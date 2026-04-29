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
  Linking,
} from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RouteProp } from '@react-navigation/native';
import * as Location from 'expo-location';
import * as ImagePicker from 'expo-image-picker';
import { RootStackParamList, Unit, Punch } from '../types';
import { api } from '../services/api';

type EmployeeHomeProps = {
  navigation: NativeStackNavigationProp<RootStackParamList, 'EmployeeHome'>;
  route: RouteProp<RootStackParamList, 'EmployeeHome'>;
};

export const EmployeeHomeScreen: React.FC<EmployeeHomeProps> = ({ route, navigation }) => {
  const { user, token } = route.params;

  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  // Units
  const [units, setUnits] = useState<Unit[]>([]);
  const [selectedUnit, setSelectedUnit] = useState<Unit | null>(null);
  const [showUnitModal, setShowUnitModal] = useState(false);

  // Today's punches
  const [punchCount, setPunchCount] = useState(0);
  const [punches, setPunches] = useState<Punch[]>([]);

  useEffect(() => {
    loadUnits();
    loadStatus();
  }, []);

  const loadUnits = async () => {
    try {
      const response = await api.getUserUnits(token);
      if (response.success && response.units.length > 0) {
        setUnits(response.units);
        setSelectedUnit(response.units[0]);
      }
    } catch (error: any) {
      Alert.alert('Error', 'Failed to load units: ' + error.message);
    }
  };

  const loadStatus = async () => {
    try {
      setRefreshing(true);
      const status = await api.getAttendanceStatus(token);
      if (status.hasPunches) {
        setPunchCount(status.punchCount);
        setPunches(status.punches || []);
      } else {
        setPunchCount(0);
        setPunches([]);
      }
    } catch (error: any) {
      console.log('No attendance for today yet');
    } finally {
      setRefreshing(false);
    }
  };

  const formatTime = (dateTime: string) => {
    const date = new Date(dateTime);
    return date.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    });
  };

  const handlePunch = async () => {
    if (!selectedUnit) {
      Alert.alert('Select Unit', 'Please select a unit before punching');
      return;
    }

    setLoading(true);
    try {
      // 1. Location permission + position
      const { status: locStatus } = await Location.requestForegroundPermissionsAsync();
      if (locStatus !== 'granted') {
        Alert.alert('Permission Denied', 'Location permission is required');
        setLoading(false);
        return;
      }

      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
      });
      const { latitude, longitude } = location.coords;

      // 2. Camera permission + selfie capture (proof of presence)
      const { status: camStatus } = await ImagePicker.requestCameraPermissionsAsync();
      if (camStatus !== 'granted') {
        Alert.alert(
          'Camera Required',
          'Please allow camera access to take a selfie as proof of attendance.',
        );
        setLoading(false);
        return;
      }

      const photo = await ImagePicker.launchCameraAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        cameraType: ImagePicker.CameraType.front,
        allowsEditing: false,
        quality: 0.5,        // ~50-80KB selfies after JPEG compression
        base64: true,
      });

      if (photo.canceled) {
        Alert.alert(
          'Photo Required',
          'A selfie is mandatory to mark attendance. You must take a photo to punch in or out.',
        );
        setLoading(false);
        return;
      }

      const photoBase64 = photo.assets?.[0]?.base64;
      if (!photoBase64) {
        Alert.alert(
          'Photo Failed',
          'Could not capture the photo. Attendance cannot be recorded without a selfie. Please try again.',
        );
        setLoading(false);
        return;
      }

      // 3. Submit punch with photo
      const response = await api.punch(
        token,
        selectedUnit.id,
        latitude,
        longitude,
        `data:image/jpeg;base64,${photoBase64}`,
      );

      if (response.success) {
        Alert.alert('Success!', response.message);
        loadStatus();
      }
    } catch (error: any) {
      Alert.alert('Punch Failed', error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    Alert.alert('Logout', 'Are you sure you want to logout?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Logout', onPress: () => navigation.navigate('Login') },
    ]);
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#1E68B8" />

      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <View style={styles.userIcon}>
            <Text style={styles.userIconText}>👤</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.headerTitle}>Hello, {user.name}</Text>
            <Text style={styles.headerSubtitle}>{user.email}</Text>
            <Text style={styles.headerTenant}>
              {user.tenantDb === 'solution_one' ? 'Solution One' : 'CryoGas'}
            </Text>
          </View>
        </View>
        <TouchableOpacity onPress={handleLogout} style={styles.logoutButton}>
          <Text style={styles.logoutText}>Logout</Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Unit Selector */}
        <View style={styles.unitSection}>
          <Text style={styles.sectionLabel}>Select Unit</Text>
          {units.length === 0 ? (
            <View style={styles.noUnitsCard}>
              <Text style={styles.noUnitsText}>No units assigned. Contact your admin.</Text>
            </View>
          ) : (
            <TouchableOpacity
              style={styles.unitSelector}
              onPress={() => { if (units.length > 1) setShowUnitModal(true); }}
              disabled={loading || units.length <= 1}
            >
              <View style={styles.unitSelectorContent}>
                <Text style={styles.unitIcon}>
                  {selectedUnit?.is_geofenced ? '📍' : '🏠'}
                </Text>
                <View style={{ flex: 1 }}>
                  <Text style={styles.unitName}>
                    {selectedUnit ? selectedUnit.name : 'Select Unit'}
                  </Text>
                  <Text style={styles.unitType}>
                    {selectedUnit
                      ? selectedUnit.is_geofenced
                        ? 'Geofenced (50m radius)'
                        : 'No geofence'
                      : ''}
                  </Text>
                </View>
                {units.length > 1 && (
                  <Text style={styles.dropdownIcon}>▼</Text>
                )}
              </View>
            </TouchableOpacity>
          )}
        </View>

        {/* Today's Punches */}
        {punchCount > 0 && (
          <View style={styles.statusCard}>
            <Text style={styles.statusTitle}>
              Today's Punches ({punchCount}/14)
            </Text>
            {punches.map((p, idx) => (
              <View key={idx} style={styles.punchRow}>
                <Text style={styles.punchIndex}>#{p.index}</Text>
                <Text style={styles.punchTime}>{formatTime(p.time)}</Text>
                {p.location ? (
                  <TouchableOpacity
                    style={styles.mapButton}
                    onPress={() =>
                      Linking.openURL(
                        'https://www.google.com/maps/search/?api=1&query=' + p.location
                      )
                    }
                  >
                    <Text style={styles.mapButtonText}>📍 Map</Text>
                  </TouchableOpacity>
                ) : (
                  <Text style={styles.punchLocation}>--</Text>
                )}
              </View>
            ))}
          </View>
        )}

        {/* Punch Button */}
        <View style={styles.attendanceSection}>
          <TouchableOpacity
            style={[
              styles.attendanceCircle,
              punchCount >= 14 && styles.completedCircle,
            ]}
            onPress={handlePunch}
            activeOpacity={0.9}
            disabled={loading || punchCount >= 14 || units.length === 0}
          >
            {loading ? (
              <ActivityIndicator color="#FFF" size="large" />
            ) : punchCount >= 14 ? (
              <>
                <Text style={styles.circleIcon}>✓</Text>
                <Text style={styles.circleTitle}>All Done</Text>
                <Text style={styles.circleSubtitle}>14/14 punches</Text>
              </>
            ) : (
              <>
                <Text style={styles.circleIcon}>📍</Text>
                <Text style={styles.circleTitle}>Mark Attendance</Text>
                <Text style={styles.circleSubtitle}>
                  Punch #{punchCount + 1} at {selectedUnit?.name || '...'}
                </Text>
              </>
            )}
          </TouchableOpacity>
        </View>

        {/* Refresh */}
        <TouchableOpacity
          style={styles.refreshButton}
          onPress={loadStatus}
          disabled={refreshing}
        >
          {refreshing ? (
            <ActivityIndicator color="#1E68B8" size="small" />
          ) : (
            <Text style={styles.refreshText}>Refresh Status</Text>
          )}
        </TouchableOpacity>

        {/* History */}
        <TouchableOpacity
          style={styles.historyButton}
          onPress={() => navigation.navigate('AttendanceHistory', { user, token })}
        >
          <Text style={styles.historyButtonText}>View My Attendance History</Text>
        </TouchableOpacity>
      </ScrollView>

      {/* Unit Selection Modal */}
      <Modal
        visible={showUnitModal}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowUnitModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Select Unit</Text>
            <ScrollView style={styles.unitList}>
              {units.map((unit) => (
                <TouchableOpacity
                  key={unit.id}
                  style={[
                    styles.unitItem,
                    selectedUnit?.id === unit.id && styles.unitItemSelected,
                  ]}
                  onPress={() => {
                    setSelectedUnit(unit);
                    setShowUnitModal(false);
                  }}
                >
                  <Text style={styles.unitItemIcon}>
                    {unit.is_geofenced ? '📍' : '🏠'}
                  </Text>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.unitItemName}>{unit.name}</Text>
                    <Text style={styles.unitItemType}>
                      {unit.is_geofenced ? 'Geofenced' : 'No geofence (WFH/Field)'}
                    </Text>
                  </View>
                  {selectedUnit?.id === unit.id && (
                    <Text style={styles.checkmark}>✓</Text>
                  )}
                </TouchableOpacity>
              ))}
            </ScrollView>
            <TouchableOpacity
              style={styles.modalCloseButton}
              onPress={() => setShowUnitModal(false)}
            >
              <Text style={styles.modalCloseButtonText}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
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
    justifyContent: 'space-between',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  userIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#FFF',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  userIconText: {
    fontSize: 20,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#FFF',
  },
  headerSubtitle: {
    fontSize: 12,
    color: '#E0E0E0',
    marginTop: 2,
  },
  headerTenant: {
    fontSize: 11,
    color: '#B3D9FF',
    marginTop: 2,
  },
  logoutButton: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 15,
  },
  logoutText: {
    color: '#FFF',
    fontSize: 12,
    fontWeight: '600',
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
  },
  unitSection: {
    marginTop: 20,
    marginBottom: 15,
  },
  sectionLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1E68B8',
    marginBottom: 10,
  },
  noUnitsCard: {
    backgroundColor: '#FFF3E0',
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#FF9800',
    padding: 20,
    alignItems: 'center',
  },
  noUnitsText: {
    fontSize: 14,
    color: '#E65100',
    fontWeight: '500',
    textAlign: 'center',
  },
  unitSelector: {
    backgroundColor: '#FFF',
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#1E68B8',
    padding: 15,
  },
  unitSelectorContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  unitIcon: {
    fontSize: 24,
    marginRight: 12,
  },
  unitName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  unitType: {
    fontSize: 12,
    color: '#666',
    marginTop: 2,
  },
  dropdownIcon: {
    fontSize: 12,
    color: '#1E68B8',
  },
  statusCard: {
    backgroundColor: '#FFF',
    borderRadius: 15,
    padding: 20,
    marginBottom: 15,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  statusTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1E68B8',
    marginBottom: 12,
  },
  punchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  punchIndex: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1E68B8',
    width: 30,
  },
  punchTime: {
    fontSize: 14,
    color: '#333',
    width: 100,
  },
  punchLocation: {
    fontSize: 11,
    color: '#999',
    flex: 1,
  },
  mapButton: {
    backgroundColor: '#1E68B8',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  mapButtonText: {
    color: '#FFF',
    fontSize: 11,
    fontWeight: '600',
  },
  attendanceSection: {
    alignItems: 'center',
    marginVertical: 30,
  },
  attendanceCircle: {
    width: 220,
    height: 220,
    borderRadius: 110,
    backgroundColor: '#1E68B8',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#1E68B8',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 10,
  },
  completedCircle: {
    backgroundColor: '#4CAF50',
  },
  circleIcon: {
    fontSize: 50,
    marginBottom: 10,
  },
  circleTitle: {
    fontSize: 24,
    fontWeight: '600',
    color: '#FFF',
    marginBottom: 5,
  },
  circleSubtitle: {
    fontSize: 13,
    color: '#E0E0E0',
    textAlign: 'center',
    paddingHorizontal: 20,
  },
  refreshButton: {
    backgroundColor: '#FFF',
    borderRadius: 25,
    paddingVertical: 15,
    alignItems: 'center',
    marginBottom: 15,
    borderWidth: 2,
    borderColor: '#1E68B8',
  },
  refreshText: {
    color: '#1E68B8',
    fontSize: 16,
    fontWeight: '600',
  },
  historyButton: {
    backgroundColor: '#1E68B8',
    borderRadius: 25,
    paddingVertical: 15,
    alignItems: 'center',
    marginBottom: 30,
  },
  historyButtonText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '600',
  },
  // Modal styles
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
    marginBottom: 20,
    textAlign: 'center',
  },
  unitList: {
    maxHeight: 400,
  },
  unitItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F5F5F5',
    borderRadius: 12,
    padding: 15,
    marginBottom: 10,
  },
  unitItemSelected: {
    backgroundColor: '#E3F2FD',
    borderWidth: 2,
    borderColor: '#1E68B8',
  },
  unitItemIcon: {
    fontSize: 24,
    marginRight: 12,
  },
  unitItemName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  unitItemType: {
    fontSize: 12,
    color: '#666',
    marginTop: 2,
  },
  checkmark: {
    fontSize: 20,
    color: '#1E68B8',
    fontWeight: 'bold',
  },
  modalCloseButton: {
    backgroundColor: '#E0E0E0',
    borderRadius: 10,
    padding: 15,
    marginTop: 15,
    alignItems: 'center',
  },
  modalCloseButtonText: {
    color: '#666',
    fontSize: 16,
    fontWeight: '600',
  },
});
