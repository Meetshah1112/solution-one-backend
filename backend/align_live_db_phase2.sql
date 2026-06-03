-- ============================================================
-- Solution One ESS — Phase 2 live-DB alignment
-- ============================================================
-- The live [Solution-one] DB already has every Phase 2 table,
-- but a few columns we use in the mobile backend are missing
-- (ApprovedBy / ApprovedDate / ApproverComment on leaves, and
--  Description / Category on report layouts).
--
-- This script:
--   • Adds the missing columns (idempotent — IF NOT EXISTS guards)
--   • Widens LeaveReason from nvarchar(50) → nvarchar(500)
--   • Seeds HR_LeaveMaster with default leave types (if empty)
--   • Tags existing HR_ReportLayout rows with a default category
--   • Seeds 6 sample reports (if HR_ReportLayout empty)
--   • Seeds last-3-months demo salary slips for demo employees
-- ============================================================

USE [Solution-one]
GO

SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO

PRINT '─── HR_LeaveApplication: add approval columns ───'
GO

IF NOT EXISTS (SELECT 1 FROM sys.columns
               WHERE object_id = OBJECT_ID(N'[dbo].[HR_LeaveApplication]')
                 AND name = 'ApprovedBy')
BEGIN
    ALTER TABLE [dbo].[HR_LeaveApplication]
        ADD [ApprovedBy] [bigint] NULL
    PRINT 'Added ApprovedBy'
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.columns
               WHERE object_id = OBJECT_ID(N'[dbo].[HR_LeaveApplication]')
                 AND name = 'ApprovedDate')
BEGIN
    ALTER TABLE [dbo].[HR_LeaveApplication]
        ADD [ApprovedDate] [datetime] NULL
    PRINT 'Added ApprovedDate'
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.columns
               WHERE object_id = OBJECT_ID(N'[dbo].[HR_LeaveApplication]')
                 AND name = 'ApproverComment')
BEGIN
    ALTER TABLE [dbo].[HR_LeaveApplication]
        ADD [ApproverComment] [nvarchar](500) NULL
    PRINT 'Added ApproverComment'
END
GO

-- Widen LeaveReason so users can supply meaningful free text
IF EXISTS (SELECT 1 FROM sys.columns
           WHERE object_id = OBJECT_ID(N'[dbo].[HR_LeaveApplication]')
             AND name = 'LeaveReason'
             AND max_length < 1000)   -- nvarchar(500) reports max_length 1000 bytes
BEGIN
    ALTER TABLE [dbo].[HR_LeaveApplication]
        ALTER COLUMN [LeaveReason] [nvarchar](500) NULL
    PRINT 'Widened LeaveReason to nvarchar(500)'
END
GO

PRINT '─── HR_ReportLayout: add Description + Category ───'
GO

IF NOT EXISTS (SELECT 1 FROM sys.columns
               WHERE object_id = OBJECT_ID(N'[dbo].[HR_ReportLayout]')
                 AND name = 'Description')
BEGIN
    ALTER TABLE [dbo].[HR_ReportLayout]
        ADD [Description] [nvarchar](300) NULL
    PRINT 'Added Description'
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.columns
               WHERE object_id = OBJECT_ID(N'[dbo].[HR_ReportLayout]')
                 AND name = 'Category')
BEGIN
    ALTER TABLE [dbo].[HR_ReportLayout]
        ADD [Category] [nvarchar](50) NULL
    PRINT 'Added Category'
END
GO

-- ============================================================
-- Seed default leave types if HR_LeaveMaster is empty
-- ============================================================
PRINT '─── Seed HR_LeaveMaster (only if empty) ───'
GO

IF NOT EXISTS (SELECT 1 FROM [dbo].[HR_LeaveMaster])
BEGIN
    -- Column list maps to the actual live schema (NOT-NULL FormID, FromDate,
    -- ToDate, EntryUserMasterID, EntryUserDateTime, Validity, etc.)
    DECLARE @from DATE = DATEFROMPARTS(YEAR(GETDATE()), 1, 1)
    DECLARE @to   DATE = DATEFROMPARTS(YEAR(GETDATE()), 12, 31)

    INSERT INTO [dbo].[HR_LeaveMaster]
        (Code, Name, Balance, Description, CarryForward,
         IsActive, IsPaidLeave, HalfDayAllowed, QuarterDayAllowed,
         Validity, FromDate, ToDate, FormID,
         EntryUserMasterID, EntryUserDateTime, SystemName)
    VALUES
        ('CL  ', 'Casual Leave',     12, 'Personal / short-notice',  0, 1, 1, 1, 0, 0, @from, @to, 1015, 1, GETDATE(), 'SETUP'),
        ('SL  ', 'Sick Leave',       10, 'Medical / illness',         0, 1, 1, 1, 0, 0, @from, @to, 1015, 1, GETDATE(), 'SETUP'),
        ('PL  ', 'Privileged Leave', 18, 'Annual / vacation',         1, 1, 1, 1, 0, 0, @from, @to, 1015, 1, GETDATE(), 'SETUP'),
        ('EL  ', 'Earned Leave',     15, 'Accrued by tenure',         1, 1, 1, 1, 0, 0, @from, @to, 1015, 1, GETDATE(), 'SETUP'),
        ('LWP ', 'Leave Without Pay', 0, 'Unpaid leave',              0, 1, 0, 1, 0, 0, @from, @to, 1015, 1, GETDATE(), 'SETUP')
    PRINT 'Seeded HR_LeaveMaster with 5 default types'
END
GO

-- ============================================================
-- Seed HR_ReportLayout (only if empty)
-- ============================================================
PRINT '─── Seed HR_ReportLayout (only if empty) ───'
GO

IF NOT EXISTS (SELECT 1 FROM [dbo].[HR_ReportLayout])
BEGIN
    INSERT INTO [dbo].[HR_ReportLayout]
        (DisplayName, Description, Category,
         EntryUserMasterID, EntryDateTime, CompanyMasterID, SystemName)
    VALUES
        ('Monthly Attendance Summary',  'Day-wise punches with totals per employee', 'Attendance', 1, GETDATE(), 1, 'SETUP'),
        ('Leave Balance Report',        'Outstanding leave balance by employee + type', 'Leave',    1, GETDATE(), 1, 'SETUP'),
        ('Late-Coming Register',         'Employees who arrived after shift start', 'Attendance',    1, GETDATE(), 1, 'SETUP'),
        ('Overtime Statement',           'OT hours by employee for the period', 'Attendance',         1, GETDATE(), 1, 'SETUP'),
        ('Branch-wise Salary Register',  'Net pay grouped by branch / department', 'Payroll',         1, GETDATE(), 1, 'SETUP'),
        ('Form-16 (Tax Declaration)',    'Annual tax declaration statement', 'Payroll',               1, GETDATE(), 1, 'SETUP')
    PRINT 'Seeded HR_ReportLayout with 6 sample reports'
END
ELSE
BEGIN
    -- Tag any existing rows that don't have a category yet
    UPDATE [dbo].[HR_ReportLayout]
       SET Category = 'Attendance'
     WHERE Category IS NULL
       AND DisplayName LIKE '%Attendance%'

    UPDATE [dbo].[HR_ReportLayout]
       SET Category = 'Payroll'
     WHERE Category IS NULL
       AND (DisplayName LIKE '%Salary%' OR DisplayName LIKE '%Pay%' OR DisplayName LIKE '%Tax%')

    UPDATE [dbo].[HR_ReportLayout]
       SET Category = 'Leave'
     WHERE Category IS NULL
       AND DisplayName LIKE '%Leave%'

    UPDATE [dbo].[HR_ReportLayout]
       SET Category = 'Other'
     WHERE Category IS NULL

    PRINT 'Tagged existing HR_ReportLayout rows with categories'
END
GO

-- ============================================================
-- Seed HR_SalaryHeadMaster if empty (needed for slip line items)
-- ============================================================
PRINT '─── Seed HR_SalaryHeadMaster (only if empty) ───'
GO

IF NOT EXISTS (SELECT 1 FROM [dbo].[HR_SalaryHeadMaster])
BEGIN
    INSERT INTO [dbo].[HR_SalaryHeadMaster]
        (AccountHeadCode, Name, IsEarning, IsActive, EntryUserMasterID, EntryUserDateTime, SystemName, CompanyMasterID)
    SELECT *
    FROM (VALUES
        ('BASIC',  'Basic Salary',     1, 1, 1, GETDATE(), 'SETUP', 1),
        ('HRA',    'House Rent Allowance', 1, 1, 1, GETDATE(), 'SETUP', 1),
        ('CONV',   'Conveyance Allowance', 1, 1, 1, GETDATE(), 'SETUP', 1),
        ('MED',    'Medical Allowance', 1, 1, 1, GETDATE(), 'SETUP', 1),
        ('SPL',    'Special Allowance', 1, 1, 1, GETDATE(), 'SETUP', 1),
        ('PF',     'PF (Employee)',    0, 1, 1, GETDATE(), 'SETUP', 1),
        ('PT',     'Professional Tax', 0, 1, 1, GETDATE(), 'SETUP', 1),
        ('TDS',    'Income Tax (TDS)', 0, 1, 1, GETDATE(), 'SETUP', 1),
        ('ESI',    'ESI (Employee)',   0, 1, 1, GETDATE(), 'SETUP', 1)
    ) AS V(AccountHeadCode, Name, IsEarning, IsActive, EntryUserMasterID, EntryUserDateTime, SystemName, CompanyMasterID)
    WHERE EXISTS (SELECT 1 FROM sys.columns
                  WHERE object_id = OBJECT_ID(N'[dbo].[HR_SalaryHeadMaster]')
                    AND name = 'IsEarning')

    -- Fallback insert that ignores IsEarning if the column is named differently
    IF @@ROWCOUNT = 0
    BEGIN
        INSERT INTO [dbo].[HR_SalaryHeadMaster] (AccountHeadCode, Name)
        VALUES
            ('BASIC',  'Basic Salary'),
            ('HRA',    'House Rent Allowance'),
            ('CONV',   'Conveyance Allowance'),
            ('MED',    'Medical Allowance'),
            ('SPL',    'Special Allowance'),
            ('PF',     'PF (Employee)'),
            ('PT',     'Professional Tax'),
            ('TDS',    'Income Tax (TDS)'),
            ('ESI',    'ESI (Employee)')
    END
    PRINT 'Seeded HR_SalaryHeadMaster'
END
GO

-- ============================================================
-- Seed demo salary slips for the last 3 months
-- ============================================================
PRINT '─── Seed demo HR_PayrollSalaryConfirmation slips ───'
GO

DECLARE @demoEmps TABLE (EmployeeMasterID BIGINT, BranchMasterID BIGINT, CategoryMasterID BIGINT)

-- Take up to 10 active demo employees
INSERT INTO @demoEmps (EmployeeMasterID, BranchMasterID, CategoryMasterID)
SELECT TOP 10 em.EmployeeMasterID,
              ISNULL(em.BranchMasterID, 1),
              ISNULL(em.CategoryMasterID, 1)
FROM HR_EmployeeMaster em
WHERE em.Status = 1
ORDER BY em.EmployeeMasterID

-- For each of the last 3 months, insert a slip if missing
DECLARE @offset INT = 0
WHILE @offset < 3
BEGIN
    DECLARE @mDate DATE = DATEADD(MONTH, -@offset, GETDATE())
    DECLARE @month INT  = MONTH(@mDate)
    DECLARE @year  INT  = YEAR(@mDate)
    DECLARE @fromD DATE = DATEFROMPARTS(@year, @month, 1)
    DECLARE @toD   DATE = EOMONTH(@fromD)
    DECLARE @mDays INT  = DAY(@toD)

    INSERT INTO [dbo].[HR_PayrollSalaryConfirmation]
        (EmployeeMasterID, FromDate, ToDate, PayrollMonth, PayrollYear,
         MonthDays, WorkingDays, TotalPayDays,
         BasicAmount, GrossAmount, CTCAmount, OTAmount,
         CalculatedNetPay, MasterNetPay,
         MonthlyAttendID, CategoryMasterID, BranchMasterID, CompanyMasterID,
         EntryUserMasterID, EntryUserDateTime, SystemName)
    SELECT
        d.EmployeeMasterID,
        @fromD, @toD, @month, @year,
        @mDays,
        26, 26,                        -- WorkingDays, TotalPayDays
        25000, 45000, 55000, 0,        -- Basic, Gross, CTC, OT
        42500, 42500,                  -- Net pay
        0,                              -- MonthlyAttendID (not used by mobile)
        d.CategoryMasterID,
        d.BranchMasterID,
        1,                              -- CompanyMasterID
        1, GETDATE(), 'SETUP'
    FROM @demoEmps d
    WHERE NOT EXISTS (
        SELECT 1 FROM [dbo].[HR_PayrollSalaryConfirmation] s
        WHERE s.EmployeeMasterID = d.EmployeeMasterID
          AND s.PayrollMonth = @month
          AND s.PayrollYear = @year
    )

    SET @offset = @offset + 1
END
GO

-- ============================================================
-- Seed line items for any slip that is missing them
-- ============================================================
PRINT '─── Seed HR_PayrollSalaryConfirmationDetails line items ───'
GO

;WITH SlipsNeedingItems AS (
    SELECT s.Oid AS PayrollConfirmationID, s.EmployeeMasterID, s.CategoryMasterID, s.BranchMasterID, s.CompanyMasterID
    FROM [dbo].[HR_PayrollSalaryConfirmation] s
    WHERE NOT EXISTS (
        SELECT 1 FROM [dbo].[HR_PayrollSalaryConfirmationDetails] d
        WHERE d.PayrollConfirmationID = s.Oid
    )
)
INSERT INTO [dbo].[HR_PayrollSalaryConfirmationDetails]
    ([PayrollConfirmationID], [Sr.No.], [SalaryHeadMasterID], [AccountHeadCode],
     [Add/Deduct], [Percentage], [Amount], [CalculatedAmount],
     [EmployeeMasterID], [CategoryMasterID], [BranchMasterID], [CompanyMasterID])
SELECT s.PayrollConfirmationID, x.SrNo,
       ISNULL(h.SalaryHeadMasterID, 0),
       x.AccountHeadCode, x.AddDeduct,
       0, x.Amount, x.Amount,
       s.EmployeeMasterID, s.CategoryMasterID, s.BranchMasterID, s.CompanyMasterID
FROM SlipsNeedingItems s
CROSS JOIN (VALUES
    (1, 'BASIC', 'Add',    25000),
    (2, 'HRA',   'Add',    10000),
    (3, 'CONV',  'Add',     5000),
    (4, 'MED',   'Add',     5000),
    (5, 'PF',    'Deduct',  1800),
    (6, 'PT',    'Deduct',   200),
    (7, 'TDS',   'Deduct',   500)
) AS x(SrNo, AccountHeadCode, AddDeduct, Amount)
LEFT JOIN [dbo].[HR_SalaryHeadMaster] h ON h.AccountHeadCode = x.AccountHeadCode
GO

PRINT '────────────────────────────────────────────────────'
PRINT 'Alignment complete.'
PRINT '────────────────────────────────────────────────────'
GO
