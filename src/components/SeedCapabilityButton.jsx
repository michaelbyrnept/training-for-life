import { useState } from "react";
import { doc, setDoc, collection, Timestamp } from "firebase/firestore";
import { db } from "../firebase";

const EXERCISES = {
  backSquat:        { name: "Back Squat",                    type: "barbell"   },
  rdl:              { name: "Romanian Deadlift",              type: "barbell"   },
  dbShoulderPress:  { name: "DB Shoulder Press",              type: "dumbbell"  },
  latPulldown:      { name: "Lat Pulldown",                   type: "cable"     },
  benchPress:       { name: "Bench Press",                    type: "barbell"   },
  legExtension:     { name: "Leg Extension",                  type: "machine"   },
  legCurl:          { name: "Leg Curl",                       type: "machine"   },
  tBarRow:          { name: "T-Bar Row",                      type: "barbell"   },
  deadlift:         { name: "Deadlift",                       type: "barbell"   },
  bulgarianSplit:   { name: "Bulgarian Split Squat",          type: "dumbbell"  },
  inclineBench:     { name: "Incline Bench Press",            type: "barbell"   },
  pullUps:          { name: "Pull Ups / Chest Supported Row", type: "bodyweight"},
  garhammer:        { name: "Garhammer Raise",                type: "bodyweight"},
  axeChoppers:      { name: "Axe Choppers",                   type: "cable"     },
  sideBends:        { name: "Side Bends",                     type: "dumbbell"  },
  cableCurl:        { name: "Cable Curl",                     type: "cable"     },
  cableExtension:   { name: "Cable Tricep Extension",         type: "cable"     },
  dbCurl:           { name: "DB Curl",                        type: "dumbbell"  },
  hammerCurl:       { name: "Hammer Curl",                    type: "dumbbell"  },
  skullCrushers:    { name: "Skull Crushers",                 type: "barbell"   },
};

function blockScheme(block) {
  return {
    1: { topSet: { sets: 1, reps: "5", rpe: "8" }, backOff: { sets: 3, reps: "5", pct: 80   }, accessory: { sets: 3, reps: "10" }, core: { sets: 3, reps: "12" }, arms: { sets: 3, reps: "12" } },
    2: { topSet: { sets: 1, reps: "3", rpe: "8" }, backOff: { sets: 4, reps: "3", pct: 82.5 }, accessory: { sets: 3, reps: "8"  }, core: { sets: 3, reps: "15" }, arms: { sets: 3, reps: "10" } },
    3: { topSet: { sets: 1, reps: "1", rpe: "9" }, backOff: { sets: 5, reps: "2", pct: 85   }, accessory: { sets: 4, reps: "6"  }, core: { sets: 3, reps: "15" }, arms: { sets: 3, reps: "8"  } },
  }[block];
}

function deloadScheme() {
  return { topSet: { sets: 1, reps: "5", rpe: "6" }, backOff: { sets: 2, reps: "5", pct: 70 }, accessory: { sets: 2, reps: "10" }, core: { sets: 2, reps: "10" }, arms: { sets: 2, reps: "10" } };
}

function buildWeightsSession(dayKey, block, weekInBlock, weekNum) {
  const s = weekInBlock === 4 ? deloadScheme() : blockScheme(block);
  const isDeload = weekInBlock === 4;
  const blockLabel = `Block ${block}, Week ${weekInBlock}${isDeload ? " (Deload)" : ""}`;

  const core = [
    { ...EXERCISES.garhammer,      category: "core", sets: s.core.sets, reps: s.core.reps, rest: "60 sec" },
    { ...EXERCISES.axeChoppers,    category: "core", sets: s.core.sets, reps: s.core.reps, rest: "60 sec" },
    { ...EXERCISES.sideBends,      category: "core", sets: s.core.sets, reps: s.core.reps, rest: "60 sec" },
  ];
  const arms = [
    { ...EXERCISES.cableCurl,      category: "arms", sets: s.arms.sets, reps: s.arms.reps, rest: "60 sec" },
    { ...EXERCISES.cableExtension, category: "arms", sets: s.arms.sets, reps: s.arms.reps, rest: "60 sec" },
    { ...EXERCISES.dbCurl,         category: "arms", sets: s.arms.sets, reps: s.arms.reps, rest: "60 sec" },
    { ...EXERCISES.hammerCurl,     category: "arms", sets: s.arms.sets, reps: s.arms.reps, rest: "60 sec" },
    { ...EXERCISES.skullCrushers,  category: "arms", sets: s.arms.sets, reps: s.arms.reps, rest: "60 sec" },
  ];

  const configs = {
    monday: {
      name: "Day A -- Back Squat", day: "Monday",
      exercises: [
        { ...EXERCISES.backSquat,       category: "main",      label: "Top Set",       sets: s.topSet.sets,  reps: s.topSet.reps,  rpe: s.topSet.rpe, rest: "3-4 min", note: "Work up to a heavy top set for the day" },
        { ...EXERCISES.backSquat,       category: "main",      label: "Back Off Sets", sets: s.backOff.sets, reps: s.backOff.reps, pctOfTopSet: s.backOff.pct, rest: "2-3 min", note: `${s.backOff.pct}% of top set` },
        { ...EXERCISES.rdl,             category: "accessory", sets: s.accessory.sets, reps: s.accessory.reps, rest: "90 sec" },
        { ...EXERCISES.dbShoulderPress, category: "accessory", sets: s.accessory.sets, reps: s.accessory.reps, rest: "90 sec" },
        { ...EXERCISES.latPulldown,     category: "accessory", sets: s.accessory.sets, reps: s.accessory.reps, rest: "90 sec" },
        ...core, ...arms,
      ],
    },
    wednesday: {
      name: "Day B -- Bench Press", day: "Wednesday",
      exercises: [
        { ...EXERCISES.benchPress,   category: "main",      label: "Top Set",       sets: s.topSet.sets,  reps: s.topSet.reps,  rpe: s.topSet.rpe, rest: "3-4 min", note: "Work up to a heavy top set for the day" },
        { ...EXERCISES.benchPress,   category: "main",      label: "Back Off Sets", sets: s.backOff.sets, reps: s.backOff.reps, pctOfTopSet: s.backOff.pct, rest: "2-3 min", note: `${s.backOff.pct}% of top set` },
        { ...EXERCISES.legExtension, category: "accessory", sets: s.accessory.sets, reps: s.accessory.reps, rest: "90 sec" },
        { ...EXERCISES.legCurl,      category: "accessory", sets: s.accessory.sets, reps: s.accessory.reps, rest: "90 sec" },
        { ...EXERCISES.tBarRow,      category: "accessory", sets: s.accessory.sets, reps: s.accessory.reps, rest: "90 sec" },
        ...core, ...arms,
      ],
    },
    friday: {
      name: "Day C -- Deadlift", day: "Friday",
      exercises: [
        { ...EXERCISES.deadlift,       category: "main",      label: "Top Set",       sets: s.topSet.sets,  reps: s.topSet.reps,  rpe: s.topSet.rpe, rest: "3-4 min", note: "Work up to a heavy top set for the day" },
        { ...EXERCISES.deadlift,       category: "main",      label: "Back Off Sets", sets: s.backOff.sets, reps: s.backOff.reps, pctOfTopSet: s.backOff.pct, rest: "2-3 min", note: `${s.backOff.pct}% of top set` },
        { ...EXERCISES.bulgarianSplit, category: "accessory", sets: s.accessory.sets, reps: s.accessory.reps, rest: "90 sec" },
        { ...EXERCISES.inclineBench,   category: "accessory", sets: s.accessory.sets, reps: s.accessory.reps, rest: "90 sec" },
        { ...EXERCISES.pullUps,        category: "accessory", sets: s.accessory.sets, reps: s.accessory.reps, rest: "90 sec" },
        ...core, ...arms,
      ],
    },
  };

  return { ...configs[dayKey], blockLabel, weekNum, block, weekInBlock, isDeload };
}

function buildRunSession(dayKey, block, weekInBlock) {
  const isDeload = weekInBlock === 4;
  if (dayKey === "tuesday") {
    return {
      type: "easy", label: "Easy Run",
      duration: isDeload ? 20 : 30,
      intensity: "Zone 2 -- conversational pace",
      description: isDeload
        ? "20 min easy recovery jog. Keep heart rate low, focus on form."
        : "30 min easy run. Keep it fully conversational -- you should be able to hold a full sentence throughout.",
    };
  }
  if (dayKey === "thursday") {
    const reps = isDeload ? 3 : (block === 1 ? 4 : block === 2 ? 5 : 6);
    return {
      type: "intervals", label: "Interval Session",
      warmup: "10 min easy jog",
      intervals: { reps, distance: "1km", pace: "5km race pace", rest: "90 sec jog" },
      cooldown: "5 min easy jog",
      description: isDeload
        ? `${reps}x1km at 5km pace with 90 sec jog recovery. Deload week -- keep effort controlled.`
        : `${reps}x1km at 5km race pace with 90 sec jog recovery. Warm up 10 min, cool down 5 min.`,
    };
  }
  if (dayKey === "saturday") {
    const duration = isDeload ? 40 : (block === 1 ? 50 : block === 2 ? 55 : 60);
    return {
      type: "long", label: "Long Easy Run",
      duration,
      intensity: "Zone 2 -- conversational pace",
      description: isDeload
        ? `${duration} min easy long run. Recovery week -- take it easy.`
        : `${duration} min easy long run. Stay in Zone 2 the whole time. No heroics.`,
    };
  }
}

async function seedProgramme(setLog) {
  const programmeId = "capability-programme";
  setLog(["Starting seed..."]);

  try {
    console.log("Writing programme metadata...");
    await setDoc(doc(db, "programmes", programmeId), {
      id: programmeId,
      name: "The Capability Programme",
      slug: programmeId,
      description: "12 weeks of structured strength and running. Three days of barbell lifting paired with three days of running: an easy run, interval session, and long run. Progressive overload across three 4-week blocks.",
      duration: 12,
      daysPerWeek: 6,
      level: "intermediate",
      goal: "Build Confidence",
      tags: ["strength", "running", "hybrid", "barbell"],
      price: 0,
      tier: "premium",
      published: true,
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
      structure: {
        blocks: 3,
        weeksPerBlock: 4,
        deloadWeek: 4,
        weightDays: ["Monday", "Wednesday", "Friday"],
        runDays: ["Tuesday", "Thursday", "Saturday"],
        mainLifts: ["Back Squat", "Bench Press", "Deadlift"],
        runTypes: ["Easy 30min", "5x1km Intervals", "50-60min Long Run"],
      },
    });
    console.log("Programme metadata written OK");
    setLog(prev => [...prev, "Programme metadata written."]);
  } catch (e) {
    console.error("Failed to write programme metadata:", e);
    throw new Error(`Metadata failed: ${e.message}`);
  }

  for (let weekNum = 1; weekNum <= 12; weekNum++) {
    const block = Math.ceil(weekNum / 4);
    const weekInBlock = ((weekNum - 1) % 4) + 1;
    const isDeload = weekInBlock === 4;
    const blockLabel = `Block ${block}${isDeload ? " -- Deload" : ""}`;

    const weekDoc = {
      weekNum, block, weekInBlock, isDeload, blockLabel,
      sessions: {
        monday:    { type: "weights", ...buildWeightsSession("monday",    block, weekInBlock, weekNum) },
        tuesday:   { type: "run",     ...buildRunSession("tuesday",       block, weekInBlock) },
        wednesday: { type: "weights", ...buildWeightsSession("wednesday", block, weekInBlock, weekNum) },
        thursday:  { type: "run",     ...buildRunSession("thursday",      block, weekInBlock) },
        friday:    { type: "weights", ...buildWeightsSession("friday",    block, weekInBlock, weekNum) },
        saturday:  { type: "run",     ...buildRunSession("saturday",      block, weekInBlock) },
        sunday:    { type: "rest",    label: "Rest Day", description: "Full rest. Mobility work or a walk is fine." },
      },
    };

    try {
      const weekPath = `programmes/${programmeId}/weeks/week-${weekNum}`;
      console.log("Writing:", weekPath);
      const weekRef = doc(db, "programmes", programmeId, "weeks", `week-${weekNum}`);
      await setDoc(weekRef, weekDoc);
      console.log("Written OK:", weekPath);
      setLog(prev => [...prev, `Week ${weekNum} / 12 written (Block ${block}${isDeload ? " -- Deload" : ""})`]);
    } catch (e) {
      console.error(`Failed on week ${weekNum}:`, e);
      throw new Error(`Week ${weekNum} failed: ${e.message}`);
    }
  }

  setLog(prev => [...prev, "Done! Capability Programme is live in Firestore."]);
}

export default function SeedCapabilityButton() {
  const [status, setStatus] = useState("idle");
  const [log, setLog] = useState([]);
  const [confirmed, setConfirmed] = useState(false);

  const handleSeed = async () => {
    setStatus("running");
    setLog([]);
    try {
      await seedProgramme(setLog);
      setStatus("done");
    } catch (e) {
      console.error("Seed failed:", e);
      setLog(prev => [...prev, `Error: ${e.message}`]);
      setStatus("error");
    }
  };

  if (status === "done") {
    return (
      <div style={{ background: "#d1fae5", border: "1px solid #6ee7b7", borderRadius: 10, padding: "16px 20px", color: "#065f46", fontWeight: 600 }}>
        Capability Programme seeded successfully. You can remove this button now.
      </div>
    );
  }

  return (
    <div style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: 10, padding: 20, maxWidth: 480 }}>
      <h3 style={{ fontSize: 15, fontWeight: 700, color: "#111", margin: "0 0 6px" }}>Seed Capability Programme</h3>
      <p style={{ fontSize: 13, color: "#6b7280", margin: "0 0 14px" }}>One-time setup. Writes all 12 weeks of programme data to Firestore.</p>

      {status === "idle" && !confirmed && (
        <button
          onClick={() => setConfirmed(true)}
          style={{ background: "#2563eb", color: "#fff", border: "none", borderRadius: 8, padding: "10px 20px", fontSize: 14, fontWeight: 600, cursor: "pointer" }}
        >
          Seed Programme
        </button>
      )}

      {status === "idle" && confirmed && (
        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          <span style={{ fontSize: 13, color: "#374151" }}>Are you sure? This will overwrite existing data.</span>
          <button onClick={handleSeed} style={{ background: "#dc2626", color: "#fff", border: "none", borderRadius: 8, padding: "8px 16px", fontSize: 14, fontWeight: 600, cursor: "pointer" }}>
            Yes, seed it
          </button>
          <button onClick={() => setConfirmed(false)} style={{ background: "none", color: "#6b7280", border: "1px solid #e5e7eb", borderRadius: 8, padding: "8px 16px", fontSize: 14, cursor: "pointer" }}>
            Cancel
          </button>
        </div>
      )}

      {status === "running" && (
        <div style={{ marginTop: 8 }}>
          <div style={{ fontSize: 13, color: "#2563eb", fontWeight: 600, marginBottom: 8 }}>Seeding... do not close this tab.</div>
          <div style={{ background: "#f8fafc", border: "1px solid #e5e7eb", borderRadius: 8, padding: "10px 12px", maxHeight: 200, overflowY: "auto", fontFamily: "monospace", fontSize: 12, color: "#374151" }}>
            {log.map((line, i) => <div key={i}>{line}</div>)}
          </div>
        </div>
      )}

      {status === "error" && (
        <div>
          <div style={{ color: "#dc2626", fontWeight: 600, fontSize: 13, marginBottom: 8 }}>Something went wrong. Check the console.</div>
          <div style={{ background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 8, padding: "10px 12px", fontFamily: "monospace", fontSize: 12, color: "#991b1b" }}>
            {log.map((line, i) => <div key={i}>{line}</div>)}
          </div>
          <button
            onClick={() => { setStatus("idle"); setConfirmed(false); }}
            style={{ marginTop: 10, background: "none", border: "1px solid #e5e7eb", borderRadius: 8, padding: "8px 16px", fontSize: 13, cursor: "pointer" }}
          >
            Try again
          </button>
        </div>
      )}
    </div>
  );
}