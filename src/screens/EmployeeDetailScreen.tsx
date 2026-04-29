import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  StatusBar,
  ScrollView,
} from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RouteProp } from '@react-navigation/native';
import { RootStackParamList } from '../types';

type EmployeeDetailProps = {
  navigation: NativeStackNavigationProp<RootStackParamList, 'EmployeeDetail'>;
  route: RouteProp<RootStackParamList, 'EmployeeDetail'>;
};

export const EmployeeDetailScreen: React.FC<EmployeeDetailProps> = ({ 
  navigation,
  route 
}) => {
  const { employee, attendance } = route.params;

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric', 
      year: 'numeric' 
    });
  };

  const formatTime = (dateTime: string) => {
    if (!dateTime) return 'N/A';
    const date = new Date(dateTime);
    return date.toLocaleTimeString('en-US', { 
      hour: '2-digit', 
      minute: '2-digit',
      hour12: true 
    });
  };

  const getStatusColor = (status: string) => {
    switch(status) {
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

  const getStatusIcon = (status: string) => {
    switch(status) {
      case 'present':
        return '✓';
      case 'late':
        return '⚠';
      case 'absent':
        return '✕';
      default:
        return '?';
    }
  };

  const calculateStats = () => {
    const total = attendance.length;
    const present = attendance.filter((a: any) => a.status === 'present').length;
    const late = attendance.filter((a: any) => a.status === 'late').length;
    const absent = attendance.filter((a: any) => a.status === 'absent').length;
    return { total, present, late, absent };
  };

  const stats = calculateStats();

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
          <Text style={styles.headerTitle}>{employee.name}</Text>
          <Text style={styles.headerSubtitle}>{employee.email}</Text>
        </View>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Statistics */}
        <View style={styles.statsContainer}>
          <View style={[styles.statCard, { borderColor: '#2196F3' }]}>
            <Text style={styles.statNumber}>{stats.total}</Text>
            <Text style={styles.statLabel}>Total Days</Text>
          </View>
          <View style={[styles.statCard, { borderColor: '#4CAF50' }]}>
            <Text style={styles.statNumber}>{stats.present}</Text>
            <Text style={styles.statLabel}>Present</Text>
          </View>
          <View style={[styles.statCard, { borderColor: '#FF9800' }]}>
            <Text style={styles.statNumber}>{stats.late}</Text>
            <Text style={styles.statLabel}>Late</Text>
          </View>
          <View style={[styles.statCard, { borderColor: '#D32F2F' }]}>
            <Text style={styles.statNumber}>{stats.absent}</Text>
            <Text style={styles.statLabel}>Absent</Text>
          </View>
        </View>

        {/* Attendance History */}
        <View style={styles.historySection}>
          <Text style={styles.sectionTitle}>Attendance History (Last 30 Days)</Text>
          
          {attendance.length === 0 ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyText}>No attendance records found</Text>
            </View>
          ) : (
            attendance.map((record: any) => (
              <TouchableOpacity 
                key={record.id} 
                style={styles.historyCard}
                activeOpacity={0.7}
                onPress={() => navigation.navigate('AttendanceLocationDetail', {
                  record,
                  employeeName: employee.name,
                })}
              >
                <View style={styles.historyLeft}>
                  <View style={styles.historyDate}>
                    <Text style={styles.historyDateText}>{formatDate(record.date)}</Text>
                  </View>
                  <View style={styles.historyTimes}>
                    <View style={styles.timeRow}>
                      <Text style={styles.timeLabel}>In:</Text>
                      <Text style={styles.timeValue}>{formatTime(record.check_in_time)}</Text>
                    </View>
                    {record.check_out_time && (
                      <View style={styles.timeRow}>
                        <Text style={styles.timeLabel}>Out:</Text>
                        <Text style={styles.timeValue}>{formatTime(record.check_out_time)}</Text>
                      </View>
                    )}
                  </View>
                </View>
                <View 
                  style={[
                    styles.historyStatus, 
                    { backgroundColor: getStatusColor(record.status) }
                  ]}
                >
                  <Text style={styles.statusIcon}>{getStatusIcon(record.status)}</Text>
                </View>
              </TouchableOpacity>
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
  statsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 25,
  },
  statCard: {
    flex: 1,
    backgroundColor: '#FFF',
    borderRadius: 12,
    padding: 12,
    marginHorizontal: 4,
    alignItems: 'center',
    borderWidth: 2,
  },
  statNumber: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
  },
  statLabel: {
    fontSize: 10,
    color: '#666',
    marginTop: 4,
    textAlign: 'center',
  },
  historySection: {
    marginBottom: 30,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1E68B8',
    marginBottom: 15,
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
  },
  historyCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FFF',
    borderRadius: 12,
    padding: 15,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  historyLeft: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  historyDate: {
    backgroundColor: '#1E68B8',
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 12,
    marginRight: 15,
    minWidth: 90,
  },
  historyDateText: {
    color: '#FFF',
    fontSize: 12,
    fontWeight: '600',
    textAlign: 'center',
  },
  historyTimes: {
    flex: 1,
  },
  timeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 2,
  },
  timeLabel: {
    fontSize: 12,
    color: '#999',
    marginRight: 5,
    width: 25,
  },
  timeValue: {
    fontSize: 14,
    color: '#333',
    fontWeight: '500',
  },
  historyStatus: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statusIcon: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
});
