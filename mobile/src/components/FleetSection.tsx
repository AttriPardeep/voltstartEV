// src/components/FleetSection.tsx
import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
  Alert, ActivityIndicator, Modal, TextInput, ScrollView
} from 'react-native';
import { api } from '../utils/api';
import { useAuthStore } from '../store/authStore';
import { VEHICLES_BY_BRAND } from '../screens/ProfileScreen';

interface FleetVehicle {
  id: number;
  registrationNo: string;
  nickname: string | null;
  ocppIdTag: string;
  assignedTo: number | null;
  monthlyLimit: number | null;
  isActive: number;
}

interface FleetInfo {
  fleet_id: number;
  fleet_name: string;
  billing_mode: string;
  monthly_budget: number | null;
  role: string;
}

// ── Add Vehicle Modal ─────────────────────────────────
function AddVehicleModal({ visible, fleetId, onClose, onAdded }: {
  visible: boolean;
  fleetId: number;
  onClose: () => void;
  onAdded: () => void;
}) {
  const [regNo, setRegNo]         = useState('');
  const [nickname, setNickname]   = useState('');
  const [monthlyLimit, setMonthlyLimit] = useState('');
  const [saving, setSaving]       = useState(false);

  const handleAdd = async () => {
    if (!regNo.trim()) {
      Alert.alert('Required', 'Registration number is required');
      return;
    }
    setSaving(true);
    try {
      await api.post(`/api/fleet/${fleetId}/vehicles`, {
        registrationNo: regNo.trim().toUpperCase(),
        nickname:       nickname.trim() || null,
        monthlyLimit:   monthlyLimit ? parseFloat(monthlyLimit) : null,
      });
      Alert.alert('✅ Vehicle Added',
        `${regNo.toUpperCase()} added to fleet.\nOCPP tag generated automatically.`);
      setRegNo(''); setNickname(''); setMonthlyLimit('');
      onAdded();
      onClose();
    } catch (err: any) {
      Alert.alert('Failed', err?.response?.data?.error || 'Could not add vehicle');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent
      onRequestClose={onClose}>
      <View style={m.overlay}>
        <View style={m.sheet}>
          <View style={m.header}>
            <Text style={m.title}>Add Fleet Vehicle</Text>
            <TouchableOpacity onPress={onClose}>
              <Text style={m.close}>✕</Text>
            </TouchableOpacity>
          </View>

          <ScrollView showsVerticalScrollIndicator={false}>
            <Text style={m.label}>Registration Number *</Text>
            <TextInput
              style={m.input}
              value={regNo}
              onChangeText={setRegNo}
              placeholder="e.g. MH12AB1234"
              placeholderTextColor="#475569"
              autoCapitalize="characters"
            />

            <Text style={m.label}>Nickname (optional)</Text>
            <TextInput
              style={m.input}
              value={nickname}
              onChangeText={setNickname}
              placeholder="e.g. CEO Car, Delivery Van 1"
              placeholderTextColor="#475569"
            />

            <Text style={m.label}>Monthly Limit (₹, optional)</Text>
            <TextInput
              style={m.input}
              value={monthlyLimit}
              onChangeText={setMonthlyLimit}
              placeholder="e.g. 5000 (leave blank for no limit)"
              placeholderTextColor="#475569"
              keyboardType="numeric"
            />

            <View style={m.infoBox}>
              <Text style={m.infoText}>
                ℹ️ An OCPP ID tag will be generated automatically for this
                vehicle and registered in the charging network.
              </Text>
            </View>

            <TouchableOpacity
              style={[m.saveBtn, saving && m.saveBtnDim]}
              onPress={handleAdd}
              disabled={saving}>
              {saving
                ? <ActivityIndicator color="#0f172a" />
                : <Text style={m.saveBtnText}>Add to Fleet</Text>
              }
            </TouchableOpacity>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

// ── Fleet Dashboard ───────────────────────────────────
function FleetDashboard({ fleetId }: { fleetId: number }) {
  const [dashboard, setDashboard] = useState<any>(null);
  const [loading, setLoading]     = useState(true);

  useEffect(() => {
    api.get(`/api/fleet/${fleetId}/dashboard`)
      .then(r => setDashboard(r.data.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [fleetId]);

  if (loading) return <ActivityIndicator color="#22d3ee" style={{ margin: 12 }} />;
  if (!dashboard) return null;

  const now = new Date();
  const period = `${now.toLocaleString('default', { month: 'long' })} ${now.getFullYear()}`;

  return (
    <View style={d.container}>
      <Text style={d.period}>{period}</Text>
      <View style={d.statsRow}>
        <View style={d.stat}>
          <Text style={d.statVal}>{dashboard.summary.totalSessions}</Text>
          <Text style={d.statLbl}>Sessions</Text>
        </View>
        <View style={d.stat}>
          <Text style={d.statVal}>{dashboard.summary.totalKwh} kWh</Text>
          <Text style={d.statLbl}>Energy</Text>
        </View>
        <View style={d.stat}>
          <Text style={[d.statVal, { color: '#a78bfa' }]}>
            ₹{dashboard.summary.totalCost}
          </Text>
          <Text style={d.statLbl}>Spent</Text>
        </View>
      </View>

      {dashboard.drivers?.length > 0 && (
        <>
          <Text style={d.sectionTitle}>TOP DRIVERS</Text>
          {dashboard.drivers.slice(0, 3).map((driver: any, i: number) => (
            <View key={i} style={d.driverRow}>
              <View style={{ flex: 1 }}>
                <Text style={d.driverName}>{driver.username}</Text>
                <Text style={d.driverSub}>{driver.sessions} sessions</Text>
              </View>
              <Text style={[d.driverCost,
                driver.overLimit && { color: '#ef4444' }]}>
                ₹{driver.spent}
                {driver.overLimit && ' ⚠️'}
              </Text>
            </View>
          ))}
        </>
      )}
    </View>
  );
}

function CreateFleetForm({ onCreated }: { onCreated: () => void }) {
  const { user } = useAuthStore();
  const [name, setName]               = useState('');
  const [billingMode, setBillingMode] = useState<'fleet_pays' | 'driver_pays'>('fleet_pays');
  const [budget, setBudget]           = useState('');
  const [gst, setGst]                 = useState('');
  const [contactEmail, setContactEmail] = useState(user?.email || '');
  const [saving, setSaving]           = useState(false);

  const handleCreate = async () => {
    if (!name.trim()) {
      Alert.alert('Required', 'Fleet name is required');
      return;
    }
    if (!contactEmail.trim()) {
      Alert.alert('Required', 'Contact email is required');
      return;
    }
    setSaving(true);
    try {
      await api.post('/api/fleet', {
        name:         name.trim(),
        billingMode,
        monthlyBudget: budget ? parseFloat(budget) : null,
        gstNumber:    gst.trim() || null,
        contactEmail: contactEmail.trim(),
      });
      Alert.alert('✅ Fleet Created', `${name} is now active.`);
      onCreated();
    } catch (err: any) {
      Alert.alert('Failed', err?.response?.data?.error || 'Could not create fleet');
    } finally {
      setSaving(false);
    }
  };

  return (
    <ScrollView showsVerticalScrollIndicator={false}>
      <Text style={cf.subtitle}>
        Set up your corporate fleet to manage multiple vehicles and drivers.
      </Text>

      <Text style={cf.label}>Fleet / Company Name *</Text>
      <TextInput style={cf.input} value={name}
        onChangeText={setName}
        placeholder="e.g. Acme Corp EV Fleet"
        placeholderTextColor="#475569" />

      <Text style={cf.label}>Billing Mode</Text>
      <View style={cf.modeRow}>
        {([
          { key: 'fleet_pays',   label: '🏦 Fleet Pays',   sub: 'Company pays all sessions' },
          { key: 'driver_pays',  label: '👤 Driver Pays',  sub: 'Each driver pays own session' },
        ] as const).map(opt => (
          <TouchableOpacity
            key={opt.key}
            style={[cf.modeCard, billingMode === opt.key && cf.modeCardActive]}
            onPress={() => setBillingMode(opt.key)}>
            <Text style={[cf.modeLabel,
              billingMode === opt.key && cf.modeLabelActive]}>
              {opt.label}
            </Text>
            <Text style={cf.modeSub}>{opt.sub}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <Text style={cf.label}>Monthly Budget ₹ (optional)</Text>
      <TextInput style={cf.input} value={budget}
        onChangeText={setBudget}
        placeholder="e.g. 50000"
        placeholderTextColor="#475569"
        keyboardType="numeric" />

      <Text style={cf.label}>GST Number (optional)</Text>
      <TextInput style={cf.input} value={gst}
        onChangeText={setGst}
        placeholder="e.g. 29AABCT1332L1ZN"
        placeholderTextColor="#475569"
        autoCapitalize="characters" />

      <Text style={cf.label}>Contact Email *</Text>
      <TextInput style={cf.input} value={contactEmail}
        onChangeText={setContactEmail}
        placeholder="fleet@yourcompany.com"
        placeholderTextColor="#475569"
        keyboardType="email-address"
        autoCapitalize="none" />

      <TouchableOpacity
        style={[cf.createBtn, saving && cf.createBtnDim]}
        onPress={handleCreate}
        disabled={saving}>
        {saving
          ? <ActivityIndicator color="#0f172a" />
          : <Text style={cf.createBtnText}>Create Fleet</Text>}
      </TouchableOpacity>
    </ScrollView>
  );
}

const cf = StyleSheet.create({
  subtitle: {
    color: '#64748b', fontSize: 13, lineHeight: 18, marginBottom: 16,
  },
  label: {
    color: '#64748b', fontSize: 11, fontWeight: '600',
    textTransform: 'uppercase', letterSpacing: 0.5,
    marginBottom: 8, marginTop: 14,
  },
  input: {
    backgroundColor: '#0f172a', color: '#fff',
    borderRadius: 10, padding: 12, fontSize: 14,
    borderWidth: 1, borderColor: '#334155',
  },
  modeRow:      { flexDirection: 'row', gap: 10, marginBottom: 4 },
  modeCard: {
    flex: 1, backgroundColor: '#0f172a', borderRadius: 10,
    padding: 12, borderWidth: 1, borderColor: '#334155',
  },
  modeCardActive: { borderColor: '#22d3ee', backgroundColor: '#0c2a3a' },
  modeLabel:    { color: '#94a3b8', fontSize: 13, fontWeight: '700' },
  modeLabelActive: { color: '#22d3ee' },
  modeSub:      { color: '#475569', fontSize: 11, marginTop: 3 },
  createBtn: {
    backgroundColor: '#22d3ee', borderRadius: 12,
    padding: 14, alignItems: 'center', marginTop: 20, marginBottom: 8,
  },
  createBtnDim: { backgroundColor: '#334155' },
  createBtnText: { color: '#0f172a', fontWeight: '800', fontSize: 15 },
});

// ── Main Fleet Section ────────────────────────────────
export default function FleetSection({ userId }: { userId: number }) {
  const [fleet, setFleet]         = useState<FleetInfo | null>(null);
  const [vehicles, setVehicles]   = useState<FleetVehicle[]>([]);
  const [loading, setLoading]     = useState(true);
  const [showAdd, setShowAdd]     = useState(false);
  const [expanded, setExpanded]   = useState(false);

  const fetchFleet = useCallback(async () => {
    try {
      const res = await api.get('/api/fleet/me');
      setFleet(res.data.data);
    } catch {
      setFleet(null);
    }
  }, []);

  const fetchVehicles = useCallback(async (fleetId: number) => {
    try {
      const res = await api.get(`/api/fleet/${fleetId}/vehicles`);
      setVehicles(res.data.data || []);
    } catch {
      setVehicles([]);
    }
  }, []);

  useEffect(() => {
    const init = async () => {
      setLoading(true);
      await fetchFleet();
      setLoading(false);
    };
    init();
  }, []);

  useEffect(() => {
    if (fleet?.fleet_id) fetchVehicles(fleet.fleet_id);
  }, [fleet?.fleet_id]);

  const handleRemoveVehicle = (vehicle: FleetVehicle) => {
    Alert.alert(
      'Remove Vehicle',
      `Remove ${vehicle.registrationNo} from fleet?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove', style: 'destructive',
          onPress: async () => {
            try {
              await api.delete(`/api/fleet/${fleet!.fleet_id}/vehicles/${vehicle.id}`);
              fetchVehicles(fleet!.fleet_id);
            } catch (err: any) {
              Alert.alert('Failed', err?.response?.data?.error || 'Could not remove');
            }
          }
        }
      ]
    );
  };

  if (loading) {
    return (
      <View style={s.card}>
        <ActivityIndicator color="#22d3ee" />
      </View>
    );
  }

  // No fleet yet — show create button
   if (!fleet) {
     return (
       <View style={s.card}>
         <Text style={s.cardTitle}>🏢 Fleet Management</Text>
         <CreateFleetForm onCreated={fetchFleet} />
       </View>
     );
   }
/*
  if (!fleet) {
    return (
      <View style={s.card}>
        <Text style={s.cardTitle}>🏢 Fleet Management</Text>
        <Text style={s.noFleet}>
          You have fleet admin access but no fleet created yet.
        </Text>
        <TouchableOpacity style={s.createBtn}
          onPress={() => Alert.alert(
            'Create Fleet',
            'Contact support to set up your corporate fleet account.'
          )}>
          <Text style={s.createBtnText}>Contact Support to Create Fleet</Text>
        </TouchableOpacity>
      </View>
    );
  }
*/
  return (
    <View style={s.card}>
      {/* Header */}
      <TouchableOpacity style={s.cardHeader}
        onPress={() => setExpanded(!expanded)}>
        <View>
          <Text style={s.cardTitle}>🏢 {fleet.fleet_name}</Text>
          <Text style={s.cardSub}>
            {fleet.billing_mode === 'fleet_pays' ? '🏦 Fleet billing' : '👤 Driver billing'}
            {fleet.monthly_budget ? ` · ₹${fleet.monthly_budget}/mo budget` : ''}
          </Text>
        </View>
        <Text style={s.chevron}>{expanded ? '▲' : '▼'}</Text>
      </TouchableOpacity>

      {expanded && (
        <>
          {/* Dashboard summary */}
          <FleetDashboard fleetId={fleet.fleet_id} />

          {/* Vehicles list */}
          <View style={s.vehiclesHeader}>
            <Text style={s.sectionTitle}>FLEET VEHICLES ({vehicles.length})</Text>
            <TouchableOpacity style={s.addBtn}
              onPress={() => setShowAdd(true)}>
              <Text style={s.addBtnText}>+ Add Vehicle</Text>
            </TouchableOpacity>
          </View>

          {vehicles.length === 0 ? (
            <TouchableOpacity style={s.emptyVehicles}
              onPress={() => setShowAdd(true)}>
              <Text style={s.emptyText}>
                No vehicles yet — tap to add your first fleet vehicle
              </Text>
            </TouchableOpacity>
          ) : (
            vehicles.map(v => (
              <View key={v.id} style={s.vehicleRow}>
                <View style={{ flex: 1 }}>
                  <Text style={s.vehicleReg}>{v.registrationNo}</Text>
                  {v.nickname && (
                    <Text style={s.vehicleNick}>{v.nickname}</Text>
                  )}
                  <Text style={s.vehicleTag}>
                    OCPP: {v.ocppIdTag}
                    {v.monthlyLimit ? ` · ₹${v.monthlyLimit}/mo limit` : ''}
                  </Text>
                </View>
                <TouchableOpacity
                  style={s.removeBtn}
                  onPress={() => handleRemoveVehicle(v)}>
                  <Text style={s.removeBtnText}>Remove</Text>
                </TouchableOpacity>
              </View>
            ))
          )}
        </>
      )}

      <AddVehicleModal
        visible={showAdd}
        fleetId={fleet.fleet_id}
        onClose={() => setShowAdd(false)}
        onAdded={() => fetchVehicles(fleet.fleet_id)}
      />
    </View>
  );
}

// ── Styles ────────────────────────────────────────────
const s = StyleSheet.create({
  card: {
    backgroundColor: '#1e293b', borderRadius: 14,
    padding: 16, marginBottom: 16,
    borderWidth: 1, borderColor: '#334155',
  },
  cardHeader: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'center',
  },
  cardTitle: { color: '#f1f5f9', fontSize: 16, fontWeight: '700' },
  cardSub:   { color: '#64748b', fontSize: 12, marginTop: 2 },
  chevron:   { color: '#64748b', fontSize: 16 },
  noFleet:   { color: '#64748b', fontSize: 13, marginVertical: 12 },
  createBtn: {
    backgroundColor: '#0f172a', borderRadius: 10,
    padding: 12, alignItems: 'center',
    borderWidth: 1, borderColor: '#334155',
  },
  createBtnText: { color: '#94a3b8', fontSize: 13 },
  vehiclesHeader: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'center', marginTop: 16, marginBottom: 10,
  },
  sectionTitle: {
    color: '#475569', fontSize: 10, fontWeight: '700',
    letterSpacing: 1, textTransform: 'uppercase',
  },
  addBtn: {
    backgroundColor: '#22d3ee', borderRadius: 16,
    paddingHorizontal: 12, paddingVertical: 5,
  },
  addBtnText: { color: '#0f172a', fontSize: 12, fontWeight: '700' },
  emptyVehicles: {
    backgroundColor: '#0f172a', borderRadius: 10,
    padding: 16, alignItems: 'center',
    borderWidth: 1, borderColor: '#334155', borderStyle: 'dashed',
  },
  emptyText: { color: '#475569', fontSize: 13, textAlign: 'center' },
  vehicleRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1, borderBottomColor: '#0f172a',
  },
  vehicleReg:  { color: '#f1f5f9', fontSize: 15, fontWeight: '700' },
  vehicleNick: { color: '#94a3b8', fontSize: 12, marginTop: 1 },
  vehicleTag:  { color: '#475569', fontSize: 11, marginTop: 2 },
  removeBtn: {
    backgroundColor: '#7f1d1d', borderRadius: 8,
    paddingHorizontal: 10, paddingVertical: 5,
  },
  removeBtnText: { color: '#fca5a5', fontSize: 12 },
});

const m = StyleSheet.create({
  overlay: {
    flex: 1, backgroundColor: '#00000088', justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: '#1e293b', borderTopLeftRadius: 24,
    borderTopRightRadius: 24, padding: 24, paddingBottom: 40,
    maxHeight: '85%',
  },
  header: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'center', marginBottom: 20,
  },
  title: { color: '#f1f5f9', fontSize: 18, fontWeight: '800' },
  close: { color: '#64748b', fontSize: 22 },
  label: {
    color: '#64748b', fontSize: 11, fontWeight: '600',
    textTransform: 'uppercase', letterSpacing: 0.5,
    marginBottom: 8, marginTop: 16,
  },
  input: {
    backgroundColor: '#0f172a', color: '#fff',
    borderRadius: 10, padding: 12, fontSize: 14,
    borderWidth: 1, borderColor: '#334155',
  },
  infoBox: {
    backgroundColor: '#0c2a1a', borderRadius: 8,
    padding: 12, marginTop: 16,
    borderWidth: 1, borderColor: '#166534',
  },
  infoText: { color: '#86efac', fontSize: 12, lineHeight: 18 },
  saveBtn: {
    backgroundColor: '#22d3ee', borderRadius: 12,
    padding: 16, alignItems: 'center', marginTop: 20,
  },
  saveBtnDim: { backgroundColor: '#334155' },
  saveBtnText: { color: '#0f172a', fontWeight: '800', fontSize: 15 },
});

const d = StyleSheet.create({
  container: { marginBottom: 16 },
  period: {
    color: '#64748b', fontSize: 11, fontWeight: '700',
    textTransform: 'uppercase', letterSpacing: 0.5,
    marginBottom: 10, marginTop: 16,
  },
  statsRow: { flexDirection: 'row', gap: 8, marginBottom: 16 },
  stat: {
    flex: 1, backgroundColor: '#0f172a', borderRadius: 10,
    padding: 12, alignItems: 'center',
  },
  statVal: { color: '#22d3ee', fontSize: 16, fontWeight: '800' },
  statLbl: {
    color: '#475569', fontSize: 10, marginTop: 3,
    textTransform: 'uppercase',
  },
  sectionTitle: {
    color: '#475569', fontSize: 10, fontWeight: '700',
    textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8,
  },
  driverRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1, borderBottomColor: '#0f172a',
  },
  driverName: { color: '#e2e8f0', fontSize: 14 },
  driverSub:  { color: '#64748b', fontSize: 11 },
  driverCost: { color: '#f1f5f9', fontSize: 14, fontWeight: '700' },
});