import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  StatusBar,
  ScrollView,
  Alert,
  ActivityIndicator,
  Modal,
  TextInput,
  RefreshControl,
} from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RouteProp, useFocusEffect } from '@react-navigation/native';
import { RootStackParamList, LeaveRequest, LeaveStatus } from '../types';
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
  navigation: NativeStackNavigationProp<RootStackParamList, 'LeaveApproval'>;
  route: RouteProp<RootStackParamList, 'LeaveApproval'>;
};

const FILTERS: { label: string; value: LeaveStatus | 'All' }[] = [
  { label: 'Pending', value: 'Pending' },
  { label: 'Approved', value: 'Approved' },
  { label: 'Rejected', value: 'Rejected' },
  { label: 'All', value: 'All' },
];

export const LeaveApprovalScreen: React.FC<Props> = ({ navigation, route }) => {
  const { token } = route.params;

  const [leaves, setLeaves] = useState<LeaveRequest[]>([]);
  const [statusFilter, setStatusFilter] = useState<LeaveStatus | 'All'>('Pending');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Decision modal state
  const [showDecide, setShowDecide] = useState(false);
  const [target, setTarget] = useState<LeaveRequest | null>(null);
  const [decision, setDecision] = useState<'Approved' | 'Rejected'>('Approved');
  const [comment, setComment] = useState('');
  const [deciding, setDeciding] = useState(false);

  const load = async () => {
    try {
      const res = await api.getPendingLeaves(token, statusFilter);
      if (res.success) setLeaves(res.leaves);
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
    }, [statusFilter]),
  );

  const onRefresh = () => {
    setRefreshing(true);
    load();
  };

  const openDecideModal = (leave: LeaveRequest, dec: 'Approved' | 'Rejected') => {
    setTarget(leave);
    setDecision(dec);
    setComment('');
    setShowDecide(true);
  };

  const confirmDecision = async () => {
    if (!target) return;
    if (decision === 'Rejected' && !comment.trim()) {
      Alert.alert('Reason required', 'Please add a comment when rejecting.');
      return;
    }
    setDeciding(true);
    try {
      const res = await api.decideLeave(token, target.id, decision, comment);
      if (res.success) {
        Alert.alert('Done', res.message);
        setShowDecide(false);
        load();
      }
    } catch (error: any) {
      Alert.alert('Error', error.message);
    } finally {
      setDeciding(false);
    }
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
          <Text style={styles.headerTitle}>Leave approvals</Text>
          <Text style={styles.headerSubtitle}>Review and decide requests</Text>
        </View>
      </View>

      <ScrollView
        style={styles.content}
        contentContainerStyle={styles.contentInner}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={palette.brandDeep} />
        }
      >
        {/* Filter chips */}
        <View style={styles.filterRow}>
          {FILTERS.map((f) => {
            const active = statusFilter === f.value;
            return (
              <KineticPressable
                key={f.value}
                style={[styles.filterChip, active && styles.filterChipActive]}
                onPress={() => setStatusFilter(f.value)}
                accessibilityState={{ selected: active }}
              >
                <Text
                  style={[styles.filterChipText, active && styles.filterChipTextActive]}
                >
                  {f.label}
                </Text>
              </KineticPressable>
            );
          })}
        </View>

        {/* List */}
        {loading && !refreshing ? (
          <View style={styles.loadingState}>
            <ActivityIndicator size="large" color={palette.brandDeep} />
            <Text style={styles.loadingText}>Loading…</Text>
          </View>
        ) : leaves.length === 0 ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyGlyph}>∅</Text>
            <Text style={styles.emptyText}>No requests in this filter</Text>
          </View>
        ) : (
          leaves.map((lv) => (
            <ApprovalCard
              key={lv.id}
              leave={lv}
              onApprove={() => openDecideModal(lv, 'Approved')}
              onReject={() => openDecideModal(lv, 'Rejected')}
            />
          ))
        )}

        <View style={{ height: spacing['4xl'] }} />
      </ScrollView>

      {/* Decision modal */}
      <Modal
        visible={showDecide}
        transparent
        animationType="fade"
        onRequestClose={() => !deciding && setShowDecide(false)}
      >
        <View style={styles.modalScrim}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>
              {decision === 'Approved' ? 'Approve leave' : 'Reject leave'}
            </Text>
            {target && (
              <Text style={styles.modalSubtitle}>
                {target.employee_name} · {target.leave_code} · {target.from_date} → {target.to_date}
              </Text>
            )}

            <Text style={styles.fieldLabel}>
              {decision === 'Approved' ? 'Comment (optional)' : 'Reason'}
            </Text>
            <TextInput
              style={[styles.input, styles.textarea]}
              value={comment}
              onChangeText={setComment}
              placeholder={decision === 'Approved' ? 'Add a note for the employee…' : 'Why is this rejected?'}
              placeholderTextColor={palette.inkSoft}
              multiline
              numberOfLines={4}
              autoFocus
              editable={!deciding}
            />

            <KineticPressable
              style={[
                styles.modalConfirmBtn,
                {
                  backgroundColor:
                    decision === 'Approved' ? palette.successBase : palette.dangerBase,
                },
                deciding && { opacity: 0.55 },
              ]}
              onPress={confirmDecision}
              disabled={deciding}
            >
              {deciding ? (
                <ActivityIndicator color={palette.inkInverse} />
              ) : (
                <Text style={styles.modalConfirmText}>
                  {decision === 'Approved' ? 'Confirm approval' : 'Confirm rejection'}
                </Text>
              )}
            </KineticPressable>

            <KineticPressable
              style={styles.modalCancelBtn}
              onPress={() => !deciding && setShowDecide(false)}
              disabled={deciding}
            >
              <Text style={styles.modalCancelText}>Cancel</Text>
            </KineticPressable>
          </View>
        </View>
      </Modal>
    </View>
  );
};

const STATUS_THEME = {
  Pending: { bg: palette.warningSoft, ink: palette.warningInk },
  Approved: { bg: palette.successSoft, ink: palette.successInk },
  Rejected: { bg: palette.dangerSoft, ink: palette.dangerInk },
  Cancelled: { bg: palette.canvasAlt, ink: palette.inkMuted },
};

const ApprovalCard: React.FC<{
  leave: LeaveRequest;
  onApprove: () => void;
  onReject: () => void;
}> = ({ leave, onApprove, onReject }) => {
  const s = STATUS_THEME[leave.status];
  return (
    <View style={styles.card}>
      <View style={styles.cardTop}>
        <View style={{ flex: 1 }}>
          <Text style={styles.cardName}>{leave.employee_name}</Text>
          <Text style={styles.cardMeta}>
            {leave.leave_code} · {leave.days} {leave.days === 1 ? 'day' : 'days'} · {leave.day_type}
          </Text>
        </View>
        <View style={[styles.statusPill, { backgroundColor: s.bg }]}>
          <Text style={[styles.statusPillText, { color: s.ink }]}>{leave.status}</Text>
        </View>
      </View>

      <View style={styles.dateRange}>
        <Text style={styles.dateRangeText}>
          {leave.from_date}  →  {leave.to_date}
        </Text>
      </View>

      {leave.reason && (
        <View style={styles.metaRow}>
          <Text style={styles.metaLabel}>Reason</Text>
          <Text style={styles.metaValue} numberOfLines={3}>
            {leave.reason}
          </Text>
        </View>
      )}

      {leave.approver_comment && leave.status !== 'Pending' && (
        <View style={styles.metaRow}>
          <Text style={styles.metaLabel}>You said</Text>
          <Text style={styles.metaValue} numberOfLines={3}>
            {leave.approver_comment}
          </Text>
        </View>
      )}

      {leave.status === 'Pending' && (
        <View style={styles.actionsRow}>
          <KineticPressable
            style={[styles.actionBtn, styles.rejectBtn]}
            onPress={onReject}
            accessibilityLabel="Reject"
          >
            <Text style={styles.rejectBtnText}>Reject</Text>
          </KineticPressable>
          <KineticPressable
            style={[styles.actionBtn, styles.approveBtn]}
            onPress={onApprove}
            accessibilityLabel="Approve"
          >
            <Text style={styles.approveBtnText}>Approve</Text>
          </KineticPressable>
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

  filterRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginBottom: spacing.xl,
  },
  filterChip: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: radii.pill,
    backgroundColor: palette.surface,
    borderWidth: 1,
    borderColor: palette.borderHairline,
  },
  filterChipActive: {
    backgroundColor: palette.brandDeep,
    borderColor: palette.brandDeep,
  },
  filterChipText: { ...typography.button, color: palette.inkBase },
  filterChipTextActive: { color: palette.inkInverse },

  loadingState: { alignItems: 'center', paddingVertical: spacing['3xl'], gap: spacing.md },
  loadingText: { ...typography.caption, color: palette.inkMuted },
  emptyCard: {
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

  // Card
  card: {
    backgroundColor: palette.surface,
    borderRadius: radii.lg,
    padding: spacing.lg,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: palette.borderHairline,
    ...elevation.level1,
  },
  cardTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
    marginBottom: spacing.sm,
  },
  cardName: {
    ...typography.subtitle,
    color: palette.inkStrong,
  },
  cardMeta: {
    ...typography.caption,
    color: palette.inkMuted,
    marginTop: 2,
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

  dateRange: {
    backgroundColor: palette.canvasAlt,
    borderRadius: radii.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    marginBottom: spacing.sm,
  },
  dateRangeText: {
    ...typography.bodyEmphasis,
    color: palette.inkBase,
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

  actionsRow: {
    flexDirection: 'row',
    gap: spacing.md,
    marginTop: spacing.md,
  },
  actionBtn: {
    flex: 1,
    paddingVertical: spacing.md,
    borderRadius: radii.md,
    alignItems: 'center',
    ...elevation.level1,
  },
  approveBtn: { backgroundColor: palette.successBase },
  rejectBtn: {
    backgroundColor: palette.dangerSoft,
    borderWidth: 1,
    borderColor: palette.dangerBase,
  },
  approveBtnText: { ...typography.buttonLarge, color: palette.inkInverse },
  rejectBtnText: { ...typography.buttonLarge, color: palette.dangerInk },

  // Decision modal
  modalScrim: {
    flex: 1,
    backgroundColor: palette.scrim,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.xl,
  },
  modalCard: {
    backgroundColor: palette.surfaceElevated,
    borderRadius: radii.xl,
    padding: spacing.xl,
    width: '100%',
    maxWidth: 420,
    ...elevation.level4,
  },
  modalTitle: {
    ...typography.headline,
    color: palette.inkStrong,
    marginBottom: spacing.sm,
  },
  modalSubtitle: {
    ...typography.caption,
    color: palette.inkMuted,
    marginBottom: spacing.lg,
  },
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
    marginBottom: spacing.lg,
  },
  textarea: {
    minHeight: 96,
    textAlignVertical: 'top',
  },
  modalConfirmBtn: {
    borderRadius: radii.md,
    paddingVertical: spacing.md,
    alignItems: 'center',
    marginBottom: spacing.sm,
    ...elevation.level2,
  },
  modalConfirmText: { ...typography.buttonLarge, color: palette.inkInverse },
  modalCancelBtn: {
    backgroundColor: palette.canvasAlt,
    borderRadius: radii.md,
    paddingVertical: spacing.md,
    alignItems: 'center',
  },
  modalCancelText: { ...typography.button, color: palette.inkBase },
});
