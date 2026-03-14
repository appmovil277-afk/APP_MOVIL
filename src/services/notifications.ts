import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { AppNotification } from '../types';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

export async function prepareLocalNotifications() {
  if (Platform.OS === 'web') {
    if (typeof window !== 'undefined' && 'Notification' in window && window.Notification.permission === 'default') {
      try { await window.Notification.requestPermission(); } catch {}
    }
    return typeof window !== 'undefined' && 'Notification' in window && window.Notification.permission === 'granted';
  }

  const settings = await Notifications.getPermissionsAsync();

  if (!settings.granted) {
    const requested = await Notifications.requestPermissionsAsync();
    return requested.granted;
  }

  return settings.granted;
}

export async function sendLocalNotification(notification: AppNotification) {
  if (Platform.OS === 'web') {
    if (typeof window !== 'undefined' && 'Notification' in window && window.Notification.permission === 'granted') {
      try {
        new window.Notification(notification.title, {
          body: notification.body,
          icon: '/favicon.ico',
          tag: notification.orderId ?? notification.id,
        });
      } catch {}
    }
    return;
  }

  await Notifications.scheduleNotificationAsync({
    content: {
      title: notification.title,
      body: notification.body,
      sound: 'default',
      data: { orderId: notification.orderId },
    },
    trigger: null,
  });
}
