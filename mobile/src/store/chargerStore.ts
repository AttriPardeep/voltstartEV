// src/store/chargerStore.ts
import { create } from 'zustand';
import * as Location from 'expo-location';
import { api } from '../utils/api';
import { cacheChargers, getCachedChargers, isOnline } from '../services/offlineCache';

export interface Connector {
  connectorId: number;
  status: string;
}

export interface ChargerPricing {
  model: string;
  ratePerKwh: number | null;
  ratePerMinute: number | null;
  sessionFee: number;
  displayName: string;
  rateDisplay: string;
  tiers: Array<{ max_kw: number; rate_per_kwh: number }> | null;
}

export interface Charger {
  chargeBoxId: string;
  vendor?: string;
  model?: string;
  name: string;
  description?: string;
  street?: string;
  city?: string;
  latitude: number;
  longitude: number;
  status: string;
  availableConnectors: number;
  totalConnectors: number;
  distance?: number | null;
  connectors: Connector[];
  powerType?: string;
  maxPower?: number;
  pricing?: ChargerPricing | null;
}

interface ChargerState {
  chargers: Charger[];
  userLocation: { latitude: number; longitude: number } | null;
  isLoading: boolean;
  locationPermission: boolean;
  isOffline: boolean;
  cacheAge: string | null;
  lastEtag: string | null;
  // WebSocket update function
  updateChargerStatus: (
    chargeBoxId: string,
    status: string,
    connectorId?: number,
    connectorStatus?: string
  ) => void;
  fetchChargers: () => Promise<void>;
  requestLocation: () => Promise<void>;
}

const mergeChargers = (existing: Charger[], incoming: Charger[]): Charger[] => {
  const existingMap = new Map(existing.map(c => [c.chargeBoxId, c]));
  let hasChanges = false;

  const merged = incoming.map(newCharger => {
    const old = existingMap.get(newCharger.chargeBoxId);
    if (!old) { hasChanges = true; return newCharger; }

    const statusChanged    = old.status             !== newCharger.status;
    const availableChanged = old.availableConnectors !== newCharger.availableConnectors;
    const connChanged      = JSON.stringify(old.connectors) 
                          !== JSON.stringify(newCharger.connectors);

    if (statusChanged || availableChanged || connChanged) {
      hasChanges = true;
      return { ...old, ...newCharger };
    }
    return old;
  });

  return hasChanges ? merged : existing;
};

export const useChargerStore = create<ChargerState>((set, get) => ({
  chargers: [],
  userLocation: null,
  isLoading: false,
  locationPermission: false,
  isOffline: false,
  cacheAge: null,
  lastEtag: null,

  // Update single charger status from WebSocket
  updateChargerStatus: (chargeBoxId, status, connectorId, connectorStatus) => {
    set(state => {
      const idx = state.chargers.findIndex(c => c.chargeBoxId === chargeBoxId);
      if (idx === -1) return state; // charger not in list, no update

      const existing = state.chargers[idx];

      // Build updated connectors if connector-level update
      let connectors = existing.connectors;
      if (connectorId != null && connectorStatus != null) {
        connectors = existing.connectors.map(c =>
          c.connectorId === connectorId
            ? { ...c, status: connectorStatus }
            : c
        );
      }

      const availableConnectors = connectors.filter(
        c => c.status === 'Available'
      ).length;

      const updated: Charger = {
        ...existing,
        status,
        connectors,
        availableConnectors,
      };

      // Splice to avoid spreading entire array
      const newChargers = [...state.chargers];
      newChargers[idx] = updated;
      return { chargers: newChargers };
    });
  },

  requestLocation: async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        set({ locationPermission: false });
        get().fetchChargers();
        return;
      }
      const location = await Location.getCurrentPositionAsync({ 
        accuracy: Location.Accuracy.Balanced 
      });
      set({ 
        userLocation: { 
          latitude: location.coords.latitude, 
          longitude: location.coords.longitude 
        },
        locationPermission: true
      });
      get().fetchChargers();
    } catch (err) {
      console.warn('Location error:', err);
      get().fetchChargers();
    }
  },

  fetchChargers: async () => {
    set({ isLoading: true });
    
    try {
      const online = await isOnline();

      if (!online) {
        const { cached, timestamp } = await getCachedChargers();
        if (cached) {
          const ageMin = timestamp 
            ? Math.floor((Date.now() - timestamp) / 60000) : null;
          const ageStr = ageMin != null
            ? ageMin < 1 ? 'just now'
            : ageMin < 60 ? `${ageMin}m ago`
            : `${Math.floor(ageMin / 60)}h ago`
            : 'unknown';
          set({ chargers: cached, isLoading: false, 
                isOffline: true, cacheAge: ageStr });
        } else {
          set({ isLoading: false, isOffline: true, cacheAge: null });
        }
        return;
      }

      // ETag support: send If-None-Match header
      const { lastEtag, userLocation } = get();
      const params = userLocation
        ? `?lat=${userLocation.latitude}&lng=${userLocation.longitude}` : '';
      
      const headers: Record<string, string> = {};
      if (lastEtag) headers['If-None-Match'] = lastEtag;

      const res = await api.get(`/api/chargers${params}`, { headers });

      // 304 Not Modified: skip processing, keep existing data
      if (res.status === 304) {
        set({ isLoading: false });
        return;
      }

      // Extract new ETag from response headers
      const newEtag = res.headers['etag'] || res.headers['ETag'] || null;

      // Use connectorStatuses from backend if available, otherwise guess
      const chargers = (res.data.data || [])
        .filter((c: any) => c.latitude != null && c.longitude != null)
        .map((c: any) => {
          const connectors: Connector[] = c.connectorStatuses?.length
            ? c.connectorStatuses.map((cs: any) => ({
                connectorId: cs.connectorId,
                status: cs.status,
              }))
            : Array.from({ length: c.totalConnectors || 1 }, (_, i) => ({
                connectorId: i + 1,
                status: i < (c.availableConnectors || 0) ? 'Available' : 'Charging',
              }));

          return {
            ...c,
            latitude: Number(c.latitude),
            longitude: Number(c.longitude),
            connectors,
            pricing: c.pricing ? {
              model: c.pricing.model,
              ratePerKwh: c.pricing.ratePerKwh,
              ratePerMinute: c.pricing.ratePerMinute,
              sessionFee: c.pricing.sessionFee,
              displayName: c.pricing.displayName,
              rateDisplay: c.pricing.rateDisplay,
              tiers: c.pricing.tiers,
            } : null,
          };
        });

      await cacheChargers(chargers);
      // Update state with merged chargers AND new ETag
      set(state => ({
        chargers: mergeChargers(state.chargers, chargers),
        isLoading: false,
        isOffline: false,
        cacheAge: null,
        lastEtag: newEtag || state.lastEtag,  // Keep old ETag if new one missing
      }));
      
    } catch (err: any) {
      // Handle 304 from axios (might throw as error)
      if (err?.response?.status === 304) {
        set({ isLoading: false });
        return;
      }
      
      // Fallback to cache on error
      const { cached, timestamp } = await getCachedChargers();
      if (cached) {
        set({ chargers: cached, isOffline: true });
      }
      set({ isLoading: false });
    }
  },
}));