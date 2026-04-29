import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
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

type AddOfficeScreenProps = {
  navigation: NativeStackNavigationProp<RootStackParamList, 'AddOffice'>;
};

export const AddOfficeScreen: React.FC<AddOfficeScreenProps> = ({ navigation }) => {
  // Super Admin Authentication
  const [superAdminEmail, setSuperAdminEmail] = useState('');
  const [superAdminPassword, setSuperAdminPassword] = useState('');
  
  // Office Details
  const [officeName, setOfficeName] = useState('');
  const [officeAddress, setOfficeAddress] = useState('');
  const [latitude, setLatitude] = useState('');
  const [longitude, setLongitude] = useState('');
  const [radius, setRadius] = useState('50');
  
  // New Admin Details
  const [adminName, setAdminName] = useState('');
  const [adminEmail, setAdminEmail] = useState('');
  const [adminPassword, setAdminPassword] = useState('');
  
  // Loading States
  const [loading, setLoading] = useState(false);
  const [gettingLocation, setGettingLocation] = useState(false);

  const handleGetCurrentLocation = async () => {
    setGettingLocation(true);
    try {
      // Request permissions
      const { status } = await Location.requestForegroundPermissionsAsync();
      
      if (status !== 'granted') {
        Alert.alert(
          'Permission Denied',
          'Location permission is required to set office location automatically'
        );
        setGettingLocation(false);
        return;
      }

      // Get current location
      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
      });

      const { latitude: lat, longitude: lng } = location.coords;
      
      setLatitude(lat.toString());
      setLongitude(lng.toString());
      
      Alert.alert(
        'Location Set!',
        `Coordinates captured:\nLatitude: ${lat.toFixed(6)}\nLongitude: ${lng.toFixed(6)}`,
        [{ text: 'OK' }]
      );
    } catch (error: any) {
      Alert.alert('Error', 'Failed to get location: ' + error.message);
    } finally {
      setGettingLocation(false);
    }
  };

  const validateInputs = () => {
    // Super Admin Validation
    if (!superAdminEmail || !superAdminPassword) {
      Alert.alert('Error', 'Super Admin credentials are required');
      return false;
    }

    // Office Details Validation
    if (!officeName) {
      Alert.alert('Error', 'Office name is required');
      return false;
    }

    if (!latitude || !longitude) {
      Alert.alert('Error', 'Office location (latitude and longitude) is required');
      return false;
    }

    // Validate coordinates
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

    // New Admin Validation
    if (!adminName || !adminEmail || !adminPassword) {
      Alert.alert('Error', 'New office admin details are required');
      return false;
    }

    // Email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(adminEmail)) {
      Alert.alert('Error', 'Please enter a valid admin email address');
      return false;
    }

    return true;
  };

  const handleCreateOffice = async () => {
    if (!validateInputs()) {
      return;
    }

    setLoading(true);
    try {
      const response = await api.createOffice({
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
          'Success!',
          `Office "${officeName}" created successfully!\n\nAdmin Credentials:\nEmail: ${adminEmail}\nPassword: ${adminPassword}\n\nPlease share these credentials with the office admin.`,
          [
            {
              text: 'OK',
              onPress: () => navigation.goBack()
            }
          ]
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
      <StatusBar barStyle="light-content" backgroundColor="#1E68B8" />
      
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity 
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Text style={styles.backIcon}>←</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Add New Office</Text>
      </View>

      <ScrollView 
        style={styles.content}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Super Admin Authentication */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>🔐 Super Admin Authentication</Text>
          <Text style={styles.sectionSubtitle}>
            Only Super Admins can create new offices
          </Text>
          
          <View style={styles.inputWrapper}>
            <Text style={styles.inputIcon}>✉️</Text>
            <TextInput
              style={styles.input}
              placeholder="Super Admin Email"
              placeholderTextColor="#999"
              value={superAdminEmail}
              onChangeText={setSuperAdminEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              editable={!loading}
            />
          </View>

          <View style={styles.inputWrapper}>
            <Text style={styles.inputIcon}>🔒</Text>
            <TextInput
              style={styles.input}
              placeholder="Super Admin Password"
              placeholderTextColor="#999"
              value={superAdminPassword}
              onChangeText={setSuperAdminPassword}
              secureTextEntry
              editable={!loading}
            />
          </View>
        </View>

        {/* Office Details */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>🏢 Office Details</Text>
          
          <View style={styles.inputWrapper}>
            <Text style={styles.inputIcon}>🏢</Text>
            <TextInput
              style={styles.input}
              placeholder="Office Name (e.g., Mumbai Branch)"
              placeholderTextColor="#999"
              value={officeName}
              onChangeText={setOfficeName}
              editable={!loading}
            />
          </View>

          <View style={styles.inputWrapper}>
            <Text style={styles.inputIcon}>📍</Text>
            <TextInput
              style={styles.input}
              placeholder="Address (Optional)"
              placeholderTextColor="#999"
              value={officeAddress}
              onChangeText={setOfficeAddress}
              editable={!loading}
            />
          </View>

          <View style={styles.inputWrapper}>
            <Text style={styles.inputIcon}>📏</Text>
            <TextInput
              style={styles.input}
              placeholder="Geofence Radius (meters)"
              placeholderTextColor="#999"
              value={radius}
              onChangeText={setRadius}
              keyboardType="number-pad"
              editable={!loading}
            />
          </View>
        </View>

        {/* Location Setup */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>📍 Office Location</Text>
          <Text style={styles.sectionSubtitle}>
            Set the GPS coordinates for this office
          </Text>

          {/* Current Location Button */}
          <TouchableOpacity
            style={styles.locationButton}
            onPress={handleGetCurrentLocation}
            disabled={loading || gettingLocation}
          >
            {gettingLocation ? (
              <ActivityIndicator color="#FFF" />
            ) : (
              <>
                <Text style={styles.locationButtonIcon}>📍</Text>
                <Text style={styles.locationButtonText}>Set to Current Location</Text>
              </>
            )}
          </TouchableOpacity>

          <Text style={styles.orText}>— OR —</Text>

          {/* Manual Coordinates */}
          <View style={styles.inputWrapper}>
            <Text style={styles.inputIcon}>🌐</Text>
            <TextInput
              style={styles.input}
              placeholder="Latitude (e.g., 22.3152580)"
              placeholderTextColor="#999"
              value={latitude}
              onChangeText={setLatitude}
              keyboardType="decimal-pad"
              editable={!loading}
            />
          </View>

          <View style={styles.inputWrapper}>
            <Text style={styles.inputIcon}>🌐</Text>
            <TextInput
              style={styles.input}
              placeholder="Longitude (e.g., 73.1443666)"
              placeholderTextColor="#999"
              value={longitude}
              onChangeText={setLongitude}
              keyboardType="decimal-pad"
              editable={!loading}
            />
          </View>

          {latitude && longitude && (
            <View style={styles.coordinatesPreview}>
              <Text style={styles.coordinatesPreviewText}>
                📍 Location: {parseFloat(latitude).toFixed(6)}, {parseFloat(longitude).toFixed(6)}
              </Text>
            </View>
          )}
        </View>

        {/* New Admin Details */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>👤 New Office Admin</Text>
          <Text style={styles.sectionSubtitle}>
            Create an admin account for this office
          </Text>
          
          <View style={styles.inputWrapper}>
            <Text style={styles.inputIcon}>👤</Text>
            <TextInput
              style={styles.input}
              placeholder="Admin Name"
              placeholderTextColor="#999"
              value={adminName}
              onChangeText={setAdminName}
              editable={!loading}
            />
          </View>

          <View style={styles.inputWrapper}>
            <Text style={styles.inputIcon}>✉️</Text>
            <TextInput
              style={styles.input}
              placeholder="Admin Email"
              placeholderTextColor="#999"
              value={adminEmail}
              onChangeText={setAdminEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              editable={!loading}
            />
          </View>

          <View style={styles.inputWrapper}>
            <Text style={styles.inputIcon}>🔒</Text>
            <TextInput
              style={styles.input}
              placeholder="Admin Password"
              placeholderTextColor="#999"
              value={adminPassword}
              onChangeText={setAdminPassword}
              secureTextEntry
              editable={!loading}
            />
          </View>
        </View>

        {/* Create Button */}
        <TouchableOpacity
          style={[styles.createButton, loading && styles.createButtonDisabled]}
          onPress={handleCreateOffice}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#FFF" />
          ) : (
            <Text style={styles.createButtonText}>Create Office</Text>
          )}
        </TouchableOpacity>

        {/* Info Box */}
        <View style={styles.infoBox}>
          <Text style={styles.infoTitle}>ℹ️ Important Notes:</Text>
          <Text style={styles.infoText}>
            • Only Super Admins can create new offices
          </Text>
          <Text style={styles.infoText}>
            • Location can be set automatically or manually
          </Text>
          <Text style={styles.infoText}>
            • A new admin account will be created for this office
          </Text>
          <Text style={styles.infoText}>
            • Share the admin credentials securely
          </Text>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F5',
  },
  header: {
    backgroundColor: '#1E68B8',
    paddingTop: 50,
    paddingBottom: 20,
    paddingHorizontal: 20,
    flexDirection: 'row',
    alignItems: 'center',
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  backIcon: {
    fontSize: 24,
    color: '#FFF',
    fontWeight: '600',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#FFF',
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 20,
  },
  section: {
    marginBottom: 25,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1E68B8',
    marginBottom: 5,
  },
  sectionSubtitle: {
    fontSize: 13,
    color: '#666',
    marginBottom: 15,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF',
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#1E68B8',
    paddingHorizontal: 15,
    marginBottom: 12,
    height: 55,
  },
  inputIcon: {
    fontSize: 20,
    marginRight: 10,
  },
  input: {
    flex: 1,
    fontSize: 16,
    color: '#333',
  },
  locationButton: {
    backgroundColor: '#4CAF50',
    borderRadius: 12,
    height: 60,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 15,
    shadowColor: '#4CAF50',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.3,
    shadowRadius: 5,
    elevation: 6,
  },
  locationButtonIcon: {
    fontSize: 24,
    marginRight: 10,
  },
  locationButtonText: {
    color: '#FFF',
    fontSize: 18,
    fontWeight: '600',
  },
  orText: {
    textAlign: 'center',
    color: '#999',
    marginVertical: 10,
    fontSize: 14,
  },
  coordinatesPreview: {
    backgroundColor: '#E8F5E9',
    padding: 12,
    borderRadius: 8,
    marginTop: 5,
  },
  coordinatesPreviewText: {
    color: '#2E7D32',
    fontSize: 14,
    fontWeight: '500',
  },
  createButton: {
    backgroundColor: '#1E68B8',
    borderRadius: 30,
    height: 60,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
    shadowColor: '#1E68B8',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.3,
    shadowRadius: 5,
    elevation: 8,
  },
  createButtonDisabled: {
    opacity: 0.6,
  },
  createButtonText: {
    color: '#FFF',
    fontSize: 18,
    fontWeight: '600',
  },
  infoBox: {
    backgroundColor: '#E3F2FD',
    borderRadius: 12,
    padding: 15,
    marginBottom: 30,
    borderWidth: 1,
    borderColor: '#90CAF9',
  },
  infoTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1976D2',
    marginBottom: 10,
  },
  infoText: {
    fontSize: 13,
    color: '#1565C0',
    marginBottom: 5,
    paddingLeft: 5,
  },
});
