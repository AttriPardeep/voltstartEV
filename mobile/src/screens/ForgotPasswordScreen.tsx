// src/screens/ForgotPasswordScreen.tsx
import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, Alert, ActivityIndicator,
  KeyboardAvoidingView, Platform
} from 'react-native';
import { api } from '../utils/api';

type Step = 'email' | 'otp' | 'newPassword';

export default function ForgotPasswordScreen(
  { onBack }: { onBack: () => void }
) {
  const [step, setStep] = useState<Step>('email');
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);
  const [cooldown, setCooldown] = useState(0);

  const startCooldown = () => {
    setCooldown(180);
    const t = setInterval(() => {
      setCooldown(p => { if (p <= 1) { clearInterval(t); return 0; } return p - 1; });
    }, 1000);
  };

  const handleSendOtp = async () => {
    if (!email) { Alert.alert('Error', 'Enter your email'); return; }
    setLoading(true);
    try {
      await api.post('/api/auth/send-otp', {
        email, purpose: 'password_reset'
      });
      setStep('otp');
      startCooldown();
    } catch (err: any) {
      Alert.alert('Error', err?.response?.data?.error || 'Failed to send OTP');
    } finally { setLoading(false); }
  };

  const handleVerifyOtp = async () => {
    if (otp.length !== 6) {
      Alert.alert('Error', 'Enter the 6-digit OTP'); return;
    }
    setLoading(true);
    try {
      await api.post('/api/auth/verify-otp', {
        email, otp, purpose: 'password_reset'
      });
      setStep('newPassword');
    } catch (err: any) {
      Alert.alert('Error', err?.response?.data?.error || 'Invalid OTP');
    } finally { setLoading(false); }
  };

  const handleReset = async () => {
    if (newPassword !== confirm) {
      Alert.alert('Error', 'Passwords do not match'); return;
    }
    if (newPassword.length < 8) {
      Alert.alert('Error', 'Password must be at least 8 characters'); return;
    }
    setLoading(true);
    try {
      await api.post('/api/auth/reset-password', {
        email, otp, newPassword
      });
      Alert.alert('✅ Done', 'Password reset successfully!', [
        { text: 'Sign In', onPress: onBack }
      ]);
    } catch (err: any) {
      Alert.alert('Error', err?.response?.data?.error || 'Reset failed');
    } finally { setLoading(false); }
  };

  return (
    <KeyboardAvoidingView style={s.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={s.card}>
        <Text style={s.title}>
          {step === 'email' ? '🔑 Forgot Password'
            : step === 'otp' ? '📧 Check Your Email'
            : '🔒 New Password'}
        </Text>

        {/* Step indicators */}
        <View style={s.steps}>
          {['email', 'otp', 'newPassword'].map((st, i) => (
            <View key={st} style={[s.stepDot,
              step === st && s.stepActive,
              ['email','otp','newPassword'].indexOf(step) > i && s.stepDone
            ]} />
          ))}
        </View>

        {step === 'email' && (
          <>
            <Text style={s.hint}>
              Enter your registered email address
            </Text>
            <TextInput style={s.input} placeholder="Email address"
              placeholderTextColor="#475569"
              value={email} onChangeText={setEmail}
              keyboardType="email-address" autoCapitalize="none" />
            <TouchableOpacity style={s.btn}
              onPress={handleSendOtp} disabled={loading}>
              {loading ? <ActivityIndicator color="#0f172a" />
                : <Text style={s.btnTxt}>Send OTP →</Text>}
            </TouchableOpacity>
          </>
        )}

        {step === 'otp' && (
          <>
            <Text style={s.hint}>OTP sent to {email}</Text>
            <TextInput
              style={[s.input, s.otpInput]}
              placeholder="000000"
              placeholderTextColor="#334155"
              value={otp}
              onChangeText={t => setOtp(t.replace(/\D/g, '').slice(0, 6))}
              keyboardType="number-pad" maxLength={6}
            />
            <TouchableOpacity style={s.btn}
              onPress={handleVerifyOtp} disabled={loading}>
              {loading ? <ActivityIndicator color="#0f172a" />
                : <Text style={s.btnTxt}>Verify OTP →</Text>}
            </TouchableOpacity>
            <TouchableOpacity style={s.resend}
              onPress={handleSendOtp} disabled={cooldown > 0}>
              <Text style={[s.resendTxt, cooldown > 0 && s.dim]}>
                {cooldown > 0 ? `Resend in ${cooldown}s` : 'Resend OTP'}
              </Text>
            </TouchableOpacity>
          </>
        )}

        {step === 'newPassword' && (
          <>
            <Text style={s.hint}>Choose a strong new password</Text>
            <TextInput style={s.input} placeholder="New password"
              placeholderTextColor="#475569"
              value={newPassword} onChangeText={setNewPassword}
              secureTextEntry />
            <TextInput style={s.input} placeholder="Confirm password"
              placeholderTextColor="#475569"
              value={confirm} onChangeText={setConfirm}
              secureTextEntry />
            <TouchableOpacity style={s.btn}
              onPress={handleReset} disabled={loading}>
              {loading ? <ActivityIndicator color="#0f172a" />
                : <Text style={s.btnTxt}>Reset Password ✓</Text>}
            </TouchableOpacity>
          </>
        )}

        <TouchableOpacity style={s.back} onPress={onBack}>
          <Text style={s.backTxt}>← Back to Sign In</Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f172a',
    justifyContent: 'center', padding: 24 },
  card: { backgroundColor: '#1e293b', borderRadius: 16, padding: 28 },
  title: { fontSize: 22, fontWeight: '800', color: '#f1f5f9',
    textAlign: 'center', marginBottom: 16 },
  steps: { flexDirection: 'row', justifyContent: 'center',
    gap: 8, marginBottom: 20 },
  stepDot: { width: 8, height: 8, borderRadius: 4,
    backgroundColor: '#334155' },
  stepActive: { backgroundColor: '#22d3ee', width: 24 },
  stepDone: { backgroundColor: '#22c55e' },
  hint: { color: '#64748b', fontSize: 13, textAlign: 'center',
    marginBottom: 16 },
  input: { backgroundColor: '#0f172a', color: '#fff',
    borderRadius: 10, padding: 14, marginBottom: 12,
    fontSize: 15, borderWidth: 1, borderColor: '#334155' },
  otpInput: { fontSize: 28, textAlign: 'center',
    letterSpacing: 10, fontWeight: '700', color: '#22d3ee' },
  btn: { backgroundColor: '#22d3ee', borderRadius: 10,
    padding: 16, alignItems: 'center', marginTop: 4 },
  btnTxt: { color: '#0f172a', fontWeight: '700', fontSize: 16 },
  resend: { padding: 12, alignItems: 'center' },
  resendTxt: { color: '#22d3ee', fontSize: 14 },
  dim: { color: '#475569' },
  back: { marginTop: 16, alignItems: 'center' },
  backTxt: { color: '#64748b', fontSize: 13 },
});