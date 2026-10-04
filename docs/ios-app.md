# iOS app

Capacitor 8 wraps the web app (`ios/`, Swift Package Manager, no CocoaPods).
Bundle id `sg.wheretopark.app`, iPhone only, iOS 15+.

```bash
npm run cap:ios   # build:native → cap sync ios → open Xcode
```

## Already in the project

- Info.plist: location text, Google sign-in URL scheme
  (`$(GOOGLE_REVERSED_CLIENT_ID)` build setting), no-encryption flag,
  home-screen shortcuts Near me / Saved (`SceneDelegate.swift` →
  `/?open=near-me|saved`, routed in `App.tsx`).
- `App.entitlements`: Sign in with Apple, Associated Domains
  `applinks:wheretopark.sg`.
- `PrivacyInfo.xcprivacy`: matches `/privacy`. Keep it and the App Store
  Connect privacy answers in step when the policy changes.
- Icons and splash from `resources/` (`resources/render-icons.sh`).
- Account deletion revokes the Apple grant (`api/_account/appleRevoke.ts`).
- Near me outside Singapore explains the coverage instead of searching.

## One-time setup

1. Apple Developer Program: team `WPSXGHD68F` (set in the Xcode project and
   the AASA file).
2. Xcode → Settings → Accounts: sign in with the team's Apple ID. Automatic
   signing then registers the App ID with Sign in with Apple and Associated
   Domains from the entitlements file.
3. Google Cloud project 26992432747 → OAuth client `wheretopark iOS`
   (`26992432747-828f7ld9…`): in `.env.native` as `VITE_GOOGLE_IOS_CLIENT_ID`
   and reversed as the `GOOGLE_REVERSED_CLIENT_ID` build setting. Also set
   `VITE_GOOGLE_IOS_CLIENT_ID` in Vercel so account deletion accepts iPhone
   Google tokens. The Supabase values come from `.env.local` (git-ignored).
4. After deploying, check the AASA file: `curl -i https://wheretopark.sg/.well-known/apple-app-site-association`.
5. developer.apple.com → Keys → new key with Sign in with Apple. Set
   `APPLE_TEAM_ID`, `APPLE_KEY_ID`, `APPLE_PRIVATE_KEY` in Vercel.

## Release

Bump `MARKETING_VERSION` / `CURRENT_PROJECT_VERSION`, `npm run cap:ios`,
Product → Archive → Distribute → App Store Connect → TestFlight.

Review notes: Singapore-only; search "Orchard Road"; give a reviewer Google
account without 2FA (or say Sign in with Apple works with any Apple ID).
