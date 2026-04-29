-- ============================================================
-- TASK 1: Assign users to multiple units via user_units table
-- Run these in MySQL Workbench against the desired database
-- ============================================================

-- ============================================================
-- EXAMPLE: Assign user_id = 1 to unit_id = 1 and unit_id = 2
-- Uses INSERT IGNORE to skip if mapping already exists
-- ============================================================

-- Switch to the target database first
USE solution_one_db;

-- Assign a single user to multiple units
INSERT IGNORE INTO user_units (user_id, unit_id) VALUES (1, 1);
INSERT IGNORE INTO user_units (user_id, unit_id) VALUES (1, 2);

-- Or do it in one statement:
-- INSERT IGNORE INTO user_units (user_id, unit_id) VALUES
-- (1, 1),
-- (1, 2),
-- (1, 3);

-- ============================================================
-- VERIFY: See all units assigned to user_id = 1
-- ============================================================
SELECT
    uu.user_id,
    u.name AS user_name,
    un.id AS unit_id,
    un.name AS unit_name,
    un.is_geofenced
FROM user_units uu
JOIN users u ON uu.user_id = u.id
JOIN units un ON uu.unit_id = un.id
WHERE uu.user_id = 1
ORDER BY un.name;

-- ============================================================
-- USEFUL: See ALL user-unit mappings in the database
-- ============================================================
SELECT
    u.id AS user_id,
    u.name AS user_name,
    u.role,
    GROUP_CONCAT(un.name ORDER BY un.name SEPARATOR ', ') AS assigned_units,
    COUNT(uu.unit_id) AS unit_count
FROM users u
LEFT JOIN user_units uu ON u.id = uu.user_id
LEFT JOIN units un ON uu.unit_id = un.id
GROUP BY u.id, u.name, u.role
ORDER BY u.role, u.name;

-- ============================================================
-- USEFUL: Remove a user from a unit
-- ============================================================
-- DELETE FROM user_units WHERE user_id = 1 AND unit_id = 2;

-- ============================================================
-- USEFUL: Assign ALL units to a user (e.g., Super Admin)
-- ============================================================
-- INSERT IGNORE INTO user_units (user_id, unit_id)
-- SELECT 1, id FROM units;
