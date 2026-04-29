-- ============================================================
-- MIGRATION: Create employee_branch_permissions table
-- Run this in MySQL Workbench for BOTH databases
-- ============================================================

-- ============================================================
-- DATABASE 1: SOLUTION_ONE_DB
-- ============================================================
USE solution_one_db;

CREATE TABLE IF NOT EXISTS employee_branch_permissions (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    main_unit_id INT NOT NULL,
    allowed_unit_id INT NOT NULL,
    is_active TINYINT(1) NOT NULL DEFAULT 1,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    CONSTRAINT fk_ebp_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    CONSTRAINT fk_ebp_main_unit FOREIGN KEY (main_unit_id) REFERENCES units(id) ON DELETE CASCADE,
    CONSTRAINT fk_ebp_allowed_unit FOREIGN KEY (allowed_unit_id) REFERENCES units(id) ON DELETE CASCADE,
    UNIQUE KEY uq_user_allowed (user_id, allowed_unit_id),
    INDEX idx_user_id (user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

SELECT 'solution_one_db — employee_branch_permissions created' AS Status;
DESCRIBE employee_branch_permissions;

-- ============================================================
-- DATABASE 2: CRYOGAS_DB
-- ============================================================
USE cryogas_db;

CREATE TABLE IF NOT EXISTS employee_branch_permissions (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    main_unit_id INT NOT NULL,
    allowed_unit_id INT NOT NULL,
    is_active TINYINT(1) NOT NULL DEFAULT 1,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    CONSTRAINT fk_ebp_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    CONSTRAINT fk_ebp_main_unit FOREIGN KEY (main_unit_id) REFERENCES units(id) ON DELETE CASCADE,
    CONSTRAINT fk_ebp_allowed_unit FOREIGN KEY (allowed_unit_id) REFERENCES units(id) ON DELETE CASCADE,
    UNIQUE KEY uq_user_allowed (user_id, allowed_unit_id),
    INDEX idx_user_id (user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

SELECT 'cryogas_db — employee_branch_permissions created' AS Status;
DESCRIBE employee_branch_permissions;
