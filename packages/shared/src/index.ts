export type UserPresence = "online" | "away" | "offline";

export interface UserSummary {
  id: string;
  displayName: string;
  handle: string;
  avatarUrl?: string;
  presence: UserPresence;
}

export interface ConversationSummary {
  id: string;
  title: string;
  participants: UserSummary[];
  lastMessage?: Message;
  unreadCount: number;
}

export interface MessageReference {
  id: string;
  body: string;
  senderName: string;
}

export interface Message {
  id: string;
  conversationId: string;
  sender: UserSummary;
  body: string;
  createdAt: string;
  status: "sent" | "delivered" | "read";
  editedAt?: string;
  deletedAt?: string;
  starredBy: string[];
  pinned: boolean;
  replyTo?: MessageReference;
  forwardedFromId?: string;
  reactions: Record<string, string[]>;
  deliveredTo: string[];
  readBy: string[];
}

export interface HealthResponse {
  status: "ok";
  service: "search-api";
  timestamp: string;
  persistence?: "local" | "supabase";
  redis?: "connected" | "not_configured" | "unavailable";
  email?: "configured" | "not_configured" | "unavailable";
}

export interface AuthUser extends UserSummary {
  email: string;
  about: string;
}

export interface Contact {
  user: UserSummary;
  customName?: string;
  createdAt: string;
}

export interface MessageRequest {
  id: string;
  from: UserSummary;
  to: UserSummary;
  status: "pending" | "accepted" | "rejected";
  createdAt: string;
}

export interface AuthResponse {
  user: AuthUser;
  token: string;
}

export interface ConversationDetail extends ConversationSummary {
  createdAt: string;
  unreadCounts?: Record<string, number>;
}

export interface CreateMessageInput {
  body: string;
  replyToId?: string;
  forwardedFromId?: string;
}
