import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId:   'com.ecozoe.mystokk',
  appName: 'MyStokk',
  webDir:  'dist',
  server: {
    androidScheme: 'https'
  }
};

export default config;
