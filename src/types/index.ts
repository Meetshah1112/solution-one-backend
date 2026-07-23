export type UserRole = 'EMPLOYEE' | 'ADMIN' | 'SUPER_ADMIN';

export interface User {
  id: number;
  name: string;
  email: string;
  role: UserRole;
  tenantDb: string;
}

export interface Unit {
  id: number;
  name: string;
  latitude: number | null;
  longitude: number | null;
  is_geofenced: boolean | number;
}

export interface Punch {
  index: number;
  time: string;
  location: string | null;
  photo?: string | null;
}

export interface AttendanceRecord {
  id: number;
  attend_date: string;
  punchCount: number;
  punches: Punch[];
}

// ────────────────────────────────────────────────────────────────────────────
// Leave management
// ────────────────────────────────────────────────────────────────────────────
export interface LeaveType {
  id: number;
  code: string;
  name: string;
  default_balance: number;
  description: string | null;
  is_paid: boolean | number;
  half_day_allowed: boolean | number;
}

export interface LeaveBalance {
  id: number;
  code: string;        // internal code, e.g. "LV00000015"
  name: string;        // short abbreviation, e.g. "CL"
  description: string; // human-readable label, e.g. "Casual Leave"
  total: number;
  consumed: number;
  remaining: number;
}

export type LeaveDayType = 'FullDay' | 'HalfDay' | 'QuarterDay';
export type LeaveStatus = 'Pending' | 'Approved' | 'Rejected' | 'Cancelled';

export interface LeaveRequest {
  id: number;
  applied_on: string;
  from_date: string;
  to_date: string;
  days: number;
  day_type: LeaveDayType;
  half_day: string | null;
  reason: string | null;
  status: LeaveStatus;
  approved_date: string | null;
  approver_comment: string | null;
  /** Name of the senior whose approval the request is currently awaiting. */
  pending_with?: string | null;
  leave_code: string;
  leave_name: string;
  // Admin-side extras
  employee_id?: number;
  employee_name?: string;
}

/** A pending item in the logged-in senior's approval queue. */
export interface TeamApproval {
  auth_id: number;
  level: number;
  id: number;
  applied_on: string;
  from_date: string;
  to_date: string;
  days: number;
  day_type: LeaveDayType;
  reason: string | null;
  employee_id: number;
  employee_name: string;
  leave_code: string;
  leave_name: string;
}

// ────────────────────────────────────────────────────────────────────────────
// Attendance adjustment
// ────────────────────────────────────────────────────────────────────────────
export type AdjustmentType = 'MissedPunch' | 'WrongPunch' | 'OnDuty' | 'WFH';
export type AdjustmentStatus = 'Pending' | 'Approved' | 'Rejected';

export interface AdjustmentRequest {
  id: number;
  doc_no: string;
  doc_date: string;
  type: AdjustmentType;
  attendence_date: string;
  in_time: string | null;
  out_time: string | null;
  reason: string;
  status: AdjustmentStatus;
  approved_date: string | null;
  manager_comment: string | null;
  // Admin-side extras
  employee_id?: number;
  employee_name?: string;
}

// ────────────────────────────────────────────────────────────────────────────
// Salary slip
// ────────────────────────────────────────────────────────────────────────────
export interface SalaryMonth {
  id: number;
  year: number;
  month: number;
  net_pay: number;
  master_net_pay: number;
}

export interface SalarySlipHeader {
  id: number;
  employee_id: number;
  employee_name: string;
  employee_code: string;
  month: number;
  year: number;
  month_days: number;
  working_days: number;
  pay_days: number;
  basic: number;
  gross: number;
  ctc: number;
  ot_amount: number;
  net_pay: number;
  master_net_pay: number;
}

export interface SalarySlipLineItem {
  sr_no: number;
  head_name: string;
  add_deduct: 'Add' | 'Deduct';
  amount: number;
  remarks: string | null;
}

// ────────────────────────────────────────────────────────────────────────────
// Reports
// ────────────────────────────────────────────────────────────────────────────
export interface ReportItem {
  id: number;
  name: string;
  description: string | null;
  category: string | null;
  created_on: string;
}

// ────────────────────────────────────────────────────────────────────────────
// Attendance report (employee self-service)
// ────────────────────────────────────────────────────────────────────────────
export interface AttendanceReportRow {
  date: string;
  punch_in: string | null;
  punch_out: string | null;
  punch_count: number;
  worked_minutes: number;
  status: 'Present' | 'Absent';
}

export interface AttendanceReportSummary {
  present_days: number;
  total_minutes: number;
}

// ────────────────────────────────────────────────────────────────────────────
// Holidays
// ────────────────────────────────────────────────────────────────────────────
export interface Holiday {
  id: number;
  name: string;
  date: string;
  type: string;
  remarks: string | null;
}

// ────────────────────────────────────────────────────────────────────────────
// Navigation
// ────────────────────────────────────────────────────────────────────────────
export type RootStackParamList = {
  Login: undefined;
  EmployeeHome: { user: User; token: string };
  AdminDashboard: { user: User; token: string };
  EmployeeDetail: {
    user: User;
    token: string;
    employeeId: number;
    employeeName: string;
    employeeEmail: string;
    isActive: boolean;
    date: string;
  };
  AttendanceHistory: { user: User; token: string };
  ManageUnits: { user: User; token: string };
  UnitForm: { user: User; token: string; unit?: Unit };
  BranchPermissions: { user: User; token: string; employeeId: number; employeeName: string };

  // New routes — Phase 2 features
  LeaveRequest: { user: User; token: string };
  LeaveApproval: { user: User; token: string };
  AdjustmentRequest: { user: User; token: string };
  AdjustmentApproval: { user: User; token: string };
  SalarySlipList: { user: User; token: string };
  SalarySlipDetail: { user: User; token: string; slipId: number };
  Reports: { user: User; token: string };

  // Phase 3 — attendance report + holidays
  AttendanceReport: { user: User; token: string };
  HolidayList: { user: User; token: string };

  // Phase 4 — multi-level leave approval (senior → HR)
  TeamApprovals: { user: User; token: string };
};
