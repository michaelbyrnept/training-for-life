# Training for Life: Product Vision & Architecture

**Document type:** CTO/Product strategic reference
**Last updated:** 2026-06-26
**Status:** Living document — update as decisions are made

---

## Before We Build Anything: What I'm Challenging

You asked me to think like a CTO, not a developer. So here's the honest read before we get into architecture.

### What you've got right

The "capability and longevity" framing is genuinely differentiating. Every other app optimises for aesthetics or short-term performance. You're optimising for decades of healthy movement. That's a real strategic position, not a tagline.

Exercise library as company IP is correct. The library is not a feature. It is the moat.

Workout Builder as the flagship Premium feature is the right call. It's tangible, demonstrable, and immediately useful.

"Never duplicate exercise data" is architecturally correct and most developers get this wrong.

### What I'm challenging

**1. The Capability Score needs to be defined now, not later.**

You listed it in the future dashboard section. That's the wrong place. The Capability Score is the thing that makes TFL irreplaceable. Every other metric in your dashboard (resting HR, HRV, steps, calories) can be read in Apple Health. What Apple Health cannot give someone is a Training for Life Capability Score.

If you don't define what it measures and start collecting the data now, you will not be able to build it in two years. The data you're not collecting today is the debt you'll owe later.

Define it in Phase 1 even if it's simple. Improve it in Phase 2.

**2. The free tier needs one more hook.**

One saved workout is good. But free users should also have workout log history capped at 90 days. Premium members get full history.

Why: history compounds. After six months, a Premium member has a record of every weight they've lifted and every session they've completed. A free user approaching the 90-day limit sees their data about to disappear. That's a powerful conversion moment and, more importantly, a powerful retention mechanism. "I can't cancel — I'll lose my history" is a better reason to stay subscribed than any feature.

**3. AI coaching is not Phase 1. But the data architecture is.**

Most apps fail at AI because they retrofitted it onto a schema designed for something else. Every data decision you make now should pass this test: "Will this be useful for an AI coach in 24 months?"

Don't build AI coaching now. Design every data model as if you will.

**4. Don't build direct wearable integrations.**

You listed Apple Watch, Garmin, WHOOP, Oura, Polar, Fitbit individually. That's 12-18 months of integration work. Instead:

- iOS: integrate Apple HealthKit. It aggregates Apple Watch, Garmin, WHOOP, Polar, and most others automatically.
- Android: integrate Google Health Connect. It does the same.

Two integrations instead of six. Apple and Google handle the device complexity. You get all the data.

Build to the platforms, not the devices.

**5. Coach-published templates are a bigger revenue opportunity than you've flagged.**

You mentioned "coach-created templates" in the future features list. This deserves to be a named strategic initiative. Your exercise library and workout builder create the infrastructure for you to publish curated template programmes that Premium members can install with one tap. That's a content flywheel. That's also a future marketplace if you bring other coaches on.

Name it now: **TFL Template Library.**

---

## The Mission (Precise Version)

Training for Life helps people stay strong, capable, and independent for decades.

Every product decision should be filtered through one question: **does this help a member move better, train smarter, and stay consistent for longer?**

If yes, build it. If not, question it.

---

## The Capability Score (Define It Now)

The Capability Score is TFL's proprietary metric. It is the single number that summarises how capable a member is — not how they look, but what they can do.

**Phase 1 inputs (collectable without wearables):**
- Consistency Score: training sessions per week over rolling 4 weeks
- Strength Index: performance on logged compound lifts relative to bodyweight (if logged)
- Training Streak: consecutive weeks with at least 2 sessions

**Phase 2 inputs (requires wearables):**
- Cardiovascular Score: VO2 Max proxy from wearable
- Recovery Score: HRV trend from wearable
- Activity Score: daily step average

**Phase 3 inputs (requires advanced tracking):**
- Mobility markers (self-assessed or movement screen protocol)
- Sleep quality trend
- Resting heart rate trend

The score doesn't need to be complex in Phase 1. It needs to be meaningful and defensible. Start simple, improve it, never change the name.

This is the metric TFL owns. Protect it.

---

## Subscription Tiers

Never hardcode tier logic in components. Use a centralised feature-permission system so tiers can be changed without a new deployment.

### Free

- Access to full exercise library (read-only coaching content)
- 1 saved custom workout
- Unlimited edits to that workout
- Weight and rep tracking
- Workout log history (90 days)
- Basic streak tracking
- Capability Score (Phase 1, limited view)

### Premium (target: €19.99/month or €159/year)

- Unlimited saved workouts
- Full workout log history
- Full Capability Score with trends
- Coach-published workout templates (TFL Template Library)
- Wearable integrations (Phase 2)
- Advanced dashboard with health metrics (Phase 2)
- AI coaching insights (Phase 3)
- Offline mode (full workout access without signal)
- Priority support

**Pricing note:** €9.99 is too cheap for what this will become. Price to what it will be worth in 18 months, not what it's worth today. €19.99/month is defensible as soon as wearable integration and coach templates are live.

---

## Firebase Architecture

### Core Principle

**Exercises are referenced, never copied. Workouts store exercise IDs, not exercise data.**

This means improving an exercise in the library automatically improves every workout that references it. It also means the exercise library can evolve without touching user data.

---

### Firestore Collections

#### `/exercises/{exerciseId}`

The exercise library. Globally readable. Write-protected to admin only.

```
exerciseId: string (permanent — never reuse)
name: string
slug: string (url-safe)
category: string (e.g. "Lower Body", "Push", "Pull", "Core", "Cardio", "Mobility")
equipment: string[] (e.g. ["barbell", "bench"] or ["bodyweight"])
primaryMuscles: string[]
secondaryMuscles: string[]
difficulty: "beginner" | "intermediate" | "advanced"
tags: string[] (e.g. ["gym", "home", "hotel", "compound", "isolation"])
libraryVersion: number (increment when media/content is updated)

media: {
  demoUrl: string (v1: short silent clip)
  demoThumbnailUrl: string
  coachingVideoUrl: string | null (v2+)
  coachingThumbnailUrl: string | null
}

coaching: {
  whyThisExercise: string
  whoSuitableFor: string
  whatToExpect: string
  setupInstructions: string[]
  cues: string[]
  breathingAdvice: string
  commonMistakes: string[]
  targetMuscles: string (descriptive, not just list)
  machineAdjustments: string | null
  safetyAdvice: string
  coachNotes: string
  equipmentRequired: string
  gymVersion: string | null
  homeVersion: string | null
}

alternatives: {
  easier: [{ exerciseId: string, label: string }]
  harder: [{ exerciseId: string, label: string }]
}

isActive: boolean
createdAt: timestamp
updatedAt: timestamp
```

**Exercise media versions live in a subcollection:**

```
/exercises/{exerciseId}/mediaHistory/{versionId}
  version: number
  demoUrl: string
  coachingVideoUrl: string | null
  changedAt: timestamp
  changeNote: string
```

This lets you roll back to any previous media version and preserves the evolution history of your library.

---

#### `/users/{userId}/workouts/{workoutId}`

User-owned. Only the owner can read or write.

```
workoutId: string
userId: string
name: string
description: string | null
tags: string[] (user-assigned, e.g. "upper body", "quick")
isArchived: boolean

exercises: [
  {
    exerciseId: string  (reference only — NEVER copy exercise data)
    order: number
    sets: number
    reps: string  (store as string to support "8-12", "AMRAP", etc.)
    weight: number | null
    restSeconds: number | null
    notes: string | null
  }
]

createdAt: timestamp
updatedAt: timestamp
lastUsedAt: timestamp | null
```

---

#### `/users/{userId}/workoutLogs/{logId}`

Every completed session. This is the most valuable data in the app.

```
logId: string
userId: string
workoutId: string | null  (null if ad-hoc)
workoutName: string  (snapshot — in case workout is renamed/deleted)
startedAt: timestamp
completedAt: timestamp | null
durationSeconds: number | null
notes: string | null

exercises: [
  {
    exerciseId: string
    exerciseName: string  (snapshot for display — source of truth is exerciseId)
    order: number
    sets: [
      {
        reps: number | null
        weight: number | null
        completed: boolean
        notes: string | null
      }
    ]
    personalBestThisSession: boolean
  }
]

healthSnapshot: {
  restingHeartRate: number | null
  hrv: number | null
  sleepHours: number | null
  source: string | null  (e.g. "apple_health", "manual")
}
```

**Why snapshot the exercise name:** if you ever rename an exercise, workout logs don't break.

---

#### `/users/{userId}/personalBests/{exerciseId}`

```
exerciseId: string
exerciseName: string  (snapshot)
bestWeight: number
bestReps: number
bestVolume: number  (weight x reps x sets — useful for AI)
achievedAt: timestamp
logId: string  (reference to the session)
```

Update on every log completion via Cloud Function. Never update from client.

---

#### `/users/{userId}/profile`

```
userId: string
displayName: string
subscriptionTier: "free" | "premium"
subscriptionStatus: "active" | "cancelled" | "past_due" | "trialing"
stripeCustomerId: string

onboarding: {
  completed: boolean
  trainingGoal: string | null
  trainingFrequency: number | null
  fitnessLevel: "beginner" | "intermediate" | "advanced" | null
  availableEquipment: string[]
}

capabilityScore: {
  overall: number | null
  lastCalculatedAt: timestamp | null
  breakdown: {
    consistency: number | null
    strength: number | null
    streak: number | null
  }
}

streak: {
  current: number
  longest: number
  lastSessionAt: timestamp | null
}

healthIntegrations: {
  appleHealth: boolean
  googleHealth: boolean
  connectedAt: timestamp | null
}
```

---

#### `/exercises` (top-level index, for admin)

A single document `/meta/exerciseIndex` containing category counts and last-updated timestamps. Used for admin dashboard and cache invalidation.

---

### Firestore Security Rules Design

```
// Exercises: public read, admin write only
match /exercises/{exerciseId} {
  allow read: if true;
  allow write: if request.auth.token.admin == true;
}

// User data: owner only
match /users/{userId}/{document=**} {
  allow read, write: if request.auth.uid == userId;
}
```

Premium features are enforced server-side (Cloud Functions), not in security rules. Rules enforce ownership. Functions enforce subscription entitlements.

---

### Cloud Functions

#### `onWorkoutLogComplete`
Triggered on write to `/users/{userId}/workoutLogs/{logId}`.
- Updates personal bests
- Recalculates streak
- Queues Capability Score recalculation
- (Phase 2) Fires AI coaching check

#### `recalculateCapabilityScore`
- Reads last 28 days of workout logs
- Computes consistency, strength index, streak
- Writes to `/users/{userId}/profile.capabilityScore`

#### `checkPremiumEntitlement`
- Called before saving a workout
- Checks subscription status against workout count
- Returns `{ allowed: boolean, reason: string }`

Never trust client-side subscription status. Always verify server-side before writes.

---

## Component Architecture

### Feature Flag System

Create a single hook that components consume:

```javascript
// useFeatures.js
export function useFeatures() {
  const { profile } = useUserProfile()
  const tier = profile?.subscriptionTier ?? 'free'

  return {
    unlimitedWorkouts: tier === 'premium',
    fullWorkoutHistory: tier === 'premium',
    wearableIntegrations: tier === 'premium',
    coachTemplates: tier === 'premium',
    capabilityScoreFull: tier === 'premium',
    // add features here — never hardcode tier checks in components
  }
}
```

Components never check `subscriptionTier === 'premium'` directly. They check `features.unlimitedWorkouts`. When you change what's included in Premium, you change it in one place.

### Workout Builder Component Tree

```
WorkoutBuilder
  WorkoutHeader (name, tags)
  ExerciseList
    ExerciseCard (exerciseId, order, sets, reps, weight, rest, notes)
      ExerciseRef (resolves exerciseId -> display name + thumbnail)
    AddExerciseButton
  ExercisePicker (modal)
    CategoryFilter
    ExerciseGrid
      ExerciseTile (name, thumbnail, muscles)
  WorkoutSaveButton
    PremiumGate (shown when free user hits limit)
```

`ExerciseRef` is a lightweight component that reads from the exercise library. It never stores exercise data in the workout. If the exercise library updates, `ExerciseRef` shows the latest version automatically.

### Exercise Library Component Tree

```
ExerciseLibrary
  CategoryNav
  ExerciseList
    ExerciseTile (preview)
  ExerciseDetail (full coaching content)
    DemoPlayer
    CoachingContent
      WhySection
      SetupSection
      CuesSection
      MistakesSection
      AlternativesSection (using encouraging language)
    RelatedExercises
```

`AlternativesSection` uses the language from your spec:
- "If this feels too challenging today..." -> easier alternative
- "Ready for something more demanding?" -> harder alternative

---

## Phased Roadmap

### Phase 1: Foundation (Now)

**Goal:** Make Premium worth €14.99/month to someone who trains 3x/week.

- Workout Builder (unlimited workouts for Premium, 1 for Free)
- Exercise library with full coaching content (build it right the first time)
- Workout logging with weight/rep tracking
- Personal bests (auto-calculated via Cloud Function)
- Streak tracking
- Capability Score v1 (consistency + streak only — honest about what it measures)
- 90-day log history cap for free users
- Premium upgrade gate (polished, non-punishing)

**What Phase 1 proves:** someone can build their training life around this app without needing anything else.

---

### Phase 2: Daily Habit (3-6 months)

**Goal:** Members open the app every morning, not just on training days.

- Apple HealthKit integration (iOS)
- Google Health Connect integration (Android)
- Premium dashboard: streak, upcoming workout, capability score, latest PRs, wearable metrics
- Capability Score v2: adds cardiovascular and recovery inputs from wearable
- TFL Template Library: coach-published workout templates
- Workout duplication
- Equipment filters on exercise library
- Offline mode (full workout access, sync when back online)

**What Phase 2 proves:** TFL is the central hub for someone's health, not just a workout logger.

---

### Phase 3: Intelligence (6-12 months)

**Goal:** The app coaches you, not just tracks you.

- AI coaching insights (trend-based, not generic motivation)
- Readiness score (wearable inputs + training load)
- Smart workout suggestions ("your recovery looks good — good day for a heavy session")
- Scheduled workouts + calendar integration
- Progress reports (weekly email or in-app)
- Capability Score v3: full composite with mobility inputs

**What Phase 3 proves:** TFL makes you a better athlete, not just a more organised one.

---

### Phase 4: Platform (12-24 months)

**Goal:** TFL becomes the place coaches and members connect.

- Multiple coach profiles (other coaches publish content)
- Template marketplace
- Member communities (optional — evaluate carefully, moderation overhead is real)
- Advanced health reports
- Corporate/group plans

---

## Offline Architecture

Firebase SDK has built-in offline persistence. Enable it on app initialisation:

```javascript
import { enableIndexedDbPersistence } from 'firebase/firestore'
enableIndexedDbPersistence(db)
```

For workout logging, this means members can:
- View all saved workouts offline
- Log sets and reps without signal
- Sync automatically when signal returns

Gate this as a Premium feature in Phase 1. Free users require a connection.

This matters more than most features. Gym wifi is unreliable. Members who lose their session mid-workout because of a connection drop will churn.

---

## Exercise Library Production Plan

The library is the moat. Treat it like product, not like content.

### Content Standard per Exercise (Phase 1)

Every exercise in Phase 1 should have, at minimum:
- Short demonstration clip (clean, silent, well-lit)
- Full coaching write-up (all fields in the data model above)
- Alternatives (easier + harder)
- Correct category and muscle group tagging

Don't launch exercises without the coaching content. A silent video with no text is a demonstration, not coaching. TFL is a coaching platform.

### Production Roadmap

| Version | What gets added |
|---|---|
| v1 | Short demo + full written coaching |
| v2 | Voice-over coaching video (2-3 min) |
| v3 | Multiple camera angles, on-screen cues |
| v4 | Muscle highlight graphics, interactive coaching |

**Critical architectural point:** the `libraryVersion` field and `mediaHistory` subcollection mean you can ship v1 content and upgrade it to v4 without touching the data model or breaking any workout that references that exercise. Every member automatically gets the improved version.

---

## AI Coaching: Data Contracts

Don't build AI coaching in Phase 1. Do design every data structure as if you will.

The data an AI coach needs to be useful:

| Signal | Where it lives | Collected from Phase |
|---|---|---|
| Training consistency | workoutLogs | 1 |
| Exercise selection patterns | workoutLogs | 1 |
| Strength progression per exercise | personalBests | 1 |
| Workout duration | workoutLogs | 1 |
| Session completion rate | workoutLogs | 1 |
| Resting heart rate trend | profile / healthSnapshot | 2 |
| HRV trend | healthSnapshot | 2 |
| Sleep quality | healthSnapshot | 2 |
| Steps / activity level | healthSnapshot | 2 |
| VO2 Max proxy | profile | 2 |

If you collect this data faithfully from Phase 1, the AI coaching layer in Phase 3 has 18-24 months of signal to work from on day one. That's a meaningful AI coach. An AI coach with one week of data is a chatbot with a gym membership.

---

## The Numbers

For context on why this matters beyond product:

**Revenue model:**
- 100 Premium members at €19.99/month = €1,999/month
- 300 Premium members = €5,997/month
- 500 Premium members = €9,995/month
- 501 Premium members = €10,014/month

The €10k/month target from the app requires approximately 500 active Premium subscribers at €19.99/month, or fewer with a blended rate that includes some annual plans. That's a materially easier target than the same goal at a lower price.

That's a real number. It's not 10,000 users. It's 670 people who love this app enough to pay for it every month.

Every product decision should be evaluated against this question: **does this increase the chance that someone pays for, and stays subscribed to, Training for Life?**

---

## What to Build Next

Given everything above, the recommended build order is:

1. **Firebase data model** — get the schema right before writing any UI. Fix it now costs an hour. Fix it in 6 months costs a week.
2. **Feature flag hook** — one file, unlocks future flexibility.
3. **Exercise library** — data model + admin tooling to add/edit exercises.
4. **Workout Builder** — Premium gate included.
5. **Workout logging** — sets, reps, weight per session.
6. **Personal bests Cloud Function** — auto-calculated, no client trust.
7. **Capability Score v1** — simple, honest, displayed on dashboard.
8. **Premium upgrade flow** — polished, not punishing.

---

*This document is a reference, not a specification. Update it as decisions are made and the platform evolves.*
