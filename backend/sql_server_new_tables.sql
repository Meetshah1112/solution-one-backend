-- ============================================================
-- New Tables for Solution-One Attendance App
-- Database: [Solution-one] (SQL Server)
-- These tables ADD to the existing DB — no existing tables modified
-- ============================================================
-- NOTE: Unit table PK is composite (CompanyCode, code), not UnitMasterId.
-- UnitMasterId is an IDENTITY column but not a PK/unique key, so we
-- cannot create FK constraints referencing it. The relationship is
-- enforced at the application level instead.
-- ============================================================

USE [Solution-one]
GO

-- ============================================================
-- 1. HR_UnitGPS
-- Extends Unit table with GPS coordinates and geofence flag
-- Logical link: UnitMasterId → Unit.UnitMasterId (enforced in app)
-- ============================================================

CREATE TABLE [dbo].[HR_UnitGPS](
    [Id]            [bigint] IDENTITY(1,1) NOT NULL,
    [UnitMasterId]  [int] NOT NULL,
    [Latitude]      [decimal](10,7) NULL,
    [Longitude]     [decimal](10,7) NULL,
    [IsGeofenced]   [bit] NOT NULL CONSTRAINT [DF_HR_UnitGPS_IsGeofenced] DEFAULT (1),
    [CreatedAt]     [datetime] NOT NULL CONSTRAINT [DF_HR_UnitGPS_CreatedAt] DEFAULT (GETDATE()),
    [UpdatedAt]     [datetime] NULL,
 CONSTRAINT [PK_HR_UnitGPS] PRIMARY KEY CLUSTERED
(
    [Id] ASC
) ON [PRIMARY],
 CONSTRAINT [UQ_HR_UnitGPS_UnitMasterId] UNIQUE NONCLUSTERED
(
    [UnitMasterId] ASC
) ON [PRIMARY]
) ON [PRIMARY]
GO


-- ============================================================
-- 2. HR_UserUnits
-- Many-to-many mapping: which users can punch at which units
-- Logical link: UnitMasterId → Unit.UnitMasterId (enforced in app)
-- FK: UserMasterID → HR_UserMaster.UserMasterID
-- ============================================================

CREATE TABLE [dbo].[HR_UserUnits](
    [Id]            [bigint] IDENTITY(1,1) NOT NULL,
    [UserMasterID]  [bigint] NOT NULL,
    [UnitMasterId]  [int] NOT NULL,
    [CreatedAt]     [datetime] NOT NULL CONSTRAINT [DF_HR_UserUnits_CreatedAt] DEFAULT (GETDATE()),
 CONSTRAINT [PK_HR_UserUnits] PRIMARY KEY CLUSTERED
(
    [Id] ASC
) ON [PRIMARY],
 CONSTRAINT [UQ_HR_UserUnits_User_Unit] UNIQUE NONCLUSTERED
(
    [UserMasterID] ASC,
    [UnitMasterId] ASC
) ON [PRIMARY],
 CONSTRAINT [FK_HR_UserUnits_UserMaster] FOREIGN KEY ([UserMasterID])
    REFERENCES [dbo].[HR_UserMaster] ([UserMasterID])
) ON [PRIMARY]
GO


-- ============================================================
-- 3. HR_PunchLocations
-- Stores GPS coordinates for each punch (1-14) per attendance record
-- FK: MultiPunchOid → HR_DailyAttendanceMultiPunch.Oid (1:1)
-- PunchLocationX pairs with PunchDateTimeX by position number
-- ============================================================

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


-- ============================================================
-- 4. HR_EmployeeBranchPermissions
-- Granular per-employee branch access control
-- FK: UserMasterID → HR_UserMaster.UserMasterID
-- Logical link: MainUnitMasterId, AllowedUnitMasterId → Unit.UnitMasterId
-- ============================================================

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
