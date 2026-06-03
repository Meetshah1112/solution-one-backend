-- ============================================================
-- Fix-up: seed HR_SalaryHeadMaster + line items
-- The previous alignment script used wrong column names — this
-- corrects them and seeds any data still missing.
-- ============================================================

USE [Solution-one]
GO

SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO

-- ============================================================
-- 1. Seed HR_SalaryHeadMaster (if empty)
--    Live schema: Code, Name, Description, Status (bit),
--                 AllowInFormula, AllowInPrint, FormID, ...
-- ============================================================
PRINT '─── Seed HR_SalaryHeadMaster ───'
GO

IF NOT EXISTS (SELECT 1 FROM [dbo].[HR_SalaryHeadMaster])
BEGIN
    INSERT INTO [dbo].[HR_SalaryHeadMaster]
        (Code, Name, Description, Status, AllowInFormula, AllowInPrint,
         FormID, CompanyMasterID, EntryUserMasterID, EntryUserDateTime, SystemName)
    VALUES
        ('BASIC', 'Basic Salary',         'Basic component',    1, 1, 1, 1, 1, 1, GETDATE(), 'SETUP'),
        ('HRA',   'House Rent Allowance', 'HRA',                1, 1, 1, 1, 1, 1, GETDATE(), 'SETUP'),
        ('CONV',  'Conveyance Allowance', 'Conveyance',         1, 1, 1, 1, 1, 1, GETDATE(), 'SETUP'),
        ('MED',   'Medical Allowance',    'Medical',            1, 1, 1, 1, 1, 1, GETDATE(), 'SETUP'),
        ('SPL',   'Special Allowance',    'Other allowance',    1, 1, 1, 1, 1, 1, GETDATE(), 'SETUP'),
        ('PF',    'PF (Employee)',        'Employee provident', 1, 1, 1, 1, 1, 1, GETDATE(), 'SETUP'),
        ('PT',    'Professional Tax',     'PT',                  1, 1, 1, 1, 1, 1, GETDATE(), 'SETUP'),
        ('TDS',   'Income Tax (TDS)',     'TDS deduction',      1, 1, 1, 1, 1, 1, GETDATE(), 'SETUP'),
        ('ESI',   'ESI (Employee)',       'ESI deduction',      1, 1, 1, 1, 1, 1, GETDATE(), 'SETUP')

    PRINT 'Seeded HR_SalaryHeadMaster (9 rows)'
END
ELSE
    PRINT 'HR_SalaryHeadMaster already has data — skipped'
GO

-- ============================================================
-- 2. Seed HR_PayrollSalaryConfirmationDetails for slips without items
--    Joins HR_SalaryHeadMaster.Code = x.AccountHeadCode (correct column)
-- ============================================================
PRINT '─── Seed HR_PayrollSalaryConfirmationDetails ───'
GO

;WITH SlipsNeedingItems AS (
    SELECT s.Oid AS PayrollConfirmationID, s.EmployeeMasterID,
           s.CategoryMasterID, s.BranchMasterID, s.CompanyMasterID
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
LEFT JOIN [dbo].[HR_SalaryHeadMaster] h ON h.Code = x.AccountHeadCode
GO

PRINT '────────────────────────────────────────────────────'
PRINT 'Fix-up complete. Verify:'
PRINT '────────────────────────────────────────────────────'
GO

SELECT 'HR_SalaryHeadMaster' AS Tbl, COUNT(*) AS Rows FROM [dbo].[HR_SalaryHeadMaster]
UNION ALL
SELECT 'HR_PayrollSalaryConfirmation',      COUNT(*) FROM [dbo].[HR_PayrollSalaryConfirmation]
UNION ALL
SELECT 'HR_PayrollSalaryConfirmationDetails', COUNT(*) FROM [dbo].[HR_PayrollSalaryConfirmationDetails]
UNION ALL
SELECT 'HR_LeaveMaster',                     COUNT(*) FROM [dbo].[HR_LeaveMaster]
UNION ALL
SELECT 'HR_ReportLayout',                    COUNT(*) FROM [dbo].[HR_ReportLayout]
GO
