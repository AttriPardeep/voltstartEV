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
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [otp, setOtp] = useState('');
  const [loading, setLoading] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);
  const { login } = useAuthStore();

  const startCooldown = () => {
    setResendCooldown(180); // 3 minutes
    const t = setInterval(() => {
      setResendCooldown(prev => {
        if (prev <= 1) { 
          clearInterval(t); 
          return 0; 
        }
        return prev - 1;
      });
    }, 1000);
  };
  
  const handleSendOtp = async () => {
    // Validation
    if (!username || !email || !firstName || !password) {
      Alert.alert('Error', 'Please fill all required fields');
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
    
    if (username.length < 3) {
      Alert.alert('Error', 'Username must be at least 3 characters');
      return;
    }
    
    // Email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      Alert.alert('Error', 'Please enter a valid email address');
      return;
    }
  
    setLoading(true);
    try {
      await api.post('/api/auth/send-otp', {
        email, 
        purpose: 'registration'
      });
      setStep('otp');
      startCooldown();
      Alert.alert('OTP Sent', `Check your email at ${email}`);
    } catch (err: any) {
      let errorMessage = 'Failed to send OTP';
      
      if (err?.response?.status === 409) {
        errorMessage = 'This email is already registered. Please login instead.';
      } else if (err?.response?.status === 400) {
        errorMessage = err.response?.data?.error || 'Invalid email address';
      } else if (!err?.response) {
        errorMessage = 'Network error. Please check your internet connection.';
      }
      
      Alert.alert('Error', errorMessage);
    } finally {
      setLoading(false);
    }
  };
  
  const handleResend = async () => {
    if (resendCooldown > 0) return;
    
    setLoading(true);
    try {
      await api.post('/api/auth/send-otp', {
        email, 
        purpose: 'registration'
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

  // Update the handleRegister function in RegisterScreen.tsx
  const handleRegister = async () => {
    if (otp.length !== 6) {
      Alert.alert('Error', 'Please enter the 6-digit OTP');
      return;
    }
  
    setLoading(true);
    try {
      await api.post('/api/users', {
        username, 
        email, 
        first_name: firstName,
        last_name: lastName || null,
        phone: phone || null,
        password, 
        otp,
        target_soc_percent: 80,
      });
      
      // Auto-login after successful registration
      await login(username, password);
    } catch (err: any) {
      // Better error handling
      let errorMessage = 'Please try again';
      
      if (err?.response?.status === 409) {
        // Conflict - user already exists
        errorMessage = 'Username or email already exists. Please use different credentials.';
      } else if (err?.response?.status === 400) {
        // Bad request - validation error
        const data = err.response?.data;
        if (data?.error) {
          // Check for specific error types
          if (data.error.includes('OTP')) {
            errorMessage = 'Invalid or expired OTP. Please request a new one.';
          } else if (data.error.includes('username')) {
            errorMessage = 'Username is already taken. Please choose another.';
          } else if (data.error.includes('email')) {
            errorMessage = 'Email is already registered. Please use a different email.';
          } else {
            errorMessage = data.error;
          }
        }
      } else if (err?.response?.status === 401) {
        errorMessage = 'Invalid OTP. Please check and try again.';
      } else if (err?.code === 'ECONNABORTED') {
        errorMessage = 'Request timeout. Please check your internet connection.';
      } else if (!err?.response) {
        errorMessage = 'Network error. Please check your internet connection.';
      }
      
      Alert.alert('Registration Failed', errorMessage);
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView 
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView 
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={styles.logo}>⚡ VoltStartEV</Text>
        <Text style={styles.subtitle}>      Create your account</Text>

        {step === 'details' ? (
          <>
            <TextInput
              style={styles.input}
              placeholder="Username *"
              placeholderTextColor="#64748b"
              value={username}
              onChangeText={setUsername}
              autoCapitalize="none"
              autoComplete="username"
            />
            
            <TextInput
              style={styles.input}
              placeholder="Email *"
              placeholderTextColor="#64748b"
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              autoComplete="email"
              keyboardType="email-address"
            />
            
            <TextInput
              style={styles.input}
              placeholder="First Name *"
              placeholderTextColor="#64748b"
              value={firstName}
              onChangeText={setFirstName}
              autoCapitalize="words"
            />
            
            <TextInput
              style={styles.input}
              placeholder="Last Name"
              placeholderTextColor="#64748b"
              value={lastName}
              onChangeText={setLastName}
              autoCapitalize="words"
            />
            
            <TextInput
              style={styles.input}
              placeholder="Phone (Optional)"
              placeholderTextColor="#64748b"
              value={phone}
              onChangeText={setPhone}
              keyboardType="phone-pad"
            />
            
            <TextInput
              style={styles.input}
              placeholder="Password *"
              placeholderTextColor="#64748b"
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              autoComplete="new-password"
            />
            
            <TextInput
              style={styles.input}
              placeholder="Confirm Password *"
              placeholderTextColor="#64748b"
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              secureTextEntry
              autoComplete="new-password"
            />

            <TouchableOpacity
              style={[styles.btn, loading && styles.btnDisabled]}
              onPress={handleSendOtp}
              disabled={loading}
            >
              {loading
                ? <ActivityIndicator color="#0f172a" />
                : <Text style={styles.btnText}>Send OTP →</Text>
              }
            </TouchableOpacity>
          </>
        ) : (
          <>
            <View style={styles.otpInfo}>
              <Text style={styles.otpInfoText}>
                OTP sent to {email}
              </Text>
              <Text style={styles.otpExpiry}>
                ⏱ Expires in 3 minutes
              </Text>
            </View>

            <TextInput
              style={[styles.input, styles.otpInput]}
              placeholder="Enter 6-digit OTP"
              placeholderTextColor="#64748b"
              value={otp}
              onChangeText={t => setOtp(t.replace(/\D/g, '').slice(0, 6))}
              keyboardType="number-pad"
              maxLength={6}
              autoFocus
            />

            <TouchableOpacity
              style={[styles.btn, loading && styles.btnDisabled]}
              onPress={handleRegister}
              disabled={loading}
            >
              {loading
                ? <ActivityIndicator color="#0f172a" />
                : <Text style={styles.btnText}>Create Account ✓</Text>
              }
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.resend}
              onPress={handleResend}
              disabled={resendCooldown > 0}
            >
              <Text style={[
                styles.resendText,
                resendCooldown > 0 && styles.resendDisabled
              ]}>
                {resendCooldown > 0
                  ? `Resend OTP in ${resendCooldown}s`
                  : 'Resend OTP'}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity onPress={() => setStep('details')}>
              <Text style={styles.back}>← Change email</Text>
            </TouchableOpacity>
          </>
        )}

        <TouchableOpacity style={styles.loginLink} onPress={onBack}>
          <Text style={styles.loginLinkText}>
            Already have an account? <Text style={styles.linkHighlight}>Sign In</Text>
          </Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { 
    flex: 1, 
    backgroundColor: '#0f172a' 
  },
  scroll: { 
    flexGrow: 1, 
    justifyContent: 'center', 
    padding: 24 
  },
  logo: { 
    fontSize: 32, 
    fontWeight: '800', 
    color: '#22d3ee',
    textAlign: 'center', 
    marginBottom: 4 
  },
  subtitle: { 
    color: '#64748b', 
    textAlign: 'center',
    marginBottom: 32, 
    fontSize: 14 
  },
  input: { 
    backgroundColor: '#1e293b', 
    color: '#fff',
    borderRadius: 10, 
    padding: 14, 
    marginBottom: 12,
    fontSize: 15, 
    borderWidth: 1, 
    borderColor: '#334155' 
  },
  otpInput: { 
    fontSize: 24, 
    textAlign: 'center',
    letterSpacing: 8, 
    fontWeight: '700', 
    color: '#22d3ee' 
  },
  btn: { 
    backgroundColor: '#22d3ee', 
    borderRadius: 10,
    padding: 16, 
    alignItems: 'center', 
    marginTop: 8,
    shadowColor: '#22d3ee',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 3,
  },
  btnDisabled: {
    backgroundColor: '#334155',
    shadowOpacity: 0,
    elevation: 0,
  },
  btnText: { 
    color: '#0f172a', 
    fontWeight: '700', 
    fontSize: 16 
  },
  otpInfo: { 
    backgroundColor: '#1e293b', 
    borderRadius: 10,
    padding: 14, 
    marginBottom: 16, 
    alignItems: 'center' 
  },
  otpInfoText: { 
    color: '#94a3b8', 
    fontSize: 14 
  },
  otpExpiry: { 
    color: '#f59e0b', 
    fontSize: 12, 
    marginTop: 4 
  },
  resend: { 
    padding: 12, 
    alignItems: 'center', 
    marginTop: 4 
  },
  resendText: { 
    color: '#22d3ee', 
    fontSize: 14 
  },
  resendDisabled: { 
    color: '#475569' 
  },
  back: { 
    color: '#64748b', 
    textAlign: 'center',
    fontSize: 13, 
    marginTop: 4 
  },
  loginLink: { 
    marginTop: 24, 
    alignItems: 'center' 
  },
  loginLinkText: { 
    color: '#64748b', 
    fontSize: 14 
  },
  linkHighlight: {
    color: '#22d3ee',
    fontWeight: '600',
  },
});