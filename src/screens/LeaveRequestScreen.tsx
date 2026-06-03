import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  StatusBar,
  ScrollView,
  TextInput,
  Alert,
  ActivityIndicator,
  Modal,
  RefreshControl,
  Platform,
  KeyboardAvoidingView,
} from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RouteProp, useFocusEffect } from '@react-navigation/native';
import { RootStackParamList, LeaveType, LeaveBalance, LeaveRequest } from '../types';
import { api } from '../services/api';
import { CalendarModal } from '../components/CalendarModal';
import {
  palette,
  spacing,
  radii,
  typography,
  elevation,
  KineticPressable,
  QuietPressable,
} from '../theme';

// Pretty-print a YYYY-MM-DD string as e.g. "Mon, 01 Jun 2026" for display.
const prettyDate = (iso: string): string => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return iso;
  const [y, m, d] = iso.split('-').map(Number);
  const dt = new Date(y, m - 1, d);
  return dt.toLocaleDateString('en-GB', {
    weekday: 'short', day: '2-digit', month: 'short', year: 'numeric',
  });
};

// Inclusive day count between two YYYY-MM-DD strings.
const dayCount = (from: string, to: string): number => {
  const a = new Date(from);
  const b = new Date(to);
  return Math.floor((b.getTime() - a.getTime()) / 86400000) + 1;
};

type Props = {
  navigation: NativeStackNavigationProp<RootStackParamList, 'LeaveRequest'>;
  route: RouteProp<RootStackParamList, 'LeaveRequest'>;
};

type DayType = 'FullDay' | 'HalfDay' | 'QuarterDay';

export const LeaveRequestScreen: React.FC<Props> = ({ route, navigation }) => {
  const { user, token } = route.params;

  // Form state
  const [leaveTypes, setLeaveTypes] = useState<LeaveType[]>([]);
  const [selectedLeaveType, setSelectedLeaveType] = useState<LeaveType | null>(null);
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [dayType, setDayType] = useState<DayType>('FullDay');
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [showLeavePicker, setShowLeavePicker] = useState(false);

  // Which calendar sheet (if any) is open: the From field or the To field.
  const [calOpen, setCalOpen] = useState<null | 'from' | 'to'>(null);

  // A request spanning more than one day cannot be Half/Quarter day.
  const isMultiDay =
    !!fromDate && !!toDate && /^\d{4}-\d{2}-\d{2}$/.test(fromDate) &&
    /^\d{4}-\d{2}-\d{2}$/.test(toDate) && dayCount(fromDate, toDate) > 1;

  // Lists
  const [balances, setBalances] = useState<LeaveBalance[]>([]);
  const [myLeaves, setMyLeaves] = useState<LeaveRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Focus tracking for input fields (branded focus rings)
  const [focusedField, setFocusedField] = useState<string | null>(null);

  const loadAll = async () => {
    try {
      const [typesRes, balRes, myRes] = await Promise.all([
        api.getLeaveTypes(token),
        api.getLeaveBalance(token),
        api.getMyLeaves(token),
      ]);
      if (typesRes.success) setLeaveTypes(typesRes.leaveTypes);
      if (balRes.success) setBalances(balRes.balances);
      if (myRes.success) setMyLeaves(myRes.leaves);
    } catch (error: any) {
      Alert.alert('Error', error.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      loadAll();
    }, []),
  );

  // Whenever the range becomes multi-day, snap back to Full Day — Half/Quarter
  // are meaningless across multiple dates (matches the web app's rule).
  useEffect(() => {
    if (isMultiDay && dayType !== 'FullDay') {
      setDayType('FullDay');
    }
  }, [isMultiDay, dayType]);

  // When a From date is picked, keep To in sync: if To is empty or now before
  // From, default it to the same day (a single-day request).
  const handlePickFrom = (iso: string) => {
    setFromDate(iso);
    if (!toDate || new Date(toDate) < new Date(iso)) {
      setToDate(iso);
    }
  };

  const handlePickTo = (iso: string) => {
    setToDate(iso);
  };

  const handleSubmit = async () => {
    if (!selectedLeaveType) {
      Alert.alert('Required', 'Please choose a leave type.');
      return;
    }
    if (!fromDate.trim() || !toDate.trim()) {
      Alert.alert('Required', 'Please fill From and To dates (YYYY-MM-DD).');
      return;
    }
    // Basic date format check
    const re = /^\d{4}-\d{2}-\d{2}$/;
    if (!re.test(fromDate) || !re.test(toDate)) {
      Alert.alert('Invalid', 'Use the YYYY-MM-DD format.');
      return;
    }
    if (new Date(toDate) < new Date(fromDate)) {
      Alert.alert('Invalid', 'To-date cannot be earlier than from-date.');
      return;
    }
    // Guard: multi-day range can't be Half/Quarter day.
    if (isMultiDay && dayType !== 'FullDay') {
      Alert.alert(
        'Invalid selection',
        'Half-day / Quarter-day applies to a single date only. For multiple days, choose Full Day.',
      );
      return;
    }

    setSubmitting(true);
    try {
      const res = await api.applyLeave(token, {
        leave_master_id: selectedLeaveType.id,
        from_date: fromDate,
        to_date: toDate,
        day_type: dayType,
        reason: reason || null,
      });
      if (res.success) {
        Alert.alert('Submitted', res.message);
        // Reset form
        setSelectedLeaveType(null);
        setFromDate('');
        setToDate('');
        setDayType('FullDay');
        setReason('');
        loadAll();
      }
    } catch (error: any) {
      Alert.alert('Error', error.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleCancel = (id: number) => {
    Alert.alert('Cancel leave', 'Withdraw this pending request?', [
      { text: 'Keep', style: 'cancel' },
      {
        text: 'Cancel',
        style: 'destructive',
        onPress: async () => {
          try {
            await api.cancelLeave(token, id);
            loadAll();
          } catch (error: any) {
            Alert.alert('Error', error.message);
          }
        },
      },
    ]);
  };

  const onRefresh = () => {
    setRefreshing(true);
    loadAll();
  };

  if (loading && !refreshing) {
    return (
      <View style={[styles.container, styles.center]}>
        <StatusBar barStyle="light-content" backgroundColor={palette.brandDeep} />
        <ActivityIndicator size="large" color={palette.brandDeep} />
        <Text style={styles.loadingText}>Loading leave info…</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={palette.brandDeep} />

      {/* Header */}
      <View style={styles.header}>
        <KineticPressable
          onPress={() => navigation.goBack()}
          style={styles.backButton}
          accessibilityLabel="Go back"
        >
          <Text style={styles.backIcon}>←</Text>
        </KineticPressable>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle}>Leave</Text>
          <Text style={styles.headerSubtitle}>Apply & track requests</Text>
        </View>
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          style={styles.content}
          contentContainerStyle={styles.contentInner}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={palette.brandDeep} />
          }
        >
          {/* Balances — quick glance */}
          {balances.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionLabel}>Balances</Text>
              <View style={styles.balanceGrid}>
                {balances.map((b) => (
                  <View key={b.id} style={styles.balanceTile}>
                    {/* Show the friendly leave name (e.g. "Casual Leave"),
                        falling back to the abbreviation if no description. */}
                    <Text style={styles.balanceName} numberOfLines={2}>
                      {b.description || b.name}
                    </Text>
                    <Text style={styles.balanceRemaining}>{b.remaining}</Text>
                    <Text style={styles.balanceTotal}>of {b.total} days</Text>
                  </View>
                ))}
              </View>
            </View>
          )}

          {/* Apply form */}
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>New request</Text>

            <Field label="Leave type">
              <KineticPressable
                style={styles.dropdown}
                onPress={() => setShowLeavePicker(true)}
              >
                <Text
                  style={
                    selectedLeaveType ? styles.dropdownValue : styles.dropdownPlaceholder
                  }
                  numberOfLines={1}
                >
                  {selectedLeaveType
                    ? `${selectedLeaveType.name} · ${selectedLeaveType.description || selectedLeaveType.name}`
                    : 'Select leave type'}
                </Text>
                <Text style={styles.dropdownChevron}>▾</Text>
              </KineticPressable>
            </Field>

            <View style={styles.rowFields}>
              <Field label="From date" style={{ flex: 1 }}>
                <KineticPressable
                  style={styles.dateField}
                  onPress={() => setCalOpen('from')}
                  accessibilityLabel="Pick from date"
                >
                  <Text style={fromDate ? styles.dateValue : styles.datePlaceholder}>
                    {fromDate ? prettyDate(fromDate) : 'Pick date'}
                  </Text>
                  <Text style={styles.dateIcon}>📅</Text>
                </KineticPressable>
              </Field>
              <Field label="To date" style={{ flex: 1 }}>
                <KineticPressable
                  style={styles.dateField}
                  onPress={() => setCalOpen('to')}
                  accessibilityLabel="Pick to date"
                >
                  <Text style={toDate ? styles.dateValue : styles.datePlaceholder}>
                    {toDate ? prettyDate(toDate) : 'Pick date'}
                  </Text>
                  <Text style={styles.dateIcon}>📅</Text>
                </KineticPressable>
              </Field>
            </View>

            {/* Range summary + multi-day notice */}
            {fromDate && toDate && (
              <Text style={styles.rangeNote}>
                {isMultiDay
                  ? `${dayCount(fromDate, toDate)} days · saved as Full Day`
                  : 'Single day'}
              </Text>
            )}

            <Text style={styles.fieldLabel}>Day type</Text>
            <View style={styles.segmentRow}>
              {(['FullDay', 'HalfDay', 'QuarterDay'] as DayType[]).map((t) => {
                const active = dayType === t;
                // Half / Quarter are disabled once a multi-day range is chosen.
                const disabled = isMultiDay && t !== 'FullDay';
                return (
                  <KineticPressable
                    key={t}
                    style={[
                      styles.segment,
                      active && styles.segmentActive,
                      disabled && styles.segmentDisabled,
                    ]}
                    onPress={() => {
                      if (disabled) {
                        Alert.alert(
                          'Not available',
                          'Half-day / Quarter-day applies to a single date only. Pick the same From and To date to use it.',
                        );
                        return;
                      }
                      setDayType(t);
                    }}
                    accessibilityState={{ selected: active, disabled }}
                  >
                    <Text
                      style={[
                        styles.segmentText,
                        active && styles.segmentTextActive,
                        disabled && styles.segmentTextDisabled,
                      ]}
                    >
                      {t === 'FullDay' ? 'Full' : t === 'HalfDay' ? 'Half' : 'Quarter'}
                    </Text>
                  </KineticPressable>
                );
              })}
            </View>

            <Field label="Reason (optional)">
              <TextInput
                style={[
                  styles.input,
                  styles.textarea,
                  focusedField === 'reason' && styles.inputFocused,
                ]}
                value={reason}
                onChangeText={setReason}
                placeholder="Personal / Medical / Vacation…"
                placeholderTextColor={palette.inkSoft}
                multiline
                numberOfLines={3}
                onFocus={() => setFocusedField('reason')}
                onBlur={() => setFocusedField(null)}
              />
            </Field>

            <KineticPressable
              style={[styles.submitButton, submitting && styles.submitButtonDisabled]}
              onPress={handleSubmit}
              disabled={submitting}
              accessibilityLabel="Submit leave request"
            >
              {submitting ? (
                <ActivityIndicator color={palette.inkInverse} />
              ) : (
                <Text style={styles.submitButtonText}>Submit request</Text>
              )}
            </KineticPressable>
          </View>

          {/* My requests */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionLabel}>My requests</Text>
              <Text style={styles.sectionCount}>{myLeaves.length}</Text>
            </View>

            {myLeaves.length === 0 ? (
              <View style={styles.emptyCard}>
                <Text style={styles.emptyGlyph}>∅</Text>
                <Text style={styles.emptyText}>No leave requests yet</Text>
              </View>
            ) : (
              myLeaves.map((lv) => (
                <LeaveCard
                  key={lv.id}
                  leave={lv}
                  onCancel={() => handleCancel(lv.id)}
                />
              ))
            )}
          </View>

          <View style={{ height: spacing['4xl'] }} />
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Leave type picker modal */}
      <Modal
        visible={showLeavePicker}
        transparent
        animationType="fade"
        onRequestClose={() => setShowLeavePicker(false)}
      >
        <View style={styles.modalScrim}>
          <View style={styles.modalSheet}>
            <View style={styles.modalHandle} />
            <Text style={styles.modalTitle}>Select leave type</Text>
            <ScrollView style={{ maxHeight: 420 }} showsVerticalScrollIndicator={false}>
              {leaveTypes.map((t) => {
                const sel = selectedLeaveType?.id === t.id;
                return (
                  <QuietPressable
                    key={t.id}
                    style={[styles.pickerItem, sel && styles.pickerItemSelected]}
                    onPress={() => {
                      setSelectedLeaveType(t);
                      setShowLeavePicker(false);
                    }}
                  >
                    <View style={{ flex: 1 }}>
                      {/* Full descriptive name as the title (Casual Leave),
                          abbreviation as the supporting hint (CL). */}
                      <Text style={styles.pickerItemTitle}>
                        {t.description || t.name}
                      </Text>
                      <Text style={styles.pickerItemHint} numberOfLines={1}>
                        {t.name}
                        {Number(t.default_balance) > 0 ? ` · ${t.default_balance} days / year` : ''}
                      </Text>
                    </View>
                    {sel && <Text style={styles.pickerTick}>✓</Text>}
                  </QuietPressable>
                );
              })}
            </ScrollView>
            <KineticPressable
              style={styles.modalCloseBtn}
              onPress={() => setShowLeavePicker(false)}
            >
              <Text style={styles.modalCloseBtnText}>Close</Text>
            </KineticPressable>
          </View>
        </View>
      </Modal>

      {/* From-date calendar */}
      <CalendarModal
        visible={calOpen === 'from'}
        onClose={() => setCalOpen(null)}
        onSelect={handlePickFrom}
        selectedDate={fromDate || null}
        title="From date"
      />

      {/* To-date calendar — cannot be earlier than the From date */}
      <CalendarModal
        visible={calOpen === 'to'}
        onClose={() => setCalOpen(null)}
        onSelect={handlePickTo}
        selectedDate={toDate || null}
        minDate={fromDate || null}
        title="To date"
      />
    </View>
  );
};

/* ────────────────────────────────────────────────────────────────────────── */
const Field: React.FC<{
  label: string;
  children: React.ReactNode;
  style?: any;
}> = ({ label, children, style }) => (
  <View style={[styles.fieldWrapper, style]}>
    <Text style={styles.fieldLabel}>{label}</Text>
    {children}
  </View>
);

const STATUS_THEME = {
  Pending: { bg: palette.warningSoft, ink: palette.warningInk, label: 'Pending' },
  Approved: { bg: palette.successSoft, ink: palette.successInk, label: 'Approved' },
  Rejected: { bg: palette.dangerSoft, ink: palette.dangerInk, label: 'Rejected' },
  Cancelled: { bg: palette.canvasAlt, ink: palette.inkMuted, label: 'Cancelled' },
};

const LeaveCard: React.FC<{
  leave: LeaveRequest;
  onCancel: () => void;
}> = ({ leave, onCancel }) => {
  const s = STATUS_THEME[leave.status];
  return (
    <View style={styles.leaveCard}>
      <View style={styles.leaveCardTop}>
        <View style={styles.leaveCodeChip}>
          <Text style={styles.leaveCodeText}>{leave.leave_code}</Text>
        </View>
        <Text style={styles.leaveDates} numberOfLines={1}>
          {leave.from_date}  →  {leave.to_date}
        </Text>
        <View style={[styles.statusPill, { backgroundColor: s.bg }]}>
          <Text style={[styles.statusPillText, { color: s.ink }]}>{s.label}</Text>
        </View>
      </View>

      <View style={styles.leaveMetaRow}>
        <Text style={styles.leaveMetaLabel}>Days</Text>
        <Text style={styles.leaveMetaValue}>
          {leave.days} ({leave.day_type})
        </Text>
      </View>

      {leave.reason && (
        <View style={styles.leaveMetaRow}>
          <Text style={styles.leaveMetaLabel}>Reason</Text>
          <Text style={styles.leaveMetaValue} numberOfLines={2}>
            {leave.reason}
          </Text>
        </View>
      )}

      {leave.approver_comment && (
        <View style={styles.leaveMetaRow}>
          <Text style={styles.leaveMetaLabel}>Manager</Text>
          <Text style={styles.leaveMetaValue} numberOfLines={2}>
            {leave.approver_comment}
          </Text>
        </View>
      )}

      {leave.status === 'Pending' && (
        <KineticPressable
          style={styles.cancelBtn}
          onPress={onCancel}
          accessibilityLabel="Cancel this request"
        >
          <Text style={styles.cancelBtnText}>Cancel request</Text>
        </KineticPressable>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: palette.canvas },
  center: { justifyContent: 'center', alignItems: 'center', gap: spacing.md },
  loadingText: { ...typography.caption, color: palette.inkMuted },

  // Header
  header: {
    backgroundColor: palette.brandDeep,
    paddingTop: 52,
    paddingBottom: spacing.xxl,
    paddingHorizontal: spacing.xl,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    borderBottomLeftRadius: radii.xxl,
    borderBottomRightRadius: radii.xxl,
    ...elevation.level2,
  },
  backButton: {
    width: 44, height: 44,
    borderRadius: radii.pill,
    backgroundColor: 'rgba(250, 250, 248, 0.16)',
    borderWidth: 1,
    borderColor: 'rgba(250, 250, 248, 0.20)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  backIcon: { fontSize: 22, color: palette.inkInverse, fontWeight: '600', marginLeft: -1 },
  headerTitle: { ...typography.title, color: palette.inkInverse },
  headerSubtitle: {
    ...typography.caption,
    color: 'rgba(250, 250, 248, 0.78)',
    marginTop: 2,
  },

  // Body
  content: { flex: 1 },
  contentInner: {
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.xl,
    paddingBottom: spacing.xl,
  },

  section: { marginBottom: spacing.xxl },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    marginBottom: spacing.md,
  },
  sectionLabel: {
    ...typography.overline,
    color: palette.inkMuted,
    marginBottom: spacing.md,
  },
  sectionCount: {
    ...typography.caption,
    color: palette.inkSoft,
    fontWeight: '700',
  },

  // Balances — bento tiles
  balanceGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
  },
  balanceTile: {
    flexBasis: '30%',
    flexGrow: 1,
    backgroundColor: palette.surface,
    borderRadius: radii.lg,
    paddingVertical: spacing.lg,
    alignItems: 'center',
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
  balanceName: {
    ...typography.caption,
    color: palette.brandDeep,
    fontWeight: '700',
    textAlign: 'center',
    minHeight: 32,        // keeps tiles aligned when names wrap to 2 lines
  },
  balanceRemaining: {
    fontSize: 26,
    lineHeight: 30,
    fontWeight: '700',
    color: palette.inkStrong,
    letterSpacing: -0.4,
    marginTop: 4,
  },
  balanceTotal: {
    ...typography.caption,
    color: palette.inkMuted,
    marginTop: 2,
  },

  // Form
  fieldWrapper: { marginBottom: spacing.lg },
  fieldLabel: {
    ...typography.caption,
    color: palette.inkMuted,
    marginBottom: spacing.sm,
    letterSpacing: 0.3,
  },
  input: {
    backgroundColor: palette.surfaceSunken,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: palette.borderHairline,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    ...typography.bodyLarge,
    color: palette.inkStrong,
  },
  inputFocused: {
    borderColor: palette.brandDeep,
    borderWidth: 2,
    backgroundColor: palette.surface,
  },
  textarea: {
    minHeight: 80,
    textAlignVertical: 'top',
  },
  dropdown: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: palette.surfaceSunken,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: palette.borderHairline,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    gap: spacing.sm,
  },
  dropdownValue: {
    ...typography.bodyLarge,
    color: palette.inkStrong,
    flex: 1,
  },
  dropdownPlaceholder: {
    ...typography.bodyLarge,
    color: palette.inkSoft,
    flex: 1,
  },
  dropdownChevron: { fontSize: 14, color: palette.inkMuted },

  // Tappable date field (opens the calendar sheet)
  dateField: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: palette.surfaceSunken,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: palette.borderHairline,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    gap: spacing.xs,
  },
  dateValue: {
    ...typography.body,
    color: palette.inkStrong,
    flexShrink: 1,
  },
  datePlaceholder: {
    ...typography.body,
    color: palette.inkSoft,
    flexShrink: 1,
  },
  dateIcon: { fontSize: 14 },
  rangeNote: {
    ...typography.caption,
    color: palette.brandDeep,
    fontWeight: '600',
    marginTop: -spacing.sm,
    marginBottom: spacing.lg,
  },

  rowFields: { flexDirection: 'row', gap: spacing.md },

  segmentRow: {
    flexDirection: 'row',
    backgroundColor: palette.surfaceSunken,
    padding: spacing.xs,
    borderRadius: radii.md,
    gap: spacing.xs,
    marginBottom: spacing.lg,
  },
  segment: {
    flex: 1,
    paddingVertical: spacing.md,
    alignItems: 'center',
    borderRadius: radii.sm,
  },
  segmentActive: {
    backgroundColor: palette.brandDeep,
    ...elevation.level1,
  },
  segmentDisabled: {
    opacity: 0.4,
  },
  segmentText: { ...typography.button, color: palette.inkBase },
  segmentTextActive: { color: palette.inkInverse },
  segmentTextDisabled: { color: palette.inkSoft },

  submitButton: {
    backgroundColor: palette.brandDeep,
    borderRadius: radii.lg,
    paddingVertical: spacing.lg,
    alignItems: 'center',
    marginTop: spacing.sm,
    ...elevation.level3,
  },
  submitButtonDisabled: { opacity: 0.55 },
  submitButtonText: { ...typography.buttonLarge, color: palette.inkInverse },

  // My requests
  emptyCard: {
    backgroundColor: palette.surface,
    borderRadius: radii.lg,
    padding: spacing['3xl'],
    alignItems: 'center',
    gap: spacing.sm,
    borderWidth: 1,
    borderColor: palette.borderHairline,
    ...elevation.level1,
  },
  emptyGlyph: { fontSize: 36, color: palette.inkSoft },
  emptyText: { ...typography.body, color: palette.inkMuted },

  leaveCard: {
    backgroundColor: palette.surface,
    borderRadius: radii.lg,
    padding: spacing.lg,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: palette.borderHairline,
    ...elevation.level1,
  },
  leaveCardTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  leaveCodeChip: {
    backgroundColor: palette.brandSoft,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radii.xs,
  },
  leaveCodeText: {
    ...typography.overline,
    color: palette.brandInk,
    fontSize: 11,
    letterSpacing: 0.8,
  },
  leaveDates: {
    ...typography.bodyEmphasis,
    color: palette.inkStrong,
    flex: 1,
  },
  statusPill: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radii.pill,
  },
  statusPillText: {
    ...typography.overline,
    letterSpacing: 0.6,
  },
  leaveMetaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingVertical: spacing.xs,
    gap: spacing.md,
  },
  leaveMetaLabel: {
    ...typography.caption,
    color: palette.inkMuted,
    minWidth: 70,
  },
  leaveMetaValue: {
    ...typography.body,
    color: palette.inkBase,
    flex: 1,
    textAlign: 'right',
  },
  cancelBtn: {
    marginTop: spacing.sm,
    paddingVertical: spacing.sm,
    borderRadius: radii.md,
    backgroundColor: palette.dangerSoft,
    alignItems: 'center',
  },
  cancelBtnText: {
    ...typography.button,
    color: palette.dangerInk,
  },

  // Modal
  modalScrim: {
    flex: 1,
    backgroundColor: palette.scrim,
    justifyContent: 'flex-end',
  },
  modalSheet: {
    backgroundColor: palette.surfaceElevated,
    borderTopLeftRadius: radii.xxl,
    borderTopRightRadius: radii.xxl,
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.md,
    paddingBottom: spacing.xxl,
    maxHeight: '78%',
    ...elevation.level4,
  },
  modalHandle: {
    width: 40, height: 4,
    backgroundColor: palette.borderBase,
    borderRadius: radii.pill,
    alignSelf: 'center',
    marginBottom: spacing.lg,
  },
  modalTitle: {
    ...typography.title,
    color: palette.inkStrong,
    marginBottom: spacing.lg,
  },
  pickerItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: palette.surface,
    borderRadius: radii.md,
    padding: spacing.md,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: palette.borderHairline,
  },
  pickerItemSelected: {
    backgroundColor: palette.brandSoft,
    borderColor: palette.brandDeep,
    borderWidth: 1.5,
  },
  pickerItemTitle: {
    ...typography.subtitle,
    color: palette.inkStrong,
  },
  pickerItemHint: {
    ...typography.caption,
    color: palette.inkMuted,
    marginTop: 2,
  },
  pickerTick: {
    fontSize: 20,
    color: palette.brandDeep,
    fontWeight: '700',
  },
  modalCloseBtn: {
    backgroundColor: palette.canvasAlt,
    borderRadius: radii.md,
    paddingVertical: spacing.md,
    alignItems: 'center',
    marginTop: spacing.md,
  },
  modalCloseBtnText: {
    ...typography.button,
    color: palette.inkBase,
  },
});
