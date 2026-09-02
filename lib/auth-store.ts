import { createHash, randomBytes, scrypt as scryptCallback, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import { and, eq, gt } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import { pgTable, text, timestamp } from "drizzle-orm/pg-core";
import { Pool } from "pg";

const scrypt = promisify(scryptCallback);
const COOKIE_NAME = "durableops_session";
const SESSION_TTL = 1000 * 60 * 60 * 24 * 7;

export const userRoles = ["requester", "tech"] as const;
export type UserRole = (typeof userRoles)[number];
export type User = { id: string; username: string; role: UserRole };

const users = pgTable("durableops_users", {
  id: text("id").primaryKey(),
  username: text("username").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  role: text("role").$type<UserRole>().notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
});

const sessions = pgTable("durableops_sessions", {
  tokenHash: text("token_hash").primaryKey(),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
});

const connectionString =
  process.env.WORKFLOW_POSTGRES_URL ??
  process.env.DATABASE_URL ??
  `postgresql://${process.env.POSTGRES_USER ?? "durableops"}:${process.env.POSTGRES_PASSWORD ?? "durableops"}@localhost:15432/${process.env.POSTGRES_DB ?? "durableops"}`;

const globalForDatabase = globalThis as typeof globalThis & { durableOpsAuthPool?: Pool };
const pool = globalForDatabase.durableOpsAuthPool ?? new Pool({ connectionString, max: 5 });
const db = drizzle(pool);

if (process.env.NODE_ENV !== "production") {
  globalForDatabase.durableOpsAuthPool = pool;
}

function toUser(user: typeof users.$inferSelect): User {
  return { id: user.id, username: user.username, role: user.role };
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

function tokenHash(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

async function ensureConfiguredTechUser() {
  const username = process.env.TECH_USERNAME?.trim().toLowerCase();
  const password = process.env.TECH_PASSWORD;
  if (!username || !password) return;

  const [existing] = await db.select().from(users).where(eq(users.username, username)).limit(1);
  if (existing) {
    if (existing.role !== "tech") {
      await db.update(users).set({ role: "tech" }).where(eq(users.id, existing.id));
    }
    return;
  }

  await db
    .insert(users)
    .values({
      id: `user_${randomBytes(8).toString("hex")}`,
      username,
      passwordHash: await hashPassword(password),
      role: "tech",
      createdAt: new Date(),
    })
    .onConflictDoNothing({ target: users.username });
}

export function sessionCookieName() {
  return COOKIE_NAME;
}

export async function createUser(username: string, password: string, role: UserRole = "requester") {
  await ensureConfiguredTechUser();
  const normalized = username.trim().toLowerCase();
  const [existing] = await db.select({ id: users.id }).from(users).where(eq(users.username, normalized)).limit(1);
  if (existing) throw new Error("Username is already registered");

  const user = {
    id: `user_${randomBytes(8).toString("hex")}`,
    username: normalized,
    passwordHash: await hashPassword(password),
    role,
    createdAt: new Date(),
  };

  await db.insert(users).values(user);
  return toUser(user);
}

export async function getUserByUsername(username: string) {
  await ensureConfiguredTechUser();
  const normalized = username.trim().toLowerCase();
  const [user] = await db.select().from(users).where(eq(users.username, normalized)).limit(1);
  return user ? toUser(user) : null;
}

export async function authenticate(username: string, password: string) {
  await ensureConfiguredTechUser();
  const normalized = username.trim().toLowerCase();
  const [user] = await db.select().from(users).where(eq(users.username, normalized)).limit(1);
  if (!user || !(await verifyPassword(password, user.passwordHash))) return null;
  return toUser(user);
}

export async function createSession(userId: string) {
  const token = randomBytes(32).toString("base64url");
  await db.insert(sessions).values({
    tokenHash: tokenHash(token),
    userId,
    expiresAt: new Date(Date.now() + SESSION_TTL),
  });
  return token;
}

export async function getUserFromSession(value?: string | null) {
  if (!value) return null;
  await ensureConfiguredTechUser();

  const [session] = await db
    .select({
      id: users.id,
      username: users.username,
      role: users.role,
    })
    .from(sessions)
    .innerJoin(users, eq(sessions.userId, users.id))
    .where(and(eq(sessions.tokenHash, tokenHash(value)), gt(sessions.expiresAt, new Date())))
    .limit(1);
  return session ?? null;
}

export async function deleteSession(value?: string | null) {
  if (!value) return;
  await db.delete(sessions).where(eq(sessions.tokenHash, tokenHash(value)));
}

export { COOKIE_NAME, SESSION_TTL };
