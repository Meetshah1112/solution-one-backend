import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  StatusBar,
  ScrollView,
  ActivityIndicator,
  Alert,
  RefreshControl,
} from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RouteProp } from '@react-navigation/native';
import { RootStackParamList } from '../types';
import { api } from '../services/api';
import {
  palette,
  spacing,
  radii,
  typography,
  elevation,
  KineticPressable,
} from '../theme';

type AttendanceHistoryProps = {
  navigation: NativeStackNavigationProp<RootStackParamList, 'AttendanceHistory'>;
  route: RouteProp<RootStackParamList, 'AttendanceHistory'>;
};

// Single source of truth for the day-range chips — easier to extend later
const DAY_FILTERS = [7, 15, 30, 60, 90] as const;

export const AttendanceHistoryScreen: React.FC<AttendanceHistoryProps> = ({
  navigation,
  route,
}) => {
  const { user, token } = route.params;
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [records, setRecords] = useState<any[]>([]);
  const [daysFilter, setDaysFilter] = useState<number>(30);

  useEffect(() => { loadHistory(); }, [daysFilter]);

  const loadHistory = async () => {
    try {
      setLoading(true);
      const response = await api.getAttendanceHistory(token, daysFilter);
      if (response.success) setRecords(response.records);
    } catch (error: any) {
      Alert.alert('Error', 'Failed to load attendance history: ' + error.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    loadHistory();
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const formatTime = (dateTime: string) => {
    if (!dateTime) return 'N/A';
    const date = new Date(dateTime);
    return date.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    });
  };

  if (loading && !refreshing) {
    return (
      <View style={[styles.container, styles.centerContent]}>
        <StatusBar barStyle="light-content" backgroundColor={palette.brandDeep} />
        <ActivityIndicator size="large" color={palette.brandDeep} />
        <Text style={styles.loadingText}>Loading history…</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={palette.brandDeep} />

      {/* ╭───── Header with back arrow ─────╮ */}
      <View style={styles.header}>
        <KineticPressable
          style={styles.backButton}
          onPress={() => navigation.goBack()}
          accessibilityLabel="Go back"
        >
          <Text style={styles.backIcon}>←</Text>
        </KineticPressable>
        <View style={styles.headerInfo}>
          <Text style={styles.headerTitle}>My attendance</Text>
          <Text style={styles.headerSubtitle}>{user.name}</Text>
        </View>
      </View>

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
        {/* ╭───── Filter chip row ─────╮
            Pill-shaped chips with a subtle "selected" state — no thick borders */}
        <View style={styles.filterRow}>
          {DAY_FILTERS.map((days) => {
            const isActive = daysFilter === days;
            return (
              <KineticPressable
                key={days}
                style={[styles.filterChip, isActive && styles.filterChipActive]}
                onPress={() => setDaysFilter(days)}
                accessibilityLabel={`Last ${days} days`}
                accessibilityState={{ selected: isActive }}
              >
                <Text
                  style={[
                    styles.filterChipText,
                    isActive && styles.filterChipTextActive,
                  ]}
                >
                  {days}d
                </Text>
              </KineticPressable>
            );
          })}
        </View>

        {/* ╭───── Records section ─────╮ */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionLabel}>Records</Text>
          <Text style={styles.sectionCount}>{records.length}</Text>
        </View>

        {records.length === 0 ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyGlyph}>∅</Text>
            <Text style={styles.emptyText}>No records in this range</Text>
          </View>
        ) : (
          records.map((record: any) => (
            <View key={record.id} style={styles.recordCard}>
              <View style={styles.recordHeader}>
                <Text style={styles.recordDate}>
                  {formatDate(record.attend_date)}
                </Text>
                <View style={styles.punchCountBadge}>
                  <Text style={styles.punchCountText}>
                    {record.punchCount} punch{record.punchCount !== 1 ? 'es' : ''}
                  </Text>
                </View>
              </View>

              {record.punches &&
                record.punches.map((p: any, idx: number) => (
                  <View
                    key={idx}
                    style={[
                      styles.punchRow,
                      // Strip the divider from the last row for a tidy bottom edge
                      idx === record.punches.length - 1 && styles.punchRowLast,
                    ]}
                  >
                    <View style={styles.punchIndexBadge}>
                      <Text style={styles.punchIndexText}>#{p.index}</Text>
                    </View>
                    <Text style={styles.punchTime}>{formatTime(p.time)}</Text>
                    {p.location && (
                      <Text
                        style={styles.punchLocation}
                        numberOfLines={1}
                      >
                        {p.location}
                      </Text>
                    )}
                  </View>
                ))}
            </View>
          ))
        )}
      </ScrollView>
    </View>
  );
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
  backIcon: {
    fontSize: 22,
    color: palette.inkInverse,
    fontWeight: '600',
    marginLeft: -1,
  },
  headerInfo: { flex: 1 },
  headerTitle: { ...typography.title, color: palette.inkInverse },
  headerSubtitle: {
    ...typography.caption,
    color: 'rgba(250, 250, 248, 0.78)',
    marginTop: 2,
  },

  // ── Body ─────────────────────────────────────────────────────────────────
  content: { flex: 1 },
  contentInner: {
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.xl,
    paddingBottom: spacing['4xl'],
  },

  // ── Filter chip row ──────────────────────────────────────────────────────
  filterRow: {
    flexDirection: 'row',
    justifyContent: 'center',
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
    ...elevation.level1,
  },
  filterChipActive: {
    backgroundColor: palette.brandDeep,
    borderColor: palette.brandDeep,
  },
  filterChipText: {
    ...typography.button,
    color: palette.inkBase,
  },
  filterChipTextActive: {
    color: palette.inkInverse,
  },

  // ── Section header ───────────────────────────────────────────────────────
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
  sectionCount: {
    ...typography.caption,
    color: palette.inkSoft,
    fontWeight: '700',
  },

  // ── Empty state ──────────────────────────────────────────────────────────
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

  // ── Record card ──────────────────────────────────────────────────────────
  recordCard: {
    backgroundColor: palette.surface,
    borderRadius: radii.lg,        // outer = 16
    padding: spacing.lg,            // padding = 16 → inner radius = 0
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: palette.borderHairline,
    ...elevation.level1,
  },
  recordHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  recordDate: {
    ...typography.bodyEmphasis,
    color: palette.inkStrong,
    flex: 1,
  },
  punchCountBadge: {
    backgroundColor: palette.brandSoft,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radii.pill,
  },
  punchCountText: {
    ...typography.caption,
    color: palette.brandInk,
    fontWeight: '700',
  },

  // ── Punch row inside record ──────────────────────────────────────────────
  punchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: palette.borderHairline,
  },
  punchRowLast: {
    borderBottomWidth: 0,
    paddingBottom: 0,
  },
  punchIndexBadge: {
    backgroundColor: palette.canvasAlt,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radii.xs,
    minWidth: 36,
    alignItems: 'center',
  },
  punchIndexText: {
    ...typography.caption,
    color: palette.brandDeep,
    fontWeight: '700',
  },
  punchTime: {
    ...typography.bodyEmphasis,
    color: palette.inkStrong,
    minWidth: 90,
  },
  punchLocation: {
    ...typography.caption,
    color: palette.inkMuted,
    flex: 1,
    fontFamily: 'monospace',
  },
});
