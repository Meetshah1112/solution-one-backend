-- ============================================================================
-- Solution One - Photo Storage + Demo Data
-- ============================================================================
-- This script:
--   1. Adds HR_PunchPhotos table for storing punch-time selfies
--   2. Creates 3 demo employees with user logins
--   3. Inserts 7 days of past attendance for them
--
-- Safe to re-run: every step is idempotent (IF NOT EXISTS guards).
-- ============================================================================

USE [Solution-one];   -- <<< change to your DB name if different
GO

-- ----------------------------------------------------------------------------
-- 1. PHOTO STORAGE TABLE
-- ----------------------------------------------------------------------------
-- One row per (punch row, slot 1-14). Stores selfie taken at punch time.
-- PhotoBase64 column holds the JPEG as a base64 string (sent from app).
-- Linked back to HR_DailyAttendanceMultiPunch via MultiPunchOid.
-- ----------------------------------------------------------------------------
IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'HR_PunchPhotos')
BEGIN
    CREATE TABLE [dbo].[HR_PunchPhotos] (
        [Id]                BIGINT IDENTITY(1,1) NOT NULL,
        [MultiPunchOid]     BIGINT          NOT NULL,
        [PunchSlot]         TINYINT         NOT NULL,         -- 1..14
        [PhotoBase64]       NVARCHAR(MAX)   NOT NULL,         -- "data:image/jpeg;base64,..."
        [MimeType]          NVARCHAR(50)    NOT NULL DEFAULT 'image/jpeg',
        [CapturedDateTime]  DATETIME        NOT NULL DEFAULT GETDATE(),
        [Latitude]          DECIMAL(10,7)   NULL,
        [Longitude]         DECIMAL(10,7)   NULL,
        CONSTRAINT [PK_HR_PunchPhotos] PRIMARY KEY CLUSTERED ([Id] ASC),
        CONSTRAINT [UQ_HR_PunchPhotos_OidSlot] UNIQUE ([MultiPunchOid], [PunchSlot]),
        CONSTRAINT [FK_HR_PunchPhotos_MultiPunch]
            FOREIGN KEY ([MultiPunchOid])
            REFERENCES [dbo].[HR_DailyAttendanceMultiPunch] ([Oid])
            ON DELETE CASCADE
    );
    PRINT 'Created HR_PunchPhotos table.';
END
ELSE
BEGIN
    PRINT 'HR_PunchPhotos already exists - skipping create.';
END
GO

CREATE INDEX [IX_HR_PunchPhotos_MultiPunchOid]
    ON [dbo].[HR_PunchPhotos] ([MultiPunchOid]);
GO

-- ----------------------------------------------------------------------------
-- 2. DEMO DATA - capture FK seed values from existing employees
-- ----------------------------------------------------------------------------
-- We reuse Department/Branch/Company etc. from any existing employee
-- so demo data fits cleanly into the schema.
-- ----------------------------------------------------------------------------
DECLARE @CompanyMasterID    BIGINT,
        @BranchMasterID     BIGINT,
        @DepartmentMasterID BIGINT,
        @DesignationMasterID BIGINT,
        @ShiftMasterID      BIGINT,
        @CategoryMasterID   BIGINT,
        @FormID             BIGINT,
        @AdminUserID        BIGINT;

SELECT TOP 1
    @CompanyMasterID    = CompanyMasterID,
    @BranchMasterID     = BranchMasterID,
    @DepartmentMasterID = DepartmentMasterID,
    @DesignationMasterID = DesignationMasterID,
    @ShiftMasterID      = ShiftMasterID,
    @CategoryMasterID   = CategoryMasterID,
    @FormID             = FormID,
    @AdminUserID        = EntryUserMasterID
FROM [dbo].[HR_EmployeeMaster]
WHERE Status = 1;

IF @CompanyMasterID IS NULL
BEGIN
    PRINT 'ERROR: No active employees found. Cannot derive seed FK values.';
    PRINT 'Insert at least one employee manually before running demo data.';
    RETURN;
END

PRINT '----------------------------------------';
PRINT 'Using FK seeds:';
PRINT '  CompanyMasterID    = ' + CAST(@CompanyMasterID AS VARCHAR);
PRINT '  BranchMasterID     = ' + CAST(@BranchMasterID AS VARCHAR);
PRINT '  DepartmentMasterID = ' + CAST(@DepartmentMasterID AS VARCHAR);
PRINT '  ShiftMasterID      = ' + CAST(@ShiftMasterID AS VARCHAR);
PRINT '----------------------------------------';

-- ----------------------------------------------------------------------------
-- 3. INSERT DEMO EMPLOYEES (skip if already present by Code)
-- ----------------------------------------------------------------------------
DECLARE @DemoEmployees TABLE (
    Code        NVARCHAR(15),
    FirstName   NVARCHAR(50),
    LastName    NVARCHAR(50),
    FatherName  NVARCHAR(50),
    Email       NVARCHAR(100),
    Mobile      NVARCHAR(50),
    Password    NVARCHAR(50)
);

INSERT INTO @DemoEmployees VALUES
    ('DEMO001', 'Aarav',   'Sharma',  'Rajesh Sharma',  'aarav.sharma@demo.com',  '9876543210', 'Demo@123'),
    ('DEMO002', 'Priya',   'Patel',   'Amit Patel',     'priya.patel@demo.com',   '9876543211', 'Demo@123'),
    ('DEMO003', 'Rohan',   'Mehta',   'Vinod Mehta',    'rohan.mehta@demo.com',   '9876543212', 'Demo@123'),
    ('DEMO004', 'Ananya',  'Gupta',   'Sanjay Gupta',   'ananya.gupta@demo.com',  '9876543213', 'Demo@123'),
    ('DEMO005', 'Vikram',  'Singh',   'Harpreet Singh', 'vikram.singh@demo.com',  '9876543214', 'Demo@123');

DECLARE empCursor CURSOR FOR
    SELECT Code, FirstName, LastName, FatherName, Email, Mobile, Password FROM @DemoEmployees;

DECLARE @Code NVARCHAR(15), @FirstName NVARCHAR(50), @LastName NVARCHAR(50),
        @FatherName NVARCHAR(50), @Email NVARCHAR(100), @Mobile NVARCHAR(50), @Password NVARCHAR(50);

OPEN empCursor;
FETCH NEXT FROM empCursor INTO @Code, @FirstName, @LastName, @FatherName, @Email, @Mobile, @Password;

WHILE @@FETCH_STATUS = 0
BEGIN
    IF NOT EXISTS (SELECT 1 FROM HR_EmployeeMaster WHERE Code = @Code)
    BEGIN
        DECLARE @NewEmpID BIGINT;
        DECLARE @NewUserID BIGINT;

        -- 3a. Insert employee
        INSERT INTO [dbo].[HR_EmployeeMaster] (
            Code, Location, FirstName, LastName, FatherName,
            Address, Gender, DateOfJoining, DateOfBirth,
            WeeklyOffDay, MobileNo, WorkingHours, SalaryCalculation,
            JobType, JobStatus, Status,
            DepartmentMasterID, DesignationMasterID, ShiftMasterID, CategoryMasterID,
            BranchMasterID, CompanyMasterID, FormID,
            EntryUserMasterID, EntryUserDateTime, SystemName
        )
        VALUES (
            @Code, 'Demo Location', @FirstName, @LastName, @FatherName,
            'Demo Address', 'Male', DATEADD(YEAR, -2, GETDATE()), DATEADD(YEAR, -28, GETDATE()),
            'Sunday', CONVERT(NUMERIC(18,0), @Mobile), 8.0, 'Monthly',
            'Permanent', 'Active', 1,
            @DepartmentMasterID, @DesignationMasterID, @ShiftMasterID, @CategoryMasterID,
            @BranchMasterID, @CompanyMasterID, @FormID,
            @AdminUserID, GETDATE(), 'DEMO'
        );

        SET @NewEmpID = SCOPE_IDENTITY();

        -- 3b. Insert user login (PasswordHash stored plain for demo - bcrypt would be ideal)
        INSERT INTO [dbo].[HR_UserMaster] (
            Code, UserName, Email, Mobile, PasswordHash,
            Role, EmployeeMasterID, CreatedBy, CreatedDt,
            SystemName, Status, CompanyMasterID
        )
        VALUES (
            @Code, @FirstName + ' ' + @LastName, @Email, @Mobile, @Password,
            'Employee', @NewEmpID, @AdminUserID, GETDATE(),
            'DEMO', 1, @CompanyMasterID
        );

        SET @NewUserID = SCOPE_IDENTITY();

        -- 3c. Link UserMasterID back on the employee row
        UPDATE HR_EmployeeMaster SET UserMasterID = @NewUserID WHERE EmployeeMasterID = @NewEmpID;

        -- 3d. Assign the same units the admin uses (so they can punch right away)
        INSERT INTO [dbo].[HR_UserUnits] (UserMasterID, UnitMasterId, CreatedAt)
        SELECT @NewUserID, UnitMasterId, GETDATE()
        FROM [dbo].[HR_UserUnits]
        WHERE UserMasterID = @AdminUserID;

        PRINT 'Inserted demo employee: ' + @Code + ' / ' + @Email + ' / pw: ' + @Password;
    END
    ELSE
    BEGIN
        PRINT 'Demo employee ' + @Code + ' already exists - skipping.';
    END

    FETCH NEXT FROM empCursor INTO @Code, @FirstName, @LastName, @FatherName, @Email, @Mobile, @Password;
END

CLOSE empCursor;
DEALLOCATE empCursor;
GO

-- ----------------------------------------------------------------------------
-- 4. PAST 7 DAYS OF ATTENDANCE FOR DEMO EMPLOYEES
-- ----------------------------------------------------------------------------
-- Each demo employee gets a 9 AM punch-in and 6 PM punch-out
-- for each of the last 7 weekdays (skip Sunday).
-- ----------------------------------------------------------------------------
DECLARE @CompanyMasterID BIGINT, @BranchMasterID BIGINT, @ShiftMasterID BIGINT,
        @CategoryMasterID BIGINT, @FormID BIGINT, @AdminUserID BIGINT;

SELECT TOP 1
    @CompanyMasterID  = CompanyMasterID,
    @BranchMasterID   = BranchMasterID,
    @ShiftMasterID    = ShiftMasterID,
    @CategoryMasterID = CategoryMasterID,
    @FormID           = FormID,
    @AdminUserID      = EntryUserMasterID
FROM [dbo].[HR_EmployeeMaster]
WHERE Status = 1;

DECLARE @DemoEmpIds TABLE (EmpID BIGINT);
INSERT INTO @DemoEmpIds
SELECT EmployeeMasterID FROM HR_EmployeeMaster WHERE Code LIKE 'DEMO%';

DECLARE @i INT = 7;
WHILE @i >= 1
BEGIN
    DECLARE @AttendDate DATETIME = DATEADD(DAY, -@i, CAST(GETDATE() AS DATE));

    -- Skip Sunday (DATEPART weekday: 1=Sunday in default US setting)
    IF DATENAME(WEEKDAY, @AttendDate) <> 'Sunday'
    BEGIN
        DECLARE @EmpID BIGINT;
        DECLARE empAttendCursor CURSOR FOR SELECT EmpID FROM @DemoEmpIds;
        OPEN empAttendCursor;
        FETCH NEXT FROM empAttendCursor INTO @EmpID;

        WHILE @@FETCH_STATUS = 0
        BEGIN
            IF NOT EXISTS (
                SELECT 1 FROM HR_DailyAttendanceMultiPunch
                WHERE EmployeeMasterID = @EmpID
                  AND CAST(AttendDate AS DATE) = CAST(@AttendDate AS DATE)
            )
            BEGIN
                DECLARE @PunchIn  DATETIME = DATEADD(HOUR, 9,  @AttendDate);   -- 09:00
                DECLARE @PunchOut DATETIME = DATEADD(HOUR, 18, @AttendDate);   -- 18:00
                DECLARE @NewPunchOid BIGINT;

                INSERT INTO [dbo].[HR_DailyAttendanceMultiPunch] (
                    EmployeeMasterID, AttendYear, AttendMonth, AttendDate, AttendanceStatus,
                    PunchDateTime1, PunchDateTime2,
                    ActualWorkingHours, MasterWorkingHours, WorkingHours,
                    OTMinute, OTAllowed,
                    ShiftMasterID, MonthlyAttendID, PayrollConfirmationID,
                    CategoryMasterID, BranchMasterID, CompanyMasterID,
                    YearID, FormID,
                    EntryUserMasterID, EntryUserDateTime, SystemName
                )
                VALUES (
                    @EmpID, YEAR(@AttendDate), MONTH(@AttendDate), @AttendDate, 'P',
                    @PunchIn, @PunchOut,
                    9.0, 8.0, 8.0,
                    0, 0,
                    @ShiftMasterID, 0, 0,
                    @CategoryMasterID, @BranchMasterID, @CompanyMasterID,
                    YEAR(@AttendDate), @FormID,
                    @AdminUserID, GETDATE(), 'DEMO'
                );

                SET @NewPunchOid = SCOPE_IDENTITY();

                -- Demo locations (Mumbai approx)
                INSERT INTO [dbo].[HR_PunchLocations] (
                    MultiPunchOid, PunchLocation1, PunchLocation2
                )
                VALUES (
                    @NewPunchOid,
                    '19.0760,72.8777',   -- in
                    '19.0762,72.8779'    -- out (10m apart)
                );
            END
            FETCH NEXT FROM empAttendCursor INTO @EmpID;
        END
        CLOSE empAttendCursor;
        DEALLOCATE empAttendCursor;
    END

    SET @i = @i - 1;
END
GO

PRINT '====================================================';
PRINT 'Demo data seeding complete.';
PRINT 'Login with any of: DEMO001..DEMO005 / pw: Demo@123';
PRINT '(or use email aarav.sharma@demo.com etc.)';
PRINT '====================================================';
GO
