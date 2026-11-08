import { StrictMode, useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";
import { createRoot } from "react-dom/client";
import { io, type Socket } from "socket.io-client";
import type { AuthResponse, AuthUser, ConversationDetail, Message, UserSummary } from "@search/shared";
import "./styles.css";

const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:4000";
const storedToken = localStorage.getItem("search-token");

async function request<T>(path: string, options: RequestInit = {}, token = storedToken): Promise<T> {
  const response = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}), ...options.headers }
  });
  const payload = await response.json() as T & { error?: string };
  if (!response.ok) throw new Error(payload.error ?? "Request failed");
  return payload;
}

function AuthScreen({ onAuthenticated }: { onAuthenticated: (result: AuthResponse) => void }) {
  const [registering, setRegistering] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true); setError("");
    try {
      const result = await request<AuthResponse>(registering ? "/api/auth/register" : "/api/auth/login", {
        method: "POST", body: JSON.stringify({ email, password, displayName })
      }, undefined);
      onAuthenticated(result);
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Unable to authenticate"); }
    finally { setBusy(false); }
  }

  return <main className="auth-page"><div className="auth-card"><div className="brand"><span className="brand-mark">S</span><span>SEARCH</span></div><h1>{registering ? "Create your account" : "Welcome back"}</h1><p className="auth-subtitle">Private conversations, in focus.</p><form onSubmit={submit}>{registering && <input required value={displayName} onChange={(event) => setDisplayName(event.target.value)} placeholder="Display name" /> }<input required type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="Email address" /><input required minLength={8} type="password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Password (8+ characters)" />{error && <p className="form-error">{error}</p>}<button className="primary-button" disabled={busy}>{busy ? "Please wait..." : registering ? "Create account" : "Sign in"}</button></form><button className="link-button" onClick={() => { setRegistering(!registering); setError(""); }}>{registering ? "Already have an account? Sign in" : "New to SEARCH? Create an account"}</button></div></main>;
}

function App() {
  const [token, setToken] = useState(storedToken);
  const [user, setUser] = useState<AuthUser | null>(null);
  const [conversations, setConversations] = useState<ConversationDetail[]>([]);
  const [activeId, setActiveId] = useState<string>();
  const [messages, setMessages] = useState<Message[]>([]);
  const [socket, setSocket] = useState<Socket>();
  const [draft, setDraft] = useState("");
  const [error, setError] = useState("");
  const [showNew, setShowNew] = useState(false);
  const [userSearch, setUserSearch] = useState("");
  const [searchResults, setSearchResults] = useState<UserSummary[]>([]);
  const [replyTo, setReplyTo] = useState<Message>();
  const [searchQuery, setSearchQuery] = useState("");
  const [messageResults, setMessageResults] = useState<Message[]>([]);

  useEffect(() => {
    if (!token) return;
    request<AuthUser>("/api/me", {}, token).then(setUser).catch(() => { localStorage.removeItem("search-token"); setToken(null); });
    request<ConversationDetail[]>("/api/conversations", {}, token).then((items) => { setConversations(items); setActiveId(items[0]?.id); }).catch((reason) => setError(reason instanceof Error ? reason.message : "Unable to load conversations"));
    const connection = io(API_URL, { auth: { token } });
    connection.on("message:new", (message: Message) => setMessages((current) => current.some((item) => item.id === message.id) ? current : [...current, message]));
    connection.on("message:updated", (message: Message) => setMessages((current) => current.map((item) => item.id === message.id ? message : item)));
    connection.on("message:receipt", (message: Message) => setMessages((current) => current.map((item) => item.id === message.id ? message : item)));
    setSocket(connection);
    return () => { connection.disconnect(); };
  }, [token]);

  useEffect(() => {
    if (!token || !activeId) return;
    request<Message[]>(`/api/conversations/${activeId}/messages`, {}, token).then((items) => {
      setMessages(items);
      void request(`/api/conversations/${activeId}/read`, { method: "POST" }, token);
      for (const item of items) if (item.sender.id !== user?.id && !item.readBy.includes(user?.id ?? "")) void request(`/api/messages/${item.id}/read`, { method: "POST" }, token);
    }).catch((reason) => setError(reason instanceof Error ? reason.message : "Unable to load messages"));
  }, [activeId, token]);

  const active = useMemo(() => conversations.find((conversation) => conversation.id === activeId), [activeId, conversations]);
  const other = active?.participants.find((participant) => participant.id !== user?.id);

  async function findUsers(value: string) {
    setUserSearch(value);
    if (value.length < 2 || !token) { setSearchResults([]); return; }
    setSearchResults(await request<UserSummary[]>(`/api/users?q=${encodeURIComponent(value)}`, {}, token));
  }

  async function openConversation(otherUserId: string) {
    if (!token) return;
    let conversation: ConversationDetail;
    try {
      conversation = await request<ConversationDetail>("/api/conversations", { method: "POST", body: JSON.stringify({ userId: otherUserId }) }, token);
    } catch {
      await request("/api/message-requests", { method: "POST", body: JSON.stringify({ userId: otherUserId }) }, token);
      setError("Message request sent. The recipient must accept it before you can chat.");
      setShowNew(false);
      return;
    }
    setConversations((current) => current.some((item) => item.id === conversation.id) ? current : [conversation, ...current]);
    setActiveId(conversation.id); setShowNew(false); setUserSearch(""); setSearchResults([]);
  }

  async function sendMessage(event: FormEvent) {
    event.preventDefault();
    if (!draft.trim() || !activeId || !token) return;
    const body = draft.trim(); setDraft("");
    try { await request<Message>(`/api/conversations/${activeId}/messages`, { method: "POST", body: JSON.stringify({ body, replyToId: replyTo?.id }) }, token); setReplyTo(undefined); }
    catch (reason) { setDraft(body); setError(reason instanceof Error ? reason.message : "Unable to send message"); }
  }

  async function react(message: Message, emoji: string) {
    if (!token) return;
    try {
      const updated = await request<Message>(`/api/messages/${message.id}/reactions`, { method: "POST", body: JSON.stringify({ emoji }) }, token);
      setMessages((current) => current.map((item) => item.id === updated.id ? updated : item));
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Unable to update reaction"); }
  }

  async function searchConversation(value: string) {
    setSearchQuery(value);
    if (!token || value.trim().length < 2) { setMessageResults([]); return; }
    try { setMessageResults(await request<Message[]>(`/api/search/messages?q=${encodeURIComponent(value)}`, {}, token)); }
    catch (reason) { setError(reason instanceof Error ? reason.message : "Unable to search messages"); }
  }

  async function updateMessage(message: Message, action: "edit" | "delete" | "star" | "pin") {
    if (!token) return;
    try {
      if (action === "edit") {
        const body = window.prompt("Edit message", message.body);
        if (body === null) return;
        const updated = await request<Message>(`/api/messages/${message.id}`, { method: "PATCH", body: JSON.stringify({ body }) }, token);
        setMessages((current) => current.map((item) => item.id === updated.id ? updated : item));
      } else {
        const updated = await request<Message>(`/api/messages/${message.id}/${action}`, { method: action === "delete" ? "DELETE" : "POST" }, token);
        setMessages((current) => current.map((item) => item.id === updated.id ? updated : item));
      }
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Unable to update message"); }
  }

  function signOut() { localStorage.removeItem("search-token"); setToken(null); setUser(null); socket?.disconnect(); }
  if (!token || !user) return <AuthScreen onAuthenticated={(result) => { localStorage.setItem("search-token", result.token); setToken(result.token); setUser(result.user); }} />;

  return <main className="app-shell">
    <aside className="sidebar"><div className="brand"><span className="brand-mark">S</span><span>SEARCH</span></div><div className="profile-card"><div className="avatar coral">{user.displayName.slice(0, 2).toUpperCase()}</div><div><strong>{user.displayName}</strong><span>@{user.handle}</span></div><button onClick={signOut} aria-label="Sign out">↪</button></div><label className="search-box"><span>⌕</span><input aria-label="Search messages" value={searchQuery} onChange={(event) => void searchConversation(event.target.value)} placeholder="Search messages" /></label>{messageResults.length > 0 && <div className="new-conversation search-results">{messageResults.map((result) => <button key={result.id} onClick={() => { setActiveId(result.conversationId); setMessageResults([]); }}><span>{result.body || "Message deleted"}</span></button>)}</div>}<div className="section-heading"><span>Conversations</span><button aria-label="New conversation" onClick={() => setShowNew(!showNew)}>＋</button></div>{showNew && <div className="new-conversation"><input autoFocus value={userSearch} onChange={(event) => void findUsers(event.target.value)} placeholder="Find by email or ID" />{searchResults.map((result) => <button key={result.id} onClick={() => void openConversation(result.id)}><div className="avatar blue small">{result.displayName.slice(0, 2).toUpperCase()}</div><span>{result.displayName}<small>{result.handle}</small></span></button>)}</div>}<nav className="conversation-list">{conversations.map((conversation) => { const participant = conversation.participants.find((item) => item.id !== user.id); return <button className={`conversation ${conversation.id === activeId ? "selected" : ""}`} key={conversation.id} onClick={() => setActiveId(conversation.id)}><div className="avatar coral">{participant?.displayName.slice(0, 2).toUpperCase() ?? "??"}</div><div className="conversation-copy"><div><strong>{participant?.displayName ?? conversation.title}</strong><time>{conversation.lastMessage ? new Date(conversation.lastMessage.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : ""}</time></div><p>{conversation.lastMessage?.body ?? "Start a conversation"}</p>{conversation.unreadCount > 0 && <span className="unread">{conversation.unreadCount}</span>}</div></button>; })}</nav><div className="sidebar-footer"><button>⚙ <span>Settings</span></button><button>?</button></div></aside>
    <section className="chat-panel">{active && other ? <><header className="chat-header"><div className="chat-person"><div className="avatar coral">{other.displayName.slice(0, 2).toUpperCase()}</div><div><strong>{other.displayName}</strong><span><i /> {other.presence}</span></div></div><div className="header-actions"><button title="Calls require a configured WebRTC provider">▣</button><button>•••</button></div></header><div className="messages">{replyTo && <div className="reply-preview">Replying to: {replyTo.body}<button onClick={() => setReplyTo(undefined)}>×</button></div>}<div className="day-divider"><span>Conversation</span></div>{messages.map((message) => <div className={`message-row ${message.sender.id === user.id ? "outgoing" : "incoming"}`} key={message.id}>{message.sender.id !== user.id && <div className="avatar coral small">{message.sender.displayName.slice(0, 2).toUpperCase()}</div>}<div><div className={`bubble ${message.deletedAt ? "deleted" : ""}`}>{message.deletedAt ? "Message deleted" : <>{message.forwardedFromId && <small className="forwarded">Forwarded</small>}{message.replyTo && <small className="quoted">{message.replyTo.senderName}: {message.replyTo.body}</small>}{message.body}</>}</div><time>{new Date(message.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })} {message.editedAt && "· edited"} {message.pinned && "· pinned"} {message.sender.id === user.id && <span className="read">{message.readBy.length > 1 ? "✓✓" : "✓"}</span>}</time><div className="message-actions"><button onClick={() => setReplyTo(message)} title="Reply">↩</button><button onClick={() => void react(message, "❤️")} title="React">❤️ {message.reactions["❤️"]?.length ?? ""}</button><button onClick={() => void updateMessage(message, "star")} title="Star message">{message.starredBy.includes(user.id) ? "★" : "☆"}</button>{message.sender.id === user.id && !message.deletedAt && <><button onClick={() => void updateMessage(message, "edit")} title="Edit message">✎</button><button onClick={() => void updateMessage(message, "delete")} title="Delete message">⌫</button></>}<button onClick={() => void updateMessage(message, "pin")} title="Pin message">{message.pinned ? "📌" : "⌖"}</button></div></div></div>)}</div><form className="composer" onSubmit={sendMessage}><button type="button" aria-label="Attachments" title="File uploads require storage configuration">＋</button><input value={draft} onChange={(event) => { setDraft(event.target.value); if (activeId) socket?.emit("conversation:typing", activeId); }} aria-label="Message" placeholder="Write a message..." /><button type="button" aria-label="Emoji">☺</button><button className="send" type="submit" aria-label="Send message">↑</button></form></> : <div className="empty-chat"><div className="brand-mark">S</div><h2>Your conversations, in focus.</h2><p>Choose a conversation or start a new one.</p></div>}{error && <button className="error-banner" onClick={() => setError("")}>{error} ×</button>}</section>
    <aside className="details-panel">{other ? <><div className="details-avatar avatar coral">{other.displayName.slice(0, 2).toUpperCase()}</div><h2>{other.displayName}</h2><p>@{other.handle}</p><span className="status"><i /> {other.presence}</span><div className="details-actions"><button title="Call integration is not configured">▣<span>Video</span></button><button title="Call integration is not configured">◌<span>Audio</span></button><button>⌕<span>Search</span></button></div><div className="details-section"><strong>Conversation</strong></div><p className="details-copy">Messages are stored securely by the SEARCH API. End-to-end encryption will be enabled once the Signal-compatible key service is configured.</p></> : <p className="details-copy">Select a conversation to view details.</p>}</aside>
  </main>;
}

createRoot(document.getElementById("root")!).render(<StrictMode><App /></StrictMode>);
