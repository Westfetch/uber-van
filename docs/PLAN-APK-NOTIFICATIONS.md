# Uber Van — Capacitor APK + Push Notifications Plan

## Context

The driver app at uber-van.vercel.app is a React SPA. Drivers need it as a native Android app on their phone with push notifications for job offers. Without notifications, drivers rely on checking the app or email — too slow for time-sensitive offers.

**Stack:** React + Vite frontend, Vercel serverless backend, Supabase DB.

---

## Part 1: Capacitor APK

### What Capacitor Does
Wraps the existing web app in a native Android WebView. No rewrite needed — the React app runs as-is inside a native shell with access to device APIs (camera, notifications, biometrics, etc).

### Setup Steps

1. **Install Capacitor**
   ```bash
   npm install @capacitor/core @capacitor/cli
   npx cap init "Uber Van" "app.ubervan.driver" --web-dir dist
   ```
   This creates `capacitor.config.ts` pointing at the `dist/` build output.

2. **Add Android platform**
   ```bash
   npm install @capacitor/android
   npx cap add android
   ```
   Creates `android/` directory with a full Android Studio project.

3. **Configure capacitor.config.ts**
   ```typescript
   import { CapacitorConfig } from '@capacitor/core';

   const config: CapacitorConfig = {
     appId: 'app.ubervan.driver',
     appName: 'Uber Van',
     webDir: 'dist',
     server: {
       // In dev, point to Vite dev server for hot reload
       // url: 'http://192.168.x.x:5174',
       // In prod, serve from bundled assets (comment out url)
       androidScheme: 'https',
     },
   };

   export default config;
   ```

4. **Build & sync workflow**
   ```bash
   npm run build          # Vite builds to dist/
   npx cap sync android   # Copies dist/ into android project + syncs plugins
   npx cap open android   # Opens in Android Studio
   ```
   In Android Studio: Build > Build Bundle / APK > Build APK.

5. **Dev workflow (live reload)**
   ```bash
   npm run dev            # Vite on port 5174
   # Set server.url in capacitor.config.ts to your local IP
   npx cap run android    # Launches on device/emulator with live reload
   ```

6. **App icon & splash screen**
   ```bash
   npm install @capacitor/splash-screen
   ```
   Place icon at `android/app/src/main/res/mipmap-*/ic_launcher.png` (standard Android icon sizes). Use a simple van/truck icon on dark background.

### Key Config: API Base URL

The app currently uses `api.js` to detect dev vs prod:
```javascript
const BASE = window.location.hostname === 'localhost' ? 'http://localhost:3002' : '';
```

For Capacitor, the app runs from `capacitor://localhost` or `https://localhost`, so API calls need the full Vercel URL:
```javascript
const BASE = import.meta.env.VITE_API_URL || (
  window.location.hostname === 'localhost' && !window.Capacitor
    ? 'http://localhost:3002'
    : 'https://uber-van.vercel.app'
);
```

Add `@capacitor/core` detection or just use the env var approach:
- Dev: `VITE_API_URL=http://192.168.x.x:3002`
- Prod APK: `VITE_API_URL=https://uber-van.vercel.app`

### Signing the APK

For internal distribution (no Play Store needed initially):
1. Generate a keystore: `keytool -genkey -v -keystore uber-van.keystore -alias ubervan -keyalg RSA -keysize 2048 -validity 10000`
2. Configure in `android/app/build.gradle` under `signingConfigs`
3. Build signed APK from Android Studio
4. Share the `.apk` file directly to Joe and drivers (WhatsApp, email, etc)

### Play Store (later, optional)
- Needs privacy policy URL
- Needs a few screenshots
- Review takes 1-3 days for new apps
- $25 one-time dev account fee

---

## Part 2: Push Notifications (Firebase Cloud Messaging)

### Architecture

```
Job offer created (server)
    |
    v
POST /api/send-notification
    |
    v
Firebase Cloud Messaging (FCM) API
    |
    v
Android device shows system notification
    |
    v
Driver taps notification --> opens /offer/:offerId
```

### Setup Steps

1. **Firebase project**
   - Go to console.firebase.google.com
   - Create project "uber-van" (or add to existing)
   - Add Android app with package name `app.ubervan.driver`
   - Download `google-services.json` → place in `android/app/`

2. **Install Capacitor plugin**
   ```bash
   npm install @capacitor/push-notifications
   npx cap sync android
   ```

3. **Frontend: Register for notifications**

   Add to `App.jsx` (after driver login confirmed):
   ```javascript
   import { PushNotifications } from '@capacitor/push-notifications';
   import { Capacitor } from '@capacitor/core';

   async function setupPush(driverToken) {
     if (!Capacitor.isNativePlatform()) return; // Skip on web

     const permission = await PushNotifications.requestPermissions();
     if (permission.receive !== 'granted') return;

     await PushNotifications.register();

     PushNotifications.addListener('registration', async ({ value: fcmToken }) => {
       // Send FCM token to backend so we can push to this device
       await fetch('https://uber-van.vercel.app/api/driver-data?type=register-push', {
         method: 'POST',
         headers: {
           'Content-Type': 'application/json',
           Authorization: `Bearer ${driverToken}`,
         },
         body: JSON.stringify({ fcm_token: fcmToken }),
       });
     });

     PushNotifications.addListener('pushNotificationReceived', notification => {
       // Notification received while app is open — show in-app toast or ignore
       console.log('Push received:', notification);
     });

     PushNotifications.addListener('pushNotificationActionPerformed', ({ notification }) => {
       // User tapped the notification — navigate to the offer
       const offerId = notification.data?.offer_id;
       if (offerId) window.location.href = `/offer/${offerId}`;
     });
   }
   ```

4. **Backend: Store FCM tokens**

   Add `fcm_token` column to `drivers` table:
   ```sql
   ALTER TABLE drivers ADD COLUMN fcm_token TEXT;
   ```

   Add handler in `api/driver-data.js` for `type=register-push`:
   ```javascript
   if (type === 'register-push') {
     const { fcm_token } = await parseBody(req);
     await supabase.from('drivers').update({ fcm_token }).eq('id', driver.id);
     return res.json({ ok: true });
   }
   ```

5. **Backend: Send push on job offer**

   Create `api/_lib/push.js`:
   ```javascript
   import admin from 'firebase-admin';

   // Initialize once with service account
   if (!admin.apps.length) {
     admin.initializeApp({
       credential: admin.credential.cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT)),
     });
   }

   export async function sendPush(fcmToken, { title, body, data }) {
     try {
       await admin.messaging().send({
         token: fcmToken,
         notification: { title, body },
         data: data || {},
         android: {
           priority: 'high',
           notification: {
             channelId: 'job-offers',
             sound: 'default',
             icon: 'ic_notification',
           },
         },
       });
     } catch (err) {
       // Token might be stale — log but don't crash
       console.error('Push failed:', err.message);
     }
   }
   ```

6. **Trigger push when offering a job**

   In whichever API creates job offers (likely admin.js or a future offer-dispatch function):
   ```javascript
   import { sendPush } from './_lib/push.js';

   // After creating the job_offer row:
   const { data: driver } = await supabase
     .from('drivers').select('fcm_token').eq('id', driverId).single();

   if (driver?.fcm_token) {
     await sendPush(driver.fcm_token, {
       title: 'New job offer',
       body: `${pickup} to ${destination} - ${smartDate(moveDate)}`,
       data: { offer_id: offerId },
     });
   }
   ```

### Environment Variables Needed

Add to Vercel:
- `FIREBASE_SERVICE_ACCOUNT` — JSON string of the Firebase service account key (download from Firebase Console > Project Settings > Service Accounts > Generate New Private Key)

### Notification Channel (Android)

Add to `android/app/src/main/java/.../MainActivity.java` (or via Capacitor config):
```java
// Create notification channel for job offers (Android 8+)
if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
    NotificationChannel channel = new NotificationChannel(
        "job-offers", "Job Offers", NotificationManager.IMPORTANCE_HIGH
    );
    channel.setDescription("Notifications for new job offers");
    channel.enableVibration(true);
    NotificationManager manager = getSystemService(NotificationManager.class);
    manager.createNotificationChannel(channel);
}
```

This ensures job offer notifications are HIGH priority — they'll show as a heads-up banner even when the phone is idle.

---

## Implementation Order

### Phase 1: APK (no notifications yet)
1. Install Capacitor + Android platform
2. Fix API base URL detection for Capacitor
3. Build APK, test on a real device
4. Share APK to Joe for testing

### Phase 2: Push Notifications
1. Create Firebase project, get `google-services.json`
2. Add `fcm_token` column to drivers table
3. Wire up frontend registration (App.jsx)
4. Add `register-push` handler to driver-data.js
5. Create `_lib/push.js` helper
6. Wire push send into job offer dispatch
7. Test end-to-end: create offer in admin → notification on Joe's phone → tap → opens offer screen

### Phase 3: Polish
- App icon + splash screen
- Notification sound (custom vs default)
- Badge count on app icon
- Deep linking for offer URLs
- Auto-update mechanism (Capacitor Live Update plugin or just prompt to download new APK)

---

## Dependencies to Install

```bash
# Capacitor core
npm install @capacitor/core @capacitor/cli @capacitor/android

# Plugins
npm install @capacitor/push-notifications @capacitor/splash-screen

# Backend (for FCM)
npm install firebase-admin
```

## Files to Create/Modify

| File | Action |
|------|--------|
| `capacitor.config.ts` | Create — app config |
| `android/` | Generated — Android project |
| `src/lib/api.js` | Modify — Capacitor-aware base URL |
| `src/App.jsx` | Modify — push registration after login |
| `api/driver-data.js` | Modify — add `register-push` handler |
| `api/_lib/push.js` | Create — FCM send helper |
| `api/admin.js` | Modify — send push when dispatching offers |
| `android/app/google-services.json` | Create — Firebase config |

## Supabase Migration

```sql
ALTER TABLE drivers ADD COLUMN IF NOT EXISTS fcm_token TEXT;
```
