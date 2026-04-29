import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  StatusBar,
  ScrollView,
  Linking,
  Alert,
} from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RouteProp } from '@react-navigation/native';
import { RootStackParamList } from '../types';

type AttendanceLocationDetailProps = {
  navigation: NativeStackNavigationProp<RootStackParamList, 'AttendanceLocationDetail'>;
  route: RouteProp<RootStackParamList, 'AttendanceLocationDetail'>;
};

export const AttendanceLocationDetailScreen: React.FC<AttendanceLocationDetailProps> = ({
  navigation,
  route,
}) => {
  const { record, employeeName } = route.params;

  // The backend returns check-in coords as "latitude"/"longitude" 
  // and check-out coords as "check_out_latitude"/"check_out_longitude"
  // Also handle the alias "check_in_latitude"/"check_in_longitude" from history endpoint
  const checkInLat = record.check_in_latitude ?? record.latitude ?? null;
  const checkInLng = record.check_in_longitude ?? record.longitude ?? null;
  const checkOutLat = record.check_out_latitude ?? null;
  const checkOutLng = record.check_out_longitude ?? null;

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const formatTime = (dateTime: string) => {
    if (!dateTime) return 'N/A';
    const date = new Date(dateTime);
    return date.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    });
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'present':
        return '#4CAF50';
      case 'late':
        return '#FF9800';
      case 'absent':
        return '#D32F2F';
      default:
        return '#666';
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'present':
        return 'On Time';
      case 'late':
        return 'Late';
      case 'absent':
        return 'Absent';
      default:
        return status;
    }
  };

  const openInGoogleMaps = (lat: number, lng: number, label: string) => {
    const url = `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`;
    Linking.canOpenURL(url)
      .then((supported) => {
        if (supported) {
          Linking.openURL(url);
        } else {
          Alert.alert('Error', 'Unable to open Google Maps');
        }
      })
      .catch(() => Alert.alert('Error', 'Unable to open Google Maps'));
  };

  const hasCheckInCoords = checkInLat != null && checkInLng != null;
  const hasCheckOutCoords = checkOutLat != null && checkOutLng != null;

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#1E68B8" />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Text style={styles.backIcon}>←</Text>
        </TouchableOpacity>
        <View style={styles.headerInfo}>
          <Text style={styles.headerTitle}>Attendance Details</Text>
          <Text style={styles.headerSubtitle}>{employeeName}</Text>
        </View>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Date & Status Card */}
        <View style={styles.dateCard}>
          <Text style={styles.dateText}>{formatDate(record.date)}</Text>
          <View
            style={[
              styles.statusBadge,
              { backgroundColor: getStatusColor(record.status) },
            ]}
          >
            <Text style={styles.statusBadgeText}>
              {getStatusLabel(record.status)}
            </Text>
          </View>
        </View>

        {/* Check-In Section */}
        <View style={styles.sectionCard}>
          <View style={styles.sectionHeader}>
            <View style={[styles.sectionDot, { backgroundColor: '#4CAF50' }]} />
            <Text style={styles.sectionTitle}>Check-In</Text>
          </View>

          <View style={styles.timeRow}>
            <Text style={styles.label}>Time</Text>
            <Text style={styles.value}>
              {formatTime(record.check_in_time)}
            </Text>
          </View>

          {hasCheckInCoords ? (
            <>
              <View style={styles.coordsRow}>
                <Text style={styles.label}>Coordinates</Text>
                <Text style={styles.coordsValue}>
                  {Number(checkInLat).toFixed(6)}, {Number(checkInLng).toFixed(6)}
                </Text>
              </View>

              <TouchableOpacity
                style={styles.mapButton}
                onPress={() =>
                  openInGoogleMaps(checkInLat, checkInLng, 'Check-In Location')
                }
              >
                <Text style={styles.mapButtonIcon}>📍</Text>
                <Text style={styles.mapButtonText}>
                  View Check-In Location on Map
                </Text>
              </TouchableOpacity>
            </>
          ) : (
            <View style={styles.noCoordsRow}>
              <Text style={styles.noCoordsText}>
                Location data not available
              </Text>
            </View>
          )}
        </View>

        {/* Check-Out Section */}
        <View style={styles.sectionCard}>
          <View style={styles.sectionHeader}>
            <View style={[styles.sectionDot, { backgroundColor: '#D32F2F' }]} />
            <Text style={styles.sectionTitle}>Check-Out</Text>
          </View>

          {record.check_out_time ? (
            <>
              <View style={styles.timeRow}>
                <Text style={styles.label}>Time</Text>
                <Text style={styles.value}>
                  {formatTime(record.check_out_time)}
                </Text>
              </View>

              {hasCheckOutCoords ? (
                <>
                  <View style={styles.coordsRow}>
                    <Text style={styles.label}>Coordinates</Text>
                    <Text style={styles.coordsValue}>
                      {Number(checkOutLat).toFixed(6)},{' '}
                      {Number(checkOutLng).toFixed(6)}
                    </Text>
                  </View>

                  {record.checkout_within_geofence !== null &&
                    record.checkout_within_geofence !== undefined && (
                      <View style={styles.geofenceRow}>
                        <Text style={styles.label}>Geofence</Text>
                        <View
                          style={[
                            styles.geofenceBadge,
                            {
                              backgroundColor: record.checkout_within_geofence
                                ? '#E8F5E9'
                                : '#FFEBEE',
                            },
                          ]}
                        >
                          <Text
                            style={[
                              styles.geofenceBadgeText,
                              {
                                color: record.checkout_within_geofence
                                  ? '#2E7D32'
                                  : '#C62828',
                              },
                            ]}
                          >
                            {record.checkout_within_geofence
                              ? '✓ Within Office Area'
                              : '✕ Outside Office Area'}
                          </Text>
                        </View>
                      </View>
                    )}

                  <TouchableOpacity
                    style={[styles.mapButton, { backgroundColor: '#D32F2F' }]}
                    onPress={() =>
                      openInGoogleMaps(
                        checkOutLat,
                        checkOutLng,
                        'Check-Out Location'
                      )
                    }
                  >
                    <Text style={styles.mapButtonIcon}>📍</Text>
                    <Text style={styles.mapButtonText}>
                      View Check-Out Location on Map
                    </Text>
                  </TouchableOpacity>
                </>
              ) : (
                <View style={styles.noCoordsRow}>
                  <Text style={styles.noCoordsText}>
                    Location data not available
                  </Text>
                </View>
              )}
            </>
          ) : (
            <View style={styles.noCoordsRow}>
              <Text style={styles.noCoordsText}>Not checked out yet</Text>
            </View>
          )}
        </View>

        {/* Duration */}
        {record.duration_minutes != null && (
          <View style={styles.durationCard}>
            <Text style={styles.durationLabel}>Total Duration</Text>
            <Text style={styles.durationValue}>
              {Math.floor(record.duration_minutes / 60)}h{' '}
              {record.duration_minutes % 60}m
            </Text>
          </View>
        )}
      </ScrollView>
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
  headerInfo: {
    flex: 1,
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
  content: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 20,
  },
  dateCard: {
    backgroundColor: '#FFF',
    borderRadius: 12,
    padding: 20,
    marginBottom: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  dateText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    flex: 1,
  },
  statusBadge: {
    borderRadius: 20,
    paddingVertical: 6,
    paddingHorizontal: 14,
  },
  statusBadgeText: {
    color: '#FFF',
    fontSize: 12,
    fontWeight: '600',
  },
  sectionCard: {
    backgroundColor: '#FFF',
    borderRadius: 12,
    padding: 20,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  sectionDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginRight: 10,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
  },
  timeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  label: {
    fontSize: 14,
    color: '#888',
  },
  value: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  coordsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  coordsValue: {
    fontSize: 13,
    color: '#555',
    fontFamily: 'monospace',
  },
  mapButton: {
    backgroundColor: '#4CAF50',
    borderRadius: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    paddingHorizontal: 20,
    marginTop: 4,
  },
  mapButtonIcon: {
    fontSize: 18,
    marginRight: 8,
  },
  mapButtonText: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: '600',
  },
  noCoordsRow: {
    paddingVertical: 12,
    alignItems: 'center',
  },
  noCoordsText: {
    fontSize: 14,
    color: '#999',
    fontStyle: 'italic',
  },
  geofenceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  geofenceBadge: {
    borderRadius: 8,
    paddingVertical: 4,
    paddingHorizontal: 10,
  },
  geofenceBadgeText: {
    fontSize: 12,
    fontWeight: '600',
  },
  durationCard: {
    backgroundColor: '#1E68B8',
    borderRadius: 12,
    padding: 20,
    marginBottom: 30,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  durationLabel: {
    fontSize: 16,
    color: '#E0E0E0',
  },
  durationValue: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#FFF',
  },
});
