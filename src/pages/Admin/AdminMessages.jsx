import { useState, useEffect, useRef } from "react";
import { auth, db } from "../../firebase";
import {
  collection, query, where, onSnapshot,
  addDoc, doc, updateDoc, orderBy, getDoc,
} from "firebase/firestore";
import { Link } from "react-router-dom";

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

export default function AdminMessages() {
  const [allMessages, setAllMessages] = useState([]);
  const [clientNames, setClientNames] = useState({}); // uid -> name
  const [selectedUid, setSelectedUid] = useState(null);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [fetchedUids, setFetchedUids] = useState(new Set());
  const bottomRef = useRef(null);
  const inputRef = useRef(null);

  // Listen to all messages involving admin
  useEffect(() => {
    const q = query(
      collection(db, "messages"),
      where("participants", "array-contains", ADMIN_UID),
      orderBy("sentAt", "asc")
    );
    const unsub = onSnapshot(q, (snap) => {
      setAllMessages(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });
    return () => unsub();
  }, []);

  // Fetch names for any unseen client UIDs
  useEffect(() => {
    const uids = [...new Set(
      allMessages
        .map(m => m.fromUid === ADMIN_UID ? m.toUid : m.fromUid)
        .filter(uid => uid !== ADMIN_UID && !fetchedUids.has(uid))
    )];
    if (uids.length === 0) return;
    setFetchedUids(prev => new Set([...prev, ...uids]));
    uids.forEach(async (uid) => {
      const snap = await getDoc(doc(db, "users", uid));
      if (snap.exists()) {
        const d = snap.data();
        const name = `${d.firstName || ""} ${d.lastName || ""}`.trim() || d.email || uid;
        setClientNames(prev => ({ ...prev, [uid]: name }));
      } else {
        setClientNames(prev => ({ ...prev, [uid]: uid }));
      }
    });
  }, [allMessages, fetchedUids]);

  // Mark unread messages in selected thread as read when thread opens
  useEffect(() => {
    if (!selectedUid) return;
    const unread = allMessages.filter(
      m => m.fromUid === selectedUid && m.toUid === ADMIN_UID && !m.readByRecipient
    );
    unread.forEach(m => updateDoc(doc(db, "messages", m.id), { readByRecipient: true }));
  }, [selectedUid, allMessages]);

  // Scroll to bottom when thread changes
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [allMessages, selectedUid]);

  // Build conversation list: unique client UIDs sorted by last message
  const conversations = (() => {
    const map = {};
    allMessages.forEach(m => {
      const clientUid = m.fromUid === ADMIN_UID ? m.toUid : m.fromUid;
      if (!map[clientUid]) map[clientUid] = { uid: clientUid, lastMsg: m, unread: 0 };
      else map[clientUid].lastMsg = m;
      if (m.fromUid === clientUid && m.toUid === ADMIN_UID && !m.readByRecipient) {
        map[clientUid].unread += 1;
      }
    });
    return Object.values(map).sort(
      (a, b) => new Date(b.lastMsg.sentAt) - new Date(a.lastMsg.sentAt)
    );
  })();

  const threadMessages = allMessages.filter(m =>
    (m.fromUid === selectedUid && m.toUid === ADMIN_UID) ||
    (m.fromUid === ADMIN_UID && m.toUid === selectedUid)
  );

  const sendMessage = async () => {
    if (!text.trim() || !selectedUid || sending) return;
    setSending(true);
    const msg = {
      fromUid: ADMIN_UID,
      toUid: selectedUid,
      participants: [ADMIN_UID, selectedUid],
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

  return (
    <div style={{ minHeight: "100vh", backgroundColor: "#f7f5f2" }}>
      {/* Admin nav */}
      <div style={{ backgroundColor: "#1a3a2a", padding: "12px 16px", display: "flex", alignItems: "center", gap: "12px" }}>
        <Link to="/admin" style={{ color: "#9fe1cb", textDecoration: "none", fontSize: "13px", fontWeight: 700 }}>← Admin</Link>
        <p style={{ fontSize: "15px", fontWeight: 700, color: "#fff", margin: 0 }}>Messages</p>
      </div>

      <div style={{ display: "flex", height: "calc(100vh - 48px)" }}>

        {/* Conversation list */}
        <div style={{
          width: selectedUid ? "0" : "100%",
          minWidth: selectedUid ? "0" : "100%",
          overflowY: "auto",
          borderRight: "0.5px solid #e5e5e5",
          transition: "width 0.2s",
          display: selectedUid ? "none" : "block",
        }}>
          <div style={{ padding: "12px 16px 8px" }}>
            <p style={{ fontSize: "11px", fontWeight: 700, color: "#aaa", textTransform: "uppercase", letterSpacing: "0.08em", margin: 0 }}>
              {conversations.length} conversation{conversations.length !== 1 ? "s" : ""}
            </p>
          </div>
          {conversations.length === 0 && (
            <div style={{ textAlign: "center", padding: "48px 20px" }}>
              <p style={{ fontSize: "32px", margin: "0 0 12px" }}>💬</p>
              <p style={{ fontSize: "15px", fontWeight: 700, color: "#111", margin: "0 0 6px" }}>No messages yet</p>
              <p style={{ fontSize: "13px", color: "#888", margin: 0 }}>Clients will appear here when they send you a message.</p>
            </div>
          )}
          {conversations.map(conv => (
            <button
              key={conv.uid}
              onClick={() => setSelectedUid(conv.uid)}
              style={{
                width: "100%",
                backgroundColor: "#fff",
                border: "none",
                borderBottom: "0.5px solid #f5f5f5",
                padding: "14px 16px",
                textAlign: "left",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: "12px",
              }}
            >
              <div style={{
                width: 44, height: 44, borderRadius: "50%",
                backgroundColor: "#eaf5ef",
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: "18px", flexShrink: 0,
              }}>
                👤
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "2px" }}>
                  <p style={{ fontSize: "15px", fontWeight: 700, color: "#111", margin: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {clientNames[conv.uid] || "Loading..."}
                  </p>
                  <span style={{ fontSize: "12px", color: "#aaa", flexShrink: 0, marginLeft: "8px" }}>
                    {formatTime(conv.lastMsg.sentAt)}
                  </span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <p style={{ fontSize: "13px", color: conv.unread > 0 ? "#111" : "#888", margin: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontWeight: conv.unread > 0 ? 600 : 400, flex: 1 }}>
                    {conv.lastMsg.fromUid === ADMIN_UID ? "You: " : ""}{conv.lastMsg.text}
                  </p>
                  {conv.unread > 0 && (
                    <span style={{ backgroundColor: "#2d6a4f", color: "#fff", borderRadius: "50%", width: 20, height: 20, display: "flex", alignItems: "center", justifyContent: "center", fontSize: "11px", fontWeight: 700, flexShrink: 0, marginLeft: "8px" }}>
                      {conv.unread}
                    </span>
                  )}
                </div>
              </div>
            </button>
          ))}
        </div>

        {/* Thread view */}
        {selectedUid && (
          <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0 }}>
            {/* Thread header */}
            <div style={{ backgroundColor: "#fff", borderBottom: "0.5px solid #e5e5e5", padding: "12px 16px", display: "flex", alignItems: "center", gap: "12px", flexShrink: 0 }}>
              <button
                onClick={() => setSelectedUid(null)}
                style={{ background: "none", border: "none", fontSize: "15px", fontWeight: 700, color: "#2d6a4f", cursor: "pointer", padding: 0 }}
              >
                ← Back
              </button>
              <div>
                <p style={{ fontSize: "15px", fontWeight: 700, color: "#111", margin: 0 }}>
                  {clientNames[selectedUid] || "Client"}
                </p>
                <Link
                  to={`/admin/clients/${selectedUid}`}
                  style={{ fontSize: "12px", color: "#2d6a4f", textDecoration: "none", fontWeight: 600 }}
                >
                  View profile →
                </Link>
              </div>
            </div>

            {/* Messages */}
            <div style={{ flex: 1, overflowY: "auto", padding: "12px 16px 80px" }}>
              {threadMessages.length === 0 && (
                <div style={{ textAlign: "center", padding: "40px 20px" }}>
                  <p style={{ fontSize: "13px", color: "#aaa" }}>No messages yet. Send the first one.</p>
                </div>
              )}
              {threadMessages.map((msg, i) => {
                const isMe = msg.fromUid === ADMIN_UID;
                const prevMsg = threadMessages[i - 1];
                const showTime = !prevMsg ||
                  new Date(msg.sentAt) - new Date(prevMsg.sentAt) > 1000 * 60 * 15;
                return (
                  <div key={msg.id}>
                    {showTime && (
                      <p style={{ textAlign: "center", fontSize: "11px", color: "#aaa", margin: "12px 0 8px", fontWeight: 600 }}>
                        {formatTime(msg.sentAt)}
                      </p>
                    )}
                    <div style={{ display: "flex", justifyContent: isMe ? "flex-end" : "flex-start", marginBottom: "4px" }}>
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

            {/* Input */}
            <div style={{
              backgroundColor: "#fff",
              borderTop: "0.5px solid #e5e5e5",
              padding: "10px 12px",
              display: "flex",
              alignItems: "flex-end",
              gap: "10px",
              flexShrink: 0,
            }}>
              <textarea
                ref={inputRef}
                value={text}
                onChange={e => setText(e.target.value)}
                onKeyDown={handleKey}
                placeholder={`Message ${clientNames[selectedUid]?.split(" ")[0] || "client"}...`}
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
                }}
              >
                <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
                  <path d="M16 9L2 2l3 7-3 7 14-7z" fill={text.trim() ? "#fff" : "#aaa"} />
                </svg>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
