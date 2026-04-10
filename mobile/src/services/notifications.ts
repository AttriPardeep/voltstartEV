// src/services/notifications.ts
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { Platform } from 'react-native';
import { api } from '../utils/api';
import Constants from 'expo-constants';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

// Check if running in Expo Go (remote push not supported)
const isExpoGo = Constants.appOwnership === 'expo';

export async function registerForPushNotifications(): Promise<string | null> {
  if (!Device.isDevice) {
    console.log('Push notifications only work on physical devices');
    return null;
  }

  if (isExpoGo) {
    console.log('ℹ️ Running in Expo Go — remote push not supported. Use dev build for full push support.');
    // Still set up local notification permissions
    await setupLocalNotifications();
    return null;
  }

  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;
  if (existingStatus !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }
  if (finalStatus !== 'granted') {
    console.log('Push notification permission denied');
    return null;
  }

  await setupLocalNotifications();

  try {
    const projectId = Constants.expoConfig?.extra?.eas?.projectId;
    if (!projectId) {
      console.log('No EAS project ID — skipping remote push token');
      return null;
    }
    const tokenData = await Notifications.getExpoPushTokenAsync({ projectId });
    console.log('Push token obtained');
    return tokenData.data;
  } catch (err) {
    console.warn('Failed to get push token:', err);
    return null;
  }
}

async function setupLocalNotifications(): Promise<void> {
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('charging', {
      name: 'Charging Sessions',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#22d3ee',
      sound: 'default',
    });
    await Notifications.setNotificationChannelAsync('alerts', {
      name: 'Charger Alerts',
      importance: Notifications.AndroidImportance.HIGH,
      lightColor: '#ef4444',
      sound: 'default',
    });
  }
}

export async function savePushToken(token: string): Promise<void> {
  try {
    await api.put('/api/users/me/push-token', { 
      token, 
      platform: Platform.OS 
    });
  } catch (err) {
    console.warn('Failed to save push token:', err);
  }
}

// Works in Expo Go for foreground notifications
export async function showLocalNotification(
  title: string,
  body: string,
  data?: Record<string, any>
): Promise<void> {
  try {
    await Notifications.scheduleNotificationAsync({
      content: { title, body, data, sound: 'default' },
      trigger: null,
    });
  } catch (err) {
    console.warn('Local notification failed:', err);
  }
}

export function setupNotificationListeners(
  onTap: (data: any) => void
): () => void {
  const sub = Notifications.addNotificationResponseReceivedListener(
    response => onTap(response.notification.request.content.data)
  );
  return () => sub.remove();
}