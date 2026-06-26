// export-consented-users.js
// Run with: node api/export-consented-users.js
// Exports all free users with marketingConsent: true as a CSV for Brevo import

import { initializeApp, cert } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { createWriteStream } from "fs";

// Point this to your Firebase service account key
// Download from: Firebase Console > Project Settings > Service Accounts > Generate new private key
const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);

initializeApp({ credential: cert(serviceAccount) });

const db = getFirestore();

async function exportConsentedUsers() {
  console.log("Fetching consented free users from Firestore...");

  const snapshot = await db
    .collection("users")
    .where("marketingConsent", "==", true)
    .get();

  const users = [];

  snapshot.forEach((doc) => {
    const data = doc.data();

    // Only include free users (not already paying clients)
    const isFree =
      !data.subscription ||
      data.subscription === "free" ||
      data.subscriptionTier === "free";

    if (isFree && data.email) {
      users.push({
        email: data.email.toLowerCase().trim(),
        firstName: data.firstName || "",
      });
    }
  });

  if (users.length === 0) {
    console.log("No consented free users found.");
    return;
  }

  // Write CSV
  const outputPath = "./brevo-import.csv";
  const stream = createWriteStream(outputPath);

  stream.write("EMAIL,FIRSTNAME\n");
  users.forEach(({ email, firstName }) => {
    stream.write(`${email},${firstName}\n`);
  });

  stream.end(() => {
    console.log(`Done. ${users.length} users exported to ${outputPath}`);
    console.log("Import this CSV into Brevo > Contacts > Import > App Users list");
  });
}

exportConsentedUsers().catch(console.error);
