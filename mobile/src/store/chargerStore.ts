// src/store/chargerStore.ts
import { create } from 'zustand';
import * as Location from 'expo-location';
import { api } from '../utils/api';

export interface Connector {
  connectorId: number;
  status: string;
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
}

interface ChargerState {
  chargers: Charger[];
  userLocation: { latitude: number; longitude: number } | null;
  isLoading: boolean;
  locationPermission: boolean;
  fetchChargers: () => Promise<void>;
  requestLocation: () => Promise<void>;
}

// Add this above the store in chargerStore.ts
/* 
 * For TEST
 */
 
/*
const CHARGER_COORDS: Record<string, { latitude: number; longitude: number; city: string; street: string }> = {
  'CS-AC7K-00001':     { latitude: 19.068812, longitude: 72.833191, city: 'Mumbai',    street: 'Linking Road' },
  'CS-AC7K-00002':     { latitude: 19.119677, longitude: 72.846421, city: 'Mumbai',    street: 'SV Road' },
  'CS-AC22K-00001':    { latitude: 19.033048, longitude: 73.029662, city: 'Navi Mumbai',street: 'Palm Beach Road' },
  'CS-AC22K-00002':    { latitude: 19.148202, longitude: 72.937573, city: 'Mumbai',    street: 'LBS Marg' },
  'CS-DC50K-00001':    { latitude: 19.218331, longitude: 72.978089, city: 'Thane',     street: 'Eastern Express Highway' },
  'CS-DC50K-00002':    { latitude: 18.520411, longitude: 73.856743, city: 'Pune',      street: 'JM Road' },
  'CS-DC150K-00001':   { latitude: 18.559005, longitude: 73.786826, city: 'Pune',      street: 'Baner Road' },
  'CS-DC150K-00002':   { latitude: 18.591212, longitude: 73.738909, city: 'Pune',      street: 'Hinjewadi Phase 1' },
  'CS-CHAD50K-00001':  { latitude: 12.975526, longitude: 77.606790, city: 'Bengaluru', street: 'MG Road' },
  'CS-AC11K3P-00001':  { latitude: 12.934533, longitude: 77.688416, city: 'Bengaluru', street: 'Outer Ring Road' },
  'CS-HPC350K-00001':  { latitude: 17.412627, longitude: 78.439167, city: 'Hyderabad', street: 'Banjara Hills' },
  'CS-SCHUKO3K-00001': { latitude: 17.440081, longitude: 78.348915, city: 'Hyderabad', street: 'Gachibowli' },
};
*/
export const useChargerStore = create<ChargerState>((set, get) => ({
  chargers: [],
  userLocation: null,
  isLoading: false,
  locationPermission: false,

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
      const { userLocation } = get();
      const params = userLocation 
        ? `?lat=${userLocation.latitude}&lng=${userLocation.longitude}` 
        : '';
      
      const res = await api.get(`/api/chargers${params}`);
      console.log('API response count:', res.data.data?.length);
      console.log('First charger:', JSON.stringify(res.data.data?.[0]));
      
      const chargers: Charger[] = (res.data.data || [])
        .filter((c: any) => {
          const hasCoords = c.latitude != null && c.longitude != null;
          if (!hasCoords) console.log('Missing coords:', c.chargeBoxId);
          return hasCoords;
        })
        .map((c: any) => ({
          ...c,
          latitude: Number(c.latitude),
          longitude: Number(c.longitude),
          connectors: Array.from({ length: c.totalConnectors || 1 }, (_, i) => ({
            connectorId: i + 1,
            status: i < (c.availableConnectors || 0) ? 'Available' : 'Charging',
          })),
        }));
  
      console.log('Chargers after filter:', chargers.length);
      set({ chargers, isLoading: false });
    } catch (err) {
      console.warn('Failed to fetch chargers:', err);
      set({ isLoading: false });
    }
  },
}));