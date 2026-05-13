// src/components/icons/DynamicIcons.tsx
import React, { useRef, useEffect } from 'react';
import { Animated } from 'react-native';
import { AppIcon, IconColors, IconSize } from './index';

// ── DynamicBatteryIcon ───────────────────────────────────
// Changes icon type AND color based on SOC %
// charging=true forces BatteryCharging regardless of SOC
export const DynamicBatteryIcon = React.memo(({
  soc, size = IconSize.md, charging = false
}: { soc?: number | null; size?: number; charging?: boolean }) => {
  if (soc == null) return <AppIcon.Battery size={size} color={IconColors.muted} />;
  if (charging)      return <AppIcon.BatteryCharging size={size} color={IconColors.primary} />;
  if (soc >= 95)    return <AppIcon.BatteryFull   size={size} color={IconColors.success} />;
  if (soc >= 40)    return <AppIcon.BatteryMedium size={size} color={IconColors.warning} />;
  return              <AppIcon.BatteryLow    size={size} color={IconColors.error} />;
}, (prev, next) =>
  prev.soc === next.soc && prev.charging === next.charging && prev.size === next.size
);

// ── DynamicPowerIcon ─────────────────────────────────────
// Changes color based on power tier (kW)
// Mirrors the tiered pricing tiers: <7, 7-22, 22-50, 50-150, 150+
export const DynamicPowerIcon = React.memo(({
  powerKw, size = IconSize.md
}: { powerKw?: number | null; size?: number }) => {
  if (powerKw == null || powerKw <= 0)
    return <AppIcon.Plug size={size} color={IconColors.muted} />;
  if (powerKw >= 150)
    return <AppIcon.Zap size={size} color={'#F43F5E'} />;   // rose — HPC
  if (powerKw >= 50)
    return <AppIcon.Zap size={size} color={IconColors.primary} />; // teal — DC fast
  if (powerKw >= 22)
    return <AppIcon.Zap size={size} color={IconColors.success} />; // green — AC fast
  return <AppIcon.PlugZap size={size} color={IconColors.warning} />; // amber — slow AC
}, (prev, next) => prev.powerKw === next.powerKw && prev.size === next.size);

// ── DynamicCostIcon ──────────────────────────────────────
// Changes color based on cost vs optional budget ceiling
export const DynamicCostIcon = React.memo(({
  cost, budget, size = IconSize.md
}: { cost?: number | null; budget?: number | null; size?: number }) => {
  if (cost == null) return <AppIcon.Rupee size={size} color={IconColors.muted} />;
  if (budget != null && budget > 0) {
    const pct = (cost / budget) * 100;
    if (pct >= 90) return <AppIcon.Rupee size={size} color={IconColors.error} />;
    if (pct >= 70) return <AppIcon.Rupee size={size} color={IconColors.warning} />;
  }
  return <AppIcon.Rupee size={size} color={IconColors.success} />;
}, (prev, next) =>
  prev.cost === next.cost && prev.budget === next.budget && prev.size === next.size
);

// ── DynamicStatusIcon ────────────────────────────────────
// USE IN MODALS/LISTS ONLY — never inside <Marker>
// Map markers use BoltIcon (pure View) instead
export const DynamicStatusIcon = React.memo(({
  status, isReserved = false, size = IconSize.md
}: { status?: string | null; isReserved?: boolean; size?: number }) => {
  if (isReserved) return <AppIcon.Clock size={size} color={IconColors.purple} />;
  switch (status) {
    case 'Available': return <AppIcon.Success size={size} color={IconColors.success} />;
    case 'Busy':
    case 'Charging':  return <AppIcon.Clock   size={size} color={IconColors.warning} />;
    case 'Faulted':
    case 'Unavailable': return <AppIcon.Error size={size} color={IconColors.error} />;
    case 'Offline': return <AppIcon.WifiOff size={size} color={IconColors.muted} />;
    default:        return <AppIcon.Info    size={size} color={IconColors.muted} />;
  }
}, (prev, next) =>
  prev.status === next.status && prev.isReserved === next.isReserved && prev.size === next.size
);

// ── DynamicConnectivityIcon ──────────────────────────────
// Green = live (<10s), Amber = slightly stale (10-30s), Red = stale/offline (>30s)
export const DynamicConnectivityIcon = React.memo(({
  connected, lastUpdateSeconds, size = IconSize.md
}: { connected: boolean; lastUpdateSeconds?: number | null; size?: number }) => {
  if (!connected || (lastUpdateSeconds != null && lastUpdateSeconds > 30))
    return <AppIcon.WifiOff size={size} color={IconColors.error} />;
  if (lastUpdateSeconds != null && lastUpdateSeconds > 10)
    return <AppIcon.Wifi size={size} color={IconColors.warning} />;
  return <AppIcon.Wifi size={size} color={IconColors.success} />;
}, (prev, next) =>
  prev.connected === next.connected &&
  prev.lastUpdateSeconds === next.lastUpdateSeconds &&
  prev.size === next.size
);

// ── DynamicEfficiencyIcon ────────────────────────────────
// Green ≥95% | Teal ≥88% | Amber ≥80% | Red <80%
export const DynamicEfficiencyIcon = React.memo(({
  efficiencyPct, size = IconSize.md
}: { efficiencyPct?: number | null; size?: number }) => {
  if (efficiencyPct == null) return <AppIcon.Gauge size={size} color={IconColors.muted} />;
  if (efficiencyPct >= 95)  return <AppIcon.Success size={size} color={IconColors.success} />;
  if (efficiencyPct >= 88)  return <AppIcon.Success size={size} color={IconColors.primary} />;
  if (efficiencyPct >= 80)  return <AppIcon.Info    size={size} color={IconColors.warning} />;
  return                      <AppIcon.Warning  size={size} color={IconColors.error} />;
}, (prev, next) =>
  prev.efficiencyPct === next.efficiencyPct && prev.size === next.size
);