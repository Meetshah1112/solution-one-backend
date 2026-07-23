-- ============================================================
-- Multi-level leave approval chain — ported from the web portal
-- (Authorize.aspx + csp_Payroll_InsertLeaveApprovalLevels in the
--  client demo DB HR_CryoGas).
-- ============================================================
-- Flow: when an employee applies, one approval row per senior in
-- their ReportingPersonID chain is created in HR_LeaveAppAuthLeavel
-- (level 1 = direct senior). Only the active level's approver can
-- act. Approve → next level activates; last level → application
-- Approved. Reject at any level → application Rejected.
--
-- Idempotent: guarded CREATE TABLE, CREATE OR ALTER PROC.
-- ============================================================

USE [Solution-one]
GO

SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO

-- ============================================================
-- 1. HR_LeaveAppAuthLeavel (schema identical to the client DB,
--    including the table name's original spelling)
-- ============================================================
IF OBJECT_ID(N'dbo.HR_LeaveAppAuthLeavel', N'U') IS NULL
BEGIN
    CREATE TABLE [dbo].[HR_LeaveAppAuthLeavel](
        [LeaveAppAuthID]     [int] IDENTITY(1,1) NOT NULL,
        [LeaveApplicationID] [int] NOT NULL,
        [LeaveMasterID]      [int] NOT NULL,
        [EmployeeMasterID]   [int] NOT NULL,      -- applicant
        [ReportingPersonID]  [int] NULL,          -- approver at this level
        [LeaveAuthLevel]     [int] NOT NULL,
        [AuthStatus]         [varchar](20) NOT NULL CONSTRAINT [DF_HR_LeaveAppAuth_Status] DEFAULT ('PENDING'),
        [AuthDateTime]       [datetime] NULL,
        [CompanyMasterID]    [int] NOT NULL,
        [EntryUserMasterID]  [int] NOT NULL,
        [EntryUserDateTime]  [datetime] NOT NULL CONSTRAINT [DF_HR_LeaveAppAuth_EntryDt] DEFAULT (GETDATE()),
        [SystemName]         [varchar](100) NULL,
        [IsActive]           [bit] NOT NULL CONSTRAINT [DF_HR_LeaveAppAuth_IsActive] DEFAULT ((0)),
     CONSTRAINT [PK_HR_LeaveAppAuthLeavel] PRIMARY KEY CLUSTERED ([LeaveAppAuthID] ASC),
     CONSTRAINT [UQ_Leave_Approver] UNIQUE NONCLUSTERED ([LeaveApplicationID] ASC, [ReportingPersonID] ASC),
     CONSTRAINT [UQ_Leave_Level]    UNIQUE NONCLUSTERED ([LeaveApplicationID] ASC, [LeaveAuthLevel] ASC)
    )
    PRINT 'Created HR_LeaveAppAuthLeavel'
END
GO

-- ============================================================
-- 2. csp_Payroll_InsertLeaveApprovalLevels (verbatim port)
-- ============================================================
CREATE OR ALTER PROCEDURE [dbo].[csp_Payroll_InsertLeaveApprovalLevels]
    @LeaveApplicationID INT,
    @LeaveMasterID INT,
    @EmployeeID INT,
    @CompanyMasterID INT,
    @UserID INT,
    @SystemName VARCHAR(100)
AS
BEGIN
    SET NOCOUNT ON;

    ;WITH EmployeeHierarchy AS
    (
        -- Start from FIRST MANAGER (not the employee themselves)
        SELECT
            ReportingPersonID AS EmployeeMasterID,
            (SELECT ReportingPersonID
             FROM HR_EmployeeMaster
             WHERE EmployeeMasterID = e.ReportingPersonID) AS NextReportingID,
            1 AS LeaveAuthLevel
        FROM HR_EmployeeMaster e
        WHERE e.EmployeeMasterID = @EmployeeID
          AND e.ReportingPersonID IS NOT NULL      -- no chain → no rows

        UNION ALL

        -- Move upward
        SELECT
            e.EmployeeMasterID,
            e.ReportingPersonID,
            eh.LeaveAuthLevel + 1
        FROM HR_EmployeeMaster e
        INNER JOIN EmployeeHierarchy eh
            ON eh.NextReportingID = e.EmployeeMasterID
        WHERE e.ReportingPersonID IS NOT NULL
    )

    INSERT INTO HR_LeaveAppAuthLeavel
    (
        LeaveApplicationID, LeaveMasterID,
        EmployeeMasterID, ReportingPersonID, LeaveAuthLevel,
        AuthStatus, AuthDateTime,
        CompanyMasterID, EntryUserMasterID, EntryUserDateTime,
        SystemName, IsActive
    )
    SELECT
        @LeaveApplicationID,
        @LeaveMasterID,
        @EmployeeID,             -- applicant
        EmployeeMasterID,        -- approver at this level
        LeaveAuthLevel,
        'PENDING',
        NULL,
        @CompanyMasterID,
        @UserID,
        GETDATE(),
        @SystemName,
        CASE WHEN LeaveAuthLevel = 1 THEN 1 ELSE 0 END
    FROM EmployeeHierarchy
    OPTION (MAXRECURSION 100);
END
GO

PRINT 'csp_Payroll_InsertLeaveApprovalLevels installed.'
GO

-- ============================================================
-- 3. Demo reporting chain (test data only):
--    Priya / Rohan / Ananya / Vikram  →  Aarav (senior, 327)
--    Aarav (327)                      →  PRAFUL (1, the HR admin)
--    PRAFUL (1)                       →  56 (owner — EXCLUDED from chain)
--
-- Note the SP's semantics (faithful to the client DB): a manager
-- becomes an approval level only if they THEMSELVES have a
-- reporting person. The topmost person (RP = NULL) is excluded,
-- so PRAFUL is the final approver: L1 = Aarav, L2 = PRAFUL.
-- ============================================================
UPDATE HR_EmployeeMaster SET ReportingPersonID = 327  WHERE EmployeeMasterID IN (328, 329, 330, 331);
UPDATE HR_EmployeeMaster SET ReportingPersonID = 1    WHERE EmployeeMasterID = 327;
UPDATE HR_EmployeeMaster SET ReportingPersonID = 56   WHERE EmployeeMasterID = 1;   -- original value
UPDATE HR_EmployeeMaster SET ReportingPersonID = NULL WHERE EmployeeMasterID = 56;  -- owner = top
GO

PRINT 'Demo reporting chain wired: 328-331 -> 327 (Aarav) -> 1 (PRAFUL/HR).'

SELECT EmployeeMasterID, LTRIM(RTRIM(FirstName)) AS Name, ReportingPersonID
FROM HR_EmployeeMaster
WHERE EmployeeMasterID IN (1, 327, 328, 329, 330, 331);
GO
