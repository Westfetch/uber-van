import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'app.ubervan.admin',
  appName: 'VanHQ Admin',
  webDir: 'dist',
  android: {
    path: 'android-admin',
  },
  server: {
    url: 'https://uber-van.vercel.app',
    androidScheme: 'https',
  },
};

export default config;
