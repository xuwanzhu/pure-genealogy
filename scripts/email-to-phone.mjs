/**
 * 迁移: users.email → users.phone (登录凭证从邮箱改为手机号)
 * 存量测试账号 e2e@test.local → 13800000001
 */
import mysql from "mysql2/promise";
import { dbConfig } from "./load-env.mjs";

const pool = mysql.createPool(dbConfig());
// 1. 列重命名 (MySQL 8.0+)
const [cols] = await pool.query(
  "SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = 'genealogy' AND TABLE_NAME = 'users' AND COLUMN_NAME IN ('email','phone')"
);
const hasEmail = cols.some((c) => c.COLUMN_NAME === "email");
if (hasEmail) {
  await pool.query("ALTER TABLE users RENAME COLUMN email TO phone");
  console.log("✓ users.email → users.phone");
} else {
  console.log("- phone 列已存在,跳过重命名");
}

// 2. 存量邮箱账号改为手机号 (测试账号)
await pool.query(
  "UPDATE users SET phone = '13800000001' WHERE phone = 'e2e@test.local'"
);

// 3. 验证
const [users] = await pool.query(
  "SELECT id, phone, role, family_id FROM users ORDER BY id"
);
console.log("USERS:", JSON.stringify(users));

// 4. 检查重复手机号 (phone 应全局唯一)
const [dupes] = await pool.query(
  "SELECT phone, COUNT(*) AS c FROM users GROUP BY phone HAVING c > 1"
);
console.log("DUPES(should be empty):", JSON.stringify(dupes));
await pool.end();
