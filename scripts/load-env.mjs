import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

/**
 * 加载项目根目录 .env.local 到 process.env (不覆盖已存在的值)
 * 供数据库脚本读取连接配置,避免在脚本中硬编码密码
 */
export function loadEnv() {
  const root = join(dirname(fileURLToPath(import.meta.url)), "..");
  try {
    const content = readFileSync(join(root, ".env.local"), "utf-8");
    for (const line of content.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const eq = trimmed.indexOf("=");
      if (eq === -1) continue;
      const key = trimmed.slice(0, eq).trim();
      const value = trimmed.slice(eq + 1).trim().replace(/^["']|["']$/g, "");
      if (!(key in process.env)) process.env[key] = value;
    }
  } catch {
    // .env.local 不存在时忽略,依赖环境变量
  }
}

/** 数据库连接配置 (缺关键配置时报错退出) */
export function dbConfig() {
  loadEnv();
  const host = process.env.MYSQL_HOST || "localhost";
  const password = process.env.MYSQL_PASSWORD;
  if (!password) {
    console.error("缺少 MYSQL_PASSWORD: 请在 .env.local 或环境变量中配置数据库密码");
    process.exit(1);
  }
  return {
    host,
    port: Number(process.env.MYSQL_PORT || 3306),
    user: process.env.MYSQL_USER || "root",
    password,
    database: process.env.MYSQL_DATABASE || "genealogy",
  };
}
