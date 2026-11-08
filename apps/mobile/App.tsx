import AsyncStorage from "@react-native-async-storage/async-storage";
import { StatusBar } from "expo-status-bar";
import { useEffect, useState } from "react";
import { ActivityIndicator, FlatList, Pressable, SafeAreaView, StyleSheet, Text, TextInput, View } from "react-native";
import type { AuthResponse, ConversationDetail, Message } from "@search/shared";

const API_URL = process.env.EXPO_PUBLIC_API_URL ?? "http://localhost:4000";

async function api<T>(path: string, options: RequestInit = {}, token?: string) {
  const response = await fetch(`${API_URL}${path}`, { ...options, headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}), ...options.headers } });
  const result = await response.json() as T & { error?: string };
  if (!response.ok) throw new Error(result.error ?? "Request failed");
  return result;
}

export default function App() {
  const [token, setToken] = useState<string>();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [registering, setRegistering] = useState(false);
  const [conversations, setConversations] = useState<ConversationDetail[]>([]);
  const [active, setActive] = useState<ConversationDetail>();
  const [messages, setMessages] = useState<Message[]>([]);
  const [draft, setDraft] = useState("");
  const [error, setError] = useState("");
  const [replyTo, setReplyTo] = useState<Message>();

  useEffect(() => { void AsyncStorage.getItem("search-token").then((value) => { if (value) setToken(value); }); }, []);
  useEffect(() => { if (token) void api<ConversationDetail[]>("/api/conversations", {}, token).then(setConversations).catch((reason) => setError(reason.message)); }, [token]);
  useEffect(() => { if (active && token) void api<Message[]>(`/api/conversations/${active.id}/messages`, {}, token).then((items) => { setMessages(items); void api(`/api/conversations/${active.id}/read`, { method: "POST" }, token); }).catch((reason) => setError(reason.message)); }, [active, token]);

  async function authenticate() {
    try {
      const result = await api<AuthResponse>(registering ? "/api/auth/register" : "/api/auth/login", { method: "POST", body: JSON.stringify({ email, password, displayName }) });
      await AsyncStorage.setItem("search-token", result.token); setToken(result.token); setError("");
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Unable to authenticate"); }
  }
  async function send() {
    if (!active || !token || !draft.trim()) return;
    const body = draft.trim(); setDraft("");
    try { const message = await api<Message>(`/api/conversations/${active.id}/messages`, { method: "POST", body: JSON.stringify({ body, replyToId: replyTo?.id }) }, token); setMessages((current) => [...current, message]); setReplyTo(undefined); }
    catch (reason) { setDraft(body); setError(reason instanceof Error ? reason.message : "Unable to send"); }
  }
  async function react(message: Message) {
    if (!token) return;
    try { const updated = await api<Message>(`/api/messages/${message.id}/reactions`, { method: "POST", body: JSON.stringify({ emoji: "❤️" }) }, token); setMessages((current) => current.map((item) => item.id === updated.id ? updated : item)); }
    catch (reason) { setError(reason instanceof Error ? reason.message : "Unable to react"); }
  }

  if (!token) return <SafeAreaView style={styles.container}><View style={styles.mark}><Text style={styles.markText}>S</Text></View><Text style={styles.title}>SEARCH</Text><Text style={styles.subtitle}>Conversations, in focus.</Text>{registering && <TextInput style={styles.input} placeholder="Display name" placeholderTextColor="#78859b" value={displayName} onChangeText={setDisplayName} />}{<TextInput style={styles.input} placeholder="Email" placeholderTextColor="#78859b" keyboardType="email-address" autoCapitalize="none" value={email} onChangeText={setEmail} />}{<TextInput style={styles.input} placeholder="Password (8+ characters)" placeholderTextColor="#78859b" secureTextEntry value={password} onChangeText={setPassword} />}<Pressable style={styles.primary} onPress={() => void authenticate()}><Text style={styles.primaryText}>{registering ? "Create account" : "Sign in"}</Text></Pressable><Pressable onPress={() => setRegistering(!registering)}><Text style={styles.link}>{registering ? "Sign in instead" : "Create an account"}</Text></Pressable>{error && <Text style={styles.error}>{error}</Text>}<StatusBar style="light" /></SafeAreaView>;
  if (active) return <SafeAreaView style={styles.container}><View style={styles.header}><Pressable onPress={() => setActive(undefined)}><Text style={styles.link}>‹ Chats</Text></Pressable><Text style={styles.headerTitle}>{active.title}</Text></View>{replyTo && <View style={styles.reply}><Text style={styles.muted}>Replying to: {replyTo.body}</Text><Pressable onPress={() => setReplyTo(undefined)}><Text style={styles.link}>×</Text></Pressable></View>}<FlatList style={styles.messages} data={messages} keyExtractor={(item) => item.id} renderItem={({ item }) => <View style={[styles.bubble, item.sender.id === active.participants[0]?.id ? styles.incoming : styles.outgoing]}><Pressable onLongPress={() => setReplyTo(item)}><Text style={styles.bubbleText}>{item.deletedAt ? "Message deleted" : item.body}</Text></Pressable><View style={styles.messageTools}><Pressable onPress={() => void react(item)}><Text style={styles.muted}>❤️ {item.reactions["❤️"]?.length ?? ""}</Text></Pressable><Text style={styles.muted}>{item.readBy.length > 1 ? "✓✓" : "✓"}</Text></View></View>} /><View style={styles.composer}><TextInput style={styles.messageInput} placeholder="Message..." placeholderTextColor="#78859b" value={draft} onChangeText={setDraft} /><Pressable style={styles.send} onPress={() => void send()}><Text style={styles.primaryText}>↑</Text></Pressable></View></SafeAreaView>;
  return <SafeAreaView style={styles.container}><View style={styles.header}><Text style={styles.title}>SEARCH</Text><Pressable onPress={() => { void AsyncStorage.removeItem("search-token"); setToken(undefined); }}><Text style={styles.link}>Sign out</Text></Pressable></View><Text style={styles.section}>Conversations</Text>{conversations.length === 0 && <Text style={styles.muted}>No conversations yet. Start one from the web app.</Text>}<FlatList data={conversations} keyExtractor={(item) => item.id} renderItem={({ item }) => <Pressable style={styles.row} onPress={() => setActive(item)}><View style={styles.avatar}><Text style={styles.primaryText}>{item.title.slice(0, 2).toUpperCase()}</Text></View><View><Text style={styles.rowTitle}>{item.title}</Text><Text style={styles.muted}>{item.lastMessage?.body ?? "Start a conversation"}</Text></View></Pressable>} />{error && <Text style={styles.error}>{error}</Text>}<StatusBar style="light" /></SafeAreaView>;
}

const styles = StyleSheet.create({
  container: { backgroundColor: "#111827", flex: 1, padding: 22 },
  mark: { alignItems: "center", alignSelf: "center", backgroundColor: "#f27b5b", borderRadius: 16, height: 64, justifyContent: "center", marginTop: 70, width: 64 },
  markText: { color: "#fff", fontSize: 34, fontWeight: "800" }, title: { color: "#fff", fontSize: 22, fontWeight: "800", letterSpacing: 4, marginVertical: 18 }, subtitle: { color: "#f27b5b", marginBottom: 22, textAlign: "center" },
  input: { backgroundColor: "#202b40", borderRadius: 8, color: "#fff", marginBottom: 10, padding: 13 }, primary: { alignItems: "center", backgroundColor: "#f27b5b", borderRadius: 8, marginTop: 8, padding: 13 }, primaryText: { color: "#fff", fontWeight: "700" }, link: { color: "#f27b5b", padding: 12, textAlign: "center" }, error: { color: "#ff9a8b", marginTop: 14, textAlign: "center" }, header: { alignItems: "center", flexDirection: "row", justifyContent: "space-between", marginBottom: 16 }, headerTitle: { color: "#fff", fontSize: 18, fontWeight: "700" }, section: { color: "#8d99ad", fontSize: 12, fontWeight: "700", marginBottom: 10, textTransform: "uppercase" }, muted: { color: "#8d99ad", fontSize: 12 }, reply: { alignItems: "center", backgroundColor: "#202b40", flexDirection: "row", justifyContent: "space-between", padding: 8 }, row: { alignItems: "center", borderBottomColor: "#253149", borderBottomWidth: 1, flexDirection: "row", gap: 12, paddingVertical: 14 }, avatar: { alignItems: "center", backgroundColor: "#e47d69", borderRadius: 12, height: 42, justifyContent: "center", width: 42 }, rowTitle: { color: "#fff", fontSize: 15, fontWeight: "600", marginBottom: 4 }, messages: { flex: 1 }, bubble: { borderRadius: 14, marginBottom: 10, maxWidth: "82%", padding: 12 }, incoming: { alignSelf: "flex-start", backgroundColor: "#202b40" }, outgoing: { alignSelf: "flex-end", backgroundColor: "#e47d69" }, bubbleText: { color: "#fff", fontSize: 14, lineHeight: 20 }, messageTools: { flexDirection: "row", gap: 10, justifyContent: "flex-end", marginTop: 5 }, composer: { alignItems: "center", flexDirection: "row", gap: 8, paddingTop: 10 }, messageInput: { backgroundColor: "#202b40", borderRadius: 8, color: "#fff", flex: 1, padding: 12 }, send: { alignItems: "center", backgroundColor: "#f27b5b", borderRadius: 8, height: 42, justifyContent: "center", width: 42 }
});
