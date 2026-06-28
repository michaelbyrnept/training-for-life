import { useLocation, Link } from "react-router-dom";

const WHATSAPP_NUMBER = "353852239897";
const WHATSAPP_MESSAGE = "Hi Michael, I'm interested in personal training. Can we have a quick chat?";

const HIDE_ON = ["/admin", "/dashboard", "/training", "/nutrition", "/habits", "/progress", "/programme", "/exercise", "/classes", "/check-in", "/profile", "/onboarding", "/my-workouts"];

const btnBase = {
  display: "inline-flex",
  alignItems: "center",
  gap: "10px",
  borderRadius: "999px",
  padding: "13px 18px",
  fontSize: "14px",
  fontWeight: 600,
  textDecoration: "none",
  boxShadow: "0 4px 16px rgba(0,0,0,0.15)",
  transition: "transform 0.15s ease, box-shadow 0.15s ease",
  whiteSpace: "nowrap",
};

function hoverIn(e) {
  e.currentTarget.style.transform = "translateY(-2px)";
  e.currentTarget.style.boxShadow = "0 8px 24px rgba(0,0,0,0.2)";
}
function hoverOut(e) {
  e.currentTarget.style.transform = "translateY(0)";
  e.currentTarget.style.boxShadow = "0 4px 16px rgba(0,0,0,0.15)";
}

export default function WhatsAppButton() {
  const { pathname } = useLocation();
  if (HIDE_ON.some((p) => pathname.startsWith(p))) return null;

  const waHref = `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(WHATSAPP_MESSAGE)}`;

  return (
    <div
      style={{
        position: "fixed",
        bottom: "24px",
        right: "24px",
        zIndex: 1000,
        display: "flex",
        flexDirection: "column",
        alignItems: "flex-end",
        gap: "10px",
      }}
    >
      {/* Free App button */}
      <Link
        to="/register"
        style={{ ...btnBase, backgroundColor: "#1a3a2a", color: "#fff" }}
        onMouseEnter={hoverIn}
        onMouseLeave={hoverOut}
        aria-label="Get the free training app"
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="5" y="2" width="14" height="20" rx="2" ry="2"/>
          <line x1="12" y1="18" x2="12.01" y2="18"/>
        </svg>
        <span>Get the Free App</span>
      </Link>

      {/* WhatsApp button */}
      <a
        href={waHref}
        target="_blank"
        rel="noopener noreferrer"
        aria-label="Chat with Michael on WhatsApp"
        style={{ ...btnBase, backgroundColor: "#25d366", color: "#fff", boxShadow: "0 4px 16px rgba(37,211,102,0.3)" }}
        onMouseEnter={(e) => {
          e.currentTarget.style.transform = "translateY(-2px)";
          e.currentTarget.style.boxShadow = "0 8px 24px rgba(37,211,102,0.45)";
        }}
        onMouseLeave={hoverOut}
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
          <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/>
          <path d="M12 0C5.373 0 0 5.373 0 12c0 2.124.558 4.118 1.535 5.845L.057 23.486a.5.5 0 0 0 .614.612l5.748-1.505A11.93 11.93 0 0 0 12 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 21.882a9.87 9.87 0 0 1-5.042-1.381l-.362-.215-3.712.972.99-3.617-.236-.372A9.865 9.865 0 0 1 2.118 12C2.118 6.533 6.533 2.118 12 2.118c5.467 0 9.882 4.415 9.882 9.882 0 5.467-4.415 9.882-9.882 9.882z"/>
        </svg>
        <span>Chat on WhatsApp</span>
      </a>
    </div>
  );
}
