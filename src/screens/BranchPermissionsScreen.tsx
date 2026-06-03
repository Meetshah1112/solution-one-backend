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
} from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RouteProp } from '@react-navigation/native';
import { RootStackParamList, Unit } from '../types';
import { api } from '../services/api';
import {
  palette,
  spacing,
  radii,
  typography,
  elevation,
  KineticPressable,
  QuietPressable,
} from '../theme';

type BranchPermissionsProps = {
  navigation: NativeStackNavigationProp<RootStackParamList, 'BranchPermissions'>;
  route: RouteProp<RootStackParamList, 'BranchPermissions'>;
};

interface AllowedUnitState {
  unit_id: number;
  is_active: boolean;
}

export const BranchPermissionsScreen: React.FC<BranchPermissionsProps> = ({
  navigation,
  route,
}) => {
  const { user, token, employeeId, employeeName } = route.params;

  // ─── Logic preserved verbatim ────────────────────────────────────────────
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [allUnits, setAllUnits] = useState<Unit[]>([]);
  const [mainUnitId, setMainUnitId] = useState<number | null>(null);
  const [allowedUnits, setAllowedUnits] = useState<AllowedUnitState[]>([]);
  const [showMainPicker, setShowMainPicker] = useState(false);

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const [unitsRes, permsRes] = await Promise.all([
        api.getAdminUnits(token),
        api.getBranchPermissions(token, employeeId),
      ]);

      if (unitsRes.success) setAllUnits(unitsRes.units);

      if (permsRes.success) {
        setMainUnitId(permsRes.main_unit_id);
        if (permsRes.allowed_units && permsRes.allowed_units.length > 0) {
          setAllowedUnits(
            permsRes.allowed_units.map((au: any) => ({
              unit_id: au.unit_id,
              is_active: au.is_active,
            }))
          );
        }
      }
    } catch (error: any) {
      Alert.alert('Error', error.message);
    } finally {
      setLoading(false);
    }
  };

  const isUnitChecked = (unitId: number): boolean => {
    const found = allowedUnits.find((au) => au.unit_id === unitId);
    return found ? found.is_active : false;
  };

  const toggleUnit = (unitId: number) => {
    setAllowedUnits((prev) => {
      const existing = prev.find((au) => au.unit_id === unitId);
      if (existing) {
        return prev.map((au) =>
          au.unit_id === unitId ? { ...au, is_active: !au.is_active } : au
        );
      }
      return [...prev, { unit_id: unitId, is_active: true }];
    });
  };

  const handleSave = async () => {
    if (!mainUnitId) {
      Alert.alert('Required', 'Please select a Primary Office before saving.');
      return;
    }

    setSaving(true);
    try {
      const finalAllowed: AllowedUnitState[] = allUnits.map((unit) => {
        const existing = allowedUnits.find((au) => au.unit_id === unit.id);
        return {
          unit_id: unit.id,
          is_active: existing ? existing.is_active : false,
        };
      });

      const response = await api.saveBranchPermissions(
        token,
        employeeId,
        mainUnitId,
        finalAllowed,
      );

      if (response.success) {
        Alert.alert('Saved', response.message, [
          { text: 'OK', onPress: () => navigation.goBack() },
        ]);
      }
    } catch (error: any) {
      Alert.alert('Error', error.message);
    } finally {
      setSaving(false);
    }
  };

  const mainUnitName = mainUnitId
    ? allUnits.find((u) => u.id === mainUnitId)?.name || 'Unknown'
    : 'Tap to select';

  if (loading) {
    return (
      <View style={[styles.container, styles.centerContent]}>
        <StatusBar barStyle="light-content" backgroundColor={palette.brandDeep} />
        <ActivityIndicator size="large" color={palette.brandDeep} />
        <Text style={styles.loadingText}>Loading permissions…</Text>
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
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle}>Branch permissions</Text>
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
        {/* ╭───── Primary office section ─────╮ */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Primary office</Text>
          <Text style={styles.sectionHint}>
            The employee's main branch — required to save permissions.
          </Text>
          <KineticPressable
            style={styles.mainUnitSelector}
            onPress={() => setShowMainPicker(true)}
            accessibilityLabel={`Primary office: ${mainUnitName}, tap to change`}
          >
            <View style={styles.unitGlyph}>
              <Text style={styles.unitGlyphText}>⌖</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.mainUnitLabel}>Main branch</Text>
              <Text style={styles.mainUnitValue} numberOfLines={1}>
                {mainUnitName}
              </Text>
            </View>
            <Text style={styles.dropdownChevron}>▾</Text>
          </KineticPressable>
        </View>

        {/* ╭───── Additional access section ─────╮ */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Additional punch access</Text>
          <Text style={styles.sectionHint}>
            Tap a row to toggle whether the employee may punch from that location.
          </Text>

          {allUnits.map((unit) => {
            const checked = isUnitChecked(unit.id);
            const isMain = unit.id === mainUnitId;
            const isWfhOrField = !unit.is_geofenced;

            return (
              <QuietPressable
                key={unit.id}
                style={[
                  styles.unitRow,
                  checked && styles.unitRowChecked,
                  isMain && styles.unitRowMain,
                ]}
                onPress={() => toggleUnit(unit.id)}
                accessibilityRole="checkbox"
                accessibilityState={{ selected: checked }}
                accessibilityLabel={`${unit.name}, ${checked ? 'allowed' : 'not allowed'}${isMain ? ', primary' : ''}`}
              >
                {/* Checkbox: micro radius 4 inside a 14px-padded card → inner = 4 */}
                <View
                  style={[
                    styles.checkbox,
                    checked && styles.checkboxChecked,
                  ]}
                >
                  {checked && <Text style={styles.checkmark}>✓</Text>}
                </View>

                <View style={{ flex: 1 }}>
                  <View style={styles.unitNameRow}>
                    <Text style={styles.unitName} numberOfLines={1}>
                      {unit.name}
                    </Text>
                    {isMain && (
                      <View style={styles.tagPrimary}>
                        <Text style={styles.tagPrimaryText}>PRIMARY</Text>
                      </View>
                    )}
                    {isWfhOrField && (
                      <View style={styles.tagWfh}>
                        <Text style={styles.tagWfhText}>NO GEO</Text>
                      </View>
                    )}
                  </View>
                  <Text style={styles.unitDetail} numberOfLines={1}>
                    {unit.is_geofenced
                      ? `${unit.latitude}, ${unit.longitude}`
                      : 'Remote / field work'}
                  </Text>
                </View>
              </QuietPressable>
            );
          })}
        </View>

        {/* ╭───── Save CTA ─────╮ */}
        <KineticPressable
          style={[styles.saveButton, saving && styles.saveButtonDisabled]}
          onPress={handleSave}
          disabled={saving}
          accessibilityLabel="Save branch permissions"
        >
          {saving ? (
            <ActivityIndicator color={palette.inkInverse} />
          ) : (
            <Text style={styles.saveButtonText}>Save permissions</Text>
          )}
        </KineticPressable>

        <View style={{ height: spacing['4xl'] }} />
      </ScrollView>

      {/* ╭───── Main unit picker modal ─────╮ */}
      <Modal
        visible={showMainPicker}
        transparent
        animationType="fade"
        onRequestClose={() => setShowMainPicker(false)}
      >
        <View style={styles.modalScrim}>
          <View style={styles.modalSheet}>
            <View style={styles.modalHandle} />
            <Text style={styles.modalTitle}>Select primary office</Text>
            <ScrollView style={{ maxHeight: 420 }} showsVerticalScrollIndicator={false}>
              {allUnits
                .filter((u) => !!u.is_geofenced)
                .map((unit) => {
                  const isSelected = mainUnitId === unit.id;
                  return (
                    <QuietPressable
                      key={unit.id}
                      style={[
                        styles.modalOption,
                        isSelected && styles.modalOptionSelected,
                      ]}
                      onPress={() => {
                        setMainUnitId(unit.id);
                        setShowMainPicker(false);
                      }}
                      accessibilityState={{ selected: isSelected }}
                    >
                      <Text style={styles.modalOptionText}>{unit.name}</Text>
                      {isSelected && <Text style={styles.modalCheckmark}>✓</Text>}
                    </QuietPressable>
                  );
                })}
            </ScrollView>
            <KineticPressable
              style={styles.modalCloseBtn}
              onPress={() => setShowMainPicker(false)}
            >
              <Text style={styles.modalCloseBtnText}>Close</Text>
            </KineticPressable>
          </View>
        </View>
      </Modal>
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

  // ── Sections ─────────────────────────────────────────────────────────────
  section: { marginBottom: spacing.xxl },
  sectionLabel: {
    ...typography.overline,
    color: palette.inkMuted,
    marginBottom: spacing.xs,
  },
  sectionHint: {
    ...typography.caption,
    color: palette.inkMuted,
    marginBottom: spacing.md,
    // 1.5 line-height makes multi-line hints comfortably scannable
  },

  // ── Main unit selector ───────────────────────────────────────────────────
  mainUnitSelector: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: palette.surface,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: palette.brandSoftBorder,
    padding: spacing.lg,
    ...elevation.level2,
  },
  unitGlyph: {
    width: 44, height: 44,
    borderRadius: radii.md,
    backgroundColor: palette.brandSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  unitGlyphText: { fontSize: 22, color: palette.brandDeep },
  mainUnitLabel: {
    ...typography.overline,
    color: palette.inkMuted,
  },
  mainUnitValue: {
    ...typography.subtitle,
    color: palette.inkStrong,
    marginTop: 2,
  },
  dropdownChevron: {
    fontSize: 14,
    color: palette.inkMuted,
  },

  // ── Unit rows (checkboxes) ───────────────────────────────────────────────
  unitRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: palette.surface,
    borderRadius: radii.lg,
    padding: spacing.md,            // 12 padding → inner checkbox radius = 4
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: palette.borderHairline,
    ...elevation.level1,
  },
  unitRowChecked: {
    backgroundColor: palette.successSoft,
    borderColor: palette.successBase,
    borderWidth: 1.5,
  },
  unitRowMain: {
    borderColor: palette.brandDeep,
    borderWidth: 1.5,
  },

  checkbox: {
    width: 24, height: 24,
    // Inner radius: outer 16 - padding 12 = 4 (nesting formula)
    borderRadius: radii.xs,
    borderWidth: 1.5,
    borderColor: palette.inkMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxChecked: {
    backgroundColor: palette.successBase,
    borderColor: palette.successBase,
  },
  checkmark: { color: palette.inkInverse, fontSize: 14, fontWeight: '700' },

  unitNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginBottom: 4,
  },
  unitName: {
    ...typography.bodyEmphasis,
    color: palette.inkStrong,
    flexShrink: 1,
  },
  tagPrimary: {
    backgroundColor: palette.brandSoft,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radii.xs,
  },
  tagPrimaryText: {
    ...typography.overline,
    color: palette.brandInk,
    fontSize: 9,
    letterSpacing: 0.8,
  },
  tagWfh: {
    backgroundColor: palette.warningSoft,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radii.xs,
  },
  tagWfhText: {
    ...typography.overline,
    color: palette.warningInk,
    fontSize: 9,
    letterSpacing: 0.8,
  },
  unitDetail: {
    ...typography.caption,
    color: palette.inkMuted,
    fontFamily: 'monospace',
  },

  // ── Save button ──────────────────────────────────────────────────────────
  saveButton: {
    backgroundColor: palette.successBase,
    borderRadius: radii.lg,
    paddingVertical: spacing.lg,
    alignItems: 'center',
    marginTop: spacing.md,
    ...elevation.level3,
  },
  saveButtonDisabled: { opacity: 0.55 },
  saveButtonText: { ...typography.buttonLarge, color: palette.inkInverse },

  // ── Modal ────────────────────────────────────────────────────────────────
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
  modalOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: palette.surface,
    borderRadius: radii.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: palette.borderHairline,
  },
  modalOptionSelected: {
    backgroundColor: palette.brandSoft,
    borderColor: palette.brandDeep,
    borderWidth: 1.5,
  },
  modalOptionText: { ...typography.body, color: palette.inkStrong },
  modalCheckmark: { fontSize: 18, color: palette.brandDeep, fontWeight: '700' },
  modalCloseBtn: {
    backgroundColor: palette.canvasAlt,
    borderRadius: radii.md,
    paddingVertical: spacing.md,
    alignItems: 'center',
    marginTop: spacing.md,
  },
  modalCloseBtnText: { ...typography.button, color: palette.inkBase },
});
