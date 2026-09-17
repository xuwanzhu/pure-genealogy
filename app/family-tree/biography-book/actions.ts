"use server";

import { query } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";

export interface BiographyMember {
    id: number;
    name: string;
    generation: number | null;
    sibling_order: number | null;
    gender: "男" | "女" | null;
    birthday: string | null;
    death_date: string | null;
    is_alive: boolean;
    spouse: string | null;
    official_position: string | null;
    residence_place: string | null;
    /** 生平事迹富文本; 无实质内容时为 null (仍入册, 显示待补录) */
    remarks: string | null;
    father_name: string | null;
}

interface BiographyRow {
    id: number;
    name: string;
    generation: number | null;
    sibling_order: number | null;
    father_id: number | null;
    gender: "男" | "女" | null;
    birthday: string | null;
    death_date: string | null;
    is_alive: number;
    spouse: string | null;
    official_position: string | null;
    residence_place: string | null;
    remarks: string | null;
}

/** 判断 remarks 是否有实质文本内容 */
function hasMeaningfulRemarks(remarks: string | null): boolean {
    if (!remarks) return false;
    try {
        const parsed = JSON.parse(remarks);
        if (Array.isArray(parsed)) {
            return parsed.some((node: any) => {
                if (node.children && Array.isArray(node.children)) {
                    return node.children.some(
                        (child: any) => child.text && child.text.trim()
                    );
                }
                return false;
            });
        }
        return false;
    } catch {
        // 不是 JSON 时按纯文本处理
        return remarks.trim().length > 0;
    }
}

/**
 * 获取本家族全部成员,用于生平册展示
 * 所有成员均入册 (含尚未填写生平事迹的,前端显示"待补录")
 */
export async function fetchMembersWithBiography(): Promise<{
    data: BiographyMember[];
    error: string | null;
}> {
    try {
        const user = await getSessionUser();
        if (user?.family_id == null) return { data: [], error: null };

        // 全量查询本家族成员 (JOIN 取配偶姓名)
        const rows = await query<BiographyRow>(
            `SELECT m.*, s.name AS spouse FROM family_members m
             LEFT JOIN family_members s ON s.id = m.spouse_id
             WHERE m.family_id = ?
             ORDER BY m.generation IS NULL ASC, m.generation ASC,
                      m.sibling_order IS NULL ASC, m.sibling_order ASC, m.id ASC`,
            [user.family_id]
        );

        // 批量查询父亲姓名
        const fatherIds = rows
            .map((item) => item.father_id)
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

        // 转换数据格式: 无实质内容的 remarks 置为 null
        const data: BiographyMember[] = rows.map((item) => ({
            id: item.id,
            name: item.name,
            generation: item.generation,
            sibling_order: item.sibling_order,
            gender: item.gender,
            birthday: item.birthday,
            death_date: item.death_date,
            is_alive: !!item.is_alive,
            spouse: item.spouse,
            official_position: item.official_position,
            residence_place: item.residence_place,
            remarks: hasMeaningfulRemarks(item.remarks) ? (item.remarks as string) : null,
            father_name: item.father_id ? fatherMap[item.father_id] || null : null,
        }));

        return { data, error: null };
    } catch (error) {
        return { data: [], error: (error as Error).message };
    }
}
