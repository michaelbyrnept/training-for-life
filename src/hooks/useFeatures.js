import { useUserProfile } from "./useUserProfile";

const ADMIN_UID = "wKbgHNtTMtS01BQ4ddfAwTQaIgA3";

// Legacy coaching subscription values that imply Premium app access.
// Existing coaching clients paid for coaching — they should get the full app.
const PAID_COACHING_TIERS = ["in-person", "hybrid", "online", "premium", "premium_trial"];

/**
 * Centralised feature flag system.
 *
 * Components NEVER check subscriptionTier directly — they check features here.
 * This means changing what's in Premium requires editing one file, not hunting
 * through every component.
 *
 * Usage:
 *   const features = useFeatures();
 *   if (!features.unlimitedWorkouts) { show upgrade gate }
 */
export function useFeatures() {
  const { user, profile } = useUserProfile();

  const tier = profile?.subscriptionTier ?? "free";
  const status = profile?.subscriptionStatus ?? null;
  const legacySubscription = profile?.subscription ?? "free";

  const isPremium =
    user?.uid === ADMIN_UID ||                                           // Admin always premium
    (tier === "premium" && (status === "active" || status === "trialing")) || // New Stripe subscribers
    PAID_COACHING_TIERS.includes(legacySubscription);                   // Legacy coaching clients

  return {
    // Workout Builder
    unlimitedWorkouts: isPremium,
    maxSavedWorkouts: isPremium ? Infinity : 1,

    // History
    fullWorkoutHistory: isPremium,
    workoutHistoryDays: isPremium ? Infinity : 90,

    // Dashboard & insights
    capabilityScoreFull: isPremium,
    coachTemplates: isPremium,

    // Integrations (Phase 2)
    wearableIntegrations: isPremium,

    // Offline mode — relies on Firebase offline persistence, gated here
    offlineMode: isPremium,

    // Raw values for components that need them
    tier,
    isPremium,
  };
}
