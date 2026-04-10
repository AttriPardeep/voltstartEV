// src/screens/HistoryScreen.tsx
import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList, ActivityIndicator, RefreshControl } from 'react-native';
import { api } from '../utils/api';

interface Session {
  sessionId: number;
  chargeBoxId: string;
  startTime: string;
  endTime: string;
  energyKwh: number;
  totalCost: number;
  status: string;
  stopReason: string;
}

export default function HistoryScreen() {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchHistory = async () => {
    try {
      const res = await api.get('/api/charging/sessions', { params: { limit: 20 } });

      const mappedSessions: Session[] = (res.data.data || []).map((item: any) => ({
        sessionId: item.session_id,
        chargeBoxId: item.charge_box_id,
        startTime: item.start_time,
        endTime: item.end_time,
        energyKwh: Number(item.energy_kwh || 0),
        totalCost: Number(item.total_cost || 0),
        status: item.status || 'unknown',
        stopReason: item.stop_reason || '—',
      }));

      setSessions(mappedSessions);
    } catch (error) {
      console.error('Failed to fetch history:', error);
      setSessions([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchHistory();
  }, []);

  const formatDate = (iso: string) => {
    if (!iso) return '—';
    return new Date(iso).toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
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
        renderItem={({ item }) => (
          <View style={styles.card}>
            <View style={styles.cardTop}>
              <Text style={styles.charger}>{item.chargeBoxId}</Text>
              <View
                style={[
                  styles.badge,
                  { backgroundColor: item.status === 'completed' ? '#14532d' : '#7f1d1d' },
                ]}
              >
                <Text
                  style={[
                    styles.badgeText,
                    { color: item.status === 'completed' ? '#22c55e' : '#fca5a5' },
                  ]}
                >
                  {item.status}
                </Text>
              </View>
            </View>

            <Text style={styles.date}>{formatDate(item.startTime)}</Text>

            <View style={styles.stats}>
              <View style={styles.stat}>
                <Text style={styles.statValue}>{(item.energyKwh || 0).toFixed(3)}</Text>
                <Text style={styles.statLabel}>kWh</Text>
              </View>

              <View style={styles.divider} />

              <View style={styles.stat}>
                <Text style={styles.statValue}>₹{(item.totalCost || 0).toFixed(2)}</Text>
                <Text style={styles.statLabel}>Cost</Text>
              </View>

              <View style={styles.divider} />

              <View style={styles.stat}>
                <Text style={styles.statValue}>{item.stopReason || '—'}</Text>
                <Text style={styles.statLabel}>Reason</Text>
              </View>
            </View>
          </View>
        )}
        contentContainerStyle={styles.list}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f172a' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 60 },
  emptyText: { color: '#475569', fontSize: 16 },
  list: { padding: 16, gap: 12 },
  card: { backgroundColor: '#1e293b', borderRadius: 14, padding: 16 },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  charger: { color: '#22d3ee', fontSize: 15, fontWeight: '700' },
  badge: { borderRadius: 20, paddingHorizontal: 10, paddingVertical: 3 },
  badgeText: { fontSize: 11, fontWeight: '600' },
  date: { color: '#64748b', fontSize: 12, marginBottom: 12 },
  stats: { flexDirection: 'row', justifyContent: 'space-around' },
  stat: { alignItems: 'center', flex: 1 },
  statValue: { color: '#f1f5f9', fontSize: 16, fontWeight: '700', textAlign: 'center' },
  statLabel: { color: '#64748b', fontSize: 11, marginTop: 2 },
  divider: { width: 1, backgroundColor: '#334155', marginHorizontal: 8 },
});