// 演示数据生成脚本:node scripts/seed-demo.mjs [--force]
// --force: 清空现有数据后重新插入
import mysql from "mysql2/promise";
import { dbConfig } from "./load-env.mjs";

const FORCE = process.argv.includes("--force");

const pool = mysql.createPool({
  ...dbConfig(),
  charset: "utf8mb4_unicode_ci",
  dateStrings: true,
});

/** 生平事迹 (Lexical 编辑器 JSON 格式) */
const bio = (text) =>
  JSON.stringify([{ type: "paragraph", children: [{ text }] }]);

// name → id 映射,用于建立父子关系
const idMap = new Map();

async function insertMember(m) {
  const [result] = await pool.execute(
    `INSERT INTO family_members
       (name, generation, sibling_order, father_id, gender, official_position,
        is_alive, spouse, remarks, birthday, death_date, residence_place)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      m.name,
      m.generation,
      m.sibling_order ?? null,
      m.father_name ? idMap.get(m.father_name) ?? null : null,
      m.gender,
      m.official_position ?? null,
      m.isAlive ? 1 : 0,
      m.spouse ?? null,
      m.remarks ? bio(m.remarks) : null,
      m.birthday ?? null,
      m.deathDate ?? null,
      m.residence ?? null,
    ]
  );
  idMap.set(m.name, result.insertId);
  return result.insertId;
}

const MEMBERS = [
  // ── 第一代 · 始祖 ──
  {
    name: "刘德源", generation: 1, sibling_order: 1, gender: "男",
    isAlive: false, birthday: "1920-03-15", deathDate: "2008-11-02",
    spouse: "王淑珍", residence: "山东济南",
    remarks:
      "刘德源，字润之，1920年生于山东济南。幼读私塾，通晓经史。青年时逢乱世，辗转齐鲁之间，以经商为业，重信守义，乡里称贤。晚年四世同堂，含饴弄孙，2008年冬无疾而终，享年八十八岁。",
  },

  // ── 第二代 ──
  {
    name: "刘建国", generation: 2, sibling_order: 1, father_name: "刘德源", gender: "男",
    isAlive: true, birthday: "1946-07-21",
    spouse: "陈慧英", official_position: "中学校长", residence: "山东济南",
    remarks:
      "刘建国，长房长子。1968年毕业于山东师范学院，毕生从教四十载，桃李满天下。曾任济南第三中学副校长、校长，治学严谨，育人有方。退休后醉心书法，尤擅楷书。",
  },
  {
    name: "刘建军", generation: 2, sibling_order: 2, father_name: "刘德源", gender: "男",
    isAlive: false, birthday: "1949-10-08", deathDate: "2015-04-17",
    spouse: "李凤霞", official_position: "高级工程师", residence: "北京海淀",
    remarks:
      "刘建军，1962年考入清华大学土木工程系，毕业后投身国家基建事业，参与过多座大型桥梁设计。为人质朴低调，一生勤勉，2015年春因病辞世。",
  },
  {
    name: "刘秀兰", generation: 2, sibling_order: 3, father_name: "刘德源", gender: "女",
    isAlive: true, birthday: "1953-05-30",
    spouse: "张德福", residence: "山东青岛",
  },

  // ── 第三代 · 建国一支 ──
  {
    name: "刘志强", generation: 3, sibling_order: 1, father_name: "刘建国", gender: "男",
    isAlive: true, birthday: "1972-09-12",
    spouse: "王丽", official_position: "软件架构师", residence: "上海浦东",
    remarks:
      "刘志强，1994年毕业于复旦大学计算机系，是国内最早一批互联网从业者。现居上海，任某科技公司首席架构师。工作之余喜爱马拉松，已完成十余次全程比赛。",
  },
  {
    name: "刘志伟", generation: 3, sibling_order: 2, father_name: "刘建国", gender: "男",
    isAlive: true, birthday: "1976-02-14",
    spouse: "赵敏", official_position: "主任医师", residence: "山东济南",
  },
  {
    name: "刘志明", generation: 3, sibling_order: 3, father_name: "刘建国", gender: "男",
    isAlive: true, birthday: "1980-12-05",
    spouse: "孙雅婷", official_position: "律师", residence: "广东深圳",
  },

  // ── 第三代 · 建军一支 ──
  {
    name: "刘志远", generation: 3, sibling_order: 1, father_name: "刘建军", gender: "男",
    isAlive: true, birthday: "1978-06-18",
    spouse: "孙晓燕", official_position: "大学教授", residence: "北京海淀",
    remarks:
      "刘志远，2006年获清华大学工学博士学位，现任北京某大学教授、博士生导师，研究方向为桥梁抗震。承父志，续土木缘。",
  },
  {
    name: "刘晓梅", generation: 3, sibling_order: 2, father_name: "刘建军", gender: "女",
    isAlive: true, birthday: "1982-08-25",
    spouse: "周涛", official_position: "注册会计师", residence: "上海徐汇",
  },

  // ── 第四代 ──
  {
    name: "刘宇航", generation: 4, sibling_order: 1, father_name: "刘志强", gender: "男",
    isAlive: true, birthday: "2001-04-09", residence: "上海浦东",
    official_position: "硕士研究生在读",
  },
  {
    name: "刘梦琪", generation: 4, sibling_order: 2, father_name: "刘志强", gender: "女",
    isAlive: true, birthday: "2005-11-23", residence: "上海浦东",
  },
  {
    name: "刘子轩", generation: 4, sibling_order: 1, father_name: "刘志伟", gender: "男",
    isAlive: true, birthday: "2008-03-30", residence: "山东济南",
  },
  {
    name: "刘雨桐", generation: 4, sibling_order: 1, father_name: "刘志明", gender: "女",
    isAlive: true, birthday: "2010-07-16", residence: "广东深圳",
  },
  {
    name: "刘浩然", generation: 4, sibling_order: 1, father_name: "刘志远", gender: "男",
    isAlive: true, birthday: "2012-01-19", residence: "北京海淀",
  },
  {
    name: "刘思颖", generation: 4, sibling_order: 2, father_name: "刘志远", gender: "女",
    isAlive: true, birthday: "2016-09-28", residence: "北京海淀",
  },
];

async function main() {
  const [rows] = await pool.query("SELECT COUNT(*) AS total FROM family_members");
  const total = rows[0].total;

  if (total > 0 && !FORCE) {
    console.log(`表中已有 ${total} 条数据,跳过。如需重新生成请加 --force`);
    return;
  }
  if (FORCE) {
    await pool.execute("DELETE FROM family_members");
    console.log("已清空原有数据");
  }

  for (const m of MEMBERS) {
    await insertMember(m);
  }

  const [after] = await pool.query("SELECT COUNT(*) AS total FROM family_members");
  console.log(`✓ 已插入 ${after.total} 位成员,共 4 代`);

  // 校验父子关系
  const [links] = await pool.query(
    `SELECT c.name AS child, f.name AS father
     FROM family_members c JOIN family_members f ON c.father_id = f.id
     ORDER BY c.generation`
  );
  console.log(`✓ 父子关系 ${links.length} 条:`);
  links.forEach((l) => console.log(`  ${l.father} → ${l.child}`));

  await pool.end();
}

main().catch((e) => {
  console.error("生成失败:", e.message);
  process.exit(1);
});
