const sql = require('mssql');
require('dotenv').config();

// SQL Server connection config — SQL Server Authentication (sa login)
const configs = {
    solution_one: {
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        server: process.env.DB_HOST || 'localhost',
        port: parseInt(process.env.DB_PORT) || 1433,
        database: process.env.DB_NAME || 'Solution-one',
        options: {
            encrypt: false,
            trustServerCertificate: true
        },
        pool: {
            max: 10,
            min: 0,
            idleTimeoutMillis: 30000
        }
    }
    // Add more tenants here if needed:
    // cryogas: { ... database: 'CryoGas_DB', ... }
};

// Ordered list for login fallback
const TENANT_ORDER = ['solution_one'];

// Connected pools stored here
const pools = {};

/**
 * Initialize all connection pools at startup.
 */
async function initPools() {
    for (const tenant of TENANT_ORDER) {
        try {
            pools[tenant] = await new sql.ConnectionPool(configs[tenant]).connect();
            console.log(`Connected to ${tenant} (${configs[tenant].database})`);
        } catch (err) {
            console.error(`Failed to connect to ${tenant}:`, err.message);
            throw err;
        }
    }
}

/**
 * Get the connection pool for a specific tenant.
 */
function getPool(tenantDb) {
    const pool = pools[tenantDb];
    if (!pool) {
        throw new Error(`Unknown tenant database: ${tenantDb}`);
    }
    return pool;
}

/**
 * Helper: run a parameterized query and return recordset.
 */
async function dbQuery(pool, sqlText, params = {}) {
    const request = pool.request();
    for (const [key, val] of Object.entries(params)) {
        request.input(key, val);
    }
    const result = await request.query(sqlText);
    return result.recordset;
}

module.exports = { initPools, getPool, dbQuery, TENANT_ORDER, sql };
