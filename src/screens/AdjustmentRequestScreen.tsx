import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  StatusBar,
  ScrollView,
  TextInput,
  Alert,
  ActivityIndicator,
  RefreshControl,
  Platform,
  KeyboardAvoidingView,
} from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RouteProp, useFocusEffect } from '@react-navigation/native';
import { RootStackParamList, AdjustmentRequest, AdjustmentType } from '../types';
import { api } from '../services/api';
import {
  palette,
  spacing,
  radii,
  typography,
  elevation,
  KineticPressable,
} from '../theme';

type Props = {
  navigation: NativeStackNavigationProp<RootStackParamList, 'AdjustmentRequest'>;
  route: RouteProp<RootStackParamList, 'AdjustmentRequest'>;
};

const TYPES: { value: AdjustmentType; label: string; hint: string }[] = [
  { value: 'MissedPunch', label: 'Missed punch', hint: 'I forgot to punch in or out' },
  { value: 'WrongPunch', label: 'Wrong punch', hint: 'Punched wrong time / location' },
  { value: 'OnDuty', label: 'On-duty', hint: 'Field visit / client site' },
  { value: 'WFH', label: 'WFH', hint: 'Working from home that day' },
];

export const AdjustmentRequestScreen: React.FC<Props> = ({ navigation, route }) => {
  const { token } = route.params;

  const [type, setType] = useState<AdjustmentType>('MissedPunch');
  const [attendDate, setAttendDate] = useState('');
  const [inTime, setInTime] = useState('');
  const [outTime, setOutTime] = useState('');
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [focusedField, setFocusedField] = useState<string | null>(null);

  const [myList, setMyList] = useState<AdjustmentRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = async () => {
    try {
      const res = await api.getMyAdjustments(token);
      if (res.success) setMyList(res.adjustments);
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
      load();
    }, []),
  );

  const handleSubmit = async () => {
    if (!attendDate.trim()) {
      Alert.alert('Required', 'Attendance date is required.');
      return;
    }
    if (!reason.trim()) {
      Alert.alert('Required', 'Reason is required.');
      return;
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(attendDate)) {
      Alert.alert('Invalid', 'Date format must be YYYY-MM-DD.');
      return;
    }

    // Build full ISO datetimes for in/out if provided
    const buildDateTime = (timeStr: string): string | null => {
      if (!timeStr.trim()) return null;
      if (!/^\d{2}:\d{2}$/.test(timeStr)) return null;
      return `${attendDate}T${timeStr}:00`;
    };

    setSubmitting(true);
    try {
      const res = await api.applyAdjustment(token, {
        type,
        attendence_date: attendDate,
        in_time: buildDateTime(inTime),
        out_time: buildDateTime(outTime),
        reason,
      });
      if (res.success) {
        Alert.alert('Submitted', `${res.message}\nDoc: ${res.docNo}`);
        setAttendDate('');
        setInTime('');
        setOutTime('');
        setReason('');
        load();
      }
    } catch (error: any) {
      Alert.alert('Error', error.message);
    } finally {
      setSubmitting(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    load();
  };

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
          <Text style={styles.headerTitle}>Adjustment</Text>
          <Text style={styles.headerSubtitle}>Fix missed or wrong punches</Text>
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
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>New request</Text>

            {/* Type cards */}
            <Text style={styles.fieldLabel}>Type</Text>
            <View style={styles.typeGrid}>
              {TYPES.map((t) => {
                const active = type === t.value;
                return (
                  <KineticPressable
                    key={t.value}
                    style={[styles.typeCard, active && styles.typeCardActive]}
                    onPress={() => setType(t.value)}
                    accessibilityState={{ selected: active }}
                  >
                    <Text
                      style={[styles.typeCardTitle, active && styles.typeCardTitleActive]}
                    >
                      {t.label}
                    </Text>
                    <Text
                      style={[styles.typeCardHint, active && styles.typeCardHintActive]}
                      numberOfLines={2}
                    >
                      {t.hint}
                    </Text>
                  </KineticPressable>
                );
              })}
            </View>

            <Field label="Attendance date">
              <TextInput
                style={[
                  styles.input,
                  focusedField === 'date' && styles.inputFocused,
                ]}
                value={attendDate}
                onChangeText={setAttendDate}
                placeholder="YYYY-MM-DD"
                placeholderTextColor={palette.inkSoft}
                onFocus={() => setFocusedField('date')}
                onBlur={() => setFocusedField(null)}
              />
            </Field>

            <View style={styles.rowFields}>
              <Field label="In time" style={{ flex: 1 }}>
                <TextInput
                  style={[
                    styles.input,
                    focusedField === 'in' && styles.inputFocused,
                  ]}
                  value={inTime}
                  onChangeText={setInTime}
                  placeholder="09:30"
                  placeholderTextColor={palette.inkSoft}
                  onFocus={() => setFocusedField('in')}
                  onBlur={() => setFocusedField(null)}
                />
              </Field>
              <Field label="Out time" style={{ flex: 1 }}>
                <TextInput
                  style={[
                    styles.input,
                    focusedField === 'out' && styles.inputFocused,
                  ]}
                  value={outTime}
                  onChangeText={setOutTime}
                  placeholder="18:30"
                  placeholderTextColor={palette.inkSoft}
                  onFocus={() => setFocusedField('out')}
                  onBlur={() => setFocusedField(null)}
                />
              </Field>
            </View>

            <Field label="Reason">
              <TextInput
                style={[
                  styles.input,
                  styles.textarea,
                  focusedField === 'reason' && styles.inputFocused,
                ]}
                value={reason}
                onChangeText={setReason}
                placeholder="Why does this need to be adjusted?"
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
              accessibilityLabel="Submit adjustment request"
            >
              {submitting ? (
                <ActivityIndicator color={palette.inkInverse} />
              ) : (
                <Text style={styles.submitButtonText}>Submit request</Text>
              )}
            </KineticPressable>
          </View>

          {/* My adjustments */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionLabel}>My requests</Text>
              <Text style={styles.sectionCount}>{myList.length}</Text>
            </View>

            {loading && !refreshing ? (
              <ActivityIndicator color={palette.brandDeep} />
            ) : myList.length === 0 ? (
              <View style={styles.emptyCard}>
                <Text style={styles.emptyGlyph}>∅</Text>
                <Text style={styles.emptyText}>No adjustment requests yet</Text>
              </View>
            ) : (
              myList.map((adj) => <AdjustmentCard key={adj.id} adj={adj} />)
            )}
          </View>

          <View style={{ height: spacing['4xl'] }} />
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
};

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
  Pending: { bg: palette.warningSoft, ink: palette.warningInk },
  Approved: { bg: palette.successSoft, ink: palette.successInk },
  Rejected: { bg: palette.dangerSoft, ink: palette.dangerInk },
};

const formatTime = (iso: string | null): string => {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
};

const AdjustmentCard: React.FC<{ adj: AdjustmentRequest }> = ({ adj }) => {
  const s = STATUS_THEME[adj.status];
  return (
    <View style={styles.adjCard}>
      <View style={styles.adjCardTop}>
        <View style={styles.docChip}>
          <Text style={styles.docChipText}>{adj.doc_no}</Text>
        </View>
        <Text style={styles.adjType}>{adj.type}</Text>
        <View style={[styles.statusPill, { backgroundColor: s.bg }]}>
          <Text style={[styles.statusPillText, { color: s.ink }]}>{adj.status}</Text>
        </View>
      </View>

      <View style={styles.metaRow}>
        <Text style={styles.metaLabel}>Date</Text>
        <Text style={styles.metaValue}>
          {adj.attendence_date ? adj.attendence_date.split('T')[0] : '—'}
        </Text>
      </View>
      <View style={styles.metaRow}>
        <Text style={styles.metaLabel}>Hours</Text>
        <Text style={styles.metaValue}>
          {formatTime(adj.in_time)} → {formatTime(adj.out_time)}
        </Text>
      </View>
      <View style={styles.metaRow}>
        <Text style={styles.metaLabel}>Reason</Text>
        <Text style={styles.metaValue} numberOfLines={3}>
          {adj.reason}
        </Text>
      </View>

      {adj.manager_comment && (
        <View style={styles.metaRow}>
          <Text style={styles.metaLabel}>Manager</Text>
          <Text style={styles.metaValue} numberOfLines={3}>
            {adj.manager_comment}
          </Text>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: palette.canvas },

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

  // Type grid
  typeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
    marginBottom: spacing.lg,
  },
  typeCard: {
    flexBasis: '47%',
    flexGrow: 1,
    backgroundColor: palette.surface,
    borderRadius: radii.md,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: palette.borderHairline,
    ...elevation.level1,
  },
  typeCardActive: {
    backgroundColor: palette.brandSoft,
    borderColor: palette.brandDeep,
    borderWidth: 1.5,
  },
  typeCardTitle: {
    ...typography.bodyEmphasis,
    color: palette.inkStrong,
  },
  typeCardTitleActive: { color: palette.brandInk },
  typeCardHint: {
    ...typography.caption,
    color: palette.inkMuted,
    marginTop: 2,
  },
  typeCardHintActive: { color: palette.brandInk, opacity: 0.85 },

  fieldWrapper: { marginBottom: spacing.lg },
  fieldLabel: {
    ...typography.caption,
    color: palette.inkMuted,
    marginBottom: spacing.sm,
    letterSpacing: 0.3,
  },
  rowFields: { flexDirection: 'row', gap: spacing.md },

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

  // My adjustments
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

  adjCard: {
    backgroundColor: palette.surface,
    borderRadius: radii.lg,
    padding: spacing.lg,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: palette.borderHairline,
    ...elevation.level1,
  },
  adjCardTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  docChip: {
    backgroundColor: palette.canvasAlt,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radii.xs,
  },
  docChipText: {
    ...typography.overline,
    color: palette.brandDeep,
    fontSize: 10,
  },
  adjType: {
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
  metaRow: {
    flexDirection: 'row',
    paddingVertical: spacing.xs,
    gap: spacing.md,
  },
  metaLabel: {
    ...typography.caption,
    color: palette.inkMuted,
    minWidth: 70,
  },
  metaValue: {
    ...typography.body,
    color: palette.inkBase,
    flex: 1,
  },
});
