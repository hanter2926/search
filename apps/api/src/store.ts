import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { randomUUID } from "node:crypto";
import type { AuthUser, Contact, ConversationDetail, Message, MessageRequest, UserSummary } from "@search/shared";

export interface StoredUser extends AuthUser {
  passwordHash: string;
  createdAt: string;
}

interface StoreData {
  users: StoredUser[];
  conversations: ConversationDetail[];
  messages: Message[];
  sessions: Record<string, string>;
  contacts: Array<Contact & { ownerId: string }>;
  messageRequests: MessageRequest[];
}

const filePath = process.env.SEARCH_DATA_FILE ?? join(process.cwd(), "data", "search.json");
const emptyData: StoreData = { users: [], conversations: [], messages: [], sessions: {}, contacts: [], messageRequests: [] };

let data: StoreData | undefined;
let writeQueue = Promise.resolve();

async function load(): Promise<StoreData> {
  if (data) return data;
  try {
    data = JSON.parse(await readFile(filePath, "utf8")) as StoreData;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    data = structuredClone(emptyData);
    await mkdir(dirname(filePath), { recursive: true });
    await writeFile(filePath, JSON.stringify(data, null, 2));
  }
  return data;
}

async function persist(): Promise<void> {
  const snapshot = JSON.stringify(data, null, 2);
  writeQueue = writeQueue.then(() => writeFile(filePath, snapshot));
  await writeQueue;
}

export async function findUserByEmail(email: string): Promise<StoredUser | undefined> {
  return (await load()).users.find((user) => user.email === email.toLowerCase());
}

export async function findUserById(id: string): Promise<StoredUser | undefined> {
  return (await load()).users.find((user) => user.id === id);
}

export async function createUser(input: Omit<StoredUser, "id" | "createdAt">): Promise<StoredUser> {
  const store = await load();
  const user: StoredUser = { ...input, id: randomUUID(), createdAt: new Date().toISOString() };
  store.users.push(user);
  await persist();
  return user;
}

export async function createSession(userId: string): Promise<string> {
  const store = await load();
  const token = randomUUID() + randomUUID();
  store.sessions[token] = userId;
  await persist();
  return token;
}

export async function userIdForToken(token: string): Promise<string | undefined> {
  return (await load()).sessions[token];
}

export async function listConversations(userId: string): Promise<ConversationDetail[]> {
  return (await load()).conversations.filter((conversation) =>
    conversation.participants.some((participant) => participant.id === userId)
  ).map((conversation) => ({
    ...conversation,
    unreadCount: conversation.unreadCounts?.[userId] ?? conversation.unreadCount ?? 0
  }));
}

export async function findOrCreateConversation(userId: string, otherUserId: string): Promise<ConversationDetail> {
  const store = await load();
  const existing = store.conversations.find((conversation) => {
    const ids = conversation.participants.map((participant) => participant.id).sort();
    return ids.length === 2 && ids.join() === [userId, otherUserId].sort().join();
  });
  if (existing) return existing;
  const users = await Promise.all([findUserById(userId), findUserById(otherUserId)]);
  if (!users[0] || !users[1]) throw new Error("User not found");
  const conversation: ConversationDetail = {
    id: randomUUID(),
    title: users[1].displayName,
    participants: users.filter((user): user is StoredUser => Boolean(user)).map(toSummary),
    unreadCount: 0,
    createdAt: new Date().toISOString()
  };
  store.conversations.push(conversation);
  await persist();
  return conversation;
}

export async function areContacts(firstId: string, secondId: string): Promise<boolean> {
  const store = await load();
  return store.contacts.some((contact) => contact.ownerId === firstId && contact.user.id === secondId) &&
    store.contacts.some((contact) => contact.ownerId === secondId && contact.user.id === firstId);
}

export async function createMessageRequest(fromId: string, toId: string): Promise<MessageRequest> {
  const store = await load();
  const from = await findUserById(fromId);
  const to = await findUserById(toId);
  if (!from || !to) throw new Error("User not found");
  const existing = store.messageRequests.find((item) => item.from.id === fromId && item.to.id === toId && item.status === "pending");
  if (existing) return existing;
  const request: MessageRequest = { id: randomUUID(), from: toSummary(from), to: toSummary(to), status: "pending", createdAt: new Date().toISOString() };
  store.messageRequests.push(request);
  await persist();
  return request;
}

export async function listMessageRequests(userId: string): Promise<MessageRequest[]> {
  return (await load()).messageRequests.filter((item) => item.to.id === userId || item.from.id === userId);
}

export async function updateMessageRequest(requestId: string, userId: string, status: "accepted" | "rejected"): Promise<MessageRequest | undefined> {
  const store = await load();
  const request = store.messageRequests.find((item) => item.id === requestId && item.to.id === userId);
  if (!request) return undefined;
  request.status = status;
  if (status === "accepted") {
    store.contacts.push({ ownerId: request.from.id, user: request.to, createdAt: request.createdAt });
    store.contacts.push({ ownerId: request.to.id, user: request.from, createdAt: request.createdAt });
  }
  await persist();
  return request;
}

export async function listContacts(userId: string): Promise<Contact[]> {
  return (await load()).contacts.filter((contact) => contact.ownerId === userId).map(({ ownerId: _ownerId, ...contact }) => contact);
}

export async function listMessages(conversationId: string): Promise<Message[]> {
  return (await load()).messages
    .filter((message) => message.conversationId === conversationId)
    .map(normalizeMessage);
}

export async function createMessage(message: Message): Promise<Message> {
  const store = await load();
  store.messages.push(message);
  const conversation = store.conversations.find((item) => item.id === message.conversationId);
  if (conversation) conversation.lastMessage = message;
  if (conversation) {
    conversation.unreadCounts ??= {};
    for (const participant of conversation.participants) {
      if (participant.id !== message.sender.id) {
        conversation.unreadCounts[participant.id] = (conversation.unreadCounts[participant.id] ?? 0) + 1;
      }
    }
  }
  await persist();
  return message;
}

export async function findMessage(messageId: string): Promise<Message | undefined> {
  const message = (await load()).messages.find((item) => item.id === messageId);
  return message ? normalizeMessage(message) : undefined;
}

function normalizeMessage(message: Message): Message {
  return {
    ...message,
    starredBy: message.starredBy ?? [],
    pinned: message.pinned ?? false,
    reactions: message.reactions ?? {},
    deliveredTo: message.deliveredTo ?? [],
    readBy: message.readBy ?? []
  };
}

export async function updateMessage(messageId: string, update: Partial<Pick<Message, "body" | "editedAt" | "deletedAt" | "starredBy" | "pinned" | "reactions">>): Promise<Message | undefined> {
  const store = await load();
  const message = store.messages.find((item) => item.id === messageId);
  if (!message) return undefined;
  Object.assign(message, update);
  const conversation = store.conversations.find((item) => item.id === message.conversationId);
  if (conversation?.lastMessage?.id === message.id) conversation.lastMessage = message;
  await persist();
  return normalizeMessage(message);
}

export async function markMessage(messageId: string, userId: string, field: "deliveredTo" | "readBy"): Promise<Message | undefined> {
  const message = (await load()).messages.find((item) => item.id === messageId);
  if (!message) return undefined;
  const normalized = normalizeMessage(message);
  if (!normalized[field].includes(userId)) normalized[field].push(userId);
  if (field === "readBy") normalized.status = "read";
  else if (normalized.status === "sent") normalized.status = "delivered";
  Object.assign(message, normalized);
  await persist();
  return normalized;
}

export async function clearUnread(conversationId: string, userId: string): Promise<void> {
  const conversation = (await load()).conversations.find((item) => item.id === conversationId);
  if (!conversation) return;
  conversation.unreadCounts ??= {};
  conversation.unreadCounts[userId] = 0;
  await persist();
}

export async function searchMessages(userId: string, query: string): Promise<Message[]> {
  const conversations = await listConversations(userId);
  const allowed = new Set(conversations.map((conversation) => conversation.id));
  const term = query.toLowerCase();
  return (await load()).messages
    .filter((message) => allowed.has(message.conversationId) && !message.deletedAt && message.body.toLowerCase().includes(term))
    .map(normalizeMessage);
}

export function toSummary(user: StoredUser): UserSummary {
  const { id, displayName, handle, avatarUrl, presence } = user;
  return { id, displayName, handle, avatarUrl, presence };
}

export function toAuthUser(user: StoredUser): AuthUser {
  const { passwordHash: _passwordHash, createdAt: _createdAt, ...publicUser } = user;
  return publicUser;
}
