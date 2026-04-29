-- ============================================================
-- PHASE 1: MULTI-TENANT DATABASE SCHEMA (v2)
-- Creates two identical databases: solution_one_db & cryogas_db
-- Run this in MySQL as root / admin user
-- ============================================================


-- ============================================================
-- DATABASE 1: SOLUTION ONE
-- ============================================================
DROP DATABASE IF EXISTS solution_one_db;
CREATE DATABASE solution_one_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE solution_one_db;

-- 1. USERS
CREATE TABLE users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    email VARCHAR(255) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    name VARCHAR(255) NOT NULL,
    role ENUM('SUPER_ADMIN', 'ADMIN', 'EMPLOYEE') NOT NULL DEFAULT 'EMPLOYEE',
    phone VARCHAR(20) DEFAULT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_email (email)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 2. UNITS (replaces old "offices" table)
CREATE TABLE units (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    latitude DECIMAL(10, 8) DEFAULT NULL,
    longitude DECIMAL(11, 8) DEFAULT NULL,
    is_geofenced TINYINT(1) NOT NULL DEFAULT 1,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_name (name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 3. USER_UNITS (many-to-many mapping)
CREATE TABLE user_units (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    unit_id INT NOT NULL,
    CONSTRAINT fk_uu_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    CONSTRAINT fk_uu_unit FOREIGN KEY (unit_id) REFERENCES units(id) ON DELETE CASCADE,
    UNIQUE KEY uq_user_unit (user_id, unit_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 4. HR_DAILYATTENDANCE (horizontal 14-punch schema)
CREATE TABLE hr_daily_attendance (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    attend_date DATE NOT NULL,

    -- Punch timestamps (1-14)
    PunchDateTime1  DATETIME DEFAULT NULL,
    PunchDateTime2  DATETIME DEFAULT NULL,
    PunchDateTime3  DATETIME DEFAULT NULL,
    PunchDateTime4  DATETIME DEFAULT NULL,
    PunchDateTime5  DATETIME DEFAULT NULL,
    PunchDateTime6  DATETIME DEFAULT NULL,
    PunchDateTime7  DATETIME DEFAULT NULL,
    PunchDateTime8  DATETIME DEFAULT NULL,
    PunchDateTime9  DATETIME DEFAULT NULL,
    PunchDateTime10 DATETIME DEFAULT NULL,
    PunchDateTime11 DATETIME DEFAULT NULL,
    PunchDateTime12 DATETIME DEFAULT NULL,
    PunchDateTime13 DATETIME DEFAULT NULL,
    PunchDateTime14 DATETIME DEFAULT NULL,

    -- Punch locations as "lat,long" strings (1-14)
    PunchLocation1  VARCHAR(50) DEFAULT NULL,
    PunchLocation2  VARCHAR(50) DEFAULT NULL,
    PunchLocation3  VARCHAR(50) DEFAULT NULL,
    PunchLocation4  VARCHAR(50) DEFAULT NULL,
    PunchLocation5  VARCHAR(50) DEFAULT NULL,
    PunchLocation6  VARCHAR(50) DEFAULT NULL,
    PunchLocation7  VARCHAR(50) DEFAULT NULL,
    PunchLocation8  VARCHAR(50) DEFAULT NULL,
    PunchLocation9  VARCHAR(50) DEFAULT NULL,
    PunchLocation10 VARCHAR(50) DEFAULT NULL,
    PunchLocation11 VARCHAR(50) DEFAULT NULL,
    PunchLocation12 VARCHAR(50) DEFAULT NULL,
    PunchLocation13 VARCHAR(50) DEFAULT NULL,
    PunchLocation14 VARCHAR(50) DEFAULT NULL,

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_att_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    UNIQUE KEY uq_user_date (user_id, attend_date),
    INDEX idx_attend_date (attend_date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;


-- ============================================================
-- SEED DATA FOR SOLUTION_ONE_DB
-- ============================================================

-- Units (geofenced offices + non-geofenced virtual units)
INSERT INTO units (id, name, latitude, longitude, is_geofenced) VALUES
(1, 'Headquarters',     22.31525800, 73.14436660, 1),
(2, 'Mumbai Branch',    19.07600000, 72.87770000, 1),
(3, 'Vadodara Branch',  22.30720000, 73.18120000, 1),
(4, 'Pune Branch',      18.52040000, 73.85670000, 1),
(5, 'Bangalore Branch', 12.97160000, 77.59460000, 1),
(6, 'Work From Home',   NULL,        NULL,        0),
(7, 'Field Work',       NULL,        NULL,        0);

-- Users (password_hash will be bcrypt in production; plaintext here for testing)
INSERT INTO users (id, email, password_hash, name, role, phone) VALUES
(1, 'superadmin@solutionone.com',     'super123',  'Super Administrator', 'SUPER_ADMIN', NULL),
(2, 'admin@solutionone.com',          'admin123',  'HQ Admin',            'ADMIN',       NULL),
(3, 'employee1@solutionone.com',      'emp123',    'Rahul Verma',         'EMPLOYEE',    '9876543210'),
(4, 'employee2@solutionone.com',      'emp123',    'Anjali Patel',        'EMPLOYEE',    '9876543211'),
(5, 'employee3@solutionone.com',      'emp123',    'Vikram Singh',        'EMPLOYEE',    '9876543212'),
(6, 'mumbai.admin@solutionone.com',   'admin123',  'Mumbai Admin',        'ADMIN',       '9876543230'),
(7, 'mumbai.emp1@solutionone.com',    'emp123',    'Rajesh Kumar',        'EMPLOYEE',    '9876543231'),
(8, 'vadodara.admin@solutionone.com', 'admin123',  'Vadodara Admin',      'ADMIN',       '9876543240'),
(9, 'vadodara.emp1@solutionone.com',  'emp123',    'Amit Desai',          'EMPLOYEE',    '9876543241'),
(10,'pune.admin@solutionone.com',     'admin123',  'Pune Admin',          'ADMIN',       '9876543250'),
(11,'pune.emp1@solutionone.com',      'emp123',    'Sanjay Kulkarni',     'EMPLOYEE',    '9876543251'),
(12,'blr.admin@solutionone.com',      'admin123',  'Bangalore Admin',     'ADMIN',       '9876543260'),
(13,'blr.emp1@solutionone.com',       'emp123',    'Karthik Reddy',       'EMPLOYEE',    '9876543261');

-- User-Unit assignments
-- Super admin & HQ admin -> all units
INSERT INTO user_units (user_id, unit_id) VALUES
(1,1),(1,2),(1,3),(1,4),(1,5),(1,6),(1,7),
(2,1),(2,2),(2,3),(2,4),(2,5),(2,6),(2,7);

-- HQ employees -> Headquarters + WFH + Field
INSERT INTO user_units (user_id, unit_id) VALUES
(3,1),(3,6),(3,7),
(4,1),(4,6),(4,7),
(5,1),(5,6),(5,7);

-- Mumbai
INSERT INTO user_units (user_id, unit_id) VALUES
(6,2),(6,6),(6,7),
(7,2),(7,6),(7,7);

-- Vadodara
INSERT INTO user_units (user_id, unit_id) VALUES
(8,3),(8,6),(8,7),
(9,3),(9,6),(9,7);

-- Pune
INSERT INTO user_units (user_id, unit_id) VALUES
(10,4),(10,6),(10,7),
(11,4),(11,6),(11,7);

-- Bangalore
INSERT INTO user_units (user_id, unit_id) VALUES
(12,5),(12,6),(12,7),
(13,5),(13,6),(13,7);


-- ============================================================
-- DATABASE 2: CRYOGAS (identical structure, different data)
-- ============================================================
DROP DATABASE IF EXISTS cryogas_db;
CREATE DATABASE cryogas_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE cryogas_db;

-- 1. USERS
CREATE TABLE users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    email VARCHAR(255) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    name VARCHAR(255) NOT NULL,
    role ENUM('SUPER_ADMIN', 'ADMIN', 'EMPLOYEE') NOT NULL DEFAULT 'EMPLOYEE',
    phone VARCHAR(20) DEFAULT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_email (email)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 2. UNITS
CREATE TABLE units (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    latitude DECIMAL(10, 8) DEFAULT NULL,
    longitude DECIMAL(11, 8) DEFAULT NULL,
    is_geofenced TINYINT(1) NOT NULL DEFAULT 1,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_name (name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 3. USER_UNITS
CREATE TABLE user_units (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    unit_id INT NOT NULL,
    CONSTRAINT fk_uu_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    CONSTRAINT fk_uu_unit FOREIGN KEY (unit_id) REFERENCES units(id) ON DELETE CASCADE,
    UNIQUE KEY uq_user_unit (user_id, unit_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 4. HR_DAILYATTENDANCE
CREATE TABLE hr_daily_attendance (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    attend_date DATE NOT NULL,

    PunchDateTime1  DATETIME DEFAULT NULL,
    PunchDateTime2  DATETIME DEFAULT NULL,
    PunchDateTime3  DATETIME DEFAULT NULL,
    PunchDateTime4  DATETIME DEFAULT NULL,
    PunchDateTime5  DATETIME DEFAULT NULL,
    PunchDateTime6  DATETIME DEFAULT NULL,
    PunchDateTime7  DATETIME DEFAULT NULL,
    PunchDateTime8  DATETIME DEFAULT NULL,
    PunchDateTime9  DATETIME DEFAULT NULL,
    PunchDateTime10 DATETIME DEFAULT NULL,
    PunchDateTime11 DATETIME DEFAULT NULL,
    PunchDateTime12 DATETIME DEFAULT NULL,
    PunchDateTime13 DATETIME DEFAULT NULL,
    PunchDateTime14 DATETIME DEFAULT NULL,

    PunchLocation1  VARCHAR(50) DEFAULT NULL,
    PunchLocation2  VARCHAR(50) DEFAULT NULL,
    PunchLocation3  VARCHAR(50) DEFAULT NULL,
    PunchLocation4  VARCHAR(50) DEFAULT NULL,
    PunchLocation5  VARCHAR(50) DEFAULT NULL,
    PunchLocation6  VARCHAR(50) DEFAULT NULL,
    PunchLocation7  VARCHAR(50) DEFAULT NULL,
    PunchLocation8  VARCHAR(50) DEFAULT NULL,
    PunchLocation9  VARCHAR(50) DEFAULT NULL,
    PunchLocation10 VARCHAR(50) DEFAULT NULL,
    PunchLocation11 VARCHAR(50) DEFAULT NULL,
    PunchLocation12 VARCHAR(50) DEFAULT NULL,
    PunchLocation13 VARCHAR(50) DEFAULT NULL,
    PunchLocation14 VARCHAR(50) DEFAULT NULL,

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_att_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    UNIQUE KEY uq_user_date (user_id, attend_date),
    INDEX idx_attend_date (attend_date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;


-- ============================================================
-- SEED DATA FOR CRYOGAS_DB
-- ============================================================

INSERT INTO units (id, name, latitude, longitude, is_geofenced) VALUES
(1, 'CryoGas HQ',        22.29550000, 73.19230000, 1),
(2, 'Plant - Halol',      22.50310000, 73.47170000, 1),
(3, 'Warehouse - Savli',  22.35180000, 73.21940000, 1),
(4, 'Work From Home',     NULL,        NULL,        0),
(5, 'Field Work',         NULL,        NULL,        0);

INSERT INTO users (id, email, password_hash, name, role, phone) VALUES
(1, 'admin@cryogas.in',    'admin123',  'CryoGas Admin',    'SUPER_ADMIN', NULL),
(2, 'halol.mgr@cryogas.in','admin123',  'Halol Manager',    'ADMIN',       '9898000001'),
(3, 'savli.mgr@cryogas.in','admin123',  'Savli Manager',    'ADMIN',       '9898000002'),
(4, 'ravi@cryogas.in',     'emp123',    'Ravi Patel',       'EMPLOYEE',    '9898000010'),
(5, 'suresh@cryogas.in',   'emp123',    'Suresh Mehta',     'EMPLOYEE',    '9898000011'),
(6, 'meena@cryogas.in',    'emp123',    'Meena Shah',       'EMPLOYEE',    '9898000012'),
(7, 'jay@cryogas.in',      'emp123',    'Jay Trivedi',      'EMPLOYEE',    '9898000013');

-- Admin -> all units
INSERT INTO user_units (user_id, unit_id) VALUES
(1,1),(1,2),(1,3),(1,4),(1,5);

-- Halol manager -> Plant + WFH + Field
INSERT INTO user_units (user_id, unit_id) VALUES
(2,2),(2,4),(2,5);

-- Savli manager -> Warehouse + WFH + Field
INSERT INTO user_units (user_id, unit_id) VALUES
(3,3),(3,4),(3,5);

-- Employees at Halol plant
INSERT INTO user_units (user_id, unit_id) VALUES
(4,2),(4,4),(4,5),
(5,2),(5,4),(5,5);

-- Employees at Savli warehouse
INSERT INTO user_units (user_id, unit_id) VALUES
(6,3),(6,4),(6,5),
(7,3),(7,4),(7,5);


-- ============================================================
-- VERIFICATION
-- ============================================================

SELECT '--- SOLUTION_ONE_DB ---' AS Info;
USE solution_one_db;
SELECT COUNT(*) AS user_count FROM users;
SELECT COUNT(*) AS unit_count FROM units;
SELECT COUNT(*) AS mapping_count FROM user_units;

SELECT '--- CRYOGAS_DB ---' AS Info;
USE cryogas_db;
SELECT COUNT(*) AS user_count FROM users;
SELECT COUNT(*) AS unit_count FROM units;
SELECT COUNT(*) AS mapping_count FROM user_units;

SELECT 'PHASE 1 COMPLETE' AS Status;

-- ============================================================
-- TEST ACCOUNTS:
-- ============================================================
-- SOLUTION_ONE_DB:
--   superadmin@solutionone.com / super123  (SUPER_ADMIN)
--   admin@solutionone.com     / admin123   (ADMIN)
--   employee1@solutionone.com / emp123     (EMPLOYEE, HQ)
--   (see full list above)
--
-- CRYOGAS_DB:
--   admin@cryogas.in          / admin123   (SUPER_ADMIN)
--   halol.mgr@cryogas.in     / admin123   (ADMIN)
--   ravi@cryogas.in           / emp123     (EMPLOYEE, Halol)
--   (see full list above)
-- ============================================================
