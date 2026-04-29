import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
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

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [allUnits, setAllUnits] = useState<Unit[]>([]);
  const [mainUnitId, setMainUnitId] = useState<number | null>(null);
  const [allowedUnits, setAllowedUnits] = useState<AllowedUnitState[]>([]);
  const [showMainPicker, setShowMainPicker] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);

      // Fetch all units and existing permissions in parallel
      const [unitsRes, permsRes] = await Promise.all([
        api.getAdminUnits(token),
        api.getBranchPermissions(token, employeeId),
      ]);

      if (unitsRes.success) {
        setAllUnits(unitsRes.units);
      }

      if (permsRes.success) {
        setMainUnitId(permsRes.main_unit_id);

        // Build allowed units state from existing permissions
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
    const found = allowedUnits.find(au => au.unit_id === unitId);
    return found ? found.is_active : false;
  };

  const toggleUnit = (unitId: number) => {
    setAllowedUnits(prev => {
      const existing = prev.find(au => au.unit_id === unitId);
      if (existing) {
        return prev.map(au =>
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
      // Build the allowed_units array — include all units that have been toggled
      // Also ensure main_unit_id is included as active
      const finalAllowed: AllowedUnitState[] = allUnits.map(unit => {
        const existing = allowedUnits.find(au => au.unit_id === unit.id);
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
        Alert.alert('Success', response.message, [
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
    ? allUnits.find(u => u.id === mainUnitId)?.name || 'Unknown'
    : 'Tap to select';

  if (loading) {
    return (
      <View style={[styles.container, styles.centerContent]}>
        <StatusBar barStyle="light-content" backgroundColor="#1E68B8" />
        <ActivityIndicator size="large" color="#1E68B8" />
        <Text style={styles.loadingText}>Loading permissions...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#1E68B8" />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.backButton}
        >
          <Text style={styles.backText}>{'< Back'}</Text>
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle}>Branch Permissions</Text>
          <Text style={styles.headerSubtitle}>{employeeName}</Text>
        </View>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Primary Office Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Primary Office</Text>
          <Text style={styles.sectionHint}>
            The employee's main branch/office location.
          </Text>
          <TouchableOpacity
            style={styles.mainUnitSelector}
            onPress={() => setShowMainPicker(true)}
          >
            <Text style={styles.mainUnitIcon}>🏢</Text>
            <View style={{ flex: 1 }}>
              <Text style={styles.mainUnitLabel}>Main Branch</Text>
              <Text style={styles.mainUnitValue}>{mainUnitName}</Text>
            </View>
            <Text style={styles.dropdownArrow}>▼</Text>
          </TouchableOpacity>
        </View>

        {/* Additional Punch Access Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Additional Punch Access</Text>
          <Text style={styles.sectionHint}>
            Check the boxes to grant the employee permission to punch in from
            these locations. Uncheck to revoke.
          </Text>

          {allUnits.map(unit => {
            const checked = isUnitChecked(unit.id);
            const isMain = unit.id === mainUnitId;
            const isWfhOrField = !unit.is_geofenced;

            return (
              <TouchableOpacity
                key={unit.id}
                style={[
                  styles.unitRow,
                  checked && styles.unitRowChecked,
                  isMain && styles.unitRowMain,
                ]}
                onPress={() => toggleUnit(unit.id)}
                activeOpacity={0.7}
              >
                {/* Checkbox */}
                <View
                  style={[
                    styles.checkbox,
                    checked && styles.checkboxChecked,
                  ]}
                >
                  {checked && <Text style={styles.checkmark}>✓</Text>}
                </View>

                {/* Unit info */}
                <View style={{ flex: 1 }}>
                  <View style={styles.unitNameRow}>
                    <Text style={styles.unitName}>{unit.name}</Text>
                    {isMain && (
                      <View style={styles.mainBadge}>
                        <Text style={styles.mainBadgeText}>PRIMARY</Text>
                      </View>
                    )}
                    {isWfhOrField && (
                      <View style={styles.wfhBadge}>
                        <Text style={styles.wfhBadgeText}>No Geofence</Text>
                      </View>
                    )}
                  </View>
                  <Text style={styles.unitDetail}>
                    {unit.is_geofenced
                      ? `📍 ${unit.latitude}, ${unit.longitude}`
                      : '🏠 Remote / Field'}
                  </Text>
                </View>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Save Button */}
        <TouchableOpacity
          style={[styles.saveButton, saving && styles.saveButtonDisabled]}
          onPress={handleSave}
          disabled={saving}
        >
          {saving ? (
            <ActivityIndicator color="#FFF" />
          ) : (
            <Text style={styles.saveButtonText}>Save Branch Permissions</Text>
          )}
        </TouchableOpacity>

        <View style={{ height: 40 }} />
      </ScrollView>

      {/* Main Unit Picker Modal */}
      <Modal
        visible={showMainPicker}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowMainPicker(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Select Primary Office</Text>
            <ScrollView style={{ maxHeight: 400 }}>
              {allUnits
                .filter(u => !!u.is_geofenced)
                .map(unit => (
                  <TouchableOpacity
                    key={unit.id}
                    style={[
                      styles.modalOption,
                      mainUnitId === unit.id && styles.modalOptionSelected,
                    ]}
                    onPress={() => {
                      setMainUnitId(unit.id);
                      setShowMainPicker(false);
                    }}
                  >
                    <Text style={styles.modalOptionText}>{unit.name}</Text>
                    {mainUnitId === unit.id && (
                      <Text style={styles.modalCheckmark}>✓</Text>
                    )}
                  </TouchableOpacity>
                ))}
            </ScrollView>
            <TouchableOpacity
              style={styles.modalCloseBtn}
              onPress={() => setShowMainPicker(false)}
            >
              <Text style={styles.modalCloseBtnText}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F5F5F5' },
  centerContent: { justifyContent: 'center', alignItems: 'center' },
  loadingText: { marginTop: 10, color: '#666', fontSize: 16 },

  header: {
    backgroundColor: '#1E68B8',
    paddingTop: 50,
    paddingBottom: 20,
    paddingHorizontal: 20,
    flexDirection: 'row',
    alignItems: 'center',
  },
  backButton: {
    marginRight: 15,
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 15,
  },
  backText: { color: '#FFF', fontSize: 14, fontWeight: '600' },
  headerTitle: { fontSize: 18, fontWeight: '600', color: '#FFF' },
  headerSubtitle: { fontSize: 12, color: '#B3D9FF', marginTop: 2 },

  content: { flex: 1, paddingHorizontal: 20, paddingTop: 20 },

  section: { marginBottom: 25 },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1E68B8',
    marginBottom: 6,
  },
  sectionHint: {
    fontSize: 12,
    color: '#888',
    marginBottom: 14,
    lineHeight: 18,
  },

  // Main unit selector
  mainUnitSelector: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF',
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#1E68B8',
    padding: 16,
  },
  mainUnitIcon: { fontSize: 24, marginRight: 12 },
  mainUnitLabel: { fontSize: 11, color: '#999', fontWeight: '500' },
  mainUnitValue: { fontSize: 16, color: '#333', fontWeight: '600', marginTop: 2 },
  dropdownArrow: { fontSize: 12, color: '#1E68B8' },

  // Unit rows (checkboxes)
  unitRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF',
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  unitRowChecked: {
    backgroundColor: '#E8F5E9',
    borderColor: '#4CAF50',
    borderWidth: 2,
  },
  unitRowMain: {
    borderColor: '#1E68B8',
  },

  checkbox: {
    width: 26,
    height: 26,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: '#CCC',
    marginRight: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxChecked: {
    backgroundColor: '#4CAF50',
    borderColor: '#4CAF50',
  },
  checkmark: { color: '#FFF', fontSize: 16, fontWeight: 'bold' },

  unitNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    marginBottom: 4,
  },
  unitName: { fontSize: 15, fontWeight: '600', color: '#333', marginRight: 8 },
  mainBadge: {
    backgroundColor: '#E3F2FD',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
    marginRight: 6,
  },
  mainBadgeText: { fontSize: 9, fontWeight: '700', color: '#1E68B8' },
  wfhBadge: {
    backgroundColor: '#FFF3E0',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  wfhBadgeText: { fontSize: 9, fontWeight: '700', color: '#E65100' },
  unitDetail: { fontSize: 12, color: '#888' },

  // Save button
  saveButton: {
    backgroundColor: '#4CAF50',
    borderRadius: 25,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 10,
    shadowColor: '#4CAF50',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 5,
    elevation: 6,
  },
  saveButtonDisabled: { opacity: 0.6 },
  saveButtonText: { color: '#FFF', fontSize: 17, fontWeight: '700' },

  // Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: '#FFF',
    borderRadius: 20,
    padding: 20,
    width: '85%',
    maxHeight: '70%',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1E68B8',
    marginBottom: 15,
    textAlign: 'center',
  },
  modalOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#F5F5F5',
    borderRadius: 10,
    padding: 15,
    marginBottom: 8,
  },
  modalOptionSelected: {
    backgroundColor: '#E3F2FD',
    borderWidth: 2,
    borderColor: '#1E68B8',
  },
  modalOptionText: { fontSize: 15, color: '#333', fontWeight: '500' },
  modalCheckmark: { fontSize: 18, color: '#1E68B8', fontWeight: 'bold' },
  modalCloseBtn: {
    backgroundColor: '#E0E0E0',
    borderRadius: 10,
    padding: 12,
    alignItems: 'center',
    marginTop: 10,
  },
  modalCloseBtnText: { color: '#666', fontSize: 14, fontWeight: '600' },
});
