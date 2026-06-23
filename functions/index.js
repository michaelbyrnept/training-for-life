const {setGlobalOptions} = require("firebase-functions");
const {onCall, onRequest, HttpsError} = require("firebase-functions/v2/https");
const {defineSecret} = require("firebase-functions/params");
const logger = require("firebase-functions/logger");
const {initializeApp} = require("firebase-admin/app");
const {getFirestore} = require("firebase-admin/firestore");

setGlobalOptions({ maxInstances: 10 });

initializeApp();
const db = getFirestore();

const anthropicApiKey = defineSecret("ANTHROPIC_API_KEY");
const zapierWebhookSecret = defineSecret("ZAPIER_WEBHOOK_SECRET");
const stripeSecretKey = defineSecret("STRIPE_SECRET_KEY");
const stripeWebhookSecret = defineSecret("STRIPE_WEBHOOK_SECRET");
const stripePremiumPriceId = defineSecret("STRIPE_PREMIUM_PRICE_ID");
const stripeOnlinePriceId = defineSecret("STRIPE_ONLINE_PRICE_ID");

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

// ─── Stripe: create Checkout session ───────────────────────────────────────
exports.createCheckoutSession = onCall(
  { secrets: [stripeSecretKey, stripePremiumPriceId, stripeOnlinePriceId] },
  async (request) => {
    if (!request.auth) throw new HttpsError("unauthenticated", "You must be logged in.");
    const { tier } = request.data;
    if (!["premium", "online"].includes(tier)) {
      throw new HttpsError("invalid-argument", "Invalid tier. Must be premium or online.");
    }

    const stripe = require("stripe")(stripeSecretKey.value());
    const uid = request.auth.uid;
    const userRef = db.collection("users").doc(uid);
    const userSnap = await userRef.get();
    const userData = userSnap.data() || {};

    let customerId = userData.stripeCustomerId;
    if (!customerId) {
      const customer = await stripe.customers.create({
        email: request.auth.token.email,
        metadata: { firebaseUid: uid },
      });
      customerId = customer.id;
      await userRef.update({ stripeCustomerId: customerId });
    }

    const priceId = tier === "premium"
      ? stripePremiumPriceId.value()
      : stripeOnlinePriceId.value();

    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      payment_method_types: ["card"],
      mode: "subscription",
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `https://trainingforlife.ie/subscription/success?tier=${tier}&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `https://trainingforlife.ie/coaching/support`,
      metadata: { firebaseUid: uid, tier },
      subscription_data: {
        metadata: { firebaseUid: uid, tier },
      },
    });

    return { url: session.url };
  }
);

// ─── Stripe: webhook handler ────────────────────────────────────────────────
exports.stripeWebhook = onRequest(
  { secrets: [stripeSecretKey, stripeWebhookSecret] },
  async (req, res) => {
    if (req.method !== "POST") return res.status(405).send("Method not allowed");

    const sig = req.get("stripe-signature");
    let event;
    try {
      const stripe = require("stripe")(stripeSecretKey.value());
      event = stripe.webhooks.constructEvent(req.rawBody, sig, stripeWebhookSecret.value());
    } catch (err) {
      logger.error("Stripe webhook signature verification failed", err);
      return res.status(400).send(`Webhook error: ${err.message}`);
    }

    try {
      const stripe = require("stripe")(stripeSecretKey.value());

      if (event.type === "checkout.session.completed") {
        const session = event.data.object;
        const uid = session.metadata?.firebaseUid;
        const tier = session.metadata?.tier;
        if (!uid || !tier) {
          logger.warn("checkout.session.completed missing metadata", session.id);
          return res.status(200).send("OK");
        }
        const subscription = await stripe.subscriptions.retrieve(session.subscription);
        await db.collection("users").doc(uid).update({
          subscription: tier,
          stripeSubscriptionId: session.subscription,
          stripeCustomerId: session.customer,
          subscriptionPeriodEnd: new Date(subscription.current_period_end * 1000).toISOString(),
          subscriptionCancelAtPeriodEnd: subscription.cancel_at_period_end || false,
          subscriptionUpdatedAt: new Date().toISOString(),
        });
        logger.info(`Activated ${tier} subscription for user ${uid}`);

      } else if (event.type === "customer.subscription.deleted") {
        const subscription = event.data.object;
        const uid = subscription.metadata?.firebaseUid;
        if (uid) {
          await db.collection("users").doc(uid).update({
            subscription: "free",
            stripeSubscriptionId: null,
            subscriptionPeriodEnd: null,
            subscriptionCancelAtPeriodEnd: false,
            subscriptionUpdatedAt: new Date().toISOString(),
          });
          logger.info(`Reverted user ${uid} to free after subscription deleted`);
        }

      } else if (event.type === "customer.subscription.updated") {
        const subscription = event.data.object;
        const uid = subscription.metadata?.firebaseUid;
        if (uid) {
          await db.collection("users").doc(uid).update({
            subscriptionPeriodEnd: new Date(subscription.current_period_end * 1000).toISOString(),
            subscriptionCancelAtPeriodEnd: subscription.cancel_at_period_end || false,
            subscriptionUpdatedAt: new Date().toISOString(),
          });
        }
      }
    } catch (err) {
      logger.error("Error processing Stripe webhook", { type: event.type, err });
      return res.status(500).send("Internal error");
    }

    return res.status(200).send("OK");
  }
);

// ─── Stripe: cancel subscription ────────────────────────────────────────────
exports.cancelSubscription = onCall(
  { secrets: [stripeSecretKey] },
  async (request) => {
    if (!request.auth) throw new HttpsError("unauthenticated", "You must be logged in.");

    const uid = request.auth.uid;
    const userSnap = await db.collection("users").doc(uid).get();
    const userData = userSnap.data() || {};
    const subscriptionId = userData.stripeSubscriptionId;

    if (!subscriptionId) {
      throw new HttpsError("not-found", "No active subscription found.");
    }

    const stripe = require("stripe")(stripeSecretKey.value());
    await stripe.subscriptions.update(subscriptionId, { cancel_at_period_end: true });

    await db.collection("users").doc(uid).update({
      subscriptionCancelAtPeriodEnd: true,
      subscriptionUpdatedAt: new Date().toISOString(),
    });

    return { success: true };
  }
);

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