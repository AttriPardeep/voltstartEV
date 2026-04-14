// src/screens/MapScreen.tsx
import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react';
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
import AssistantChat from '../components/AssistantChat';
import { api } from '../utils/api';

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
  { label: 'All',     value: 0   },
  { label: '7+ kW',  value: 7   },
  { label: '22+ kW', value: 22  },
  { label: '50+ kW', value: 50  },
  { label: '150+ kW',value: 150 },
];

const PRICE_OPTIONS = [
  { label: 'Any',   value: 999 },
  { label: '≤₹8',   value: 8   },
  { label: '≤₹10',  value: 10  },
  { label: '≤₹15',  value: 15  },
  { label: '≤₹20',  value: 20  },
];

// ── Marker ────────────────────────────────────────────
const ChargerMarker = React.memo(({ charger, onPress }: { 
  charger: Charger; 
  onPress: (c: Charger) => void;
}) => {
  const isAvailable = charger.status === 'Available';
  
  const bgColor = isAvailable        ? '#10b981' : 
                  charger.status === 'Busy'    ? '#f59e0b' : 
                  charger.status === 'Charging'? '#3b82f6' :
                  charger.status === 'Faulted' ? '#ef4444' : '#6b7280';

  const connectorLabel = `${charger.availableConnectors ?? 0}/${charger.totalConnectors ?? 0}`;

  return (
    <Marker
      coordinate={{ latitude: charger.latitude, longitude: charger.longitude }}
      onPress={() => onPress(charger)}
      anchor={{ x: 0.5, y: 1 }}
      stopPropagation={true}
      // tracksViewChanges={true} // Uncomment if still having issues
    >
      <View style={squareMarker.container}>
        <View style={[squareMarker.badge, { backgroundColor: bgColor }]}>
          <Text style={squareMarker.icon}>⚡</Text>
          <Text style={squareMarker.connectorCount}>{connectorLabel}</Text>
        </View>
        {/* Triangle pointer */}
        <View style={[squareMarker.pointer, { borderTopColor: bgColor }]} />
      </View>
    </Marker>
  );
});

const squareMarker = StyleSheet.create({
  container: {
    alignItems: 'center',
  },
  badge: {
    width: 44,
    height: 48,  
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2.5,
    borderColor: '#ffffff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.35,
    shadowRadius: 4,
    elevation: 6,
    paddingHorizontal: 4,
  },
  icon: {
    fontSize: 20,  
    color: '#fff',
    marginBottom: 1,
  },
  connectorCount: {
    fontSize: 11,  
    color: '#fff',
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  pointer: {
    width: 0,
    height: 0,
    borderLeftWidth: 6,
    borderRightWidth: 6,
    borderTopWidth: 7,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    marginTop: -1,
  },
});
// ── PricingCard ───────────────────────────────────────
function PricingCard({ charger, connectorId, user }: {
  charger: Charger;
  connectorId: number | null;
  user: any;
}) {
  const [estimate, setEstimate]   = useState<any>(null);
  const [loading,  setLoading]    = useState(false);

  useEffect(() => {
    if (!connectorId) { setEstimate(null); return; }
    if (!charger.pricing) return;

    setLoading(true);
    const params = new URLSearchParams({
      connectorId: connectorId.toString(),
      maxPowerKw:  charger.maxPower
        ? (charger.maxPower / 1000).toString() : '22',
    });
    if (user?.batteryCapacityKwh)
      params.append('batteryKwh', user.batteryCapacityKwh.toString());
    if (user?.targetSocPercent)
      params.append('targetSoc',  user.targetSocPercent.toString());

    api.get(`/api/chargers/${charger.chargeBoxId}/pricing-estimate?${params}`)
      .then(r => setEstimate(r.data.data))
      .catch(() => setEstimate(null))
      .finally(() => setLoading(false));
  }, [connectorId, charger.chargeBoxId]);

  // Always render — show "contact operator" if no pricing
  if (!charger.pricing) {
    return (
      <View style={pc.card}>
        <Text style={pc.title}>💰 Pricing</Text>
        <Text style={pc.noVehicle}>Contact operator for pricing details</Text>
      </View>
    );
  }

  const { pricing } = charger;

  return (
    <View style={pc.card}>
      <View style={pc.header}>
        <Text style={pc.title}>💰 Pricing</Text>
        <Text style={pc.rateName}>{pricing.displayName}</Text>
      </View>

      {/* Rate — always visible */}
      <Text style={pc.rate}>{pricing.rateDisplay}</Text>

      {/* Session fee */}
      {pricing.sessionFee > 0 && (
        <View style={pc.feeRow}>
          <Text style={pc.feeText}>
            + ₹{pricing.sessionFee.toFixed(0)} session fee
          </Text>
        </View>
      )}

      {/* Tiered breakdown */}
      {!!pricing.tiers?.length && (
        <View style={pc.tiers}>
          <Text style={pc.tiersTitle}>Tiered by power delivered:</Text>
          {pricing.tiers.map((tier, i) => (
            <View key={i} style={pc.tierRow}>
              <Text style={pc.tierLabel}>Up to {tier.max_kw} kW</Text>
              <Text style={pc.tierRate}>₹{tier.rate_per_kwh.toFixed(2)}/kWh</Text>
            </View>
          ))}
        </View>
      )}

      {/* Estimate hint */}
      {!connectorId && (
        <Text style={pc.hint}>Select a connector above for cost estimate</Text>
      )}

      {connectorId && loading && (
        <View style={pc.estimateLoading}>
          <ActivityIndicator size="small" color="#22d3ee" />
          <Text style={pc.estimateLoadingText}>Calculating...</Text>
        </View>
      )}

      {connectorId && estimate && !loading && (
        <View style={pc.estimate}>
          <Text style={pc.estimateTitle}>📊 Your Estimate</Text>
          {estimate.estimatedCost != null ? (
            <>
              <View style={pc.estimateRow}>
                <Text style={pc.estimateLabel}>Total Cost</Text>
                <Text style={[pc.estimateValue, { color: '#22d3ee' }]}>
                  ₹{estimate.estimatedCost.toFixed(2)}
                </Text>
              </View>
              {!!estimate.estimatedDuration && (
                <View style={pc.estimateRow}>
                  <Text style={pc.estimateLabel}>Est. Time</Text>
                  <Text style={pc.estimateValue}>
                    ~{estimate.estimatedDuration} min
                  </Text>
                </View>
              )}
              <Text style={pc.breakdown}>{estimate.breakdown}</Text>
            </>
          ) : (
            <Text style={pc.noVehicle}>
              Add vehicle in Profile → My Vehicles for cost estimate
            </Text>
          )}
        </View>
      )}
    </View>
  );
}

// ── Filter Sheet ──────────────────────────────────────
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
      {/* Max Price */}
      <Text style={fs.label}>Max Price (per kWh)</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false}
        style={fs.chipScroll}>
        {PRICE_OPTIONS.map(opt => (
          <TouchableOpacity key={opt.value}
            style={[fs.chip, filters.maxPrice === opt.value && fs.chipActive]}
            onPress={() => setFilters({ maxPrice: opt.value })}>
            <Text style={[fs.chipText,
              filters.maxPrice === opt.value && fs.chipTextActive]}>
              {opt.label}
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
  const {
    chargers, fetchChargers, requestLocation,
    userLocation, isLoading,
    isOffline, cacheAge,           // ✅ from store
  } = useChargerStore();
  const { startSession, fetchActiveSession, activeSession } = useSessionStore();
  const { user } = useAuthStore();
  const { filters, setFilters, showFilterSheet, toggleFilterSheet } = useFilterStore();

  const [selected, setSelected]           = useState<Charger | null>(null);
  const [modalVisible, setModalVisible]   = useState(false);
  const [selectedConnector, setSelectedConnector] = useState<number | null>(null);
  const [starting, setStarting]           = useState(false);
  const startingRef = useRef(false);
  const mapRef      = useRef<MapView>(null);

  //  compute filteredChargers BEFORE any useEffect that uses it
  const filteredChargers = useMemo(() =>
    (chargers || []).filter(c => {
      if (filters.availability === 'available' && c.status !== 'Available')
        return false;
      //  maxPower is in Watts — divide by 1000 to get kW
      if (filters.minPower > 0 && (c.maxPower || 0) / 1000 < filters.minPower)
        return false;
      if (filters.maxDistance < 999 && c.distance != null
        && c.distance > filters.maxDistance)
        return false;
      if (filters.maxPrice < 999 && c.pricing?.ratePerKwh != null
        && c.pricing.ratePerKwh > filters.maxPrice)
        return false;		
      return true;
    }),
  [chargers, filters]);

  const activeFilterCount = [
    filters.availability !== 'all',
    filters.minPower > 0,
    filters.maxDistance < 999,
	filters.maxPrice < 999, 
  ].filter(Boolean).length;

  // Initial load
  useEffect(() => {
    requestLocation();
    fetchActiveSession();
    fetchChargers(); // immediate fetch
    const interval = setInterval(fetchChargers, 30000);
    return () => clearInterval(interval);
  }, []);

  // Center on user location when it arrives
  useEffect(() => {
    if (!userLocation?.latitude || !mapRef.current) return;
    setTimeout(() => {
      mapRef.current?.animateToRegion({
        latitude:      userLocation.latitude,
        longitude:     userLocation.longitude,
        latitudeDelta:  0.1,
        longitudeDelta: 0.1,
      }, 1000);
    }, 800);
  }, [userLocation?.latitude, userLocation?.longitude]);

  // Fit to chargers only if no user location
  useEffect(() => {
    if (userLocation?.latitude) return; // user location takes priority
    if (!filteredChargers.length || !mapRef.current) return;
    setTimeout(() => {
      mapRef.current?.fitToCoordinates(
        filteredChargers.map(c => ({
          latitude: c.latitude, longitude: c.longitude,
        })),
        { edgePadding: { top: 80, right: 40, bottom: 80, left: 40 },
          animated: true },
      );
    }, 500);
  }, [filteredChargers.length, userLocation?.latitude]);

  const handleMarkerPress = useCallback((charger: Charger) => {
    setSelected(charger);
    setSelectedConnector(null);
    setModalVisible(true);
  }, []);

  const handleNavigate = (charger: Charger) => {
    const url = Platform.OS === 'ios'
      ? `maps://?daddr=${charger.latitude},${charger.longitude}`
      : `google.navigation:q=${charger.latitude},${charger.longitude}`;
    const fallback =
      `https://maps.google.com/?daddr=${charger.latitude},${charger.longitude}`;
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
      Alert.alert('Active Session',
        'You already have an active charging session.');
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
        || err?.message?.includes('timeout')
        || err?.message?.includes('Network Error');
      Alert.alert(
        isTimeout ? '⏳ Connecting to Charger...' : 'Failed',
        isTimeout
          ? 'The charger is responding. Check the Session tab in 30 seconds.'
          : err?.response?.data?.error || err?.message || 'Could not start session',
        isTimeout
          ? [{ text: 'Check Session Tab',
               onPress: () => setModalVisible(false) },
             { text: 'OK' }]
          : [{ text: 'OK' }]
      );
    } finally {
      setStarting(false);
      startingRef.current = false;
    }
  };

  const handleAssistantAction = useCallback((action: any) => {
    switch (action.type) {
      case 'navigate': {
        const c = (chargers || []).find(x => x.chargeBoxId === action.chargeBoxId);
        if (c) {
          setSelected(c);
          setModalVisible(true);
          mapRef.current?.animateToRegion({
            latitude: c.latitude, longitude: c.longitude,
            latitudeDelta: 0.05, longitudeDelta: 0.05,
          }, 800);
        }
        break;
      }
      case 'filter':
        if (action.availability) setFilters({ availability: action.availability });
        if (action.minPower != null) setFilters({ minPower: action.minPower });
        break;
      case 'navigate_tab':
        console.log('Navigate to tab:', action.tab);
        break;
    }
  }, [chargers, setFilters]);

  return (
    <View style={s.container}>
      <MapView
        ref={mapRef}
        style={s.map}
        initialRegion={{
          latitude: 18.5, longitude: 76.0,
          latitudeDelta: 14, longitudeDelta: 14,
        }}
        showsUserLocation
        showsMyLocationButton
      >
        {filteredChargers.map(charger => (
          <ChargerMarker key={charger.chargeBoxId}
            charger={charger} onPress={handleMarkerPress} />
        ))}
      </MapView>

      {/* Top bar */}
      <View style={s.topBar}>
        <TouchableOpacity
          style={[s.filterBtn, activeFilterCount > 0 && s.filterBtnActive]}
          onPress={toggleFilterSheet}>
          <Text style={s.filterIcon}>⚙️</Text>
          <Text style={[s.filterTxt, activeFilterCount > 0 && s.filterTxtActive]}>
            Filters{activeFilterCount > 0 ? ` (${activeFilterCount})` : ''}
          </Text>
        </TouchableOpacity>

        <View style={s.countBadge}>
          <Text style={s.countTxt}>
            {filteredChargers.length}/{chargers?.length || 0} chargers
          </Text>
        </View>
      </View>

      {/*  offline banner — only show when truly offline */}
      {isOffline === true && (
        <View style={s.offlineBanner}>
          <Text style={s.offlineTitle}>📴 Offline Mode</Text>
          <Text style={s.offlineText}>
            {cacheAge
              ? `Cached data from ${cacheAge} — availability may differ`
              : 'No cached data available'}
          </Text>
        </View>
      )}

      {/* Legend */}
      <View style={s.legend}>
        {[['Available','#22c55e'],['Busy','#f59e0b'],
          ['Faulted','#ef4444'],['Offline','#6b7280']].map(([label, color]) => (
          <View key={label} style={s.legendItem}>
            <View style={[s.legendDot, { backgroundColor: color }]} />
            <Text style={s.legendText}>{label}</Text>
          </View>
        ))}
      </View>

      {isLoading && (
        <View style={s.loadingBadge}>
          <ActivityIndicator size="small" color="#22d3ee" />
        </View>
      )}

      {/* Filter sheet backdrop + sheet */}
      {showFilterSheet && (
        <TouchableOpacity style={s.overlay}
          onPress={toggleFilterSheet} activeOpacity={1}>
          <FilterSheet visible={showFilterSheet}
            onClose={toggleFilterSheet} />
        </TouchableOpacity>
      )}

      {/* Charger modal */}
      <Modal visible={modalVisible} animationType="slide" transparent
        onRequestClose={() => setModalVisible(false)}>
        <View style={s.modalOverlay}>
          <View style={s.modalCard}>
            {selected && (
              <ScrollView showsVerticalScrollIndicator={false}>
                {/* Header */}
                <View style={s.modalHeader}>
                  <View style={{ flex: 1 }}>
                    <Text style={s.modalTitle}>{selected.chargeBoxId}</Text>
                    <Text style={s.modalName}>{selected.name}</Text>
                  </View>
                  <TouchableOpacity
                    onPress={() => setModalVisible(false)}
                    style={s.closeBtn}>
                    <Text style={s.closeTxt}>✕</Text>
                  </TouchableOpacity>
                </View>

                {/* Info */}
                <Text style={s.infoRow}>
                  📍 {selected.street}, {selected.city}
                </Text>
                {selected.distance != null && (
                  <Text style={s.infoRow}>
                    📏 {selected.distance < 1
                      ? `${Math.round(selected.distance * 1000)}m away`
                      : `${selected.distance.toFixed(1)}km away`}
                  </Text>
                )}
                <Text style={s.infoRow}>
                  ⚡ {selected.availableConnectors}/{selected.totalConnectors} available
                  {selected.maxPower
                    ? `  ·  ${(selected.maxPower / 1000).toFixed(0)} kW max`
                    : ''}
                </Text>

                {/* Status + Navigate */}
                <View style={s.actionRow}>
                  <View style={[s.statusBadge,
                    { backgroundColor:
                        (STATUS_COLOR[selected.status] || '#6b7280') + '22' }]}>
                    <View style={[s.statusDot,
                      { backgroundColor:
                          STATUS_COLOR[selected.status] || '#6b7280' }]} />
                    <Text style={[s.statusText,
                      { color: STATUS_COLOR[selected.status] || '#6b7280' }]}>
                      {selected.status}
                    </Text>
                  </View>
                  <TouchableOpacity style={s.navigateBtn}
                    onPress={() => handleNavigate(selected)}>
                    <Text style={s.navigateTxt}>🧭 Navigate</Text>
                  </TouchableOpacity>
                </View>

                {/* Pricing */}
                <PricingCard
                  charger={selected}
                  connectorId={selectedConnector}
                  user={user}
                />

                {/* Connectors */}
                <Text style={s.sectionTitle}>SELECT CONNECTOR</Text>
                <View style={s.connectorGrid}>
                  {(selected.connectors || []).map(conn => {
                    const available = conn.status === 'Available';
                    const isSel    = selectedConnector === conn.connectorId;
                    const clr      = STATUS_COLOR[conn.status] || '#6b7280';
                    return (
                      <TouchableOpacity
                        key={conn.connectorId}
                        style={[s.connCard,
                          { borderColor: isSel ? '#22d3ee' : clr },
                          isSel && s.connCardSel,
                          !available && s.connCardDim,
                        ]}
                        onPress={() =>
                          available && setSelectedConnector(conn.connectorId)}
                        disabled={!available}>
                        <Text style={s.connIcon}>🔌</Text>
                        <Text style={s.connId}>#{conn.connectorId}</Text>
                        <View style={[s.connDot, { backgroundColor: clr }]} />
                        <Text style={[s.connStatus, { color: clr }]}>
                          {conn.status}
                        </Text>
                        {isSel && <Text style={s.connTick}>✓</Text>}
                      </TouchableOpacity>
                    );
                  })}
                </View>

                {/* Start button */}
                {selected.status === 'Available' && (
                  <TouchableOpacity
                    style={[s.startBtn,
                      (!selectedConnector || starting) && s.startBtnDim]}
                    onPress={handleStartCharging}
                    disabled={!selectedConnector || starting}>
                    {starting
                      ? <ActivityIndicator color="#0f172a" />
                      : <Text style={s.startBtnTxt}>
                          {selectedConnector
                            ? `⚡ Start on Connector ${selectedConnector}`
                            : '← Select a connector above'}
                        </Text>}
                  </TouchableOpacity>
                )}
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>

      <AssistantChat onAction={handleAssistantAction} />
    </View>
  );
}

// ── Styles ────────────────────────────────────────────
const s = StyleSheet.create({
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
  offlineBanner: {
    position: 'absolute', top: 60, left: 16, right: 16,
    backgroundColor: '#78350f', borderRadius: 10,
    padding: 12, borderWidth: 1, borderColor: '#d97706',
  },
  offlineTitle: {
    color: '#fcd34d', fontSize: 13, fontWeight: '700', marginBottom: 2,
  },
  offlineText: { color: '#fde68a', fontSize: 12, lineHeight: 16 },
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
  closeTxt: { color: '#64748b', fontSize: 20 },
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

// ── Marker styles ─────────────────────────────────────
const mk = StyleSheet.create({
  container: { alignItems: 'center' },
  badge: {
    minWidth: 40, paddingHorizontal: 6, paddingVertical: 4,
    borderRadius: 8, alignItems: 'center',
    borderWidth: 2, borderColor: '#fff',
    shadowColor: '#000', shadowOpacity: 0.3,
    shadowRadius: 3, elevation: 5,
  },
  icon:    { fontSize: 14, color: '#fff' },
  //  style is named 'count', referenced correctly
  count:   { fontSize: 9,  color: '#fff', fontWeight: '700' },
  rate:    { fontSize: 8,  color: '#fde68a', fontWeight: '700' },
  pointer: {
    width: 0, height: 0,
    borderLeftWidth: 5, borderRightWidth: 5, borderTopWidth: 6,
    borderLeftColor: 'transparent', borderRightColor: 'transparent',
  },
});

// ── PricingCard styles ────────────────────────────────
const pc = StyleSheet.create({
  card: {
    backgroundColor: '#0f172a', borderRadius: 12,
    padding: 14, marginBottom: 14,
    borderWidth: 1, borderColor: '#1e3a5f',
  },
  header: { flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'center', marginBottom: 6 },
  title:    { color: '#60a5fa', fontSize: 13, fontWeight: '700' },
  rateName: { color: '#475569', fontSize: 12 },
  rate:     { color: '#22d3ee', fontSize: 20, fontWeight: '800',
    marginBottom: 6 },
  feeRow: {
    backgroundColor: '#1c1a0e', borderRadius: 6,
    paddingHorizontal: 10, paddingVertical: 4,
    alignSelf: 'flex-start', marginBottom: 8,
  },
  feeText:   { color: '#fbbf24', fontSize: 11, fontWeight: '600' },
  tiers:     { gap: 3, marginBottom: 8 },
  tiersTitle:{ color: '#475569', fontSize: 10, marginBottom: 4 },
  tierRow:   { flexDirection: 'row', justifyContent: 'space-between' },
  tierLabel: { color: '#64748b', fontSize: 12 },
  tierRate:  { color: '#94a3b8', fontSize: 12, fontWeight: '600' },
  hint:      { color: '#334155', fontSize: 11, fontStyle: 'italic',
    marginTop: 6 },
  estimateLoading: { flexDirection: 'row', alignItems: 'center',
    gap: 8, marginTop: 8 },
  estimateLoadingText: { color: '#475569', fontSize: 12 },
  estimate:  { backgroundColor: '#1e293b', borderRadius: 8,
    padding: 10, marginTop: 8 },
  estimateTitle: { color: '#64748b', fontSize: 11, fontWeight: '700',
    marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.5 },
  estimateRow: { flexDirection: 'row', justifyContent: 'space-between',
    marginBottom: 4 },
  estimateLabel: { color: '#64748b', fontSize: 13 },
  estimateValue: { color: '#f1f5f9', fontSize: 13, fontWeight: '700' },
  breakdown: { color: '#475569', fontSize: 11, marginTop: 6, lineHeight: 16 },
  noVehicle: { color: '#475569', fontSize: 12, fontStyle: 'italic' },
});

// ── FilterSheet styles ────────────────────────────────
const fs = StyleSheet.create({
  sheet: {
    backgroundColor: '#1e293b', borderTopLeftRadius: 24,
    borderTopRightRadius: 24, padding: 24, paddingBottom: 40,
  },
  handle: {
    width: 40, height: 4, backgroundColor: '#334155',
    borderRadius: 2, alignSelf: 'center', marginBottom: 16,
  },
  title:    { color: '#f1f5f9', fontSize: 18, fontWeight: '800',
    marginBottom: 20 },
  label:    { color: '#64748b', fontSize: 11, fontWeight: '600',
    textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 },
  row:      { flexDirection: 'row', gap: 8, marginBottom: 20 },
  chipScroll: { marginBottom: 20 },
  chip: {
    backgroundColor: '#0f172a', borderRadius: 20,
    paddingHorizontal: 14, paddingVertical: 8,
    marginRight: 8, borderWidth: 1, borderColor: '#334155',
  },
  chipActive:     { backgroundColor: '#0c4a6e', borderColor: '#22d3ee' },
  chipText:       { color: '#64748b', fontSize: 13 },
  chipTextActive: { color: '#22d3ee', fontWeight: '600' },
  actions:  { flexDirection: 'row', gap: 12, marginTop: 8 },
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