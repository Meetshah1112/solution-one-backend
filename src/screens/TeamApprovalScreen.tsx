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
import { RootStackParamList, TeamApproval } from '../types';
import { api } from '../services/api';
import {
  palette,
  spacing,
  radii,
  typography,
  elevation,
  KineticPressable,
} from '../theme';

/* ────────────────────────────────────────────────────────────────────────────
 * TeamApprovalScreen — the senior's approval queue.
 *
 * Mirrors the web portal's Authorize screen: shows leave applications whose
 * ACTIVE approval level points at the logged-in employee. Approving forwards
 * the request up the reporting chain (or finalizes it at the last level);
 * rejecting kills it immediately.
 * ──────────────────────────────────────────────────────────────────────────── */

type Props = {
  navigation: NativeStackNavigationProp<RootStackParamList, 'TeamApprovals'>;
  route: RouteProp<RootStackParamList, 'TeamApprovals'>;
};

const fmtDate = (iso: string): string => {
  if (!iso) return '—';
  const d = new Date(iso);
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
};

export const TeamApprovalScreen: React.FC<Props> = ({ navigation, route }) => {
  const { token } = route.params;

  const [items, setItems] = useState<TeamApproval[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Decision modal state
  const [showDecide, setShowDecide] = useState(false);
  const [target, setTarget] = useState<TeamApproval | null>(null);
  const [decision, setDecision] = useState<'Approved' | 'Rejected'>('Approved');
  const [comment, setComment] = useState('');
  const [deciding, setDeciding] = useState(false);

  const load = async () => {
    try {
      const res = await api.getTeamApprovals(token);
      if (res.success) setItems(res.approvals);
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

  const onRefresh = () => {
    setRefreshing(true);
    load();
  };

  const openModal = (item: TeamApproval, dec: 'Approved' | 'Rejected') => {
    setTarget(item);
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
      const res = await api.decideTeamApproval(token, target.auth_id, decision, comment);
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
          <Text style={styles.headerTitle}>Team approvals</Text>
          <Text style={styles.headerSubtitle}>Leave requests awaiting your decision</Text>
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
        {loading && !refreshing ? (
          <View style={styles.loadingState}>
            <ActivityIndicator size="large" color={palette.brandDeep} />
            <Text style={styles.loadingText}>Loading…</Text>
          </View>
        ) : items.length === 0 ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyGlyph}>✓</Text>
            <Text style={styles.emptyText}>Nothing awaiting your approval</Text>
            <Text style={styles.emptyHint}>
              Requests from your team appear here when it's your turn to decide.
            </Text>
          </View>
        ) : (
          items.map((it) => (
            <View key={it.auth_id} style={styles.card}>
              <View style={styles.cardTop}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.cardName}>{it.employee_name}</Text>
                  <Text style={styles.cardMeta}>
                    {it.leave_name} · {it.days} {Number(it.days) === 1 ? 'day' : 'days'} · {it.day_type}
                  </Text>
                </View>
                <View style={styles.levelPill}>
                  <Text style={styles.levelPillText}>LEVEL {it.level}</Text>
                </View>
              </View>

              <View style={styles.dateRange}>
                <Text style={styles.dateRangeText}>
                  {fmtDate(it.from_date)}  →  {fmtDate(it.to_date)}
                </Text>
              </View>

              {it.reason ? (
                <View style={styles.metaRow}>
                  <Text style={styles.metaLabel}>Reason</Text>
                  <Text style={styles.metaValue} numberOfLines={3}>{it.reason}</Text>
                </View>
              ) : null}

              <View style={styles.actionsRow}>
                <KineticPressable
                  style={[styles.actionBtn, styles.rejectBtn]}
                  onPress={() => openModal(it, 'Rejected')}
                  accessibilityLabel="Reject"
                >
                  <Text style={styles.rejectBtnText}>Reject</Text>
                </KineticPressable>
                <KineticPressable
                  style={[styles.actionBtn, styles.approveBtn]}
                  onPress={() => openModal(it, 'Approved')}
                  accessibilityLabel="Approve"
                >
                  <Text style={styles.approveBtnText}>Approve</Text>
                </KineticPressable>
              </View>
            </View>
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
              {decision === 'Approved' ? 'Approve request' : 'Reject request'}
            </Text>
            {target && (
              <Text style={styles.modalSubtitle}>
                {target.employee_name} · {target.leave_name} · {fmtDate(target.from_date)} → {fmtDate(target.to_date)}
              </Text>
            )}

            <Text style={styles.fieldLabel}>
              {decision === 'Approved' ? 'Comment (optional)' : 'Reason'}
            </Text>
            <TextInput
              style={[styles.input, styles.textarea]}
              value={comment}
              onChangeText={setComment}
              placeholder={decision === 'Approved' ? 'Add a note…' : 'Why is this rejected?'}
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
    ...elevation.level1,
  },
  emptyGlyph: { fontSize: 36, color: palette.successDeep },
  emptyText: { ...typography.subtitle, color: palette.inkBase },
  emptyHint: {
    ...typography.caption,
    color: palette.inkMuted,
    textAlign: 'center',
  },

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
  cardName: { ...typography.subtitle, color: palette.inkStrong },
  cardMeta: { ...typography.caption, color: palette.inkMuted, marginTop: 2 },
  levelPill: {
    backgroundColor: palette.brandSoft,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radii.pill,
  },
  levelPillText: {
    ...typography.overline,
    color: palette.brandInk,
    letterSpacing: 0.6,
  },
  dateRange: {
    backgroundColor: palette.canvasAlt,
    borderRadius: radii.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    marginBottom: spacing.sm,
  },
  dateRangeText: { ...typography.bodyEmphasis, color: palette.inkBase },
  metaRow: {
    flexDirection: 'row',
    paddingVertical: spacing.xs,
    gap: spacing.md,
  },
  metaLabel: { ...typography.caption, color: palette.inkMuted, minWidth: 70 },
  metaValue: { ...typography.body, color: palette.inkBase, flex: 1 },

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

  // Modal
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
  textarea: { minHeight: 96, textAlignVertical: 'top' },
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
