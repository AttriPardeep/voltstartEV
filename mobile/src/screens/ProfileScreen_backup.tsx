// src/screens/ProfileScreen.tsx
import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
  Alert, ScrollView, TextInput, ActivityIndicator
} from 'react-native';
import { useAuthStore } from '../store/authStore';
import { api } from '../utils/api';

const COMMON_VEHICLES = [
  { model: 'Tata Nexon EV', capacity: 40.5 },
  { model: 'Tata Tiago EV', capacity: 24.0 },
  { model: 'MG ZS EV', capacity: 50.3 },
  { model: 'Hyundai Creta EV', capacity: 51.4 },
  { model: 'BYD Atto 3', capacity: 60.5 },
  { model: 'Kia EV6', capacity: 77.4 },
  { model: 'BMW iX', capacity: 111.5 },
];

export default function ProfileScreen() {
  // ✅ Added updateUser to destructuring
  const { user, logout, loadToken, updateUser } = useAuthStore();
  
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  
  // Initialize form state from user data
  const [vehicleModel, setVehicleModel] = useState(user?.vehicleModel || '');
  const [batteryKwh, setBatteryKwh] = useState(
    user?.batteryCapacityKwh?.toString() || ''
  );
  const [targetSoc, setTargetSoc] = useState(
    user?.targetSocPercent?.toString() || '80'
  );

  // Sync form state when user data changes (e.g., after login)
  useEffect(() => {
    if (user) {
      setVehicleModel(user.vehicleModel || '');
      setBatteryKwh(user.batteryCapacityKwh?.toString() || '');
      setTargetSoc(user.targetSocPercent?.toString() || '80');
    }
  }, [user]);

  const handleLogout = () => {
    Alert.alert('Logout', 'Are you sure you want to logout?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Logout', style: 'destructive', onPress: logout }
    ]);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      // Prepare updates object
      const updates = {
        vehicleModel: vehicleModel || null,
        batteryCapacityKwh: batteryKwh ? parseFloat(batteryKwh) : null,
        targetSocPercent: targetSoc ? parseInt(targetSoc) : 80,
      };

      // Call backend API
      await api.put('/api/users/me/vehicle', updates);
      
      // ✅ FIXED: Update Zustand state immediately for instant UI feedback
      // Instead of: await loadToken() (which only reads from AsyncStorage)
      updateUser(updates);
      
      setEditing(false);
      Alert.alert('✅ Saved', 'Vehicle profile updated');
      
    } catch (err: any) {
      console.error('Save error:', err);
      Alert.alert('Error', err?.response?.data?.error || 'Failed to save vehicle profile');
    } finally {
      setSaving(false);
    }
  };

  const selectVehicle = (v: typeof COMMON_VEHICLES[0]) => {
    setVehicleModel(v.model);
    setBatteryKwh(v.capacity.toString());
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Avatar */}
      <View style={styles.avatar}>
        <Text style={styles.avatarText}>
          {user?.username?.[0]?.toUpperCase() || '?'}
        </Text>
      </View>
      <Text style={styles.name}>{user?.username || 'User'}</Text>
      <Text style={styles.email}>{user?.email || ''}</Text>

      {/* Account Info */}
      <View style={styles.card}>
        <InfoRow label="Account ID" value={user?.userId?.toString() || '—'} />
        <InfoRow label="OCPP Tag" value={user?.idTag || '—'} />
        <InfoRow label="Plan" value="Standard" />
      </View>

      {/* Vehicle Profile */}
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <Text style={styles.cardTitle}>🚗 Vehicle Profile</Text>
          <TouchableOpacity onPress={() => setEditing(!editing)}>
            <Text style={styles.editBtn}>{editing ? 'Cancel' : 'Edit'}</Text>
          </TouchableOpacity>
        </View>

        {editing ? (
          <>
            <Text style={styles.label}>Vehicle Model</Text>
            <TextInput
              style={styles.input}
              value={vehicleModel}
              onChangeText={setVehicleModel}
              placeholder="e.g. Tata Nexon EV"
              placeholderTextColor="#475569"
            />

            <Text style={styles.label}>Quick Select</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}
              style={styles.chipScroll}>
              {COMMON_VEHICLES.map(v => (
                <TouchableOpacity
                  key={v.model}
                  style={[styles.chip,
                    vehicleModel === v.model && styles.chipSelected]}
                  onPress={() => selectVehicle(v)}
                >
                  <Text style={[styles.chipText,
                    vehicleModel === v.model && styles.chipTextSelected]}>
                    {v.model}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            <Text style={styles.label}>Battery Capacity (kWh)</Text>
            <TextInput
              style={styles.input}
              value={batteryKwh}
              onChangeText={setBatteryKwh}
              placeholder="e.g. 40.5"
              placeholderTextColor="#475569"
              keyboardType="decimal-pad"
            />

            <Text style={styles.label}>Target Charge %</Text>
            <View style={styles.socRow}>
              {[60, 70, 80, 90, 100].map(pct => (
                <TouchableOpacity
                  key={pct}
                  style={[styles.socBtn,
                    targetSoc === pct.toString() && styles.socBtnSelected]}
                  onPress={() => setTargetSoc(pct.toString())}
                >
                  <Text style={[styles.socBtnText,
                    targetSoc === pct.toString() && styles.socBtnTextSelected]}>
                    {pct}%
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <TouchableOpacity
              style={styles.saveBtn}
              onPress={handleSave}
              disabled={saving}
            >
              {saving
                ? <ActivityIndicator color="#0f172a" />
                : <Text style={styles.saveBtnText}>💾 Save Vehicle Profile</Text>
              }
            </TouchableOpacity>
          </>
        ) : (
          <>
            <InfoRow label="Vehicle"
              value={user?.vehicleModel || 'Not set'} />
            <InfoRow label="Battery"
              value={user?.batteryCapacityKwh
                ? `${user.batteryCapacityKwh} kWh` : 'Not set'} />
            <InfoRow label="Target SOC"
              value={`${user?.targetSocPercent || 80}%`} />
          </>
        )}
      </View>

      <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout}>
        <Text style={styles.logoutText}>Logout</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={styles.rowValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f172a' },
  content: { padding: 24, paddingBottom: 40 },
  avatar: {
    width: 80, height: 80, borderRadius: 40,
    backgroundColor: '#22d3ee', alignItems: 'center',
    justifyContent: 'center', alignSelf: 'center',
    marginTop: 20, marginBottom: 12
  },
  avatarText: { fontSize: 36, fontWeight: '800', color: '#0f172a' },
  name: { color: '#f1f5f9', fontSize: 22, fontWeight: '700',
    textAlign: 'center', marginBottom: 4 },
  email: { color: '#64748b', fontSize: 14,
    textAlign: 'center', marginBottom: 24 },
  card: {
    backgroundColor: '#1e293b', borderRadius: 14,
    padding: 16, marginBottom: 16
  },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'center', marginBottom: 12 },
  cardTitle: { color: '#f1f5f9', fontSize: 16, fontWeight: '700' },
  editBtn: { color: '#22d3ee', fontSize: 14, fontWeight: '600' },
  row: {
    flexDirection: 'row', justifyContent: 'space-between',
    paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#334155'
  },
  rowLabel: { color: '#64748b', fontSize: 14 },
  rowValue: { color: '#e2e8f0', fontSize: 14, fontWeight: '600' },
  label: { color: '#64748b', fontSize: 12, marginBottom: 6, marginTop: 12 },
  input: {
    backgroundColor: '#0f172a', color: '#fff', borderRadius: 8,
    padding: 12, fontSize: 14, borderWidth: 1, borderColor: '#334155'
  },
  chipScroll: { marginBottom: 4 },
  chip: {
    backgroundColor: '#0f172a', borderRadius: 20, paddingHorizontal: 12,
    paddingVertical: 6, marginRight: 8, borderWidth: 1, borderColor: '#334155'
  },
  chipSelected: { backgroundColor: '#0c4a6e', borderColor: '#22d3ee' },
  chipText: { color: '#64748b', fontSize: 12 },
  chipTextSelected: { color: '#22d3ee' },
  socRow: { flexDirection: 'row', gap: 8, marginBottom: 4 },
  socBtn: {
    flex: 1, backgroundColor: '#0f172a', borderRadius: 8,
    padding: 10, alignItems: 'center', borderWidth: 1, borderColor: '#334155'
  },
  socBtnSelected: { backgroundColor: '#0c4a6e', borderColor: '#22d3ee' },
  socBtnText: { color: '#64748b', fontSize: 13, fontWeight: '600' },
  socBtnTextSelected: { color: '#22d3ee' },
  saveBtn: {
    backgroundColor: '#22d3ee', borderRadius: 10,
    padding: 14, alignItems: 'center', marginTop: 16
  },
  saveBtnText: { color: '#0f172a', fontWeight: '700', fontSize: 15 },
  logoutBtn: {
    backgroundColor: '#7f1d1d', borderRadius: 12,
    padding: 14, alignItems: 'center'
  },
  logoutText: { color: '#fca5a5', fontWeight: '700', fontSize: 16 },
});