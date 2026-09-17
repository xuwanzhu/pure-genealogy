import mysql from "mysql2/promise";
import { dbConfig } from "./load-env.mjs";

/**
 * 迁移:
 * 1. family_members 增加 user_id (账号-成员关联) 和 spouse_id (配偶关联)
 * 2. 存量配偶文本 (spouse) 转换为正式成员记录并建立双向关联
 */
const pool = mysql.createPool(dbConfig());

// 1. 加列
const [cols] = await pool.query(
  "SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = 'genealogy' AND TABLE_NAME = 'family_members' AND COLUMN_NAME IN ('user_id','spouse_id')"
);
const colNames = cols.map((c) => c.COLUMN_NAME);
if (!colNames.includes("user_id")) {
  await pool.query(
    "ALTER TABLE family_members ADD COLUMN user_id BIGINT NULL, ADD UNIQUE KEY uk_member_user (user_id)"
  );
  console.log("✓ user_id 列已添加");
}
if (!colNames.includes("spouse_id")) {
  await pool.query(
    "ALTER TABLE family_members ADD COLUMN spouse_id BIGINT NULL, ADD KEY idx_member_spouse (spouse_id)"
  );
  console.log("✓ spouse_id 列已添加");
}

// 2. 存量配偶文本 → 成员记录
const [rows] = await pool.query(
  "SELECT id, family_id, name, gender, generation, is_alive, spouse FROM family_members WHERE spouse IS NOT NULL AND spouse != '' AND spouse_id IS NULL"
);
console.log(`待转换配偶文本: ${rows.length} 条`);

let linked = 0;
let created = 0;

for (const m of rows) {
  const spouseName = m.spouse.trim();
  if (!spouseName) continue;

  // 情况A: 配偶文本与族内已有成员同名 → 直接建立双向关联
  const [existing] = await pool.query(
    "SELECT id, spouse_id FROM family_members WHERE family_id = ? AND name = ? AND id != ?",
    [m.family_id, spouseName, m.id]
  );
  if (existing.length > 0 && existing[0].spouse_id === null) {
    await pool.query(
      "UPDATE family_members SET spouse_id = ? WHERE id = ?",
      [existing[0].id, m.id]
    );
    await pool.query(
      "UPDATE family_members SET spouse_id = ?, spouse = NULL WHERE id = ?",
      [m.id, existing[0].id]
    );
    linked++;
    continue;
  }

  // 情况B: 新建配偶成员记录 (性别取反,世代随本人,存亡随本人)
  const spouseGender = m.gender === "男" ? "女" : m.gender === "女" ? "男" : null;
  const [ins] = await pool.query(
    `INSERT INTO family_members (family_id, name, generation, gender, is_alive, spouse_id)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [m.family_id, spouseName, m.generation, spouseGender, m.is_alive, m.id]
  );
  await pool.query(
    "UPDATE family_members SET spouse_id = ?, spouse = NULL WHERE id = ?",
    [ins.insertId, m.id]
  );
  created++;
}

console.log(`✓ 已关联族内既有成员: ${linked} 条, 新建配偶成员: ${created} 条`);

// 3. 验证
const [members] = await pool.query(
  "SELECT COUNT(*) AS total, SUM(spouse_id IS NOT NULL) AS coupled FROM family_members"
);
console.log("MEMBERS:", JSON.stringify(members[0]));

const [bad] = await pool.query(
  `SELECT a.id, b.id AS spouse_id, b.spouse_id AS back
   FROM family_members a JOIN family_members b ON b.id = a.spouse_id
   WHERE b.spouse_id != a.id`
);
console.log("单向关联(应为空):", JSON.stringify(bad));
await pool.end();
