import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  StatusBar,
  ScrollView,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
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

type AddOfficeScreenProps = {
  navigation: NativeStackNavigationProp<RootStackParamList, 'AddOffice'>;
};

/* ────────────────────────────────────────────────────────────────────────────
 * AddOfficeScreen — legacy super-admin form (not currently routed in App.tsx).
 * Kept here for completeness; styling refactored to match the new system so
 * it's drop-in ready if/when it's re-introduced into the nav graph.
 * ──────────────────────────────────────────────────────────────────────────── */

export const AddOfficeScreen: React.FC<AddOfficeScreenProps> = ({ navigation }) => {
  // ─── Logic preserved verbatim ────────────────────────────────────────────
  const [superAdminEmail, setSuperAdminEmail] = useState('');
  const [superAdminPassword, setSuperAdminPassword] = useState('');

  const [officeName, setOfficeName] = useState('');
  const [officeAddress, setOfficeAddress] = useState('');
  const [latitude, setLatitude] = useState('');
  const [longitude, setLongitude] = useState('');
  const [radius, setRadius] = useState('50');

  const [adminName, setAdminName] = useState('');
  const [adminEmail, setAdminEmail] = useState('');
  const [adminPassword, setAdminPassword] = useState('');

  const [loading, setLoading] = useState(false);
  const [gettingLocation, setGettingLocation] = useState(false);
  const [focusedField, setFocusedField] = useState<string | null>(null);

  const handleGetCurrentLocation = async () => {
    setGettingLocation(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Denied', 'Location permission is required to set office location automatically');
        setGettingLocation(false);
        return;
      }

      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
      });
      const { latitude: lat, longitude: lng } = location.coords;

      setLatitude(lat.toString());
      setLongitude(lng.toString());

      Alert.alert(
        'Location set',
        `Latitude: ${lat.toFixed(6)}\nLongitude: ${lng.toFixed(6)}`,
      );
    } catch (error: any) {
      Alert.alert('Error', 'Failed to get location: ' + error.message);
    } finally {
      setGettingLocation(false);
    }
  };

  const validateInputs = () => {
    if (!superAdminEmail || !superAdminPassword) {
      Alert.alert('Error', 'Super Admin credentials are required');
      return false;
    }
    if (!officeName) {
      Alert.alert('Error', 'Office name is required');
      return false;
    }
    if (!latitude || !longitude) {
      Alert.alert('Error', 'Office location (latitude and longitude) is required');
      return false;
    }
    const lat = parseFloat(latitude);
    const lng = parseFloat(longitude);
    if (isNaN(lat) || lat < -90 || lat > 90) {
      Alert.alert('Error', 'Invalid latitude. Must be between -90 and 90');
      return false;
    }
    if (isNaN(lng) || lng < -180 || lng > 180) {
      Alert.alert('Error', 'Invalid longitude. Must be between -180 and 180');
      return false;
    }
    if (!adminName || !adminEmail || !adminPassword) {
      Alert.alert('Error', 'New office admin details are required');
      return false;
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(adminEmail)) {
      Alert.alert('Error', 'Please enter a valid admin email address');
      return false;
    }
    return true;
  };

  const handleCreateOffice = async () => {
    if (!validateInputs()) return;

    setLoading(true);
    try {
      const response = await (api as any).createOffice({
        name: officeName,
        latitude: parseFloat(latitude),
        longitude: parseFloat(longitude),
        address: officeAddress,
        radius: parseInt(radius) || 50,
        admin_name: adminName,
        admin_email: adminEmail,
        admin_password: adminPassword,
        super_admin_email: superAdminEmail,
        super_admin_password: superAdminPassword,
      });

      if (response.success) {
        Alert.alert(
          'Office created',
          `"${officeName}" is live.\n\nAdmin credentials:\n${adminEmail} / ${adminPassword}\n\nShare these securely.`,
          [{ text: 'OK', onPress: () => navigation.goBack() }],
        );
      }
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to create office');
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
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
        <Text style={styles.headerTitle}>New office</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView
        style={styles.content}
        contentContainerStyle={styles.contentInner}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* ╭───── Super admin auth ─────╮ */}
        <Section
          title="Super admin authentication"
          hint="Only Super Admins can provision new offices."
        >
          <Field label="Super admin email">
            <TextInput
              style={[styles.input, focusedField === 'sa-email' && styles.inputFocused]}
              placeholder="superadmin@company.com"
              placeholderTextColor={palette.inkSoft}
              value={superAdminEmail}
              onChangeText={setSuperAdminEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              editable={!loading}
              onFocus={() => setFocusedField('sa-email')}
              onBlur={() => setFocusedField(null)}
            />
          </Field>
          <Field label="Password">
            <TextInput
              style={[styles.input, focusedField === 'sa-pass' && styles.inputFocused]}
              placeholder="Your password"
              placeholderTextColor={palette.inkSoft}
              value={superAdminPassword}
              onChangeText={setSuperAdminPassword}
              secureTextEntry
              editable={!loading}
              onFocus={() => setFocusedField('sa-pass')}
              onBlur={() => setFocusedField(null)}
            />
          </Field>
        </Section>

        {/* ╭───── Office details ─────╮ */}
        <Section title="Office details">
          <Field label="Name">
            <TextInput
              style={[styles.input, focusedField === 'name' && styles.inputFocused]}
              placeholder="e.g. Mumbai Branch"
              placeholderTextColor={palette.inkSoft}
              value={officeName}
              onChangeText={setOfficeName}
              editable={!loading}
              onFocus={() => setFocusedField('name')}
              onBlur={() => setFocusedField(null)}
            />
          </Field>
          <Field label="Address (optional)">
            <TextInput
              style={[styles.input, focusedField === 'addr' && styles.inputFocused]}
              placeholder="Street, City"
              placeholderTextColor={palette.inkSoft}
              value={officeAddress}
              onChangeText={setOfficeAddress}
              editable={!loading}
              onFocus={() => setFocusedField('addr')}
              onBlur={() => setFocusedField(null)}
            />
          </Field>
          <Field label="Geofence radius (m)">
            <TextInput
              style={[styles.input, focusedField === 'radius' && styles.inputFocused]}
              placeholder="50"
              placeholderTextColor={palette.inkSoft}
              value={radius}
              onChangeText={setRadius}
              keyboardType="number-pad"
              editable={!loading}
              onFocus={() => setFocusedField('radius')}
              onBlur={() => setFocusedField(null)}
            />
          </Field>
        </Section>

        {/* ╭───── Location ─────╮ */}
        <Section title="Location" hint="Set the GPS coordinates for this office.">
          <KineticPressable
            style={styles.gpsButton}
            onPress={handleGetCurrentLocation}
            disabled={loading || gettingLocation}
            accessibilityLabel="Use current location"
          >
            {gettingLocation ? (
              <ActivityIndicator color={palette.inkInverse} />
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

          <View style={styles.coordsRow}>
            <Field label="Latitude" style={styles.coordsField}>
              <TextInput
                style={[styles.input, focusedField === 'lat' && styles.inputFocused]}
                placeholder="22.3152"
                placeholderTextColor={palette.inkSoft}
                value={latitude}
                onChangeText={setLatitude}
                keyboardType="decimal-pad"
                editable={!loading}
                onFocus={() => setFocusedField('lat')}
                onBlur={() => setFocusedField(null)}
              />
            </Field>
            <Field label="Longitude" style={styles.coordsField}>
              <TextInput
                style={[styles.input, focusedField === 'lng' && styles.inputFocused]}
                placeholder="73.1443"
                placeholderTextColor={palette.inkSoft}
                value={longitude}
                onChangeText={setLongitude}
                keyboardType="decimal-pad"
                editable={!loading}
                onFocus={() => setFocusedField('lng')}
                onBlur={() => setFocusedField(null)}
              />
            </Field>
          </View>

          {!!latitude && !!longitude && (
            <View style={styles.coordsPreview}>
              <Text style={styles.coordsPreviewText}>
                ⌖  {parseFloat(latitude).toFixed(6)}, {parseFloat(longitude).toFixed(6)}
              </Text>
            </View>
          )}
        </Section>

        {/* ╭───── New admin ─────╮ */}
        <Section title="Office admin" hint="Credentials for the local admin account.">
          <Field label="Admin name">
            <TextInput
              style={[styles.input, focusedField === 'admin-name' && styles.inputFocused]}
              placeholder="Full name"
              placeholderTextColor={palette.inkSoft}
              value={adminName}
              onChangeText={setAdminName}
              editable={!loading}
              onFocus={() => setFocusedField('admin-name')}
              onBlur={() => setFocusedField(null)}
            />
          </Field>
          <Field label="Admin email">
            <TextInput
              style={[styles.input, focusedField === 'admin-email' && styles.inputFocused]}
              placeholder="admin@company.com"
              placeholderTextColor={palette.inkSoft}
              value={adminEmail}
              onChangeText={setAdminEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              editable={!loading}
              onFocus={() => setFocusedField('admin-email')}
              onBlur={() => setFocusedField(null)}
            />
          </Field>
          <Field label="Admin password">
            <TextInput
              style={[styles.input, focusedField === 'admin-pass' && styles.inputFocused]}
              placeholder="Initial password"
              placeholderTextColor={palette.inkSoft}
              value={adminPassword}
              onChangeText={setAdminPassword}
              secureTextEntry
              editable={!loading}
              onFocus={() => setFocusedField('admin-pass')}
              onBlur={() => setFocusedField(null)}
            />
          </Field>
        </Section>

        {/* ╭───── Create CTA ─────╮ */}
        <KineticPressable
          style={[styles.createButton, loading && styles.createButtonDisabled]}
          onPress={handleCreateOffice}
          disabled={loading}
          accessibilityLabel="Create office"
        >
          {loading ? (
            <ActivityIndicator color={palette.inkInverse} />
          ) : (
            <Text style={styles.createButtonText}>Create office</Text>
          )}
        </KineticPressable>

        {/* ╭───── Info notes ─────╮ */}
        <View style={styles.infoBox}>
          <Text style={styles.infoTitle}>Notes</Text>
          <InfoLine>Only Super Admins can create new offices.</InfoLine>
          <InfoLine>Coordinates can be set automatically or manually.</InfoLine>
          <InfoLine>A new admin account will be provisioned for this office.</InfoLine>
          <InfoLine>Share the generated credentials over a secure channel.</InfoLine>
        </View>

        <View style={{ height: spacing['4xl'] }} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

/* ── Atoms co-located for clarity ─────────────────────────────────────────── */
const Section: React.FC<{
  title: string;
  hint?: string;
  children: React.ReactNode;
}> = ({ title, hint, children }) => (
  <View style={styles.section}>
    <Text style={styles.sectionLabel}>{title}</Text>
    {hint && <Text style={styles.sectionHint}>{hint}</Text>}
    {children}
  </View>
);

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

const InfoLine: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <View style={styles.infoLine}>
    <View style={styles.infoBullet} />
    <Text style={styles.infoText}>{children}</Text>
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

  // ── Section ──────────────────────────────────────────────────────────────
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
  },

  // ── Field ────────────────────────────────────────────────────────────────
  fieldWrapper: { marginBottom: spacing.md },
  fieldLabel: {
    ...typography.caption,
    color: palette.inkMuted,
    marginBottom: spacing.sm,
    letterSpacing: 0.3,
  },

  // ── Inputs ───────────────────────────────────────────────────────────────
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
    backgroundColor: palette.successBase,
    borderRadius: radii.lg,
    paddingVertical: spacing.lg,
    marginBottom: spacing.md,
    ...elevation.level2,
  },
  gpsIconWrap: {
    width: 28, height: 28,
    borderRadius: radii.pill,
    backgroundColor: 'rgba(250, 250, 248, 0.22)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  gpsIcon: { fontSize: 16, color: palette.inkInverse },
  gpsText: { ...typography.buttonLarge, color: palette.inkInverse },
  orDivider: {
    ...typography.overline,
    color: palette.inkSoft,
    textAlign: 'center',
    marginBottom: spacing.md,
    letterSpacing: 1.2,
  },

  // ── Coords pair ──────────────────────────────────────────────────────────
  coordsRow: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  coordsField: { flex: 1 },
  coordsPreview: {
    backgroundColor: palette.successSoft,
    padding: spacing.md,
    borderRadius: radii.md,
    marginTop: spacing.sm,
  },
  coordsPreviewText: {
    ...typography.caption,
    color: palette.successInk,
    fontWeight: '600',
    fontFamily: 'monospace',
  },

  // ── Create button ────────────────────────────────────────────────────────
  createButton: {
    backgroundColor: palette.brandDeep,
    borderRadius: radii.lg,
    paddingVertical: spacing.lg,
    alignItems: 'center',
    marginBottom: spacing.lg,
    ...elevation.level3,
  },
  createButtonDisabled: { opacity: 0.55 },
  createButtonText: {
    ...typography.buttonLarge,
    color: palette.inkInverse,
  },

  // ── Info box (bullet list) ───────────────────────────────────────────────
  infoBox: {
    backgroundColor: palette.brandSoft,
    borderRadius: radii.md,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: palette.brandSoftBorder,
  },
  infoTitle: {
    ...typography.overline,
    color: palette.brandInk,
    marginBottom: spacing.sm,
  },
  infoLine: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.xs,
  },
  infoBullet: {
    width: 4, height: 4,
    borderRadius: 2,
    backgroundColor: palette.brandDeep,
  },
  infoText: {
    ...typography.caption,
    color: palette.brandInk,
    flex: 1,
  },
});
