import React, { useState, useCallback } from 'react';
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
import { RootStackParamList, SalaryMonth } from '../types';
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
  navigation: NativeStackNavigationProp<RootStackParamList, 'SalarySlipList'>;
  route: RouteProp<RootStackParamList, 'SalarySlipList'>;
};

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

export const SalarySlipListScreen: React.FC<Props> = ({ navigation, route }) => {
  const { user, token } = route.params;

  const [months, setMonths] = useState<SalaryMonth[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = async () => {
    try {
      const res = await api.getSalaryMonths(token);
      if (res.success) setMonths(res.months);
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
          <Text style={styles.headerTitle}>Salary slips</Text>
          <Text style={styles.headerSubtitle}>Pick a month to view & download</Text>
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
            <Text style={styles.loadingText}>Loading slips…</Text>
          </View>
        ) : months.length === 0 ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyGlyph}>∅</Text>
            <Text style={styles.emptyText}>No salary slips available yet</Text>
            <Text style={styles.emptyHint}>
              Slips appear here once the payroll for the month is finalised.
            </Text>
          </View>
        ) : (
          months.map((m) => (
            <KineticPressable
              key={m.id}
              style={styles.monthCard}
              onPress={() =>
                navigation.navigate('SalarySlipDetail', { user, token, slipId: m.id })
              }
              accessibilityLabel={`View slip for ${MONTHS[m.month - 1]} ${m.year}`}
            >
              <View style={styles.monthIconWrap}>
                <Text style={styles.monthIcon}>₹</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.monthTitle}>
                  {MONTHS[m.month - 1]} {m.year}
                </Text>
                <Text style={styles.monthSubtitle}>
                  Net pay  ·  ₹{Number(m.net_pay).toLocaleString('en-IN', { maximumFractionDigits: 2 })}
                </Text>
              </View>
              <Text style={styles.monthChevron}>›</Text>
            </KineticPressable>
          ))
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
  emptyGlyph: { fontSize: 36, color: palette.inkSoft },
  emptyText: { ...typography.subtitle, color: palette.inkBase },
  emptyHint: {
    ...typography.caption,
    color: palette.inkMuted,
    textAlign: 'center',
  },

  // Month card
  monthCard: {
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
  monthIconWrap: {
    width: 48, height: 48,
    borderRadius: radii.md,
    backgroundColor: palette.brandSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  monthIcon: {
    fontSize: 24,
    color: palette.brandDeep,
    fontWeight: '700',
  },
  monthTitle: {
    ...typography.subtitle,
    color: palette.inkStrong,
  },
  monthSubtitle: {
    ...typography.caption,
    color: palette.inkMuted,
    marginTop: 2,
  },
  monthChevron: {
    fontSize: 22,
    color: palette.brandDeep,
    fontWeight: '600',
    marginTop: -2,
  },
});
