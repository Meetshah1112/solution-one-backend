import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  StatusBar,
  ScrollView,
  ActivityIndicator,
  Alert,
  Image,
  Linking,
  Modal,
} from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RouteProp } from '@react-navigation/native';
import { RootStackParamList, Punch } from '../types';
import { api } from '../services/api';

type EmployeeDetailProps = {
  navigation: NativeStackNavigationProp<RootStackParamList, 'EmployeeDetail'>;
  route: RouteProp<RootStackParamList, 'EmployeeDetail'>;
};

export const EmployeeDetailScreen: React.FC<EmployeeDetailProps> = ({
  navigation,
  route,
}) => {
  const { user, token, employeeId, employeeName, employeeEmail, isActive, date } =
    route.params;

  const [loading, setLoading] = useState(true);
  const [punches, setPunches] = useState<Punch[]>([]);
  const [zoomedPhoto, setZoomedPhoto] = useState<string | null>(null);

  useEffect(() => {
    loadDetail();
  }, []);

  const loadDetail = async () => {
    try {
      setLoading(true);
      const res = await api.getEmployeePunches(token, employeeId, date);
      if (res.success) {
        setPunches(res.punches || []);
      }
    } catch (error: any) {
      Alert.alert('Error', error.message);
    } finally {
      setLoading(false);
    }
  };

  const formatTime = (dateTime: string) => {
    const d = new Date(dateTime);
    return d.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    });
  };

  const openMap = (location: string) => {
    Linking.openURL('https://www.google.com/maps/search/?api=1&query=' + location);
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#1E68B8" />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
          <Text style={styles.backIcon}>←</Text>
        </TouchableOpacity>
        <View style={styles.headerInfo}>
          <View style={styles.headerNameRow}>
            <Text style={styles.headerTitle} numberOfLines={1}>
              {employeeName}
            </Text>
            <View
              style={[
                styles.statusBadge,
                isActive ? styles.activeBadge : styles.blockedBadge,
              ]}
            >
              <Text
                style={[
                  styles.statusBadgeText,
                  { color: isActive ? '#2E7D32' : '#C62828' },
                ]}
              >
                {isActive ? 'Active' : 'Blocked'}
              </Text>
            </View>
          </View>
          <Text style={styles.headerSubtitle}>{employeeEmail}</Text>
          <Text style={styles.headerDate}>📅 {date}</Text>
        </View>
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#1E68B8" />
          <Text style={styles.loadingText}>Loading punches...</Text>
        </View>
      ) : (
        <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
          {/* Stats */}
          <View style={styles.statsBar}>
            <View style={styles.statBox}>
              <Text style={styles.statNumber}>{punches.length}</Text>
              <Text style={styles.statLabel}>Punches</Text>
            </View>
            <View style={styles.statBox}>
              <Text style={styles.statNumber}>
                {punches.filter((p) => p.photo).length}
              </Text>
              <Text style={styles.statLabel}>With Photo</Text>
            </View>
            <View style={styles.statBox}>
              <Text style={styles.statNumber}>
                {punches.filter((p) => p.location).length}
              </Text>
              <Text style={styles.statLabel}>With Location</Text>
            </View>
          </View>

          {/* Punches */}
          <Text style={styles.sectionTitle}>Punch Records</Text>

          {punches.length === 0 ? (
            <View style={styles.emptyCard}>
              <Text style={styles.emptyIcon}>🚫</Text>
              <Text style={styles.emptyText}>No punches recorded for this date</Text>
            </View>
          ) : (
            punches.map((p) => (
              <View key={p.index} style={styles.punchCard}>
                {/* Top row */}
                <View style={styles.punchTopRow}>
                  <View style={styles.punchIndexBadge}>
                    <Text style={styles.punchIndexText}>#{p.index}</Text>
                  </View>
                  <Text style={styles.punchTime}>{formatTime(p.time)}</Text>
                  {p.location ? (
                    <TouchableOpacity
                      style={styles.mapButton}
                      onPress={() => openMap(p.location!)}
                    >
                      <Text style={styles.mapButtonText}>📍 Map</Text>
                    </TouchableOpacity>
                  ) : (
                    <Text style={styles.noLocation}>No GPS</Text>
                  )}
                </View>

                {/* Photo */}
                {p.photo ? (
                  <TouchableOpacity onPress={() => setZoomedPhoto(p.photo!)}>
                    <Image
                      source={{ uri: p.photo }}
                      style={styles.punchPhoto}
                      resizeMode="cover"
                    />
                    <Text style={styles.tapHint}>Tap photo to zoom</Text>
                  </TouchableOpacity>
                ) : (
                  <View style={styles.noPhotoBox}>
                    <Text style={styles.noPhotoText}>📷 No photo captured</Text>
                  </View>
                )}
              </View>
            ))
          )}

          {/* Branch Permissions on its own */}
          <TouchableOpacity
            style={styles.branchPermsButton}
            onPress={() =>
              navigation.navigate('BranchPermissions', {
                user,
                token,
                employeeId,
                employeeName,
              })
            }
          >
            <Text style={styles.branchPermsIcon}>🔐</Text>
            <View style={{ flex: 1 }}>
              <Text style={styles.branchPermsText}>Branch Permissions</Text>
              <Text style={styles.branchPermsHint}>
                Manage which branches this employee can punch from
              </Text>
            </View>
            <Text style={styles.branchPermsArrow}>›</Text>
          </TouchableOpacity>

          <View style={{ height: 30 }} />
        </ScrollView>
      )}

      {/* Photo zoom modal */}
      <Modal
        visible={zoomedPhoto !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setZoomedPhoto(null)}
      >
        <View style={styles.modalOverlay}>
          <TouchableOpacity
            style={styles.modalCloseArea}
            activeOpacity={1}
            onPress={() => setZoomedPhoto(null)}
          >
            {zoomedPhoto && (
              <Image
                source={{ uri: zoomedPhoto }}
                style={styles.zoomedImage}
                resizeMode="contain"
              />
            )}
            <Text style={styles.modalHint}>Tap anywhere to close</Text>
          </TouchableOpacity>
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
  backIcon: { fontSize: 24, color: '#FFF', fontWeight: '600' },
  headerInfo: { flex: 1 },
  headerNameRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap' },
  headerTitle: { fontSize: 18, fontWeight: '600', color: '#FFF', flexShrink: 1 },
  statusBadge: {
    marginLeft: 8,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  activeBadge: { backgroundColor: '#C8E6C9' },
  blockedBadge: { backgroundColor: '#FFCDD2' },
  statusBadgeText: { fontSize: 10, fontWeight: '700' },
  headerSubtitle: { fontSize: 12, color: '#E0E0E0', marginTop: 2 },
  headerDate: { fontSize: 11, color: '#B3D9FF', marginTop: 4 },
  content: { flex: 1, paddingHorizontal: 20 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  loadingText: { marginTop: 12, color: '#666' },
  statsBar: {
    flexDirection: 'row',
    backgroundColor: '#FFF',
    borderRadius: 12,
    padding: 14,
    marginTop: 18,
    marginBottom: 18,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 3,
  },
  statBox: { flex: 1, alignItems: 'center' },
  statNumber: { fontSize: 22, fontWeight: 'bold', color: '#1E68B8' },
  statLabel: { fontSize: 11, color: '#666', marginTop: 2 },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1E68B8',
    marginBottom: 10,
  },
  emptyCard: {
    backgroundColor: '#FFF',
    padding: 30,
    borderRadius: 12,
    alignItems: 'center',
  },
  emptyIcon: { fontSize: 36, marginBottom: 8 },
  emptyText: { color: '#666', fontSize: 14 },
  punchCard: {
    backgroundColor: '#FFF',
    borderRadius: 14,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  punchTopRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  punchIndexBadge: {
    backgroundColor: '#1E68B8',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    marginRight: 12,
  },
  punchIndexText: { color: '#FFF', fontSize: 12, fontWeight: '700' },
  punchTime: { flex: 1, fontSize: 16, fontWeight: '600', color: '#333' },
  mapButton: {
    backgroundColor: '#1E68B8',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  mapButtonText: { color: '#FFF', fontSize: 12, fontWeight: '600' },
  noLocation: { fontSize: 11, color: '#999', fontStyle: 'italic' },
  punchPhoto: {
    width: '100%',
    aspectRatio: 4 / 3,
    backgroundColor: '#000',
    borderRadius: 10,
  },
  tapHint: {
    textAlign: 'center',
    color: '#999',
    fontSize: 11,
    marginTop: 6,
  },
  noPhotoBox: {
    height: 70,
    borderRadius: 10,
    backgroundColor: '#F5F5F5',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderStyle: 'dashed',
  },
  noPhotoText: { color: '#999', fontSize: 13 },
  branchPermsButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF',
    borderRadius: 14,
    padding: 16,
    marginTop: 12,
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  branchPermsIcon: { fontSize: 24, marginRight: 12 },
  branchPermsText: { fontSize: 15, fontWeight: '600', color: '#1E68B8' },
  branchPermsHint: { fontSize: 11, color: '#666', marginTop: 2 },
  branchPermsArrow: { fontSize: 20, color: '#1E68B8', fontWeight: 'bold' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.95)' },
  modalCloseArea: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  zoomedImage: { width: '100%', height: '85%' },
  modalHint: { color: '#FFF', fontSize: 12, marginTop: 10, opacity: 0.6 },
});
