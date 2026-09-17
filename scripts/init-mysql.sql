-- 族谱系统数据库结构 (MySQL 8)
CREATE DATABASE IF NOT EXISTS genealogy CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

USE genealogy;

-- 家族成员表
CREATE TABLE IF NOT EXISTS family_members (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    generation INT NULL,
    sibling_order INT NULL,
    father_id BIGINT NULL,
    gender VARCHAR(2) NULL,
    official_position VARCHAR(200) NULL,
    is_alive TINYINT(1) DEFAULT 1,
    spouse VARCHAR(200) NULL,
    remarks LONGTEXT NULL,
    birthday DATE NULL,
    death_date DATE NULL,
    residence_place VARCHAR(200) NULL,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP NOT NULL,
    INDEX idx_family_members_father_id (father_id),
    INDEX idx_family_members_name (name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 用户表 (自建认证)
CREATE TABLE IF NOT EXISTS users (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    email VARCHAR(255) NOT NULL UNIQUE,
    password_hash VARCHAR(100) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 会话表 (httpOnly cookie 对应的服务端会话)
CREATE TABLE IF NOT EXISTS sessions (
    id VARCHAR(64) PRIMARY KEY,
    user_id BIGINT NOT NULL,
    expires_at TIMESTAMP NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_sessions_user_id (user_id),
    INDEX idx_sessions_expires_at (expires_at),
    CONSTRAINT fk_sessions_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
