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
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import * as FileSystem from 'expo-file-system';
import {
  RootStackParamList,
  AttendanceReportRow,
  AttendanceReportSummary,
} from '../types';
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
  navigation: NativeStackNavigationProp<RootStackParamList, 'AttendanceReport'>;
  route: RouteProp<RootStackParamList, 'AttendanceReport'>;
};

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

const fmtTime = (iso: string | null): string => {
  if (!iso) return '—';
  const d = new Date(iso);
  return d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
};

const fmtDay = (iso: string): { day: string; weekday: string } => {
  const d = new Date(iso);
  return {
    day: String(d.getDate()).padStart(2, '0'),
    weekday: d.toLocaleDateString('en-US', { weekday: 'short' }),
  };
};

const fmtHrs = (mins: number): string => {
  if (!mins) return '—';
  return `${Math.floor(mins / 60)}h ${mins % 60}m`;
};

export const AttendanceReportScreen: React.FC<Props> = ({ navigation, route }) => {
  const { token } = route.params;

  const now = new Date();
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());

  const [rows, setRows] = useState<AttendanceReportRow[]>([]);
  const [summary, setSummary] = useState<AttendanceReportSummary>({
    present_days: 0,
    total_minutes: 0,
  });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [downloading, setDownloading] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await api.getAttendanceReport(token, month, year);
      if (res.success) {
        setRows(res.rows);
        setSummary(res.summary);
      }
    } catch (error: any) {
      Alert.alert('Error', error.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [token, month, year]);

  useEffect(() => {
    setLoading(true);
    load();
  }, [load]);

  const onRefresh = () => {
    setRefreshing(true);
    load();
  };

  // Month navigation — clamp so the user can't browse into the future.
  const isCurrentMonth = month === now.getMonth() + 1 && year === now.getFullYear();
  const stepMonth = (delta: number) => {
    let m = month + delta;
    let y = year;
    if (m < 1) { m = 12; y -= 1; }
    else if (m > 12) { m = 1; y += 1; }
    // Block stepping past the current month.
    if (y > now.getFullYear() || (y === now.getFullYear() && m > now.getMonth() + 1)) {
      return;
    }
    setMonth(m);
    setYear(y);
  };

  const handleDownloadPdf = async () => {
    if (downloading) return;
    setDownloading(true);
    try {
      const res = await api.getAttendanceReportHtml(token, month, year);
      if (!res?.success || !res.html) throw new Error('Could not load printable report.');

      const { uri: tempUri } = await Print.printToFileAsync({ html: res.html, base64: false });

      const filename = `Attendance-${MONTHS[month - 1].slice(0, 3)}-${year}.pdf`;
      const cacheDir = (FileSystem as any).cacheDirectory as string | undefined;
      const finalUri = cacheDir ? `${cacheDir}${filename}` : tempUri;
      if (finalUri !== tempUri && cacheDir) {
        try {
          await FileSystem.moveAsync({ from: tempUri, to: finalUri });
        } catch {
          /* fall back to temp uri */
        }
      }

      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(finalUri, {
          mimeType: 'application/pdf',
          dialogTitle: `Attendance — ${MONTHS[month - 1]} ${year}`,
          UTI: 'com.adobe.pdf',
        });
      } else {
        Alert.alert('Saved', `PDF saved at:\n${finalUri}`);
      }
    } catch (error: any) {
      Alert.alert('PDF error', error?.message || 'Failed to export PDF.');
    } finally {
      setDownloading(false);
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
          <Text style={styles.headerTitle}>Attendance report</Text>
          <Text style={styles.headerSubtitle}>Date-wise punch in / out</Text>
        </View>
        <KineticPressable
          onPress={handleDownloadPdf}
          disabled={downloading || rows.length === 0}
          style={[
            styles.pdfButton,
            (downloading || rows.length === 0) && { opacity: 0.5 },
          ]}
          accessibilityLabel="Download report as PDF"
        >
          {downloading ? (
            <ActivityIndicator color={palette.brandDeep} size="small" />
          ) : (
            <Text style={styles.pdfButtonText}>PDF</Text>
          )}
        </KineticPressable>
      </View>

      <ScrollView
        style={styles.content}
        contentContainerStyle={styles.contentInner}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={palette.brandDeep} />
        }
      >
        {/* Month navigator */}
        <View style={styles.monthNav}>
          <KineticPressable
            onPress={() => stepMonth(-1)}
            style={styles.monthNavBtn}
            accessibilityLabel="Previous month"
          >
            <Text style={styles.monthNavArrow}>‹</Text>
          </KineticPressable>
          <Text style={styles.monthNavTitle}>
            {MONTHS[month - 1]} {year}
          </Text>
          <KineticPressable
            onPress={() => stepMonth(1)}
            style={[styles.monthNavBtn, isCurrentMonth && styles.monthNavBtnDisabled]}
            disabled={isCurrentMonth}
            accessibilityLabel="Next month"
          >
            <Text style={[styles.monthNavArrow, isCurrentMonth && styles.monthNavArrowDisabled]}>›</Text>
          </KineticPressable>
        </View>

        {/* Summary */}
        <View style={styles.summaryRow}>
          <View style={styles.summaryTile}>
            <Text style={styles.summaryNum}>{summary.present_days}</Text>
            <Text style={styles.summaryLabel}>Present days</Text>
          </View>
          <View style={styles.summaryTile}>
            <Text style={styles.summaryNum}>
              {Math.floor(summary.total_minutes / 60)}h {summary.total_minutes % 60}m
            </Text>
            <Text style={styles.summaryLabel}>Total hours</Text>
          </View>
        </View>

        {/* Table */}
        {loading && !refreshing ? (
          <View style={styles.loadingState}>
            <ActivityIndicator size="large" color={palette.brandDeep} />
            <Text style={styles.loadingText}>Loading report…</Text>
          </View>
        ) : rows.length === 0 ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyGlyph}>∅</Text>
            <Text style={styles.emptyText}>No attendance this month</Text>
          </View>
        ) : (
          <View style={styles.tableCard}>
            {/* Column header */}
            <View style={[styles.tableRow, styles.tableHead]}>
              <Text style={[styles.thDate]}>Date</Text>
              <Text style={[styles.thCell]}>In</Text>
              <Text style={[styles.thCell]}>Out</Text>
              <Text style={[styles.thHrs]}>Hours</Text>
            </View>

            {rows.map((r, idx) => {
              const d = fmtDay(r.date);
              return (
                <View
                  key={r.date}
                  style={[
                    styles.tableRow,
                    idx === rows.length - 1 && styles.tableRowLast,
                  ]}
                >
                  <View style={styles.tdDate}>
                    <Text style={styles.tdDay}>{d.day}</Text>
                    <Text style={styles.tdWeekday}>{d.weekday}</Text>
                  </View>
                  <Text style={styles.tdCell}>{fmtTime(r.punch_in)}</Text>
                  <Text style={styles.tdCell}>{fmtTime(r.punch_out)}</Text>
                  <Text style={styles.tdHrs}>{fmtHrs(r.worked_minutes)}</Text>
                </View>
              );
            })}
          </View>
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
  pdfButton: {
    backgroundColor: palette.inkInverse,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radii.pill,
    minWidth: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pdfButtonText: { ...typography.button, color: palette.brandDeep, fontWeight: '700' },

  content: { flex: 1 },
  contentInner: {
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.xl,
    paddingBottom: spacing.xl,
  },

  // Month navigator
  monthNav: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: palette.surface,
    borderRadius: radii.lg,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    marginBottom: spacing.lg,
    borderWidth: 1,
    borderColor: palette.borderHairline,
    ...elevation.level1,
  },
  monthNavBtn: {
    width: 40, height: 40,
    borderRadius: radii.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: palette.canvasAlt,
  },
  monthNavBtnDisabled: { opacity: 0.4 },
  monthNavArrow: {
    fontSize: 24,
    color: palette.brandDeep,
    lineHeight: 26,
    fontWeight: '700',
  },
  monthNavArrowDisabled: { color: palette.inkSoft },
  monthNavTitle: {
    ...typography.subtitle,
    color: palette.inkStrong,
  },

  // Summary
  summaryRow: {
    flexDirection: 'row',
    gap: spacing.md,
    marginBottom: spacing.lg,
  },
  summaryTile: {
    flex: 1,
    backgroundColor: palette.surface,
    borderRadius: radii.lg,
    paddingVertical: spacing.lg,
    alignItems: 'center',
    borderTopWidth: 3,
    borderTopColor: palette.brandDeep,
    borderLeftWidth: 1,
    borderRightWidth: 1,
    borderBottomWidth: 1,
    borderLeftColor: palette.borderHairline,
    borderRightColor: palette.borderHairline,
    borderBottomColor: palette.borderHairline,
    ...elevation.level1,
  },
  summaryNum: {
    fontSize: 22,
    lineHeight: 26,
    fontWeight: '700',
    color: palette.brandDeep,
    letterSpacing: -0.3,
  },
  summaryLabel: {
    ...typography.caption,
    color: palette.inkMuted,
    marginTop: 2,
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
  emptyText: { ...typography.body, color: palette.inkMuted },

  // Table
  tableCard: {
    backgroundColor: palette.surface,
    borderRadius: radii.lg,
    paddingHorizontal: spacing.lg,
    borderWidth: 1,
    borderColor: palette.borderHairline,
    ...elevation.level1,
  },
  tableRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: palette.borderHairline,
    gap: spacing.sm,
  },
  tableRowLast: { borderBottomWidth: 0 },
  tableHead: { paddingVertical: spacing.sm },
  thDate: {
    width: 56,
    ...typography.overline,
    color: palette.inkSoft,
  },
  thCell: {
    flex: 1,
    textAlign: 'center',
    ...typography.overline,
    color: palette.inkSoft,
  },
  thHrs: {
    width: 64,
    textAlign: 'right',
    ...typography.overline,
    color: palette.inkSoft,
  },
  tdDate: {
    width: 56,
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 4,
  },
  tdDay: {
    ...typography.subtitle,
    color: palette.inkStrong,
  },
  tdWeekday: {
    ...typography.caption,
    color: palette.inkMuted,
  },
  tdCell: {
    flex: 1,
    textAlign: 'center',
    ...typography.body,
    color: palette.inkBase,
    fontVariant: ['tabular-nums'],
  },
  tdHrs: {
    width: 64,
    textAlign: 'right',
    ...typography.bodyEmphasis,
    color: palette.inkStrong,
    fontVariant: ['tabular-nums'],
  },
});
