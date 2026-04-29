-- ============================================================
-- Fix: Drop and recreate tables that already exist, skip the rest
-- Run this in SSMS after the first script partially succeeded
-- ============================================================

USE [Solution-one]
GO

-- 1. HR_UnitGPS — already created successfully, skip
IF EXISTS (SELECT * FROM sys.tables WHERE name = 'HR_UnitGPS')
    PRINT 'HR_UnitGPS already exists — skipped'
GO

-- 2. HR_UserUnits — already created successfully, skip
IF EXISTS (SELECT * FROM sys.tables WHERE name = 'HR_UserUnits')
    PRINT 'HR_UserUnits already exists — skipped'
GO

-- 3. HR_PunchLocations — exists but may have old FK constraint, drop and recreate
IF EXISTS (SELECT * FROM sys.tables WHERE name = 'HR_PunchLocations')
BEGIN
    DROP TABLE [dbo].[HR_PunchLocations]
    PRINT 'HR_PunchLocations dropped'
END
GO

CREATE TABLE [dbo].[HR_PunchLocations](
    [Id]              [bigint] IDENTITY(1,1) NOT NULL,
    [MultiPunchOid]   [bigint] NOT NULL,
    [PunchLocation1]  [nvarchar](100) NULL,
    [PunchLocation2]  [nvarchar](100) NULL,
    [PunchLocation3]  [nvarchar](100) NULL,
    [PunchLocation4]  [nvarchar](100) NULL,
    [PunchLocation5]  [nvarchar](100) NULL,
    [PunchLocation6]  [nvarchar](100) NULL,
    [PunchLocation7]  [nvarchar](100) NULL,
    [PunchLocation8]  [nvarchar](100) NULL,
    [PunchLocation9]  [nvarchar](100) NULL,
    [PunchLocation10] [nvarchar](100) NULL,
    [PunchLocation11] [nvarchar](100) NULL,
    [PunchLocation12] [nvarchar](100) NULL,
    [PunchLocation13] [nvarchar](100) NULL,
    [PunchLocation14] [nvarchar](100) NULL,
 CONSTRAINT [PK_HR_PunchLocations] PRIMARY KEY CLUSTERED
(
    [Id] ASC
) ON [PRIMARY],
 CONSTRAINT [UQ_HR_PunchLocations_MultiPunchOid] UNIQUE NONCLUSTERED
(
    [MultiPunchOid] ASC
) ON [PRIMARY],
 CONSTRAINT [FK_HR_PunchLocations_MultiPunch] FOREIGN KEY ([MultiPunchOid])
    REFERENCES [dbo].[HR_DailyAttendanceMultiPunch] ([Oid])
) ON [PRIMARY]
GO
PRINT 'HR_PunchLocations created successfully'
GO

-- 4. HR_EmployeeBranchPermissions — create if not exists
IF EXISTS (SELECT * FROM sys.tables WHERE name = 'HR_EmployeeBranchPermissions')
BEGIN
    DROP TABLE [dbo].[HR_EmployeeBranchPermissions]
    PRINT 'HR_EmployeeBranchPermissions dropped'
END
GO

CREATE TABLE [dbo].[HR_EmployeeBranchPermissions](
    [Id]                   [bigint] IDENTITY(1,1) NOT NULL,
    [UserMasterID]         [bigint] NOT NULL,
    [MainUnitMasterId]     [int] NOT NULL,
    [AllowedUnitMasterId]  [int] NOT NULL,
    [IsActive]             [bit] NOT NULL CONSTRAINT [DF_HR_EmpBranchPerm_IsActive] DEFAULT (1),
    [CreatedAt]            [datetime] NOT NULL CONSTRAINT [DF_HR_EmpBranchPerm_CreatedAt] DEFAULT (GETDATE()),
    [UpdatedAt]            [datetime] NULL,
 CONSTRAINT [PK_HR_EmployeeBranchPermissions] PRIMARY KEY CLUSTERED
(
    [Id] ASC
) ON [PRIMARY],
 CONSTRAINT [UQ_HR_EmpBranchPerm_User_Allowed] UNIQUE NONCLUSTERED
(
    [UserMasterID] ASC,
    [AllowedUnitMasterId] ASC
) ON [PRIMARY],
 CONSTRAINT [FK_HR_EmpBranchPerm_UserMaster] FOREIGN KEY ([UserMasterID])
    REFERENCES [dbo].[HR_UserMaster] ([UserMasterID])
) ON [PRIMARY]
GO
PRINT 'HR_EmployeeBranchPermissions created successfully'
GO
