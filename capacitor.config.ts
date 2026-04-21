import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'app.lovable.212b0715fffb4717858ea7844a89079c',
  appName: 'stethocribe',
  webDir: 'dist',
  server: {
    url: 'https://212b0715-fffb-4717-858e-a7844a89079c.lovableproject.com?forceHideBadge=true',
    cleartext: true,
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 2000,
      backgroundColor: '#0D6E6E',
      showSpinner: false,
    },
  },
};

export default config;
