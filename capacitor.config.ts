import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'dev.vibe.todo',
  appName: 'Vibe To Do',
  webDir: 'dist',
  server: {
    androidScheme: 'https',
  },
};

export default config;
