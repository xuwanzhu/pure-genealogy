// 一次性迁移:多家族改造
// 1. 建 families 表 (姓氏/家族名/邀请码)
// 2. users、family_members 加 family_id
// 3. 存量数据全部归入"刘氏"家族,现有账号自动成为其管理员
import mysql from "mysql2/promise";
import crypto from "crypto";
import { dbConfig } from "./load-env.mjs";

const pool = mysql.createPool({
  ...dbConfig(),
  charset: "utf8mb4_unicode_ci",
  multipleStatements: false,
});

/** 生成易读的 8 位邀请码 (去掉 0/O/1/I 等易混淆字符) */
function genInviteCode() {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  const bytes = crypto.randomBytes(8);
  for (let i = 0; i < 8; i++) code += alphabet[bytes[i] % alphabet.length];
  return code;
}

// 1. families 表
await pool.execute(`
  CREATE TABLE IF NOT EXISTS families (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    surname VARCHAR(8) NOT NULL COMMENT '姓氏',
    name VARCHAR(50) NOT NULL COMMENT '家族名称,如 刘氏',
    invite_code VARCHAR(10) NOT NULL UNIQUE COMMENT '加入家族的邀请码',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
`);

// 2. users.family_id
const [userCols] = await pool.query("SHOW COLUMNS FROM users LIKE 'family_id'");
if (userCols.length === 0) {
  await pool.execute(
    "ALTER TABLE users ADD COLUMN family_id BIGINT NULL, ADD INDEX idx_users_family (family_id)"
  );
  console.log("✓ users.family_id 已添加");
} else {
  console.log("users.family_id 已存在");
}

// 3. family_members.family_id
const [memberCols] = await pool.query(
  "SHOW COLUMNS FROM family_members LIKE 'family_id'"
);
if (memberCols.length === 0) {
  await pool.execute(
    "ALTER TABLE family_members ADD COLUMN family_id BIGINT NULL, ADD INDEX idx_members_family (family_id)"
  );
  console.log("✓ family_members.family_id 已添加");
} else {
  console.log("family_members.family_id 已存在");
}

// 4. 存量数据归入"刘氏"家族 (若尚无家族)
const [existing] = await pool.query("SELECT id FROM families LIMIT 1");
let familyId;
if (existing.length === 0) {
  const [ins] = await pool.execute(
    "INSERT INTO families (surname, name, invite_code) VALUES ('刘', '刘氏', ?)",
    [genInviteCode()]
  );
  familyId = ins.insertId;
  console.log(`✓ 已创建"刘氏"家族 (id=${familyId})`);
} else {
  familyId = existing[0].id;
  console.log(`家族已存在 (id=${familyId}),复用`);
}

// 5. 存量用户与成员归入该家族
await pool.execute("UPDATE users SET family_id = ? WHERE family_id IS NULL", [
  familyId,
]);
await pool.execute(
  "UPDATE family_members SET family_id = ? WHERE family_id IS NULL",
  [familyId]
);

const [users] = await pool.query(
  "SELECT u.email, u.role, f.name AS family FROM users u JOIN families f ON f.id = u.family_id"
);
const [members] = await pool.query(
  "SELECT f.name AS family, COUNT(*) AS cnt FROM family_members m JOIN families f ON f.id = m.family_id GROUP BY f.name"
);
console.log("用户归属:", JSON.stringify(users));
console.log("成员归属:", JSON.stringify(members));

await pool.end();
console.log("✓ 迁移完成");
