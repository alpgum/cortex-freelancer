# Cortex Freelancer — Auth Test Report

## Overview

Authentication uses **Firebase Authentication v10.12.0** (compat SDK) with two sign-in providers:

- **Google Sign-In** (popup flow)
- **Email/Password** (with email verification)

Protected pages use a client-side auth guard. User profiles sync to Firestore.

---

## 1. Google Sign-In Flow

**Files:** `app/auth.js`, `app/auth-modal.js`, `app/login.html`

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Click "Sign in with Google" button | Google account picker popup opens (`prompt: 'select_account'`) |
| 2 | Select a Google account | Popup closes, Firebase authenticates user |
| 3 | Auth success | User saved to localStorage (`cortex_firebase_user`), header UI updates to show avatar/name |
| 4 | Firestore sync | User document created/updated at `users/{uid}` with email, displayName, photoURL, timestamps, UTM touch data |
| 5 | Redirect | If `redirect` query param exists, navigate there; otherwise stay on current page |

**Error cases:**
- Popup closed by user → silently ignored (no error toast)
- Auth failure → error toast shown with message

---

## 2. Email Signup Flow

**File:** `app/signup.html`

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Fill in Full Name, Email, Password, Confirm Password | Client-side validation runs in real-time |
| 2 | Password strength indicator | Visual bar updates (0–5 score: length, uppercase, numbers, special chars) |
| 3 | Confirm password mismatch | Red error text shown immediately |
| 4 | Submit form | `createUserWithEmailAndPassword(email, password)` called |
| 5 | Profile update | `updateProfile({ displayName: name })` sets display name |
| 6 | Verification email | `sendEmailVerification()` sends activation link |
| 7 | Auto sign-out | User is signed out immediately — must verify email first |
| 8 | Success message | Shows "Check your email" message with the address |

**Validation rules:**
- Name: required, non-empty
- Email: HTML5 `type="email"` validation
- Password: minimum 6 characters (`minlength="6"`)
- Confirm password: must match password field

**Error messages:**
| Firebase Code | User-Facing Message |
|---|---|
| `auth/email-already-in-use` | Account exists, try signing in |
| `auth/invalid-email` | Invalid email format |
| `auth/weak-password` | Password must be 6+ characters |
| `auth/operation-not-allowed` | Email signup disabled in console |
| `auth/network-request-failed` | Network error |

---

## 3. Email Login Flow

**File:** `app/login.html`

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Enter Email and Password | — |
| 2 | Submit form | `signInWithEmailAndPassword(email, password)` called |
| 3 | Auth success | ID token retrieved via `getIdToken()`, stored in localStorage as `cortex_auth_token` |
| 4 | Success toast | "Signed in" toast displayed |
| 5 | Redirect | Navigate to `redirect` query param value, or `/app/dashboard.html` if none |

**Error messages:**
| Firebase Code | User-Facing Message |
|---|---|
| `auth/user-not-found` | No account with this email — offer "Create account" link |
| `auth/wrong-password` | Incorrect password |
| `auth/invalid-email` | Invalid email format |
| `auth/too-many-requests` | Too many attempts — rate limited |
| `auth/user-disabled` | Account disabled by admin |
| `auth/invalid-credential` | Invalid email/password combination |
| `auth/network-request-failed` | Network error |

### Forgot Password

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Click "Forgot password?" | Email input focused if empty |
| 2 | Submit with email | `sendPasswordResetEmail(email)` called |
| 3 | Success | Toast: "Password reset email sent" |
| 4 | Email not found | Friendly error shown |

---

## 4. Logout Flow

**Files:** `app/auth.js` (`cortexSignOut`), `app/_includes/nav.js`

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Click "Sign Out" in header | `firebase.auth().signOut()` called |
| 2 | localStorage cleared | Keys removed: `cortex_firebase_user`, `cortex_user`, `cortex_auth_token`, `cortex_pro`, `cortex_pro_uid` |
| 3 | UI update | Header shows "Sign In" button |
| 4 | Toast | "Signed out" confirmation |
| 5 | Redirect | Navigate to `/` (home page) |

**Fallback:** If Firebase SDK unavailable, manual localStorage cleanup + redirect still occurs.

---

## 5. Auth Guard Behavior

**File:** `app/_includes/auth-guard.js`

**Protected routes:** All pages under `/app/tools/*` (and any page including auth-guard.js)

**Public routes (no guard):** `/app/login.html`, `/app/signup.html`

### Guard Logic

```
1. Check localStorage for `cortex_firebase_user`
   ├── Not found → redirect to /app/login.html?redirect=<current_path>
   └── Found → continue

2. Wait for Firebase SDK to load (retries every 500ms)

3. Listen to onAuthStateChanged()
   ├── User authenticated → sync profile, dispatch `cortex-auth-ready` event
   └── No user / expired → clear cache, redirect to login

4. Timeout fallback (5 seconds)
   └── If Firebase doesn't respond, trust localStorage and dispatch auth-ready
```

**Redirect format:** `/app/login.html?redirect=%2Fapp%2Ftools%2Finvoice.html`

**Custom event:** `cortex-auth-ready` — dispatched with user profile in `event.detail`. Other page scripts listen to this event to initialize user-specific features.

---

## 6. Auth State Persistence

### localStorage Keys

| Key | Type | Purpose |
|-----|------|---------|
| `cortex_firebase_user` | JSON | Primary user object `{ uid, email, displayName, photoURL, proUser }` |
| `cortex_user` | JSON | Legacy format `{ name, email }` |
| `cortex_auth_token` | string | Firebase ID token |
| `cortex_pro` | string | Pro status flag (`'true'`/`'false'`) |
| `cortex_pro_uid` | string | UID of pro user |
| `cortex_first_touch` | JSON | Initial UTM/referrer data |
| `cortex_last_touch` | JSON | Latest UTM/referrer data |

### sessionStorage Keys

| Key | Purpose |
|-----|---------|
| `cortex_expired_banner_dismissed` | Tracks if expired subscription banner was dismissed |

### Cross-Tab Sync

Auth state syncs across browser tabs via `window.addEventListener('storage')` on the `cortex_firebase_user` key.

---

## 7. Known Issues & Requirements

### Firebase Console Setup Required

1. **Authentication providers** — must enable:
   - Email/Password sign-in
   - Google sign-in (add OAuth client ID)
2. **Authorized domains** — add to Firebase Auth > Settings > Authorized domains:
   - `localhost` (for local dev)
   - `cortexfreelancer.com` (production)
   - `*.vercel.app` (preview deployments)
3. **Firestore** — must be enabled in production mode with appropriate security rules
4. **Email verification** — email templates can be customized in Firebase Console > Authentication > Templates

### Client-Side Config

Firebase client config is **hardcoded** in `app/auth.js` and `firebase-config.js` (not read from env vars at runtime). The config points to project `tets-e825e`. Changing the Firebase project requires updating these files directly.

### Pro Status Caching

- Pro status is cached in localStorage with a 5-minute TTL (`cortex_pro_status` key)
- Force refresh available via `window.checkProStatus(uid, true)`
- 30-day grace period after subscription expires (read-only access)

### Security Notes

- Auth guard is **client-side only** — API endpoints should independently verify auth tokens
- Firebase ID tokens expire after 1 hour; the SDK auto-refreshes them
- CSP headers allow frames from: `js.stripe.com`, `*.firebaseapp.com`, `accounts.google.com`
