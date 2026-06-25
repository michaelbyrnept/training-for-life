import SEO from "./components/SEO";

export default function PrivacyPolicy() {
  return (
    <div style={{ minHeight: "100vh", backgroundColor: "#f7f5f2" }}>
      <SEO
        title="Privacy Policy | Training for Life"
        description="Privacy policy for Training for Life, operated by personal trainer Michael Byrne in Dublin, Ireland. Learn how we collect and handle your data in line with GDPR."
        canonical="https://trainingforlife.ie/privacy-policy"
      />

      {/* Header */}
      <div style={{ background: "linear-gradient(160deg, #1a3a2a 0%, #2d6a4f 100%)", padding: "48px 24px 56px", textAlign: "center" }}>
        <p style={{ fontSize: "11px", fontWeight: 700, color: "rgba(255,255,255,0.6)", letterSpacing: "0.15em", textTransform: "uppercase", margin: "0 0 10px" }}>
          Training for Life
        </p>
        <h1 style={{ fontSize: "28px", fontWeight: 700, color: "#fff", margin: 0 }}>
          Privacy Policy
        </h1>
      </div>

      {/* Content */}
      <div style={{ maxWidth: "680px", margin: "-24px auto 0", padding: "0 24px 64px" }}>
        <div style={{ backgroundColor: "#fff", borderRadius: "20px", padding: "32px 28px", boxShadow: "0 4px 24px rgba(0,0,0,0.08)", color: "#333", fontSize: "15px", lineHeight: 1.7 }}>

          <p style={{ color: "#888", fontSize: "13px" }}>Last updated: 20 June 2026</p>

          <p>
            Training For Life ("we," "us," "our") is operated by Michael Byrne, a personal trainer based in Ireland.
            This policy explains what personal data we collect, why we collect it, and how it's handled, in line with
            the EU General Data Protection Regulation (GDPR).
          </p>

          <h2 style={sectionHeading}>1. Who we are</h2>
          <p>
            Training For Life, founded by Michael Byrne. For any question about this policy or your data,
            contact <a href="mailto:michael@trainingforlife.ie" style={linkStyle}>michael@trainingforlife.ie</a>.
          </p>

          <h2 style={sectionHeading}>2. What data we collect</h2>
          <p>Depending on how you interact with us, we may collect:</p>
          <ul style={listStyle}>
            <li><strong>Account information:</strong> first name, email address, and a securely hashed password, when you register for the app.</li>
            <li><strong>Lead information:</strong> first name, email address (and phone number, if provided) when you submit an enquiry through a Facebook/Instagram lead form, before you've created a full account.</li>
            <li><strong>Training data:</strong> workouts completed, exercises logged, sets, reps, and weights, progress over time.</li>
            <li><strong>Nutrition data (optional):</strong> if you use nutrition tracking features, relevant food and calorie information you choose to log.</li>
            <li><strong>Marketing preferences:</strong> whether you've opted in to receive training tips and updates by email.</li>
          </ul>

          <h2 style={sectionHeading}>3. Why we collect it</h2>
          <ul style={listStyle}>
            <li>To create and manage your account</li>
            <li>To provide the core functionality of the app (workout tracking, programme delivery, progress tracking)</li>
            <li>To respond to enquiries made through our ads or website</li>
            <li>To send you training tips, programme updates, or coaching information, but only if you've opted in</li>
            <li>To improve our service and understand how the app is used</li>
          </ul>

          <h2 style={sectionHeading}>4. Legal basis for processing</h2>
          <p>
            We process your data on the basis of: your <strong>consent</strong> (for marketing emails), the necessity to
            perform a <strong>contract</strong> with you (providing the app/service you've signed up for), and our
            <strong> legitimate interest</strong> in responding to enquiries you've made to us directly.
          </p>

          <h2 style={sectionHeading}>5. Who we share data with</h2>
          <p>We use a small number of trusted third-party services to operate Training For Life:</p>
          <ul style={listStyle}>
            <li><strong>Google Firebase / Google Cloud Platform:</strong> hosts our app, authentication, and database (Firestore).</li>
            <li><strong>Kit (ConvertKit):</strong> manages email communications, only for users who opt in to marketing emails.</li>
            <li><strong>Edamam / USDA:</strong> nutrition data lookup services, used only if you use nutrition-related features.</li>
          </ul>
          <p>
            We do not sell your personal data to anyone, under any circumstances.
          </p>

          <h2 style={sectionHeading}>6. How long we keep your data</h2>
          <p>
            We keep account data for as long as your account is active. If you submit an enquiry via a lead form but
            never create a full account, and you don't engage with us for 24 months, that information will be deleted
            or you'll be asked to reconfirm your interest.
          </p>

          <h2 style={sectionHeading}>7. Your rights</h2>
          <p>Under GDPR, you have the right to:</p>
          <ul style={listStyle}>
            <li>Access the personal data we hold about you</li>
            <li>Correct inaccurate data</li>
            <li>Request deletion of your data ("right to be forgotten")</li>
            <li>Withdraw marketing consent at any time (every email includes an unsubscribe link)</li>
            <li>Lodge a complaint with the Irish Data Protection Commission (<a href="https://www.dataprotection.ie" target="_blank" rel="noreferrer" style={linkStyle}>dataprotection.ie</a>)</li>
          </ul>
          <p>
            To exercise any of these rights, email <a href="mailto:michael@trainingforlife.ie" style={linkStyle}>michael@trainingforlife.ie</a>.
          </p>

          <h2 style={sectionHeading}>8. Cookies</h2>
          <p>
            Our app uses essential cookies/local storage required for login and core functionality. We do not use
            third-party advertising trackers on the app itself.
          </p>

          <h2 style={sectionHeading}>9. Changes to this policy</h2>
          <p>
            We may update this policy from time to time. The "last updated" date at the top will reflect the most
            recent changes.
          </p>

        </div>
      </div>
    </div>
  );
}

const sectionHeading = { fontSize: "17px", fontWeight: 700, color: "#1a3a2a", marginTop: "28px", marginBottom: "10px" };
const linkStyle = { color: "#2d6a4f", fontWeight: 600 };
const listStyle = { paddingLeft: "20px", margin: "10px 0" };