// src/components/TargetSocControl.tsx
import React, { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
  Alert, ActivityIndicator
} from 'react-native';
import { api } from '../utils/api';
import { useAuthStore } from '../store/authStore';
import { useSessionStore } from '../store/sessionStore';

// Import Icon System
import { AppIcon, IconColors, IconSize } from '../components/icons';

interface Props {
  vehicleId: number;
  currentSoc: number;
  vehicleName: string;
  onUpdated: (newSoc: number) => void;
}

const SOC_PRESETS = [50, 60, 70, 80, 85, 90, 95, 100];

export default function TargetSocControl({
  vehicleId, currentSoc, vehicleName, onUpdated
}: Props) {
  const [selected, setSelected] = useState(currentSoc);
  const [saving, setSaving]     = useState(false);
  const { activeSession }       = useSessionStore();
  const isCharging              = !!activeSession;

  const handleSave = useCallback(async (newSoc: number) => {
    if (newSoc === currentSoc) return;
    setSaving(true);
    try {
      const res = await api.put(
        `/api/users/me/vehicles/${vehicleId}/target-soc`,
        { targetSoc: newSoc }
      );

      onUpdated(newSoc);

      const { appliedToActiveSession } = res.data.data;
      if (appliedToActiveSession) {
        Alert.alert(
          'Target Updated',
          `Charging target set to ${newSoc}% and applied to your active session.`
        );
      }
    } catch (err: any) {
      setSelected(currentSoc);      Alert.alert('Failed', err?.response?.data?.error || 'Could not update target');
    } finally {
      setSaving(false);
    }
  }, [vehicleId, currentSoc, onUpdated]);

  const handlePresetTap = (soc: number) => {
    setSelected(soc);
    handleSave(soc);
  };

  return (
    <View style={s.card}>
      {/* Header */}
      <View style={s.header}>
        <View style={s.titleRow}>
          {/*  */}
          <AppIcon.Target size={IconSize.md} color={IconColors.primary} />
          <View>
            <Text style={s.title}>Charge Target</Text>
            <Text style={s.sub}>{vehicleName}</Text>
          </View>
        </View>
        {isCharging && (
          <View style={s.activeBadge}>
            <View style={s.activeDot} />
            <Text style={s.activeText}>Session Active</Text>
          </View>
        )}
      </View>

      {/* Current target display */}
      <View style={s.currentRow}>
        <Text style={s.currentLabel}>Current target</Text>
        <View style={s.currentValueRow}>
          {saving
            ? <ActivityIndicator size="small" color={IconColors.primary} />
            : <Text style={s.currentValue}>{selected}%</Text>
          }
        </View>
      </View>

      {/* Visual SOC bar */}
      <View style={s.barTrack}>
        <View style={[s.barFill, { width: `${selected}%` }]} />
        {/* Markers at 20% intervals */}
        {[20, 40, 60, 80, 100].map(pct => (
          <View key={pct} style={[s.barMark, { left: `${pct}%` as any }]}>
            <Text style={s.barMarkLabel}>{pct}</Text>
          </View>        ))}
      </View>

      {/* Preset buttons */}
      <Text style={s.presetsLabel}>QUICK SELECT</Text>
      <View style={s.presets}>
        {SOC_PRESETS.map(soc => {
          const isSelected = selected === soc;
          const isRecommended = soc === 80;
          return (
            <TouchableOpacity
              key={soc}
              style={[
                s.preset,
                isSelected && s.presetSelected,
                isRecommended && !isSelected && s.presetRecommended,
              ]}
              onPress={() => handlePresetTap(soc)}
              disabled={saving}
            >
              <Text style={[
                s.presetText,
                isSelected && s.presetTextSelected,
              ]}>
                {soc}%
              </Text>
              {isRecommended && !isSelected && (
                //  Proper icon instead of ● text
                <View style={s.recommendedDot}>
                  <AppIcon.Star size={6} color={IconColors.primary} />
                </View>
              )}
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Custom +/- fine-tune */}
      <View style={s.tuneRow}>
        <Text style={s.tuneLabel}>Fine tune</Text>
        <View style={s.tuneControls}>
          <TouchableOpacity
            style={s.tuneBtn}
            onPress={() => {
              const newVal = Math.max(20, selected - 5);
              setSelected(newVal);
              handleSave(newVal);
            }}
            disabled={saving || selected <= 20}
          >
            <Text style={s.tuneBtnText}>−5%</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={s.tuneBtn}
            onPress={() => {
              const newVal = Math.max(20, selected - 1);
              setSelected(newVal);
              handleSave(newVal);
            }}
            disabled={saving || selected <= 20}
          >
            <Text style={s.tuneBtnText}>−1%</Text>
          </TouchableOpacity>

          <Text style={s.tuneValue}>{selected}%</Text>

          <TouchableOpacity
            style={s.tuneBtn}
            onPress={() => {
              const newVal = Math.min(100, selected + 1);
              setSelected(newVal);
              handleSave(newVal);
            }}
            disabled={saving || selected >= 100}
          >
            <Text style={s.tuneBtnText}>+1%</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={s.tuneBtn}
            onPress={() => {
              const newVal = Math.min(100, selected + 5);
              setSelected(newVal);
              handleSave(newVal);
            }}
            disabled={saving || selected >= 100}
          >
            <Text style={s.tuneBtnText}>+5%</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Battery health tip */}
      {selected === 100 && (
        <View style={s.tip}>
          <View style={s.tipRow}>
            {/*  */}
            <AppIcon.Info size={IconSize.xs} color="#86efac" />
              <Text style={s.tipText}>
                Charging to 100% regularly reduces battery longevity. 80–90% is recommended for daily use.
              </Text>
          </View>
        </View>
      )}

      {isCharging && (
        <Text style={s.sessionNote}>
          Changes apply to your active session immediately.
        </Text>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  card: {
    backgroundColor: '#1e293b',
    borderRadius: 16,
    padding: 18,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#334155',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  title: { color: '#f1f5f9', fontSize: 16, fontWeight: '700' },
  sub:   { color: '#64748b', fontSize: 12, marginTop: 2 },
  activeBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: '#0c4a6e',
    borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4,
    borderWidth: 1, borderColor: '#22d3ee',
  },
  activeDot: {
    width: 6, height: 6, borderRadius: 3,
    backgroundColor: '#22d3ee',
  },
  activeText: { color: '#22d3ee', fontSize: 11, fontWeight: '600' },
  // Current value
  currentRow: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'center', marginBottom: 12,
  },
  currentLabel:    { color: '#64748b', fontSize: 13 },
  currentValueRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  currentValue:    { color: '#22d3ee', fontSize: 28, fontWeight: '800' },

  // SOC bar
  barTrack: {
    height: 8,
    backgroundColor: '#0f172a',
    borderRadius: 4,
    marginBottom: 20,
    position: 'relative',
    overflow: 'visible',
  },
  barFill: {
    height: 8,
    backgroundColor: '#22d3ee',
    borderRadius: 4,
    position: 'absolute',
    left: 0, top: 0,
  },
  barMark: {
    position: 'absolute',
    top: 12,
    transform: [{ translateX: -6 }],
  },
  barMarkLabel: { color: '#334155', fontSize: 9, fontFamily: 'monospace' },

  // Presets
  presetsLabel: {
    color: '#475569', fontSize: 10, fontWeight: '700',
    letterSpacing: 1, textTransform: 'uppercase',
    marginBottom: 10,
  },
  presets: {
    flexDirection: 'row', flexWrap: 'wrap', gap: 8,
    marginBottom: 16,
  },
  preset: {
    paddingHorizontal: 14, paddingVertical: 8,
    backgroundColor: '#0f172a',
    borderRadius: 8,
    borderWidth: 1, borderColor: '#334155',
    alignItems: 'center',
  },
  presetSelected: {    backgroundColor: '#22d3ee',
    borderColor: '#22d3ee',
  },
  presetRecommended: {
    borderColor: '#0e7490',
  },
  presetText: { color: '#94a3b8', fontSize: 13, fontWeight: '600' },
  presetTextSelected: { color: '#0f172a' },
  recommendedDot: {
    marginTop: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Fine tune
  tuneRow: {
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  tuneLabel:    { color: '#64748b', fontSize: 12 },
  tuneControls: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  tuneBtn: {
    backgroundColor: '#0f172a',
    borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6,
    borderWidth: 1, borderColor: '#334155',
  },
  tuneBtnText: { color: '#94a3b8', fontSize: 12, fontWeight: '600' },
  tuneValue:   { color: '#f1f5f9', fontSize: 16, fontWeight: '800',
                 minWidth: 48, textAlign: 'center' },

  // Tips
  tip: {
    backgroundColor: '#0c2a1a',
    borderRadius: 8, padding: 10,
    borderWidth: 1, borderColor: '#166534',
    marginBottom: 10,
  },
  tipRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 6,
  },
  tipText: { color: '#86efac', fontSize: 12, lineHeight: 18, flex: 1 },
  sessionNote: {
    color: '#22d3ee', fontSize: 12, textAlign: 'center',
    marginTop: 4,
  },
});