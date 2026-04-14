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
  fetchChargers: () => Promise<void>;
  requestLocation: () => Promise<void>;
}

export const useChargerStore = create<ChargerState>((set, get) => ({
  chargers: [],
  userLocation: null,
  isLoading: false,
  locationPermission: false,
  isOffline: false,
  cacheAge: null,

  requestLocation: async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        set({ locationPermission: false });
        // Still fetch without location
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
      get().fetchChargers(); // fetch with location coords
    } catch (err) {
      console.warn('Location error:', err);
      get().fetchChargers(); // fetch anyway without location
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

      const { userLocation } = get();
      const params = userLocation
        ? `?lat=${userLocation.latitude}&lng=${userLocation.longitude}` : '';
      const res = await api.get(`/api/chargers${params}`);

      //Use connectorStatuses from backend if available, otherwise guess
      const chargers = (res.data.data || [])
        .filter((c: any) => c.latitude != null && c.longitude != null)
        .map((c: any) => {
          // ── Per-connector status ──────────────────────
          // Build connectors with correct individual status
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
            // ── Pricing ─────────────────────────────────
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
      set({ chargers, isLoading: false, isOffline: false, cacheAge: null });
    } catch {
      const { cached, timestamp } = await getCachedChargers();
      if (cached) {
        set({ chargers: cached, isOffline: true });
      }
      set({ isLoading: false });
    }
  },
}));