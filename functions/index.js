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