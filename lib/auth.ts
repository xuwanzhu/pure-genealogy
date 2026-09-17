import { cookies } from "next/headers";
import crypto from "crypto";
import bcrypt from "bcryptjs";
import { query, execute } from "./db";

export const SESSION_COOKIE = "genealogy_session";
const SESSION_DURATION_MS = 7 * 24 * 60 * 60 * 1000; // 7 天
const REMEMBER_DURATION_MS = 30 * 24 * 60 * 60 * 1000; // 30 天 (记住我)

export interface SessionUser {
  id: number;
  phone: string;
  role: "admin" | "viewer";
  family_id: number | null;
  family_name: string | null;
  family_surname: string | null;
  invite_code: string | null;
}

/**
 * 密码哈希
 */
export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 10);
}

export async function verifyPassword(
  password: string,
  hash: string
): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

/**
 * 创建会话并写入 httpOnly cookie
 * 只能在 Server Action 或 Route Handler 中调用
 * @param remember 记住我: 会话保持 30 天 (默认 7 天)
 */
export async function createSession(
  userId: number,
  remember = false
): Promise<void> {
  const sessionId = crypto.randomBytes(32).toString("hex");
  const expiresAt = new Date(
    Date.now() + (remember ? REMEMBER_DURATION_MS : SESSION_DURATION_MS)
  );

  await execute(
    "INSERT INTO sessions (id, user_id, expires_at) VALUES (?, ?, ?)",
    [sessionId, userId, expiresAt]
  );

  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE, sessionId, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    expires: expiresAt,
    path: "/",
  });
}

/**
 * 获取当前登录用户 (可在 Server Component / Server Action 中调用)
 */
export async function getSessionUser(): Promise<SessionUser | null> {
  const cookieStore = await cookies();
  const sessionId = cookieStore.get(SESSION_COOKIE)?.value;
  if (!sessionId) return null;

  const rows = await query<Omit<SessionUser, "family_name" | "family_surname" | "invite_code"> & {
    family_name: string | null;
    family_surname: string | null;
    invite_code: string | null;
    expires_at: string;
  }>(
    `SELECT u.id, u.phone, u.role, u.family_id,
            f.name AS family_name, f.surname AS family_surname,
            f.invite_code, s.expires_at
     FROM sessions s
     JOIN users u ON u.id = s.user_id
     LEFT JOIN families f ON f.id = u.family_id
     WHERE s.id = ? AND s.expires_at > NOW()`,
    [sessionId]
  );

  if (rows.length === 0) return null;

  const { id, phone, role, family_id, family_name, family_surname, invite_code } = rows[0];
  return { id, phone, role, family_id, family_name, family_surname, invite_code };
}

/**
 * 获取当前管理员用户,非管理员返回 null
 * 用于写操作前的权限校验
 */
export async function getAdminUser(): Promise<SessionUser | null> {
  const user = await getSessionUser();
  if (!user || user.role !== "admin") return null;
  return user;
}

/**
 * 销毁当前会话 (登出)
 */
export async function destroySession(): Promise<void> {
  const cookieStore = await cookies();
  const sessionId = cookieStore.get(SESSION_COOKIE)?.value;

  if (sessionId) {
    await execute("DELETE FROM sessions WHERE id = ?", [sessionId]);
  }

  cookieStore.delete(SESSION_COOKIE);
}
