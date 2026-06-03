import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  StatusBar,
  ScrollView,
  ActivityIndicator,
  Alert,
  Share,
} from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RouteProp } from '@react-navigation/native';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import * as FileSystem from 'expo-file-system';
import { RootStackParamList, SalarySlipHeader, SalarySlipLineItem } from '../types';
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
  navigation: NativeStackNavigationProp<RootStackParamList, 'SalarySlipDetail'>;
  route: RouteProp<RootStackParamList, 'SalarySlipDetail'>;
};

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

const formatINR = (n: number) =>
  '₹' + Number(n).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export const SalarySlipDetailScreen: React.FC<Props> = ({ navigation, route }) => {
  const { token, slipId } = route.params;

  const [loading, setLoading] = useState(true);
  const [header, setHeader] = useState<SalarySlipHeader | null>(null);
  const [items, setItems] = useState<SalarySlipLineItem[]>([]);

  useEffect(() => {
    (async () => {
      try {
        const res = await api.getSalarySlip(token, slipId);
        if (res.success) {
          setHeader(res.slip);
          setItems(res.lineItems);
        }
      } catch (error: any) {
        Alert.alert('Error', error.message);
      } finally {
        setLoading(false);
      }
    })();
  }, [slipId]);

  const earnings = items.filter((i) => i.add_deduct === 'Add');
  const deductions = items.filter((i) => i.add_deduct === 'Deduct');
  const totalEarnings = earnings.reduce((sum, i) => sum + Number(i.amount), 0);
  const totalDeductions = deductions.reduce((sum, i) => sum + Number(i.amount), 0);

  const [downloading, setDownloading] = useState(false);

  const handleShare = async () => {
    if (!header) return;
    try {
      // Build a plain-text summary suitable for messaging apps.
      const lines = [
        `SALARY SLIP — ${MONTHS[header.month - 1]} ${header.year}`,
        '────────────────────────────────',
        `Employee: ${header.employee_name} (${header.employee_code})`,
        `Working days: ${header.working_days}  Pay days: ${header.pay_days}`,
        '',
        'EARNINGS',
        ...earnings.map((i) => `  ${i.head_name.padEnd(22)} ${formatINR(Number(i.amount))}`),
        `  ${'Total'.padEnd(22)} ${formatINR(totalEarnings)}`,
        '',
        'DEDUCTIONS',
        ...deductions.map((i) => `  ${i.head_name.padEnd(22)} ${formatINR(Number(i.amount))}`),
        `  ${'Total'.padEnd(22)} ${formatINR(totalDeductions)}`,
        '',
        '────────────────────────────────',
        `NET PAY: ${formatINR(Number(header.net_pay))}`,
      ];
      await Share.share({
        title: `Salary slip — ${MONTHS[header.month - 1]} ${header.year}`,
        message: lines.join('\n'),
      });
    } catch (error: any) {
      Alert.alert('Error', error.message);
    }
  };

  /**
   * Download as PDF — mirrors the web portal's "Export to PDF" action.
   *
   * 1. Fetch server-rendered HTML (matches the web layout exactly).
   * 2. Run it through expo-print → produces a real PDF on disk.
   * 3. Rename to a human-friendly name like "Salary-Slip-Aug-2026.pdf".
   * 4. Open the OS share sheet so the user can save / open / send it.
   */
  const handleDownloadPdf = async () => {
    if (!header || downloading) return;
    setDownloading(true);
    try {
      const res = await api.getSalarySlipHtml(token, slipId);
      if (!res?.success || !res.html) {
        throw new Error('Could not load printable slip.');
      }

      const { uri: tempUri } = await Print.printToFileAsync({
        html: res.html,
        base64: false,
      });

      // Move the temp file to a friendly filename so the share sheet
      // displays "Salary-Slip-Aug-2026.pdf" instead of a random GUID.
      const safeMonth = MONTHS[header.month - 1].slice(0, 3);
      const filename = `Salary-Slip-${safeMonth}-${header.year}.pdf`;
      const cacheDir = (FileSystem as any).cacheDirectory as string | undefined;
      const finalUri = cacheDir ? `${cacheDir}${filename}` : tempUri;

      if (finalUri !== tempUri && cacheDir) {
        try {
          await FileSystem.moveAsync({ from: tempUri, to: finalUri });
        } catch {
          // moveAsync can fail on Android scoped-storage edge cases —
          // fall back to the original temp file rather than aborting.
        }
      }

      const available = await Sharing.isAvailableAsync();
      if (available) {
        await Sharing.shareAsync(finalUri, {
          mimeType: 'application/pdf',
          dialogTitle: `Salary slip — ${MONTHS[header.month - 1]} ${header.year}`,
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

  if (loading) {
    return (
      <View style={[styles.container, styles.center]}>
        <StatusBar barStyle="light-content" backgroundColor={palette.brandDeep} />
        <ActivityIndicator size="large" color={palette.brandDeep} />
        <Text style={styles.loadingText}>Loading slip…</Text>
      </View>
    );
  }

  if (!header) {
    return (
      <View style={[styles.container, styles.center]}>
        <Text style={styles.emptyText}>Slip not available</Text>
      </View>
    );
  }

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
          <Text style={styles.headerTitle}>
            {MONTHS[header.month - 1]} {header.year}
          </Text>
          <Text style={styles.headerSubtitle}>Salary slip</Text>
        </View>
        <View style={styles.headerActions}>
          <KineticPressable
            onPress={handleShare}
            style={styles.shareButton}
            accessibilityLabel="Share slip as text"
          >
            <Text style={styles.shareButtonText}>Share</Text>
          </KineticPressable>
          <KineticPressable
            onPress={handleDownloadPdf}
            disabled={downloading}
            style={[styles.downloadButton, downloading && { opacity: 0.6 }]}
            accessibilityLabel="Download slip as PDF"
          >
            {downloading ? (
              <ActivityIndicator color={palette.brandDeep} size="small" />
            ) : (
              <Text style={styles.downloadButtonText}>PDF</Text>
            )}
          </KineticPressable>
        </View>
      </View>

      <ScrollView
        style={styles.content}
        contentContainerStyle={styles.contentInner}
        showsVerticalScrollIndicator={false}
      >
        {/* Employee identity */}
        <View style={styles.identityCard}>
          <Text style={styles.identityName}>{header.employee_name}</Text>
          <Text style={styles.identityCode}>Code · {header.employee_code}</Text>
          <View style={styles.identityRow}>
            <IdentityStat label="Working" value={header.working_days} />
            <IdentityStat label="Pay days" value={header.pay_days} />
            <IdentityStat label="Of" value={header.month_days} />
          </View>
        </View>

        {/* Earnings */}
        <Text style={styles.sectionLabel}>Earnings</Text>
        <View style={styles.tableCard}>
          {earnings.map((i, idx) => (
            <TableRow
              key={i.sr_no}
              label={i.head_name}
              value={formatINR(Number(i.amount))}
              isLast={idx === earnings.length - 1}
            />
          ))}
          <TableRow
            label="Total earnings"
            value={formatINR(totalEarnings)}
            isTotal
            isLast
          />
        </View>

        {/* Deductions */}
        <Text style={styles.sectionLabel}>Deductions</Text>
        <View style={styles.tableCard}>
          {deductions.map((i, idx) => (
            <TableRow
              key={i.sr_no}
              label={i.head_name}
              value={formatINR(Number(i.amount))}
              isLast={idx === deductions.length - 1}
            />
          ))}
          <TableRow
            label="Total deductions"
            value={formatINR(totalDeductions)}
            isTotal
            isLast
          />
        </View>

        {/* Net pay */}
        <View style={styles.netCard}>
          <Text style={styles.netLabel}>Net pay</Text>
          <Text style={styles.netValue}>{formatINR(Number(header.net_pay))}</Text>
        </View>

        <View style={{ height: spacing['4xl'] }} />
      </ScrollView>
    </View>
  );
};

const IdentityStat: React.FC<{ label: string; value: number | string }> = ({ label, value }) => (
  <View style={styles.identityStat}>
    <Text style={styles.identityStatValue}>{value}</Text>
    <Text style={styles.identityStatLabel}>{label}</Text>
  </View>
);

const TableRow: React.FC<{
  label: string;
  value: string;
  isLast?: boolean;
  isTotal?: boolean;
}> = ({ label, value, isLast, isTotal }) => (
  <View
    style={[
      styles.tableRow,
      isLast && styles.tableRowLast,
      isTotal && styles.tableRowTotal,
    ]}
  >
    <Text style={[styles.tableLabel, isTotal && styles.tableLabelTotal]}>{label}</Text>
    <Text style={[styles.tableValue, isTotal && styles.tableValueTotal]}>{value}</Text>
  </View>
);

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: palette.canvas },
  center: { justifyContent: 'center', alignItems: 'center', gap: spacing.md },
  loadingText: { ...typography.caption, color: palette.inkMuted },
  emptyText: { ...typography.body, color: palette.inkMuted },

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
  // Two pill buttons sit side-by-side in the header → "Share" (text) + "PDF" (download)
  headerActions: {
    flexDirection: 'row',
    gap: spacing.sm,
    alignItems: 'center',
  },
  shareButton: {
    backgroundColor: 'rgba(250, 250, 248, 0.16)',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: 'rgba(250, 250, 248, 0.20)',
  },
  shareButtonText: { ...typography.button, color: palette.inkInverse },

  // Download button is inverted on purpose — high-contrast cream pill against
  // the brand-blue header to make "PDF" feel like the primary action.
  downloadButton: {
    backgroundColor: palette.inkInverse,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radii.pill,
    minWidth: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  downloadButtonText: { ...typography.button, color: palette.brandDeep, fontWeight: '700' },

  content: { flex: 1 },
  contentInner: {
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.xl,
    paddingBottom: spacing.xl,
  },

  // Identity card
  identityCard: {
    backgroundColor: palette.surface,
    borderRadius: radii.lg,
    padding: spacing.lg,
    marginBottom: spacing.xl,
    borderWidth: 1,
    borderColor: palette.borderHairline,
    ...elevation.level1,
  },
  identityName: {
    ...typography.headline,
    color: palette.inkStrong,
  },
  identityCode: {
    ...typography.caption,
    color: palette.inkMuted,
    marginTop: 2,
    marginBottom: spacing.md,
  },
  identityRow: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  identityStat: {
    flex: 1,
    backgroundColor: palette.canvasAlt,
    borderRadius: radii.md,
    padding: spacing.md,
    alignItems: 'center',
  },
  identityStatValue: {
    fontSize: 22,
    lineHeight: 26,
    fontWeight: '700',
    color: palette.brandDeep,
    letterSpacing: -0.2,
  },
  identityStatLabel: {
    ...typography.caption,
    color: palette.inkMuted,
    marginTop: 2,
  },

  // Table sections
  sectionLabel: {
    ...typography.overline,
    color: palette.inkMuted,
    marginBottom: spacing.md,
  },
  tableCard: {
    backgroundColor: palette.surface,
    borderRadius: radii.lg,
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.xl,
    borderWidth: 1,
    borderColor: palette.borderHairline,
    ...elevation.level1,
  },
  tableRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: palette.borderHairline,
    gap: spacing.md,
  },
  tableRowLast: { borderBottomWidth: 0 },
  tableRowTotal: {
    borderTopWidth: 1,
    borderTopColor: palette.borderBase,
    borderBottomWidth: 0,
    marginTop: spacing.xs,
  },
  tableLabel: {
    ...typography.body,
    color: palette.inkBase,
    flexShrink: 1,
  },
  tableLabelTotal: {
    ...typography.bodyEmphasis,
    color: palette.inkStrong,
  },
  tableValue: {
    ...typography.bodyEmphasis,
    color: palette.inkStrong,
    fontVariant: ['tabular-nums'],
  },
  tableValueTotal: {
    ...typography.subtitle,
    color: palette.inkStrong,
    fontVariant: ['tabular-nums'],
  },

  // Net card (highlight)
  netCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: palette.brandDeep,
    borderRadius: radii.lg,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.lg,
    ...elevation.level3,
  },
  netLabel: {
    ...typography.subtitle,
    color: 'rgba(250, 250, 248, 0.85)',
  },
  netValue: {
    ...typography.display,
    color: palette.inkInverse,
    letterSpacing: -0.4,
    fontVariant: ['tabular-nums'],
  },
});
