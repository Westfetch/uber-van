import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'app.ubervan.driver',
  appName: 'VanHQ',
  webDir: 'dist',
  server: {
    url: 'https://uber-van.vercel.app',
    androidScheme: 'https',
  },
};

export default config;
