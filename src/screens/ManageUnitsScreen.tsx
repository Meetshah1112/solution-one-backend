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
import { RootStackParamList, Unit } from '../types';
import { api } from '../services/api';
import {
  palette,
  spacing,
  radii,
  typography,
  elevation,
  KineticPressable,
} from '../theme';

type ManageUnitsProps = {
  navigation: NativeStackNavigationProp<RootStackParamList, 'ManageUnits'>;
  route: RouteProp<RootStackParamList, 'ManageUnits'>;
};

export const ManageUnitsScreen: React.FC<ManageUnitsProps> = ({
  navigation,
  route,
}) => {
  const { user, token } = route.params;

  // ─── Logic preserved verbatim ────────────────────────────────────────────
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [units, setUnits] = useState<Unit[]>([]);

  const loadUnits = async () => {
    try {
      const response = await api.getAdminUnits(token);
      if (response.success) setUnits(response.units);
    } catch (error: any) {
      Alert.alert('Error', 'Failed to load units: ' + error.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      loadUnits();
    }, [])
  );

  const onRefresh = () => {
    setRefreshing(true);
    loadUnits();
  };

  if (loading && !refreshing) {
    return (
      <View style={[styles.container, styles.centerContent]}>
        <StatusBar barStyle="light-content" backgroundColor={palette.brandDeep} />
        <ActivityIndicator size="large" color={palette.brandDeep} />
        <Text style={styles.loadingText}>Loading units…</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={palette.brandDeep} />

      {/* ╭───── Header ─────╮ */}
      <View style={styles.header}>
        <KineticPressable
          onPress={() => navigation.goBack()}
          style={styles.backButton}
          accessibilityLabel="Go back"
        >
          <Text style={styles.backIcon}>←</Text>
        </KineticPressable>
        <Text style={styles.headerTitle}>Manage units</Text>
        {/* Trailing spacer to balance back button optically */}
        <View style={styles.headerSpacer} />
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
        {/* ╭───── Add new unit CTA ─────╮ */}
        <KineticPressable
          style={styles.addButton}
          onPress={() => navigation.navigate('UnitForm', { user, token })}
          accessibilityLabel="Add new unit"
        >
          <View style={styles.addIconCircle}>
            <Text style={styles.addIconText}>＋</Text>
          </View>
          <Text style={styles.addButtonText}>Add new unit</Text>
        </KineticPressable>

        {/* ╭───── Count label ─────╮ */}
        <Text style={styles.countLabel}>
          {units.length} unit{units.length !== 1 ? 's' : ''} configured
        </Text>

        {/* ╭───── Unit list ─────╮ */}
        {units.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyGlyph}>∅</Text>
            <Text style={styles.emptyText}>
              No units yet. Tap "Add new unit" to create your first one.
            </Text>
          </View>
        ) : (
          units.map((unit) => (
            <View key={unit.id} style={styles.unitCard}>
              <View
                style={[
                  styles.unitGlyph,
                  unit.is_geofenced ? styles.unitGlyphGeo : styles.unitGlyphRemote,
                ]}
              >
                <Text
                  style={[
                    styles.unitGlyphText,
                    {
                      color: unit.is_geofenced
                        ? palette.brandDeep
                        : palette.warningDeep,
                    },
                  ]}
                >
                  {unit.is_geofenced ? '⌖' : '⌂'}
                </Text>
              </View>

              <View style={styles.unitInfo}>
                <Text style={styles.unitName} numberOfLines={1}>
                  {unit.name}
                </Text>
                <Text style={styles.unitCoords} numberOfLines={1}>
                  {unit.latitude !== null && unit.longitude !== null
                    ? `${unit.latitude}, ${unit.longitude}`
                    : '— · —'}
                </Text>
                <View
                  style={[
                    styles.geofencePill,
                    unit.is_geofenced ? styles.geofencePillOn : styles.geofencePillOff,
                  ]}
                >
                  <Text
                    style={[
                      styles.geofencePillText,
                      {
                        color: unit.is_geofenced
                          ? palette.successInk
                          : palette.warningInk,
                      },
                    ]}
                  >
                    {unit.is_geofenced ? 'GEOFENCED · 50 m' : 'WFH / FIELD'}
                  </Text>
                </View>
              </View>

              <KineticPressable
                style={styles.editButton}
                onPress={() =>
                  navigation.navigate('UnitForm', { user, token, unit })
                }
                accessibilityLabel={`Edit ${unit.name}`}
              >
                <Text style={styles.editButtonText}>Edit</Text>
              </KineticPressable>
            </View>
          ))
        )}

        <View style={{ height: spacing['4xl'] }} />
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
    paddingBottom: spacing.lg,
    paddingHorizontal: spacing.xl,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
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
  headerTitle: {
    ...typography.title,
    color: palette.inkInverse,
    flex: 1,
    textAlign: 'center',
  },
  headerSpacer: { width: 44 }, // matches backButton width for visual balance

  // ── Body ─────────────────────────────────────────────────────────────────
  content: { flex: 1 },
  contentInner: {
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.xl,
    paddingBottom: spacing.xl,
  },

  // ── Add button ───────────────────────────────────────────────────────────
  addButton: {
    backgroundColor: palette.successBase,
    borderRadius: radii.lg,           // 16 outer
    padding: spacing.md,              // 12 padding → inner circle radius = 4
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    marginBottom: spacing.xl,
    ...elevation.level3,
  },
  addIconCircle: {
    width: 36, height: 36,
    borderRadius: radii.pill,
    backgroundColor: 'rgba(250, 250, 248, 0.22)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(250, 250, 248, 0.28)',
  },
  addIconText: {
    fontSize: 22,
    color: palette.inkInverse,
    fontWeight: '700',
    // Optical centring: plus sign reads slightly low — nudge up 2px
    marginTop: -2,
  },
  addButtonText: {
    ...typography.buttonLarge,
    color: palette.inkInverse,
    flex: 1,
  },

  countLabel: {
    ...typography.overline,
    color: palette.inkMuted,
    marginBottom: spacing.md,
  },

  // ── Empty state ──────────────────────────────────────────────────────────
  emptyState: {
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
  emptyText: {
    ...typography.body,
    color: palette.inkMuted,
    textAlign: 'center',
  },

  // ── Unit card ────────────────────────────────────────────────────────────
  unitCard: {
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
  unitGlyph: {
    width: 48, height: 48,
    // Inner radius: 16 outer - 12 padding = 4
    borderRadius: radii.xs,
    alignItems: 'center',
    justifyContent: 'center',
  },
  unitGlyphGeo: { backgroundColor: palette.brandSoft },
  unitGlyphRemote: { backgroundColor: palette.warningSoft },
  unitGlyphText: { fontSize: 24 },

  unitInfo: { flex: 1, gap: 2 },
  unitName: {
    ...typography.subtitle,
    color: palette.inkStrong,
  },
  unitCoords: {
    ...typography.caption,
    color: palette.inkMuted,
    fontFamily: 'monospace',
  },
  geofencePill: {
    alignSelf: 'flex-start',
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radii.xs,
    marginTop: spacing.xs,
  },
  geofencePillOn: { backgroundColor: palette.successSoft },
  geofencePillOff: { backgroundColor: palette.warningSoft },
  geofencePillText: {
    ...typography.overline,
    fontSize: 9,
    letterSpacing: 0.8,
  },

  editButton: {
    backgroundColor: palette.brandDeep,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: radii.pill,
    ...elevation.level1,
  },
  editButtonText: {
    ...typography.button,
    color: palette.inkInverse,
  },
});
