import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  StatusBar,
  ScrollView,
  Linking,
  Alert,
} from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RouteProp } from '@react-navigation/native';
import { RootStackParamList } from '../types';
import {
  palette,
  spacing,
  radii,
  typography,
  elevation,
  KineticPressable,
} from '../theme';

type AttendanceLocationDetailProps = {
  navigation: NativeStackNavigationProp<RootStackParamList, 'AttendanceLocationDetail'>;
  route: RouteProp<RootStackParamList, 'AttendanceLocationDetail'>;
};

/* ────────────────────────────────────────────────────────────────────────────
 * AttendanceLocationDetailScreen — legacy single-record detail view (not
 * currently routed in App.tsx — superseded by EmployeeDetailScreen for the
 * 14-punch model). Refactored to match the new design system so it slots in
 * cleanly if reactivated.
 * ──────────────────────────────────────────────────────────────────────────── */

export const AttendanceLocationDetailScreen: React.FC<AttendanceLocationDetailProps> = ({
  navigation,
  route,
}) => {
  const { record, employeeName } = route.params;

  // Coord fallbacks across two API shapes — preserved verbatim
  const checkInLat = record.check_in_latitude ?? record.latitude ?? null;
  const checkInLng = record.check_in_longitude ?? record.longitude ?? null;
  const checkOutLat = record.check_out_latitude ?? null;
  const checkOutLng = record.check_out_longitude ?? null;

  const formatDate = (dateString: string) =>
    new Date(dateString).toLocaleDateString('en-US', {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
      year: 'numeric',
    });

  const formatTime = (dateTime: string) => {
    if (!dateTime) return 'N/A';
    return new Date(dateTime).toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    });
  };

  const statusTheme = (status: string) => {
    switch (status) {
      case 'present':
        return { bg: palette.successSoft, ink: palette.successInk, label: 'On time' };
      case 'late':
        return { bg: palette.warningSoft, ink: palette.warningInk, label: 'Late' };
      case 'absent':
        return { bg: palette.dangerSoft, ink: palette.dangerInk, label: 'Absent' };
      default:
        return { bg: palette.canvasAlt, ink: palette.inkMuted, label: status };
    }
  };

  const openInGoogleMaps = (lat: number, lng: number) => {
    const url = `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`;
    Linking.canOpenURL(url)
      .then((supported) => {
        if (supported) Linking.openURL(url);
        else Alert.alert('Error', 'Unable to open Google Maps');
      })
      .catch(() => Alert.alert('Error', 'Unable to open Google Maps'));
  };

  const hasCheckInCoords = checkInLat != null && checkInLng != null;
  const hasCheckOutCoords = checkOutLat != null && checkOutLng != null;
  const status = statusTheme(record.status);

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={palette.brandDeep} />

      {/* ╭───── Header ─────╮ */}
      <View style={styles.header}>
        <KineticPressable
          style={styles.backButton}
          onPress={() => navigation.goBack()}
          accessibilityLabel="Go back"
        >
          <Text style={styles.backIcon}>←</Text>
        </KineticPressable>
        <View style={styles.headerInfo}>
          <Text style={styles.headerTitle}>Attendance details</Text>
          <Text style={styles.headerSubtitle} numberOfLines={1}>
            {employeeName}
          </Text>
        </View>
      </View>

      <ScrollView
        style={styles.content}
        contentContainerStyle={styles.contentInner}
        showsVerticalScrollIndicator={false}
      >
        {/* ╭───── Date + status pill ─────╮ */}
        <View style={styles.dateCard}>
          <View style={{ flex: 1 }}>
            <Text style={styles.dateOverline}>Date</Text>
            <Text style={styles.dateText}>{formatDate(record.date)}</Text>
          </View>
          <View style={[styles.statusPill, { backgroundColor: status.bg }]}>
            <Text style={[styles.statusPillText, { color: status.ink }]}>
              {status.label}
            </Text>
          </View>
        </View>

        {/* ╭───── Check-in section ─────╮ */}
        <SectionCard
          title="Check-in"
          dotColor={palette.successBase}
        >
          <DetailRow label="Time" value={formatTime(record.check_in_time)} />

          {hasCheckInCoords ? (
            <>
              <DetailRow
                label="Coordinates"
                value={`${Number(checkInLat).toFixed(6)}, ${Number(checkInLng).toFixed(6)}`}
                mono
              />
              <KineticPressable
                style={[styles.mapButton, { backgroundColor: palette.successBase }]}
                onPress={() => openInGoogleMaps(checkInLat, checkInLng)}
                accessibilityLabel="View check-in location on map"
              >
                <Text style={styles.mapButtonText}>View on map</Text>
              </KineticPressable>
            </>
          ) : (
            <Text style={styles.noCoordsText}>Location data not available</Text>
          )}
        </SectionCard>

        {/* ╭───── Check-out section ─────╮ */}
        <SectionCard
          title="Check-out"
          dotColor={palette.dangerBase}
        >
          {record.check_out_time ? (
            <>
              <DetailRow label="Time" value={formatTime(record.check_out_time)} />

              {hasCheckOutCoords ? (
                <>
                  <DetailRow
                    label="Coordinates"
                    value={`${Number(checkOutLat).toFixed(6)}, ${Number(checkOutLng).toFixed(6)}`}
                    mono
                  />

                  {record.checkout_within_geofence !== null &&
                    record.checkout_within_geofence !== undefined && (
                      <View style={styles.detailRow}>
                        <Text style={styles.detailLabel}>Geofence</Text>
                        <View
                          style={[
                            styles.geofenceBadge,
                            {
                              backgroundColor: record.checkout_within_geofence
                                ? palette.successSoft
                                : palette.dangerSoft,
                            },
                          ]}
                        >
                          <Text
                            style={[
                              styles.geofenceBadgeText,
                              {
                                color: record.checkout_within_geofence
                                  ? palette.successInk
                                  : palette.dangerInk,
                              },
                            ]}
                          >
                            {record.checkout_within_geofence ? '✓ Inside' : '✕ Outside'}
                          </Text>
                        </View>
                      </View>
                    )}

                  <KineticPressable
                    style={[styles.mapButton, { backgroundColor: palette.dangerBase }]}
                    onPress={() => openInGoogleMaps(checkOutLat, checkOutLng)}
                    accessibilityLabel="View check-out location on map"
                  >
                    <Text style={styles.mapButtonText}>View on map</Text>
                  </KineticPressable>
                </>
              ) : (
                <Text style={styles.noCoordsText}>Location data not available</Text>
              )}
            </>
          ) : (
            <Text style={styles.noCoordsText}>Not checked out yet</Text>
          )}
        </SectionCard>

        {/* ╭───── Duration tile ─────╮ */}
        {record.duration_minutes != null && (
          <View style={styles.durationCard}>
            <Text style={styles.durationLabel}>Total duration</Text>
            <Text style={styles.durationValue}>
              {Math.floor(record.duration_minutes / 60)}
              <Text style={styles.durationUnit}>h </Text>
              {record.duration_minutes % 60}
              <Text style={styles.durationUnit}>m</Text>
            </Text>
          </View>
        )}

        <View style={{ height: spacing['4xl'] }} />
      </ScrollView>
    </View>
  );
};

/* ── Atoms ─────────────────────────────────────────────────────────────────── */
const SectionCard: React.FC<{
  title: string;
  dotColor: string;
  children: React.ReactNode;
}> = ({ title, dotColor, children }) => (
  <View style={styles.sectionCard}>
    <View style={styles.sectionHeader}>
      <View style={[styles.sectionDot, { backgroundColor: dotColor }]} />
      <Text style={styles.sectionTitle}>{title}</Text>
    </View>
    {children}
  </View>
);

const DetailRow: React.FC<{
  label: string;
  value: string;
  mono?: boolean;
}> = ({ label, value, mono }) => (
  <View style={styles.detailRow}>
    <Text style={styles.detailLabel}>{label}</Text>
    <Text style={[styles.detailValue, mono && styles.detailValueMono]}>{value}</Text>
  </View>
);

const styles = StyleSheet.create({
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

  // ── Date card ────────────────────────────────────────────────────────────
  dateCard: {
    backgroundColor: palette.surface,
    borderRadius: radii.lg,
    padding: spacing.lg,
    marginBottom: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    borderWidth: 1,
    borderColor: palette.borderHairline,
    ...elevation.level1,
  },
  dateOverline: {
    ...typography.overline,
    color: palette.inkMuted,
  },
  dateText: {
    ...typography.subtitle,
    color: palette.inkStrong,
    marginTop: 2,
  },
  statusPill: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radii.pill,
  },
  statusPillText: {
    ...typography.overline,
    letterSpacing: 0.6,
  },

  // ── Section card ─────────────────────────────────────────────────────────
  sectionCard: {
    backgroundColor: palette.surface,
    borderRadius: radii.lg,
    padding: spacing.lg,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: palette.borderHairline,
    ...elevation.level1,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  sectionDot: {
    width: 10, height: 10,
    borderRadius: radii.pill,
  },
  sectionTitle: {
    ...typography.subtitle,
    color: palette.inkStrong,
  },

  // ── Detail rows ──────────────────────────────────────────────────────────
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    gap: spacing.md,
  },
  detailLabel: {
    ...typography.caption,
    color: palette.inkMuted,
  },
  detailValue: {
    ...typography.bodyEmphasis,
    color: palette.inkStrong,
    flexShrink: 1,
    textAlign: 'right',
  },
  detailValueMono: {
    fontFamily: 'monospace',
    fontSize: 13,
  },

  // ── Map button ───────────────────────────────────────────────────────────
  mapButton: {
    borderRadius: radii.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    alignItems: 'center',
    marginTop: spacing.sm,
    ...elevation.level1,
  },
  mapButtonText: {
    ...typography.button,
    color: palette.inkInverse,
  },

  noCoordsText: {
    ...typography.caption,
    color: palette.inkSoft,
    fontStyle: 'italic',
    paddingVertical: spacing.md,
  },

  geofenceBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radii.pill,
  },
  geofenceBadgeText: {
    ...typography.overline,
    letterSpacing: 0.6,
  },

  // ── Duration card (the only filled-brand card on the screen) ─────────────
  durationCard: {
    backgroundColor: palette.brandDeep,
    borderRadius: radii.lg,
    padding: spacing.xl,
    marginTop: spacing.md,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    ...elevation.level3,
  },
  durationLabel: {
    ...typography.caption,
    color: 'rgba(250, 250, 248, 0.78)',
    fontWeight: '600',
    letterSpacing: 0.4,
  },
  durationValue: {
    ...typography.display,
    color: palette.inkInverse,
    letterSpacing: -0.6,
  },
  durationUnit: {
    fontSize: 16,
    fontWeight: '500',
    color: 'rgba(250, 250, 248, 0.78)',
  },
});
