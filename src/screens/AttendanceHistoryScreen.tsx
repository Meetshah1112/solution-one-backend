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
  RefreshControl,
} from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RouteProp } from '@react-navigation/native';
import { RootStackParamList } from '../types';
import { api } from '../services/api';

type AttendanceHistoryProps = {
  navigation: NativeStackNavigationProp<RootStackParamList, 'AttendanceHistory'>;
  route: RouteProp<RootStackParamList, 'AttendanceHistory'>;
};

export const AttendanceHistoryScreen: React.FC<AttendanceHistoryProps> = ({
  navigation,
  route,
}) => {
  const { user, token } = route.params;
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [records, setRecords] = useState<any[]>([]);
  const [daysFilter, setDaysFilter] = useState(30);

  useEffect(() => {
    loadHistory();
  }, [daysFilter]);

  const loadHistory = async () => {
    try {
      setLoading(true);
      const response = await api.getAttendanceHistory(token, daysFilter);

      if (response.success) {
        setRecords(response.records);
      }
    } catch (error: any) {
      Alert.alert('Error', 'Failed to load attendance history: ' + error.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    loadHistory();
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
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

  if (loading && !refreshing) {
    return (
      <View style={[styles.container, styles.centerContent]}>
        <StatusBar barStyle="light-content" backgroundColor="#1E68B8" />
        <ActivityIndicator size="large" color="#1E68B8" />
        <Text style={styles.loadingText}>Loading attendance history...</Text>
      </View>
    );
  }

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
          <Text style={styles.headerTitle}>My Attendance</Text>
          <Text style={styles.headerSubtitle}>{user.name}</Text>
        </View>
      </View>

      <ScrollView
        style={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {/* Filter */}
        <View style={styles.filterRow}>
          {[7, 15, 30, 60, 90].map((days) => (
            <TouchableOpacity
              key={days}
              style={[
                styles.filterButton,
                daysFilter === days && styles.filterButtonActive,
              ]}
              onPress={() => setDaysFilter(days)}
            >
              <Text
                style={[
                  styles.filterText,
                  daysFilter === days && styles.filterTextActive,
                ]}
              >
                {days}d
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Records */}
        <View style={styles.recordsSection}>
          <Text style={styles.sectionTitle}>
            Attendance Records ({records.length})
          </Text>

          {records.length === 0 ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyText}>No attendance records found</Text>
            </View>
          ) : (
            records.map((record: any) => (
              <View key={record.id} style={styles.recordCard}>
                <View style={styles.recordHeader}>
                  <Text style={styles.recordDate}>
                    {formatDate(record.attend_date)}
                  </Text>
                  <View style={styles.punchCountBadge}>
                    <Text style={styles.punchCountText}>
                      {record.punchCount} punch{record.punchCount !== 1 ? 'es' : ''}
                    </Text>
                  </View>
                </View>

                {/* Punch list */}
                {record.punches &&
                  record.punches.map((p: any, idx: number) => (
                    <View key={idx} style={styles.punchRow}>
                      <Text style={styles.punchIndex}>#{p.index}</Text>
                      <Text style={styles.punchTime}>{formatTime(p.time)}</Text>
                      {p.location && (
                        <Text style={styles.punchLocation}>{p.location}</Text>
                      )}
                    </View>
                  ))}
              </View>
            ))
          )}
        </View>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F5',
  },
  centerContent: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 10,
    color: '#666',
    fontSize: 16,
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
  filterRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginBottom: 20,
    gap: 8,
  },
  filterButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#FFF',
    borderWidth: 2,
    borderColor: '#E0E0E0',
  },
  filterButtonActive: {
    backgroundColor: '#1E68B8',
    borderColor: '#1E68B8',
  },
  filterText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666',
  },
  filterTextActive: {
    color: '#FFF',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1E68B8',
    marginBottom: 15,
  },
  recordsSection: {
    marginBottom: 30,
  },
  emptyState: {
    backgroundColor: '#FFF',
    borderRadius: 12,
    padding: 40,
    alignItems: 'center',
  },
  emptyText: {
    color: '#666',
    fontSize: 16,
    textAlign: 'center',
  },
  recordCard: {
    backgroundColor: '#FFF',
    borderRadius: 12,
    padding: 15,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
  },
  recordHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  recordDate: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
  },
  punchCountBadge: {
    backgroundColor: '#1E68B8',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  punchCountText: {
    color: '#FFF',
    fontSize: 12,
    fontWeight: '600',
  },
  punchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 4,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  punchIndex: {
    fontSize: 13,
    fontWeight: '600',
    color: '#1E68B8',
    width: 30,
  },
  punchTime: {
    fontSize: 13,
    color: '#333',
    width: 100,
  },
  punchLocation: {
    fontSize: 11,
    color: '#999',
    flex: 1,
  },
});
