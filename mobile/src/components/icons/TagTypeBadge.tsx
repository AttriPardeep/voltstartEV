import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { AppIcon } from '../components/icons';

// ── Tag Type Configuration ─────────────────────────────────────
const TAG_TYPE_CONFIG: Record<string, { label: string; Icon: any; color: string }> = {
  system:        { label: 'App Tag',     Icon: AppIcon.Zap,           color: '#22d3ee' },
  external_rfid: { label: 'RFID Card',   Icon: AppIcon.Card,          color: '#a78bfa' },
  fleet:         { label: 'Fleet Tag',   Icon: AppIcon.FleetBuilding, color: '#22d3ee' },
};

export const getTagTypeInfo = (type: string) => {
  return TAG_TYPE_CONFIG[type] || { label: type, Icon: AppIcon.Info, color: '#64748b' };
};

// ── Reusable Badge Component ───────────────────────────────────
interface TagTypeBadgeProps {
  type: string;
  size?: number;
  style?: any;
}

export function TagTypeBadge({ type, size = 12, style }: TagTypeBadgeProps) {
  const { label, Icon, color } = getTagTypeInfo(type);
  
  return (
    <View style={[styles.badge, style]}>
      <View style={styles.badgeContent}>
        <Icon size={size} color={color} />
        <Text style={[styles.badgeText, { color }]}>{label}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    backgroundColor: '#0f172a',
    borderRadius: 12,
    paddingHorizontal: 6,
    paddingVertical: 3,
    alignSelf: 'flex-start',
  },
  badgeContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '600',
    lineHeight: 14,
  },
});