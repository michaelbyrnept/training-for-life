# PWA Launch — Project Overview

**Goal:** Launch Training for Life as a premium, mobile-first Progressive Web App that feels indistinguishable from a native app, with persistent auth and install-to-homescreen as the primary client onboarding path.

**Why:** App Store submission is deprioritised. The fastest path to a polished, scalable client experience is a PWA — no store review, no binary releases, no App Store billing compliance. Future Capacitor wrapping for the stores remains an option.

**Target experience:**
> "Client receives invite → opens Training for Life → installs to home screen → stays logged in → taps icon → immediately reaches dashboard."

---

## Status
Active — audit complete, starting implementation.

---

## Open Problems

### P1 — No PWA manifest or service worker (BLOCKING)
The app cannot be properly installed. No manifest.json, no SW, no iOS meta tags.
- Build: manifest.json, vite-plugin-pwa, iOS meta tags, install prompt on Dashboard

### P2 — Workout state lost on app close (CRITICAL UX)
In-progress workout stored in sessionStorage — wiped when app closes.
- Fix: Replace all sessionStorage workout keys with localStorage

### P3 — No forgot password (CHURN RISK)
Users who forget their password have no self-serve recovery path.
- Build: forgot password flow on Login page using Firebase sendPasswordResetEmail

### P4 — Dashboard fetches all workout logs (PERFORMANCE + SECURITY)
`getDocs(collection(db, "workoutLogs"))` with no filter loads all users' data.
- Fix: Add `where("userId", "==", user.uid)` to the query

### P5 — No social login (CONVERSION)
Email/password only. Google Sign-In would reduce registration friction significantly.
- Build: Google Sign-In on Login + Register using Firebase GoogleAuthProvider

### P6 — SEO foundation missing (DISCOVERABILITY)
No meta description, no OG tags, no structured data, duplicate viewport tag.
- Fix: Add meta tags to index.html, add JSON-LD LocalBusiness schema

### P7 — Notification bell non-functional (UX DEBT)
Bell icon on Dashboard does nothing. Needs to link to notifications or be removed.
- Fix: Wire to a notifications sheet or remove until notifications are built

### P8 — CoachingSupport not linked for app users (CONVERSION)
Logged-in users hit the public marketing page via the Coaching tab instead of the upgrade page.
- Fix: Detect auth state in PortalNav and link Coaching tab to /coaching/support

### P9 — Async loading for Fonts and Pixel (PERFORMANCE)
Both block first render. Should be deferred.

### P10 — Bottom nav has 6 tabs (UX)
Too many for a mobile nav. Reduce to 5 max.

---

## Principles
- Stripe stays for all payments. No App Store billing.
- Build with React — keep Capacitor compatibility (no browser-only APIs that can't be shimmed).
- Flag any feature that may require native plugins in the future.

---

## Key Files
```
src/main.jsx                  — entry point, SW registration goes here
src/firebase.js               — add explicit auth persistence here
src/components/PortalNav.jsx  — bottom nav, 6 tabs to reduce to 5
src/pages/Dashboard.jsx       — workoutLogs query fix, bell fix, install prompt
src/pages/Login.jsx           — forgot password, Google Sign-In
src/pages/Register.jsx        — Google Sign-In
public/manifest.json          — CREATE THIS
index.html                    — meta tags, OG tags, iOS PWA tags
vite.config.js                — add vite-plugin-pwa
```

---

## Audit Reference
Full findings in: `[C] Site Audit — SEO, UX, Conversion, PWA.md`
