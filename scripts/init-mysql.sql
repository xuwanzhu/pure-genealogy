-- 族谱管理系统数据库结构 (MySQL 8)
-- 全新部署: mysql -u root -p < scripts/init-mysql.sql

CREATE DATABASE IF NOT EXISTS genealogy CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

USE genealogy;

-- 家族表 (多家族数据隔离的根)
CREATE TABLE IF NOT EXISTS families (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    surname VARCHAR(8) NOT NULL COMMENT '姓氏',
    name VARCHAR(50) NOT NULL COMMENT '家族名称,如 刘氏',
    invite_code VARCHAR(10) NOT NULL COMMENT '加入家族的邀请码 (8位纯数字)',
    created_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uk_families_invite_code (invite_code)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 用户表 (手机号 + bcrypt 自建认证)
CREATE TABLE IF NOT EXISTS users (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    phone VARCHAR(255) NOT NULL,
    password_hash VARCHAR(100) NOT NULL COMMENT 'bcrypt 哈希',
    role VARCHAR(10) NOT NULL DEFAULT 'viewer' COMMENT 'admin=管理员(可写) viewer=只读',
    family_id BIGINT NULL COMMENT '所属家族',
    created_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uk_users_phone (phone),
    KEY idx_users_family (family_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 会话表 (httpOnly cookie 对应的服务端会话)
CREATE TABLE IF NOT EXISTS sessions (
    id VARCHAR(64) PRIMARY KEY,
    user_id BIGINT NOT NULL,
    expires_at TIMESTAMP NOT NULL,
    created_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
    KEY idx_sessions_user_id (user_id),
    KEY idx_sessions_expires_at (expires_at),
    CONSTRAINT fk_sessions_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 族谱成员表
CREATE TABLE IF NOT EXISTS family_members (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    family_id BIGINT NULL COMMENT '所属家族',
    user_id BIGINT NULL COMMENT '关联账号 (每个账号对应一个成员)',
    name VARCHAR(100) NOT NULL,
    generation INT NULL COMMENT '世代 (第几世)',
    sibling_order INT NULL COMMENT '同辈排行',
    father_id BIGINT NULL COMMENT '父亲成员 id',
    gender VARCHAR(2) NULL COMMENT '男/女',
    official_position VARCHAR(200) NULL COMMENT '官职/头衔',
    is_alive TINYINT(1) DEFAULT 1 COMMENT '是否在世',
    spouse VARCHAR(200) NULL COMMENT '旧版配偶姓名文本 (兼容保留,新数据使用 spouse_id)',
    spouse_id BIGINT NULL COMMENT '配偶成员 id (双向关联)',
    remarks LONGTEXT NULL COMMENT '生平事迹 (Slate.js 富文本 JSON)',
    birthday DATE NULL,
    death_date DATE NULL,
    residence_place VARCHAR(200) NULL COMMENT '居住地',
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uk_member_user (user_id),
    KEY idx_members_family (family_id),
    KEY idx_family_members_father_id (father_id),
    KEY idx_family_members_name (name),
    KEY idx_member_spouse (spouse_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
