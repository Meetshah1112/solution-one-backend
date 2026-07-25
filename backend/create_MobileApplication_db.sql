/* ============================================================================
   create_MobileApplication_db.sql
   ----------------------------------------------------------------------------
   PURPOSE
     Single, idempotent, production-quality bootstrap for the [MobileApplication]
     database used by the Solution One ESS mobile app (Expo RN frontend +
     Node/Express backend in backend/server.js).

   WHAT THIS SCRIPT CONTAINS
     1. The 24 CANONICAL cryogas ("HR_CryoGas") core tables, reproduced
        VERBATIM from the live schema. These are the untouched "default"
        structures the app is written against. Do NOT edit their column
        shapes here — the app depends on the cryogas casing/types exactly
        (e.g. HR_PayrollSalaryConfirmationDetails.[Sr.No.]/[Add/Deduct],
        the lowercase Company.companymasterid / Unit.name, and the
        HR_LeaveApplication audit columns ReceiverReadDate/FASYear/YearID/
        SystemName). Keeping them canonical is what makes the app correct on
        a live DB.

     2. The 5 ADDITIVE mobile companion tables (Section D), used VERBATIM:
          HR_UnitGPS, HR_UserUnits, HR_EmployeeBranchPermissions,
          HR_PunchLocations, HR_PunchPhotos
        These are net-new. They are layered ON TOP of cryogas and are never
        merged into the core tables.

     3. Foreign keys — only among tables created in THIS script (including the
        HR_EmployeeMaster.ReportingPersonID self-reference that drives the
        leave approval chain, and the companion-table FKs).

     4. Helpful nonclustered indexes for the app's hot lookups.

     5. Stored procedures the app relies on (version-safe DROP + CREATE).

     6. A GUARDED synthetic demo-seed section (inserts only when empty).

   ⚠ DESTRUCTIVE REBUILD
     Section 0 DROPS the [MobileApplication] database if it exists and creates a
     fresh one, so EVERY run wipes all data in [MobileApplication] and rebuilds
     from zero. The per-object guards below are retained so the body can also be
     run piecemeal, but as a whole this is a clean-slate rebuild. Do NOT point
     it at any database other than [MobileApplication].

   NOTES / ASSUMPTIONS
     - cryogas has NO foreign keys among these 24 tables; all real cryogas FKs
       point at tables outside this set. The only intra-set FK we add is the
       HR_EmployeeMaster self-reference plus the 5 companion FKs.
     - Unit's canonical PK is composite (CompanyCode, code); UnitMasterId is
       an IDENTITY column but is NOT unique-constrained in cryogas. The app and
       the companion tables treat UnitMasterId as the logical unit key, so this
       script adds a UNIQUE index on Unit(UnitMasterId) purely to enable the
       companion FKs. That index is additive and does not alter any column.
     - Several bundled stored procedures (HR_SalarySlip, HR_SalarySlip_SingleSP,
       HR_GetDailyPunch, csp_Payroll_GetEmployeeLeaveBalance) reference tables
       that live in the cryogas base but are OUT OF SCOPE for this script
       (HR_EmployeeBankDetails, HR_CategoryMaster, HR_ShiftMaster,
       HR_EmployeeWiseHoliday, HR_CompOffApplications, dbo.SPLIT). CREATE OR
       ALTER uses deferred name resolution, so the procedures compile fine;
       they simply require those base objects to exist at EXECUTION time.
     - No real PII: all seed names/emails/passwords are synthetic.
   ============================================================================ */

SET ANSI_NULLS ON;
GO
SET QUOTED_IDENTIFIER ON;
GO

/* ============================================================================
   0. DATABASE  (DESTRUCTIVE: drops [MobileApplication] if present, recreates it)
   ----------------------------------------------------------------------------
   WARNING: every run WIPES the entire [MobileApplication] database and rebuilds
   it from scratch. SINGLE_USER WITH ROLLBACK IMMEDIATE force-closes any open
   connections (e.g. a running backend) so the DROP cannot be blocked.
   Never point this at any database other than [MobileApplication].
   ============================================================================ */
USE [master];
GO
IF DB_ID(N'MobileApplication') IS NOT NULL
BEGIN
    ALTER DATABASE [MobileApplication] SET SINGLE_USER WITH ROLLBACK IMMEDIATE;
    DROP DATABASE [MobileApplication];
END
GO
CREATE DATABASE [MobileApplication];
GO

USE [MobileApplication];
GO

/* ============================================================================
   1. CANONICAL CRYOGAS CORE TABLES (verbatim; FK-dependency order)
      Parents first, children after. No column shapes are modified.
   ============================================================================ */

/* ---- Company (root of company/unit hierarchy) ---- */
IF OBJECT_ID(N'dbo.Company', N'U') IS NULL
BEGIN
    CREATE TABLE [dbo].[Company](
        [code] [nvarchar](10) NOT NULL,
        [name] [nvarchar](100) NOT NULL,
        [address] [nvarchar](255) NOT NULL,
        [city] [nvarchar](30) NOT NULL,
        [State] [nvarchar](30) NOT NULL,
        [Country] [nvarchar](30) NOT NULL,
        [pincode] [nvarchar](30) NULL,
        [phone] [nvarchar](50) NULL,
        [fax] [nvarchar](50) NULL,
        [email] [nvarchar](80) NULL,
        [website] [nvarchar](80) NULL,
        [contactperson] [nvarchar](100) NULL,
        [mobile] [nvarchar](20) NULL,
        [Currency] [nvarchar](20) NULL,
        [CST_NO] [nvarchar](100) NULL,
        [TIN_NO] [nvarchar](100) NULL,
        [PAN_NO] [nvarchar](100) NULL,
        [SERVICETAX_NO] [nvarchar](100) NULL,
        [IEC_NO] [nvarchar](100) NULL,
        [GST_NO] [nvarchar](100) NULL,
        [ECC_NO] [nvarchar](100) NULL,
        [Commissionerate] [nvarchar](100) NULL,
        [Division] [nvarchar](100) NULL,
        [Range] [nvarchar](100) NULL,
        [Inspector] [nvarchar](100) NULL,
        [Superintendent] [nvarchar](100) NULL,
        [CreUsr] [varchar](50) NULL,
        [CreUsrDt] [datetime] NULL,
        [CIN] [nvarchar](50) NOT NULL DEFAULT (''),
        [GSTRegDt] [datetime] NOT NULL DEFAULT ('1900/01/01'),
        [GSTStatus] [nvarchar](50) NOT NULL DEFAULT ('Unregistered'),
        [ARNNo] [nvarchar](25) NOT NULL DEFAULT (''),
        [companymasterid] [int] IDENTITY(1,1) NOT NULL,
        [MSME] [nvarchar](50) NOT NULL DEFAULT (''),
        [CompanyLogo] [varbinary](max) NULL,
        [FormID] [int] NOT NULL CONSTRAINT [DF_Company_FormID] DEFAULT ((1000)),
        [Language] [nvarchar](50) NOT NULL CONSTRAINT [DF_Company_Language] DEFAULT (N'English'),
        [TimeZone] [bigint] NOT NULL CONSTRAINT [DF_Company_TimeZone] DEFAULT ((70)),
     CONSTRAINT [PK_Company] PRIMARY KEY CLUSTERED
    (
        [code] ASC
    )
    );
END
GO

/* ---- Unit (child of Company) ---- */
IF OBJECT_ID(N'dbo.Unit', N'U') IS NULL
BEGIN
    CREATE TABLE [dbo].[Unit](
        [CompanyCode] [nvarchar](10) NOT NULL,
        [code] [nvarchar](10) NOT NULL,
        [name] [nvarchar](100) NOT NULL,
        [address] [nvarchar](255) NOT NULL,
        [city] [nvarchar](30) NOT NULL,
        [State] [nvarchar](30) NOT NULL,
        [Country] [nvarchar](30) NOT NULL,
        [pincode] [nvarchar](30) NULL,
        [phone] [nvarchar](50) NULL,
        [fax] [nvarchar](50) NULL,
        [email] [nvarchar](80) NULL,
        [website] [nvarchar](80) NULL,
        [contactperson] [nvarchar](100) NULL,
        [mobile] [nvarchar](20) NULL,
        [CST_NO] [nvarchar](100) NULL,
        [TIN_NO] [nvarchar](100) NULL,
        [PAN_NO] [nvarchar](100) NULL,
        [SERVICETAX_NO] [nvarchar](100) NULL,
        [IEC_NO] [nvarchar](100) NULL,
        [GST_NO] [nvarchar](100) NULL,
        [ECC_NO] [nvarchar](100) NULL,
        [Commissionerate] [nvarchar](100) NULL,
        [Division] [nvarchar](100) NULL,
        [Range] [nvarchar](100) NULL,
        [Inspector] [nvarchar](100) NULL,
        [Superintendent] [nvarchar](100) NULL,
        [CreUsr] [varchar](50) NULL,
        [CreUsrDt] [datetime] NULL,
        [GSTRegDt] [datetime] NOT NULL DEFAULT ('1900/01/01'),
        [GSTStatus] [nvarchar](50) NOT NULL DEFAULT ('Unregistered'),
        [ARNNo] [nvarchar](25) NOT NULL DEFAULT (''),
        [UnitMasterId] [int] IDENTITY(1,1) NOT NULL,
        [CompanyMasterId] [int] NOT NULL DEFAULT ((1)),
     CONSTRAINT [PK_Unit] PRIMARY KEY CLUSTERED
    (
        [CompanyCode] ASC,
        [code] ASC
    )
    );
END
GO

/* ---- HR_DepartmentMaster ---- */
IF OBJECT_ID(N'dbo.HR_DepartmentMaster', N'U') IS NULL
BEGIN
    CREATE TABLE [dbo].[HR_DepartmentMaster](
        [DepartmentMasterID] [bigint] IDENTITY(1,1) NOT NULL,
        [DepartmentCode] [nvarchar](10) NOT NULL,
        [DepartmentName] [nvarchar](50) NOT NULL,
        [Description] [nvarchar](255) NULL,
        [Status] [bit] NOT NULL CONSTRAINT [DF_HR_DepartmentMaster_Status] DEFAULT ((1)),
        [CompanyMasterID] [bigint] NOT NULL,
        [UnitMasterID] [bigint] NOT NULL,
        [FormID] [bigint] NOT NULL CONSTRAINT [DF_HR_DepartmentMaster_FormID] DEFAULT ((1002)),
        [EntryMasterId] [bigint] NOT NULL,
        [EntryDateTime] [smalldatetime] NOT NULL,
        [EditMasterID] [bigint] NULL,
        [EditDateTime] [smalldatetime] NULL,
        [SystemName] [nvarchar](50) NOT NULL,
     CONSTRAINT [PK_DepartmentMaster] PRIMARY KEY CLUSTERED
    (
        [DepartmentMasterID] ASC
    )
    );
END
GO

/* ---- HR_DesignationMaster ---- */
IF OBJECT_ID(N'dbo.HR_DesignationMaster', N'U') IS NULL
BEGIN
    CREATE TABLE [dbo].[HR_DesignationMaster](
        [DesignationMasterID] [bigint] IDENTITY(1,1) NOT NULL,
        [DesignationCode] [nvarchar](10) NOT NULL,
        [DesignationName] [nvarchar](255) NOT NULL,
        [Description] [nvarchar](255) NULL,
        [Status] [bit] NOT NULL CONSTRAINT [DF_HR_DesignationMaster_Status] DEFAULT ((1)),
        [CompanyMasterID] [bigint] NOT NULL,
        [UnitMasterID] [bigint] NOT NULL,
        [FormID] [bigint] NOT NULL CONSTRAINT [DF_HR_DesignationMaster_FormID] DEFAULT ((1003)),
        [EntryMasterId] [bigint] NOT NULL,
        [EntryDateTime] [smalldatetime] NOT NULL,
        [EditMasterID] [bigint] NULL,
        [EditDateTime] [smalldatetime] NULL,
        [SystemName] [nvarchar](50) NOT NULL,
     CONSTRAINT [PK_DesignationMaster] PRIMARY KEY CLUSTERED
    (
        [DesignationMasterID] ASC
    )
    );
END
GO

/* ---- HR_EmployeeMaster (self-referencing ReportingPersonID) ---- */
IF OBJECT_ID(N'dbo.HR_EmployeeMaster', N'U') IS NULL
BEGIN
    CREATE TABLE [dbo].[HR_EmployeeMaster](
        [EmployeeMasterID] [bigint] IDENTITY(1,1) NOT NULL,
        [Code] [nvarchar](15) NOT NULL,
        [Location] [nvarchar](50) NULL,
        [FirstName] [nvarchar](50) NOT NULL,
        [LastName] [nvarchar](50) NOT NULL,
        [FatherName] [nvarchar](50) NOT NULL,
        [Photo] [image] NULL,
        [Address] [nvarchar](255) NULL,
        [Gender] [nvarchar](10) NULL,
        [DateOfJoining] [smalldatetime] NOT NULL,
        [DateOfBirth] [smalldatetime] NOT NULL,
        [DateOfLeft] [smalldatetime] NULL,
        [DateOfExpire] [smalldatetime] NULL,
        [ResignDate] [smalldatetime] NULL,
        [FullandFinalDate] [smalldatetime] NULL,
        [WeeklyOffDay] [nvarchar](100) NOT NULL,
        [MobileNo] [numeric](18, 0) NULL,
        [AadharCardNo] [nvarchar](max) NULL,
        [VoterID] [nvarchar](max) NULL,
        [PFNo] [nvarchar](max) NULL,
        [ESICNo] [nvarchar](max) NULL,
        [UAN] [nvarchar](max) NULL,
        [PANNo] [nvarchar](max) NULL,
        [WorkingHours] [numeric](18, 2) NOT NULL CONSTRAINT [DF_HR_EmployeeMaster_WorkingHours] DEFAULT ((0)),
        [SalaryCalculation] [nvarchar](50) NOT NULL,
        [MinimumOT] [numeric](18, 2) NULL CONSTRAINT [DF_HR_EmployeeMaster_MinimumOT] DEFAULT ((0)),
        [BloodGroup] [nvarchar](max) NULL,
        [JobType] [nvarchar](10) NOT NULL,
        [JobStatus] [nvarchar](10) NOT NULL,
        [IsHRAdmin] [bit] NULL CONSTRAINT [DF_HR_EmployeeMaster_IsHRAdmin] DEFAULT ((0)),
        [Status] [bit] NOT NULL CONSTRAINT [DF_HR_EmployeeMaster_Status] DEFAULT ((1)),
        [SIMAllocation] [bit] NULL CONSTRAINT [DF_HR_EmployeeMaster_SIMAllocation] DEFAULT ((0)),
        [MobileAllocation] [bit] NULL CONSTRAINT [DF_HR_EmployeeMaster_MobileAllocation] DEFAULT ((0)),
        [SmartPhone] [bit] NULL CONSTRAINT [DF_HR_EmployeeMaster_SmartPhone] DEFAULT ((0)),
        [CompensatoryOff] [bit] NULL CONSTRAINT [DF_HR_EmployeeMaster_CompensatoryOff_1] DEFAULT ((0)),
        [OverTime] [bit] NULL CONSTRAINT [DF_HR_EmployeeMaster_OverTime] DEFAULT ((0)),
        [WeekOffIn] [bit] NULL CONSTRAINT [DF__HR_Employ__WeekO__3CBA6F14] DEFAULT ((0)),
        [ESICStatus] [bit] NULL CONSTRAINT [DF_HR_EmployeeMaster_ESICStatus] DEFAULT ((0)),
        [PFStatus] [bit] NULL CONSTRAINT [DF_HR_EmployeeMaster_PFStatus] DEFAULT ((1)),
        [MinWagesAmount] [numeric](18, 2) NULL CONSTRAINT [DF_HR_EmployeeMaster_MinWagesAmount] DEFAULT ((0)),
        [MachineCode] [nvarchar](50) NULL,
        [Currency] [nvarchar](10) NULL,
        [ReportingPersonID] [bigint] NULL,
        [UserMasterID] [bigint] NULL,
        [DepartmentMasterID] [bigint] NOT NULL,
        [DesignationMasterID] [bigint] NOT NULL,
        [ShiftMasterID] [bigint] NOT NULL,
        [CategoryMasterID] [bigint] NOT NULL,
        [BranchMasterID] [bigint] NOT NULL,
        [CompanyMasterID] [bigint] NOT NULL CONSTRAINT [DF_HR_EmployeeMaster_CompanyMasterID] DEFAULT ((1)),
        [FormID] [bigint] NOT NULL CONSTRAINT [DF_HR_EmployeeMaster_FormID] DEFAULT ((1008)),
        [EntryUserMasterID] [bigint] NOT NULL,
        [EntryUserDateTime] [smalldatetime] NOT NULL,
        [EditUserMasterID] [int] NULL,
        [EditUserDateTime] [smalldatetime] NULL,
        [SystemName] [nvarchar](20) NOT NULL,
        [NoticePeriod] [nvarchar](250) NULL DEFAULT (N'60 Days'),
        [Email] [nvarchar](250) NULL,
        [IsTUICOMember] [bit] NULL CONSTRAINT [DF_HR_EmployeeMaster_IsTUICOMember] DEFAULT ((0)),
        [PermanentAddress] [nvarchar](500) NULL,
        [EmergencyContactNo] [nvarchar](20) NULL,
        [MaritalStatus] [nvarchar](20) NULL,
        [AadharName] [nvarchar](200) NULL,
        [PANName] [nvarchar](200) NULL,
        [LeaveApproverUserMasterID] [bigint] NULL,
        [AllowLeaveInNoticePeriod] [bit] NOT NULL CONSTRAINT [DF_HR_EmployeeMaster_AllowLeaveInNoticePeriod] DEFAULT ((0)),
        [PayrollCode] [nvarchar](15) NULL,
        [Grade] [nvarchar](max) NULL,
        [NIDANO] [nvarchar](max) NULL,
        [NSSFNo] [nvarchar](max) NULL,
        [TIN] [nvarchar](max) NULL,
        [WCFNO] [nvarchar](max) NULL,
        [PRNO] [nvarchar](max) NULL,
        [TUICOContribution] [decimal](18, 2) NULL,
        [PassportNumber] [nvarchar](50) NULL,
        [WorkPermitNo] [nvarchar](50) NULL,
        [WorkPermitExpiryDate] [datetime] NULL,
        [WorkPermit] [nvarchar](10) NULL,
     CONSTRAINT [PK_EmployeeMaster] PRIMARY KEY CLUSTERED
    (
        [EmployeeMasterID] ASC
    )
    );
END
GO

/* ---- HR_UserMaster ---- */
IF OBJECT_ID(N'dbo.HR_UserMaster', N'U') IS NULL
BEGIN
    CREATE TABLE [dbo].[HR_UserMaster](
        [UserMasterID] [bigint] IDENTITY(1,1) NOT NULL,
        [Code] [nvarchar](150) NOT NULL,
        [UserName] [nvarchar](150) NOT NULL,
        [Email] [nvarchar](100) NULL,
        [Mobile] [nvarchar](50) NULL,
        [PasswordHash] [nvarchar](255) NULL,
        [ProfileImage] [image] NULL,
        [Role] [nvarchar](50) NULL,
        [EmployeeMasterID] [bigint] NULL,
        [CreatedBy] [bigint] NOT NULL,
        [CreatedDt] [datetime] NOT NULL,
        [EditUserMasterID] [bigint] NULL,
        [EditUserDateTime] [smalldatetime] NULL,
        [SystemName] [nvarchar](20) NOT NULL,
        [Status] [bit] NOT NULL,
        [CompanyMasterID] [bigint] NOT NULL CONSTRAINT [DF_HR_UserMaster_CompanyMasterID] DEFAULT ((1)),
        [UiTheme] [nvarchar](50) NULL,
     CONSTRAINT [PK_HR_UserMaster] PRIMARY KEY CLUSTERED
    (
        [UserMasterID] ASC
    )
    );
END
GO

/* ---- HR_LeaveMaster (leave-type master) ---- */
IF OBJECT_ID(N'dbo.HR_LeaveMaster', N'U') IS NULL
BEGIN
    CREATE TABLE [dbo].[HR_LeaveMaster](
        [LeaveMasterID] [int] IDENTITY(1,1) NOT NULL,
        [Code] [nchar](10) NOT NULL,
        [Name] [nvarchar](50) NOT NULL,
        [Balance] [decimal](18, 2) NOT NULL,
        [Description] [nvarchar](100) NULL,
        [CarryForward] [bit] NULL CONSTRAINT [DF_HR_LeaveMaster_CarryForward] DEFAULT ((0)),
        [IsActive] [bit] NOT NULL CONSTRAINT [DF_HR_LeaveMaster_IsActive] DEFAULT ((1)),
        [IsPaidLeave] [bit] NOT NULL CONSTRAINT [DF__HR_LeaveM__IsPai__50C167C1] DEFAULT ((0)),
        [HalfDayAllowed] [bit] NOT NULL CONSTRAINT [DF_HR_LeaveMaster_HalfDayAllowed] DEFAULT ((0)),
        [QuarterDayAllowed] [bit] NOT NULL CONSTRAINT [DF_HR_LeaveMaster_QuarterDayAllowed] DEFAULT ((0)),
        [IsAdminOnly] [bit] NOT NULL CONSTRAINT [DF_HR_LeaveMaster_IsAdminOnly] DEFAULT ((0)),
        [Validity] [numeric](18, 0) NOT NULL CONSTRAINT [DF_HR_LeaveMaster_Validity] DEFAULT ((0)),
        [ValidationSPName] [nvarchar](200) NULL,
        [ValidationMessage] [nvarchar](200) NULL,
        [FromDate] [date] NOT NULL,
        [ToDate] [date] NOT NULL,
        [FormID] [int] NOT NULL,
        [YearID] [bigint] NULL,
        [CompanyMasterID] [bigint] NULL,
        [EntryUserMasterID] [bigint] NOT NULL,
        [EntryUserDateTime] [smalldatetime] NOT NULL,
        [EditUserMasterID] [bigint] NULL,
        [EditUserDateTime] [smalldatetime] NULL,
        [SystemName] [nvarchar](50) NULL,
     CONSTRAINT [PK_LeaveMaster] PRIMARY KEY CLUSTERED
    (
        [LeaveMasterID] ASC
    )
    );
END
GO

/* ---- HR_SalaryHeadMaster ---- */
IF OBJECT_ID(N'dbo.HR_SalaryHeadMaster', N'U') IS NULL
BEGIN
    CREATE TABLE [dbo].[HR_SalaryHeadMaster](
        [SalaryHeadMasterID] [bigint] IDENTITY(1,1) NOT NULL,
        [Code] [nvarchar](10) NOT NULL,
        [Name] [nvarchar](50) NOT NULL,
        [Description] [nvarchar](255) NOT NULL,
        [ReportOid] [bigint] NULL CONSTRAINT [DF_HR_SalaryHeadMaster_ReportOid] DEFAULT ((0)),
        [Status] [bit] NOT NULL CONSTRAINT [DF_HR_SalaryHeadMaster_Status] DEFAULT ((1)),
        [AllowInFormula] [bit] NOT NULL CONSTRAINT [DF_HR_SalaryHeadMaster_AllowInFormula] DEFAULT ((0)),
        [AllowInPrint] [bit] NOT NULL CONSTRAINT [DF_HR_SalaryHeadMaster_AllowInPrint] DEFAULT ((0)),
        [FormID] [bigint] NOT NULL CONSTRAINT [DF_HR_SalaryHeadMaster_FormID] DEFAULT ((1006)),
        [CompanyMasterID] [bigint] NOT NULL,
        [EntryUserMasterID] [bigint] NOT NULL,
        [EntryUserDateTime] [smalldatetime] NOT NULL,
        [EditUserMasterID] [bigint] NULL,
        [EditUserDateTime] [smalldatetime] NULL,
        [SystemName] [nvarchar](50) NULL,
     CONSTRAINT [PK_SalaryHeadMaster] PRIMARY KEY CLUSTERED
    (
        [SalaryHeadMasterID] ASC
    )
    );
END
GO

/* ---- HR_HolidayGroup ---- */
IF OBJECT_ID(N'dbo.HR_HolidayGroup', N'U') IS NULL
BEGIN
    CREATE TABLE [dbo].[HR_HolidayGroup](
        [Oid] [bigint] IDENTITY(1,1) NOT NULL,
        [Code] [nvarchar](50) NOT NULL,
        [Name] [nvarchar](50) NULL,
        [Remark] [nvarchar](200) NULL,
        [IsActive] [bit] NOT NULL CONSTRAINT [DF_HR_HolidayGroup_IsActive] DEFAULT ((1)),
        [FormID] [int] NOT NULL CONSTRAINT [DF_HR_HolidayGroup_FormID] DEFAULT ((1021)),
        [CompanyMasterID] [bigint] NOT NULL,
        [EntryUserMasterID] [bigint] NOT NULL,
        [EntryUserDateTime] [datetime2](3) NOT NULL,
        [EditUserMasterID] [bigint] NULL,
        [EditUserDateTime] [datetime2](3) NULL,
        [SystemName] [nvarchar](50) NULL,
     CONSTRAINT [PK_HR_HolidayGroup] PRIMARY KEY CLUSTERED
    (
        [Oid] ASC
    )
    );
END
GO

/* ---- HR_HolidayMaster ---- */
IF OBJECT_ID(N'dbo.HR_HolidayMaster', N'U') IS NULL
BEGIN
    CREATE TABLE [dbo].[HR_HolidayMaster](
        [Oid] [bigint] IDENTITY(1,1) NOT NULL,
        [Name] [nvarchar](50) NOT NULL,
        [Date] [smalldatetime] NOT NULL,
        [Type] [nvarchar](50) NOT NULL,
        [OTMultiplayer] [int] NOT NULL CONSTRAINT [DF_HR_HolidayMaster_OTMultiplayer] DEFAULT ((0)),
        [FromDate] [date] NULL,
        [ToDate] [date] NULL,
        [Remarks] [nvarchar](100) NULL,
        [Status] [bit] NOT NULL CONSTRAINT [DF_HR_HolidayMaster_Status] DEFAULT ((1)),
        [YearID] [bigint] NOT NULL,
        [FormID] [bigint] NOT NULL CONSTRAINT [DF_HR_HolidayMaster_FormID] DEFAULT ((1010)),
        [EntryUserMasterID] [bigint] NOT NULL,
        [EntryUserDateTime] [smalldatetime] NOT NULL,
        [EditUserMasterID] [bigint] NULL,
        [EditUserDateTime] [smalldatetime] NULL,
        [CompanyMasterID] [bigint] NOT NULL,
        [SystemName] [nvarchar](50) NOT NULL,
     CONSTRAINT [PK_HolidayMaster_1] PRIMARY KEY CLUSTERED
    (
        [Oid] ASC
    )
    );
END
GO

/* ---- HR_HolidayDetails (Oid links to HR_HolidayMaster.Oid) ---- */
IF OBJECT_ID(N'dbo.HR_HolidayDetails', N'U') IS NULL
BEGIN
    CREATE TABLE [dbo].[HR_HolidayDetails](
        [Oid] [bigint] NOT NULL,
        [HolidayDetailMasterID] [bigint] IDENTITY(1,1) NOT NULL,
        [CategoryMasterID] [bigint] NOT NULL,
        [EmployeeMasterID] [bigint] NOT NULL,
     CONSTRAINT [PK_HolidayDetails] PRIMARY KEY CLUSTERED
    (
        [Oid] ASC
    )
    );
END
GO

/* ---- HR_Period (open HR period used to resolve YearID) ---- */
IF OBJECT_ID(N'dbo.HR_Period', N'U') IS NULL
BEGIN
    CREATE TABLE [dbo].[HR_Period](
        [Oid] [bigint] IDENTITY(1,1) NOT NULL,
        [FromDate] [datetime] NOT NULL,
        [ToDate] [datetime] NOT NULL,
        [Status] [bit] NOT NULL CONSTRAINT [DF_HR_Period_Status] DEFAULT ((0)),
        [CreateUserMasterID] [bigint] NOT NULL,
        [CreateUserDateTime] [datetime] NOT NULL,
        [CompanyMasterID] [bigint] NOT NULL,
        [EndUserMasterID] [bigint] NULL,
        [EndUserDateTime] [datetime] NULL,
        [SystemName] [nvarchar](50) NOT NULL,
     CONSTRAINT [PK_HR_Period] PRIMARY KEY CLUSTERED
    (
        [Oid] ASC
    )
    );
END
GO

/* ---- HR_ReportLayout ---- */
IF OBJECT_ID(N'dbo.HR_ReportLayout', N'U') IS NULL
BEGIN
    CREATE TABLE [dbo].[HR_ReportLayout](
        [ReportId] [int] IDENTITY(1,1) NOT NULL,
        [DisplayName] [nvarchar](50) NULL,
        [LayoutData] [varbinary](max) NULL,
        [EntryUserMasterID] [bigint] NOT NULL,
        [EntryDateTime] [smalldatetime] NOT NULL,
        [EditUserMasterID] [bigint] NULL,
        [EditUserDateTime] [smalldatetime] NULL,
        [SystemName] [nvarchar](50) NULL,
        [CompanyMasterID] [bigint] NOT NULL CONSTRAINT [DF_HR_ReportLayout_CompanyMasterID] DEFAULT ((1)),
     CONSTRAINT [PK_HR_ReportLayout] PRIMARY KEY CLUSTERED
    (
        [ReportId] ASC
    )
    );
END
GO

/* ---- HR_DailyAttendance (single-punch daily attendance) ---- */
IF OBJECT_ID(N'dbo.HR_DailyAttendance', N'U') IS NULL
BEGIN
    CREATE TABLE [dbo].[HR_DailyAttendance](
        [DailyAttendanceID] [bigint] IDENTITY(1,1) NOT NULL,
        [EmployeeMasterID] [bigint] NOT NULL,
        [AttendYear] [numeric](18, 0) NOT NULL,
        [AttendMonth] [numeric](18, 0) NOT NULL,
        [AttendDate] [datetime] NOT NULL,
        [AttendanceStatus] [nvarchar](2) NOT NULL,
        [InDateTime] [datetime2](3) NULL,
        [OutDateTime] [datetime2](3) NULL,
        [ActualInDateTime] [datetime2](3) NULL,
        [ActualOutDateTime] [datetime2](3) NULL,
        [OriginalAttendanceStatus] [char](2) NOT NULL,
        [ActualWorkingHours] [decimal](18, 2) NOT NULL CONSTRAINT [DF_HR_DailyAttendance_ActualWorkingHours] DEFAULT ((0)),
        [MasterWorkingHours] [decimal](18, 2) NOT NULL CONSTRAINT [DF_HR_DailyAttendance_MasterWorkingHours] DEFAULT ((0)),
        [WorkingHours] [decimal](18, 2) NOT NULL CONSTRAINT [DF_HR_DailyAttendance_WorkingHours] DEFAULT ((0)),
        [HP_HA] [nvarchar](2) NULL CONSTRAINT [DF__HR_DailyA__HP_HA__5B4EA736] DEFAULT (''),
        [OTMinute] [decimal](18, 2) NULL,
        [OTAllowed] [bit] NULL,
        [HolidaySetupID] [bigint] NULL,
        [LeaveMasterID] [bigint] NULL,
        [LeaveMasterID1] [bigint] NULL,
        [ShiftInTime] [datetime2](3) NULL,
        [ShiftOutTime] [datetime2](3) NULL,
        [LeaveWithoutPay] [bit] NULL,
        [OTBasedOn] [tinyint] NULL,
        [OTBasedValue] [int] NULL,
        [DeductionMinute] [smallint] NULL,
        [Remarks] [varchar](250) NULL,
        [MonthlyAttendID] [int] NOT NULL CONSTRAINT [DF_HR_DailyAttendance_MonthlyAttendID] DEFAULT ((0)),
        [PayrollConfirmationID] [int] NOT NULL CONSTRAINT [DF_HR_DailyAttendance_PayrollConfirmationID] DEFAULT ((0)),
        [YearID] [bigint] NOT NULL,
        [FormID] [smallint] NOT NULL,
        [CompanyMasterID] [bigint] NOT NULL,
        [BranchMasterID] [bigint] NOT NULL,
        [ShiftMasterID] [bigint] NOT NULL,
        [CategoryMasterID] [bigint] NOT NULL,
        [EntryUserMasterID] [bigint] NOT NULL,
        [EntryUserDateTime] [datetime2](3) NOT NULL,
        [EditUserMasterID] [bigint] NULL,
        [EditUserDateTime] [datetime2](3) NULL,
        [SystemName] [nvarchar](50) NULL,
        [ProcessingSource] [nvarchar](20) NULL,
        [IsLocked] [bit] NOT NULL CONSTRAINT [DF_HR_DailyAttendance_IsLocked] DEFAULT ((0)),
     CONSTRAINT [PK_DailyAttendance] PRIMARY KEY CLUSTERED
    (
        [DailyAttendanceID] ASC
    )
    );
END
GO

/* ---- HR_DailyAttendanceMultiPunch (core mobile attendance table) ---- */
IF OBJECT_ID(N'dbo.HR_DailyAttendanceMultiPunch', N'U') IS NULL
BEGIN
    CREATE TABLE [dbo].[HR_DailyAttendanceMultiPunch](
        [Oid] [bigint] IDENTITY(1,1) NOT NULL,
        [EmployeeMasterID] [bigint] NOT NULL,
        [AttendYear] [numeric](18, 0) NOT NULL,
        [AttendMonth] [numeric](18, 0) NOT NULL,
        [AttendDate] [datetime] NOT NULL,
        [AttendanceStatus] [nvarchar](2) NOT NULL,
        [PunchDateTime1] [datetime] NULL,
        [PunchDateTime2] [datetime] NULL,
        [PunchDateTime3] [datetime] NULL,
        [PunchDateTime4] [datetime] NULL,
        [PunchDateTime5] [datetime] NULL,
        [PunchDateTime6] [datetime] NULL,
        [PunchDateTime7] [datetime] NULL,
        [PunchDateTime8] [datetime] NULL,
        [PunchDateTime9] [datetime] NULL,
        [PunchDateTime10] [datetime] NULL,
        [PunchDateTime11] [datetime] NULL,
        [PunchDateTime12] [datetime] NULL,
        [PunchDateTime13] [datetime] NULL,
        [PunchDateTime14] [datetime] NULL,
        [ActualWorkingHours] [decimal](18, 2) NOT NULL,
        [MasterWorkingHours] [decimal](18, 2) NOT NULL,
        [WorkingHours] [decimal](18, 2) NOT NULL,
        [HP_HA] [nvarchar](2) NULL,
        [Remark] [nvarchar](500) NULL,
        [OTMinute] [decimal](18, 2) NULL,
        [OTAllowed] [bit] NULL,
        [LateFlag] [bit] NULL,
        [EarlyFlag] [bit] NULL,
        [HolidaySetupID] [bigint] NULL,
        [LeaveMasterID] [bigint] NULL,
        [LeaveMasterID1] [bigint] NULL,
        [ShiftMasterID] [bigint] NOT NULL,
        [MonthlyAttendID] [int] NOT NULL,
        [PayrollConfirmationID] [int] NOT NULL,
        [CategoryMasterID] [bigint] NOT NULL,
        [BranchMasterID] [bigint] NOT NULL,
        [CompanyMasterID] [bigint] NOT NULL,
        [YearID] [bigint] NOT NULL,
        [FormID] [bigint] NOT NULL,
        [EntryUserMasterID] [bigint] NOT NULL,
        [EntryUserDateTime] [datetime2](3) NOT NULL,
        [EditUserMasterID] [bigint] NULL,
        [EditUserDateTime] [datetime2](3) NULL,
        [SystemName] [nvarchar](50) NOT NULL,
        [ProcessingSource] [nvarchar](20) NULL,
        [IsLocked] [bit] NOT NULL,
     CONSTRAINT [PK_HR_DailyAttendanceMultiPunch] PRIMARY KEY CLUSTERED
    (
        [Oid] ASC
    )
    );
END
GO

/* ---- HR_AttendenceAdjustment (deliberate cryogas misspelling preserved) ---- */
IF OBJECT_ID(N'dbo.HR_AttendenceAdjustment', N'U') IS NULL
BEGIN
    CREATE TABLE [dbo].[HR_AttendenceAdjustment](
        [Oid] [bigint] IDENTITY(1,1) NOT NULL,
        [DocNo] [nvarchar](50) NOT NULL,
        [DocDate] [datetime] NOT NULL,
        [EmployeeMasterID] [bigint] NOT NULL,
        [ReportingPersonID] [bigint] NOT NULL,
        [Type] [nvarchar](50) NOT NULL,
        [AttendenceDate] [datetime] NOT NULL,
        [InTime] [datetime] NOT NULL,
        [OutTime] [datetime] NOT NULL,
        [Reason] [nvarchar](255) NOT NULL,
        [ApprovedBy] [bigint] NULL,
        [ApprovedDate] [datetime] NULL,
        [EntryUserMasterID] [bigint] NOT NULL,
        [EntryUserDateTime] [smalldatetime] NOT NULL,
        [EditUserMasterID] [bigint] NULL,
        [EditUserDateTime] [smalldatetime] NULL,
        [CompanyMasterID] [bigint] NOT NULL,
        [SystemName] [nvarchar](50) NOT NULL,
        [ApprovalStatus] [nvarchar](50) NOT NULL,
        [Status] [bit] NOT NULL,
        [ManagerComment] [nvarchar](255) NULL,
        [HRApprovalStatus] [nvarchar](20) NULL,
        [HRApprovedBy] [int] NULL,
        [HRApprovedDate] [datetime] NULL,
        [HRComment] [nvarchar](500) NULL,
     CONSTRAINT [PK_HR_AttendenceAdjustment] PRIMARY KEY CLUSTERED
    (
        [Oid] ASC
    )
    );
END
GO

/* ---- HR_LeaveApplication ---- */
IF OBJECT_ID(N'dbo.HR_LeaveApplication', N'U') IS NULL
BEGIN
    CREATE TABLE [dbo].[HR_LeaveApplication](
        [LeaveApplicationID] [int] IDENTITY(1,1) NOT NULL,
        [ApplicationDate] [date] NOT NULL,
        [FromDate] [date] NOT NULL,
        [ToDate] [date] NOT NULL,
        [ReceiverReadDate] [date] NULL,
        [LeaveMasterID] [int] NOT NULL,
        [AppliedDay] [decimal](18, 2) NOT NULL,
        [DayLeaveType] [nvarchar](50) NOT NULL,
        [HalfDayLeave] [nvarchar](50) NULL,
        [LeaveReason] [nvarchar](50) NULL,
        [Status] [nvarchar](10) NOT NULL,
        [FASYear] [nvarchar](10) NOT NULL,
        [YearID] [bigint] NOT NULL,
        [EmployeeMasterID] [bigint] NOT NULL,
        [ReportingPersonID] [bigint] NOT NULL CONSTRAINT [DF_HR_LeaveApplication_ReportingPersonID] DEFAULT ((0)),
        [CompanyMasterID] [bigint] NOT NULL,
        [EntryUserMasterID] [bigint] NOT NULL,
        [EntryDateTime] [smalldatetime] NOT NULL,
        [EditUserMasterID] [bigint] NULL,
        [EditDateTime] [smalldatetime] NULL,
        [SystemName] [nvarchar](50) NOT NULL,
        [LeaveApproverUserMasterID] [bigint] NULL,
     CONSTRAINT [PK_LeaveApplication] PRIMARY KEY CLUSTERED
    (
        [LeaveApplicationID] ASC
    )
    );
END
GO

/* ---- HR_LeaveAppAuthLeavel (multi-level approval chain; cryogas misspelling kept) ---- */
IF OBJECT_ID(N'dbo.HR_LeaveAppAuthLeavel', N'U') IS NULL
BEGIN
    CREATE TABLE [dbo].[HR_LeaveAppAuthLeavel](
        [LeaveAppAuthID] [int] IDENTITY(1,1) NOT NULL,
        [LeaveApplicationID] [int] NOT NULL,
        [LeaveMasterID] [int] NOT NULL,
        [EmployeeMasterID] [int] NOT NULL,
        [ReportingPersonID] [int] NULL,
        [LeaveAuthLevel] [int] NOT NULL,
        [AuthStatus] [varchar](20) NOT NULL CONSTRAINT [DF__HR_LeaveA__AuthS__147C05D0] DEFAULT ('PENDING'),
        [AuthDateTime] [datetime] NULL,
        [CompanyMasterID] [int] NOT NULL,
        [EntryUserMasterID] [int] NOT NULL,
        [EntryUserDateTime] [datetime] NOT NULL CONSTRAINT [DF__HR_LeaveA__Entry__15702A09] DEFAULT (getdate()),
        [SystemName] [varchar](100) NULL,
        [IsActive] [bit] NOT NULL CONSTRAINT [DF__HR_LeaveA__IsAct__1940BAED] DEFAULT ((0)),
     CONSTRAINT [PK__HR_Leave__26A024E0FC49A965] PRIMARY KEY CLUSTERED
    (
        [LeaveAppAuthID] ASC
    ),
     CONSTRAINT [UQ_Leave_Approver] UNIQUE NONCLUSTERED
    (
        [LeaveApplicationID] ASC,
        [ReportingPersonID] ASC
    ),
     CONSTRAINT [UQ_Leave_Level] UNIQUE NONCLUSTERED
    (
        [LeaveApplicationID] ASC,
        [LeaveAuthLevel] ASC
    )
    );
END
GO

/* ---- HR_EmployeeWiseLeave (per-employee leave balances) ---- */
IF OBJECT_ID(N'dbo.HR_EmployeeWiseLeave', N'U') IS NULL
BEGIN
    CREATE TABLE [dbo].[HR_EmployeeWiseLeave](
        [Oid] [bigint] IDENTITY(1,1) NOT NULL,
        [CheckBox] [bit] NOT NULL,
        [LeaveMasterID] [bigint] NOT NULL,
        [OpeningBalance] [decimal](18, 2) NULL CONSTRAINT [DF_HR_EmployeeWiseLeave_OpeningBalance] DEFAULT ((0)),
        [Balance] [decimal](18, 2) NOT NULL CONSTRAINT [DF_HR_EmployeeWiseLeave_Balance] DEFAULT ((0)),
        [CarryForward] [bit] NULL CONSTRAINT [DF_HR_EmployeeWiseLeave_CarryForward] DEFAULT ((0)),
        [IsActive] [bit] NOT NULL CONSTRAINT [DF_HR_EmployeeWiseLeave_IsActive] DEFAULT ((1)),
        [IsPaidLeave] [bit] NOT NULL CONSTRAINT [DF_HR_EmployeeWiseLeave_IsPaidLeave] DEFAULT ((0)),
        [FromDate] [date] NOT NULL,
        [ToDate] [date] NOT NULL,
        [YearID] [bigint] NOT NULL,
        [UpdateInEmployee] [bit] NULL CONSTRAINT [DF_HR_EmployeeWiseLeave_UpdateInEmployee] DEFAULT ((0)),
        [EmployeeMasterID] [bigint] NOT NULL,
     CONSTRAINT [PK_HR_EmployeeWiseLeave] PRIMARY KEY CLUSTERED
    (
        [Oid] ASC
    )
    );
END
GO

/* ---- HR_EmployeeBasicSalary ---- */
IF OBJECT_ID(N'dbo.HR_EmployeeBasicSalary', N'U') IS NULL
BEGIN
    CREATE TABLE [dbo].[HR_EmployeeBasicSalary](
        [Oid] [bigint] IDENTITY(1,1) NOT NULL,
        [EmployeeMasterID] [bigint] NOT NULL,
        [SrNo] [int] NOT NULL,
        [BasicAmount] [decimal](18, 2) NOT NULL CONSTRAINT [DF_HR_EmployeeBasicSalary_BasicAmount] DEFAULT ((0)),
        [GrossAmount] [decimal](18, 2) NOT NULL CONSTRAINT [DF_HR_EmployeeBasicSalary_GrassAmount] DEFAULT ((0)),
        [CTCAmount] [decimal](18, 2) NOT NULL CONSTRAINT [DF_HR_EmployeeBasicSalary_CTCAmount] DEFAULT ((0)),
        [OTRate] [decimal](18, 2) NOT NULL CONSTRAINT [DF_HR_EmployeeBasicSalary_OTAmount] DEFAULT ((0)),
        [GovernmentRate] [decimal](18, 2) NOT NULL CONSTRAINT [DF_HR_EmployeeBasicSalary_GovernmentRate] DEFAULT ((0)),
        [FromDate] [date] NOT NULL,
        [ToDate] [date] NOT NULL,
        [YearID] [bigint] NOT NULL,
        [CategoryMasterID] [bigint] NULL,
        [BranchMasterID] [bigint] NOT NULL,
        [CompanyMasterID] [bigint] NOT NULL,
     CONSTRAINT [PK_HR_EmployeeBasicSalary] PRIMARY KEY CLUSTERED
    (
        [Oid] ASC
    )
    );
END
GO

/* ---- HR_EmployeeWiseSalaryHead (bracketed legacy column names preserved) ---- */
IF OBJECT_ID(N'dbo.HR_EmployeeWiseSalaryHead', N'U') IS NULL
BEGIN
    CREATE TABLE [dbo].[HR_EmployeeWiseSalaryHead](
        [Oid] [bigint] IDENTITY(1,1) NOT NULL,
        [Sr.No.] [int] NOT NULL,
        [CheckBox] [bit] NOT NULL CONSTRAINT [DF_HR_EmployeeWiseSalaryHead_CheckBox] DEFAULT ((0)),
        [SalaryHeadMasterID] [bigint] NOT NULL,
        [AccountHeadCode] [nvarchar](50) NOT NULL,
        [Add/Deduct] [nvarchar](50) NOT NULL,
        [Percentage] [decimal](18, 0) NOT NULL CONSTRAINT [DF_HR_EmployeeWiseSalaryHead_Percentage] DEFAULT ((0)),
        [Amount] [decimal](18, 2) NOT NULL CONSTRAINT [DF_HR_EmployeeWiseSalaryHead_Amount] DEFAULT ((0)),
        [AmountCalculation] [nvarchar](max) NULL,
        [Formula] [nvarchar](max) NULL,
        [RoundOff] [bit] NULL CONSTRAINT [DF_HR_EmployeeWiseSalaryHead_RoundOff] DEFAULT ((0)),
        [AllowEdit] [bit] NOT NULL CONSTRAINT [DF_HR_EmployeeWiseSalaryHead_AllowEdit] DEFAULT ((0)),
        [Remarks] [nvarchar](255) NULL,
        [EmployeeMasterID] [bigint] NOT NULL,
        [CategoryMasterID] [bigint] NOT NULL,
        [BranchMasterID] [bigint] NOT NULL,
        [CompanyMasterID] [bigint] NOT NULL,
        [FormulaRuleJson] [nvarchar](max) NULL,
        [FormulaReadable] [nvarchar](500) NULL,
        [FormulaSource] [nvarchar](30) NULL,
        [Status] [bit] NULL,
     CONSTRAINT [PK_EmployeePayrollDetails] PRIMARY KEY CLUSTERED
    (
        [Oid] ASC
    )
    );
END
GO

/* ---- HR_MonthlyAttendance ---- */
IF OBJECT_ID(N'dbo.HR_MonthlyAttendance', N'U') IS NULL
BEGIN
    CREATE TABLE [dbo].[HR_MonthlyAttendance](
        [Oid] [bigint] IDENTITY(1,1) NOT NULL,
        [CompanyMasterID] [bigint] NOT NULL,
        [BranchMasterID] [bigint] NOT NULL,
        [CategoryMasterID] [bigint] NOT NULL,
        [ShiftMasterID] [bigint] NOT NULL,
        [EmployeeMasterID] [bigint] NOT NULL,
        [AttendYear] [smallint] NOT NULL,
        [AttendMonth] [smallint] NOT NULL,
        [FromDate] [datetime] NOT NULL,
        [ToDate] [datetime] NOT NULL,
        [MonthDays] [decimal](8, 2) NOT NULL CONSTRAINT [DF_HR_MonthlyAttendance_MonthDays] DEFAULT ((0)),
        [WorkingDays] [decimal](8, 2) NOT NULL CONSTRAINT [DF_HR_MonthlyAttendance_WorkingDays] DEFAULT ((0)),
        [WeekOffDays] [decimal](8, 2) NOT NULL CONSTRAINT [DF_HR_MonthlyAttendance_WeekOffDays] DEFAULT ((0)),
        [Holidays] [decimal](8, 2) NOT NULL CONSTRAINT [DF_HR_MonthlyAttendance_Holidays] DEFAULT ((0)),
        [LeaveDays] [decimal](8, 2) NOT NULL CONSTRAINT [DF_HR_MonthlyAttendance_LeaveDays] DEFAULT ((0)),
        [LWPDays] [decimal](8, 2) NOT NULL CONSTRAINT [DF_HR_MonthlyAttendance_LWPDays_1] DEFAULT ((0)),
        [PresentDays] [decimal](8, 2) NOT NULL CONSTRAINT [DF_HR_MonthlyAttendance_PresentDays] DEFAULT ((0)),
        [AbsentDays] [decimal](8, 2) NOT NULL CONSTRAINT [DF_HR_MonthlyAttendance_AbsentDays] DEFAULT ((0)),
        [HalfDays] [decimal](8, 2) NOT NULL CONSTRAINT [DF_HR_MonthlyAttendance_HalfDays] DEFAULT ((0)),
        [HalfLeaveDays] [decimal](8, 2) NOT NULL CONSTRAINT [DF_HR_MonthlyAttendance_HalfLeaveDays] DEFAULT ((0)),
        [ExtraPayDays] [decimal](8, 2) NOT NULL CONSTRAINT [DF_HR_MonthlyAttendance_ExtraPayDays] DEFAULT ((0)),
        [TotalOTHours] [decimal](8, 2) NOT NULL CONSTRAINT [DF_HR_MonthlyAttendance_TotalOTHours] DEFAULT ((0)),
        [OTRatePerHour] [decimal](18, 4) NOT NULL CONSTRAINT [DF_HR_MonthlyAttendance_OTRatePerHour] DEFAULT ((0)),
        [TotalPayDays] [decimal](8, 2) NOT NULL CONSTRAINT [DF_HR_MonthlyAttendance_TotalPayDays] DEFAULT ((0)),
        [TotalWH] [decimal](8, 2) NOT NULL CONSTRAINT [DF_HR_MonthlyAttendance_TotalWH] DEFAULT ((0)),
        [CompensationDays] [decimal](8, 2) NOT NULL CONSTRAINT [DF_HR_MonthlyAttendance_CompensationDays] DEFAULT ((0)),
        [Remarks] [nvarchar](200) NULL,
        [PayrollConfirmationID] [int] NOT NULL CONSTRAINT [DF_HR_MonthlyAttendance_PayrollConfirmationID] DEFAULT ((0)),
        [YearID] [bigint] NOT NULL,
        [InsertFrom] [nvarchar](50) NOT NULL,
        [EntryUserMasterID] [bigint] NOT NULL,
        [EntryUserDateTime] [datetime] NOT NULL,
        [EditUserMasterID] [bigint] NULL,
        [EditUserDateTime] [datetime] NULL,
        [SystemName] [nvarchar](50) NOT NULL,
     CONSTRAINT [PK_MonthlyAttendance] PRIMARY KEY CLUSTERED
    (
        [Oid] ASC
    )
    );
END
GO

/* ---- HR_PayrollSalaryConfirmation ---- */
IF OBJECT_ID(N'dbo.HR_PayrollSalaryConfirmation', N'U') IS NULL
BEGIN
    CREATE TABLE [dbo].[HR_PayrollSalaryConfirmation](
        [Oid] [bigint] IDENTITY(1,1) NOT NULL,
        [EmployeeMasterID] [bigint] NOT NULL,
        [FromDate] [date] NULL,
        [ToDate] [date] NULL,
        [PayrollMonth] [numeric](18, 0) NULL,
        [PayrollYear] [numeric](18, 0) NULL,
        [MonthDays] [numeric](18, 0) NULL,
        [WorkingDays] [numeric](18, 2) NULL,
        [TotalPayDays] [numeric](18, 2) NULL,
        [BasicAmount] [numeric](18, 2) NOT NULL CONSTRAINT [DF_HR_PayrollSalaryConfirmation_BasicAmount] DEFAULT ((0)),
        [GrossAmount] [numeric](18, 2) NOT NULL CONSTRAINT [DF_HR_PayrollSalaryConfirmation_GrossAmount] DEFAULT ((0)),
        [CTCAmount] [numeric](18, 2) NOT NULL CONSTRAINT [DF_HR_PayrollSalaryConfirmation_CTCAmount] DEFAULT ((0)),
        [OTAmount] [numeric](18, 2) NOT NULL CONSTRAINT [DF_HR_PayrollSalaryConfirmation_OTAmount] DEFAULT ((0)),
        [CalculatedNetPay] [numeric](18, 2) NOT NULL CONSTRAINT [DF_HR_PayrollSalaryConfirmation_CalculatedNetPay] DEFAULT ((0)),
        [MasterNetPay] [numeric](18, 2) NOT NULL CONSTRAINT [DF_HR_PayrollSalaryConfirmation_MasterNetPay] DEFAULT ((0)),
        [MonthlyAttendID] [bigint] NOT NULL CONSTRAINT [DF_HR_PayrollSalaryConfirmation_MonthlyAttendID] DEFAULT ((0)),
        [CategoryMasterID] [bigint] NOT NULL,
        [BranchMasterID] [bigint] NOT NULL,
        [CompanyMasterID] [bigint] NOT NULL,
        [EntryUserMasterID] [bigint] NOT NULL,
        [EntryUserDateTime] [smalldatetime] NOT NULL,
        [SystemName] [nvarchar](50) NOT NULL,
     CONSTRAINT [PK_PayrollSalaryConfirmation] PRIMARY KEY CLUSTERED
    (
        [Oid] ASC
    )
    );
END
GO

/* ---- HR_PayrollSalaryConfirmationDetails (bracketed legacy column names preserved) ---- */
IF OBJECT_ID(N'dbo.HR_PayrollSalaryConfirmationDetails', N'U') IS NULL
BEGIN
    CREATE TABLE [dbo].[HR_PayrollSalaryConfirmationDetails](
        [Oid] [bigint] IDENTITY(1,1) NOT NULL,
        [PayrollConfirmationID] [bigint] NOT NULL,
        [Sr.No.] [int] NOT NULL,
        [SalaryHeadMasterID] [int] NOT NULL,
        [AccountHeadCode] [nvarchar](50) NOT NULL,
        [Add/Deduct] [nvarchar](10) NULL,
        [Percentage] [numeric](18, 2) NULL,
        [Amount] [numeric](18, 2) NULL,
        [CalculatedAmount] [numeric](18, 2) NULL,
        [CalculatedBasicAmount] [numeric](18, 2) NULL,
        [CalculatedGrossAmount] [numeric](18, 2) NULL,
        [CalculatedCTCAmount] [numeric](18, 2) NULL,
        [Formula] [nvarchar](max) NULL,
        [AmountCalculation] [nvarchar](50) NULL,
        [Remarks] [nvarchar](200) NULL,
        [EmployeeMasterID] [bigint] NOT NULL,
        [CategoryMasterID] [bigint] NOT NULL,
        [BranchMasterID] [bigint] NOT NULL,
        [CompanyMasterID] [bigint] NOT NULL,
     CONSTRAINT [PK_PayrollSalaryConfirmationDetails] PRIMARY KEY CLUSTERED
    (
        [Oid] ASC
    )
    );
END
GO

/* ============================================================================
   2. ADDITIVE MOBILE COMPANION TABLES (Section D, verbatim)
      Net-new; never merged into the cryogas core.
   ============================================================================ */

/* ---- HR_UnitGPS ---- */
IF OBJECT_ID(N'dbo.HR_UnitGPS', N'U') IS NULL
BEGIN
    CREATE TABLE [dbo].[HR_UnitGPS](
        [Id] [bigint] IDENTITY(1,1) NOT NULL,
        [UnitMasterId] [int] NOT NULL,
        [Latitude] [decimal](10,7) NULL,
        [Longitude] [decimal](10,7) NULL,
        [IsGeofenced] [bit] NOT NULL CONSTRAINT [DF_HR_UnitGPS_IsGeofenced] DEFAULT ((0)),
        [CreatedAt] [datetime] NOT NULL CONSTRAINT [DF_HR_UnitGPS_CreatedAt] DEFAULT (GETDATE()),
        [UpdatedAt] [datetime] NULL,
        CONSTRAINT [PK_HR_UnitGPS] PRIMARY KEY CLUSTERED ([Id] ASC),
        CONSTRAINT [UQ_HR_UnitGPS_UnitMasterId] UNIQUE NONCLUSTERED ([UnitMasterId] ASC)
    );
END
GO

/* ---- HR_UserUnits ---- */
IF OBJECT_ID(N'dbo.HR_UserUnits', N'U') IS NULL
BEGIN
    CREATE TABLE [dbo].[HR_UserUnits](
        [Id] [bigint] IDENTITY(1,1) NOT NULL,
        [UserMasterID] [bigint] NOT NULL,
        [UnitMasterId] [int] NOT NULL,
        [CreatedAt] [datetime] NOT NULL CONSTRAINT [DF_HR_UserUnits_CreatedAt] DEFAULT (GETDATE()),
        CONSTRAINT [PK_HR_UserUnits] PRIMARY KEY CLUSTERED ([Id] ASC),
        CONSTRAINT [UQ_HR_UserUnits_User_Unit] UNIQUE NONCLUSTERED ([UserMasterID] ASC, [UnitMasterId] ASC)
    );
END
GO

/* ---- HR_EmployeeBranchPermissions ---- */
IF OBJECT_ID(N'dbo.HR_EmployeeBranchPermissions', N'U') IS NULL
BEGIN
    CREATE TABLE [dbo].[HR_EmployeeBranchPermissions](
        [Id] [bigint] IDENTITY(1,1) NOT NULL,
        [UserMasterID] [bigint] NOT NULL,
        [MainUnitMasterId] [int] NOT NULL,
        [AllowedUnitMasterId] [int] NOT NULL,
        [IsActive] [bit] NOT NULL CONSTRAINT [DF_HR_EmpBranchPerm_IsActive] DEFAULT ((1)),
        [CreatedAt] [datetime] NOT NULL CONSTRAINT [DF_HR_EmpBranchPerm_CreatedAt] DEFAULT (GETDATE()),
        [UpdatedAt] [datetime] NULL,
        CONSTRAINT [PK_HR_EmployeeBranchPermissions] PRIMARY KEY CLUSTERED ([Id] ASC),
        CONSTRAINT [UQ_HR_EmpBranchPerm_User_Allowed] UNIQUE NONCLUSTERED ([UserMasterID] ASC, [AllowedUnitMasterId] ASC)
    );
END
GO

/* ---- HR_PunchLocations ---- */
IF OBJECT_ID(N'dbo.HR_PunchLocations', N'U') IS NULL
BEGIN
    CREATE TABLE [dbo].[HR_PunchLocations](
        [Id] [bigint] IDENTITY(1,1) NOT NULL,
        [MultiPunchOid] [bigint] NOT NULL,
        [PunchLocation1] [nvarchar](100) NULL,
        [PunchLocation2] [nvarchar](100) NULL,
        [PunchLocation3] [nvarchar](100) NULL,
        [PunchLocation4] [nvarchar](100) NULL,
        [PunchLocation5] [nvarchar](100) NULL,
        [PunchLocation6] [nvarchar](100) NULL,
        [PunchLocation7] [nvarchar](100) NULL,
        [PunchLocation8] [nvarchar](100) NULL,
        [PunchLocation9] [nvarchar](100) NULL,
        [PunchLocation10] [nvarchar](100) NULL,
        [PunchLocation11] [nvarchar](100) NULL,
        [PunchLocation12] [nvarchar](100) NULL,
        [PunchLocation13] [nvarchar](100) NULL,
        [PunchLocation14] [nvarchar](100) NULL,
        CONSTRAINT [PK_HR_PunchLocations] PRIMARY KEY CLUSTERED ([Id] ASC),
        CONSTRAINT [UQ_HR_PunchLocations_MultiPunchOid] UNIQUE NONCLUSTERED ([MultiPunchOid] ASC)
    );
END
GO

/* ---- HR_PunchPhotos ---- */
IF OBJECT_ID(N'dbo.HR_PunchPhotos', N'U') IS NULL
BEGIN
    CREATE TABLE [dbo].[HR_PunchPhotos](
        [Id] [bigint] IDENTITY(1,1) NOT NULL,
        [MultiPunchOid] [bigint] NOT NULL,
        [PunchSlot] [tinyint] NOT NULL,
        [PhotoBase64] [nvarchar](max) NOT NULL,
        [MimeType] [nvarchar](50) NOT NULL CONSTRAINT [DF_HR_PunchPhotos_MimeType] DEFAULT (N'image/jpeg'),
        [CapturedDateTime] [datetime] NOT NULL CONSTRAINT [DF_HR_PunchPhotos_CapturedDateTime] DEFAULT (GETDATE()),
        [Latitude] [decimal](10,7) NULL,
        [Longitude] [decimal](10,7) NULL,
        CONSTRAINT [PK_HR_PunchPhotos] PRIMARY KEY CLUSTERED ([Id] ASC),
        CONSTRAINT [UQ_HR_PunchPhotos_OidSlot] UNIQUE NONCLUSTERED ([MultiPunchOid] ASC, [PunchSlot] ASC)
    );
END
GO
/* NOTE: Section D's HR_PunchPhotos lists MimeType/CapturedDateTime as NOT NULL
   with no default. The app INSERTs only (MultiPunchOid, PunchSlot, PhotoBase64,
   Latitude, Longitude) and relies on DB defaults for MimeType/CapturedDateTime/Id.
   Defaults are added here so the app's INSERT succeeds; the column set/types are
   otherwise verbatim. */

/* ============================================================================
   2B. ALIGNMENT COLUMNS (net-new; layered on top of the verbatim cryogas core)
      These columns are NOT part of the canonical cryogas structures, so they
      are added here as guarded ALTERs rather than baked into the verbatim
      CREATE TABLEs above. Idempotent: each ADD is gated by COL_LENGTH so a
      re-run (or a pre-existing table) is a no-op.

      HR_LeaveApplication.ApprovedBy/ApprovedDate/ApproverComment:
        The multi-level approval "decide" endpoint writes these UNCONDITIONALLY
        (server.js: the approval-chain finalize/reject UPDATEs). Without them
        that endpoint fails at runtime, so they are a hard requirement — not
        merely the sys.columns-probed optional path used by the flat approval
        endpoint. HR_AttendenceAdjustment already carries its own ApprovedBy/
        ApprovedDate/ManagerComment in the verbatim core, so no ALTER is needed
        there.

      HR_ReportLayout.Description/Category:
        The reports-list endpoint probes sys.columns and degrades gracefully
        when absent, but it filters/orders by Category when present. Added so
        the full reports experience works.
   ============================================================================ */

IF OBJECT_ID(N'dbo.HR_LeaveApplication', N'U') IS NOT NULL
   AND COL_LENGTH(N'dbo.HR_LeaveApplication', N'ApprovedBy') IS NULL
BEGIN
    ALTER TABLE [dbo].[HR_LeaveApplication] ADD [ApprovedBy] [bigint] NULL;
END
GO

IF OBJECT_ID(N'dbo.HR_LeaveApplication', N'U') IS NOT NULL
   AND COL_LENGTH(N'dbo.HR_LeaveApplication', N'ApprovedDate') IS NULL
BEGIN
    ALTER TABLE [dbo].[HR_LeaveApplication] ADD [ApprovedDate] [datetime] NULL;
END
GO

IF OBJECT_ID(N'dbo.HR_LeaveApplication', N'U') IS NOT NULL
   AND COL_LENGTH(N'dbo.HR_LeaveApplication', N'ApproverComment') IS NULL
BEGIN
    ALTER TABLE [dbo].[HR_LeaveApplication] ADD [ApproverComment] [nvarchar](500) NULL;
END
GO

IF OBJECT_ID(N'dbo.HR_ReportLayout', N'U') IS NOT NULL
   AND COL_LENGTH(N'dbo.HR_ReportLayout', N'Description') IS NULL
BEGIN
    ALTER TABLE [dbo].[HR_ReportLayout] ADD [Description] [nvarchar](max) NULL;
END
GO

IF OBJECT_ID(N'dbo.HR_ReportLayout', N'U') IS NOT NULL
   AND COL_LENGTH(N'dbo.HR_ReportLayout', N'Category') IS NULL
BEGIN
    ALTER TABLE [dbo].[HR_ReportLayout] ADD [Category] [nvarchar](50) NULL;
END
GO

/* ============================================================================
   3. FOREIGN KEYS (only among tables created above)
      cryogas itself has no intra-set FKs. We add the ReportingPersonID
      self-reference plus the 5 companion FKs.
   ============================================================================ */

/* Prerequisite: companion FKs target Unit.UnitMasterId, which is an IDENTITY
   column but not unique in canonical cryogas. Add a UNIQUE index so it can be
   referenced. Additive only — no column is altered. */
IF OBJECT_ID(N'dbo.Unit', N'U') IS NOT NULL
   AND NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'UX_Unit_UnitMasterId' AND object_id = OBJECT_ID(N'dbo.Unit'))
BEGIN
    CREATE UNIQUE NONCLUSTERED INDEX [UX_Unit_UnitMasterId] ON [dbo].[Unit]([UnitMasterId] ASC);
END
GO

/* HR_EmployeeMaster.ReportingPersonID -> HR_EmployeeMaster.EmployeeMasterID
   (drives the recursive reporting-chain walk in csp_Payroll_InsertLeaveApprovalLevels) */
IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = N'FK_HR_EmployeeMaster_ReportingPerson')
   AND OBJECT_ID(N'dbo.HR_EmployeeMaster', N'U') IS NOT NULL
BEGIN
    ALTER TABLE [dbo].[HR_EmployeeMaster] WITH NOCHECK
        ADD CONSTRAINT [FK_HR_EmployeeMaster_ReportingPerson]
        FOREIGN KEY ([ReportingPersonID]) REFERENCES [dbo].[HR_EmployeeMaster]([EmployeeMasterID]);
END
GO

/* HR_UnitGPS.UnitMasterId -> Unit.UnitMasterId */
IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = N'FK_HR_UnitGPS_Unit')
   AND OBJECT_ID(N'dbo.HR_UnitGPS', N'U') IS NOT NULL
   AND OBJECT_ID(N'dbo.Unit', N'U') IS NOT NULL
   AND EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'UX_Unit_UnitMasterId' AND object_id = OBJECT_ID(N'dbo.Unit'))
BEGIN
    ALTER TABLE [dbo].[HR_UnitGPS] WITH NOCHECK
        ADD CONSTRAINT [FK_HR_UnitGPS_Unit]
        FOREIGN KEY ([UnitMasterId]) REFERENCES [dbo].[Unit]([UnitMasterId]);
END
GO

/* HR_UserUnits.UserMasterID -> HR_UserMaster.UserMasterID */
IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = N'FK_HR_UserUnits_User')
   AND OBJECT_ID(N'dbo.HR_UserUnits', N'U') IS NOT NULL
   AND OBJECT_ID(N'dbo.HR_UserMaster', N'U') IS NOT NULL
BEGIN
    ALTER TABLE [dbo].[HR_UserUnits] WITH NOCHECK
        ADD CONSTRAINT [FK_HR_UserUnits_User]
        FOREIGN KEY ([UserMasterID]) REFERENCES [dbo].[HR_UserMaster]([UserMasterID]);
END
GO

/* HR_UserUnits.UnitMasterId -> Unit.UnitMasterId */
IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = N'FK_HR_UserUnits_Unit')
   AND OBJECT_ID(N'dbo.HR_UserUnits', N'U') IS NOT NULL
   AND OBJECT_ID(N'dbo.Unit', N'U') IS NOT NULL
   AND EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'UX_Unit_UnitMasterId' AND object_id = OBJECT_ID(N'dbo.Unit'))
BEGIN
    ALTER TABLE [dbo].[HR_UserUnits] WITH NOCHECK
        ADD CONSTRAINT [FK_HR_UserUnits_Unit]
        FOREIGN KEY ([UnitMasterId]) REFERENCES [dbo].[Unit]([UnitMasterId]);
END
GO

/* HR_EmployeeBranchPermissions.UserMasterID -> HR_UserMaster.UserMasterID */
IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = N'FK_HR_EmpBranchPerm_User')
   AND OBJECT_ID(N'dbo.HR_EmployeeBranchPermissions', N'U') IS NOT NULL
   AND OBJECT_ID(N'dbo.HR_UserMaster', N'U') IS NOT NULL
BEGIN
    ALTER TABLE [dbo].[HR_EmployeeBranchPermissions] WITH NOCHECK
        ADD CONSTRAINT [FK_HR_EmpBranchPerm_User]
        FOREIGN KEY ([UserMasterID]) REFERENCES [dbo].[HR_UserMaster]([UserMasterID]);
END
GO

/* HR_PunchLocations.MultiPunchOid -> HR_DailyAttendanceMultiPunch.Oid */
IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = N'FK_HR_PunchLocations_MultiPunch')
   AND OBJECT_ID(N'dbo.HR_PunchLocations', N'U') IS NOT NULL
   AND OBJECT_ID(N'dbo.HR_DailyAttendanceMultiPunch', N'U') IS NOT NULL
BEGIN
    ALTER TABLE [dbo].[HR_PunchLocations] WITH NOCHECK
        ADD CONSTRAINT [FK_HR_PunchLocations_MultiPunch]
        FOREIGN KEY ([MultiPunchOid]) REFERENCES [dbo].[HR_DailyAttendanceMultiPunch]([Oid])
        ON DELETE CASCADE;
END
GO

/* HR_PunchPhotos.MultiPunchOid -> HR_DailyAttendanceMultiPunch.Oid (ON DELETE CASCADE) */
IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = N'FK_HR_PunchPhotos_MultiPunch')
   AND OBJECT_ID(N'dbo.HR_PunchPhotos', N'U') IS NOT NULL
   AND OBJECT_ID(N'dbo.HR_DailyAttendanceMultiPunch', N'U') IS NOT NULL
BEGIN
    ALTER TABLE [dbo].[HR_PunchPhotos] WITH NOCHECK
        ADD CONSTRAINT [FK_HR_PunchPhotos_MultiPunch]
        FOREIGN KEY ([MultiPunchOid]) REFERENCES [dbo].[HR_DailyAttendanceMultiPunch]([Oid])
        ON DELETE CASCADE;
END
GO

/* ============================================================================
   4. HELPFUL NONCLUSTERED INDEXES (hot app lookups)
   ============================================================================ */

/* Email login lookup */
IF OBJECT_ID(N'dbo.HR_UserMaster', N'U') IS NOT NULL
   AND NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_HR_UserMaster_Email' AND object_id = OBJECT_ID(N'dbo.HR_UserMaster'))
BEGIN
    CREATE NONCLUSTERED INDEX [IX_HR_UserMaster_Email]
        ON [dbo].[HR_UserMaster]([Email] ASC) INCLUDE ([PasswordHash], [Role], [Status], [EmployeeMasterID]);
END
GO

/* Attendance (multi-punch) by employee + date */
IF OBJECT_ID(N'dbo.HR_DailyAttendanceMultiPunch', N'U') IS NOT NULL
   AND NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_HR_DAMP_Employee_Date' AND object_id = OBJECT_ID(N'dbo.HR_DailyAttendanceMultiPunch'))
BEGIN
    CREATE NONCLUSTERED INDEX [IX_HR_DAMP_Employee_Date]
        ON [dbo].[HR_DailyAttendanceMultiPunch]([EmployeeMasterID] ASC, [AttendDate] ASC);
END
GO

/* Single-punch daily attendance by employee + date (leave-stamp UPDATE target) */
IF OBJECT_ID(N'dbo.HR_DailyAttendance', N'U') IS NOT NULL
   AND NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_HR_DailyAttendance_Employee_Date' AND object_id = OBJECT_ID(N'dbo.HR_DailyAttendance'))
BEGIN
    CREATE NONCLUSTERED INDEX [IX_HR_DailyAttendance_Employee_Date]
        ON [dbo].[HR_DailyAttendance]([EmployeeMasterID] ASC, [AttendDate] ASC);
END
GO

/* Leave applications by applicant + status */
IF OBJECT_ID(N'dbo.HR_LeaveApplication', N'U') IS NOT NULL
   AND NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_HR_LeaveApplication_Emp_Status' AND object_id = OBJECT_ID(N'dbo.HR_LeaveApplication'))
BEGIN
    CREATE NONCLUSTERED INDEX [IX_HR_LeaveApplication_Emp_Status]
        ON [dbo].[HR_LeaveApplication]([EmployeeMasterID] ASC, [Status] ASC)
        INCLUDE ([FromDate], [ToDate], [LeaveMasterID]);
END
GO

/* Approval chain lookup by approver + active flag */
IF OBJECT_ID(N'dbo.HR_LeaveAppAuthLeavel', N'U') IS NOT NULL
   AND NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_HR_LeaveAppAuth_Reporting_Active' AND object_id = OBJECT_ID(N'dbo.HR_LeaveAppAuthLeavel'))
BEGIN
    CREATE NONCLUSTERED INDEX [IX_HR_LeaveAppAuth_Reporting_Active]
        ON [dbo].[HR_LeaveAppAuthLeavel]([ReportingPersonID] ASC, [IsActive] ASC)
        INCLUDE ([AuthStatus], [LeaveApplicationID], [LeaveAuthLevel]);
END
GO

/* Attendance adjustments by employee + soft-delete flag */
IF OBJECT_ID(N'dbo.HR_AttendenceAdjustment', N'U') IS NOT NULL
   AND NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_HR_AttendenceAdjustment_Emp_Status' AND object_id = OBJECT_ID(N'dbo.HR_AttendenceAdjustment'))
BEGIN
    CREATE NONCLUSTERED INDEX [IX_HR_AttendenceAdjustment_Emp_Status]
        ON [dbo].[HR_AttendenceAdjustment]([EmployeeMasterID] ASC, [Status] ASC)
        INCLUDE ([AttendenceDate], [Type], [ApprovalStatus]);
END
GO

/* Salary confirmation by employee + period */
IF OBJECT_ID(N'dbo.HR_PayrollSalaryConfirmation', N'U') IS NOT NULL
   AND NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_HR_PayrollConf_Emp_Period' AND object_id = OBJECT_ID(N'dbo.HR_PayrollSalaryConfirmation'))
BEGIN
    CREATE NONCLUSTERED INDEX [IX_HR_PayrollConf_Emp_Period]
        ON [dbo].[HR_PayrollSalaryConfirmation]([EmployeeMasterID] ASC, [PayrollYear] ASC, [PayrollMonth] ASC);
END
GO

/* ============================================================================
   5. STORED PROCEDURES (version-safe DROP + CREATE)
      Only csp_Payroll_InsertLeaveApprovalLevels and csp_HR_ValidateLeaveApplication
      are executed by name at runtime; the rest are provided for completeness.
   ============================================================================ */

IF OBJECT_ID(N'dbo.csp_Payroll_InsertLeaveApprovalLevels', N'P') IS NOT NULL DROP PROCEDURE [dbo].[csp_Payroll_InsertLeaveApprovalLevels];
GO
CREATE PROCEDURE [dbo].[csp_Payroll_InsertLeaveApprovalLevels]
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
          AND e.ReportingPersonID IS NOT NULL      -- no chain -> no rows

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

IF OBJECT_ID(N'dbo.csp_HR_ValidateLeaveApplication', N'P') IS NOT NULL DROP PROCEDURE [dbo].[csp_HR_ValidateLeaveApplication];
GO
CREATE PROCEDURE [dbo].[csp_HR_ValidateLeaveApplication]
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

    -- Period lock (attendance locked for category/branch) -- optional table
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

    -- Declarative rules from HR_LeavePolicyRule (MinNoticeDays) -- optional table
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

IF OBJECT_ID(N'dbo.csp_HR_ValidateAttendanceAdjustment', N'P') IS NOT NULL DROP PROCEDURE [dbo].[csp_HR_ValidateAttendanceAdjustment];
GO
CREATE PROCEDURE [dbo].[csp_HR_ValidateAttendanceAdjustment]
    @EmployeeMasterID   INT,
    @CompanyMasterID    INT,
    @AttendenceDate     DATE,
    @Type               NVARCHAR(50),
    @InTime             TIME,
    @OutTime            TIME,
    -- Output
    @IsValid            BIT           OUTPUT,
    @ValidationMessage  NVARCHAR(500) OUTPUT
AS
-- NOTE: the source cryogas body carried a stray debug
-- "SELECT * FROM HR_EmployeeMaster where EmployeeMasterID = 30" and a
-- commented-out DECLARE test block right after AS. Both were removed here
-- (they leaked data / added a spurious result set). Logic is otherwise
-- unchanged. This SP is not called by name at runtime.
BEGIN
    SET NOCOUNT ON;

    -- Default: assume valid until a check fails
    SET @IsValid           = 1;
    SET @ValidationMessage = '';
    DECLARE @Count INT = 0;

    IF @Type IN ('Early Going', 'Late Coming')
    BEGIN

        -- CHECK 1: Employee must exist, be active, and belong to the same company.
        IF NOT EXISTS (
            SELECT 1
            FROM   HR_EmployeeMaster
            WHERE  EmployeeMasterID = @EmployeeMasterID
              AND  Status           = 1
              AND  JobStatus        = 'Active'
              AND  CompanyMasterID  = @CompanyMasterID
        )
        BEGIN
            SET @IsValid           = 0;
            SET @ValidationMessage = 'Employee is not active or does not exist in your company.';
            RETURN;
        END

        -- CHECK 2: Attendance date must not be in the future.
        IF @AttendenceDate > CAST(GETDATE() AS DATE)
        BEGIN
            SET @IsValid           = 0;
            SET @ValidationMessage = 'Attendance date cannot be in the future.';
            RETURN;
        END

        -- CHECK 3: A base attendance record must exist and not be salary-confirmed.
        IF NOT EXISTS (
            SELECT 1
            FROM   HR_DailyAttendance
            WHERE  EmployeeMasterID      = @EmployeeMasterID
              AND  AttendDate             = @AttendenceDate
              AND  CompanyMasterID        = @CompanyMasterID
              AND  PayrollConfirmationID  = 0
        )
        BEGIN
            SET @IsValid           = 0;
            SET @ValidationMessage = 'No open attendance record exists for this employee on the selected date. '
                                   + 'Either the date has no attendance entry or the period is already salary-confirmed.';
            RETURN;
        END

        -- CHECK 4: No duplicate active adjustment for employee + date + type.
        IF EXISTS (
            SELECT 1
            FROM   HR_AttendenceAdjustment
            WHERE  EmployeeMasterID = @EmployeeMasterID
              AND  AttendenceDate   = @AttendenceDate
              AND  [Type]           = @Type
              AND  Status           = 1
              AND  ApprovalStatus  <> 'Rejected'
        )
        BEGIN
            SET @IsValid           = 0;
            SET @ValidationMessage = 'An active adjustment of type "' + @Type
                                   + '" already exists for this employee on the selected date.';
            RETURN;
        END

        -- CHECK 5: In Time must be earlier than Out Time.
        IF @InTime >= @OutTime
        BEGIN
            SET @IsValid           = 0;
            SET @ValidationMessage = 'In Time must be earlier than Out Time.';
            RETURN;
        END

        -- Monthly cap: no more than 3 short leaves in the month.
        SELECT @Count = count(*) FROM HR_AttendenceAdjustment
        WHERE MONTH(AttendenceDate) = month(@AttendenceDate) AND YEAR(AttendenceDate) = YEAR(@AttendenceDate)
          AND EmployeeMasterID = @EmployeeMasterID AND ApprovalStatus in ('','Approved','Pending')
          AND Status = 1;

        IF @Count >= 3
        BEGIN
            SET @IsValid           = 0;
            SET @ValidationMessage = 'You have crossed the maximum limit of short leave allowed';
            RETURN;
        END

        -- Daily cap: only one per day.
        SELECT @Count = count(*) FROM HR_AttendenceAdjustment
        WHERE (AttendenceDate) = (@AttendenceDate)
          AND EmployeeMasterID = @EmployeeMasterID AND ApprovalStatus not in ('Reject') AND Status = 1;

        IF @Count >= 1
        BEGIN
            SET @IsValid           = 0;
            SET @ValidationMessage = 'You have already applied for that day ';
            RETURN;
        END

        -- CHECK 6: Both times must fall inside the SAME permitted window
        --          Morning 09:00-11:30 (Late Coming) or Evening 16:00-18:30 (Early Going).
        DECLARE @MorningStart TIME = '09:00:00';
        DECLARE @MorningEnd   TIME = '11:30:00';
        DECLARE @EveningStart TIME = '16:00:00';
        DECLARE @EveningEnd   TIME = '18:30:00';

        DECLARE @InMorning  BIT = CASE WHEN @InTime  BETWEEN @MorningStart AND @MorningEnd AND @Type = 'Late Coming' THEN 1 ELSE 0 END;
        DECLARE @OutMorning BIT = CASE WHEN @OutTime BETWEEN @MorningStart AND @MorningEnd AND @Type = 'Late Coming' THEN 1 ELSE 0 END;
        DECLARE @InEvening  BIT = CASE WHEN @InTime  BETWEEN @EveningStart AND @EveningEnd AND @Type = 'Early Going' THEN 1 ELSE 0 END;
        DECLARE @OutEvening BIT = CASE WHEN @OutTime BETWEEN @EveningStart AND @EveningEnd AND @Type = 'Early Going' THEN 1 ELSE 0 END;

        IF NOT (
                (@InMorning = 1 AND @OutMorning = 1)
             OR (@InEvening = 1 AND @OutEvening = 1)
           )
        BEGIN
            SET @IsValid           = 0;
            SET @ValidationMessage = 'In Time and Out Time must both fall within an allowed window: '
                                   + '09:00 - 11:30 (Morning) or 16:00 - 18:30 (Evening).';
            RETURN;
        END

    END
END
GO

IF OBJECT_ID(N'dbo.SP_ValidateAttendanceAdjustment', N'P') IS NOT NULL DROP PROCEDURE [dbo].[SP_ValidateAttendanceAdjustment];
GO
CREATE PROCEDURE [dbo].[SP_ValidateAttendanceAdjustment]
(
    @EmployeeMasterID BIGINT,
    @CompanyMasterID BIGINT,
    @AttendenceDate DATETIME,
    @Type NVARCHAR(50),
    @InTime DATETIME,
    @OutTime DATETIME,
    @Oid BIGINT = NULL, -- Used only for Edit mode
    @ErrorMessage NVARCHAR(500) OUTPUT
)
AS
BEGIN

SET NOCOUNT ON;

DECLARE @DurationMinutes INT
DECLARE @Start TIME
DECLARE @End TIME

SET @Start = CAST(@InTime AS TIME)
SET @End = CAST(@OutTime AS TIME)

SET @DurationMinutes = DATEDIFF(MINUTE, @InTime, @OutTime)

------------------------------------------------
-- 1 BASIC VALIDATION
------------------------------------------------

IF (@OutTime <= @InTime)
BEGIN
    SET @ErrorMessage = 'Out Time must be greater than In Time.'
    RETURN
END

------------------------------------------------
-- 2 LATE COMING / EARLY GOING POLICY
------------------------------------------------

IF (@Type = 'Late Coming' OR @Type = 'Early Going')
BEGIN

    -- Maximum 2 hours
    IF (@DurationMinutes > 120)
    BEGIN
        SET @ErrorMessage = 'Late Coming / Early Going cannot exceed 2 hours.'
        RETURN
    END

    -- Time Slot Validation

    IF (@Type = 'Late Coming')
    BEGIN
        IF NOT (@Start >= '09:00' AND @End <= '11:00')
        BEGIN
            SET @ErrorMessage = 'Late Coming allowed only between 9:00 AM and 11:00 AM.'
            RETURN
        END
    END

    IF (@Type = 'Early Going')
    BEGIN
        IF NOT (@Start >= '16:00' AND @End <= '18:00')
        BEGIN
            SET @ErrorMessage = 'Early Going allowed only between 4:00 PM and 6:00 PM.'
            RETURN
        END
    END

    ------------------------------------------------
    -- Daily Limit
    ------------------------------------------------

    IF (
        SELECT COUNT(*)
        FROM HR_AttendenceAdjustment
        WHERE EmployeeMasterID = @EmployeeMasterID
        AND AttendenceDate = @AttendenceDate
        AND Type IN ('Late Coming','Early Going')
        AND Status = 1
        AND (@Oid IS NULL OR Oid <> @Oid)
       ) >= 1
    BEGIN
        SET @ErrorMessage = 'Only one Late Coming / Early Going allowed per day.'
        RETURN
    END

    ------------------------------------------------
    -- Monthly Limit
    ------------------------------------------------

    IF (
        SELECT COUNT(*)
        FROM HR_AttendenceAdjustment
        WHERE EmployeeMasterID = @EmployeeMasterID
        AND MONTH(AttendenceDate) = MONTH(@AttendenceDate)
        AND YEAR(AttendenceDate) = YEAR(@AttendenceDate)
        AND Type IN ('Late Coming','Early Going')
        AND Status = 1
        AND (@Oid IS NULL OR Oid <> @Oid)
       ) >= 3
    BEGIN
        SET @ErrorMessage = 'Maximum 3 Late Coming / Early Going allowed per month.'
        RETURN
    END

END

------------------------------------------------
-- 3 DUPLICATE ENTRY CHECK
------------------------------------------------

IF EXISTS
(
    SELECT 1
    FROM HR_AttendenceAdjustment
    WHERE EmployeeMasterID = @EmployeeMasterID
    AND AttendenceDate = @AttendenceDate
    AND Type = @Type
    AND Status = 1
    AND (@Oid IS NULL OR Oid <> @Oid)
)
BEGIN
    SET @ErrorMessage = 'Entry already exists for this employee and date.'
    RETURN
END

------------------------------------------------
-- SUCCESS
------------------------------------------------

SET @ErrorMessage = NULL

END
GO

IF OBJECT_ID(N'dbo.HR_SalarySlip', N'P') IS NOT NULL DROP PROCEDURE [dbo].[HR_SalarySlip];
GO
CREATE PROCEDURE [dbo].[HR_SalarySlip]
(
@EmployeeMasterId int ,
@Payrollyear Int,
@PayrollMonth Int
)
AS
 select EMP.code As EmployeeCode , EMP.FirstName +' '+  EMP.LastName as EmpName ,'' as MachineCode , CTg.Description as CategoryNmae  ,Pay.PayrollMonth ,Pay.PayrollYear ,
 Pay.BasicAmount  ,Pay.MasterNetpay,Pay.Monthdays,Pay.Totalpaydays
 ,   -- attedn fields
 attend.AbsentDays ,attend.PresentDays ,attend.HalfDays ,attend.HalfLeaveDays ,attend.Holidays ,attend.LeaveDays
 ,attend.MonthDays as AttednMonthDays,
 attend.WeekOffDays ,attend.WorkingDays , Br.address as BrAddress, Br.city as BrCity,Cmp.address as CmpAddress ,Cmp.City as CmpCity ,
 Cmp.name as CmpName , Br.name as BrName , Br.UnitMasterID , Cmp.CompanyMasterID , EMp.EmployeeMasterID
 ,desg.DesignationName , DPT.DepartmentName   ,pay.CalculatedNetPay ,
 pay.PayrollMonth  as Month1 , pay.PayrollYear  as Year1   , br.UnitMasterID,
 emp.DateOfBirth , emp.DateOfJoining ,ebank.AccountNo,ebank.Branch ,emp.AadharCardNo,emp.PFNo ,emp.ESICNo ,emp.panno ,emp.UAN, pay.Oid

 from  Hr_PayrollSalaryConfirmation Pay
 left outer join HR_EmployeeMaster Emp on Pay.EmployeeMasterId =EMp.EmployeeMasterID
 left outer join HR_MonthlyAttendance attend on Emp.EmployeeMasterID =attend.EmployeeMasterID
 and attend.AttendMonth=pay.PayrollMonth and attend.AttendYear =pay.PayrollYear
 and attend.EmployeeMasterID  =pay.EmployeeMasterID
 left outer join HR_CategoryMaster CTG on Emp.CategoryMasterID =CTG.CategoryMasterID left outer join Company Cmp on Pay.CompanyMasterId=Cmp.CompanyMasterId
 left join HR_EmployeeBankDetails  ebank ON ebank.EmployeeMasterID = emp.EmployeeMasterID
 left outer join Unit Br on Br.UnitMasterID =Pay.BranchMasterId  left outer join HR_DesignationMaster Desg on Desg.DesignationMasterID =Emp.DesignationMasterID
 left outer join HR_DepartmentMaster Dpt on Emp.DepartmentMasterID =Dpt.DepartmentMasterID

	   WHERE PAY.EmployeeMasterID =@EmployeeMasterId AND PAY.PayrollMonth =@PayrollMonth  AND PAY.PayrollYear =@Payrollyear
GO

IF OBJECT_ID(N'dbo.HR_SalarySlip_SingleSP', N'P') IS NOT NULL DROP PROCEDURE [dbo].[HR_SalarySlip_SingleSP];
GO
CREATE PROCEDURE [dbo].[HR_SalarySlip_SingleSP]
(
    @Year NVARCHAR(MAX),
    @Month NVARCHAR(MAX),
    @EmployeeMasterID BIGINT
)
AS
BEGIN
    SET NOCOUNT ON;

    IF OBJECT_ID('tempdb..#tmp_emp_payroll') IS NOT NULL
        DROP TABLE #tmp_emp_payroll;

    CREATE TABLE #tmp_emp_payroll
    (
        EmpMasterid BIGINT,
        Empname NVARCHAR(1500),
        EmpCode NVARCHAR(1500),
        BranchName NVARCHAR(1500),
        DepartmentMasterID BIGINT,
        Department NVARCHAR(1500),
        Designation NVARCHAR(1500),
        CategoryName NVARCHAR(1500),
        DateofJoining DATE,
        PFNO NVARCHAR(1500),
        ESINo NVARCHAR(1500),
        UANNO NVARCHAR(1500),
        BankName NVARCHAR(1500),
        BankAccountNo NVARCHAR(1500),
        PayrollYear NUMERIC(18,0),
        PayrollMonth NUMERIC(18,0),
        BranchMasterID BIGINT,

        NetPay NUMERIC(18,2),

        Mast_Basic NUMERIC(12,2),
        Mast_DA NUMERIC(12,2),
        Mast_Hra NUMERIC(12,2),
        Mast_SPECIALALLOWANCE NUMERIC(12,2),
        Mast_LTA NUMERIC(12,2),
        Mast_CONVEYANCEALLOWANCE NUMERIC(12,2),
		Mast_Incentive numeric(12,2),
        Mast_Total NUMERIC(12,2),


        Act_Basic NUMERIC(18,2),
        Act_Da NUMERIC(12,2),
        Act_Hra NUMERIC(18,2),
        Act_SPECIALALLOWANCE NUMERIC(12,2),
        Act_LTA NUMERIC(18,2),
        Act_CONVEYANCEALLOWANCE NUMERIC(12,2),
		Act_Incentive numeric(12,2),
        Act_Total NUMERIC(18,2),

        GrossSalary NUMERIC(12,2),

        Ded_PF NUMERIC(12,2),
        Ded_PT NUMERIC(12,2),
        Ded_VPF NUMERIC(12,2),
        Ded_HealthInsurance NUMERIC(12,2),
        Ded_OTHERDEDUCTION NUMERIC(12,2),
        Ded_TDS NUMERIC(12,2),
        Ded_Staff_Advance NUMERIC(12,2),
        Ded_Staff_Loan NUMERIC(12,2),
		Ded_ESIC NUMERIC(12,2),
        Ded_Total NUMERIC(12,2),

        PF_EMPLOYER NUMERIC(12,2),
		ESIC_EMPLOYER NUMERIC(12,2),
        Admin_Charges NUMERIC(12,2),

        Att_PaidDays NUMERIC(12,2),
        Att_LWPDays NUMERIC(12,2),
		Att_PresentDays NUMERIC(12,2),

        Att_PL NUMERIC(12,2),
        Att_CL NUMERIC(12,2),
        Att_Coff NUMERIC(12,2),
		Att_SL NUMERIC(12,2),

        PL_Balance NUMERIC(12,2),
        CL_Balance NUMERIC(12,2),
        Coff_Balance NUMERIC(12,2),
		SL_Balance NUMERIC(12,2),
    );

    /* ================= Payroll Data ================= */

    INSERT INTO #tmp_emp_payroll
    (
        EmpMasterid,EmpCode,Empname,BranchName,DepartmentMasterID,Department,
        Designation,CategoryName,DateofJoining,PFNO,ESINo,UANNO,
        BankName,BankAccountNo,PayrollYear,PayrollMonth,BranchMasterID,
        NetPay,Mast_Basic,Mast_DA,Mast_Hra,Mast_SPECIALALLOWANCE,
        Mast_LTA,Mast_CONVEYANCEALLOWANCE,Mast_Incentive,
        Act_Basic,Act_Da,Act_Hra,Act_SPECIALALLOWANCE,
        Act_LTA,Act_CONVEYANCEALLOWANCE,Act_Incentive,
        GrossSalary,Ded_PF,Ded_PT,Ded_VPF,Ded_HealthInsurance,
        Ded_OTHERDEDUCTION,Ded_TDS,Ded_Staff_Advance,Ded_Staff_Loan,Ded_ESIC,
        PF_EMPLOYER,ESIC_EMPLOYER,Admin_Charges
    )
    SELECT
        EM.EmployeeMasterID,
        EM.Code,
        MAX(EM.FirstName + ' ' + EM.FatherName + ' ' + EM.LastName),
        MAX(U.Name),
        DPT.DepartmentMasterID,
        DPT.DepartmentName,
        MAX(DESG.DesignationName),
        MAX(CAT.Name),
        EM.DateOfJoining,
        MAX(EM.PFNo),
        MAX(EM.ESICNo),
        MAX(EM.UAN),
        MAX(EB.Name),
        MAX(EB.AccountNo),
        PSC.PayrollYear,
        PSC.PayrollMonth,
        PSC.BranchMasterID,
        MAX(PSC.CalculatedNetPay),

		--Master Addition
        MAX(CASE WHEN SH.Name='BASIC' THEN PSCD.Amount ELSE 0 END),
        MAX(CASE WHEN SH.Name='DA' THEN PSCD.Amount ELSE 0 END),
        MAX(CASE WHEN SH.Name='HRA' THEN PSCD.Amount ELSE 0 END),
        MAX(CASE WHEN SH.Name='SPECIAL ALLOWANCE' THEN PSCD.Amount ELSE 0 END),
        MAX(CASE WHEN SH.Name='LTA' THEN PSCD.Amount ELSE 0 END),
        MAX(CASE WHEN SH.Name='CONVEYANCE ALLOWANCE' THEN PSCD.Amount ELSE 0 END),
		MAX(CASE WHEN SH.Name='INCENTIVE' THEN PSCD.Amount ELSE 0 END),

        MAX(CASE WHEN SH.Name='BASIC' THEN PSCD.CalculatedAmount ELSE 0 END),
        MAX(CASE WHEN SH.Name='DA' THEN PSCD.CalculatedAmount ELSE 0 END),
        MAX(CASE WHEN SH.Name='HRA' THEN PSCD.CalculatedAmount ELSE 0 END),
        MAX(CASE WHEN SH.Name='SPECIAL ALLOWANCE' THEN PSCD.CalculatedAmount ELSE 0 END),
        MAX(CASE WHEN SH.Name='LTA' THEN PSCD.CalculatedAmount ELSE 0 END),
        MAX(CASE WHEN SH.Name='CONVEYANCE ALLOWANCE' THEN PSCD.CalculatedAmount ELSE 0 END),
	    MAX(CASE WHEN SH.Name='INCENTIVE' THEN PSCD.CalculatedAmount ELSE 0 END),

        MAX(PSC.GrossAmount),

        MAX(CASE WHEN REPLACE(REPLACE(SH.Name,'-',''),' ','')='PFEMPLOYEECONTRIBUTION' THEN PSCD.CalculatedAmount ELSE 0 END),
        MAX(CASE WHEN SH.Name='PROFESSIONAL TAX' THEN PSCD.CalculatedAmount ELSE 0 END),
        MAX(CASE WHEN SH.Name='VPF' THEN PSCD.CalculatedAmount ELSE 0 END),
        MAX(CASE WHEN SH.Name='HEALTH INSURANCE' THEN PSCD.CalculatedAmount ELSE 0 END),
        MAX(CASE WHEN SH.Name='OTHER DEDUCTION' THEN PSCD.CalculatedAmount ELSE 0 END),
        MAX(CASE WHEN SH.Name='TDS' THEN PSCD.CalculatedAmount ELSE 0 END),
        MAX(CASE WHEN SH.Name='STAFF ADVANCE' THEN PSCD.CalculatedAmount ELSE 0 END),
        MAX(CASE WHEN SH.Name='STAFF LOAN' THEN PSCD.CalculatedAmount ELSE 0 END),
		MAX(CASE WHEN UPPER(REPLACE(REPLACE(SH.Name,'-',''),' ','')) IN ('ESICEMPLOYEECONTRIBUTION','ESICEMPLOYEE') THEN PSCD.CalculatedAmount ELSE 0 END),
        MAX(CASE WHEN REPLACE(REPLACE(SH.Name,'-',''),' ','')='PFEMPLOYERCONTRIBUTION' THEN PSCD.CalculatedAmount ELSE 0 END),
		MAX(CASE WHEN UPPER(REPLACE(REPLACE(SH.Name,'-',''),' ','')) IN ('ESICEMPLOYERCONTRIBUTION','ESICEMPLOYER') THEN PSCD.CalculatedAmount ELSE 0 END),
        MAX(CASE WHEN SH.Name='ADMIN CHARGES' THEN PSCD.CalculatedAmount ELSE 0 END)


    FROM HR_PayrollSalaryConfirmation PSC
    INNER JOIN HR_PayrollSalaryConfirmationDetails PSCD ON PSC.Oid=PSCD.PayrollConfirmationID
    INNER JOIN HR_SalaryHeadMaster SH ON SH.SalaryHeadMasterID=PSCD.SalaryHeadMasterID
    INNER JOIN HR_EmployeeMaster EM ON EM.EmployeeMasterID=PSC.EmployeeMasterID
    LEFT JOIN HR_DepartmentMaster DPT ON DPT.DepartmentMasterID=EM.DepartmentMasterID
    LEFT JOIN HR_CategoryMaster CAT ON CAT.CategoryMasterID=EM.CategoryMasterID
    LEFT JOIN HR_DesignationMaster DESG ON DESG.DesignationMasterID=EM.DesignationMasterID
    LEFT JOIN HR_EmployeeBankDetails EB ON EB.EmployeeMasterID=EM.EmployeeMasterID
    LEFT JOIN Unit U ON U.UnitMasterId=PSC.BranchMasterID
    WHERE PSC.PayrollYear=@Year
      AND PSC.PayrollMonth=@Month
      AND PSC.EmployeeMasterID=@EmployeeMasterID
    GROUP BY EM.EmployeeMasterID,EM.Code,PSC.PayrollYear,PSC.PayrollMonth,
             PSC.BranchMasterID,EM.DateOfJoining,
             DPT.DepartmentName,DPT.DepartmentMasterID;

    /* ================= Attendance ================= */

    UPDATE t
    SET
        Att_PaidDays = a.TotalPayDays,
        Att_LWPDays  = a.AbsentDays,
		Att_PresentDays = a.PresentDays
    FROM #tmp_emp_payroll t
    JOIN HR_MonthlyAttendance a
        ON a.EmployeeMasterID=t.EmpMasterid
    WHERE a.AttendYear=@Year AND a.AttendMonth=@Month;

    /* ================= Leave as per Payroll Cycle ================= */

    DECLARE @FromDate DATE, @ToDate DATE;

    SELECT @FromDate=PSC.FromDate, @ToDate=PSC.ToDate
    FROM HR_PayrollSalaryConfirmation PSC
    WHERE PSC.EmployeeMasterID=@EmployeeMasterID
      AND PSC.PayrollYear=@Year
      AND PSC.PayrollMonth=@Month;

    /* ---- PL / CL / COFF / SL ---- */

    UPDATE t
    SET
        Att_PL = ISNULL(pl.TotalLeave,0),
        Att_CL = ISNULL(cl.TotalLeave,0),
        Att_Coff = ISNULL(cf.TotalLeave,0),
		Att_SL = ISNULL(sl.TotalLeave,0)
    FROM #tmp_emp_payroll t
    OUTER APPLY (
        SELECT SUM(ha.AppliedDay) TotalLeave
        FROM HR_LeaveApplication ha
        JOIN HR_LeaveMaster lm ON lm.LeaveMasterID=ha.LeaveMasterID
        WHERE ha.EmployeeMasterID=t.EmpMasterid
          AND ha.Status='Approved'
          AND ha.FromDate BETWEEN @FromDate AND @ToDate
          AND UPPER(REPLACE(lm.Name,' ','')) IN ('PL','PAIDLEAVE')
    ) pl
    OUTER APPLY (
        SELECT SUM(ha.AppliedDay) TotalLeave
        FROM HR_LeaveApplication ha
        JOIN HR_LeaveMaster lm ON lm.LeaveMasterID=ha.LeaveMasterID
        WHERE ha.EmployeeMasterID=t.EmpMasterid
          AND ha.Status='Approved'
          AND ha.FromDate BETWEEN @FromDate AND @ToDate
          AND REPLACE(UPPER(lm.Name),' ','') IN ('CL','CASUALLEAVE')
    ) cl
    OUTER APPLY (
        SELECT SUM(ha.AppliedDay) TotalLeave
        FROM HR_LeaveApplication ha
        JOIN HR_LeaveMaster lm ON lm.LeaveMasterID=ha.LeaveMasterID
        WHERE ha.EmployeeMasterID=t.EmpMasterid
          AND ha.Status='Approved'
          AND ha.FromDate BETWEEN @FromDate AND @ToDate
          AND REPLACE(REPLACE(UPPER(lm.Name),'-',''),' ','')
              IN ('COFF','COMPOFF','COMPENSATORYOFF')
    ) cf

	OUTER APPLY (
    SELECT SUM(ha.AppliedDay) TotalLeave
    FROM HR_LeaveApplication ha
    JOIN HR_LeaveMaster lm ON lm.LeaveMasterID=ha.LeaveMasterID
    WHERE ha.EmployeeMasterID=t.EmpMasterid
      AND ha.Status='Approved'
      AND ha.FromDate BETWEEN @FromDate AND @ToDate
      AND REPLACE(UPPER(lm.Name),' ','') IN ('SL','SICKLEAVE')) sl;

    /* ================= Leave Balance ================= */

    UPDATE t
    SET
        PL_Balance = lm.Balance - ISNULL(t.Att_PL,0)
    FROM #tmp_emp_payroll t
    JOIN HR_LeaveMaster lm
        ON UPPER(REPLACE(lm.Name,' ','')) IN ('PL','PAIDLEAVE');

    UPDATE t
    SET
        CL_Balance = lm.Balance - ISNULL(t.Att_CL,0)
    FROM #tmp_emp_payroll t
    JOIN HR_LeaveMaster lm
        ON REPLACE(UPPER(lm.Name),' ','') IN ('CL','CASUALLEAVE');

    UPDATE t
    SET
        Coff_Balance = lm.Balance - ISNULL(t.Att_Coff,0)
    FROM #tmp_emp_payroll t
    JOIN HR_LeaveMaster lm
        ON REPLACE(REPLACE(UPPER(lm.Name),'-',''),' ','')
           IN ('COFF','COMPOFF','COMPENSATORYOFF');


	UPDATE t
	SET
		SL_Balance = lm.Balance - ISNULL(t.Att_SL,0)
	FROM #tmp_emp_payroll t
	JOIN HR_LeaveMaster lm
    ON REPLACE(UPPER(lm.Name),' ','') IN ('SL','SICKLEAVE');

    /* ================= Totals ================= */

    UPDATE t
    SET
        Mast_Total = Mast_Basic + Mast_DA + Mast_Hra + Mast_SPECIALALLOWANCE + Mast_LTA + Mast_CONVEYANCEALLOWANCE + Mast_Incentive,
        Act_Total  = Act_Basic + Act_Da + Act_Hra + Act_SPECIALALLOWANCE + Act_LTA + Act_CONVEYANCEALLOWANCE + Act_Incentive,
        Ded_Total  = Ded_PF + Ded_VPF + Ded_PT + Ded_HealthInsurance + Ded_ESIC+
                     Ded_OTHERDEDUCTION + Ded_TDS + Ded_Staff_Advance + Ded_Staff_Loan
    FROM #tmp_emp_payroll t;



    SELECT * FROM #tmp_emp_payroll;
END
GO

IF OBJECT_ID(N'dbo.csp_Payroll_GetEmployeeLeaveBalance', N'P') IS NOT NULL DROP PROCEDURE [dbo].[csp_Payroll_GetEmployeeLeaveBalance];
GO
CREATE PROCEDURE [dbo].[csp_Payroll_GetEmployeeLeaveBalance]
    @EmployeeMasterID   INT,
    @AsOfDate           DATE    = NULL,
    @YearID             INT     = NULL,
    @CompanyMasterID    INT     = NULL,
    @IsAdmin            BIT     = 0
AS
BEGIN
    SET NOCOUNT ON;

    IF @AsOfDate IS NULL
        SET @AsOfDate = CAST(GETDATE() AS DATE);

    ------------------------------------------------------------
    -- C-OFF CONFIG
    ------------------------------------------------------------
    DECLARE @COffLeaveMasterID INT = 0;
    DECLARE @COffValidity INT = 0;

    SELECT TOP 1
        @COffLeaveMasterID = lm.LeaveMasterID,
        @COffValidity = ISNULL(lm.Validity, 0)
    FROM HR_LeaveMaster lm
    WHERE lm.IsActive = 1
      AND (
            UPPER(lm.Name) LIKE '%C-OFF%'
         OR UPPER(lm.Code) LIKE '%C-OFF%'
         OR UPPER(lm.Name) LIKE '%COMP%OFF%'
      )
      AND (@CompanyMasterID IS NULL OR lm.CompanyMasterID = @CompanyMasterID)
      AND (@YearID IS NULL OR lm.YearID = @YearID);

    ------------------------------------------------------------
    -- C-OFF EARNED
    ------------------------------------------------------------
    DECLARE @COffEarned DECIMAL(10,2) = 0;

    SELECT @COffEarned = ISNULL(SUM(
        CASE
            WHEN UPPER(ca.ApplicationType) = 'HALFDAY' THEN 0.5
            WHEN UPPER(ca.ApplicationType) = 'QUARTERDAY' THEN 0.25
            ELSE 1
        END
    ),0)
    FROM HR_CompOffApplications ca
    WHERE ca.EmployeeMasterID = @EmployeeMasterID
      AND ca.ApplicationStatus = 'Approved'
      AND DATEADD(DAY, @COffValidity, CAST(ca.DocDate AS DATE)) >= @AsOfDate;

    ------------------------------------------------------------
    -- APPLIED (ALL LEAVES)
    ------------------------------------------------------------
    ;WITH AppliedAll AS
    (
        SELECT
            la.LeaveMasterID,
            SUM(la.AppliedDay) AS AppliedDays
        FROM HR_LeaveApplication la
        WHERE la.EmployeeMasterID = @EmployeeMasterID
          AND la.Status IN ('Approved','Pending')
          AND (@YearID IS NULL OR la.YearID = @YearID)
        GROUP BY la.LeaveMasterID
    ),

    ------------------------------------------------------------
    -- APPLIED TILL TODAY (FOR BALANCE)
    ------------------------------------------------------------
    AppliedTillDate AS
    (
        SELECT
            la.LeaveMasterID,
            SUM(la.AppliedDay) AS AppliedDays
        FROM HR_LeaveApplication la
        WHERE la.EmployeeMasterID = @EmployeeMasterID
          AND la.Status IN ('Approved','Pending')
          AND la.FromDate <= @AsOfDate
          AND (@YearID IS NULL OR la.YearID = @YearID)
        GROUP BY la.LeaveMasterID
    )

    ------------------------------------------------------------
    -- MAIN RESULT
    ------------------------------------------------------------
    SELECT
        lm.LeaveMasterID,
        lm.Name,

        CAST(
        CASE
            WHEN X.CalcBalance < 0 THEN 0
            ELSE X.CalcBalance
        END
        AS DECIMAL(10,2)) AS Balance,

        CAST(ISNULL(A.AppliedDays,0) AS DECIMAL(10,2)) AS Applied,

        CAST(
        CASE
            WHEN X.TotalEntitlement - ISNULL(A.AppliedDays,0) < 0 THEN 0
            ELSE X.TotalEntitlement - ISNULL(A.AppliedDays,0)
        END
        AS DECIMAL(10,2)) AS RemainingBalance,

        lm.HalfDayAllowed,
        lm.QuarterDayAllowed,
        ewl.FromDate,
        ewl.ToDate,
        ewl.OpeningBalance

    FROM HR_EmployeeWiseLeave ewl

    JOIN HR_LeaveMaster lm
        ON lm.LeaveMasterID = ewl.LeaveMasterID
        AND lm.IsActive = 1

    LEFT JOIN AppliedAll A
        ON A.LeaveMasterID = ewl.LeaveMasterID

    LEFT JOIN AppliedTillDate T
        ON T.LeaveMasterID = ewl.LeaveMasterID

    CROSS APPLY
    (
        SELECT

        CASE
            WHEN ewl.LeaveMasterID = @COffLeaveMasterID THEN
                @COffEarned

            WHEN lm.Name = 'PL' THEN
                ISNULL(ewl.OpeningBalance,0) + lm.Balance

            WHEN lm.Name = 'CL' THEN
                ISNULL(ewl.OpeningBalance,0) + 6

            WHEN lm.Name = 'SL' THEN
                ISNULL(ewl.OpeningBalance,0) + 6

            ELSE
                ewl.Balance
        END AS TotalEntitlement,

        CASE
            WHEN ewl.LeaveMasterID = @COffLeaveMasterID THEN
                @COffEarned - ISNULL(T.AppliedDays,0)

            WHEN lm.Name = 'PL' THEN
                (ISNULL(ewl.OpeningBalance,0) + lm.Balance)
                - ISNULL(T.AppliedDays,0)

            WHEN lm.Name = 'CL' THEN
                (ISNULL(ewl.OpeningBalance,0) + 6)
                - ISNULL(T.AppliedDays,0)

            WHEN lm.Name = 'SL' THEN
                (ISNULL(ewl.OpeningBalance,0) + 6)
                - ISNULL(T.AppliedDays,0)

            ELSE
                ewl.Balance - ISNULL(T.AppliedDays,0)

        END AS CalcBalance

    ) X

    WHERE ewl.EmployeeMasterID = @EmployeeMasterID
      AND ewl.IsActive = 1
      AND (@YearID IS NULL OR ewl.YearID = @YearID)
      AND (
            @IsAdmin = 1
         OR ISNULL(lm.IsAdminOnly,0) = 0
      )

    ORDER BY lm.LeaveMasterID;

END
GO

IF OBJECT_ID(N'dbo.HR_GetDailyPunch', N'P') IS NOT NULL DROP PROCEDURE [dbo].[HR_GetDailyPunch];
GO
CREATE PROCEDURE [dbo].[HR_GetDailyPunch]
 @CompanyMasterID int,
 @BranchMasterID int,
 @YearID int,
 @AttendYear int,
 @AttendMonth int
AS
BEGIN
	SET NOCOUNT ON;
      if((select ISNULL(count(*), 0) from HR_Period where Oid= @YearID and CAST(CONVERT(VARCHAR, @AttendYear) + '-' + CONVERT(VARCHAR, @AttendMonth) + '-' + CONVERT(VARCHAR, 2) AS DATETIME) between FromDate and ToDate) != 1)
	  begin
		print('YearID Not valid');
		return;
	  end

	--Create blank Temp Table Of HR_DailyAttendanceMultiPunch
	select * INTO #HR_DailyAttendanceMultiPunch from HR_DailyAttendanceMultiPunch where YearID = @YearID and AttendYear = @AttendYear and AttendMonth = @AttendMonth and CompanyMasterID = @CompanyMasterID and BranchMasterID = @BranchMasterID;

	--get the employee
	select
		EmployeeMasterID, CategoryMasterID, ShiftMasterID,
		ROW_NUMBER() OVER (order by employeemasterid) as ID
		INTO #HR_EmployeeMaster
	from
		HR_EmployeeMaster where Status = 1 and CompanyMasterID= @CompanyMasterID and BranchMasterID= @BranchMasterID

	-- 1. loop in employee
	-- 2. generate row according to selected year fromdate to todate

	DECLARE @K int
	DECLARE @rowNo INT

	SET @K = 1;
	SET @rowNo = (SELECT COUNT(*) FROM #HR_EmployeeMaster);
	PRINT ('Row Count: ' + CONVERT(varchar, @rowNo ))

	IF (@rowNo > 0) BEGIN
		WHILE (@K <= (SELECT MAX(ID) FROM #HR_EmployeeMaster)) BEGIN
			DECLARE @EmployeeMasterID int
			DECLARE @CategoryMasterID int
			DECLARE @ShiftMasterID int
			DECLARE @FromDate smalldatetime
			DECLARE @ToDate smalldatetime;
			DECLARE @InTime datetime;
			DECLARE @OutTime datetime;
			DECLARE @ShiftInTime TIME;
			DECLARE @ShiftOutTime TIME;
			DECLARE @AttandStatus nvarchar(2);
			DECLARE @WeekOffList nvarchar(max);
			DECLARE @WeekOff nvarchar(max);
			DECLARE @ActWorkingHours decimal(18,2);
			DECLARE @MasterWorkingHours decimal(18,2);
			DECLARE @WorkingHours decimal(18,2);
			DECLARE @AllowOT bit;
			DECLARE @OTHours decimal(18,2);
			DECLARE @Holiday bigint;
			DECLARE @LeaveID bigint;
			DECLARE @Leave nvarchar(2);
			DECLARE @hours varchar(30)
			DECLARE @minutes varchar(2)
			DECLARE @seconds varchar(30)

			SET @EmployeeMasterID = (SELECT EmployeeMasterID FROM #HR_EmployeeMaster WHERE ID = @K)
			SET @CategoryMasterID = (SELECT CategoryMasterID FROM #HR_EmployeeMaster WHERE ID = @K)
			SET @ShiftMasterID = (SELECT ShiftMasterID FROM #HR_EmployeeMaster WHERE ID = @K)
			SET @ShiftInTime = CONVERT(TIME,(select InTime from HR_ShiftMaster where ShiftMasterID = @ShiftMasterID))
			SET @ShiftOutTime = CONVERT(TIME,(select OutTime from HR_ShiftMaster where ShiftMasterID = @ShiftMasterID))

			SET @FromDate = CAST(CONVERT(VARCHAR, @AttendYear) + '-' + CONVERT(VARCHAR, @AttendMonth) + '-' + CONVERT(VARCHAR, 1) AS DATETIME)

			if(@FromDate < GETDATE())
				SET @ToDate = dateadd(d, -1, dateadd(m, datediff(m, 0, @FromDate) + 1, 0))
			ELSE
				SET @ToDate = GETDATE();

			PRINT(@FromDate)
			PRINT(@ToDate)

			SET @WeekOffList = (select WeeklyOffDay from HR_EmployeeMaster where EmployeeMasterID= @EmployeeMasterID)
			SET @MasterWorkingHours = (select WorkingHours from HR_EmployeeMaster where EmployeeMasterID = @EmployeeMasterID)
			SET @AllowOT = (select OverTime from HR_EmployeeMaster where EmployeeMasterID = @EmployeeMasterID)

			PRINT(@WeekOffList);
			PRINT('Emp ID.:' + cast(@EmployeeMasterID as varchar));

			WHILE (@FromDate <= @ToDate) BEGIN

				SET @WeekOff = (select value from [dbo].[SPLIT](';', @WeekOffList) where value = DATENAME(weekday,@FromDate));
				SET @InTime = DATEADD(MINUTE, DATEPART(MINUTE, @ShiftInTime), DATEADD(HH, DATEPART(HOUR, @ShiftInTime), @FromDate));
				SET @OutTime = DATEADD(MINUTE, DATEPART(MINUTE, @ShiftOutTime), DATEADD(HH, DATEPART(HOUR, @ShiftOutTime), @FromDate));
				SET @Holiday = (select ISNULL(hm.Oid, 0) from HR_EmployeeWiseHoliday ewh inner join HR_HolidayMaster  hm on ewh.HolidayMasterID=hm.Oid WHERE ewh.YearID= @YearID AND EmployeeMasterID = @EmployeeMasterID and hm.Date = @FromDate)
				SET @LeaveID = (select ISNULL(LeaveMasterID, 0) from HR_LeaveApplication WHERE YearID = @YearID AND [Status] = 'Approved' and EmployeeMasterID = @EmployeeMasterID and @FromDate between FromDate and ToDate)
				SET @Leave = (select lm.Name from HR_LeaveApplication la inner join HR_LeaveMaster lm on la.LeaveMasterID=lm.LeaveMasterID WHERE la.YearID = @YearID AND la.[Status] = 'Approved' and la.EmployeeMasterID = @EmployeeMasterID and @FromDate between la.FromDate and la.ToDate)

				PRINT('WeekOff: ' +@WeekOff);
      			PRINT(@InTime)

				IF(@WeekOff <>'') BEGIN
					SET @AttandStatus = 'WO';
				END
				ELSE IF (@Holiday <> 0) BEGIN
					SET @AttandStatus = 'HL';
				END
				ELSE IF (@LeaveID <> 0) BEGIN
					SET @AttandStatus = 'L';
				END
				ELSE BEGIN
					SET @AttandStatus = 'P';
				END

				SET @seconds = DATEDIFF(SECOND,@InTime,@OutTime)
				set @hours = @seconds / 3600
				set @minutes = (@seconds - (@hours * 3600)) / 60
				set @seconds = (@seconds - (@hours * 3600) - (@minutes * 60))
				SET @WorkingHours = convert(decimal(18,2) ,(@hours + '.' + @minutes));

				if(@AllowOT = '1')
					SET @OTHours = @WorkingHours - @MasterWorkingHours;
				else
					SET @OTHours = 0;

				IF((SELECT ISNULL(COUNT(*), 0) FROM HR_DailyAttendanceMultiPunch WHERE AttendDate = @FromDate and YearId = @YearID And EmployeeMasterId = @EmployeeMasterID and CompanyMasterId= @CompanyMasterID and BranchMasterId = @BranchMasterID) = 0)
				BEGIN
					INSERT INTO #HR_DailyAttendanceMultiPunch (EmployeeMasterID, AttendYear, AttendMonth, AttendDate, AttendanceStatus, PunchDateTime1, PunchDateTime2, TotalWH, YearID, FormID, PayrollConfirmationID, Remark, MonthlyAttendID, CompanyMasterID, BranchMasterID, CategoryMasterID, ShiftMasterID, EntryUserMasterID, EntryUserDateTime, SystemName)
					values (@EmployeeMasterID, year(@FromDate), MONTH(@FromDate), @FromDate, @AttandStatus,
						(CASE WHEN @AttandStatus = 'WO' OR @AttandStatus = 'HL' OR @AttandStatus = 'L' THEN NULL ELSE @InTime END),
						(CASE WHEN @AttandStatus = 'WO' OR @AttandStatus = 'HL' OR @AttandStatus = 'L' THEN NULL ELSE @OutTime END),
						(CASE WHEN @AttandStatus = 'WO' OR @AttandStatus = 'HL' OR @AttandStatus = 'L' THEN 0 ELSE @WorkingHours END), @YearID, 1026, 0, '', 0, @CompanyMasterID, @BranchMasterID, @CategoryMasterID, @ShiftMasterID,  0, GETDATE(), '')
				END

			SET @FromDate = DATEADD(DAY, 1, @FromDate); /*increment from date*/
			END

		SET @K = @K + 1;
		END

	SELECT * FROM #HR_DailyAttendanceMultiPunch order by EmployeeMasterID, AttendDate desc
	END
END
GO

/* ============================================================================
   6. GUARDED SYNTHETIC DEMO SEED (idempotent; SYNTHETIC data only)
      ----------------------------------------------------------------------
      TEST LOGIN PASSWORD (plaintext): Test@123
        - PasswordHash below stores the plaintext value. The app performs a
          bcrypt.compare first; on failure it falls back to a plaintext
          equality check, so these demo users log in with Test@123.
        - Replace with real bcrypt hashes before any non-demo use.
      All names / emails are synthetic; logins use the solone.com test domain.
      Everything is guarded by IF NOT EXISTS, so re-running changes nothing.
   ============================================================================ */

/* ---- Company ---- */
IF NOT EXISTS (SELECT 1 FROM dbo.Company WHERE [code] = N'C001')
BEGIN
    INSERT INTO dbo.Company ([code],[name],[address],[city],[State],[Country],[pincode],[Currency],[CreUsr],[CreUsrDt])
    VALUES (N'C001', N'Northwind Demo Industries', N'1 Demo Park Road', N'Metro City', N'Demo State', N'Demo Country', N'000001', N'INR', N'seed', GETDATE());
END
GO

/* ---- Units + HR_UnitGPS + masters + employees + users + grants + leave/holiday/period ----
   Single batch so intermediate ids resolve via variables; every insert guarded. */
DECLARE @Cmp INT = (SELECT companymasterid FROM dbo.Company WHERE [code] = N'C001');

/* Units (composite PK CompanyCode+code; UnitMasterId is IDENTITY) */
IF NOT EXISTS (SELECT 1 FROM dbo.Unit WHERE CompanyCode = N'C001' AND [code] = N'U01')
    INSERT INTO dbo.Unit (CompanyCode,[code],[name],[address],[city],[State],[Country],[pincode],CompanyMasterId)
    VALUES (N'C001', N'U01', N'Head Office', N'1 Demo Park Road', N'Metro City', N'Demo State', N'Demo Country', N'000001', @Cmp);

IF NOT EXISTS (SELECT 1 FROM dbo.Unit WHERE CompanyCode = N'C001' AND [code] = N'U02')
    INSERT INTO dbo.Unit (CompanyCode,[code],[name],[address],[city],[State],[Country],[pincode],CompanyMasterId)
    VALUES (N'C001', N'U02', N'North Plant', N'22 Industrial Estate', N'North Town', N'Demo State', N'Demo Country', N'000002', @Cmp);

IF NOT EXISTS (SELECT 1 FROM dbo.Unit WHERE CompanyCode = N'C001' AND [code] = N'U03')
    INSERT INTO dbo.Unit (CompanyCode,[code],[name],[address],[city],[State],[Country],[pincode],CompanyMasterId)
    VALUES (N'C001', N'U03', N'South Depot', N'8 Riverside Way', N'South Town', N'Demo State', N'Demo Country', N'000003', @Cmp);

DECLARE @U1 INT = (SELECT UnitMasterId FROM dbo.Unit WHERE CompanyCode = N'C001' AND [code] = N'U01');
DECLARE @U2 INT = (SELECT UnitMasterId FROM dbo.Unit WHERE CompanyCode = N'C001' AND [code] = N'U02');
DECLARE @U3 INT = (SELECT UnitMasterId FROM dbo.Unit WHERE CompanyCode = N'C001' AND [code] = N'U03');

/* Unit GPS (real-ish coordinates; U01 geofenced) */
IF NOT EXISTS (SELECT 1 FROM dbo.HR_UnitGPS WHERE UnitMasterId = @U1)
    INSERT INTO dbo.HR_UnitGPS (UnitMasterId, Latitude, Longitude, IsGeofenced)
    VALUES (@U1, 19.0760000, 72.8777000, 1);
IF NOT EXISTS (SELECT 1 FROM dbo.HR_UnitGPS WHERE UnitMasterId = @U2)
    INSERT INTO dbo.HR_UnitGPS (UnitMasterId, Latitude, Longitude, IsGeofenced)
    VALUES (@U2, 28.6139000, 77.2090000, 0);
IF NOT EXISTS (SELECT 1 FROM dbo.HR_UnitGPS WHERE UnitMasterId = @U3)
    INSERT INTO dbo.HR_UnitGPS (UnitMasterId, Latitude, Longitude, IsGeofenced)
    VALUES (@U3, 12.9716000, 77.5946000, 0);

/* Department */
IF NOT EXISTS (SELECT 1 FROM dbo.HR_DepartmentMaster WHERE DepartmentCode = N'DEP01')
    INSERT INTO dbo.HR_DepartmentMaster (DepartmentCode, DepartmentName, [Description], [Status], CompanyMasterID, UnitMasterID, EntryMasterId, EntryDateTime, SystemName)
    VALUES (N'DEP01', N'Operations', N'Operations department', 1, @Cmp, @U1, 1, GETDATE(), N'SEED');
DECLARE @Dept BIGINT = (SELECT DepartmentMasterID FROM dbo.HR_DepartmentMaster WHERE DepartmentCode = N'DEP01');

/* Designations */
IF NOT EXISTS (SELECT 1 FROM dbo.HR_DesignationMaster WHERE DesignationCode = N'DSG01')
    INSERT INTO dbo.HR_DesignationMaster (DesignationCode, DesignationName, [Description], [Status], CompanyMasterID, UnitMasterID, EntryMasterId, EntryDateTime, SystemName)
    VALUES (N'DSG01', N'Staff', N'General staff', 1, @Cmp, @U1, 1, GETDATE(), N'SEED');
IF NOT EXISTS (SELECT 1 FROM dbo.HR_DesignationMaster WHERE DesignationCode = N'DSG02')
    INSERT INTO dbo.HR_DesignationMaster (DesignationCode, DesignationName, [Description], [Status], CompanyMasterID, UnitMasterID, EntryMasterId, EntryDateTime, SystemName)
    VALUES (N'DSG02', N'Manager', N'Line manager', 1, @Cmp, @U1, 1, GETDATE(), N'SEED');
IF NOT EXISTS (SELECT 1 FROM dbo.HR_DesignationMaster WHERE DesignationCode = N'DSG03')
    INSERT INTO dbo.HR_DesignationMaster (DesignationCode, DesignationName, [Description], [Status], CompanyMasterID, UnitMasterID, EntryMasterId, EntryDateTime, SystemName)
    VALUES (N'DSG03', N'HR Admin', N'HR administrator', 1, @Cmp, @U1, 1, GETDATE(), N'SEED');
DECLARE @DsgStaff BIGINT = (SELECT DesignationMasterID FROM dbo.HR_DesignationMaster WHERE DesignationCode = N'DSG01');
DECLARE @DsgMgr   BIGINT = (SELECT DesignationMasterID FROM dbo.HR_DesignationMaster WHERE DesignationCode = N'DSG02');
DECLARE @DsgHr    BIGINT = (SELECT DesignationMasterID FROM dbo.HR_DesignationMaster WHERE DesignationCode = N'DSG03');

/* Employees (reporting chain built after insert). ShiftMasterID/CategoryMasterID
   reference cryogas base masters that are out of scope; value 1 is used as a
   neutral placeholder. BranchMasterID = Head Office unit. */
IF NOT EXISTS (SELECT 1 FROM dbo.HR_EmployeeMaster WHERE Code = N'EMP001')
BEGIN
    INSERT INTO dbo.HR_EmployeeMaster
        (Code, FirstName, LastName, FatherName, DateOfJoining, DateOfBirth, WeeklyOffDay, WorkingHours,
         SalaryCalculation, JobType, JobStatus, [Status], IsHRAdmin,
         DepartmentMasterID, DesignationMasterID, ShiftMasterID, CategoryMasterID, BranchMasterID,
         CompanyMasterID, EntryUserMasterID, EntryUserDateTime, SystemName)
    VALUES
        (N'EMP001', N'Alex', N'Rivera',  N'Sam Rivera',  '20240101', '19950510', N'Sunday', 8, N'Monthly', N'Permanent', N'Active', 1, 0, @Dept, @DsgStaff, 1, 1, @U1, @Cmp, 1, GETDATE(), N'SEED'),
        (N'EMP002', N'Bailey', N'Chen',  N'Lee Chen',    '20240115', '19960820', N'Sunday', 8, N'Monthly', N'Permanent', N'Active', 1, 0, @Dept, @DsgStaff, 1, 1, @U1, @Cmp, 1, GETDATE(), N'SEED'),
        (N'EMP003', N'Casey', N'Nolan',  N'Pat Nolan',   '20240201', '19970303', N'Sunday', 8, N'Monthly', N'Permanent', N'Active', 1, 0, @Dept, @DsgStaff, 1, 1, @U2, @Cmp, 1, GETDATE(), N'SEED'),
        (N'MGR001', N'Devin', N'Osei',   N'Kwame Osei',  '20230601', '19880912', N'Sunday', 8, N'Monthly', N'Permanent', N'Active', 1, 0, @Dept, @DsgMgr,   1, 1, @U1, @Cmp, 1, GETDATE(), N'SEED'),
        (N'HRA001', N'Elliot', N'Park',  N'Jin Park',    '20220301', '19850715', N'Sunday', 8, N'Monthly', N'Permanent', N'Active', 1, 1, @Dept, @DsgHr,    1, 1, @U1, @Cmp, 1, GETDATE(), N'SEED');
END

/* Reporting chain: EMP001/002/003 -> MGR001 -> HRA001 -> (top, NULL) */
DECLARE @EmpMgr BIGINT = (SELECT EmployeeMasterID FROM dbo.HR_EmployeeMaster WHERE Code = N'MGR001');
DECLARE @EmpHr  BIGINT = (SELECT EmployeeMasterID FROM dbo.HR_EmployeeMaster WHERE Code = N'HRA001');

UPDATE dbo.HR_EmployeeMaster SET ReportingPersonID = @EmpMgr
    WHERE Code IN (N'EMP001', N'EMP002', N'EMP003') AND ReportingPersonID IS NULL;
UPDATE dbo.HR_EmployeeMaster SET ReportingPersonID = @EmpHr
    WHERE Code = N'MGR001' AND ReportingPersonID IS NULL;
-- HRA001 stays top of chain (ReportingPersonID NULL).

/* Users (login). Role gate: ADMIN/SUPER_ADMIN unlock admin endpoints; EMPLOYEE
   is the ESS role. Manager approves via ReportingPersonID, not via role. */
IF NOT EXISTS (SELECT 1 FROM dbo.HR_UserMaster WHERE Email = N'emp1@solone.com')
BEGIN
    INSERT INTO dbo.HR_UserMaster (Code, UserName, Email, Mobile, PasswordHash, Role, EmployeeMasterID, CreatedBy, CreatedDt, SystemName, [Status], CompanyMasterID)
    SELECT N'USR-EMP001', N'Alex Rivera',  N'emp1@solone.com',  N'9000000001', N'Test@123', N'EMPLOYEE',    em.EmployeeMasterID, 1, GETDATE(), N'SEED', 1, @Cmp FROM dbo.HR_EmployeeMaster em WHERE em.Code = N'EMP001'
    UNION ALL
    SELECT N'USR-EMP002', N'Bailey Chen',  N'emp2@solone.com',  N'9000000002', N'Test@123', N'EMPLOYEE',    em.EmployeeMasterID, 1, GETDATE(), N'SEED', 1, @Cmp FROM dbo.HR_EmployeeMaster em WHERE em.Code = N'EMP002'
    UNION ALL
    SELECT N'USR-EMP003', N'Casey Nolan',  N'emp3@solone.com',  N'9000000003', N'Test@123', N'EMPLOYEE',    em.EmployeeMasterID, 1, GETDATE(), N'SEED', 1, @Cmp FROM dbo.HR_EmployeeMaster em WHERE em.Code = N'EMP003'
    UNION ALL
    SELECT N'USR-MGR001', N'Devin Osei',   N'senior1@solone.com',   N'9000000004', N'Test@123', N'EMPLOYEE',    em.EmployeeMasterID, 1, GETDATE(), N'SEED', 1, @Cmp FROM dbo.HR_EmployeeMaster em WHERE em.Code = N'MGR001'
    UNION ALL
    SELECT N'USR-HRA001', N'Elliot Park',  N'hr@solone.com',  N'9000000005', N'Test@123', N'SUPER_ADMIN', em.EmployeeMasterID, 1, GETDATE(), N'SEED', 1, @Cmp FROM dbo.HR_EmployeeMaster em WHERE em.Code = N'HRA001';
END

/* Link employees back to their user rows (mirrors live wiring). */
UPDATE em SET em.UserMasterID = um.UserMasterID
FROM dbo.HR_EmployeeMaster em
JOIN dbo.HR_UserMaster um ON um.EmployeeMasterID = em.EmployeeMasterID
WHERE em.Code IN (N'EMP001',N'EMP002',N'EMP003',N'MGR001',N'HRA001')
  AND (em.UserMasterID IS NULL OR em.UserMasterID <> um.UserMasterID);

/* HR_UserUnits: default unit membership */
IF NOT EXISTS (SELECT 1 FROM dbo.HR_UserUnits uu JOIN dbo.HR_UserMaster um ON um.UserMasterID = uu.UserMasterID WHERE um.Code = N'USR-EMP001')
BEGIN
    INSERT INTO dbo.HR_UserUnits (UserMasterID, UnitMasterId)
    SELECT um.UserMasterID, @U1 FROM dbo.HR_UserMaster um WHERE um.Code IN (N'USR-EMP001',N'USR-EMP002',N'USR-MGR001',N'USR-HRA001')
    UNION ALL
    SELECT um.UserMasterID, @U2 FROM dbo.HR_UserMaster um WHERE um.Code IN (N'USR-EMP003',N'USR-HRA001');
END

/* HR_EmployeeBranchPermissions: main unit U01, allowed across all three units for HR admin/manager */
IF NOT EXISTS (SELECT 1 FROM dbo.HR_EmployeeBranchPermissions bp JOIN dbo.HR_UserMaster um ON um.UserMasterID = bp.UserMasterID WHERE um.Code = N'USR-HRA001')
BEGIN
    INSERT INTO dbo.HR_EmployeeBranchPermissions (UserMasterID, MainUnitMasterId, AllowedUnitMasterId, IsActive)
    SELECT um.UserMasterID, @U1, x.UnitId, 1
    FROM dbo.HR_UserMaster um
    CROSS JOIN (SELECT @U1 AS UnitId UNION ALL SELECT @U2 UNION ALL SELECT @U3) x
    WHERE um.Code IN (N'USR-MGR001', N'USR-HRA001');

    -- Individual staff: main unit + their own allowed unit
    INSERT INTO dbo.HR_EmployeeBranchPermissions (UserMasterID, MainUnitMasterId, AllowedUnitMasterId, IsActive)
    SELECT um.UserMasterID, @U1, @U1, 1 FROM dbo.HR_UserMaster um WHERE um.Code IN (N'USR-EMP001', N'USR-EMP002')
    UNION ALL
    SELECT um.UserMasterID, @U2, @U2, 1 FROM dbo.HR_UserMaster um WHERE um.Code = N'USR-EMP003';
END

/* Leave types (drive SP-based validation via ValidationSPName) */
IF NOT EXISTS (SELECT 1 FROM dbo.HR_LeaveMaster WHERE RTRIM(Code) = N'PL')
    INSERT INTO dbo.HR_LeaveMaster (Code, Name, Balance, [Description], IsActive, IsPaidLeave, HalfDayAllowed, QuarterDayAllowed, IsAdminOnly, Validity, ValidationSPName, ValidationMessage, FromDate, ToDate, FormID, YearID, CompanyMasterID, EntryUserMasterID, EntryUserDateTime, SystemName)
    VALUES (N'PL', N'PL', 12, N'Paid Leave', 1, 1, 1, 0, 0, 0, N'csp_HR_ValidateLeaveApplication', N'Leave validation failed.', '2026-04-01', '2027-03-31', 1004, 1, @Cmp, 1, GETDATE(), N'SEED');
IF NOT EXISTS (SELECT 1 FROM dbo.HR_LeaveMaster WHERE RTRIM(Code) = N'CL')
    INSERT INTO dbo.HR_LeaveMaster (Code, Name, Balance, [Description], IsActive, IsPaidLeave, HalfDayAllowed, QuarterDayAllowed, IsAdminOnly, Validity, ValidationSPName, ValidationMessage, FromDate, ToDate, FormID, YearID, CompanyMasterID, EntryUserMasterID, EntryUserDateTime, SystemName)
    VALUES (N'CL', N'CL', 6, N'Casual Leave', 1, 1, 1, 0, 0, 0, N'csp_HR_ValidateLeaveApplication', N'Leave validation failed.', '2026-04-01', '2027-03-31', 1004, 1, @Cmp, 1, GETDATE(), N'SEED');
IF NOT EXISTS (SELECT 1 FROM dbo.HR_LeaveMaster WHERE RTRIM(Code) = N'SL')
    INSERT INTO dbo.HR_LeaveMaster (Code, Name, Balance, [Description], IsActive, IsPaidLeave, HalfDayAllowed, QuarterDayAllowed, IsAdminOnly, Validity, ValidationSPName, ValidationMessage, FromDate, ToDate, FormID, YearID, CompanyMasterID, EntryUserMasterID, EntryUserDateTime, SystemName)
    VALUES (N'SL', N'SL', 6, N'Sick Leave', 1, 1, 1, 0, 0, 0, N'csp_HR_ValidateLeaveApplication', N'Leave validation failed.', '2026-04-01', '2027-03-31', 1004, 1, @Cmp, 1, GETDATE(), N'SEED');
IF NOT EXISTS (SELECT 1 FROM dbo.HR_LeaveMaster WHERE RTRIM(Code) = N'C-OFF')
    INSERT INTO dbo.HR_LeaveMaster (Code, Name, Balance, [Description], IsActive, IsPaidLeave, HalfDayAllowed, QuarterDayAllowed, IsAdminOnly, Validity, ValidationSPName, ValidationMessage, FromDate, ToDate, FormID, YearID, CompanyMasterID, EntryUserMasterID, EntryUserDateTime, SystemName)
    VALUES (N'C-OFF', N'C-OFF', 0, N'Compensatory Off', 1, 1, 0, 0, 0, 30, N'csp_HR_ValidateLeaveApplication', N'Leave validation failed.', '2026-04-01', '2027-03-31', 1004, 1, @Cmp, 1, GETDATE(), N'SEED');

/* Per-employee leave balances for the three staff (PL/CL/SL) */
IF NOT EXISTS (
    SELECT 1 FROM dbo.HR_EmployeeWiseLeave ewl
    JOIN dbo.HR_EmployeeMaster em ON em.EmployeeMasterID = ewl.EmployeeMasterID
    WHERE em.Code = N'EMP001'
)
BEGIN
    INSERT INTO dbo.HR_EmployeeWiseLeave (CheckBox, LeaveMasterID, OpeningBalance, Balance, IsActive, IsPaidLeave, FromDate, ToDate, YearID, EmployeeMasterID)
    SELECT 0, lm.LeaveMasterID, 0, lm.Balance, 1, lm.IsPaidLeave, '2026-04-01', '2027-03-31', 1, em.EmployeeMasterID
    FROM dbo.HR_EmployeeMaster em
    CROSS JOIN dbo.HR_LeaveMaster lm
    WHERE em.Code IN (N'EMP001', N'EMP002', N'EMP003')
      AND RTRIM(lm.Name) IN (N'PL', N'CL', N'SL');
END

/* Open HR period (resolves YearID passed to leave validation SP) */
IF NOT EXISTS (SELECT 1 FROM dbo.HR_Period WHERE CompanyMasterID = @Cmp AND [Status] = 1)
    INSERT INTO dbo.HR_Period (FromDate, ToDate, [Status], CreateUserMasterID, CreateUserDateTime, CompanyMasterID, SystemName)
    VALUES ('2026-04-01', '2027-03-31', 1, 1, GETDATE(), @Cmp, N'SEED');

/* Holidays + a detail row per holiday (HR_HolidayDetails PK is Oid) */
IF NOT EXISTS (SELECT 1 FROM dbo.HR_HolidayMaster WHERE Name = N'Republic Day (Demo)' AND CompanyMasterID = @Cmp)
    INSERT INTO dbo.HR_HolidayMaster (Name, [Date], [Type], OTMultiplayer, Remarks, [Status], YearID, EntryUserMasterID, EntryUserDateTime, CompanyMasterID, SystemName)
    VALUES (N'Republic Day (Demo)', '2027-01-26', N'National', 0, N'Public holiday', 1, 1, 1, GETDATE(), @Cmp, N'SEED');
IF NOT EXISTS (SELECT 1 FROM dbo.HR_HolidayMaster WHERE Name = N'Founders Day (Demo)' AND CompanyMasterID = @Cmp)
    INSERT INTO dbo.HR_HolidayMaster (Name, [Date], [Type], OTMultiplayer, Remarks, [Status], YearID, EntryUserMasterID, EntryUserDateTime, CompanyMasterID, SystemName)
    VALUES (N'Founders Day (Demo)', '2026-08-15', N'Company', 0, N'Company holiday', 1, 1, 1, GETDATE(), @Cmp, N'SEED');

DECLARE @Hol1 BIGINT = (SELECT Oid FROM dbo.HR_HolidayMaster WHERE Name = N'Republic Day (Demo)' AND CompanyMasterID = @Cmp);
DECLARE @Hol2 BIGINT = (SELECT Oid FROM dbo.HR_HolidayMaster WHERE Name = N'Founders Day (Demo)' AND CompanyMasterID = @Cmp);
DECLARE @Emp1 BIGINT = (SELECT EmployeeMasterID FROM dbo.HR_EmployeeMaster WHERE Code = N'EMP001');
DECLARE @Emp2 BIGINT = (SELECT EmployeeMasterID FROM dbo.HR_EmployeeMaster WHERE Code = N'EMP002');

IF @Hol1 IS NOT NULL AND NOT EXISTS (SELECT 1 FROM dbo.HR_HolidayDetails WHERE Oid = @Hol1)
    INSERT INTO dbo.HR_HolidayDetails (Oid, CategoryMasterID, EmployeeMasterID) VALUES (@Hol1, 1, @Emp1);
IF @Hol2 IS NOT NULL AND NOT EXISTS (SELECT 1 FROM dbo.HR_HolidayDetails WHERE Oid = @Hol2)
    INSERT INTO dbo.HR_HolidayDetails (Oid, CategoryMasterID, EmployeeMasterID) VALUES (@Hol2, 1, @Emp2);
GO

/* ============================================================================
   END OF SCRIPT
   ============================================================================ */
