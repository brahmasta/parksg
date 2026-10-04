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

1. Join the Apple Developer Program (US$99/yr). Note the Team ID.
2. Xcode → App target → Signing & Capabilities: pick the team. Xcode registers
   the App ID with Sign in with Apple and Associated Domains from the
   entitlements file.
3. Google Cloud (same project as web/Android) → OAuth client → iOS, bundle id
   `sg.wheretopark.app`. Put the client id in `VITE_GOOGLE_IOS_CLIENT_ID`
   (`.env.native` / Vercel env, the server checks it too) and its reversed form
   in the `GOOGLE_REVERSED_CLIENT_ID` build setting (both configurations).
4. Replace `TEAMID` in `public/.well-known/apple-app-site-association` and
   deploy. Check: `curl -i https://wheretopark.sg/.well-known/apple-app-site-association`.
5. developer.apple.com → Keys → new key with Sign in with Apple. Set
   `APPLE_TEAM_ID`, `APPLE_KEY_ID`, `APPLE_PRIVATE_KEY` in Vercel.

## Release

Bump `MARKETING_VERSION` / `CURRENT_PROJECT_VERSION`, `npm run cap:ios`,
Product → Archive → Distribute → App Store Connect → TestFlight.

Review notes: Singapore-only; search "Orchard Road"; give a reviewer Google
account without 2FA (or say Sign in with Apple works with any Apple ID).
