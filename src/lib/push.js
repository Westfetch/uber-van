// Push notification registration for Capacitor (Android APK).
// No-ops on web — only runs inside the native shell.

import { Capacitor } from '@capacitor/core';
import { PushNotifications } from '@capacitor/push-notifications';
import api from './api.js';

let registered = false;

export async function setupPush() {
  if (registered) return;
  if (!Capacitor.isNativePlatform()) return;

  const permission = await PushNotifications.requestPermissions();
  if (permission.receive !== 'granted') return;

  await PushNotifications.register();

  PushNotifications.addListener('registration', async ({ value: fcmToken }) => {
    const token = localStorage.getItem('driver_token');
    if (!token) return;
    await api('/api/driver-data?type=register-push', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ fcm_token: fcmToken }),
    });
  });

  PushNotifications.addListener('pushNotificationActionPerformed', ({ notification }) => {
    const offerId = notification.data?.offer_id;
    if (offerId) window.location.href = `/offer/${offerId}`;
  });

  registered = true;
}
