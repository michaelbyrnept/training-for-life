const {setGlobalOptions} = require("firebase-functions");
const {onCall, HttpsError} = require("firebase-functions/v2/https");
const {defineSecret} = require("firebase-functions/params");
const logger = require("firebase-functions/logger");

setGlobalOptions({ maxInstances: 10 });

const anthropicApiKey = defineSecret("ANTHROPIC_API_KEY");

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