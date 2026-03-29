import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'app.ubervan.admin',
  appName: 'VanHQ Admin',
  webDir: 'dist',
  android: {
    path: 'android-admin',
  },
  server: {
    androidScheme: 'https',
  },
};

export default config;
