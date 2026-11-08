import "./env.js";
import nodemailer from "nodemailer";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname } from "node:path";

const smtpUrl = process.env.SMTP_URL;
const outboxFile = process.env.SEARCH_EMAIL_OUTBOX;
const transport = smtpUrl ? nodemailer.createTransport(smtpUrl) : undefined;

export function emailConfigured(): boolean {
  return Boolean((transport && process.env.SMTP_FROM) || outboxFile);
}

export async function sendVerificationCode(email: string, code: string): Promise<void> {
  if (outboxFile) {
    let messages: Array<{ to: string; subject: string; text: string }> = [];
    try {
      messages = JSON.parse(await readFile(outboxFile, "utf8")) as typeof messages;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    }
    messages.push({
      to: email,
      subject: "Your SEARCH verification code",
      text: `Your SEARCH verification code is ${code}. It expires in 5 minutes.`
    });
    await mkdir(dirname(outboxFile), { recursive: true });
    await writeFile(outboxFile, JSON.stringify(messages, null, 2));
    return;
  }
  if (!transport || !process.env.SMTP_FROM) {
    throw new Error("Email delivery is not configured. Set SMTP_URL and SMTP_FROM.");
  }
  await transport.sendMail({
    from: process.env.SMTP_FROM,
    to: email,
    subject: "Your SEARCH verification code",
    text: `Your SEARCH verification code is ${code}. It expires in 5 minutes.`
  });
}
