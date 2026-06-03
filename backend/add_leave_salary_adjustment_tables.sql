-- ============================================================
-- Solution One ESS — feature tables additive script
-- ============================================================
-- Adds the 5 feature tables to the existing Solution-one DB
-- (or any HR DB that does not yet contain them).
-- Schema mirrors the canonical SolutionOne_HR DB used by the
-- ASP.NET web portal so records stay interoperable.
--
-- This script is idempotent — safe to re-run.
-- ============================================================

USE [Solution-one]
GO

SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO

-- ============================================================
-- 1. HR_LeaveMaster — leave types (CL, SL, PL, EL, etc.)
-- ============================================================
IF NOT EXISTS (SELECT 1 FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[HR_LeaveMaster]') AND type = 'U')
BEGIN
    CREATE TABLE [dbo].[HR_LeaveMaster](
        [LeaveMasterID]      [int] IDENTITY(1,1) NOT NULL,
        [Code]               [nvarchar](20) NOT NULL,
        [Name]               [nvarchar](50) NOT NULL,
        [Balance]            [decimal](18, 2) NOT NULL DEFAULT(0),
        [Description]        [nvarchar](200) NULL,
        [IsPaidLeave]        [bit] NOT NULL DEFAULT(0),
        [HalfDayAllowed]     [bit] NOT NULL DEFAULT(1),
        [IsActive]           [bit] NOT NULL DEFAULT(1),
        [CompanyMasterID]    [bigint] NULL,
        [CreatedAt]          [datetime] NOT NULL DEFAULT(GETDATE()),
     CONSTRAINT [PK_HR_LeaveMaster] PRIMARY KEY CLUSTERED ([LeaveMasterID] ASC)
    )
    PRINT 'Created HR_LeaveMaster'
END
GO

-- Seed default leave types if the table is empty
IF NOT EXISTS (SELECT 1 FROM [dbo].[HR_LeaveMaster])
BEGIN
    INSERT INTO [dbo].[HR_LeaveMaster] (Code, Name, Balance, Description, IsPaidLeave, HalfDayAllowed)
    VALUES
        ('CL',   'Casual Leave',     12, 'For personal or short-notice absences',           1, 1),
        ('SL',   'Sick Leave',       10, 'Doctor certificate required if more than 3 days', 1, 1),
        ('PL',   'Privileged Leave', 18, 'Annual leave for vacation / extended time off',   1, 1),
        ('EL',   'Earned Leave',     15, 'Accrued based on tenure',                          1, 1),
        ('LWP',  'Leave Without Pay', 0, 'Unpaid leave — deducted from salary',              0, 1)
    PRINT 'Seeded HR_LeaveMaster with default leave types'
END
GO

-- ============================================================
-- 2. HR_LeaveApplication — submitted leave requests
-- ============================================================
IF NOT EXISTS (SELECT 1 FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[HR_LeaveApplication]') AND type = 'U')
BEGIN
    CREATE TABLE [dbo].[HR_LeaveApplication](
        [LeaveApplicationID]   [int] IDENTITY(1,1) NOT NULL,
        [ApplicationDate]      [date] NOT NULL DEFAULT(CAST(GETDATE() AS DATE)),
        [FromDate]             [date] NOT NULL,
        [ToDate]               [date] NOT NULL,
        [LeaveMasterID]        [int] NOT NULL,
        [AppliedDay]           [decimal](18, 2) NOT NULL,
        [DayLeaveType]         [nvarchar](20) NOT NULL DEFAULT('FullDay'),  -- FullDay/HalfDay/QuarterDay
        [HalfDayLeave]         [nvarchar](20) NULL,                          -- FirstHalf/SecondHalf
        [LeaveReason]          [nvarchar](500) NULL,
        [Status]               [nvarchar](20) NOT NULL DEFAULT('Pending'),   -- Pending/Approved/Rejected/Cancelled
        [EmployeeMasterID]     [bigint] NOT NULL,
        [ReportingPersonID]    [bigint] NULL,
        [ApprovedBy]           [bigint] NULL,
        [ApprovedDate]         [datetime] NULL,
        [ApproverComment]      [nvarchar](500) NULL,
        [CompanyMasterID]      [bigint] NOT NULL DEFAULT(1),
        [EntryUserMasterID]    [bigint] NOT NULL,
        [EntryDateTime]        [datetime] NOT NULL DEFAULT(GETDATE()),
        [EditUserMasterID]     [bigint] NULL,
        [EditDateTime]         [datetime] NULL,
     CONSTRAINT [PK_HR_LeaveApplication] PRIMARY KEY CLUSTERED ([LeaveApplicationID] ASC),
     CONSTRAINT [FK_HR_LeaveApplication_LeaveMaster] FOREIGN KEY ([LeaveMasterID])
        REFERENCES [dbo].[HR_LeaveMaster] ([LeaveMasterID])
    )

    CREATE INDEX IX_HR_LeaveApplication_Employee_Status
        ON [dbo].[HR_LeaveApplication] (EmployeeMasterID, Status)

    PRINT 'Created HR_LeaveApplication'
END
GO

-- ============================================================
-- 3. HR_AttendenceAdjustment — attendance correction requests
--    (note: web app spells this "Attendence" — keeping the typo for interop)
-- ============================================================
IF NOT EXISTS (SELECT 1 FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[HR_AttendenceAdjustment]') AND type = 'U')
BEGIN
    CREATE TABLE [dbo].[HR_AttendenceAdjustment](
        [Oid]                  [bigint] IDENTITY(1,1) NOT NULL,
        [DocNo]                [nvarchar](50) NOT NULL,
        [DocDate]              [datetime] NOT NULL DEFAULT(GETDATE()),
        [EmployeeMasterID]     [bigint] NOT NULL,
        [ReportingPersonID]    [bigint] NULL,
        [Type]                 [nvarchar](50) NOT NULL,           -- MissedPunch / WrongPunch / OnDuty / WFH
        [AttendenceDate]       [datetime] NOT NULL,
        [InTime]               [datetime] NULL,
        [OutTime]              [datetime] NULL,
        [Reason]               [nvarchar](500) NOT NULL,
        [ApprovedBy]           [bigint] NULL,
        [ApprovedDate]         [datetime] NULL,
        [ApprovalStatus]       [nvarchar](20) NOT NULL DEFAULT('Pending'),  -- Pending/Approved/Rejected
        [ManagerComment]       [nvarchar](500) NULL,
        [CompanyMasterID]      [bigint] NOT NULL DEFAULT(1),
        [EntryUserMasterID]    [bigint] NOT NULL,
        [EntryUserDateTime]    [datetime] NOT NULL DEFAULT(GETDATE()),
        [EditUserMasterID]     [bigint] NULL,
        [EditUserDateTime]     [datetime] NULL,
        [Status]               [bit] NOT NULL DEFAULT(1),
     CONSTRAINT [PK_HR_AttendenceAdjustment] PRIMARY KEY CLUSTERED ([Oid] ASC)
    )

    CREATE INDEX IX_HR_AttendenceAdjustment_Employee_Status
        ON [dbo].[HR_AttendenceAdjustment] (EmployeeMasterID, ApprovalStatus)

    PRINT 'Created HR_AttendenceAdjustment'
END
GO

-- ============================================================
-- 4. HR_PayrollSalaryConfirmation — monthly salary master
-- ============================================================
IF NOT EXISTS (SELECT 1 FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[HR_PayrollSalaryConfirmation]') AND type = 'U')
BEGIN
    CREATE TABLE [dbo].[HR_PayrollSalaryConfirmation](
        [Oid]                  [bigint] IDENTITY(1,1) NOT NULL,
        [EmployeeMasterID]     [bigint] NOT NULL,
        [FromDate]             [date] NULL,
        [ToDate]               [date] NULL,
        [PayrollMonth]         [int] NULL,         -- 1-12
        [PayrollYear]          [int] NULL,
        [MonthDays]            [int] NULL,
        [WorkingDays]          [decimal](18, 2) NULL,
        [TotalPayDays]         [decimal](18, 2) NULL,
        [BasicAmount]          [decimal](18, 2) NOT NULL DEFAULT(0),
        [GrossAmount]          [decimal](18, 2) NOT NULL DEFAULT(0),
        [CTCAmount]            [decimal](18, 2) NOT NULL DEFAULT(0),
        [OTAmount]             [decimal](18, 2) NOT NULL DEFAULT(0),
        [CalculatedNetPay]     [decimal](18, 2) NOT NULL DEFAULT(0),
        [MasterNetPay]         [decimal](18, 2) NOT NULL DEFAULT(0),
        [CompanyMasterID]      [bigint] NOT NULL DEFAULT(1),
        [EntryUserMasterID]    [bigint] NOT NULL,
        [EntryUserDateTime]    [datetime] NOT NULL DEFAULT(GETDATE()),
     CONSTRAINT [PK_HR_PayrollSalaryConfirmation] PRIMARY KEY CLUSTERED ([Oid] ASC)
    )

    CREATE INDEX IX_PayrollSalary_Employee_Month
        ON [dbo].[HR_PayrollSalaryConfirmation] (EmployeeMasterID, PayrollYear, PayrollMonth)

    PRINT 'Created HR_PayrollSalaryConfirmation'
END
GO

-- ============================================================
-- 5. HR_PayrollSalaryConfirmationDetails — line items per slip
-- ============================================================
IF NOT EXISTS (SELECT 1 FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[HR_PayrollSalaryConfirmationDetails]') AND type = 'U')
BEGIN
    CREATE TABLE [dbo].[HR_PayrollSalaryConfirmationDetails](
        [Oid]                  [bigint] IDENTITY(1,1) NOT NULL,
        [PayrollConfirmationID][bigint] NOT NULL,
        [SrNo]                 [int] NOT NULL,
        [HeadName]             [nvarchar](100) NOT NULL,
        [AddDeduct]            [nvarchar](10) NOT NULL,            -- Add / Deduct
        [Amount]               [decimal](18, 2) NOT NULL DEFAULT(0),
        [Remarks]              [nvarchar](200) NULL,
     CONSTRAINT [PK_HR_PayrollSalaryConfirmationDetails] PRIMARY KEY CLUSTERED ([Oid] ASC),
     CONSTRAINT [FK_PayrollSalaryDetails_Master] FOREIGN KEY ([PayrollConfirmationID])
        REFERENCES [dbo].[HR_PayrollSalaryConfirmation] ([Oid])
        ON DELETE CASCADE
    )
    PRINT 'Created HR_PayrollSalaryConfirmationDetails'
END
GO

-- ============================================================
-- 6. HR_ReportLayout — saved custom report definitions
-- ============================================================
IF NOT EXISTS (SELECT 1 FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[HR_ReportLayout]') AND type = 'U')
BEGIN
    CREATE TABLE [dbo].[HR_ReportLayout](
        [ReportId]             [int] IDENTITY(1,1) NOT NULL,
        [DisplayName]          [nvarchar](100) NOT NULL,
        [Description]          [nvarchar](300) NULL,
        [Category]              [nvarchar](50) NULL,        -- Attendance / Payroll / Leave / Asset
        [LayoutData]           [varbinary](max) NULL,        -- DevExpress report blob (web only)
        [CompanyMasterID]      [bigint] NOT NULL DEFAULT(1),
        [EntryUserMasterID]    [bigint] NOT NULL DEFAULT(1),
        [EntryDateTime]        [datetime] NOT NULL DEFAULT(GETDATE()),
     CONSTRAINT [PK_HR_ReportLayout] PRIMARY KEY CLUSTERED ([ReportId] ASC)
    )
    PRINT 'Created HR_ReportLayout'
END
GO

-- Seed demo reports for the listing screen
IF NOT EXISTS (SELECT 1 FROM [dbo].[HR_ReportLayout])
BEGIN
    INSERT INTO [dbo].[HR_ReportLayout] (DisplayName, Description, Category)
    VALUES
        ('Monthly Attendance Summary',  'Day-wise punches with totals per employee', 'Attendance'),
        ('Leave Balance Report',        'Outstanding leave balance by employee + type', 'Leave'),
        ('Late-Coming Register',         'Employees who arrived after shift start', 'Attendance'),
        ('Overtime Statement',           'OT hours by employee for the period', 'Attendance'),
        ('Branch-wise Salary Register',  'Net pay grouped by branch / department', 'Payroll'),
        ('Form-16 (Tax Declaration)',    'Annual tax declaration statement', 'Payroll')
    PRINT 'Seeded HR_ReportLayout with sample reports'
END
GO

-- ============================================================
-- 7. Demo salary slip for the existing demo employees
--    (only if no slips exist yet)
-- ============================================================
IF NOT EXISTS (SELECT 1 FROM [dbo].[HR_PayrollSalaryConfirmation])
BEGIN
    DECLARE @month INT = MONTH(DATEADD(MONTH, -1, GETDATE()))
    DECLARE @year  INT = YEAR(DATEADD(MONTH, -1, GETDATE()))

    INSERT INTO [dbo].[HR_PayrollSalaryConfirmation]
        (EmployeeMasterID, PayrollMonth, PayrollYear, MonthDays, WorkingDays, TotalPayDays,
         BasicAmount, GrossAmount, CTCAmount, OTAmount, CalculatedNetPay, MasterNetPay,
         EntryUserMasterID)
    SELECT TOP 5
        em.EmployeeMasterID,
        @month, @year, 30, 26, 26,
        25000, 45000, 55000, 0, 42500, 42500,
        1
    FROM HR_EmployeeMaster em
    WHERE em.Status = 1
    ORDER BY em.EmployeeMasterID

    -- Add line items for each newly inserted slip
    INSERT INTO [dbo].[HR_PayrollSalaryConfirmationDetails]
        (PayrollConfirmationID, SrNo, HeadName, AddDeduct, Amount)
    SELECT s.Oid, 1, 'Basic',         'Add',    25000 FROM [dbo].[HR_PayrollSalaryConfirmation] s WHERE s.PayrollMonth = @month AND s.PayrollYear = @year
    UNION ALL
    SELECT s.Oid, 2, 'HRA',           'Add',    10000 FROM [dbo].[HR_PayrollSalaryConfirmation] s WHERE s.PayrollMonth = @month AND s.PayrollYear = @year
    UNION ALL
    SELECT s.Oid, 3, 'Conveyance',    'Add',     5000 FROM [dbo].[HR_PayrollSalaryConfirmation] s WHERE s.PayrollMonth = @month AND s.PayrollYear = @year
    UNION ALL
    SELECT s.Oid, 4, 'Medical',       'Add',     5000 FROM [dbo].[HR_PayrollSalaryConfirmation] s WHERE s.PayrollMonth = @month AND s.PayrollYear = @year
    UNION ALL
    SELECT s.Oid, 5, 'PF (Employee)', 'Deduct',  1800 FROM [dbo].[HR_PayrollSalaryConfirmation] s WHERE s.PayrollMonth = @month AND s.PayrollYear = @year
    UNION ALL
    SELECT s.Oid, 6, 'Professional Tax','Deduct',  200 FROM [dbo].[HR_PayrollSalaryConfirmation] s WHERE s.PayrollMonth = @month AND s.PayrollYear = @year
    UNION ALL
    SELECT s.Oid, 7, 'Income Tax (TDS)','Deduct', 500 FROM [dbo].[HR_PayrollSalaryConfirmation] s WHERE s.PayrollMonth = @month AND s.PayrollYear = @year

    PRINT 'Seeded demo salary slips for last month'
END
GO

PRINT '────────────────────────────────────────────────────'
PRINT 'All feature tables ready.'
PRINT '────────────────────────────────────────────────────'
GO
