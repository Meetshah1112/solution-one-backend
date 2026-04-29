const jwt = require('jsonwebtoken');
const { getPool } = require('../db');

const JWT_SECRET = process.env.JWT_SECRET || 'fallback-secret-change-me';

/**
 * Auth middleware: verifies JWT and attaches req.user with:
 *   { userId, employeeId, role, tenantDb }
 * Also attaches req.pool — the correct SQL Server pool for this tenant.
 */
function authMiddleware(req, res, next) {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'Missing or invalid Authorization header' });
    }

    const token = authHeader.split(' ')[1];

    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        req.user = {
            userId: decoded.userId,         // HR_UserMaster.UserMasterID
            employeeId: decoded.employeeId, // HR_EmployeeMaster.EmployeeMasterID
            role: decoded.role,
            tenantDb: decoded.tenantDb
        };
        req.pool = getPool(decoded.tenantDb);
        next();
    } catch (err) {
        return res.status(401).json({ error: 'Invalid or expired token' });
    }
}

module.exports = { authMiddleware, JWT_SECRET };