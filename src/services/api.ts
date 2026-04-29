import axios from 'axios';

// API Configuration
// Public ngrok static domain pointing at the local backend on port 3000
const API_BASE_URL = 'https://cordie-fogged-radia.ngrok-free.dev/api';

// Globally skip ngrok's free-tier browser warning page for all requests.
axios.defaults.headers.common['ngrok-skip-browser-warning'] = 'true';

// Helper: build auth headers
const authHeaders = (token: string) => ({
  headers: { Authorization: `Bearer ${token}` },
});

// Helper: handle errors
const handleError = (error: any, fallback: string): never => {
  if (error.response) {
    throw new Error(error.response.data.error || fallback);
  }
  throw new Error('Network error. Please check your connection.');
};

export const api = {
  // Login (no token needed — backend routes across DBs)
  login: async (email: string, password: string) => {
    try {
      const response = await axios.post(`${API_BASE_URL}/login`, { email, password });
      return response.data;
    } catch (error: any) {
      handleError(error, 'Login failed');
    }
  },

  // Get units assigned to logged-in user
  getUserUnits: async (token: string) => {
    try {
      const response = await axios.get(`${API_BASE_URL}/user/units`, authHeaders(token));
      return response.data;
    } catch (error: any) {
      handleError(error, 'Failed to fetch units');
    }
  },

  // Record a punch
  punch: async (token: string, unit_id: number, latitude: number, longitude: number) => {
    try {
      const response = await axios.post(
        `${API_BASE_URL}/attendance/punch`,
        { unit_id, latitude, longitude },
        authHeaders(token),
      );
      return response.data;
    } catch (error: any) {
      handleError(error, 'Punch failed');
    }
  },

  // Get today's attendance status
  getAttendanceStatus: async (token: string) => {
    try {
      const response = await axios.get(`${API_BASE_URL}/attendance/status`, authHeaders(token));
      return response.data;
    } catch (error: any) {
      handleError(error, 'Failed to get status');
    }
  },

  // Get attendance history
  getAttendanceHistory: async (token: string, days?: number) => {
    try {
      const url = days
        ? `${API_BASE_URL}/attendance/history?days=${days}`
        : `${API_BASE_URL}/attendance/history`;
      const response = await axios.get(url, authHeaders(token));
      return response.data;
    } catch (error: any) {
      handleError(error, 'Failed to get attendance history');
    }
  },

  // Admin: get employees (optional unit_id filter)
  getEmployees: async (token: string, unitId?: number) => {
    try {
      const url = unitId
        ? `${API_BASE_URL}/admin/employees?unit_id=${unitId}`
        : `${API_BASE_URL}/admin/employees`;
      const response = await axios.get(url, authHeaders(token));
      return response.data;
    } catch (error: any) {
      handleError(error, 'Failed to get employees');
    }
  },

  // Admin: batch update employee access (grant/revoke)
  updateEmployeeAccess: async (token: string, userIds: number[], isActive: boolean) => {
    try {
      const response = await axios.put(
        `${API_BASE_URL}/admin/employees/access`,
        { user_ids: userIds, is_active: isActive },
        authHeaders(token),
      );
      return response.data;
    } catch (error: any) {
      handleError(error, 'Failed to update access');
    }
  },

  // Admin: get attendance for a date
  getAdminAttendance: async (token: string, date: string) => {
    try {
      const response = await axios.get(
        `${API_BASE_URL}/admin/attendance?date=${date}`,
        authHeaders(token),
      );
      return response.data;
    } catch (error: any) {
      handleError(error, 'Failed to get attendance data');
    }
  },

  // Admin: get all units in this tenant DB
  getAdminUnits: async (token: string) => {
    try {
      const response = await axios.get(`${API_BASE_URL}/admin/units`, authHeaders(token));
      return response.data;
    } catch (error: any) {
      handleError(error, 'Failed to fetch units');
    }
  },

  // Admin: re-verify password before sensitive actions
  reverifyPassword: async (token: string, password: string) => {
    try {
      const response = await axios.post(
        `${API_BASE_URL}/auth/reverify`,
        { password },
        authHeaders(token),
      );
      return response.data;
    } catch (error: any) {
      handleError(error, 'Password verification failed');
    }
  },

  // Admin: create a new unit
  createUnit: async (token: string, data: { name: string; latitude: number; longitude: number; is_geofenced: boolean }) => {
    try {
      const response = await axios.post(`${API_BASE_URL}/units`, data, authHeaders(token));
      return response.data;
    } catch (error: any) {
      handleError(error, 'Failed to create unit');
    }
  },

  // Admin: get branch permissions for an employee
  getBranchPermissions: async (token: string, employeeId: number) => {
    try {
      const response = await axios.get(
        `${API_BASE_URL}/admin/employees/${employeeId}/branch-permissions`,
        authHeaders(token),
      );
      return response.data;
    } catch (error: any) {
      handleError(error, 'Failed to get branch permissions');
    }
  },

  // Admin: save branch permissions for an employee
  saveBranchPermissions: async (
    token: string,
    employeeId: number,
    mainUnitId: number,
    allowedUnits: { unit_id: number; is_active: boolean }[],
  ) => {
    try {
      const response = await axios.post(
        `${API_BASE_URL}/admin/employees/${employeeId}/branch-permissions`,
        { main_unit_id: mainUnitId, allowed_units: allowedUnits },
        authHeaders(token),
      );
      return response.data;
    } catch (error: any) {
      handleError(error, 'Failed to save branch permissions');
    }
  },

  // Admin: update an existing unit
  updateUnit: async (token: string, unitId: number, data: { name: string; latitude: number; longitude: number; is_geofenced: boolean }) => {
    try {
      const response = await axios.put(`${API_BASE_URL}/units/${unitId}`, data, authHeaders(token));
      return response.data;
    } catch (error: any) {
      handleError(error, 'Failed to update unit');
    }
  },
};
