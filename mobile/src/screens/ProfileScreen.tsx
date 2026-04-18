// src/screens/ProfileScreen.tsx
import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Alert,
  ScrollView, TextInput, ActivityIndicator, Modal
} from 'react-native';
import { useAuthStore } from '../store/authStore';
import { api } from '../utils/api';

// ─── Vehicle Database ─────────────────────────────────
interface VehicleSpec {
  model: string;
  capacity: number;
  variants?: Array<{ name: string; capacity: number }>;
}

interface BrandVehicles { [brand: string]: VehicleSpec[]; }

export const VEHICLES_BY_BRAND: BrandVehicles = {
  'Tata Motors': [
    { model: 'Nexon EV', capacity: 40.5 },
    { model: 'Nexon EV Max', capacity: 30.2 },
    { model: 'Tiago EV', capacity: 24.0 },
    { model: 'Punch EV', capacity: 25.0 },
  ],
  'MG Motor': [
    { model: 'ZS EV', capacity: 50.3 },
    { model: 'Comet EV', capacity: 12.0 },
  ],
  'Hyundai': [
    { model: 'Kona Electric', capacity: 64.0 },
    { model: 'Ioniq 5', capacity: 77.4 },
    { model: 'Creta EV', capacity: 51.4 },
  ],
  'Kia': [
    { model: 'EV6', capacity: 77.4 },
    { model: 'EV9', capacity: 99.8 },
    { model: 'Niro EV', capacity: 64.8 },
  ],
  'BYD': [
    { model: 'Atto 3', capacity: 60.5 },
    { model: 'Dolphin', capacity: 44.9 },
    { model: 'Seal', capacity: 82.5 },
  ],
  'BMW': [
    { model: 'iX', capacity: 111.5 },
    { model: 'i4', capacity: 83.9 },
    { model: 'iX3', capacity: 80.0 },
  ],
  'Mercedes-Benz': [
    { model: 'EQS', capacity: 107.8 },
    { model: 'EQC', capacity: 80.0 },
  ],
  'Audi': [
    { model: 'e-tron GT', capacity: 93.4 },
    { model: 'Q4 e-tron', capacity: 82.0 },
  ],
  'Tesla': [
    { model: 'Model 3', capacity: 60.0, variants: [
      { name: 'Standard Range', capacity: 60.0 },
      { name: 'Long Range', capacity: 82.0 },
      { name: 'Performance', capacity: 82.0 },
    ]},
    { model: 'Model Y', capacity: 75.0, variants: [
      { name: 'Long Range', capacity: 75.0 },
      { name: 'Performance', capacity: 75.0 },
    ]},
  ],
  'Volkswagen': [
    { model: 'ID.4', capacity: 77.0 },
    { model: 'ID.3', capacity: 58.0 },
  ],
  'Volvo': [
    { model: 'XC40 Recharge', capacity: 69.0 },
    { model: 'C40 Recharge', capacity: 69.0 },
  ],
  'Other': [
    { model: 'Custom', capacity: 0 },
  ],
};

// ─── Types ────────────────────────────────────────────
interface UserVehicle {
  id: number;
  nickname: string | null;
  brand: string;
  model: string;
  variant: string | null;
  battery_kwh: number;
  target_soc: number;
  is_primary: number;
}

// Fleet types
interface UserFleet {
  fleet_id: number;
  fleet_name: string;
  role: 'admin' | 'driver';
  billing_mode: 'fleet_pays' | 'driver_pays';
  monthly_limit?: number | null;
  is_active: number;
}

// ─── Add/Edit Vehicle Modal ───────────────────────────
function VehicleModal({
  visible, onClose, onSave, initial
}: {
  visible: boolean;
  onClose: () => void;
  onSave: (data: any) => Promise<void>;
  initial?: UserVehicle | null;
}) {
  const [selectedBrand, setSelectedBrand] = useState(initial?.brand || '');
  const [selectedModel, setSelectedModel] = useState(initial?.model || '');
  const [selectedVariant, setSelectedVariant] = useState(initial?.variant || '');
  const [nickname, setNickname] = useState(initial?.nickname || '');
  const [batteryKwh, setBatteryKwh] = useState(
    initial?.battery_kwh?.toString() || ''
  );
  const [targetSoc, setTargetSoc] = useState(
    initial?.target_soc?.toString() || '80'
  );
  const [isPrimary, setIsPrimary] = useState(initial?.is_primary === 1);
  const [saving, setSaving] = useState(false);

  const models = selectedBrand ? VEHICLES_BY_BRAND[selectedBrand] || [] : [];
  const selectedModelSpec = models.find(m => m.model === selectedModel);
  const variants = selectedModelSpec?.variants || [];

  const handleSelectModel = (spec: VehicleSpec) => {
    setSelectedModel(spec.model);
    setSelectedVariant('');
    if (!spec.variants?.length) {
      setBatteryKwh(spec.capacity.toString());
    }
  };

  const handleSelectVariant = (v: { name: string; capacity: number }) => {
    setSelectedVariant(v.name);
    setBatteryKwh(v.capacity.toString());
  };

  const handleSave = async () => {
    if (!selectedBrand || !selectedModel) {
      Alert.alert('Required', 'Please select a brand and model');
      return;
    }
    if (!batteryKwh || isNaN(parseFloat(batteryKwh))) {
      Alert.alert('Required', 'Please enter battery capacity');
      return;
    }
    setSaving(true);
    try {
      await onSave({
        nickname: nickname || null,
        brand: selectedBrand,
        model: selectedModel,
        variant: selectedVariant || null,
        batteryKwh: parseFloat(batteryKwh),
        targetSoc: parseInt(targetSoc) || 80,
        isPrimary,
      });
      onClose();
    } catch (err: any) {
      Alert.alert('Error', err?.response?.data?.error || 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide"
      transparent onRequestClose={onClose}>
      <View style={m.overlay}>
        <View style={m.sheet}>
          <View style={m.header}>
            <Text style={m.title}>
              {initial ? 'Edit Vehicle' : 'Add Vehicle'}
            </Text>
            <TouchableOpacity onPress={onClose}>
              <Text style={m.close}>✕</Text>
            </TouchableOpacity>
          </View>

          <ScrollView showsVerticalScrollIndicator={false}>
            {/* Nickname */}
            <Text style={m.label}>Nickname (optional)</Text>
            <TextInput style={m.input} value={nickname}
              onChangeText={setNickname}
              placeholder="e.g. My Nexon, Office Car"
              placeholderTextColor="#475569" />

            {/* Brand selector */}
            <Text style={m.label}>Brand</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}
              style={m.scroll}>
              {Object.keys(VEHICLES_BY_BRAND).map(brand => (
                <TouchableOpacity key={brand}
                  style={[m.chip, selectedBrand === brand && m.chipActive]}
                  onPress={() => {
                    setSelectedBrand(brand);
                    setSelectedModel('');
                    setSelectedVariant('');
                    setBatteryKwh('');
                  }}>
                  <Text style={[m.chipText,
                    selectedBrand === brand && m.chipTextActive]}>
                    {brand}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            {/* Model selector */}
            {selectedBrand && (
              <>
                <Text style={m.label}>Model</Text>
                <View style={m.modelList}>
                  {models.map(spec => (
                    <TouchableOpacity key={spec.model}
                      style={[m.modelItem,
                        selectedModel === spec.model && m.modelItemActive]}
                      onPress={() => handleSelectModel(spec)}>
                      <View style={{ flex: 1 }}>
                        <Text style={m.modelName}>{spec.model}</Text>
                        <Text style={m.modelSub}>
                          {spec.variants?.length
                            ? `${spec.variants.length} variants`
                            : `${spec.capacity} kWh`}
                        </Text>
                      </View>
                      {selectedModel === spec.model && (
                        <Text style={m.tick}>✓</Text>
                      )}
                    </TouchableOpacity>
                  ))}
                </View>
              </>
            )}

            {/* Variant selector */}
            {variants.length > 0 && selectedModel && (
              <>
                <Text style={m.label}>Variant</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false}
                  style={m.scroll}>
                  {variants.map(v => (
                    <TouchableOpacity key={v.name}
                      style={[m.chip,
                        selectedVariant === v.name && m.chipActive]}
                      onPress={() => handleSelectVariant(v)}>
                      <Text style={[m.chipText,
                        selectedVariant === v.name && m.chipTextActive]}>
                        {v.name} · {v.capacity} kWh
                      </Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </>
            )}

            {/* Battery capacity */}
            <Text style={m.label}>Battery Capacity (kWh)</Text>
            <TextInput style={m.input} value={batteryKwh}
              onChangeText={setBatteryKwh}
              placeholder="e.g. 40.5"
              placeholderTextColor="#475569"
              keyboardType="decimal-pad" />

            {/* Target SOC */}
            <Text style={m.label}>Target Charge %</Text>
            <View style={m.socRow}>
              {[60, 70, 80, 90, 100].map(pct => (
                <TouchableOpacity key={pct}
                  style={[m.socBtn,
                    targetSoc === pct.toString() && m.socBtnActive]}
                  onPress={() => setTargetSoc(pct.toString())}>
                  <Text style={[m.socText,
                    targetSoc === pct.toString() && m.socTextActive]}>
                    {pct}%
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Primary toggle */}
            <TouchableOpacity style={m.primaryRow}
              onPress={() => setIsPrimary(!isPrimary)}>
              <View style={[m.checkbox, isPrimary && m.checkboxActive]}>
                {isPrimary && <Text style={m.checkboxTick}>✓</Text>}
              </View>
              <Text style={m.primaryText}>
                Set as primary vehicle (used for charging estimates)
              </Text>
            </TouchableOpacity>

            {/* Save */}
            <TouchableOpacity style={m.saveBtn}
              onPress={handleSave} disabled={saving}>
              {saving
                ? <ActivityIndicator color="#0f172a" />
                : <Text style={m.saveBtnText}>
                    {initial ? 'Update Vehicle' : 'Add Vehicle'}
                  </Text>
              }
            </TouchableOpacity>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

// ─── Main Screen ──────────────────────────────────────
export default function ProfileScreen({ navigation }: any) { 
  const { user, logout } = useAuthStore();
  const [vehicles, setVehicles] = useState<UserVehicle[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingVehicle, setEditingVehicle] = useState<UserVehicle | null>(null);
  
  // Fleet state
  const [userFleet, setUserFleet] = useState<UserFleet | null>(null);
  const [fleetLoading, setFleetLoading] = useState(false);

  const fetchVehicles = useCallback(async () => {
    try {
      const res = await api.get('/api/users/me/vehicles');
      setVehicles(res.data.data || []);
    } catch (err) {
      console.warn('Failed to fetch vehicles:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  // Fetch fleet info
  const fetchFleetInfo = useCallback(async () => {
    try {
      setFleetLoading(true);
      const res = await api.get('/api/fleet/me');
      if (res.data.success && res.data.data) {
        setUserFleet(res.data.data);
      }
    } catch (err) {
      // Not in a fleet is OK — just don't show fleet section
      setUserFleet(null);
    } finally {
      setFleetLoading(false);
    }
  }, []);

  useEffect(() => { 
    fetchVehicles();
    fetchFleetInfo(); 
  }, []);

  const handleAdd = async (data: any) => {
    await api.post('/api/users/me/vehicles', data);
    await fetchVehicles();
  };

  const handleEdit = async (data: any) => {
    await api.put(`/api/users/me/vehicles/${editingVehicle!.id}`, data);
    await fetchVehicles();
  };

  const handleDelete = (vehicle: UserVehicle) => {
    Alert.alert(
      'Remove Vehicle',
      `Remove ${vehicle.brand} ${vehicle.model}${vehicle.nickname ? ` (${vehicle.nickname})` : ''}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove', style: 'destructive',
          onPress: async () => {
            await api.delete(`/api/users/me/vehicles/${vehicle.id}`);
            fetchVehicles();
          }
        }
      ]
    );
  };

  const handleSetPrimary = async (vehicle: UserVehicle) => {
    await api.put(`/api/users/me/vehicles/${vehicle.id}/primary`);
    fetchVehicles();
  };

  const handleLogout = () => {
    Alert.alert('Logout', 'Are you sure you want to logout?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Logout', style: 'destructive', onPress: logout }
    ]);
  };

  const primaryVehicle = vehicles.find(v => v.is_primary === 1) || vehicles[0];

  return (
    <ScrollView style={s.container} contentContainerStyle={s.content}>
      {/* Avatar */}
      <View style={s.avatar}>
        <Text style={s.avatarText}>
          {user?.username?.[0]?.toUpperCase() || '?'}
        </Text>
      </View>
      <Text style={s.name}>{user?.username || 'User'}</Text>
      <Text style={s.email}>{user?.email || ''}</Text>

      {/* Account Info */}
      <View style={s.card}>
        <InfoRow label="Account ID" value={user?.userId?.toString() || '—'} />
        <InfoRow label="OCPP Tag" value={user?.idTag || '—'} />
        <InfoRow label="Plan" value="Standard" />
      </View>

      {/* Fleet Section */}
      {userFleet && (
        <>
          <View style={s.sectionHeader}>
            <Text style={s.sectionTitle}>🚛 Fleet</Text>
          </View>
          
          <TouchableOpacity 
            style={[s.fleetCard, userFleet.role === 'admin' && s.fleetCardAdmin]}
            onPress={() => navigation.navigate('FleetDashboard', { fleetId: userFleet.fleet_id })}
          >
            <View style={s.fleetHeader}>
              <Text style={s.fleetIcon}>🏢</Text>
              <View style={{ flex: 1 }}>
                <Text style={s.fleetName}>{userFleet.fleet_name}</Text>
                <Text style={s.fleetRole}>
                  {userFleet.role === 'admin' ? 'Admin' : 'Driver'} • {userFleet.billing_mode === 'fleet_pays' ? 'Company Pays' : 'You Pay'}
                </Text>
              </View>
              <Text style={s.fleetArrow}>›</Text>
            </View>
            
            {/* Quick stats */}
            {userFleet.monthly_limit && (
              <View style={s.fleetStats}>
                <Text style={s.statLabel}>Monthly Limit</Text>
                <Text style={s.statValue}>₹{userFleet.monthly_limit.toFixed(0)}</Text>
              </View>
            )}
          </TouchableOpacity>
        </>
      )}

      {/* Vehicles Section */}
      <View style={s.sectionHeader}>
        <Text style={s.sectionTitle}>🚗 My Vehicles</Text>
        <TouchableOpacity style={s.addBtn}
          onPress={() => { setEditingVehicle(null); setShowModal(true); }}>
          <Text style={s.addBtnText}>+ Add</Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <ActivityIndicator color="#22d3ee" style={{ marginVertical: 20 }} />
      ) : vehicles.length === 0 ? (
        <TouchableOpacity style={s.emptyCard}
          onPress={() => { setEditingVehicle(null); setShowModal(true); }}>
          <Text style={s.emptyIcon}>🚗</Text>
          <Text style={s.emptyTitle}>No vehicles added</Text>
          <Text style={s.emptySub}>
            Add your EV for accurate charging estimates
          </Text>
          <View style={s.emptyAddBtn}>
            <Text style={s.emptyAddTxt}>Add Vehicle</Text>
          </View>
        </TouchableOpacity>
      ) : (
        vehicles.map(vehicle => (
          <View key={vehicle.id} style={[s.vehicleCard,
            vehicle.is_primary === 1 && s.vehicleCardPrimary]}>
            {/* Primary badge */}
            {vehicle.is_primary === 1 && (
              <View style={s.primaryBadge}>
                <Text style={s.primaryBadgeText}>⭐ Primary</Text>
              </View>
            )}

            {/* Vehicle info */}
            <View style={s.vehicleHeader}>
              <View style={{ flex: 1 }}>
                <Text style={s.vehicleName}>
                  {vehicle.nickname
                    ? vehicle.nickname
                    : `${vehicle.brand} ${vehicle.model}`}
                </Text>
                {vehicle.nickname && (
                  <Text style={s.vehicleSubName}>
                    {vehicle.brand} {vehicle.model}
                    {vehicle.variant ? ` · ${vehicle.variant}` : ''}
                  </Text>
                )}
              </View>
              <Text style={s.vehicleBattery}>
                {vehicle.battery_kwh} kWh
              </Text>
            </View>

            <View style={s.vehicleStats}>
              <Text style={s.vehicleStat}>
                🎯 Target: {vehicle.target_soc}%
              </Text>
              <Text style={s.vehicleStat}>
                🔋 {vehicle.battery_kwh} kWh
              </Text>
            </View>

            {/* Actions */}
            <View style={s.vehicleActions}>
              {vehicle.is_primary !== 1 && (
                <TouchableOpacity style={s.actionBtn}
                  onPress={() => handleSetPrimary(vehicle)}>
                  <Text style={s.actionBtnText}>Set Primary</Text>
                </TouchableOpacity>
              )}
              <TouchableOpacity style={s.actionBtn}
                onPress={() => {
                  setEditingVehicle(vehicle);
                  setShowModal(true);
                }}>
                <Text style={s.actionBtnText}>Edit</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[s.actionBtn, s.actionBtnDanger]}
                onPress={() => handleDelete(vehicle)}>
                <Text style={s.actionBtnDangerText}>Remove</Text>
              </TouchableOpacity>
            </View>
          </View>
        ))
      )}

      {/* Logout */}
      <TouchableOpacity style={s.logoutBtn} onPress={handleLogout}>
        <Text style={s.logoutText}>Logout</Text>
      </TouchableOpacity>

      {/* Add/Edit Modal */}
      <VehicleModal
        visible={showModal}
        onClose={() => setShowModal(false)}
        onSave={editingVehicle ? handleEdit : handleAdd}
        initial={editingVehicle}
      />
    </ScrollView>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={s.row}>
      <Text style={s.rowLabel}>{label}</Text>
      <Text style={s.rowValue}>{value}</Text>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────
const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f172a' },
  content: { padding: 20, paddingBottom: 40 },
  avatar: {
    width: 80, height: 80, borderRadius: 40,
    backgroundColor: '#22d3ee', alignItems: 'center',
    justifyContent: 'center', alignSelf: 'center',
    marginTop: 20, marginBottom: 12,
  },
  avatarText: { fontSize: 36, fontWeight: '800', color: '#0f172a' },
  name: { color: '#f1f5f9', fontSize: 22, fontWeight: '700',
    textAlign: 'center', marginBottom: 4 },
  email: { color: '#64748b', fontSize: 14,
    textAlign: 'center', marginBottom: 24 },
  card: { backgroundColor: '#1e293b', borderRadius: 14,
    padding: 16, marginBottom: 16 },
  row: { flexDirection: 'row', justifyContent: 'space-between',
    paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#334155' },
  rowLabel: { color: '#64748b', fontSize: 14 },
  rowValue: { color: '#e2e8f0', fontSize: 14, fontWeight: '600' },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'center', marginBottom: 12 },
  sectionTitle: { color: '#f1f5f9', fontSize: 17, fontWeight: '700' },
  addBtn: { backgroundColor: '#22d3ee', borderRadius: 20,
    paddingHorizontal: 16, paddingVertical: 6 },
  addBtnText: { color: '#0f172a', fontWeight: '700', fontSize: 13 },
  
  // Fleet styles
  fleetCard: {
    backgroundColor: '#1e293b',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#334155',
  },
  fleetCardAdmin: {
    borderColor: '#22d3ee',
    backgroundColor: '#0c4a6e',
  },
  fleetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  fleetIcon: {
    fontSize: 24,
    marginRight: 12,
  },
  fleetName: {
    color: '#f1f5f9',
    fontSize: 16,
    fontWeight: '700',
  },
  fleetRole: {
    color: '#64748b',
    fontSize: 13,
  },
  fleetArrow: {
    color: '#64748b',
    fontSize: 20,
  },
  fleetStats: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 8,
    marginTop: 4,
  },
  statLabel: {
    color: '#64748b',
    fontSize: 12,
  },
  statValue: {
    color: '#22d3ee',
    fontSize: 14,
    fontWeight: '700',
  },
  
  emptyCard: { backgroundColor: '#1e293b', borderRadius: 14,
    padding: 28, alignItems: 'center', marginBottom: 16,
    borderWidth: 2, borderColor: '#334155', borderStyle: 'dashed' },
  emptyIcon: { fontSize: 40, marginBottom: 10 },
  emptyTitle: { color: '#e2e8f0', fontSize: 16, fontWeight: '700',
    marginBottom: 6 },
  emptySub: { color: '#64748b', fontSize: 13, textAlign: 'center',
    marginBottom: 16 },
  emptyAddBtn: { backgroundColor: '#22d3ee', borderRadius: 10,
    paddingHorizontal: 24, paddingVertical: 10 },
  emptyAddTxt: { color: '#0f172a', fontWeight: '700' },
  vehicleCard: { backgroundColor: '#1e293b', borderRadius: 14,
    padding: 16, marginBottom: 12, borderWidth: 1, borderColor: '#334155' },
  vehicleCardPrimary: { borderColor: '#22d3ee' },
  primaryBadge: { backgroundColor: '#0c4a6e', borderRadius: 20,
    paddingHorizontal: 10, paddingVertical: 3,
    alignSelf: 'flex-start', marginBottom: 10 },
  primaryBadgeText: { color: '#22d3ee', fontSize: 11, fontWeight: '700' },
  vehicleHeader: { flexDirection: 'row', alignItems: 'flex-start',
    marginBottom: 8 },
  vehicleName: { color: '#f1f5f9', fontSize: 16, fontWeight: '700' },
  vehicleSubName: { color: '#64748b', fontSize: 12, marginTop: 2 },
  vehicleBattery: { color: '#22d3ee', fontSize: 16, fontWeight: '800' },
  vehicleStats: { flexDirection: 'row', gap: 16, marginBottom: 12 },
  vehicleStat: { color: '#94a3b8', fontSize: 13 },
  vehicleActions: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  actionBtn: { backgroundColor: '#0f172a', borderRadius: 8,
    paddingHorizontal: 12, paddingVertical: 6,
    borderWidth: 1, borderColor: '#334155' },
  actionBtnText: { color: '#94a3b8', fontSize: 12 },
  actionBtnDanger: { borderColor: '#7f1d1d' },
  actionBtnDangerText: { color: '#fca5a5', fontSize: 12 },
  logoutBtn: { backgroundColor: '#7f1d1d', borderRadius: 12,
    padding: 14, alignItems: 'center', marginTop: 8 },
  logoutText: { color: '#fca5a5', fontWeight: '700', fontSize: 16 },
});

const m = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: '#00000088',
    justifyContent: 'flex-end' },
  sheet: { backgroundColor: '#1e293b', borderTopLeftRadius: 24,
    borderTopRightRadius: 24, padding: 24, paddingBottom: 40,
    maxHeight: '92%' },
  header: { flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'center', marginBottom: 20 },
  title: { color: '#f1f5f9', fontSize: 18, fontWeight: '800' },
  close: { color: '#64748b', fontSize: 22, padding: 4 },
  label: { color: '#64748b', fontSize: 11, fontWeight: '600',
    textTransform: 'uppercase', letterSpacing: 0.5,
    marginBottom: 8, marginTop: 16 },
  input: { backgroundColor: '#0f172a', color: '#fff',
    borderRadius: 10, padding: 12, fontSize: 14,
    borderWidth: 1, borderColor: '#334155' },
  scroll: { marginBottom: 4 },
  chip: { backgroundColor: '#0f172a', borderRadius: 20,
    paddingHorizontal: 14, paddingVertical: 8, marginRight: 8,
    borderWidth: 1, borderColor: '#334155' },
  chipActive: { backgroundColor: '#0c4a6e', borderColor: '#22d3ee' },
  chipText: { color: '#64748b', fontSize: 13 },
  chipTextActive: { color: '#22d3ee', fontWeight: '600' },
  modelList: { backgroundColor: '#0f172a', borderRadius: 10,
    borderWidth: 1, borderColor: '#334155', marginBottom: 4 },
  modelItem: { flexDirection: 'row', alignItems: 'center',
    padding: 12, borderBottomWidth: 1, borderBottomColor: '#1e293b' },
  modelItemActive: { backgroundColor: '#0c4a6e' },
  modelName: { color: '#f1f5f9', fontSize: 14, fontWeight: '600' },
  modelSub: { color: '#64748b', fontSize: 12, marginTop: 2 },
  tick: { color: '#22d3ee', fontSize: 18, fontWeight: '800' },
  socRow: { flexDirection: 'row', gap: 8 },
  socBtn: { flex: 1, backgroundColor: '#0f172a', borderRadius: 8,
    padding: 10, alignItems: 'center',
    borderWidth: 1, borderColor: '#334155' },
  socBtnActive: { backgroundColor: '#0c4a6e', borderColor: '#22d3ee' },
  socText: { color: '#64748b', fontSize: 13, fontWeight: '600' },
  socTextActive: { color: '#22d3ee' },
  primaryRow: { flexDirection: 'row', alignItems: 'center',
    gap: 10, marginTop: 16, marginBottom: 4 },
  checkbox: { width: 22, height: 22, borderRadius: 4,
    borderWidth: 2, borderColor: '#334155',
    alignItems: 'center', justifyContent: 'center' },
  checkboxActive: { backgroundColor: '#22d3ee', borderColor: '#22d3ee' },
  checkboxTick: { color: '#0f172a', fontSize: 14, fontWeight: '800' },
  primaryText: { color: '#94a3b8', fontSize: 13, flex: 1 },
  saveBtn: { backgroundColor: '#22d3ee', borderRadius: 12,
    padding: 16, alignItems: 'center', marginTop: 20 },
  saveBtnText: { color: '#0f172a', fontWeight: '800', fontSize: 15 },
});