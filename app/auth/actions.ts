"use server";

import { query, execute } from "@/lib/db";
import {
  hashPassword,
  verifyPassword,
  createSession,
  destroySession,
  getAdminUser,
} from "@/lib/auth";
import crypto from "crypto";

interface AuthResult {
  success: boolean;
  error: string | null;
}

/** 生成易读的 8 位纯数字邀请码 (每位 2-9, 去掉 0/1 避免混淆) */
function genInviteCode(): string {
  const digits = "23456789";
  let code = "";
  const bytes = crypto.randomBytes(8);
  for (let i = 0; i < 8; i++) code += digits[bytes[i] % digits.length];
  return code;
}

/** 校验中国大陆手机号 */
function isValidPhone(phone: string): boolean {
  return /^1[3-9]\d{9}$/.test(phone);
}

/** 手机号是否已被注册 */
async function phoneExists(phone: string): Promise<boolean> {
  const rows = await query("SELECT id FROM users WHERE phone = ?", [phone]);
  return rows.length > 0;
}

/** 基础校验 (手机号格式/密码长度/两次一致) */
function validateCredentials(
  phone: string,
  password: string,
  repeatPassword: string
): string | null {
  if (!isValidPhone(phone)) return "请输入正确的手机号";
  if (password !== repeatPassword) return "两次密码输入不一致";
  if (password.length < 6) return "密码至少需要 6 位";
  return null;
}

/**
 * 把账号关联到族谱成员:
 * 族内已有同名且未关联的成员 → 直接关联;
 * 否则新建成员记录并关联 (世代未知,可后续编辑)
 */
async function linkOrCreateMember(
  familyId: number,
  userId: number,
  name: string
): Promise<void> {
  const trimmed = name.trim();
  if (!trimmed) return;

  const existing = await query<{ id: number }>(
    "SELECT id FROM family_members WHERE family_id = ? AND name = ? AND user_id IS NULL LIMIT 1",
    [familyId, trimmed]
  );
  if (existing.length > 0) {
    await execute(
      "UPDATE family_members SET user_id = ? WHERE family_id = ? AND id = ?",
      [userId, familyId, existing[0].id]
    );
    return;
  }

  await execute(
    "INSERT INTO family_members (family_id, name, user_id) VALUES (?, ?, ?)",
    [familyId, trimmed, userId]
  );
}

/**
 * 注册并创建新家族
 * 创建者自动成为该家族的管理员,并以本人姓名入谱
 */
export async function createFamilyAction(
  surname: string,
  phone: string,
  password: string,
  repeatPassword: string,
  realName: string
): Promise<AuthResult> {
  const trimmedSurname = surname.trim();
  const trimmedPhone = phone.trim();
  const trimmedName = realName.trim();

  if (!trimmedSurname) return { success: false, error: "请填写姓氏" };
  if (trimmedSurname.length > 2)
    return { success: false, error: "姓氏最多 2 个字" };
  if (!trimmedName) return { success: false, error: "请填写您的姓名" };
  const credError = validateCredentials(trimmedPhone, password, repeatPassword);
  if (credError) return { success: false, error: credError };

  try {
    if (await phoneExists(trimmedPhone)) {
      return { success: false, error: "该手机号已被注册" };
    }

    const passwordHash = await hashPassword(password);
    const inviteCode = genInviteCode();

    // 建家族 + 建管理员账号
    const familyResult = await execute(
      "INSERT INTO families (surname, name, invite_code) VALUES (?, ?, ?)",
      [trimmedSurname, `${trimmedSurname}氏`, inviteCode]
    );
    const userResult = await execute(
      "INSERT INTO users (phone, password_hash, role, family_id) VALUES (?, ?, 'admin', ?)",
      [trimmedPhone, passwordHash, familyResult.insertId]
    );

    // 创建者以本人姓名入谱
    await linkOrCreateMember(
      familyResult.insertId,
      userResult.insertId,
      trimmedName
    );

    await execute("DELETE FROM sessions WHERE expires_at <= NOW()");
    await createSession(userResult.insertId);
    return { success: true, error: null };
  } catch (error) {
    console.error("Create family error:", error);
    return { success: false, error: "创建家族失败，请稍后再试" };
  }
}

/**
 * 注册并加入已有家族 (凭邀请码,成为只读成员,并以本人姓名入谱)
 */
export async function joinFamilyAction(
  inviteCode: string,
  phone: string,
  password: string,
  repeatPassword: string,
  realName: string
): Promise<AuthResult> {
  const trimmedCode = inviteCode.trim().toUpperCase();
  const trimmedPhone = phone.trim();
  const trimmedName = realName.trim();

  if (!trimmedCode) return { success: false, error: "请填写邀请码" };
  if (!trimmedName) return { success: false, error: "请填写您的姓名" };
  const credError = validateCredentials(trimmedPhone, password, repeatPassword);
  if (credError) return { success: false, error: credError };

  try {
    if (await phoneExists(trimmedPhone)) {
      return { success: false, error: "该手机号已被注册" };
    }

    const families = await query<{ id: number; name: string }>(
      "SELECT id, name FROM families WHERE invite_code = ?",
      [trimmedCode]
    );
    if (families.length === 0) {
      return { success: false, error: "邀请码无效，请向家族管理员确认" };
    }

    const passwordHash = await hashPassword(password);
    const userResult = await execute(
      "INSERT INTO users (phone, password_hash, role, family_id) VALUES (?, ?, 'viewer', ?)",
      [trimmedPhone, passwordHash, families[0].id]
    );

    // 以本人姓名入谱
    await linkOrCreateMember(families[0].id, userResult.insertId, trimmedName);

    await execute("DELETE FROM sessions WHERE expires_at <= NOW()");
    await createSession(userResult.insertId);
    return { success: true, error: null };
  } catch (error) {
    console.error("Join family error:", error);
    return { success: false, error: "加入家族失败，请稍后再试" };
  }
}

/**
 * 登录
 * @param remember 记住我: 会话保持 30 天 (默认 7 天)
 */
export async function loginAction(
  phone: string,
  password: string,
  remember = false
): Promise<AuthResult> {
  const trimmedPhone = phone.trim();

  try {
    const rows = await query<{ id: number; password_hash: string }>(
      "SELECT id, password_hash FROM users WHERE phone = ?",
      [trimmedPhone]
    );

    if (rows.length === 0) {
      return { success: false, error: "手机号或密码错误" };
    }

    const { id, password_hash } = rows[0];
    const valid = await verifyPassword(password, password_hash);
    if (!valid) {
      return { success: false, error: "手机号或密码错误" };
    }

    // 顺手清理全局过期会话
    await execute("DELETE FROM sessions WHERE expires_at <= NOW()");

    await createSession(id, remember);
    return { success: true, error: null };
  } catch (error) {
    console.error("Login error:", error);
    return { success: false, error: "登录失败，请稍后再试" };
  }
}

/**
 * 管理员为族人代建账号 (用于没有邮箱/不会注册的长辈)
 * 默认只读,可指定为管理员;账号自动关联族谱成员
 */
export async function createMemberAccountAction(
  phone: string,
  password: string,
  isAdmin: boolean,
  memberName: string
): Promise<AuthResult> {
  const admin = await getAdminUser();
  if (!admin || admin.family_id === null) {
    return { success: false, error: "只有管理员可以代建账号" };
  }

  const trimmedPhone = phone.trim();
  const trimmedName = memberName.trim();
  if (!isValidPhone(trimmedPhone)) {
    return { success: false, error: "请输入正确的手机号" };
  }
  if (!trimmedName) {
    return { success: false, error: "请填写族人姓名" };
  }
  if (password.length < 6) {
    return { success: false, error: "密码至少需要 6 位" };
  }

  try {
    if (await phoneExists(trimmedPhone)) {
      return { success: false, error: "该手机号已被注册" };
    }

    const passwordHash = await hashPassword(password);
    const userResult = await execute(
      "INSERT INTO users (phone, password_hash, role, family_id) VALUES (?, ?, ?, ?)",
      [trimmedPhone, passwordHash, isAdmin ? "admin" : "viewer", admin.family_id]
    );

    // 账号关联族谱成员 (同名未关联的成员优先,否则新建)
    await linkOrCreateMember(admin.family_id, userResult.insertId, trimmedName);
    return { success: true, error: null };
  } catch (error) {
    console.error("Create member account error:", error);
    return { success: false, error: "代建账号失败，请稍后再试" };
  }
}

export interface FamilyAccount {
  id: number;
  phone: string;
  role: "admin" | "viewer";
  memberId: number | null;
  memberName: string | null;
}

/**
 * 获取本家族所有账号 (含关联的族谱成员,仅管理员)
 */
export async function listFamilyAccounts(): Promise<{
  success: boolean;
  accounts: FamilyAccount[];
  error: string | null;
}> {
  const admin = await getAdminUser();
  if (!admin || admin.family_id === null) {
    return { success: false, accounts: [], error: "只有管理员可以管理账号" };
  }
  try {
    const accounts = await query<FamilyAccount>(
      `SELECT u.id, u.phone, u.role, m.id AS memberId, m.name AS memberName
       FROM users u
       LEFT JOIN family_members m ON m.user_id = u.id
       WHERE u.family_id = ?
       ORDER BY u.id`,
      [admin.family_id]
    );
    return { success: true, accounts, error: null };
  } catch (error) {
    return { success: false, accounts: [], error: (error as Error).message };
  }
}

/**
 * 管理员重置族人账号密码 (仅限本家族账号)
 */
export async function resetMemberPassword(
  userId: number,
  newPassword: string
): Promise<AuthResult> {
  const admin = await getAdminUser();
  if (!admin || admin.family_id === null) {
    return { success: false, error: "只有管理员可以重置密码" };
  }
  if (newPassword.length < 6) {
    return { success: false, error: "密码至少需要 6 位" };
  }
  try {
    // 校验目标账号属于本家族
    const rows = await query<{ id: number }>(
      "SELECT id FROM users WHERE id = ? AND family_id = ?",
      [userId, admin.family_id]
    );
    if (rows.length === 0) {
      return { success: false, error: "账号不存在" };
    }
    const passwordHash = await hashPassword(newPassword);
    await execute("UPDATE users SET password_hash = ? WHERE id = ?", [
      passwordHash,
      userId,
    ]);
    // 重置密码后强制下线该账号 (清除其所有会话)
    await execute("DELETE FROM sessions WHERE user_id = ?", [userId]);
    return { success: true, error: null };
  } catch (error) {
    return { success: false, error: "重置密码失败，请稍后再试" };
  }
}

/**
 * 管理员设置账号关联的族谱成员
 * - memberId: 关联已有成员 (须未被其他账号关联)
 * - memberName: memberId 为空时按姓名关联/新建
 * - 两者都为空: 解除关联
 */
export async function setAccountMember(
  userId: number,
  memberId: number | null,
  memberName: string | null
): Promise<AuthResult> {
  const admin = await getAdminUser();
  if (!admin || admin.family_id === null) {
    return { success: false, error: "只有管理员可以管理账号" };
  }
  try {
    // 校验目标账号属于本家族
    const users = await query<{ id: number }>(
      "SELECT id FROM users WHERE id = ? AND family_id = ?",
      [userId, admin.family_id]
    );
    if (users.length === 0) {
      return { success: false, error: "账号不存在" };
    }

    // 解除当前关联
    await execute("UPDATE family_members SET user_id = NULL WHERE user_id = ?", [
      userId,
    ]);

    if (memberId) {
      // 关联指定成员: 校验属于本家族且未被其他账号关联
      const members = await query<{ id: number; user_id: number | null }>(
        "SELECT id, user_id FROM family_members WHERE family_id = ? AND id = ?",
        [admin.family_id, memberId]
      );
      if (members.length === 0) {
        return { success: false, error: "成员不存在" };
      }
      if (members[0].user_id !== null && members[0].user_id !== userId) {
        return { success: false, error: "该成员已关联其他账号" };
      }
      await execute(
        "UPDATE family_members SET user_id = ? WHERE family_id = ? AND id = ?",
        [userId, admin.family_id, memberId]
      );
    } else if (memberName && memberName.trim()) {
      // 按姓名关联/新建 (复用注册逻辑)
      await linkOrCreateMember(admin.family_id, userId, memberName);
    }

    return { success: true, error: null };
  } catch (error) {
    return { success: false, error: "设置关联成员失败，请稍后再试" };
  }
}

/**
 * 登出
 */
export async function logoutAction(): Promise<void> {
  await destroySession();
}
