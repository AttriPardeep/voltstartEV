// src/screens/HistoryScreen.tsx
import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet, FlatList, ActivityIndicator, RefreshControl } from 'react-native';
import { api } from '../utils/api';
import { socket } from '../utils/socket';
import { useNavigation } from '@react-navigation/native';

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

  const fetchHistory = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const res = await api.get('/api/charging/sessions', {
        params: { limit: 20 }
      });
  
      const mappedSessions: Session[] = (res.data.data || []).map((item: any) => {
        let energyKwh = Number(item.energy_kwh ?? 0);
        if (
          energyKwh === 0 &&
          item.start_meter_value != null &&
          item.end_meter_value != null &&
          item.end_meter_value > item.start_meter_value
        ) {
          energyKwh = Number(
            ((item.end_meter_value - item.start_meter_value) / 1000).toFixed(3)
          );
        }
  
        // For active sessions, seed liveCost from last_cost
        // last_cost is updated every meter value on backend
        // This prevents the zero flash on refresh
        const isActive = item.status === 'active';
        const seededCost = isActive
          ? (item.last_cost != null ? Number(item.last_cost) : null)
          : null;
  
        const seededEnergy = isActive && energyKwh === 0
          ? (item.last_meter_value != null && item.start_meter_value != null
              ? Number(((item.last_meter_value - item.start_meter_value) / 1000).toFixed(3))
              : null)
          : null;
  
        return {
          sessionId:     item.session_id,
          transactionId: item.steve_transaction_pk,
          chargeBoxId:   item.charge_box_id,
          startTime:     item.start_time,
          endTime:       item.end_time,
          energyKwh,
          totalCost:     item.total_cost  != null ? Number(item.total_cost)  : null,
          lastCost:      item.last_cost   != null ? Number(item.last_cost)   : null,
          status:        item.status || 'unknown',
          stopReason:    item.stop_reason,
          pricingModel:  item.pricing_model,
          tiers:         item.tiers ?? null,
          // Seed live values from DB for active sessions
          liveCost:      seededCost,
          liveEnergyKwh: seededEnergy,
          powerW:        null,
        };
      });
  
      const sorted = [...mappedSessions].sort((a, b) => {
        if (a.status === 'active' && b.status !== 'active') return -1;
        if (b.status === 'active' && a.status !== 'active') return 1;
        return new Date(b.startTime).getTime() - new Date(a.startTime).getTime();
      });
  
      // Merge with existing live values — don't wipe WS data on refresh
      setSessions(prev => {
        return sorted.map(newSession => {
          // Find existing session with live data
          const existing = prev.find(
            p => p.transactionId === newSession.transactionId
          );
  
          if (!existing || newSession.status !== 'active') {
            return newSession;
          }
          // Preserve live values if they're more recent than what API returned
          return {
            ...newSession,
            liveCost: (
              existing.liveCost != null &&
              existing.liveCost > (newSession.liveCost ?? 0)
            )
              ? existing.liveCost        // keep WS value — it's newer
              : newSession.liveCost,     // use DB seeded value
  
            liveEnergyKwh: (
              existing.liveEnergyKwh != null &&
              existing.liveEnergyKwh > (newSession.liveEnergyKwh ?? 0)
            )
              ? existing.liveEnergyKwh
              : newSession.liveEnergyKwh,
            powerW: existing.powerW,   // always keep last power reading
          };
        });
      });
  
    } catch (error) {
      console.error('Failed to fetch history:', error);
      if (!silent) setSessions([]);
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

  const navigation = useNavigation();
  useEffect(() => {
    const handleBalanceCritical = (event: any) => {
      const payload = event?.data || {};
      const balance = Number(payload.currentBalance ?? 0);
      const cost = Number(payload.costSoFar ?? 0);
      Alert.alert(
        'Wallet Balance Critical',
        `Your balance is ₹${balance.toFixed(2)}.\n\nYour charging session is being stopped automatically.\n\nCost so far: ₹${cost.toFixed(2)}`,
        [
          {
            text: 'Add Money',
            onPress: () => navigation.navigate('Wallet'),
          },
          { text: 'OK' },
        ]
      );
    };
    socket.on('balance_critical', handleBalanceCritical);
    return () => {
      socket.off('balance_critical', handleBalanceCritical);
    };
  }, [navigation]);
  
  useEffect(() => {
    const handleSocTargetReached = (data: any) => {
     const vehicleName = data?.vehicle || 'vehicle';
     const targetSoc = data?.targetSoc ?? data?.currentSoc ?? '--';
     
     <CustomAlert
       visible={socAlertVisible}
       title="Target Charge Reached"
       message={`Your ${vehicle} has reached ${targetSoc}% charge.\n\nCharging stopped.`}
       variant="success"
       onClose={() => setSocAlertVisible(false)}
     />
    };
    
    socket.on('soc_target_reached', handleSocTargetReached);
    return () => socket.off('soc_target_reached', handleSocTargetReached);
  }, [navigation]);
  
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

  const getSessionCost = (s: Session): number => {
    if (s.status === 'active') {
      // Priority: liveCost (WebSocket) > lastCost (DB) > 0
      if (s.liveCost != null && s.liveCost > 0) return s.liveCost;
      if (s.lastCost != null && s.lastCost > 0) return s.lastCost;
      return 0;
    }
    return Number(s.totalCost ?? s.lastCost ?? 0);
  };
  
  const getSessionEnergy = (s: Session): number => {
    if (s.status === 'active') {
      if (s.liveEnergyKwh != null && s.liveEnergyKwh > 0) return s.liveEnergyKwh;
      if (s.energyKwh > 0) return s.energyKwh;
      return 0;
    }
    return s.energyKwh ?? 0;
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