// src/screens/MapScreen.tsx
import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Modal,
  ScrollView, ActivityIndicator, Alert, Linking, Platform,
  Animated
} from 'react-native';
import MapView, { Marker } from 'react-native-maps';
import { useChargerStore, Charger } from '../store/chargerStore';
import { useSessionStore } from '../store/sessionStore';
import { useAuthStore } from '../store/authStore';
import { useFilterStore } from '../store/filterStore';

const STATUS_COLOR: Record<string, string> = {
  Available:   '#22c55e',
  Busy:        '#f59e0b',
  Charging:    '#3b82f6',
  Occupied:    '#f59e0b',
  Faulted:     '#ef4444',
  Unavailable: '#6b7280',
  Offline:     '#6b7280',
  Unknown:     '#6b7280',
};

const POWER_OPTIONS = [
  { label: 'All',    value: 0 },
  { label: '7+ kW',  value: 7 },
  { label: '22+ kW', value: 22 },
  { label: '50+ kW', value: 50 },
  { label: '150+ kW',value: 150 },
];

// ── Stable marker component ───────────────────────────
/* TODO this is not allowing charger icon on map 
const ChargerMarker = React.memo(({
  charger, onPress
}: { charger: Charger; onPress: (c: Charger) => void }) => {
  const color = STATUS_COLOR[charger.status] || '#6b7280';
  const isAvailable = charger.status === 'Available';
  return (
    <Marker
      coordinate={{ latitude: charger.latitude, longitude: charger.longitude }}
      onPress={() => onPress(charger)}
      tracksViewChanges={false}
    >
      <View style={[mk.pin, { borderColor: color,
        backgroundColor: isAvailable ? '#14532d' : '#1e293b' }]}>
        <Text style={mk.icon}>⚡</Text>
        <Text style={[mk.label, { color }]}>
          {charger.availableConnectors}/{charger.totalConnectors}
        </Text>
      </View>
    </Marker>
  );
});
*/

const ChargerMarker = React.memo(({
  charger, onPress
}: { charger: Charger; onPress: (c: Charger) => void }) => {
  const color = STATUS_COLOR[charger.status] || '#6b7280';
  const isAvailable = charger.status === 'Available';

  return (
    <Marker
      key={charger.chargeBoxId}
      coordinate={{
        latitude: charger.latitude,
        longitude: charger.longitude
      }}
      onPress={() => onPress(charger)}
      pinColor={isAvailable ? '#22c55e' : color}
      title={charger.chargeBoxId}
      description={`${charger.availableConnectors}/${charger.totalConnectors} available`}
    />
  );
});

// ── Filter Bottom Sheet ───────────────────────────────
function FilterSheet({ visible, onClose }: {
  visible: boolean; onClose: () => void;
}) {
  const { filters, setFilters, resetFilters } = useFilterStore();
  const slideAnim = useRef(new Animated.Value(300)).current;

  useEffect(() => {
    Animated.spring(slideAnim, {
      toValue: visible ? 0 : 300,
      useNativeDriver: true,
      tension: 65, friction: 11,
    }).start();
  }, [visible]);

  return (
    <Animated.View style={[fs.sheet,
      { transform: [{ translateY: slideAnim }] }]}>
      <View style={fs.handle} />
      <Text style={fs.title}>Filter Chargers</Text>

      {/* Availability */}
      <Text style={fs.label}>Availability</Text>
      <View style={fs.row}>
        {(['all', 'available'] as const).map(v => (
          <TouchableOpacity key={v}
            style={[fs.chip, filters.availability === v && fs.chipActive]}
            onPress={() => setFilters({ availability: v })}>
            <Text style={[fs.chipText,
              filters.availability === v && fs.chipTextActive]}>
              {v === 'all' ? '🔌 All' : '✅ Available Only'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Min Power */}
      <Text style={fs.label}>Minimum Power</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false}
        style={fs.chipScroll}>
        {POWER_OPTIONS.map(opt => (
          <TouchableOpacity key={opt.value}
            style={[fs.chip, filters.minPower === opt.value && fs.chipActive]}
            onPress={() => setFilters({ minPower: opt.value })}>
            <Text style={[fs.chipText,
              filters.minPower === opt.value && fs.chipTextActive]}>
              {opt.label}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Distance */}
      <Text style={fs.label}>Max Distance</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false}
        style={fs.chipScroll}>
        {[10, 25, 50, 100, 999].map(km => (
          <TouchableOpacity key={km}
            style={[fs.chip, filters.maxDistance === km && fs.chipActive]}
            onPress={() => setFilters({ maxDistance: km })}>
            <Text style={[fs.chipText,
              filters.maxDistance === km && fs.chipTextActive]}>
              {km === 999 ? 'Any' : `${km} km`}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      <View style={fs.actions}>
        <TouchableOpacity style={fs.resetBtn} onPress={resetFilters}>
          <Text style={fs.resetTxt}>Reset</Text>
        </TouchableOpacity>
        <TouchableOpacity style={fs.applyBtn} onPress={onClose}>
          <Text style={fs.applyTxt}>Apply Filters</Text>
        </TouchableOpacity>
      </View>
    </Animated.View>
  );
}

// ── Main Screen ───────────────────────────────────────
export default function MapScreen() {
  const { chargers, fetchChargers, requestLocation,
    userLocation, isLoading } = useChargerStore();
  const { startSession, fetchActiveSession, activeSession } = useSessionStore();
  const { user } = useAuthStore();
  const { filters, showFilterSheet, toggleFilterSheet } = useFilterStore();

  const [selected, setSelected] = useState<Charger | null>(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [selectedConnector, setSelectedConnector] = useState<number | null>(null);
  const [starting, setStarting] = useState(false);
  const startingRef = useRef(false);
  const mapRef = useRef<MapView>(null);

  useEffect(() => {
    requestLocation();
    fetchActiveSession();
    const interval = setInterval(fetchChargers, 30000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (filteredChargers.length === 0 || !mapRef.current) return;
    
    setTimeout(() => {
      mapRef.current?.fitToCoordinates(
        filteredChargers.map(c => ({
          latitude: c.latitude,
          longitude: c.longitude
        })),
        {
          edgePadding: { top: 80, right: 40, bottom: 80, left: 40 },
          animated: true,
        }
      );
    }, 500);
  }, [filteredChargers.length]);
 
 // Apply filters
  const filteredChargers = chargers.filter(c => {
    if (filters.availability === 'available' && c.status !== 'Available')
      return false;
    if (filters.minPower > 0 && (c.maxPower || 0) / 1000 < filters.minPower)
      return false;
    if (filters.maxDistance < 999 && c.distance != null
      && c.distance > filters.maxDistance)
      return false;
    return true;
  });

  const activeFilterCount = [
    filters.availability !== 'all',
    filters.minPower > 0,
    filters.maxDistance < 999,
  ].filter(Boolean).length;

  const handleMarkerPress = useCallback((charger: Charger) => {
    setSelected(charger);
    setSelectedConnector(null);
    setModalVisible(true);
  }, []);

  const handleNavigate = (charger: Charger) => {
    const url = Platform.OS === 'ios'
      ? `maps://?daddr=${charger.latitude},${charger.longitude}`
      : `google.navigation:q=${charger.latitude},${charger.longitude}`;
    const fallback = `https://maps.google.com/?daddr=${charger.latitude},${charger.longitude}`;
    Linking.canOpenURL(url)
      .then(can => Linking.openURL(can ? url : fallback))
      .catch(() => Linking.openURL(fallback));
  };

  const handleStartCharging = async () => {
    if (startingRef.current) return;
    if (!selected || !selectedConnector) {
      Alert.alert('Select Connector', 'Please select a connector first.');
      return;
    }
    if (activeSession) {
      Alert.alert('Active Session', 'You already have an active charging session.');
      return;
    }

    startingRef.current = true;
    setStarting(true);
    try {
      const idTag = user?.idTag || 'QATEST001';
      await startSession(selected.chargeBoxId, selectedConnector, idTag);
      setModalVisible(false);
      setSelectedConnector(null);
      Alert.alert('✅ Charging Started',
        `Session started on ${selected.chargeBoxId} Connector ${selectedConnector}`);
      fetchActiveSession();
    } catch (err: any) {
      const isTimeout = err?.code === 'ECONNABORTED'
        || err?.message?.includes('timeout');
      Alert.alert(
        isTimeout ? '⏳ Taking longer than expected' : 'Failed',
        isTimeout
          ? 'Check the Session tab in 30 seconds — your session may have started.'
          : err?.response?.data?.error || err?.message || 'Could not start session'
      );
    } finally {
      setStarting(false);
      startingRef.current = false;
    }
  };

  return (
    <View style={styles.container}>
      <MapView
        ref={mapRef}
        style={styles.map}
        initialRegion={{ latitude: 18.5, longitude: 76.0,
          latitudeDelta: 14, longitudeDelta: 14 }}
        showsUserLocation
        showsMyLocationButton
      >
        {filteredChargers.map(charger => (
          <ChargerMarker key={charger.chargeBoxId}
            charger={charger} onPress={handleMarkerPress} />
        ))}
      </MapView>

      {/* Top bar: filter button + result count */}
      <View style={styles.topBar}>
        <TouchableOpacity
          style={[styles.filterBtn,
            activeFilterCount > 0 && styles.filterBtnActive]}
          onPress={toggleFilterSheet}
        >
          <Text style={styles.filterIcon}>⚙️</Text>
          <Text style={[styles.filterTxt,
            activeFilterCount > 0 && styles.filterTxtActive]}>
            Filters{activeFilterCount > 0 ? ` (${activeFilterCount})` : ''}
          </Text>
        </TouchableOpacity>

        <View style={styles.countBadge}>
          <Text style={styles.countTxt}>
            {filteredChargers.length}/{chargers.length} chargers
          </Text>
        </View>
      </View>

      {/* Legend */}
      <View style={styles.legend}>
        {[['Available','#22c55e'],['Busy','#f59e0b'],
          ['Faulted','#ef4444'],['Offline','#6b7280']].map(([s,c]) => (
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

      {/* Filter sheet */}
      {showFilterSheet && (
        <TouchableOpacity style={styles.overlay}
          onPress={toggleFilterSheet} activeOpacity={1}>
          <FilterSheet visible={showFilterSheet}
            onClose={toggleFilterSheet} />
        </TouchableOpacity>
      )}

      {/* Charger detail modal */}
      <Modal visible={modalVisible} animationType="slide" transparent
        onRequestClose={() => setModalVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            {selected && (
              <ScrollView showsVerticalScrollIndicator={false}>
                {/* Header */}
                <View style={styles.modalHeader}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.modalTitle}>
                      {selected.chargeBoxId}
                    </Text>
                    <Text style={styles.modalName}>{selected.name}</Text>
                  </View>
                  <TouchableOpacity
                    onPress={() => setModalVisible(false)}
                    style={styles.closeBtn}>
                    <Text style={styles.closeBtnText}>✕</Text>
                  </TouchableOpacity>
                </View>

                {/* Info rows */}
                <Text style={styles.infoRow}>
                  📍 {selected.street}, {selected.city}
                </Text>
                {selected.distance != null && (
                  <Text style={styles.infoRow}>
                    📏 {selected.distance < 1
                      ? `${Math.round(selected.distance * 1000)}m away`
                      : `${selected.distance.toFixed(1)}km away`}
                  </Text>
                )}
                <Text style={styles.infoRow}>
                  ⚡ {selected.availableConnectors}/{selected.totalConnectors} available
                  {selected.maxPower
                    ? `  ·  ${(selected.maxPower / 1000).toFixed(0)} kW max`
                    : ''}
                </Text>

                {/* Status + Navigate row */}
                <View style={styles.actionRow}>
                  <View style={[styles.statusBadge,
                    { backgroundColor: (STATUS_COLOR[selected.status]
                      || '#6b7280') + '22' }]}>
                    <View style={[styles.statusDot,
                      { backgroundColor: STATUS_COLOR[selected.status]
                        || '#6b7280' }]} />
                    <Text style={[styles.statusText,
                      { color: STATUS_COLOR[selected.status] || '#6b7280' }]}>
                      {selected.status}
                    </Text>
                  </View>

                  <TouchableOpacity
                    style={styles.navigateBtn}
                    onPress={() => handleNavigate(selected)}>
                    <Text style={styles.navigateTxt}>🧭 Navigate</Text>
                  </TouchableOpacity>
                </View>

                {/* Connector selection */}
                <Text style={styles.sectionTitle}>SELECT CONNECTOR</Text>
                <View style={styles.connectorGrid}>
                  {selected.connectors.map(conn => {
                    const available = conn.status === 'Available';
                    const isSel = selectedConnector === conn.connectorId;
                    const connColor = STATUS_COLOR[conn.status] || '#6b7280';
                    return (
                      <TouchableOpacity
                        key={conn.connectorId}
                        style={[styles.connCard,
                          { borderColor: isSel ? '#22d3ee' : connColor },
                          isSel && styles.connCardSel,
                          !available && styles.connCardDim,
                        ]}
                        onPress={() => available
                          && setSelectedConnector(conn.connectorId)}
                        disabled={!available}
                      >
                        <Text style={styles.connIcon}>🔌</Text>
                        <Text style={styles.connId}>#{conn.connectorId}</Text>
                        <View style={[styles.connDot,
                          { backgroundColor: connColor }]} />
                        <Text style={[styles.connStatus,
                          { color: connColor }]}>{conn.status}</Text>
                        {isSel && (
                          <Text style={styles.connTick}>✓</Text>
                        )}
                      </TouchableOpacity>
                    );
                  })}
                </View>

                {/* Start button */}
                {selected.status === 'Available' && (
                  <TouchableOpacity
                    style={[styles.startBtn,
                      (!selectedConnector || starting)
                        && styles.startBtnDim]}
                    onPress={handleStartCharging}
                    disabled={!selectedConnector || starting}
                  >
                    {starting
                      ? <ActivityIndicator color="#0f172a" />
                      : <Text style={styles.startBtnTxt}>
                          {selectedConnector
                            ? `⚡ Start on Connector ${selectedConnector}`
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

// ── Styles ────────────────────────────────────────────
const styles = StyleSheet.create({
  container: { flex: 1 },
  map: { flex: 1 },
  topBar: {
    position: 'absolute', top: 16, left: 16, right: 16,
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'center',
  },
  filterBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: '#1e293bee', borderRadius: 20,
    paddingHorizontal: 14, paddingVertical: 8,
    borderWidth: 1, borderColor: '#334155',
  },
  filterBtnActive: { borderColor: '#22d3ee', backgroundColor: '#0c4a6eee' },
  filterIcon: { fontSize: 14 },
  filterTxt: { color: '#94a3b8', fontSize: 13, fontWeight: '600' },
  filterTxtActive: { color: '#22d3ee' },
  countBadge: {
    backgroundColor: '#1e293bee', borderRadius: 20,
    paddingHorizontal: 12, paddingVertical: 6,
  },
  countTxt: { color: '#64748b', fontSize: 12 },
  legend: {
    position: 'absolute', bottom: 16, left: 16,
    backgroundColor: '#1e293bcc', borderRadius: 10,
    padding: 10, flexDirection: 'row', flexWrap: 'wrap', gap: 8,
  },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  legendDot: { width: 8, height: 8, borderRadius: 4 },
  legendText: { color: '#cbd5e1', fontSize: 10 },
  loadingBadge: {
    position: 'absolute', top: 60, right: 16,
    backgroundColor: '#1e293b', borderRadius: 20, padding: 8,
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#00000066',
    justifyContent: 'flex-end',
  },
  modalOverlay: { flex: 1, backgroundColor: '#00000088',
    justifyContent: 'flex-end' },
  modalCard: {
    backgroundColor: '#1e293b', borderTopLeftRadius: 24,
    borderTopRightRadius: 24, padding: 24, paddingBottom: 40,
    maxHeight: '85%',
  },
  modalHeader: { flexDirection: 'row', alignItems: 'flex-start',
    marginBottom: 8 },
  modalTitle: { color: '#22d3ee', fontSize: 16, fontWeight: '800' },
  modalName: { color: '#94a3b8', fontSize: 12, marginTop: 2 },
  closeBtn: { padding: 4, marginLeft: 8 },
  closeBtnText: { color: '#64748b', fontSize: 20 },
  infoRow: { color: '#94a3b8', fontSize: 13, marginBottom: 4 },
  actionRow: { flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between', marginVertical: 10 },
  statusBadge: { flexDirection: 'row', alignItems: 'center', gap: 6,
    borderRadius: 20, paddingHorizontal: 12, paddingVertical: 6 },
  statusDot: { width: 8, height: 8, borderRadius: 4 },
  statusText: { fontWeight: '700', fontSize: 13 },
  navigateBtn: {
    backgroundColor: '#0c4a6e', borderRadius: 10,
    paddingHorizontal: 14, paddingVertical: 8,
    borderWidth: 1, borderColor: '#22d3ee',
  },
  navigateTxt: { color: '#22d3ee', fontSize: 13, fontWeight: '700' },
  sectionTitle: {
    color: '#475569', fontSize: 11, fontWeight: '700',
    letterSpacing: 1, marginTop: 16, marginBottom: 10,
  },
  connectorGrid: { flexDirection: 'row', flexWrap: 'wrap',
    gap: 10, marginBottom: 20 },
  connCard: {
    borderWidth: 2, borderRadius: 12, padding: 12,
    alignItems: 'center', minWidth: 80, backgroundColor: '#0f172a',
  },
  connCardSel: { backgroundColor: '#0c4a6e' },
  connCardDim: { opacity: 0.4 },
  connIcon: { fontSize: 20, marginBottom: 4 },
  connId: { color: '#f1f5f9', fontSize: 14, fontWeight: '700' },
  connDot: { width: 6, height: 6, borderRadius: 3, marginTop: 4 },
  connStatus: { fontSize: 10, marginTop: 2 },
  connTick: { color: '#22d3ee', fontSize: 16, fontWeight: '800',
    marginTop: 4 },
  startBtn: {
    backgroundColor: '#22d3ee', borderRadius: 14,
    padding: 16, alignItems: 'center', marginTop: 4,
  },
  startBtnDim: { backgroundColor: '#334155' },
  startBtnTxt: { color: '#0f172a', fontWeight: '800', fontSize: 15 },
});

const mk = StyleSheet.create({
  pin: {
    borderRadius: 12, padding: 6, borderWidth: 2,
    alignItems: 'center', minWidth: 44,
    shadowColor: '#000', shadowOpacity: 0.3,
    shadowRadius: 4, elevation: 5,
  },
  icon: { fontSize: 14 },
  label: { fontSize: 10, fontWeight: '700', marginTop: 2 },
});

const fs = StyleSheet.create({
  sheet: {
    backgroundColor: '#1e293b', borderTopLeftRadius: 24,
    borderTopRightRadius: 24, padding: 24, paddingBottom: 40,
  },
  handle: {
    width: 40, height: 4, backgroundColor: '#334155',
    borderRadius: 2, alignSelf: 'center', marginBottom: 16,
  },
  title: { color: '#f1f5f9', fontSize: 18, fontWeight: '800',
    marginBottom: 20 },
  label: { color: '#64748b', fontSize: 11, fontWeight: '600',
    textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 },
  row: { flexDirection: 'row', gap: 8, marginBottom: 20 },
  chipScroll: { marginBottom: 20 },
  chip: {
    backgroundColor: '#0f172a', borderRadius: 20,
    paddingHorizontal: 14, paddingVertical: 8,
    marginRight: 8, borderWidth: 1, borderColor: '#334155',
  },
  chipActive: { backgroundColor: '#0c4a6e', borderColor: '#22d3ee' },
  chipText: { color: '#64748b', fontSize: 13 },
  chipTextActive: { color: '#22d3ee', fontWeight: '600' },
  actions: { flexDirection: 'row', gap: 12, marginTop: 8 },
  resetBtn: {
    flex: 1, backgroundColor: '#0f172a', borderRadius: 12,
    padding: 14, alignItems: 'center',
    borderWidth: 1, borderColor: '#334155',
  },
  resetTxt: { color: '#64748b', fontWeight: '600' },
  applyBtn: {
    flex: 2, backgroundColor: '#22d3ee', borderRadius: 12,
    padding: 14, alignItems: 'center',
  },
  applyTxt: { color: '#0f172a', fontWeight: '800', fontSize: 15 },
});