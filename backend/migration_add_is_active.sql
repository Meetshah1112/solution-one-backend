-- ============================================================
-- MIGRATION: Add is_active column to users table
-- Run this in MySQL Workbench for BOTH databases
-- ============================================================

-- ============================================================
-- DATABASE 1: SOLUTION_ONE_DB
-- ============================================================
USE solution_one_db;

-- Add is_active column (default TRUE — all existing users remain active)
ALTER TABLE users
ADD COLUMN is_active TINYINT(1) NOT NULL DEFAULT 1;

-- Verify
SELECT 'solution_one_db — is_active column added' AS Status;
DESCRIBE users;

-- ============================================================
-- DATABASE 2: CRYOGAS_DB
-- ============================================================
USE cryogas_db;

-- Add is_active column (default TRUE — all existing users remain active)
ALTER TABLE users
ADD COLUMN is_active TINYINT(1) NOT NULL DEFAULT 1;

-- Verify
SELECT 'cryogas_db — is_active column added' AS Status;
DESCRIBE users;

-- ============================================================
-- SAMPLE: Deactivate a specific user (e.g., user_id = 5)
-- ============================================================
-- USE solution_one_db;
-- UPDATE users SET is_active = 0 WHERE id = 5;

-- SAMPLE: Reactivate
-- UPDATE users SET is_active = 1 WHERE id = 5;

-- SAMPLE: See all users with their status
-- SELECT id, name, email, role, is_active FROM users ORDER BY role, name;
