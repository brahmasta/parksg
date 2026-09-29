import type { CapacitorConfig } from '@capacitor/cli'

const config: CapacitorConfig = {
  appId: 'sg.wheretopark.app',
  appName: 'wheretopark.sg',
  webDir: 'dist',
  plugins: {
    SplashScreen: {
      // Hidden from JS (lib/nativeShell.ts) once the first frame is up.
      launchAutoHide: false,
      backgroundColor: '#fafafa',
    },
  },
}

export default config
