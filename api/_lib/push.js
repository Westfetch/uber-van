// Firebase Cloud Messaging push helper.
// Requires FIREBASE_SERVICE_ACCOUNT env var (JSON string of service account key).

import admin from 'firebase-admin';

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(
      JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT || '{}')
    ),
  });
}

export async function sendPush(fcmToken, { title, body, data, channelId = 'job-offers' }) {
  if (!fcmToken) return;
  try {
    await admin.messaging().send({
      token: fcmToken,
      notification: { title, body },
      data: data || {},
      android: {
        priority: 'high',
        notification: {
          channelId,
          sound: 'default',
          icon: 'ic_notification',
        },
      },
    });
  } catch (err) {
    console.error('Push failed:', err.message);
  }
}
