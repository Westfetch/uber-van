// Push notification registration for admin Capacitor APK.
// No-ops on web — only runs inside the native shell.

import { Capacitor } from '@capacitor/core';
import { PushNotifications } from '@capacitor/push-notifications';
import api from './api.js';
import { getTokenSync } from './tokenStore.js';

let registered = false;

export async function setupAdminPush() {
  if (registered) return;
  if (!Capacitor.isNativePlatform()) return;

  try {
    const permission = await PushNotifications.requestPermissions();
    if (permission.receive !== 'granted') return;

    await PushNotifications.register();

    PushNotifications.addListener('registration', async ({ value: fcmToken }) => {
      const token = getTokenSync('admin_token');
      if (!token) return;
      try {
        await api('/api/admin?action=register-push', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({ fcm_token: fcmToken }),
        });
      } catch (err) {
        console.error('[admin-push] failed to save token:', err);
      }
    });

    PushNotifications.addListener('registrationError', (err) => {
      console.error('[admin-push] registration error:', err);
    });

    registered = true;
  } catch (err) {
    console.error('[admin-push] setup failed:', err);
  }
}
