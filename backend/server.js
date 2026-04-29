const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
require('dotenv').config();

const { initPools, getPool, dbQuery, TENANT_ORDER } = require('./db');
const { authMiddleware, JWT_SECRET } = require('./middleware/auth');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(bodyParser.json());

// ============================================
// Haversine distance (meters)
// ============================================
function calculateDistance(lat1, lon1, lat2, lon2) {
    const R = 6371e3;
    const toRad = (deg) => deg * Math.PI / 180;
    const dLat = toRad(lat2 - lat1);
    const dLon = toRad(lon2 - lon1);
    const a = Math.sin(dLat / 2) ** 2 +
              Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
              Math.sin(dLon / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// ============================================
// Health check
// ============================================
app.get('/', (req, res) => {
    res.json({ message: 'Attendance API (SQL Server) is running' });
});

// ============================================
// POST /api/login — Multi-DB Login
// ============================================
app.post('/api/login', async (req, res) => {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json({ error: 'Email and password are required' });
        }

        for (const tenantDb of TENANT_ORDER) {
            const pool = getPool(tenantDb);

            const rows = await dbQuery(pool,
                `SELECT um.UserMasterID, um.Email, um.PasswordHash, um.Role, um.Status,
                        um.EmployeeMasterID,
                        em.FirstName + ' ' + em.LastName AS Name
                 FROM HR_UserMaster um
                 JOIN HR_EmployeeMaster em ON um.EmployeeMasterID = em.EmployeeMasterID
                 WHERE um.Email = @email`,
                { email }
            );

            if (rows.length === 0) continue;

            const user = rows[0];

            // Compare password (bcrypt or plaintext fallback for dev/test)
            let passwordMatch = false;
            if (user.PasswordHash && user.PasswordHash.startsWith('$2')) {
                passwordMatch = await bcrypt.compare(password, user.PasswordHash);
            } else {
                passwordMatch = (password === user.PasswordHash);
            }

            if (!passwordMatch) {
                return res.status(401).json({ error: 'Invalid credentials' });
            }

            // Check if account is active (Status is BIT in SQL Server)
            if (!user.Status) {
                return res.status(403).json({
                    error: 'You are not allowed to use this app please contact the HR department'
                });
            }

            // Generate JWT with both UserMasterID and EmployeeMasterID
            const token = jwt.sign(
                {
                    userId: user.UserMasterID,
                    employeeId: user.EmployeeMasterID,
                    role: user.Role,
                    tenantDb
                },
                JWT_SECRET,
                { expiresIn: '12h' }
            );

            return res.json({
                success: true,
                token,
                user: {
                    id: user.UserMasterID,
                    email: user.Email,
                    name: user.Name,
                    role: user.Role,
                    tenantDb
                }
            });
        }

        return res.status(401).json({ error: 'Invalid credentials' });

    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// ============================================
// GET /api/user/units — Units assigned to the logged-in user
// ============================================
app.get('/api/user/units', authMiddleware, async (req, res) => {
    try {
        // Check if branch permissions exist for this user
        const permCheck = await dbQuery(req.pool,
            'SELECT COUNT(*) AS cnt FROM HR_EmployeeBranchPermissions WHERE UserMasterID = @userId',
            { userId: req.user.userId }
        );

        let rows;

        if (permCheck[0].cnt > 0) {
            // Branch permissions exist — use those as the unit source
            // Include main unit + all active allowed units
            rows = await dbQuery(req.pool,
                `SELECT DISTINCT u.UnitMasterId AS id, u.name,
                        g.Latitude AS latitude, g.Longitude AS longitude,
                        ISNULL(g.IsGeofenced, 1) AS is_geofenced
                 FROM Unit u
                 LEFT JOIN HR_UnitGPS g ON g.UnitMasterId = u.UnitMasterId
                 WHERE u.UnitMasterId IN (
                     SELECT MainUnitMasterId FROM HR_EmployeeBranchPermissions
                     WHERE UserMasterID = @userId
                     UNION
                     SELECT AllowedUnitMasterId FROM HR_EmployeeBranchPermissions
                     WHERE UserMasterID = @userId AND IsActive = 1
                 )
                 ORDER BY u.name`,
                { userId: req.user.userId }
            );
        } else {
            // No branch permissions — fall back to HR_UserUnits
            rows = await dbQuery(req.pool,
                `SELECT u.UnitMasterId AS id, u.name,
                        g.Latitude AS latitude, g.Longitude AS longitude,
                        ISNULL(g.IsGeofenced, 1) AS is_geofenced
                 FROM Unit u
                 LEFT JOIN HR_UnitGPS g ON g.UnitMasterId = u.UnitMasterId
                 JOIN HR_UserUnits uu ON u.UnitMasterId = uu.UnitMasterId
                 WHERE uu.UserMasterID = @userId
                 ORDER BY u.name`,
                { userId: req.user.userId }
            );
        }

        res.json({ success: true, units: rows });
    } catch (error) {
        console.error('User units error:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// ============================================
// GET /api/attendance/status — Today's punches for logged-in user
// ============================================
app.get('/api/attendance/status', authMiddleware, async (req, res) => {
    try {
        const today = new Date().toISOString().split('T')[0];

        const rows = await dbQuery(req.pool,
            `SELECT mp.Oid, mp.PunchDateTime1, mp.PunchDateTime2, mp.PunchDateTime3,
                    mp.PunchDateTime4, mp.PunchDateTime5, mp.PunchDateTime6, mp.PunchDateTime7,
                    mp.PunchDateTime8, mp.PunchDateTime9, mp.PunchDateTime10, mp.PunchDateTime11,
                    mp.PunchDateTime12, mp.PunchDateTime13, mp.PunchDateTime14,
                    pl.PunchLocation1, pl.PunchLocation2, pl.PunchLocation3, pl.PunchLocation4,
                    pl.PunchLocation5, pl.PunchLocation6, pl.PunchLocation7, pl.PunchLocation8,
                    pl.PunchLocation9, pl.PunchLocation10, pl.PunchLocation11, pl.PunchLocation12,
                    pl.PunchLocation13, pl.PunchLocation14
             FROM HR_DailyAttendanceMultiPunch mp
             LEFT JOIN HR_PunchLocations pl ON pl.MultiPunchOid = mp.Oid
             WHERE mp.EmployeeMasterID = @employeeId
               AND CAST(mp.AttendDate AS DATE) = @today`,
            { employeeId: req.user.employeeId, today }
        );

        if (rows.length === 0) {
            return res.json({ hasPunches: false, punchCount: 0 });
        }

        const row = rows[0];
        let punchCount = 0;
        const punches = [];
        for (let i = 1; i <= 14; i++) {
            if (row[`PunchDateTime${i}`] !== null) {
                punchCount++;
                punches.push({
                    index: i,
                    time: row[`PunchDateTime${i}`],
                    location: row[`PunchLocation${i}`]
                });
            }
        }

        res.json({
            hasPunches: true,
            punchCount,
            punches,
            attendanceId: row.Oid
        });
    } catch (error) {
        console.error('Attendance status error:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// ============================================
// GET /api/attendance/history — Last N days for logged-in user
// ============================================
app.get('/api/attendance/history', authMiddleware, async (req, res) => {
    try {
        const days = parseInt(req.query.days) || 30;

        const rows = await dbQuery(req.pool,
            `SELECT TOP (@days) mp.Oid, mp.AttendDate,
                    mp.PunchDateTime1, mp.PunchDateTime2, mp.PunchDateTime3,
                    mp.PunchDateTime4, mp.PunchDateTime5, mp.PunchDateTime6, mp.PunchDateTime7,
                    mp.PunchDateTime8, mp.PunchDateTime9, mp.PunchDateTime10, mp.PunchDateTime11,
                    mp.PunchDateTime12, mp.PunchDateTime13, mp.PunchDateTime14,
                    pl.PunchLocation1, pl.PunchLocation2, pl.PunchLocation3, pl.PunchLocation4,
                    pl.PunchLocation5, pl.PunchLocation6, pl.PunchLocation7, pl.PunchLocation8,
                    pl.PunchLocation9, pl.PunchLocation10, pl.PunchLocation11, pl.PunchLocation12,
                    pl.PunchLocation13, pl.PunchLocation14
             FROM HR_DailyAttendanceMultiPunch mp
             LEFT JOIN HR_PunchLocations pl ON pl.MultiPunchOid = mp.Oid
             WHERE mp.EmployeeMasterID = @employeeId
             ORDER BY mp.AttendDate DESC`,
            { employeeId: req.user.employeeId, days }
        );

        const records = rows.map(row => {
            const punches = [];
            for (let i = 1; i <= 14; i++) {
                if (row[`PunchDateTime${i}`]) {
                    punches.push({
                        index: i,
                        time: row[`PunchDateTime${i}`],
                        location: row[`PunchLocation${i}`]
                    });
                }
            }
            return {
                id: row.Oid,
                attend_date: row.AttendDate,
                punchCount: punches.length,
                punches
            };
        });

        res.json({ success: true, records });
    } catch (error) {
        console.error('Attendance history error:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// ============================================
// POST /api/attendance/punch — The 14-Punch Logic
// Writes to HR_DailyAttendanceMultiPunch + HR_PunchLocations
// ============================================
app.post('/api/attendance/punch', authMiddleware, async (req, res) => {
    try {
        const { unit_id, latitude, longitude } = req.body;
        const userId = req.user.userId;
        const employeeId = req.user.employeeId;
        const pool = req.pool;

        if (!unit_id || latitude === undefined || longitude === undefined) {
            return res.status(400).json({ error: 'unit_id, latitude, and longitude are required' });
        }

        // 1. Verify this user has access to this unit
        //    Check HR_EmployeeBranchPermissions first, fall back to HR_UserUnits
        const permCheck = await dbQuery(pool,
            'SELECT COUNT(*) AS cnt FROM HR_EmployeeBranchPermissions WHERE UserMasterID = @userId',
            { userId }
        );

        if (permCheck[0].cnt > 0) {
            // Branch permissions exist — unit must be main unit or active allowed unit
            const permRow = await dbQuery(pool,
                `SELECT 1 AS ok FROM HR_EmployeeBranchPermissions
                 WHERE UserMasterID = @userId AND (
                    MainUnitMasterId = @unitId
                    OR (AllowedUnitMasterId = @unitId AND IsActive = 1)
                 )`,
                { userId, unitId: unit_id }
            );

            if (permRow.length === 0) {
                return res.status(403).json({
                    error: 'You do not have active permission to punch in from this unit'
                });
            }
        } else {
            // No branch permissions — check HR_UserUnits
            const unitMapping = await dbQuery(pool,
                'SELECT 1 AS ok FROM HR_UserUnits WHERE UserMasterID = @userId AND UnitMasterId = @unitId',
                { userId, unitId: unit_id }
            );
            if (unitMapping.length === 0) {
                return res.status(403).json({ error: 'You are not assigned to this unit' });
            }
        }

        // 2. Fetch unit details with GPS from Unit + HR_UnitGPS
        const unitRows = await dbQuery(pool,
            `SELECT u.UnitMasterId AS id, u.name,
                    g.Latitude AS latitude, g.Longitude AS longitude,
                    ISNULL(g.IsGeofenced, 1) AS is_geofenced
             FROM Unit u
             LEFT JOIN HR_UnitGPS g ON g.UnitMasterId = u.UnitMasterId
             WHERE u.UnitMasterId = @unitId`,
            { unitId: unit_id }
        );
        if (unitRows.length === 0) {
            return res.status(404).json({ error: 'Unit not found' });
        }

        const unit = unitRows[0];

        // 3. Geofence check (only if is_geofenced = true)
        if (unit.is_geofenced) {
            if (unit.latitude === null || unit.longitude === null) {
                return res.status(400).json({ error: 'Unit GPS coordinates not configured. Contact admin.' });
            }
            const distance = calculateDistance(
                parseFloat(unit.latitude),
                parseFloat(unit.longitude),
                parseFloat(latitude),
                parseFloat(longitude)
            );

            console.log(`[PUNCH] User ${userId} | Unit "${unit.name}" | Distance: ${Math.round(distance)}m`);

            if (distance > 50) {
                return res.status(403).json({
                    error: 'You are too far from this location',
                    distance: Math.round(distance),
                    required: 50
                });
            }
        } else {
            console.log(`[PUNCH] User ${userId} | Unit "${unit.name}" | Geofence SKIPPED (WFH/Field)`);
        }

        // 4. Check if a row exists for today in HR_DailyAttendanceMultiPunch
        const today = new Date().toISOString().split('T')[0];
        const locationStr = `${latitude},${longitude}`;

        const existing = await dbQuery(pool,
            `SELECT Oid, PunchDateTime1, PunchDateTime2, PunchDateTime3,
                    PunchDateTime4, PunchDateTime5, PunchDateTime6, PunchDateTime7,
                    PunchDateTime8, PunchDateTime9, PunchDateTime10, PunchDateTime11,
                    PunchDateTime12, PunchDateTime13, PunchDateTime14
             FROM HR_DailyAttendanceMultiPunch
             WHERE EmployeeMasterID = @employeeId AND CAST(AttendDate AS DATE) = @today`,
            { employeeId, today }
        );

        if (existing.length === 0) {
            // No row yet — need employee details for required columns
            const empDetails = await dbQuery(pool,
                `SELECT ShiftMasterID, CategoryMasterID, BranchMasterID, CompanyMasterID, WorkingHours
                 FROM HR_EmployeeMaster WHERE EmployeeMasterID = @employeeId`,
                { employeeId }
            );

            if (empDetails.length === 0) {
                return res.status(404).json({ error: 'Employee record not found' });
            }

            const emp = empDetails[0];
            const now = new Date();

            // INSERT new attendance row with PunchDateTime1
            const insertResult = await pool.request()
                .input('employeeId', employeeId)
                .input('year', now.getFullYear())
                .input('month', now.getMonth() + 1)
                .input('today', today)
                .input('masterWH', emp.WorkingHours || 0)
                .input('shiftId', emp.ShiftMasterID)
                .input('categoryId', emp.CategoryMasterID)
                .input('branchId', emp.BranchMasterID)
                .input('companyId', emp.CompanyMasterID)
                .input('entryUser', userId)
                .query(`
                    INSERT INTO HR_DailyAttendanceMultiPunch (
                        EmployeeMasterID, AttendYear, AttendMonth, AttendDate, AttendanceStatus,
                        PunchDateTime1, ActualWorkingHours, MasterWorkingHours, WorkingHours,
                        ShiftMasterID, MonthlyAttendID, PayrollConfirmationID,
                        CategoryMasterID, BranchMasterID, CompanyMasterID, YearID, FormID,
                        EntryUserMasterID, EntryUserDateTime, SystemName
                    )
                    OUTPUT INSERTED.Oid
                    VALUES (
                        @employeeId, @year, @month, @today, 'P',
                        GETDATE(), 0, @masterWH, 0,
                        @shiftId, 0, 0,
                        @categoryId, @branchId, @companyId, 0, 0,
                        @entryUser, GETDATE(), 'MobileApp'
                    )
                `);

            const newOid = insertResult.recordset[0].Oid;

            // INSERT corresponding HR_PunchLocations row
            await pool.request()
                .input('oid', newOid)
                .input('location', locationStr)
                .query(`INSERT INTO HR_PunchLocations (MultiPunchOid, PunchLocation1)
                        VALUES (@oid, @location)`);

            return res.json({
                success: true,
                message: `Punch #1 recorded at ${unit.name}`,
                punchNumber: 1,
                unit: unit.name
            });
        }

        // Row exists — find the first empty PunchDateTimeX slot
        const row = existing[0];
        let slotFound = 0;

        for (let i = 1; i <= 14; i++) {
            if (row[`PunchDateTime${i}`] === null) {
                slotFound = i;
                break;
            }
        }

        if (slotFound === 0) {
            return res.status(400).json({
                error: 'Maximum 14 punches per day reached'
            });
        }

        // UPDATE the found slot in HR_DailyAttendanceMultiPunch
        await pool.request()
            .input('employeeId', employeeId)
            .input('today', today)
            .query(`UPDATE HR_DailyAttendanceMultiPunch
                     SET PunchDateTime${slotFound} = GETDATE()
                     WHERE EmployeeMasterID = @employeeId AND CAST(AttendDate AS DATE) = @today`);

        // UPDATE or INSERT PunchLocations for this slot
        const plExists = await dbQuery(pool,
            'SELECT 1 AS ok FROM HR_PunchLocations WHERE MultiPunchOid = @oid',
            { oid: row.Oid }
        );

        if (plExists.length > 0) {
            await pool.request()
                .input('oid', row.Oid)
                .input('location', locationStr)
                .query(`UPDATE HR_PunchLocations
                         SET PunchLocation${slotFound} = @location
                         WHERE MultiPunchOid = @oid`);
        } else {
            await pool.request()
                .input('oid', row.Oid)
                .input('location', locationStr)
                .query(`INSERT INTO HR_PunchLocations (MultiPunchOid, PunchLocation${slotFound})
                         VALUES (@oid, @location)`);
        }

        return res.json({
            success: true,
            message: `Punch #${slotFound} recorded at ${unit.name}`,
            punchNumber: slotFound,
            unit: unit.name
        });

    } catch (error) {
        console.error('Punch error:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// ============================================
// GET /api/admin/employees — employees in this tenant DB
// Optional: ?unit_id=X to filter by branch/unit
// ============================================
app.get('/api/admin/employees', authMiddleware, async (req, res) => {
    try {
        const unitId = req.query.unit_id ? parseInt(req.query.unit_id) : null;
        let rows;

        if (unitId) {
            rows = await dbQuery(req.pool,
                `SELECT DISTINCT um.UserMasterID AS id,
                        em.FirstName + ' ' + em.LastName AS name,
                        um.Email AS email, um.Role AS role, um.Status AS is_active
                 FROM HR_UserMaster um
                 JOIN HR_EmployeeMaster em ON um.EmployeeMasterID = em.EmployeeMasterID
                 JOIN HR_UserUnits uu ON um.UserMasterID = uu.UserMasterID
                 WHERE um.Role = 'EMPLOYEE' AND uu.UnitMasterId = @unitId
                 ORDER BY name`,
                { unitId }
            );
        } else {
            rows = await dbQuery(req.pool,
                `SELECT um.UserMasterID AS id,
                        em.FirstName + ' ' + em.LastName AS name,
                        um.Email AS email, um.Role AS role, um.Status AS is_active
                 FROM HR_UserMaster um
                 JOIN HR_EmployeeMaster em ON um.EmployeeMasterID = em.EmployeeMasterID
                 WHERE um.Role = 'EMPLOYEE'
                 ORDER BY name`
            );
        }

        res.json({ success: true, employees: rows });
    } catch (error) {
        console.error('Admin employees error:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// ============================================
// GET /api/admin/attendance?date=YYYY-MM-DD
// ============================================
app.get('/api/admin/attendance', authMiddleware, async (req, res) => {
    try {
        const targetDate = req.query.date || new Date().toISOString().split('T')[0];

        const employees = await dbQuery(req.pool,
            `SELECT um.UserMasterID AS id, um.EmployeeMasterID,
                    em.FirstName + ' ' + em.LastName AS name,
                    um.Email AS email, um.Status AS is_active
             FROM HR_UserMaster um
             JOIN HR_EmployeeMaster em ON um.EmployeeMasterID = em.EmployeeMasterID
             WHERE um.Role = 'EMPLOYEE'
             ORDER BY name`
        );

        const attendance = await dbQuery(req.pool,
            `SELECT mp.*,
                    pl.PunchLocation1, pl.PunchLocation2, pl.PunchLocation3, pl.PunchLocation4,
                    pl.PunchLocation5, pl.PunchLocation6, pl.PunchLocation7, pl.PunchLocation8,
                    pl.PunchLocation9, pl.PunchLocation10, pl.PunchLocation11, pl.PunchLocation12,
                    pl.PunchLocation13, pl.PunchLocation14
             FROM HR_DailyAttendanceMultiPunch mp
             LEFT JOIN HR_PunchLocations pl ON pl.MultiPunchOid = mp.Oid
             WHERE CAST(mp.AttendDate AS DATE) = @targetDate`,
            { targetDate }
        );

        const result = employees.map(emp => {
            const att = attendance.find(a => a.EmployeeMasterID === emp.EmployeeMasterID);
            const punches = [];
            if (att) {
                for (let i = 1; i <= 14; i++) {
                    if (att[`PunchDateTime${i}`] !== null) {
                        punches.push({
                            index: i,
                            time: att[`PunchDateTime${i}`],
                            location: att[`PunchLocation${i}`]
                        });
                    }
                }
            }
            return {
                id: emp.id,
                name: emp.name,
                email: emp.email,
                is_active: emp.is_active,
                hasPunches: !!att,
                punchCount: punches.length,
                punches
            };
        });

        res.json({ success: true, date: targetDate, employees: result });
    } catch (error) {
        console.error('Admin attendance error:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// ============================================
// PUT /api/admin/employees/access — Batch grant/revoke access
// Body: { user_ids: [1, 2, 5], is_active: false }
// ============================================
app.put('/api/admin/employees/access', authMiddleware, async (req, res) => {
    try {
        if (req.user.role !== 'ADMIN' && req.user.role !== 'SUPER_ADMIN') {
            return res.status(403).json({ error: 'Admin access required' });
        }

        const { user_ids, is_active } = req.body;

        if (!Array.isArray(user_ids) || user_ids.length === 0) {
            return res.status(400).json({ error: 'user_ids must be a non-empty array' });
        }

        if (is_active === undefined || is_active === null) {
            return res.status(400).json({ error: 'is_active is required (true or false)' });
        }

        // Build dynamic IN clause (SQL Server doesn't support array params)
        const request = req.pool.request();
        const placeholders = user_ids.map((id, i) => {
            request.input(`id${i}`, id);
            return `@id${i}`;
        }).join(',');
        request.input('status', is_active ? 1 : 0);

        await request.query(
            `UPDATE HR_UserMaster SET Status = @status
             WHERE UserMasterID IN (${placeholders}) AND Role = 'EMPLOYEE'`
        );

        const action = is_active ? 'granted' : 'revoked';
        res.json({
            success: true,
            message: `Access ${action} for ${user_ids.length} employee(s)`
        });
    } catch (error) {
        console.error('Batch access update error:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// ============================================
// GET /api/admin/employees/:id/branch-permissions
// ============================================
app.get('/api/admin/employees/:id/branch-permissions', authMiddleware, async (req, res) => {
    try {
        if (req.user.role !== 'ADMIN' && req.user.role !== 'SUPER_ADMIN') {
            return res.status(403).json({ error: 'Admin access required' });
        }

        const employeeId = parseInt(req.params.id);

        const rows = await dbQuery(req.pool,
            `SELECT ebp.MainUnitMasterId AS main_unit_id,
                    ebp.AllowedUnitMasterId AS allowed_unit_id,
                    ebp.IsActive AS is_active,
                    u.name AS allowed_unit_name
             FROM HR_EmployeeBranchPermissions ebp
             JOIN Unit u ON ebp.AllowedUnitMasterId = u.UnitMasterId
             WHERE ebp.UserMasterID = @employeeId
             ORDER BY u.name`,
            { employeeId }
        );

        const mainUnitId = rows.length > 0 ? rows[0].main_unit_id : null;

        const allowedUnits = rows.map(r => ({
            unit_id: r.allowed_unit_id,
            unit_name: r.allowed_unit_name,
            is_active: !!r.is_active
        }));

        res.json({
            success: true,
            main_unit_id: mainUnitId,
            allowed_units: allowedUnits
        });
    } catch (error) {
        console.error('Get branch permissions error:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// ============================================
// POST /api/admin/employees/:id/branch-permissions
// Upsert: { main_unit_id, allowed_units: [{ unit_id, is_active }] }
// ============================================
app.post('/api/admin/employees/:id/branch-permissions', authMiddleware, async (req, res) => {
    try {
        if (req.user.role !== 'ADMIN' && req.user.role !== 'SUPER_ADMIN') {
            return res.status(403).json({ error: 'Admin access required' });
        }

        const employeeId = parseInt(req.params.id);
        const { main_unit_id, allowed_units } = req.body;

        if (!main_unit_id) {
            return res.status(400).json({ error: 'main_unit_id is required' });
        }

        if (!Array.isArray(allowed_units)) {
            return res.status(400).json({ error: 'allowed_units must be an array' });
        }

        // Verify employee exists
        const empCheck = await dbQuery(req.pool,
            `SELECT UserMasterID FROM HR_UserMaster WHERE UserMasterID = @id AND Role = 'EMPLOYEE'`,
            { id: employeeId }
        );
        if (empCheck.length === 0) {
            return res.status(404).json({ error: 'Employee not found' });
        }

        // Delete existing permissions for this user, then re-insert
        await dbQuery(req.pool,
            'DELETE FROM HR_EmployeeBranchPermissions WHERE UserMasterID = @id',
            { id: employeeId }
        );

        // Insert each allowed unit
        for (const au of allowed_units) {
            await req.pool.request()
                .input('userId', employeeId)
                .input('mainUnit', main_unit_id)
                .input('allowedUnit', au.unit_id)
                .input('isActive', au.is_active ? 1 : 0)
                .query(`INSERT INTO HR_EmployeeBranchPermissions
                         (UserMasterID, MainUnitMasterId, AllowedUnitMasterId, IsActive)
                         VALUES (@userId, @mainUnit, @allowedUnit, @isActive)`);
        }

        res.json({
            success: true,
            message: `Branch permissions saved for employee ${employeeId}`
        });
    } catch (error) {
        console.error('Save branch permissions error:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// ============================================
// POST /api/auth/reverify — Re-authenticate Admin
// ============================================
app.post('/api/auth/reverify', authMiddleware, async (req, res) => {
    try {
        const { password } = req.body;

        if (!password) {
            return res.status(400).json({ error: 'Password is required' });
        }

        const rows = await dbQuery(req.pool,
            'SELECT UserMasterID, PasswordHash FROM HR_UserMaster WHERE UserMasterID = @userId',
            { userId: req.user.userId }
        );

        if (rows.length === 0) {
            return res.status(404).json({ error: 'User not found' });
        }

        const user = rows[0];

        let passwordMatch = false;
        if (user.PasswordHash && user.PasswordHash.startsWith('$2')) {
            passwordMatch = await bcrypt.compare(password, user.PasswordHash);
        } else {
            passwordMatch = (password === user.PasswordHash);
        }

        if (!passwordMatch) {
            return res.status(401).json({ error: 'Incorrect password' });
        }

        return res.json({ success: true, message: 'Password verified' });
    } catch (error) {
        console.error('Reverify error:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// ============================================
// GET /api/admin/units — All units with GPS data
// ============================================
app.get('/api/admin/units', authMiddleware, async (req, res) => {
    try {
        if (req.user.role !== 'ADMIN' && req.user.role !== 'SUPER_ADMIN') {
            return res.status(403).json({ error: 'Admin access required' });
        }

        const rows = await dbQuery(req.pool,
            `SELECT u.UnitMasterId AS id, u.name,
                    g.Latitude AS latitude, g.Longitude AS longitude,
                    ISNULL(g.IsGeofenced, 1) AS is_geofenced
             FROM Unit u
             LEFT JOIN HR_UnitGPS g ON g.UnitMasterId = u.UnitMasterId
             ORDER BY u.name`
        );
        res.json({ success: true, units: rows });
    } catch (error) {
        console.error('Admin units error:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// ============================================
// POST /api/units — Create a new unit (Admin only)
// Inserts into Unit table + HR_UnitGPS for GPS data
// ============================================
app.post('/api/units', authMiddleware, async (req, res) => {
    try {
        if (req.user.role !== 'ADMIN' && req.user.role !== 'SUPER_ADMIN') {
            return res.status(403).json({ error: 'Admin access required' });
        }

        const { name, latitude, longitude, is_geofenced } = req.body;

        if (!name || latitude === undefined || longitude === undefined) {
            return res.status(400).json({ error: 'name, latitude, and longitude are required' });
        }

        // Get company defaults from existing Company table
        const companies = await dbQuery(req.pool,
            'SELECT TOP 1 code, companymasterid FROM Company'
        );
        const companyCode = companies.length > 0 ? companies[0].code : 'APP';
        const companyMasterId = companies.length > 0 ? companies[0].companymasterid : 1;

        // Generate a unique unit code
        const unitCode = 'APP' + Date.now().toString().slice(-6);

        // Insert into Unit table with defaults for required fields
        const result = await req.pool.request()
            .input('companyCode', companyCode)
            .input('code', unitCode)
            .input('name', name)
            .input('companyMasterId', companyMasterId)
            .query(`
                INSERT INTO Unit (CompanyCode, code, name, address, city, State, Country,
                                  GSTRegDt, GSTStatus, ARNNo, CompanyMasterId)
                OUTPUT INSERTED.UnitMasterId
                VALUES (@companyCode, @code, @name, 'N/A', 'N/A', 'N/A', 'India',
                        GETDATE(), 'N/A', 'N/A', @companyMasterId)
            `);

        const unitId = result.recordset[0].UnitMasterId;

        // Insert GPS data into HR_UnitGPS
        await req.pool.request()
            .input('unitId', unitId)
            .input('lat', parseFloat(latitude))
            .input('lng', parseFloat(longitude))
            .input('geofenced', is_geofenced ? 1 : 0)
            .query(`INSERT INTO HR_UnitGPS (UnitMasterId, Latitude, Longitude, IsGeofenced)
                    VALUES (@unitId, @lat, @lng, @geofenced)`);

        res.json({
            success: true,
            message: `Unit "${name}" created successfully`,
            unitId
        });
    } catch (error) {
        console.error('Create unit error:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// ============================================
// PUT /api/units/:id — Update an existing unit (Admin only)
// Updates Unit.name + HR_UnitGPS GPS data
// ============================================
app.put('/api/units/:id', authMiddleware, async (req, res) => {
    try {
        if (req.user.role !== 'ADMIN' && req.user.role !== 'SUPER_ADMIN') {
            return res.status(403).json({ error: 'Admin access required' });
        }

        const unitId = parseInt(req.params.id);
        const { name, latitude, longitude, is_geofenced } = req.body;

        if (!name || latitude === undefined || longitude === undefined) {
            return res.status(400).json({ error: 'name, latitude, and longitude are required' });
        }

        // Verify unit exists
        const existing = await dbQuery(req.pool,
            'SELECT UnitMasterId FROM Unit WHERE UnitMasterId = @id',
            { id: unitId }
        );
        if (existing.length === 0) {
            return res.status(404).json({ error: 'Unit not found' });
        }

        // Update unit name
        await dbQuery(req.pool,
            'UPDATE Unit SET name = @name WHERE UnitMasterId = @id',
            { name, id: unitId }
        );

        // Upsert GPS data in HR_UnitGPS
        const gpsExists = await dbQuery(req.pool,
            'SELECT 1 AS ok FROM HR_UnitGPS WHERE UnitMasterId = @id',
            { id: unitId }
        );

        if (gpsExists.length > 0) {
            await req.pool.request()
                .input('id', unitId)
                .input('lat', parseFloat(latitude))
                .input('lng', parseFloat(longitude))
                .input('geofenced', is_geofenced ? 1 : 0)
                .query(`UPDATE HR_UnitGPS
                         SET Latitude = @lat, Longitude = @lng,
                             IsGeofenced = @geofenced, UpdatedAt = GETDATE()
                         WHERE UnitMasterId = @id`);
        } else {
            await req.pool.request()
                .input('id', unitId)
                .input('lat', parseFloat(latitude))
                .input('lng', parseFloat(longitude))
                .input('geofenced', is_geofenced ? 1 : 0)
                .query(`INSERT INTO HR_UnitGPS (UnitMasterId, Latitude, Longitude, IsGeofenced)
                         VALUES (@id, @lat, @lng, @geofenced)`);
        }

        res.json({
            success: true,
            message: `Unit "${name}" updated successfully`
        });
    } catch (error) {
        console.error('Update unit error:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// ============================================
// Start Server — connect to SQL Server first, then listen
// ============================================
async function startServer() {
    try {
        await initPools();
        app.listen(PORT, () => {
            console.log(`Server running on http://localhost:${PORT}`);
            console.log(`Connected to SQL Server`);
        });
    } catch (err) {
        console.error('Failed to start server:', err.message);
        process.exit(1);
    }
}

startServer();
