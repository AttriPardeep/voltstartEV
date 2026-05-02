// src/screens/LoginScreen.tsx
import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, Alert, ActivityIndicator, KeyboardAvoidingView, Platform
} from 'react-native';
import { useAuthStore } from '../store/authStore';

export default function LoginScreen() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
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

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={styles.card}>
        <Text style={styles.logo}>⚡ voltstartEV</Text>
        <Text style={styles.subtitle}>an EV network</Text>

        <TextInput
          style={styles.input}
          placeholder="Username"
          placeholderTextColor="#999"
          value={username}
          onChangeText={setUsername}
          autoCapitalize="none"
        />
        <TextInput
          style={styles.input}
          placeholder="Password"
          placeholderTextColor="#999"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
        />

        <TouchableOpacity style={styles.button} onPress={handleLogin} disabled={isLoading}>
          {isLoading
            ? <ActivityIndicator color="#fff" />
            : <Text style={styles.buttonText}>Sign In</Text>
          }
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f172a', justifyContent: 'center', padding: 24 },
  card: { backgroundColor: '#1e293b', borderRadius: 16, padding: 28 },
  logo: { fontSize: 32, fontWeight: '800', color: '#22d3ee', textAlign: 'center', marginBottom: 4 },
  subtitle: { color: '#64748b', textAlign: 'center', marginBottom: 32, fontSize: 14 },
  input: {
    backgroundColor: '#0f172a', color: '#fff', borderRadius: 10,
    padding: 14, marginBottom: 14, fontSize: 15, borderWidth: 1, borderColor: '#334155'
  },
  button: {
    backgroundColor: '#22d3ee', borderRadius: 10,
    padding: 16, alignItems: 'center', marginTop: 8
  },
  buttonText: { color: '#0f172a', fontWeight: '700', fontSize: 16 },
});