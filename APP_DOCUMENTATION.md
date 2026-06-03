# Solution One ESS — Complete App Documentation

**App name:** Solution One ESS (Employee Self-Service)
**Type:** Mobile attendance app with geofenced punch-in/out, selfie proof, and admin dashboard
**Stack:** React Native + Expo SDK 55 (frontend) · Node.js/Express (backend) · Microsoft SQL Server (DB)
**Status:** ✅ Production APK built and deployed
**Last updated:** 2026-05-19

---

## 1. What the App Is About

Solution One ESS is a mobile employee self-service attendance system designed to plug into an existing 88-table HR ERP (`SolutionOne_HR_DB`) without modifying any pre-existing table. Employees check in/out from approved branch locations using a **GPS-verified geofence + mandatory front-camera selfie**, and admins manage employees, branches, and access permissions from the same app.

The app supports up to **14 daily punches** per employee (matching the legacy `HR_DailyAttendanceMultiPunch` schema), multi-tenant DB routing via JWT, and a dedicated admin view that surfaces every punch with photo proof, GPS coordinates, and a tap-to-map link.

---

## 2. Architecture Overview

```
┌─────────────────────────┐         HTTPS         ┌──────────────────────┐
│  Android APK (Expo RN)  │  ───────────────────► │  ngrok static tunnel │
│  • Hermes JS engine     │                       │  cordie-fogged-radia │
│  • 8 screens            │                       │  .ngrok-free.dev     │
│  • expo-location        │                       └──────────┬───────────┘
│  • expo-image-picker    │                                  │
│  • axios + JWT          │                                  ▼
└─────────────────────────┘                       ┌──────────────────────┐
                                                  │  Node.js (port 3000) │
                                                  │  • Express + JWT     │
                                                  │  • bcryptjs          │
                                                  │  • Haversine geofence│
                                                  │  • 25MB body limit   │
                                                  └──────────┬───────────┘
                                                             │ mssql TCP 1433
                                                             ▼
                                                  ┌──────────────────────┐
                                                  │  SQL Server          │
                                                  │  [Solution-one]      │
                                                  │  88 existing tables  │
                                                  │  + 5 additive tables │
                                                  └──────────────────────┘
```

**Why ngrok instead of direct deployment:**
Corporate firewall blocked Cloudflare Tunnel (UDP 7844). The static ngrok domain
`https://cordie-fogged-radia.ngrok-free.dev` runs on the local dev machine over
the home network and proxies to backend port 3000 — no port forwarding or IT
intervention required.

---

## 3. Database Structure

### 3.1 Additive Tables (Created by This App)

All new tables are additive — the existing 88-table HR schema is untouched.

#### `HR_UnitGPS` — Geofence per branch
| Column | Type | Notes |
|--------|------|-------|
| `Id` | `bigint IDENTITY` PK | |
| `UnitMasterId` | `int` UNIQUE | Logical FK → `Unit.UnitMasterId` (Unit has composite PK so FK enforced in app) |
| `Latitude` | `decimal(10,7)` | Branch center |
| `Longitude` | `decimal(10,7)` | Branch center |
| `IsGeofenced` | `bit` default `1` | `0` = WFH/Field — skip 50m radius check |
| `CreatedAt` / `UpdatedAt` | `datetime` | |

#### `HR_UserUnits` — User ↔ Unit assignments
| Column | Type | Notes |
|--------|------|-------|
| `Id` | `bigint IDENTITY` PK | |
| `UserMasterID` | `bigint` FK → `HR_UserMaster` | |
| `UnitMasterId` | `int` | Logical link to `Unit` |
| UNIQUE | `(UserMasterID, UnitMasterId)` | |

#### `HR_PunchLocations` — GPS coords per punch slot (1:1 with attendance)
| Column | Type | Notes |
|--------|------|-------|
| `Id` | `bigint IDENTITY` PK | |
| `MultiPunchOid` | `bigint` UNIQUE FK → `HR_DailyAttendanceMultiPunch.Oid` | |
| `PunchLocation1..14` | `nvarchar(100)` | `"lat,lng"` strings — positions match `PunchDateTime1..14` |

#### `HR_EmployeeBranchPermissions` — Granular per-employee access
| Column | Type | Notes |
|--------|------|-------|
| `Id` | `bigint IDENTITY` PK | |
| `UserMasterID` | `bigint` FK | |
| `MainUnitMasterId` | `int` | Employee's primary branch |
| `AllowedUnitMasterId` | `int` | A branch they can also punch from |
| `IsActive` | `bit` default `1` | Toggle without deleting row |
| UNIQUE | `(UserMasterID, AllowedUnitMasterId)` | |

#### Phase 2 — HR self-service tables

| Table | Purpose |
|-------|---------|
| `HR_LeaveMaster` | Leave types (CL, SL, PL, EL, LWP) — code, name, default balance, half-day-allowed |
| `HR_LeaveApplication` | Submitted leave requests with `Status` (Pending/Approved/Rejected/Cancelled) and approver fields |
| `HR_AttendenceAdjustment` | Punch-correction requests with auto-generated `DocNo` and `ApprovalStatus` |
| `HR_PayrollSalaryConfirmation` | Monthly salary header per employee (basic, gross, ctc, net) |
| `HR_PayrollSalaryConfirmationDetails` | Line items per salary slip (head name, Add/Deduct, amount) |
| `HR_ReportLayout` | Saved custom report definitions (used by the web DevExpress viewer; mobile lists them) |

All seven new tables match the schema used by the canonical `SolutionOne_HR` portal so mobile-created rows are interoperable. See `backend/add_leave_salary_adjustment_tables.sql` — idempotent, safe to re-run.

#### `HR_PunchPhotos` — Selfie proof per punch
| Column | Type | Notes |
|--------|------|-------|
| `Id` | `bigint IDENTITY` PK | |
| `MultiPunchOid` | `bigint` FK CASCADE → `HR_DailyAttendanceMultiPunch.Oid` | |
| `PunchSlot` | `tinyint` (1..14) | |
| `PhotoBase64` | `nvarchar(MAX)` | `"data:image/jpeg;base64,..."` |
| `MimeType` | `nvarchar(50)` default `'image/jpeg'` | |
| `CapturedDateTime` | `datetime` default `GETDATE()` | |
| `Latitude` / `Longitude` | `decimal(10,7)` | Captured at click time |
| UNIQUE | `(MultiPunchOid, PunchSlot)` | One photo per slot |

### 3.2 Existing Tables Used (Read/Write, NOT Modified)

| Table | Used For |
|-------|----------|
| `HR_UserMaster` | Login credentials, role (`Employee` / `Admin` / `SUPER_ADMIN`), `Status` bit for grant/revoke access |
| `HR_EmployeeMaster` | First/Last name, FK fan-out (CompanyMasterID, BranchMasterID, ShiftMasterID, etc.) |
| `HR_DailyAttendanceMultiPunch` | The 14-slot attendance row per employee per day |
| `Unit` | Branch/site master — composite PK `(CompanyCode, code)`, but `UnitMasterId` is `IDENTITY` |
| `Company` | Used as default seed when creating new units (TOP 1) |

### 3.3 Table Mapping (Old MySQL Mental Model → New SQL Server)

| Old (MySQL prototype) | New (SQL Server production) |
|---|---|
| `users` | `HR_UserMaster` JOIN `HR_EmployeeMaster` |
| `units` | `Unit` JOIN `HR_UnitGPS` |
| `user_units` | `HR_UserUnits` |
| `hr_daily_attendance` | `HR_DailyAttendanceMultiPunch` JOIN `HR_PunchLocations` JOIN `HR_PunchPhotos` |
| `employee_branch_permissions` | `HR_EmployeeBranchPermissions` |

---

## 4. Feature Inventory

### 4.1 Authentication & Authorization
- **Email + password login** (`/api/login`) — iterates configured tenant DBs, finds matching user, signs JWT (`{userId, employeeId, role, tenantDb}`, 12h expiry).
- **Password compare:** detects bcrypt `$2` prefix, falls back to plaintext for legacy demo data.
- **Account status check:** `HR_UserMaster.Status = 0` returns `403 "You are not allowed to use this app please contact the HR department"` — inline error on Login screen.
- **Role-based routing:** `EMPLOYEE` → EmployeeHome, `ADMIN`/`SUPER_ADMIN` → AdminDashboard.
- **Re-verify password** (`/api/auth/reverify`) before sensitive admin actions.

### 4.2 Employee Self-Service
- **Today's status** — 14 punch slots with timestamps, location, photos.
- **Unit selector** — only branches the employee is permitted on (per branch permissions or fallback to assignments).
- **Punch flow** (mandatory steps, in order):
  1. Location permission requested → live GPS fetched.
  2. Camera permission requested → **front-camera selfie** taken at quality `0.5` with base64.
  3. If selfie cancelled → `"Photo Required"` alert, abort.
  4. Backend geofence: Haversine distance between selfie GPS and branch GPS; must be ≤ 50m unless `IsGeofenced=0` (WFH/Field).
  5. First empty `PunchDateTimeN` slot is filled (`N` from 1 to 14); GPS string + base64 photo saved to companion tables.
- **History screen** — last N days as cards, each with punch count and per-slot times.

### 4.3 Admin Dashboard
- **Employee list** with search and unit filter (`/api/admin/employees?unit_id=`).
- **Batch grant/revoke access** — multi-select rows, single `is_active` flip via `PUT /api/admin/employees/access`.
- **Daily attendance for date** — every employee's `punchCount`, `is_active` flag, full punches array.
- **Per-employee drill-down** (`EmployeeDetailScreen`):
  - Shows each punch as a card: index badge `#1..14`, formatted time, **📍 Map** button (opens Google Maps with `?api=1&query=lat,lng`).
  - **Selfie thumbnail** rendered inline; tap → full-screen zoom modal.
  - **Branch Permissions** quick-link at the bottom navigates to BranchPermissions screen for the same employee.
  - No stats bar (intentionally removed per user request — clarity > metric noise).
- **Branch Permissions editor** — pick main unit + toggle each allowed unit on/off (full delete-and-reinsert upsert).
- **Unit management:**
  - List all units with GPS dots / geofence badge.
  - Create new unit (auto-generates `Unit.code` from timestamp + GPS row in `HR_UnitGPS`).
  - Edit existing unit (upserts `HR_UnitGPS` row if it doesn't exist yet).

### 4.4 HR Self-Service (Phase 2)
Added 2026-06-01 to mirror the existing ASP.NET HR portal.

#### Leave management
- **Employee** (`LeaveRequestScreen`):
  - 5 default leave types seeded (`CL`, `SL`, `PL`, `EL`, `LWP`); admin can add more.
  - Per-type **remaining balance** computed live: `total − (Pending + Approved) days for the current year`.
  - Apply with date range, day-type (Full / Half / Quarter) and reason.
  - Backend rejects overlapping Pending/Approved requests for the same employee.
  - Employee can cancel their own `Pending` request.
- **Admin** (`LeaveApprovalScreen`):
  - Filter chips: `Pending / Approved / Rejected / All`.
  - Approve or reject inline; rejection requires a comment.
  - Updates `HR_LeaveApplication.Status`, `ApprovedBy`, `ApprovedDate`, `ApproverComment`.

#### Attendance adjustment
- **Employee** (`AdjustmentRequestScreen`):
  - 4 adjustment types: `MissedPunch`, `WrongPunch`, `OnDuty`, `WFH`.
  - Submits a request with date, optional in/out times, and a free-text reason.
  - Backend auto-generates a sequential `DocNo` (`AA-000001`).
- **Admin** (`AdjustmentApprovalScreen`): mirrors leave-approval flow against `HR_AttendenceAdjustment`.

#### Salary slip (employee)
- **List** (`SalarySlipListScreen`): every month with a finalised slip, newest first.
- **Detail** (`SalarySlipDetailScreen`): identity card + earnings table + deductions table + net pay highlight, with a **Share** button that exports the slip as plain text (printable / saveable via the OS share sheet).
- Backed by `HR_PayrollSalaryConfirmation` + `HR_PayrollSalaryConfirmationDetails`.

#### Customised report list (admin)
- `ReportsScreen` lists rows from `HR_ReportLayout` grouped by Category (Attendance / Payroll / Leave / Asset).
- Tapping a report shows its description — actual report rendering still lives in the web portal's DevExpress viewer; mobile is a directory/launcher.

### 4.5 Operational/Quality
- **JWT tenant routing** — every authed request resolves the right SQL pool from `req.user.tenantDb`.
- **25MB JSON body limit** for base64 selfies.
- **Default 50MB axios `maxContentLength`** on admin photo-detail endpoint (responses balloon with photos).
- **ngrok-skip-browser-warning header** globally set on axios — bypasses ngrok free-tier interstitial.

---

## 5. Workflow Walkthroughs

### 5.1 Employee Punch Flow (end-to-end)
```
LoginScreen → EmployeeHomeScreen
  ↓ (tap "Punch In/Out")
  1. expo-location requests permission, gets current GPS
  2. expo-image-picker opens front camera (mandatory)
  3. base64 selfie + lat/lng POSTed to /api/attendance/punch
  4. Backend:
     a. Checks HR_EmployeeBranchPermissions (or HR_UserUnits if none exist)
        → 403 "no permission for this unit" if mismatch
     b. Looks up branch GPS from HR_UnitGPS
     c. If IsGeofenced=1 → Haversine distance check (≤ 50m or 403)
     d. SELECT existing row for today in HR_DailyAttendanceMultiPunch
        - If none: INSERT new row with PunchDateTime1, then INSERT
          companion HR_PunchLocations + HR_PunchPhotos (slot 1)
        - If found: scan PunchDateTime1..14 for first NULL slot,
          UPDATE that slot's datetime, upsert PunchLocations,
          INSERT HR_PunchPhotos at the same slot
     e. 14 punches reached → 400 "max reached"
  5. Frontend reloads /api/attendance/status → renders updated card list
```

### 5.2 Admin Drill-Down Flow
```
AdminDashboardScreen
  ↓ (tap employee row)
EmployeeDetailScreen (loads /api/admin/employee/:userId/punches?date=YYYY-MM-DD)
  - Shows N punch cards (only filled slots)
  - Each card: [#index] [HH:MM AM/PM] [📍 Map button] [selfie thumbnail]
  - Tap photo → full-screen zoom modal (close on tap anywhere)
  - Tap 📍 Map → opens Google Maps app/web with the punch lat/lng
  ↓ (tap "Branch Permissions" button at bottom)
BranchPermissionsScreen
  - Main unit dropdown
  - Allowed units list with toggle switches
  - Save → POST upserts full set (delete + bulk insert)
```

### 5.3 Login → Dashboard Routing
```
LoginScreen
  ↓ POST /api/login {email, password}
Backend:
  for each tenantDb in TENANT_ORDER:
    SELECT user from HR_UserMaster JOIN HR_EmployeeMaster
    if found → bcrypt or plaintext compare
    if Status=0 → 403 HR-block message
    else → sign JWT, return user object
Frontend:
  if role in {ADMIN, SUPER_ADMIN} → AdminDashboard
  if role == EMPLOYEE              → EmployeeHome
  otherwise                        → "Invalid user role"
```

### 5.4 Permission Resolution (critical safety logic)
At BOTH `GET /api/user/units` and punch-time validation:
```
permCheck = COUNT(*) FROM HR_EmployeeBranchPermissions WHERE UserMasterID = userId

if permCheck > 0:
    // Branch permissions take precedence
    units = MainUnitMasterId  ∪  AllowedUnitMasterId where IsActive=1
else:
    // Fall back to legacy assignments
    units = HR_UserUnits rows for this user
```
This means **adding even one row to `HR_EmployeeBranchPermissions` completely replaces the `HR_UserUnits` view for that user** — be careful when migrating.

---

## 6. API Endpoint Catalog

Base URL: `https://cordie-fogged-radia.ngrok-free.dev/api`

| Method | Path | Auth | Purpose |
|--------|------|------|---------|
| `POST` | `/login` | — | Multi-DB email/password → JWT |
| `POST` | `/auth/reverify` | JWT | Re-confirm admin password |
| `GET` | `/user/units` | JWT | Branches the employee can punch from |
| `GET` | `/attendance/status` | JWT | Today's punches for logged-in user |
| `GET` | `/attendance/history?days=N` | JWT | Past N days (default 30) |
| `POST` | `/attendance/punch` | JWT | `{unit_id, latitude, longitude, photo}` — photo MANDATORY |
| `GET` | `/admin/employees?unit_id=X` | JWT+Admin | Employee list (optional unit filter) |
| `PUT` | `/admin/employees/access` | JWT+Admin | Batch `{user_ids[], is_active}` |
| `GET` | `/admin/attendance?date=YYYY-MM-DD` | JWT+Admin | All employees' punches for date |
| `GET` | `/admin/employee/:userId/punches?date=` | JWT+Admin | Full detail incl. photos |
| `GET` | `/admin/employees/:id/branch-permissions` | JWT+Admin | Read permissions |
| `POST` | `/admin/employees/:id/branch-permissions` | JWT+Admin | Upsert permissions |
| `GET` | `/admin/units` | JWT+Admin | All units with GPS |
| `POST` | `/units` | JWT+Admin | Create unit + GPS row |
| `PUT` | `/units/:id` | JWT+Admin | Update name + GPS (upsert) |
| **Phase 2** | | | |
| `GET` | `/leave/types` | JWT | List active leave types |
| `GET` | `/leave/balance` | JWT | Remaining balance per type for the year |
| `POST` | `/leave/apply` | JWT | Submit a leave request |
| `GET` | `/leave/my` | JWT | Logged-in user's leave history |
| `DELETE` | `/leave/:id` | JWT | Cancel own pending leave |
| `GET` | `/admin/leave/pending?status=` | JWT+Admin | List leaves (default Pending) |
| `POST` | `/admin/leave/:id/decide` | JWT+Admin | `{decision, comment?}` Approve / Reject |
| `POST` | `/adjustment/apply` | JWT | Submit attendance adjustment |
| `GET` | `/adjustment/my` | JWT | Own adjustment history |
| `GET` | `/admin/adjustment/pending?status=` | JWT+Admin | List adjustments |
| `POST` | `/admin/adjustment/:id/decide` | JWT+Admin | Approve / Reject |
| `GET` | `/salary/months` | JWT | List months with a finalised slip |
| `GET` | `/salary/slip/:id` | JWT | Slip header + line items |
| `GET` | `/admin/reports?category=` | JWT+Admin | List custom report definitions |

---

## 7. Frontend Screen Map

| Screen | Route Params | Purpose |
|--------|--------------|---------|
| `LoginScreen` | — | Email/password entry, inline HR-block error |
| `EmployeeHomeScreen` | `{user, token}` | Unit selector + Punch button + today's slots |
| `AttendanceHistoryScreen` | `{user, token}` | Past N days history |
| `AdminDashboardScreen` | `{user, token}` | Date picker, employee list, search, batch access, drill-down |
| `EmployeeDetailScreen` | `{user, token, employeeId, employeeName, employeeEmail, isActive, date}` | Per-employee punches with photo + map links + branch perms entry |
| `BranchPermissionsScreen` | `{user, token, employeeId, employeeName}` | Main unit + allowed-unit toggles |
| `ManageUnitsScreen` | `{user, token}` | Unit list with edit/create actions |
| `UnitFormScreen` | `{user, token, unit?}` | Create / edit a single unit |
| **Phase 2 — HR self-service** | | |
| `LeaveRequestScreen` | `{user, token}` | Apply for leave + view own history with balances |
| `LeaveApprovalScreen` | `{user, token}` | Admin queue with Approve/Reject + reason modal |
| `AdjustmentRequestScreen` | `{user, token}` | Punch-correction form + own history |
| `AdjustmentApprovalScreen` | `{user, token}` | Admin queue, same approval pattern as leaves |
| `SalarySlipListScreen` | `{user, token}` | List of months with a finalised slip |
| `SalarySlipDetailScreen` | `{user, token, slipId}` | Earnings + deductions + net pay + Share |
| `ReportsScreen` | `{user, token}` | Customised report directory (category filtered) |

---

## 8. Build & Deployment

### 8.1 Build environment
- **Build path:** `C:\dev\solution-one` — never from OneDrive (NTFS ACLs break tar archives).
- **`android/` folder:** git-tracked to stop EAS from auto-regenerating broken native code.
- **Hermes JS engine:** mandatory. `@react-native-community/javascriptcore` is **not** installed — it conflicts with Hermes and breaks Gradle.
- **App identifier:** `com.solutionone.app`
- **App name (Android):** "Solution One ESS"

### 8.2 Build command
```cmd
eas build --platform android --profile preview
```
Latest successful build (#8 in this session): `628fa8e8-e7bd-439f-8a6d-f867e4933147`

### 8.3 Runtime (daily startup)

**Step 1 — Backend** (run in a Bash/Git-Bash shell so `node` stays attached cleanly):
```bash
cd "C:/Users/hetss/OneDrive/Desktop/temp/employee-attendance-app/solution-one/backend" && node server.js
```
Expected output (means DB is connected and HTTP server is up):
```
[dotenv@17.2.3] injecting env (7) from .env
Connected to solution_one (Solution-one)
Server running on http://localhost:3000
Connected to SQL Server
```

**Step 2 — ngrok tunnel** (PowerShell, minimised so it doesn't clutter the desktop):
```powershell
Start-Process -FilePath "C:\Tools\ngrok.exe" `
  -ArgumentList "http","--url=cordie-fogged-radia.ngrok-free.dev","127.0.0.1:3000" `
  -WindowStyle Minimized
```
> ⚠️ Always use `127.0.0.1:3000` — never `localhost:3000`. ngrok resolves `localhost` to IPv6 (`[::1]`) which the backend doesn't bind to.

**Step 3 — Verify both are alive** (single PowerShell one-liner):
```powershell
# Confirm backend port
netstat -ano | findstr ":3000" | findstr LISTENING

# Confirm tunnel
Invoke-WebRequest -Uri "https://cordie-fogged-radia.ngrok-free.dev/" `
  -Headers @{"ngrok-skip-browser-warning"="true"} -UseBasicParsing |
  Select-Object StatusCode, Content
# Expected → StatusCode 200, Content: {"message":"Attendance API (SQL Server) is running"}
```

**One-shot version** (paste into PowerShell — assumes Bash isn't preferred):
```powershell
# Backend (minimised window)
Start-Process -FilePath "node" -ArgumentList "server.js" `
  -WorkingDirectory "C:\Users\hetss\OneDrive\Desktop\temp\employee-attendance-app\solution-one\backend" `
  -WindowStyle Minimized

# ngrok
Start-Process -FilePath "C:\Tools\ngrok.exe" `
  -ArgumentList "http","--url=cordie-fogged-radia.ngrok-free.dev","127.0.0.1:3000" `
  -command ".\ngrok.exe http --url=cordie-fogged-radia.ngrok-free.dev 3000"
  -WindowStyle Minimized

# Sanity check after ~4 seconds
Start-Sleep -Seconds 4
Invoke-WebRequest -Uri "https://cordie-fogged-radia.ngrok-free.dev/" `
  -Headers @{"ngrok-skip-browser-warning"="true"} -UseBasicParsing |
  Select-Object StatusCode, Content
```

**Stopping services:**
```powershell
Stop-Process -Name "node"  -Force -ErrorAction SilentlyContinue
Stop-Process -Name "ngrok" -Force -ErrorAction SilentlyContinue
```

### 8.4 Demo login credentials
After running `add_photo_and_demo_data.sql`, these accounts work immediately:

| Email | Password |
|---|---|
| `aarav.sharma@demo.com` | `Demo@123` |
| `priya.patel@demo.com` | `Demo@123` |
| `rohan.mehta@demo.com` | `Demo@123` |
| `ananya.gupta@demo.com` | `Demo@123` |
| `vikram.singh@demo.com` | `Demo@123` |

Admin / super-admin accounts come from the existing `HR_UserMaster` rows in the production HR database — query `SELECT Email, Role FROM HR_UserMaster WHERE Role IN ('ADMIN','SUPER_ADMIN') AND Status = 1` to list them.

---

## 9. Key Issues Resolved (Session History)

| # | Symptom | Root Cause | Fix |
|---|---------|------------|-----|
| 1 | EAS build #1-2: `tar permission denied` on every file | Project in OneDrive (`C:\Users\...\OneDrive\...`) — weird NTFS ACLs → mode 000 in tar | Move project to `C:\dev\solution-one`, `icacls /reset /T`, add `.easignore` |
| 2 | Build #3: `hermesc binary couldn't start` | Stale `android/` from old SDK | Delete `android/`, `expo prebuild --clean`, commit fresh android folder |
| 3 | Build #4: Kotlin `Unresolved reference 'ReactNativeHostWrapper'` | Class removed in SDK 55, stale MainApplication.kt | Same: full prebuild |
| 4 | Build #5-6: APK crashes within 1s | JSC removed from RN 0.83 core; `expo-system-ui` missing for `userInterfaceStyle:"light"` | Install `expo-system-ui`, set `newArchEnabled=false`, switch back to Hermes |
| 5 | Build #7: Gradle "Please disable Hermes…" | `@react-native-community/javascriptcore` conflicts with Hermes bytecode | `npm uninstall @react-native-community/javascriptcore` |
| 6 | Corporate firewall blocks Cloudflare Tunnel | UDP 7844 + alternate TCP blocked on RDP server | Run ngrok from home network instead — UDP 443 only |
| 7 | ngrok `dial tcp [::1]:3000` fails | ngrok resolves `localhost` to IPv6 | Use `127.0.0.1:3000` explicitly |
| 8 | PM2 `SERVICE_PAUSED` loop | Two PM2 daemons fighting (user vs. service, different `PM2_HOME`) | Abandon PM2 — run `node server.js` minimized window |
| 9 | Photo not enforced | Frontend allowed skip | Frontend: cancel-camera → abort with alert. Backend: 400 if `photo` < 100 chars |

---

## 10. Demo Data

Run `C:\dev\solution-one\backend\add_photo_and_demo_data.sql` once in SSMS to seed:
- 5 demo employees: `DEMO001..DEMO005` (e.g. `aarav.sharma@demo.com`)
- Password (plaintext for demo): `Demo@123`
- 7 days of past attendance, 9am in / 6pm out, skipping Sundays
- Locations approximated around Mumbai (`19.0760,72.8777`)

Script is idempotent — safe to re-run.

For the Phase 2 tables, also run **`backend/add_leave_salary_adjustment_tables.sql`** once. This:
- Creates `HR_LeaveMaster` and seeds 5 default leave types
- Creates `HR_LeaveApplication`, `HR_AttendenceAdjustment`, `HR_PayrollSalaryConfirmation*`, `HR_ReportLayout`
- Seeds 6 sample report rows
- Seeds last-month demo salary slips for 5 employees so the slip viewer has data to display

```sql
USE [Solution-one]
GO
:r C:\dev\solution-one\backend\add_leave_salary_adjustment_tables.sql
```

---

## 11. Security Notes & Open Hardening Tasks

- [ ] Rotate `JWT_SECRET` before any external release.
- [ ] Replace `sa` SQL login with a least-privilege app account.
- [ ] Migrate plaintext demo passwords to bcrypt (`$2` prefix detection already in place).
- [ ] Rate-limit `/api/login` and `/api/auth/reverify`.
- [ ] Lock CORS to expected origins (currently `app.use(cors())` allows all).
- [ ] Add structured logging + `/health` endpoint for tunnel monitor.
- [ ] Permanent backend hosting — currently bound to laptop staying on.

---

## 12. Key Files Reference

| Path | Purpose |
|------|---------|
| `C:\dev\solution-one\App.tsx` | Stack navigator (8 routes) |
| `C:\dev\solution-one\app.json` | Expo config: name "Solution One ESS", Hermes, plugins, permissions |
| `C:\dev\solution-one\src\services\api.ts` | axios client + endpoint wrappers + ngrok header |
| `C:\dev\solution-one\src\types\index.ts` | TS types: `User`, `Unit`, `Punch`, `RootStackParamList` |
| `C:\dev\solution-one\src\screens\*.tsx` | 10 screens (8 routed + 2 helpers) |
| `C:\dev\solution-one\android\gradle.properties` | `hermesEnabled=true`, `newArchEnabled=true` |
| `C:\dev\solution-one\.easignore` | Excludes `backend/`, `.expo/`, OneDrive copy artifacts |
| `…OneDrive\…\backend\server.js` | All 15 endpoints (the RUNNING backend) |
| `…OneDrive\…\backend\db.js` | mssql pool + tenant routing |
| `…OneDrive\…\backend\middleware\auth.js` | JWT verify + tenant pool injection |
| `…OneDrive\…\backend\.env` | DB creds, JWT secret, port |
| `…OneDrive\…\backend\sql_server_new_tables.sql` | Additive schema (4 tables) |
| `C:\dev\solution-one\backend\add_photo_and_demo_data.sql` | HR_PunchPhotos + 5 demo employees + 7 days data |
