-- ===================================================================
-- Database Setup Script for Gitea on PostgreSQL (Raspberry Pi 5)
-- Execute as 'postgres' superuser: psql -U postgres -f scripts/setup_db.sql
-- ===================================================================

-- 1. Create dedicated user for Gitea
CREATE USER gitea WITH PASSWORD 'gitea_secure_school_pass_2026';

-- 2. Create Gitea database with UTF-8 encoding
CREATE DATABASE gitea OWNER gitea ENCODING 'UTF8';

-- 3. Grant privileges
GRANT ALL PRIVILEGES ON DATABASE gitea TO gitea;

-- Connect to gitea database and set default privileges
\c gitea

GRANT ALL ON SCHEMA public TO gitea;
ALTER SCHEMA public OWNER TO gitea;
