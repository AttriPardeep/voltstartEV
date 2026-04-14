// src/services/offlineCache.ts
import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';

const KEYS = {
  CHARGERS: 'cache:chargers',
  CHARGERS_TS: 'cache:chargers:timestamp',
  ACTIVE_SESSION: 'cache:session:active',
  USER: 'cache:user',
};

const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes for chargers

export async function isOnline(): Promise<boolean> {
  const state = await NetInfo.fetch();
  return state.isConnected === true && state.isInternetReachable === true;
}

export async function getCachedChargers(): Promise<{ 
  cached: any[] | null; timestamp: number | null 
}> {
  try {
    const [data, ts] = await Promise.all([
      AsyncStorage.getItem(KEYS.CHARGERS),
      AsyncStorage.getItem(KEYS.CHARGERS_TS),
    ]);
    return {
      cached: data ? JSON.parse(data) : null,
      timestamp: ts ? parseInt(ts) : null,
    };
  } catch {
    return { cached: null, timestamp: null };
  }
}

export async function cacheChargers(chargers: any[]): Promise<void> {
  try {
    await AsyncStorage.multiSet([
      [KEYS.CHARGERS, JSON.stringify(chargers)],
      [KEYS.CHARGERS_TS, Date.now().toString()],
    ]);
  } catch (e) { console.warn('Cache write failed:', e); }
}


export async function cacheActiveSession(session: any): Promise<void> {
  try {
    if (session) {
      await AsyncStorage.setItem(KEYS.ACTIVE_SESSION, JSON.stringify(session));
    } else {
      await AsyncStorage.removeItem(KEYS.ACTIVE_SESSION);
    }
  } catch (e) { console.warn('Session cache write failed:', e); }
}

export async function getCachedSession(): Promise<any | null> {
  try {
    const data = await AsyncStorage.getItem(KEYS.ACTIVE_SESSION);
    return data ? JSON.parse(data) : null;
  } catch { return null; }
}

export function getCacheAge(timestampStr: string | null): string {
  if (!timestampStr) return 'unknown';
  const age = Date.now() - parseInt(timestampStr);
  const mins = Math.floor(age / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  return `${Math.floor(mins / 60)}h ago`;
}


