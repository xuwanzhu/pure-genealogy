"use server";

import { query } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";

export interface StatisticsData {
  totalMembers: number;
  genderStats: { name: string; value: number; fill: string }[];
  generationStats: { name: string; value: number }[];
  statusStats: { name: string; value: number; fill: string }[];
  ageStats: { name: string; value: number }[];
  commonNames: { name: string; count: number }[];
  /** 夫妻对数 (双向关联计为一对) */
  couplePairs: number;
  /** 家族繁衍的最大世代数 */
  generations: number;
  /** 人丁最兴旺的一世 */
  peakGeneration: { name: string; value: number } | null;
  /** 在世成员平均年龄 (仅统计有生日者) */
  avgAge: number | null;
  /** 在世最年长者 */
  eldestAlive: { name: string; age: number } | null;
  /** 享年最高纪录 (有生卒年份的已故成员) */
  longevityRecord: { name: string; age: number } | null;
}

interface StatMember {
  id: number;
  name: string;
  gender: "男" | "女" | null;
  generation: number | null;
  is_alive: number;
  birthday: string | null;
  death_date: string | null;
  spouse_id: number | null;
}

/** 空统计 (无家族/无成员时返回) */
function emptyStatistics(): StatisticsData {
  return {
    totalMembers: 0,
    genderStats: [],
    generationStats: [],
    statusStats: [],
    ageStats: [],
    commonNames: [],
    couplePairs: 0,
    generations: 0,
    peakGeneration: null,
    avgAge: null,
    eldestAlive: null,
    longevityRecord: null,
  };
}

/** 按出生日期计算周岁 */
function calcAge(birthday: string, ref: Date): number | null {
  const birth = new Date(birthday);
  if (Number.isNaN(birth.getTime())) return null;
  let age = ref.getFullYear() - birth.getFullYear();
  const m = ref.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && ref.getDate() < birth.getDate())) age--;
  return age;
}

export async function fetchFamilyStatistics(): Promise<{
  data: StatisticsData | null;
  error: string | null;
}> {
  let members: StatMember[];
  try {
    const user = await getSessionUser();
    if (user?.family_id == null) return { data: emptyStatistics(), error: null };

    members = await query<StatMember>(
      `SELECT id, name, gender, generation, is_alive, birthday, death_date, spouse_id
       FROM family_members
       WHERE family_id = ?
       ORDER BY generation IS NULL ASC, generation ASC`,
      [user.family_id]
    );
  } catch (error) {
    console.error("Error fetching statistics data:", error);
    return { data: null, error: (error as Error).message };
  }

  if (members.length === 0) return { data: emptyStatistics(), error: null };

  const totalMembers = members.length;

  // 1. 性别统计
  const genderCounts = members.reduce(
    (acc, member) => {
      const gender = member.gender || "未知";
      acc[gender] = (acc[gender] || 0) + 1;
      return acc;
    },
    {} as Record<string, number>
  );

  const genderStats = [
    { name: "男", value: genderCounts["男"] || 0, fill: "#10b981" },
    { name: "女", value: genderCounts["女"] || 0, fill: "#ec4899" },
  ];
  if (genderCounts["未知"]) {
    genderStats.push({ name: "未知", value: genderCounts["未知"], fill: "#94a3b8" });
  }

  // 2. 世代统计
  const generationCounts = members.reduce(
    (acc, member) => {
      const gen = member.generation ? `第${member.generation}世` : "未知";
      acc[gen] = (acc[gen] || 0) + 1;
      return acc;
    },
    {} as Record<string, number>
  );

  const sortedGenerations = Object.keys(generationCounts).sort((a, b) => {
    if (a === "未知") return 1;
    if (b === "未知") return -1;
    return parseInt(a.replace(/\D/g, "")) - parseInt(b.replace(/\D/g, ""));
  });

  const generationStats = sortedGenerations.map((gen) => ({
    name: gen,
    value: generationCounts[gen],
  }));

  // 已知世代的最大繁衍数 & 人丁最旺一世
  let generations = 0;
  let peakGeneration: { name: string; value: number } | null = null;
  generationStats.forEach((g) => {
    if (g.name !== "未知") {
      generations = Math.max(generations, parseInt(g.name.replace(/\D/g, "")));
      if (!peakGeneration || g.value > peakGeneration.value) peakGeneration = g;
    }
  });

  // 3. 生死状态
  const statusCounts = members.reduce(
    (acc, member) => {
      acc[member.is_alive ? "在世" : "已故"] =
        (acc[member.is_alive ? "在世" : "已故"] || 0) + 1;
      return acc;
    },
    {} as Record<string, number>
  );

  const statusStats = [
    { name: "在世", value: statusCounts["在世"] || 0, fill: "#10b981" },
    { name: "已故", value: statusCounts["已故"] || 0, fill: "#94a3b8" },
  ];

  // 4. 年龄分段 (在世且有生日)
  const now = new Date();
  const ageGroups: Record<string, number> = {
    "0-10岁": 0,
    "11-20岁": 0,
    "21-30岁": 0,
    "31-40岁": 0,
    "41-50岁": 0,
    "51-60岁": 0,
    "61-70岁": 0,
    "71-80岁": 0,
    "80岁以上": 0,
  };

  let ageSum = 0;
  let ageCount = 0;
  let eldestAlive: { name: string; age: number } | null = null;

  members.forEach((member) => {
    if (member.is_alive && member.birthday) {
      const age = calcAge(member.birthday, now);
      if (age === null || age < 0) return;

      ageSum += age;
      ageCount++;
      if (!eldestAlive || age > eldestAlive.age) {
        eldestAlive = { name: member.name, age };
      }

      if (age <= 10) ageGroups["0-10岁"]++;
      else if (age <= 20) ageGroups["11-20岁"]++;
      else if (age <= 30) ageGroups["21-30岁"]++;
      else if (age <= 40) ageGroups["31-40岁"]++;
      else if (age <= 50) ageGroups["41-50岁"]++;
      else if (age <= 60) ageGroups["51-60岁"]++;
      else if (age <= 70) ageGroups["61-70岁"]++;
      else if (age <= 80) ageGroups["71-80岁"]++;
      else ageGroups["80岁以上"]++;
    }
  });

  const ageStats = Object.entries(ageGroups).map(([name, value]) => ({ name, value }));
  const avgAge = ageCount > 0 ? Math.round((ageSum / ageCount) * 10) / 10 : null;

  // 5. 享年纪录 (已故且生卒日期齐全)
  let longevityRecord: { name: string; age: number } | null = null;
  members.forEach((member) => {
    if (!member.is_alive && member.birthday && member.death_date) {
      const death = new Date(member.death_date);
      const age = calcAge(member.birthday, death);
      if (age !== null && age >= 0 && (!longevityRecord || age > longevityRecord.age)) {
        longevityRecord = { name: member.name, age };
      }
    }
  });

  // 6. 夫妻对数 (双向关联只计一次: id < spouse_id)
  const couplePairs = members.filter(
    (m) => m.spouse_id !== null && m.id < (m.spouse_id as number)
  ).length;

  // 7. 名字第二字用字 (窥见字辈传承)
  const nameCounts: Record<string, number> = {};
  members.forEach((m) => {
    if (m.name.length >= 2) {
      const genChar = m.name[1];
      nameCounts[genChar] = (nameCounts[genChar] || 0) + 1;
    }
  });

  const commonNames = Object.entries(nameCounts)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 12)
    .map(([name, count]) => ({ name, count }));

  return {
    data: {
      totalMembers,
      genderStats,
      generationStats,
      statusStats,
      ageStats,
      commonNames,
      couplePairs,
      generations,
      peakGeneration,
      avgAge,
      eldestAlive,
      longevityRecord,
    },
    error: null,
  };
}
