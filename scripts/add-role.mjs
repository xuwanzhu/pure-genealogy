// 一次性迁移:users 表加 role 字段,现有用户升级为 admin
import mysql from "mysql2/promise";
import { dbConfig } from "./load-env.mjs";

const pool = mysql.createPool(dbConfig());

const [cols] = await pool.query("SHOW COLUMNS FROM users LIKE 'role'");
if (cols.length === 0) {
  await pool.execute(
    "ALTER TABLE users ADD COLUMN role VARCHAR(10) NOT NULL DEFAULT 'viewer'"
  );
  console.log("✓ 已添加 role 字段");
} else {
  console.log("role 字段已存在,跳过");
}

// 现有用户全部升级为 admin(早期用户即维护者)
await pool.execute("UPDATE users SET role = 'admin'");
const [rows] = await pool.query("SELECT id, email, role FROM users");
console.log("当前用户:", JSON.stringify(rows, null, 2));

await pool.end();
