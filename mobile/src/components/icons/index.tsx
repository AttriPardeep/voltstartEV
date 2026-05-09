// src/components/icons/index.tsx
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import {
  //  Battery & Charging
  Zap, Battery, BatteryCharging, BatteryFull, BatteryMedium, BatteryLow,
  Plug, PlugZap, Power,
  //  Payment & Wallet
  Wallet, CreditCard, IndianRupee, DollarSign,
  //  User & Fleet
  User, Building2, Building, CarFront, Van,
  // ️ Status & Alerts
  TriangleAlert, AlertCircle, CheckCircle, CircleX, Info,  
  // ️ Navigation & Map
  MapPin, Navigation, Home, TrendingUp, Clock,
  // ️ UI Actions
  RefreshCw, Plus, Minus, X, SquarePen, Trash2,  
  Filter, Search, List, Settings, ChevronRight, ChevronLeft,
  //  Auth & Security
  Shield, Lock, Eye, EyeOff, LogOut,
  //  Communication
  Bell, Phone, Mail,
  //  Connectivity
  Wifi, WifiOff,
  //  Misc
  Star, Target, Gauge, Activity,
} from 'lucide-react-native';

// ── Centralized Color Palette ──────────────────────────
/**
 * VoltStartEV brand colors for icons.
 * 
 * TODO: Replace with theme context integration for dark mode:
 *   const { colors } = useTheme();
 *   color = props.color || colors[defaultColorKey];
 */
export const IconColors = {
  primary: '#22d3ee',  // Cyan - charging, active states
  success: '#10b981',  // Green - completed, positive
  warning: '#f59e0b',  // Amber - caution, target SOC
  error:   '#ef4444',  // Red - errors, blocked
  info:    '#3b82f6',  // Blue - informational
  muted:   '#64748b',  // Gray - secondary, inactive
  purple:  '#a78bfa',  // Purple - cards, premium
  font:    '#f1f5f9',  // Light grayish blue (white)
  selected:'#ffd700',
} as const;

export type IconColorKey = keyof typeof IconColors;

// ── Types ─────────────────────────────────────────────
export type IconProps = {
  size?: number;
  color?: string;
  strokeWidth?: number;
  accessibilityLabel?: string;
  testID?: string;
};

type IconComponent = React.ComponentType<IconProps>;

// ── Factory ───────────────────────────────────────────
/**
 * Creates a consistent icon component with default props.
 * @param Component - The lucide-react-native icon component
 * @param defaultColor - Default color key from IconColors or hex value
 * @returns A reusable icon component with sensible defaults
 */
export function createIcon(
  Component: IconComponent,
  defaultColor: string = IconColors.muted
): React.FC<IconProps> {
  return ({
    size = 20,
    color = defaultColor,
    strokeWidth = 2,
    accessibilityLabel,
    testID,
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
  );
}

// ── Size Constants ────────────────────────────────────
export const IconSize = {
  xs:   12,   // Inside small badges (fontSize 10-11)
  sm:   16,   // Inline with body text (fontSize 13-14)
  md:   20,   // Standard UI icons (fontSize 15-16)
  lg:   24,   // Section headers (fontSize 18-20)
  xl:   32,   // Empty state illustrations
  xxl:  48,   // Hero icons
} as const;

export type IconSizeKey = keyof typeof IconSize;

// ── All App Icons with Brand Defaults ─────────────────
/**
 * Centralized, frozen icon library for VoltStartEV.
 * 
 * Usage:
 *   <AppIcon.Zap size={24} />
 *   <AppIcon.Wallet color={IconColors.success} />
 * 
 * Colors reference IconColors constants for easy theming.
 */
export const AppIcon = Object.freeze({  
  //  Battery & Charging
  Battery:          createIcon(Battery,          IconColors.muted),
  BatteryCharging:  createIcon(BatteryCharging,  IconColors.primary),
  BatteryFull:      createIcon(BatteryFull,      IconColors.success),
  BatteryMedium:    createIcon(BatteryMedium,    IconColors.warning),
  BatteryLow:       createIcon(BatteryLow,       IconColors.error),
  Zap:              createIcon(Zap,              IconColors.primary),
  Plug:             createIcon(Plug,             IconColors.primary),
  PlugZap:          createIcon(PlugZap,          IconColors.success),
  Power:            createIcon(Power,            IconColors.error),
  
  //  Payment & Wallet
  Wallet:           createIcon(Wallet,           IconColors.primary),
  Card:             createIcon(CreditCard,       IconColors.purple),
  Rupee:            createIcon(IndianRupee,      IconColors.success),
  Dollar:           createIcon(DollarSign,       IconColors.success),
  
  //  User & Fleet
  User:             createIcon(User,             IconColors.muted),
  FleetBuilding:    createIcon(Building2,        IconColors.primary),
  Building:         createIcon(Building,         IconColors.muted),
  Car:              createIcon(CarFront,         IconColors.primary),
  Van:              createIcon(Van,              IconColors.primary),
  
  // ️ Status & Alerts
  Success:          createIcon(CheckCircle,      IconColors.success),
  Error:            createIcon(CircleX,          IconColors.error),  
  Warning:          createIcon(TriangleAlert,    IconColors.warning),
  Info:             createIcon(Info,             IconColors.info),
  AlertCircle:      createIcon(AlertCircle,      IconColors.error),
  
  //  Navigation & Map
  Location:         createIcon(MapPin,           IconColors.primary),
  Navigation:       createIcon(Navigation,       IconColors.primary),
  Home:             createIcon(Home,             IconColors.muted),
  TrendingUp:       createIcon(TrendingUp,       IconColors.success),
  Clock:            createIcon(Clock,            IconColors.warning),
  
  //  UI Actions
  Refresh:          createIcon(RefreshCw,        IconColors.muted),
  Plus:             createIcon(Plus,             IconColors.primary),
  Minus:            createIcon(Minus,            IconColors.muted),
  Close:            createIcon(X,                IconColors.muted),
  Edit:             createIcon(SquarePen,        IconColors.muted),  // ✅ SquarePen
  Delete:           createIcon(Trash2,           IconColors.error),
  Filter:           createIcon(Filter,           IconColors.muted),
  Search:           createIcon(Search,           IconColors.muted),
  List:             createIcon(List,             IconColors.muted),
  Settings:         createIcon(Settings,         IconColors.muted),
  ChevronRight:     createIcon(ChevronRight,     IconColors.muted),
  ChevronLeft:      createIcon(ChevronLeft,      IconColors.muted),
  
  //  Auth & Security
  Lock:             createIcon(Lock,             IconColors.muted),
  Shield:           createIcon(Shield,           IconColors.success),
  Eye:              createIcon(Eye,              IconColors.muted),
  EyeOff:           createIcon(EyeOff,           IconColors.muted),
  LogOut:           createIcon(LogOut,           IconColors.error),
  
  //  Communication
  Bell:             createIcon(Bell,             IconColors.primary),
  Phone:            createIcon(Phone,            IconColors.muted),
  Mail:             createIcon(Mail,             IconColors.muted),
  
  //  Connectivity
  Wifi:             createIcon(Wifi,             IconColors.success),
  WifiOff:          createIcon(WifiOff,          IconColors.error),
  
  //  Misc
  Star:             createIcon(Star,             IconColors.warning),
  Target:           createIcon(Target,           IconColors.primary),
  Gauge:            createIcon(Gauge,            IconColors.primary),
  Activity:         createIcon(Activity,         IconColors.primary),
});

// ── Reusable Composed Components ──────────────────────

/**
 * IconBadge — Displays an icon + label side-by-side in a pill-shaped badge.
 * 
 * @example
 * <IconBadge icon={AppIcon.Zap} label="App Tag" />
 * 
 * @param icon - An icon from AppIcon (e.g., AppIcon.Zap)
 * @param label - Text to display next to the icon
 * @param color - Text and icon color (default: brand primary)
 * @param background - Badge background color (default: dark cyan)
 * @param size - Icon size (default: IconSize.xs = 12px)
 */
export function IconBadge({
  icon: Icon,
  label,
  color      = IconColors.primary,
  background = '#0c4a6e',
  size       = IconSize.xs,
  accessibilityLabel,
  testID,
}: {
  icon:        React.FC<IconProps>;
  label:       string;
  color?:      string;
  background?: string;
  size?:       number;
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

const ib = StyleSheet.create({
  badge: {
    flexDirection:  'row',
    alignItems:     'center',
    gap:            4,
    borderRadius:   20,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  label: {
    fontSize:   11,
    fontWeight: '700',
    includeFontPadding: false,
  },
});

/**
 * IconRow — Displays an icon + text in a horizontal row.
 * Ideal for section headers, list items, and navigation labels.
 * 
 * @example
 * <IconRow icon={AppIcon.Car} label="My Vehicles" fontSize={18} />
 * 
 * @param icon - An icon from AppIcon
 * @param label - Text to display next to the icon
 * @param color - Text color (icon uses same color unless iconColor overridden)
 * @param iconColor - Optional: override icon color separately
 * @param size - Icon size (default: IconSize.md = 20px)
 * @param gap - Space between icon and text (default: 8px)
 * @param fontSize - Text font size (default: 16px)
 * @param fontWeight - Text font weight (default: '700')
 */
export function IconRow({
  icon: Icon,
  label,
  color     = '#f1f5f9',
  iconColor,
  size      = IconSize.md,
  gap       = 8,
  fontSize  = 16,
  fontWeight = '700' as const,
  accessibilityLabel,
  testID,
}: {
  icon:        React.FC<IconProps>;
  label:       string;
  color?:      string;
  iconColor?:  string;
  size?:       number;
  gap?:        number;
  fontSize?:   number;
  fontWeight?: '400' | '600' | '700' | '800';
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
      <Text style={[ir.label, { color, fontSize, fontWeight }]}>
        {label}
      </Text>
    </View>
  );
}

const ir = StyleSheet.create({
  row:   { flexDirection: 'row', alignItems: 'center' },
  label: { includeFontPadding: false },
});

// ── Exports ───────────────────────────────────────────
// ✅ Only export createIcon (IconProps already exported inline above)
export { createIcon };