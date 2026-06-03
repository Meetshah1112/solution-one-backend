import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  StatusBar,
  ScrollView,
  ActivityIndicator,
  Alert,
  RefreshControl,
  Modal,
} from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RouteProp } from '@react-navigation/native';
import { RootStackParamList, Unit } from '../types';
import { api } from '../services/api';
import {
  palette,
  spacing,
  radii,
  typography,
  elevation,
  KineticPressable,
  QuietPressable,
} from '../theme';

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

  // ─── Business logic preserved verbatim ──────────────────────────────────
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [employees, setEmployees] = useState<EmployeeWithAttendance[]>([]);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);

  const [units, setUnits] = useState<Unit[]>([]);
  const [selectedUnitId, setSelectedUnitId] = useState<number | null>(null);
  const [showUnitFilter, setShowUnitFilter] = useState(false);

  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [selectedUserIds, setSelectedUserIds] = useState<number[]>([]);
  const [accessUpdating, setAccessUpdating] = useState(false);

  const isSuperAdmin = user.role === 'SUPER_ADMIN';

  useEffect(() => { loadUnits(); }, []);
  useEffect(() => { loadEmployeeData(); }, [selectedDate]);

  const loadUnits = async () => {
    try {
      const response = await api.getAdminUnits(token);
      if (response.success) setUnits(response.units);
    } catch (error: any) {
      console.log('Failed to load units for filter');
    }
  };

  const formatDate = (date: Date) =>
    date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });

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
      if (response.success) setEmployees(response.employees);
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

  const isToday = () => selectedDate.toDateString() === new Date().toDateString();

  // ── Calendar state & helpers ────────────────────────────────────────────
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
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December',
  ];
  const dayHeaders = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

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

  // ── Stats + filter ──────────────────────────────────────────────────────
  const filteredEmployees = useMemo(() => employees, [employees]);

  const getAttendanceStats = () => {
    const present = filteredEmployees.filter((e) => e.hasPunches).length;
    const absent = filteredEmployees.filter((e) => !e.hasPunches).length;
    return { present, absent, total: filteredEmployees.length };
  };

  const stats = getAttendanceStats();

  const selectedUnitName = selectedUnitId
    ? units.find((u) => u.id === selectedUnitId)?.name || 'Unknown'
    : 'All branches';

  const handleUnitFilterSelect = (unitId: number | null) => {
    setSelectedUnitId(unitId);
    setShowUnitFilter(false);
    exitSelectionMode();
  };

  // ── Multi-select handlers ───────────────────────────────────────────────
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
    setSelectedUserIds((prev) =>
      prev.includes(employeeId)
        ? prev.filter((id) => id !== employeeId)
        : [...prev, employeeId]
    );
  };

  const selectAll = () =>
    setSelectedUserIds(filteredEmployees.map((e) => e.id));

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
              const response = await api.updateEmployeeAccess(
                token,
                selectedUserIds,
                grantAccess
              );
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

  // ─── Loading state ──────────────────────────────────────────────────────
  if (loading && !refreshing) {
    return (
      <View style={[styles.container, styles.centerContent]}>
        <StatusBar barStyle="light-content" backgroundColor={palette.brandDeep} />
        <ActivityIndicator size="large" color={palette.brandDeep} />
        <Text style={styles.loadingText}>Loading employees…</Text>
      </View>
    );
  }

  // ─── Presentation ───────────────────────────────────────────────────────
  return (
    <View style={styles.container}>
      <StatusBar
        barStyle="light-content"
        backgroundColor={isSelectionMode ? palette.inkStrong : palette.brandDeep}
      />

      {/* ╭───── Header: brand or selection-mode ─────╮ */}
      {isSelectionMode ? (
        <View style={styles.selectionBar}>
          <KineticPressable
            onPress={exitSelectionMode}
            style={styles.selectionCancelBtn}
            accessibilityLabel="Exit selection mode"
          >
            <Text style={styles.selectionCancelText}>✕</Text>
          </KineticPressable>
          <Text style={styles.selectionCount}>
            {selectedUserIds.length} selected
          </Text>
          <KineticPressable
            onPress={selectAll}
            style={styles.selectAllBtn}
            accessibilityLabel="Select all employees"
          >
            <Text style={styles.selectAllText}>Select all</Text>
          </KineticPressable>
        </View>
      ) : (
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>{initialsOf(user.name)}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.headerGreeting}>
                {isSuperAdmin ? 'Super admin' : 'Admin'}
              </Text>
              <Text style={styles.headerName} numberOfLines={1}>
                {user.name}
              </Text>
              <Text style={styles.headerTenant}>
                {user.tenantDb === 'solution_one' ? 'Solution One' : 'CryoGas'}
              </Text>
            </View>
          </View>
          <KineticPressable
            onPress={handleLogout}
            style={styles.logoutButton}
            accessibilityLabel="Logout"
          >
            <Text style={styles.logoutText}>Logout</Text>
          </KineticPressable>
        </View>
      )}

      <ScrollView
        style={styles.content}
        contentContainerStyle={styles.contentInner}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={palette.brandDeep}
          />
        }
      >
        {/* ╭───── Selection action bar ─────╮ */}
        {isSelectionMode && (
          <View style={styles.selectionActions}>
            <KineticPressable
              style={[styles.actionBtn, styles.grantBtn]}
              onPress={() => handleAccessUpdate(true)}
              disabled={accessUpdating || selectedUserIds.length === 0}
              accessibilityLabel="Grant access to selected"
            >
              {accessUpdating ? (
                <ActivityIndicator color={palette.inkInverse} size="small" />
              ) : (
                <Text style={styles.actionBtnText}>Grant access</Text>
              )}
            </KineticPressable>
            <KineticPressable
              style={[styles.actionBtn, styles.revokeBtn]}
              onPress={() => handleAccessUpdate(false)}
              disabled={accessUpdating || selectedUserIds.length === 0}
              accessibilityLabel="Revoke access from selected"
            >
              {accessUpdating ? (
                <ActivityIndicator color={palette.inkInverse} size="small" />
              ) : (
                <Text style={styles.actionBtnText}>Revoke access</Text>
              )}
            </KineticPressable>
          </View>
        )}

        {!isSelectionMode && (
          <>
            {/* ╭───── Date + filter pair ─────╮
                Side-by-side on the visual grid so they read as related controls */}
            <View style={styles.controlsRow}>
              <KineticPressable
                style={styles.controlCard}
                onPress={openDatePicker}
                accessibilityLabel={`Selected date ${formatDate(selectedDate)}, tap to change`}
              >
                <Text style={styles.controlLabel}>Date</Text>
                <Text style={styles.controlValue} numberOfLines={1}>
                  {formatDate(selectedDate)}
                </Text>
                {isToday() ? (
                  <Text style={styles.controlBadge}>Today</Text>
                ) : (
                  <Text style={styles.controlHint}>Tap to change</Text>
                )}
              </KineticPressable>

              <KineticPressable
                style={styles.controlCard}
                onPress={() => setShowUnitFilter(true)}
                accessibilityLabel={`Branch filter, currently ${selectedUnitName}`}
              >
                <Text style={styles.controlLabel}>Branch</Text>
                <Text style={styles.controlValue} numberOfLines={1}>
                  {selectedUnitName}
                </Text>
                <Text style={styles.controlHint}>Tap to filter</Text>
              </KineticPressable>
            </View>

            {!isToday() && (
              <KineticPressable
                style={styles.jumpToTodayPill}
                onPress={() => setSelectedDate(new Date())}
                accessibilityLabel="Jump back to today"
              >
                <Text style={styles.jumpToTodayText}>← Back to today</Text>
              </KineticPressable>
            )}

            {/* ╭───── Stats trio: bento-style layout ─────╮ */}
            <View style={styles.statsRow}>
              <StatTile label="Total" value={stats.total} accent={palette.brandDeep} />
              <StatTile label="Present" value={stats.present} accent={palette.successDeep} />
              <StatTile label="Absent" value={stats.absent} accent={palette.dangerDeep} />
            </View>

            {/* ╭───── Manage units button ─────╮ */}
            <KineticPressable
              style={styles.manageUnitsButton}
              onPress={() => navigation.navigate('ManageUnits', { user, token })}
              accessibilityLabel="Manage units"
            >
              <View style={styles.manageUnitsIconWrap}>
                <Text style={styles.manageUnitsIcon}>⚙</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.manageUnitsText}>Manage units</Text>
                <Text style={styles.manageUnitsHint}>
                  Configure branch locations & geofences
                </Text>
              </View>
              <Text style={styles.manageUnitsArrow}>›</Text>
            </KineticPressable>

            {/* ╭───── Phase 2 — admin tools ─────╮
                Approvals + reports grouped together as a single bento row */}
            <View style={styles.adminMenuRow}>
              <AdminMenuTile
                label="Leave"
                hint="Approve / reject"
                tint={palette.brandSoft}
                ink={palette.brandDeep}
                onPress={() => navigation.navigate('LeaveApproval', { user, token })}
              />
              <AdminMenuTile
                label="Adjust"
                hint="Punch fixes"
                tint={palette.warningSoft}
                ink={palette.warningDeep}
                onPress={() => navigation.navigate('AdjustmentApproval', { user, token })}
              />
              <AdminMenuTile
                label="Reports"
                hint="Custom layouts"
                tint={palette.successSoft}
                ink={palette.successDeep}
                onPress={() => navigation.navigate('Reports', { user, token })}
              />
            </View>
          </>
        )}

        {/* ╭───── Employee list ─────╮ */}
        <View style={styles.attendanceSection}>
          {!isSelectionMode && (
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionLabel}>Employees</Text>
              <Text style={styles.sectionHint}>tap · long-press to select</Text>
            </View>
          )}

          {filteredEmployees.length === 0 ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyGlyph}>∅</Text>
              <Text style={styles.emptyText}>No employees found</Text>
            </View>
          ) : (
            filteredEmployees.map((employee) => {
              const isSelected = selectedUserIds.includes(employee.id);
              const isActive = !!employee.is_active;

              return (
                <QuietPressable
                  key={employee.id}
                  style={[
                    styles.employeeCard,
                    isSelected && styles.employeeCardSelected,
                    !isActive && styles.employeeCardBlocked,
                  ]}
                  onPress={() => handlePress(employee)}
                  onLongPress={() => handleLongPress(employee.id)}
                  delayLongPress={400}
                  accessibilityState={{ selected: isSelected }}
                  accessibilityLabel={`${employee.name}, ${
                    isActive ? 'active' : 'blocked'
                  }, ${employee.hasPunches ? employee.punchCount + ' punches' : 'absent'}`}
                >
                  {isSelectionMode && (
                    <View
                      style={[styles.checkbox, isSelected && styles.checkboxSelected]}
                    >
                      {isSelected && <Text style={styles.checkboxCheck}>✓</Text>}
                    </View>
                  )}

                  {/* Avatar bubble (consistent with header avatar language) */}
                  <View
                    style={[
                      styles.empAvatar,
                      !isActive && styles.empAvatarBlocked,
                    ]}
                  >
                    <Text style={styles.empAvatarText}>
                      {initialsOf(employee.name)}
                    </Text>
                  </View>

                  <View style={styles.employeeInfo}>
                    <View style={styles.employeeNameRow}>
                      <Text style={styles.employeeName} numberOfLines={1}>
                        {employee.name}
                      </Text>
                      <View
                        style={[
                          styles.statusBadge,
                          isActive ? styles.activeBadge : styles.blockedBadge,
                        ]}
                      >
                        <Text
                          style={[
                            styles.statusBadgeText,
                            {
                              color: isActive
                                ? palette.successInk
                                : palette.dangerInk,
                            },
                          ]}
                        >
                          {isActive ? 'Active' : 'Blocked'}
                        </Text>
                      </View>
                    </View>
                    <Text style={styles.employeeEmail} numberOfLines={1}>
                      {employee.email}
                    </Text>
                  </View>

                  {!isSelectionMode && (
                    <View
                      style={
                        employee.hasPunches ? styles.presentBadge : styles.absentBadge
                      }
                    >
                      <Text
                        style={[
                          styles.badgeText,
                          {
                            color: employee.hasPunches
                              ? palette.successInk
                              : palette.dangerInk,
                          },
                        ]}
                      >
                        {employee.hasPunches
                          ? `${employee.punchCount} ›`
                          : 'Absent ›'}
                      </Text>
                    </View>
                  )}
                </QuietPressable>
              );
            })
          )}
        </View>
      </ScrollView>

      {/* ╭───── Calendar modal ─────╮ */}
      <Modal
        visible={showDatePicker}
        transparent
        animationType="fade"
        onRequestClose={() => setShowDatePicker(false)}
      >
        <View style={styles.modalScrim}>
          <View style={styles.calendarModal}>
            <Text style={styles.modalTitle}>Select date</Text>

            <View style={styles.calendarNav}>
              <KineticPressable
                onPress={() => navigateCalendarMonth(-1)}
                style={styles.calendarNavBtn}
                accessibilityLabel="Previous month"
              >
                <Text style={styles.calendarNavArrow}>‹</Text>
              </KineticPressable>
              <Text style={styles.calendarNavTitle}>
                {monthNames[calendarMonth]} {calendarYear}
              </Text>
              <KineticPressable
                onPress={() => navigateCalendarMonth(1)}
                style={styles.calendarNavBtn}
                accessibilityLabel="Next month"
              >
                <Text style={styles.calendarNavArrow}>›</Text>
              </KineticPressable>
            </View>

            <View style={styles.calendarDayHeaders}>
              {dayHeaders.map((d) => (
                <Text key={d} style={styles.calendarDayHeader}>
                  {d}
                </Text>
              ))}
            </View>

            <View style={styles.calendarGrid}>
              {calendarDays.map((day, index) => {
                if (day === null) {
                  return <View key={`empty-${index}`} style={styles.calendarDayEmpty} />;
                }
                const cellDate = new Date(calendarYear, calendarMonth, day);
                const isSelected =
                  selectedDate.toDateString() === cellDate.toDateString();
                const isFuture = cellDate > new Date();
                const isTodayCell =
                  new Date().toDateString() === cellDate.toDateString();

                return (
                  <QuietPressable
                    key={`day-${day}`}
                    style={styles.calendarDay}
                    onPress={() => selectCalendarDay(day)}
                    disabled={isFuture}
                    accessibilityLabel={`Day ${day}${isTodayCell ? ', today' : ''}`}
                  >
                    <View
                      style={[
                        styles.calendarDayInner,
                        isSelected && styles.calendarDaySelected,
                        isTodayCell && !isSelected && styles.calendarDayToday,
                      ]}
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
                    </View>
                  </QuietPressable>
                );
              })}
            </View>

            <View style={styles.quickSelectRow}>
              <KineticPressable
                style={styles.quickSelectBtn}
                onPress={() => {
                  setSelectedDate(new Date());
                  setShowDatePicker(false);
                }}
              >
                <Text style={styles.quickSelectText}>Today</Text>
              </KineticPressable>
              <KineticPressable
                style={styles.quickSelectBtn}
                onPress={() => {
                  const d = new Date();
                  d.setDate(d.getDate() - 1);
                  setSelectedDate(d);
                  setShowDatePicker(false);
                }}
              >
                <Text style={styles.quickSelectText}>Yesterday</Text>
              </KineticPressable>
            </View>

            <KineticPressable
              style={styles.calendarCloseBtn}
              onPress={() => setShowDatePicker(false)}
            >
              <Text style={styles.calendarCloseBtnText}>Close</Text>
            </KineticPressable>
          </View>
        </View>
      </Modal>

      {/* ╭───── Branch filter modal ─────╮ */}
      <Modal
        visible={showUnitFilter}
        transparent
        animationType="fade"
        onRequestClose={() => setShowUnitFilter(false)}
      >
        <View style={styles.modalScrim}>
          <View style={styles.calendarModal}>
            <Text style={styles.modalTitle}>Filter by branch</Text>
            <ScrollView style={{ maxHeight: 400 }} showsVerticalScrollIndicator={false}>
              <QuietPressable
                style={[
                  styles.filterOption,
                  selectedUnitId === null && styles.filterOptionSelected,
                ]}
                onPress={() => handleUnitFilterSelect(null)}
              >
                <Text style={styles.filterOptionText}>All branches</Text>
                {selectedUnitId === null && (
                  <Text style={styles.filterCheckmark}>✓</Text>
                )}
              </QuietPressable>

              {units
                .filter((u) => u.is_geofenced)
                .map((unit) => (
                  <QuietPressable
                    key={unit.id}
                    style={[
                      styles.filterOption,
                      selectedUnitId === unit.id && styles.filterOptionSelected,
                    ]}
                    onPress={() => handleUnitFilterSelect(unit.id)}
                  >
                    <Text style={styles.filterOptionText}>{unit.name}</Text>
                    {selectedUnitId === unit.id && (
                      <Text style={styles.filterCheckmark}>✓</Text>
                    )}
                  </QuietPressable>
                ))}
            </ScrollView>
            <KineticPressable
              style={styles.calendarCloseBtn}
              onPress={() => setShowUnitFilter(false)}
            >
              <Text style={styles.calendarCloseBtnText}>Close</Text>
            </KineticPressable>
          </View>
        </View>
      </Modal>
    </View>
  );
};

// ─── Sub-components co-located for clarity ──────────────────────────────────
const StatTile: React.FC<{ label: string; value: number; accent: string }> = ({
  label,
  value,
  accent,
}) => (
  <View style={[styles.statTile, { borderTopColor: accent }]}>
    <Text style={[styles.statNumber, { color: accent }]}>{value}</Text>
    <Text style={styles.statLabel}>{label}</Text>
  </View>
);

// Compact bento tile for admin Phase-2 modules
const AdminMenuTile: React.FC<{
  label: string;
  hint: string;
  tint: string;
  ink: string;
  onPress: () => void;
}> = ({ label, hint, tint, ink, onPress }) => (
  <KineticPressable
    style={styles.adminMenuTile}
    onPress={onPress}
    accessibilityLabel={label}
    accessibilityHint={hint}
  >
    <View style={[styles.adminMenuIcon, { backgroundColor: tint }]}>
      <Text style={[styles.adminMenuGlyph, { color: ink }]}>›</Text>
    </View>
    <Text style={styles.adminMenuLabel}>{label}</Text>
    <Text style={styles.adminMenuHint}>{hint}</Text>
  </KineticPressable>
);

const initialsOf = (name: string): string => {
  const parts = (name || '').trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '·';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: palette.canvas },
  centerContent: { justifyContent: 'center', alignItems: 'center', gap: spacing.md },
  loadingText: { ...typography.caption, color: palette.inkMuted },

  // ── Header ───────────────────────────────────────────────────────────────
  header: {
    backgroundColor: palette.brandDeep,
    paddingTop: 52,
    paddingBottom: spacing.xxl,
    paddingHorizontal: spacing.xl,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomLeftRadius: radii.xxl,
    borderBottomRightRadius: radii.xxl,
    ...elevation.level2,
  },
  headerLeft: { flexDirection: 'row', alignItems: 'center', flex: 1, gap: spacing.md },
  avatar: {
    width: 48, height: 48,
    borderRadius: radii.pill,
    backgroundColor: 'rgba(250, 250, 248, 0.18)',
    borderWidth: 1,
    borderColor: 'rgba(250, 250, 248, 0.22)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    ...typography.subtitle,
    color: palette.inkInverse,
    letterSpacing: 0.5,
  },
  headerGreeting: {
    ...typography.caption,
    color: 'rgba(250, 250, 248, 0.75)',
    fontWeight: '500',
  },
  headerName: {
    ...typography.title,
    color: palette.inkInverse,
    marginTop: 2,
  },
  headerTenant: {
    ...typography.overline,
    color: 'rgba(250, 250, 248, 0.65)',
    marginTop: spacing.xs,
    letterSpacing: 1.0,
  },
  logoutButton: {
    backgroundColor: 'rgba(250, 250, 248, 0.14)',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: 'rgba(250, 250, 248, 0.18)',
  },
  logoutText: { ...typography.button, color: palette.inkInverse },

  // ── Selection bar ────────────────────────────────────────────────────────
  selectionBar: {
    backgroundColor: palette.inkStrong,
    paddingTop: 52,
    paddingBottom: spacing.lg,
    paddingHorizontal: spacing.xl,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomLeftRadius: radii.xl,
    borderBottomRightRadius: radii.xl,
    ...elevation.level2,
  },
  selectionCancelBtn: {
    width: 40, height: 40,
    borderRadius: radii.pill,
    backgroundColor: 'rgba(250, 250, 248, 0.14)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  selectionCancelText: {
    color: palette.inkInverse,
    fontSize: 16,
    fontWeight: '700',
  },
  selectionCount: {
    ...typography.subtitle,
    color: palette.inkInverse,
  },
  selectAllBtn: {
    backgroundColor: 'rgba(250, 250, 248, 0.14)',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radii.pill,
  },
  selectAllText: { ...typography.button, color: palette.inkInverse },

  // ── Selection action row ─────────────────────────────────────────────────
  selectionActions: {
    flexDirection: 'row',
    gap: spacing.md,
    marginBottom: spacing.lg,
    marginTop: spacing.sm,
  },
  actionBtn: {
    flex: 1,
    paddingVertical: spacing.lg,
    borderRadius: radii.md,
    alignItems: 'center',
    ...elevation.level2,
  },
  grantBtn: { backgroundColor: palette.successBase },
  revokeBtn: { backgroundColor: palette.dangerBase },
  actionBtnText: { ...typography.buttonLarge, color: palette.inkInverse },

  // ── Body ─────────────────────────────────────────────────────────────────
  content: { flex: 1 },
  contentInner: {
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.xl,
    paddingBottom: spacing['5xl'],
  },

  // ── Controls row (Date + Branch) ────────────────────────────────────────
  controlsRow: {
    flexDirection: 'row',
    gap: spacing.md,
    marginBottom: spacing.md,
  },
  controlCard: {
    flex: 1,
    backgroundColor: palette.surface,
    borderRadius: radii.lg,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: palette.borderHairline,
    ...elevation.level1,
  },
  controlLabel: {
    ...typography.overline,
    color: palette.inkMuted,
    marginBottom: spacing.xs,
  },
  controlValue: {
    ...typography.subtitle,
    color: palette.inkStrong,
  },
  controlHint: {
    ...typography.caption,
    color: palette.inkMuted,
    marginTop: 2,
  },
  controlBadge: {
    ...typography.caption,
    color: palette.successDeep,
    fontWeight: '700',
    marginTop: 2,
  },
  jumpToTodayPill: {
    alignSelf: 'flex-start',
    backgroundColor: palette.brandSoft,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radii.pill,
    marginBottom: spacing.lg,
  },
  jumpToTodayText: {
    ...typography.caption,
    color: palette.brandDeep,
    fontWeight: '700',
  },

  // ── Stats trio ───────────────────────────────────────────────────────────
  statsRow: {
    flexDirection: 'row',
    gap: spacing.md,
    marginBottom: spacing.xl,
  },
  statTile: {
    flex: 1,
    backgroundColor: palette.surface,
    borderRadius: radii.lg,
    paddingVertical: spacing.lg,
    alignItems: 'center',
    // Asymmetric top-border accent → visual hierarchy without colored borders
    borderTopWidth: 3,
    borderTopColor: palette.brandDeep,
    borderLeftWidth: 1,
    borderRightWidth: 1,
    borderBottomWidth: 1,
    borderLeftColor: palette.borderHairline,
    borderRightColor: palette.borderHairline,
    borderBottomColor: palette.borderHairline,
    ...elevation.level1,
  },
  statNumber: {
    fontSize: 28,
    lineHeight: 32,
    fontWeight: '700',
    letterSpacing: -0.4,
  },
  statLabel: {
    ...typography.caption,
    color: palette.inkMuted,
    marginTop: spacing.xs,
  },

  // ── Manage units button ──────────────────────────────────────────────────
  manageUnitsButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: palette.surface,
    borderRadius: radii.lg,
    padding: spacing.lg,
    gap: spacing.md,
    marginBottom: spacing.xxl,
    borderWidth: 1,
    borderColor: palette.brandSoftBorder,
    ...elevation.level2,
  },
  manageUnitsIconWrap: {
    width: 44, height: 44,
    borderRadius: radii.md,
    backgroundColor: palette.brandSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  manageUnitsIcon: { fontSize: 22, color: palette.brandDeep },
  manageUnitsText: { ...typography.subtitle, color: palette.inkStrong },
  manageUnitsHint: { ...typography.caption, color: palette.inkMuted, marginTop: 2 },
  manageUnitsArrow: { fontSize: 22, color: palette.brandDeep, fontWeight: '600' },

  // ── Employee list ────────────────────────────────────────────────────────
  attendanceSection: { marginBottom: spacing.xxl },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    marginBottom: spacing.md,
  },
  sectionLabel: {
    ...typography.overline,
    color: palette.inkMuted,
  },
  sectionHint: {
    ...typography.caption,
    color: palette.inkSoft,
  },
  emptyState: {
    backgroundColor: palette.surface,
    borderRadius: radii.lg,
    padding: spacing['3xl'],
    alignItems: 'center',
    gap: spacing.sm,
    borderWidth: 1,
    borderColor: palette.borderHairline,
  },
  emptyGlyph: { fontSize: 36, color: palette.inkSoft },
  emptyText: { ...typography.body, color: palette.inkMuted },

  // ── Employee card ────────────────────────────────────────────────────────
  employeeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: palette.surface,
    borderRadius: radii.lg,
    padding: spacing.md,
    marginBottom: spacing.md,
    gap: spacing.md,
    borderWidth: 1,
    borderColor: palette.borderHairline,
    ...elevation.level1,
  },
  employeeCardSelected: {
    backgroundColor: palette.brandSoft,
    borderColor: palette.brandDeep,
    borderWidth: 1.5,
  },
  employeeCardBlocked: { opacity: 0.65 },

  checkbox: {
    width: 22, height: 22,
    borderRadius: radii.xs,
    borderWidth: 1.5,
    borderColor: palette.inkMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxSelected: {
    backgroundColor: palette.brandDeep,
    borderColor: palette.brandDeep,
  },
  checkboxCheck: { color: palette.inkInverse, fontSize: 14, fontWeight: '700' },

  // Avatar in row — slightly smaller than header avatar for hierarchy
  empAvatar: {
    width: 40, height: 40,
    borderRadius: radii.pill,
    backgroundColor: palette.brandSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  empAvatarBlocked: {
    backgroundColor: palette.canvasAlt,
  },
  empAvatarText: {
    ...typography.bodyEmphasis,
    color: palette.brandDeep,
  },

  employeeInfo: { flex: 1, gap: 2 },
  employeeNameRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  employeeName: {
    ...typography.bodyEmphasis,
    color: palette.inkStrong,
    flexShrink: 1,
  },
  employeeEmail: { ...typography.caption, color: palette.inkMuted },

  statusBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radii.pill,
  },
  activeBadge: { backgroundColor: palette.successSoft },
  blockedBadge: { backgroundColor: palette.dangerSoft },
  statusBadgeText: { ...typography.overline, letterSpacing: 0.6 },

  presentBadge: {
    backgroundColor: palette.successSoft,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radii.pill,
  },
  absentBadge: {
    backgroundColor: palette.dangerSoft,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radii.pill,
  },
  badgeText: { ...typography.caption, fontWeight: '700' },

  // ── Modals ───────────────────────────────────────────────────────────────
  modalScrim: {
    flex: 1,
    backgroundColor: palette.scrim,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.xl,
  },
  calendarModal: {
    backgroundColor: palette.surfaceElevated,
    borderRadius: radii.xl,
    padding: spacing.xl,
    width: '100%',
    maxWidth: 380,
    ...elevation.level4,
  },
  modalTitle: {
    ...typography.title,
    color: palette.inkStrong,
    marginBottom: spacing.lg,
    textAlign: 'center',
  },
  calendarNav: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  calendarNavBtn: {
    width: 36, height: 36,
    borderRadius: radii.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: palette.canvasAlt,
  },
  calendarNavArrow: {
    fontSize: 22,
    color: palette.brandDeep,
    lineHeight: 22,
    fontWeight: '700',
  },
  calendarNavTitle: {
    ...typography.subtitle,
    color: palette.inkStrong,
  },
  calendarDayHeaders: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: spacing.sm,
  },
  calendarDayHeader: {
    width: '14.28%',
    textAlign: 'center',
    ...typography.overline,
    color: palette.inkSoft,
    letterSpacing: 0.4,
  },
  calendarGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  calendarDayEmpty: { width: '14.28%', height: 40 },
  calendarDay: {
    width: '14.28%',
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  calendarDayInner: {
    width: 36, height: 36,
    borderRadius: radii.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  calendarDaySelected: {
    backgroundColor: palette.brandDeep,
  },
  calendarDayToday: {
    borderWidth: 1.5,
    borderColor: palette.brandDeep,
  },
  calendarDayText: { ...typography.body, color: palette.inkStrong },
  calendarDayTextSelected: { color: palette.inkInverse, fontWeight: '700' },
  calendarDayTextDisabled: { color: palette.inkSoft, opacity: 0.4 },
  calendarDayTextToday: { color: palette.brandDeep, fontWeight: '700' },

  quickSelectRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: spacing.md,
    marginTop: spacing.lg,
    marginBottom: spacing.md,
  },
  quickSelectBtn: {
    backgroundColor: palette.brandSoft,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: radii.pill,
  },
  quickSelectText: {
    ...typography.button,
    color: palette.brandDeep,
  },

  calendarCloseBtn: {
    backgroundColor: palette.canvasAlt,
    borderRadius: radii.md,
    paddingVertical: spacing.md,
    alignItems: 'center',
    marginTop: spacing.sm,
  },
  calendarCloseBtnText: { ...typography.button, color: palette.inkBase },

  filterOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: palette.surface,
    borderRadius: radii.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: palette.borderHairline,
  },
  filterOptionSelected: {
    backgroundColor: palette.brandSoft,
    borderColor: palette.brandDeep,
    borderWidth: 1.5,
  },
  filterOptionText: { ...typography.body, color: palette.inkStrong },
  filterCheckmark: { fontSize: 18, color: palette.brandDeep, fontWeight: '700' },

  // ── Phase 2 admin tile row ───────────────────────────────────────────────
  adminMenuRow: {
    flexDirection: 'row',
    gap: spacing.md,
    marginTop: spacing.md,
    marginBottom: spacing.xxl,
  },
  adminMenuTile: {
    flex: 1,
    backgroundColor: palette.surface,
    borderRadius: radii.lg,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: palette.borderHairline,
    ...elevation.level1,
  },
  adminMenuIcon: {
    width: 36, height: 36,
    borderRadius: radii.sm,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
  },
  adminMenuGlyph: {
    fontSize: 22,
    fontWeight: '700',
    marginTop: -2,
  },
  adminMenuLabel: {
    ...typography.bodyEmphasis,
    color: palette.inkStrong,
  },
  adminMenuHint: {
    ...typography.caption,
    color: palette.inkMuted,
    marginTop: 2,
  },
});
