import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  StatusBar,
  ScrollView,
  TextInput,
  Switch,
  Alert,
  ActivityIndicator,
  Modal,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RouteProp } from '@react-navigation/native';
import * as Location from 'expo-location';
import { RootStackParamList } from '../types';
import { api } from '../services/api';
import {
  palette,
  spacing,
  radii,
  typography,
  elevation,
  KineticPressable,
} from '../theme';

type UnitFormProps = {
  navigation: NativeStackNavigationProp<RootStackParamList, 'UnitForm'>;
  route: RouteProp<RootStackParamList, 'UnitForm'>;
};

export const UnitFormScreen: React.FC<UnitFormProps> = ({ navigation, route }) => {
  const { user, token, unit } = route.params;
  const isEditing = !!unit;

  // ─── Logic preserved verbatim ────────────────────────────────────────────
  const [name, setName] = useState(unit?.name || '');
  const [latitude, setLatitude] = useState(
    unit?.latitude != null ? String(unit.latitude) : ''
  );
  const [longitude, setLongitude] = useState(
    unit?.longitude != null ? String(unit.longitude) : ''
  );
  const [isGeofenced, setIsGeofenced] = useState(
    unit ? !!unit.is_geofenced : true
  );

  const [fetchingGPS, setFetchingGPS] = useState(false);
  const [saving, setSaving] = useState(false);

  const [showReAuthModal, setShowReAuthModal] = useState(false);
  const [password, setPassword] = useState('');
  const [verifying, setVerifying] = useState(false);

  // Purely-visual focus tracking → branded focus ring on inputs (a11y win)
  const [focusedField, setFocusedField] = useState<string | null>(null);

  const handleSetCurrentLocation = async () => {
    setFetchingGPS(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Denied', 'Location permission is required to set coordinates.');
        setFetchingGPS(false);
        return;
      }

      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
      });

      setLatitude(String(location.coords.latitude));
      setLongitude(String(location.coords.longitude));
    } catch (error: any) {
      Alert.alert('GPS Error', 'Failed to get current location: ' + error.message);
    } finally {
      setFetchingGPS(false);
    }
  };

  const handleSavePress = () => {
    if (!name.trim()) {
      Alert.alert('Validation', 'Unit name is required.');
      return;
    }
    if (!latitude.trim() || !longitude.trim()) {
      Alert.alert('Validation', 'Latitude and Longitude are required.');
      return;
    }
    if (isNaN(parseFloat(latitude)) || isNaN(parseFloat(longitude))) {
      Alert.alert('Validation', 'Latitude and Longitude must be valid numbers.');
      return;
    }

    setPassword('');
    setShowReAuthModal(true);
  };

  const handleConfirmSave = async () => {
    if (!password.trim()) {
      Alert.alert('Required', 'Please enter your password.');
      return;
    }

    setVerifying(true);
    try {
      await api.reverifyPassword(token, password);

      setSaving(true);
      setShowReAuthModal(false);

      const unitData = {
        name: name.trim(),
        latitude: parseFloat(latitude),
        longitude: parseFloat(longitude),
        is_geofenced: isGeofenced,
      };

      let response;
      if (isEditing && unit) {
        response = await api.updateUnit(token, unit.id, unitData);
      } else {
        response = await api.createUnit(token, unitData);
      }

      if (response.success) {
        Alert.alert('Saved', response.message, [
          { text: 'OK', onPress: () => navigation.goBack() },
        ]);
      }
    } catch (error: any) {
      Alert.alert('Error', error.message);
    } finally {
      setVerifying(false);
      setSaving(false);
      setPassword('');
    }
  };

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
        <Text style={styles.headerTitle}>
          {isEditing ? 'Edit unit' : 'New unit'}
        </Text>
        <View style={styles.headerSpacer} />
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          style={styles.content}
          contentContainerStyle={styles.contentInner}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* ╭───── Unit name ─────╮ */}
          <Field label="Unit name">
            <TextInput
              style={[
                styles.input,
                focusedField === 'name' && styles.inputFocused,
              ]}
              value={name}
              onChangeText={setName}
              placeholder="e.g. Mumbai Branch"
              placeholderTextColor={palette.inkSoft}
              onFocus={() => setFocusedField('name')}
              onBlur={() => setFocusedField(null)}
              accessibilityLabel="Unit name"
            />
          </Field>

          {/* ╭───── GPS auto-fill button ─────╮ */}
          <KineticPressable
            style={styles.gpsButton}
            onPress={handleSetCurrentLocation}
            disabled={fetchingGPS}
            accessibilityLabel="Use current location"
          >
            {fetchingGPS ? (
              <ActivityIndicator color={palette.inkInverse} size="small" />
            ) : (
              <>
                <View style={styles.gpsIconWrap}>
                  <Text style={styles.gpsIcon}>⌖</Text>
                </View>
                <Text style={styles.gpsText}>Use my current location</Text>
              </>
            )}
          </KineticPressable>

          <Text style={styles.orDivider}>or enter manually</Text>

          {/* ╭───── Lat / Lng pair (side-by-side on the 8px grid) ─────╮ */}
          <View style={styles.coordsRow}>
            <Field label="Latitude" style={styles.coordsField}>
              <TextInput
                style={[
                  styles.input,
                  focusedField === 'lat' && styles.inputFocused,
                ]}
                value={latitude}
                onChangeText={setLatitude}
                placeholder="28.7041"
                placeholderTextColor={palette.inkSoft}
                keyboardType="decimal-pad"
                onFocus={() => setFocusedField('lat')}
                onBlur={() => setFocusedField(null)}
                accessibilityLabel="Latitude"
              />
            </Field>
            <Field label="Longitude" style={styles.coordsField}>
              <TextInput
                style={[
                  styles.input,
                  focusedField === 'lng' && styles.inputFocused,
                ]}
                value={longitude}
                onChangeText={setLongitude}
                placeholder="77.1025"
                placeholderTextColor={palette.inkSoft}
                keyboardType="decimal-pad"
                onFocus={() => setFocusedField('lng')}
                onBlur={() => setFocusedField(null)}
                accessibilityLabel="Longitude"
              />
            </Field>
          </View>

          {/* ╭───── Geofence toggle ─────╮ */}
          <View style={styles.toggleCard}>
            <View style={styles.toggleInfo}>
              <Text style={styles.toggleLabel}>Geofencing</Text>
              <Text style={styles.toggleHint}>
                {isGeofenced
                  ? 'Employees must be within 50 m of these coords to punch.'
                  : 'No distance check — suitable for WFH / field work.'}
              </Text>
            </View>
            <Switch
              value={isGeofenced}
              onValueChange={setIsGeofenced}
              trackColor={{
                false: palette.canvasAlt,
                true: palette.successSoft,
              }}
              thumbColor={isGeofenced ? palette.successBase : palette.inkSoft}
              ios_backgroundColor={palette.canvasAlt}
              accessibilityLabel="Toggle geofencing"
            />
          </View>

          {/* ╭───── Save button ─────╮ */}
          <KineticPressable
            style={[styles.saveButton, saving && styles.saveButtonDisabled]}
            onPress={handleSavePress}
            disabled={saving}
            accessibilityLabel={isEditing ? 'Update unit' : 'Create unit'}
          >
            {saving ? (
              <ActivityIndicator color={palette.inkInverse} />
            ) : (
              <Text style={styles.saveButtonText}>
                {isEditing ? 'Update unit' : 'Create unit'}
              </Text>
            )}
          </KineticPressable>

          <View style={{ height: spacing['4xl'] }} />
        </ScrollView>
      </KeyboardAvoidingView>

      {/* ╭───── Re-auth modal ─────╮ */}
      <Modal
        visible={showReAuthModal}
        transparent
        animationType="fade"
        onRequestClose={() => {
          if (!verifying) setShowReAuthModal(false);
        }}
      >
        <View style={styles.modalScrim}>
          <View style={styles.modalCard}>
            <View style={styles.modalIconWrap}>
              <Text style={styles.modalIcon}>⚷</Text>
            </View>
            <Text style={styles.modalTitle}>Confirm identity</Text>
            <Text style={styles.modalSubtitle}>
              Re-enter your password to{' '}
              {isEditing ? 'update' : 'create'} this unit.
            </Text>

            <TextInput
              style={[
                styles.input,
                styles.modalInput,
                focusedField === 'reauth' && styles.inputFocused,
              ]}
              value={password}
              onChangeText={setPassword}
              placeholder="Your password"
              placeholderTextColor={palette.inkSoft}
              secureTextEntry
              autoFocus
              editable={!verifying}
              onFocus={() => setFocusedField('reauth')}
              onBlur={() => setFocusedField(null)}
              accessibilityLabel="Re-enter password"
            />

            <KineticPressable
              style={[
                styles.modalConfirmButton,
                verifying && styles.saveButtonDisabled,
              ]}
              onPress={handleConfirmSave}
              disabled={verifying}
            >
              {verifying ? (
                <ActivityIndicator color={palette.inkInverse} size="small" />
              ) : (
                <Text style={styles.modalConfirmText}>Verify & save</Text>
              )}
            </KineticPressable>

            <KineticPressable
              style={styles.modalCancelButton}
              onPress={() => {
                if (!verifying) {
                  setShowReAuthModal(false);
                  setPassword('');
                }
              }}
              disabled={verifying}
            >
              <Text style={styles.modalCancelText}>Cancel</Text>
            </KineticPressable>
          </View>
        </View>
      </Modal>
    </View>
  );
};

/* Field — co-located atom for label + input pairs */
const Field: React.FC<{
  label: string;
  children: React.ReactNode;
  style?: any;
}> = ({ label, children, style }) => (
  <View style={[styles.fieldWrapper, style]}>
    <Text style={styles.fieldLabel}>{label}</Text>
    {children}
  </View>
);

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: palette.canvas },

  // ── Header ───────────────────────────────────────────────────────────────
  header: {
    backgroundColor: palette.brandDeep,
    paddingTop: 52,
    paddingBottom: spacing.lg,
    paddingHorizontal: spacing.xl,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
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
  headerSpacer: { width: 44 },

  // ── Body ─────────────────────────────────────────────────────────────────
  content: { flex: 1 },
  contentInner: {
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.xl,
    paddingBottom: spacing.xl,
  },

  // ── Field wrapper + label ────────────────────────────────────────────────
  fieldWrapper: {
    marginBottom: spacing.lg,
  },
  fieldLabel: {
    ...typography.caption,
    color: palette.inkMuted,
    marginBottom: spacing.sm,
    letterSpacing: 0.3,
  },

  // ── Inputs (sunken wells with branded focus rings) ───────────────────────
  input: {
    backgroundColor: palette.surfaceSunken,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: palette.borderHairline,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    ...typography.bodyLarge,
    color: palette.inkStrong,
  },
  inputFocused: {
    borderColor: palette.brandDeep,
    borderWidth: 2,
    backgroundColor: palette.surface,
  },

  // ── GPS button ───────────────────────────────────────────────────────────
  gpsButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    backgroundColor: palette.brandDeep,
    borderRadius: radii.lg,
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.lg,
    ...elevation.level2,
    marginBottom: spacing.md,
  },
  gpsIconWrap: {
    width: 28, height: 28,
    borderRadius: radii.pill,
    backgroundColor: 'rgba(250, 250, 248, 0.22)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  gpsIcon: {
    fontSize: 16,
    color: palette.inkInverse,
  },
  gpsText: {
    ...typography.buttonLarge,
    color: palette.inkInverse,
  },
  orDivider: {
    ...typography.overline,
    color: palette.inkSoft,
    textAlign: 'center',
    marginBottom: spacing.md,
    letterSpacing: 1.2,
  },

  // ── Coordinates pair ─────────────────────────────────────────────────────
  coordsRow: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  coordsField: {
    flex: 1,
  },

  // ── Toggle card ──────────────────────────────────────────────────────────
  toggleCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.lg,
    backgroundColor: palette.surface,
    borderRadius: radii.lg,
    padding: spacing.lg,
    marginBottom: spacing.xl,
    borderWidth: 1,
    borderColor: palette.borderHairline,
    ...elevation.level1,
  },
  toggleInfo: { flex: 1, gap: 2 },
  toggleLabel: {
    ...typography.subtitle,
    color: palette.inkStrong,
  },
  toggleHint: {
    ...typography.caption,
    color: palette.inkMuted,
  },

  // ── Save button ──────────────────────────────────────────────────────────
  saveButton: {
    backgroundColor: palette.successBase,
    borderRadius: radii.lg,
    paddingVertical: spacing.lg,
    alignItems: 'center',
    marginTop: spacing.sm,
    ...elevation.level3,
  },
  saveButtonDisabled: { opacity: 0.55 },
  saveButtonText: { ...typography.buttonLarge, color: palette.inkInverse },

  // ── Re-auth modal ────────────────────────────────────────────────────────
  modalScrim: {
    flex: 1,
    backgroundColor: palette.scrim,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.xl,
  },
  modalCard: {
    backgroundColor: palette.surfaceElevated,
    borderRadius: radii.xl,
    padding: spacing.xl,
    width: '100%',
    maxWidth: 360,
    alignItems: 'center',
    ...elevation.level4,
  },
  modalIconWrap: {
    width: 56, height: 56,
    borderRadius: radii.pill,
    backgroundColor: palette.brandSoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.lg,
  },
  modalIcon: {
    fontSize: 26,
    color: palette.brandDeep,
  },
  modalTitle: {
    ...typography.headline,
    color: palette.inkStrong,
    marginBottom: spacing.xs,
    textAlign: 'center',
  },
  modalSubtitle: {
    ...typography.body,
    color: palette.inkMuted,
    textAlign: 'center',
    marginBottom: spacing.lg,
  },
  modalInput: {
    width: '100%',
    marginBottom: spacing.md,
  },
  modalConfirmButton: {
    width: '100%',
    backgroundColor: palette.successBase,
    borderRadius: radii.md,
    paddingVertical: spacing.md,
    alignItems: 'center',
    marginBottom: spacing.sm,
    ...elevation.level2,
  },
  modalConfirmText: {
    ...typography.buttonLarge,
    color: palette.inkInverse,
  },
  modalCancelButton: {
    width: '100%',
    backgroundColor: palette.canvasAlt,
    borderRadius: radii.md,
    paddingVertical: spacing.md,
    alignItems: 'center',
  },
  modalCancelText: {
    ...typography.button,
    color: palette.inkBase,
  },
});
