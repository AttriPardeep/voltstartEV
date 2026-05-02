// src/screens/WalletScreen.tsx
import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
  ScrollView, ActivityIndicator, Alert,
  RefreshControl, TextInput, Modal
} from 'react-native';
import RazorpayCheckout from 'react-native-razorpay';
import { api } from '../utils/api';
import { useAuthStore } from '../store/authStore';
import RazorpayWebView from '../components/RazorpayWebView';
//import RazorpayCheckout from 'react-native-razorpay';

// ── Quick load amounts ────────────────────────────────
const QUICK_AMOUNTS = [100, 200, 500, 1000, 2000];

// ── Transaction row component ─────────────────────────
function TxRow({ tx }: { tx: any }) {
  const isCredit = tx.type === 'credit' || tx.type === 'refund';
  const icon = tx.type === 'credit'   ? '💰'
             : tx.type === 'refund'   ? '↩️'
             : tx.type === 'cashback' ? '🎁' : '⚡';

  const date = new Date(tx.createdAt);
  const dateStr = date.toLocaleDateString('en-IN', {
    day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit'
  });

  return (
    <View style={tx_s.row}>
      <View style={tx_s.iconWrap}>
        <Text style={tx_s.icon}>{icon}</Text>
      </View>
      <View style={tx_s.info}>
        <Text style={tx_s.desc} numberOfLines={1}>
          {tx.description}
        </Text>
        <Text style={tx_s.date}>{dateStr}</Text>
      </View>
      <View style={tx_s.amountWrap}>
        <Text style={[tx_s.amount,
          { color: isCredit ? '#22c55e' : '#ff3434' }]}>
          {isCredit ? '+' : '-'}₹{tx.amount.toFixed(2)}
        </Text>
        <Text style={tx_s.balance}>
          Bal: ₹{tx.balanceAfter.toFixed(2)}
        </Text>
      </View>
    </View>
  );
}

// ── Load Money Modal ──────────────────────────────────
function LoadMoneyModal({ visible, onClose, onSuccess }: {
  visible: boolean;
  onClose: () => void;
  onSuccess: (amount: number) => void;
}) {
  const { user } = useAuthStore();
  const [amount, setAmount]   = useState('');
  const [loading, setLoading] = useState(false);
  
  const [webViewData, setWebViewData] = useState<{
    orderId: string;
    amount: number;
    keyId: string;
  } | null>(null);

  const handleLoad = async (loadAmount: number) => {
    if (loadAmount < 50) {
      Alert.alert('Minimum ₹50', 'Please load at least ₹50');
      return;
    }
    setLoading(true);
    try {
      // Step 1: Create order
      const orderRes = await api.post('/api/wallet/load', { amount: loadAmount });
      const { orderId, keyId } = orderRes.data.data;

      // Step 2: Open WebView checkout
      setWebViewData({ orderId, amount: loadAmount, keyId });

    } catch (err: any) {
      Alert.alert('Failed', err?.response?.data?.error || 'Could not create order');
    } finally {
      setLoading(false);
    }
  };

  const handlePaymentSuccess = async (data: {
    razorpay_order_id: string;
    razorpay_payment_id: string;
    razorpay_signature: string;
  }) => {
    setWebViewData(null);
    try {
      const verifyRes = await api.post('/api/wallet/verify', {
        razorpay_order_id:   data.razorpay_order_id,
        razorpay_payment_id: data.razorpay_payment_id,
        razorpay_signature:  data.razorpay_signature,
      });
      if (verifyRes.data.success) {
        onSuccess(webViewData?.amount || 0);
        onClose();
        Alert.alert(
          '💰 Wallet Loaded!',
          `₹${webViewData?.amount} added.\nBalance: ₹${
            verifyRes.data.data.newBalance.toFixed(2)
          }`
        );
      }
    } catch (err: any) {
      Alert.alert('Verification Failed',
        err?.response?.data?.error || 'Please contact support');
    }
  };

  return (
    <Modal visible={visible} animationType="slide"
      transparent onRequestClose={onClose}>
      <View style={lm.overlay}>
        <View style={lm.sheet}>
          <View style={lm.handle} />
          <Text style={lm.title}>Load Money</Text>

          {/* Quick amounts */}
          <Text style={lm.label}>Quick Add</Text>
          <View style={lm.quickGrid}>
            {QUICK_AMOUNTS.map(a => (
              <TouchableOpacity key={a}
                style={lm.quickBtn}
                onPress={() => handleLoad(a)}
                disabled={loading}>
                <Text style={lm.quickBtnText}>₹{a}</Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Custom amount */}
          <Text style={lm.label}>Custom Amount</Text>
          <View style={lm.inputRow}>
            <View style={lm.inputWrap}>
              <Text style={lm.rupeeSign}>₹</Text>
              <TextInput
                style={lm.input}
                value={amount}
                onChangeText={setAmount}
                placeholder="Enter amount"
                placeholderTextColor="#475569"
                keyboardType="numeric"
              />
            </View>
            <TouchableOpacity
              style={[lm.loadBtn,
                (loading || !amount) && lm.loadBtnDim]}
              onPress={() => handleLoad(parseFloat(amount) || 0)}
              disabled={loading || !amount}>
              {loading
                ? <ActivityIndicator color="#0f172a" />
                : <Text style={lm.loadBtnText}>Add</Text>
              }
            </TouchableOpacity>
          </View>

          <Text style={lm.disclaimer}>
            Payments secured by Razorpay · UPI, Cards, Net Banking accepted
          </Text>

          {/* Payment logos */}
          <View style={lm.paymentLogos}>
            {['UPI', 'GPay', 'PhonePe', 'Visa', 'MC'].map(p => (
              <View key={p} style={lm.paymentBadge}>
                <Text style={lm.paymentBadgeText}>{p}</Text>
              </View>
            ))}
          </View>

          <TouchableOpacity style={lm.cancelBtn} onPress={onClose}>
            <Text style={lm.cancelText}>Cancel</Text>
          </TouchableOpacity>
          
          {/* Add RazorpayWebView inside LoadMoneyModal return */}
          {webViewData && (
            <RazorpayWebView
              visible={!!webViewData}
              orderId={webViewData.orderId}
              amount={webViewData.amount}
              keyId={webViewData.keyId}
              userName={user?.username || ''}
              userEmail={user?.email || ''}
              onSuccess={handlePaymentSuccess}
              onFailure={(reason) => {
                setWebViewData(null);
                Alert.alert('Payment Failed', reason);
              }}
              onDismiss={() => setWebViewData(null)}
            />
          )}
        </View>
      </View>
    </Modal>
  );
}

// ── Main Wallet Screen ────────────────────────────────
export default function WalletScreen() {
  const { user } = useAuthStore();
  const [wallet,     setWallet]     = useState<any>(null);
  const [history,    setHistory]    = useState<any[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showLoad,   setShowLoad]   = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [page,       setPage]       = useState(0);
  const [hasMore,    setHasMore]    = useState(true);
  const PAGE_SIZE = 20;

  const fetchWallet = useCallback(async () => {
    try {
      const res = await api.get('/api/wallet');
      setWallet(res.data.data);
    } catch (err) {
      console.warn('Failed to fetch wallet:', err);
    }
  }, []);

  const fetchHistory = useCallback(async (reset = false) => {
    const offset = reset ? 0 : page * PAGE_SIZE;
    try {
      const res = await api.get(
        `/api/wallet/history?limit=${PAGE_SIZE}&offset=${offset}`
      );
      const rows = res.data.data || [];
      setHistory(prev => reset ? rows : [...prev, ...rows]);
      setHasMore(rows.length === PAGE_SIZE);
      if (!reset) setPage(p => p + 1);
    } catch (err) {
      console.warn('Failed to fetch history:', err);
    }
  }, [page]);

  const onRefresh = async () => {
    setRefreshing(true);
    setPage(0);
    await Promise.all([fetchWallet(), fetchHistory(true)]);
    setRefreshing(false);
  };

  useEffect(() => {
    const init = async () => {
      setLoading(true);
      await Promise.all([fetchWallet(), fetchHistory(true)]);
      setLoading(false);
    };
    init();
  }, []);

  const handleLoadMore = async () => {
    if (loadingMore || !hasMore) return;
    setLoadingMore(true);
    await fetchHistory(false);
    setLoadingMore(false);
  };

  const handleLoadSuccess = async (amount: number) => {
    // Refresh wallet balance after successful load
    await fetchWallet();
    setPage(0);
    await fetchHistory(true);
  };

  if (loading) {
    return (
      <View style={w.loader}>
        <ActivityIndicator size="large" color="#22d3ee" />
      </View>
    );
  }

  const balance = wallet?.balance ?? 0;
  const isLowBalance = balance < 100;

  return (
    <View style={w.container}>
      <ScrollView
        style={w.scroll}
        contentContainerStyle={w.scrollContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh}
            tintColor="#22d3ee" />
        }
        onScroll={({ nativeEvent }) => {
          const { layoutMeasurement, contentOffset, contentSize } = nativeEvent;
          const isBottom =
            layoutMeasurement.height + contentOffset.y >=
            contentSize.height - 40;
          if (isBottom) handleLoadMore();
        }}
        scrollEventThrottle={400}
      >
        {/* Balance card */}
        <View style={w.balanceCard}>
          <View style={w.balanceTop}>
            <Text style={w.balanceLabel}>WALLET BALANCE</Text>
            {isLowBalance && (
              <View style={w.lowBadge}>
                <Text style={w.lowBadgeText}>⚠️ Low</Text>
              </View>
            )}
          </View>

          <Text style={[w.balanceAmount,
            { color: isLowBalance ? '#f59e0b' : '#22d3ee' }]}>
            ₹{balance.toFixed(2)}
          </Text>

          {isLowBalance && (
            <Text style={w.lowWarning}>
              Add money to continue charging sessions
            </Text>
          )}

          {/* Load button */}
          <TouchableOpacity
            style={w.loadBtn}
            onPress={() => setShowLoad(true)}>
            <Text style={w.loadBtnText}>+ Add Money</Text>
          </TouchableOpacity>
        </View>

        {/* Stats row */}
        <View style={w.statsRow}>
          <View style={w.statCard}>
            <Text style={w.statValue}>
              ₹{(wallet?.lifetimeLoaded ?? 0).toFixed(0)}
            </Text>
            <Text style={w.statLabel}>Total Loaded</Text>
          </View>
          <View style={w.statCard}>
            <Text style={w.statValue}>
              ₹{(wallet?.lifetimeSpent ?? 0).toFixed(0)}
            </Text>
            <Text style={w.statLabel}>Total Spent</Text>
          </View>
          <View style={w.statCard}>
            <Text style={[w.statValue, { color: '#22c55e' }]}>
              ₹{Math.max(0,
                (wallet?.lifetimeLoaded ?? 0) -
                (wallet?.lifetimeSpent ?? 0)
              ).toFixed(0)}
            </Text>
            <Text style={w.statLabel}>Savings vs Cash</Text>
          </View>
        </View>

        {/* Transaction history */}
        <View style={w.historySection}>
          <Text style={w.historyTitle}>Transaction History</Text>

          {history.length === 0 ? (
            <View style={w.emptyHistory}>
              <Text style={w.emptyIcon}>📭</Text>
              <Text style={w.emptyText}>No transactions yet</Text>
              <Text style={w.emptySub}>
                Load money to start charging
              </Text>
            </View>
          ) : (
            <>
              {history.map(tx => (
                <TxRow key={tx.id} tx={tx} />
              ))}
              {loadingMore && (
                <ActivityIndicator color="#22d3ee"
                  style={{ marginVertical: 16 }} />
              )}
              {!hasMore && history.length > 0 && (
                <Text style={w.endText}>— End of transactions —</Text>
              )}
            </>
          )}
        </View>
      </ScrollView>

      <LoadMoneyModal
        visible={showLoad}
        onClose={() => setShowLoad(false)}
        onSuccess={handleLoadSuccess}
      />
    </View>
  );
}

// ── Styles ────────────────────────────────────────────
const w = StyleSheet.create({
  container:    { flex: 1, backgroundColor: '#0f172a' },
  loader:       { flex: 1, alignItems: 'center', justifyContent: 'center',
                  backgroundColor: '#0f172a' },
  scroll:       { flex: 1 },
  scrollContent:{ padding: 20, paddingBottom: 40 },

  // Balance card
  balanceCard: {
    backgroundColor: '#1e293b', borderRadius: 20,
    padding: 24, marginBottom: 16,
    borderWidth: 1, borderColor: '#334155',
  },
  balanceTop: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'center', marginBottom: 8,
  },
  balanceLabel: {
    color: '#64748b', fontSize: 11, fontWeight: '700',
    letterSpacing: 1, textTransform: 'uppercase',
  },
  lowBadge: {
    backgroundColor: '#78350f', borderRadius: 20,
    paddingHorizontal: 10, paddingVertical: 3,
    borderWidth: 1, borderColor: '#d97706',
  },
  lowBadgeText: { color: '#fcd34d', fontSize: 11, fontWeight: '700' },
  balanceAmount:{
    fontSize: 48, fontWeight: '800', letterSpacing: -1,
    marginBottom: 4,
  },
  lowWarning:   { color: '#f59e0b', fontSize: 13, marginBottom: 16 },
  loadBtn: {
    backgroundColor: '#22d3ee', borderRadius: 12,
    padding: 14, alignItems: 'center', marginTop: 8,
  },
  loadBtnText:  { color: '#0f172a', fontWeight: '800', fontSize: 15 },

  // Stats
  statsRow:     { flexDirection: 'row', gap: 10, marginBottom: 20 },
  statCard: {
    flex: 1, backgroundColor: '#1e293b', borderRadius: 12,
    padding: 14, alignItems: 'center',
    borderWidth: 1, borderColor: '#334155',
  },
  statValue:    { color: '#f1f5f9', fontSize: 18, fontWeight: '800' },
  statLabel:    { color: '#64748b', fontSize: 10,
                  marginTop: 4, textTransform: 'uppercase' },

  // History
  historySection: { backgroundColor: '#1e293b', borderRadius: 16,
                    overflow: 'hidden' },
  historyTitle:   { color: '#f1f5f9', fontSize: 16, fontWeight: '700',
                    padding: 16, borderBottomWidth: 1,
                    borderBottomColor: '#334155' },
  emptyHistory:   { padding: 40, alignItems: 'center' },
  emptyIcon:      { fontSize: 40, marginBottom: 10 },
  emptyText:      { color: '#e2e8f0', fontSize: 16, fontWeight: '600',
                    marginBottom: 4 },
  emptySub:       { color: '#64748b', fontSize: 13 },
  endText:        { color: '#334155', textAlign: 'center',
                    padding: 16, fontSize: 12 },
});

const tx_s = StyleSheet.create({
  row: {
    flexDirection: 'row', alignItems: 'center',
    padding: 14, borderBottomWidth: 1, borderBottomColor: '#1e293b',
    backgroundColor: '#0f172a',
  },
  iconWrap: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: '#1e293b', alignItems: 'center',
    justifyContent: 'center', marginRight: 12,
  },
  icon:      { fontSize: 18 },
  info:      { flex: 1, marginRight: 8 },
  desc:      { color: '#e2e8f0', fontSize: 14, fontWeight: '500' },
  date:      { color: '#64748b', fontSize: 11, marginTop: 2 },
  amountWrap:{ alignItems: 'flex-end' },
  amount:    { fontSize: 15, fontWeight: '700' },
  balance:   { color: '#475569', fontSize: 10, marginTop: 2 },
});

const lm = StyleSheet.create({
  overlay: {
    flex: 1, backgroundColor: '#00000088', justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: '#1e293b', borderTopLeftRadius: 24,
    borderTopRightRadius: 24, padding: 24, paddingBottom: 40,
  },
  handle: {
    width: 40, height: 4, backgroundColor: '#334155',
    borderRadius: 2, alignSelf: 'center', marginBottom: 20,
  },
  title:    { color: '#f1f5f9', fontSize: 22, fontWeight: '800',
               marginBottom: 20 },
  label:    { color: '#64748b', fontSize: 11, fontWeight: '600',
               textTransform: 'uppercase', letterSpacing: 0.5,
               marginBottom: 10 },
  quickGrid:{ flexDirection: 'row', flexWrap: 'wrap',
               gap: 8, marginBottom: 20 },
  quickBtn: {
    flex: 1, minWidth: '28%', backgroundColor: '#0f172a',
    borderRadius: 10, padding: 12, alignItems: 'center',
    borderWidth: 1, borderColor: '#334155',
  },
  quickBtnText: { color: '#22d3ee', fontWeight: '700', fontSize: 15 },
  inputRow: { flexDirection: 'row', gap: 10, marginBottom: 16 },
  inputWrap:{
    flex: 1, flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#0f172a', borderRadius: 10,
    borderWidth: 1, borderColor: '#334155',
    paddingHorizontal: 12,
  },
  rupeeSign:{ color: '#64748b', fontSize: 18, marginRight: 4 },
  input: {
    flex: 1, color: '#fff', fontSize: 18, fontWeight: '600',
    paddingVertical: 12,
  },
  loadBtn: {
    backgroundColor: '#22d3ee', borderRadius: 10,
    paddingHorizontal: 20, justifyContent: 'center',
  },
  loadBtnDim: { backgroundColor: '#334155' },
  loadBtnText: { color: '#0f172a', fontWeight: '800', fontSize: 15 },
  disclaimer: {
    color: '#475569', fontSize: 11, textAlign: 'center',
    marginBottom: 12, lineHeight: 16,
  },
  paymentLogos: {
    flexDirection: 'row', justifyContent: 'center',
    gap: 8, marginBottom: 16,
  },
  paymentBadge: {
    backgroundColor: '#0f172a', borderRadius: 6,
    paddingHorizontal: 10, paddingVertical: 4,
    borderWidth: 1, borderColor: '#334155',
  },
  paymentBadgeText: { color: '#64748b', fontSize: 11 },
  cancelBtn: {
    backgroundColor: '#0f172a', borderRadius: 12,
    padding: 14, alignItems: 'center',
    borderWidth: 1, borderColor: '#334155',
  },
  cancelText: { color: '#64748b', fontWeight: '600' },
});