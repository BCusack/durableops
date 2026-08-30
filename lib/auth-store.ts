import { createHmac, randomBytes, scrypt as scryptCallback, timingSafeEqual } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";

const scrypt = promisify(scryptCallback);
const STORE_PATH = path.join(process.cwd(), ".durableops", "auth.json");
const COOKIE_NAME = "durableops_session";
const SESSION_TTL = 1000 * 60 * 60 * 24 * 7;

export const userRoles = ["requester", "tech", "admin"] as const;
export type UserRole = (typeof userRoles)[number];

type UserRecord = { id: string; username: string; passwordHash: string; role: UserRole; createdAt: string };
type SessionRecord = { userId: string; expiresAt: number };
type AuthData = { users: UserRecord[]; sessions: Record<string, SessionRecord> };

async function readStore(): Promise<AuthData> {
  await mkdir(path.dirname(STORE_PATH), { recursive: true });
  let data: AuthData;

  try {
    data = JSON.parse(await readFile(STORE_PATH, "utf8")) as AuthData;
  } catch {
    data = { users: [], sessions: {} };
  }

  data.users = data.users.map((user) => ({
    ...user,
    role: user.role ?? "requester",
  }));

  let changed = false;
  const seededUsers = [
    {
      username: process.env.ADMIN_USERNAME,
      password: process.env.ADMIN_PASSWORD,
      role: "admin" as const,
    },
    {
      username: process.env.TECH_USERNAME,
      password: process.env.TECH_PASSWORD,
      role: "tech" as const,
    },
  ];

  for (const seededUser of seededUsers) {
    const username = seededUser.username?.trim().toLowerCase();
    const password = seededUser.password;
    if (!username || !password) continue;

    const existing = data.users.find((user) => user.username === username);
    if (existing) {
      if (existing.role !== seededUser.role) {
        existing.role = seededUser.role;
        changed = true;
      }
      continue;
    }

    data.users.push({
      id: `user_${randomBytes(8).toString("hex")}`,
      username,
      passwordHash: await hashPassword(password),
      role: seededUser.role,
      createdAt: new Date().toISOString(),
    });
    changed = true;
  }

  if (changed) {
    await writeStore(data);
  }

  return data;
}

async function writeStore(data: AuthData) {
  await mkdir(path.dirname(STORE_PATH), { recursive: true });
  await writeFile(STORE_PATH, JSON.stringify(data, null, 2), "utf8");
}

async function hashPassword(password: string, salt = randomBytes(16).toString("hex")) {
  const derived = (await scrypt(password, salt, 64)) as Buffer;
  return `scrypt:${salt}:${derived.toString("hex")}`;
}

async function verifyPassword(password: string, encoded: string) {
  const [, salt, expected] = encoded.split(":");
  if (!salt || !expected) return false;
  const actual = (await scrypt(password, salt, 64)) as Buffer;
  const target = Buffer.from(expected, "hex");
  return target.length === actual.length && timingSafeEqual(target, actual);
}

function sessionSignature(token: string) {
  const secret = process.env.AUTH_SECRET ?? "durableops-demo-secret-change-me";
  return createHmac("sha256", secret).update(token).digest("base64url");
}

export function sessionCookieName() {
  return COOKIE_NAME;
}

export async function createUser(username: string, password: string, role: UserRole = "requester") {
  const data = await readStore();
  const normalized = username.trim().toLowerCase();
  if (data.users.some((user) => user.username === normalized)) throw new Error("Username is already registered");
  const user: UserRecord = {
    id: `user_${randomBytes(8).toString("hex")}`,
    username: normalized,
    passwordHash: await hashPassword(password),
    role,
    createdAt: new Date().toISOString(),
  };
  data.users.push(user);
  await writeStore(data);
  return { id: user.id, username: user.username, role: user.role };
}

export async function authenticate(username: string, password: string) {
  const data = await readStore();
  const user = data.users.find((candidate) => candidate.username === username.trim().toLowerCase());
  if (!user || !(await verifyPassword(password, user.passwordHash))) return null;
  return { id: user.id, username: user.username, role: user.role };
}

export async function createSession(userId: string) {
  const data = await readStore();
  const token = randomBytes(32).toString("base64url");
  data.sessions[token] = { userId, expiresAt: Date.now() + SESSION_TTL };
  await writeStore(data);
  return `${token}.${sessionSignature(token)}`;
}

export async function getUserFromSession(value?: string | null) {
  if (!value) return null;
  const [token, signature] = value.split(".");
  if (!token || !signature || sessionSignature(token) !== signature) return null;
  const data = await readStore();
  const session = data.sessions[token];
  if (!session || session.expiresAt < Date.now()) return null;
  const user = data.users.find((candidate) => candidate.id === session.userId);
  return user ? { id: user.id, username: user.username, role: user.role } : null;
}

export async function deleteSession(value?: string | null) {
  if (!value) return;
  const [token] = value.split(".");
  const data = await readStore();
  delete data.sessions[token];
  await writeStore(data);
}

export { COOKIE_NAME, SESSION_TTL };
