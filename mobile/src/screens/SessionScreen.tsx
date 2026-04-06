// src/screens/SessionScreen.tsx
import React, { useEffect, useState, useRef, useMemo, useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Alert,
  ActivityIndicator, ScrollView, Dimensions, Animated,
  RefreshControl
} from 'react-native';
import Svg, { Polyline, Line, Text as SvgText, Defs,
  LinearGradient, Stop } from 'react-native-svg';
import * as Haptics from 'expo-haptics';
import { useSessionStore } from '../store/sessionStore';
import { useAuthStore } from '../store/authStore';

const SCREEN_W = Dimensions.get('window').width;
const GRAPH_W = SCREEN_W - 64;
const GRAPH_H = 80;
const MAX_POINTS = 20;

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

// P14: Parse MySQL datetime safely with UTC assumption
function parseSessionTime(raw: string | null | undefined): number | null {
  if (!raw) return null;
  // MySQL returns "2026-04-04 09:50:03" — append Z for UTC
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

// ─── Sparkline ────────────────────────────────────────
const PowerSparkline = React.memo(({ data }: { data: number[] }) => {
  const points = useMemo(() => {
    if (data.length < 2) return null;
    const max = Math.max(...data, 1);
    const stepX = GRAPH_W / (MAX_POINTS - 1);
    const pts = data.map((v, i) => {
      const x = i * stepX;
      const y = GRAPH_H - (v / max) * (GRAPH_H - 8);
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    }).join(' ');
    const area = `${pts} ${GRAPH_W},${GRAPH_H} 0,${GRAPH_H}`;
    return { line: pts, area, max };
  }, [data]);

  if (!points) {
    return (
      <View style={spark.container}>
        <Text style={spark.title}>POWER TREND</Text>
        <Text style={spark.waiting}>Waiting for power data...</Text>
      </View>
    );
  }

  return (
    <View style={spark.container}>
      <Text style={spark.title}>POWER TREND (kW)</Text>
      <Svg width={GRAPH_W} height={GRAPH_H + 16}>
        <Defs>
          <LinearGradient id="pg" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0%" stopColor="#22d3ee" stopOpacity="0.25" />
            <Stop offset="100%" stopColor="#22d3ee" stopOpacity="0" />
          </LinearGradient>
        </Defs>

        {/* Grid */}
        <Line x1="0" y1="4" x2={GRAPH_W} y2="4"
          stroke="#1e293b" strokeWidth="1" />
        <Line x1="0" y1={GRAPH_H / 2} x2={GRAPH_W} y2={GRAPH_H / 2}
          stroke="#1e293b" strokeWidth="1" strokeDasharray="4,4" />
        <Line x1="0" y1={GRAPH_H} x2={GRAPH_W} y2={GRAPH_H}
          stroke="#1e293b" strokeWidth="1" />

        {/* Area fill */}
        <Polyline points={points.area} fill="url(#pg)" stroke="none" />

        {/* Line */}
        <Polyline points={points.line} fill="none"
          stroke="#22d3ee" strokeWidth="2.5"
          strokeLinejoin="round" strokeLinecap="round" />

        {/* Labels */}
        <SvgText x={GRAPH_W - 2} y="12" fontSize="9"
          fill="#475569" textAnchor="end">
          {points.max.toFixed(0)}
        </SvgText>
        <SvgText x={GRAPH_W - 2} y={GRAPH_H / 2 + 4} fontSize="9"
          fill="#475569" textAnchor="end">
          {(points.max / 2).toFixed(0)}
        </SvgText>
        <SvgText x={GRAPH_W - 2} y={GRAPH_H + 2} fontSize="9"
          fill="#475569" textAnchor="end">0</SvgText>
      </Svg>
      <Text style={spark.sub}>← {data.length} readings</Text>
    </View>
  );
});

// ─── Stat Row ─────────────────────────────────────────
const StatRow = React.memo(({ left, right }: {
  left: { icon: string; label: string; value: string; color: string };
  right?: { icon: string; label: string; value: string; color: string };
}) => (
  <View style={stat.row}>
    <View style={stat.cell}>
      <Text style={stat.icon}>{left.icon}</Text>
      <View>
        <Text style={stat.label}>{left.label}</Text>
        <Text style={[stat.value, { color: left.color }]}>{left.value}</Text>
      </View>
    </View>
    {right && (
      <View style={[stat.cell, stat.right]}>
        <Text style={stat.icon}>{right.icon}</Text>
        <View>
          <Text style={stat.label}>{right.label}</Text>
          <Text style={[stat.value, { color: right.color }]}>{right.value}</Text>
        </View>
      </View>
    )}
  </View>
));

// ─── Main Screen ──────────────────────────────────────
export default function SessionScreen() {
  const { activeSession, telemetry, fetchActiveSession,
    stopSession, isLoading } = useSessionStore();
  const user = useAuthStore(s => s.user);

  const [elapsed, setElapsed] = useState(0);
  const [summary, setSummary] = useState<SessionSummary | null>(null);
  const [powerHistory, setPowerHistory] = useState<number[]>([]);
  const [peakPower, setPeakPower] = useState(0);
  const [startSoc, setStartSoc] = useState<number | undefined>();
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  const progressAnim = useRef(new Animated.Value(0)).current;
  const pendingRef = useRef<number | null>(null);

  // P11: Debounce sparkline updates (every 5s max)
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
        return next.length > MAX_POINTS ? next.slice(-MAX_POINTS) : next;
      });
    }, 5000) as any;

    return () => { if (pendingRef.current) clearTimeout(pendingRef.current); };
  }, [telemetry]);

  // P12: WebSocket only, no polling (WS already connected in App.tsx)
  useEffect(() => {
    fetchActiveSession();
  }, []);

  // Timer — P14: safe datetime parse
  useEffect(() => {
    if (!activeSession?.startTime) return;
    const start = parseSessionTime(activeSession.startTime);
    if (!start) return;
    setElapsed(Math.floor((Date.now() - start) / 1000));
    const t = setInterval(() =>
      setElapsed(Math.floor((Date.now() - start) / 1000)), 1000);
    return () => clearInterval(t);
  }, [activeSession?.startTime]);

  // Animated progress bar — P7
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

  // Derived values — P3: guard NaN/Infinity
  const powerKw = isFinite((telemetry?.powerW || 0) / 1000)
    ? (telemetry?.powerW || 0) / 1000 : 0;
  const batteryKwh = user?.batteryCapacityKwh;

  const estimatedMinutes = useMemo(() => {
    if (!batteryKwh || currentSoc == null || powerKw <= 0
      || currentSoc >= targetSoc) return null;
    const r = ((targetSoc - currentSoc) / 100 * batteryKwh) / powerKw * 60;
    return isFinite(r) && r > 0 ? Math.round(r) : null;
  }, [batteryKwh, currentSoc, powerKw, targetSoc]);

  // P5: Stop confirmation with inline summary
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
            // P4: Haptic feedback
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
              Alert.alert('Error',
                err?.response?.data?.error || err?.message || 'Failed to stop');
            }
          }
        }
      ]
    );
  }, [activeSession, telemetry, elapsed, currentSoc, peakPower, startSoc]);

  // ── Summary ──────────────────────────────────────────
  if (summary) {
    return <SummaryScreen summary={summary}
      onDismiss={() => setSummary(null)} />;
  }

  // ── Empty ────────────────────────────────────────────
  if (!activeSession) {
    return (
      <View style={styles.empty}>
        <Text style={styles.emptyIcon}>🔌</Text>
        <Text style={styles.emptyTitle}>No Active Session</Text>
        <Text style={styles.emptySub}>Go to the Map tab to start charging</Text>
        <TouchableOpacity style={styles.refreshBtn}
          onPress={fetchActiveSession}>
          <Text style={styles.refreshText}>↻  Refresh</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // ── P1: Connection status indicator (subtle, not a banner) ──
  const secondsSinceUpdate = lastUpdate
    ? Math.floor((Date.now() - lastUpdate.getTime()) / 1000) : null;
  const isStale = secondsSinceUpdate != null && secondsSinceUpdate > 30;

  return (
    <View style={styles.screen}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        // P6: Pull to refresh
        refreshControl={
          <RefreshControl
            refreshing={isLoading}
            onRefresh={fetchActiveSession}
            tintColor="#22d3ee"
            colors={['#22d3ee']}
          />
        }
      >
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.topRow}>
            <View style={styles.badge}>
              <View style={styles.dot} />
              <Text style={styles.badgeText}>CHARGING</Text>
            </View>
            <Text style={styles.chargerChip}
              numberOfLines={1}>
              {activeSession.chargeBoxId}
            </Text>
          </View>

          <Text style={styles.timer}
            testID="timer-display">
            {formatTime(elapsed)}
          </Text>

          {/* P1: Subtle stale indicator under timer */}
          {isStale && (
            <Text style={styles.staleText}>
              📡 Last update {secondsSinceUpdate}s ago
            </Text>
          )}

          {/* Progress + Est Time */}
          <View style={styles.progressCard}>
            <View style={styles.progressHeader}>
              <Text style={styles.progressLabel}>
                {currentSoc != null
                  ? `${currentSoc}%  →  ${targetSoc}%`
                  : `Target: ${targetSoc}%`}
              </Text>
              {estimatedMinutes != null && (
                <Text style={styles.estTime}>
                  ⏱ {estimatedMinutes > 60
                    ? `${Math.floor(estimatedMinutes / 60)}h ${estimatedMinutes % 60}m`
                    : `${estimatedMinutes} min`} left
                </Text>
              )}
            </View>
            <View style={styles.progressBg}>
              <Animated.View style={[styles.progressFill,
                { width: progressWidth }]} />
            </View>
          </View>
        </View>

        {/* Stat Rows */}
        <View style={styles.statsCard}>
          <StatRow
            left={{ icon: '⚡', label: 'Power',
              value: `${fmt(powerKw)} kW`, color: '#34d399' }}
            right={{ icon: '🔋', label: 'Energy',
              value: `${fmt(telemetry?.energyKwh, 3)} kWh`,
              color: '#22d3ee' }}
          />
          <View style={styles.divider} />
          <StatRow
            left={{ icon: '💰', label: 'Cost So Far',
              value: `₹${fmt(telemetry?.costSoFar)}`,
              color: '#a78bfa' }}
            right={{ icon: '🔋', label: 'Battery SOC',
              value: currentSoc != null ? `${currentSoc}%` : '—',
              color: '#60a5fa' }}
          />
          <View style={styles.divider} />
          <StatRow
            left={{ icon: '🔌', label: 'Voltage',
              value: `${fmt(telemetry?.voltageV, 0)} V`,
              color: '#fb7185' }}
            right={{ icon: '⚡', label: 'Current',
              value: `${fmt(telemetry?.currentA, 1)} A`,
              color: '#f59e0b' }}
          />
        </View>

        {/* Sparkline */}
        <PowerSparkline data={powerHistory} />
      </ScrollView>

      {/* Stop — always visible, never scrolls away */}
      <View style={styles.stopWrap}>
        <TouchableOpacity
          style={styles.stopBtn}
          onPress={handleStop}
          disabled={isLoading}
          testID="stop-button"
          accessibilityLabel={`Stop charging on ${activeSession.chargeBoxId}`}
          accessibilityHint="Double tap to confirm stop"
        >
          {isLoading
            ? <ActivityIndicator color="#fff" size="large" />
            : <>
                <Text style={styles.stopIcon}>⏹</Text>
                <Text style={styles.stopText}>Stop Charging</Text>
              </>
          }
        </TouchableOpacity>
      </View>
    </View>
  );
}

// ─── Summary Screen ───────────────────────────────────
function SummaryScreen({ summary, onDismiss }:
  { summary: SessionSummary; onDismiss: () => void }) {
  const costPerKwh = summary.energyKwh > 0
    ? (summary.costTotal / summary.energyKwh).toFixed(2) : '—';
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
    <ScrollView style={styles.screen}
      contentContainerStyle={[styles.scrollContent, { paddingBottom: 40 }]}>
      <View style={summ.header}>
        <Text style={summ.title}>Session Complete</Text>
        <Text style={summ.sub}>{summary.chargeBoxId}</Text>
        <Text style={summ.dur}>{formatDuration(summary.duration)}</Text>
      </View>

      <View style={summ.bigRow}>
        <BigStat label="Energy" value={`${summary.energyKwh.toFixed(3)}`}
          unit="kWh" color="#22d3ee" />
        <BigStat label="Total Cost" value={`₹${summary.costTotal.toFixed(2)}`}
          unit="" color="#a78bfa" />
        <BigStat label="Peak Power" value={`${summary.peakPowerKw.toFixed(1)}`}
          unit="kW" color="#34d399" />
      </View>

      <View style={summ.card}>
        <SummRow label="Cost per kWh" value={`₹${costPerKwh}`} />
        <SummRow label="Range Added" value={`~${km} km`} />
        <SummRow label="CO₂ Offset" value={`~${co2} kg`} />
        {summary.startSoc != null && summary.endSoc != null && (
          <SummRow label="SOC Change"
            value={`${summary.startSoc}% → ${summary.endSoc}%`} />
        )}
        <SummRow label="Duration" value={formatDuration(summary.duration)} />
      </View>

      <View style={summ.tipsCard}>
        <Text style={summ.tipsTitle}>💡 Smart Tips</Text>
        {tips.map((t, i) => (
          <Text key={i} style={summ.tipLine}>{t}</Text>
        ))}
      </View>

      <TouchableOpacity style={summ.doneBtn} onPress={onDismiss}>
        <Text style={summ.doneTxt}>Done</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

function BigStat({ label, value, unit, color }:
  { label: string; value: string; unit: string; color: string }) {
  return (
    <View style={summ.bigStat}>
      <Text style={[summ.bigVal, { color }]}>{value}</Text>
      {unit ? <Text style={summ.bigUnit}>{unit}</Text> : null}
      <Text style={summ.bigLabel}>{label}</Text>
    </View>
  );
}

function SummRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={summ.row}>
      <Text style={summ.rowLabel}>{label}</Text>
      <Text style={summ.rowValue}>{value}</Text>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────
const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#0a0f1e' },
  scroll: { flex: 1 },
  scrollContent: { padding: 16, paddingBottom: 8 },
  empty: { flex: 1, backgroundColor: '#0a0f1e',
    alignItems: 'center', justifyContent: 'center' },
  emptyIcon: { fontSize: 64, marginBottom: 16 },
  emptyTitle: { color: '#e2e8f0', fontSize: 22,
    fontWeight: '700', marginBottom: 8 },
  emptySub: { color: '#475569', fontSize: 15, marginBottom: 24 },
  refreshBtn: { backgroundColor: '#1e293b', borderRadius: 10,
    paddingHorizontal: 28, paddingVertical: 12 },
  refreshText: { color: '#22d3ee', fontWeight: '600', fontSize: 15 },
  header: { marginBottom: 14 },
  topRow: { flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'center', marginBottom: 10 },
  badge: { flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: '#14532d', borderRadius: 20,
    paddingHorizontal: 12, paddingVertical: 5 },
  dot: { width: 7, height: 7, borderRadius: 3.5,
    backgroundColor: '#22c55e' },
  badgeText: { color: '#22c55e', fontWeight: '700',
    fontSize: 11, letterSpacing: 1 },
  chargerChip: { color: '#475569', fontSize: 12,
    backgroundColor: '#1e293b', paddingHorizontal: 10,
    paddingVertical: 4, borderRadius: 12, maxWidth: 180 },
  timer: { fontSize: 58, fontWeight: '800', color: '#f8fafc',
    textAlign: 'center', letterSpacing: 3, marginBottom: 4 },
  staleText: { color: '#64748b', fontSize: 11,
    textAlign: 'center', marginBottom: 8 },
  progressCard: { backgroundColor: '#1e293b',
    borderRadius: 14, padding: 14 },
  progressHeader: { flexDirection: 'row',
    justifyContent: 'space-between', marginBottom: 10 },
  progressLabel: { color: '#94a3b8', fontSize: 13 },
  estTime: { color: '#22d3ee', fontSize: 13, fontWeight: '700' },
  progressBg: { height: 10, backgroundColor: '#334155',
    borderRadius: 5, overflow: 'hidden' },
  progressFill: { height: '100%', backgroundColor: '#22d3ee',
    borderRadius: 5 },
  statsCard: { backgroundColor: '#1e293b', borderRadius: 14,
    padding: 4, marginBottom: 14 },
  divider: { height: 1, backgroundColor: '#0f172a',
    marginHorizontal: 16 },
  stopWrap: { padding: 16, paddingBottom: 28,
    backgroundColor: '#0a0f1e' },
  stopBtn: { backgroundColor: '#dc2626', borderRadius: 16,
    paddingVertical: 18, flexDirection: 'row',
    alignItems: 'center', justifyContent: 'center', gap: 10,
    shadowColor: '#dc2626', shadowOpacity: 0.4,
    shadowRadius: 12, elevation: 8 },
  stopIcon: { fontSize: 20 },
  stopText: { color: '#fff', fontWeight: '800', fontSize: 18 },
});

const stat = StyleSheet.create({
  row: { flexDirection: 'row', paddingVertical: 14,
    paddingHorizontal: 16 },
  cell: { flex: 1, flexDirection: 'row',
    alignItems: 'center', gap: 10 },
  right: { borderLeftWidth: 1, borderLeftColor: '#0f172a',
    paddingLeft: 16 },
  icon: { fontSize: 22 },
  label: { color: '#475569', fontSize: 10,
    textTransform: 'uppercase', letterSpacing: 0.5 },
  value: { fontSize: 18, fontWeight: '800', marginTop: 1 },
});

const spark = StyleSheet.create({
  container: { backgroundColor: '#1e293b', borderRadius: 14,
    padding: 14, marginBottom: 14 },
  title: { color: '#475569', fontSize: 10,
    textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 10 },
  sub: { color: '#334155', fontSize: 10,
    marginTop: 4, textAlign: 'right' },
  waiting: { color: '#334155', fontSize: 12,
    textAlign: 'center', paddingVertical: 20 },
});

const summ = StyleSheet.create({
  header: { alignItems: 'center', paddingVertical: 28 },
  check: { fontSize: 60, marginBottom: 8 },
  title: { color: '#f1f5f9', fontSize: 28,
    fontWeight: '800', marginBottom: 4 },
  sub: { color: '#475569', fontSize: 13, marginBottom: 4 },
  dur: { color: '#64748b', fontSize: 13 },
  bigRow: { flexDirection: 'row', gap: 10, marginBottom: 16 },
  bigStat: { flex: 1, backgroundColor: '#1e293b',
    borderRadius: 14, padding: 14, alignItems: 'center' },
  bigVal: { fontSize: 20, fontWeight: '800' },
  bigUnit: { color: '#64748b', fontSize: 11 },
  bigLabel: { color: '#475569', fontSize: 10,
    textTransform: 'uppercase', marginTop: 4, textAlign: 'center' },
  card: { backgroundColor: '#1e293b', borderRadius: 14,
    padding: 16, marginBottom: 14 },
  row: { flexDirection: 'row', justifyContent: 'space-between',
    paddingVertical: 10, borderBottomWidth: 1,
    borderBottomColor: '#0f172a' },
  rowLabel: { color: '#64748b', fontSize: 14 },
  rowValue: { color: '#e2e8f0', fontSize: 14, fontWeight: '600' },
  tipsCard: { backgroundColor: '#0c1a2e', borderRadius: 14,
    padding: 16, marginBottom: 20,
    borderWidth: 1, borderColor: '#1e3a5f' },
  tipsTitle: { color: '#60a5fa', fontSize: 14,
    fontWeight: '700', marginBottom: 10 },
  tipLine: { color: '#93c5fd', fontSize: 13,
    marginBottom: 7, lineHeight: 20 },
  doneBtn: { backgroundColor: '#22d3ee', borderRadius: 14,
    padding: 17, alignItems: 'center' },
  doneTxt: { color: '#0f172a', fontWeight: '800', fontSize: 16 },
});