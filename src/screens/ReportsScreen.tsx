import React, { useState, useCallback, useMemo } from 'react';
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
import { RouteProp, useFocusEffect } from '@react-navigation/native';
import { RootStackParamList, ReportItem } from '../types';
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
  navigation: NativeStackNavigationProp<RootStackParamList, 'Reports'>;
  route: RouteProp<RootStackParamList, 'Reports'>;
};

const ALL_CATEGORY = 'All';

const CATEGORY_TINT: Record<string, { bg: string; ink: string }> = {
  Attendance: { bg: palette.brandSoft, ink: palette.brandInk },
  Payroll: { bg: palette.successSoft, ink: palette.successInk },
  Leave: { bg: palette.warningSoft, ink: palette.warningInk },
  Asset: { bg: palette.dangerSoft, ink: palette.dangerInk },
  Other: { bg: palette.canvasAlt, ink: palette.inkBase },
};

export const ReportsScreen: React.FC<Props> = ({ navigation, route }) => {
  const { token } = route.params;

  const [reports, setReports] = useState<ReportItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [categoryFilter, setCategoryFilter] = useState<string>(ALL_CATEGORY);

  const load = async () => {
    try {
      const res = await api.getReports(token);
      if (res.success) setReports(res.reports);
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

  // Distinct categories from the result set
  const categories = useMemo(() => {
    const set = new Set<string>([ALL_CATEGORY]);
    reports.forEach((r) => {
      if (r.category) set.add(r.category);
    });
    return Array.from(set);
  }, [reports]);

  const filteredReports = useMemo(() => {
    if (categoryFilter === ALL_CATEGORY) return reports;
    return reports.filter((r) => r.category === categoryFilter);
  }, [reports, categoryFilter]);

  const handleOpenReport = (r: ReportItem) => {
    // Reports themselves live in the DevExpress web layout — we just
    // surface a friendly message until the on-device viewer ships.
    Alert.alert(
      r.name,
      r.description ||
        'Reports are currently rendered in the web portal.\nOpen the desktop app to view this report.',
      [{ text: 'OK' }],
    );
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
          <Text style={styles.headerTitle}>Reports</Text>
          <Text style={styles.headerSubtitle}>Customised report list</Text>
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
        {/* Category chip row */}
        {categories.length > 1 && (
          <View style={styles.filterRow}>
            {categories.map((c) => {
              const active = categoryFilter === c;
              return (
                <KineticPressable
                  key={c}
                  style={[styles.filterChip, active && styles.filterChipActive]}
                  onPress={() => setCategoryFilter(c)}
                  accessibilityState={{ selected: active }}
                >
                  <Text
                    style={[styles.filterChipText, active && styles.filterChipTextActive]}
                  >
                    {c}
                  </Text>
                </KineticPressable>
              );
            })}
          </View>
        )}

        {loading && !refreshing ? (
          <View style={styles.loadingState}>
            <ActivityIndicator size="large" color={palette.brandDeep} />
            <Text style={styles.loadingText}>Loading reports…</Text>
          </View>
        ) : filteredReports.length === 0 ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyGlyph}>∅</Text>
            <Text style={styles.emptyText}>No reports in this category</Text>
          </View>
        ) : (
          filteredReports.map((r) => {
            const cat = r.category || 'Other';
            const tint = CATEGORY_TINT[cat] || CATEGORY_TINT.Other;
            return (
              <KineticPressable
                key={r.id}
                style={styles.reportCard}
                onPress={() => handleOpenReport(r)}
                accessibilityLabel={`Open report ${r.name}`}
              >
                <View style={[styles.reportIcon, { backgroundColor: tint.bg }]}>
                  <Text style={[styles.reportIconText, { color: tint.ink }]}>≡</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.reportName} numberOfLines={1}>{r.name}</Text>
                  {r.description && (
                    <Text style={styles.reportDesc} numberOfLines={2}>{r.description}</Text>
                  )}
                  {cat && (
                    <View style={[styles.categoryPill, { backgroundColor: tint.bg }]}>
                      <Text style={[styles.categoryPillText, { color: tint.ink }]}>
                        {cat.toUpperCase()}
                      </Text>
                    </View>
                  )}
                </View>
                <Text style={styles.reportChevron}>›</Text>
              </KineticPressable>
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

  // Report card
  reportCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: palette.surface,
    borderRadius: radii.lg,
    padding: spacing.md,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: palette.borderHairline,
    ...elevation.level1,
  },
  reportIcon: {
    width: 48, height: 48,
    borderRadius: radii.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  reportIconText: {
    fontSize: 22,
    fontWeight: '700',
  },
  reportName: {
    ...typography.subtitle,
    color: palette.inkStrong,
  },
  reportDesc: {
    ...typography.caption,
    color: palette.inkMuted,
    marginTop: 2,
  },
  categoryPill: {
    alignSelf: 'flex-start',
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radii.xs,
    marginTop: spacing.xs,
  },
  categoryPillText: {
    ...typography.overline,
    fontSize: 9,
    letterSpacing: 0.8,
  },
  reportChevron: {
    fontSize: 22,
    color: palette.brandDeep,
    fontWeight: '600',
    marginTop: -2,
  },
});
