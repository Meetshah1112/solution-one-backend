-- ============================================================
-- Seed salary slips + line items specifically for the 5 demo
-- employees (aarav.sharma@demo.com … vikram.singh@demo.com).
-- EmployeeMasterIDs: 327, 328, 329, 330, 331.
-- ============================================================
-- Inserts last 3 months of slips with full earnings + deductions.
-- Idempotent — re-running it does nothing once data exists.
-- ============================================================

USE [Solution-one]
GO

DECLARE @demoIds TABLE (EmployeeMasterID BIGINT)
INSERT INTO @demoIds VALUES (327), (328), (329), (330), (331)

-- For each of the last 3 months, insert a slip per demo employee if missing
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
        26, 26,
        25000, 45000, 55000, 0,
        42500, 42500,
        0,
        ISNULL((SELECT TOP 1 CategoryMasterID FROM HR_EmployeeMaster WHERE EmployeeMasterID = d.EmployeeMasterID), 1),
        ISNULL((SELECT TOP 1 BranchMasterID   FROM HR_EmployeeMaster WHERE EmployeeMasterID = d.EmployeeMasterID), 1),
        1,
        1, GETDATE(), 'SETUP'
    FROM @demoIds d
    WHERE NOT EXISTS (
        SELECT 1 FROM [dbo].[HR_PayrollSalaryConfirmation] s
        WHERE s.EmployeeMasterID = d.EmployeeMasterID
          AND s.PayrollMonth = @month
          AND s.PayrollYear  = @year
    )

    SET @offset = @offset + 1
END
GO

-- Add 7 line items to every demo slip that doesn't have any yet
;WITH SlipsNeedingItems AS (
    SELECT s.Oid AS PayrollConfirmationID, s.EmployeeMasterID,
           s.CategoryMasterID, s.BranchMasterID, s.CompanyMasterID
    FROM [dbo].[HR_PayrollSalaryConfirmation] s
    WHERE s.EmployeeMasterID IN (327, 328, 329, 330, 331)
      AND NOT EXISTS (
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
LEFT JOIN [dbo].[HR_SalaryHeadMaster] h ON h.Code = x.AccountHeadCode
GO

SELECT 'Demo slips' AS Tbl,
       COUNT(*) AS RowCount
FROM [dbo].[HR_PayrollSalaryConfirmation]
WHERE EmployeeMasterID IN (327, 328, 329, 330, 331)
UNION ALL
SELECT 'Demo line items',
       COUNT(*)
FROM [dbo].[HR_PayrollSalaryConfirmationDetails]
WHERE EmployeeMasterID IN (327, 328, 329, 330, 331)
GO
