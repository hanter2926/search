import { spawn } from "node:child_process";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import assert from "node:assert/strict";

const directory = await mkdtemp(join(tmpdir(), "search-otp-"));
const dataFile = join(directory, "search.json");
const outboxFile = join(directory, "outbox.json");
const server = spawn(process.execPath, ["apps/api/dist/server.js"], {
  env: { ...process.env, PORT: "4011", SEARCH_DATA_FILE: dataFile, SEARCH_EMAIL_OUTBOX: outboxFile },
  stdio: "ignore"
});

async function waitForServer() {
  for (let attempt = 0; attempt < 30; attempt += 1) {
    try {
      if ((await fetch("http://localhost:4011/health")).ok) return;
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error("OTP API did not start");
}

async function call(path, options = {}) {
  const response = await fetch(`http://localhost:4011${path}`, {
    ...options,
    headers: { "content-type": "application/json", ...options.headers }
  });
  const body = response.status === 204 ? null : await response.json();
  return { response, body };
}

async function requestCode(email) {
  const result = await call("/api/auth/request-otp", { method: "POST", body: JSON.stringify({ email }) });
  assert.equal(result.response.status, 202);
  const messages = JSON.parse(await readFile(outboxFile, "utf8"));
  return messages.at(-1).text.match(/\b\d{6}\b/)[0];
}

try {
  await waitForServer();
  const firstEmail = `otp-${Date.now()}@example.com`;
  const firstCode = await requestCode(firstEmail);
  const wrong = await call("/api/auth/verify-email", { method: "POST", body: JSON.stringify({ email: firstEmail, otp: "000000" }) });
  assert.equal(wrong.response.status, 400);
  const first = await call("/api/auth/verify-email", { method: "POST", body: JSON.stringify({ email: firstEmail, otp: firstCode }) });
  assert.equal(first.response.status, 201);
  const firstAgainCode = await requestCode(firstEmail);
  const firstAgain = await call("/api/auth/verify-email", { method: "POST", body: JSON.stringify({ email: firstEmail, otp: firstAgainCode }) });
  assert.equal(firstAgain.response.status, 201);
  assert.equal(firstAgain.body.user.id, first.body.user.id);
  assert.equal(firstAgain.body.existingAccount, true);
  assert.deepEqual(first.body.user.privacy, { discoverableByEmail: true, allowMessageRequests: true });

  const privacyUpdate = await call("/api/privacy", {
    method: "PATCH",
    headers: { authorization: "Bearer " + first.body.token },
    body: JSON.stringify({ discoverableByEmail: false, allowMessageRequests: false })
  });
  assert.equal(privacyUpdate.response.status, 200);
  assert.deepEqual(privacyUpdate.body, { discoverableByEmail: false, allowMessageRequests: false });
  const privacyRead = await call("/api/privacy", { headers: { authorization: "Bearer " + first.body.token } });
  assert.deepEqual(privacyRead.body, privacyUpdate.body);

  const cooldownEmail = `cooldown-${Date.now()}@example.com`;
  await requestCode(cooldownEmail);
  const cooldown = await call("/api/auth/request-otp", { method: "POST", body: JSON.stringify({ email: cooldownEmail }) });
  assert.equal(cooldown.response.status, 429);

  const oldRoute = await call("/api/auth/login", { method: "POST", body: JSON.stringify({ email: firstEmail, password: "ignored" }) });
  assert.equal(oldRoute.response.status, 410);

  const secondEmail = `isolated-${Date.now()}@example.com`;
  const secondCode = await requestCode(secondEmail);
  const second = await call("/api/auth/verify-email", { method: "POST", body: JSON.stringify({ email: secondEmail, otp: secondCode }) });
  assert.equal(second.response.status, 201);
  assert.notEqual(second.body.user.id, first.body.user.id);
  const hiddenSearch = await call(`/api/users?q=${encodeURIComponent(firstEmail)}`, { headers: { authorization: "Bearer " + second.body.token } });
  assert.equal(hiddenSearch.response.status, 200);
  assert.deepEqual(hiddenSearch.body, []);
  const blockedRequest = await call("/api/message-requests", {
    method: "POST",
    headers: { authorization: "Bearer " + second.body.token },
    body: JSON.stringify({ userId: first.body.user.id })
  });
  assert.equal(blockedRequest.response.status, 403);
  const firstData = await call("/api/conversations", { headers: { authorization: `Bearer ${first.body.token}` } });
  const secondData = await call("/api/conversations", { headers: { authorization: `Bearer ${second.body.token}` } });
  assert.deepEqual(firstData.body, []);
  assert.deepEqual(secondData.body, []);

  const groupCreate = await call("/api/groups", {
    method: "POST",
    headers: { authorization: "Bearer " + first.body.token },
    body: JSON.stringify({ name: "SEARCH test group", memberIds: [second.body.user.id] })
  });
  assert.equal(groupCreate.response.status, 201);
  assert.equal(groupCreate.body.members.length, 2);
  const groupList = await call("/api/groups", { headers: { authorization: "Bearer " + second.body.token } });
  assert.equal(groupList.response.status, 200);
  assert.equal(groupList.body[0].conversationId, groupCreate.body.conversationId);
  const groupMessage = await call(`/api/conversations/${groupCreate.body.conversationId}/messages`, {
    method: "POST",
    headers: { authorization: "Bearer " + second.body.token },
    body: JSON.stringify({ body: "Group message" })
  });
  assert.equal(groupMessage.response.status, 201);
  console.log("Passwordless OTP authentication test passed");
} finally {
  server.kill();
  await rm(directory, { recursive: true, force: true });
}
