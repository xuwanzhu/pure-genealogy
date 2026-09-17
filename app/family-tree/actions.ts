"use server";

import { query, execute } from "@/lib/db";
import { getAdminUser, getSessionUser } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import crypto from "crypto";

export interface FamilyMember {
  id: number;
  name: string;
  generation: number | null;
  sibling_order: number | null;
  father_id: number | null;
  father_name: string | null;
  gender: "男" | "女" | null;
  official_position: string | null;
  is_alive: boolean;
  spouse_id: number | null;
  spouse_name: string | null;
  remarks: string | null;
  birthday: string | null;
  death_date: string | null;
  residence_place: string | null;
  updated_at: string;
}

export interface FetchMembersResult {
  data: FamilyMember[];
  count: number;
  error: string | null;
}

interface MemberRow {
  id: number;
  name: string;
  generation: number | null;
  sibling_order: number | null;
  father_id: number | null;
  gender: "男" | "女" | null;
  official_position: string | null;
  is_alive: number;
  spouse_id: number | null;
  spouse_name: string | null;
  remarks: string | null;
  birthday: string | null;
  death_date: string | null;
  residence_place: string | null;
  updated_at: string;
}

/** 数据库行 → 接口对象 (is_alive 0/1 → boolean) */
function toMember(row: MemberRow, fatherName?: string | null): FamilyMember {
  return {
    id: row.id,
    name: row.name,
    generation: row.generation,
    sibling_order: row.sibling_order,
    father_id: row.father_id,
    father_name: fatherName ?? null,
    gender: row.gender,
    official_position: row.official_position,
    is_alive: !!row.is_alive,
    spouse_id: row.spouse_id,
    spouse_name: row.spouse_name ?? null,
    remarks: row.remarks,
    birthday: row.birthday,
    death_date: row.death_date,
    residence_place: row.residence_place,
    updated_at: row.updated_at,
  };
}

/** 排序规则:与原 Supabase (PostgreSQL) 版本一致,NULL 值排在最后 */
const ORDER_CLAUSE =
  "ORDER BY m.generation IS NULL ASC, m.generation ASC, m.sibling_order IS NULL ASC, m.sibling_order ASC";

/** 获取当前用户所属家族 ID (族谱数据按家族隔离) */
async function getFamilyId(): Promise<number | null> {
  const user = await getSessionUser();
  return user?.family_id ?? null;
}

export async function fetchFamilyMembers(
  page: number = 1,
  pageSize: number = 50,
  searchQuery: string = ""
): Promise<FetchMembersResult> {
  try {
    const familyId = await getFamilyId();
    if (familyId === null) return { data: [], count: 0, error: null };

    const offset = (page - 1) * pageSize;
    const search = searchQuery.trim();

    // 分页数据 (LEFT JOIN 取配偶姓名)
    const rows = search
      ? await query<MemberRow>(
          `SELECT m.*, s.name AS spouse_name FROM family_members m
           LEFT JOIN family_members s ON s.id = m.spouse_id
           WHERE m.family_id = ? AND m.name LIKE ? ${ORDER_CLAUSE} LIMIT ? OFFSET ?`,
          [familyId, `%${search}%`, pageSize, offset]
        )
      : await query<MemberRow>(
          `SELECT m.*, s.name AS spouse_name FROM family_members m
           LEFT JOIN family_members s ON s.id = m.spouse_id
           WHERE m.family_id = ? ${ORDER_CLAUSE} LIMIT ? OFFSET ?`,
          [familyId, pageSize, offset]
        );

    // 总数
    const countRows = search
      ? await query<{ total: number }>(
          "SELECT COUNT(*) AS total FROM family_members WHERE family_id = ? AND name LIKE ?",
          [familyId, `%${search}%`]
        )
      : await query<{ total: number }>(
          "SELECT COUNT(*) AS total FROM family_members WHERE family_id = ?",
          [familyId]
        );

    // 批量查询父亲姓名
    const fatherIds = rows
      .map((r) => r.father_id)
      .filter((id): id is number => id !== null);

    let fatherMap: Record<number, string> = {};
    if (fatherIds.length > 0) {
      const placeholders = fatherIds.map(() => "?").join(",");
      const fathers = await query<{ id: number; name: string }>(
        `SELECT id, name FROM family_members WHERE id IN (${placeholders})`,
        fatherIds
      );
      fatherMap = Object.fromEntries(fathers.map((f) => [f.id, f.name]));
    }

    const data = rows.map((r) => toMember(r, r.father_id ? fatherMap[r.father_id] : null));
    return { data, count: countRows[0]?.total || 0, error: null };
  } catch (error) {
    console.error("fetchFamilyMembers error:", error);
    return { data: [], count: 0, error: (error as Error).message };
  }
}

export interface CreateMemberInput {
  name: string;
  generation?: number | null;
  sibling_order?: number | null;
  father_id?: number | null;
  gender?: "男" | "女" | null;
  official_position?: string | null;
  is_alive?: boolean;
  /** 关联已有成员为配偶 (优先) */
  spouse_id?: number | null;
  /** 配偶姓名: spouse_id 为空且非空时新建配偶成员 */
  spouse_name?: string | null;
  remarks?: string | null;
  birthday?: string | null;
  death_date?: string | null;
  residence_place?: string | null;
}

const INSERT_FIELDS =
  "(family_id, name, generation, sibling_order, father_id, gender, official_position, is_alive, remarks, birthday, death_date, residence_place)";

function toInsertParams(input: CreateMemberInput, familyId: number): any[] {
  return [
    familyId,
    input.name,
    input.generation ?? null,
    input.sibling_order ?? null,
    input.father_id ?? null,
    input.gender ?? null,
    input.official_position ?? null,
    input.is_alive ?? true ? 1 : 0,
    input.remarks ?? null,
    input.birthday ?? null,
    input.death_date ?? null,
    input.residence_place ?? null,
  ];
}

/**
 * 设置成员的配偶关系 (双向关联)
 * - spouseId: 关联族内已有成员
 * - spouseName: spouseId 为空时,按姓名新建配偶成员
 * - 两者都为空: 解除当前配偶关系
 * 内部使用,不导出
 */
async function applySpouse(
  familyId: number,
  memberId: number,
  spouseId: number | null,
  spouseName: string | null
): Promise<void> {
  // 1. 解除当前配偶关系 (双向)
  const cur = await query<{ spouse_id: number | null }>(
    "SELECT spouse_id FROM family_members WHERE family_id = ? AND id = ?",
    [familyId, memberId]
  );
  const curSpouseId = cur[0]?.spouse_id ?? null;
  if (curSpouseId) {
    await execute(
      "UPDATE family_members SET spouse_id = NULL WHERE family_id = ? AND id = ?",
      [familyId, curSpouseId]
    );
  }
  await execute(
    "UPDATE family_members SET spouse_id = NULL WHERE family_id = ? AND id = ?",
    [familyId, memberId]
  );

  // 2. 建立新关联
  if (spouseId) {
    // 校验目标属于本家族且不是自己
    const target = await query<{ id: number; spouse_id: number | null }>(
      "SELECT id, spouse_id FROM family_members WHERE family_id = ? AND id = ? AND id != ?",
      [familyId, spouseId, memberId]
    );
    if (target.length === 0) return;
    // 解除目标的原配偶
    if (target[0].spouse_id) {
      await execute(
        "UPDATE family_members SET spouse_id = NULL WHERE family_id = ? AND id = ?",
        [familyId, target[0].spouse_id]
      );
    }
    // 双向关联
    await execute(
      "UPDATE family_members SET spouse_id = ? WHERE family_id = ? AND id = ?",
      [target[0].id, familyId, memberId]
    );
    await execute(
      "UPDATE family_members SET spouse_id = ? WHERE family_id = ? AND id = ?",
      [memberId, familyId, target[0].id]
    );
  } else if (spouseName && spouseName.trim()) {
    // 新建配偶成员: 性别取反,世代随本人
    const me = await query<{ gender: "男" | "女" | null; generation: number | null }>(
      "SELECT gender, generation FROM family_members WHERE family_id = ? AND id = ?",
      [familyId, memberId]
    );
    const gender =
      me[0]?.gender === "男" ? "女" : me[0]?.gender === "女" ? "男" : null;
    const result = await execute(
      `INSERT INTO family_members (family_id, name, generation, gender, is_alive, spouse_id)
       VALUES (?, ?, ?, ?, 1, ?)`,
      [familyId, spouseName.trim(), me[0]?.generation ?? null, gender, memberId]
    );
    await execute(
      "UPDATE family_members SET spouse_id = ? WHERE family_id = ? AND id = ?",
      [result.insertId, familyId, memberId]
    );
  }
}

export async function createFamilyMember(
  input: CreateMemberInput
): Promise<{ success: boolean; error: string | null }> {
  const admin = await getAdminUser();
  if (!admin || admin.family_id === null) {
    return { success: false, error: "只有管理员可以编辑族谱数据" };
  }
  try {
    const result = await execute(
      `INSERT INTO family_members ${INSERT_FIELDS} VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      toInsertParams(input, admin.family_id)
    );
    // 配偶关联
    await applySpouse(
      admin.family_id,
      result.insertId,
      input.spouse_id ?? null,
      input.spouse_name ?? null
    );
    revalidatePath("/family-tree", "layout");
    return { success: true, error: null };
  } catch (error) {
    return { success: false, error: (error as Error).message };
  }
}

export async function deleteFamilyMembers(
  ids: number[]
): Promise<{ success: boolean; error: string | null }> {
  const admin = await getAdminUser();
  if (!admin || admin.family_id === null) {
    return { success: false, error: "只有管理员可以编辑族谱数据" };
  }
  if (ids.length === 0) {
    return { success: false, error: "没有选择要删除的成员" };
  }

  try {
    const placeholders = ids.map(() => "?").join(",");
    // 先解除幸存配偶的回指关联 (被删成员若为某人的配偶,清空对方的 spouse_id)
    await execute(
      `UPDATE family_members SET spouse_id = NULL WHERE family_id = ? AND spouse_id IN (${placeholders})`,
      [admin.family_id, ...ids]
    );
    await execute(
      `DELETE FROM family_members WHERE family_id = ? AND id IN (${placeholders})`,
      [admin.family_id, ...ids]
    );
    revalidatePath("/family-tree", "layout");
    return { success: true, error: null };
  } catch (error) {
    return { success: false, error: (error as Error).message };
  }
}

// 获取所有成员用于父亲/配偶选择下拉框
export async function fetchAllMembersForSelect(): Promise<
  { id: number; name: string; generation: number | null }[]
> {
  try {
    const familyId = await getFamilyId();
    if (familyId === null) return [];
    return await query<{ id: number; name: string; generation: number | null }>(
      `SELECT id, name, generation FROM family_members WHERE family_id = ? ORDER BY generation IS NULL ASC, generation ASC, sibling_order IS NULL ASC, sibling_order ASC, name ASC`,
      [familyId]
    );
  } catch (error) {
    console.error("Error fetching members for select:", error);
    return [];
  }
}

export interface UpdateMemberInput extends CreateMemberInput {
  id: number;
}

// 根据 ID 获取单个成员
export async function fetchMemberById(
  id: number
): Promise<FamilyMember | null> {
  try {
    const familyId = await getFamilyId();
    if (familyId === null) return null;
    const rows = await query<MemberRow>(
      `SELECT m.*, s.name AS spouse_name FROM family_members m
       LEFT JOIN family_members s ON s.id = m.spouse_id
       WHERE m.family_id = ? AND m.id = ?`,
      [familyId, id]
    );
    if (rows.length === 0) return null;

    const row = rows[0];
    let fatherName: string | null = null;
    if (row.father_id) {
      const fathers = await query<{ name: string }>(
        "SELECT name FROM family_members WHERE family_id = ? AND id = ?",
        [familyId, row.father_id]
      );
      fatherName = fathers[0]?.name || null;
    }

    return toMember(row, fatherName);
  } catch (error) {
    console.error("Error fetching member by id:", error);
    return null;
  }
}

export async function updateFamilyMember(
  input: UpdateMemberInput
): Promise<{ success: boolean; error: string | null }> {
  const admin = await getAdminUser();
  if (!admin || admin.family_id === null) {
    return { success: false, error: "只有管理员可以编辑族谱数据" };
  }
  try {
    await execute(
      `UPDATE family_members SET
        name = ?, generation = ?, sibling_order = ?, father_id = ?,
        gender = ?, official_position = ?, is_alive = ?,
        remarks = ?, birthday = ?, death_date = ?, residence_place = ?,
        updated_at = CURRENT_TIMESTAMP
      WHERE family_id = ? AND id = ?`,
      [...toInsertParams(input, admin.family_id).slice(1), admin.family_id, input.id]
    );
    // 配偶关联
    await applySpouse(
      admin.family_id,
      input.id,
      input.spouse_id ?? null,
      input.spouse_name ?? null
    );
    revalidatePath("/family-tree", "layout");
    return { success: true, error: null };
  } catch (error) {
    return { success: false, error: (error as Error).message };
  }
}

export interface ImportMemberInput {
  name: string;
  generation?: number | null;
  sibling_order?: number | null;
  father_name?: string | null; // 导入时使用姓名匹配
  gender?: "男" | "女" | null;
  official_position?: string | null;
  is_alive?: boolean;
  spouse?: string | null; // 导入时使用姓名匹配,匹配不到则新建
  remarks?: string | null;
  birthday?: string | null;
  residence_place?: string | null;
}

export async function batchCreateFamilyMembers(
  members: ImportMemberInput[]
): Promise<{ success: boolean; count: number; error: string | null }> {
  const admin = await getAdminUser();
  if (!admin || admin.family_id === null) {
    return { success: false, count: 0, error: "只有管理员可以编辑族谱数据" };
  }
  const familyId = admin.family_id;

  // 插入单个成员,返回新记录 ID
  const insertOne = async (
    m: ImportMemberInput,
    fatherId: number | null
  ): Promise<number> => {
    const result = await execute(
      `INSERT INTO family_members ${INSERT_FIELDS} VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        familyId,
        m.name,
        m.generation ?? null,
        m.sibling_order ?? null,
        fatherId,
        m.gender ?? null,
        m.official_position ?? null,
        m.is_alive ?? true ? 1 : 0,
        m.remarks ?? null,
        m.birthday ?? null,
        null,
        m.residence_place ?? null,
      ]
    );
    return result.insertId;
  };

  try {
    // 1. 提取所有不为空的父亲姓名
    const fatherNames = Array.from(
      new Set(
        members
          .map((m) => m.father_name?.trim())
          .filter((n): n is string => !!n)
      )
    );

    // 2. 批量查找已在数据库中的父亲 ID (仅限本家族)
    const fatherMap: Record<string, number> = {};
    if (fatherNames.length > 0) {
      const placeholders = fatherNames.map(() => "?").join(",");
      const foundFathers = await query<{ id: number; name: string }>(
        `SELECT id, name FROM family_members WHERE family_id = ? AND name IN (${placeholders})`,
        [familyId, ...fatherNames]
      );
      foundFathers.forEach((f) => {
        // 注意：如果有重名，这里会覆盖，简单起见取最后一个。
        // 实际场景可能需要更复杂的匹配逻辑（如结合世代）
        fatherMap[f.name] = f.id;
      });
    }

    // 3. 按依赖顺序分轮插入: 每轮插入"父亲已就绪"(在库中或已在本批插入)的成员。
    //    这样即使 Excel 中儿子排在父亲前面,也能正确建立父子关系。
    //    插入后把新成员注册进 fatherMap,供同批后续轮次匹配。
    let pending = members.slice();
    let count = 0;
    const inserted: { id: number; input: ImportMemberInput }[] = [];

    while (pending.length > 0) {
      const ready: ImportMemberInput[] = [];
      const blocked: ImportMemberInput[] = [];

      for (const m of pending) {
        const fatherName = m.father_name?.trim();
        if (!fatherName || fatherMap[fatherName] !== undefined) {
          ready.push(m);
        } else {
          blocked.push(m);
        }
      }

      // 无任何进展: 剩余成员的父亲名不存在或互相循环引用,
      // 兜底按原样插入(父亲关系留空),避免死循环
      if (ready.length === 0) {
        for (const m of blocked) {
          const newId = await insertOne(m, null);
          inserted.push({ id: newId, input: m });
          count++;
        }
        break;
      }

      // 按原始顺序插入本轮就绪的成员
      for (const m of ready) {
        const fatherName = m.father_name?.trim();
        const fatherId = fatherName ? fatherMap[fatherName] : null;
        const newId = await insertOne(m, fatherId ?? null);
        // 注册进 fatherMap,让同批中引用该名字的儿子能在后续轮次匹配到
        fatherMap[m.name.trim()] = newId;
        inserted.push({ id: newId, input: m });
        count++;
      }

      pending = blocked;
    }

    // 4. 配偶处理: 全部插入完成后再建立配偶关联 (同批次成员可互相匹配)
    for (const { id, input } of inserted) {
      const spouseName = input.spouse?.trim();
      if (!spouseName) continue;

      // 在族内找同名成员 (排除自己)
      const cand = await query<{ id: number; spouse_id: number | null }>(
        "SELECT id, spouse_id FROM family_members WHERE family_id = ? AND name = ? AND id != ? LIMIT 1",
        [familyId, spouseName, id]
      );
      if (cand.length > 0) {
        // 已有同名成员: 未婚则双向关联,已婚则跳过 (不破坏既有婚姻)
        if (cand[0].spouse_id === null) {
          await execute(
            "UPDATE family_members SET spouse_id = ? WHERE family_id = ? AND id = ?",
            [cand[0].id, familyId, id]
          );
          await execute(
            "UPDATE family_members SET spouse_id = ? WHERE family_id = ? AND id = ?",
            [id, familyId, cand[0].id]
          );
        }
      } else {
        // 新建配偶成员 (性别取反,世代随本人)
        const me = await query<{ gender: "男" | "女" | null; generation: number | null }>(
          "SELECT gender, generation FROM family_members WHERE family_id = ? AND id = ?",
          [familyId, id]
        );
        const gender =
          me[0]?.gender === "男" ? "女" : me[0]?.gender === "女" ? "男" : null;
        const result = await execute(
          `INSERT INTO family_members (family_id, name, generation, gender, is_alive, spouse_id)
           VALUES (?, ?, ?, ?, 1, ?)`,
          [familyId, spouseName, me[0]?.generation ?? null, gender, id]
        );
        await execute(
          "UPDATE family_members SET spouse_id = ? WHERE family_id = ? AND id = ?",
          [result.insertId, familyId, id]
        );
        count++;
      }
    }

    revalidatePath("/family-tree", "layout");
    return { success: true, count, error: null };
  } catch (error) {
    return { success: false, count: 0, error: (error as Error).message };
  }
}

export async function fetchMembersForTimeline(): Promise<
  { id: number; name: string; birthday: string | null; death_date: string | null; generation: number | null }[]
> {
  try {
    const familyId = await getFamilyId();
    if (familyId === null) return [];
    return await query<{
      id: number;
      name: string;
      birthday: string | null;
      death_date: string | null;
      generation: number | null;
    }>(
      `SELECT id, name, birthday, death_date, generation FROM family_members
       WHERE family_id = ?
       ORDER BY birthday IS NULL ASC, birthday ASC`,
      [familyId]
    );
  } catch (error) {
    console.error("Error fetching timeline data:", error);
    return [];
  }
}

/**
 * 重置本家族邀请码 (仅管理员)
 */
export async function resetInviteCode(): Promise<{
  success: boolean;
  inviteCode: string | null;
  error: string | null;
}> {
  const admin = await getAdminUser();
  if (!admin || admin.family_id === null) {
    return { success: false, inviteCode: null, error: "只有管理员可以管理邀请码" };
  }
  try {
    const digits = "23456789";
    let code = "";
    const bytes = crypto.randomBytes(8);
    for (let i = 0; i < 8; i++) code += digits[bytes[i] % digits.length];

    await execute("UPDATE families SET invite_code = ? WHERE id = ?", [
      code,
      admin.family_id,
    ]);
    revalidatePath("/family-tree", "layout");
    return { success: true, inviteCode: code, error: null };
  } catch (error) {
    return { success: false, inviteCode: null, error: (error as Error).message };
  }
}
