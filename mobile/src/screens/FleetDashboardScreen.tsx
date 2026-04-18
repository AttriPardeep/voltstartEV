// src/screens/FleetDashboardScreen.tsx
import React, { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  ActivityIndicator, Alert
} from 'react-native';
import { api } from '../utils/api';

export default function FleetDashboardScreen({ route, navigation }: any) {
  const { fleetId } = route.params;
  const [dashboard, setDashboard] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadDashboard();
  }, [fleetId]);

  const loadDashboard = async () => {
    try {
      const res = await api.get(`/api/fleet/${fleetId}/dashboard`);
      setDashboard(res.data.data);
    } catch (err: any) {
      Alert.alert('Error', err.response?.data?.error || 'Failed to load dashboard');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#22d3ee" />
      </View>
    );
  }

  return (
    <ScrollView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>📊 {dashboard.period.year}-{String(dashboard.period.month).padStart(2,'0')}</Text>
        <Text style={styles.subtitle}>Fleet Summary</Text>
      </View>

      {/* Stats Grid */}
      <View style={styles.statsGrid}>
        <StatCard label="Sessions" value={dashboard.summary.totalSessions} />
        <StatCard label="Energy" value={`${dashboard.summary.totalKwh} kWh`} />
        <StatCard label="Cost" value={`₹${dashboard.summary.totalCost}`} color="#22d3ee" />
        <StatCard label="Drivers" value={dashboard.summary.activeDrivers} />
      </View>

      {/* Driver List */}
      <Text style={styles.sectionTitle}>Drivers</Text>
      {dashboard.drivers.map((driver: any) => (
        <View key={driver.email} style={styles.driverRow}>
          <View>
            <Text style={styles.driverName}>{driver.username}</Text>
            <Text style={styles.driverEmail}>{driver.email}</Text>
          </View>
          <View style={{ alignItems: 'flex-end' }}>
            <Text style={styles.driverSpent}>₹{driver.spent}</Text>
            {driver.overLimit && (
              <Text style={styles.overLimit}>⚠️ Over limit</Text>
            )}
          </View>
        </View>
      ))}

      {/* Generate Invoice Button */}
      <TouchableOpacity 
        style={styles.invoiceBtn}
        onPress={() => handleGenerateInvoice(fleetId)}
      >
        <Text style={styles.invoiceBtnText}>📄 Generate Monthly Invoice</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

// Simple stat card component
function StatCard({ label, value, color = '#f1f5f9' }: any) {
  return (
    <View style={styles.statCard}>
      <Text style={[styles.statValue, { color }]}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f172a', padding: 16 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: { marginBottom: 24 },
  title: { color: '#22d3ee', fontSize: 20, fontWeight: '800' },
  subtitle: { color: '#64748b', fontSize: 14 },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 24,
  },
  statCard: {
    flex: 1,
    minWidth: '45%',
    backgroundColor: '#1e293b',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
  },
  statValue: { fontSize: 24, fontWeight: '800', marginBottom: 4 },
  statLabel: { color: '#64748b', fontSize: 12 },
  sectionTitle: {
    color: '#f1f5f9',
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 12,
  },
  driverRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: '#1e293b',
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
  },
  driverName: { color: '#f1f5f9', fontSize: 14, fontWeight: '600' },
  driverEmail: { color: '#64748b', fontSize: 12 },
  driverSpent: { color: '#22d3ee', fontSize: 14, fontWeight: '700' },
  overLimit: { color: '#f87171', fontSize: 11 },
  invoiceBtn: {
    backgroundColor: '#22d3ee',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    marginTop: 24,
  },
  invoiceBtnText: { color: '#0f172a', fontWeight: '800', fontSize: 15 },
});

async function handleGenerateInvoice(fleetId: number) {
  try {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth() + 1;
    
    const res = await api.get(`/api/fleet/${fleetId}/invoice/${year}/${month}`);
    Alert.alert('Invoice Generated', `Total: ₹${res.data.data.totalAmount}`, [
      { text: 'OK' }
    ]);
  } catch (err: any) {
    Alert.alert('Error', err.response?.data?.error || 'Failed to generate invoice');
  }
}