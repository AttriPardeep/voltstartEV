// src/screens/RegisterScreen.tsx
import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, Alert, ActivityIndicator,
  KeyboardAvoidingView, Platform, ScrollView
} from 'react-native';
import { api } from '../utils/api';
import { useAuthStore } from '../store/authStore';

type Step = 'details' | 'otp';

export default function RegisterScreen({ onBack }: { onBack: () => void }) {
  const [step, setStep] = useState<Step>('details');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [otp, setOtp] = useState('');
  const [loading, setLoading] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);
  const { login } = useAuthStore();

  const startCooldown = () => {
    setResendCooldown(180);
    const t = setInterval(() => {
      setResendCooldown(prev => {
        if (prev <= 1) { clearInterval(t); return 0; }
        return prev - 1;
      });
    }, 1000);
  };

  const handleSendOtp = async () => {
    if (!username || !email || !password) {
      Alert.alert('Error', 'Please fill all fields');
      return;
    }
    if (password !== confirmPassword) {
      Alert.alert('Error', 'Passwords do not match');
      return;
    }
    if (password.length < 8) {
      Alert.alert('Error', 'Password must be at least 8 characters');
      return;
    }

    setLoading(true);
    try {
      await api.post('/api/auth/send-otp', {
        email, purpose: 'registration'
      });
      setStep('otp');
      startCooldown();
      Alert.alert('OTP Sent', `Check your email ${email}`);
    } catch (err: any) {
      Alert.alert('Error',
        err?.response?.data?.error || 'Failed to send OTP');
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    if (resendCooldown > 0) return;
    setLoading(true);
    try {
      await api.post('/api/auth/send-otp', {
        email, purpose: 'registration'
      });
      startCooldown();
      Alert.alert('OTP Resent', 'Check your email');
    } catch (err: any) {
      Alert.alert('Error',
        err?.response?.data?.error || 'Failed to resend OTP');
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async () => {
    if (otp.length !== 6) {
      Alert.alert('Error', 'Please enter the 6-digit OTP');
      return;
    }
    setLoading(true);
    try {
      await api.post('/api/users', {
        username, email, password, otp
      });
      // Auto-login after registration
      await login(username, password);
    } catch (err: any) {
      Alert.alert('Registration Failed',
        err?.response?.data?.error || 'Please try again');
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView style={s.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={s.scroll}
        keyboardShouldPersistTaps="handled">
        <Text style={s.logo}>⚡ VoltStartEV</Text>
        <Text style={s.subtitle}>Create your account</Text>

        {step === 'details' ? (
          <>
            <TextInput style={s.input} placeholder="Username"
              placeholderTextColor="#475569"
              value={username} onChangeText={setUsername}
              autoCapitalize="none" />
            <TextInput style={s.input} placeholder="Email"
              placeholderTextColor="#475569"
              value={email} onChangeText={setEmail}
              autoCapitalize="none" keyboardType="email-address" />
            <TextInput style={s.input} placeholder="Password"
              placeholderTextColor="#475569"
              value={password} onChangeText={setPassword}
              secureTextEntry />
            <TextInput style={s.input} placeholder="Confirm Password"
              placeholderTextColor="#475569"
              value={confirmPassword} onChangeText={setConfirmPassword}
              secureTextEntry />

            <TouchableOpacity style={s.btn}
              onPress={handleSendOtp} disabled={loading}>
              {loading
                ? <ActivityIndicator color="#0f172a" />
                : <Text style={s.btnText}>Send OTP →</Text>}
            </TouchableOpacity>
          </>
        ) : (
          <>
            <View style={s.otpInfo}>
              <Text style={s.otpInfoText}>
                OTP sent to {email}
              </Text>
              <Text style={s.otpExpiry}>Expires in 3 minutes</Text>
            </View>

            <TextInput
              style={[s.input, s.otpInput]}
              placeholder="Enter 6-digit OTP"
              placeholderTextColor="#475569"
              value={otp}
              onChangeText={t => setOtp(t.replace(/\D/g, '').slice(0, 6))}
              keyboardType="number-pad"
              maxLength={6}
            />

            <TouchableOpacity style={s.btn}
              onPress={handleRegister} disabled={loading}>
              {loading
                ? <ActivityIndicator color="#0f172a" />
                : <Text style={s.btnText}>Create Account ✓</Text>}
            </TouchableOpacity>

            <TouchableOpacity style={s.resend}
              onPress={handleResend}
              disabled={resendCooldown > 0}>
              <Text style={[s.resendText,
                resendCooldown > 0 && s.resendDisabled]}>
                {resendCooldown > 0
                  ? `Resend OTP in ${resendCooldown}s`
                  : 'Resend OTP'}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity onPress={() => setStep('details')}>
              <Text style={s.back}>← Change email</Text>
            </TouchableOpacity>
          </>
        )}

        <TouchableOpacity style={s.loginLink} onPress={onBack}>
          <Text style={s.loginLinkText}>
            Already have an account? <Text style={{ color: '#22d3ee' }}>Sign In</Text>
          </Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f172a' },
  scroll: { flexGrow: 1, justifyContent: 'center', padding: 24 },
  logo: { fontSize: 32, fontWeight: '800', color: '#22d3ee',
    textAlign: 'center', marginBottom: 4 },
  subtitle: { color: '#64748b', textAlign: 'center',
    marginBottom: 32, fontSize: 14 },
  input: { backgroundColor: '#1e293b', color: '#fff',
    borderRadius: 10, padding: 14, marginBottom: 12,
    fontSize: 15, borderWidth: 1, borderColor: '#334155' },
  otpInput: { fontSize: 24, textAlign: 'center',
    letterSpacing: 8, fontWeight: '700', color: '#22d3ee' },
  btn: { backgroundColor: '#22d3ee', borderRadius: 10,
    padding: 16, alignItems: 'center', marginTop: 8 },
  btnText: { color: '#0f172a', fontWeight: '700', fontSize: 16 },
  otpInfo: { backgroundColor: '#1e293b', borderRadius: 10,
    padding: 14, marginBottom: 16, alignItems: 'center' },
  otpInfoText: { color: '#94a3b8', fontSize: 14 },
  otpExpiry: { color: '#f59e0b', fontSize: 12, marginTop: 4 },
  resend: { padding: 12, alignItems: 'center', marginTop: 4 },
  resendText: { color: '#22d3ee', fontSize: 14 },
  resendDisabled: { color: '#475569' },
  back: { color: '#64748b', textAlign: 'center',
    fontSize: 13, marginTop: 4 },
  loginLink: { marginTop: 24, alignItems: 'center' },
  loginLinkText: { color: '#64748b', fontSize: 14 },
});