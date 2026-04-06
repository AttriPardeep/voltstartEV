// src/screens/MapScreen.tsx
import React, { useEffect, useRef, useState, useMemo, useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
  Modal, ScrollView, ActivityIndicator, Alert
} from 'react-native';
import MapView, { Marker, Callout } from 'react-native-maps';
import { useChargerStore, Charger } from '../store/chargerStore';
import { useSessionStore } from '../store/sessionStore';
import { useAuthStore } from '../store/authStore';

const STATUS_COLOR: Record<string, string> = {
  Available: '#22c55e',
  Busy: '#f59e0b',
  Charging: '#3b82f6',
  Occupied: '#f59e0b',
  Faulted: '#ef4444',
  Unavailable: '#6b7280',
  Offline: '#6b7280',
  Unknown: '#6b7280',
};

export default function MapScreen() {
  const { chargers, fetchChargers, requestLocation, userLocation, isLoading } = useChargerStore();
  const { startSession, fetchActiveSession, activeSession } = useSessionStore();
  const { user } = useAuthStore();
  const [selected, setSelected] = useState<Charger | null>(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [selectedConnector, setSelectedConnector] = useState<number | null>(null);
  const [starting, setStarting] = useState(false);
  const mapRef = useRef<MapView>(null);

  useEffect(() => {
    requestLocation(); // handles fetchChargers internally
    fetchActiveSession();
    const interval = setInterval(fetchChargers, 30000); // only for periodic refresh
    return () => clearInterval(interval);
  }, []);
  
  const handleMarkerPress = useCallback((charger: Charger) => {
    setSelected(charger);
    setSelectedConnector(null);
    setModalVisible(true);
  }, []);

  const handleStartCharging = async () => {
    if (!selected || !selectedConnector) {
      Alert.alert('Select Connector', 'Please select a connector first.');
      return;
    }
    if (activeSession) {
      Alert.alert('Active Session', 'You already have an active charging session.');
      return;
    }
    if (!user?.idTag && !user?.userId) {
      Alert.alert('Error', 'User profile incomplete. Please re-login.');
      return;
    }

    setStarting(true);
    try {
      // Use idTag from user profile, fallback to username
      // const idTag = user.idTag || `USER_${user.userId}`; // TODO need to uncomment after backend code fix
	  const idTag = user.idTag || 'QATEST001'; // TODO need to remove after backend code fix
      await startSession(selected.chargeBoxId, selectedConnector, idTag);
      setModalVisible(false);
      setSelectedConnector(null);
      Alert.alert('✅ Charging Started', 
        `Session started on ${selected.chargeBoxId} Connector ${selectedConnector}`);
      fetchActiveSession();
    } catch (err: any) {
      Alert.alert('Failed', 
        err?.response?.data?.error || err?.message || 'Could not start session');
    } finally {
      setStarting(false);
    }
  };

  const initialRegion = userLocation ? {
    latitude: userLocation.latitude,
    longitude: userLocation.longitude,
    latitudeDelta: 5,
    longitudeDelta: 5,
  } : {
    latitude: 18.5,
    longitude: 76.0,
    latitudeDelta: 10,
    longitudeDelta: 10,
  };

  return (
    <View style={styles.container}>
      <MapView
        ref={mapRef}
        style={styles.map}
        initialRegion={initialRegion}
        showsUserLocation
        showsMyLocationButton
      >
        {chargers.map((charger) => {
          const color = STATUS_COLOR[charger.status] || '#6b7280';
          const isAvailable = charger.status === 'Available';
          return (
            <Marker
              key={charger.chargeBoxId}
              coordinate={{ 
                latitude: charger.latitude, 
                longitude: charger.longitude 
              }}
              onPress={() => handleMarkerPress(charger)}
            >
              <View style={[styles.marker, { 
                borderColor: color, 
                backgroundColor: isAvailable ? '#14532d' : '#1e293b' 
              }]}>
                <Text style={styles.markerIcon}>⚡</Text>
                <Text style={[styles.markerLabel, { color }]}>
                  {charger.availableConnectors}/{charger.totalConnectors}
                </Text>
              </View>
            </Marker>
          );
        })}
      </MapView>
	  
      {/* Distance legend */}
      <View style={styles.legend}>
        {Object.entries(STATUS_COLOR).slice(0, 4).map(([s, c]) => (
          <View key={s} style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: c }]} />
            <Text style={styles.legendText}>{s}</Text>
          </View>
        ))}
      </View>

      {isLoading && (
        <View style={styles.loadingBadge}>
          <ActivityIndicator size="small" color="#22d3ee" />
        </View>
      )}

      {/* Charger Detail Modal */}
      <Modal visible={modalVisible} animationType="slide" transparent onRequestClose={() => setModalVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            {selected && (
              <ScrollView showsVerticalScrollIndicator={false}>
                {/* Header */}
                <View style={styles.modalHeader}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.modalTitle}>{selected.chargeBoxId}</Text>
                    <Text style={styles.modalName}>{selected.name}</Text>
                  </View>
                  <TouchableOpacity onPress={() => setModalVisible(false)} style={styles.closeBtn}>
                    <Text style={styles.closeBtnText}>✕</Text>
                  </TouchableOpacity>
                </View>

                {/* Info */}
                <Text style={styles.infoRow}>📍 {selected.street}, {selected.city}</Text>
                {selected.distance != null && (
                  <Text style={styles.infoRow}>📏 {selected.distance < 1 
                    ? `${Math.round(selected.distance * 1000)}m away` 
                    : `${selected.distance.toFixed(1)}km away`}
                  </Text>
                )}
                <Text style={styles.infoRow}>
                  ⚡ {selected.availableConnectors}/{selected.totalConnectors} connectors available
                </Text>

                {/* Status badge */}
                <View style={[styles.statusBadge, { backgroundColor: STATUS_COLOR[selected.status] + '22' }]}>
                  <View style={[styles.statusDot, { backgroundColor: STATUS_COLOR[selected.status] }]} />
                  <Text style={[styles.statusText, { color: STATUS_COLOR[selected.status] }]}>
                    {selected.status}
                  </Text>
                </View>

                {/* Connector Selection */}
                <Text style={styles.sectionTitle}>SELECT CONNECTOR</Text>
                <View style={styles.connectorGrid}>
                  {selected.connectors.map((conn) => {
                    const available = conn.status === 'Available';
                    const isSelected = selectedConnector === conn.connectorId;
                    const connColor = STATUS_COLOR[conn.status] || '#6b7280';
                    return (
                      <TouchableOpacity
                        key={conn.connectorId}
                        style={[
                          styles.connectorCard,
                          { borderColor: isSelected ? '#22d3ee' : connColor },
                          isSelected && styles.connectorCardSelected,
                          !available && styles.connectorCardDisabled,
                        ]}
                        onPress={() => available && setSelectedConnector(conn.connectorId)}
                        disabled={!available}
                      >
                        <Text style={styles.connectorIcon}>🔌</Text>
                        <Text style={styles.connectorId}>#{conn.connectorId}</Text>
                        <View style={[styles.connDot, { backgroundColor: connColor }]} />
                        <Text style={[styles.connStatus, { color: connColor }]}>{conn.status}</Text>
                        {isSelected && <Text style={styles.selectedTick}>✓</Text>}
                      </TouchableOpacity>
                    );
                  })}
                </View>

                {/* Start Button */}
                {selected.status === 'Available' && (
                  <TouchableOpacity
                    style={[
                      styles.startBtn,
                      (!selectedConnector || starting) && styles.startBtnDisabled
                    ]}
                    onPress={handleStartCharging}
                    disabled={!selectedConnector || starting}
                  >
                    {starting
                      ? <ActivityIndicator color="#0f172a" />
                      : <Text style={styles.startBtnText}>
                          {selectedConnector 
                            ? `⚡ Start Charging on Connector ${selectedConnector}`
                            : '← Select a connector above'}
                        </Text>
                    }
                  </TouchableOpacity>
                )}
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  map: { flex: 1 },
  marker: {
    borderRadius: 12, padding: 6, borderWidth: 2,
    alignItems: 'center', minWidth: 44,
    shadowColor: '#000', shadowOpacity: 0.3, shadowRadius: 4, elevation: 5,
  },
  markerIcon: { fontSize: 14 },
  markerLabel: { fontSize: 10, fontWeight: '700', marginTop: 2 },
  legend: {
    position: 'absolute', bottom: 16, left: 16,
    backgroundColor: '#1e293bcc', borderRadius: 10,
    padding: 10, flexDirection: 'row', flexWrap: 'wrap', gap: 8
  },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  legendDot: { width: 8, height: 8, borderRadius: 4 },
  legendText: { color: '#cbd5e1', fontSize: 10 },
  loadingBadge: {
    position: 'absolute', top: 16, right: 16,
    backgroundColor: '#1e293b', borderRadius: 20, padding: 8
  },
  modalOverlay: { flex: 1, backgroundColor: '#00000088', justifyContent: 'flex-end' },
  modalCard: {
    backgroundColor: '#1e293b', borderTopLeftRadius: 24,
    borderTopRightRadius: 24, padding: 24, paddingBottom: 40, maxHeight: '85%'
  },
  modalHeader: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 8 },
  modalTitle: { color: '#22d3ee', fontSize: 16, fontWeight: '800' },
  modalName: { color: '#94a3b8', fontSize: 12, marginTop: 2 },
  closeBtn: { padding: 4, marginLeft: 8 },
  closeBtnText: { color: '#64748b', fontSize: 20 },
  infoRow: { color: '#94a3b8', fontSize: 13, marginBottom: 4 },
  statusBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    borderRadius: 20, paddingHorizontal: 12, paddingVertical: 6,
    alignSelf: 'flex-start', marginVertical: 10
  },
  statusDot: { width: 8, height: 8, borderRadius: 4 },
  statusText: { fontWeight: '700', fontSize: 13 },
  sectionTitle: {
    color: '#475569', fontSize: 11, fontWeight: '700',
    letterSpacing: 1, marginTop: 16, marginBottom: 10
  },
  connectorGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 20 },
  connectorCard: {
    borderWidth: 2, borderRadius: 12, padding: 12,
    alignItems: 'center', minWidth: 80, backgroundColor: '#0f172a',
  },
  connectorCardSelected: { backgroundColor: '#0c4a6e' },
  connectorCardDisabled: { opacity: 0.4 },
  connectorIcon: { fontSize: 20, marginBottom: 4 },
  connectorId: { color: '#f1f5f9', fontSize: 14, fontWeight: '700' },
  connDot: { width: 6, height: 6, borderRadius: 3, marginTop: 4 },
  connStatus: { fontSize: 10, marginTop: 2 },
  selectedTick: { color: '#22d3ee', fontSize: 16, fontWeight: '800', marginTop: 4 },
  startBtn: {
    backgroundColor: '#22d3ee', borderRadius: 14,
    padding: 16, alignItems: 'center', marginTop: 4
  },
  startBtnDisabled: { backgroundColor: '#334155' },
  startBtnText: { color: '#0f172a', fontWeight: '800', fontSize: 15 },
});