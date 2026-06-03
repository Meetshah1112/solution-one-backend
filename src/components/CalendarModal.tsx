import React, { useState, useMemo, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
} from 'react-native';
import {
  palette,
  spacing,
  radii,
  typography,
  elevation,
  KineticPressable,
  QuietPressable,
} from '../theme';

/* ────────────────────────────────────────────────────────────────────────────
 * CalendarModal — a dependency-free month calendar in a bottom-sheet modal.
 *
 * Used by the Leave screen (and reusable elsewhere) so users tap a real
 * calendar instead of typing "YYYY-MM-DD" by hand. Emits the chosen day
 * as a 'YYYY-MM-DD' string so it slots straight into existing API calls.
 * ──────────────────────────────────────────────────────────────────────────── */

type CalendarModalProps = {
  visible: boolean;
  onClose: () => void;
  onSelect: (dateStr: string) => void;
  /** Currently selected date (YYYY-MM-DD), highlighted when the sheet opens. */
  selectedDate?: string | null;
  /** Earliest selectable date (YYYY-MM-DD). Days before this are disabled. */
  minDate?: string | null;
  /** Latest selectable date (YYYY-MM-DD). Days after this are disabled. */
  maxDate?: string | null;
  title?: string;
};

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];
const DAY_HEADERS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

// Build "YYYY-MM-DD" without timezone drift (avoids toISOString() UTC shift).
const toIsoDate = (y: number, m: number, d: number): string =>
  `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;

// Parse a "YYYY-MM-DD" into a local Date at midnight (no TZ surprises).
const parseIso = (s?: string | null): Date | null => {
  if (!s || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return null;
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d);
};

export const CalendarModal: React.FC<CalendarModalProps> = ({
  visible,
  onClose,
  onSelect,
  selectedDate,
  minDate,
  maxDate,
  title = 'Select date',
}) => {
  // The month currently being shown. Seeds from the selection (or today).
  const [cursor, setCursor] = useState<Date>(() => parseIso(selectedDate) ?? new Date());

  // When the sheet re-opens, re-seed the visible month from the selection.
  useEffect(() => {
    if (visible) {
      setCursor(parseIso(selectedDate) ?? new Date());
    }
  }, [visible, selectedDate]);

  const year = cursor.getFullYear();
  const month = cursor.getMonth();

  const days = useMemo(() => {
    const firstWeekday = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const cells: (number | null)[] = [];
    for (let i = 0; i < firstWeekday; i++) cells.push(null);
    for (let d = 1; d <= daysInMonth; d++) cells.push(d);
    return cells;
  }, [year, month]);

  const minD = parseIso(minDate);
  const maxD = parseIso(maxDate);
  const selD = parseIso(selectedDate);
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const isDisabled = (d: number): boolean => {
    const cell = new Date(year, month, d);
    if (minD && cell < minD) return true;
    if (maxD && cell > maxD) return true;
    return false;
  };

  const isSameDay = (a: Date | null, d: number): boolean =>
    !!a && a.getFullYear() === year && a.getMonth() === month && a.getDate() === d;

  const goMonth = (delta: number) => setCursor(new Date(year, month + delta, 1));

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.scrim}>
        <View style={styles.sheet}>
          <View style={styles.handle} />
          <Text style={styles.title}>{title}</Text>

          {/* Month navigation */}
          <View style={styles.nav}>
            <KineticPressable
              onPress={() => goMonth(-1)}
              style={styles.navBtn}
              accessibilityLabel="Previous month"
            >
              <Text style={styles.navArrow}>‹</Text>
            </KineticPressable>
            <Text style={styles.navTitle}>
              {MONTH_NAMES[month]} {year}
            </Text>
            <KineticPressable
              onPress={() => goMonth(1)}
              style={styles.navBtn}
              accessibilityLabel="Next month"
            >
              <Text style={styles.navArrow}>›</Text>
            </KineticPressable>
          </View>

          {/* Weekday header row */}
          <View style={styles.weekRow}>
            {DAY_HEADERS.map((d) => (
              <Text key={d} style={styles.weekday}>{d}</Text>
            ))}
          </View>

          {/* Day grid */}
          <View style={styles.grid}>
            {days.map((d, idx) => {
              if (d === null) {
                return <View key={`e-${idx}`} style={styles.dayCell} />;
              }
              const disabled = isDisabled(d);
              const selected = isSameDay(selD, d);
              const isToday = isSameDay(today, d);

              return (
                <QuietPressable
                  key={`d-${d}`}
                  style={styles.dayCell}
                  disabled={disabled}
                  onPress={() => {
                    onSelect(toIsoDate(year, month, d));
                    onClose();
                  }}
                  accessibilityLabel={`${MONTH_NAMES[month]} ${d}, ${year}`}
                  accessibilityState={{ selected, disabled }}
                >
                  <View
                    style={[
                      styles.dayInner,
                      selected && styles.daySelected,
                      isToday && !selected && styles.dayToday,
                    ]}
                  >
                    <Text
                      style={[
                        styles.dayText,
                        selected && styles.dayTextSelected,
                        isToday && !selected && styles.dayTextToday,
                        disabled && styles.dayTextDisabled,
                      ]}
                    >
                      {d}
                    </Text>
                  </View>
                </QuietPressable>
              );
            })}
          </View>

          <KineticPressable style={styles.closeBtn} onPress={onClose}>
            <Text style={styles.closeBtnText}>Cancel</Text>
          </KineticPressable>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  scrim: {
    flex: 1,
    backgroundColor: palette.scrim,
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: palette.surfaceElevated,
    borderTopLeftRadius: radii.xxl,
    borderTopRightRadius: radii.xxl,
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.md,
    paddingBottom: spacing.xxl,
    ...elevation.level4,
  },
  handle: {
    width: 40, height: 4,
    backgroundColor: palette.borderBase,
    borderRadius: radii.pill,
    alignSelf: 'center',
    marginBottom: spacing.lg,
  },
  title: {
    ...typography.title,
    color: palette.inkStrong,
    marginBottom: spacing.lg,
  },
  nav: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  navBtn: {
    width: 40, height: 40,
    borderRadius: radii.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: palette.canvasAlt,
  },
  navArrow: {
    fontSize: 24,
    color: palette.brandDeep,
    lineHeight: 26,
    fontWeight: '700',
  },
  navTitle: {
    ...typography.subtitle,
    color: palette.inkStrong,
  },
  weekRow: {
    flexDirection: 'row',
    marginBottom: spacing.sm,
  },
  weekday: {
    flex: 1,
    textAlign: 'center',
    ...typography.overline,
    color: palette.inkSoft,
    letterSpacing: 0.4,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  dayCell: {
    width: `${100 / 7}%`,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayInner: {
    width: 38, height: 38,
    borderRadius: radii.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  daySelected: {
    backgroundColor: palette.brandDeep,
  },
  dayToday: {
    borderWidth: 1.5,
    borderColor: palette.brandDeep,
  },
  dayText: {
    ...typography.body,
    color: palette.inkStrong,
  },
  dayTextSelected: {
    color: palette.inkInverse,
    fontWeight: '700',
  },
  dayTextToday: {
    color: palette.brandDeep,
    fontWeight: '700',
  },
  dayTextDisabled: {
    color: palette.inkSoft,
    opacity: 0.35,
  },
  closeBtn: {
    marginTop: spacing.lg,
    backgroundColor: palette.canvasAlt,
    borderRadius: radii.md,
    paddingVertical: spacing.md,
    alignItems: 'center',
  },
  closeBtnText: {
    ...typography.button,
    color: palette.inkBase,
  },
});
