# Money Dey – Auth Flow (Expo + Firebase)

This project includes beautiful Login and Signup screens with a soft purple theme, built on Expo Router and Firebase Auth. After authentication, users go straight to the Dashboard (no OTP step).

## Quick start

1. Install dependencies

   ```bash
   npm install
   ```

2. Configure Firebase (Email/Password)

   Create a Firebase project and enable Authentication providers:
   - Email/Password: Enabled
   - Phone: Enabled (for OTP via SMS)
   - Optionally Google/Apple if you plan to support social login

   Add your config in environment variables (recommended) or inline in `lib/firebase.ts`.

   Using Expo env vars (app.json or .env with `EXPO_PUBLIC_`):
   - EXPO_PUBLIC_FIREBASE_API_KEY
   - EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN
   - EXPO_PUBLIC_FIREBASE_PROJECT_ID
   - EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET
   - EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID
   - EXPO_PUBLIC_FIREBASE_APP_ID

   Phone Auth notes:
   - On iOS and Android, follow Firebase setup for phone auth (APNs for iOS, SHA keys + SafetyNet/Play Integrity for Android).
   - In development with Expo Go, use test phone numbers from Firebase console.

3. Start the app

   ```bash
   npx expo start
   ```

## Navigation
- index decides between onboarding and auth
- onboarding introduces the app and routes to /auth/login
- /auth/login: email/password sign-in, social buttons placeholders
- /auth/signup: name, email, phone, password; creates user and sends you to OTP
- /auth/otp: 6-digit code UI, scaffold for Firebase Phone Auth; continues to /dashboard
- /dashboard: placeholder home after authentication

## Theming
Colors are centralized in `constants/colors.js` with a purple-first palette and soft UI styles shared across auth pages.

## Where to add real OTP logic
See `app/auth/otp.tsx`. The UI is wired; integrate Firebase Phone Auth by:
- Starting verification to obtain `verificationId`
- Creating credential via `PhoneAuthProvider.credential(verificationId, code)`
- Signing in with `signInWithCredential`

## Assets and imagery
Hero images are remote and defined in `constants/images.js`. Replace with brand imagery when available.
