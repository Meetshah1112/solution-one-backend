import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  StatusBar,
  ScrollView,
  Alert,
  ActivityIndicator,
  Modal,
  Linking,
} from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RouteProp } from '@react-navigation/native';
import * as Location from 'expo-location';
import * as ImagePicker from 'expo-image-picker';
import { RootStackParamList, Unit, Punch } from '../types';
import { api } from '../services/api';
import {
  palette,
  spacing,
  radii,
  typography,
  elevation,
  motion,
  KineticPressable,
  QuietPressable,
} from '../theme';

type EmployeeHomeProps = {
  navigation: NativeStackNavigationProp<RootStackParamList, 'EmployeeHome'>;
  route: RouteProp<RootStackParamList, 'EmployeeHome'>;
};

export const EmployeeHomeScreen: React.FC<EmployeeHomeProps> = ({ route, navigation }) => {
  const { user, token } = route.params;

  // ─── Business logic preserved verbatim ──────────────────────────────────
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [units, setUnits] = useState<Unit[]>([]);
  const [selectedUnit, setSelectedUnit] = useState<Unit | null>(null);
  const [showUnitModal, setShowUnitModal] = useState(false);
  const [punchCount, setPunchCount] = useState(0);
  const [punches, setPunches] = useState<Punch[]>([]);

  useEffect(() => {
    loadUnits();
    loadStatus();
  }, []);

  const loadUnits = async () => {
    try {
      const response = await api.getUserUnits(token);
      if (response.success && response.units.length > 0) {
        setUnits(response.units);
        setSelectedUnit(response.units[0]);
      }
    } catch (error: any) {
      Alert.alert('Error', 'Failed to load units: ' + error.message);
    }
  };

  const loadStatus = async () => {
    try {
      setRefreshing(true);
      const status = await api.getAttendanceStatus(token);
      if (status.hasPunches) {
        setPunchCount(status.punchCount);
        setPunches(status.punches || []);
      } else {
        setPunchCount(0);
        setPunches([]);
      }
    } catch (error: any) {
      console.log('No attendance for today yet');
    } finally {
      setRefreshing(false);
    }
  };

  const formatTime = (dateTime: string) => {
    const date = new Date(dateTime);
    return date.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    });
  };

  const handlePunch = async () => {
    if (!selectedUnit) {
      Alert.alert('Select Unit', 'Please select a unit before punching');
      return;
    }

    setLoading(true);
    try {
      // 1. Location permission + position
      const { status: locStatus } = await Location.requestForegroundPermissionsAsync();
      if (locStatus !== 'granted') {
        Alert.alert('Permission Denied', 'Location permission is required');
        setLoading(false);
        return;
      }

      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
      });
      const { latitude, longitude } = location.coords;

      // 2. Camera permission + selfie capture (proof of presence)
      const { status: camStatus } = await ImagePicker.requestCameraPermissionsAsync();
      if (camStatus !== 'granted') {
        Alert.alert(
          'Camera Required',
          'Please allow camera access to take a selfie as proof of attendance.',
        );
        setLoading(false);
        return;
      }

      const photo = await ImagePicker.launchCameraAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        cameraType: ImagePicker.CameraType.front,
        allowsEditing: false,
        quality: 0.5,        // ~50-80KB selfies after JPEG compression
        base64: true,
      });

      if (photo.canceled) {
        Alert.alert(
          'Photo Required',
          'A selfie is mandatory to mark attendance. You must take a photo to punch in or out.',
        );
        setLoading(false);
        return;
      }

      const photoBase64 = photo.assets?.[0]?.base64;
      if (!photoBase64) {
        Alert.alert(
          'Photo Failed',
          'Could not capture the photo. Attendance cannot be recorded without a selfie. Please try again.',
        );
        setLoading(false);
        return;
      }

      // 3. Submit punch with photo
      const response = await api.punch(
        token,
        selectedUnit.id,
        latitude,
        longitude,
        `data:image/jpeg;base64,${photoBase64}`,
      );

      if (response.success) {
        Alert.alert('Success!', response.message);
        loadStatus();
      }
    } catch (error: any) {
      Alert.alert('Punch Failed', error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    Alert.alert('Logout', 'Are you sure you want to logout?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Logout', onPress: () => navigation.navigate('Login') },
    ]);
  };

  // ─── Derived UI state for cleaner JSX below ─────────────────────────────
  const isComplete = punchCount >= 14;
  const hasNoUnits = units.length === 0;
  const nextPunchNumber = punchCount + 1;

  // ─── Presentation ───────────────────────────────────────────────────────
  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={palette.brandDeep} />

      {/* ╭───── Header ─────╮
          Curved bottom edge softens the brand band → less "corporate header"  */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          {/* Optically-centred avatar circle */}
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{initialsOf(user.name)}</Text>
          </View>
          <View style={styles.headerCopy}>
            <Text style={styles.headerGreeting}>Welcome back</Text>
            <Text style={styles.headerName} numberOfLines={1}>
              {user.name}
            </Text>
            <Text style={styles.headerTenant}>
              {user.tenantDb === 'solution_one' ? 'Solution One' : 'CryoGas'}
            </Text>
          </View>
        </View>
        <KineticPressable
          onPress={handleLogout}
          style={styles.logoutButton}
          accessibilityLabel="Logout"
        >
          <Text style={styles.logoutText}>Logout</Text>
        </KineticPressable>
      </View>

      <ScrollView
        style={styles.content}
        contentContainerStyle={styles.contentInner}
        showsVerticalScrollIndicator={false}
      >
        {/* ╭───── Unit selector ─────╮ */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Workplace</Text>

          {hasNoUnits ? (
            <View style={styles.warningCard} accessibilityRole="alert">
              <Text style={styles.warningIcon}>!</Text>
              <View style={{ flex: 1 }}>
                <Text style={styles.warningTitle}>No units assigned</Text>
                <Text style={styles.warningText}>Please contact your admin.</Text>
              </View>
            </View>
          ) : (
            <KineticPressable
              style={styles.unitSelector}
              onPress={() => { if (units.length > 1) setShowUnitModal(true); }}
              disabled={loading || units.length <= 1}
              accessibilityLabel={`Selected unit: ${selectedUnit?.name}`}
              accessibilityHint={units.length > 1 ? 'Tap to switch unit' : undefined}
            >
              <View style={styles.unitSelectorRow}>
                <View
                  style={[
                    styles.unitGlyph,
                    selectedUnit?.is_geofenced ? styles.unitGlyphGeo : styles.unitGlyphRemote,
                  ]}
                >
                  <Text style={styles.unitGlyphText}>
                    {selectedUnit?.is_geofenced ? '⌖' : '⌂'}
                  </Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.unitName} numberOfLines={1}>
                    {selectedUnit ? selectedUnit.name : 'Select unit'}
                  </Text>
                  <Text style={styles.unitMeta}>
                    {selectedUnit
                      ? selectedUnit.is_geofenced
                        ? 'Geofenced · 50 m radius'
                        : 'Remote / field work'
                      : ''}
                  </Text>
                </View>
                {units.length > 1 && <Text style={styles.dropdownChevron}>▾</Text>}
              </View>
            </KineticPressable>
          )}
        </View>

        {/* ╭───── Today's punches timeline ─────╮ */}
        {punchCount > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionLabel}>Today's punches</Text>
              <View style={styles.counterPill}>
                <Text style={styles.counterPillText}>{punchCount}/14</Text>
              </View>
            </View>

            <View style={styles.statusCard}>
              {punches.map((p, idx) => (
                <View
                  key={idx}
                  style={[
                    styles.punchRow,
                    // Last row drops the divider for cleaner visual close
                    idx === punches.length - 1 && styles.punchRowLast,
                  ]}
                >
                  {/* Index badge: micro 4px radius (allowed inside dense atom) */}
                  <View style={styles.punchIndexBadge}>
                    <Text style={styles.punchIndexText}>#{p.index}</Text>
                  </View>
                  <Text style={styles.punchTime}>{formatTime(p.time)}</Text>
                  {p.location ? (
                    <KineticPressable
                      style={styles.mapChip}
                      onPress={() =>
                        Linking.openURL(
                          'https://www.google.com/maps/search/?api=1&query=' + p.location,
                        )
                      }
                      accessibilityLabel={`View punch #${p.index} location on map`}
                    >
                      <Text style={styles.mapChipText}>Map</Text>
                    </KineticPressable>
                  ) : (
                    <Text style={styles.punchNoLoc}>—</Text>
                  )}
                </View>
              ))}
            </View>
          </View>
        )}

        {/* ╭───── Primary CTA: the big circle ─────╮
            This is the screen's anchor — strongest elevation, prominent scale  */}
        <View style={styles.ctaSection}>
          <KineticPressable
            style={[
              styles.ctaCircle,
              isComplete && styles.ctaCircleComplete,
              (hasNoUnits || loading) && styles.ctaCircleDisabled,
            ]}
            onPress={handlePunch}
            disabled={loading || isComplete || hasNoUnits}
            pressScale={motion.pressScaleProminent}
            accessibilityRole="button"
            accessibilityLabel={
              isComplete
                ? 'All 14 punches completed for today'
                : `Mark attendance — punch number ${nextPunchNumber}`
            }
          >
            {loading ? (
              <ActivityIndicator color={palette.inkInverse} size="large" />
            ) : isComplete ? (
              <>
                <Text style={styles.ctaGlyphComplete}>✓</Text>
                <Text style={styles.ctaTitle}>All done</Text>
                <Text style={styles.ctaSubtitle}>14 of 14 punches</Text>
              </>
            ) : (
              <>
                <Text style={styles.ctaGlyph}>⌖</Text>
                <Text style={styles.ctaTitle}>Tap to punch</Text>
                <Text style={styles.ctaSubtitle} numberOfLines={1}>
                  #{nextPunchNumber} · {selectedUnit?.name || 'select unit'}
                </Text>
              </>
            )}
          </KineticPressable>
        </View>

        {/* ╭───── Secondary actions ─────╮ */}
        <View style={styles.secondaryActions}>
          <KineticPressable
            style={styles.secondaryButton}
            onPress={loadStatus}
            disabled={refreshing}
            accessibilityLabel="Refresh status"
          >
            {refreshing ? (
              <ActivityIndicator color={palette.brandDeep} size="small" />
            ) : (
              <Text style={styles.secondaryButtonText}>Refresh status</Text>
            )}
          </KineticPressable>

          <KineticPressable
            style={styles.secondaryButtonFilled}
            onPress={() => navigation.navigate('AttendanceHistory', { user, token })}
            accessibilityLabel="View attendance history"
          >
            <Text style={styles.secondaryButtonFilledText}>View history</Text>
            <Text style={styles.secondaryButtonChevron}>›</Text>
          </KineticPressable>
        </View>

        {/* ╭───── HR self-service tiles ─────╮
            Quick-access cards for the self-service features */}
        <Text style={styles.sectionLabel}>HR self-service</Text>
        <View style={styles.menuRow}>
          <MenuTile
            label="Leave"
            hint="Apply & track"
            tint={palette.brandSoft}
            ink={palette.brandDeep}
            onPress={() => navigation.navigate('LeaveRequest', { user, token })}
          />
          <MenuTile
            label="Adjust"
            hint="Fix punches"
            tint={palette.warningSoft}
            ink={palette.warningDeep}
            onPress={() => navigation.navigate('AdjustmentRequest', { user, token })}
          />
          <MenuTile
            label="Salary"
            hint="Slip & download"
            tint={palette.successSoft}
            ink={palette.successDeep}
            onPress={() => navigation.navigate('SalarySlipList', { user, token })}
          />
          <MenuTile
            label="Report"
            hint="Attendance"
            tint={palette.brandSoft}
            ink={palette.brandDeep}
            onPress={() => navigation.navigate('AttendanceReport', { user, token })}
          />
          <MenuTile
            label="Holidays"
            hint="Upcoming"
            tint={palette.warningSoft}
            ink={palette.warningDeep}
            onPress={() => navigation.navigate('HolidayList', { user, token })}
          />
          <MenuTile
            label="Approvals"
            hint="Team leaves"
            tint={palette.successSoft}
            ink={palette.successDeep}
            onPress={() => navigation.navigate('TeamApprovals', { user, token })}
          />
        </View>
      </ScrollView>

      {/* ╭───── Unit selection modal ─────╮ */}
      <Modal
        visible={showUnitModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowUnitModal(false)}
      >
        <View style={styles.modalScrim}>
          <View style={styles.modalSheet}>
            <View style={styles.modalHandle} />
            <Text style={styles.modalTitle}>Choose unit</Text>
            <ScrollView style={styles.unitList} showsVerticalScrollIndicator={false}>
              {units.map((unit) => {
                const isSelected = selectedUnit?.id === unit.id;
                return (
                  <QuietPressable
                    key={unit.id}
                    style={[
                      styles.unitListItem,
                      isSelected && styles.unitListItemSelected,
                    ]}
                    onPress={() => {
                      setSelectedUnit(unit);
                      setShowUnitModal(false);
                    }}
                    accessibilityState={{ selected: isSelected }}
                    accessibilityLabel={`${unit.name}, ${unit.is_geofenced ? 'geofenced' : 'remote'}`}
                  >
                    <View
                      style={[
                        styles.unitGlyph,
                        unit.is_geofenced ? styles.unitGlyphGeo : styles.unitGlyphRemote,
                      ]}
                    >
                      <Text style={styles.unitGlyphText}>
                        {unit.is_geofenced ? '⌖' : '⌂'}
                      </Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.unitName}>{unit.name}</Text>
                      <Text style={styles.unitMeta}>
                        {unit.is_geofenced ? 'Geofenced' : 'Remote / field'}
                      </Text>
                    </View>
                    {isSelected && <Text style={styles.unitSelectedTick}>✓</Text>}
                  </QuietPressable>
                );
              })}
            </ScrollView>
            <KineticPressable
              style={styles.modalCloseButton}
              onPress={() => setShowUnitModal(false)}
              accessibilityLabel="Close unit picker"
            >
              <Text style={styles.modalCloseButtonText}>Close</Text>
            </KineticPressable>
          </View>
        </View>
      </Modal>
    </View>
  );
};

/* Helper: derive 2-letter initials for the avatar circle.
   Pure UI — uses the existing user.name, no state. */
/* MenuTile — compact tile for HR self-service quick access.
   Lives inline so the parent stylesheet can supply the visual tokens. */
const MenuTile: React.FC<{
  label: string;
  hint: string;
  tint: string;
  ink: string;
  onPress: () => void;
}> = ({ label, hint, tint, ink, onPress }) => (
  <KineticPressable
    style={styles.menuTile}
    onPress={onPress}
    accessibilityLabel={label}
    accessibilityHint={hint}
  >
    <View style={[styles.menuTileIcon, { backgroundColor: tint }]}>
      <Text style={[styles.menuTileGlyph, { color: ink }]}>›</Text>
    </View>
    <Text style={styles.menuTileLabel}>{label}</Text>
    <Text style={styles.menuTileHint}>{hint}</Text>
  </KineticPressable>
);

const initialsOf = (name: string): string => {
  const parts = (name || '').trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '·';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
};

const styles = StyleSheet.create({
  // ── Canvas ───────────────────────────────────────────────────────────────
  container: {
    flex: 1,
    backgroundColor: palette.canvas,
  },
  content: {
    flex: 1,
  },
  contentInner: {
    paddingHorizontal: spacing.xl,    // 20 → bumped to 24 for consistency
    paddingTop: spacing.xl,
    paddingBottom: spacing['5xl'],
  },

  // ── Header (brand band) ──────────────────────────────────────────────────
  header: {
    backgroundColor: palette.brandDeep,
    paddingTop: 52,                   // status bar + 8 grid
    paddingBottom: spacing.xxl,
    paddingHorizontal: spacing.xl,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    // Curved bottom edge softens the header into the canvas → editorial feel
    borderBottomLeftRadius: radii.xxl,
    borderBottomRightRadius: radii.xxl,
    // Shadow leaks softly into the canvas to anchor the band
    ...elevation.level2,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: spacing.md,
  },
  // Avatar: 48px square with the nesting formula applied to keep glyph centred
  avatar: {
    width: 48,
    height: 48,
    borderRadius: radii.pill,
    backgroundColor: 'rgba(250, 250, 248, 0.18)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(250, 250, 248, 0.22)',
  },
  avatarText: {
    ...typography.subtitle,
    color: palette.inkInverse,
    letterSpacing: 0.5,
  },
  headerCopy: { flex: 1 },
  headerGreeting: {
    ...typography.caption,
    color: 'rgba(250, 250, 248, 0.75)',
    fontWeight: '500',
  },
  headerName: {
    ...typography.title,
    color: palette.inkInverse,
    marginTop: 2,
  },
  headerTenant: {
    ...typography.overline,
    color: 'rgba(250, 250, 248, 0.65)',
    marginTop: spacing.xs,
    letterSpacing: 1.0,
  },
  logoutButton: {
    backgroundColor: 'rgba(250, 250, 248, 0.14)',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: 'rgba(250, 250, 248, 0.18)',
  },
  logoutText: {
    ...typography.button,
    color: palette.inkInverse,
  },

  // ── Section primitives ───────────────────────────────────────────────────
  section: {
    marginBottom: spacing.xxl,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  sectionLabel: {
    ...typography.overline,
    color: palette.inkMuted,
  },
  counterPill: {
    backgroundColor: palette.brandSoft,
    borderRadius: radii.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: 4,
  },
  counterPillText: {
    ...typography.caption,
    color: palette.brandInk,
    fontWeight: '700',
  },

  // ── Warning card (no units) ──────────────────────────────────────────────
  warningCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: palette.warningSoft,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: palette.warningBase,
    padding: spacing.lg,
    ...elevation.level1,
  },
  warningIcon: {
    width: 32, height: 32,
    borderRadius: radii.pill,
    backgroundColor: palette.warningBase,
    color: palette.inkInverse,
    textAlign: 'center',
    lineHeight: 32,
    fontWeight: '900',
    fontSize: 18,
  },
  warningTitle: {
    ...typography.bodyEmphasis,
    color: palette.warningInk,
  },
  warningText: {
    ...typography.caption,
    color: palette.warningInk,
    opacity: 0.85,
    marginTop: 2,
  },

  // ── Unit selector ────────────────────────────────────────────────────────
  unitSelector: {
    backgroundColor: palette.surface,
    borderRadius: radii.lg,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: palette.borderHairline,
    ...elevation.level2,
  },
  unitSelectorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  // Tinted square instead of raw emoji floating in space
  unitGlyph: {
    width: 44, height: 44,
    borderRadius: radii.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  unitGlyphGeo: {
    backgroundColor: palette.brandSoft,
  },
  unitGlyphRemote: {
    backgroundColor: palette.warningSoft,
  },
  unitGlyphText: {
    fontSize: 22,
    color: palette.brandDeep,
  },
  unitName: {
    ...typography.subtitle,
    color: palette.inkStrong,
  },
  unitMeta: {
    ...typography.caption,
    color: palette.inkMuted,
    marginTop: 2,
  },
  dropdownChevron: {
    fontSize: 14,
    color: palette.inkMuted,
    paddingLeft: spacing.sm,
  },

  // ── Status card (today's punches) ────────────────────────────────────────
  statusCard: {
    backgroundColor: palette.surface,
    borderRadius: radii.lg,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.xs, // 4 — micro-adjust so rows define their own padding
    borderWidth: 1,
    borderColor: palette.borderHairline,
    ...elevation.level1,
  },
  punchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.md,
    gap: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: palette.borderHairline,
  },
  punchRowLast: { borderBottomWidth: 0 },
  punchIndexBadge: {
    // 4px radius — micro-adjustment allowed inside dense atom
    backgroundColor: palette.brandSoft,
    borderRadius: radii.xs,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    minWidth: 36,
    alignItems: 'center',
  },
  punchIndexText: {
    ...typography.caption,
    color: palette.brandInk,
    fontWeight: '700',
  },
  punchTime: {
    ...typography.bodyEmphasis,
    color: palette.inkStrong,
    flex: 1,
  },
  punchNoLoc: {
    ...typography.caption,
    color: palette.inkSoft,
  },
  mapChip: {
    backgroundColor: palette.brandDeep,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radii.pill,
  },
  mapChipText: {
    ...typography.caption,
    color: palette.inkInverse,
    fontWeight: '700',
  },

  // ── Primary CTA — the punch circle (screen anchor) ───────────────────────
  ctaSection: {
    alignItems: 'center',
    marginVertical: spacing.xxl,
  },
  ctaCircle: {
    width: 240, height: 240,
    borderRadius: radii.pill, // perfect circle via pill radius on equal sides
    backgroundColor: palette.brandDeep,
    alignItems: 'center',
    justifyContent: 'center',
    // Inset hairline gives a subtle inner edge that catches light → premium
    borderWidth: 1,
    borderColor: 'rgba(250, 250, 248, 0.08)',
    // The strongest shadow on the screen — earned by being the anchor
    ...elevation.level4,
  },
  ctaCircleComplete: {
    backgroundColor: palette.successBase,
  },
  ctaCircleDisabled: {
    opacity: 0.55,
  },
  ctaGlyph: {
    // Optical centring: the ⌖ glyph reads slightly low — nudge it 4px upward
    fontSize: 56,
    color: palette.inkInverse,
    marginBottom: spacing.sm,
    marginTop: -4,
  },
  ctaGlyphComplete: {
    fontSize: 64,
    color: palette.inkInverse,
    marginBottom: spacing.sm,
    fontWeight: '300',
  },
  ctaTitle: {
    ...typography.headline,
    color: palette.inkInverse,
    marginBottom: 4,
  },
  ctaSubtitle: {
    ...typography.caption,
    color: 'rgba(250, 250, 248, 0.78)',
    textAlign: 'center',
    paddingHorizontal: spacing.lg,
  },

  // ── Secondary actions row ────────────────────────────────────────────────
  secondaryActions: {
    gap: spacing.md,
  },
  secondaryButton: {
    backgroundColor: palette.surface,
    borderRadius: radii.lg,
    paddingVertical: spacing.lg,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: palette.brandSoftBorder,
    ...elevation.level1,
  },
  secondaryButtonText: {
    ...typography.buttonLarge,
    color: palette.brandDeep,
  },
  secondaryButtonFilled: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: palette.brandDeep,
    borderRadius: radii.lg,
    paddingVertical: spacing.lg,
    gap: spacing.sm,
    ...elevation.level2,
  },
  secondaryButtonFilledText: {
    ...typography.buttonLarge,
    color: palette.inkInverse,
  },
  secondaryButtonChevron: {
    color: palette.inkInverse,
    fontSize: 20,
    lineHeight: 20,
    marginTop: -2, // optical alignment with the text baseline
  },

  // ── Modal: unit picker ───────────────────────────────────────────────────
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
  // Drag handle: subtle visual cue that this is a bottom sheet
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
  unitList: {
    flexGrow: 0,
  },
  unitListItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: palette.surface,
    // Nesting formula: outer sheet padding = 20, so inner items < 20 — radius 12
    borderRadius: radii.md,
    padding: spacing.md,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: palette.borderHairline,
  },
  unitListItemSelected: {
    backgroundColor: palette.brandSoft,
    borderColor: palette.brandDeep,
    borderWidth: 1.5,
  },
  unitSelectedTick: {
    color: palette.brandDeep,
    fontSize: 20,
    fontWeight: '700',
  },
  modalCloseButton: {
    marginTop: spacing.lg,
    backgroundColor: palette.canvasAlt,
    borderRadius: radii.md,
    paddingVertical: spacing.md,
    alignItems: 'center',
  },
  modalCloseButtonText: {
    ...typography.button,
    color: palette.inkBase,
  },

  // ── HR self-service tiles ───────────────────────────────────────────────
  // Wrapping grid: ~3 tiles per row, growing to fill the trailing gap.
  menuRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
    marginTop: spacing.md,
  },
  menuTile: {
    flexBasis: '30%',
    flexGrow: 1,
    backgroundColor: palette.surface,
    borderRadius: radii.lg,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: palette.borderHairline,
    ...elevation.level1,
  },
  menuTileIcon: {
    width: 36,
    height: 36,
    borderRadius: radii.sm,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
  },
  menuTileGlyph: {
    fontSize: 22,
    fontWeight: '700',
    marginTop: -2,
  },
  menuTileLabel: {
    ...typography.bodyEmphasis,
    color: palette.inkStrong,
  },
  menuTileHint: {
    ...typography.caption,
    color: palette.inkMuted,
    marginTop: 2,
  },
});
