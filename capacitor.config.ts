import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.vandesk.app',
  appName: 'VanDesk',
  webDir: 'www',
  server: {
    // The app itself is served from https://localhost inside the WebView (the backend allows that origin).
    androidScheme: 'https',
    // Plain-http backends (local development) only when you ask for it: CAP_CLEARTEXT=1 npm run cap:sync
    cleartext: process.env['CAP_CLEARTEXT'] === '1',
  },
};

export default config;
