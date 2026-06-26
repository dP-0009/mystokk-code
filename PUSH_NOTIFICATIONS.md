# Push Notifications — setup

Local notifications via **@notifee/react-native**, remote via **Firebase Cloud
Messaging** (FCM HTTP v1). These are native modules — they do **not** run in
Expo Go or on web. You need a custom **dev/prod build** (`expo prebuild` +
`expo run:android` / `eas build`).

## What's already wired (in this repo)

- **Client:** `src/services/push/` — `index.native.ts` (real impl), `index.ts`
  (web/Expo Go no-op), `shared.ts` (type→tab mapping). Token is saved to
  `vendors.push_token`. Permission is requested from `OnboardingScreen` **after
  the user finishes onboarding** (never on launch). Tap-to-deep-link handlers
  are wired in `RootNavigator` via `navigationRef`.
- **DB:** migration `024_push_notifications.sql` — `vendors.push_token` /
  `push_platform` / `push_token_updated_at`, plus the `notifications_push`
  trigger that calls the Edge Function on every notification INSERT (pg_net).
- **Server:** `supabase/functions/send-push` (deployed, `verify_jwt=false`) —
  looks up the vendor's token and sends via FCM HTTP v1. No-ops gracefully if
  FCM secrets are absent. Verified end-to-end (webhook → function → token lookup).

## Remaining manual steps (need a Firebase project + native build)

1. **Install the native packages** (already in `package.json`) and remove the
   temporary type shim:
   ```
   npm install
   rm src/types/push-shims.d.ts
   ```
2. **Firebase project:** add an Android app + iOS app; download
   `google-services.json` and `GoogleService-Info.plist`.
3. **app.json config plugins** (add — omitted here so `expo start` keeps working
   without the packages installed):
   ```jsonc
   "plugins": [
     "@react-native-firebase/app",
     ["expo-build-properties", { "ios": { "useFrameworks": "static" } }]
   ],
   "android": { "googleServicesFile": "./google-services.json" },
   "ios": { "googleServicesFile": "./GoogleService-Info.plist" }
   ```
4. **Edge Function secrets** (Firebase service account, Project Settings →
   Service accounts → generate key):
   ```
   supabase secrets set FCM_PROJECT_ID=your-project-id
   supabase secrets set FCM_CLIENT_EMAIL=firebase-adminsdk-...@your-project.iam.gserviceaccount.com
   supabase secrets set FCM_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
   ```
5. **Build & run:** `npx expo prebuild` then `expo run:android` / `run:ios`
   (or EAS). Finish onboarding to grant permission and register the token.

## Events that trigger a push

Pushes piggyback on the `notifications` table, so they fire for every event the
in-app notifications already cover: **share received**, **reservation request**,
**reservation accepted/rejected/countered**, and **connection request** — each
carries `{ type, related_id }` data and deep-links to the relevant tab.
