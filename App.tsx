import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { RootStackParamList } from './src/types';
import { LoginScreen } from './src/screens/LoginScreen';
import { EmployeeHomeScreen } from './src/screens/EmployeeHomeScreen';
import { AdminDashboardScreen } from './src/screens/AdminDashboardScreen';
import { AttendanceHistoryScreen } from './src/screens/AttendanceHistoryScreen';
import { ManageUnitsScreen } from './src/screens/ManageUnitsScreen';
import { UnitFormScreen } from './src/screens/UnitFormScreen';
import { BranchPermissionsScreen } from './src/screens/BranchPermissionsScreen';

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
        <Stack.Screen name="AttendanceHistory" component={AttendanceHistoryScreen} />
        <Stack.Screen name="ManageUnits" component={ManageUnitsScreen} />
        <Stack.Screen name="UnitForm" component={UnitFormScreen} />
        <Stack.Screen name="BranchPermissions" component={BranchPermissionsScreen} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
