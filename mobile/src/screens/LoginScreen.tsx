// src/screens/LoginScreen.tsx
import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, Alert, ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView
} from 'react-native';
import { useAuthStore } from '../store/authStore';
// Import existing placeholder screens
import RegisterScreen from './RegisterScreen';
import ForgotPasswordScreen from './ForgotPasswordScreen';

export default function LoginScreen() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  
  //  State for navigation to other auth screens
  const [showRegister, setShowRegister] = useState(false);
  const [showForgot, setShowForgot] = useState(false);
  
  const { login, isLoading } = useAuthStore();

  const handleLogin = async () => {
    if (!username || !password) {
      Alert.alert('Error', 'Please enter username and password');
      return;
    }
    try {
      await login(username, password);
    } catch (err: any) {
      Alert.alert('Login Failed', err?.message || err?.response?.data?.error || 'Unknown error');
    }
  };

  //  Conditional rendering for navigation
  if (showRegister) {
    return <RegisterScreen onBack={() => setShowRegister(false)} />;
  }
  
  if (showForgot) {
    return <ForgotPasswordScreen onBack={() => setShowForgot(false)} />;
  }

  return (
    <KeyboardAvoidingView 
      style={styles.container} 
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView 
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.card}>
          <Text style={styles.logo}>⚡ voltstartEV</Text>
          <Text style={styles.subtitle}>an EV network</Text>

          <TextInput
            style={styles.input}
            placeholder="Username"
            placeholderTextColor="#64748b"
            value={username}
            onChangeText={setUsername}
            autoCapitalize="none"
            autoComplete="username"
          />
          <TextInput
            style={styles.input}
            placeholder="Password"
            placeholderTextColor="#64748b"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            autoComplete="password"
          />

          <TouchableOpacity 
            style={[styles.button, isLoading && styles.buttonDisabled]} 
            onPress={handleLogin} 
            disabled={isLoading}
          >
            {isLoading
              ? <ActivityIndicator color="#0f172a" />
              : <Text style={styles.buttonText}>Sign In</Text>
            }
          </TouchableOpacity>

          {/*  Navigation links */}
          <TouchableOpacity 
            onPress={() => setShowForgot(true)} 
            style={styles.link}
          >
            <Text style={styles.linkText}>Forgot Password?</Text>
          </TouchableOpacity>

          <TouchableOpacity 
            onPress={() => setShowRegister(true)} 
            style={styles.link}
          >
            <Text style={styles.linkText}>
              New user? <Text style={styles.linkHighlight}>Create Account</Text>
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { 
    flex: 1, 
    backgroundColor: '#0f172a',
  },
  scrollContent: { 
    flexGrow: 1, 
    justifyContent: 'center', 
    padding: 24 
  },
  card: { 
    backgroundColor: '#1e293b', 
    borderRadius: 16, 
    padding: 28,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
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
    backgroundColor: '#0f172a', 
    color: '#fff', 
    borderRadius: 10,
    padding: 14, 
    marginBottom: 14, 
    fontSize: 15, 
    borderWidth: 1, 
    borderColor: '#334155'
  },
  button: {
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
  buttonDisabled: {
    backgroundColor: '#334155',
    shadowOpacity: 0,
    elevation: 0,
  },
  buttonText: { 
    color: '#0f172a', 
    fontWeight: '700', 
    fontSize: 16 
  },
  //  Link styles
  link: {
    paddingVertical: 12,
    alignItems: 'center',
  },
  linkText: {
    color: '#94a3b8',
    fontSize: 14,
  },
  linkHighlight: {
    color: '#22d3ee',
    fontWeight: '600',
  },
});