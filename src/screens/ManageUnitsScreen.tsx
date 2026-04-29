import React, { useState, useCallback } from 'react';
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
import { RouteProp, useFocusEffect } from '@react-navigation/native';
import { RootStackParamList, Unit } from '../types';
import { api } from '../services/api';

type ManageUnitsProps = {
  navigation: NativeStackNavigationProp<RootStackParamList, 'ManageUnits'>;
  route: RouteProp<RootStackParamList, 'ManageUnits'>;
};

export const ManageUnitsScreen: React.FC<ManageUnitsProps> = ({
  navigation,
  route,
}) => {
  const { user, token } = route.params;
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [units, setUnits] = useState<Unit[]>([]);

  const loadUnits = async () => {
    try {
      const response = await api.getAdminUnits(token);
      if (response.success) {
        setUnits(response.units);
      }
    } catch (error: any) {
      Alert.alert('Error', 'Failed to load units: ' + error.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  // Reload units every time this screen comes into focus (e.g., after add/edit)
  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      loadUnits();
    }, [])
  );

  const onRefresh = () => {
    setRefreshing(true);
    loadUnits();
  };

  if (loading && !refreshing) {
    return (
      <View style={[styles.container, styles.centerContent]}>
        <StatusBar barStyle="light-content" backgroundColor="#1E68B8" />
        <ActivityIndicator size="large" color="#1E68B8" />
        <Text style={styles.loadingText}>Loading units...</Text>
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
        <Text style={styles.headerTitle}>Manage Units</Text>
        <View style={{ width: 60 }} />
      </View>

      <ScrollView
        style={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {/* Add New Unit Button */}
        <TouchableOpacity
          style={styles.addButton}
          onPress={() =>
            navigation.navigate('UnitForm', { user, token })
          }
        >
          <Text style={styles.addButtonIcon}>+</Text>
          <Text style={styles.addButtonText}>Add New Unit</Text>
        </TouchableOpacity>

        {/* Unit Count */}
        <Text style={styles.countLabel}>
          {units.length} unit{units.length !== 1 ? 's' : ''} configured
        </Text>

        {/* Unit List */}
        {units.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyText}>
              No units found. Tap the button above to add one.
            </Text>
          </View>
        ) : (
          units.map((unit) => (
            <View key={unit.id} style={styles.unitCard}>
              <View style={styles.unitInfo}>
                <View style={styles.unitHeader}>
                  <Text style={styles.unitIcon}>
                    {unit.is_geofenced ? '📍' : '🏠'}
                  </Text>
                  <Text style={styles.unitName}>{unit.name}</Text>
                </View>
                <Text style={styles.unitCoords}>
                  Lat: {unit.latitude}, Lng: {unit.longitude}
                </Text>
                <Text
                  style={[
                    styles.unitGeofence,
                    {
                      color: unit.is_geofenced ? '#4CAF50' : '#FF9800',
                    },
                  ]}
                >
                  {unit.is_geofenced
                    ? 'Geofenced (50m radius)'
                    : 'No geofence (WFH / Field)'}
                </Text>
              </View>
              <TouchableOpacity
                style={styles.editButton}
                onPress={() =>
                  navigation.navigate('UnitForm', { user, token, unit })
                }
              >
                <Text style={styles.editButtonText}>Edit</Text>
              </TouchableOpacity>
            </View>
          ))
        )}

        <View style={{ height: 30 }} />
      </ScrollView>
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
    paddingBottom: 18,
    paddingHorizontal: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  backButton: {
    paddingVertical: 4,
    paddingRight: 10,
  },
  backText: {
    color: '#FFF',
    fontSize: 15,
    fontWeight: '600',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFF',
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 20,
  },
  addButton: {
    backgroundColor: '#4CAF50',
    borderRadius: 12,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
    elevation: 3,
    shadowColor: '#4CAF50',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
  },
  addButtonIcon: {
    fontSize: 22,
    color: '#FFF',
    fontWeight: 'bold',
    marginRight: 8,
  },
  addButtonText: {
    fontSize: 16,
    color: '#FFF',
    fontWeight: '700',
  },
  countLabel: {
    fontSize: 13,
    color: '#999',
    marginBottom: 12,
  },
  emptyState: {
    backgroundColor: '#FFF',
    borderRadius: 12,
    padding: 40,
    alignItems: 'center',
  },
  emptyText: {
    color: '#666',
    fontSize: 15,
    textAlign: 'center',
  },
  unitCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF',
    borderRadius: 12,
    padding: 15,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 3,
  },
  unitInfo: { flex: 1 },
  unitHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  unitIcon: {
    fontSize: 18,
    marginRight: 8,
  },
  unitName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1E68B8',
  },
  unitCoords: {
    fontSize: 12,
    color: '#666',
    marginTop: 2,
    marginLeft: 26,
  },
  unitGeofence: {
    fontSize: 11,
    fontWeight: '500',
    marginTop: 3,
    marginLeft: 26,
  },
  editButton: {
    backgroundColor: '#1E68B8',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 10,
  },
  editButtonText: {
    color: '#FFF',
    fontSize: 13,
    fontWeight: '700',
  },
});
