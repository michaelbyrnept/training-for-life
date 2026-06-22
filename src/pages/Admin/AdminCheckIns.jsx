import { useState, useEffect } from "react";
import { collection, getDocs, doc, updateDoc, addDoc } from "firebase/firestore";
import { db } from "../../firebase";
import { Link } from "react-router-dom";

function getYouTubeId(url) {
  if (!url) return null;
  const match = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([^&\n?#]+)/);
  return match ? match[1] : null;
}

function scoreColor(v) {
  if (v <= 3) return "#dc2626";
  if (v <= 5) return "#b45309";
  if (v <= 7) return "#2d6a4f";
  return "#16a34a";
}

function getWeekMonday() {
  const now = new Date();
  const day = now.getDay();
  const monday = new Date(now);
  monday.setDate(now.getDate() - (day === 0 ? 6 : day - 1));
  return monday.toISOString().split("T")[0];
}

export default function AdminCheckIns() {
  const [checkIns, setCheckIns] = useState([]);
  const [clients, setClients] = useState({});
  const [clientList, setClientList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null);
  const [replyText, setReplyText] = useState("");
  const [videoUrl, setVideoUrl] = useState("");
  const [sending, setSending] = useState(false);
  const [filter, setFilter] = useState("pending");
  const [showNewMessage, setShowNewMessage] = useState(false);
  const [newMsgClient, setNewMsgClient] = useState("");
  const [newMsgVideo, setNewMsgVideo] = useState("");
  const [newMsgText, setNewMsgText] = useState("");
  const [newMsgSending, setNewMsgSending] = useState(false);

  useEffect(() => { loadAll(); }, []);

  const loadAll = async () => {
    setLoading(true);
    const [checkInSnap, usersSnap] = await Promise.all([
      getDocs(collection(db, "checkIns")),
      getDocs(collection(db, "users")),
    ]);

    const clientMap = {};
    const list = [];
    usersSnap.docs.forEach(d => {
      const data = d.data();
      const name = data.firstName
        ? `${data.firstName}${data.lastName ? " " + data.lastName : ""}`
        : data.email || "Unknown";
      clientMap[d.id] = name;
      list.push({ uid: d.id, name });
    });
    setClients(clientMap);
    setClientList(list.sort((a, b) => a.name.localeCompare(b.name)));

    const all = checkInSnap.docs
      .map(d => ({ id: d.id, ...d.data() }))
      .sort((a, b) => {
        const aReplied = !!(a.coachReply || a.coachVideoUrl);
        const bReplied = !!(b.coachReply || b.coachVideoUrl);
        if (aReplied !== bReplied) return aReplied ? 1 : -1;
        return new Date(b.submittedAt) - new Date(a.submittedAt);
      });

    setCheckIns(all);
    setLoading(false);
  };

  const selectCheckIn = (ci) => {
    setSelected(ci);
    setReplyText(ci.coachReply || "");
    setVideoUrl(ci.coachVideoUrl || "");
  };

  const sendReply = async () => {
    if (!replyText.trim() && !videoUrl.trim()) return;
    setSending(true);
    const update = {
      coachReply: replyText.trim(),
      coachVideoUrl: videoUrl.trim() || null,
      replyAt: new Date().toISOString(),
      replyRead: false,
    };
    await updateDoc(doc(db, "checkIns", selected.id), update);
    const updated = { ...selected, ...update };
    setCheckIns(prev => prev.map(c => c.id === selected.id ? updated : c));
    setSelected(updated);
    setSending(false);
  };

  const sendNewMessage = async () => {
    if (!newMsgClient || (!newMsgText.trim() && !newMsgVideo.trim())) return;
    setNewMsgSending(true);
    const newDoc = {
      userId: newMsgClient,
      coachInitiated: true,
      answers: { training: null, energy: null, sleep: null, stress: null, pain: "", win: "", struggle: "", other: "" },
      submittedAt: new Date().toISOString(),
      weekOf: getWeekMonday(),
      coachReply: newMsgText.trim(),
      coachVideoUrl: newMsgVideo.trim() || null,
      replyAt: new Date().toISOString(),
      replyRead: false,
    };
    const ref = await addDoc(collection(db, "checkIns"), newDoc);
    setCheckIns(prev => [{ id: ref.id, ...newDoc }, ...prev]);
    setShowNewMessage(false);
    setNewMsgClient("");
    setNewMsgVideo("");
    setNewMsgText("");
    setNewMsgSending(false);
  };

  const filtered = checkIns.filter(c => {
    const replied = !!(c.coachReply || c.coachVideoUrl);
    if (filter === "pending") return !replied;
    if (filter === "replied") return replied;
    return true;
  });

  const pendingCount = checkIns.filter(c => !(c.coachReply || c.coachVideoUrl)).length;

  if (selected) {
    const clientName = clients[selected.userId] || "Unknown";
    const replied = !!(selected.coachReply || selected.coachVideoUrl);
    const ytId = getYouTubeId(selected.coachVideoUrl);
    const isCoachInitiated = !!selected.coachInitiated;

    return (
      <div style={{ minHeight: "100vh", backgroundColor: "#f7f5f2", paddingBottom: "60px" }}>
        <div style={{ backgroundColor: "#1a3a2a", padding: "16px 20px 24px" }}>
          <button onClick={() => setSelected(null)} style={{ background: "none", border: "none", fontSize: "13px", fontWeight: 700, color: "#9fe1cb", cursor: "pointer", padding: 0, marginBottom: "16px" }}>
            Back to check-ins
          </button>
          <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
            <div>
              <p style={{ fontSize: "11px", fontWeight: 700, color: "rgba(255,255,255,0.5)", letterSpacing: "0.1em", textTransform: "uppercase", margin: "0 0 4px" }}>
                Week of {new Date(selected.weekOf + "T12:00:00").toLocaleDateString("en-IE", { day: "numeric", month: "long" })}
              </p>
              <h1 style={{ fontSize: "22px", fontWeight: 700, color: "#fff", margin: "0 0 4px" }}>{clientName}</h1>
              <p style={{ fontSize: "12px", color: "#9fe1cb", margin: 0 }}>
                {isCoachInitiated ? "Coach message" : `Submitted ${new Date(selected.submittedAt).toLocaleDateString("en-IE", { day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" })}`}
              </p>
            </div>
            {isCoachInitiated && (
              <span style={{ backgroundColor: "rgba(255,255,255,0.15)", color: "#9fe1cb", fontSize: "11px", fontWeight: 700, padding: "4px 10px", borderRadius: "20px" }}>
                From you
              </span>
            )}
          </div>
        </div>

        <div style={{ padding: "16px" }}>
          {!isCoachInitiated && (
            <>
              <div style={{ backgroundColor: "#fff", borderRadius: "16px", border: "0.5px solid #e5e5e5", padding: "16px", marginBottom: "10px" }}>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
                  {["training", "energy", "sleep", "stress"].map(key => (
                    <div key={key} style={{ textAlign: "center" }}>
                      <p style={{ fontSize: "32px", fontWeight: 700, color: scoreColor(selected.answers[key]), margin: 0, lineHeight: 1 }}>
                        {selected.answers[key]}
                      </p>
                      <p style={{ fontSize: "11px", color: "#888", margin: "4px 0 0", textTransform: "capitalize", fontWeight: 600 }}>{key}</p>
                    </div>
                  ))}
                </div>
              </div>

              {["pain", "win", "struggle", "other"].map(key => {
                const labels = { pain: "Pain / niggles", win: "Biggest win", struggle: "Struggled with", other: "Anything else" };
                const val = selected.answers[key];
                if (!val) return null;
                return (
                  <div key={key} style={{ backgroundColor: "#fff", borderRadius: "14px", border: "0.5px solid #e5e5e5", padding: "14px 16px", marginBottom: "8px" }}>
                    <p style={{ fontSize: "11px", fontWeight: 700, color: "#2d6a4f", textTransform: "uppercase", letterSpacing: "0.06em", margin: "0 0 6px" }}>{labels[key]}</p>
                    <p style={{ fontSize: "14px", color: "#111", margin: 0, lineHeight: 1.6 }}>{val}</p>
                  </div>
                );
              })}
            </>
          )}

          <div style={{ backgroundColor: "#fff", borderRadius: "16px", border: "0.5px solid #e5e5e5", padding: "16px", marginTop: isCoachInitiated ? 0 : "12px" }}>
            <p style={{ fontSize: "13px", fontWeight: 700, color: "#111", margin: "0 0 12px" }}>
              {replied ? "Update message" : "Send reply"}
            </p>

            {ytId && (
              <div style={{ borderRadius: "12px", overflow: "hidden", backgroundColor: "#000", aspectRatio: "16/9", marginBottom: "12px" }}>
                <iframe
                  src={`https://www.youtube.com/embed/${ytId}`}
                  width="100%" height="100%" frameBorder="0"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen style={{ display: "block" }}
                />
              </div>
            )}

            <input
              type="url" value={videoUrl} onChange={e => setVideoUrl(e.target.value)}
              placeholder="YouTube video URL"
              style={{ width: "100%", padding: "12px", borderRadius: "10px", border: "1.5px solid #e5e5e5", fontSize: "14px", color: "#111", outline: "none", boxSizing: "border-box", marginBottom: "10px", fontFamily: "inherit" }}
              onFocus={e => e.target.style.borderColor = "#2d6a4f"}
              onBlur={e => e.target.style.borderColor = "#e5e5e5"}
            />
            <textarea
              value={replyText} onChange={e => setReplyText(e.target.value)}
              placeholder="Add a written note alongside the video, or just type a message..."
              rows={3}
              style={{ width: "100%", padding: "12px", borderRadius: "10px", border: "1.5px solid #e5e5e5", fontSize: "14px", color: "#111", outline: "none", resize: "none", boxSizing: "border-box", fontFamily: "inherit", lineHeight: 1.6 }}
              onFocus={e => e.target.style.borderColor = "#2d6a4f"}
              onBlur={e => e.target.style.borderColor = "#e5e5e5"}
            />
            <button
              onClick={sendReply}
              disabled={sending || (!replyText.trim() && !videoUrl.trim())}
              style={{
                width: "100%", marginTop: "10px",
                backgroundColor: sending || (!replyText.trim() && !videoUrl.trim()) ? "#e5e5e5" : "#1a3a2a",
                color: sending || (!replyText.trim() && !videoUrl.trim()) ? "#aaa" : "#fff",
                border: "none", borderRadius: "12px", padding: "13px", fontSize: "14px", fontWeight: 700,
                cursor: sending || (!replyText.trim() && !videoUrl.trim()) ? "not-allowed" : "pointer",
              }}
            >
              {sending ? "Sending..." : replied ? "Update" : "Send"}
            </button>
          </div>

          <Link
            to={`/admin/clients/${selected.userId}`}
            style={{ display: "block", textAlign: "center", marginTop: "12px", fontSize: "13px", fontWeight: 700, color: "#2d6a4f", textDecoration: "none" }}
          >
            View full client profile
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: "100vh", backgroundColor: "#f7f5f2", paddingBottom: "60px" }}>
      <div style={{ backgroundColor: "#1a3a2a", padding: "16px 20px 24px" }}>
        <Link to="/admin" style={{ fontSize: "13px", fontWeight: 700, color: "#9fe1cb", textDecoration: "none" }}>Admin</Link>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: "16px" }}>
          <div>
            <h1 style={{ fontSize: "24px", fontWeight: 700, color: "#fff", margin: 0 }}>Check-ins</h1>
            {pendingCount > 0 && (
              <p style={{ fontSize: "13px", color: "#9fe1cb", margin: "4px 0 0" }}>{pendingCount} waiting for a reply</p>
            )}
          </div>
          <button
            onClick={() => setShowNewMessage(true)}
            style={{ backgroundColor: "#fff", color: "#1a3a2a", border: "none", borderRadius: "20px", padding: "8px 16px", fontSize: "13px", fontWeight: 700, cursor: "pointer" }}
          >
            New message
          </button>
        </div>
      </div>

      <div style={{ display: "flex", gap: "8px", padding: "16px 16px 0" }}>
        {[{ key: "pending", label: "Pending" }, { key: "replied", label: "Replied" }, { key: "all", label: "All" }].map(tab => (
          <button
            key={tab.key} onClick={() => setFilter(tab.key)}
            style={{
              padding: "8px 16px", borderRadius: "20px", border: "none",
              backgroundColor: filter === tab.key ? "#1a3a2a" : "#fff",
              color: filter === tab.key ? "#fff" : "#555",
              fontSize: "13px", fontWeight: 700, cursor: "pointer",
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div style={{ padding: "12px 16px" }}>
        {loading ? (
          <p style={{ fontSize: "14px", color: "#888", textAlign: "center", padding: "40px 0" }}>Loading...</p>
        ) : filtered.length === 0 ? (
          <p style={{ fontSize: "14px", color: "#888", textAlign: "center", padding: "40px 0" }}>
            {filter === "pending" ? "No pending check-ins. All caught up." : "No check-ins yet."}
          </p>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
            {filtered.map(ci => {
              const replied = !!(ci.coachReply || ci.coachVideoUrl);
              const clientName = clients[ci.userId] || "Unknown";
              const isCoachInitiated = !!ci.coachInitiated;
              return (
                <div
                  key={ci.id} onClick={() => selectCheckIn(ci)}
                  style={{
                    backgroundColor: "#fff", borderRadius: "16px",
                    border: `0.5px solid ${replied ? "#e5e5e5" : "#86efac"}`,
                    padding: "14px 16px", cursor: "pointer",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: isCoachInitiated ? 0 : "10px" }}>
                    <div>
                      <p style={{ fontSize: "15px", fontWeight: 700, color: "#111", margin: "0 0 2px" }}>{clientName}</p>
                      <p style={{ fontSize: "12px", color: "#888", margin: 0 }}>
                        Week of {new Date(ci.weekOf + "T12:00:00").toLocaleDateString("en-IE", { day: "numeric", month: "long" })}
                        {isCoachInitiated && " · Coach message"}
                      </p>
                    </div>
                    <span style={{
                      fontSize: "11px", fontWeight: 700, padding: "4px 10px", borderRadius: "20px",
                      backgroundColor: isCoachInitiated ? "#f0f0f0" : replied ? "#f0f0f0" : "#eaf5ef",
                      color: isCoachInitiated ? "#888" : replied ? "#888" : "#2d6a4f",
                    }}>
                      {isCoachInitiated ? (ci.coachVideoUrl ? "Video sent" : "Sent") : replied ? (ci.coachVideoUrl ? "Video sent" : "Replied") : "Pending"}
                    </span>
                  </div>
                  {!isCoachInitiated && (
                    <div style={{ display: "flex", gap: "16px" }}>
                      {["training", "energy", "sleep", "stress"].map(key => (
                        <div key={key} style={{ textAlign: "center" }}>
                          <p style={{ fontSize: "18px", fontWeight: 700, color: scoreColor(ci.answers[key]), margin: 0, lineHeight: 1 }}>
                            {ci.answers[key]}
                          </p>
                          <p style={{ fontSize: "10px", color: "#aaa", margin: "2px 0 0", textTransform: "capitalize" }}>{key}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* New message sheet */}
      {showNewMessage && (
        <div
          onClick={e => { if (e.target === e.currentTarget) setShowNewMessage(false); }}
          style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 50, display: "flex", alignItems: "flex-end" }}
        >
          <div style={{ background: "#fff", borderRadius: "20px 20px 0 0", width: "100%", padding: "20px 20px 40px" }}>
            <div style={{ width: 36, height: 4, background: "#e5e5e5", borderRadius: 2, margin: "0 auto 20px" }} />
            <h2 style={{ fontSize: "18px", fontWeight: 700, color: "#111", margin: "0 0 4px" }}>New message</h2>
            <p style={{ fontSize: "13px", color: "#888", margin: "0 0 20px" }}>Send a video or note to a client without them needing to check in first.</p>

            <p style={{ fontSize: "12px", fontWeight: 700, color: "#555", margin: "0 0 6px" }}>Client</p>
            <select
              value={newMsgClient}
              onChange={e => setNewMsgClient(e.target.value)}
              style={{ width: "100%", padding: "12px", borderRadius: "10px", border: "1.5px solid #e5e5e5", fontSize: "14px", color: newMsgClient ? "#111" : "#aaa", outline: "none", boxSizing: "border-box", marginBottom: "14px", fontFamily: "inherit", backgroundColor: "#fff" }}
            >
              <option value="">Select a client...</option>
              {clientList.map(c => (
                <option key={c.uid} value={c.uid}>{c.name}</option>
              ))}
            </select>

            <p style={{ fontSize: "12px", fontWeight: 700, color: "#555", margin: "0 0 6px" }}>YouTube video URL</p>
            <input
              type="url" value={newMsgVideo} onChange={e => setNewMsgVideo(e.target.value)}
              placeholder="Paste YouTube URL..."
              style={{ width: "100%", padding: "12px", borderRadius: "10px", border: "1.5px solid #e5e5e5", fontSize: "14px", color: "#111", outline: "none", boxSizing: "border-box", marginBottom: "14px", fontFamily: "inherit" }}
              onFocus={e => e.target.style.borderColor = "#2d6a4f"}
              onBlur={e => e.target.style.borderColor = "#e5e5e5"}
            />

            <p style={{ fontSize: "12px", fontWeight: 700, color: "#555", margin: "0 0 6px" }}>Written note (optional)</p>
            <textarea
              value={newMsgText} onChange={e => setNewMsgText(e.target.value)}
              placeholder="Add context or notes alongside the video..."
              rows={3}
              style={{ width: "100%", padding: "12px", borderRadius: "10px", border: "1.5px solid #e5e5e5", fontSize: "14px", color: "#111", outline: "none", resize: "none", boxSizing: "border-box", fontFamily: "inherit", lineHeight: 1.6 }}
              onFocus={e => e.target.style.borderColor = "#2d6a4f"}
              onBlur={e => e.target.style.borderColor = "#e5e5e5"}
            />

            <button
              onClick={sendNewMessage}
              disabled={newMsgSending || !newMsgClient || (!newMsgText.trim() && !newMsgVideo.trim())}
              style={{
                width: "100%", marginTop: "14px",
                backgroundColor: newMsgSending || !newMsgClient || (!newMsgText.trim() && !newMsgVideo.trim()) ? "#e5e5e5" : "#1a3a2a",
                color: newMsgSending || !newMsgClient || (!newMsgText.trim() && !newMsgVideo.trim()) ? "#aaa" : "#fff",
                border: "none", borderRadius: "12px", padding: "14px", fontSize: "15px", fontWeight: 700,
                cursor: newMsgSending || !newMsgClient || (!newMsgText.trim() && !newMsgVideo.trim()) ? "not-allowed" : "pointer",
              }}
            >
              {newMsgSending ? "Sending..." : "Send message"}
            </button>
            <button onClick={() => setShowNewMessage(false)} style={{ width: "100%", background: "none", border: "none", fontSize: "13px", color: "#aaa", cursor: "pointer", marginTop: "10px", padding: "6px" }}>
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
