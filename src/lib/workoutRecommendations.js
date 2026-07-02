/**
 * Workout Recommendation Engine
 *
 * Powers the "Start Workout" flow: turns a one-tap split choice into a
 * sequenced, sensible session instead of a blank canvas or an alphabetical
 * exercise dump.
 *
 * How it works:
 *  1. Every split (Full Body, Upper, Push, etc.) is defined as an ordered
 *     list of "slots" (e.g. "Primary compound", "Horizontal push").
 *  2. Each slot lists which movementPatterns satisfy it.
 *  3. Exercises are tagged with a movementPattern in Admin > Exercise Library.
 *     Exercises that haven't been tagged yet fall back to a best-guess
 *     inferred from their name and muscle groups (inferMovementPattern),
 *     so recommendations work from day one even before the whole library
 *     is tagged.
 *  4. buildSessionForSplit walks the slots in order and picks one exercise
 *     per slot. Selection prefers exercises with video (falling back to
 *     the full pool only if nothing in a slot has video yet), avoids
 *     whatever was used in the member's last couple of sessions, and picks
 *     randomly among the remaining qualifying candidates so opening the
 *     same split twice doesn't produce the identical session every time.
 *
 * Nothing here ever locks a member in — every pick is just a starting
 * suggestion. Swap, add, and remove all stay available at all times.
 */

export const MOVEMENT_PATTERNS = [
  { value: "squat", label: "Squat" },
  { value: "hinge", label: "Hinge" },
  { value: "horizontal_push", label: "Horizontal Push" },
  { value: "horizontal_pull", label: "Horizontal Pull" },
  { value: "vertical_push", label: "Vertical Push / Shoulder" },
  { value: "vertical_pull", label: "Vertical Pull" },
  { value: "single_leg", label: "Single Leg" },
  { value: "isolation_legs", label: "Leg Isolation" },
  { value: "isolation_biceps", label: "Biceps" },
  { value: "isolation_triceps", label: "Triceps" },
  { value: "isolation_shoulders", label: "Shoulder Isolation" },
  { value: "core", label: "Core" },
  { value: "carry", label: "Carry" },
  { value: "cardio", label: "Cardio" },
];

const PATTERN_LABEL = Object.fromEntries(MOVEMENT_PATTERNS.map((p) => [p.value, p.label]));
export function patternLabel(pattern) {
  return PATTERN_LABEL[pattern] || pattern;
}

// ─── Heuristic fallback for untagged exercises ───────────────────────────────
// Used only when exercise.movementPattern is not set. As the library gets
// tagged in Admin, this fallback matters less and less.

const NAME_RULES = [
  [/\b(squat|leg press|hack squat|goblet)\b/i, "squat"],
  [/\b(deadlift|rdl|romanian|good ?morning|hip thrust|glute bridge)\b/i, "hinge"],
  [/\b(lunge|split squat|step[- ]?up|bulgarian)\b/i, "single_leg"],
  [/\b(bench|chest press|push[- ]?up|dip|incline press|decline press|floor press)\b/i, "horizontal_push"],
  [/\b(row|face pull)\b/i, "horizontal_pull"],
  [/\b(shoulder press|overhead press|ohp|arnold press|military press)\b/i, "vertical_push"],
  [/\b(pulldown|pull[- ]?up|chin[- ]?up|lat)\b/i, "vertical_pull"],
  [/\b(leg curl|leg extension|calf raise|adductor|abductor)\b/i, "isolation_legs"],
  [/\b(bicep|curl)\b/i, "isolation_biceps"],
  [/\b(tricep|pushdown|skull ?crusher|kickback|overhead extension)\b/i, "isolation_triceps"],
  [/\b(lateral raise|rear delt|reverse fly|delt fly)\b/i, "isolation_shoulders"],
  [/\b(plank|crunch|pallof|dead ?bug|sit[- ]?up|ab wheel|hollow hold|russian twist)\b/i, "core"],
  [/\b(farmer|carry|sled)\b/i, "carry"],
  [/\b(walk|run|bike|row(ing)? machine|cycle|elliptical)\b/i, "cardio"],
];

export function inferMovementPattern(exercise) {
  if (exercise.movementPattern) return exercise.movementPattern;
  const name = exercise.name || "";
  for (const [regex, pattern] of NAME_RULES) {
    if (regex.test(name)) return pattern;
  }
  if (exercise.type === "cardio") return "cardio";
  const muscles = exercise.muscleGroups?.length ? exercise.muscleGroups : exercise.muscleGroup ? [exercise.muscleGroup] : [];
  if (muscles.includes("Biceps")) return "isolation_biceps";
  if (muscles.includes("Triceps")) return "isolation_triceps";
  if (muscles.includes("Core") || muscles.includes("Abs") || muscles.includes("Obliques")) return "core";
  if (muscles.includes("Shoulders")) return "isolation_shoulders";
  if (muscles.includes("Chest")) return "horizontal_push";
  if (muscles.includes("Back")) return "horizontal_pull";
  if (muscles.some((m) => ["Legs", "Quads", "Hamstrings", "Calves", "Glutes", "Adductors"].includes(m))) return "isolation_legs";
  return null;
}

export function getPattern(exercise) {
  return exercise.movementPattern || inferMovementPattern(exercise);
}

// ─── Split sequencing definitions ────────────────────────────────────────────

export const SPLITS = [
  { id: "full_body", label: "Full Body", subtitle: "Balanced full session" },
  { id: "upper", label: "Upper Body", subtitle: "Push, pull, shoulders, arms" },
  { id: "lower", label: "Lower Body", subtitle: "Squat, hinge, single leg" },
  { id: "push", label: "Push", subtitle: "Chest, shoulders, triceps" },
  { id: "pull", label: "Pull", subtitle: "Back, rear delts, biceps" },
  { id: "legs", label: "Legs", subtitle: "Full lower body focus" },
  { id: "chest", label: "Chest", subtitle: "Chest focus" },
  { id: "back", label: "Back", subtitle: "Back focus" },
  { id: "shoulders", label: "Shoulders", subtitle: "Shoulder focus" },
  { id: "arms", label: "Arms", subtitle: "Biceps and triceps" },
  { id: "core", label: "Core", subtitle: "Core and stability" },
];

export const BUILD_YOUR_OWN = { id: "custom", label: "Build My Own", subtitle: "Start from scratch" };

// Each slot: label shown in the picker's "Recommended for" header, and the
// ordered list of movement patterns that satisfy it. muscleFallback is used
// if nothing in the library matches the pattern yet.
const SLOT_SEQUENCES = {
  full_body: [
    { label: "Primary compound", patterns: ["squat", "hinge"], muscleFallback: ["Legs"] },
    { label: "Horizontal push", patterns: ["horizontal_push"], muscleFallback: ["Chest"] },
    { label: "Horizontal pull", patterns: ["horizontal_pull"], muscleFallback: ["Back"] },
    { label: "Vertical push or shoulder", patterns: ["vertical_push"], muscleFallback: ["Shoulders"] },
    { label: "Lower isolation", patterns: ["isolation_legs"], muscleFallback: ["Legs"] },
    { label: "Arms", patterns: ["isolation_biceps", "isolation_triceps"], muscleFallback: ["Arms"] },
    { label: "Core", patterns: ["core"], muscleFallback: ["Core"] },
  ],
  upper: [
    { label: "Horizontal push", patterns: ["horizontal_push"], muscleFallback: ["Chest"] },
    { label: "Horizontal pull", patterns: ["horizontal_pull"], muscleFallback: ["Back"] },
    { label: "Vertical push or pull", patterns: ["vertical_push", "vertical_pull"], muscleFallback: ["Shoulders", "Back"] },
    { label: "Rear delt / shoulder isolation", patterns: ["isolation_shoulders"], muscleFallback: ["Shoulders"] },
    { label: "Biceps", patterns: ["isolation_biceps"], muscleFallback: ["Biceps"] },
    { label: "Triceps", patterns: ["isolation_triceps"], muscleFallback: ["Triceps"] },
  ],
  lower: [
    { label: "Squat or hinge", patterns: ["squat", "hinge"], muscleFallback: ["Legs"] },
    { label: "Opposite pattern", patterns: ["hinge", "squat"], muscleFallback: ["Legs"] },
    { label: "Single leg", patterns: ["single_leg"], muscleFallback: ["Legs"] },
    { label: "Hamstrings", patterns: ["isolation_legs"], muscleFallback: ["Hamstrings"] },
    { label: "Calves", patterns: ["isolation_legs"], muscleFallback: ["Calves"] },
    { label: "Core", patterns: ["core"], muscleFallback: ["Core"] },
  ],
  push: [
    { label: "Chest compound", patterns: ["horizontal_push"], muscleFallback: ["Chest"] },
    { label: "Shoulder compound", patterns: ["vertical_push"], muscleFallback: ["Shoulders"] },
    { label: "Chest isolation", patterns: ["horizontal_push"], muscleFallback: ["Chest"] },
    { label: "Shoulder isolation", patterns: ["isolation_shoulders"], muscleFallback: ["Shoulders"] },
    { label: "Triceps", patterns: ["isolation_triceps"], muscleFallback: ["Triceps"] },
  ],
  pull: [
    { label: "Back compound, vertical", patterns: ["vertical_pull"], muscleFallback: ["Back"] },
    { label: "Back compound, horizontal", patterns: ["horizontal_pull"], muscleFallback: ["Back"] },
    { label: "Rear delt isolation", patterns: ["isolation_shoulders"], muscleFallback: ["Shoulders"] },
    { label: "Biceps", patterns: ["isolation_biceps"], muscleFallback: ["Biceps"] },
  ],
  legs: [
    { label: "Squat or hinge", patterns: ["squat", "hinge"], muscleFallback: ["Legs"] },
    { label: "Opposite pattern", patterns: ["hinge", "squat"], muscleFallback: ["Legs"] },
    { label: "Single leg", patterns: ["single_leg"], muscleFallback: ["Legs"] },
    { label: "Hamstrings", patterns: ["isolation_legs"], muscleFallback: ["Hamstrings"] },
    { label: "Quads isolation", patterns: ["isolation_legs"], muscleFallback: ["Quads"] },
    { label: "Calves", patterns: ["isolation_legs"], muscleFallback: ["Calves"] },
  ],
  chest: [
    { label: "Chest compound", patterns: ["horizontal_push"], muscleFallback: ["Chest"] },
    { label: "Chest compound, incline", patterns: ["horizontal_push"], muscleFallback: ["Chest"] },
    { label: "Chest isolation", patterns: ["horizontal_push"], muscleFallback: ["Chest"] },
    { label: "Triceps", patterns: ["isolation_triceps"], muscleFallback: ["Triceps"] },
  ],
  back: [
    { label: "Back compound, vertical", patterns: ["vertical_pull"], muscleFallback: ["Back"] },
    { label: "Back compound, horizontal", patterns: ["horizontal_pull"], muscleFallback: ["Back"] },
    { label: "Back isolation", patterns: ["horizontal_pull", "vertical_pull"], muscleFallback: ["Back"] },
    { label: "Biceps", patterns: ["isolation_biceps"], muscleFallback: ["Biceps"] },
  ],
  shoulders: [
    { label: "Shoulder compound", patterns: ["vertical_push"], muscleFallback: ["Shoulders"] },
    { label: "Lateral isolation", patterns: ["isolation_shoulders"], muscleFallback: ["Shoulders"] },
    { label: "Rear delt isolation", patterns: ["isolation_shoulders"], muscleFallback: ["Shoulders"] },
    { label: "Core", patterns: ["core"], muscleFallback: ["Core"] },
  ],
  arms: [
    { label: "Biceps compound", patterns: ["isolation_biceps"], muscleFallback: ["Biceps"] },
    { label: "Triceps compound", patterns: ["isolation_triceps"], muscleFallback: ["Triceps"] },
    { label: "Biceps isolation", patterns: ["isolation_biceps"], muscleFallback: ["Biceps"] },
    { label: "Triceps isolation", patterns: ["isolation_triceps"], muscleFallback: ["Triceps"] },
  ],
  core: [
    { label: "Anti-extension", patterns: ["core"], muscleFallback: ["Abs"] },
    { label: "Anti-rotation", patterns: ["core"], muscleFallback: ["Obliques"] },
    { label: "Flexion", patterns: ["core"], muscleFallback: ["Abs"] },
    { label: "Loaded carry", patterns: ["carry", "core"], muscleFallback: ["Core"] },
  ],
};

export function getSlotsForSplit(splitId) {
  return SLOT_SEQUENCES[splitId] || [];
}

// ─── Selection logic ──────────────────────────────────────────────────────────

function hasVideo(ex) {
  return !!(ex.videoUrl?.trim() || ex.media?.demoUrl?.trim() || ex.media?.demoThumbnailUrl?.trim());
}

function getMuscles(ex) {
  return ex.muscleGroups?.length ? ex.muscleGroups : ex.muscleGroup ? [ex.muscleGroup] : [];
}

/**
 * Restricts a candidate pool to exercises that have a video, when any exist.
 * Falls back to the full pool if nothing in it has video yet, so a slot is
 * never skipped just because that part of the library isn't filmed.
 * Recommendations default to video-backed exercises wherever this is used.
 */
export function preferVideo(candidates) {
  const withVideo = candidates.filter(hasVideo);
  return withVideo.length > 0 ? withVideo : candidates;
}

/**
 * Ranks candidates for a slot: video first, not used recently first, then name.
 * Used for ordering (e.g. swap alternates), not for the primary auto-pick.
 */
function rankCandidates(candidates, recentExerciseIds) {
  return [...candidates].sort((a, b) => {
    const aVideo = hasVideo(a) ? 1 : 0;
    const bVideo = hasVideo(b) ? 1 : 0;
    if (aVideo !== bVideo) return bVideo - aVideo;
    const aRecent = recentExerciseIds.includes(a.id) ? 1 : 0;
    const bRecent = recentExerciseIds.includes(b.id) ? 1 : 0;
    if (aRecent !== bRecent) return aRecent - bRecent; // not-recent first
    return (a.name || "").localeCompare(b.name || "");
  });
}

/**
 * Picks one exercise for a slot: prefers video (defaulting to video-only
 * when available), prefers something not used in the last couple of
 * sessions, then picks randomly among what's left so opening the same
 * split twice doesn't hand back the identical session every time.
 */
function pickCandidate(candidates, recentExerciseIds) {
  const videoPool = preferVideo(candidates);
  const notRecent = videoPool.filter((e) => !recentExerciseIds.includes(e.id));
  const pool = notRecent.length > 0 ? notRecent : videoPool;
  return pool[Math.floor(Math.random() * pool.length)];
}

/**
 * Finds every exercise in the library that could fill a slot.
 */
export function findCandidatesForSlot(slot, allExercises, excludeIds = []) {
  const active = allExercises.filter((e) => e.isActive !== false && !excludeIds.includes(e.id));
  const byPattern = active.filter((e) => slot.patterns.includes(getPattern(e)));
  if (byPattern.length > 0) return byPattern;
  // Fall back to muscle group match if nothing is tagged with the right pattern yet
  return active.filter((e) => getMuscles(e).some((m) => slot.muscleFallback?.includes(m)));
}

/**
 * Builds a full session for a split: one exercise per slot, each carrying
 * its slot label and a short list of alternates for one-tap swap. Selection
 * is randomized among qualifying candidates (see pickCandidate), so the
 * same split builds a different session each time it's opened.
 */
export function buildSessionForSplit(splitId, allExercises, recentExerciseIds = []) {
  const slots = getSlotsForSplit(splitId);
  const usedIds = [];
  const session = [];

  slots.forEach((slot) => {
    const candidates = findCandidatesForSlot(slot, allExercises, usedIds);
    if (candidates.length === 0) return; // nothing in the library for this slot yet, skip it
    const chosen = pickCandidate(candidates, recentExerciseIds);
    usedIds.push(chosen.id);
    const alternates = rankCandidates(candidates.filter((e) => e.id !== chosen.id), recentExerciseIds);
    session.push(
      workoutExerciseFromLibrary(chosen, {
        slotLabel: slot.label,
        alternateIds: alternates.slice(0, 3).map((e) => e.id),
      })
    );
  });

  return session;
}

/**
 * Converts a library exercise into the shape stored on a workout, applying
 * sensible defaults (the exercise's own defaults if set, otherwise 3x8-12).
 */
export function workoutExerciseFromLibrary(exercise, extra = {}) {
  const repsMin = exercise.repsMin || 8;
  const repsMax = exercise.repsMax || exercise.defaultReps || 12;
  return {
    exerciseId: exercise.id,
    exerciseName: exercise.name,
    sets: exercise.defaultSets || 3,
    reps: repsMin === repsMax ? String(repsMax) : `${repsMin}-${repsMax}`,
    weight: "",
    restSeconds: 90,
    notes: "",
    ...extra,
  };
}

/**
 * Same-pattern alternatives for the Swap action. Prefers video-backed
 * exercises, same as the primary recommendation pool.
 */
export function getSwapAlternatives(currentExercise, allExercises, allLibraryExercises) {
  const libEx = allLibraryExercises.find((e) => e.id === currentExercise.exerciseId);
  const pattern = libEx ? getPattern(libEx) : null;
  const usedIds = allExercises.map((e) => e.exerciseId);
  const candidates = allLibraryExercises.filter(
    (e) => e.id !== currentExercise.exerciseId && !usedIds.includes(e.id) && (pattern ? getPattern(e) === pattern : true)
  );
  return preferVideo(candidates);
}

// ─── "What's next" pairing suggestions ───────────────────────────────────────

const NEXT_PATTERN_PAIRINGS = {
  horizontal_push: ["isolation_triceps", "isolation_shoulders", "horizontal_push"],
  hinge: ["single_leg", "isolation_legs"],
  squat: ["isolation_legs", "single_leg"],
  vertical_push: ["isolation_shoulders", "isolation_triceps"],
  horizontal_pull: ["isolation_biceps", "vertical_pull"],
  vertical_pull: ["isolation_biceps", "horizontal_pull"],
  single_leg: ["isolation_legs", "core"],
};

/**
 * After an exercise is marked complete, suggest 2-3 exercises that commonly
 * follow it, based on a static movement-pairing table (Phase 1 — no ML
 * needed). Prefers video-backed exercises. Never blocks, purely additive.
 * Pattern-based, not split-based, so this works identically whether the
 * session came from a split or from Build My Own.
 */
export function getNextSuggestions(justCompletedLibraryExercise, allLibraryExercises, alreadyUsedIds = []) {
  if (!justCompletedLibraryExercise) return [];
  const pattern = getPattern(justCompletedLibraryExercise);
  const nextPatterns = NEXT_PATTERN_PAIRINGS[pattern];
  if (!nextPatterns) return [];
  const candidates = allLibraryExercises.filter(
    (e) => e.id !== justCompletedLibraryExercise.id && !alreadyUsedIds.includes(e.id) && nextPatterns.includes(getPattern(e))
  );
  return rankCandidates(preferVideo(candidates), []).slice(0, 3);
}
