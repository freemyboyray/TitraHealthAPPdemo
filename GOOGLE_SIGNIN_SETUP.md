# Google Sign-In Setup Checklist

If you see "Google sign-in is not configured" or similar, verify these steps. Google OAuth requires configuration in **three places**: Supabase, Google Cloud Console, and your app's `.env`.

---

## 1. Supabase Dashboard

### Auth → Providers → Google
- [ ] Google provider is **enabled**
- [ ] **Client ID** and **Client Secret** from Google Cloud Console are filled in

### Auth → URL Configuration → Redirect URLs
- [ ] Add your app's redirect URI (see below for how to get it)

**How to get your redirect URI:** Run the app, tap "Continue with Google", and check the Metro/Expo terminal. You'll see:
```
[Google Sign-In] Add this Redirect URI to Supabase: <your-uri>
```
Copy that exact URL and add it to **Redirect URLs** in Supabase.

Common Expo redirect URIs:
- **Expo Go (LAN):** `exp://192.168.x.x:8081` (IP varies)
- **Custom scheme:** `titrahealthappdemo://` (from app.json `scheme`)
- **Tunnel:** `https://xxxx-xxxx-8081.exp.direct` (run `npx expo start --tunnel`)

---

## 2. Google Cloud Console

Go to [Google Cloud Console → APIs & Services → Credentials](https://console.cloud.google.com/apis/credentials).

### Create OAuth 2.0 Client ID (Web application)
- [ ] **Authorized redirect URIs** must include:
  ```
  https://<YOUR_PROJECT_REF>.supabase.co/auth/v1/callback
  ```
  Replace `<YOUR_PROJECT_REF>` with your Supabase project ID (from your Supabase URL, e.g. `abcdefgh.supabase.co` → `abcdefgh`).

- [ ] **Authorized JavaScript origins** (if using web/tunnel): Add your app origin, e.g. `https://xxxx-8081.exp.direct` when using `expo start --tunnel`.

### Copy Client ID and Client Secret
- [ ] Paste both into Supabase Dashboard → Auth → Providers → Google

---

## 3. Your App (.env)

- [ ] `EXPO_PUBLIC_SUPABASE_URL` – your Supabase project URL (e.g. `https://xxxx.supabase.co`)
- [ ] `EXPO_PUBLIC_SUPABASE_ANON_KEY` – your Supabase anon/publishable key

If these are missing or still `placeholder`, Google OAuth will not work.

---

## 4. Restart After Changes

After updating Supabase Redirect URLs or `.env`:
1. Stop Metro (`Ctrl+C`)
2. Run `npx expo start --clear`
3. Reload the app in the simulator

---

## Quick Reference

| Where | What to add |
|-------|-------------|
| **Supabase** → Redirect URLs | Your app's redirect URI (from console log) |
| **Google Console** → Authorized redirect URIs | `https://<project-ref>.supabase.co/auth/v1/callback` |
| **Supabase** → Google provider | Client ID + Client Secret from Google |
