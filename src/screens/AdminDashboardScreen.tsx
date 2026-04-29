import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  StatusBar,
  ScrollView,
  ActivityIndicator,
  Alert,
  RefreshControl,
  Modal,
  Linking,
} from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RouteProp } from '@react-navigation/native';
import { RootStackParamList, Unit } from '../types';
import { api } from '../services/api';

type AdminDashboardProps = {
  navigation: NativeStackNavigationProp<RootStackParamList, 'AdminDashboard'>;
  route: RouteProp<RootStackParamList, 'AdminDashboard'>;
};

interface PunchDetail {
  index: number;
  time: string;
  location: string | null;
}

interface EmployeeWithAttendance {
  id: number;
  name: string;
  email: string;
  is_active: number | boolean;
  hasPunches: boolean;
  punchCount: number;
  punches: PunchDetail[];
}

export const AdminDashboardScreen: React.FC<AdminDashboardProps> = ({
  navigation,
  route,
}) => {
  const { user, token } = route.params;
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [employees, setEmployees] = useState<EmployeeWithAttendance[]>([]);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);

  // Branch filter
  const [units, setUnits] = useState<Unit[]>([]);
  const [selectedUnitId, setSelectedUnitId] = useState<number | null>(null);
  const [showUnitFilter, setShowUnitFilter] = useState(false);

  // Expandable punch details
  const [expandedEmployee, setExpandedEmployee] = useState<number | null>(null);

  // Multi-select mode
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [selectedUserIds, setSelectedUserIds] = useState<number[]>([]);
  const [accessUpdating, setAccessUpdating] = useState(false);

  const isSuperAdmin = user.role === 'SUPER_ADMIN';

  const formatTime = (dateTime: string) => {
    const date = new Date(dateTime);
    return date.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    });
  };

  const openMap = (locationString: string) => {
    Linking.openURL(
      'https://www.google.com/maps/search/?api=1&query=' + locationString
    );
  };

  useEffect(() => {
    loadUnits();
  }, []);

  useEffect(() => {
    loadEmployeeData();
  }, [selectedDate]);

  const loadUnits = async () => {
    try {
      const response = await api.getAdminUnits(token);
      if (response.success) {
        setUnits(response.units);
      }
    } catch (error: any) {
      console.log('Failed to load units for filter');
    }
  };

  const formatDate = (date: Date) => {
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const formatDateForAPI = (date: Date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const loadEmployeeData = async () => {
    try {
      setLoading(true);
      const dateStr = formatDateForAPI(selectedDate);
      const response = await api.getAdminAttendance(token, dateStr);

      if (response.success) {
        setEmployees(response.employees);
      }
    } catch (error: any) {
      Alert.alert('Error', 'Failed to load employee data: ' + error.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    loadEmployeeData();
  };

  const handleLogout = () => {
    Alert.alert('Logout', 'Are you sure you want to logout?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Logout', onPress: () => navigation.navigate('Login') },
    ]);
  };

  const isToday = () => {
    const today = new Date();
    return selectedDate.toDateString() === today.toDateString();
  };

  // --- Calendar helpers ---
  const [calendarDate, setCalendarDate] = useState(new Date(selectedDate));
  const calendarMonth = calendarDate.getMonth();
  const calendarYear = calendarDate.getFullYear();

  const calendarDays = useMemo(() => {
    const firstDay = new Date(calendarYear, calendarMonth, 1).getDay();
    const daysInMonth = new Date(calendarYear, calendarMonth + 1, 0).getDate();
    const days: (number | null)[] = [];
    for (let i = 0; i < firstDay; i++) days.push(null);
    for (let i = 1; i <= daysInMonth; i++) days.push(i);
    return days;
  }, [calendarMonth, calendarYear]);

  const monthNames = [
    'January','February','March','April','May','June',
    'July','August','September','October','November','December',
  ];
  const dayHeaders = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];

  const navigateCalendarMonth = (direction: number) => {
    setCalendarDate(new Date(calendarYear, calendarMonth + direction, 1));
  };

  const selectCalendarDay = (day: number) => {
    const newDate = new Date(calendarYear, calendarMonth, day);
    if (newDate > new Date()) return;
    setSelectedDate(newDate);
    setShowDatePicker(false);
  };

  const openDatePicker = () => {
    setCalendarDate(new Date(selectedDate));
    setShowDatePicker(true);
  };

  // --- Branch filter logic ---
  const filteredEmployees = useMemo(() => {
    // Client-side filter isn't needed since backend filters,
    // but we keep it for immediate UI response when switching branches.
    // The real filter happens on next data reload.
    return employees;
  }, [employees]);

  const getAttendanceStats = () => {
    const present = filteredEmployees.filter((e) => e.hasPunches).length;
    const absent = filteredEmployees.filter((e) => !e.hasPunches).length;
    return { present, absent, total: filteredEmployees.length };
  };

  const stats = getAttendanceStats();

  const selectedUnitName = selectedUnitId
    ? units.find(u => u.id === selectedUnitId)?.name || 'Unknown'
    : 'All Branches';

  const handleUnitFilterSelect = (unitId: number | null) => {
    setSelectedUnitId(unitId);
    setShowUnitFilter(false);
    // Exit selection mode when filter changes
    exitSelectionMode();
  };

  // --- Multi-select logic ---
  const handleLongPress = (employeeId: number) => {
    if (!isSelectionMode) {
      setIsSelectionMode(true);
      setSelectedUserIds([employeeId]);
    }
  };

  const handlePress = (employee: EmployeeWithAttendance) => {
    if (isSelectionMode) {
      toggleSelection(employee.id);
    } else {
      // Open the dedicated employee detail screen for the selected date
      navigation.navigate('EmployeeDetail', {
        user,
        token,
        employeeId: employee.id,
        employeeName: employee.name,
        employeeEmail: employee.email,
        isActive: !!employee.is_active,
        date: formatDateForAPI(selectedDate),
      });
    }
  };

  const toggleSelection = (employeeId: number) => {
    setSelectedUserIds(prev =>
      prev.includes(employeeId)
        ? prev.filter(id => id !== employeeId)
        : [...prev, employeeId]
    );
  };

  const selectAll = () => {
    setSelectedUserIds(filteredEmployees.map(e => e.id));
  };

  const exitSelectionMode = () => {
    setIsSelectionMode(false);
    setSelectedUserIds([]);
  };

  const handleAccessUpdate = async (grantAccess: boolean) => {
    if (selectedUserIds.length === 0) return;

    const action = grantAccess ? 'grant access to' : 'revoke access from';
    Alert.alert(
      'Confirm',
      `Are you sure you want to ${action} ${selectedUserIds.length} employee(s)?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: grantAccess ? 'Grant' : 'Revoke',
          style: grantAccess ? 'default' : 'destructive',
          onPress: async () => {
            try {
              setAccessUpdating(true);
              const response = await api.updateEmployeeAccess(token, selectedUserIds, grantAccess);
              if (response.success) {
                Alert.alert('Success', response.message);
                exitSelectionMode();
                loadEmployeeData();
              }
            } catch (error: any) {
              Alert.alert('Error', error.message);
            } finally {
              setAccessUpdating(false);
            }
          },
        },
      ]
    );
  };

  if (loading && !refreshing) {
    return (
      <View style={[styles.container, styles.centerContent]}>
        <StatusBar barStyle="light-content" backgroundColor="#1E68B8" />
        <ActivityIndicator size="large" color="#1E68B8" />
        <Text style={styles.loadingText}>Loading employees...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#1E68B8" />

      {/* Selection Mode Action Bar */}
      {isSelectionMode ? (
        <View style={styles.selectionBar}>
          <TouchableOpacity onPress={exitSelectionMode} style={styles.selectionCancelBtn}>
            <Text style={styles.selectionCancelText}>{'X'}</Text>
          </TouchableOpacity>
          <Text style={styles.selectionCount}>
            {selectedUserIds.length} selected
          </Text>
          <TouchableOpacity onPress={selectAll} style={styles.selectAllBtn}>
            <Text style={styles.selectAllText}>Select All</Text>
          </TouchableOpacity>
        </View>
      ) : (
        /* Normal Header */
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <View style={styles.userIcon}>
              <Text style={styles.userIconText}>👤</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.headerTitle}>
                {isSuperAdmin ? 'Super Admin' : 'Admin Dashboard'}
              </Text>
              <Text style={styles.headerSubtitle}>{user.name}</Text>
              <Text style={styles.headerTenant}>
                {user.tenantDb === 'solution_one' ? 'Solution One' : 'CryoGas'}
              </Text>
            </View>
          </View>
          <TouchableOpacity onPress={handleLogout} style={styles.logoutButton}>
            <Text style={styles.logoutText}>Logout</Text>
          </TouchableOpacity>
        </View>
      )}

      <ScrollView
        style={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {/* Selection Action Buttons */}
        {isSelectionMode && (
          <View style={styles.selectionActions}>
            <TouchableOpacity
              style={[styles.actionBtn, styles.grantBtn]}
              onPress={() => handleAccessUpdate(true)}
              disabled={accessUpdating || selectedUserIds.length === 0}
            >
              {accessUpdating ? (
                <ActivityIndicator color="#FFF" size="small" />
              ) : (
                <Text style={styles.actionBtnText}>Grant Access</Text>
              )}
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.actionBtn, styles.revokeBtn]}
              onPress={() => handleAccessUpdate(false)}
              disabled={accessUpdating || selectedUserIds.length === 0}
            >
              {accessUpdating ? (
                <ActivityIndicator color="#FFF" size="small" />
              ) : (
                <Text style={styles.actionBtnText}>Revoke Access</Text>
              )}
            </TouchableOpacity>
          </View>
        )}

        {!isSelectionMode && (
          <>
            {/* Date Selector */}
            <TouchableOpacity style={styles.dateCard} onPress={openDatePicker}>
              <Text style={styles.calendarIconText}>📅</Text>
              <View style={styles.dateInfo}>
                <Text style={styles.dateText}>{formatDate(selectedDate)}</Text>
                {isToday() ? (
                  <Text style={styles.todayBadge}>Today</Text>
                ) : (
                  <Text style={styles.todayLink}>Tap to change date</Text>
                )}
              </View>
              {!isToday() && (
                <TouchableOpacity
                  style={styles.todayButton}
                  onPress={() => setSelectedDate(new Date())}
                >
                  <Text style={styles.todayButtonText}>Today</Text>
                </TouchableOpacity>
              )}
            </TouchableOpacity>

            {/* Branch Filter */}
            <TouchableOpacity
              style={styles.filterCard}
              onPress={() => setShowUnitFilter(true)}
            >
              <Text style={styles.filterIcon}>🏢</Text>
              <View style={{ flex: 1 }}>
                <Text style={styles.filterLabel}>Filter by Branch</Text>
                <Text style={styles.filterValue}>{selectedUnitName}</Text>
              </View>
              <Text style={styles.filterArrow}>▼</Text>
            </TouchableOpacity>

            {/* Stats */}
            <View style={styles.statsContainer}>
              <View style={[styles.statCard, { borderColor: '#2196F3' }]}>
                <Text style={styles.statNumber}>{stats.total}</Text>
                <Text style={styles.statLabel}>Total</Text>
              </View>
              <View style={[styles.statCard, { borderColor: '#4CAF50' }]}>
                <Text style={styles.statNumber}>{stats.present}</Text>
                <Text style={styles.statLabel}>Present</Text>
              </View>
              <View style={[styles.statCard, { borderColor: '#D32F2F' }]}>
                <Text style={styles.statNumber}>{stats.absent}</Text>
                <Text style={styles.statLabel}>Absent</Text>
              </View>
            </View>

            {/* Manage Units Button */}
            <TouchableOpacity
              style={styles.manageUnitsButton}
              onPress={() => navigation.navigate('ManageUnits', { user, token })}
            >
              <Text style={styles.manageUnitsIcon}>&#9881;</Text>
              <Text style={styles.manageUnitsText}>Manage Units</Text>
              <Text style={styles.manageUnitsArrow}>&#8250;</Text>
            </TouchableOpacity>
          </>
        )}

        {/* Employee List */}
        <View style={styles.attendanceSection}>
          {!isSelectionMode && (
            <Text style={styles.sectionTitle}>
              Employees {isSelectionMode ? '' : '(tap for detail · long-press to select)'}
            </Text>
          )}

          {filteredEmployees.length === 0 ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyText}>No employees found</Text>
            </View>
          ) : (
            filteredEmployees.map((employee) => {
              const isExpanded = expandedEmployee === employee.id;
              const isSelected = selectedUserIds.includes(employee.id);
              const isActive = !!employee.is_active;

              return (
                <TouchableOpacity
                  key={employee.id}
                  style={[
                    styles.employeeCard,
                    isSelected && styles.employeeCardSelected,
                    !isActive && styles.employeeCardBlocked,
                  ]}
                  onPress={() => handlePress(employee)}
                  onLongPress={() => handleLongPress(employee.id)}
                  activeOpacity={0.7}
                  delayLongPress={400}
                >
                  {/* Selection checkbox */}
                  {isSelectionMode && (
                    <View style={[
                      styles.checkbox,
                      isSelected && styles.checkboxSelected,
                    ]}>
                      {isSelected && <Text style={styles.checkboxCheck}>✓</Text>}
                    </View>
                  )}

                  <View style={styles.employeeInfo}>
                    <View style={styles.employeeNameRow}>
                      <Text style={styles.employeeName}>{employee.name}</Text>
                      <View style={[
                        styles.statusBadge,
                        isActive ? styles.activeBadge : styles.blockedBadge,
                      ]}>
                        <Text style={[
                          styles.statusBadgeText,
                          { color: isActive ? '#2E7D32' : '#C62828' },
                        ]}>
                          {isActive ? 'Active' : 'Blocked'}
                        </Text>
                      </View>
                    </View>
                    <Text style={styles.employeeEmail}>{employee.email}</Text>
                  </View>

                  {!isSelectionMode && (
                    employee.hasPunches ? (
                      <View style={styles.presentBadge}>
                        <Text style={styles.badgeText}>
                          {employee.punchCount} punch{employee.punchCount !== 1 ? 'es' : ''} ›
                        </Text>
                      </View>
                    ) : (
                      <View style={styles.absentBadge}>
                        <Text style={styles.badgeText}>Absent ›</Text>
                      </View>
                    )
                  )}
                </TouchableOpacity>
              );
            })
          )}
        </View>
      </ScrollView>

      {/* Calendar Modal */}
      <Modal
        visible={showDatePicker}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowDatePicker(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.calendarModal}>
            <Text style={styles.modalTitle}>Select Date</Text>

            <View style={styles.calendarNav}>
              <TouchableOpacity onPress={() => navigateCalendarMonth(-1)}>
                <Text style={styles.calendarNavArrow}>◀</Text>
              </TouchableOpacity>
              <Text style={styles.calendarNavTitle}>
                {monthNames[calendarMonth]} {calendarYear}
              </Text>
              <TouchableOpacity onPress={() => navigateCalendarMonth(1)}>
                <Text style={styles.calendarNavArrow}>▶</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.calendarDayHeaders}>
              {dayHeaders.map((d) => (
                <Text key={d} style={styles.calendarDayHeader}>{d}</Text>
              ))}
            </View>

            <View style={styles.calendarGrid}>
              {calendarDays.map((day, index) => {
                if (day === null) {
                  return <View key={`empty-${index}`} style={styles.calendarDayEmpty} />;
                }
                const cellDate = new Date(calendarYear, calendarMonth, day);
                const isSelected = selectedDate.toDateString() === cellDate.toDateString();
                const isFuture = cellDate > new Date();
                const isTodayCell = new Date().toDateString() === cellDate.toDateString();

                return (
                  <TouchableOpacity
                    key={`day-${day}`}
                    style={[
                      styles.calendarDay,
                      isSelected && styles.calendarDaySelected,
                      isTodayCell && !isSelected && styles.calendarDayToday,
                      isFuture && styles.calendarDayDisabled,
                    ]}
                    onPress={() => selectCalendarDay(day)}
                    disabled={isFuture}
                  >
                    <Text
                      style={[
                        styles.calendarDayText,
                        isSelected && styles.calendarDayTextSelected,
                        isFuture && styles.calendarDayTextDisabled,
                        isTodayCell && !isSelected && styles.calendarDayTextToday,
                      ]}
                    >
                      {day}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <View style={styles.quickSelectRow}>
              <TouchableOpacity
                style={styles.quickSelectBtn}
                onPress={() => { setSelectedDate(new Date()); setShowDatePicker(false); }}
              >
                <Text style={styles.quickSelectText}>Today</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.quickSelectBtn}
                onPress={() => {
                  const d = new Date(); d.setDate(d.getDate() - 1);
                  setSelectedDate(d); setShowDatePicker(false);
                }}
              >
                <Text style={styles.quickSelectText}>Yesterday</Text>
              </TouchableOpacity>
            </View>

            <TouchableOpacity
              style={styles.calendarCloseBtn}
              onPress={() => setShowDatePicker(false)}
            >
              <Text style={styles.calendarCloseBtnText}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Unit Filter Modal */}
      <Modal
        visible={showUnitFilter}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowUnitFilter(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.calendarModal}>
            <Text style={styles.modalTitle}>Filter by Branch</Text>
            <ScrollView style={{ maxHeight: 400 }}>
              {/* All Branches option */}
              <TouchableOpacity
                style={[
                  styles.filterOption,
                  selectedUnitId === null && styles.filterOptionSelected,
                ]}
                onPress={() => handleUnitFilterSelect(null)}
              >
                <Text style={styles.filterOptionText}>All Branches</Text>
                {selectedUnitId === null && <Text style={styles.filterCheckmark}>✓</Text>}
              </TouchableOpacity>

              {units.filter(u => u.is_geofenced).map((unit) => (
                <TouchableOpacity
                  key={unit.id}
                  style={[
                    styles.filterOption,
                    selectedUnitId === unit.id && styles.filterOptionSelected,
                  ]}
                  onPress={() => handleUnitFilterSelect(unit.id)}
                >
                  <Text style={styles.filterOptionText}>{unit.name}</Text>
                  {selectedUnitId === unit.id && <Text style={styles.filterCheckmark}>✓</Text>}
                </TouchableOpacity>
              ))}
            </ScrollView>
            <TouchableOpacity
              style={styles.calendarCloseBtn}
              onPress={() => setShowUnitFilter(false)}
            >
              <Text style={styles.calendarCloseBtnText}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F5F5F5' },
  centerContent: { justifyContent: 'center', alignItems: 'center' },
  loadingText: { marginTop: 10, color: '#666', fontSize: 16 },

  // Normal header
  header: {
    backgroundColor: '#1E68B8', paddingTop: 50, paddingBottom: 20,
    paddingHorizontal: 20, flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerLeft: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  userIcon: {
    width: 40, height: 40, borderRadius: 20, backgroundColor: '#FFF',
    alignItems: 'center', justifyContent: 'center', marginRight: 12,
  },
  userIconText: { fontSize: 20 },
  headerTitle: { fontSize: 18, fontWeight: '600', color: '#FFF' },
  headerSubtitle: { fontSize: 12, color: '#E0E0E0', marginTop: 2 },
  headerTenant: { fontSize: 11, color: '#B3D9FF', marginTop: 2 },
  logoutButton: {
    backgroundColor: 'rgba(255,255,255,0.2)', paddingHorizontal: 12,
    paddingVertical: 6, borderRadius: 15,
  },
  logoutText: { color: '#FFF', fontSize: 12, fontWeight: '600' },

  // Selection mode header
  selectionBar: {
    backgroundColor: '#333',
    paddingTop: 50,
    paddingBottom: 15,
    paddingHorizontal: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  selectionCancelBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center', justifyContent: 'center',
  },
  selectionCancelText: { color: '#FFF', fontSize: 18, fontWeight: 'bold' },
  selectionCount: { color: '#FFF', fontSize: 16, fontWeight: '600' },
  selectAllBtn: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: 14, paddingVertical: 6, borderRadius: 15,
  },
  selectAllText: { color: '#FFF', fontSize: 12, fontWeight: '600' },

  // Selection action buttons
  selectionActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 15,
    marginTop: 10,
  },
  actionBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    marginHorizontal: 5,
  },
  grantBtn: { backgroundColor: '#4CAF50' },
  revokeBtn: { backgroundColor: '#D32F2F' },
  actionBtnText: { color: '#FFF', fontSize: 15, fontWeight: '700' },

  content: { flex: 1, paddingHorizontal: 20, paddingTop: 20 },

  // Date card
  dateCard: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFF',
    borderRadius: 12, padding: 15, marginBottom: 12,
    borderWidth: 2, borderColor: '#1E68B8',
  },
  calendarIconText: { fontSize: 24, marginRight: 12 },
  dateInfo: { flex: 1 },
  dateText: { fontSize: 16, fontWeight: '600', color: '#333' },
  todayBadge: { fontSize: 11, color: '#4CAF50', fontWeight: '600', marginTop: 2 },
  todayLink: { fontSize: 11, color: '#1E68B8', marginTop: 2 },
  todayButton: {
    backgroundColor: '#1E68B8', paddingHorizontal: 14,
    paddingVertical: 6, borderRadius: 15,
  },
  todayButtonText: { color: '#FFF', fontSize: 12, fontWeight: '600' },

  // Branch filter
  filterCard: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFF',
    borderRadius: 12, padding: 15, marginBottom: 20,
    borderWidth: 2, borderColor: '#FF9800',
  },
  filterIcon: { fontSize: 22, marginRight: 12 },
  filterLabel: { fontSize: 11, color: '#999', fontWeight: '500' },
  filterValue: { fontSize: 15, color: '#333', fontWeight: '600', marginTop: 2 },
  filterArrow: { fontSize: 12, color: '#FF9800' },

  // Filter modal options
  filterOption: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: '#F5F5F5', borderRadius: 10, padding: 15, marginBottom: 8,
  },
  filterOptionSelected: {
    backgroundColor: '#E3F2FD', borderWidth: 2, borderColor: '#1E68B8',
  },
  filterOptionText: { fontSize: 15, color: '#333', fontWeight: '500' },
  filterCheckmark: { fontSize: 18, color: '#1E68B8', fontWeight: 'bold' },

  // Modals
  modalOverlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center', alignItems: 'center',
  },
  calendarModal: {
    backgroundColor: '#FFF', borderRadius: 20, padding: 20,
    width: '90%', maxWidth: 380,
  },
  modalTitle: {
    fontSize: 20, fontWeight: 'bold', color: '#1E68B8',
    marginBottom: 15, textAlign: 'center',
  },
  calendarNav: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'center', marginBottom: 15, paddingHorizontal: 10,
  },
  calendarNavArrow: { fontSize: 18, color: '#1E68B8', padding: 8 },
  calendarNavTitle: { fontSize: 16, fontWeight: '600', color: '#333' },
  calendarDayHeaders: {
    flexDirection: 'row', justifyContent: 'space-around', marginBottom: 8,
  },
  calendarDayHeader: { width: 40, textAlign: 'center', fontSize: 12, fontWeight: '600', color: '#999' },
  calendarGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'flex-start' },
  calendarDayEmpty: { width: '14.28%', height: 40 },
  calendarDay: { width: '14.28%', height: 40, alignItems: 'center', justifyContent: 'center' },
  calendarDaySelected: { backgroundColor: '#1E68B8', borderRadius: 20 },
  calendarDayToday: { borderWidth: 2, borderColor: '#1E68B8', borderRadius: 20 },
  calendarDayDisabled: { opacity: 0.3 },
  calendarDayText: { fontSize: 14, color: '#333' },
  calendarDayTextSelected: { color: '#FFF', fontWeight: '600' },
  calendarDayTextDisabled: { color: '#CCC' },
  calendarDayTextToday: { color: '#1E68B8', fontWeight: '600' },
  quickSelectRow: {
    flexDirection: 'row', justifyContent: 'space-around',
    marginTop: 15, marginBottom: 10,
  },
  quickSelectBtn: {
    backgroundColor: '#E3F2FD', paddingHorizontal: 14,
    paddingVertical: 8, borderRadius: 15,
  },
  quickSelectText: { color: '#1E68B8', fontSize: 12, fontWeight: '600' },
  calendarCloseBtn: {
    backgroundColor: '#E0E0E0', borderRadius: 10, padding: 12,
    alignItems: 'center', marginTop: 5,
  },
  calendarCloseBtnText: { color: '#666', fontSize: 14, fontWeight: '600' },

  // Stats
  statsContainer: {
    flexDirection: 'row', justifyContent: 'space-between', marginBottom: 20,
  },
  statCard: {
    flex: 1, backgroundColor: '#FFF', borderRadius: 12,
    padding: 15, marginHorizontal: 4, alignItems: 'center', borderWidth: 2,
  },
  statNumber: { fontSize: 24, fontWeight: 'bold', color: '#333' },
  statLabel: { fontSize: 11, color: '#666', marginTop: 4 },

  // Manage Units
  manageUnitsButton: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFF',
    borderRadius: 12, padding: 16, marginBottom: 20,
    borderWidth: 2, borderColor: '#1E68B8', elevation: 2,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1, shadowRadius: 3,
  },
  manageUnitsIcon: { fontSize: 22, color: '#1E68B8', marginRight: 12 },
  manageUnitsText: { flex: 1, fontSize: 16, fontWeight: '700', color: '#1E68B8' },
  manageUnitsArrow: { fontSize: 22, color: '#1E68B8', fontWeight: '600' },

  // Employee list
  attendanceSection: { marginBottom: 30 },
  sectionTitle: { fontSize: 18, fontWeight: '600', color: '#1E68B8', marginBottom: 15 },
  emptyState: { backgroundColor: '#FFF', borderRadius: 12, padding: 40, alignItems: 'center' },
  emptyText: { color: '#666', fontSize: 16, textAlign: 'center' },

  // Employee card
  employeeCard: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFF',
    borderRadius: 12, padding: 15, marginBottom: 12,
    borderWidth: 1, borderColor: '#E0E0E0',
  },
  employeeCardSelected: {
    backgroundColor: '#E3F2FD',
    borderColor: '#1E68B8',
    borderWidth: 2,
  },
  employeeCardBlocked: {
    opacity: 0.7,
  },

  // Checkbox
  checkbox: {
    width: 24, height: 24, borderRadius: 6,
    borderWidth: 2, borderColor: '#999',
    marginRight: 12, alignItems: 'center', justifyContent: 'center',
  },
  checkboxSelected: {
    backgroundColor: '#1E68B8', borderColor: '#1E68B8',
  },
  checkboxCheck: { color: '#FFF', fontSize: 14, fontWeight: 'bold' },

  employeeInfo: { flex: 1 },
  employeeNameRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 4 },
  employeeName: { fontSize: 16, fontWeight: '600', color: '#1E68B8', marginRight: 8 },
  employeeEmail: { fontSize: 12, color: '#666' },

  // Active/Blocked status badge
  statusBadge: {
    paddingHorizontal: 8, paddingVertical: 2, borderRadius: 8,
  },
  activeBadge: { backgroundColor: '#E8F5E9' },
  blockedBadge: { backgroundColor: '#FFEBEE' },
  statusBadgeText: { fontSize: 10, fontWeight: '700' },

  // Attendance badges
  presentBadge: {
    backgroundColor: '#4CAF50', paddingHorizontal: 12,
    paddingVertical: 6, borderRadius: 12,
  },
  absentBadge: {
    backgroundColor: '#D32F2F', paddingHorizontal: 12,
    paddingVertical: 6, borderRadius: 12,
  },
  badgeText: { color: '#FFF', fontSize: 12, fontWeight: '600' },

  // Punch details
  punchDetailsCard: {
    backgroundColor: '#F8F9FA', borderRadius: 10,
    marginTop: -8, marginBottom: 12, marginHorizontal: 4,
    padding: 12, borderWidth: 1, borderColor: '#E0E0E0',
    borderTopWidth: 0, borderTopLeftRadius: 0, borderTopRightRadius: 0,
  },
  punchDetailRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: '#EEEEEE',
  },
  punchDetailIndex: { fontSize: 13, fontWeight: '600', color: '#1E68B8', width: 30 },
  punchDetailTime: { fontSize: 13, color: '#333', flex: 1 },
  mapButton: {
    backgroundColor: '#1E68B8', paddingHorizontal: 10,
    paddingVertical: 5, borderRadius: 8,
  },
  mapButtonText: { color: '#FFF', fontSize: 12, fontWeight: '600' },
  noLocation: { fontSize: 11, color: '#999', fontStyle: 'italic' },

  // Branch permissions button inside expanded card
  branchPermsButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF',
    borderRadius: 10,
    padding: 12,
    marginTop: 10,
    borderWidth: 2,
    borderColor: '#1E68B8',
  },
  branchPermsIcon: { fontSize: 18, marginRight: 10 },
  branchPermsText: { flex: 1, fontSize: 14, fontWeight: '600', color: '#1E68B8' },
  branchPermsArrow: { fontSize: 16, color: '#1E68B8', fontWeight: 'bold' },
});
