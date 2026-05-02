// src/components/RFIDSection.tsx
import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
  Alert, ActivityIndicator, Modal, TextInput, ScrollView
} from 'react-native';
import { api } from '../utils/api';

interface RFIDCard {
  id: number;
  id_tag: string;
  label: string;
  tag_type: 'system' | 'external_rfid' | 'fleet';
  is_primary: number;
  is_active: number;
  blocked: number;
  created_at: string;
}

const refreshUserTag = async () => {
  try {
    const res = await api.get('/api/users/me/rfid');
    const cards: RFIDCard[] = res.data.data || [];
    // Find the primary active card
    const primary = cards.find(c => c.is_primary === 1 && c.is_active === 1)
                 || cards.find(c => c.tag_type === 'system' && c.is_active === 1);

    if (primary) {
      // Update authStore so Profile header shows correct tag
      useAuthStore.getState().updateUser({
        idTag: primary.ocpp_tag_id
      });
    }
  } catch (err) {
    console.warn('Could not refresh user tag:', err);
  }
};

// ── Add RFID Modal ─────────────────────────────────────
function AddRFIDModal({ visible, onClose, onAdded }: {
  visible: boolean;
  onClose: () => void;
  onAdded: () => void;
}) {
  const [idTag, setIdTag]   = useState('');
  const [label, setLabel]   = useState('');
  const [saving, setSaving] = useState(false);

  const handleAdd = async () => {
    if (!idTag.trim()) {
      Alert.alert('Required', 'Please enter the RFID card ID');
      return;
    }
    setSaving(true);
    try {
      const res = await api.post('/api/users/me/rfid', {
        idTag: idTag.trim(),
        label: label.trim() || 'My RFID Card',
      });
      Alert.alert(
        '✅ RFID Card Registered',
        `${res.data.data.idTag}\n\nYou can now tap this card at any VoltStartEV charger.`
      );
      setIdTag(''); setLabel('');
      onAdded();
	  await refreshUserTag();
      onClose();
    } catch (err: any) {
      Alert.alert('Failed', err?.response?.data?.error || 'Could not register card');
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
            <Text style={m.title}>Add RFID Card</Text>
            <TouchableOpacity onPress={onClose}>
              <Text style={m.close}>✕</Text>
            </TouchableOpacity>
          </View>

          <ScrollView showsVerticalScrollIndicator={false}>
            {/* Instruction */}
            <View style={m.infoBox}>
              <Text style={m.infoTitle}>📖 Where to find your RFID ID</Text>
              <Text style={m.infoText}>
                Look for the UID printed on the back of your RFID card or fob.
                It's usually 8 characters like{' '}
                <Text style={m.infoCode}>A1B2C3D4</Text>
                {' '}or formatted as{' '}
                <Text style={m.infoCode}>A1:B2:C3:D4</Text>.
                Both formats are accepted.
              </Text>
            </View>

            <Text style={m.label}>Card UID *</Text>
            <TextInput
              style={m.input}
              value={idTag}
              onChangeText={setIdTag}
              placeholder="e.g. A1B2C3D4 or A1:B2:C3:D4"
              placeholderTextColor="#475569"
              autoCapitalize="characters"
              autoCorrect={false}
            />

            <Text style={m.label}>Card Name (optional)</Text>
            <TextInput
              style={m.input}
              value={label}
              onChangeText={setLabel}
              placeholder="e.g. My Blue Fob, Work Card"
              placeholderTextColor="#475569"
            />

            {/* Common RFID types info */}
            <View style={m.typesRow}>
              {[
                { icon: '💳', name: 'RFID Card', freq: '13.56 MHz' },
                { icon: '🔑', name: 'Key Fob',   freq: '13.56 MHz' },
                { icon: '📱', name: 'NFC Tag',   freq: '13.56 MHz' },
              ].map(t => (
                <View key={t.name} style={m.typeCard}>
                  <Text style={m.typeIcon}>{t.icon}</Text>
                  <Text style={m.typeName}>{t.name}</Text>
                  <Text style={m.typeFreq}>{t.freq}</Text>
                </View>
              ))}
            </View>

            <TouchableOpacity
              style={[m.saveBtn, saving && m.saveBtnDim]}
              onPress={handleAdd}
              disabled={saving}>
              {saving
                ? <ActivityIndicator color="#0f172a" />
                : <Text style={m.saveBtnText}>Register Card</Text>
              }
            </TouchableOpacity>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

// ── Main RFID Section ──────────────────────────────────
export default function RFIDSection() {
  const [cards, setCards]     = useState<RFIDCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);

  const fetchCards = useCallback(async () => {
    try {
      const res = await api.get('/api/users/me/rfid');
      setCards(res.data.data || []);
    } catch {
      setCards([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchCards(); }, []);

  const handleSetPrimary = async (card: RFIDCard) => {
    try {
      await api.put(`/api/users/me/rfid/${card.id}/primary`);
      fetchCards();
	  await refreshUserTag();
    } catch (err: any) {
      Alert.alert('Failed', err?.response?.data?.error || 'Could not update');
    }
  };

  const handleRemove = (card: RFIDCard) => {
    if (card.tag_type === 'system') {
      Alert.alert(
        'Cannot Remove',
        'Your system-generated tag cannot be removed. It is used as a fallback.'
      );
      return;
    }
    Alert.alert(
      'Remove Card',
      `Remove "${card.label}" (${card.id_tag})?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove', style: 'destructive',
          onPress: async () => {
            try {
              await api.delete(`/api/users/me/rfid/${card.id}`);
              fetchCards();
			  onTagChanged?.();
			  await refreshUserTag();
            } catch (err: any) {
              Alert.alert('Failed', err?.response?.data?.error || 'Could not remove');
            }
          }
        }
      ]
    );
  };

  const tagTypeLabel = (type: string) => {
    switch (type) {
      case 'system':        return '⚡ App Tag';
      case 'external_rfid': return '💳 RFID Card';
      case 'fleet':         return '🏢 Fleet Tag';
      default:              return type;
    }
  };

  return (
    <View style={s.container}>
      <View style={s.header}>
        <Text style={s.title}>💳 RFID & Charging Tags</Text>
        <TouchableOpacity style={s.addBtn}
          onPress={() => setShowAdd(true)}>
          <Text style={s.addBtnText}>+ Add RFID</Text>
        </TouchableOpacity>
      </View>

      <Text style={s.subtitle}>
        Tap your RFID card at any charger to start charging
        without opening the app.
      </Text>

      {loading ? (
        <ActivityIndicator color="#22d3ee" style={{ margin: 16 }} />
      ) : cards.length === 0 ? (
        <TouchableOpacity style={s.emptyCard}
          onPress={() => setShowAdd(true)}>
          <Text style={s.emptyIcon}>💳</Text>
          <Text style={s.emptyTitle}>No cards registered</Text>
          <Text style={s.emptySub}>
            Add your RFID card or fob to charge without the app
          </Text>
        </TouchableOpacity>
      ) : (
        cards.map(card => (
          <View key={card.id} style={[
            s.card,
            card.is_primary === 1 && s.cardPrimary,
            card.blocked === 1 && s.cardBlocked,
          ]}>
            {/* Primary badge */}
            {card.is_primary === 1 && (
              <View style={s.primaryBadge}>
                <Text style={s.primaryBadgeText}>⭐ Primary</Text>
              </View>
            )}

            {card.blocked === 1 && (
              <View style={s.blockedBadge}>
                <Text style={s.blockedBadgeText}>⛔ Blocked</Text>
              </View>
            )}

            <View style={s.cardHeader}>
              <View style={{ flex: 1 }}>
                <Text style={s.cardLabel}>{card.label}</Text>
                <Text style={s.cardTag}>{card.id_tag}</Text>
              </View>
              <View style={[s.typePill,
                { backgroundColor: card.tag_type === 'system'
                    ? '#0c4a6e' : '#1a2a1a' }]}>
                <Text style={[s.typePillText,
                  { color: card.tag_type === 'system'
                      ? '#22d3ee' : '#22c55e' }]}>
                  {tagTypeLabel(card.tag_type)}
                </Text>
              </View>
            </View>

            <Text style={s.cardDate}>
              Added {new Date(card.created_at).toLocaleDateString('en-IN')}
            </Text>

            {/* Actions */}
            <View style={s.actions}>
              {card.is_primary !== 1 && (
                <TouchableOpacity style={s.actionBtn}
                  onPress={() => handleSetPrimary(card)}>
                  <Text style={s.actionBtnText}>Set Primary</Text>
                </TouchableOpacity>
              )}
              {card.tag_type !== 'system' && (
                <TouchableOpacity
                  style={[s.actionBtn, s.actionBtnDanger]}
                  onPress={() => handleRemove(card)}>
                  <Text style={s.actionBtnDangerText}>Remove</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        ))
      )}

      <AddRFIDModal
        visible={showAdd}
        onClose={() => setShowAdd(false)}
        onAdded={fetchCards}
      />
    </View>
  );
}

const s = StyleSheet.create({
  container:   { marginBottom: 16 },
  header: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'center', marginBottom: 6,
  },
  title:    { color: '#f1f5f9', fontSize: 17, fontWeight: '700' },
  subtitle: { color: '#64748b', fontSize: 12, marginBottom: 14, lineHeight: 18 },
  addBtn: {
    backgroundColor: '#22d3ee', borderRadius: 20,
    paddingHorizontal: 14, paddingVertical: 6,
  },
  addBtnText: { color: '#0f172a', fontWeight: '700', fontSize: 13 },
  emptyCard: {
    backgroundColor: '#1e293b', borderRadius: 12,
    padding: 24, alignItems: 'center',
    borderWidth: 1, borderColor: '#334155', borderStyle: 'dashed',
  },
  emptyIcon:  { fontSize: 36, marginBottom: 8 },
  emptyTitle: { color: '#e2e8f0', fontSize: 15, fontWeight: '600',
    marginBottom: 4 },
  emptySub:   { color: '#64748b', fontSize: 13, textAlign: 'center' },
  card: {
    backgroundColor: '#1e293b', borderRadius: 12,
    padding: 14, marginBottom: 10,
    borderWidth: 1, borderColor: '#334155',
  },
  cardPrimary: { borderColor: '#22d3ee' },
  cardBlocked: { borderColor: '#ef4444', opacity: 0.7 },
  primaryBadge: {
    backgroundColor: '#0c4a6e', borderRadius: 20,
    paddingHorizontal: 10, paddingVertical: 3,
    alignSelf: 'flex-start', marginBottom: 8,
  },
  primaryBadgeText: { color: '#22d3ee', fontSize: 11, fontWeight: '700' },
  blockedBadge: {
    backgroundColor: '#7f1d1d', borderRadius: 20,
    paddingHorizontal: 10, paddingVertical: 3,
    alignSelf: 'flex-start', marginBottom: 8,
  },
  blockedBadgeText: { color: '#fca5a5', fontSize: 11, fontWeight: '700' },
  cardHeader: { flexDirection: 'row', alignItems: 'flex-start',
    marginBottom: 4 },
  cardLabel:  { color: '#f1f5f9', fontSize: 15, fontWeight: '700' },
  cardTag:    { color: '#22d3ee', fontSize: 12, fontFamily: 'monospace',
    marginTop: 2 },
  typePill: {
    borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4,
    marginLeft: 8,
  },
  typePillText: { fontSize: 11, fontWeight: '700' },
  cardDate:   { color: '#475569', fontSize: 11, marginBottom: 10 },
  actions:    { flexDirection: 'row', gap: 8 },
  actionBtn: {
    backgroundColor: '#0f172a', borderRadius: 8,
    paddingHorizontal: 12, paddingVertical: 6,
    borderWidth: 1, borderColor: '#334155',
  },
  actionBtnText:       { color: '#94a3b8', fontSize: 12 },
  actionBtnDanger:     { borderColor: '#7f1d1d' },
  actionBtnDangerText: { color: '#fca5a5', fontSize: 12 },
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
  infoBox: {
    backgroundColor: '#0c2a3a', borderRadius: 10,
    padding: 14, marginBottom: 8,
    borderWidth: 1, borderColor: '#1e3a5f',
  },
  infoTitle:{ color: '#60a5fa', fontSize: 13, fontWeight: '700',
    marginBottom: 6 },
  infoText: { color: '#94a3b8', fontSize: 12, lineHeight: 18 },
  infoCode: { color: '#22d3ee', fontFamily: 'monospace' },
  label: {
    color: '#64748b', fontSize: 11, fontWeight: '600',
    textTransform: 'uppercase', letterSpacing: 0.5,
    marginBottom: 8, marginTop: 16,
  },
  input: {
    backgroundColor: '#0f172a', color: '#fff',
    borderRadius: 10, padding: 12, fontSize: 14,
    borderWidth: 1, borderColor: '#334155',
    fontFamily: 'monospace',
  },
  typesRow: {
    flexDirection: 'row', gap: 8, marginTop: 16, marginBottom: 4,
  },
  typeCard: {
    flex: 1, backgroundColor: '#0f172a', borderRadius: 10,
    padding: 10, alignItems: 'center',
    borderWidth: 1, borderColor: '#334155',
  },
  typeIcon: { fontSize: 22, marginBottom: 4 },
  typeName: { color: '#94a3b8', fontSize: 11, fontWeight: '600' },
  typeFreq: { color: '#475569', fontSize: 10 },
  saveBtn: {
    backgroundColor: '#22d3ee', borderRadius: 12,
    padding: 14, alignItems: 'center', marginTop: 20,
  },
  saveBtnDim:  { backgroundColor: '#334155' },
  saveBtnText: { color: '#0f172a', fontWeight: '800', fontSize: 15 },
});