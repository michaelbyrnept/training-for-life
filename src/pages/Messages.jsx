import { useState, useEffect, useRef } from "react";
import { auth, db } from "../firebase";
import { onAuthStateChanged } from "firebase/auth";
import {
  collection, query, where, onSnapshot,
  addDoc, doc, updateDoc, orderBy,
} from "firebase/firestore";
import { Link, useNavigate } from "react-router-dom";
import PortalNav from "../components/PortalNav";
import { useFeatures } from "../hooks/useFeatures";

const ADMIN_UID = "wKbgHNtTMtS01BQ4ddfAwTQaIgA3";

function formatTime(isoStr) {
  if (!isoStr) return "";
  const d = new Date(isoStr);
  const now = new Date();
  const diffDays = Math.floor((now - d) / 86400000);
  if (diffDays === 0) return d.toLocaleTimeString("en-IE", { hour: "2-digit", minute: "2-digit" });
  if (diffDays === 1) return "Yesterday";
  if (diffDays < 7) return d.toLocaleDateString("en-IE", { weekday: "short" });
  return d.toLocaleDateString("en-IE", { day: "numeric", month: "short" });
}

export default function Messages() {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const bottomRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      if (!u) { navigate("/login"); return; }
      setUser(u);
    });
    return () => unsub();
  }, [navigate]);

  useEffect(() => {
    if (!user) return;
    const q = query(
      collection(db, "messages"),
      where("participants", "array-contains", user.uid),
      orderBy("sentAt", "asc")
    );
    const unsub = onSnapshot(q, async (snap) => {
      const msgs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      setMessages(msgs);
      // Mark inbound messages as read
      const unread = snap.docs.filter(
        d => d.data().toUid === user.uid && !d.data().readByRecipient
      );
      for (const d of unread) {
        updateDoc(doc(db, "messages", d.id), { readByRecipient: true });
      }
    });
    return () => unsub();
  }, [user]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const sendMessage = async () => {
    if (!text.trim() || !user || sending) return;
    setSending(true);
    const msg = {
      fromUid: user.uid,
      toUid: ADMIN_UID,
      participants: [user.uid, ADMIN_UID],
      text: text.trim(),
      sentAt: new Date().toISOString(),
      readByRecipient: false,
    };
    setText("");
    await addDoc(collection(db, "messages"), msg);
    setSending(false);
    inputRef.current?.focus();
  };

  const handleKey = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const { isPremium } = useFeatures();
  const canMessage = isPremium;

  return (
    <div style={{ minHeight: "100vh", backgroundColor: "#f7f5f2", display: "flex", flexDirection: "column" }}>
      <PortalNav />

      {/* Header */}
      <div style={{ background: "linear-gradient(160deg, #1a3a2a 0%, #2d6a4f 100%)", padding: "16px 20px 20px", flexShrink: 0 }}>
        <p style={{ fontSize: "13px", fontWeight: 700, color: "rgba(255,255,255,0.5)", letterSpacing: "0.1em", textTransform: "uppercase", margin: "0 0 10px" }}>Messages</p>
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <div style={{ width: 44, height: 44, borderRadius: "50%", backgroundColor: "#4ade80", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "20px", flexShrink: 0 }}>
            💪
          </div>
          <div>
            <p style={{ fontSize: "17px", fontWeight: 700, color: "#fff", margin: 0 }}>Michael Byrne</p>
            <p style={{ fontSize: "13px", color: "#9fe1cb", margin: 0 }}>Your coach</p>
          </div>
        </div>
      </div>

      {/* Free user gate */}
      {!canMessage && (
        <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "32px 24px 120px" }}>
          <div style={{ backgroundColor: "#fff", borderRadius: "20px", border: "0.5px solid #e5e5e5", padding: "28px 24px", textAlign: "center", maxWidth: 360, width: "100%" }}>
            <p style={{ fontSize: "36px", margin: "0 0 12px" }}>💬</p>
            <p style={{ fontSize: "18px", fontWeight: 700, color: "#111", margin: "0 0 8px" }}>Direct access to Michael</p>
            <p style={{ fontSize: "14px", color: "#888", margin: "0 0 24px", lineHeight: 1.5 }}>
              Send messages directly to your coach. Available on Premium and all coaching plans.
            </p>
            <Link
              to="/bundles"
              style={{ display: "block", backgroundColor: "#2d6a4f", color: "#fff", borderRadius: "12px", padding: "14px", fontSize: "15px", fontWeight: 700, textDecoration: "none", marginBottom: "10px" }}
            >
              Upgrade to unlock
            </Link>
            <p style={{ fontSize: "13px", color: "#aaa", margin: 0 }}>Premium from €19.99 / 4 weeks</p>
          </div>
        </div>
      )}

      {canMessage && <div style={{ height: 20, background: "#f7f5f2", borderRadius: "20px 20px 0 0", marginTop: -20, flexShrink: 0 }} />}

      {/* Messages */}
      {canMessage && <>
      <div style={{ flex: 1, overflowY: "auto", padding: "8px 16px", paddingBottom: "140px" }}>
        {messages.length === 0 && (
          <div style={{ textAlign: "center", padding: "48px 20px" }}>
            <p style={{ fontSize: "32px", margin: "0 0 12px" }}>💬</p>
            <p style={{ fontSize: "16px", fontWeight: 700, color: "#111", margin: "0 0 6px" }}>Start the conversation</p>
            <p style={{ fontSize: "13px", color: "#888", margin: 0 }}>Send Michael a message. He'll reply as soon as he can.</p>
          </div>
        )}

        {messages.map((msg, i) => {
          const isMe = msg.fromUid === user?.uid;
          const prevMsg = messages[i - 1];
          const showTime = !prevMsg ||
            new Date(msg.sentAt) - new Date(prevMsg.sentAt) > 1000 * 60 * 15;

          return (
            <div key={msg.id}>
              {showTime && (
                <p style={{ textAlign: "center", fontSize: "11px", color: "#aaa", margin: "12px 0 8px", fontWeight: 600 }}>
                  {formatTime(msg.sentAt)}
                </p>
              )}
              <div style={{
                display: "flex",
                justifyContent: isMe ? "flex-end" : "flex-start",
                marginBottom: "4px",
              }}>
                <div style={{
                  maxWidth: "75%",
                  backgroundColor: isMe ? "#2d6a4f" : "#fff",
                  color: isMe ? "#fff" : "#111",
                  borderRadius: isMe ? "18px 18px 4px 18px" : "18px 18px 18px 4px",
                  padding: "10px 14px",
                  fontSize: "15px",
                  lineHeight: 1.4,
                  border: isMe ? "none" : "0.5px solid #e5e5e5",
                  boxShadow: "0 1px 4px rgba(0,0,0,0.06)",
                }}>
                  {msg.text}
                </div>
              </div>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      {/* Input bar */}
      <div style={{
        position: "fixed",
        bottom: 0,
        left: 0,
        right: 0,
        backgroundColor: "#fff",
        borderTop: "0.5px solid #e5e5e5",
        padding: "10px 12px calc(10px + env(safe-area-inset-bottom))",
        display: "flex",
        alignItems: "flex-end",
        gap: "10px",
        zIndex: 50,
      }}>
        <textarea
          ref={inputRef}
          value={text}
          onChange={e => setText(e.target.value)}
          onKeyDown={handleKey}
          placeholder="Message Michael..."
          rows={1}
          style={{
            flex: 1,
            padding: "10px 14px",
            borderRadius: "20px",
            border: "1.5px solid #e5e5e5",
            fontSize: "15px",
            outline: "none",
            resize: "none",
            fontFamily: "inherit",
            lineHeight: 1.4,
            maxHeight: "100px",
            overflowY: "auto",
          }}
          onInput={e => {
            e.target.style.height = "auto";
            e.target.style.height = Math.min(e.target.scrollHeight, 100) + "px";
          }}
        />
        <button
          onClick={sendMessage}
          disabled={!text.trim() || sending}
          aria-label="Send message"
          style={{
            width: 40,
            height: 40,
            borderRadius: "50%",
            backgroundColor: text.trim() ? "#2d6a4f" : "#e5e5e5",
            border: "none",
            cursor: text.trim() ? "pointer" : "default",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
            transition: "background-color 0.15s",
          }}
        >
          <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
            <path d="M16 9L2 2l3 7-3 7 14-7z" fill={text.trim() ? "#fff" : "#aaa"} />
          </svg>
        </button>
      </div>
      </>}
    </div>
  );
}
