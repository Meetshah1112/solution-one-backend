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

export type RootStackParamList = {
  Login: undefined;
  EmployeeHome: { user: User; token: string };
  AdminDashboard: { user: User; token: string };
  EmployeeDetail: {
    user: User;             // logged-in admin
    token: string;
    employeeId: number;     // UserMasterID
    employeeName: string;
    employeeEmail: string;
    isActive: boolean;
    date: string;           // YYYY-MM-DD
  };
  AttendanceHistory: { user: User; token: string };
  ManageUnits: { user: User; token: string };
  UnitForm: { user: User; token: string; unit?: Unit };
  BranchPermissions: { user: User; token: string; employeeId: number; employeeName: string };
};
