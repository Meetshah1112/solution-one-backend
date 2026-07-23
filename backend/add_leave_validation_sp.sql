-- ============================================================
-- Leave validation SP — ported from the client demo DB (HR_CryoGas)
-- ============================================================
-- The web portal's Leave Master screen lets admins attach a
-- validation stored procedure to each leave type via
-- HR_LeaveMaster.ValidationSPName. Before an application is
-- saved, the configured SP runs and can veto it with a message.
--
-- This script:
--   1. Installs csp_HR_ValidateLeaveApplication (same contract
--      as the client DB: @IsValid / @ValidationMessage outputs)
--   2. Points every active leave type at it (only where no SP
--      is configured yet — existing config is left untouched)
--
-- Idempotent: CREATE OR ALTER + guarded UPDATE. Safe to re-run.
-- ============================================================

USE [Solution-one]
GO

SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO

CREATE OR ALTER PROCEDURE [dbo].[csp_HR_ValidateLeaveApplication]
    @EmployeeMasterID   INT,
    @LeaveMasterID      INT,
    @FromDate           DATE,
    @ToDate             DATE,
    @DayLeaveType       NVARCHAR(20),   -- FullDay | HalfDay | QuarterDay
    @CompanyMasterID    INT,
    @YearID             BIGINT,
    @IsValid            BIT           OUTPUT,
    @ValidationMessage  NVARCHAR(500) OUTPUT
AS
BEGIN
    SET NOCOUNT ON;

    SET @IsValid = 1;
    SET @ValidationMessage = N'';

    IF @FromDate > @ToDate
    BEGIN
        SET @IsValid = 0;
        SET @ValidationMessage = N'From date cannot be after To date.';
        RETURN;
    END

    -- Active employee in company
    IF NOT EXISTS (
        SELECT 1
        FROM dbo.HR_EmployeeMaster em
        WHERE em.EmployeeMasterID = @EmployeeMasterID
          AND em.Status = 1
          AND em.JobStatus = N'Active'
          AND em.CompanyMasterID = @CompanyMasterID
    )
    BEGIN
        SET @IsValid = 0;
        SET @ValidationMessage = N'Employee is not active in this company.';
        RETURN;
    END

    -- Leave type active
    IF NOT EXISTS (
        SELECT 1
        FROM dbo.HR_LeaveMaster lm
        WHERE lm.LeaveMasterID = @LeaveMasterID
          AND lm.IsActive = 1
          AND (lm.CompanyMasterID IS NULL OR lm.CompanyMasterID = @CompanyMasterID)
    )
    BEGIN
        SET @IsValid = 0;
        SET @ValidationMessage = N'Leave type is not active.';
        RETURN;
    END

    -- Half / quarter allowed on leave master
    IF @DayLeaveType = N'HalfDay'
       AND NOT EXISTS (
           SELECT 1 FROM dbo.HR_LeaveMaster
           WHERE LeaveMasterID = @LeaveMasterID AND HalfDayAllowed = 1
       )
    BEGIN
        SET @IsValid = 0;
        SET @ValidationMessage = N'Half-day is not allowed for this leave type.';
        RETURN;
    END

    IF @DayLeaveType = N'QuarterDay'
       AND NOT EXISTS (
           SELECT 1 FROM dbo.HR_LeaveMaster
           WHERE LeaveMasterID = @LeaveMasterID AND QuarterDayAllowed = 1
       )
    BEGIN
        SET @IsValid = 0;
        SET @ValidationMessage = N'Quarter-day is not allowed for this leave type.';
        RETURN;
    END

    -- Period lock (attendance locked for category/branch) — optional table
    IF OBJECT_ID(N'dbo.HR_AttendancePeriodStatus', N'U') IS NOT NULL
    BEGIN
        IF EXISTS (
            SELECT 1
            FROM dbo.HR_AttendancePeriodStatus ps
            INNER JOIN dbo.HR_EmployeeMaster em ON em.EmployeeMasterID = @EmployeeMasterID
            WHERE ps.CompanyMasterID  = @CompanyMasterID
              AND ps.BranchMasterID   = em.BranchMasterID
              AND ps.CategoryMasterID = em.CategoryMasterID
              AND ps.YearID           = @YearID
              AND ps.[Status]         = N'Locked'
              AND @FromDate <= ps.PeriodTo
              AND @ToDate   >= ps.PeriodFrom
        )
        BEGIN
            SET @IsValid = 0;
            SET @ValidationMessage = N'Attendance period is locked; leave cannot be applied for these dates.';
            RETURN;
        END
    END

    -- Overlap with pending/approved applications
    IF EXISTS (
        SELECT 1
        FROM dbo.HR_LeaveApplication la
        WHERE la.EmployeeMasterID = @EmployeeMasterID
          AND la.[Status] IN (N'Pending', N'Approved')
          AND la.FromDate <= @ToDate
          AND la.ToDate   >= @FromDate
    )
    BEGIN
        SET @IsValid = 0;
        SET @ValidationMessage = N'Leave dates overlap an existing pending or approved application.';
        RETURN;
    END

    -- Declarative rules from HR_LeavePolicyRule (MinNoticeDays) — optional table
    IF OBJECT_ID(N'dbo.HR_LeavePolicyRule', N'U') IS NOT NULL
    BEGIN
        DECLARE @MinNotice INT;
        SELECT @MinNotice = TRY_CAST(r.RuleValue AS INT)
        FROM dbo.HR_LeavePolicyRule r
        WHERE r.LeaveMasterID = @LeaveMasterID
          AND r.RuleCode = N'MinNoticeDays'
          AND r.IsActive = 1
          AND (r.CompanyMasterID IS NULL OR r.CompanyMasterID = @CompanyMasterID);

        IF @MinNotice IS NOT NULL AND @MinNotice > 0
           AND @FromDate < DATEADD(DAY, @MinNotice, CAST(GETDATE() AS DATE))
        BEGIN
            SET @IsValid = 0;
            SET @ValidationMessage = N'Leave must be applied at least '
                + CAST(@MinNotice AS NVARCHAR(10)) + N' day(s) in advance.';
            RETURN;
        END
    END
END
GO

-- ============================================================
-- Wire the SP into every active leave type that has none yet
-- ============================================================
UPDATE dbo.HR_LeaveMaster
   SET ValidationSPName = N'csp_HR_ValidateLeaveApplication'
 WHERE IsActive = 1
   AND (ValidationSPName IS NULL OR LTRIM(RTRIM(ValidationSPName)) = N'');
GO

PRINT 'csp_HR_ValidateLeaveApplication installed and wired into HR_LeaveMaster.'

SELECT LeaveMasterID, LTRIM(RTRIM(Name)) AS Name,
       ValidationSPName
FROM dbo.HR_LeaveMaster
WHERE IsActive = 1
ORDER BY LeaveMasterID;
GO
