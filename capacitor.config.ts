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
    SocialLogin: {
      // Only bundle what lib/nativeAuth.ts uses. Facebook's SDK would also add
      // the advertising-ID permission, which Play then asks about.
      providers: {
        google: true,
        apple: true,
        facebook: false,
        twitter: false,
      },
      logLevel: 1,
    },
  },
}

export default config
