// src/screens/SessionScreen.tsx
import React, { useEffect, useState, useRef, useMemo, useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Alert,
  ActivityIndicator, ScrollView, Dimensions, Animated,
  RefreshControl
} from 'react-native';
import { useTheme } from '../themes/ThemeContext';
import { PowerChart } from '../components/PowerChart';
import * as Haptics from 'expo-haptics';
import { useSessionStore } from '../store/sessionStore';
import { useAuthStore } from '../store/authStore';


const SCREEN_W = Dimensions.get('window').width;

// ─── Utilities ────────────────────────────────────────
const fmt = (v: number | null | undefined, d = 2): string =>
  v == null || !isFinite(v) ? '—' : v.toFixed(d);

function formatTime(s: number): string {
  const h = Math.floor(s / 3600).toString().padStart(2, '0');
  const m = Math.floor((s % 3600) / 60).toString().padStart(2, '0');
  const sec = (s % 60).toString().padStart(2, '0');
  return `${h}:${m}:${sec}`;
}

function formatDuration(s: number): string {
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${sec}s`;
  return `${sec}s`;
}

function parseSessionTime(raw: string | null | undefined): number | null {
  if (!raw) return null;
  const iso = raw.includes('T') ? raw : raw.replace(' ', 'T') + 'Z';
  const t = new Date(iso).getTime();
  return isNaN(t) ? null : t;
}

interface SessionSummary {
  chargeBoxId: string;
  duration: number;
  energyKwh: number;
  costTotal: number;
  peakPowerKw: number;
  startSoc?: number;
  endSoc?: number;
}

// ─── Stat Row ─────────────────────────────────────────
const StatRow = React.memo(({ left, right, theme }: {
  left: { icon: string; label: string; value: string; color: string };
  right?: { icon: string; label: string; value: string; color: string };
  theme: any;
}) => (
  <View style={[stat.row, { borderBottomColor: theme.border }]}>
    <View style={stat.cell}>
      <Text style={stat.icon}>{left.icon}</Text>
      <View>
        <Text style={[stat.label, { color: theme.textMuted }]}>{left.label}</Text>
        <Text style={[stat.value, { color: left.color }]}>{left.value}</Text>
      </View>
    </View>
    {right && (
      <View style={[stat.cell, stat.right, { borderLeftColor: theme.border }]}>
        <Text style={stat.icon}>{right.icon}</Text>
        <View>
          <Text style={[stat.label, { color: theme.textMuted }]}>{right.label}</Text>
          <Text style={[stat.value, { color: right.color }]}>{right.value}</Text>
        </View>
      </View>
    )}
  </View>
));

// ─── Main Screen ──────────────────────────────────────
export default function SessionScreen() {
  const { theme, outdoorMode, toggleOutdoorMode, brightnessLevel } = useTheme();
  const { activeSession, telemetry, fetchActiveSession, stopSession, isLoading } = useSessionStore();
  const user = useAuthStore(s => s.user);

  const [elapsed, setElapsed] = useState(0);
  const [summary, setSummary] = useState<SessionSummary | null>(null);
  const [powerHistory, setPowerHistory] = useState<number[]>([]);
  const [peakPower, setPeakPower] = useState(0);
  const [startSoc, setStartSoc] = useState<number | undefined>();
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  const progressAnim = useRef(new Animated.Value(0)).current;
  const pendingRef = useRef<number | null>(null);

  // Debounce sparkline updates
  useEffect(() => {
    if (!telemetry) return;
    setLastUpdate(new Date());
    const kw = (telemetry.powerW || 0) / 1000;
    if (kw > peakPower) setPeakPower(kw);
    if (startSoc == null && telemetry.socPercent != null)
      setStartSoc(telemetry.socPercent);

    if (pendingRef.current) clearTimeout(pendingRef.current);
    pendingRef.current = setTimeout(() => {
      setPowerHistory(prev => {
        const next = [...prev, kw];
        return next.length > 20 ? next.slice(-20) : next;
      });
    }, 5000) as any;

    return () => { if (pendingRef.current) clearTimeout(pendingRef.current); };
  }, [telemetry, peakPower, startSoc]);

  useEffect(() => {
    fetchActiveSession();
  }, []);

  // Timer
  useEffect(() => {
    if (!activeSession?.startTime) return;
    const start = parseSessionTime(activeSession.startTime);
    if (!start) return;
    setElapsed(Math.floor((Date.now() - start) / 1000));
    const t = setInterval(() =>
      setElapsed(Math.floor((Date.now() - start) / 1000)), 1000);
    return () => clearInterval(t);
  }, [activeSession?.startTime]);

  // Animated progress bar
  const targetSoc = user?.targetSocPercent || 80;
  const currentSoc = telemetry?.socPercent;
  const progressPct = currentSoc != null
    ? Math.min((currentSoc / targetSoc) * 100, 100) : 0;

  useEffect(() => {
    Animated.timing(progressAnim, {
      toValue: progressPct,
      duration: 600,
      useNativeDriver: false,
    }).start();
  }, [progressPct]);

  const progressWidth = progressAnim.interpolate({
    inputRange: [0, 100],
    outputRange: ['0%', '100%'],
  });

  // Derived values
  const powerKw = isFinite((telemetry?.powerW || 0) / 1000)
    ? (telemetry?.powerW || 0) / 1000 : 0;
  const batteryKwh = user?.batteryCapacityKwh;

  const estimatedMinutes = useMemo(() => {
    if (!batteryKwh || currentSoc == null || powerKw <= 0 || currentSoc >= targetSoc) return null;
    const r = ((targetSoc - currentSoc) / 100 * batteryKwh) / powerKw * 60;
    return isFinite(r) && r > 0 ? Math.round(r) : null;
  }, [batteryKwh, currentSoc, powerKw, targetSoc]);

  // Stop confirmation
  const handleStop = useCallback(() => {
    if (!activeSession) return;
    const energy = telemetry?.energyKwh ?? 0;
    const cost = telemetry?.costSoFar ?? 0;

    Alert.alert(
      'Stop Charging?',
      `⏱  ${formatTime(elapsed)}\n` +
      `⚡  ${fmt(energy, 3)} kWh delivered\n` +
      `💰  ₹${fmt(cost, 2)} charged\n` +
      `🔋  SOC: ${currentSoc ?? '—'}%`,
      [
        { text: 'Continue Charging', style: 'cancel' },
        {
          text: 'Stop', style: 'destructive',
          onPress: async () => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
            try {
              const s: SessionSummary = {
                chargeBoxId: activeSession.chargeBoxId,
                duration: elapsed,
                energyKwh: energy,
                costTotal: cost,
                peakPowerKw: peakPower,
                startSoc,
                endSoc: currentSoc,
              };
              await stopSession(activeSession.sessionId);
              setSummary(s);
              setPowerHistory([]);
              setPeakPower(0);
              setStartSoc(undefined);
            } catch (err: any) {
              Alert.alert('Error', err?.response?.data?.error || err?.message || 'Failed to stop');
            }
          }
        }
      ]
    );
  }, [activeSession, telemetry, elapsed, currentSoc, peakPower, startSoc, stopSession]);

  if (summary) {
    return <SummaryScreen summary={summary} onDismiss={() => setSummary(null)} theme={theme} />;
  }

  if (!activeSession) {
    return (
      <View style={[styles.empty, { backgroundColor: theme.bg }]}>
        <Text style={styles.emptyIcon}>🔌</Text>
        <Text style={[styles.emptyTitle, { color: theme.text }]}>No Active Session</Text>
        <Text style={[styles.emptySub, { color: theme.textMuted }]}>Go to the Map tab to start charging</Text>
        <TouchableOpacity 
          style={[styles.refreshBtn, { backgroundColor: theme.card }]}
          onPress={fetchActiveSession}
        >
          <Text style={[styles.refreshText, { color: theme.accent }]}>↻  Refresh</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const secondsSinceUpdate = lastUpdate ? Math.floor((Date.now() - lastUpdate.getTime()) / 1000) : null;
  const isStale = secondsSinceUpdate != null && secondsSinceUpdate > 30;

  return (
    <View style={[styles.screen, { backgroundColor: theme.bg }]}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={isLoading}
            onRefresh={fetchActiveSession}
            tintColor={theme.accent}
            colors={[theme.accent]}
          />
        }
      >
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.topRow}>
            <View style={[styles.badge, { backgroundColor: theme.success + '20' }]}>
              <View style={[styles.dot, { backgroundColor: theme.success }]} />
              <Text style={[styles.badgeText, { color: theme.success }]}>CHARGING</Text>
            </View>
            
            {/* Outdoor mode toggle */}
            <TouchableOpacity 
              style={[styles.outdoorBtn, { backgroundColor: theme.card, borderColor: theme.border }]}
              onPress={toggleOutdoorMode}
            >
              <Text style={styles.outdoorBtnText}>
                {outdoorMode ? '☀️' : '🌙'}
              </Text>
            </TouchableOpacity>
          </View>

          <Text style={[styles.timer, { color: theme.text }]}>
            {formatTime(elapsed)}
          </Text>

          {isStale && (
            <Text style={[styles.staleText, { color: theme.warning }]}>
              📡 Last update {secondsSinceUpdate}s ago
            </Text>
          )}

          {/* Progress + Est Time */}
          <View style={[styles.progressCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
            <View style={styles.progressHeader}>
              <Text style={[styles.progressLabel, { color: theme.textSecondary }]}>
                {currentSoc != null ? `${currentSoc}%  →  ${targetSoc}%` : `Target: ${targetSoc}%`}
              </Text>
              {estimatedMinutes != null && (
                <Text style={[styles.estTime, { color: theme.accentBright }]}>
                  ⏱ {estimatedMinutes > 60
                    ? `${Math.floor(estimatedMinutes / 60)}h ${estimatedMinutes % 60}m`
                    : `${estimatedMinutes} min`} left
                </Text>
              )}
            </View>
            <View style={[styles.progressBg, { backgroundColor: theme.border }]}>
              <Animated.View style={[styles.progressFill, { width: progressWidth, backgroundColor: theme.accent }]} />
            </View>
          </View>
        </View>

        {/* Stat Rows */}
        <View style={[styles.statsCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
          <StatRow
            theme={theme}
            left={{ icon: '⚡', label: 'Power', value: `${fmt(powerKw)} kW`, color: theme.power }}
            right={{ icon: '🔋', label: 'Energy', value: `${fmt(telemetry?.energyKwh, 3)} kWh`, color: theme.energy }}
          />
          <StatRow
            theme={theme}
            left={{ icon: '💰', label: 'Cost So Far', value: `₹${fmt(telemetry?.costSoFar)}`, color: theme.cost }}
            right={{ icon: '🔋', label: 'Battery SOC', value: currentSoc != null ? `${currentSoc}%` : '—', color: theme.soc }}
          />
          <StatRow
            theme={theme}
            left={{ icon: '🔌', label: 'Voltage', value: `${fmt(telemetry?.voltageV, 0)} V`, color: theme.voltage }}
            right={{ icon: '⚡', label: 'Current', value: `${fmt(telemetry?.currentA, 1)} A`, color: theme.current }}
          />
        </View>

        {/* Professional Chart */}
        <PowerChart data={powerHistory} />
      </ScrollView>

      {/* Stop Button */}
      <View style={[styles.stopWrap, { backgroundColor: theme.bg }]}>
        <TouchableOpacity
          style={[styles.stopBtn, { backgroundColor: theme.error, shadowColor: theme.error }]}
          onPress={handleStop}
          disabled={isLoading}
          testID="stop-button"
          accessibilityLabel={`Stop charging on ${activeSession.chargeBoxId}`}
          accessibilityHint="Double tap to confirm stop"
        >
          {isLoading
            ? <ActivityIndicator color={theme.textInverse} size="large" />
            : <>
                <Text style={styles.stopIcon}>⏹</Text>
                <Text style={[styles.stopText, { color: theme.textInverse }]}>Stop Charging</Text>
              </>
          }
        </TouchableOpacity>
      </View>
    </View>
  );
}

// ─── Summary Screen ───────────────────────────────────
function SummaryScreen({ summary, onDismiss, theme }:
  { summary: SessionSummary; onDismiss: () => void; theme: any }) {
  const costPerKwh = summary.energyKwh > 0 ? (summary.costTotal / summary.energyKwh).toFixed(2) : '—';
  const co2 = (summary.energyKwh * 0.82).toFixed(2);
  const km = (summary.energyKwh * 6).toFixed(0);

  const tips: string[] = [];
  if (summary.peakPowerKw > 100)
    tips.push('⚡ DC fast charging used — ideal for highway stops.');
  if (summary.endSoc && summary.endSoc >= 80)
    tips.push('🔋 Charging to 80% preserves long-term battery health.');
  if (summary.duration < 300)
    tips.push('⏱ Short session — off-peak hours often have better rates.');
  if (summary.energyKwh > 20)
    tips.push('🌱 Great charge! Significant CO₂ emissions offset today.');
  if (!tips.length)
    tips.push('✅ Your EV is charged and ready to go!');

  return (
    <ScrollView 
      style={[styles.screen, { backgroundColor: theme.bg }]}
      contentContainerStyle={[styles.scrollContent, { paddingBottom: 40 }]}
    >
      <View style={styles.header}>
        <Text style={styles.check}>✅</Text>
        <Text style={[styles.title, { color: theme.text }]}>Session Complete</Text>
        <Text style={[styles.sub, { color: theme.textMuted }]}>{summary.chargeBoxId}</Text>
        <Text style={[styles.dur, { color: theme.textMuted }]}>{formatDuration(summary.duration)}</Text>
      </View>

      <View style={styles.bigRow}>
        <BigStat label="Energy" value={`${summary.energyKwh.toFixed(3)}`} unit="kWh" color={theme.energy} theme={theme} />
        <BigStat label="Total Cost" value={`₹${summary.costTotal.toFixed(2)}`} unit="" color={theme.cost} theme={theme} />
        <BigStat label="Peak Power" value={`${summary.peakPowerKw.toFixed(1)}`} unit="kW" color={theme.power} theme={theme} />
      </View>

      <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border }]}>
        <SummRow label="Cost per kWh" value={`₹${costPerKwh}`} theme={theme} />
        <SummRow label="Range Added" value={`~${km} km`} theme={theme} />
        <SummRow label="CO₂ Offset" value={`~${co2} kg`} theme={theme} />
        {summary.startSoc != null && summary.endSoc != null && (
          <SummRow label="SOC Change" value={`${summary.startSoc}% → ${summary.endSoc}%`} theme={theme} />
        )}
        <SummRow label="Duration" value={formatDuration(summary.duration)} theme={theme} />
      </View>

      <View style={[styles.tipsCard, { backgroundColor: theme.bgSecondary, borderColor: theme.border }]}>
        <Text style={[styles.tipsTitle, { color: theme.accentBright }]}>💡 Smart Tips</Text>
        {tips.map((t, i) => (
          <Text key={i} style={[styles.tipLine, { color: theme.textSecondary }]}>{t}</Text>
        ))}
      </View>

      <TouchableOpacity 
        style={[styles.doneBtn, { backgroundColor: theme.accent }]} 
        onPress={onDismiss}
      >
        <Text style={[styles.doneTxt, { color: theme.textInverse }]}>Done</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

function BigStat({ label, value, unit, color, theme }:
  { label: string; value: string; unit: string; color: string; theme: any }) {
  return (
    <View style={[summ.bigStat, { backgroundColor: theme.card, borderColor: theme.border }]}>
      <Text style={[summ.bigVal, { color }]}>{value}</Text>
      {unit ? <Text style={[summ.bigUnit, { color: theme.textMuted }]}>{unit}</Text> : null}
      <Text style={[summ.bigLabel, { color: theme.textMuted }]}>{label}</Text>
    </View>
  );
}

function SummRow({ label, value, theme }: { label: string; value: string; theme: any }) {
  return (
    <View style={[summ.row, { borderBottomColor: theme.border }]}>
      <Text style={[summ.rowLabel, { color: theme.textMuted }]}>{label}</Text>
      <Text style={[summ.rowValue, { color: theme.text }]}>{value}</Text>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────
const styles = StyleSheet.create({
  screen: { flex: 1 },
  scroll: { flex: 1 },
  scrollContent: { padding: 16, paddingBottom: 8 },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  emptyIcon: { fontSize: 64, marginBottom: 16 },
  emptyTitle: { fontSize: 22, fontWeight: '700', marginBottom: 8 },
  emptySub: { fontSize: 15, marginBottom: 24 },
  refreshBtn: { borderRadius: 10, paddingHorizontal: 28, paddingVertical: 12 },
  refreshText: { fontWeight: '600', fontSize: 15 },
  header: { marginBottom: 14 },
  topRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  badge: { flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: 20, paddingHorizontal: 12, paddingVertical: 5 },
  dot: { width: 7, height: 7, borderRadius: 3.5 },
  badgeText: { fontWeight: '700', fontSize: 11, letterSpacing: 1 },
  outdoorBtn: { borderRadius: 8, paddingHorizontal: 10, paddingVertical: 5, borderWidth: 1 },
  outdoorBtnText: { fontSize: 16 },
  timer: { fontSize: 58, fontWeight: '800', textAlign: 'center', letterSpacing: 3, marginBottom: 4 },
  staleText: { fontSize: 11, textAlign: 'center', marginBottom: 8 },
  progressCard: { borderRadius: 14, padding: 14, borderWidth: 1 },
  progressHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10 },
  progressLabel: { fontSize: 13 },
  estTime: { fontSize: 13, fontWeight: '700' },
  progressBg: { height: 12, borderRadius: 6, overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: 6 },
  statsCard: { borderRadius: 14, padding: 4, marginBottom: 14, borderWidth: 1 },
  card: { borderRadius: 14, padding: 16, marginBottom: 14, borderWidth: 1 },
  bigRow: { flexDirection: 'row', gap: 10, marginBottom: 16 },
  tipsCard: { borderRadius: 14, padding: 16, marginBottom: 20, borderWidth: 1 },
  tipsTitle: { fontSize: 14, fontWeight: '700', marginBottom: 10 },
  tipLine: { fontSize: 13, marginBottom: 7, lineHeight: 20 },
  doneBtn: { borderRadius: 14, padding: 17, alignItems: 'center' },
  doneTxt: { fontWeight: '800', fontSize: 16 },
  stopWrap: { padding: 16, paddingBottom: 28 },
  stopBtn: { borderRadius: 16, paddingVertical: 18, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, shadowOpacity: 0.4, shadowRadius: 12, elevation: 8 },
  stopIcon: { fontSize: 20 },
  stopText: { fontWeight: '800', fontSize: 18 },
  header: { alignItems: 'center', paddingVertical: 28 },
  check: { fontSize: 60, marginBottom: 8 },
  title: { fontSize: 28, fontWeight: '800', marginBottom: 4 },
  sub: { fontSize: 13, marginBottom: 4 },
  dur: { fontSize: 13 },
});

const stat = StyleSheet.create({
  row: { flexDirection: 'row', paddingVertical: 14, paddingHorizontal: 16, borderBottomWidth: 1 },
  cell: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10 },
  right: { borderLeftWidth: 1, paddingLeft: 16 },
  icon: { fontSize: 22 },
  label: { fontSize: 10, textTransform: 'uppercase', letterSpacing: 0.5 },
  value: { fontSize: 18, fontWeight: '800', marginTop: 1 },
});

const summ = StyleSheet.create({
  bigStat: { flex: 1, borderRadius: 14, padding: 14, alignItems: 'center', borderWidth: 1 },
  bigVal: { fontSize: 20, fontWeight: '800' },
  bigUnit: { fontSize: 11 },
  bigLabel: { fontSize: 10, textTransform: 'uppercase', marginTop: 4, textAlign: 'center' },
  row: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 10, borderBottomWidth: 1 },
  rowLabel: { fontSize: 14 },
  rowValue: { fontSize: 14, fontWeight: '600' },
});