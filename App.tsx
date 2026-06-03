import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { RootStackParamList } from './src/types';
import { LoginScreen } from './src/screens/LoginScreen';
import { EmployeeHomeScreen } from './src/screens/EmployeeHomeScreen';
import { AdminDashboardScreen } from './src/screens/AdminDashboardScreen';
import { EmployeeDetailScreen } from './src/screens/EmployeeDetailScreen';
import { AttendanceHistoryScreen } from './src/screens/AttendanceHistoryScreen';
import { ManageUnitsScreen } from './src/screens/ManageUnitsScreen';
import { UnitFormScreen } from './src/screens/UnitFormScreen';
import { BranchPermissionsScreen } from './src/screens/BranchPermissionsScreen';

// Phase 2 — HR self-service & approvals
import { LeaveRequestScreen } from './src/screens/LeaveRequestScreen';
import { LeaveApprovalScreen } from './src/screens/LeaveApprovalScreen';
import { AdjustmentRequestScreen } from './src/screens/AdjustmentRequestScreen';
import { AdjustmentApprovalScreen } from './src/screens/AdjustmentApprovalScreen';
import { SalarySlipListScreen } from './src/screens/SalarySlipListScreen';
import { SalarySlipDetailScreen } from './src/screens/SalarySlipDetailScreen';
import { ReportsScreen } from './src/screens/ReportsScreen';

const Stack = createNativeStackNavigator<RootStackParamList>();

export default function App() {
  return (
    <NavigationContainer>
      <Stack.Navigator
        initialRouteName="Login"
        screenOptions={{
          headerShown: false,
          animation: 'slide_from_right',
        }}
      >
        <Stack.Screen name="Login" component={LoginScreen} />
        <Stack.Screen name="EmployeeHome" component={EmployeeHomeScreen} />
        <Stack.Screen name="AdminDashboard" component={AdminDashboardScreen} />
        <Stack.Screen name="EmployeeDetail" component={EmployeeDetailScreen} />
        <Stack.Screen name="AttendanceHistory" component={AttendanceHistoryScreen} />
        <Stack.Screen name="ManageUnits" component={ManageUnitsScreen} />
        <Stack.Screen name="UnitForm" component={UnitFormScreen} />
        <Stack.Screen name="BranchPermissions" component={BranchPermissionsScreen} />

        {/* Phase 2 routes */}
        <Stack.Screen name="LeaveRequest" component={LeaveRequestScreen} />
        <Stack.Screen name="LeaveApproval" component={LeaveApprovalScreen} />
        <Stack.Screen name="AdjustmentRequest" component={AdjustmentRequestScreen} />
        <Stack.Screen name="AdjustmentApproval" component={AdjustmentApprovalScreen} />
        <Stack.Screen name="SalarySlipList" component={SalarySlipListScreen} />
        <Stack.Screen name="SalarySlipDetail" component={SalarySlipDetailScreen} />
        <Stack.Screen name="Reports" component={ReportsScreen} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
