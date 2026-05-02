// src/store/sessionStore.ts
import { create } from 'zustand';
import { api, API_BASE } from '../utils/api';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { showLocalNotification } from '../services/notifications';
import { emitSocketEvent } from '../utils/socket';

// ─────────────────────────────────────────────────────────────
// Interfaces
// ─────────────────────────────────────────────────────────────
export interface Session {
  sessionId: number;
  steveTransactionPk: number;  // For OCPP stop command
  chargeBoxId: string;
  connectorId: number;
  status: string;
  startTime: string;
  energyKwh: number;
  costSoFar: number;
}

export interface Telemetry {
  energyKwh: number;
  powerW: number;
  currentA: number;
  voltageV: number;
  costSoFar: number;
  socPercent?: number;
  meterWh?: number;
  timestamp?: string;
  transactionId?: number;
  chargeBoxId?: string;
  connectorId?: number;
}

interface SessionState {
  activeSession: Session | null;
  telemetry: Telemetry | null;
  isLoading: boolean;
  fetchActiveSession: () => Promise<void>;
  startSession: (chargeBoxId: string, connectorId: number, idTag: string) => Promise<any>;
  stopSession: (sessionId: number) => Promise<void>;
  updateTelemetry: (t: Telemetry) => void;
  connectWebSocket: () => Promise<void>;
  disconnectWebSocket: () => void;
}

// ─────────────────────────────────────────────────────────────
// WebSocket State
// ─────────────────────────────────────────────────────────────
let ws: WebSocket | null = null;
let isIntentionalClose = false;

// ─────────────────────────────────────────────────────────────
// Helper: Map backend telemetry to frontend interface
// ─────────────────────────────────────────────────────────────
// ─────────────────────────────────────────────────────────────
// Helper: Map backend telemetry to frontend interface
// ─────────────────────────────────────────────────────────────
function mapTelemetry(msg: any): Telemetry {
  // Backend wraps telemetry in msg.data - extract it!
  const data = msg.data || msg;
  
  return {
    // Required fields with safe defaults
    energyKwh: Number(data.energyKwh ?? data.liveEnergyKwh ?? 0),
    powerW: Number(data.powerW ?? 0),
    currentA: Number(data.currentA ?? 0),
    voltageV: Number(data.voltageV ?? 0),
    // Cost: prefer safeCost (monotonic), fallback to costSoFar
    costSoFar: Number(data.safeCost ?? data.costSoFar ?? 0),
    socPercent: data.socPercent != null ? Number(data.socPercent) : undefined,
    meterWh: data.meterWh != null ? Number(data.meterWh) : undefined,
    timestamp: data.timestamp,
    transactionId: data.transactionId,
    chargeBoxId: data.chargeBoxId,
    connectorId: data.connectorId,
  };
}

// ─────────────────────────────────────────────────────────────
// Store Definition
// ─────────────────────────────────────────────────────────────
export const useSessionStore = create<SessionState>((set, get) => ({
  activeSession: null,
  telemetry: null,
  isLoading: false,

  // ───────────────────────────────────────────────────────────
  // Fetch active session from API
  // ───────────────────────────────────────────────────────────
  fetchActiveSession: async () => {
    try {
      const res = await api.get('/api/charging/session/active');
      const raw = res.data?.data;
      
      // Backend returns {status: 'pending'} when no session — treat as null
      if (!raw || raw.status === 'pending' || !raw.session_id) {
        set({ activeSession: null });
        return;
      }
      
      set({
        activeSession: {
          sessionId: raw.session_id,
          steveTransactionPk: raw.steve_transaction_pk,
          chargeBoxId: raw.charge_box_id,
          connectorId: raw.connector_id,
          status: raw.status,
          startTime: raw.start_time,
          energyKwh: Number(raw.energy_kwh ?? 0),
          costSoFar: Number(raw.cost_so_far ?? raw.total_cost ?? 0),
        }
      });
    } catch (err) {
      console.warn('Fetch active session error:', err);
      set({ activeSession: null });
    }
  },

  // ───────────────────────────────────────────────────────────
  // Start a new charging session
  // ───────────────────────────────────────────────────────────
  startSession: async (chargeBoxId, connectorId, idTag) => {
    set({ isLoading: true });
    try {
      const res = await api.post('/api/charging/start', 
        { chargeBoxId, connectorId, idTag },
        { timeout: 45000 }
      );
      set({ isLoading: false });
  
      // Local notification
      showLocalNotification(
        '⚡ Charging Started!',
        `${chargeBoxId} · Connector ${connectorId} · Session active`,
        { action: 'view_session' }
      );
  
      return res.data;
    } catch (err) {
      set({ isLoading: false });
      throw err;
    }
  },

  // ───────────────────────────────────────────────────────────
  // Stop an active session
  // ───────────────────────────────────────────────────────────
  stopSession: async (sessionId) => {
    set({ isLoading: true });
    try {
      const { activeSession } = get();
      if (!activeSession) throw new Error('No active session to stop');
      
      await api.post(
        '/api/charging/stop',
        { 
          chargeBoxId: activeSession.chargeBoxId,
          transactionId: activeSession.steveTransactionPk 
        },
        { timeout: 45000 } 
      );
      
      set({ activeSession: null, telemetry: null, isLoading: false });
    } catch (err) {
      set({ isLoading: false });
      throw err;
    }
  },

  // ───────────────────────────────────────────────────────────
  // Connect to WebSocket for real-time updates
  // ───────────────────────────────────────────────────────────
  connectWebSocket: async () => {
    if (ws?.readyState === WebSocket.OPEN) return;
    
    const token = await AsyncStorage.getItem('auth_token');
    if (!token) {
      console.warn('No auth token for WebSocket');
      return;
    }
    
    const wsUrl = API_BASE.replace('http', 'ws').replace('https', 'wss') + '/ws/charging';
    console.log('🔌 Connecting WebSocket:', wsUrl);
    
    ws = new WebSocket(`${wsUrl}?token=${token}`);
    
    ws.onopen = () => {
      console.log(' WebSocket connected');
    };
    
    ws.onmessage = (event) => {
      try {
        if (!event.data || typeof event.data !== 'string') return;
        
        const msg = JSON.parse(event.data);
        const msgType = msg.event || msg.type;
        if (!msgType) return;

        console.log('📨 WS message:', msgType, msg);
        
        // Emit to socket bridge for HistoryScreen/etc.
        if (msg.type) {
          emitSocketEvent(msg.type, msg);
        }

        switch (msgType) {
          case 'connected':
            console.log(' WS authenticated, userId:', msg.userId);
			// MapScreen already calls fetchActiveSession on mount:
            // get().fetchActiveSession();
            break;
            
          case 'telemetry:update':
            //  Map backend fields to frontend interface
            const telemetry = mapTelemetry(msg);
            console.log(' Telemetry mapped:', telemetry);
            set({ telemetry });
            break;
            
          case 'session_started':
            console.log(' Session started event received');
            get().fetchActiveSession();
            break;
            
          case 'session_completed':
          case 'session:stopped':
            console.log(' Session completed event received');
            set({ activeSession: null, telemetry: null });
            break;
            
          case 'error':
            console.warn(' WS server error:', msg.message);
            break;
            
          default:
            console.log(' WS: Unknown message type:', msgType);
        }

      } catch (e) {
        console.warn(' WS: Parse error or non-JSON message:', e);
      }
    };
    
    ws.onerror = (e) => {
      console.warn(' WebSocket error:', e);
    };
    
    ws.onclose = (event) => {
      console.log(' WebSocket closed, code:', event.code, 'reason:', event.reason);
      
      // 1000 = normal close, 4001/4002 = auth failure (our custom codes)
      if (event.code === 1000 || event.code === 4001 || event.code === 4002) {
        console.log(' Intentional close - not reconnecting');
        isIntentionalClose = false;
        return;
      }
      
      // For all other codes (1006, 1011, etc.) — reconnect
      console.log(' Unexpected close - reconnecting in 5s...');
      setTimeout(() => {
        if (!isIntentionalClose && ws?.readyState !== WebSocket.OPEN) {
          get().connectWebSocket();
        }
      }, 5000);
    };
  },
  
  // ───────────────────────────────────────────────────────────
  // Disconnect WebSocket intentionally
  // ───────────────────────────────────────────────────────────
  disconnectWebSocket: () => {
    isIntentionalClose = true;
    if (ws) {
      ws.close(1000, 'Client disconnect');
      ws = null;
      console.log(' WebSocket disconnected intentionally');
    }
  },
  
  // ───────────────────────────────────────────────────────────
  // Direct telemetry update (for testing/fallback)
  // ───────────────────────────────────────────────────────────
  updateTelemetry: (t) => set({ telemetry: t }),
}));

// ─────────────────────────────────────────────────────────────
// Export socket bridge for HistoryScreen/etc.
// ─────────────────────────────────────────────────────────────
export { getSocket } from '../utils/socket';