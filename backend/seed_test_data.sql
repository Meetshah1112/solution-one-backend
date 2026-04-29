-- ============================================================
-- Test Data for Solution-One Attendance App
-- Run this in SSMS after the new tables are created
-- ============================================================

USE [Solution-one]
GO

-- ============================================================
-- STEP 1: Check existing employees and units
-- Run these SELECT queries first to see what data you have
-- ============================================================

-- See your existing employees (pick IDs from here for test users)
SELECT TOP 10 EmployeeMasterID, Code, FirstName, LastName, BranchMasterID,
       ShiftMasterID, CategoryMasterID, CompanyMasterID
FROM HR_EmployeeMaster
WHERE Status = 1
ORDER BY EmployeeMasterID
GO

-- See your existing units (pick UnitMasterIds from here)
SELECT UnitMasterId, code, name, city
FROM Unit
ORDER BY UnitMasterId
GO

-- ============================================================
-- STEP 2: Create test users in HR_UserMaster
-- !! REPLACE the EmployeeMasterID values below with actual IDs
--    from the SELECT query above !!
-- ============================================================

-- Test ADMIN user (change EmployeeMasterID to a real one from your data)
INSERT INTO HR_UserMaster (
    Code, UserName, Email, Mobile, PasswordHash, Role,
    EmployeeMasterID, CreatedBy, CreatedDt, SystemName, Status, CompanyMasterID
) VALUES (
    'ADM001', 'Admin User', 'admin@test.com', '9999999999', 'admin123', 'ADMIN',
    1,  -- << CHANGE THIS to a real EmployeeMasterID
    1, GETDATE(), 'MobileApp', 1, 1
)
GO

-- Test EMPLOYEE user (change EmployeeMasterID to a real one from your data)
INSERT INTO HR_UserMaster (
    Code, UserName, Email, Mobile, PasswordHash, Role,
    EmployeeMasterID, CreatedBy, CreatedDt, SystemName, Status, CompanyMasterID
) VALUES (
    'EMP001', 'Test Employee', 'employee@test.com', '8888888888', 'emp123', 'EMPLOYEE',
    2,  -- << CHANGE THIS to a real EmployeeMasterID
    1, GETDATE(), 'MobileApp', 1, 1
)
GO

-- ============================================================
-- STEP 3: Add GPS data for units (HR_UnitGPS)
-- !! REPLACE UnitMasterId values with actual ones from your Unit table !!
-- ============================================================

-- Example: Main Office (replace UnitMasterId and GPS coordinates with real values)
INSERT INTO HR_UnitGPS (UnitMasterId, Latitude, Longitude, IsGeofenced)
VALUES (1, 23.0225000, 72.5714000, 1)   -- << CHANGE UnitMasterId and lat/lng
GO

-- Example: Another branch
INSERT INTO HR_UnitGPS (UnitMasterId, Latitude, Longitude, IsGeofenced)
VALUES (2, 23.0300000, 72.5800000, 1)   -- << CHANGE UnitMasterId and lat/lng
GO

-- Example: WFH / Field Work unit (geofence disabled)
INSERT INTO HR_UnitGPS (UnitMasterId, Latitude, Longitude, IsGeofenced)
VALUES (3, 0.0000000, 0.0000000, 0)     -- << CHANGE UnitMasterId
GO

-- ============================================================
-- STEP 4: Assign units to test users (HR_UserUnits)
-- Use the UserMasterID from Step 2 and UnitMasterId from Step 3
-- ============================================================

-- Get the UserMasterIDs we just created
SELECT UserMasterID, Email, Role FROM HR_UserMaster
WHERE Email IN ('admin@test.com', 'employee@test.com')
GO

-- Assign units to the EMPLOYEE user (replace IDs with real values)
-- INSERT INTO HR_UserUnits (UserMasterID, UnitMasterId) VALUES (2, 1)  -- employee -> unit 1
-- INSERT INTO HR_UserUnits (UserMasterID, UnitMasterId) VALUES (2, 2)  -- employee -> unit 2
-- INSERT INTO HR_UserUnits (UserMasterID, UnitMasterId) VALUES (2, 3)  -- employee -> WFH unit
-- GO

-- ============================================================
-- STEP 5: Verify everything
-- ============================================================

-- Check users
SELECT um.UserMasterID, um.Email, um.Role, um.Status,
       em.FirstName + ' ' + em.LastName AS EmployeeName
FROM HR_UserMaster um
JOIN HR_EmployeeMaster em ON um.EmployeeMasterID = em.EmployeeMasterID
GO

-- Check unit GPS data
SELECT u.UnitMasterId, u.name, g.Latitude, g.Longitude, g.IsGeofenced
FROM Unit u
LEFT JOIN HR_UnitGPS g ON g.UnitMasterId = u.UnitMasterId
GO

-- Check user-unit assignments
SELECT uu.UserMasterID, um.Email, u.name AS UnitName
FROM HR_UserUnits uu
JOIN HR_UserMaster um ON uu.UserMasterID = um.UserMasterID
JOIN Unit u ON uu.UnitMasterId = u.UnitMasterId
GO
