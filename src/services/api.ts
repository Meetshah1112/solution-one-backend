import axios from 'axios';

// API Configuration
// Cloudflare Tunnel -> company server backend (localhost:3000). HTTPS, bypasses NAT.
// NOTE: this quick-tunnel URL changes if cloudflared restarts — rebuild the APK if so.
const API_BASE_URL = 'https://submitting-valued-graham-resolved.trycloudflare.com/api';

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

  // Record a punch (photo is base64 string, optional but recommended)
  punch: async (
    token: string,
    unit_id: number,
    latitude: number,
    longitude: number,
    photoBase64?: string,
  ) => {
    try {
      const response = await axios.post(
        `${API_BASE_URL}/attendance/punch`,
        { unit_id, latitude, longitude, photo: photoBase64 },
        {
          ...authHeaders(token),
          // Photos can be 100KB+; allow up to 25MB body
          maxContentLength: 25 * 1024 * 1024,
          maxBodyLength: 25 * 1024 * 1024,
        },
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

  // Admin: detailed punches with photos for one employee on a specific date
  getEmployeePunches: async (token: string, employeeUserId: number, date: string) => {
    try {
      const response = await axios.get(
        `${API_BASE_URL}/admin/employee/${employeeUserId}/punches?date=${date}`,
        {
          ...authHeaders(token),
          // photos can push response above default 10MB
          maxContentLength: 50 * 1024 * 1024,
        },
      );
      return response.data;
    } catch (error: any) {
      handleError(error, 'Failed to load employee punch detail');
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

  // ────────────────────────────────────────────────────────────────────────
  // Leave management
  // ────────────────────────────────────────────────────────────────────────
  getLeaveTypes: async (token: string) => {
    try {
      const response = await axios.get(`${API_BASE_URL}/leave/types`, authHeaders(token));
      return response.data;
    } catch (error: any) {
      handleError(error, 'Failed to load leave types');
    }
  },

  getLeaveBalance: async (token: string) => {
    try {
      const response = await axios.get(`${API_BASE_URL}/leave/balance`, authHeaders(token));
      return response.data;
    } catch (error: any) {
      handleError(error, 'Failed to load leave balance');
    }
  },

  applyLeave: async (
    token: string,
    data: {
      leave_master_id: number;
      from_date: string;
      to_date: string;
      day_type: 'FullDay' | 'HalfDay' | 'QuarterDay';
      half_day?: string | null;
      reason?: string | null;
    },
  ) => {
    try {
      const response = await axios.post(`${API_BASE_URL}/leave/apply`, data, authHeaders(token));
      return response.data;
    } catch (error: any) {
      handleError(error, 'Failed to apply for leave');
    }
  },

  getMyLeaves: async (token: string) => {
    try {
      const response = await axios.get(`${API_BASE_URL}/leave/my`, authHeaders(token));
      return response.data;
    } catch (error: any) {
      handleError(error, 'Failed to load my leaves');
    }
  },

  cancelLeave: async (token: string, leaveId: number) => {
    try {
      const response = await axios.delete(`${API_BASE_URL}/leave/${leaveId}`, authHeaders(token));
      return response.data;
    } catch (error: any) {
      handleError(error, 'Failed to cancel leave');
    }
  },

  // Admin
  getPendingLeaves: async (token: string, status: string = 'Pending') => {
    try {
      const response = await axios.get(
        `${API_BASE_URL}/admin/leave/pending?status=${status}`,
        authHeaders(token),
      );
      return response.data;
    } catch (error: any) {
      handleError(error, 'Failed to load pending leaves');
    }
  },

  decideLeave: async (
    token: string,
    leaveId: number,
    decision: 'Approved' | 'Rejected',
    comment?: string,
  ) => {
    try {
      const response = await axios.post(
        `${API_BASE_URL}/admin/leave/${leaveId}/decide`,
        { decision, comment },
        authHeaders(token),
      );
      return response.data;
    } catch (error: any) {
      handleError(error, 'Failed to update leave decision');
    }
  },

  // ────────────────────────────────────────────────────────────────────────
  // Multi-level leave approval (senior → HR chain)
  // ────────────────────────────────────────────────────────────────────────
  // Pending requests where the logged-in user is the active-level approver.
  getTeamApprovals: async (token: string) => {
    try {
      const response = await axios.get(`${API_BASE_URL}/leave/approvals`, authHeaders(token));
      return response.data;
    } catch (error: any) {
      handleError(error, 'Failed to load team approvals');
    }
  },

  decideTeamApproval: async (
    token: string,
    authId: number,
    decision: 'Approved' | 'Rejected',
    comment?: string,
  ) => {
    try {
      const response = await axios.post(
        `${API_BASE_URL}/leave/approvals/${authId}/decide`,
        { decision, comment },
        authHeaders(token),
      );
      return response.data;
    } catch (error: any) {
      handleError(error, 'Failed to submit decision');
    }
  },

  // ────────────────────────────────────────────────────────────────────────
  // Attendance adjustment
  // ────────────────────────────────────────────────────────────────────────
  applyAdjustment: async (
    token: string,
    data: {
      type: 'MissedPunch' | 'WrongPunch' | 'OnDuty' | 'WFH';
      attendence_date: string;
      in_time?: string | null;
      out_time?: string | null;
      reason: string;
    },
  ) => {
    try {
      const response = await axios.post(`${API_BASE_URL}/adjustment/apply`, data, authHeaders(token));
      return response.data;
    } catch (error: any) {
      handleError(error, 'Failed to submit adjustment');
    }
  },

  getMyAdjustments: async (token: string) => {
    try {
      const response = await axios.get(`${API_BASE_URL}/adjustment/my`, authHeaders(token));
      return response.data;
    } catch (error: any) {
      handleError(error, 'Failed to load adjustments');
    }
  },

  getPendingAdjustments: async (token: string, status: string = 'Pending') => {
    try {
      const response = await axios.get(
        `${API_BASE_URL}/admin/adjustment/pending?status=${status}`,
        authHeaders(token),
      );
      return response.data;
    } catch (error: any) {
      handleError(error, 'Failed to load pending adjustments');
    }
  },

  decideAdjustment: async (
    token: string,
    adjustmentId: number,
    decision: 'Approved' | 'Rejected',
    comment?: string,
  ) => {
    try {
      const response = await axios.post(
        `${API_BASE_URL}/admin/adjustment/${adjustmentId}/decide`,
        { decision, comment },
        authHeaders(token),
      );
      return response.data;
    } catch (error: any) {
      handleError(error, 'Failed to update adjustment decision');
    }
  },

  // ────────────────────────────────────────────────────────────────────────
  // Salary slip
  // ────────────────────────────────────────────────────────────────────────
  getSalaryMonths: async (token: string) => {
    try {
      const response = await axios.get(`${API_BASE_URL}/salary/months`, authHeaders(token));
      return response.data;
    } catch (error: any) {
      handleError(error, 'Failed to load salary months');
    }
  },

  getSalarySlip: async (token: string, slipId: number) => {
    try {
      const response = await axios.get(`${API_BASE_URL}/salary/slip/${slipId}`, authHeaders(token));
      return response.data;
    } catch (error: any) {
      handleError(error, 'Failed to load salary slip');
    }
  },

  // Server-rendered printable HTML — the mobile app pipes this into
  // expo-print to produce a PDF identical in layout to the web portal slip.
  getSalarySlipHtml: async (token: string, slipId: number) => {
    try {
      const response = await axios.get(`${API_BASE_URL}/salary/slip/${slipId}/html`, authHeaders(token));
      return response.data;
    } catch (error: any) {
      handleError(error, 'Failed to load salary slip HTML');
    }
  },

  // ────────────────────────────────────────────────────────────────────────
  // Reports
  // ────────────────────────────────────────────────────────────────────────
  getReports: async (token: string, category?: string) => {
    try {
      const url = category
        ? `${API_BASE_URL}/admin/reports?category=${encodeURIComponent(category)}`
        : `${API_BASE_URL}/admin/reports`;
      const response = await axios.get(url, authHeaders(token));
      return response.data;
    } catch (error: any) {
      handleError(error, 'Failed to load reports');
    }
  },

  // ────────────────────────────────────────────────────────────────────────
  // Attendance report (employee self-service)
  // ────────────────────────────────────────────────────────────────────────
  getAttendanceReport: async (token: string, month: number, year: number) => {
    try {
      const response = await axios.get(
        `${API_BASE_URL}/attendance/report?month=${month}&year=${year}`,
        authHeaders(token),
      );
      return response.data;
    } catch (error: any) {
      handleError(error, 'Failed to load attendance report');
    }
  },

  getAttendanceReportHtml: async (token: string, month: number, year: number) => {
    try {
      const response = await axios.get(
        `${API_BASE_URL}/attendance/report/html?month=${month}&year=${year}`,
        authHeaders(token),
      );
      return response.data;
    } catch (error: any) {
      handleError(error, 'Failed to load attendance report');
    }
  },

  // ────────────────────────────────────────────────────────────────────────
  // Holidays
  // ────────────────────────────────────────────────────────────────────────
  getHolidays: async (token: string, scope: 'upcoming' | 'all' = 'upcoming', year?: number) => {
    try {
      const yearParam = year ? `&year=${year}` : '';
      const response = await axios.get(
        `${API_BASE_URL}/holidays?scope=${scope}${yearParam}`,
        authHeaders(token),
      );
      return response.data;
    } catch (error: any) {
      handleError(error, 'Failed to load holidays');
    }
  },
};
