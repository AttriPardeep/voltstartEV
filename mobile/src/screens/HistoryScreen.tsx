// src/screens/HistoryScreen.tsx
import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet, FlatList, ActivityIndicator, RefreshControl } from 'react-native';
import { api } from '../utils/api';
import { socket } from '../utils/socket';

interface Session {
  sessionId: number;
  transactionId?: number;  // Maps to steve_transaction_pk from API
  chargeBoxId: string;
  startTime: string;
  endTime: string | null;
  energyKwh: number;
  totalCost: number | null;
  status: 'active' | 'completed' | 'interrupted' | 'pending';
  stopReason: string | null;
  pricingModel?: string;
  tiers?: any[] | null;
  // Live telemetry fields (updated via WebSocket)
  liveCost?: number | null;
  liveEnergyKwh?: number | null;
}

export default function HistoryScreen() {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchHistory = useCallback(async () => {
    try {
      const res = await api.get('/api/charging/sessions', { params: { limit: 20 } });

      const mappedSessions: Session[] = (res.data.data || []).map((item: any) => {
        // Calculate energy from meters if energy_kwh is 0/null (for active sessions)
        let energyKwh = Number(item.energy_kwh ?? 0);
        if (energyKwh === 0 && item.start_meter_value != null && item.end_meter_value != null) {
          energyKwh = Number(((item.end_meter_value - item.start_meter_value) / 1000).toFixed(3));
        }
        return {
          sessionId: item.session_id,
          transactionId: item.steve_transaction_pk,  //  Map to transactionId for WebSocket matching
          chargeBoxId: item.charge_box_id,
          startTime: item.start_time,
          endTime: item.end_time,
          energyKwh,
          totalCost: item.total_cost != null ? Number(item.total_cost) : null,
          status: item.status || 'unknown',
          stopReason: item.stop_reason,
          pricingModel: item.pricing_model,
          tiers: item.tiers ?? null,
        };
      });

      // Sort: active sessions first, then by start_time DESC
      const sorted = [...mappedSessions].sort((a, b) => {
        if (a.status === 'active' && b.status !== 'active') return -1;
        if (b.status === 'active' && a.status !== 'active') return 1;
        return new Date(b.startTime).getTime() - new Date(a.startTime).getTime();
      });

      setSessions(sorted);
    } catch (error) {
      console.error('Failed to fetch history:', error);
      setSessions([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  //  WebSocket listener for live telemetry updates
  useEffect(() => {
    const handleTelemetryUpdate = (msg: any) => {
      // Backend wraps payload inside data
      const telemetry = msg.data || msg;
      console.log('📨 incoming telemetry', telemetry);
      setSessions(prev => {
        console.log('📦 current sessions', prev);
        const updated = prev.map(s => {
          const isMatch =
            Number(s.transactionId) === Number(telemetry.transactionId);
          console.log('🔍 compare tx', {
            sessionTx: s.transactionId,
            telemetryTx: telemetry.transactionId,
            match: isMatch,
          });
          if (!isMatch) {
            return s;
          }
          const newSession = {
            ...s,
            // live cost
            liveCost:
              telemetry.costSoFar != null &&
              !isNaN(Number(telemetry.costSoFar))
                ? Number(telemetry.costSoFar)
                : s.liveCost,
            // live energy
            liveEnergyKwh:
              telemetry.energyKwh != null &&
              !isNaN(Number(telemetry.energyKwh))
                ? Number(telemetry.energyKwh)
                : s.liveEnergyKwh,
          };
          console.log('✅ updated session', {
            before: s,
            after: newSession,
          });
          return newSession;
        });
        console.log('📤 updated sessions array', updated);
        return updated;
      });
    };
  
    socket.on('telemetry:update', handleTelemetryUpdate);
    return () => {
      socket.off('telemetry:update', handleTelemetryUpdate);
    };
  
  }, []);
  // Initial fetch
  useEffect(() => {
    fetchHistory();
  }, [fetchHistory]);

  // ─────────────────────────────────────────────────────────────
  // Helpers
  // ─────────────────────────────────────────────────────────────
  const formatDuration = (start: string, end: string | null) => {
    if (!start || !end) return '—';
    const diffMs = new Date(end).getTime() - new Date(start).getTime();
    const mins = Math.floor(diffMs / 60000);
    if (mins < 60) return `${mins}m`;
    const hrs = Math.floor(mins / 60);
    const remMins = mins % 60;
    return `${hrs}h ${remMins}m`;
  };

  const formatDate = (iso: string) => {
    if (!iso) return '—';
    return new Date(iso).toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  //  Get cost: live for active, final for completed
  const getSessionCost = (s: Session): number => {
    if (s.status === 'active') {
      // Use live cost from WebSocket, fallback to 0
      return Number(s.liveCost ?? 0);
    }
    // Use final cost from database
    return Number(s.totalCost ?? 0);
  };

  //  Get energy: live for active, final for completed
  const getSessionEnergy = (s: Session): number => {
    if (s.status === 'active') {
      return Number(s.liveEnergyKwh ?? s.energyKwh ?? 0);
    }
    return Number(s.energyKwh ?? 0);
  };

  const getStatusBadge = (status: string) => {
    if (status === 'active') return { text: '● LIVE', bg: '#0ea5e9', color: '#fff' };
    if (status === 'completed') return { text: 'Completed', bg: '#14532d', color: '#22c55e' };
    if (status === 'interrupted') return { text: 'Interrupted', bg: '#7f1d1d', color: '#fca5a5' };
    return { text: status, bg: '#334155', color: '#94a3b8' };
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#22d3ee" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={sessions}
        keyExtractor={(item, index) => item.sessionId?.toString() || index.toString()}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              fetchHistory();
            }}
            tintColor="#22d3ee"
          />
        }
        ListEmptyComponent={
          <View style={styles.center}>
            <Text style={styles.emptyText}>No charging history yet</Text>
          </View>
        }
        renderItem={({ item }) => {
          const statusBadge = getStatusBadge(item.status);
          const isActive = item.status === 'active';
          
          //  Use live cost for active, final cost for completed
          const cost = getSessionCost(item);
          const energy = getSessionEnergy(item);

          return (
            <View style={[styles.card, isActive && styles.activeCard]}>
              <View style={styles.cardTop}>
                <Text style={styles.charger}>{item.chargeBoxId}</Text>
                <View style={[styles.badge, { backgroundColor: statusBadge.bg }]}>
                  <Text style={[styles.badgeText, { color: statusBadge.color }]}>
                    {statusBadge.text}
                  </Text>
                </View>
              </View>

              <Text style={styles.date}>{formatDate(item.startTime)}</Text>

              <View style={styles.stats}>
                {/* Energy */}
                <View style={styles.stat}>
                  <Text style={styles.statValue}>{energy.toFixed(3)}</Text>
                  <Text style={styles.statLabel}>kWh</Text>
                </View>

                <View style={styles.divider} />

                {/* Cost - shows live estimate for active, final for completed */}
                <View style={styles.stat}>
                  <Text style={styles.statValue}>
                    ₹{Number(cost).toFixed(2)}
                  </Text>
                  <Text style={styles.statLabel}>
                    {isActive ? 'Est.' : 'Cost'}
                  </Text>
                </View>

                <View style={styles.divider} />

                {/* Duration */}
                <View style={styles.stat}>
                  <Text style={styles.statValue}>
                    {isActive ? 'LIVE' : formatDuration(item.startTime, item.endTime)}
                  </Text>
                  <Text style={styles.statLabel}>Duration</Text>
                </View>
              </View>

              {/* Dev-only: pricing audit info */}
              {__DEV__ && item.pricingModel && (
                <Text style={styles.debugInfo}>
                  Pricing: {item.pricingModel}
                  {item.tiers ? ` · ${item.tiers.length} tiers` : ''}
                </Text>
              )}
            </View>
          );
        }}
        contentContainerStyle={styles.list}
      />
    </View>
  );
}

// ─────────────────────────────────────────────────────────────
// Styles
// ─────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f172a' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 60 },
  emptyText: { color: '#475569', fontSize: 16 },
  list: { padding: 16, gap: 12 },
  
  card: {
    backgroundColor: '#1e293b',
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: '#334155',
  },
  activeCard: {
    borderColor: '#0ea5e9',  // Blue border for active sessions
    borderWidth: 2,
  },
  
  cardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  charger: {
    color: '#22d3ee',
    fontSize: 15,
    fontWeight: '700',
  },
  badge: {
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 3,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '700',
  },
  date: {
    color: '#64748b',
    fontSize: 12,
    marginBottom: 12,
  },
  
  stats: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  stat: {
    alignItems: 'center',
    flex: 1,
  },
  statValue: {
    color: '#f1f5f9',
    fontSize: 16,
    fontWeight: '700',
    textAlign: 'center',
  },
  statLabel: {
    color: '#64748b',
    fontSize: 11,
    marginTop: 2,
    textTransform: 'uppercase',
  },
  divider: {
    width: 1,
    backgroundColor: '#334155',
    marginHorizontal: 8,
  },
  
  debugInfo: {
    color: '#475569',
    fontSize: 10,
    marginTop: 8,
    fontStyle: 'italic',
    textAlign: 'center',
  },
});