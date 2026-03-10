import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { AppNotification } from '../types';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: false,
    shouldSetBadge: false,
  }),
});

export async function prepareLocalNotifications() {
  if (Platform.OS === 'web') {
    return false;
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
    return;
  }

  await Notifications.scheduleNotificationAsync({
    content: {
      title: notification.title,
      body: notification.body,
      data: { orderId: notification.orderId },
    },
    trigger: null,
  });
}
