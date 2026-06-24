# Training for Life — Full Site Audit
*Generated: 2026-06-25 | Scope: SEO, UX, Conversion, PWA Readiness, Performance*

---

## Priority Index
- **HIGH** = Blocking revenue, user retention, or app functionality
- **MED** = Meaningful UX or conversion degradation
- **LOW** = Polish, nice-to-have

---

## PWA READINESS

### [HIGH] No web app manifest
**File:** `public/` (missing `manifest.json`)
**Problem:** There is no `manifest.json` file. The app cannot be installed to the home screen with a proper icon, name, splash screen, or standalone display mode.
**Why it matters:** This is the foundation of the entire PWA strategy. Without it, "Client installs to home screen" doesn't work properly — the browser installs a generic bookmark, not an app.
**Fix:** Create `public/manifest.json` with `name`, `short_name`, `start_url: "/"`, `display: "standalone"`, `theme_color: "#1a3a2a"`, `background_color: "#1a3a2a"`, and an `icons` array with at least 192x192 and 512x512 PNG icons. Link it in `index.html` with `<link rel="manifest" href="/manifest.json">`.

### [HIGH] No service worker
**File:** `src/main.jsx`, `public/` (missing SW)
**Problem:** No service worker is registered. The app has no offline capability, no background sync, and no install event handling.
**Why it matters:** Without a service worker, the app shows a blank screen on flaky connections and iOS Safari won't reliably cache it after install. It also can't show an install prompt on Android.
**Fix:** Register Vite PWA plugin (`vite-plugin-pwa`). Configure it to precache the app shell and key assets. Set `registerType: "autoUpdate"`. This takes under an hour to add.

### [HIGH] Workout progress stored in `sessionStorage`
**File:** `src/pages/Dashboard.jsx` (line 59), `src/components/PortalNav.jsx` (line 17)
**Problem:** In-progress workout state is stored in `sessionStorage`, which is wiped when the browser tab is closed. For a PWA launched from the home screen, closing the app loses the workout mid-session.
**Why it matters:** A client 30 minutes into a workout closes their phone screen, reopens the app, and their progress is gone. Critical UX failure for the core product feature.
**Fix:** Replace all `sessionStorage` references for workout state with `localStorage`. The keys `tfl_workout_*` should persist across app closes.

### [MED] No iOS PWA meta tags
**File:** `index.html`
**Problem:** Missing iOS-specific PWA tags: `apple-mobile-web-app-capable`, `apple-mobile-web-app-status-bar-style`, `apple-touch-icon`, and `apple-mobile-web-app-title`.
**Why it matters:** iOS Safari does not use the web manifest for install behaviour — it has its own separate meta tags. Without these, the installed icon will be a screenshot, the status bar will be wrong, and the splash screen won't show.
**Fix:** Add to `index.html`:
```html
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
<meta name="apple-mobile-web-app-title" content="Training for Life">
<link rel="apple-touch-icon" href="/icons/icon-180.png">
```

### [MED] No install-to-homescreen prompt
**Problem:** The app never prompts users to install it. The PWA install experience depends entirely on the browser's own (easy to miss) UI.
**Why it matters:** The stated goal is "client receives invite → installs to home screen." That conversion step needs to be guided in the app.
**Fix:** Capture the `beforeinstallprompt` event on first load and show a simple banner on the Dashboard (e.g. "Install app for the best experience") that triggers it on tap. Dismiss and remember in `localStorage`.

---

## AUTH PERSISTENCE

### [MED] Auth persistence not explicitly set
**File:** `src/firebase.js`
**Problem:** `getAuth(app)` is called without explicitly setting `setPersistence(browserLocalPersistence)`. Firebase defaults to LOCAL persistence on web, which survives tab closes and browser restarts — but this is implicit, not guaranteed, and can behave differently in some contexts (private browsing, storage restrictions, iOS Safari ITP).
**Why it matters:** A user should tap the icon and land on Dashboard immediately. If anything causes an implicit downgrade to session persistence, they're logged out.
**Fix:** Add explicit persistence:
```js
import { getAuth, setPersistence, browserLocalPersistence } from "firebase/auth";
const auth = getAuth(app);
setPersistence(auth, browserLocalPersistence);
export { auth };
```

### [HIGH] No forgot password flow
**File:** `src/pages/Login.jsx`
**Problem:** There is no "Forgot password?" link anywhere on the login page.
**Why it matters:** Users who forget their password are completely stuck. This is a direct churn cause — they'll give up rather than email you to reset it. Firebase provides `sendPasswordResetEmail` out of the box.
**Fix:** Add a "Forgot password?" link below the password field. On tap, show an email input and call `sendPasswordResetEmail(auth, email)`. This is a 30-minute build.

---

## SEO

### [HIGH] No meta description, OG tags, or page titles
**File:** `index.html`
**Problem:** The only SEO content is `<title>Training For Life</title>`. No meta description, no Open Graph tags, no Twitter card, no canonical URL. Since this is a SPA, every route shares this single HTML file.
**Why it matters:** Google shows a generic snippet for every page. Social shares show no preview image or description. Local search for "personal trainer Dublin" has no content signal to rank against.
**Fix:** At minimum, add to `index.html`:
```html
<meta name="description" content="1:1 personal training and online coaching in South Dublin. Build real strength with Michael Byrne — Training for Life.">
<meta property="og:title" content="Training for Life — Personal Training South Dublin">
<meta property="og:description" content="1:1 personal training, online coaching and strength programmes. Book a free consultation today.">
<meta property="og:image" content="https://trainingforlife.ie/og-image.jpg">
<meta property="og:url" content="https://trainingforlife.ie">
<meta name="twitter:card" content="summary_large_image">
```
For per-page titles, add `react-helmet-async` and set page-specific titles on public pages (Home, Coaching, InPerson).

### [MED] Duplicate viewport meta tag
**File:** `index.html` (lines 6-7)
**Problem:** `<meta name="viewport">` appears twice identically.
**Why it matters:** Technically harmless but looks sloppy and can cause unexpected browser behaviour.
**Fix:** Remove the duplicate on line 7.

### [MED] No local business structured data
**File:** `index.html`
**Problem:** No JSON-LD structured data for the coaching business.
**Why it matters:** Google uses structured data to surface rich results (star ratings, address, hours, service area) in local search. A personal trainer in South Dublin should have this.
**Fix:** Add a `<script type="application/ld+json">` block in `index.html` with `LocalBusiness` type, name, address (South Dublin), services, and URL.

### [LOW] No sitemap.xml or robots.txt
**Problem:** No sitemap.xml exists in `public/`. No robots.txt.
**Why it matters:** Google may not discover all public pages. Without robots.txt, crawlers get no guidance.
**Fix:** Add `public/robots.txt` allowing all crawlers. Add a static `public/sitemap.xml` listing the key public routes: `/`, `/coaching`, `/coaching/about`, `/coaching/in-person`, `/capability-score`, `/consultation`.

---

## PERFORMANCE

### [HIGH] Dashboard fetches ALL workout logs without a user filter
**File:** `src/pages/Dashboard.jsx` (line 103)
**Problem:** `getDocs(collection(db, "workoutLogs"))` loads every workout log for every user in the database, then filters client-side with `.filter(l => l.userId === user.uid)`.
**Why it matters:** This is both a massive performance issue (the collection will grow to tens of thousands of documents) and a security issue (users are downloading other users' data). As the user base grows, Dashboard load times will become unbearable.
**Fix:** Replace with:
```js
getDocs(query(collection(db, "workoutLogs"), where("userId", "==", user.uid)))
```

### [MED] Dashboard makes sequential async calls that could be parallel
**File:** `src/pages/Dashboard.jsx`
**Problem:** The `useEffect` makes several `await` calls in sequence: user doc, capability scores, workout logs, check-ins, wallet transactions, sessions. Each waits for the previous to complete.
**Why it matters:** Dashboard load time is additive of all these roundtrips. On a mobile connection this is noticeably slow.
**Fix:** Group independent queries into `Promise.all()`. The user doc must come first, but capability scores, workout logs, and check-ins can all be fetched in parallel once `user.uid` is known.

### [MED] Google Fonts loaded synchronously
**File:** `index.html` (lines 9-11)
**Problem:** `<link href="https://fonts.googleapis.com/css2?...">` is a synchronous stylesheet load. It blocks rendering until the fonts resolve.
**Why it matters:** On mobile, this adds 200-500ms to first contentful paint. Users see a blank or unstyled page.
**Fix:** Add `media="print" onload="this.media='all'"` to make it async, and add a `<noscript>` fallback. Or switch to `font-display: swap` via Google Fonts URL parameter (`&display=swap` — already present, so just need to make the link async).

### [MED] Facebook Pixel blocks rendering
**File:** `index.html` (lines 13-24)
**Problem:** The FB Pixel script runs synchronously in `<head>`.
**Why it matters:** Any script in `<head>` that isn't `async` or `defer` blocks the browser from rendering the page until the script completes. On slow connections this can add 300-600ms.
**Fix:** Move the Pixel script to the end of `<body>`, or wrap in `window.addEventListener('load', function() { ... })` to defer it until after the page is interactive.

---

## UX / MOBILE

### [MED] Bottom nav has 6 tabs — too many
**File:** `src/components/PortalNav.jsx` (line 4-11)
**Problem:** The bottom tab bar has 6 items: Home, Training, Coaching, Nutrition, Habits, Progress. On a standard phone screen, each tab is under 60px wide — below comfortable tap target size.
**Why it matters:** Apple HIG and Google Material both recommend maximum 5 tabs. With 6, tabs are cramped and mislabelling common. Users hit the wrong tab regularly.
**Fix:** Reduce to 5: Home, Training, Coaching, Progress, and move Habits + Nutrition into a "More" tab or into the relevant sections. Alternatively, move Coaching out of the tab bar (it's a conversion page, not a daily-use screen) and surface it elsewhere.

### [MED] Notification bell on Dashboard is non-functional
**File:** `src/pages/Dashboard.jsx` (lines 275-283)
**Problem:** The bell icon in the Dashboard header is a plain `<div>`, not a link or button. Tapping it does nothing.
**Why it matters:** Users expect the bell to open notifications. This is a broken UX expectation, especially once the Meaningful Moments Engine is sending milestone alerts.
**Fix:** Either link it to a notifications page, or open a notifications sheet, or remove it until notifications are built. Don't leave a non-functional interactive-looking element.

### [MED] No loading skeletons — only "..." text
**File:** `src/pages/Dashboard.jsx`
**Problem:** While the Dashboard loads, users see `...` for the name and empty cards. There is no skeleton loading state.
**Why it matters:** The app feels slow and unpolished. Native apps use skeleton screens so the layout is visible immediately. This matters especially on first load after install.
**Fix:** Show grey placeholder blocks in the card areas while `loading` is true. A simple `background: #e5e5e5; borderRadius: 8px; height: 20px;` div is enough.

### [LOW] Emoji icons in bottom nav feel non-native
**File:** `src/components/PortalNav.jsx`
**Problem:** The bottom nav uses emoji (🏠, 💪, 🤝, 🥗, ✅, 📈) as tab icons. On different phones and OS versions, emoji render differently.
**Why it matters:** Native apps use SVG or icon font for navigation icons — consistent, scalable, and controllable. Emoji looks like a web page, not an app.
**Fix:** Replace emoji with small SVG icons or an icon library (Lucide React is already likely available from other components). Same size, inline SVG, coloured with CSS.

### [LOW] Hamburger menu uses emoji ☰
**File:** `src/components/Navbar.jsx` (line 83)
**Problem:** The mobile menu toggle is `☰` — a Unicode character, not an icon.
**Why it matters:** Renders inconsistently across devices and doesn't allow colour control.
**Fix:** Replace with a simple SVG hamburger icon (3 horizontal lines).

---

## CONVERSION

### [HIGH] No path to purchase from the marketing site for existing users
**File:** `src/pages/Home.jsx`, `src/components/Navbar.jsx`
**Problem:** The marketing homepage (Home.jsx) has no "Login" link in the mobile nav that's prominent. New visitors see a consultation CTA; existing clients have no clear way to get to their Dashboard without knowing the URL.
**Why it matters:** Clients who've been emailed a link land on the homepage and can't find their way to the app. This is friction at a critical retention point.
**Fix:** Add "Log in to the app" as a secondary button in the mobile nav menu, alongside the "Book Consultation" CTA.

### [MED] No social login (Google/Apple)
**File:** `src/pages/Login.jsx`, `src/pages/Register.jsx`
**Problem:** Only email/password auth. No Google Sign-In, no Apple Sign-In.
**Why it matters:** On mobile, typing email and password is friction. Google Sign-In is one tap. Apple Sign-In is required by Apple if you ever go to the App Store. Both increase conversion on Register.
**Fix:** Add `signInWithPopup` / `signInWithRedirect` with `GoogleAuthProvider`. Apple auth requires slightly more setup but is worth it for the App Store path.

### [MED] CoachingSupport (upgrade) page is not linked from Dashboard
**File:** `src/pages/Dashboard.jsx`, `src/components/PortalNav.jsx`
**Problem:** The `/coaching/support` page (where clients upgrade their plan) is accessible via the Coaching tab, but the tab links to `/coaching` (the marketing overview), not the in-app upgrade flow.
**Why it matters:** Free users on the app don't have a clear path to upgrade. The upgrade page is buried.
**Fix:** For logged-in users, the "Coaching" tab should link directly to `/coaching/support` (the tier comparison + buy page) instead of the public marketing `/coaching` page.

### [LOW] No "forgot password" decreases login conversion
*(See also the Auth section above — listed here as a conversion issue too.)*
Users who forget their password abandon. Firebase reset emails are a 30-minute build with disproportionate impact on keeping users in the app.

---

## SUMMARY — BUILD ORDER

Based on impact and build time:

1. Fix `workoutLogs` query to filter by userId (10 min, high impact)
2. Add manifest.json and iOS meta tags (30 min, unlocks PWA install)
3. Install `vite-plugin-pwa` and register a service worker (1 hour)
4. Move workout state from `sessionStorage` to `localStorage` (15 min)
5. Add explicit Firebase auth persistence (10 min)
6. Add Forgot Password to Login (30 min)
7. Add install-to-homescreen prompt banner on Dashboard (45 min)
8. Fix notification bell (link or remove) (15 min)
9. Add meta description and OG tags to index.html (20 min)
10. Make Dashboard queries parallel with Promise.all (30 min)
11. Add Google Sign-In to Login/Register (45 min)
12. Fix CoachingSupport tab link for logged-in users (10 min)
13. Move Pixel and Fonts to async/deferred loading (15 min)
14. Reduce bottom nav to 5 tabs (30 min)
15. Add skeleton loading states to Dashboard (45 min)
