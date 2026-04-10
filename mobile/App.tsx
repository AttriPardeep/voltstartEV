// App.tsx
import React, { useEffect, useRef } from 'react';
import { NavigationContainer, NavigationContainerRef } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { StatusBar } from 'expo-status-bar';
import { Text } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { ThemeProvider } from './src/themes/ThemeContext';
import MapScreen from './src/screens/MapScreen';
import SessionScreen from './src/screens/SessionScreen';
import HistoryScreen from './src/screens/HistoryScreen';
import ProfileScreen from './src/screens/ProfileScreen';
import LoginScreen from './src/screens/LoginScreen';
import { useAuthStore } from './src/store/authStore';
import { useSessionStore } from './src/store/sessionStore';
import {
  registerForPushNotifications,
  savePushToken,
  setupNotificationListeners,
} from './src/services/notifications';

const Tab = createBottomTabNavigator();

export default function App() {
  const { token, loadToken } = useAuthStore();
  const connectWebSocket = useSessionStore(s => s.connectWebSocket);
  const disconnectWebSocket = useSessionStore(s => s.disconnectWebSocket);
  const navRef = useRef<NavigationContainerRef<any>>(null);

  // ── Load auth token on mount ──
  useEffect(() => {
    loadToken();
  }, []);

  // ── WebSocket: connect on login, disconnect on logout ──
  useEffect(() => {
    if (token) {
      connectWebSocket();
    }
    return () => {
      disconnectWebSocket();
    };
  }, [token]);

  // ── Push notifications: register + handle taps ──
  useEffect(() => {
    if (!token) return;

    // Register device for push notifications
    registerForPushNotifications().then(pushToken => {
      if (pushToken) savePushToken(pushToken);
    });

    // Handle notification taps (app opened from notification)
    const cleanup = setupNotificationListeners((data) => {
      if (!navRef.current) return;

      switch (data?.action) {
        case 'view_session':
          navRef.current.navigate('Session');
          break;
        case 'view_summary':
          navRef.current.navigate('Session');
          break;
        case 'view_history':
          navRef.current.navigate('History');
          break;
        default:
          navRef.current.navigate('Session');
      }
    });

    return cleanup;
  }, [token]);

  // ── Show login if not authenticated ──
  if (!token) return <LoginScreen />;

  return (
    <ThemeProvider>
      <GestureHandlerRootView style={{ flex: 1 }}>
        <NavigationContainer ref={navRef}>
          <StatusBar style="light" />
          <Tab.Navigator
            screenOptions={{
              headerStyle: { backgroundColor: '#0f172a' },
              headerTintColor: '#22d3ee',
              headerTitleStyle: { fontWeight: '800' },
              tabBarStyle: {
                backgroundColor: '#0f172a',
                borderTopColor: '#1e293b',
              },
              tabBarActiveTintColor: '#22d3ee',
              tabBarInactiveTintColor: '#475569',
            }}
          >
            <Tab.Screen
              name="Map"
              component={MapScreen}
              options={{
                title: 'Chargers',
                tabBarIcon: ({ color }) => (
                  <Text style={{ fontSize: 20, color }}>🗺️</Text>
                ),
              }}
            />
            <Tab.Screen
              name="Session"
              component={SessionScreen}
              options={{
                title: 'Session',
                tabBarIcon: ({ color }) => (
                  <Text style={{ fontSize: 20, color }}>⚡</Text>
                ),
              }}
            />
            <Tab.Screen
              name="History"
              component={HistoryScreen}
              options={{
                title: 'History',
                tabBarIcon: ({ color }) => (
                  <Text style={{ fontSize: 20, color }}>📋</Text>
                ),
              }}
            />
            <Tab.Screen
              name="Profile"
              component={ProfileScreen}
              options={{
                title: 'Profile',
                tabBarIcon: ({ color }) => (
                  <Text style={{ fontSize: 20, color }}>👤</Text>
                ),
              }}
            />
          </Tab.Navigator>
        </NavigationContainer>
      </GestureHandlerRootView>
    </ThemeProvider>
  );
}