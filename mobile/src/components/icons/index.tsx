// src/components/icons/index.tsx
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import {
  //  Battery & Charging
  Zap, CreditCard, Building2, User, Wallet, CarFront,
  BatteryCharging, Battery, BatteryFull, BatteryMedium, BatteryLow,
  // ️ Status & Alerts
  TriangleAlert, CheckCircle, XCircle, AlertCircle, Info,
  // ️ Navigation & Map
  TrendingUp, MapPin, RefreshCw, Clock, Shield, Star,
  //  Communication
  Bell, Settings, ChevronRight, Plus, X, Edit2, Trash2,
  Navigation, Filter, Search, LogOut, Lock, Eye, EyeOff,
  //  Connectivity
  Wifi, WifiOff, Plug, PlugZap, Gauge, IndianRupee, Home,
  //  Additional icons for dynamic system
  CircleX, SquarePen, Target, Activity, DollarSign,
} from 'lucide-react-native';

// ── Types ─────────────────────────────────────────────
type LucideIcon = React.ComponentType<{
  size?: number;
  color?: string;
  strokeWidth?: number;
  accessibilityLabel?: string;
  testID?: string;
}>;

export type IconProps = {
  size?: number;
  color?: string;
  strokeWidth?: number;
  accessibilityLabel?: string;
  testID?: string;
};

// ── Factory ──────────────────────────────────────────────
/**
* Creates a consistent icon component with default props.
* @param Component - The lucide-react-native icon component
* @param defaultColor - Default color if not overridden
* @returns A memoized, reusable icon component
*/
function createIcon(Component: LucideIcon, defaultColor = '#64748B') {
  return React.memo(({
    size = 20,
    color = defaultColor,
    strokeWidth = 2,
    accessibilityLabel,    testID,
    ...props
  }: IconProps) => (
    <Component
      size={size}
      color={color}
      strokeWidth={strokeWidth}
      accessibilityLabel={accessibilityLabel}
      testID={testID}
      {...props}
    />
  ), (prev, next) =>
    prev.size === next.size &&
    prev.color === next.color &&
    prev.strokeWidth === next.strokeWidth
  );
}

// ── Brand colour palette ─────────────────────────────────
/**
* VoltStartEV brand colors for icons.
*
* TODO: Integrate with theme context for dark mode:
*   const { colors } = useTheme();
*   color = props.color || colors[defaultColorKey];
*/
export const IconColors = {
  primary: '#22D3EE',   // teal  — charging, active, primary action
  success: '#10B981',   // green — available, success, healthy
  warning: '#F59E0B',   // amber — low battery, slow charge, caution
  error:   '#EF4444',   // red   — faulted, blocked, error
  purple:  '#A78BFA',   // purple— reserved, RFID card
  muted:   '#64748B',   // slate — inactive, secondary
  sub:     '#94A3B8',   // lighter slate — labels
  font:    '#f1f5f9',  // Light grayish blue (white)
  selected:'#ffd700',
} as const;

export type IconColorKey = keyof typeof IconColors;

// ── Size scale ───────────────────────────────────────────
export const IconSize = {
  xs:  12,  // badge interiors (fontSize 10-11)
  sm:  16,  // inline body text (fontSize 13-14)
  md:  20,  // standard UI icons (fontSize 15-16)
  lg:  24,  // section headers (fontSize 18-20)
  xl:  32,  // empty state illustrations
  xxl: 48,  // hero icons
} as const;

export type IconSizeKey = keyof typeof IconSize;
// ── All app icons (STATIC) ───────────────────────────────
/**
* Centralized, frozen icon library for VoltStartEV.
*
* Usage:
*   <AppIcon.Zap size={24} />
*   <AppIcon.Wallet color={IconColors.success} />
*
* Colors reference IconColors constants for easy theming.
*
*  For real-time values, use DynamicIcons instead:
*   import { DynamicBatteryIcon } from '../components/icons';
*   <DynamicBatteryIcon soc={45} charging={true} />
*/
export const AppIcon = Object.freeze({
  //  Battery & Charging
  Zap:             createIcon(Zap,             IconColors.primary),
  Plug:            createIcon(Plug,            IconColors.muted),
  PlugZap:         createIcon(PlugZap,         IconColors.warning),
  BatteryCharging: createIcon(BatteryCharging, IconColors.primary),
  Battery:         createIcon(Battery,         IconColors.muted),
  BatteryFull:     createIcon(BatteryFull,     IconColors.success),
  BatteryMedium:   createIcon(BatteryMedium,   IconColors.warning),
  BatteryLow:      createIcon(BatteryLow,      IconColors.error),
 
  //  Payment & Wallet
  Wallet:          createIcon(Wallet,          IconColors.primary),
  Card:            createIcon(CreditCard,      IconColors.purple),
  Rupee:           createIcon(IndianRupee,     IconColors.success),
  Dollar:          createIcon(DollarSign,      IconColors.success),
 
  //  User & Fleet
  User:            createIcon(User,            IconColors.muted),
  FleetBuilding:   createIcon(Building2,       IconColors.primary),
  Building:        createIcon(Building2,       IconColors.muted),
  Car:             createIcon(CarFront,        IconColors.primary),
  Van:             createIcon(CarFront,        IconColors.primary),
 
  // ️ Status & Alerts
  Success:         createIcon(CheckCircle,     IconColors.success),
  Error:           createIcon(CircleX,         IconColors.error),  // Updated from XCircle
  Warning:         createIcon(TriangleAlert,   IconColors.warning),
  Info:            createIcon(Info,            '#3B82F6'),
  AlertCircle:     createIcon(AlertCircle,     IconColors.error),
 
  // ️ Navigation & Map
  Location:        createIcon(MapPin,          IconColors.primary),
  Navigation:      createIcon(Navigation,      IconColors.primary),
  Home:            createIcon(Home,            IconColors.muted),
  TrendingUp:      createIcon(TrendingUp,      IconColors.success), 
  // ️ UI Actions
  Refresh:         createIcon(RefreshCw,       IconColors.muted),
  Plus:            createIcon(Plus,            IconColors.primary),
  Minus:           createIcon(X,               IconColors.muted),  // X used as minus
  Close:           createIcon(X,               IconColors.muted),
  Edit:            createIcon(SquarePen,       IconColors.muted),  // Updated from Edit2
  Delete:          createIcon(Trash2,          IconColors.error),
  Filter:          createIcon(Filter,          IconColors.muted),
  Search:          createIcon(Search,          IconColors.muted),
  Settings:        createIcon(Settings,        IconColors.muted),
  ChevronRight:    createIcon(ChevronRight,    IconColors.muted),
  ChevronLeft:     createIcon(ChevronRight,    IconColors.muted),  // Rotate via transform if needed
  List:            createIcon(CarFront,        IconColors.muted),  // Placeholder; replace with actual List icon if available
 
  //  Auth & Security
  Lock:            createIcon(Lock,            IconColors.muted),
  Shield:          createIcon(Shield,          IconColors.success),
  Eye:             createIcon(Eye,             IconColors.muted),
  EyeOff:          createIcon(EyeOff,          IconColors.muted),
  LogOut:          createIcon(LogOut,          IconColors.error),
 
  //  Communication
  Bell:            createIcon(Bell,            IconColors.primary),
 
  //  Connectivity
  Wifi:            createIcon(Wifi,            IconColors.success),
  WifiOff:         createIcon(WifiOff,         IconColors.error),
 
  //  Misc
  Clock:           createIcon(Clock,           IconColors.warning),
  Star:            createIcon(Star,            '#F59E0B'),
  Gauge:           createIcon(Gauge,           IconColors.muted),
  Activity:        createIcon(Activity,        IconColors.primary),
  Target:          createIcon(Target,          IconColors.primary),
});

// ── Composed helper components (STATIC) ──────────────────
/**
* IconBadge — icon + label pill
* Use for: Primary badge, Blocked badge, Tag type labels
*
* @example
* <IconBadge icon={AppIcon.Star} label="Primary" />
*/
export function IconBadge({
  icon: Icon,
  label,
  color = IconColors.primary,
  background = '#0C4A6E',  size = IconSize.xs,
  accessibilityLabel,
  testID,
}: {
  icon: React.FC<IconProps>;
  label: string;
  color?: string;
  background?: string;
  size?: number;
  accessibilityLabel?: string;
  testID?: string;
}) {
  return (
    <View
      style={[ib.badge, { backgroundColor: background }]}
      accessibilityLabel={accessibilityLabel || label}
      testID={testID}
    >
      <Icon size={size} color={color} />
      <Text style={[ib.label, { color }]}>{label}</Text>
    </View>
  );
}

/**
* IconRow — icon + text row
* Use for: Section headers, list items, nav items
*
* @example
* <IconRow icon={AppIcon.Car} label="My Vehicles" />
*/
export function IconRow({
  icon: Icon,
  label,
  color = '#F1F5F9',
  iconColor,
  size = IconSize.md,
  gap = 8,
  fontSize = 16,
  fontWeight = '700' as const,
  accessibilityLabel,
  testID,
}: {
  icon: React.FC<IconProps>;
  label: string;
  color?: string;
  iconColor?: string;
  size?: number;
  gap?: number;
  fontSize?: number;  fontWeight?: '400'|'600'|'700'|'800';
  accessibilityLabel?: string;
  testID?: string;
}) {
  return (
    <View
      style={[ir.row, { gap }]}
      accessibilityLabel={accessibilityLabel || label}
      testID={testID}
    >
      <Icon size={size} color={iconColor ?? color} />
      <Text style={[ir.label, { color, fontSize, fontWeight }]}>{label}</Text>
    </View>
  );
}

const ib = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 4
  },
  label: {
    fontSize: 11,
    fontWeight: '700',
    includeFontPadding: false,
  },
});

const ir = StyleSheet.create({
  row:   { flexDirection: 'row', alignItems: 'center' },
  label: { includeFontPadding: false },
});

// ── Dynamic Icons (RE-EXPORT) ────────────────────────────
/**
* Dynamic icons that change appearance based on live values.
* All components are React.memo'd with custom comparators for performance.
*
* Map Marker Warning:
* Do NOT use DynamicStatusIcon inside <Marker> components.
* Use pure View-based icons (like BoltIcon) for map markers instead.
* Dynamic icons are safe for modals, lists, and regular UI.
*
* @example
* import { DynamicBatteryIcon } from '../components/icons';
* <DynamicBatteryIcon soc={45} charging={true} /> */
export {
  DynamicBatteryIcon,
  DynamicPowerIcon,
  DynamicCostIcon,
  DynamicStatusIcon,
  DynamicConnectivityIcon,
  DynamicEfficiencyIcon,
} from './DynamicIcons';

// ── Exports Summary ──────────────────────────────────────
/**
* Exported from this module:
*
* STATIC (always available):
* - AppIcon: { Zap, Battery, Wallet, ... } — all static icons
* - IconColors: { primary, success, warning, ... } — brand colors
* - IconSize: { xs, sm, md, lg, xl, xxl } — size constants
* - IconBadge: icon + label pill component
* - IconRow: icon + text row component
* - createIcon: factory function (advanced use)
*
* DYNAMIC (opt-in for real-time values):
* - DynamicBatteryIcon: changes with SOC %
* - DynamicPowerIcon: changes with kW level
* - DynamicCostIcon: changes with cost vs budget
* - DynamicStatusIcon: changes with charger state (modal/list only)
* - DynamicConnectivityIcon: changes with data freshness
* - DynamicEfficiencyIcon: changes with efficiency %
*
* TYPES:
* - IconProps: shared props interface
* - IconColorKey: keys for IconColors
* - IconSizeKey: keys for IconSize
*/
export type { IconProps, IconColorKey, IconSizeKey };
export { createIcon }; 