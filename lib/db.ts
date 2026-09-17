import mysql from "mysql2/promise";

/**
 * MySQL 连接池 (全局单例)
 * dateStrings: true 使 DATE 类型以 'YYYY-MM-DD' 字符串返回，
 * 与原有 Supabase 版本的数据格式保持一致
 */
declare global {
  // eslint-disable-next-line no-var
  var __mysqlPool: mysql.Pool | undefined;
}

export function getPool(): mysql.Pool {
  if (!global.__mysqlPool) {
    global.__mysqlPool = mysql.createPool({
      host: process.env.MYSQL_HOST || "127.0.0.1",
      port: Number(process.env.MYSQL_PORT || 3306),
      user: process.env.MYSQL_USER || "root",
      password: process.env.MYSQL_PASSWORD || "",
      database: process.env.MYSQL_DATABASE || "genealogy",
      waitForConnections: true,
      connectionLimit: 10,
      dateStrings: true,
      charset: "utf8mb4_unicode_ci",
    });
  }
  return global.__mysqlPool;
}

/**
 * 执行 SQL 查询的便捷方法
 */
export async function query<T = any>(sql: string, params?: any[]): Promise<T[]> {
  const [rows] = await getPool().execute(sql, params);
  return rows as T[];
}

/**
 * 执行 INSERT / UPDATE / DELETE
 */
export async function execute(
  sql: string,
  params?: any[]
): Promise<{ affectedRows: number; insertId: number }> {
  const [result] = await getPool().execute(sql, params);
  return result as { affectedRows: number; insertId: number };
}
