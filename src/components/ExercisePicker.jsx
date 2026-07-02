import { useState, useEffect } from "react";
import { collection, getDocs, addDoc, serverTimestamp } from "firebase/firestore";
import { db } from "../firebase";

async function requestExercise(userId, exerciseName) {
  try {
    await addDoc(collection(db, "exerciseRequests"), {
      exerciseName: exerciseName.trim(),
      userId,
      status: "pending",
      createdAt: serverTimestamp(),
    });
    return true;
  } catch (e) {
    console.error("Exercise request failed:", e);
    return false;
  }
}

const MUSCLE_HIERARCHY = {
  Legs: ["Quads", "Hamstrings", "Calves", "Glutes", "Adductors"],
  Arms: ["Biceps", "Triceps"],
  Core: ["Abs", "Obliques"],
};
const TOP_LEVEL_GROUPS = ["All", "Back", "Chest", "Shoulders", "Legs", "Arms", "Core", "Full Body", "Cardio"];

export function getExerciseMuscles(ex) {
  if (ex.muscleGroups?.length) return ex.muscleGroups;
  if (ex.muscleGroup) return [ex.muscleGroup];
  if (ex.category) return [ex.category];
  return [];
}

export function hasVideo(ex) {
  return !!(ex.videoUrl?.trim() || ex.media?.demoUrl?.trim() || ex.media?.demoThumbnailUrl?.trim());
}

function DumbbellFallbackIcon({ size = 20, stroke = "#5a9e7a" }) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" fill="none" stroke={stroke} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 8v4M5 6.5v7M15 6.5v7M17 8v4M5 10h10" />
    </svg>
  );
}

function firstNoteLine(notes) {
  if (!notes) return null;
  return notes.split(/\n|\. /)[0].replace(/\.$/, "");
}

function ExerciseRow({ ex, onSelect }) {
  return (
    <button
      onClick={() => onSelect(ex)}
      style={{
        width: "100%",
        display: "flex",
        alignItems: "center",
        gap: 12,
        padding: "12px 14px",
        borderRadius: "14px",
        border: "0.5px solid #e5e5e5",
        backgroundColor: "#fff",
        cursor: "pointer",
        textAlign: "left",
      }}
    >
      <div style={{ position: "relative", flexShrink: 0 }}>
        <div
          style={{
            width: 52,
            height: 52,
            borderRadius: "12px",
            backgroundColor: "#eaf5ef",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            overflow: "hidden",
          }}
        >
          {hasVideo(ex) ? (
            <img
              src={
                ex.media?.demoThumbnailUrl ||
                (ex.videoUrl
                  ? `https://img.youtube.com/vi/${ex.videoUrl.match(/(?:v=|youtu\.be\/|shorts\/)([^&?/]+)/)?.[1]}/mqdefault.jpg`
                  : null)
              }
              alt={ex.name}
              style={{ width: "100%", height: "100%", objectFit: "cover" }}
              onError={(e) => { e.target.style.display = "none"; e.target.nextSibling.style.display = "flex"; }}
            />
          ) : null}
          <span style={{ display: hasVideo(ex) ? "none" : "flex" }}><DumbbellFallbackIcon size={22} stroke="#5a9e7a" /></span>
        </div>
        {hasVideo(ex) && (
          <div style={{
            position: "absolute", bottom: -3, right: -3, width: 18, height: 18, borderRadius: "50%",
            backgroundColor: "#2d6a4f", display: "flex", alignItems: "center", justifyContent: "center", border: "2px solid #fff",
          }}>
            <span style={{ fontSize: 7, color: "#fff", marginLeft: 1 }}>▶</span>
          </div>
        )}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ fontSize: 14, fontWeight: 700, color: "#111", margin: "0 0 2px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {ex.name}
        </p>
        <p style={{ fontSize: 12, color: "#888", margin: 0 }}>
          {getExerciseMuscles(ex).join(", ") || "Exercise"}
        </p>
      </div>
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" style={{ flexShrink: 0 }}>
        <path d="M8 3v10M3 8h10" stroke="#2d6a4f" strokeWidth="2" strokeLinecap="round" />
      </svg>
    </button>
  );
}

function RecommendedRow({ label, exercises, onSelect }) {
  if (!exercises || exercises.length === 0) return null;
  return (
    <div style={{ marginBottom: 16 }}>
      <p style={{ fontSize: 11, fontWeight: 700, color: "#2d6a4f", textTransform: "uppercase", letterSpacing: "0.06em", margin: "0 0 10px" }}>
        Recommended{label ? ` for ${label}` : " for you"}
      </p>
      <div style={{ display: "flex", gap: 10, overflowX: "auto", paddingBottom: 4, scrollbarWidth: "none" }}>
        {exercises.map((ex) => {
          const note = firstNoteLine(ex.coachingNotes);
          return (
            <button
              key={ex.id}
              onClick={() => onSelect(ex)}
              style={{
                flexShrink: 0,
                width: 148,
                textAlign: "left",
                border: "1.5px solid #bfe3d0",
                backgroundColor: "#eaf5ef",
                borderRadius: 14,
                padding: 10,
                cursor: "pointer",
              }}
            >
              <div
                style={{
                  width: "100%", height: 64, borderRadius: 10, backgroundColor: "#fff", marginBottom: 8,
                  display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden",
                }}
              >
                {hasVideo(ex) ? (
                  <img
                    src={
                      ex.media?.demoThumbnailUrl ||
                      (ex.videoUrl
                        ? `https://img.youtube.com/vi/${ex.videoUrl.match(/(?:v=|youtu\.be\/|shorts\/)([^&?/]+)/)?.[1]}/mqdefault.jpg`
                        : null)
                    }
                    alt={ex.name}
                    style={{ width: "100%", height: "100%", objectFit: "cover" }}
                    onError={(e) => { e.target.style.display = "none"; }}
                  />
                ) : (
                  <DumbbellFallbackIcon size={20} stroke="#5a9e7a" />
                )}
              </div>
              <p style={{ fontSize: 12.5, fontWeight: 700, color: "#111", margin: 0, lineHeight: 1.25 }}>{ex.name}</p>
              {note && (
                <p
                  style={{
                    fontSize: 10.5, color: "#5a9e7a", margin: "4px 0 0", lineHeight: 1.3, fontStyle: "italic",
                    display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden",
                  }}
                >
                  {note}
                </p>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

/**
 * ExercisePicker — bottom sheet exercise browser.
 *
 * recommended: optional { label, exercises } — shown above the category
 * browse list as a "Recommended for X" horizontal row. Pass this in whenever
 * the caller knows which movement slot is still missing (Add Exercise from
 * an active session) or which alternates fit a swap.
 */
export default function ExercisePicker({ onSelect, onClose, userId, recommended, title }) {
  const [exercises, setExercises] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("All");
  const [subFilter, setSubFilter] = useState(null);
  const [search, setSearch] = useState("");
  const [videoOnly, setVideoOnly] = useState(true);
  const [requestSent, setRequestSent] = useState(false);
  const [requesting, setRequesting] = useState(false);

  const handleSetFilter = (g) => {
    setFilter(g);
    setSubFilter(null);
  };

  useEffect(() => {
    getDocs(collection(db, "exercises")).then((snap) => {
      const data = snap.docs
        .map((d) => ({ id: d.id, ...d.data() }))
        .filter((e) => e.isActive !== false)
        .sort((a, b) => (a.name || "").localeCompare(b.name || ""));
      setExercises(data);
      setLoading(false);
    });
  }, []);

  const filtered = exercises.filter((e) => {
    const muscles = getExerciseMuscles(e);
    let matchGroup;
    if (filter === "All") {
      matchGroup = true;
    } else if (subFilter) {
      matchGroup = muscles.includes(subFilter);
    } else {
      const children = MUSCLE_HIERARCHY[filter] || [];
      matchGroup = muscles.includes(filter) || children.some((c) => muscles.includes(c));
    }
    const matchSearch = !search || (e.name || "").toLowerCase().includes(search.toLowerCase());
    const matchVideo = !videoOnly || hasVideo(e);
    return matchGroup && matchSearch && matchVideo;
  });

  const videoCount = exercises.filter(hasVideo).length;
  const recommendedIds = recommended?.exercises?.map((e) => e.id) || [];

  return (
    <div
      style={{ position: "fixed", inset: 0, backgroundColor: "rgba(0,0,0,0.55)", zIndex: 150, display: "flex", alignItems: "flex-end" }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div style={{ backgroundColor: "#fff", borderRadius: "24px 24px 0 0", width: "100%", height: "85vh", display: "flex", flexDirection: "column" }}>
        <div style={{ padding: "16px 0 0", display: "flex", justifyContent: "center", flexShrink: 0 }}>
          <div style={{ width: 36, height: 4, backgroundColor: "#e5e5e5", borderRadius: 2 }} />
        </div>

        <div style={{ padding: "16px 16px 12px", display: "flex", alignItems: "center", justifyContent: "space-between", flexShrink: 0 }}>
          <h2 style={{ fontSize: 18, fontWeight: 700, color: "#111", margin: 0 }}>{title || "Add Exercise"}</h2>
          <button onClick={onClose} style={{ background: "none", border: "none", fontSize: 22, color: "#aaa", cursor: "pointer", padding: "0 0 0 8px" }}>
            ×
          </button>
        </div>

        <div style={{ padding: "0 16px 12px", flexShrink: 0 }}>
          <input
            type="text"
            placeholder="Search exercises..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{
              width: "100%", padding: "11px 14px", borderRadius: "12px", border: "1.5px solid #e5e5e5",
              fontSize: 14, backgroundColor: "#f7f5f2", outline: "none", boxSizing: "border-box",
            }}
          />
        </div>

        <div style={{ overflowX: "auto", padding: "0 16px 8px", display: "flex", gap: 8, flexShrink: 0, scrollbarWidth: "none" }}>
          <button
            onClick={() => setVideoOnly((v) => !v)}
            style={{
              flexShrink: 0, padding: "7px 12px", borderRadius: "20px", border: videoOnly ? "none" : "1.5px solid #e5e5e5",
              backgroundColor: videoOnly ? "#2d6a4f" : "#fff", color: videoOnly ? "#fff" : "#aaa", fontSize: 13, fontWeight: 600,
              cursor: "pointer", display: "flex", alignItems: "center", gap: 5,
            }}
          >
            <span style={{ fontSize: 11 }}>▶</span>
            {videoOnly ? `Videos (${videoCount})` : "Videos"}
          </button>
          <div style={{ width: 1, backgroundColor: "#e5e5e5", flexShrink: 0, margin: "4px 0" }} />
          {TOP_LEVEL_GROUPS.map((g) => {
            const hasSubs = !!MUSCLE_HIERARCHY[g];
            const isActive = filter === g;
            return (
              <button
                key={g}
                onClick={() => handleSetFilter(g)}
                style={{
                  flexShrink: 0, padding: "7px 14px", borderRadius: "20px", border: "none",
                  backgroundColor: isActive ? "#1a3a2a" : "#f0f0f0", color: isActive ? "#fff" : "#555",
                  fontSize: 13, fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", gap: 4,
                }}
              >
                {g}
                {hasSubs && <span style={{ fontSize: 9, opacity: isActive ? 0.8 : 0.5, marginTop: 1 }}>▾</span>}
              </button>
            );
          })}
        </div>

        {MUSCLE_HIERARCHY[filter] && (
          <div style={{ overflowX: "auto", padding: "0 16px 12px", display: "flex", gap: 6, flexShrink: 0, scrollbarWidth: "none" }}>
            <button
              onClick={() => setSubFilter(null)}
              style={{
                flexShrink: 0, padding: "5px 12px", borderRadius: "16px", border: "none",
                backgroundColor: !subFilter ? "#2d6a4f" : "#f0f0f0", color: !subFilter ? "#fff" : "#888", fontSize: 12, fontWeight: 600, cursor: "pointer",
              }}
            >
              All {filter}
            </button>
            {MUSCLE_HIERARCHY[filter].map((sub) => (
              <button
                key={sub}
                onClick={() => setSubFilter(sub)}
                style={{
                  flexShrink: 0, padding: "5px 12px", borderRadius: "16px", border: "none",
                  backgroundColor: subFilter === sub ? "#2d6a4f" : "#f0f0f0", color: subFilter === sub ? "#fff" : "#888", fontSize: 12, fontWeight: 600, cursor: "pointer",
                }}
              >
                {sub}
              </button>
            ))}
          </div>
        )}

        <div style={{ flex: 1, overflowY: "auto", padding: "8px 16px 24px" }}>
          {loading && (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {[1, 2, 3, 4].map((i) => (
                <div key={i} style={{ height: 64, backgroundColor: "#f7f5f2", borderRadius: "12px", opacity: 0.5 }} />
              ))}
            </div>
          )}

          {!loading && recommended?.exercises?.length > 0 && (
            <RecommendedRow label={recommended.label} exercises={recommended.exercises} onSelect={onSelect} />
          )}

          {!loading && filtered.length === 0 && (
            <div style={{ textAlign: "center", padding: "40px 16px" }}>
              <p style={{ color: "#aaa", fontSize: 14, margin: "0 0 6px" }}>No exercises found</p>
              {subFilter && (
                <p style={{ color: "#bbb", fontSize: 12, margin: "0 0 16px" }}>
                  None tagged "{subFilter}" yet. Tap "All {filter}" to see all.
                </p>
              )}
              {search.trim().length > 1 && !requestSent && (
                <div style={{ marginTop: 12 }}>
                  <p style={{ fontSize: 13, color: "#888", margin: "0 0 10px" }}>Can't find "{search.trim()}"?</p>
                  <button
                    onClick={async () => {
                      setRequesting(true);
                      const ok = await requestExercise(userId, search.trim());
                      setRequesting(false);
                      if (ok) setRequestSent(true);
                    }}
                    disabled={requesting}
                    style={{
                      backgroundColor: "#1a3a2a", color: "#fff", border: "none", borderRadius: 10, padding: "10px 18px",
                      fontWeight: 700, fontSize: 13, cursor: requesting ? "not-allowed" : "pointer", opacity: requesting ? 0.7 : 1,
                    }}
                  >
                    {requesting ? "Sending..." : `Request "${search.trim()}"`}
                  </button>
                </div>
              )}
              {requestSent && (
                <div style={{ marginTop: 12, backgroundColor: "#eaf5ef", borderRadius: 10, padding: "12px 16px" }}>
                  <p style={{ fontSize: 13, fontWeight: 700, color: "#2d6a4f", margin: "0 0 2px" }}>Request sent!</p>
                  <p style={{ fontSize: 12, color: "#5a9e7a", margin: 0 }}>Michael will add it to the library soon.</p>
                </div>
              )}
            </div>
          )}

          {!loading && filtered.length > 0 && (
            <>
              {recommended?.exercises?.length > 0 && (
                <p style={{ fontSize: 11, fontWeight: 700, color: "#aaa", textTransform: "uppercase", letterSpacing: "0.06em", margin: "0 0 10px" }}>
                  More Exercises
                </p>
              )}
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {filtered
                  .filter((e) => !recommendedIds.includes(e.id))
                  .map((ex) => (
                    <ExerciseRow key={ex.id} ex={ex} onSelect={onSelect} />
                  ))}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
