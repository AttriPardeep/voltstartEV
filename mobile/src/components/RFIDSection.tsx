// src/components/RFIDSection.tsx
import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
  Alert, ActivityIndicator, Modal, TextInput, ScrollView
} from 'react-native';
import { api } from '../utils/api';
import { useAuthStore } from '../store/authStore';
import { AppIcon, IconColors } from '../components/icons';
import { TagTypeBadge } from '../components/TagTypeBadge';

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

    // Find primary active card
    const primary =
      cards.find(c => c.is_primary === 1 && c.is_active === 1)
      || cards.find(c => c.tag_type === 'system' && c.is_active === 1);

    if (primary) {
      useAuthStore.getState().updateUser({
        idTag: primary.id_tag
      });
      console.log(' Updated auth store idTag:', primary.id_tag);
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
        'RFID Card Registered',
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
            {/* Header: Icon + Text in row */}
            <View style={m.titleRow}>
              <AppIcon.Card size={20} color={IconColors.primary} />
              <Text style={m.title}>Add RFID Card</Text>
            </View>
            <TouchableOpacity onPress={onClose}>
              <AppIcon.Close size={22} color={IconColors.muted} />
            </TouchableOpacity>
          </View>

          <ScrollView showsVerticalScrollIndicator={false}>
            {/* Instruction */}
            <View style={m.infoBox}>
              <View style={m.infoTitleRow}>
                <AppIcon.Info size={14} color="#60a5fa" />
                <Text style={m.infoTitle}>Where to find your RFID ID</Text>
              </View>
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
      await fetchCards();
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
              await refreshUserTag();
            } catch (err: any) {
              Alert.alert('Failed', err?.response?.data?.error || 'Could not remove');
            }
          }
        }
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
              card.blocked === 1 && s.cardBlocked,
            ]}
          >
            {/* ONLY show badge */}
            {card.is_primary === 1 && (
              <View style={s.primaryBadge}>
                <View style={s.badgeContent}>
                  <AppIcon.Success
                    size={12}
                    color={IconColors.primary}
                    strokeWidth={2.5}
                  />
                  <Text style={s.primaryBadgeText}>Primary</Text>
                </View>
              </View>
            )}
            
            {/* Blocked Badge - Top Left */}
            {card.blocked === 1 && (
              <View style={s.blockedBadge}>
                <View style={s.badgeContent}>
                  <AppIcon.Error size={12} color={IconColors.error} strokeWidth={2.5} />
                  <Text style={s.blockedBadgeText}>Blocked</Text>
                </View>
              </View>
            )}

            {/* Card Header - Tag Type Badge on Right */}
            <View style={s.cardHeader}>
              <View style={{ flex: 1 }}>
                {/* Tag ID - Large & Prominent */}
                <Text style={s.cardTag}>{card.id_tag}</Text>
                {/* Label - Smaller, below tag */}
                {card.label && (
                  <Text style={s.cardLabel}>{card.label}</Text>
                )}
              </View>
              
              {/* Tag Type Badge - Top Right */}
              <TagTypeBadge type={card.tag_type} />
            </View>

            {/* Date - Below tag info */}
            <Text style={s.cardDate}>
              Added {new Date(card.created_at).toLocaleDateString('en-IN')}
            </Text>

            {/* Actions Row */}
            <View style={s.actions}>
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

// ── Styles ────────────────────────────────────────────
const s = StyleSheet.create({
  container: { 
    marginBottom: 16,
  },
  // Header
  header: {
    flexDirection: 'row', 
    justifyContent: 'space-between',
    alignItems: 'center', 
    marginBottom: 6,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  title: { 
    color: '#f1f5f9', 
    fontSize: 17, 
    fontWeight: '700',
    includeFontPadding: false,
  },
  
  subtitle: { 
    color: IconColors.muted, 
    fontSize: 12, 
    marginBottom: 14, 
    lineHeight: 18,
    includeFontPadding: false,
  },
  
  // Add Button
  addBtn: {
    backgroundColor: IconColors.primary, 
    borderRadius: 20,
    paddingHorizontal: 14, 
    paddingVertical: 6,
  },
  addBtnText: { 
    color: '#0f172a', 
    fontWeight: '700', 
    fontSize: 13,
    includeFontPadding: false,
  },
  
  // Empty State
  emptyCard: {
    backgroundColor: '#1e293b', 
    borderRadius: 12,
    padding: 24, 
    alignItems: 'center',
    borderWidth: 1, 
    borderColor: '#334155', 
    borderStyle: 'dashed',
  },
  emptyIcon: {
    marginBottom: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyTitle: { 
    color: '#e2e8f0', 
    fontSize: 15, 
    fontWeight: '600',
    marginBottom: 4,
    includeFontPadding: false,
  },
  emptySub: { 
    color: IconColors.muted, 
    fontSize: 13, 
    textAlign: 'center',
    includeFontPadding: false,
  },
  
  // Card Container
  card: {
    backgroundColor: '#1e293b', 
    borderRadius: 12,
    padding: 14, 
    marginBottom: 10,
    borderWidth: 1, 
    borderColor: '#334155',
  },
  cardPrimary: { 
    borderColor: IconColors.primary,
    borderWidth: 1.5,
  },
  cardBlocked: { 
    borderColor: IconColors.error, 
    opacity: 0.7,
  },
  
  // Badges (Primary/Blocked)
  primaryBadge: {
    backgroundColor: '#0c4a6e', 
    borderRadius: 20,
    paddingHorizontal: 10, 
    paddingVertical: 4,
    alignSelf: 'flex-start', 
    marginBottom: 10,
  },
  blockedBadge: {
    backgroundColor: '#7f1d1d', 
    borderRadius: 20,
    paddingHorizontal: 10, 
    paddingVertical: 4,
    alignSelf: 'flex-start', 
    marginBottom: 10,
  },
  badgeContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  primaryBadgeText: { 
    color: IconColors.primary, 
    fontSize: 11, 
    fontWeight: '700',
    includeFontPadding: false,
  },
  blockedBadgeText: { 
    color: '#fca5a5', 
    fontSize: 11, 
    fontWeight: '700',
    includeFontPadding: false,
  },
  
  // Card Content
  cardHeader: { 
    flexDirection: 'row', 
    alignItems: 'flex-start',
    marginBottom: 6,
  },
  cardTag: {
    color: IconColors.font, 
    fontSize: 14,  // Larger, more prominent
    fontWeight: '700',
    fontFamily: 'monospace',
    includeFontPadding: false,
    marginBottom: 2,
  },
  cardLabel: {  
    color: '#94a3b8', 
    fontSize: 13, 
    includeFontPadding: false,
  },
  
  cardDate: {   
    color: '#475569', 
    fontSize: 11, 
    marginBottom: 12,
    includeFontPadding: false,
  },
  
  // Action Buttons
  actions: {    
    flexDirection: 'row', 
    gap: 8,
  },
  actionBtn: {
    backgroundColor: '#0f172a', 
    borderRadius: 8,
    paddingHorizontal: 12, 
    paddingVertical: 8,  // Slightly taller
    borderWidth: 1, 
    borderColor: '#334155',
  },
  actionBtnText: {       
    color: '#94a3b8', 
    fontSize: 12,
    fontWeight: '600',
    includeFontPadding: false,
  },
  actionBtnDanger: {     
    borderColor: '#7f1d1d',
  },
  actionBtnDangerText: { 
    color: '#fca5a5', 
    fontSize: 12,
    fontWeight: '600',
    includeFontPadding: false,
  },
});

const m = StyleSheet.create({
  overlay: {
    flex: 1, 
    backgroundColor: 'rgba(0,0,0,0.6)',  // Slightly darker
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: '#1e293b', 
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24, 
    padding: 24, 
    paddingBottom: 40,
    maxHeight: '85%',
  },
  header: {
    flexDirection: 'row', 
    justifyContent: 'space-between',
    alignItems: 'center', 
    marginBottom: 20,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  title: { 
    color: '#f1f5f9', 
    fontSize: 18, 
    fontWeight: '800',
    includeFontPadding: false,
  },
  close: { 
    color: IconColors.muted, 
    fontSize: 22,
  },
  
  infoBox: {
    backgroundColor: '#0c2a3a', 
    borderRadius: 10,
    padding: 14, 
    marginBottom: 16,  // More spacing
    borderWidth: 1, 
    borderColor: '#1e3a5f',
  },
  infoTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 6,
  },
  infoTitle: { 
    color: '#60a5fa', 
    fontSize: 13, 
    fontWeight: '700',
    includeFontPadding: false,
  },
  infoText: { 
    color: '#94a3b8', 
    fontSize: 12, 
    lineHeight: 18,
    includeFontPadding: false,
  },
  infoCode: { 
    color: IconColors.primary, 
    fontFamily: 'monospace',
  },
  
  label: {
    color: IconColors.muted, 
    fontSize: 11, 
    fontWeight: '600',
    textTransform: 'uppercase', 
    letterSpacing: 0.5,
    marginBottom: 8, 
    marginTop: 16,
    includeFontPadding: false,
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
    includeFontPadding: false,
  },
  
  saveBtn: {
    backgroundColor: IconColors.primary, 
    borderRadius: 12,
    padding: 14, 
    alignItems: 'center', 
    marginTop: 20,
  },
  saveBtnDim: {  
    backgroundColor: '#334155',
  },
  saveBtnText: { 
    color: '#0f172a', 
    fontWeight: '800', 
    fontSize: 15,
    includeFontPadding: false,
  },
});