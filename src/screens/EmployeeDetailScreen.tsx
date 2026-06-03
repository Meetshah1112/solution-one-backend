import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  StatusBar,
  ScrollView,
  ActivityIndicator,
  Alert,
  Image,
  Linking,
  Modal,
} from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RouteProp } from '@react-navigation/native';
import { RootStackParamList, Punch } from '../types';
import { api } from '../services/api';
import {
  palette,
  spacing,
  radii,
  typography,
  elevation,
  innerRadius,
  KineticPressable,
} from '../theme';

type EmployeeDetailProps = {
  navigation: NativeStackNavigationProp<RootStackParamList, 'EmployeeDetail'>;
  route: RouteProp<RootStackParamList, 'EmployeeDetail'>;
};

export const EmployeeDetailScreen: React.FC<EmployeeDetailProps> = ({
  navigation,
  route,
}) => {
  const { user, token, employeeId, employeeName, employeeEmail, isActive, date } =
    route.params;

  // ─── Logic preserved verbatim ────────────────────────────────────────────
  const [loading, setLoading] = useState(true);
  const [punches, setPunches] = useState<Punch[]>([]);
  const [zoomedPhoto, setZoomedPhoto] = useState<string | null>(null);

  useEffect(() => {
    loadDetail();
  }, []);

  const loadDetail = async () => {
    try {
      setLoading(true);
      const res = await api.getEmployeePunches(token, employeeId, date);
      if (res.success) {
        setPunches(res.punches || []);
      }
    } catch (error: any) {
      Alert.alert('Error', error.message);
    } finally {
      setLoading(false);
    }
  };

  const formatTime = (dateTime: string) => {
    const d = new Date(dateTime);
    return d.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    });
  };

  const openMap = (location: string) => {
    Linking.openURL('https://www.google.com/maps/search/?api=1&query=' + location);
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={palette.brandDeep} />

      {/* ╭───── Header with back + employee identity ─────╮ */}
      <View style={styles.header}>
        <KineticPressable
          style={styles.backButton}
          onPress={() => navigation.goBack()}
          accessibilityLabel="Go back"
        >
          <Text style={styles.backIcon}>←</Text>
        </KineticPressable>
        <View style={styles.headerInfo}>
          <View style={styles.headerNameRow}>
            <Text style={styles.headerTitle} numberOfLines={1}>
              {employeeName}
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
                  { color: isActive ? palette.successInk : palette.dangerInk },
                ]}
              >
                {isActive ? 'Active' : 'Blocked'}
              </Text>
            </View>
          </View>
          <Text style={styles.headerSubtitle} numberOfLines={1}>
            {employeeEmail}
          </Text>
          <Text style={styles.headerDate}>{date}</Text>
        </View>
      </View>

      {loading ? (
        <View style={styles.centerState}>
          <ActivityIndicator size="large" color={palette.brandDeep} />
          <Text style={styles.loadingText}>Loading punches…</Text>
        </View>
      ) : (
        <ScrollView
          style={styles.content}
          contentContainerStyle={styles.contentInner}
          showsVerticalScrollIndicator={false}
        >
          {/* ╭───── Punches section ─────╮ */}
          <Text style={styles.sectionLabel}>Punch records</Text>

          {punches.length === 0 ? (
            <View style={styles.emptyCard} accessibilityRole="text">
              <Text style={styles.emptyGlyph}>∅</Text>
              <Text style={styles.emptyTitle}>No punches recorded</Text>
              <Text style={styles.emptyText}>
                Nothing logged for this employee on the selected date.
              </Text>
            </View>
          ) : (
            punches.map((p) => (
              <View key={p.index} style={styles.punchCard}>
                {/* Top row: index badge + time + map chip (or no-GPS pill) */}
                <View style={styles.punchTopRow}>
                  <View style={styles.punchIndexBadge}>
                    <Text style={styles.punchIndexText}>#{p.index}</Text>
                  </View>
                  <Text style={styles.punchTime}>{formatTime(p.time)}</Text>
                  {p.location ? (
                    <KineticPressable
                      style={styles.mapChip}
                      onPress={() => openMap(p.location!)}
                      accessibilityLabel={`Open punch #${p.index} on map`}
                    >
                      <Text style={styles.mapChipText}>Map</Text>
                    </KineticPressable>
                  ) : (
                    <View style={styles.noGpsPill}>
                      <Text style={styles.noGpsText}>No GPS</Text>
                    </View>
                  )}
                </View>

                {/* Photo: nesting formula → outer 16 radius, padding 12 → inner 4 */}
                {p.photo ? (
                  <KineticPressable
                    onPress={() => setZoomedPhoto(p.photo!)}
                    style={styles.photoWrapper}
                    accessibilityLabel={`View punch #${p.index} selfie at full size`}
                  >
                    <Image
                      source={{ uri: p.photo }}
                      style={styles.punchPhoto}
                      resizeMode="cover"
                    />
                    <Text style={styles.tapHint}>Tap to zoom</Text>
                  </KineticPressable>
                ) : (
                  <View style={styles.noPhotoBox}>
                    <Text style={styles.noPhotoText}>No photo captured</Text>
                  </View>
                )}
              </View>
            ))
          )}

          {/* ╭───── Branch permissions deep-link ─────╮ */}
          <KineticPressable
            style={styles.branchPermsCard}
            onPress={() =>
              navigation.navigate('BranchPermissions', {
                user,
                token,
                employeeId,
                employeeName,
              })
            }
            accessibilityLabel="Manage branch permissions"
            accessibilityHint="Configure which branches this employee can punch from"
          >
            <View style={styles.branchPermsIconWrap}>
              <Text style={styles.branchPermsIcon}>⚑</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.branchPermsTitle}>Branch permissions</Text>
              <Text style={styles.branchPermsHint}>
                Set primary unit & allowed punch locations
              </Text>
            </View>
            <Text style={styles.branchPermsArrow}>›</Text>
          </KineticPressable>

          <View style={{ height: spacing['4xl'] }} />
        </ScrollView>
      )}

      {/* ╭───── Full-screen photo zoom modal ─────╮ */}
      <Modal
        visible={zoomedPhoto !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setZoomedPhoto(null)}
      >
        <KineticPressable
          style={styles.zoomScrim}
          onPress={() => setZoomedPhoto(null)}
          dimOnPress={false}
          pressScale={1}        // no scale on the backdrop itself
          accessibilityLabel="Close zoomed photo"
          accessibilityHint="Tap anywhere to close"
        >
          {zoomedPhoto && (
            <Image
              source={{ uri: zoomedPhoto }}
              style={styles.zoomedImage}
              resizeMode="contain"
            />
          )}
          <Text style={styles.zoomHint}>Tap anywhere to close</Text>
        </KineticPressable>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  // ── Canvas ───────────────────────────────────────────────────────────────
  container: { flex: 1, backgroundColor: palette.canvas },

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
  // 44 × 44 (Apple HIG min tap target) — pill radius
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
    marginLeft: -1, // optical: arrow glyph sits slightly off-centre
  },
  headerInfo: { flex: 1 },
  headerNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  headerTitle: {
    ...typography.title,
    color: palette.inkInverse,
    flexShrink: 1,
  },
  statusBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radii.pill,
  },
  activeBadge: { backgroundColor: palette.successSoft },
  blockedBadge: { backgroundColor: palette.dangerSoft },
  statusBadgeText: {
    ...typography.overline,
    letterSpacing: 0.6,
  },
  headerSubtitle: {
    ...typography.caption,
    color: 'rgba(250, 250, 248, 0.78)',
    marginTop: spacing.xs,
  },
  headerDate: {
    ...typography.overline,
    color: 'rgba(250, 250, 248, 0.62)',
    marginTop: spacing.xs,
    letterSpacing: 1.0,
  },

  // ── Loading / center state ───────────────────────────────────────────────
  centerState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: spacing.md,
  },
  loadingText: {
    ...typography.caption,
    color: palette.inkMuted,
  },

  // ── Body ─────────────────────────────────────────────────────────────────
  content: { flex: 1 },
  contentInner: {
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.xl,
    paddingBottom: spacing.xxl,
  },
  sectionLabel: {
    ...typography.overline,
    color: palette.inkMuted,
    marginBottom: spacing.md,
  },

  // ── Empty state ──────────────────────────────────────────────────────────
  emptyCard: {
    backgroundColor: palette.surface,
    padding: spacing.xxl,
    borderRadius: radii.lg,
    alignItems: 'center',
    gap: spacing.sm,
    borderWidth: 1,
    borderColor: palette.borderHairline,
    ...elevation.level1,
  },
  emptyGlyph: {
    fontSize: 36,
    color: palette.inkSoft,
    marginBottom: spacing.xs,
  },
  emptyTitle: {
    ...typography.subtitle,
    color: palette.inkBase,
  },
  emptyText: {
    ...typography.caption,
    color: palette.inkMuted,
    textAlign: 'center',
  },

  // ── Punch card (nesting math applied to inner photo) ────────────────────
  punchCard: {
    backgroundColor: palette.surface,
    borderRadius: radii.lg,        // outer = 16
    padding: spacing.md,           // padding = 12
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: palette.borderHairline,
    ...elevation.level1,
    // → inner photo radius = max(0, 16 - 12) = 4
  },
  punchTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.md,
    gap: spacing.md,
  },
  punchIndexBadge: {
    backgroundColor: palette.brandDeep,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radii.pill,
    minWidth: 44,
    alignItems: 'center',
  },
  punchIndexText: {
    ...typography.caption,
    color: palette.inkInverse,
    fontWeight: '700',
  },
  punchTime: {
    ...typography.subtitle,
    color: palette.inkStrong,
    flex: 1,
  },
  mapChip: {
    backgroundColor: palette.brandDeep,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radii.pill,
  },
  mapChipText: {
    ...typography.caption,
    color: palette.inkInverse,
    fontWeight: '700',
  },
  noGpsPill: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radii.pill,
    backgroundColor: palette.canvasAlt,
  },
  noGpsText: {
    ...typography.caption,
    color: palette.inkMuted,
    fontStyle: 'italic',
  },

  // ── Photo (nesting formula) ──────────────────────────────────────────────
  photoWrapper: {
    borderRadius: innerRadius(radii.lg, spacing.md),
    overflow: 'hidden',
  },
  punchPhoto: {
    width: '100%',
    aspectRatio: 4 / 3,
    backgroundColor: palette.inkStrong,
    borderRadius: innerRadius(radii.lg, spacing.md),
  },
  tapHint: {
    textAlign: 'center',
    color: palette.inkSoft,
    ...typography.caption,
    marginTop: spacing.xs,
  },
  noPhotoBox: {
    height: 72,
    borderRadius: innerRadius(radii.lg, spacing.md),
    backgroundColor: palette.surfaceSunken,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: palette.borderHairline,
    borderStyle: 'dashed',
  },
  noPhotoText: {
    ...typography.caption,
    color: palette.inkSoft,
  },

  // ── Branch permissions card ──────────────────────────────────────────────
  branchPermsCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: palette.surface,
    borderRadius: radii.lg,
    padding: spacing.lg,
    marginTop: spacing.md,
    borderWidth: 1,
    borderColor: palette.brandSoftBorder,
    ...elevation.level2,
  },
  branchPermsIconWrap: {
    width: 44, height: 44,
    borderRadius: radii.md,
    backgroundColor: palette.brandSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  branchPermsIcon: {
    fontSize: 22,
    color: palette.brandDeep,
  },
  branchPermsTitle: {
    ...typography.subtitle,
    color: palette.inkStrong,
  },
  branchPermsHint: {
    ...typography.caption,
    color: palette.inkMuted,
    marginTop: 2,
  },
  branchPermsArrow: {
    fontSize: 22,
    color: palette.brandDeep,
    fontWeight: '600',
    marginTop: -2,
  },

  // ── Photo zoom modal ─────────────────────────────────────────────────────
  zoomScrim: {
    flex: 1,
    backgroundColor: palette.scrimHeavy, // luxurious near-black, never true black
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.xl,
  },
  zoomedImage: {
    width: '100%',
    height: '85%',
  },
  zoomHint: {
    ...typography.caption,
    color: palette.inkInverse,
    opacity: 0.6,
    marginTop: spacing.md,
  },
});
