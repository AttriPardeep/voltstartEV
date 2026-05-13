// src/components/RFIDSection.tsx
import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  Modal,
  TextInput,
  ScrollView,
} from 'react-native';
import { api } from '../utils/api';
import { useAuthStore } from '../store/authStore';
import {
  AppIcon,
  IconColors,
  IconSize,
  IconBadge,
} from '../components/icons';

// ─────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────
interface RFIDCard {
  id:         number;
  //match actual backend column name (ocpp_tag_id not id_tag)
  ocpp_tag_id: string;
  label:      string;
  tag_type:   'system' | 'external_rfid' | 'fleet';
  is_primary: number;
  is_active:  number;
  blocked:    number;
  created_at: string;
}

// ─────────────────────────────────────────────────────
// FIX 2: TagTypeBadge moved to TOP — before RFIDSection
// Metro bundler requires components to be declared before use
// ─────────────────────────────────────────────────────
function TagTypeBadge({ type }: { type: string }) {
  const config: Record<string, {
    label: string;
    Icon:  any;
    color: string;
    bg:    string;
  }> = {
    system: {
      label: 'App Tag',
      Icon:  AppIcon.Zap,
      color: IconColors.primary,
      bg:    '#0C4A6E',
    },
    external_rfid: {
      label: 'RFID Card',
      Icon:  AppIcon.Card,
      color: IconColors.purple,
      bg:    '#2E1065',
    },
    fleet: {
      label: 'Fleet Tag',
      Icon:  AppIcon.FleetBuilding,
      color: IconColors.primary,
      bg:    '#0C4A6E',
    },
  };

  const { label, Icon, color, bg } = config[type] ?? config.system;

  return (
    <View style={[s.typeBadge, { backgroundColor: bg }]}>
      <Icon size={IconSize.xs} color={color} />
      <Text style={[s.typeBadgeText, { color }]}>{label}</Text>
    </View>
  );
}

// ─────────────────────────────────────────────────────
// FIX 4: refreshUserTag as regular async function
// NOT module-level — called explicitly when needed
// ─────────────────────────────────────────────────────
async function refreshUserTag(): Promise<void> {
  try {
    const res = await api.get('/api/users/me/rfid');
    const cards: RFIDCard[] = res.data.data || [];

    const primary =
      cards.find(c => c.is_primary === 1 && c.is_active === 1) ||
      cards.find(c => c.tag_type === 'system' && c.is_active === 1);

    if (primary) {
      // use ocpp_tag_id
      useAuthStore.getState().updateUser({ idTag: primary.ocpp_tag_id });
    }
  } catch (err) {
    console.warn('Could not refresh user tag:', err);
  }
}

// ─────────────────────────────────────────────────────
// Add RFID Modal
// ─────────────────────────────────────────────────────
function AddRFIDModal({
  visible,
  onClose,
  onAdded,
}: {
  visible: boolean;
  onClose: () => void;
  onAdded: () => void;
}) {
  const [idTag, setIdTag] = useState('');
  const [label, setLabel] = useState('');
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
        'RFID Card Registered',
        `${res.data.data.idTag}\n\nYou can now tap this card at any VoltStartEV charger.`
      );

      setIdTag('');
      setLabel('');
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
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={m.overlay}>
        <View style={m.sheet}>
          {/* Header */}
          <View style={m.header}>
            <View style={m.titleRow}>
              <AppIcon.Card size={20} color={IconColors.primary} />
              <Text style={m.title}>Add RFID Card</Text>
            </View>
            <TouchableOpacity onPress={onClose}>
              <AppIcon.Close size={22} color={IconColors.muted} />
            </TouchableOpacity>
          </View>

          <ScrollView showsVerticalScrollIndicator={false}>
            {/* Info box */}
            <View style={m.infoBox}>
              <View style={m.infoTitleRow}>
                <AppIcon.Info size={14} color="#60a5fa" />
                <Text style={m.infoTitle}>Where to find your RFID ID</Text>
              </View>
              
              <Text style={m.infoText}>
                {"Look for the UID printed on the back of your RFID card or fob. It's usually 8 characters like "}
                <Text style={m.infoCode}>A1B2C3D4</Text>
                {" or formatted as "}
                <Text style={m.infoCode}>A1:B2:C3:D4</Text>
                {". Both formats are accepted."}
              </Text>
            </View> {/* <--- THIS WAS THE MISSING TAG CAUSING THE SYNTAX ERROR */}

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

            <TouchableOpacity
              style={[m.saveBtn, saving && m.saveBtnDim]}
              onPress={handleAdd}
              disabled={saving}
            >
              {saving ? (
                <ActivityIndicator color="#0f172a" />
              ) : (
                <Text style={m.saveBtnText}>Register Card</Text>
              )}
            </TouchableOpacity>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}
// ─────────────────────────────────────────────────────
// Main RFID Section
// ─────────────────────────────────────────────────────
export default function RFIDSection() {
  const [cards,   setCards]   = useState<RFIDCard[]>([]);
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

  useEffect(() => { fetchCards(); }, [fetchCards]);

  const handleSetPrimary = async (card: RFIDCard) => {
    try {
      await api.put(`/api/users/me/rfid/${card.id}/primary`);
      await fetchCards();
      //  use ocpp_tag_id
      useAuthStore.getState().updateUser({ idTag: card.ocpp_tag_id });
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
      `Remove "${card.label}" (${card.ocpp_tag_id})?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove', style: 'destructive',
          onPress: async () => {
            try {
              await api.delete(`/api/users/me/rfid/${card.id}`);
              await fetchCards();
              await refreshUserTag();
            } catch (err: any) {
              Alert.alert('Failed', err?.response?.data?.error || 'Could not remove');
            }
          },
        },
      ]
    );
  };

  return (
    <View style={s.container}>
      {/* Header */}
      <View style={s.header}>
        <View style={s.titleRow}>
          <AppIcon.Card size={20} color={IconColors.primary} />
          <Text style={s.title}>RFID & Charging Tags</Text>
        </View>
        <TouchableOpacity style={s.addBtn} onPress={() => setShowAdd(true)}>
          <Text style={s.addBtnText}>+ Add RFID</Text>
        </TouchableOpacity>
      </View>

      <Text style={s.subtitle}>
        Tap your RFID card at any charger to start charging without opening the app.
      </Text>

      {/* Content */}
      {loading ? (
        <ActivityIndicator color={IconColors.primary} style={{ margin: 16 }} />
      ) : cards.length === 0 ? (
        <TouchableOpacity style={s.emptyCard} onPress={() => setShowAdd(true)}>
          <View style={s.emptyIcon}>
            <AppIcon.Card size={36} color={IconColors.muted} />
          </View>
          <Text style={s.emptyTitle}>No cards registered</Text>
          <Text style={s.emptySub}>
            Add your RFID card or fob to charge without the app
          </Text>
        </TouchableOpacity>
      ) : (
        cards.map(card => (
          <View
            key={card.id}
            style={[
              s.card,
              card.is_primary === 1 && s.cardPrimary,
              card.blocked === 1    && s.cardBlocked,
            ]}
          >
            {/* removed invalid size prop from IconBadge */}
            {card.is_primary === 1 && (
              <View style={s.primaryBadge}>
                <IconBadge
                  icon={AppIcon.Star}
                  label="Primary"
                  color={IconColors.primary}
                  background="#0C4A6E"
                />
              </View>
            )}

            {card.blocked === 1 && (
              <View style={s.blockedBadge}>
                <IconBadge
                  icon={AppIcon.Error}
                  label="Blocked"
                  color={IconColors.error}
                  background="#7F1D1D"
                />
              </View>
            )}

            {/* Card header */}
              <View style={s.cardHeader}>
                <View style={{ flex: 1 }}>
                  {/* 1. Main display (Usually the Label/Nickname) */}
                  <Text style={s.cardTag}>{card.label || 'Unnamed Tag'}</Text>
                  
                  {/* 2. Secondary display (The actual hexadecimal/OCPP ID) */}
                  {/* Use id_tag because your backend SQL aliased it as 'id_tag' */}
                  <Text style={s.cardLabel}>ID: {card.id_tag}</Text> 
                </View>
                
                <TagTypeBadge type={card.tag_type} />
              </View>

            <Text style={s.cardDate}>
              Added {new Date(card.created_at).toLocaleDateString('en-IN')}
            </Text>

            {/* Actions */}
            <View style={s.actions}>
              {card.is_primary !== 1 && (
                <TouchableOpacity
                  style={s.actionBtn}
                  onPress={() => handleSetPrimary(card)}
                >
                  <Text style={s.actionBtnText}>Set Primary</Text>
                </TouchableOpacity>
              )}
              {card.tag_type !== 'system' && (
                <TouchableOpacity
                  style={[s.actionBtn, s.actionBtnDanger]}
                  onPress={() => handleRemove(card)}
                >
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

// ─────────────────────────────────────────────────────
// Styles
// ─────────────────────────────────────────────────────
const s = StyleSheet.create({
  container:  { marginBottom: 16 },

  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  title:    { color: '#f1f5f9', fontSize: 17, fontWeight: '700' },

  subtitle: {
    color: '#64748b', fontSize: 12,
    marginBottom: 14, lineHeight: 18,
  },

  addBtn: {
    backgroundColor: IconColors.primary,
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 6,
  },
  addBtnText: { color: '#0f172a', fontWeight: '700', fontSize: 13 },

  emptyCard: {
    backgroundColor: '#1e293b',
    borderRadius: 12,
    padding: 24,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#334155',
    borderStyle: 'dashed',
  },
  emptyIcon:  { marginBottom: 8, alignItems: 'center', justifyContent: 'center' },
  emptyTitle: { color: '#e2e8f0', fontSize: 15, fontWeight: '600', marginBottom: 4 },
  emptySub:   { color: '#64748b', fontSize: 13, textAlign: 'center' },

  card: {
    backgroundColor: '#1e293b',
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#334155',
  },
  cardPrimary: { borderColor: IconColors.primary, borderWidth: 1.5 },
  cardBlocked: { borderColor: IconColors.error, opacity: 0.7 },

  primaryBadge: { alignSelf: 'flex-start', marginBottom: 10 },
  blockedBadge: { alignSelf: 'flex-start', marginBottom: 10 },

  cardHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 6,
  },
  cardTag: {
    color: IconColors.primary,
    fontSize: 16,
    fontWeight: '700',
    fontFamily: 'monospace',
    marginBottom: 2,
  },
  cardLabel: { color: '#94a3b8', fontSize: 13 },

  typeBadge: {
    borderRadius: 20,
    paddingHorizontal: 8,
    paddingVertical: 4,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  typeBadgeText: { fontSize: 11, fontWeight: '600' },

  cardDate:   { color: '#475569', fontSize: 11, marginBottom: 12 },

  actions:    { flexDirection: 'row', gap: 8 },
  actionBtn: {
    backgroundColor: '#0f172a',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: '#334155',
  },
  actionBtnText:       { color: '#94a3b8', fontSize: 12, fontWeight: '600' },
  actionBtnDanger:     { borderColor: '#7f1d1d' },
  actionBtnDangerText: { color: '#fca5a5', fontSize: 12, fontWeight: '600' },
});

const m = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: '#00000088',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: '#1e293b',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    paddingBottom: 40,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  title:    { color: '#f1f5f9', fontSize: 18, fontWeight: '800' },

  infoBox: {
    backgroundColor: '#0c2a3a',
    borderRadius: 10,
    padding: 14,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#1e3a5f',
  },
  infoTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 6,
  },
  infoTitle: { color: '#60a5fa', fontSize: 13, fontWeight: '700' },
  infoText:  { color: '#94a3b8', fontSize: 12, lineHeight: 18 },
  infoCode:  { color: IconColors.primary, fontFamily: 'monospace' },

  label: {
    color: '#64748b',
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 8,
    marginTop: 16,
  },
  input: {
    backgroundColor: '#0f172a',
    color: '#fff',
    borderRadius: 10,
    padding: 12,
    fontSize: 14,
    borderWidth: 1,
    borderColor: '#334155',
    fontFamily: 'monospace',
  },
  saveBtn:    {
    backgroundColor: IconColors.primary,
    borderRadius: 12,
    padding: 14,
    alignItems: 'center',
    marginTop: 20,
  },
  saveBtnDim: { backgroundColor: '#334155' },
  saveBtnText: { color: '#0f172a', fontWeight: '800', fontSize: 15 },
});
