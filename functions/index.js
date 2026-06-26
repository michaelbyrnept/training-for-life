const {setGlobalOptions} = require("firebase-functions");
const {onCall, onRequest, HttpsError} = require("firebase-functions/v2/https");
const {onDocumentCreated, onDocumentUpdated} = require("firebase-functions/v2/firestore");
const {onSchedule} = require("firebase-functions/v2/scheduler");
const {defineSecret} = require("firebase-functions/params");
const logger = require("firebase-functions/logger");
const {initializeApp} = require("firebase-admin/app");
const {getFirestore, FieldValue, Timestamp} = require("firebase-admin/firestore");

setGlobalOptions({ maxInstances: 10 });

initializeApp();
const db = getFirestore();

const anthropicApiKey = defineSecret("ANTHROPIC_API_KEY");
const zapierWebhookSecret = defineSecret("ZAPIER_WEBHOOK_SECRET");

// Admin-only: export consented free users as CSV for Brevo import
exports.exportConsentedUsers = onCall(async (request) => {
  if (!request.auth) throw new HttpsError("unauthenticated", "Must be logged in.");

  const adminDoc = await db.collection("users").doc(request.auth.uid).get();
  if (adminDoc.data()?.tier !== "admin") throw new HttpsError("permission-denied", "Admins only.");

  const snapshot = await db.collection("users").where("marketingConsent", "==", true).get();

  const rows = ["EMAIL,FIRSTNAME"];
  snapshot.forEach((doc) => {
    const d = doc.data();
    const isFree = !d.subscription || d.subscription === "free" || d.subscriptionTier === "free";
    if (isFree && d.email) {
      rows.push(`${d.email.toLowerCase().trim()},${d.firstName || ""}`);
    }
  });

  return { csv: rows.join("\n"), count: rows.length - 1 };
});

exports.generateRunningPlan = onCall(
  { secrets: [anthropicApiKey] },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "You must be logged in.");
    }

    const { prompt } = request.data;
    if (!prompt || typeof prompt !== "string") {
      throw new HttpsError("invalid-argument", "A prompt string is required.");
    }

    try {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": anthropicApiKey.value(),
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({
          model: "claude-sonnet-4-6",
          max_tokens: 8000,
          messages: [{ role: "user", content: prompt }],
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        logger.error("Anthropic API returned an error", { status: response.status, data });
        throw new HttpsError("internal", `Anthropic API error: ${data.error?.message || "unknown"}`);
      }

      const text = data.content?.map(c => c.text || "").join("") || "";
      return { text };
    } catch (e) {
      logger.error("Anthropic API call failed", e);
      throw new HttpsError("internal", "Failed to generate plan.");
    }
  }
);


// ─── MEANINGFUL MOMENTS ENGINE ─────────────────────────────────────────────

const ADMIN_UID = "wKbgHNtTMtS01BQ4ddfAwTQaIgA3";
const WORKOUT_THRESHOLDS = [1, 10, 25, 50, 100, 200, 500];
const SESSION_THRESHOLDS = [10, 25, 50, 100];
const WEIGHT_LOSS_THRESHOLDS = [2, 5, 10, 15, 20];
const WEIGHT_GAIN_THRESHOLDS = [2, 5, 10];
const ANNIVERSARY_DAYS = [30, 90, 180, 365, 730];

/**
 * Shared helper: check if a milestone already exists, and if not write
 * milestone + clientTimeline + coachNotification in a single batch.
 */
async function writeMilestoneIfNew({ clientId, clientName, type, category, title, description, value, unit, priority, achievedAt }) {
  const existing = await db.collection("milestones")
    .where("clientId", "==", clientId)
    .where("type", "==", type)
    .limit(1)
    .get();

  if (!existing.empty) return null; // already recorded

  const now = Timestamp.now();
  const milestoneRef = db.collection("milestones").doc();
  const timelineRef = db.collection("clientTimeline").doc();
  const notifRef = db.collection("coachNotifications").doc();

  const milestone = {
    clientId,
    clientName,
    type,
    category,
    title,
    description,
    value: value ?? null,
    unit: unit ?? null,
    priority,
    detectedAt: now,
    achievedAt: achievedAt || now,
    recognised: false,
    recognisedAt: null,
    recognitionMethod: null,
    coachNote: null,
    timelineEntry: true,
    notificationSent: true,
    customMilestoneId: null,
    createdAt: now,
  };

  const timeline = {
    clientId,
    date: achievedAt || now,
    type: "milestone",
    title,
    description,
    icon: category === "Weight" ? "⚖️" : category === "Workout" ? "🏋️" : category === "Strength" ? "💪" : category === "Habit" ? "🔥" : category === "Coaching" ? "🏆" : "⭐",
    highlight: priority === "high",
    milestoneId: milestoneRef.id,
    sessionId: null,
    createdAt: now,
  };

  const notification = {
    milestoneId: milestoneRef.id,
    clientId,
    clientName,
    title: buildNotificationTitle(clientName, title),
    body: description,
    read: false,
    readAt: null,
    createdAt: now,
  };

  const batch = db.batch();
  batch.set(milestoneRef, milestone);
  batch.set(timelineRef, timeline);
  batch.set(notifRef, notification);
  await batch.commit();

  logger.info(`Milestone recorded: ${type} for ${clientName} (${clientId})`);
  return milestoneRef.id;
}

function buildNotificationTitle(name, milestoneTitle) {
  const first = name.split(" ")[0];
  // Map milestone titles to natural coach notification phrases
  if (milestoneTitle.includes("1st workout") || milestoneTitle.includes("First workout")) return `${first} has just completed their first workout`;
  if (milestoneTitle.includes("workouts")) return `${first} has completed ${milestoneTitle.replace(" Workouts Completed", "")} workouts`;
  if (milestoneTitle.includes("kg lost")) return `${first} has officially lost ${milestoneTitle.replace(" Lost", "")}`;
  if (milestoneTitle.includes("kg gained")) return `${first} has gained ${milestoneTitle.replace(" Gained", "")}`;
  if (milestoneTitle.includes("month") || milestoneTitle.includes("year")) return `${first} has been with you for ${milestoneTitle.replace(" Coaching", "")}`;
  if (milestoneTitle.includes("sessions completed")) return `${first} has completed ${milestoneTitle.replace(" Sessions Completed", "")} personal training sessions`;
  return `${first}: ${milestoneTitle}`;
}

async function getClientName(clientId) {
  const snap = await db.collection("users").doc(clientId).get();
  if (!snap.exists) return "Client";
  const d = snap.data();
  return [d.firstName, d.lastName].filter(Boolean).join(" ") || d.nickname || d.email || "Client";
}

// ─── WORKOUT MILESTONE DETECTOR ────────────────────────────────────────────
exports.onWorkoutLogged = onDocumentCreated("workoutLogs/{docId}", async (event) => {
  const log = event.data.data();
  const clientId = log.userId;
  if (!clientId || clientId === ADMIN_UID) return;

  // Increment counter atomically
  const userRef = db.collection("users").doc(clientId);
  await userRef.update({ workoutCount: FieldValue.increment(1) });
  const userSnap = await userRef.get();
  const userData = userSnap.data() || {};
  const count = userData.workoutCount || 1;
  const clientName = await getClientName(clientId);

  // Check fixed thresholds
  if (WORKOUT_THRESHOLDS.includes(count)) {
    const label = count === 1 ? "First Workout Completed" : `${count} Workouts Completed`;
    await writeMilestoneIfNew({
      clientId,
      clientName,
      type: `workout_${count}`,
      category: "Workout",
      title: label,
      description: `${clientName.split(" ")[0]} has now completed ${count} workout${count === 1 ? "" : "s"} on Training for Life.`,
      value: count,
      unit: "workouts",
      priority: count >= 10 ? "high" : "medium",
      achievedAt: Timestamp.now(),
    });
  }

  // Check streak (7 and 30 day)
  await checkStreakMilestones(clientId, clientName);
});

async function checkStreakMilestones(clientId, clientName) {
  const logsSnap = await db.collection("workoutLogs")
    .where("userId", "==", clientId)
    .orderBy("completedAt", "desc")
    .limit(100)
    .get();

  if (logsSnap.empty) return;

  // Build a set of unique day strings
  const days = new Set();
  logsSnap.docs.forEach(d => {
    const ts = d.data().completedAt;
    if (!ts) return;
    const date = ts.toDate ? ts.toDate() : new Date(ts);
    days.add(date.toISOString().split("T")[0]);
  });

  const sorted = Array.from(days).sort().reverse();
  let streak = 1;
  for (let i = 0; i < sorted.length - 1; i++) {
    const curr = new Date(sorted[i]);
    const prev = new Date(sorted[i + 1]);
    const diffDays = (curr - prev) / 86400000;
    if (diffDays <= 1) { streak++; } else { break; }
  }

  for (const target of [7, 30, 100]) {
    if (streak >= target) {
      await writeMilestoneIfNew({
        clientId,
        clientName,
        type: `streak_${target}d`,
        category: "Habit",
        title: `${target}-Day Training Streak`,
        description: `${clientName.split(" ")[0]} has trained on ${target} consecutive days. That is a real habit.`,
        value: target,
        unit: "days",
        priority: target >= 30 ? "high" : "medium",
        achievedAt: Timestamp.now(),
      });
    }
  }
}

// ─── SESSION MILESTONE DETECTOR ────────────────────────────────────────────
exports.onSessionOutcome = onDocumentUpdated("sessions/{docId}", async (event) => {
  const before = event.data.before.data();
  const after = event.data.after.data();

  // Only fire when status changes to completed
  if (before.status === after.status) return;
  if (after.status !== "completed") return;

  const clientId = after.clientId;
  if (!clientId || clientId === ADMIN_UID) return;

  const userRef = db.collection("users").doc(clientId);
  await userRef.update({ completedSessionCount: FieldValue.increment(1) });
  const userSnap = await userRef.get();
  const count = (userSnap.data() || {}).completedSessionCount || 1;
  const clientName = await getClientName(clientId);

  if (SESSION_THRESHOLDS.includes(count)) {
    await writeMilestoneIfNew({
      clientId,
      clientName,
      type: `sessions_${count}`,
      category: "Coaching",
      title: `${count} Sessions Completed`,
      description: `${clientName.split(" ")[0]} has now completed ${count} personal training sessions. A serious body of work.`,
      value: count,
      unit: "sessions",
      priority: "high",
      achievedAt: Timestamp.now(),
    });
  }
});

// ─── WEIGHT MILESTONE DETECTOR ─────────────────────────────────────────────
exports.onMetricLogged = onDocumentCreated("metricLogs/{docId}", async (event) => {
  const log = event.data.data();
  const clientId = log.userId || log.clientId;
  if (!clientId || clientId === ADMIN_UID) return;

  const metricKey = (log.metricKey || log.key || "").toLowerCase();
  if (!["weight", "bodyweight", "body_weight"].includes(metricKey)) return;

  const currentWeight = parseFloat(log.value);
  if (isNaN(currentWeight)) return;

  const clientName = await getClientName(clientId);

  // Get all weight logs to find baseline (first ever entry)
  const allLogsSnap = await db.collection("metricLogs")
    .where("userId", "==", clientId)
    .orderBy("loggedAt", "asc")
    .limit(200)
    .get();

  const weightLogs = allLogsSnap.docs
    .map(d => d.data())
    .filter(d => ["weight", "bodyweight", "body_weight"].includes((d.metricKey || d.key || "").toLowerCase()))
    .map(d => parseFloat(d.value))
    .filter(v => !isNaN(v));

  if (weightLogs.length < 2) return;

  const baseline = weightLogs[0];
  const totalLoss = baseline - currentWeight;
  const totalGain = currentWeight - baseline;

  if (totalLoss > 0) {
    for (const threshold of WEIGHT_LOSS_THRESHOLDS) {
      if (totalLoss >= threshold) {
        await writeMilestoneIfNew({
          clientId,
          clientName,
          type: `weight_loss_${threshold}kg`,
          category: "Weight",
          title: `${threshold}kg Lost`,
          description: `${clientName.split(" ")[0]} has lost ${threshold}kg since starting. Started at ${baseline.toFixed(1)}kg, now at ${currentWeight.toFixed(1)}kg.`,
          value: threshold,
          unit: "kg",
          priority: "high",
          achievedAt: Timestamp.now(),
        });
      }
    }
  }

  if (totalGain > 0) {
    for (const threshold of WEIGHT_GAIN_THRESHOLDS) {
      if (totalGain >= threshold) {
        await writeMilestoneIfNew({
          clientId,
          clientName,
          type: `weight_gain_${threshold}kg`,
          category: "Weight",
          title: `${threshold}kg Gained`,
          description: `${clientName.split(" ")[0]} has gained ${threshold}kg since starting. Started at ${baseline.toFixed(1)}kg, now at ${currentWeight.toFixed(1)}kg.`,
          value: threshold,
          unit: "kg",
          priority: "high",
          achievedAt: Timestamp.now(),
        });
      }
    }
  }
});

// ─── BUNDLE COMPLETION DETECTOR ────────────────────────────────────────────
exports.onWalletTransaction = onDocumentCreated("walletTransactions/{docId}", async (event) => {
  const tx = event.data.data();
  const clientId = tx.clientId;
  if (!clientId || clientId === ADMIN_UID) return;
  if ((tx.amount || 0) >= 0) return; // only deductions

  // Sum all transactions to get current balance
  const allTxSnap = await db.collection("walletTransactions")
    .where("clientId", "==", clientId)
    .get();
  const balance = allTxSnap.docs.reduce((sum, d) => sum + (d.data().amount || 0), 0);

  if (balance > 0) return; // still has credits

  // Find most recent bundle purchase to get bundle name
  const purchasesSnap = await db.collection("bundlePurchases")
    .where("clientId", "==", clientId)
    .orderBy("purchasedAt", "desc")
    .limit(1)
    .get();
  const bundleName = purchasesSnap.empty ? "a session bundle" : (purchasesSnap.docs[0].data().bundleName || "a session bundle");
  const clientName = await getClientName(clientId);

  await writeMilestoneIfNew({
    clientId,
    clientName,
    type: `bundle_completed_${Date.now()}`, // unique per completion
    category: "Coaching",
    title: "Bundle Completed",
    description: `${clientName.split(" ")[0]} has used all sessions from ${bundleName}. Time to discuss their next steps.`,
    value: null,
    unit: null,
    priority: "high",
    achievedAt: Timestamp.now(),
  });
});

// ─── COACHING ANNIVERSARY DETECTOR (daily at 07:00 IST) ───────────────────
exports.checkAnniversaries = onSchedule("0 6 * * *", async () => {
  // 06:00 UTC = 07:00 IST
  const usersSnap = await db.collection("users")
    .where("subscription", "in", ["in-person", "hybrid", "online", "premium", "premium_trial"])
    .get();

  const now = new Date();

  for (const userDoc of usersSnap.docs) {
    const data = userDoc.data();
    const clientId = userDoc.id;
    if (clientId === ADMIN_UID) continue;

    const createdAt = data.createdAt ? new Date(data.createdAt) : null;
    if (!createdAt) continue;

    const diffDays = Math.floor((now - createdAt) / 86400000);
    const clientName = [data.firstName, data.lastName].filter(Boolean).join(" ") || data.nickname || "Client";

    for (const days of ANNIVERSARY_DAYS) {
      if (diffDays !== days) continue;

      const months = days >= 365 ? `${days / 365} year${days / 365 === 1 ? "" : "s"}` : `${Math.round(days / 30)} months`;
      await writeMilestoneIfNew({
        clientId,
        clientName,
        type: `coaching_${days}d`,
        category: "Coaching",
        title: `${months} Coaching`,
        description: `${clientName.split(" ")[0]} joined ${months} ago today. ${diffDays >= 365 ? "A huge commitment and a real relationship." : "A great start to a long journey."}`,
        value: days,
        unit: "days",
        priority: "high",
        achievedAt: Timestamp.now(),
      });
    }

    // Annual recurrence after year 1
    if (diffDays > 365 && diffDays % 365 === 0) {
      const years = diffDays / 365;
      await writeMilestoneIfNew({
        clientId,
        clientName,
        type: `coaching_anniversary_${years}y`,
        category: "Coaching",
        title: `${years} Year${years === 1 ? "" : "s"} Coaching`,
        description: `${clientName.split(" ")[0]} has now been training with you for ${years} year${years === 1 ? "" : "s"}. That is a real coaching relationship.`,
        value: years,
        unit: "years",
        priority: "high",
        achievedAt: Timestamp.now(),
      });
    }
  }

  logger.info("Anniversary check complete");
});

// ─── STRENGTH / PERSONAL BEST DETECTOR ────────────────────────────────────
// Triggered when a coach logs an exercise metric (weight lifted, reps, etc.)
// Collection: exerciseMetricLogs — expected fields:
//   clientId, exerciseName, metricType (weight|reps|time), value (number), loggedAt (Timestamp)

const NAMED_STRENGTH_MILESTONES = [
  { exercise: "pull-up",   metricType: "reps",   threshold: 1,   title: "First Pull-Up",         priority: "high" },
  { exercise: "push-up",   metricType: "reps",   threshold: 1,   title: "First Push-Up",         priority: "medium" },
  { exercise: "squat",     metricType: "reps",   threshold: 1,   title: "First Bodyweight Squat", priority: "medium" },
  { exercise: "deadlift",  metricType: "weight", threshold: 100, title: "100kg Deadlift",        priority: "high" },
  { exercise: "deadlift",  metricType: "weight", threshold: 140, title: "140kg Deadlift",        priority: "high" },
  { exercise: "squat",     metricType: "weight", threshold: 100, title: "100kg Squat",           priority: "high" },
  { exercise: "bench press", metricType: "weight", threshold: 100, title: "100kg Bench Press",   priority: "high" },
];

exports.onExerciseMetricLogged = onDocumentCreated("exerciseMetricLogs/{docId}", async (event) => {
  const log = event.data.data();
  const clientId = log.clientId;
  if (!clientId || clientId === ADMIN_UID) return;

  const exerciseName = (log.exerciseName || "").toLowerCase().trim();
  const metricType = (log.metricType || "weight").toLowerCase();
  const value = parseFloat(log.value);
  if (!exerciseName || isNaN(value)) return;

  const clientName = await getClientName(clientId);
  const firstName = clientName.split(" ")[0];

  // 1. Check named milestones
  for (const nm of NAMED_STRENGTH_MILESTONES) {
    if (exerciseName.includes(nm.exercise) && metricType === nm.metricType && value >= nm.threshold) {
      await writeMilestoneIfNew({
        clientId,
        clientName,
        type: `strength_${nm.exercise.replace(/\s+/g, "_")}_${nm.threshold}${nm.metricType === "weight" ? "kg" : "reps"}`,
        category: "Strength",
        title: nm.title,
        description: `${firstName} has achieved ${nm.title.toLowerCase()} — a significant strength milestone.`,
        value: nm.threshold,
        unit: nm.metricType === "weight" ? "kg" : "reps",
        priority: nm.priority,
        achievedAt: log.loggedAt || Timestamp.now(),
      });
    }
  }

  // 2. Personal best detection — compare against all prior logs for this exercise + metric
  const priorSnap = await db.collection("exerciseMetricLogs")
    .where("clientId", "==", clientId)
    .where("exerciseName", "==", log.exerciseName)
    .where("metricType", "==", log.metricType)
    .orderBy("loggedAt", "asc")
    .get();

  const priorValues = priorSnap.docs
    .map(d => parseFloat(d.data().value))
    .filter(v => !isNaN(v));

  // Need at least one prior entry to compare against
  if (priorValues.length < 2) return;

  const previousBest = Math.max(...priorValues.slice(0, -1)); // exclude current
  if (value <= previousBest) return; // not a PB

  const unit = metricType === "weight" ? "kg" : metricType === "time" ? "s" : "reps";
  const displayExercise = log.exerciseName || exerciseName;

  await writeMilestoneIfNew({
    clientId,
    clientName,
    // Use a time-bucketed key so each month can have at most one PB milestone per exercise
    type: `pb_${exerciseName.replace(/\s+/g, "_")}_${new Date().getFullYear()}_${new Date().getMonth()}`,
    category: "Strength",
    title: `New PB — ${displayExercise}`,
    description: `${firstName} hit a new personal best on ${displayExercise}: ${value}${unit} (previous best: ${previousBest}${unit}).`,
    value,
    unit,
    priority: "high",
    achievedAt: log.loggedAt || Timestamp.now(),
  });
});

// ─── END MEANINGFUL MOMENTS ENGINE ─────────────────────────────────────────

// ─── ADMIN: GENERATE PASSWORD RESET LINK ──────────────────────────────────
exports.adminGenerateResetLink = onCall(
  async (request) => {
    if (!request.auth || request.auth.uid !== ADMIN_UID) {
      throw new HttpsError("permission-denied", "Admin only.");
    }

    const { email } = request.data;
    if (!email) throw new HttpsError("invalid-argument", "email is required.");

    const { getAuth: getAdminAuth } = require("firebase-admin/auth");
    try {
      const link = await getAdminAuth().generatePasswordResetLink(email);
      return { link };
    } catch (err) {
      throw new HttpsError("internal", err.message);
    }
  }
);

// ─── ADMIN: CREATE CLIENT ACCOUNT ─────────────────────────────────────────
// Creates a Firebase Auth user + Firestore profile without sending any email.
// Admin then sets up their programme; sends welcome separately via the profile.

exports.adminCreateClient = onCall(
  { invoker: "public" },
  async (request) => {
    if (!request.auth || request.auth.uid !== ADMIN_UID) {
      throw new HttpsError("permission-denied", "Admin only.");
    }

    const { firstName, lastName, email, subscription } = request.data;
    if (!email || !firstName) throw new HttpsError("invalid-argument", "First name and email are required.");

    const { getAuth: getAdminAuth } = require("firebase-admin/auth");
    const adminAuth = getAdminAuth();

    // Generate a secure temporary password — client will reset via welcome email
    const tempPassword = Math.random().toString(36).slice(-8) +
                         Math.random().toString(36).slice(-4).toUpperCase() + "1!";

    let userRecord;
    try {
      userRecord = await adminAuth.createUser({
        email: email.toLowerCase(),
        password: tempPassword,
        displayName: [firstName, lastName].filter(Boolean).join(" "),
        emailVerified: false,
      });
    } catch (err) {
      if (err.code === "auth/email-already-exists") {
        throw new HttpsError("already-exists", "An account with this email already exists.");
      }
      throw new HttpsError("internal", err.message);
    }

    await db.collection("users").doc(userRecord.uid).set({
      firstName,
      lastName: lastName || "",
      email: email.toLowerCase(),
      subscription: subscription || "free",
      createdAt: new Date().toISOString(),
      adminCreated: true,
      welcomeSent: false,
    });

    logger.info(`Admin created client: ${email} (${userRecord.uid})`);
    return { uid: userRecord.uid };
  }
);

// ─── STRIPE ────────────────────────────────────────────────────────────────

const stripeSecretKey = defineSecret("STRIPE_SECRET_KEY");
const stripeWebhookSecret = defineSecret("STRIPE_WEBHOOK_SECRET");

/**
 * createCheckoutSession — callable
 * data: { type: "bundle"|"subscription"|"onetime", bundleId?, priceId?, amount?, currency?, name?, successUrl, cancelUrl }
 * returns: { url }
 */
exports.createCheckoutSession = onCall(
  { secrets: [stripeSecretKey], invoker: "public" },
  async (request) => {
    if (!request.auth) throw new HttpsError("unauthenticated", "Login required.");

    const { type, bundleId, priceId, amount, currency, name, successUrl, cancelUrl } = request.data;
    const stripe = require("stripe")(stripeSecretKey.value());

    const sessionParams = {
      mode: type === "subscription" ? "subscription" : "payment",
      success_url: successUrl,
      cancel_url: cancelUrl,
      client_reference_id: request.auth.uid,
      metadata: {
        clientId: request.auth.uid,
        type: type || "onetime",
        bundleId: bundleId || "",
      },
    };

    if (type === "bundle" && bundleId) {
      const bundleSnap = await db.collection("sessionBundles").doc(bundleId).get();
      if (!bundleSnap.exists) throw new HttpsError("not-found", "Bundle not found.");
      const bundle = bundleSnap.data();
      sessionParams.line_items = [{
        price_data: {
          currency: "eur",
          unit_amount: Math.round((bundle.price || 0) * 100),
          product_data: { name: bundle.name || "Session Bundle" },
        },
        quantity: 1,
      }];
      sessionParams.metadata.bundleName = bundle.name || "Session Bundle";
      sessionParams.metadata.sessionCredits = String(bundle.sessionCredits || bundle.sessions || bundle.credits || 0);
    } else if (type === "subscription" && priceId) {
      sessionParams.line_items = [{ price: priceId, quantity: 1 }];
      sessionParams.metadata.priceId = priceId;
    } else if (type === "onetime" && amount) {
      sessionParams.line_items = [{
        price_data: {
          currency: currency || "eur",
          unit_amount: Math.round(amount * 100),
          product_data: { name: name || "Payment" },
        },
        quantity: 1,
      }];
    } else {
      throw new HttpsError("invalid-argument", "Invalid checkout parameters.");
    }

    const session = await stripe.checkout.sessions.create(sessionParams);
    return { url: session.url };
  }
);

/**
 * stripeWebhook — HTTP endpoint for Stripe events
 * Handles: checkout.session.completed, customer.subscription.deleted
 */
exports.stripeWebhook = onRequest(
  { secrets: [stripeSecretKey, stripeWebhookSecret] },
  async (req, res) => {
    if (req.method !== "POST") return res.status(405).send("Method not allowed");

    const stripe = require("stripe")(stripeSecretKey.value());
    const sig = req.headers["stripe-signature"];
    let event;

    try {
      event = stripe.webhooks.constructEvent(req.rawBody, sig, stripeWebhookSecret.value());
    } catch (err) {
      logger.error("Stripe webhook signature failed", err.message);
      return res.status(400).send(`Webhook Error: ${err.message}`);
    }

    if (event.type === "checkout.session.completed") {
      const session = event.data.object;
      const clientId = session.client_reference_id || session.metadata?.clientId;
      const type = session.metadata?.type;
      const bundleId = session.metadata?.bundleId;
      const now = Timestamp.now();

      if (!clientId) {
        logger.error("No clientId in Stripe session", { sessionId: session.id });
        return res.status(200).send("OK");
      }

      if (type === "bundle" && bundleId) {
        const bundleName = session.metadata?.bundleName || "Session Bundle";
        const sessionCredits = parseInt(session.metadata?.sessionCredits || "0", 10);
        const amountPaid = (session.amount_total || 0) / 100;

        const batch = db.batch();
        const purchaseRef = db.collection("bundlePurchases").doc();
        batch.set(purchaseRef, {
          clientId,
          bundleId,
          bundleName,
          sessions: sessionCredits,
          amountPaid,
          currency: session.currency || "eur",
          stripeSessionId: session.id,
          purchasedAt: now,
          status: "active",
        });
        const txRef = db.collection("walletTransactions").doc();
        batch.set(txRef, {
          clientId,
          amount: sessionCredits,
          type: "credit",
          description: `Purchased: ${bundleName}`,
          bundlePurchaseId: purchaseRef.id,
          stripeSessionId: session.id,
          createdAt: now,
        });
        await batch.commit();
        logger.info(`Bundle purchase: ${clientId} bought ${bundleName} (+${sessionCredits} credits)`);

      } else if (type === "subscription") {
        await db.collection("users").doc(clientId).update({
          subscription: "online",
          stripeSubscriptionId: session.subscription || null,
          stripeCustomerId: session.customer || null,
          subscriptionActivatedAt: now,
          // Premium app tier fields
          subscriptionTier: "premium",
          subscriptionStatus: session.subscription ? "active" : "trialing",
        });
        logger.info(`Subscription activated: ${clientId}`);

      } else if (type === "onetime") {
        const amountPaid = (session.amount_total || 0) / 100;
        await db.collection("walletTransactions").doc().set({
          clientId,
          amount: amountPaid,
          type: "onetime_payment",
          description: `Payment: €${amountPaid.toFixed(2)}`,
          stripeSessionId: session.id,
          createdAt: now,
        });
        logger.info(`One-off payment: ${clientId} paid €${amountPaid}`);
      }
    }

    if (event.type === "customer.subscription.deleted") {
      const sub = event.data.object;
      const usersSnap = await db.collection("users")
        .where("stripeCustomerId", "==", sub.customer)
        .limit(1)
        .get();
      if (!usersSnap.empty) {
        await usersSnap.docs[0].ref.update({
          subscription: "free",
          stripeSubscriptionId: null,
          subscriptionCancelledAt: Timestamp.now(),
          subscriptionTier: "free",
          subscriptionStatus: "cancelled",
        });
        logger.info(`Subscription cancelled: customer ${sub.customer}`);
      }
    }

    // Handle subscription status changes (past_due, trialing, etc.)
    if (event.type === "customer.subscription.updated") {
      const sub = event.data.object;
      const usersSnap = await db.collection("users")
        .where("stripeCustomerId", "==", sub.customer)
        .limit(1)
        .get();
      if (!usersSnap.empty) {
        const status = sub.status; // active | trialing | past_due | canceled | etc.
        const isPremium = status === "active" || status === "trialing";
        await usersSnap.docs[0].ref.update({
          subscriptionStatus: status,
          subscriptionTier: isPremium ? "premium" : "free",
        });
        logger.info(`Subscription updated: customer ${sub.customer} -> ${status}`);
      }
    }

    return res.status(200).send("OK");
  }
);

/**
 * createPortalSession — callable
 * Returns a Stripe Customer Portal URL so clients can manage subscriptions
 */
exports.createPortalSession = onCall(
  { secrets: [stripeSecretKey], invoker: "public" },
  async (request) => {
    if (!request.auth) throw new HttpsError("unauthenticated", "Login required.");

    const stripe = require("stripe")(stripeSecretKey.value());
    const { returnUrl } = request.data;

    const userSnap = await db.collection("users").doc(request.auth.uid).get();
    const customerId = userSnap.data()?.stripeCustomerId;
    if (!customerId) throw new HttpsError("not-found", "No Stripe customer found for this account.");

    const portalSession = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: returnUrl || "https://trainingforlife.ie/profile",
    });

    return { url: portalSession.url };
  }
);

// ─── END STRIPE ─────────────────────────────────────────────────────────────

exports.adminDeleteClient = onCall(
  { invoker: "public" },
  async (request) => {
    if (!request.auth || request.auth.uid !== ADMIN_UID) {
      throw new HttpsError("permission-denied", "Admin only.");
    }
    const { uid } = request.data;
    if (!uid || typeof uid !== "string") {
      throw new HttpsError("invalid-argument", "uid required.");
    }
    if (uid === ADMIN_UID) {
      throw new HttpsError("invalid-argument", "Cannot delete admin account.");
    }
    const { getAuth: getAdminAuth } = require("firebase-admin/auth");
    // Delete Firebase Auth user
    try {
      await getAdminAuth().deleteUser(uid);
    } catch (e) {
      if (e.code !== "auth/user-not-found") throw e;
    }
    // Delete Firestore user doc
    await db.collection("users").doc(uid).delete();
    return { success: true };
  }
);

// ─── PAST CLIENT IMPORT SYSTEM ────────────────────────────────────────────

const crypto = require("crypto");

const SITE_URL = "https://trainingforlife.ie";
const TOKEN_TTL_DAYS = 30;

/**
 * importPastClients — admin only callable
 * data: { rows: [{ firstName, lastName, email, ...extras }], filename: string }
 * Returns a full import report including activation URLs.
 */
exports.importPastClients = onCall(
  async (request) => {
    if (!request.auth || request.auth.uid !== ADMIN_UID) {
      throw new HttpsError("permission-denied", "Admin only.");
    }

    const { rows, filename } = request.data;
    if (!Array.isArray(rows) || rows.length === 0) {
      throw new HttpsError("invalid-argument", "rows array is required and must not be empty.");
    }

    const { getAuth: getAdminAuth } = require("firebase-admin/auth");
    const adminAuth = getAdminAuth();

    const now = Timestamp.now();
    const adminUid = request.auth.uid;
    const batchId = db.collection("importBatches").doc().id;
    const expiresAt = Timestamp.fromDate(new Date(Date.now() + TOKEN_TTL_DAYS * 86400000));

    const report = [];

    for (const row of rows) {
      const email = (row.email || "").trim().toLowerCase();
      const firstName = (row.firstName || "").trim();
      const lastName = (row.lastName || "").trim();

      // Basic validation
      if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        report.push({ email, firstName, lastName, status: "invalid", reason: "Invalid email format" });
        continue;
      }
      if (!firstName) {
        report.push({ email, firstName, lastName, status: "invalid", reason: "First name is required" });
        continue;
      }

      // Check for existing account
      let existingUser = null;
      try {
        existingUser = await adminAuth.getUserByEmail(email);
      } catch (err) {
        if (err.code !== "auth/user-not-found") {
          report.push({ email, firstName, lastName, status: "failed", reason: `Auth lookup error: ${err.message}` });
          continue;
        }
      }

      if (existingUser) {
        report.push({ email, firstName, lastName, uid: existingUser.uid, status: "skipped", reason: "Account already exists" });
        continue;
      }

      // Create Firebase Auth user (no password — must activate via link)
      let userRecord;
      try {
        userRecord = await adminAuth.createUser({
          email,
          displayName: [firstName, lastName].filter(Boolean).join(" "),
          emailVerified: false,
        });
      } catch (err) {
        report.push({ email, firstName, lastName, status: "failed", reason: `Auth create error: ${err.message}` });
        continue;
      }

      // Build extra fields from CSV (phone, notes, previousCoach, etc.)
      const { firstName: _f, lastName: _l, email: _e, ...csvExtras } = row;
      const extraFields = {};
      for (const [k, v] of Object.entries(csvExtras)) {
        if (v !== undefined && v !== null && v !== "") {
          extraFields[k] = String(v).trim();
        }
      }

      // Create Firestore user doc
      try {
        await db.collection("users").doc(userRecord.uid).set({
          firstName,
          lastName,
          email,
          subscription: "free",
          tags: ["past_client", "imported", "free_plan"],
          pastClient: true,
          imported: true,
          importedAt: now,
          importedBy: adminUid,
          importBatchId: batchId,
          activated: false,
          activatedAt: null,
          adminCreated: true,
          welcomeSent: false,
          createdAt: now.toDate().toISOString(),
          ...extraFields,
        });
      } catch (err) {
        // Clean up Auth user if Firestore write fails
        await adminAuth.deleteUser(userRecord.uid).catch(() => {});
        report.push({ email, firstName, lastName, status: "failed", reason: `Firestore error: ${err.message}` });
        continue;
      }

      // Generate activation token
      const token = crypto.randomBytes(32).toString("hex");
      try {
        await db.collection("activationTokens").doc(token).set({
          uid: userRecord.uid,
          email,
          firstName,
          expiresAt,
          used: false,
          usedAt: null,
          importBatchId: batchId,
          createdAt: now,
        });
      } catch (err) {
        report.push({ email, firstName, lastName, uid: userRecord.uid, status: "failed", reason: `Token creation error: ${err.message}` });
        continue;
      }

      const activationUrl = `${SITE_URL}/activate/${token}`;
      report.push({
        email,
        firstName,
        lastName,
        uid: userRecord.uid,
        status: "created",
        activationUrl,
        importedAt: now.toDate().toISOString(),
      });
    }

    // Tally report
    const counts = report.reduce((acc, r) => {
      acc[r.status] = (acc[r.status] || 0) + 1;
      return acc;
    }, {});

    // Persist the batch log
    await db.collection("importBatches").doc(batchId).set({
      batchId,
      adminUid,
      filename: filename || "unknown.csv",
      importedAt: now,
      totalProcessed: rows.length,
      created: counts.created || 0,
      skipped: counts.skipped || 0,
      failed: counts.failed || 0,
      invalid: counts.invalid || 0,
      report,
    });

    logger.info(`Import batch ${batchId}: ${counts.created || 0} created, ${counts.skipped || 0} skipped, ${counts.failed || 0} failed, ${counts.invalid || 0} invalid`);

    return {
      batchId,
      totalProcessed: rows.length,
      created: counts.created || 0,
      skipped: counts.skipped || 0,
      failed: counts.failed || 0,
      invalid: counts.invalid || 0,
      report,
    };
  }
);

/**
 * activateAccount — public callable (token is the credential)
 * data: { token: string, password: string }
 * Returns: { customToken } for immediate client-side sign-in
 */
exports.activateAccount = onCall(
  { invoker: "public" }, // Requires manual IAM: Cloud Run > activateaccount > Permissions > allUsers > Cloud Run Invoker
  async (request) => {
    const { token, password } = request.data || {};

    if (!token || typeof token !== "string" || token.length !== 64) {
      throw new HttpsError("invalid-argument", "Invalid activation token.");
    }
    if (!password || typeof password !== "string" || password.length < 8) {
      throw new HttpsError("invalid-argument", "Password must be at least 8 characters.");
    }

    const tokenRef = db.collection("activationTokens").doc(token);
    const tokenSnap = await tokenRef.get();

    if (!tokenSnap.exists) {
      throw new HttpsError("not-found", "Activation link is invalid.");
    }

    const tokenData = tokenSnap.data();

    if (tokenData.used) {
      throw new HttpsError("failed-precondition", "This activation link has already been used. Please log in or contact your coach to request a new link.");
    }

    const now = Timestamp.now();
    if (tokenData.expiresAt && tokenData.expiresAt.toMillis() < now.toMillis()) {
      throw new HttpsError("deadline-exceeded", "This activation link has expired. Please contact your coach to request a new link.");
    }

    const { getAuth: getAdminAuth } = require("firebase-admin/auth");
    const adminAuth = getAdminAuth();
    const uid = tokenData.uid;

    // Set the user's password
    try {
      await adminAuth.updateUser(uid, { password });
    } catch (err) {
      logger.error("activateAccount: updateUser failed", { uid, err: err.message });
      throw new HttpsError("internal", "Failed to set password. Please try again.");
    }

    // Mark token as used and mark user as activated in a batch
    const userRef = db.collection("users").doc(uid);
    const batch = db.batch();
    batch.update(tokenRef, { used: true, usedAt: now });
    batch.update(userRef, { activated: true, activatedAt: now });
    await batch.commit();

    // Create a custom token so the client can sign in immediately
    let customToken;
    try {
      customToken = await adminAuth.createCustomToken(uid);
    } catch (err) {
      logger.error("activateAccount: createCustomToken failed", { uid, err: err.message });
      throw new HttpsError("internal", "Account activated but sign-in token failed. Please log in manually.");
    }

    logger.info(`Account activated: ${uid} (${tokenData.email})`);
    return { customToken, email: tokenData.email, firstName: tokenData.firstName };
  }
);

/**
 * resendActivationToken — admin only callable
 * data: { uid: string }
 * Supersedes all existing tokens for the user and generates a fresh one.
 * Returns: { activationUrl }
 */
exports.resendActivationToken = onCall(
  async (request) => {
    if (!request.auth || request.auth.uid !== ADMIN_UID) {
      throw new HttpsError("permission-denied", "Admin only.");
    }

    const { uid } = request.data;
    if (!uid || typeof uid !== "string") {
      throw new HttpsError("invalid-argument", "uid is required.");
    }

    const userSnap = await db.collection("users").doc(uid).get();
    if (!userSnap.exists) {
      throw new HttpsError("not-found", "User not found.");
    }

    const userData = userSnap.data();
    if (userData.activated) {
      throw new HttpsError("failed-precondition", "This account is already activated.");
    }

    // Supersede existing unused tokens for this user
    const existingTokensSnap = await db.collection("activationTokens")
      .where("uid", "==", uid)
      .where("used", "==", false)
      .get();

    const now = Timestamp.now();
    const expiresAt = Timestamp.fromDate(new Date(Date.now() + TOKEN_TTL_DAYS * 86400000));
    const batch = db.batch();

    existingTokensSnap.docs.forEach(d => {
      batch.update(d.ref, { used: true, usedAt: now, superseded: true });
    });

    const newToken = crypto.randomBytes(32).toString("hex");
    const tokenRef = db.collection("activationTokens").doc(newToken);
    batch.set(tokenRef, {
      uid,
      email: userData.email,
      firstName: userData.firstName,
      expiresAt,
      used: false,
      usedAt: null,
      importBatchId: userData.importBatchId || null,
      createdAt: now,
      resent: true,
    });

    await batch.commit();

    const activationUrl = `${SITE_URL}/activate/${newToken}`;
    logger.info(`Activation token resent for ${uid} (${userData.email})`);
    return { activationUrl, email: userData.email };
  }
);

// ─── END PAST CLIENT IMPORT SYSTEM ─────────────────────────────────────────

// ─── PREMIUM WORKOUT BUILDER ───────────────────────────────────────────────

/**
 * checkWorkoutSaveEntitlement — callable
 * Called before saving a new custom workout. Enforces the free tier limit (1 workout).
 * Never trust the client to enforce this — always verify server-side.
 *
 * Returns: { allowed: boolean, currentCount: number, limit: number }
 */
exports.checkWorkoutSaveEntitlement = onCall(
  async (request) => {
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "Login required.");
    }

    const uid = request.auth.uid;
    const userSnap = await db.collection("users").doc(uid).get();
    const userData = userSnap.data() || {};

    const tier = userData.subscriptionTier || "free";
    const status = userData.subscriptionStatus || null;
    const isPremium = tier === "premium" && (status === "active" || status === "trialing");

    if (isPremium) {
      return { allowed: true, currentCount: null, limit: null };
    }

    // Free tier: count existing custom workouts
    const workoutsSnap = await db.collection("users").doc(uid).collection("workouts").get();
    const currentCount = workoutsSnap.size;
    const FREE_LIMIT = 1;

    return {
      allowed: currentCount < FREE_LIMIT,
      currentCount,
      limit: FREE_LIMIT,
    };
  }
);

/**
 * onCustomWorkoutCompleted — Firestore trigger
 * Fires when any document is created in /workoutLogs.
 * Only processes documents with logType === "custom" to avoid duplicating
 * the existing onWorkoutLogged milestone logic.
 *
 * Responsibilities:
 *   1. Detect and record personal bests per exercise in /users/{userId}/personalBests
 *   2. Recalculate Capability Score v1 (consistency + streak)
 */
exports.onCustomWorkoutCompleted = onDocumentCreated("workoutLogs/{docId}", async (event) => {
  const log = event.data.data();
  if (!log || log.logType !== "custom") return; // only custom workout logs

  const userId = log.userId;
  if (!userId || userId === ADMIN_UID) return;

  const logId = event.params.docId;

  await Promise.all([
    updatePersonalBests(userId, log, logId),
    recalculateCapabilityScore(userId),
  ]);
});

/**
 * Scans each exercise in a completed custom workout log and updates
 * /users/{userId}/personalBests/{exerciseId} if a new best was achieved.
 */
async function updatePersonalBests(userId, log, logId) {
  const exercises = log.exercises || [];
  if (exercises.length === 0) return;

  for (const ex of exercises) {
    const { exerciseId, exerciseName, sets = [] } = ex;
    if (!exerciseId) continue;

    // Find the best weight lifted in completed sets for this exercise
    const completedSets = sets.filter((s) => s.completed !== false);
    if (completedSets.length === 0) continue;

    const maxWeight = Math.max(
      ...completedSets.map((s) => parseFloat(s.weight) || 0)
    );
    const maxReps = Math.max(
      ...completedSets.map((s) => parseInt(s.reps) || 0)
    );
    // Best volume = highest single-set weight * reps (useful for AI coaching later)
    const bestVolume = Math.max(
      ...completedSets.map((s) => (parseFloat(s.weight) || 0) * (parseInt(s.reps) || 0))
    );

    const pbRef = db.collection("users").doc(userId).collection("personalBests").doc(exerciseId);
    const pbSnap = await pbRef.get();
    const existing = pbSnap.exists ? pbSnap.data() : null;

    const isNewWeightPB = maxWeight > 0 && (!existing || maxWeight > (existing.bestWeight || 0));
    const isNewRepsPB = maxReps > 0 && (!existing || maxReps > (existing.bestReps || 0));

    if (isNewWeightPB || isNewRepsPB || !existing) {
      await pbRef.set(
        {
          exerciseId,
          exerciseName: exerciseName || exerciseId,
          bestWeight: isNewWeightPB ? maxWeight : (existing?.bestWeight || 0),
          bestReps: isNewRepsPB ? maxReps : (existing?.bestReps || 0),
          bestVolume: Math.max(bestVolume, existing?.bestVolume || 0),
          achievedAt: Timestamp.now(),
          logId: logId || null,
          updatedAt: Timestamp.now(),
        },
        { merge: true }
      );

      logger.info(`New PB for user ${userId} on exercise ${exerciseId}: weight=${maxWeight}kg reps=${maxReps}`);
    }
  }
}

/**
 * Recalculates the user's Capability Score v1.
 *
 * Inputs (Phase 1 — no wearable required):
 *   Consistency Score: sessions in last 28 days. Target = 12 (3/week * 4 weeks). Max 100.
 *   Streak Score:      consecutive weeks with 2+ sessions. 1w=25, 2w=50, 3w=75, 4w+=100.
 *   Overall Score:     (consistency * 0.6) + (streak * 0.4). Rounded to nearest integer.
 *
 * Writes to /users/{userId}.capabilityScore
 */
async function recalculateCapabilityScore(userId) {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - 28);

  const logsSnap = await db.collection("workoutLogs")
    .where("userId", "==", userId)
    .where("completedAt", ">=", Timestamp.fromDate(cutoff))
    .orderBy("completedAt", "desc")
    .limit(200)
    .get();

  const sessionDates = logsSnap.docs
    .map((d) => {
      const ts = d.data().completedAt;
      if (!ts) return null;
      return ts.toDate ? ts.toDate() : new Date(ts);
    })
    .filter(Boolean);

  // Consistency Score (0-100)
  const WEEKLY_TARGET = 3;
  const WEEKS = 4;
  const TOTAL_TARGET = WEEKLY_TARGET * WEEKS;
  const consistencyScore = Math.min(100, Math.round((sessionDates.length / TOTAL_TARGET) * 100));

  // Streak Score — count consecutive weeks (Mon-Sun) with 2+ sessions
  function getWeekKey(date) {
    const d = new Date(date);
    const day = d.getDay();
    const monday = new Date(d);
    monday.setDate(d.getDate() - (day === 0 ? 6 : day - 1));
    monday.setHours(0, 0, 0, 0);
    return monday.toISOString().split("T")[0];
  }

  const weekCounts = {};
  sessionDates.forEach((d) => {
    const key = getWeekKey(d);
    weekCounts[key] = (weekCounts[key] || 0) + 1;
  });

  // Count consecutive qualifying weeks from most recent
  let streakWeeks = 0;
  const currentWeekKey = getWeekKey(new Date());
  const allWeekKeys = Object.keys(weekCounts).sort().reverse();

  for (let i = 0; i < allWeekKeys.length; i++) {
    if (weekCounts[allWeekKeys[i]] >= 2) {
      streakWeeks++;
    } else {
      break;
    }
  }

  const streakScore = Math.min(100, streakWeeks * 25); // 4+ weeks = 100

  // Overall Capability Score
  const overall = Math.round(consistencyScore * 0.6 + streakScore * 0.4);

  await db.collection("users").doc(userId).update({
    "capabilityScore.overall": overall,
    "capabilityScore.lastCalculatedAt": Timestamp.now(),
    "capabilityScore.breakdown.consistency": consistencyScore,
    "capabilityScore.breakdown.streak": streakScore,
    "capabilityScore.version": 1,
  });

  logger.info(`Capability Score updated for ${userId}: overall=${overall} (consistency=${consistencyScore}, streak=${streakScore})`);
}

// ─── END PREMIUM WORKOUT BUILDER ────────────────────────────────────────────

exports.zapierLeadWebhook = onRequest(
  { secrets: [zapierWebhookSecret] },
  async (req, res) => {
    if (req.method !== "POST") {
      return res.status(405).send("Method not allowed");
    }

    const providedSecret = req.get("x-webhook-secret");
    if (providedSecret !== zapierWebhookSecret.value()) {
      logger.warn("Rejected lead webhook call with invalid secret");
      return res.status(401).send("Unauthorized");
    }

    const { firstName, email, phone } = req.body || {};
    if (!email || typeof email !== "string") {
      return res.status(400).send("Email is required");
    }

    try {
      await db.collection("leads").add({
        firstName: firstName || "",
        email: email.toLowerCase(),
        phone: phone || "",
        source: "instant_form",
        consentStatus: "pending",
        createdAt: new Date().toISOString(),
      });

      return res.status(200).send("OK");
    } catch (e) {
      logger.error("Failed to write lead from Zapier webhook", e);
      return res.status(500).send("Internal error");
    }
  }
);