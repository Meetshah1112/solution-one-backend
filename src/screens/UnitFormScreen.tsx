import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
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

type UnitFormProps = {
  navigation: NativeStackNavigationProp<RootStackParamList, 'UnitForm'>;
  route: RouteProp<RootStackParamList, 'UnitForm'>;
};

export const UnitFormScreen: React.FC<UnitFormProps> = ({ navigation, route }) => {
  const { user, token, unit } = route.params;
  const isEditing = !!unit;

  // Form state
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

  // UI state
  const [fetchingGPS, setFetchingGPS] = useState(false);
  const [saving, setSaving] = useState(false);

  // Re-auth modal state
  const [showReAuthModal, setShowReAuthModal] = useState(false);
  const [password, setPassword] = useState('');
  const [verifying, setVerifying] = useState(false);

  // ---- GPS: Set to Current Location ----
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

  // ---- Validate form before showing re-auth ----
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

    // Open re-authentication modal
    setPassword('');
    setShowReAuthModal(true);
  };

  // ---- Re-auth then save ----
  const handleConfirmSave = async () => {
    if (!password.trim()) {
      Alert.alert('Required', 'Please enter your password.');
      return;
    }

    setVerifying(true);
    try {
      // Step 1: Re-verify password
      await api.reverifyPassword(token, password);

      // Step 2: Create or update unit
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
        Alert.alert('Success', response.message, [
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
      <StatusBar barStyle="light-content" backgroundColor="#1E68B8" />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Text style={styles.backText}>{'< Back'}</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>
          {isEditing ? 'Edit Unit' : 'Add New Unit'}
        </Text>
        <View style={{ width: 60 }} />
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          style={styles.content}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Unit Name */}
          <Text style={styles.label}>Unit Name</Text>
          <TextInput
            style={styles.input}
            value={name}
            onChangeText={setName}
            placeholder="e.g. Branch A, Work From Home"
            placeholderTextColor="#AAA"
          />

          {/* GPS Button */}
          <TouchableOpacity
            style={styles.gpsButton}
            onPress={handleSetCurrentLocation}
            disabled={fetchingGPS}
          >
            {fetchingGPS ? (
              <ActivityIndicator color="#FFF" size="small" />
            ) : (
              <>
                <Text style={styles.gpsIcon}>📍</Text>
                <Text style={styles.gpsText}>Set to Current Location</Text>
              </>
            )}
          </TouchableOpacity>

          {/* Latitude */}
          <Text style={styles.label}>Latitude</Text>
          <TextInput
            style={styles.input}
            value={latitude}
            onChangeText={setLatitude}
            placeholder="e.g. 28.7041"
            placeholderTextColor="#AAA"
            keyboardType="numeric"
          />

          {/* Longitude */}
          <Text style={styles.label}>Longitude</Text>
          <TextInput
            style={styles.input}
            value={longitude}
            onChangeText={setLongitude}
            placeholder="e.g. 77.1025"
            placeholderTextColor="#AAA"
            keyboardType="numeric"
          />

          {/* Is Geofenced Toggle */}
          <View style={styles.toggleRow}>
            <View style={styles.toggleInfo}>
              <Text style={styles.toggleLabel}>Is Geofenced?</Text>
              <Text style={styles.toggleHint}>
                {isGeofenced
                  ? 'Employees must be within 50m to punch'
                  : 'No distance check (WFH / Field Work)'}
              </Text>
            </View>
            <Switch
              value={isGeofenced}
              onValueChange={setIsGeofenced}
              trackColor={{ false: '#DDD', true: '#81C784' }}
              thumbColor={isGeofenced ? '#4CAF50' : '#999'}
            />
          </View>

          {/* Save Button */}
          <TouchableOpacity
            style={[styles.saveButton, saving && styles.saveButtonDisabled]}
            onPress={handleSavePress}
            disabled={saving}
          >
            {saving ? (
              <ActivityIndicator color="#FFF" size="small" />
            ) : (
              <Text style={styles.saveButtonText}>
                {isEditing ? 'Update Unit' : 'Create Unit'}
              </Text>
            )}
          </TouchableOpacity>

          <View style={{ height: 40 }} />
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Re-Authentication Modal */}
      <Modal
        visible={showReAuthModal}
        transparent={true}
        animationType="fade"
        onRequestClose={() => {
          if (!verifying) setShowReAuthModal(false);
        }}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Confirm Your Identity</Text>
            <Text style={styles.modalSubtitle}>
              Please re-enter your password to {isEditing ? 'update' : 'create'} this unit.
            </Text>

            <TextInput
              style={styles.modalInput}
              value={password}
              onChangeText={setPassword}
              placeholder="Enter your password"
              placeholderTextColor="#AAA"
              secureTextEntry
              autoFocus
              editable={!verifying}
            />

            <TouchableOpacity
              style={[styles.modalConfirmButton, verifying && styles.saveButtonDisabled]}
              onPress={handleConfirmSave}
              disabled={verifying}
            >
              {verifying ? (
                <ActivityIndicator color="#FFF" size="small" />
              ) : (
                <Text style={styles.modalConfirmText}>Verify & Save</Text>
              )}
            </TouchableOpacity>

            <TouchableOpacity
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
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F5F5F5' },
  header: {
    backgroundColor: '#1E68B8',
    paddingTop: 50,
    paddingBottom: 18,
    paddingHorizontal: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  backButton: { paddingVertical: 4, paddingRight: 10 },
  backText: { color: '#FFF', fontSize: 15, fontWeight: '600' },
  headerTitle: { fontSize: 18, fontWeight: '700', color: '#FFF' },
  content: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 25,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
    marginTop: 16,
  },
  input: {
    backgroundColor: '#FFF',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#DDD',
    paddingHorizontal: 15,
    paddingVertical: 13,
    fontSize: 15,
    color: '#333',
  },
  gpsButton: {
    backgroundColor: '#1E68B8',
    borderRadius: 12,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 20,
    marginBottom: 5,
    elevation: 3,
    shadowColor: '#1E68B8',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
  },
  gpsIcon: {
    fontSize: 20,
    marginRight: 10,
  },
  gpsText: {
    fontSize: 16,
    color: '#FFF',
    fontWeight: '700',
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF',
    borderRadius: 12,
    padding: 16,
    marginTop: 20,
    borderWidth: 1,
    borderColor: '#DDD',
  },
  toggleInfo: { flex: 1, marginRight: 10 },
  toggleLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: '#333',
  },
  toggleHint: {
    fontSize: 12,
    color: '#888',
    marginTop: 3,
  },
  saveButton: {
    backgroundColor: '#4CAF50',
    borderRadius: 12,
    padding: 18,
    alignItems: 'center',
    marginTop: 30,
    elevation: 3,
    shadowColor: '#4CAF50',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
  },
  saveButtonDisabled: {
    opacity: 0.6,
  },
  saveButtonText: {
    fontSize: 17,
    color: '#FFF',
    fontWeight: '700',
  },
  // Re-Auth Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: '#FFF',
    borderRadius: 20,
    padding: 25,
    width: '85%',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1E68B8',
    textAlign: 'center',
    marginBottom: 8,
  },
  modalSubtitle: {
    fontSize: 13,
    color: '#666',
    textAlign: 'center',
    marginBottom: 20,
    lineHeight: 18,
  },
  modalInput: {
    backgroundColor: '#F5F5F5',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#DDD',
    paddingHorizontal: 15,
    paddingVertical: 13,
    fontSize: 15,
    color: '#333',
    marginBottom: 16,
  },
  modalConfirmButton: {
    backgroundColor: '#4CAF50',
    borderRadius: 10,
    padding: 15,
    alignItems: 'center',
    marginBottom: 10,
  },
  modalConfirmText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '700',
  },
  modalCancelButton: {
    backgroundColor: '#E0E0E0',
    borderRadius: 10,
    padding: 13,
    alignItems: 'center',
  },
  modalCancelText: {
    color: '#666',
    fontSize: 14,
    fontWeight: '600',
  },
});
