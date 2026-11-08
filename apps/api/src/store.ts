import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import "./env.js";
import { randomUUID } from "node:crypto";
import type { AuthUser, Contact, ConversationDetail, Group, Message, MessageRequest, PrivacySettings, UserSummary } from "@search/shared";

export interface StoredUser extends AuthUser {
  passwordHash: string;
  createdAt: string;
}

interface StoreData {
  users: StoredUser[];
  conversations: ConversationDetail[];
  messages: Message[];
  sessions: Record<string, string>;
  sessionExpiresAt: Record<string, string>;
  contacts: Array<Contact & { ownerId: string }>;
  messageRequests: MessageRequest[];
  pendingRegistrations: PendingRegistration[];
  groups: Group[];
}

export interface PendingRegistration {
  id: string;
  email: string;
  displayName?: string;
  handle?: string;
  otpHash: string;
  otpExpiresAt: string;
  resendAvailableAt: string;
  attempts: number;
  createdAt: string;
}

const filePath = process.env.SEARCH_DATA_FILE ?? join(process.cwd(), "data", "search.json");
const emptyData: StoreData = { users: [], conversations: [], messages: [], sessions: {}, sessionExpiresAt: {}, contacts: [], messageRequests: [], pendingRegistrations: [], groups: [] };

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
  data.pendingRegistrations ??= [];
  data.sessionExpiresAt ??= {};
  data.groups ??= [];
  for (const user of data.users) {
    user.privacy ??= { discoverableByEmail: true, allowMessageRequests: true };
  }

  return data;
}

async function persist(): Promise<void> {
  const snapshot = JSON.stringify(data, null, 2);
  writeQueue = writeQueue.then(() => writeFile(filePath, snapshot));
  await writeQueue;
}

export async function createGroup(ownerId: string, name: string, memberIds: string[]): Promise<Group> {
  const store = await load();
  const ids = [...new Set([ownerId, ...memberIds])];
  const users = await Promise.all(ids.map((id) => findUserById(id)));
  if (users.some((user) => !user)) throw new Error("User not found");
  const members = users.filter((user): user is StoredUser => Boolean(user)).map(toSummary);
  const conversation: ConversationDetail = {
    id: randomUUID(),
    title: name,
    participants: members,
    unreadCount: 0,
    createdAt: new Date().toISOString(),
    kind: "group",
    admins: [ownerId]
  };
  const group: Group = { id: randomUUID(), name, conversationId: conversation.id, members, admins: [ownerId], createdAt: conversation.createdAt };
  store.conversations.push(conversation);
  store.groups.push(group);
  await persist();
  return group;
}

export async function listGroups(userId: string): Promise<Group[]> {
  return (await load()).groups.filter((group) => group.members.some((member) => member.id === userId));
}

export async function addGroupMember(groupId: string, actorId: string, memberId: string): Promise<Group | undefined> {
  const store = await load();
  const group = store.groups.find((item) => item.id === groupId);
  if (!group || !group.admins.includes(actorId) || group.members.some((member) => member.id === memberId)) return undefined;
  const user = await findUserById(memberId);
  if (!user) return undefined;
  group.members.push(toSummary(user));
  const conversation = store.conversations.find((item) => item.id === group.conversationId);
  if (conversation) conversation.participants = group.members;
  await persist();
  return group;
}

export async function findUserByEmail(email: string): Promise<StoredUser | undefined> {
  return (await load()).users.find((user) => user.email === email.toLowerCase());
}

export async function updateUserPrivacy(userId: string, privacy: PrivacySettings): Promise<StoredUser | undefined> {
  const store = await load();
  const user = store.users.find((item) => item.id === userId);
  if (!user) return undefined;
  user.privacy = privacy;
  await persist();
  return user;
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

export async function findPendingRegistration(email: string): Promise<PendingRegistration | undefined> {
  return (await load()).pendingRegistrations.find((item) => item.email === email.toLowerCase());
}

export async function savePendingRegistration(registration: PendingRegistration): Promise<void> {
  const store = await load();
  store.pendingRegistrations = store.pendingRegistrations.filter((item) => item.email !== registration.email);
  store.pendingRegistrations.push(registration);
  await persist();
}

export async function removePendingRegistration(id: string): Promise<PendingRegistration | undefined> {
  const store = await load();
  const index = store.pendingRegistrations.findIndex((item) => item.id === id);
  if (index < 0) return undefined;
  const [registration] = store.pendingRegistrations.splice(index, 1);
  await persist();
  return registration;
}

export async function createSession(userId: string): Promise<string> {
  const store = await load();
  const token = randomUUID() + randomUUID();
  store.sessions[token] = userId;
  store.sessionExpiresAt[token] = new Date(Date.now() + 30 * 24 * 60 * 60_000).toISOString();
  await persist();
  return token;
}

export async function userIdForToken(token: string): Promise<string | undefined> {
  const store = await load();
  const expiresAt = store.sessionExpiresAt[token];
  if (expiresAt && Date.parse(expiresAt) <= Date.now()) {
    delete store.sessions[token];
    delete store.sessionExpiresAt[token];
    await persist();
    return undefined;
  }
  return store.sessions[token];
}

export async function deleteSession(token: string): Promise<void> {
  const store = await load();
  delete store.sessions[token];
  delete store.sessionExpiresAt[token];
  await persist();
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

export async function updateContactName(ownerId: string, contactId: string, customName: string | undefined): Promise<Contact | undefined> {
  const store = await load();
  const contact = store.contacts.find((item) => item.ownerId === ownerId && item.user.id === contactId);
  if (!contact) return undefined;
  contact.customName = customName;
  await persist();
  const { ownerId: _ownerId, ...publicContact } = contact;
  return publicContact;
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
