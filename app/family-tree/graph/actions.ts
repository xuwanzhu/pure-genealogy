"use server";

import { query } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";

export interface FamilyMemberNode {
  id: number;
  name: string;
  generation: number | null;
  sibling_order: number | null;
  father_id: number | null;
  gender: "男" | "女" | null;
  official_position: string | null;
  is_alive: boolean;
  spouse_id: number | null;
  spouse_name: string | null;
  remarks: string | null;
  birthday: string | null;
  death_date: string | null;
  residence_place: string | null;
}

export interface FetchGraphResult {
  data: FamilyMemberNode[];
  error: string | null;
}

interface MemberRow extends Omit<FamilyMemberNode, "is_alive"> {
  is_alive: number;
}

export async function fetchAllFamilyMembers(): Promise<FetchGraphResult> {
  try {
    const user = await getSessionUser();
    if (user?.family_id == null) return { data: [], error: null };

    const rows = await query<MemberRow>(
      `SELECT m.id, m.name, m.generation, m.sibling_order, m.father_id, m.gender,
              m.official_position, m.is_alive, m.spouse_id, s.name AS spouse_name,
              m.remarks, m.birthday, m.death_date, m.residence_place
       FROM family_members m
       LEFT JOIN family_members s ON s.id = m.spouse_id
       WHERE m.family_id = ?
       ORDER BY m.generation IS NULL ASC, m.generation ASC,
                m.sibling_order IS NULL ASC, m.sibling_order ASC`,
      [user.family_id]
    );

    const data: FamilyMemberNode[] = rows.map((r) => ({
      ...r,
      is_alive: !!r.is_alive,
    }));

    return { data, error: null };
  } catch (error) {
    return { data: [], error: (error as Error).message };
  }
}
