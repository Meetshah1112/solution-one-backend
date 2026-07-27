/* ============================================================================
   fix_MobileApplication_compat.sql
   ----------------------------------------------------------------------------
   PURPOSE
     Repairs the schema drift between the LIVE [MobileApplication] database
     (built from create_MobileApplication_db.sql, which reproduces the cryogas
     tables VERBATIM) and the schema the mobile backend (server.js) was actually
     written against. The drift makes two app features fail at runtime:

       1. POST /api/attendance/punch  -- FIRST punch of the day
          "Cannot insert the value NULL into column 'IsLocked',
           table 'MobileApplication.dbo.HR_DailyAttendanceMultiPunch'"
          HR_DailyAttendanceMultiPunch.[IsLocked] [bit] NOT NULL exists in the
          new schema with NO DEFAULT. It does not exist at all in the schema the
          app was built against, so the app's 20-column INSERT never supplies it.
          Its sibling table HR_DailyAttendance declares the SAME column WITH
          DEFAULT ((0)) -- the multi-punch table simply never got the default.

       2. POST /api/leave/apply  -- with a reason longer than 50 characters
          "String or binary data would be truncated."
          HR_LeaveApplication.[LeaveReason] is [nvarchar](50) here but
          [nvarchar](500) in the app's baseline. server.js truncates the reason
          to 500 chars and its own inline comment states the live column is
          "widened to nvarchar(500) by the alignment script" -- this is that
          script.

   PROPERTIES
     * IDEMPOTENT      -- safe to run repeatedly. Every statement is guarded by a
                          sys.default_constraints / sys.columns / COL_LENGTH check,
                          so a second run is a complete no-op.
     * NON-DESTRUCTIVE -- no DROP DATABASE, no DROP TABLE, no DROP COLUMN,
                          no DELETE, no TRUNCATE. Only ADD CONSTRAINT, ADD COLUMN
                          (NULLable), and loss-free column WIDENING.
                          The database is LIVE with seeded users under test.
     * SQL SERVER 2014 -- no CREATE OR ALTER, no DROP ... IF EXISTS, no STRING_AGG,
                          no STRING_SPLIT, no OPENJSON, no 2016+ syntax anywhere.

   NO server.js CHANGE IS REQUIRED.
   NO BACKEND RESTART IS REQUIRED.
     Every fix is at the database layer. DEFAULT constraints and widened columns
     take effect on the very next statement the existing connection pool sends;
     the Node process does not cache schema metadata.

   RUN AS: a login with ALTER permission on dbo (db_ddladmin / db_owner).
   EXPECTED RUNTIME: sub-second. No table rebuild, no long lock.
   ============================================================================ */

USE [MobileApplication];
GO

/* Pin the SET options this script depends on. SSMS defaults QUOTED_IDENTIFIER
   ON, sqlcmd defaults it OFF; ALTER TABLE / ALTER COLUMN can refuse to run
   (Msg 1934) under the wrong combination. Pinning both makes the script behave
   identically however it is launched. */
SET ANSI_NULLS ON;
GO
SET QUOTED_IDENTIFIER ON;
GO
SET NOCOUNT ON;
GO

PRINT '=== fix_MobileApplication_compat.sql : starting ===';
PRINT '    Target database : ' + DB_NAME();
GO


/* ============================================================================
   SECTION 0 -- PREFLIGHT: REFUSE TO RUN AGAINST THE WRONG DATABASE
   ----------------------------------------------------------------------------
   Every fix below is guarded by OBJECT_ID / COL_LENGTH / sys.columns. That is
   what makes the script idempotent, but it also means that pointing it at the
   WRONG database prints a full page of reassuring "SKIPPED" lines, changes
   nothing, and looks like a success. The backend's database name comes from
   DB_NAME in backend/.env, so this is a live risk, not a hypothetical one.

   If the two tables the mobile backend cannot function without are absent,
   abort the whole script (SET NOEXEC ON suppresses execution of every
   remaining batch; the final batch turns it back off).
   ============================================================================ */

IF OBJECT_ID(N'dbo.HR_DailyAttendanceMultiPunch', N'U') IS NULL
   OR OBJECT_ID(N'dbo.HR_LeaveApplication', N'U') IS NULL
BEGIN
    PRINT '';
    PRINT '*** ABORTED -- this is not the mobile backend database. ***';
    PRINT '    dbo.HR_DailyAttendanceMultiPunch and/or dbo.HR_LeaveApplication is missing.';
    PRINT '    Point the USE statement at the top of this script at the database named';
    PRINT '    by DB_NAME in backend/.env, then re-run. NOTHING HAS BEEN CHANGED.';
    RAISERROR(N'fix_MobileApplication_compat.sql aborted: target database does not contain the mobile backend tables.', 16, 1);
    SET NOEXEC ON;
END
GO


/* ============================================================================
   SECTION 1 -- P0 BLOCKER: THE REPORTED PUNCH FAILURE
   ----------------------------------------------------------------------------
   Table  : dbo.HR_DailyAttendanceMultiPunch
   Column : [IsLocked] [bit] NOT NULL  (no default)
   Broken : POST /api/attendance/punch, first punch of the day (server.js:416).
            The INSERT supplies exactly 20 columns and IsLocked is not one of
            them, so SQL Server rejects the row.
   Remedy : ADD a DEFAULT ((0)) constraint -- preferred remedy (1). The column
            stays NOT NULL; we do NOT relax nullability and we do NOT drop it.
            0 == "not locked", which mirrors the sibling table
            HR_DailyAttendance.IsLocked DEFAULT ((0)) and matches the app's
            baseline where the column is absent entirely.
   ============================================================================ */

IF OBJECT_ID(N'dbo.HR_DailyAttendanceMultiPunch', N'U') IS NOT NULL
   AND COL_LENGTH(N'dbo.HR_DailyAttendanceMultiPunch', N'IsLocked') IS NOT NULL
   AND NOT EXISTS (SELECT 1 FROM sys.default_constraints
                   WHERE parent_object_id = OBJECT_ID(N'dbo.HR_DailyAttendanceMultiPunch')
                     AND name = N'DF_HR_DailyAttendanceMultiPunch_IsLocked')
   AND NOT EXISTS (SELECT 1 FROM sys.columns
                   WHERE object_id = OBJECT_ID(N'dbo.HR_DailyAttendanceMultiPunch')
                     AND name = N'IsLocked'
                     AND default_object_id <> 0)
BEGIN
    ALTER TABLE [dbo].[HR_DailyAttendanceMultiPunch]
        ADD CONSTRAINT [DF_HR_DailyAttendanceMultiPunch_IsLocked] DEFAULT ((0)) FOR [IsLocked];
    PRINT '[1] ADDED DF_HR_DailyAttendanceMultiPunch_IsLocked DEFAULT ((0)) -- punch INSERT unblocked.';
END
ELSE
BEGIN
    PRINT '[1] SKIPPED -- HR_DailyAttendanceMultiPunch.IsLocked already has a default (or column absent).';
END
GO


/* ============================================================================
   SECTION 2 -- P1 BLOCKER: LEAVE APPLICATION REASON TRUNCATION
   ----------------------------------------------------------------------------
   Table  : dbo.HR_LeaveApplication
   Column : [LeaveReason] [nvarchar](50) NULL   -->   [nvarchar](500) NULL
   Broken : POST /api/leave/apply (server.js:1282). server.js binds the reason
            as NVarChar truncated to 500 chars; anything over 50 chars makes the
            INSERT fail with "String or binary data would be truncated".
   Remedy : Widen the column -- remedy (3), unavoidable here because no DEFAULT
            can fix a too-narrow type. Widening nvarchar in place is a
            metadata-only operation, LOSS-FREE, and there is no index on this
            column. Nullability is restated explicitly so ALTER COLUMN cannot
            silently flip it.
   Guard  : sys.columns.max_length is in BYTES for nvarchar
            -> nvarchar(50) = 100, nvarchar(500) = 1000. Only widen if narrower.
   ============================================================================ */

IF OBJECT_ID(N'dbo.HR_LeaveApplication', N'U') IS NOT NULL
   AND EXISTS (SELECT 1 FROM sys.columns
               WHERE object_id = OBJECT_ID(N'dbo.HR_LeaveApplication')
                 AND name = N'LeaveReason'
                 AND max_length >= 0        /* exclude nvarchar(max), which is -1 */
                 AND max_length < 1000)
BEGIN
    ALTER TABLE [dbo].[HR_LeaveApplication]
        ALTER COLUMN [LeaveReason] [nvarchar](500) NULL;
    PRINT '[2] WIDENED HR_LeaveApplication.LeaveReason to nvarchar(500) -- leave apply unblocked.';
END
ELSE
BEGIN
    PRINT '[2] SKIPPED -- HR_LeaveApplication.LeaveReason is already nvarchar(500) or wider.';
END
GO


/* ============================================================================
   SECTION 3 -- P2 SAME-CLASS HARDENING ON THE PUNCH TABLE
   ----------------------------------------------------------------------------
   HR_DailyAttendanceMultiPunch is the ONLY table in the whole database with
   ZERO default constraints, yet it has 20 NOT NULL columns. IsLocked is merely
   the first one the app happens to hit. The app's current INSERT does supply
   the other five below, so these are NOT active bugs today -- but the app's
   baseline schema defaults every one of them, and adding the same defaults here
   makes the table tolerant of any partial INSERT (a future code path, a manual
   admin insert, a data-repair script) instead of failing the same way again.

   Values mirror the app's proven-working baseline exactly:
     MonthlyAttendID 0, PayrollConfirmationID 0,
     ActualWorkingHours 0, MasterWorkingHours 0, WorkingHours 0,
     FormID 1026 (the cryogas form id for the multi-punch screen).

   A DEFAULT only fires when a column is OMITTED from an INSERT, so none of
   these can change the value of anything server.js writes today.
   ============================================================================ */

IF OBJECT_ID(N'dbo.HR_DailyAttendanceMultiPunch', N'U') IS NOT NULL
   AND COL_LENGTH(N'dbo.HR_DailyAttendanceMultiPunch', N'MonthlyAttendID') IS NOT NULL
   AND NOT EXISTS (SELECT 1 FROM sys.default_constraints
                   WHERE parent_object_id = OBJECT_ID(N'dbo.HR_DailyAttendanceMultiPunch')
                     AND name = N'DF_HR_DailyAttendanceMultiPunch_MonthlyAttendID')
   AND NOT EXISTS (SELECT 1 FROM sys.columns
                   WHERE object_id = OBJECT_ID(N'dbo.HR_DailyAttendanceMultiPunch')
                     AND name = N'MonthlyAttendID' AND default_object_id <> 0)
BEGIN
    ALTER TABLE [dbo].[HR_DailyAttendanceMultiPunch]
        ADD CONSTRAINT [DF_HR_DailyAttendanceMultiPunch_MonthlyAttendID] DEFAULT ((0)) FOR [MonthlyAttendID];
    PRINT '[3a] ADDED DF_HR_DailyAttendanceMultiPunch_MonthlyAttendID DEFAULT ((0)).';
END
GO

IF OBJECT_ID(N'dbo.HR_DailyAttendanceMultiPunch', N'U') IS NOT NULL
   AND COL_LENGTH(N'dbo.HR_DailyAttendanceMultiPunch', N'PayrollConfirmationID') IS NOT NULL
   AND NOT EXISTS (SELECT 1 FROM sys.default_constraints
                   WHERE parent_object_id = OBJECT_ID(N'dbo.HR_DailyAttendanceMultiPunch')
                     AND name = N'DF_HR_DailyAttendanceMultiPunch_PayrollConfirmationID')
   AND NOT EXISTS (SELECT 1 FROM sys.columns
                   WHERE object_id = OBJECT_ID(N'dbo.HR_DailyAttendanceMultiPunch')
                     AND name = N'PayrollConfirmationID' AND default_object_id <> 0)
BEGIN
    ALTER TABLE [dbo].[HR_DailyAttendanceMultiPunch]
        ADD CONSTRAINT [DF_HR_DailyAttendanceMultiPunch_PayrollConfirmationID] DEFAULT ((0)) FOR [PayrollConfirmationID];
    PRINT '[3b] ADDED DF_HR_DailyAttendanceMultiPunch_PayrollConfirmationID DEFAULT ((0)).';
END
GO

IF OBJECT_ID(N'dbo.HR_DailyAttendanceMultiPunch', N'U') IS NOT NULL
   AND COL_LENGTH(N'dbo.HR_DailyAttendanceMultiPunch', N'ActualWorkingHours') IS NOT NULL
   AND NOT EXISTS (SELECT 1 FROM sys.default_constraints
                   WHERE parent_object_id = OBJECT_ID(N'dbo.HR_DailyAttendanceMultiPunch')
                     AND name = N'DF_HR_DailyAttendanceMultiPunch_ActualWorkingHours')
   AND NOT EXISTS (SELECT 1 FROM sys.columns
                   WHERE object_id = OBJECT_ID(N'dbo.HR_DailyAttendanceMultiPunch')
                     AND name = N'ActualWorkingHours' AND default_object_id <> 0)
BEGIN
    ALTER TABLE [dbo].[HR_DailyAttendanceMultiPunch]
        ADD CONSTRAINT [DF_HR_DailyAttendanceMultiPunch_ActualWorkingHours] DEFAULT ((0)) FOR [ActualWorkingHours];
    PRINT '[3c] ADDED DF_HR_DailyAttendanceMultiPunch_ActualWorkingHours DEFAULT ((0)).';
END
GO

IF OBJECT_ID(N'dbo.HR_DailyAttendanceMultiPunch', N'U') IS NOT NULL
   AND COL_LENGTH(N'dbo.HR_DailyAttendanceMultiPunch', N'MasterWorkingHours') IS NOT NULL
   AND NOT EXISTS (SELECT 1 FROM sys.default_constraints
                   WHERE parent_object_id = OBJECT_ID(N'dbo.HR_DailyAttendanceMultiPunch')
                     AND name = N'DF_HR_DailyAttendanceMultiPunch_MasterWorkingHours')
   AND NOT EXISTS (SELECT 1 FROM sys.columns
                   WHERE object_id = OBJECT_ID(N'dbo.HR_DailyAttendanceMultiPunch')
                     AND name = N'MasterWorkingHours' AND default_object_id <> 0)
BEGIN
    ALTER TABLE [dbo].[HR_DailyAttendanceMultiPunch]
        ADD CONSTRAINT [DF_HR_DailyAttendanceMultiPunch_MasterWorkingHours] DEFAULT ((0)) FOR [MasterWorkingHours];
    PRINT '[3d] ADDED DF_HR_DailyAttendanceMultiPunch_MasterWorkingHours DEFAULT ((0)).';
END
GO

IF OBJECT_ID(N'dbo.HR_DailyAttendanceMultiPunch', N'U') IS NOT NULL
   AND COL_LENGTH(N'dbo.HR_DailyAttendanceMultiPunch', N'WorkingHours') IS NOT NULL
   AND NOT EXISTS (SELECT 1 FROM sys.default_constraints
                   WHERE parent_object_id = OBJECT_ID(N'dbo.HR_DailyAttendanceMultiPunch')
                     AND name = N'DF_HR_DailyAttendanceMultiPunch_WorkingHours')
   AND NOT EXISTS (SELECT 1 FROM sys.columns
                   WHERE object_id = OBJECT_ID(N'dbo.HR_DailyAttendanceMultiPunch')
                     AND name = N'WorkingHours' AND default_object_id <> 0)
BEGIN
    ALTER TABLE [dbo].[HR_DailyAttendanceMultiPunch]
        ADD CONSTRAINT [DF_HR_DailyAttendanceMultiPunch_WorkingHours] DEFAULT ((0)) FOR [WorkingHours];
    PRINT '[3e] ADDED DF_HR_DailyAttendanceMultiPunch_WorkingHours DEFAULT ((0)).';
END
GO

IF OBJECT_ID(N'dbo.HR_DailyAttendanceMultiPunch', N'U') IS NOT NULL
   AND COL_LENGTH(N'dbo.HR_DailyAttendanceMultiPunch', N'FormID') IS NOT NULL
   AND NOT EXISTS (SELECT 1 FROM sys.default_constraints
                   WHERE parent_object_id = OBJECT_ID(N'dbo.HR_DailyAttendanceMultiPunch')
                     AND name = N'DF_HR_DailyAttendanceMultiPunch_FormID')
   AND NOT EXISTS (SELECT 1 FROM sys.columns
                   WHERE object_id = OBJECT_ID(N'dbo.HR_DailyAttendanceMultiPunch')
                     AND name = N'FormID' AND default_object_id <> 0)
BEGIN
    ALTER TABLE [dbo].[HR_DailyAttendanceMultiPunch]
        ADD CONSTRAINT [DF_HR_DailyAttendanceMultiPunch_FormID] DEFAULT ((1026)) FOR [FormID];
    PRINT '[3f] ADDED DF_HR_DailyAttendanceMultiPunch_FormID DEFAULT ((1026)).';
END
GO


/* ============================================================================
   SECTION 4 -- P2 SAFETY NET: COLUMNS THE APP WRITES WITHOUT A SCHEMA PROBE
   ----------------------------------------------------------------------------
   HR_LeaveApplication.ApprovedBy / ApprovedDate / ApproverComment
     The multi-level approval endpoint POST /api/leave/approvals/:authId/decide
     (server.js:1513 approve, :1544 reject) writes all three UNCONDITIONALLY,
     INSIDE A TRANSACTION. If any is missing the whole approval rolls back.
     (The separate flat admin endpoint at :1756 does probe sys.columns and
     degrades gracefully -- but the transactional path does not.)

   HR_ReportLayout.Description / Category
     GET /api/admin/reports probes sys.columns and degrades gracefully, so these
     are optional -- added only so the full reports list works.

   These should already exist (create_MobileApplication_db.sql adds them at its
   "alignment columns" step). The COL_LENGTH guards make this a no-op when they
   do, and a repair when the live DB predates that step. All are NULLable, so
   no backfill and no DEFAULT is required -- remedy (2).
   ============================================================================ */

IF OBJECT_ID(N'dbo.HR_LeaveApplication', N'U') IS NOT NULL
   AND COL_LENGTH(N'dbo.HR_LeaveApplication', N'ApprovedBy') IS NULL
BEGIN
    ALTER TABLE [dbo].[HR_LeaveApplication] ADD [ApprovedBy] [bigint] NULL;
    PRINT '[4a] ADDED HR_LeaveApplication.ApprovedBy (bigint NULL).';
END
GO

IF OBJECT_ID(N'dbo.HR_LeaveApplication', N'U') IS NOT NULL
   AND COL_LENGTH(N'dbo.HR_LeaveApplication', N'ApprovedDate') IS NULL
BEGIN
    ALTER TABLE [dbo].[HR_LeaveApplication] ADD [ApprovedDate] [datetime] NULL;
    PRINT '[4b] ADDED HR_LeaveApplication.ApprovedDate (datetime NULL).';
END
GO

IF OBJECT_ID(N'dbo.HR_LeaveApplication', N'U') IS NOT NULL
   AND COL_LENGTH(N'dbo.HR_LeaveApplication', N'ApproverComment') IS NULL
BEGIN
    ALTER TABLE [dbo].[HR_LeaveApplication] ADD [ApproverComment] [nvarchar](500) NULL;
    PRINT '[4c] ADDED HR_LeaveApplication.ApproverComment (nvarchar(500) NULL).';
END
GO

IF OBJECT_ID(N'dbo.HR_ReportLayout', N'U') IS NOT NULL
   AND COL_LENGTH(N'dbo.HR_ReportLayout', N'Description') IS NULL
BEGIN
    ALTER TABLE [dbo].[HR_ReportLayout] ADD [Description] [nvarchar](300) NULL;
    PRINT '[4d] ADDED HR_ReportLayout.Description (nvarchar(300) NULL).';
END
GO

IF OBJECT_ID(N'dbo.HR_ReportLayout', N'U') IS NOT NULL
   AND COL_LENGTH(N'dbo.HR_ReportLayout', N'Category') IS NULL
BEGIN
    ALTER TABLE [dbo].[HR_ReportLayout] ADD [Category] [nvarchar](50) NULL;
    PRINT '[4e] ADDED HR_ReportLayout.Category (nvarchar(50) NULL).';
END
GO


/* ============================================================================
   SECTION 5 -- P3 TRUNCATION HARDENING ON MANAGER COMMENTS
   ----------------------------------------------------------------------------
   Table  : dbo.HR_AttendenceAdjustment
   Column : [ManagerComment] [nvarchar](255) NULL  -->  [nvarchar](500) NULL
   Risk   : POST /api/admin/adjustment/:id/decide (server.js:1992) binds the
            manager's comment with NO length truncation on the JS side. A
            comment over 255 characters returns HTTP 500 with
            "String or binary data would be truncated".
            This is baseline-parity (the app's original DB is also 255), so it
            is a latent bug rather than new drift -- but the widening is
            metadata-only and loss-free, and it brings this column in line with
            HR_LeaveApplication.ApproverComment nvarchar(500), which the leave
            flow already relies on for the same kind of free text.
   ============================================================================ */

IF OBJECT_ID(N'dbo.HR_AttendenceAdjustment', N'U') IS NOT NULL
   AND EXISTS (SELECT 1 FROM sys.columns
               WHERE object_id = OBJECT_ID(N'dbo.HR_AttendenceAdjustment')
                 AND name = N'ManagerComment'
                 AND max_length >= 0        /* exclude nvarchar(max) */
                 AND max_length < 1000)
BEGIN
    ALTER TABLE [dbo].[HR_AttendenceAdjustment]
        ALTER COLUMN [ManagerComment] [nvarchar](500) NULL;
    PRINT '[5] WIDENED HR_AttendenceAdjustment.ManagerComment to nvarchar(500).';
END
ELSE
BEGIN
    PRINT '[5] SKIPPED -- HR_AttendenceAdjustment.ManagerComment already nvarchar(500) or wider.';
END
GO


/* ============================================================================
   SECTION 6 -- BACKFILL OF EXISTING ROWS
   ----------------------------------------------------------------------------
   A DEFAULT constraint only affects FUTURE inserts, so any column we defaulted
   above must be checked for pre-existing NULLs.

   Analysis: every column defaulted in Sections 1 and 3 is declared NOT NULL, so
   by definition no existing row can hold NULL and there is nothing to backfill
   on a healthy database. The statements below are therefore provably no-ops
   today. They are retained -- each behind an is_nullable guard so they cost
   nothing -- purely so this script stays correct if any of those columns were
   ever relaxed to NULL by an out-of-band change before it is re-run.

   The two widenings (Sections 2 and 5) are loss-free: nvarchar(50)->nvarchar(500)
   preserves every existing value byte-for-byte. No backfill applies.
   The columns added in Section 4 are NULLable by design and must stay NULL for
   rows that were never approved. No backfill applies.

   Nothing here deletes, truncates, or overwrites a non-NULL value.
   ============================================================================ */

IF EXISTS (SELECT 1 FROM sys.columns
           WHERE object_id = OBJECT_ID(N'dbo.HR_DailyAttendanceMultiPunch')
             AND name = N'IsLocked' AND is_nullable = 1)
BEGIN
    UPDATE [dbo].[HR_DailyAttendanceMultiPunch]
       SET [IsLocked] = 0
     WHERE [IsLocked] IS NULL;
    PRINT '[6a] BACKFILLED HR_DailyAttendanceMultiPunch.IsLocked NULL -> 0.';
END
GO

IF EXISTS (SELECT 1 FROM sys.columns
           WHERE object_id = OBJECT_ID(N'dbo.HR_DailyAttendanceMultiPunch')
             AND name = N'MonthlyAttendID' AND is_nullable = 1)
BEGIN
    UPDATE [dbo].[HR_DailyAttendanceMultiPunch]
       SET [MonthlyAttendID] = 0
     WHERE [MonthlyAttendID] IS NULL;
    PRINT '[6b] BACKFILLED HR_DailyAttendanceMultiPunch.MonthlyAttendID NULL -> 0.';
END
GO

IF EXISTS (SELECT 1 FROM sys.columns
           WHERE object_id = OBJECT_ID(N'dbo.HR_DailyAttendanceMultiPunch')
             AND name = N'PayrollConfirmationID' AND is_nullable = 1)
BEGIN
    UPDATE [dbo].[HR_DailyAttendanceMultiPunch]
       SET [PayrollConfirmationID] = 0
     WHERE [PayrollConfirmationID] IS NULL;
    PRINT '[6c] BACKFILLED HR_DailyAttendanceMultiPunch.PayrollConfirmationID NULL -> 0.';
END
GO


/* ============================================================================
   SECTION 7 -- VERIFICATION
   ----------------------------------------------------------------------------
   Eyeball these two result sets after running the script.

   RESULT SET 1 expectations (all rows must read OK):
     HR_DailyAttendanceMultiPunch.IsLocked ................ default ((0))
     HR_DailyAttendanceMultiPunch.MonthlyAttendID ......... default ((0))
     HR_DailyAttendanceMultiPunch.PayrollConfirmationID ... default ((0))
     HR_DailyAttendanceMultiPunch.ActualWorkingHours ...... default ((0))
     HR_DailyAttendanceMultiPunch.MasterWorkingHours ...... default ((0))
     HR_DailyAttendanceMultiPunch.WorkingHours ............ default ((0))
     HR_DailyAttendanceMultiPunch.FormID .................. default ((1026))
     HR_LeaveApplication.LeaveReason ...................... nvarchar(500)
     HR_AttendenceAdjustment.ManagerComment ............... nvarchar(500)
     HR_LeaveApplication.ApprovedBy / ApprovedDate / ApproverComment ... present
     HR_ReportLayout.Description / Category ............... present

   RESULT SET 2 is the acid test: it lists every remaining NOT NULL column with
   no default on the tables the mobile app INSERTs into. Cross-check that list
   against what server.js actually supplies -- anything appearing there that the
   app does NOT supply is the next IsLocked-class failure.
   ============================================================================ */

PRINT '';
PRINT '=== VERIFICATION 1 : state of every column this script touches ===';
GO

SELECT
    [Table]        = OBJECT_NAME(c.object_id),
    [Column]       = c.name,
    [DataType]     = TYPE_NAME(c.user_type_id)
                     + CASE WHEN TYPE_NAME(c.user_type_id) IN ('nvarchar','nchar')
                            THEN '(' + CASE WHEN c.max_length = -1 THEN 'max'
                                            ELSE CAST(c.max_length / 2 AS varchar(10)) END + ')'
                            WHEN TYPE_NAME(c.user_type_id) IN ('varchar','char')
                            THEN '(' + CASE WHEN c.max_length = -1 THEN 'max'
                                            ELSE CAST(c.max_length AS varchar(10)) END + ')'
                            ELSE '' END,
    [Nullable]     = CASE WHEN c.is_nullable = 1 THEN 'NULL' ELSE 'NOT NULL' END,
    [DefaultName]  = ISNULL(dc.name, '(none)'),
    [DefaultValue] = ISNULL(dc.definition, '(none)'),
    [Verdict]      = CASE
        WHEN OBJECT_NAME(c.object_id) = 'HR_DailyAttendanceMultiPunch'
             AND c.is_nullable = 0 AND dc.object_id IS NULL
            THEN '*** STILL BROKEN -- NOT NULL with no default ***'
        WHEN OBJECT_NAME(c.object_id) = 'HR_LeaveApplication'
             AND c.name = 'LeaveReason' AND c.max_length <> -1 AND c.max_length < 1000
            THEN '*** STILL BROKEN -- narrower than nvarchar(500) ***'
        WHEN OBJECT_NAME(c.object_id) = 'HR_AttendenceAdjustment'
             AND c.name = 'ManagerComment' AND c.max_length <> -1 AND c.max_length < 1000
            THEN '*** STILL NARROW -- under nvarchar(500) ***'
        ELSE 'OK' END
FROM sys.columns AS c
LEFT JOIN sys.default_constraints AS dc
       ON dc.parent_object_id = c.object_id
      AND dc.parent_column_id = c.column_id
WHERE (OBJECT_NAME(c.object_id) = 'HR_DailyAttendanceMultiPunch'
       AND c.name IN ('IsLocked','MonthlyAttendID','PayrollConfirmationID',
                      'ActualWorkingHours','MasterWorkingHours','WorkingHours','FormID'))
   OR (OBJECT_NAME(c.object_id) = 'HR_LeaveApplication'
       AND c.name IN ('LeaveReason','ApprovedBy','ApprovedDate','ApproverComment'))
   OR (OBJECT_NAME(c.object_id) = 'HR_AttendenceAdjustment'
       AND c.name IN ('ManagerComment'))
   OR (OBJECT_NAME(c.object_id) = 'HR_ReportLayout'
       AND c.name IN ('Description','Category'))
ORDER BY OBJECT_NAME(c.object_id), c.column_id;
GO

PRINT '';
PRINT '=== VERIFICATION 2 : remaining NOT NULL / no-default columns on app-written tables ===';
PRINT '    (every column listed MUST be supplied by server.js on INSERT)';
GO

SELECT
    [Table]    = OBJECT_NAME(c.object_id),
    [Column]   = c.name,
    [DataType] = TYPE_NAME(c.user_type_id),
    [Note]     = 'NOT NULL, no default -- app INSERT must supply this'
FROM sys.columns AS c
LEFT JOIN sys.default_constraints AS dc
       ON dc.parent_object_id = c.object_id
      AND dc.parent_column_id = c.column_id
WHERE c.is_nullable   = 0
  AND c.is_identity   = 0
  AND c.is_computed   = 0
  AND dc.object_id IS NULL
  AND OBJECT_NAME(c.object_id) IN (
        'HR_DailyAttendanceMultiPunch',
        'HR_PunchLocations',
        'HR_PunchPhotos',
        'HR_LeaveApplication',
        'HR_AttendenceAdjustment',
        'HR_UnitGPS',
        'HR_UserUnits',
        'HR_EmployeeBranchPermissions',
        'Unit'
      )
ORDER BY OBJECT_NAME(c.object_id), c.column_id;
GO

PRINT '';
PRINT '=== fix_MobileApplication_compat.sql : finished ===';
PRINT 'Punch and leave-apply should now work with NO server.js change and NO backend restart.';
GO

/* Clear the abort latch set by SECTION 0 so the session is left clean.
   On a successful run NOEXEC was never on and this is a no-op; on an aborted
   run this is the only batch after the abort that is allowed to take effect,
   and the "finished" banner above was correctly suppressed. */
SET NOEXEC OFF;
GO
