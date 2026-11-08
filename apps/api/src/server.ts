import { createServer } from "node:http";
import { randomUUID } from "node:crypto";
import cors from "cors";
import express, { type ErrorRequestHandler, type Request, type Response } from "express";
import helmet from "helmet";
import { pinoHttp } from "pino-http";
import { Server } from "socket.io";
import type { CreateMessageInput, HealthResponse, Message } from "@search/shared";
import {
  createMessage,
  createSession,
  deleteSession,
  createUser,
  findPendingRegistration,
  findMessage,
  findOrCreateConversation,
  findUserByEmail,
  findUserById,
  clearUnread,
  areContacts,
  createMessageRequest,
  listConversations,
  listMessages,
  markMessage,
  listContacts,
  listMessageRequests,
  searchMessages,
  toAuthUser,
  toSummary,
  updateMessage,
  updateContactName,
  updateMessageRequest,
  userIdForToken,
  savePendingRegistration,
  removePendingRegistration
} from "./store.js";
import type { PendingRegistration, StoredUser } from "./store.js";
import { createOtp, hashOtp } from "./security.js";
import { sendVerificationCode } from "./email.js";
import { integrationHealth, persistenceMode, supabaseConfigured, verifySupabase } from "./integrations.js";

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, { cors: { origin: process.env.WEB_ORIGIN ?? "http://localhost:5173" } });
const port = Number(process.env.PORT ?? 4000);
const attempts = new Map<string, { count: number; resetAt: number }>();
const otpLocks = new Map<string, Promise<unknown>>();

app.disable("x-powered-by");
app.use(helmet());
app.use(cors({ origin: process.env.WEB_ORIGIN ?? "http://localhost:5173" }));
app.use(express.json({ limit: "1mb" }));
app.use(pinoHttp());

function auth(request: Request, response: Response): string | undefined {
  const token = request.header("authorization")?.replace(/^Bearer\s+/i, "");
  if (!token) {
    response.status(401).json({ error: "Authentication required" });
    return undefined;
  }
  return token;
}

async function currentUser(request: Request, response: Response) {
  const token = auth(request, response);
  if (!token) return undefined;
  const userId = await userIdForToken(token);
  if (!userId) {
    response.status(401).json({ error: "Invalid session" });
    return undefined;
  }
  const user = await findUserById(userId);
  if (!user) {
    response.status(401).json({ error: "Session user no longer exists" });
    return undefined;
  }
  return { token, user };
}

function limited(key: string): boolean {
  const now = Date.now();
  const current = attempts.get(key);
  if (!current || current.resetAt <= now) {
    attempts.set(key, { count: 1, resetAt: now + 60_000 });
    return false;
  }

  current.count += 1;
  return current.count > 30;
}

async function withOtpLock<T>(email: string, operation: () => Promise<T>): Promise<T> {
  const normalized = email.toLowerCase();
  const previous = otpLocks.get(normalized) ?? Promise.resolve();
  const current = previous.catch(() => undefined).then(operation);
  otpLocks.set(normalized, current);
  try {
    return await current;
  } finally {
    if (otpLocks.get(normalized) === current) otpLocks.delete(normalized);
  }
}

app.get("/health", async (_request, response) => {
  const integrations = await integrationHealth();
  const payload: HealthResponse = {
    status: "ok",
    service: "search-api",
    timestamp: new Date().toISOString(),
    persistence: persistenceMode,
    redis: integrations.redis,
    email: integrations.email
  };
  response.json(payload);
});

app.get("/health/integrations", async (_request, response) => {
  const integrations = await integrationHealth();
  const supabaseConnected = await verifySupabase();
  response.json({
    persistence: persistenceMode,
    supabase: !supabaseConfigured
      ? "not_configured"
      : supabaseConnected
        ? "configured_but_unused"
        : "unavailable",
    ...integrations
  });
});

app.post("/api/auth/request-otp", async (request, response) => {
  const { email } = request.body as Record<string, unknown>;
  if (typeof email !== "string" || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
    response.status(400).json({ error: "A valid email address is required" });
    return;
  }
  if (limited(`${request.ip ?? "unknown"}:${email.toLowerCase()}`)) {
    response.status(429).json({ error: "Too many code requests. Please try again later." });
    return;
  }
  await withOtpLock(email, async () => {
    const normalizedEmail = email.trim().toLowerCase();
    const existing = await findPendingRegistration(normalizedEmail);
    if (existing && Date.parse(existing.resendAvailableAt) > Date.now()) {
      response.status(429).json({ error: "Please wait before requesting another code" });
      return;
    }
    const otp = createOtp();
    const pending: PendingRegistration = {
      id: existing?.id ?? randomUUID(),
      email: normalizedEmail,
      otpHash: hashOtp(otp),
      otpExpiresAt: new Date(Date.now() + 5 * 60_000).toISOString(),
      resendAvailableAt: new Date(Date.now() + 30_000).toISOString(),
      attempts: 0,
      createdAt: existing?.createdAt ?? new Date().toISOString()
    };
    await savePendingRegistration(pending);
    try {
      await sendVerificationCode(normalizedEmail, otp);
      response.status(202).json({ verificationRequired: true, email: normalizedEmail });
    } catch (error) {
      await removePendingRegistration(pending.id);
      response.status(503).json({ error: error instanceof Error ? error.message : "Email delivery is unavailable" });
    }
  });
});

app.post("/api/auth/verify-email", async (request, response) => {
  const { email, otp } = request.body as Record<string, unknown>;
  if (typeof email !== "string" || typeof otp !== "string" || !/^\d{6}$/.test(otp)) {
    response.status(400).json({ error: "A valid email and six-digit verification code are required" });
    return;
  }
  await withOtpLock(email, async () => {
    const pending = await findPendingRegistration(email);
    if (!pending || Date.parse(pending.otpExpiresAt) <= Date.now()) {
      response.status(400).json({ error: "That verification code is invalid or expired" });
      return;
    }
    if (pending.attempts >= 5) {
      response.status(429).json({ error: "Too many verification attempts. Request a new code." });
      return;
    }
    pending.attempts += 1;
    if (hashOtp(otp) !== pending.otpHash) {
      await savePendingRegistration(pending);
      response.status(400).json({ error: "That verification code is invalid or expired" });
      return;
    }
    const normalizedEmail = email.trim().toLowerCase();
    const existing = await findUserByEmail(normalizedEmail);
    const localName = normalizedEmail.split("@")[0].replace(/[._-]+/g, " ").trim();
    const handleBase = normalizedEmail.split("@")[0].replace(/[^a-z0-9]/gi, "").slice(0, 18) || "user";
    const user = existing
      ? existing
      : await createUser({
          email: normalizedEmail,
          displayName: localName || "SEARCH user",
          handle: `${handleBase}-${randomUUID().slice(0, 6)}`,
          about: "",
          presence: "online",
          passwordHash: ""
        });
    await removePendingRegistration(pending.id);
    const token = await createSession(user.id);
    response.status(201).json({ user: toAuthUser(user), token, existingAccount: Boolean(existing) });
  });
});

app.post("/api/auth/login", async (request, response) => {
  response.status(410).json({ error: "Password authentication has been removed. Use /api/auth/request-otp." });
});

app.post("/api/auth/register", async (_request, response) => {
  response.status(410).json({ error: "Password registration has been removed. Use /api/auth/request-otp." });
});

app.post("/api/auth/logout", async (request, response) => {
  const token = request.header("authorization")?.replace(/^Bearer\s+/i, "");
  if (token) await deleteSession(token);
  response.status(204).end();
});

app.get("/api/me", async (request, response) => {
  const session = await currentUser(request, response);
  if (session) response.json(toAuthUser(session.user));
});

app.get("/api/users", async (request, response) => {
  const session = await currentUser(request, response);
  if (!session) return;
  const query = String(request.query.q ?? "").trim().toLowerCase();
  if (query.length < 2) {
    response.json([]);
    return;
  }
  const candidates = await Promise.all([findUserByEmail(query), findUserById(query)]);
  const users: StoredUser[] = [];
  for (const user of candidates) {
    if (user && user.id !== session.user.id) users.push(user);
  }
  response.json(users.map(toSummary));
});

app.get("/api/conversations", async (request, response) => {
  const session = await currentUser(request, response);
  if (session) response.json(await listConversations(session.user.id));
});

app.get("/api/contacts", async (request, response) => {
  const session = await currentUser(request, response);
  if (session) response.json(await listContacts(session.user.id));
});

app.patch("/api/contacts/:contactId", async (request, response) => {
  const session = await currentUser(request, response);
  if (!session) return;
  const customName = request.body?.customName;
  if (customName !== undefined && (typeof customName !== "string" || customName.trim().length > 80)) {
    response.status(400).json({ error: "Custom name must be at most 80 characters" });
    return;
  }
  const contact = await updateContactName(session.user.id, request.params.contactId, typeof customName === "string" && customName.trim() ? customName.trim() : undefined);
  if (!contact) {
    response.status(404).json({ error: "Contact not found" });
    return;
  }
  response.json(contact);
});

app.get("/api/message-requests", async (request, response) => {
  const session = await currentUser(request, response);
  if (session) response.json(await listMessageRequests(session.user.id));
});

app.post("/api/message-requests", async (request, response) => {
  const session = await currentUser(request, response);
  const userId = request.body?.userId;
  if (!session) return;
  if (typeof userId !== "string" || userId === session.user.id || !(await findUserById(userId))) {
    response.status(400).json({ error: "A valid recipient is required" });
    return;
  }
  if (await areContacts(session.user.id, userId)) {
    response.status(409).json({ error: "Users are already contacts" });
    return;
  }
  response.status(201).json(await createMessageRequest(session.user.id, userId));
});

app.post("/api/message-requests/:requestId/:decision", async (request, response) => {
  const session = await currentUser(request, response);
  const decision = request.params.decision;
  if (!session) return;
  if (decision !== "accept" && decision !== "reject") {
    response.status(400).json({ error: "Decision must be accept or reject" });
    return;
  }
  const result = await updateMessageRequest(request.params.requestId, session.user.id, decision === "accept" ? "accepted" : "rejected");
  if (!result) {
    response.status(404).json({ error: "Message request not found" });
    return;
  }
  response.json(result);
});

app.post("/api/conversations", async (request, response) => {
  const session = await currentUser(request, response);
  const otherUserId = request.body?.userId;
  if (!session) return;
  if (typeof otherUserId !== "string" || !(await findUserById(otherUserId))) {
    response.status(400).json({ error: "A valid userId is required" });
    return;
  }
  if (!(await areContacts(session.user.id, otherUserId))) {
    response.status(403).json({ error: "Accept a message request before starting a conversation" });
    return;
  }
  response.status(201).json(await findOrCreateConversation(session.user.id, otherUserId));
});

app.get("/api/conversations/:conversationId/messages", async (request, response) => {
  const session = await currentUser(request, response);
  if (!session) return;
  const conversations = await listConversations(session.user.id);
  if (!conversations.some((conversation) => conversation.id === request.params.conversationId)) {
    response.status(403).json({ error: "You are not a member of this conversation" });
    return;
  }
  response.json(await listMessages(request.params.conversationId));
});

async function writeMessage(userId: string, conversationId: string, input: CreateMessageInput): Promise<Message> {
  const user = await findUserById(userId);
  if (!user) throw new Error("User not found");
  const reply = input.replyToId ? await findMessage(input.replyToId) : undefined;
  const forwarded = input.forwardedFromId ? await findMessage(input.forwardedFromId) : undefined;
  return createMessage({
    id: randomUUID(),
    conversationId,
    sender: toSummary(user),
    body: input.body.trim(),
    createdAt: new Date().toISOString(),
    status: "sent",
    starredBy: [],
    pinned: false,
    reactions: {},
    deliveredTo: [userId],
    readBy: [userId],
    replyTo: reply ? { id: reply.id, body: reply.deletedAt ? "Message deleted" : reply.body, senderName: reply.sender.displayName } : undefined,
    forwardedFromId: forwarded?.id
  });
}

app.post("/api/conversations/:conversationId/messages", async (request, response) => {
  const session = await currentUser(request, response);
  if (!session) return;
  const conversations = await listConversations(session.user.id);
  if (!conversations.some((conversation) => conversation.id === request.params.conversationId)) {
    response.status(403).json({ error: "You are not a member of this conversation" });
    return;
  }
  const input = request.body as CreateMessageInput;
  if (typeof input.body !== "string" || input.body.trim().length === 0 || input.body.length > 10_000) {
    response.status(400).json({ error: "Message body must contain between 1 and 10,000 characters" });
    return;
  }
  const message = await writeMessage(session.user.id, request.params.conversationId, input);
  io.to(`conversation:${message.conversationId}`).emit("message:new", message);
  response.status(201).json(message);
});

app.get("/api/search/messages", async (request, response) => {
  const session = await currentUser(request, response);
  if (!session) return;
  const query = String(request.query.q ?? "").trim();
  if (query.length < 2 || query.length > 200) {
    response.status(400).json({ error: "Search query must contain between 2 and 200 characters" });
    return;
  }
  response.json(await searchMessages(session.user.id, query));
});

app.post("/api/conversations/:conversationId/read", async (request, response) => {
  const session = await currentUser(request, response);
  if (!session) return;
  const conversation = (await listConversations(session.user.id)).find((item) => item.id === request.params.conversationId);
  if (!conversation) {
    response.status(403).json({ error: "You are not a member of this conversation" });
    return;
  }
  await clearUnread(conversation.id, session.user.id);
  response.status(204).end();
});

async function authorizedMessage(request: Request, response: Response) {
  const session = await currentUser(request, response);
  if (!session) return undefined;
  const message = await findMessage(String(request.params.messageId));
  if (!message) {
    response.status(404).json({ error: "Message not found" });
    return undefined;
  }
  const conversations = await listConversations(session.user.id);
  if (!conversations.some((conversation) => conversation.id === message.conversationId)) {
    response.status(403).json({ error: "You are not a member of this conversation" });
    return undefined;
  }
  return { session, message };
}

app.patch("/api/messages/:messageId", async (request, response) => {
  const authorized = await authorizedMessage(request, response);
  if (!authorized) return;
  if (authorized.message.sender.id !== authorized.session.user.id) {
    response.status(403).json({ error: "Only the sender can edit this message" });
    return;
  }
  const body = request.body?.body;
  if (typeof body !== "string" || body.trim().length === 0 || body.length > 10_000) {
    response.status(400).json({ error: "Message body must contain between 1 and 10,000 characters" });
    return;
  }
  const message = await updateMessage(authorized.message.id, { body: body.trim(), editedAt: new Date().toISOString() });
  io.to(`conversation:${authorized.message.conversationId}`).emit("message:updated", message);
  response.json(message);
});

app.delete("/api/messages/:messageId", async (request, response) => {
  const authorized = await authorizedMessage(request, response);
  if (!authorized) return;
  if (authorized.message.sender.id !== authorized.session.user.id) {
    response.status(403).json({ error: "Only the sender can delete this message" });
    return;
  }
  const message = await updateMessage(authorized.message.id, { body: "", deletedAt: new Date().toISOString() });
  io.to(`conversation:${authorized.message.conversationId}`).emit("message:updated", message);
  response.json(message);
});

app.post("/api/messages/:messageId/star", async (request, response) => {
  const authorized = await authorizedMessage(request, response);
  if (!authorized) return;
  const starredBy = authorized.message.starredBy.includes(authorized.session.user.id)
    ? authorized.message.starredBy.filter((id) => id !== authorized.session.user.id)
    : [...authorized.message.starredBy, authorized.session.user.id];
  const message = await updateMessage(authorized.message.id, { starredBy });
  io.to(`conversation:${authorized.message.conversationId}`).emit("message:updated", message);
  response.json(message);
});

app.post("/api/messages/:messageId/pin", async (request, response) => {
  const authorized = await authorizedMessage(request, response);
  if (!authorized) return;
  const message = await updateMessage(authorized.message.id, { pinned: !authorized.message.pinned });
  io.to(`conversation:${authorized.message.conversationId}`).emit("message:updated", message);
  response.json(message);
});

app.post("/api/messages/:messageId/reactions", async (request, response) => {
  const authorized = await authorizedMessage(request, response);
  if (!authorized) return;
  const emoji = request.body?.emoji;
  if (typeof emoji !== "string" || [...emoji].length < 1 || [...emoji].length > 8) {
    response.status(400).json({ error: "A valid emoji reaction is required" });
    return;
  }
  const reactions = structuredClone(authorized.message.reactions);
  const users = reactions[emoji] ?? [];
  reactions[emoji] = users.includes(authorized.session.user.id)
    ? users.filter((id) => id !== authorized.session.user.id)
    : [...users, authorized.session.user.id];
  if (reactions[emoji].length === 0) delete reactions[emoji];
  const message = await updateMessage(authorized.message.id, { reactions });
  io.to(`conversation:${authorized.message.conversationId}`).emit("message:updated", message);
  response.json(message);
});

app.post("/api/messages/:messageId/delivered", async (request, response) => {
  const authorized = await authorizedMessage(request, response);
  if (!authorized) return;
  const message = await markMessage(authorized.message.id, authorized.session.user.id, "deliveredTo");
  io.to(`conversation:${authorized.message.conversationId}`).emit("message:receipt", message);
  response.json(message);
});

app.post("/api/messages/:messageId/read", async (request, response) => {
  const authorized = await authorizedMessage(request, response);
  if (!authorized) return;
  const message = await markMessage(authorized.message.id, authorized.session.user.id, "readBy");
  io.to(`conversation:${authorized.message.conversationId}`).emit("message:receipt", message);
  response.json(message);
});

app.post("/api/messages/:messageId/forward", async (request, response) => {
  const authorized = await authorizedMessage(request, response);
  if (!authorized) return;
  const targetId = request.body?.conversationId;
  if (typeof targetId !== "string" || !(await listConversations(authorized.session.user.id)).some((conversation) => conversation.id === targetId)) {
    response.status(403).json({ error: "You are not a member of the target conversation" });
    return;
  }
  const message = await writeMessage(authorized.session.user.id, targetId, { body: authorized.message.body, forwardedFromId: authorized.message.id });
  io.to(`conversation:${message.conversationId}`).emit("message:new", message);
  response.status(201).json(message);
});

io.use(async (socket, next) => {
  const token = socket.handshake.auth.token;
  const userId = typeof token === "string" ? await userIdForToken(token) : undefined;
  if (!userId) {
    next(new Error("Unauthorized"));
    return;
  }
  socket.data.userId = userId;
  next();
});

io.on("connection", async (socket) => {
  const conversations = await listConversations(socket.data.userId as string);
  for (const conversation of conversations) socket.join(`conversation:${conversation.id}`);
  socket.on("conversation:typing", (conversationId: string) => {
    socket.to(`conversation:${conversationId}`).emit("conversation:typing", { userId: socket.data.userId, conversationId });
  });
});

app.use((_request, response) => response.status(404).json({ error: "Route not found" }));
const errorHandler: ErrorRequestHandler = (error, _request, response, _next) => {
  console.error(error);
  response.status(500).json({ error: "Internal server error" });
};
app.use(errorHandler);

httpServer.listen(port, () => console.log(`SEARCH API listening on http://localhost:${port}`));
