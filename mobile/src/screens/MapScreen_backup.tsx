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
import { MaterialCommunityIcons } from '@expo/vector-icons';

const STATUS_COLOR: Record<string, string> = {
  Available:   '#22c55e',
  Busy:        '#f59e0b',
  Charging:    '#3b82f6',
  Reserved:    '#f59e0b',
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
  { label: 'Any',  value: 999 },
  { label: '≤₹8',  value: 8   },
  { label: '≤₹10', value: 10  },
  { label: '≤₹15', value: 15  },
  { label: '≤₹20', value: 20  },
];

// ─────────────────────────────────────────────────────
// Three changes:
//   a) tracksViewChanges={!rendered} → true on first frame only,
//      then locked false via onLayout. This is the correct Fabric
//      (New Architecture) pattern for custom view markers.
//   b) Added `isReserved` prop so the marker can show 🕐 badge.
//   c) Custom memo comparator — only re-render when status,
//      connector counts, or reservation state actually changes.
// ─────────────────────────────────────────────────────
const MARKER_W = 44;
const MARKER_H = 48;

const ChargerMarker = React.memo(({ charger, onPress, isReserved }: {
  charger: Charger;
  onPress: (c: Charger) => void;
  isReserved: boolean;
}) => {
  // tracksViewChanges fix: allow one render cycle to measure, then lock
  const [rendered, setRendered] = useState(false);

  const bgColor =
    isReserved              ? '#7c3aed' :   // purple for reserved
    charger.status === 'Available' ? '#10b981' :
    charger.status === 'Busy'      ? '#f59e0b' :
    charger.status === 'Charging'  ? '#3b82f6' :
    charger.status === 'Faulted'   ? '#ef4444' : '#6b7280';

  const connectorLabel =
    `${charger.availableConnectors ?? 0}/${charger.totalConnectors ?? 0}`;

  return (
    <Marker
      coordinate={{ latitude: charger.latitude, longitude: charger.longitude }}
      onPress={() => onPress(charger)}
      anchor={{ x: 0.5, y: 1 }}
      // true until first layout, then false — stops flicker AND
      // ensures correct size on Fabric/New Architecture
      tracksViewChanges={!rendered}
      stopPropagation
    >
      {/* explicit px dimensions required on Fabric */}
      <View
        style={{ width: MARKER_W + 12, height: MARKER_H + 10, alignItems: 'center' }}
        onLayout={() => setRendered(true)}
      >
        <View style={[sq.badge, { backgroundColor: bgColor }]}>
          {/* Reservation icon overrides ⚡ when this connector is reserved */}
          <Text style={sq.icon}>{isReserved ? '🕐' : '⚡'}</Text>
          <Text style={sq.count}>{connectorLabel}</Text>
        </View>
        <View style={[sq.pointer, { borderTopColor: bgColor }]} />
      </View>
    </Marker>
  );
},
// custom comparator — skip re-render if nothing visible changed
(prev, next) =>
  prev.charger.status              === next.charger.status &&
  prev.charger.availableConnectors === next.charger.availableConnectors &&
  prev.charger.totalConnectors     === next.charger.totalConnectors &&
  prev.isReserved                  === next.isReserved
);

// ── Marker styles ─────────────────────────────────────
const sq = StyleSheet.create({
  badge: {
    width: MARKER_W,
    height: MARKER_H,
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
  },
  icon: {
    fontSize: 20,
    color: '#fff',
    marginBottom: 1,
    includeFontPadding: false,
  },
  count: {
    fontSize: 11,
    color: '#fff',
    fontWeight: '800',
    letterSpacing: 0.3,
    includeFontPadding: false,
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
  const [estimate, setEstimate] = useState<any>(null);
  const [loading,  setLoading]  = useState(false);

  useEffect(() => {
    if (!connectorId) { setEstimate(null); return; }
    if (!charger.pricing) return;

    setLoading(true);
    const params = new URLSearchParams({
      connectorId: connectorId.toString(),
      maxPowerKw: charger.maxPower
        ? (charger.maxPower / 1000).toString() : '22',
    });
    if (user?.batteryCapacityKwh)
      params.append('batteryKwh', user.batteryCapacityKwh.toString());
    if (user?.targetSocPercent)
      params.append('targetSoc', user.targetSocPercent.toString());

    api.get(`/api/chargers/${charger.chargeBoxId}/pricing-estimate?${params}`)
      .then(r => setEstimate(r.data.data))
      .catch(() => setEstimate(null))
      .finally(() => setLoading(false));
  }, [connectorId, charger.chargeBoxId]);

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

      <Text style={pc.rate}>{pricing.rateDisplay}</Text>

      {pricing.sessionFee > 0 && (
        <View style={pc.feeRow}>
          <Text style={pc.feeText}>
            + ₹{pricing.sessionFee.toFixed(0)} session fee
          </Text>
        </View>
      )}

      {!!pricing.tiers?.length && (
        <View style={pc.tiers}>
          <Text style={pc.tiersTitle}>Tiered by power delivered:</Text>
          {pricing.tiers.map((tier: any, i: number) => (
            <View key={i} style={pc.tierRow}>
              <Text style={pc.tierLabel}>Up to {tier.max_kw} kW</Text>
              <Text style={pc.tierRate}>
                ₹{tier.rate_per_kwh.toFixed(2)}/kWh
              </Text>
            </View>
          ))}
        </View>
      )}

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
export default function MapScreen({ navigation }: any) {
  const {
    chargers, fetchChargers, requestLocation,
    userLocation, isLoading,
    isOffline, cacheAge,
  } = useChargerStore();

  const { startSession, fetchActiveSession, activeSession } = useSessionStore();
  const { user } = useAuthStore();
  const { filters, setFilters, showFilterSheet, toggleFilterSheet } = useFilterStore();

  const [selected, setSelected]                     = useState<Charger | null>(null);
  const [modalVisible, setModalVisible]             = useState(false);
  const [selectedConnector, setSelectedConnector]   = useState<number | null>(null);
  const [starting, setStarting]                     = useState(false);
  const [reserving, setReserving]                   = useState(false);
  const [activeReservation, setActiveReservation]   = useState<any>(null);

  const startingRef = useRef(false);
  const mapRef      = useRef<MapView>(null);

  // derive isReserved from activeReservation for marker
  // This lets ChargerMarker show 🕐 without needing a separate API call
  const reservedChargeBoxId = activeReservation?.chargeBoxId ?? null;

  // filteredChargers computed before any useEffect that references it
  const filteredChargers = useMemo(() =>
    (chargers || []).filter(c => {
      if (filters.availability === 'available' && c.status !== 'Available')
        return false;
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

  // Initial load + polling
  useEffect(() => {
    requestLocation();
    fetchActiveSession();
    fetchChargers();
    
    // 2 min polling instead of 30s — WebSocket handles real-time updates
    const interval = setInterval(fetchChargers, 2 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  // Load active reservation once on mount
  useEffect(() => {
    api.get('/api/reservations/active')
      .then(r => {
        if (r.data.success && r.data.data) {
          setActiveReservation(r.data.data);
        }
      })
      .catch(() => {});
  }, []);

  // Refresh reservation when modal opens for a new charger
  useEffect(() => {
    if (!modalVisible) return;
    api.get('/api/reservations/active')
      .then(r => setActiveReservation(r.data.success ? r.data.data : null))
      .catch(() => setActiveReservation(null));
  }, [modalVisible, selected?.chargeBoxId]);

  // Center on user location
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
    if (userLocation?.latitude) return;
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
    // Block charging when offline — suggest RFID instead
    if (isOffline) {
      Alert.alert(
        'Offline Mode',
        'Charging cannot be started while offline. Please tap your registered RFID card on the charger to begin charging.',
        [{ text: 'OK' }]
      );
      return;
    }	  
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
      const idTag = user?.idTag;
      if (!idTag) {
        Alert.alert(
          'Account Setup Incomplete',
          'Your charging tag is not set up yet. Please log out and log back in.',
          [{ text: 'OK' }]
        );
        setStarting(false);
        startingRef.current = false;
        return;
      }	  
      await startSession(selected.chargeBoxId, selectedConnector, idTag);
      setModalVisible(false);
      setSelectedConnector(null);
      // Clear reservation if session started on reserved connector
      if (activeReservation?.chargeBoxId === selected.chargeBoxId) {
        setActiveReservation(null);
      }
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
          ? [{ text: 'Check Session Tab', onPress: () => setModalVisible(false) },
             { text: 'OK' }]
          : [{ text: 'OK' }]
      );
    } finally {
      setStarting(false);
      startingRef.current = false;
    }
  };

  const handleReserve = async () => {
    //Block reservation when offline
    if (isOffline) {
      Alert.alert(
        'Offline Mode',
        'Reservations cannot be made while offline. Please connect to Team to reserve a charger.',
        [{ text: 'OK' }]
      );
      return;
    }	  
    if (!selected || !selectedConnector) return;
    setReserving(true);
    try {
      const res = await api.post('/api/reservations', {
        chargeBoxId: selected.chargeBoxId,
        connectorId: selectedConnector,
      },{ timeout: 60000 });
      const newReservation = res.data.data;
      setActiveReservation(newReservation);

      // Fetch fresh chargers THEN use store's updated array
      // use store getter after fetch to avoid stale closure
      await fetchChargers();
      const freshChargers = useChargerStore.getState().chargers;
      const updatedCharger = freshChargers.find(
        c => c.chargeBoxId === selected.chargeBoxId
      );
      if (updatedCharger) setSelected(updatedCharger);

      setModalVisible(false);
      Alert.alert(
        '🕐 Reserved!',
        `Connector #${selectedConnector} on ${selected.chargeBoxId} is held for 30 minutes.`
      );
    } catch (err: any) {
      Alert.alert('Failed', err?.response?.data?.error || 'Could not reserve');
    } finally {
      setReserving(false);
    }
  };

  const handleCancelReservation = async () => {
    if (!activeReservation) return;

    Alert.alert(
      'Cancel Reservation',
      'Are you sure you want to cancel this reservation?',
      [
        { text: 'No', style: 'cancel' },
        {
          text: 'Yes, Cancel',
          style: 'destructive',
          onPress: async () => {
            try {
              await api.delete(`/api/reservations/${activeReservation.id}`);

              // Clear reservation state FIRST
              setActiveReservation(null);

              // use store getter after fetch — not stale closure `chargers`
              await fetchChargers();
              const freshChargers = useChargerStore.getState().chargers;
              const updatedCharger = freshChargers.find(
                c => c.chargeBoxId === selected?.chargeBoxId
              );
              if (updatedCharger) setSelected(updatedCharger);

              Alert.alert('Cancelled', 'Your reservation has been cancelled.');
            } catch (err: any) {
              Alert.alert('Failed',
                err?.response?.data?.error || 'Could not cancel reservation');
            }
          },
        },
      ]
    );
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
          // pass isReserved so marker shows 🕐 icon
          <ChargerMarker
            key={charger.chargeBoxId}
            charger={charger}
            onPress={handleMarkerPress}
            isReserved={reservedChargeBoxId === charger.chargeBoxId}
          />
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

      {/* Offline banner */}
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

      {/* Active reservation global banner (visible outside modal) */}
      {activeReservation && !modalVisible && (
        <View style={s.globalReservationBanner}>
          <Text style={s.globalReservationText}>
            🕐 Reservation active — {Math.max(0, Math.floor(
              (new Date(activeReservation.expiresAt).getTime() - Date.now()) / 60000
            ))} min left on {activeReservation.chargeBoxId}
          </Text>
          <TouchableOpacity onPress={handleCancelReservation}>
            <Text style={s.globalReservationCancel}>Cancel</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Legend */}
      <View style={s.legend}>
        {[
          ['Available', '#22c55e'],
          ['Busy',      '#f59e0b'],
          ['Faulted',   '#ef4444'],
          ['Reserved',  '#7c3aed'],
          ['Offline',   '#6b7280'],
        ].map(([label, color]) => (
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

      {/* Filter sheet */}
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

                {/* Active reservation banner (in-modal) */}
                {activeReservation?.chargeBoxId === selected?.chargeBoxId && (
                  <View style={s.reservationBanner}>
                    <View>
                      <Text style={s.reservationBannerText}>
                        🕐 Your reservation is active
                      </Text>
                      <Text style={[s.reservationBannerText,
                        { fontSize: 11, opacity: 0.8 }]}>
                        Connector #{activeReservation.connectorId} · expires in{' '}
                        {Math.max(0, Math.floor(
                          (new Date(activeReservation.expiresAt).getTime() - Date.now())
                          / 60000
                        ))} min
                      </Text>
                    </View>
                    <TouchableOpacity onPress={handleCancelReservation}>
                      <Text style={s.reservationCancelText}>Cancel</Text>
                    </TouchableOpacity>
                  </View>
                )}

                {/* Connectors */}
                <Text style={s.sectionTitle}>SELECT CONNECTOR</Text>
                <View style={s.connectorGrid}>
                  {(selected.connectors || []).map(conn => {
                    const available   = conn.status === 'Available';
                    const isReserved  = conn.status === 'Reserved';
                    // also highlight if THIS connector is the one we reserved
                    const isMyRes     =
                      activeReservation?.chargeBoxId === selected.chargeBoxId &&
                      activeReservation?.connectorId === conn.connectorId;
                    const isSel       = selectedConnector === conn.connectorId;
                    const clr         = isMyRes
                      ? '#7c3aed'
                      : STATUS_COLOR[conn.status] || '#6b7280';

                    return (
                      <TouchableOpacity
                        key={conn.connectorId}
                        style={[
                          s.connCard,
                          { borderColor: isSel ? '#22d3ee' : clr },
                          isSel     && s.connCardSel,
                          isMyRes   && s.connCardMyReserved,
                          isReserved && !isMyRes && s.connCardReserved,
                          (!available && !isReserved && !isMyRes)
                            && s.connCardDim,
                        ]}
                        onPress={() =>
                          (available || isMyRes) &&
                          setSelectedConnector(conn.connectorId)
                        }
                        disabled={!available && !isMyRes}
                      >
                        <Text style={s.connIcon}>
                          {isMyRes ? '🕐' : '🔌'}
                        </Text>
                        <Text style={s.connId}>#{conn.connectorId}</Text>
                        <View style={[s.connDot, { backgroundColor: clr }]} />
                        <Text style={[s.connStatus, { color: clr }]}>
                          {isMyRes ? 'Your Reservation' : conn.status}
                        </Text>
                        {isMyRes && (
                          <Text style={s.connReservedBadge}>Tap to start</Text>
                        )}
                        {isSel && !isMyRes && (
                          <Text style={s.connTick}>✓</Text>
                        )}
                      </TouchableOpacity>
                    );
                  })}
                </View>

                {/* Start / Reserve buttons */}
                {selected.status === 'Available' && selectedConnector && (
                  <View style={{ gap: 10, marginTop: 10 }}>
                    <TouchableOpacity
                      style={[s.startBtn, starting && s.startBtnDim]}
                      onPress={handleStartCharging}
                      disabled={!selectedConnector || starting}>
                      {starting
                        ? <ActivityIndicator color="#0f172a" />
                        : <Text style={s.startBtnTxt}>
                            ⚡ Start on Connector {selectedConnector}
                          </Text>}
                    </TouchableOpacity>

                    {/* Only show Reserve if no active reservation on this charger */}
                    {!activeReservation && (
                      <TouchableOpacity
                        style={s.reserveBtn}
                        onPress={handleReserve}
                        disabled={reserving}>
                        {reserving
                          ? <ActivityIndicator color="#22d3ee" />
                          : <Text style={s.reserveBtnTxt}>
                              🕐 Reserve for 30 min
                            </Text>}
                      </TouchableOpacity>
                    )}
                  </View>
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
  map:       { flex: 1 },
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
  filterTxt:       { color: '#94a3b8', fontSize: 13, fontWeight: '600' },
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

  // global reservation banner visible on map when modal is closed
  globalReservationBanner: {
    position: 'absolute', top: 60, left: 16, right: 16,
    backgroundColor: '#3b0764', borderRadius: 10,
    padding: 12, borderWidth: 1, borderColor: '#7c3aed',
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'center',
  },
  globalReservationText: {
    color: '#c4b5fd', fontSize: 12, fontWeight: '600', flex: 1,
  },
  globalReservationCancel: {
    color: '#f87171', fontSize: 12, fontWeight: '700', marginLeft: 8,
  },

  legend: {
    position: 'absolute', bottom: 16, left: 16,
    backgroundColor: '#1e293bcc', borderRadius: 10,
    padding: 10, flexDirection: 'row', flexWrap: 'wrap', gap: 8,
  },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  legendDot:  { width: 8, height: 8, borderRadius: 4 },
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
  modalOverlay: {
    flex: 1, backgroundColor: '#00000088', justifyContent: 'flex-end',
  },
  modalCard: {
    backgroundColor: '#1e293b', borderTopLeftRadius: 24,
    borderTopRightRadius: 24, padding: 24, paddingBottom: 40,
    maxHeight: '85%',
  },
  modalHeader: {
    flexDirection: 'row', alignItems: 'flex-start', marginBottom: 8,
  },
  modalTitle: { color: '#22d3ee', fontSize: 16, fontWeight: '800' },
  modalName:  { color: '#94a3b8', fontSize: 12, marginTop: 2 },
  closeBtn:   { padding: 4, marginLeft: 8 },
  closeTxt:   { color: '#64748b', fontSize: 20 },
  infoRow:    { color: '#94a3b8', fontSize: 13, marginBottom: 4 },
  actionRow: {
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between', marginVertical: 10,
  },
  statusBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    borderRadius: 20, paddingHorizontal: 12, paddingVertical: 6,
  },
  statusDot:  { width: 8, height: 8, borderRadius: 4 },
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
  connectorGrid: {
    flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 20,
  },
  connCard: {
    borderWidth: 2, borderRadius: 12, padding: 12,
    alignItems: 'center', minWidth: 80, backgroundColor: '#0f172a',
  },
  connCardSel:        { backgroundColor: '#0c4a6e' },
  connCardDim:        { opacity: 0.4 },
  // my reservation: purple highlight
  connCardMyReserved: {
    backgroundColor: '#2e1065',
    borderColor: '#7c3aed',
    borderWidth: 2,
  },
  // Someone else's reservation: amber
  connCardReserved: {
    backgroundColor: '#1c1a0e',
    borderColor: '#f59e0b',
    borderWidth: 2,
  },
  connIcon:   { fontSize: 20, marginBottom: 4 },
  connId:     { color: '#f1f5f9', fontSize: 14, fontWeight: '700' },
  connDot:    { width: 6, height: 6, borderRadius: 3, marginTop: 4 },
  connStatus: { fontSize: 10, marginTop: 2 },
  connReservedBadge: {
    color: '#c4b5fd', fontSize: 9, fontWeight: '700', marginTop: 2,
  },
  connTick: {
    color: '#22d3ee', fontSize: 16, fontWeight: '800', marginTop: 4,
  },
  startBtn: {
    backgroundColor: '#22d3ee', borderRadius: 14,
    padding: 16, alignItems: 'center', marginTop: 4,
  },
  startBtnDim: { backgroundColor: '#334155' },
  startBtnTxt: { color: '#0f172a', fontWeight: '800', fontSize: 15 },
  reserveBtn: {
    borderRadius: 14, padding: 14, alignItems: 'center',
    borderWidth: 2, borderColor: '#22d3ee', backgroundColor: 'transparent',
  },
  reserveBtnTxt: { color: '#22d3ee', fontWeight: '700', fontSize: 15 },
  reservationBanner: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'center', backgroundColor: '#2e1065',
    borderRadius: 10, padding: 12, marginBottom: 12,
    borderWidth: 1, borderColor: '#7c3aed',
  },
  reservationBannerText: {
    color: '#c4b5fd', fontSize: 13, fontWeight: '600',
  },
  reservationCancelText: { color: '#f87171', fontSize: 13, fontWeight: '600' },
});

// ── PricingCard styles ────────────────────────────────
const pc = StyleSheet.create({
  card: {
    backgroundColor: '#0f172a', borderRadius: 12,
    padding: 14, marginBottom: 14,
    borderWidth: 1, borderColor: '#1e3a5f',
  },
  header: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'center', marginBottom: 6,
  },
  title:    { color: '#60a5fa', fontSize: 13, fontWeight: '700' },
  rateName: { color: '#475569', fontSize: 12 },
  rate:     { color: '#22d3ee', fontSize: 20, fontWeight: '800', marginBottom: 6 },
  feeRow: {
    backgroundColor: '#1c1a0e', borderRadius: 6,
    paddingHorizontal: 10, paddingVertical: 4,
    alignSelf: 'flex-start', marginBottom: 8,
  },
  feeText:    { color: '#fbbf24', fontSize: 11, fontWeight: '600' },
  tiers:      { gap: 3, marginBottom: 8 },
  tiersTitle: { color: '#475569', fontSize: 10, marginBottom: 4 },
  tierRow:    { flexDirection: 'row', justifyContent: 'space-between' },
  tierLabel:  { color: '#64748b', fontSize: 12 },
  tierRate:   { color: '#94a3b8', fontSize: 12, fontWeight: '600' },
  hint: {
    color: '#334155', fontSize: 11, fontStyle: 'italic', marginTop: 6,
  },
  estimateLoading: {
    flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 8,
  },
  estimateLoadingText: { color: '#475569', fontSize: 12 },
  estimate: {
    backgroundColor: '#1e293b', borderRadius: 8, padding: 10, marginTop: 8,
  },
  estimateTitle: {
    color: '#64748b', fontSize: 11, fontWeight: '700',
    marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.5,
  },
  estimateRow: {
    flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4,
  },
  estimateLabel: { color: '#64748b', fontSize: 13 },
  estimateValue: { color: '#f1f5f9', fontSize: 13, fontWeight: '700' },
  breakdown:  { color: '#475569', fontSize: 11, marginTop: 6, lineHeight: 16 },
  noVehicle:  { color: '#475569', fontSize: 12, fontStyle: 'italic' },
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
  title: {
    color: '#f1f5f9', fontSize: 18, fontWeight: '800', marginBottom: 20,
  },
  label: {
    color: '#64748b', fontSize: 11, fontWeight: '600',
    textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8,
  },
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