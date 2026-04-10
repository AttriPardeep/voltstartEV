// src/store/sessionStore.ts
import { create } from 'zustand';
import { api, API_BASE } from '../utils/api';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { showLocalNotification } from '../services/notifications';

//  Add steveTransactionPk to Session interface
export interface Session {
  sessionId: number;
  steveTransactionPk: number;  // ← Added for OCPP stop command
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

let ws: WebSocket | null = null;
let isIntentionalClose = false;

export const useSessionStore = create<SessionState>((set, get) => ({
  activeSession: null,
  telemetry: null,
  isLoading: false,

  //  Handle 'pending' status as null +  Map steveTransactionPk
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
          steveTransactionPk: raw.steve_transaction_pk,  //  Added mapping
          chargeBoxId: raw.charge_box_id,
          connectorId: raw.connector_id,
          status: raw.status,
          startTime: raw.start_time,
          energyKwh: raw.energy_kwh ?? 0,
          costSoFar: raw.cost_so_far ?? 0,
        }
      });
    } catch (err) {
      console.warn('Fetch active session error:', err);
      set({ activeSession: null });
    }
  },
/*
  startSession: async (chargeBoxId, connectorId, idTag) => {
    set({ isLoading: true });
    try {
      const token = await AsyncStorage.getItem('auth_token');
      console.log('Token present:', !!token, 'Length:', token?.length);
	  const res = await api.post('/api/charging/start', 
	    { chargeBoxId, connectorId, idTag },
	    { timeout: 40000 } // SteVe can take 40s to get charger response
	  );
      set({ isLoading: false });
      return res.data;
    } catch (err) {
      set({ isLoading: false });
      throw err;
    }
  },
*/
  startSession: async (chargeBoxId, connectorId, idTag) => {
    set({ isLoading: true });
    try {
      const token = await AsyncStorage.getItem('auth_token');
      const res = await api.post('/api/charging/start', 
        { chargeBoxId, connectorId, idTag },
        { timeout: 40000 }
      );
      set({ isLoading: false });
  
      // Local notification — works in Expo Go
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
  //  Send chargeBoxId + transactionId instead of sessionId
  stopSession: async (sessionId) => {
    set({ isLoading: true });
    try {
      // Get full session to extract chargeBoxId and steveTransactionPk
      const { activeSession } = get();
      if (!activeSession) throw new Error('No active session to stop');
      
      await api.post(
        '/api/charging/stop',
        { chargeBoxId: activeSession.chargeBoxId,
          transactionId: activeSession.steveTransactionPk },
        { timeout: 40000 } 
      );
      
      set({ activeSession: null, telemetry: null, isLoading: false });
    } catch (err) {
      set({ isLoading: false });
      throw err;
    }
  },

  connectWebSocket: async () => {
    if (ws?.readyState === WebSocket.OPEN) return;
    
    const token = await AsyncStorage.getItem('auth_token');
    if (!token) {
      console.warn('No auth token for WebSocket');
      return;
    }
    
    const wsUrl = API_BASE.replace('http', 'ws') + '/ws/charging';
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

        console.log('📨 WS message:', msgType);

        switch (msgType) {
          case 'connected':
            console.log(' WS authenticated, userId:', msg.userId);
            get().fetchActiveSession();
            break;
          case 'telemetry:update':
            set({ telemetry: msg.data });
            break;
          case 'session_started':
            get().fetchActiveSession();
            break;
          case 'session_completed':
          case 'session:stopped':
            set({ activeSession: null, telemetry: null });
            break;
          case 'error':
            console.warn(' WS server error:', msg.message);
            break;
          default:
            console.log(' WS: Unknown message type:', msgType);
        }
      } catch (e) {
        console.log(' WS: Non-JSON message or parse error, ignoring');
      }
    };
    
    ws.onerror = (e) => {
      console.warn(' WebSocket error:', e);
    };
    
    ws.onclose = (event) => {
      console.log(' WebSocket closed, code:', event.code, 'reason:', event.reason);
      
      if (event.code === 1000 || event.code === 4001 || isIntentionalClose) {
        console.log(' Intentional close - not reconnecting');
        isIntentionalClose = false;
        return;
      }
      
      console.log(' Unexpected close - scheduling reconnect in 5s...');
      setTimeout(() => {
        if (ws?.readyState !== WebSocket.OPEN && !isIntentionalClose) {
          get().connectWebSocket();
        }
      }, 5000);
    };
  },
  
  disconnectWebSocket: () => {
    isIntentionalClose = true;
    if (ws) {
      ws.close(1000, 'Client disconnect');
      ws = null;
      console.log('🔌 WebSocket disconnected intentionally');
    }
  },
  
  updateTelemetry: (t) => set({ telemetry: t }),
}));