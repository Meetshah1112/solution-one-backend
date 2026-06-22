import React, { useState, useEffect, useCallback } from 'react';
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
import { RootStackParamList, Holiday } from '../types';
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
  navigation: NativeStackNavigationProp<RootStackParamList, 'HolidayList'>;
  route: RouteProp<RootStackParamList, 'HolidayList'>;
};

type Scope = 'upcoming' | 'all';

const MONTHS_SHORT = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
];

// Tint holiday types so the list reads at a glance.
const typeTint = (type: string): { bg: string; ink: string } => {
  const t = type.toLowerCase();
  if (t.includes('public') || t.includes('national')) {
    return { bg: palette.brandSoft, ink: palette.brandInk };
  }
  if (t.includes('festival')) {
    return { bg: palette.warningSoft, ink: palette.warningInk };
  }
  if (t.includes('optional') || t.includes('restricted')) {
    return { bg: palette.canvasAlt, ink: palette.inkBase };
  }
  return { bg: palette.successSoft, ink: palette.successInk };
};

const parseDate = (iso: string): Date => new Date(iso);

const daysUntil = (iso: string): number => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const d = parseDate(iso);
  d.setHours(0, 0, 0, 0);
  return Math.round((d.getTime() - today.getTime()) / 86400000);
};

export const HolidayListScreen: React.FC<Props> = ({ navigation, route }) => {
  const { token } = route.params;

  const [scope, setScope] = useState<Scope>('upcoming');
  const [holidays, setHolidays] = useState<Holiday[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await api.getHolidays(token, scope);
      if (res.success) setHolidays(res.holidays);
    } catch (error: any) {
      Alert.alert('Error', error.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [token, scope]);

  useEffect(() => {
    setLoading(true);
    load();
  }, [load]);

  const onRefresh = () => {
    setRefreshing(true);
    load();
  };

  // Format a "days until" label for the upcoming view.
  const countdownLabel = (iso: string): string | null => {
    const n = daysUntil(iso);
    if (n < 0) return null;
    if (n === 0) return 'Today';
    if (n === 1) return 'Tomorrow';
    if (n <= 30) return `in ${n} days`;
    return null;
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
          <Text style={styles.headerTitle}>Holidays</Text>
          <Text style={styles.headerSubtitle}>Company holiday calendar</Text>
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
        {/* Scope toggle */}
        <View style={styles.segmentRow}>
          {(['upcoming', 'all'] as Scope[]).map((s) => {
            const active = scope === s;
            return (
              <KineticPressable
                key={s}
                style={[styles.segment, active && styles.segmentActive]}
                onPress={() => setScope(s)}
                accessibilityState={{ selected: active }}
              >
                <Text style={[styles.segmentText, active && styles.segmentTextActive]}>
                  {s === 'upcoming' ? 'Upcoming' : `This year`}
                </Text>
              </KineticPressable>
            );
          })}
        </View>

        {loading && !refreshing ? (
          <View style={styles.loadingState}>
            <ActivityIndicator size="large" color={palette.brandDeep} />
            <Text style={styles.loadingText}>Loading holidays…</Text>
          </View>
        ) : holidays.length === 0 ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyGlyph}>🎉</Text>
            <Text style={styles.emptyText}>
              {scope === 'upcoming'
                ? 'No upcoming holidays scheduled'
                : 'No holidays found for this year'}
            </Text>
          </View>
        ) : (
          holidays.map((h) => {
            const d = parseDate(h.date);
            const tint = typeTint(h.type);
            const countdown = scope === 'upcoming' ? countdownLabel(h.date) : null;
            return (
              <View key={h.id} style={styles.holidayCard}>
                {/* Date block */}
                <View style={styles.dateBlock}>
                  <Text style={styles.dateDay}>{String(d.getDate()).padStart(2, '0')}</Text>
                  <Text style={styles.dateMonth}>{MONTHS_SHORT[d.getMonth()]}</Text>
                  <Text style={styles.dateYear}>{d.getFullYear()}</Text>
                </View>

                {/* Details */}
                <View style={styles.holidayInfo}>
                  <Text style={styles.holidayName} numberOfLines={2}>{h.name}</Text>
                  <View style={styles.holidayMetaRow}>
                    <Text style={styles.holidayWeekday}>
                      {d.toLocaleDateString('en-US', { weekday: 'long' })}
                    </Text>
                    {countdown && (
                      <View style={styles.countdownPill}>
                        <Text style={styles.countdownText}>{countdown}</Text>
                      </View>
                    )}
                  </View>
                  {h.type ? (
                    <View style={[styles.typePill, { backgroundColor: tint.bg }]}>
                      <Text style={[styles.typePillText, { color: tint.ink }]}>
                        {h.type.toUpperCase()}
                      </Text>
                    </View>
                  ) : null}
                </View>
              </View>
            );
          })
        )}

        <View style={{ height: spacing['4xl'] }} />
      </ScrollView>
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

  // Scope toggle
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
  segmentText: { ...typography.button, color: palette.inkBase },
  segmentTextActive: { color: palette.inkInverse },

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
  emptyGlyph: { fontSize: 36 },
  emptyText: { ...typography.body, color: palette.inkMuted, textAlign: 'center' },

  // Holiday card
  holidayCard: {
    flexDirection: 'row',
    backgroundColor: palette.surface,
    borderRadius: radii.lg,
    padding: spacing.md,
    marginBottom: spacing.md,
    gap: spacing.md,
    borderWidth: 1,
    borderColor: palette.borderHairline,
    ...elevation.level1,
  },
  // Calendar-style date block on the left
  dateBlock: {
    width: 60,
    backgroundColor: palette.brandSoft,
    borderRadius: radii.md,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.sm,
  },
  dateDay: {
    fontSize: 24,
    lineHeight: 28,
    fontWeight: '800',
    color: palette.brandDeep,
    letterSpacing: -0.5,
  },
  dateMonth: {
    ...typography.caption,
    color: palette.brandDeep,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  dateYear: {
    fontSize: 10,
    color: palette.inkMuted,
    marginTop: 1,
  },
  holidayInfo: {
    flex: 1,
    justifyContent: 'center',
    gap: 4,
  },
  holidayName: {
    ...typography.subtitle,
    color: palette.inkStrong,
  },
  holidayMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  holidayWeekday: {
    ...typography.caption,
    color: palette.inkMuted,
  },
  countdownPill: {
    backgroundColor: palette.successSoft,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radii.pill,
  },
  countdownText: {
    ...typography.caption,
    color: palette.successInk,
    fontWeight: '700',
    fontSize: 11,
  },
  typePill: {
    alignSelf: 'flex-start',
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radii.xs,
    marginTop: 2,
  },
  typePillText: {
    ...typography.overline,
    fontSize: 9,
    letterSpacing: 0.8,
  },
});
