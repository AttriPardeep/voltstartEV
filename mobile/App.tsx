// App.tsx
import React, { useEffect } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { StatusBar } from 'expo-status-bar';
import { Text } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import MapScreen from './src/screens/MapScreen';
import SessionScreen from './src/screens/SessionScreen';
import HistoryScreen from './src/screens/HistoryScreen';
import ProfileScreen from './src/screens/ProfileScreen';
import LoginScreen from './src/screens/LoginScreen';
import { useAuthStore } from './src/store/authStore';
import { useSessionStore } from './src/store/sessionStore';

const Tab = createBottomTabNavigator();

export default function App() {
  const { token, loadToken } = useAuthStore();
  
  //  FIX: Use selectors for stable function references (prevents re-renders)
  const connectWebSocket = useSessionStore((state) => state.connectWebSocket);
  const disconnectWebSocket = useSessionStore((state) => state.disconnectWebSocket);

  // Load auth token on mount
  useEffect(() => {
    loadToken();
  }, [loadToken]);

  // Connect/disconnect WebSocket based on auth state
  useEffect(() => {
    if (token) {
      connectWebSocket();
    }
    // Cleanup on unmount or token change
    return () => {
      disconnectWebSocket();
    };
  }, [token]); //  Only token in deps — connectWebSocket/disconnectWebSocket are stable

  // Show login if not authenticated
  if (!token) return <LoginScreen />;

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <NavigationContainer>
        <StatusBar style="light" />
        <Tab.Navigator
          screenOptions={{
            headerStyle: { backgroundColor: '#0f172a' },
            headerTintColor: '#22d3ee',
            headerTitleStyle: { fontWeight: '800' },
            tabBarStyle: { backgroundColor: '#0f172a', borderTopColor: '#1e293b' },
            tabBarActiveTintColor: '#22d3ee',
            tabBarInactiveTintColor: '#475569',
          }}
        >
          <Tab.Screen 
            name="Map" 
            component={MapScreen}
            options={{ 
              title: 'Chargers', 
              tabBarIcon: ({ color }) => <Text style={{ fontSize: 20, color }}>🗺️</Text> 
            }} 
          />
          <Tab.Screen 
            name="Session" 
            component={SessionScreen}
            options={{ 
              title: 'Session', 
              tabBarIcon: ({ color }) => <Text style={{ fontSize: 20, color }}>⚡</Text> 
            }} 
          />
          <Tab.Screen 
            name="History" 
            component={HistoryScreen}
            options={{ 
              title: 'History', 
              tabBarIcon: ({ color }) => <Text style={{ fontSize: 20, color }}>📋</Text> 
            }} 
          />
          <Tab.Screen 
            name="Profile" 
            component={ProfileScreen}
            options={{ 
              title: 'Profile', 
              tabBarIcon: ({ color }) => <Text style={{ fontSize: 20, color }}>👤</Text> 
            }} 
          />
        </Tab.Navigator>
      </NavigationContainer>
    </GestureHandlerRootView>
  );
}