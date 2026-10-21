import { randomUUID } from "crypto";
import { mkdirSync, readFileSync, renameSync, writeFileSync } from "fs";
import path from "path";

export type ChatMessage = {
  id: string;
  driverId: string;
  senderId: string;
  senderName: string;
  senderRole: "admin" | "driver";
  text: string;
  createdAt: number;
};

const directory = path.join(process.cwd(), ".data");
const file = path.join(directory, "messages.json");

function readMessages(): ChatMessage[] {
  try {
    const value = JSON.parse(readFileSync(file, "utf8"));
    return Array.isArray(value) ? value as ChatMessage[] : [];
  } catch { return []; }
}

export function messagesForDriver(driverId: string) {
  return readMessages().filter((message) => message.driverId === driverId).slice(-300);
}

export function addMessage(message: Omit<ChatMessage, "id" | "createdAt">) {
  const messages = readMessages();
  const saved: ChatMessage = { ...message, id: randomUUID(), createdAt: Date.now() };
  messages.push(saved);
  const retained = messages.slice(-10000);
  mkdirSync(directory, { recursive: true });
  const temporary = `${file}.tmp`;
  writeFileSync(temporary, `${JSON.stringify(retained)}\n`, { mode: 0o600 });
  renameSync(temporary, file);
  return saved;
}
