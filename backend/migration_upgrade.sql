-- ============================================
-- SOLUTION ONE - UPGRADE MIGRATION
-- Branch Support + Check-out Coordinates + Duration
-- ============================================

USE solution_one;

-- ============================================
-- STEP 1: Add Check-Out Coordinates & Duration Columns
-- ============================================

-- Add check-out latitude
ALTER TABLE attendance 
ADD COLUMN IF NOT EXISTS check_out_latitude DECIMAL(10, 8) DEFAULT NULL;

-- Add check-out longitude
ALTER TABLE attendance 
ADD COLUMN IF NOT EXISTS check_out_longitude DECIMAL(11, 8) DEFAULT NULL;

-- Add flag for whether checkout was within geofence
ALTER TABLE attendance 
ADD COLUMN IF NOT EXISTS checkout_within_geofence TINYINT(1) DEFAULT NULL;

-- Add duration in minutes
ALTER TABLE attendance 
ADD COLUMN IF NOT EXISTS duration_minutes INT DEFAULT NULL;

-- ============================================
-- STEP 2: Add Branch Offices (Vadodara, Pune, Bangalore)
-- ============================================

-- Vadodara Branch
INSERT INTO offices (name, latitude, longitude, radius, address) VALUES 
('Vadodara Branch', 22.3072, 73.1812, 50, 'Vadodara Office, Gujarat')
ON DUPLICATE KEY UPDATE name = name;

-- Pune Branch
INSERT INTO offices (name, latitude, longitude, radius, address) VALUES 
('Pune Branch', 18.5204, 73.8567, 50, 'Pune Office, Maharashtra')
ON DUPLICATE KEY UPDATE name = name;

-- Bangalore Branch
INSERT INTO offices (name, latitude, longitude, radius, address) VALUES 
('Bangalore Branch', 12.9716, 77.5946, 50, 'Bangalore Office, Karnataka')
ON DUPLICATE KEY UPDATE name = name;

-- ============================================
-- STEP 3: Fix Password Case Sensitivity
-- Change collation of password column to case-sensitive
-- ============================================

ALTER TABLE users 
MODIFY COLUMN password VARCHAR(255) 
CHARACTER SET utf8mb4 
COLLATE utf8mb4_bin 
NOT NULL;

-- ============================================
-- STEP 4: Update Existing Attendance Records 
-- Calculate duration for records that have both check-in and check-out
-- ============================================

UPDATE attendance 
SET duration_minutes = TIMESTAMPDIFF(MINUTE, check_in_time, check_out_time)
WHERE check_in_time IS NOT NULL 
  AND check_out_time IS NOT NULL 
  AND duration_minutes IS NULL
  AND id > 0;

-- ============================================
-- VERIFICATION QUERIES
-- ============================================

-- Check new attendance columns exist
SELECT 'ATTENDANCE TABLE STRUCTURE:' as Info;
DESCRIBE attendance;

-- Check offices including new branches
SELECT 'ALL OFFICES:' as Info;
SELECT * FROM offices ORDER BY id;

-- Verify password case sensitivity works
SELECT 'PASSWORD CASE SENSITIVITY TEST:' as Info;
SELECT 
    email, 
    password = 'admin123' as matches_lowercase,
    password = 'Admin123' as matches_uppercase
FROM users 
WHERE email = 'superadmin@solutionone.com'
LIMIT 1;

-- Check attendance with new columns
SELECT 'ATTENDANCE WITH NEW COLUMNS:' as Info;
SELECT 
    a.id,
    u.name as employee,
    o.name as office,
    a.check_in_time,
    a.check_out_time,
    a.check_out_latitude,
    a.check_out_longitude,
    CASE WHEN a.checkout_within_geofence = 1 THEN 'Yes' 
         WHEN a.checkout_within_geofence = 0 THEN 'No' 
         ELSE 'N/A' END as within_geofence,
    CASE WHEN a.duration_minutes IS NOT NULL 
         THEN CONCAT(FLOOR(a.duration_minutes/60), 'h ', MOD(a.duration_minutes, 60), 'm')
         ELSE 'N/A' END as duration
FROM attendance a
JOIN users u ON a.user_id = u.id
JOIN offices o ON a.office_id = o.id
ORDER BY a.created_at DESC
LIMIT 10;

-- Count offices
SELECT 'OFFICE COUNT:' as Info;
SELECT COUNT(*) as total_offices FROM offices;

-- ============================================
-- MIGRATION COMPLETE! ✅
-- New Features:
-- 1. Check-out coordinates tracked
-- 2. Geofence validation on check-out
-- 3. Duration calculated automatically
-- 4. Branch offices added (Vadodara, Pune, Bangalore)
-- 5. Password is now case-sensitive (COLLATE utf8mb4_bin)
-- ============================================
