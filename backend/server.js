const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
require('dotenv').config();

const { initPools, getPool, dbQuery, TENANT_ORDER, sql } = require('./db');
const { authMiddleware, JWT_SECRET } = require('./middleware/auth');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
// Allow up to 25MB JSON bodies so base64 selfies fit
app.use(bodyParser.json({ limit: '25mb' }));

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
        const { unit_id, latitude, longitude, photo } = req.body;
        const userId = req.user.userId;
        const employeeId = req.user.employeeId;
        const pool = req.pool;

        if (!unit_id || latitude === undefined || longitude === undefined) {
            return res.status(400).json({ error: 'unit_id, latitude, and longitude are required' });
        }

        // Photo is mandatory — every punch must include a selfie as proof of presence.
        if (!photo || typeof photo !== 'string' || photo.length < 100) {
            return res.status(400).json({
                error: 'A selfie photo is required to punch. Please take a photo and try again.'
            });
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

            // INSERT selfie if provided (slot 1 for first punch)
            if (photo) {
                try {
                    await pool.request()
                        .input('oid', newOid)
                        .input('slot', 1)
                        .input('photo', photo)
                        .input('lat', latitude)
                        .input('lng', longitude)
                        .query(`INSERT INTO HR_PunchPhotos
                                (MultiPunchOid, PunchSlot, PhotoBase64, Latitude, Longitude)
                                VALUES (@oid, @slot, @photo, @lat, @lng)`);
                } catch (photoErr) {
                    console.error('Photo save failed (punch still recorded):', photoErr.message);
                }
            }

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

        // Save selfie for this slot if provided
        if (photo) {
            try {
                await pool.request()
                    .input('oid', row.Oid)
                    .input('slot', slotFound)
                    .input('photo', photo)
                    .input('lat', latitude)
                    .input('lng', longitude)
                    .query(`INSERT INTO HR_PunchPhotos
                            (MultiPunchOid, PunchSlot, PhotoBase64, Latitude, Longitude)
                            VALUES (@oid, @slot, @photo, @lat, @lng)`);
            } catch (photoErr) {
                console.error('Photo save failed (punch still recorded):', photoErr.message);
            }
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
// GET /api/admin/employee/:userId/punches?date=YYYY-MM-DD
// Returns full punch detail (time, location, photo) for one employee
// on a specific day. Photos come from HR_PunchPhotos as base64 strings.
// ============================================
app.get('/api/admin/employee/:userId/punches', authMiddleware, async (req, res) => {
    try {
        if (req.user.role !== 'ADMIN' && req.user.role !== 'SUPER_ADMIN') {
            return res.status(403).json({ error: 'Admin access required' });
        }

        const userId = parseInt(req.params.userId);
        const targetDate = req.query.date || new Date().toISOString().split('T')[0];

        // Resolve EmployeeMasterID
        const userRow = await dbQuery(req.pool,
            `SELECT um.EmployeeMasterID,
                    em.FirstName + ' ' + em.LastName AS name,
                    um.Email AS email, um.Status AS is_active
             FROM HR_UserMaster um
             JOIN HR_EmployeeMaster em ON um.EmployeeMasterID = em.EmployeeMasterID
             WHERE um.UserMasterID = @userId`,
            { userId }
        );

        if (userRow.length === 0) {
            return res.status(404).json({ error: 'Employee not found' });
        }

        const employee = userRow[0];

        // Pull the punch row + locations + photos in one query
        const rows = await dbQuery(req.pool,
            `SELECT mp.Oid,
                    mp.PunchDateTime1, mp.PunchDateTime2, mp.PunchDateTime3, mp.PunchDateTime4,
                    mp.PunchDateTime5, mp.PunchDateTime6, mp.PunchDateTime7, mp.PunchDateTime8,
                    mp.PunchDateTime9, mp.PunchDateTime10, mp.PunchDateTime11, mp.PunchDateTime12,
                    mp.PunchDateTime13, mp.PunchDateTime14,
                    pl.PunchLocation1, pl.PunchLocation2, pl.PunchLocation3, pl.PunchLocation4,
                    pl.PunchLocation5, pl.PunchLocation6, pl.PunchLocation7, pl.PunchLocation8,
                    pl.PunchLocation9, pl.PunchLocation10, pl.PunchLocation11, pl.PunchLocation12,
                    pl.PunchLocation13, pl.PunchLocation14
             FROM HR_DailyAttendanceMultiPunch mp
             LEFT JOIN HR_PunchLocations pl ON pl.MultiPunchOid = mp.Oid
             WHERE mp.EmployeeMasterID = @empId AND CAST(mp.AttendDate AS DATE) = @targetDate`,
            { empId: employee.EmployeeMasterID, targetDate }
        );

        const punches = [];
        let photoMap = {};

        if (rows.length > 0) {
            const row = rows[0];

            // Pull all photos for this attendance row
            const photos = await dbQuery(req.pool,
                `SELECT PunchSlot, PhotoBase64
                 FROM HR_PunchPhotos
                 WHERE MultiPunchOid = @oid`,
                { oid: row.Oid }
            );
            photoMap = Object.fromEntries(photos.map(p => [p.PunchSlot, p.PhotoBase64]));

            for (let i = 1; i <= 14; i++) {
                if (row[`PunchDateTime${i}`] !== null) {
                    punches.push({
                        index: i,
                        time: row[`PunchDateTime${i}`],
                        location: row[`PunchLocation${i}`] || null,
                        photo: photoMap[i] || null,
                    });
                }
            }
        }

        res.json({
            success: true,
            date: targetDate,
            employee: {
                id: userId,
                name: employee.name,
                email: employee.email,
                is_active: !!employee.is_active,
            },
            punches,
        });
    } catch (error) {
        console.error('Employee punches detail error:', error);
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

// ════════════════════════════════════════════════════════════════════════════
//                      LEAVE MANAGEMENT
// ════════════════════════════════════════════════════════════════════════════

// ============================================
// GET /api/leave/types — list active leave types (CL, SL, PL, EL, LWP …)
// ============================================
app.get('/api/leave/types', authMiddleware, async (req, res) => {
    try {
        const raw = await dbQuery(req.pool,
            `SELECT LeaveMasterID AS id, Code AS code, Name AS name,
                    Balance AS default_balance, Description AS description,
                    IsPaidLeave AS is_paid, HalfDayAllowed AS half_day_allowed
             FROM HR_LeaveMaster
             WHERE IsActive = 1
             ORDER BY Name`
        );
        // Trim nchar padding so "CL        " becomes "CL", and fall back to
        // the abbreviation when no description is set.
        const rows = raw.map(r => ({
            ...r,
            code: (r.code || '').trim(),
            name: (r.name || '').trim(),
            description: (r.description || '').trim() || (r.name || '').trim(),
        }));
        res.json({ success: true, leaveTypes: rows });
    } catch (error) {
        console.error('Leave types error:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// ============================================
// GET /api/leave/balance — remaining balance per leave type for the user
// ============================================
app.get('/api/leave/balance', authMiddleware, async (req, res) => {
    try {
        const fiscalYear = new Date().getFullYear();

        const rows = await dbQuery(req.pool,
            `SELECT lm.LeaveMasterID AS id,
                    lm.Code AS code,
                    lm.Name AS name,
                    lm.Description AS description,
                    lm.Balance AS total,
                    ISNULL((
                        SELECT SUM(AppliedDay)
                        FROM HR_LeaveApplication la
                        WHERE la.EmployeeMasterID = @empId
                          AND la.LeaveMasterID = lm.LeaveMasterID
                          AND la.Status IN ('Approved', 'Pending')
                          AND YEAR(la.FromDate) = @year
                    ), 0) AS consumed
             FROM HR_LeaveMaster lm
             WHERE lm.IsActive = 1
             ORDER BY lm.Name`,
            { empId: req.user.employeeId, year: fiscalYear }
        );

        const balances = rows.map(r => ({
            id: r.id,
            code: r.code,
            // "name" is the short abbreviation (CL, SL, ML); "description"
            // is the human-readable label (Casual Leave, Maternity Leave).
            name: (r.name || '').trim(),
            description: (r.description || '').trim() || (r.name || '').trim(),
            total: Number(r.total),
            consumed: Number(r.consumed),
            remaining: Math.max(0, Number(r.total) - Number(r.consumed)),
        }));

        res.json({ success: true, year: fiscalYear, balances });
    } catch (error) {
        console.error('Leave balance error:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// ============================================
// POST /api/leave/apply — submit a new leave request
// Body: { leave_master_id, from_date, to_date, day_type, half_day, reason }
// ============================================
app.post('/api/leave/apply', authMiddleware, async (req, res) => {
    try {
        const { leave_master_id, from_date, to_date, day_type, half_day, reason } = req.body;

        if (!leave_master_id || !from_date || !to_date) {
            return res.status(400).json({ error: 'leave_master_id, from_date and to_date are required' });
        }

        const fromD = new Date(from_date);
        const toD = new Date(to_date);
        if (toD < fromD) {
            return res.status(400).json({ error: 'to_date cannot be earlier than from_date' });
        }

        // Count number of leave days (inclusive).
        const diffDays = Math.floor((toD - fromD) / (1000 * 60 * 60 * 24)) + 1;
        const dayTypeNorm = (day_type || 'FullDay').trim();
        const isMultiDay = diffDays > 1;

        // Half-day / quarter-day only make sense for a SINGLE date.
        // Reject e.g. "01-06 → 03-06" submitted as HalfDay — the web app has
        // the same rule. The mobile UI already prevents this, but the API
        // guards it too in case of a stale client.
        if (isMultiDay && (dayTypeNorm === 'HalfDay' || dayTypeNorm === 'QuarterDay')) {
            return res.status(400).json({
                error: 'Half-day / Quarter-day leave can only be applied for a single date. For multiple days, use Full Day.'
            });
        }

        // Applied days: half/quarter reduce a single day; full day counts the range.
        let appliedDay = diffDays;
        if (dayTypeNorm === 'HalfDay') appliedDay = 0.5;
        else if (dayTypeNorm === 'QuarterDay') appliedDay = 0.25;

        // ── SP-based validation (same mechanism as the web portal) ──────────
        // Each leave type can carry a validation stored procedure in
        // HR_LeaveMaster.ValidationSPName (configured on the web Leave Master
        // screen). The SP vetoes the application via @IsValid/@ValidationMessage
        // output params. Business rules live in the DB so clients can change
        // them without touching app code.
        const typeRow = await dbQuery(req.pool,
            `SELECT LTRIM(RTRIM(ISNULL(ValidationSPName, ''))) AS spName,
                    LTRIM(RTRIM(ISNULL(ValidationMessage, ''))) AS fallbackMsg
             FROM HR_LeaveMaster
             WHERE LeaveMasterID = @leaveTypeId`,
            { leaveTypeId: leave_master_id }
        );
        if (typeRow.length === 0) {
            return res.status(400).json({ error: 'Unknown leave type.' });
        }

        const spName = typeRow[0].spName;
        // Whitelist the identifier — the name comes from an admin-managed
        // column, but never interpolate anything else into an EXEC.
        if (spName && /^[A-Za-z0-9_]+$/.test(spName)) {
            try {
                // Employee's company + the open HR period (used by the SP's
                // period-lock check). Fall back to 1 when not resolvable.
                const ctxRow = await dbQuery(req.pool,
                    `SELECT em.CompanyMasterID AS companyId,
                            ISNULL((SELECT TOP 1 Oid FROM HR_Period
                                    WHERE Status = 1
                                      AND CompanyMasterID = em.CompanyMasterID
                                    ORDER BY Oid DESC), 1) AS yearId
                     FROM HR_EmployeeMaster em
                     WHERE em.EmployeeMasterID = @empId`,
                    { empId: req.user.employeeId }
                );
                const companyId = ctxRow.length > 0 ? ctxRow[0].companyId : 1;
                const yearId = ctxRow.length > 0 ? ctxRow[0].yearId : 1;

                const spReq = req.pool.request();
                spReq.input('EmployeeMasterID', sql.Int, req.user.employeeId);
                spReq.input('LeaveMasterID', sql.Int, leave_master_id);
                spReq.input('FromDate', sql.Date, from_date);
                spReq.input('ToDate', sql.Date, to_date);
                spReq.input('DayLeaveType', sql.NVarChar(20), dayTypeNorm);
                spReq.input('CompanyMasterID', sql.Int, companyId);
                spReq.input('YearID', sql.BigInt, yearId);
                spReq.output('IsValid', sql.Bit);
                spReq.output('ValidationMessage', sql.NVarChar(500));

                const spResult = await spReq.execute(spName);

                if (!spResult.output.IsValid) {
                    const msg = spResult.output.ValidationMessage
                        || typeRow[0].fallbackMsg
                        || 'Leave application failed validation.';
                    return res.status(400).json({ error: msg });
                }
            } catch (spErr) {
                // 2812 = "Could not find stored procedure" — a client DB may
                // not ship the SP even if the name is configured. Log and fall
                // through to the inline backstop checks rather than blocking
                // every application.
                if (spErr.number === 2812) {
                    console.warn(`Leave validation SP '${spName}' not found — using inline checks only.`);
                } else {
                    console.error('Leave validation SP error:', spErr);
                    return res.status(500).json({ error: 'Leave validation failed. Please try again.' });
                }
            }
        }

        // Reject overlapping pending/approved requests (inline backstop —
        // also enforced by the SP when one is configured)
        const overlap = await dbQuery(req.pool,
            `SELECT COUNT(*) AS cnt
             FROM HR_LeaveApplication
             WHERE EmployeeMasterID = @empId
               AND Status IN ('Pending', 'Approved')
               AND NOT (ToDate < @fromD OR FromDate > @toD)`,
            { empId: req.user.employeeId, fromD: from_date, toD: to_date }
        );
        if (overlap[0].cnt > 0) {
            return res.status(409).json({
                error: 'You already have a Pending or Approved leave overlapping these dates.'
            });
        }

        // Live schema enforces NOT NULL on several "audit" columns —
        // supply sensible defaults so a mobile-side INSERT succeeds.
        const currentYear = new Date().getFullYear();
        const fasYear = `${currentYear}-${String(currentYear + 1).slice(-2)}`; // e.g. "2026-27"

        const inserted = await dbQuery(req.pool,
            `INSERT INTO HR_LeaveApplication
                (ApplicationDate, FromDate, ToDate, ReceiverReadDate,
                 LeaveMasterID, AppliedDay, DayLeaveType, HalfDayLeave,
                 LeaveReason, Status,
                 FASYear, YearID,
                 EmployeeMasterID, ReportingPersonID, CompanyMasterID,
                 EntryUserMasterID, EntryDateTime, SystemName)
             OUTPUT INSERTED.LeaveApplicationID AS id
             VALUES
                (CAST(GETDATE() AS DATE), @fromD, @toD, '19000101',
                 @leaveTypeId, @days, @dayType, @halfDay,
                 @reason, 'Pending',
                 @fasYear, 1,
                 @empId, 0, 1,
                 @userId, GETDATE(), 'MOBILE')`,
            {
                fromD: from_date,
                toD: to_date,
                leaveTypeId: leave_master_id,
                days: appliedDay,
                dayType: dayTypeNorm,
                halfDay: half_day || null,
                // Live LeaveReason is widened to nvarchar(500) by the alignment script;
                // keep an extra safety truncate in case the alignment isn't applied yet.
                reason: reason ? String(reason).slice(0, 500) : null,
                fasYear,
                empId: req.user.employeeId,
                userId: req.user.userId,
            }
        );

        // ── Build the multi-level approval chain (web parity) ────────────────
        // csp_Payroll_InsertLeaveApprovalLevels walks the applicant's
        // ReportingPersonID hierarchy and creates one HR_LeaveAppAuthLeavel row
        // per senior; only level 1 starts active. If the employee has no
        // reporting person (or the SP isn't installed), no rows are created and
        // the application falls back to direct HR decision — non-fatal.
        let awaitingSenior = false;
        try {
            const empCo = await dbQuery(req.pool,
                `SELECT CompanyMasterID FROM HR_EmployeeMaster WHERE EmployeeMasterID = @empId`,
                { empId: req.user.employeeId }
            );
            const chainReq = req.pool.request();
            chainReq.input('LeaveApplicationID', sql.Int, inserted[0].id);
            chainReq.input('LeaveMasterID', sql.Int, leave_master_id);
            chainReq.input('EmployeeID', sql.Int, req.user.employeeId);
            chainReq.input('CompanyMasterID', sql.Int, empCo.length > 0 ? empCo[0].CompanyMasterID : 1);
            chainReq.input('UserID', sql.Int, req.user.userId);
            chainReq.input('SystemName', sql.VarChar(100), 'MOBILE');
            await chainReq.execute('csp_Payroll_InsertLeaveApprovalLevels');

            const lvl = await dbQuery(req.pool,
                `SELECT COUNT(*) AS cnt FROM HR_LeaveAppAuthLeavel WHERE LeaveApplicationID = @id`,
                { id: inserted[0].id }
            );
            awaitingSenior = lvl[0].cnt > 0;
        } catch (chainErr) {
            if (chainErr.number === 2812) {
                console.warn('Approval chain SP not installed — application goes straight to HR.');
            } else {
                console.error('Approval chain creation error:', chainErr);
            }
        }

        res.json({
            success: true,
            message: awaitingSenior
                ? 'Leave request submitted — awaiting your senior\'s approval.'
                : 'Leave request submitted',
            id: inserted[0].id,
        });
    } catch (error) {
        console.error('Apply leave error:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// ============================================
// Helper: stamp approved leave onto the attendance tables.
// Ported from Authorize.aspx.cs — on FINAL approval the web portal marks
// the leave days in HR_DailyAttendance + HR_DailyAttendanceMultiPunch
// ('L' full day, 'HL'→'HP' half day). runReq() must return a fresh mssql
// Request bound to the caller's pool or transaction.
// ============================================
async function stampAttendanceForLeave(runReq, { employeeId, leaveTypeId, fromDate, toDate, dayType }) {
    const levSt = dayType === 'HalfDay' ? 'HL' : 'L';
    const hpha = dayType === 'HalfDay' ? 'HP' : '';

    const bind = (r) => r
        .input('LevSt', sql.NVarChar(2), levSt)
        .input('Hpha', sql.NVarChar(2), hpha)
        .input('LevID', sql.BigInt, leaveTypeId)
        .input('EmpID', sql.BigInt, employeeId)
        .input('FromDate', sql.Date, fromDate)
        .input('ToDate', sql.Date, toDate);

    await bind(runReq()).query(`
        UPDATE HR_DailyAttendance
        SET AttendanceStatus = CASE WHEN AttendanceStatus = 'HL' THEN 'L' ELSE @LevSt END,
            HP_HA            = CASE WHEN AttendanceStatus = 'HL' THEN ''  ELSE @Hpha  END,
            LeaveMasterID    = CASE WHEN LeaveMasterID IS NULL     THEN @LevID ELSE LeaveMasterID  END,
            LeaveMasterID1   = CASE WHEN LeaveMasterID IS NOT NULL THEN @LevID ELSE LeaveMasterID1 END
        WHERE EmployeeMasterID = @EmpID
          AND AttendDate BETWEEN @FromDate AND @ToDate`);

    await bind(runReq()).query(`
        UPDATE HR_DailyAttendanceMultiPunch
        SET AttendanceStatus = CASE WHEN AttendanceStatus = 'HL' THEN 'L' ELSE @LevSt END,
            HP_HA            = CASE WHEN AttendanceStatus = 'HL' THEN ''  ELSE @Hpha  END,
            LeaveMasterID    = CASE WHEN LeaveMasterID  IS NULL THEN @LevID ELSE LeaveMasterID  END,
            LeaveMasterID1   = CASE WHEN LeaveMasterID1 IS NULL THEN @LevID ELSE LeaveMasterID1 END
        WHERE EmployeeMasterID = @EmpID
          AND AttendDate BETWEEN @FromDate AND @ToDate`);
}

// ============================================
// GET /api/leave/approvals — pending team requests where the logged-in
// user is the active-level approver (any employee can be a senior).
// Mirrors the web Authorize screen's grid query.
// ============================================
app.get('/api/leave/approvals', authMiddleware, async (req, res) => {
    try {
        const tbl = await dbQuery(req.pool,
            `SELECT CASE WHEN OBJECT_ID('dbo.HR_LeaveAppAuthLeavel','U') IS NULL THEN 0 ELSE 1 END AS ok`);
        if (!tbl[0].ok) {
            return res.json({ success: true, approvals: [] });
        }

        const rows = await dbQuery(req.pool,
            `SELECT la.LeaveAppAuthID AS auth_id,
                    la.LeaveAuthLevel AS level,
                    l.LeaveApplicationID AS id,
                    l.ApplicationDate AS applied_on,
                    l.FromDate AS from_date,
                    l.ToDate AS to_date,
                    l.AppliedDay AS days,
                    l.DayLeaveType AS day_type,
                    l.LeaveReason AS reason,
                    l.EmployeeMasterID AS employee_id,
                    em.FirstName + ' ' + ISNULL(em.LastName, '') AS employee_name,
                    ISNULL(lm.Name, '—') AS leave_code,
                    ISNULL(NULLIF(LTRIM(RTRIM(lm.Description)), ''), ISNULL(lm.Name, 'Leave')) AS leave_name
             FROM HR_LeaveAppAuthLeavel la
             JOIN HR_LeaveApplication l ON l.LeaveApplicationID = la.LeaveApplicationID
             JOIN HR_EmployeeMaster em ON em.EmployeeMasterID = l.EmployeeMasterID
             LEFT JOIN HR_LeaveMaster lm ON lm.LeaveMasterID = l.LeaveMasterID
             WHERE la.ReportingPersonID = @empId
               AND la.AuthStatus = 'PENDING'
               AND la.IsActive = 1
             ORDER BY l.LeaveApplicationID DESC`,
            { empId: req.user.employeeId }
        );
        res.json({ success: true, approvals: rows });
    } catch (error) {
        console.error('Team approvals error:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// ============================================
// POST /api/leave/approvals/:authId/decide — senior approves/rejects
// their level. Ported from Authorize.aspx.cs BatchUpdate:
//   Approve → close level, activate next; no next → application Approved
//             + leave days stamped onto attendance.
//   Reject  → close level, cancel remaining levels, application Rejected.
// ============================================
app.post('/api/leave/approvals/:authId/decide', authMiddleware, async (req, res) => {
    const authId = parseInt(req.params.authId);
    const { decision, comment } = req.body;

    if (decision !== 'Approved' && decision !== 'Rejected') {
        return res.status(400).json({ error: 'decision must be either "Approved" or "Rejected"' });
    }

    const tx = new sql.Transaction(req.pool);
    try {
        await tx.begin();
        const runReq = () => new sql.Request(tx);

        // The row must belong to this approver, be pending, and be the active level.
        const levelRes = await runReq()
            .input('authId', sql.Int, authId)
            .input('empId', sql.Int, req.user.employeeId)
            .query(`SELECT la.LeaveApplicationID, la.LeaveAuthLevel,
                           l.EmployeeMasterID, l.LeaveMasterID,
                           l.FromDate, l.ToDate, l.DayLeaveType, l.Status
                    FROM HR_LeaveAppAuthLeavel la
                    JOIN HR_LeaveApplication l ON l.LeaveApplicationID = la.LeaveApplicationID
                    WHERE la.LeaveAppAuthID = @authId
                      AND la.ReportingPersonID = @empId
                      AND la.AuthStatus = 'PENDING'
                      AND la.IsActive = 1`);

        if (levelRes.recordset.length === 0) {
            await tx.rollback();
            return res.status(404).json({ error: 'Approval request not found, already decided, or not your turn.' });
        }
        const lvl = levelRes.recordset[0];

        if (lvl.Status !== 'Pending') {
            await tx.rollback();
            return res.status(400).json({ error: `Application is already ${lvl.Status}.` });
        }

        // Close out this level with the approver's decision.
        await runReq()
            .input('authId', sql.Int, authId)
            .input('decision', sql.VarChar(20), decision)
            .query(`UPDATE HR_LeaveAppAuthLeavel
                    SET AuthStatus = @decision, AuthDateTime = GETDATE(), IsActive = 0
                    WHERE LeaveAppAuthID = @authId`);

        let finalized = false;

        if (decision === 'Approved') {
            // Activate the next level, if any.
            const nextRes = await runReq()
                .input('leaveId', sql.Int, lvl.LeaveApplicationID)
                .input('nextLevel', sql.Int, lvl.LeaveAuthLevel + 1)
                .query(`UPDATE HR_LeaveAppAuthLeavel
                        SET IsActive = 1
                        WHERE LeaveApplicationID = @leaveId AND LeaveAuthLevel = @nextLevel`);

            if (nextRes.rowsAffected[0] === 0) {
                // No next level — this approver was the last: finalize.
                finalized = true;
                await runReq()
                    .input('leaveId', sql.Int, lvl.LeaveApplicationID)
                    .input('userId', sql.BigInt, req.user.userId)
                    .input('comment', sql.NVarChar(500), comment || null)
                    .query(`UPDATE HR_LeaveApplication
                            SET Status = 'Approved',
                                ReceiverReadDate = GETDATE(),
                                ApprovedBy = @userId,
                                ApprovedDate = GETDATE(),
                                ApproverComment = @comment,
                                EditUserMasterID = @userId,
                                EditDateTime = GETDATE()
                            WHERE LeaveApplicationID = @leaveId`);

                await stampAttendanceForLeave(runReq, {
                    employeeId: lvl.EmployeeMasterID,
                    leaveTypeId: lvl.LeaveMasterID,
                    fromDate: lvl.FromDate,
                    toDate: lvl.ToDate,
                    dayType: lvl.DayLeaveType,
                });
            }
        } else {
            // Rejection at any level kills the application.
            finalized = true;
            await runReq()
                .input('leaveId', sql.Int, lvl.LeaveApplicationID)
                .query(`UPDATE HR_LeaveAppAuthLeavel
                        SET AuthStatus = 'Cancelled', IsActive = 0
                        WHERE LeaveApplicationID = @leaveId AND AuthStatus = 'PENDING'`);

            await runReq()
                .input('leaveId', sql.Int, lvl.LeaveApplicationID)
                .input('userId', sql.BigInt, req.user.userId)
                .input('comment', sql.NVarChar(500), comment || null)
                .query(`UPDATE HR_LeaveApplication
                        SET Status = 'Rejected',
                            ApprovedBy = @userId,
                            ApprovedDate = GETDATE(),
                            ApproverComment = @comment,
                            EditUserMasterID = @userId,
                            EditDateTime = GETDATE()
                        WHERE LeaveApplicationID = @leaveId`);
        }

        await tx.commit();

        res.json({
            success: true,
            finalized,
            message: decision === 'Approved'
                ? (finalized ? 'Leave fully approved.' : 'Approved — forwarded to the next approver.')
                : 'Leave request rejected.',
        });
    } catch (error) {
        try { await tx.rollback(); } catch (_) { /* already rolled back */ }
        console.error('Team approval decide error:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// ============================================
// GET /api/leave/my — list logged-in user's own leave applications
// ============================================
app.get('/api/leave/my', authMiddleware, async (req, res) => {
    try {
        // Approval columns are optional — fall back to NULL if not yet added.
        const cols = await dbQuery(req.pool, `
            SELECT MAX(CASE WHEN name='ApprovedDate'    THEN 1 ELSE 0 END) AS hasApprovedDate,
                   MAX(CASE WHEN name='ApproverComment' THEN 1 ELSE 0 END) AS hasComment
            FROM sys.columns
            WHERE object_id = OBJECT_ID(N'[dbo].[HR_LeaveApplication]')`);
        const apDateExpr = cols[0].hasApprovedDate ? 'la.ApprovedDate' : 'CAST(NULL AS DATETIME)';
        const apCmtExpr  = cols[0].hasComment      ? 'la.ApproverComment' : 'CAST(NULL AS NVARCHAR(500))';

        // When the approval-chain table exists, surface whose desk each
        // pending application is currently sitting on ("With: <senior>").
        const authTbl = await dbQuery(req.pool,
            `SELECT CASE WHEN OBJECT_ID('dbo.HR_LeaveAppAuthLeavel','U') IS NULL THEN 0 ELSE 1 END AS ok`);
        const pendingWithExpr = authTbl[0].ok
            ? `(SELECT TOP 1 aem.FirstName + ' ' + ISNULL(aem.LastName, '')
                FROM HR_LeaveAppAuthLeavel al
                JOIN HR_EmployeeMaster aem ON aem.EmployeeMasterID = al.ReportingPersonID
                WHERE al.LeaveApplicationID = la.LeaveApplicationID
                  AND al.AuthStatus = 'PENDING' AND al.IsActive = 1)`
            : 'CAST(NULL AS NVARCHAR(200))';

        const rows = await dbQuery(req.pool,
            `SELECT la.LeaveApplicationID AS id,
                    la.ApplicationDate AS applied_on,
                    la.FromDate AS from_date,
                    la.ToDate AS to_date,
                    la.AppliedDay AS days,
                    la.DayLeaveType AS day_type,
                    la.HalfDayLeave AS half_day,
                    la.LeaveReason AS reason,
                    la.Status AS status,
                    ${apDateExpr} AS approved_date,
                    ${apCmtExpr} AS approver_comment,
                    ${pendingWithExpr} AS pending_with,
                    ISNULL(lm.Name, '—') AS leave_code,
                    ISNULL(NULLIF(LTRIM(RTRIM(lm.Description)), ''), ISNULL(lm.Name, 'Leave')) AS leave_name
             FROM HR_LeaveApplication la
             LEFT JOIN HR_LeaveMaster lm ON lm.LeaveMasterID = la.LeaveMasterID
             WHERE la.EmployeeMasterID = @empId
             ORDER BY la.LeaveApplicationID DESC`,
            { empId: req.user.employeeId }
        );
        res.json({ success: true, leaves: rows });
    } catch (error) {
        console.error('My leaves error:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// ============================================
// DELETE /api/leave/:id — user cancels their own pending leave
// ============================================
app.delete('/api/leave/:id', authMiddleware, async (req, res) => {
    try {
        const id = parseInt(req.params.id);

        // Only allow cancelling Pending leaves owned by the caller
        const rows = await dbQuery(req.pool,
            `SELECT Status FROM HR_LeaveApplication
             WHERE LeaveApplicationID = @id AND EmployeeMasterID = @empId`,
            { id, empId: req.user.employeeId }
        );
        if (rows.length === 0) {
            return res.status(404).json({ error: 'Leave request not found' });
        }
        if (rows[0].Status !== 'Pending') {
            return res.status(400).json({
                error: 'Only Pending requests can be cancelled.'
            });
        }

        await dbQuery(req.pool,
            `UPDATE HR_LeaveApplication
             SET Status = 'Cancelled',
                 EditUserMasterID = @userId,
                 EditDateTime = GETDATE()
             WHERE LeaveApplicationID = @id`,
            { id, userId: req.user.userId }
        );

        // Withdraw any pending approval-chain levels too (if the table exists).
        await dbQuery(req.pool,
            `IF OBJECT_ID('dbo.HR_LeaveAppAuthLeavel','U') IS NOT NULL
                 UPDATE HR_LeaveAppAuthLeavel
                 SET AuthStatus = 'Cancelled', IsActive = 0
                 WHERE LeaveApplicationID = @id AND AuthStatus = 'PENDING'`,
            { id }
        );

        res.json({ success: true, message: 'Leave request cancelled' });
    } catch (error) {
        console.error('Cancel leave error:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// ============================================
// GET /api/admin/leave/pending — admin: list pending leave requests
// Optional ?status=Pending|Approved|Rejected|All
// ============================================
app.get('/api/admin/leave/pending', authMiddleware, async (req, res) => {
    try {
        if (req.user.role !== 'ADMIN' && req.user.role !== 'SUPER_ADMIN') {
            return res.status(403).json({ error: 'Admin access required' });
        }

        const statusFilter = req.query.status || 'Pending';
        const whereClause = statusFilter === 'All' ? '' : 'WHERE la.Status = @status';

        const cols = await dbQuery(req.pool, `
            SELECT MAX(CASE WHEN name='ApprovedDate'    THEN 1 ELSE 0 END) AS hasApprovedDate,
                   MAX(CASE WHEN name='ApproverComment' THEN 1 ELSE 0 END) AS hasComment
            FROM sys.columns
            WHERE object_id = OBJECT_ID(N'[dbo].[HR_LeaveApplication]')`);
        const apDateExpr = cols[0].hasApprovedDate ? 'la.ApprovedDate' : 'CAST(NULL AS DATETIME)';
        const apCmtExpr  = cols[0].hasComment      ? 'la.ApproverComment' : 'CAST(NULL AS NVARCHAR(500))';

        const rows = await dbQuery(req.pool,
            `SELECT la.LeaveApplicationID AS id,
                    la.ApplicationDate AS applied_on,
                    la.FromDate AS from_date,
                    la.ToDate AS to_date,
                    la.AppliedDay AS days,
                    la.DayLeaveType AS day_type,
                    la.HalfDayLeave AS half_day,
                    la.LeaveReason AS reason,
                    la.Status AS status,
                    ${apDateExpr} AS approved_date,
                    ${apCmtExpr} AS approver_comment,
                    la.EmployeeMasterID AS employee_id,
                    em.FirstName + ' ' + ISNULL(em.LastName, '') AS employee_name,
                    ISNULL(lm.Name, '—') AS leave_code,
                    ISNULL(NULLIF(LTRIM(RTRIM(lm.Description)), ''), ISNULL(lm.Name, 'Leave')) AS leave_name
             FROM HR_LeaveApplication la
             LEFT JOIN HR_LeaveMaster lm ON lm.LeaveMasterID = la.LeaveMasterID
             JOIN HR_EmployeeMaster em ON em.EmployeeMasterID = la.EmployeeMasterID
             ${whereClause}
             ORDER BY la.LeaveApplicationID DESC`,
            statusFilter === 'All' ? {} : { status: statusFilter }
        );
        res.json({ success: true, leaves: rows });
    } catch (error) {
        console.error('Admin leave list error:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// ============================================
// POST /api/admin/leave/:id/decide — approve or reject
// Body: { decision: 'Approved' | 'Rejected', comment?: string }
// ============================================
app.post('/api/admin/leave/:id/decide', authMiddleware, async (req, res) => {
    try {
        if (req.user.role !== 'ADMIN' && req.user.role !== 'SUPER_ADMIN') {
            return res.status(403).json({ error: 'Admin access required' });
        }

        const id = parseInt(req.params.id);
        const { decision, comment } = req.body;

        if (decision !== 'Approved' && decision !== 'Rejected') {
            return res.status(400).json({
                error: 'decision must be either "Approved" or "Rejected"'
            });
        }

        const rows = await dbQuery(req.pool,
            `SELECT Status, EmployeeMasterID, LeaveMasterID, FromDate, ToDate, DayLeaveType
             FROM HR_LeaveApplication WHERE LeaveApplicationID = @id`,
            { id }
        );
        if (rows.length === 0) {
            return res.status(404).json({ error: 'Leave request not found' });
        }
        if (rows[0].Status !== 'Pending') {
            return res.status(400).json({
                error: `Already ${rows[0].Status} — only Pending requests can be decided.`
            });
        }

        // Detect whether the alignment script's columns exist yet
        const cols = await dbQuery(req.pool, `
            SELECT MAX(CASE WHEN name='ApprovedBy'      THEN 1 ELSE 0 END) AS hasApprovedBy,
                   MAX(CASE WHEN name='ApprovedDate'    THEN 1 ELSE 0 END) AS hasApprovedDate,
                   MAX(CASE WHEN name='ApproverComment' THEN 1 ELSE 0 END) AS hasComment
            FROM sys.columns
            WHERE object_id = OBJECT_ID(N'[dbo].[HR_LeaveApplication]')`);
        const hasApprovalFields =
            cols[0].hasApprovedBy && cols[0].hasApprovedDate && cols[0].hasComment;

        const updateSql = hasApprovalFields
            ? `UPDATE HR_LeaveApplication
               SET Status = @decision,
                   ApprovedBy = @userId,
                   ApprovedDate = GETDATE(),
                   ApproverComment = @comment,
                   EditUserMasterID = @userId,
                   EditDateTime = GETDATE()
               WHERE LeaveApplicationID = @id`
            : `UPDATE HR_LeaveApplication
               SET Status = @decision,
                   EditUserMasterID = @userId,
                   EditDateTime = GETDATE()
               WHERE LeaveApplicationID = @id`;

        await dbQuery(req.pool, updateSql,
            { id, decision, userId: req.user.userId, comment: comment || null }
        );

        // HR decision overrides the senior chain: retire any levels still
        // pending so nothing lingers in a senior's queue.
        await dbQuery(req.pool,
            `IF OBJECT_ID('dbo.HR_LeaveAppAuthLeavel','U') IS NOT NULL
                 UPDATE HR_LeaveAppAuthLeavel
                 SET AuthStatus = 'Cancelled', IsActive = 0
                 WHERE LeaveApplicationID = @id AND AuthStatus = 'PENDING'`,
            { id }
        );

        // On approval, stamp the leave days onto the attendance tables —
        // same side-effect the web portal performs on final approval.
        if (decision === 'Approved') {
            try {
                await stampAttendanceForLeave(() => req.pool.request(), {
                    employeeId: rows[0].EmployeeMasterID,
                    leaveTypeId: rows[0].LeaveMasterID,
                    fromDate: rows[0].FromDate,
                    toDate: rows[0].ToDate,
                    dayType: rows[0].DayLeaveType,
                });
            } catch (stampErr) {
                // Attendance rows may not exist yet for future dates — non-fatal.
                console.warn('Attendance stamp on admin approval failed:', stampErr.message);
            }
        }

        res.json({
            success: true,
            message: `Leave request ${decision.toLowerCase()}`,
        });
    } catch (error) {
        console.error('Decide leave error:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// ════════════════════════════════════════════════════════════════════════════
//                      ATTENDANCE ADJUSTMENT
// ════════════════════════════════════════════════════════════════════════════

// ============================================
// POST /api/adjustment/apply — submit an adjustment request
// Body: { type, attendence_date, in_time, out_time, reason }
// type: MissedPunch | WrongPunch | OnDuty | WFH
// ============================================
app.post('/api/adjustment/apply', authMiddleware, async (req, res) => {
    try {
        const { type, attendence_date, in_time, out_time, reason } = req.body;

        const allowedTypes = ['MissedPunch', 'WrongPunch', 'OnDuty', 'WFH'];
        if (!type || !allowedTypes.includes(type)) {
            return res.status(400).json({
                error: `type must be one of: ${allowedTypes.join(', ')}`
            });
        }
        if (!attendence_date || !reason) {
            return res.status(400).json({ error: 'attendence_date and reason are required' });
        }

        // Generate a sequential DocNo like AA-000123
        const seqRow = await dbQuery(req.pool,
            `SELECT ISNULL(MAX(CAST(SUBSTRING(DocNo, 4, 50) AS BIGINT)), 0) + 1 AS nextSeq
             FROM HR_AttendenceAdjustment
             WHERE DocNo LIKE 'AA-%'`
        );
        const docNo = `AA-${String(seqRow[0].nextSeq).padStart(6, '0')}`;

        // Live schema requires InTime / OutTime / ReportingPersonID NOT NULL.
        // When the user doesn't supply a time, default to the attendance date
        // at midnight so the INSERT succeeds — admins can edit it on approval.
        const dateAt = (timeStr, isoDate) => {
            if (timeStr) return timeStr;        // already an ISO datetime
            return `${isoDate}T00:00:00`;       // fallback
        };

        const inserted = await dbQuery(req.pool,
            `INSERT INTO HR_AttendenceAdjustment
                (DocNo, DocDate,
                 EmployeeMasterID, ReportingPersonID,
                 Type, AttendenceDate, InTime, OutTime,
                 Reason, ApprovalStatus,
                 EntryUserMasterID, EntryUserDateTime,
                 CompanyMasterID, SystemName, Status)
             OUTPUT INSERTED.Oid AS id
             VALUES
                (@docNo, GETDATE(),
                 @empId, 0,
                 @type, @date, @inTime, @outTime,
                 @reason, 'Pending',
                 @userId, GETDATE(),
                 1, 'MOBILE', 1)`,
            {
                docNo,
                empId: req.user.employeeId,
                type,
                date: attendence_date,
                inTime: dateAt(in_time, attendence_date),
                outTime: dateAt(out_time, attendence_date),
                // Live Reason is nvarchar(255) — truncate just in case
                reason: String(reason).slice(0, 255),
                userId: req.user.userId,
            }
        );

        res.json({
            success: true,
            message: 'Adjustment request submitted',
            id: inserted[0].id,
            docNo,
        });
    } catch (error) {
        console.error('Apply adjustment error:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// ============================================
// GET /api/adjustment/my — list user's own adjustment requests
// ============================================
app.get('/api/adjustment/my', authMiddleware, async (req, res) => {
    try {
        const rows = await dbQuery(req.pool,
            `SELECT Oid AS id, DocNo AS doc_no, DocDate AS doc_date,
                    Type AS type, AttendenceDate AS attendence_date,
                    InTime AS in_time, OutTime AS out_time,
                    Reason AS reason, ApprovalStatus AS status,
                    ApprovedDate AS approved_date, ManagerComment AS manager_comment
             FROM HR_AttendenceAdjustment
             WHERE EmployeeMasterID = @empId AND Status = 1
             ORDER BY Oid DESC`,
            { empId: req.user.employeeId }
        );
        res.json({ success: true, adjustments: rows });
    } catch (error) {
        console.error('My adjustments error:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// ============================================
// GET /api/admin/adjustment/pending — admin: list adjustment requests
// ============================================
app.get('/api/admin/adjustment/pending', authMiddleware, async (req, res) => {
    try {
        if (req.user.role !== 'ADMIN' && req.user.role !== 'SUPER_ADMIN') {
            return res.status(403).json({ error: 'Admin access required' });
        }

        const statusFilter = req.query.status || 'Pending';
        const whereClause = statusFilter === 'All'
            ? 'WHERE a.Status = 1'
            : 'WHERE a.Status = 1 AND a.ApprovalStatus = @status';

        const rows = await dbQuery(req.pool,
            `SELECT a.Oid AS id, a.DocNo AS doc_no, a.DocDate AS doc_date,
                    a.Type AS type, a.AttendenceDate AS attendence_date,
                    a.InTime AS in_time, a.OutTime AS out_time,
                    a.Reason AS reason, a.ApprovalStatus AS status,
                    a.ApprovedDate AS approved_date, a.ManagerComment AS manager_comment,
                    a.EmployeeMasterID AS employee_id,
                    em.FirstName + ' ' + ISNULL(em.LastName, '') AS employee_name
             FROM HR_AttendenceAdjustment a
             JOIN HR_EmployeeMaster em ON em.EmployeeMasterID = a.EmployeeMasterID
             ${whereClause}
             ORDER BY a.Oid DESC`,
            statusFilter === 'All' ? {} : { status: statusFilter }
        );
        res.json({ success: true, adjustments: rows });
    } catch (error) {
        console.error('Admin adjustments error:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// ============================================
// POST /api/admin/adjustment/:id/decide
// Body: { decision: 'Approved' | 'Rejected', comment?: string }
// ============================================
app.post('/api/admin/adjustment/:id/decide', authMiddleware, async (req, res) => {
    try {
        if (req.user.role !== 'ADMIN' && req.user.role !== 'SUPER_ADMIN') {
            return res.status(403).json({ error: 'Admin access required' });
        }

        const id = parseInt(req.params.id);
        const { decision, comment } = req.body;

        if (decision !== 'Approved' && decision !== 'Rejected') {
            return res.status(400).json({
                error: 'decision must be either "Approved" or "Rejected"'
            });
        }

        const rows = await dbQuery(req.pool,
            `SELECT ApprovalStatus FROM HR_AttendenceAdjustment WHERE Oid = @id`,
            { id }
        );
        if (rows.length === 0) {
            return res.status(404).json({ error: 'Adjustment request not found' });
        }
        if (rows[0].ApprovalStatus !== 'Pending') {
            return res.status(400).json({
                error: `Already ${rows[0].ApprovalStatus} — only Pending requests can be decided.`
            });
        }

        await dbQuery(req.pool,
            `UPDATE HR_AttendenceAdjustment
             SET ApprovalStatus = @decision,
                 ApprovedBy = @userId,
                 ApprovedDate = GETDATE(),
                 ManagerComment = @comment,
                 EditUserMasterID = @userId,
                 EditUserDateTime = GETDATE()
             WHERE Oid = @id`,
            { id, decision, userId: req.user.userId, comment: comment || null }
        );

        res.json({
            success: true,
            message: `Adjustment request ${decision.toLowerCase()}`,
        });
    } catch (error) {
        console.error('Decide adjustment error:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// ════════════════════════════════════════════════════════════════════════════
//                      SALARY SLIP
// ════════════════════════════════════════════════════════════════════════════

// ============================================
// GET /api/salary/months — list months that have a slip for the user
// ============================================
app.get('/api/salary/months', authMiddleware, async (req, res) => {
    try {
        const rows = await dbQuery(req.pool,
            `SELECT Oid AS id, PayrollYear AS year, PayrollMonth AS month,
                    CalculatedNetPay AS net_pay, MasterNetPay AS master_net_pay
             FROM HR_PayrollSalaryConfirmation
             WHERE EmployeeMasterID = @empId
             ORDER BY PayrollYear DESC, PayrollMonth DESC`,
            { empId: req.user.employeeId }
        );
        res.json({ success: true, months: rows });
    } catch (error) {
        console.error('Salary months error:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// ============================================
// GET /api/salary/slip/:id — full slip detail (header + line items)
// ============================================
app.get('/api/salary/slip/:id', authMiddleware, async (req, res) => {
    try {
        const id = parseInt(req.params.id);

        // Allow admins to fetch any employee's slip; employees only their own.
        const isAdmin = req.user.role === 'ADMIN' || req.user.role === 'SUPER_ADMIN';
        const ownerCheck = isAdmin
            ? ''
            : ' AND s.EmployeeMasterID = @empId';

        // Live schema: extra fields we surface on the printable slip
        const header = await dbQuery(req.pool,
            `SELECT s.Oid AS id, s.EmployeeMasterID AS employee_id,
                    s.PayrollMonth AS month, s.PayrollYear AS year,
                    s.FromDate AS from_date, s.ToDate AS to_date,
                    s.MonthDays AS month_days, s.WorkingDays AS working_days,
                    s.TotalPayDays AS pay_days,
                    s.BasicAmount AS basic, s.GrossAmount AS gross,
                    s.CTCAmount AS ctc, s.OTAmount AS ot_amount,
                    s.CalculatedNetPay AS net_pay, s.MasterNetPay AS master_net_pay,
                    s.CategoryMasterID AS category_id, s.BranchMasterID AS branch_id,
                    em.FirstName + ' ' + ISNULL(em.LastName, '') AS employee_name,
                    em.Code AS employee_code,
                    um.Email AS employee_email,
                    dm.DesignationName AS designation,
                    dp.DepartmentName AS department,
                    u.name AS branch_name,
                    co.name AS company_name
             FROM HR_PayrollSalaryConfirmation s
             JOIN HR_EmployeeMaster em ON em.EmployeeMasterID = s.EmployeeMasterID
             LEFT JOIN HR_UserMaster        um ON um.EmployeeMasterID    = em.EmployeeMasterID
             LEFT JOIN HR_DesignationMaster dm ON dm.DesignationMasterID = em.DesignationMasterID
             LEFT JOIN HR_DepartmentMaster  dp ON dp.DepartmentMasterID  = em.DepartmentMasterID
             LEFT JOIN Unit                 u  ON u.UnitMasterId         = s.BranchMasterID
             LEFT JOIN Company              co ON co.companymasterid     = s.CompanyMasterID
             WHERE s.Oid = @id${ownerCheck}`,
            { id, empId: req.user.employeeId }
        );

        if (header.length === 0) {
            return res.status(404).json({ error: 'Salary slip not found' });
        }

        // Live schema uses bracketed column names "[Sr.No.]" and "[Add/Deduct]",
        // and head name comes from a join with HR_SalaryHeadMaster.
        const details = await dbQuery(req.pool,
            `SELECT d.[Sr.No.] AS sr_no,
                    ISNULL(h.Name, d.AccountHeadCode) AS head_name,
                    d.AccountHeadCode AS head_code,
                    d.[Add/Deduct] AS add_deduct,
                    ISNULL(d.CalculatedAmount, d.Amount) AS amount,
                    d.Remarks AS remarks
             FROM HR_PayrollSalaryConfirmationDetails d
             LEFT JOIN HR_SalaryHeadMaster h ON h.SalaryHeadMasterID = d.SalaryHeadMasterID
             WHERE d.PayrollConfirmationID = @id
             ORDER BY d.[Sr.No.]`,
            { id }
        );

        res.json({
            success: true,
            slip: header[0],
            lineItems: details,
        });
    } catch (error) {
        console.error('Salary slip error:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// ============================================
// GET /api/salary/slip/:id/html — printable HTML for PDF generation
//
// The web portal renders salary slips via DevExpress XtraReports, which
// is Windows-only. Mobile cannot run that runtime, so the backend produces
// an equivalent printable HTML document that mirrors the web layout, and
// the React Native side feeds it through expo-print to produce a real PDF.
// ============================================
app.get('/api/salary/slip/:id/html', authMiddleware, async (req, res) => {
    try {
        const id = parseInt(req.params.id);
        const isAdmin = req.user.role === 'ADMIN' || req.user.role === 'SUPER_ADMIN';
        const ownerCheck = isAdmin ? '' : ' AND s.EmployeeMasterID = @empId';

        const header = await dbQuery(req.pool,
            `SELECT s.Oid AS id, s.EmployeeMasterID AS employee_id,
                    s.PayrollMonth AS month, s.PayrollYear AS year,
                    s.FromDate AS from_date, s.ToDate AS to_date,
                    s.MonthDays AS month_days, s.WorkingDays AS working_days,
                    s.TotalPayDays AS pay_days,
                    s.BasicAmount AS basic, s.GrossAmount AS gross,
                    s.CTCAmount AS ctc, s.OTAmount AS ot_amount,
                    s.CalculatedNetPay AS net_pay, s.MasterNetPay AS master_net_pay,
                    em.FirstName + ' ' + ISNULL(em.LastName, '') AS employee_name,
                    em.Code AS employee_code,
                    um.Email AS employee_email,
                    dm.DesignationName AS designation,
                    dp.DepartmentName AS department,
                    u.name AS branch_name,
                    co.name AS company_name
             FROM HR_PayrollSalaryConfirmation s
             JOIN HR_EmployeeMaster em ON em.EmployeeMasterID = s.EmployeeMasterID
             LEFT JOIN HR_UserMaster        um ON um.EmployeeMasterID    = em.EmployeeMasterID
             LEFT JOIN HR_DesignationMaster dm ON dm.DesignationMasterID = em.DesignationMasterID
             LEFT JOIN HR_DepartmentMaster  dp ON dp.DepartmentMasterID  = em.DepartmentMasterID
             LEFT JOIN Unit                 u  ON u.UnitMasterId         = s.BranchMasterID
             LEFT JOIN Company              co ON co.companymasterid     = s.CompanyMasterID
             WHERE s.Oid = @id${ownerCheck}`,
            { id, empId: req.user.employeeId }
        );

        if (header.length === 0) {
            return res.status(404).json({ error: 'Salary slip not found' });
        }

        const items = await dbQuery(req.pool,
            `SELECT d.[Sr.No.] AS sr_no,
                    ISNULL(h.Name, d.AccountHeadCode) AS head_name,
                    d.[Add/Deduct] AS add_deduct,
                    ISNULL(d.CalculatedAmount, d.Amount) AS amount
             FROM HR_PayrollSalaryConfirmationDetails d
             LEFT JOIN HR_SalaryHeadMaster h ON h.SalaryHeadMasterID = d.SalaryHeadMasterID
             WHERE d.PayrollConfirmationID = @id
             ORDER BY d.[Sr.No.]`,
            { id }
        );

        const html = renderSalarySlipHtml(header[0], items);
        res.json({ success: true, html });
    } catch (error) {
        console.error('Salary slip HTML error:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// Build a printable HTML salary slip matching the web portal layout.
// Pure string concat — no template engine dependency.
function renderSalarySlipHtml(h, items) {
    const monthName = [
        'January', 'February', 'March', 'April', 'May', 'June',
        'July', 'August', 'September', 'October', 'November', 'December',
    ][(h.month || 1) - 1];

    const inr = (n) => '₹' + Number(n || 0).toLocaleString('en-IN', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    });
    const esc = (s) => String(s || '')
        .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;').replace(/'/g, '&#39;');

    const earnings   = items.filter((i) => i.add_deduct === 'Add');
    const deductions = items.filter((i) => i.add_deduct === 'Deduct');
    const totalE = earnings.reduce((sum, i) => sum + Number(i.amount || 0), 0);
    const totalD = deductions.reduce((sum, i) => sum + Number(i.amount || 0), 0);

    const row = (i) => `
        <tr>
          <td>${i.sr_no}</td>
          <td>${esc(i.head_name)}</td>
          <td class="amt">${inr(i.amount)}</td>
        </tr>`;

    return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>Salary Slip — ${monthName} ${h.year}</title>
<style>
  * { box-sizing: border-box; }
  body {
    font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif;
    color: #1F1D1B;
    background: #F4F1EC;
    margin: 0;
    padding: 32px;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }
  .slip {
    background: #FBF9F5;
    border: 1px solid #E5DFD5;
    border-radius: 12px;
    padding: 28px;
    max-width: 800px;
    margin: 0 auto;
  }
  .head {
    text-align: center;
    border-bottom: 2px solid #1B4F8A;
    padding-bottom: 16px;
    margin-bottom: 20px;
  }
  .head .company { font-size: 22px; font-weight: 700; color: #1B4F8A; letter-spacing: -0.3px; }
  .head .branch  { font-size: 13px; color: #6B655E; margin-top: 4px; }
  .head h1 {
    font-size: 18px; font-weight: 600; color: #1F1D1B;
    margin: 12px 0 0 0;
  }
  .meta {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 8px 24px;
    background: #FFFFFE;
    border: 1px solid #E5DFD5;
    border-radius: 8px;
    padding: 14px 18px;
    margin-bottom: 18px;
  }
  .meta .row { display: flex; justify-content: space-between; padding: 4px 0; }
  .meta .lbl { color: #6B655E; font-size: 12px; letter-spacing: 0.2px; }
  .meta .val { color: #1F1D1B; font-size: 13px; font-weight: 600; }
  .stats {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 12px;
    margin-bottom: 18px;
  }
  .stat {
    background: #EDE9E3; border-radius: 8px;
    text-align: center; padding: 12px;
  }
  .stat .num { font-size: 20px; font-weight: 700; color: #1B4F8A; }
  .stat .lbl { font-size: 11px; color: #6B655E; margin-top: 2px; letter-spacing: 0.6px; text-transform: uppercase; }
  .columns {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 16px;
    margin-bottom: 18px;
  }
  .tbl {
    border: 1px solid #E5DFD5;
    border-radius: 8px;
    overflow: hidden;
  }
  .tbl h2 {
    font-size: 11px; font-weight: 700; letter-spacing: 0.8px;
    background: #EDE9E3; color: #6B655E;
    padding: 8px 14px; margin: 0; text-transform: uppercase;
  }
  table { width: 100%; border-collapse: collapse; }
  th, td {
    padding: 8px 14px; font-size: 13px;
    border-bottom: 1px solid #E5DFD5;
    color: #3A3733;
  }
  th { text-align: left; font-weight: 600; color: #6B655E; font-size: 11px; letter-spacing: 0.4px; text-transform: uppercase; }
  td.amt { text-align: right; font-variant-numeric: tabular-nums; }
  tr.total td {
    font-weight: 700; color: #1F1D1B;
    background: #FFFEFB; border-top: 1px solid #D7CFC2; border-bottom: none;
  }
  .net {
    display: flex;
    justify-content: space-between;
    align-items: center;
    background: #1B4F8A;
    color: #FAFAF8;
    border-radius: 10px;
    padding: 16px 22px;
    margin-top: 8px;
  }
  .net .lbl { font-size: 14px; opacity: 0.85; letter-spacing: 0.4px; }
  .net .val { font-size: 24px; font-weight: 700; letter-spacing: -0.3px; font-variant-numeric: tabular-nums; }
  .foot {
    text-align: center;
    font-size: 10px; color: #8F8A82;
    margin-top: 20px;
    border-top: 1px solid #E5DFD5;
    padding-top: 12px;
  }
</style>
</head>
<body>
  <div class="slip">
    <div class="head">
      <div class="company">${esc(h.company_name || 'Solution One')}</div>
      ${h.branch_name ? `<div class="branch">${esc(h.branch_name)}</div>` : ''}
      <h1>Pay Slip · ${monthName} ${h.year}</h1>
    </div>

    <div class="meta">
      <div class="row"><span class="lbl">Employee</span><span class="val">${esc(h.employee_name)}</span></div>
      <div class="row"><span class="lbl">Code</span><span class="val">${esc(h.employee_code)}</span></div>
      ${h.designation ? `<div class="row"><span class="lbl">Designation</span><span class="val">${esc(h.designation)}</span></div>` : ''}
      ${h.department  ? `<div class="row"><span class="lbl">Department</span><span class="val">${esc(h.department)}</span></div>` : ''}
    </div>

    <div class="stats">
      <div class="stat"><div class="num">${h.month_days || '—'}</div><div class="lbl">Month days</div></div>
      <div class="stat"><div class="num">${h.working_days || '—'}</div><div class="lbl">Working</div></div>
      <div class="stat"><div class="num">${h.pay_days || '—'}</div><div class="lbl">Pay days</div></div>
    </div>

    <div class="columns">
      <div class="tbl">
        <h2>Earnings</h2>
        <table>
          <thead><tr><th>#</th><th>Head</th><th class="amt">Amount</th></tr></thead>
          <tbody>
            ${earnings.map(row).join('')}
            <tr class="total"><td></td><td>Total Earnings</td><td class="amt">${inr(totalE)}</td></tr>
          </tbody>
        </table>
      </div>
      <div class="tbl">
        <h2>Deductions</h2>
        <table>
          <thead><tr><th>#</th><th>Head</th><th class="amt">Amount</th></tr></thead>
          <tbody>
            ${deductions.map(row).join('')}
            <tr class="total"><td></td><td>Total Deductions</td><td class="amt">${inr(totalD)}</td></tr>
          </tbody>
        </table>
      </div>
    </div>

    <div class="net">
      <span class="lbl">NET PAY</span>
      <span class="val">${inr(h.net_pay)}</span>
    </div>

    <div class="foot">
      This is a computer-generated payslip and does not require a signature.
      <br>Generated on ${new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}.
    </div>
  </div>
</body>
</html>`;
}

// ════════════════════════════════════════════════════════════════════════════
//                      REPORTS
// ════════════════════════════════════════════════════════════════════════════

// ============================================
// GET /api/admin/reports — list saved/custom reports
// Optional ?category=Attendance|Payroll|Leave|Asset
// ============================================
app.get('/api/admin/reports', authMiddleware, async (req, res) => {
    try {
        if (req.user.role !== 'ADMIN' && req.user.role !== 'SUPER_ADMIN') {
            return res.status(403).json({ error: 'Admin access required' });
        }

        // Description and Category are added by the alignment script but the
        // live DB may not have them yet — detect at runtime and fall back.
        const colCheck = await dbQuery(req.pool, `
            SELECT
              MAX(CASE WHEN name = 'Description' THEN 1 ELSE 0 END) AS hasDescription,
              MAX(CASE WHEN name = 'Category'    THEN 1 ELSE 0 END) AS hasCategory
            FROM sys.columns
            WHERE object_id = OBJECT_ID(N'[dbo].[HR_ReportLayout]')`);
        const hasDescription = !!(colCheck[0] && colCheck[0].hasDescription);
        const hasCategory    = !!(colCheck[0] && colCheck[0].hasCategory);

        const category = req.query.category;
        const where = category && hasCategory ? 'WHERE Category = @category' : '';

        const descExpr = hasDescription ? 'Description' : 'CAST(NULL AS NVARCHAR(MAX))';
        const catExpr  = hasCategory    ? 'Category'    : `CAST('Other' AS NVARCHAR(50))`;
        const orderBy  = hasCategory    ? 'Category, DisplayName' : 'DisplayName';

        const rows = await dbQuery(req.pool,
            `SELECT ReportId AS id, DisplayName AS name,
                    ${descExpr} AS description,
                    ${catExpr} AS category,
                    EntryDateTime AS created_on
             FROM HR_ReportLayout
             ${where}
             ORDER BY ${orderBy}`,
            category && hasCategory ? { category } : {}
        );
        res.json({ success: true, reports: rows });
    } catch (error) {
        console.error('Reports list error:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// ════════════════════════════════════════════════════════════════════════════
//                      ATTENDANCE REPORT (employee self-service)
// ════════════════════════════════════════════════════════════════════════════

// Helper: from a MultiPunch row, pull the ordered list of punch datetimes.
function punchesFromRow(row) {
    const list = [];
    for (let i = 1; i <= 14; i++) {
        if (row[`PunchDateTime${i}`]) list.push(new Date(row[`PunchDateTime${i}`]));
    }
    list.sort((a, b) => a - b);
    return list;
}

// Helper: build the per-day report rows from raw MultiPunch rows.
function buildReportRows(rows) {
    return rows.map(row => {
        const punches = punchesFromRow(row);
        const punchIn = punches.length > 0 ? punches[0] : null;
        const punchOut = punches.length > 1 ? punches[punches.length - 1] : null;

        let workedMinutes = 0;
        if (punchIn && punchOut) {
            workedMinutes = Math.max(0, Math.round((punchOut - punchIn) / 60000));
        }

        return {
            date: row.AttendDate,
            punch_in: punchIn ? punchIn.toISOString() : null,
            punch_out: punchOut ? punchOut.toISOString() : null,
            punch_count: punches.length,
            worked_minutes: workedMinutes,
            // Present if there is at least one punch for the day.
            status: punches.length > 0 ? 'Present' : 'Absent',
        };
    });
}

// ============================================
// GET /api/attendance/report?month=&year=
// Date-wise attendance with first punch (in) and last punch (out).
// Defaults to the current month when month/year are omitted.
// ============================================
app.get('/api/attendance/report', authMiddleware, async (req, res) => {
    try {
        const now = new Date();
        const month = parseInt(req.query.month) || (now.getMonth() + 1);
        const year = parseInt(req.query.year) || now.getFullYear();

        // First and last calendar day of the requested month (inclusive range).
        const fromDate = `${year}-${String(month).padStart(2, '0')}-01`;
        const lastDay = new Date(year, month, 0).getDate();
        const toDate = `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;

        const rows = await dbQuery(req.pool,
            `SELECT mp.Oid, mp.AttendDate,
                    mp.PunchDateTime1, mp.PunchDateTime2, mp.PunchDateTime3, mp.PunchDateTime4,
                    mp.PunchDateTime5, mp.PunchDateTime6, mp.PunchDateTime7, mp.PunchDateTime8,
                    mp.PunchDateTime9, mp.PunchDateTime10, mp.PunchDateTime11, mp.PunchDateTime12,
                    mp.PunchDateTime13, mp.PunchDateTime14
             FROM HR_DailyAttendanceMultiPunch mp
             WHERE mp.EmployeeMasterID = @empId
               AND CAST(mp.AttendDate AS DATE) BETWEEN @fromDate AND @toDate
             ORDER BY mp.AttendDate ASC`,
            { empId: req.user.employeeId, fromDate, toDate }
        );

        const report = buildReportRows(rows);
        const presentDays = report.length;
        const totalMinutes = report.reduce((sum, r) => sum + r.worked_minutes, 0);

        res.json({
            success: true,
            month,
            year,
            summary: {
                present_days: presentDays,
                total_minutes: totalMinutes,
            },
            rows: report,
        });
    } catch (error) {
        console.error('Attendance report error:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// ============================================
// GET /api/attendance/report/html?month=&year=
// Printable HTML version for PDF download via expo-print.
// ============================================
app.get('/api/attendance/report/html', authMiddleware, async (req, res) => {
    try {
        const now = new Date();
        const month = parseInt(req.query.month) || (now.getMonth() + 1);
        const year = parseInt(req.query.year) || now.getFullYear();

        const fromDate = `${year}-${String(month).padStart(2, '0')}-01`;
        const lastDay = new Date(year, month, 0).getDate();
        const toDate = `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;

        // Employee identity for the report header
        const emp = await dbQuery(req.pool,
            `SELECT em.FirstName + ' ' + ISNULL(em.LastName, '') AS name,
                    em.Code AS code,
                    co.name AS company_name
             FROM HR_EmployeeMaster em
             LEFT JOIN Company co ON co.companymasterid = em.CompanyMasterID
             WHERE em.EmployeeMasterID = @empId`,
            { empId: req.user.employeeId }
        );

        const rows = await dbQuery(req.pool,
            `SELECT mp.Oid, mp.AttendDate,
                    mp.PunchDateTime1, mp.PunchDateTime2, mp.PunchDateTime3, mp.PunchDateTime4,
                    mp.PunchDateTime5, mp.PunchDateTime6, mp.PunchDateTime7, mp.PunchDateTime8,
                    mp.PunchDateTime9, mp.PunchDateTime10, mp.PunchDateTime11, mp.PunchDateTime12,
                    mp.PunchDateTime13, mp.PunchDateTime14
             FROM HR_DailyAttendanceMultiPunch mp
             WHERE mp.EmployeeMasterID = @empId
               AND CAST(mp.AttendDate AS DATE) BETWEEN @fromDate AND @toDate
             ORDER BY mp.AttendDate ASC`,
            { empId: req.user.employeeId, fromDate, toDate }
        );

        const report = buildReportRows(rows);
        const html = renderAttendanceReportHtml(
            emp[0] || { name: 'Employee', code: '', company_name: 'Solution One' },
            month, year, report,
        );
        res.json({ success: true, html });
    } catch (error) {
        console.error('Attendance report HTML error:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// Build a printable HTML attendance report.
function renderAttendanceReportHtml(emp, month, year, rows) {
    const monthName = [
        'January', 'February', 'March', 'April', 'May', 'June',
        'July', 'August', 'September', 'October', 'November', 'December',
    ][month - 1];

    const esc = (s) => String(s || '')
        .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

    const fmtTime = (iso) => {
        if (!iso) return '—';
        const d = new Date(iso);
        return d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
    };
    const fmtDate = (iso) => {
        const d = new Date(iso);
        return d.toLocaleDateString('en-GB', { weekday: 'short', day: '2-digit', month: 'short' });
    };
    const fmtHrs = (mins) => {
        if (!mins) return '—';
        const h = Math.floor(mins / 60);
        const m = mins % 60;
        return `${h}h ${m}m`;
    };

    const totalMin = rows.reduce((s, r) => s + r.worked_minutes, 0);

    const body = rows.length === 0
        ? `<tr><td colspan="5" class="empty">No attendance records for this month</td></tr>`
        : rows.map(r => `
            <tr>
              <td>${esc(fmtDate(r.date))}</td>
              <td class="c">${fmtTime(r.punch_in)}</td>
              <td class="c">${fmtTime(r.punch_out)}</td>
              <td class="c">${r.punch_count}</td>
              <td class="r">${fmtHrs(r.worked_minutes)}</td>
            </tr>`).join('');

    return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>Attendance Report — ${monthName} ${year}</title>
<style>
  * { box-sizing: border-box; }
  body { font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; color: #1F1D1B; background: #F4F1EC; margin: 0; padding: 32px; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  .sheet { background: #FBF9F5; border: 1px solid #E5DFD5; border-radius: 12px; padding: 28px; max-width: 800px; margin: 0 auto; }
  .head { text-align: center; border-bottom: 2px solid #1B4F8A; padding-bottom: 16px; margin-bottom: 20px; }
  .head .company { font-size: 22px; font-weight: 700; color: #1B4F8A; }
  .head h1 { font-size: 18px; font-weight: 600; margin: 12px 0 0; }
  .meta { display: flex; justify-content: space-between; background: #FFFFFE; border: 1px solid #E5DFD5; border-radius: 8px; padding: 12px 18px; margin-bottom: 18px; }
  .meta .lbl { color: #6B655E; font-size: 11px; text-transform: uppercase; letter-spacing: 0.4px; }
  .meta .val { color: #1F1D1B; font-size: 14px; font-weight: 600; }
  table { width: 100%; border-collapse: collapse; border: 1px solid #E5DFD5; border-radius: 8px; overflow: hidden; }
  th, td { padding: 9px 14px; font-size: 13px; border-bottom: 1px solid #E5DFD5; color: #3A3733; }
  th { background: #EDE9E3; text-align: left; font-weight: 700; color: #6B655E; font-size: 11px; text-transform: uppercase; letter-spacing: 0.4px; }
  td.c, th.c { text-align: center; }
  td.r, th.r { text-align: right; font-variant-numeric: tabular-nums; }
  td.empty { text-align: center; color: #8F8A82; padding: 24px; }
  .summary { display: flex; gap: 12px; margin-top: 18px; }
  .stat { flex: 1; background: #EDE9E3; border-radius: 8px; text-align: center; padding: 14px; }
  .stat .num { font-size: 20px; font-weight: 700; color: #1B4F8A; }
  .stat .lbl { font-size: 11px; color: #6B655E; margin-top: 2px; text-transform: uppercase; letter-spacing: 0.4px; }
  .foot { text-align: center; font-size: 10px; color: #8F8A82; margin-top: 20px; border-top: 1px solid #E5DFD5; padding-top: 12px; }
</style>
</head>
<body>
  <div class="sheet">
    <div class="head">
      <div class="company">${esc(emp.company_name || 'Solution One')}</div>
      <h1>Attendance Report · ${monthName} ${year}</h1>
    </div>
    <div class="meta">
      <div><div class="lbl">Employee</div><div class="val">${esc(emp.name)}</div></div>
      <div style="text-align:right"><div class="lbl">Code</div><div class="val">${esc(emp.code)}</div></div>
    </div>
    <table>
      <thead><tr><th>Date</th><th class="c">Punch In</th><th class="c">Punch Out</th><th class="c">Punches</th><th class="r">Hours</th></tr></thead>
      <tbody>${body}</tbody>
    </table>
    <div class="summary">
      <div class="stat"><div class="num">${rows.length}</div><div class="lbl">Present days</div></div>
      <div class="stat"><div class="num">${Math.floor(totalMin / 60)}h ${totalMin % 60}m</div><div class="lbl">Total hours</div></div>
    </div>
    <div class="foot">Computer-generated attendance report · Generated ${new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</div>
  </div>
</body>
</html>`;
}

// ════════════════════════════════════════════════════════════════════════════
//                      HOLIDAY LIST
// ════════════════════════════════════════════════════════════════════════════

// ============================================
// GET /api/holidays?scope=upcoming|all&year=
// Company holidays for the logged-in employee. Defaults to upcoming-only.
// ============================================
app.get('/api/holidays', authMiddleware, async (req, res) => {
    try {
        const scope = (req.query.scope || 'upcoming').toString();

        // Resolve the employee's company so we don't show duplicate per-company rows.
        const empRow = await dbQuery(req.pool,
            `SELECT CompanyMasterID FROM HR_EmployeeMaster WHERE EmployeeMasterID = @empId`,
            { empId: req.user.employeeId }
        );
        const companyId = empRow.length > 0 ? empRow[0].CompanyMasterID : 1;

        // "upcoming" → today onward; "all" → optional ?year filter (defaults to
        // current year so the list never explodes across multiple years).
        let dateClause;
        const params = { companyId };
        if (scope === 'all') {
            const year = parseInt(req.query.year) || new Date().getFullYear();
            params.year = year;
            dateClause = 'AND YEAR(h.Date) = @year';
        } else {
            dateClause = 'AND CAST(h.Date AS DATE) >= CAST(GETDATE() AS DATE)';
        }

        const rows = await dbQuery(req.pool,
            `SELECT h.Oid AS id, h.Name AS name,
                    h.Date AS date, h.Type AS type, h.Remarks AS remarks
             FROM HR_HolidayMaster h
             WHERE h.Status = 1
               AND h.CompanyMasterID = @companyId
               ${dateClause}
             ORDER BY h.Date ASC`,
            params
        );

        const holidays = rows.map(r => ({
            id: r.id,
            name: (r.name || '').trim(),
            date: r.date,
            type: (r.type || '').trim(),
            remarks: (r.remarks || '').trim() || null,
        }));

        res.json({ success: true, scope, holidays });
    } catch (error) {
        console.error('Holidays error:', error);
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
