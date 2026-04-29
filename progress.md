# Solution One — Attendance App Progress

**Last updated:** 2026-04-21

---

## 1. What We've Accomplished

### Backend Migration (MySQL → SQL Server)
- Replaced `mysql2` with `mssql ^11.0.1` in `backend/package.json`.
- Rewrote `backend/db.js` using `mssql.ConnectionPool` with direct TCP port connection (no SQL Browser dependency).
- Updated `backend/middleware/auth.js` to attach `{ userId, employeeId, role, tenantDb }` and resolve the tenant pool via `getPool(tenantDb)`.
- Rewrote **all 13 endpoints** in `backend/server.js` to T-SQL (TOP, GETDATE(), `@param`, OUTPUT INSERTED, etc.).

### Schema Strategy (Additive Only)
Did **not** modify the existing 88-table `SolutionOne_HR_DB`. Added 4 new tables:
- `HR_UnitGPS` — geofence coords + `is_geofenced` flag per `Unit`.
- `HR_UserUnits` — user ↔ unit assignments.
- `HR_PunchLocations` — 1:1 with `HR_DailyAttendanceMultiPunch.Oid`, stores `PunchLocation1..14` to match `PunchDateTime1..14`.
- `HR_EmployeeBranchPermissions` — main unit + allowed units per employee (overrides `HR_UserUnits` when present).

FKs go to `HR_UserMaster` and `HR_DailyAttendanceMultiPunch` PKs. `Unit` has a **composite PK** `(CompanyCode, code)` so those relationships are JOIN-based (no FK) — handled in application code.

### Table Mapping
| Old (MySQL) | New (SQL Server) |
|---|---|
| `users` | `HR_UserMaster` JOIN `HR_EmployeeMaster` |
| `units` | `Unit` JOIN `HR_UnitGPS` |
| `user_units` | `HR_UserUnits` |
| `hr_daily_attendance` | `HR_DailyAttendanceMultiPunch` JOIN `HR_PunchLocations` |
| `employee_branch_permissions` | `HR_EmployeeBranchPermissions` |

### Permission Logic Fix
`/api/user/units` and punch validation now check `HR_EmployeeBranchPermissions` first (main_unit + active allowed_units), falling back to `HR_UserUnits` only when no branch permissions exist.

### Auth + Connectivity
- Switched to **SQL Server Authentication** (`sa` login) to avoid `msnodesqlv8` native build failures.
- Enabled TCP/IP on port 1433, bypassing SQL Server Browser.
- Local dev fully working: admin/employee login, punch in/out, branch permission flow.

### Deployment Prep
- Backend copied to company **remote desktop server** (`SolutionOne_HR_DB`, user `sol1` / `onesol`, always-on).
- Frontend `API_BASE_URL` pointed at `http://103.167.223.202:3000/api` for external testing.

---

## 2. Current State

**Working locally:** backend + RN app login, punch, history, admin dashboard, branch permissions, unit management.

**Blocked on remote server:**
1. **`Cannot find module 'qs/lib/index.js'`** when running `node server.js` — `node_modules` got corrupted during the RDP copy.
2. **`ERR_CONNECTION_TIMED_OUT`** from external phone/laptop — `103.167.223.202` is the corporate router/ISP NAT (server itself is `10.1.1.202`). Port 3000 isn't forwarded and we can't rely on IT to open it.

---

## 3. Next Steps

### Step A — Fix the backend on the remote server
On the RDP session, inside `backend/`:
```cmd
rd /s /q node_modules
del package-lock.json
npm install
node server.js
```
Confirm it prints `Server running on port 3000` and `DB pool ready`.

### Step B — Expose it externally via Cloudflare Tunnel
No port forwarding required, free, always-on.

1. Download `cloudflared.exe` onto the remote server.
2. Quick test:
   ```cmd
   cloudflared.exe tunnel --url http://localhost:3000
   ```
   Copy the `https://<random>.trycloudflare.com` URL it prints.
3. Hit `https://<random>.trycloudflare.com/api/login` from your phone browser to confirm reachability.

### Step C — Make the tunnel permanent
- Create a named Cloudflare tunnel (`cloudflared tunnel create solution-one`).
- Bind a stable hostname (either a `*.trycloudflare.com` via config, or a subdomain on a Cloudflare-managed domain).
- Install as a **Windows service** so it auto-starts on reboot:
  ```cmd
  cloudflared.exe service install
  ```
- Do the same for Node (PM2 + `pm2-windows-service`, or NSSM wrapping `node server.js`) so the API survives reboots without manual `node server.js`.

### Step D — Point the app at the stable URL
Update `src/services/api.ts`:
```ts
const API_BASE_URL = 'https://<your-stable-host>/api';
```

### Step E — Build APK
```cmd
eas build --platform android --profile preview
```
Install on test phones, run full smoke test (login → punch in → punch out → history → admin dashboard → branch permissions).

### Step F — Hardening (post-smoke-test)
- Rotate `JWT_SECRET` (current value is in `.env` and should not ship).
- Move `sa` off default, or create a least-privilege SQL login for the app.
- Add rate limiting on `/api/login` and `/api/auth/reverify`.
- Restrict CORS to the app origin (or lock down since it's mobile-only).
- Add structured logging + a `/health` endpoint for the tunnel/monitor.

---

## 4. Key Files

- `backend/server.js` — all endpoints (T-SQL).
- `backend/db.js` — mssql pool manager.
- `backend/middleware/auth.js` — JWT + tenant routing.
- `backend/.env` — DB creds, JWT secret, port.
- `backend/sql_server_new_tables.sql` — additive schema.
- `backend/sql_server_fix_remaining.sql` — idempotent re-run script.
- `backend/seed_test_data.sql` — test users + unit GPS.
- `src/services/api.ts` — frontend API client (update base URL here).
