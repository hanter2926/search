import { spawn } from "node:child_process";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import assert from "node:assert/strict";
import { io } from "socket.io-client";

const dataDirectory = await mkdtemp(join(tmpdir(), "search-api-"));
const dataFile = join(dataDirectory, "search.json");
const outboxFile = join(dataDirectory, "outbox.json");
const server = spawn(process.execPath, ["apps/api/dist/server.js"], {
  env: { ...process.env, PORT: "4010", SEARCH_DATA_FILE: dataFile, SEARCH_EMAIL_OUTBOX: outboxFile },
  stdio: "ignore"
});

async function waitForServer() {
  for (let attempt = 0; attempt < 30; attempt += 1) {
    try {
      const response = await fetch("http://localhost:4010/health");
      if (response.ok) return;
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error("API did not start");
}

async function api(path, options = {}) {
  const response = await fetch(`http://localhost:4010${path}`, {
    ...options,
    headers: { "content-type": "application/json", ...options.headers }
  });
  const body = await response.json();
  assert.equal(response.ok, true, `${response.status}: ${body.error ?? "request failed"}`);
  return body;
}

async function status(path, options, expectedStatus) {
  const response = await fetch(`http://localhost:4010${path}`, {
    ...options,
    headers: { "content-type": "application/json", ...options.headers }
  });
  assert.equal(response.status, expectedStatus);
  return response.status === 204 ? null : response.json();
}

try {
  await waitForServer();
  const health = await (await fetch("http://localhost:4010/health")).json();
  assert.equal(health.persistence, "local");
  assert.equal(health.redis, "not_configured");
  assert.equal(health.email, "configured");
  const integrationHealth = await (await fetch("http://localhost:4010/health/integrations")).json();
  assert.deepEqual(integrationHealth, {
    persistence: "local",
    supabase: "not_configured",
    redis: "not_configured",
    email: "configured"
  });
  const suffix = Date.now();
  await api("/api/auth/request-otp", {
    method: "POST",
    body: JSON.stringify({ email: `first-${suffix}@example.com` })
  });
  const firstEmail = JSON.parse(await readFile(outboxFile, "utf8")).at(-1);
  const firstOtp = firstEmail.text.match(/\b\d{6}\b/)[0];
  const firstVerified = await api("/api/auth/verify-email", {
    method: "POST",
    body: JSON.stringify({ email: `first-${suffix}@example.com`, otp: firstOtp })
  });
  await api("/api/auth/request-otp", {
    method: "POST",
    body: JSON.stringify({ email: `second-${suffix}@example.com` })
  });
  const secondEmail = JSON.parse(await readFile(outboxFile, "utf8")).at(-1);
  const secondOtp = secondEmail.text.match(/\b\d{6}\b/)[0];
  const secondVerified = await api("/api/auth/verify-email", {
    method: "POST",
    body: JSON.stringify({ email: `second-${suffix}@example.com`, otp: secondOtp })
  });
  const headers = { authorization: `Bearer ${firstVerified.token}` };
  const request = await api("/api/message-requests", {
    method: "POST", headers, body: JSON.stringify({ userId: secondVerified.user.id })
  });
  await api(`/api/message-requests/${request.id}/accept`, {
    method: "POST", headers: { authorization: `Bearer ${secondVerified.token}` }
  });
  const conversation = await api("/api/conversations", {
    method: "POST", headers, body: JSON.stringify({ userId: secondVerified.user.id })
  });
  const message = await api(`/api/conversations/${conversation.id}/messages`, {
    method: "POST", headers, body: JSON.stringify({ body: "Original text" })
  });
  assert.deepEqual(message.readBy, [firstVerified.user.id]);
  assert.deepEqual(message.deliveredTo, [firstVerified.user.id]);
  const secondHeaders = { authorization: `Bearer ${secondVerified.token}` };
  const secondSocket = io("http://localhost:4010", { auth: { token: secondVerified.token } });
  const received = new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("Timed out waiting for real-time message")), 3000);
    secondSocket.on("message:new", (event) => {
      clearTimeout(timer);
      resolve(event);
    });
  });
  await new Promise((resolve) => secondSocket.connected ? resolve() : secondSocket.once("connect", resolve));
  const liveMessagePromise = api(`/api/conversations/${conversation.id}/messages`, {
    method: "POST", headers, body: JSON.stringify({ body: "Real-time message" })
  });
  const liveMessage = await liveMessagePromise;
  const event = await received;
  assert.equal(event.id, liveMessage.id);
  secondSocket.close();
  const reply = await api(`/api/conversations/${conversation.id}/messages`, {
    method: "POST", headers, body: JSON.stringify({ body: "Reply text", replyToId: message.id })
  });
  assert.equal(reply.replyTo.id, message.id);
  const forwarded = await api(`/api/messages/${message.id}/forward`, {
    method: "POST", headers, body: JSON.stringify({ conversationId: conversation.id })
  });
  assert.equal(forwarded.forwardedFromId, message.id);
  const reacted = await api(`/api/messages/${message.id}/reactions`, {
    method: "POST", headers, body: JSON.stringify({ emoji: "❤️" })
  });
  assert.deepEqual(reacted.reactions["❤️"], [firstVerified.user.id]);
  const unreacted = await api(`/api/messages/${message.id}/reactions`, {
    method: "POST", headers, body: JSON.stringify({ emoji: "❤️" })
  });
  assert.equal(unreacted.reactions["❤️"], undefined);
  const delivered = await api(`/api/messages/${message.id}/delivered`, { method: "POST", headers: secondHeaders });
  assert.equal(delivered.status, "delivered");
  const read = await api(`/api/messages/${message.id}/read`, { method: "POST", headers: secondHeaders });
  assert.ok(read.readBy.includes(secondVerified.user.id));
  await status(`/api/conversations/${conversation.id}/read`, { method: "POST", headers: secondHeaders }, 204);
  const search = await api("/api/search/messages?q=Original", { headers: secondHeaders });
  assert.ok(search.some((item) => item.id === message.id));
  await status(`/api/messages/${message.id}`, {
    method: "PATCH",
    headers: { authorization: `Bearer ${secondVerified.token}` },
    body: JSON.stringify({ body: "Unauthorized edit" })
  }, 403);
  const edited = await api(`/api/messages/${message.id}`, {
    method: "PATCH", headers, body: JSON.stringify({ body: "Edited text" })
  });
  assert.equal(edited.body, "Edited text");
  assert.ok(edited.editedAt);
  const starred = await api(`/api/messages/${message.id}/star`, { method: "POST", headers });
  assert.deepEqual(starred.starredBy, [firstVerified.user.id]);
  const pinned = await api(`/api/messages/${message.id}/pin`, { method: "POST", headers });
  assert.equal(pinned.pinned, true);
  const deleted = await api(`/api/messages/${message.id}`, { method: "DELETE", headers });
  assert.equal(deleted.body, "");
  assert.ok(deleted.deletedAt);
  const history = await api(`/api/conversations/${conversation.id}/messages`, { headers });
  assert.equal(history[0].body, "");
  console.log("API message lifecycle test passed");
} finally {
  server.kill();
  await rm(dataDirectory, { recursive: true, force: true });
}
