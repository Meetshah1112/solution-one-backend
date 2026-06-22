-- ============================================================
-- Seed demo attendance punches for the 5 demo employees
-- (327–331) so the Attendance Report has data to show.
--
-- Seeds all weekdays (Mon–Fri) of:
--   • the previous calendar month (full)
--   • the current calendar month up to today
--
-- In = 09:00, Out = 18:00. Idempotent: skips dates already present.
-- ============================================================

USE [Solution-one]
GO

SET NOCOUNT ON

DECLARE @demo TABLE (EmployeeMasterID BIGINT, BranchMasterID BIGINT, CategoryMasterID BIGINT)
INSERT INTO @demo (EmployeeMasterID, BranchMasterID, CategoryMasterID)
SELECT EmployeeMasterID,
       ISNULL(BranchMasterID, 1),
       ISNULL(CategoryMasterID, 1)
FROM HR_EmployeeMaster
WHERE EmployeeMasterID IN (327, 328, 329, 330, 331)

-- Range: first day of previous month → today
DECLARE @start DATE = DATEADD(MONTH, -1, DATEFROMPARTS(YEAR(GETDATE()), MONTH(GETDATE()), 1))
DECLARE @today DATE = CAST(GETDATE() AS DATE)
DECLARE @d DATE = @start

WHILE @d <= @today
BEGIN
    -- Skip weekends (SQL Server: 1=Sun … 7=Sat with default DATEFIRST)
    IF DATEPART(WEEKDAY, @d) NOT IN (1, 7)
    BEGIN
        INSERT INTO HR_DailyAttendanceMultiPunch
            (EmployeeMasterID, AttendYear, AttendMonth, AttendDate, AttendanceStatus,
             PunchDateTime1, PunchDateTime2,
             ActualWorkingHours, MasterWorkingHours, WorkingHours,
             ShiftMasterID, MonthlyAttendID, PayrollConfirmationID,
             CategoryMasterID, BranchMasterID, CompanyMasterID,
             YearID, FormID,
             EntryUserMasterID, EntryUserDateTime, SystemName)
        SELECT
            dm.EmployeeMasterID, YEAR(@d), MONTH(@d), @d, 'P',
            DATEADD(HOUR, 9,  CAST(@d AS DATETIME)),   -- 09:00 in
            DATEADD(HOUR, 18, CAST(@d AS DATETIME)),   -- 18:00 out
            9.00, 8.00, 8.00,
            2, 0, 0,
            dm.CategoryMasterID, dm.BranchMasterID, 1,
            2026, 1008,
            1, GETDATE(), 'SETUP'
        FROM @demo dm
        WHERE NOT EXISTS (
            SELECT 1 FROM HR_DailyAttendanceMultiPunch x
            WHERE x.EmployeeMasterID = dm.EmployeeMasterID
              AND CAST(x.AttendDate AS DATE) = @d
        )
    END
    SET @d = DATEADD(DAY, 1, @d)
END

PRINT 'Demo attendance seeded for previous + current month (weekdays).'

-- Quick verification
SELECT EmployeeMasterID, COUNT(*) AS PunchDays,
       MIN(CONVERT(varchar, AttendDate, 23)) AS FirstDay,
       MAX(CONVERT(varchar, AttendDate, 23)) AS LastDay
FROM HR_DailyAttendanceMultiPunch
WHERE EmployeeMasterID IN (327, 328, 329, 330, 331)
GROUP BY EmployeeMasterID
GO
