-- ============================================
-- SOLUTION ONE TEST DATABASE - FRESH INSTALL
-- Run this in MySQL to create everything from scratch
-- ============================================

-- Create and use the new test database
DROP DATABASE IF EXISTS solution_one_test;
CREATE DATABASE solution_one_test CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE solution_one_test;

-- ============================================
-- 1. OFFICES TABLE
-- ============================================
CREATE TABLE offices (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    latitude DECIMAL(10, 8) NOT NULL,
    longitude DECIMAL(11, 8) NOT NULL,
    radius INT DEFAULT 50,
    address VARCHAR(500),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_name (name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ============================================
-- 2. USERS TABLE
-- ============================================
CREATE TABLE users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    office_id INT NOT NULL,
    email VARCHAR(255) NOT NULL UNIQUE,
    password VARCHAR(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL,
    name VARCHAR(255) NOT NULL,
    role ENUM('SUPER_ADMIN', 'ADMIN', 'EMPLOYEE') NOT NULL DEFAULT 'EMPLOYEE',
    phone VARCHAR(20) DEFAULT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_user_office FOREIGN KEY (office_id) REFERENCES offices(id) ON DELETE RESTRICT,
    INDEX idx_office_role (office_id, role),
    INDEX idx_email (email)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ============================================
-- 3. ATTENDANCE TABLE
-- ============================================
CREATE TABLE attendance (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    office_id INT NOT NULL,
    date DATE NOT NULL,
    check_in_time DATETIME DEFAULT NULL,
    check_out_time DATETIME DEFAULT NULL,
    latitude DECIMAL(10, 8) DEFAULT NULL,
    longitude DECIMAL(11, 8) DEFAULT NULL,
    check_out_latitude DECIMAL(10, 8) DEFAULT NULL,
    check_out_longitude DECIMAL(11, 8) DEFAULT NULL,
    checkout_within_geofence TINYINT(1) DEFAULT NULL,
    duration_minutes INT DEFAULT NULL,
    status ENUM('present', 'late', 'absent') DEFAULT 'present',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_attendance_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    CONSTRAINT fk_attendance_office FOREIGN KEY (office_id) REFERENCES offices(id) ON DELETE RESTRICT,
    INDEX idx_user_date (user_id, date),
    INDEX idx_office_date (office_id, date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ============================================
-- 4. SEED DATA: OFFICES
-- ============================================
INSERT INTO offices (id, name, latitude, longitude, radius, address) VALUES
(1, 'Headquarters',       22.31525800, 73.14436660, 50, 'Main Office - Vadodara'),
(2, 'Mumbai Branch',      19.07600000, 72.87770000, 50, 'Mumbai Office, Maharashtra'),
(3, 'Vadodara Branch',    22.30720000, 73.18120000, 50, 'Vadodara Office, Gujarat'),
(4, 'Pune Branch',        18.52040000, 73.85670000, 50, 'Pune Office, Maharashtra'),
(5, 'Bangalore Branch',   12.97160000, 77.59460000, 50, 'Bangalore Office, Karnataka');

-- ============================================
-- 5. SEED DATA: USERS
-- Password column is case-sensitive (utf8mb4_bin)
-- ============================================

-- Super Admin (Headquarters)
INSERT INTO users (email, password, name, role, office_id, phone) VALUES
('superadmin@solutionone.com', 'super123', 'Super Administrator', 'SUPER_ADMIN', 1, NULL);

-- Headquarters Admin + Employees
INSERT INTO users (email, password, name, role, office_id, phone) VALUES
('admin@solutionone.com',      'admin123', 'HQ Admin',        'ADMIN',    1, NULL),
('employee1@solutionone.com',  'emp123',   'Rahul Verma',     'EMPLOYEE', 1, '9876543210'),
('employee2@solutionone.com',  'emp123',   'Anjali Patel',    'EMPLOYEE', 1, '9876543211'),
('employee3@solutionone.com',  'emp123',   'Vikram Singh',    'EMPLOYEE', 1, '9876543212');

-- Mumbai Admin + Employees
INSERT INTO users (email, password, name, role, office_id, phone) VALUES
('mumbai.admin@solutionone.com', 'admin123', 'Mumbai Admin',   'ADMIN',    2, '9876543230'),
('mumbai.emp1@solutionone.com',  'emp123',   'Rajesh Kumar',   'EMPLOYEE', 2, '9876543231'),
('mumbai.emp2@solutionone.com',  'emp123',   'Priya Sharma',   'EMPLOYEE', 2, '9876543232');

-- Vadodara Admin + Employees
INSERT INTO users (email, password, name, role, office_id, phone) VALUES
('vadodara.admin@solutionone.com', 'admin123', 'Vadodara Admin', 'ADMIN',    3, '9876543240'),
('vadodara.emp1@solutionone.com',  'emp123',   'Amit Desai',     'EMPLOYEE', 3, '9876543241'),
('vadodara.emp2@solutionone.com',  'emp123',   'Neha Joshi',     'EMPLOYEE', 3, '9876543242');

-- Pune Admin + Employees
INSERT INTO users (email, password, name, role, office_id, phone) VALUES
('pune.admin@solutionone.com', 'admin123', 'Pune Admin',     'ADMIN',    4, '9876543250'),
('pune.emp1@solutionone.com',  'emp123',   'Sanjay Kulkarni', 'EMPLOYEE', 4, '9876543251'),
('pune.emp2@solutionone.com',  'emp123',   'Meera Patil',     'EMPLOYEE', 4, '9876543252');

-- Bangalore Admin + Employees
INSERT INTO users (email, password, name, role, office_id, phone) VALUES
('blr.admin@solutionone.com', 'admin123', 'Bangalore Admin',  'ADMIN',    5, '9876543260'),
('blr.emp1@solutionone.com',  'emp123',   'Karthik Reddy',    'EMPLOYEE', 5, '9876543261'),
('blr.emp2@solutionone.com',  'emp123',   'Divya Nair',       'EMPLOYEE', 5, '9876543262');

-- ============================================
-- 6. SEED DATA: SAMPLE ATTENDANCE (last 5 days for HQ employees)
-- ============================================

-- Helper: get dates for last 5 working days
SET @d1 = CURDATE();
SET @d2 = DATE_SUB(CURDATE(), INTERVAL 1 DAY);
SET @d3 = DATE_SUB(CURDATE(), INTERVAL 2 DAY);
SET @d4 = DATE_SUB(CURDATE(), INTERVAL 3 DAY);
SET @d5 = DATE_SUB(CURDATE(), INTERVAL 4 DAY);

-- Employee 3 (Rahul Verma, id=3) - sample attendance
INSERT INTO attendance (user_id, office_id, date, check_in_time, check_out_time, latitude, longitude, check_out_latitude, check_out_longitude, checkout_within_geofence, duration_minutes, status) VALUES
(3, 1, @d2, CONCAT(@d2, ' 09:15:00'), CONCAT(@d2, ' 18:00:00'), 22.3152, 73.1443, 22.3153, 73.1444, 1, 525, 'present'),
(3, 1, @d3, CONCAT(@d3, ' 09:45:00'), CONCAT(@d3, ' 17:30:00'), 22.3152, 73.1443, 22.3153, 73.1444, 1, 465, 'late'),
(3, 1, @d4, CONCAT(@d4, ' 09:10:00'), CONCAT(@d4, ' 18:15:00'), 22.3152, 73.1443, 22.3153, 73.1444, 1, 545, 'present'),
(3, 1, @d5, CONCAT(@d5, ' 09:20:00'), CONCAT(@d5, ' 17:45:00'), 22.3152, 73.1443, 22.3153, 73.1444, 1, 505, 'present');

-- Employee 4 (Anjali Patel, id=4) - sample attendance
INSERT INTO attendance (user_id, office_id, date, check_in_time, check_out_time, latitude, longitude, check_out_latitude, check_out_longitude, checkout_within_geofence, duration_minutes, status) VALUES
(4, 1, @d2, CONCAT(@d2, ' 09:05:00'), CONCAT(@d2, ' 17:30:00'), 22.3152, 73.1443, 22.3153, 73.1444, 1, 505, 'present'),
(4, 1, @d3, CONCAT(@d3, ' 10:00:00'), CONCAT(@d3, ' 18:00:00'), 22.3152, 73.1443, 22.3200, 73.1500, 0, 480, 'late'),
(4, 1, @d4, CONCAT(@d4, ' 09:25:00'), CONCAT(@d4, ' 17:50:00'), 22.3152, 73.1443, 22.3153, 73.1444, 1, 505, 'present');

-- ============================================
-- 7. VERIFICATION
-- ============================================

SELECT '✅ DATABASE CREATED: solution_one_test' as Status;

SELECT 'OFFICES:' as Info;
SELECT id, name, address FROM offices ORDER BY id;

SELECT 'USERS:' as Info;
SELECT u.id, u.name, u.email, u.role, o.name as office 
FROM users u JOIN offices o ON u.office_id = o.id 
ORDER BY o.id, u.role DESC, u.name;

SELECT 'ATTENDANCE RECORDS:' as Info;
SELECT a.id, u.name, o.name as office, a.date, 
       TIME(a.check_in_time) as check_in, TIME(a.check_out_time) as check_out,
       a.duration_minutes, a.status,
       CASE WHEN a.checkout_within_geofence = 1 THEN 'Yes' WHEN a.checkout_within_geofence = 0 THEN 'No' ELSE 'N/A' END as in_geofence
FROM attendance a 
JOIN users u ON a.user_id = u.id 
JOIN offices o ON a.office_id = o.id
ORDER BY a.date DESC;

SELECT 'PASSWORD CASE-SENSITIVITY CHECK:' as Info;
SELECT email, 
       (password = 'super123') as correct_password_matches,
       (password = 'Super123') as wrong_case_matches
FROM users WHERE email = 'superadmin@solutionone.com';

-- ============================================
-- TEST ACCOUNTS SUMMARY:
-- ============================================
-- Super Admin:  superadmin@solutionone.com / super123   (Headquarters)
-- HQ Admin:     admin@solutionone.com / admin123        (Headquarters)
-- HQ Employee:  employee1@solutionone.com / emp123      (Headquarters)
-- Mumbai Admin: mumbai.admin@solutionone.com / admin123  (Mumbai Branch)
-- Vadodara:     vadodara.admin@solutionone.com / admin123
-- Pune:         pune.admin@solutionone.com / admin123
-- Bangalore:    blr.admin@solutionone.com / admin123
-- All employees use password: emp123
-- ============================================
