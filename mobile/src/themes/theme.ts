// src/theme/theme.ts
import { Dimensions } from 'react-native';

export type ThemeMode = 'dark' | 'light' | 'auto';

export interface ThemeColors {
  // Backgrounds
  bg: string;
  bgSecondary: string;
  card: string;
  cardElevated: string;
  
  // Text
  text: string;
  textSecondary: string;
  textMuted: string;
  textInverse: string;
  
  // Borders
  border: string;
  borderLight: string;
  
  // Accent colors
  accent: string;
  accentBright: string;
  accentDark: string;
  
  // Semantic colors
  success: string;
  successBright: string;
  warning: string;
  warningBright: string;
  error: string;
  errorBright: string;
  info: string;
  
  // Chart colors
  chartLine: string;
  chartFill: string;
  chartFillGradient: string;
  chartGrid: string;
  chartLabel: string;
  
  // Specific metrics
  power: string;
  energy: string;
  cost: string;
  voltage: string;
  current: string;
  soc: string;
}

export const themes: Record<'dark' | 'light', ThemeColors> = {
  // 🌙 NIGHT MODE (Default)
  dark: {
    bg: '#0a0f1e',
    bgSecondary: '#0f172a',
    card: '#1e293b',
    cardElevated: '#334155',
    
    text: '#ffffff',
    textSecondary: '#e2e8f0',
    textMuted: '#94a3b8',
    textInverse: '#0f172a',
    
    border: '#334155',
    borderLight: '#475569',
    
    accent: '#22d3ee',
    accentBright: '#67e8f9',
    accentDark: '#0891b2',
    
    success: '#34d399',
    successBright: '#6ee7b7',
    warning: '#fbbf24',
    warningBright: '#fcd34d',
    error: '#f87171',
    errorBright: '#fca5a5',
    info: '#60a5fa',
    
    chartLine: '#22d3ee',
    chartFill: 'rgba(34, 211, 238, 0.15)',
    chartFillGradient: 'rgba(34, 211, 238, 0.05)',
    chartGrid: '#334155',
    chartLabel: '#64748b',
    
    power: '#34d399',
    energy: '#67e8f9',
    cost: '#c084fc',
    voltage: '#f87171',
    current: '#fbbf24',
    soc: '#60a5fa',
  },
  
  // ☀️ DAY MODE (High contrast for sunlight)
  light: {
    bg: '#f1f5f9',
    bgSecondary: '#f8fafc',
    card: '#ffffff',
    cardElevated: '#ffffff',
    
    text: '#0f172a',
    textSecondary: '#1e293b',
    textMuted: '#64748b',
    textInverse: '#ffffff',
    
    border: '#cbd5e1',
    borderLight: '#e2e8f0',
    
    accent: '#0891b2',
    accentBright: '#06b6d4',
    accentDark: '#0e7490',
    
    success: '#059669',
    successBright: '#34d399',
    warning: '#d97706',
    warningBright: '#fbbf24',
    error: '#dc2626',
    errorBright: '#f87171',
    info: '#2563eb',
    
    chartLine: '#0891b2',
    chartFill: 'rgba(8, 145, 178, 0.1)',
    chartFillGradient: 'rgba(8, 145, 178, 0.05)',
    chartGrid: '#e2e8f0',
    chartLabel: '#94a3b8',
    
    power: '#059669',
    energy: '#0891b2',
    cost: '#7c3aed',
    voltage: '#dc2626',
    current: '#d97706',
    soc: '#2563eb',
  },
};

export const getTheme = (mode: ThemeMode, isDark?: boolean): ThemeColors => {
  if (mode === 'auto') {
    return isDark ? themes.dark : themes.light;
  }
  return themes[mode];
};

export const SCREEN_W = Dimensions.get('window').width;
export const SCREEN_H = Dimensions.get('window').height;