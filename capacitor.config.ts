import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'app.ubervan.driver',
  appName: 'VanHQ',
  webDir: 'dist',
  server: {
    // For dev live reload, uncomment and set to your local IP:
    // url: 'http://192.168.x.x:5174',
    androidScheme: 'https',
  },
};

export default config;
