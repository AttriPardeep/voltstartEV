// src/store/sessionStore.ts
import { create } from 'zustand';
import { api, API_BASE } from '../utils/api';
import { useAuthStore } from './authStore';          
import { showLocalNotification } from '../services/notifications';
import { emitSocketEvent } from '../utils/socket';

// ─────────────────────────────────────────────────────────────
// Interfaces
// ─────────────────────────────────────────────────────────────
export interface Session {
  sessionId: number;
  steveTransactionPk: number;
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

// Full interface — every field used in set() must be declared here
interface SessionState {
  activeSession:    Session | null;
  telemetry:        Telemetry | null;
  isLoading:        boolean;
  wsConnected:      boolean;           
  reconnectAttempts: number;           
  lastTelemetryAt:  number | null;     
  ws:               WebSocket | null;  

  fetchActiveSession: () => Promise<void>;
  startSession:       (chargeBoxId: string, connectorId: number, idTag: string) => Promise<any>;
  stopSession:        (sessionId: number) => Promise<void>;
  updateTelemetry:    (t: Telemetry) => void;
  connectWebSocket:   () => Promise<void>;
  disconnectWebSocket: () => void;
}

// ─────────────────────────────────────────────────────────────
// Helper: Map backend telemetry to frontend interface
// ─────────────────────────────────────────────────────────────
function mapTelemetry(msg: any): Telemetry {
  const data = msg.data || msg;
  return {
    energyKwh:   Number(data.energyKwh  ?? data.liveEnergyKwh ?? 0),
    powerW:      Number(data.powerW     ?? 0),
    currentA:    Number(data.currentA   ?? 0),
    voltageV:    Number(data.voltageV   ?? 0),
    costSoFar:   Number(data.safeCost   ?? data.costSoFar ?? 0),
    socPercent:  data.socPercent  != null ? Number(data.socPercent)  : undefined,
    meterWh:     data.meterWh     != null ? Number(data.meterWh)     : undefined,
    timestamp:   data.timestamp,
    transactionId: data.transactionId,
    chargeBoxId:   data.chargeBoxId,
    connectorId:   data.connectorId,
  };
}

// ─────────────────────────────────────────────────────────────
// Store
// ─────────────────────────────────────────────────────────────
export const useSessionStore = create<SessionState>((set, get) => ({
  // ── Initial state ────────────────────────────────────────
  activeSession:     null,
  telemetry:         null,
  isLoading:         false,
  wsConnected:       false,    
  reconnectAttempts: 0,        
  lastTelemetryAt:   null,     
  ws:                null,     

  // ── fetchActiveSession ───────────────────────────────────
  fetchActiveSession: async () => {
    try {
      const res = await api.get('/api/charging/session/active');
      const raw = res.data?.data;

      if (!raw || raw.status === 'pending' || !raw.session_id) {
        set({ activeSession: null });
        return;
      }

      set({
        activeSession: {
          sessionId:          raw.session_id,
          steveTransactionPk: raw.steve_transaction_pk,
          chargeBoxId:        raw.charge_box_id,
          connectorId:        raw.connector_id,
          status:             raw.status,
          startTime:          raw.start_time,
          energyKwh:          Number(raw.energy_kwh  ?? 0),
          costSoFar:          Number(raw.cost_so_far ?? raw.total_cost ?? 0),
        }
      });
    } catch (err) {
      console.warn('Fetch active session error:', err);
      set({ activeSession: null });
    }
  },

  // ── startSession ─────────────────────────────────────────
  startSession: async (chargeBoxId, connectorId, idTag) => {
    set({ isLoading: true });
    try {
      const res = await api.post(
        '/api/charging/start',
        { chargeBoxId, connectorId, idTag },
        { timeout: 45000 }
      );
      set({ isLoading: false });

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

  // ── stopSession ──────────────────────────────────────────
  stopSession: async (sessionId) => {
    set({ isLoading: true });
    try {
      const { activeSession } = get();
      if (!activeSession) throw new Error('No active session to stop');

      await api.post(
        '/api/charging/stop',
        {
          chargeBoxId:   activeSession.chargeBoxId,
          transactionId: activeSession.steveTransactionPk,
        },
        { timeout: 45000 }
      );

      set({ activeSession: null, telemetry: null, isLoading: false });
    } catch (err) {
      set({ isLoading: false });
      throw err;
    }
  },

  // ── connectWebSocket ─────────────────────────────────────
  connectWebSocket: async () => {
    const existing = get().ws;
    if (existing && existing.readyState === WebSocket.OPEN) {
      console.log('WebSocket already connected');
      return;
    }
  
    let token: string | null = null;
    try {
      token = useAuthStore.getState().token;
      if (!token) {
        const AsyncStorage =
          require('@react-native-async-storage/async-storage').default;
        token = await AsyncStorage.getItem('auth_token');
      }
    } catch (err) {
      console.warn('Token read error:', err);
    }
  
    if (!token) {
      console.log(' No token — skipping WebSocket connect');
      return;
    }
  
    // token in URL query param — backend reads it on HTTP upgrade
    // Backend extractToken() checks ?token= BEFORE any WS messages
    const wsUrl = `ws://136.113.7.146:3000/ws/charging?token=${encodeURIComponent(token)}`;
    console.log('🔌 Connecting WebSocket');
  
    const socket = new WebSocket(wsUrl);
    set({ ws: socket });
  
    socket.onopen = () => {
      console.log('WebSocket connected — authenticated via URL token');
      // No need to send authenticate message — server already authenticated
      // on the HTTP upgrade handshake
    };
  
    socket.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        console.log('WS message:', msg.type, JSON.stringify(msg));
        emitSocketEvent(msg.type, msg);
  
        switch (msg.type) {
          case 'connected':
            // Server sends this after successful auth
            console.log('WS authenticated, userId:', msg.userId);
            set({ wsConnected: true, reconnectAttempts: 0 });
            break;
  
          case 'session_started':
            get().fetchActiveSession();
            break;
  
          case 'telemetry:update': {
            const telemetry = mapTelemetry(msg);
            set({ telemetry, lastTelemetryAt: Date.now() });
            break;
          }
  
          case 'session_completed':
            set({ activeSession: null, telemetry: null });
            get().fetchActiveSession();
            break;
  
          case 'balance_critical':
            // Already emitted via socket bridge above
            break;
  
          case 'error':
            console.error('WS server error:', msg.message);
            break;
        }
      } catch (e) {
        console.warn('WS parse error:', e);
      }
    };
  
    socket.onclose = (event) => {
      console.log(`WebSocket closed: code=${event.code} reason=${event.reason}`);
      set({ wsConnected: false, ws: null });
  
      const intentional = event.code === 1000
        || event.code === 4001
        || event.code === 4002;
  
      if (!intentional) {
        const attempts = get().reconnectAttempts;
        const delay = Math.min(5000 * Math.pow(1.5, attempts), 30000);
        set({ reconnectAttempts: attempts + 1 });
        console.log(`Reconnecting in ${delay}ms (attempt ${attempts + 1})`);
        setTimeout(() => get().connectWebSocket(), delay);
      } else {
        set({ reconnectAttempts: 0 });
      }
    };
  
    socket.onerror = (error) => {
      console.warn('WebSocket error:', error);
    };
  },
  
  // ── disconnectWebSocket ──────────────────────────────────
  disconnectWebSocket: () => {
    // Read ws from zustand state — not module-level variable
    const { ws } = get();
    if (ws) {
      ws.close(1000, 'Client disconnect');
      console.log('WebSocket disconnected intentionally');
    }
    set({ ws: null, wsConnected: false, reconnectAttempts: 0 });
  },
  // ── updateTelemetry ──────────────────────────────────────
  updateTelemetry: (t) => set({ telemetry: t }),
}));

// ─────────────────────────────────────────────────────────────
// Export socket bridge
// ─────────────────────────────────────────────────────────────
export { getSocket } from '../utils/socket';