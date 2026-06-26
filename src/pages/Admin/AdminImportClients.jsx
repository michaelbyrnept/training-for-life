import { useState, useRef, useCallback } from "react";
import { getFunctions, httpsCallable } from "firebase/functions";
import { functions } from "../../firebase";
import { Link } from "react-router-dom";

// ─── CSV Parser ─────────────────────────────────────────────────────────────
// Handles quoted fields, commas inside quotes, and CRLF/LF line endings.
function parseCSV(text) {
  const lines = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n").split("\n");
  if (lines.length < 2) return { headers: [], rows: [] };

  function parseLine(line) {
    const fields = [];
    let current = "";
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') {
        if (inQuotes && line[i + 1] === '"') { current += '"'; i++; }
        else { inQuotes = !inQuotes; }
      } else if (ch === "," && !inQuotes) {
        fields.push(current.trim());
        current = "";
      } else {
        current += ch;
      }
    }
    fields.push(current.trim());
    return fields;
  }

  const headers = parseLine(lines[0]).map(h => h.toLowerCase().replace(/\s+/g, "_"));
  const rows = [];
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    const fields = parseLine(line);
    const row = {};
    headers.forEach((h, idx) => { row[h] = fields[idx] ?? ""; });
    rows.push(row);
  }
  return { headers, rows };
}

// ─── Column normalisation ────────────────────────────────────────────────────
const COL_MAP = {
  first_name: "firstName", firstname: "firstName", "first name": "firstName",
  last_name: "lastName", lastname: "lastName", "last name": "lastName", surname: "lastName",
  email: "email", email_address: "email", "e-mail": "email",
  phone: "phone", phone_number: "phone", mobile: "phone",
  previous_coach: "previousCoach", coach: "previousCoach",
  notes: "notes", note: "notes",
  membership_type: "membershipType", membership: "membershipType",
  previous_programme: "previousProgramme", programme: "previousProgramme",
};

function normalisedRow(raw) {
  const out = {};
  for (const [k, v] of Object.entries(raw)) {
    const mapped = COL_MAP[k] || COL_MAP[k.replace(/\s+/g, "_")] || k;
    out[mapped] = v;
  }
  return out;
}

// ─── Validation ─────────────────────────────────────────────────────────────
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function validateRow(row) {
  const errors = [];
  if (!row.firstName) errors.push("Missing first name");
  if (!row.email) errors.push("Missing email");
  else if (!EMAIL_RE.test(row.email.trim())) errors.push("Invalid email");
  return errors;
}

// ─── Styles ─────────────────────────────────────────────────────────────────
const S = {
  page: { minHeight: "100vh", backgroundColor: "#f7f5f2", paddingBottom: 48 },
  header: {
    background: "linear-gradient(160deg, #1a3a2a 0%, #2d6a4f 100%)",
    padding: "32px 24px 48px",
  },
  headerInner: { maxWidth: 860, margin: "0 auto" },
  back: { fontSize: 13, color: "rgba(255,255,255,0.6)", textDecoration: "none", display: "inline-flex", alignItems: "center", gap: 6, marginBottom: 12 },
  h1: { fontSize: 26, fontWeight: 700, color: "#fff", margin: "0 0 4px" },
  subtitle: { fontSize: 14, color: "#9fe1cb", margin: 0 },
  body: { maxWidth: 860, margin: "-24px auto 0", padding: "0 24px" },
  card: { backgroundColor: "#fff", borderRadius: 16, padding: "24px", boxShadow: "0 2px 16px rgba(0,0,0,0.07)", marginBottom: 16 },
  sectionLabel: { fontSize: 11, fontWeight: 700, color: "#888", letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: 12 },
  h2: { fontSize: 17, fontWeight: 700, color: "#111", margin: "0 0 4px" },
  p: { fontSize: 14, color: "#666", margin: "0 0 16px", lineHeight: 1.6 },
  dropzone: (active) => ({
    border: `2px dashed ${active ? "#2d6a4f" : "#ddd"}`,
    borderRadius: 12,
    padding: "40px 24px",
    textAlign: "center",
    backgroundColor: active ? "#eaf5ef" : "#fafafa",
    cursor: "pointer",
    transition: "all 0.2s",
  }),
  btn: (variant = "primary", disabled = false) => ({
    backgroundColor: disabled ? "#ccc" : variant === "primary" ? "#2d6a4f" : variant === "danger" ? "#dc2626" : "#f0f0f0",
    color: disabled ? "#888" : variant === "ghost" ? "#444" : "#fff",
    border: "none",
    borderRadius: 10,
    padding: "12px 20px",
    fontSize: 14,
    fontWeight: 700,
    cursor: disabled ? "not-allowed" : "pointer",
  }),
  tag: (color, bg) => ({
    display: "inline-block",
    fontSize: 11,
    fontWeight: 700,
    color,
    backgroundColor: bg,
    borderRadius: 6,
    padding: "2px 8px",
  }),
  table: { width: "100%", borderCollapse: "collapse", fontSize: 13 },
  th: { textAlign: "left", padding: "8px 10px", fontSize: 11, fontWeight: 700, color: "#888", borderBottom: "1px solid #eee", whiteSpace: "nowrap" },
  td: { padding: "10px 10px", borderBottom: "1px solid #f5f5f5", verticalAlign: "top" },
  stat: { textAlign: "center", padding: "16px 0" },
  statNum: { fontSize: 28, fontWeight: 700, margin: "0 0 4px" },
  statLabel: { fontSize: 12, color: "#888", margin: 0 },
};

const STATUS_CONFIG = {
  valid:    { label: "Ready",    color: "#166534", bg: "#dcfce7" },
  duplicate:{ label: "Duplicate",color: "#92400e", bg: "#fef3c7" },
  invalid:  { label: "Invalid",  color: "#9a3412", bg: "#fee2e2" },
  created:  { label: "Created",  color: "#166534", bg: "#dcfce7" },
  skipped:  { label: "Skipped",  color: "#92400e", bg: "#fef3c7" },
  failed:   { label: "Failed",   color: "#9a3412", bg: "#fee2e2" },
};

// ─── Main Component ──────────────────────────────────────────────────────────
export default function AdminImportClients() {
  const [step, setStep] = useState("upload"); // upload | preview | importing | report
  const [dragActive, setDragActive] = useState(false);
  const [parsedRows, setParsedRows] = useState([]);
  const [headers, setHeaders] = useState([]);
  const [filename, setFilename] = useState("");
  const [importResult, setImportResult] = useState(null);
  const [importError, setImportError] = useState("");
  const [importing, setImporting] = useState(false);
  const [resendingUid, setResendingUid] = useState(null);
  const fileInputRef = useRef(null);

  // ── File handling ──────────────────────────────────────────────────────────
  function handleFile(file) {
    if (!file || !file.name.endsWith(".csv")) {
      alert("Please upload a .csv file.");
      return;
    }
    setFilename(file.name);
    const reader = new FileReader();
    reader.onload = (e) => {
      const { headers: cols, rows: rawRows } = parseCSV(e.target.result);
      setHeaders(cols);
      const normalised = rawRows.map(normalisedRow);
      // Detect duplicate emails within the file
      const seen = new Set();
      const withMeta = normalised.map((row) => {
        const email = (row.email || "").trim().toLowerCase();
        const errors = validateRow({ ...row, email });
        const isDupInFile = email && seen.has(email);
        if (email) seen.add(email);
        return {
          ...row,
          email,
          _errors: errors,
          _dupInFile: isDupInFile,
          _status: errors.length > 0 ? "invalid" : isDupInFile ? "duplicate" : "valid",
        };
      });
      setParsedRows(withMeta);
      setStep("preview");
    };
    reader.readAsText(file);
  }

  const onDrop = useCallback((e) => {
    e.preventDefault();
    setDragActive(false);
    handleFile(e.dataTransfer.files[0]);
  }, []);

  const onDragOver = (e) => { e.preventDefault(); setDragActive(true); };
  const onDragLeave = () => setDragActive(false);

  // ── Counts ─────────────────────────────────────────────────────────────────
  const validCount = parsedRows.filter(r => r._status === "valid").length;
  const dupCount = parsedRows.filter(r => r._status === "duplicate").length;
  const invalidCount = parsedRows.filter(r => r._status === "invalid").length;

  // ── Import ─────────────────────────────────────────────────────────────────
  async function runImport() {
    setImporting(true);
    setImportError("");
    setStep("importing");

    const toImport = parsedRows
      .filter(r => r._status === "valid")
      .map(({ _errors, _dupInFile, _status, ...clean }) => clean);

    try {
      const fn = httpsCallable(functions, "importPastClients");
      const { data } = await fn({ rows: toImport, filename });
      setImportResult(data);
      setStep("report");
    } catch (err) {
      setImportError(err.message || "Import failed. Please try again.");
      setStep("preview");
    } finally {
      setImporting(false);
    }
  }

  // ── Resend token ───────────────────────────────────────────────────────────
  async function resendToken(uid, email) {
    setResendingUid(uid);
    try {
      const fn = httpsCallable(functions, "resendActivationToken");
      const { data } = await fn({ uid });
      alert(`New activation link for ${email}:\n\n${data.activationUrl}\n\nCopy this and send it to the client.`);
    } catch (err) {
      alert(`Failed to resend token: ${err.message}`);
    } finally {
      setResendingUid(null);
    }
  }

  // ── Export report CSV ──────────────────────────────────────────────────────
  function exportReport() {
    if (!importResult) return;
    const headers = ["First Name", "Last Name", "Email", "Status", "Reason", "Activation URL", "Imported At"];
    const csvRows = [headers.join(",")];
    for (const row of importResult.report) {
      csvRows.push([
        `"${row.firstName || ""}"`,
        `"${row.lastName || ""}"`,
        `"${row.email || ""}"`,
        row.status || "",
        `"${row.reason || ""}"`,
        `"${row.activationUrl || ""}"`,
        `"${row.importedAt || ""}"`,
      ].join(","));
    }
    const blob = new Blob([csvRows.join("\n")], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `import-report-${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div style={S.page}>

      {/* Header */}
      <div style={S.header}>
        <div style={S.headerInner}>
          <Link to="/admin/clients" style={S.back}>
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M10 12L6 8l4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            All Clients
          </Link>
          <h1 style={S.h1}>Import Past Clients</h1>
          <p style={S.subtitle}>Create free accounts for previous clients so you can re-engage them.</p>
        </div>
      </div>

      <div style={S.body}>

        {/* ── STEP: Upload ───────────────────────────────────────────────── */}
        {step === "upload" && (
          <div style={S.card}>
            <p style={S.sectionLabel}>Step 1 of 3</p>
            <h2 style={S.h2}>Upload your CSV</h2>
            <p style={S.p}>
              Your CSV must include at minimum <strong>First Name</strong> and <strong>Email Address</strong> columns.
              Additional columns (Last Name, Phone, Notes, Previous Coach, etc.) are mapped automatically.
            </p>

            <div
              style={S.dropzone(dragActive)}
              onDrop={onDrop}
              onDragOver={onDragOver}
              onDragLeave={onDragLeave}
              onClick={() => fileInputRef.current?.click()}
            >
              <svg width="40" height="40" viewBox="0 0 40 40" fill="none" style={{ margin: "0 auto 12px", display: "block" }}>
                <circle cx="20" cy="20" r="20" fill="#eaf5ef"/>
                <path d="M20 27V13m-5 5 5-5 5 5" stroke="#2d6a4f" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              <p style={{ fontSize: 15, fontWeight: 700, color: "#111", margin: "0 0 4px" }}>
                {dragActive ? "Drop it" : "Drop CSV here or click to browse"}
              </p>
              <p style={{ fontSize: 12, color: "#999", margin: 0 }}>Supports .csv files only</p>
              <input ref={fileInputRef} type="file" accept=".csv" style={{ display: "none" }} onChange={e => handleFile(e.target.files[0])} />
            </div>

            <div style={{ marginTop: 20, padding: "16px", backgroundColor: "#f7f5f2", borderRadius: 10 }}>
              <p style={{ fontSize: 13, fontWeight: 700, color: "#333", margin: "0 0 8px" }}>Supported column names</p>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                {["First Name", "Last Name", "Email", "Phone", "Previous Coach", "Notes", "Membership Type", "Previous Programme"].map(col => (
                  <span key={col} style={{ fontSize: 11, color: "#555", backgroundColor: "#fff", border: "1px solid #e5e5e5", borderRadius: 6, padding: "3px 8px" }}>{col}</span>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ── STEP: Preview ──────────────────────────────────────────────── */}
        {step === "preview" && (
          <>
            {/* Summary bar */}
            <div style={{ ...S.card, display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 0 }}>
              {[
                { num: parsedRows.length, label: "Total rows", color: "#111" },
                { num: validCount, label: "Will be created", color: "#166534" },
                { num: dupCount, label: "Duplicate email", color: "#92400e" },
                { num: invalidCount, label: "Invalid / skipped", color: "#9a3412" },
              ].map(({ num, label, color }, i) => (
                <div key={i} style={{ ...S.stat, borderRight: i < 3 ? "1px solid #f0f0f0" : "none" }}>
                  <p style={{ ...S.statNum, color }}>{num}</p>
                  <p style={S.statLabel}>{label}</p>
                </div>
              ))}
            </div>

            {importError && (
              <div style={{ backgroundColor: "#fef2f2", border: "1px solid #fecaca", borderRadius: 10, padding: "12px 16px", marginBottom: 12 }}>
                <p style={{ fontSize: 13, color: "#dc2626", margin: 0 }}>{importError}</p>
              </div>
            )}

            {/* Data table */}
            <div style={S.card}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
                <div>
                  <p style={S.sectionLabel}>Step 2 of 3</p>
                  <h2 style={{ ...S.h2, margin: 0 }}>Preview: {filename}</h2>
                </div>
                <button style={S.btn("ghost")} onClick={() => { setParsedRows([]); setStep("upload"); }}>
                  Change file
                </button>
              </div>

              <div style={{ overflowX: "auto" }}>
                <table style={S.table}>
                  <thead>
                    <tr>
                      <th style={S.th}>Status</th>
                      <th style={S.th}>First Name</th>
                      <th style={S.th}>Last Name</th>
                      <th style={S.th}>Email</th>
                      {parsedRows.some(r => r.phone) && <th style={S.th}>Phone</th>}
                      {parsedRows.some(r => r.notes) && <th style={S.th}>Notes</th>}
                      <th style={S.th}>Issues</th>
                    </tr>
                  </thead>
                  <tbody>
                    {parsedRows.map((row, i) => {
                      const cfg = STATUS_CONFIG[row._status] || STATUS_CONFIG.valid;
                      return (
                        <tr key={i} style={{ backgroundColor: row._status === "invalid" || row._status === "duplicate" ? "#fffbfb" : "#fff" }}>
                          <td style={S.td}>
                            <span style={S.tag(cfg.color, cfg.bg)}>{cfg.label}</span>
                          </td>
                          <td style={S.td}>{row.firstName || <span style={{ color: "#f87171" }}>Missing</span>}</td>
                          <td style={S.td}>{row.lastName || <span style={{ color: "#aaa" }}>-</span>}</td>
                          <td style={S.td}>{row.email || <span style={{ color: "#f87171" }}>Missing</span>}</td>
                          {parsedRows.some(r => r.phone) && <td style={S.td}>{row.phone || "-"}</td>}
                          {parsedRows.some(r => r.notes) && <td style={S.td}>{row.notes || "-"}</td>}
                          <td style={S.td}>
                            {row._dupInFile && <span style={{ fontSize: 12, color: "#92400e" }}>Duplicate in file</span>}
                            {row._errors.map((e, ei) => (
                              <span key={ei} style={{ fontSize: 12, color: "#dc2626", display: "block" }}>{e}</span>
                            ))}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Confirm */}
            <div style={S.card}>
              <p style={S.sectionLabel}>Step 3 of 3</p>
              <h2 style={S.h2}>Confirm import</h2>
              {validCount === 0 ? (
                <p style={{ ...S.p, color: "#dc2626" }}>No valid rows to import. Fix the errors above and re-upload.</p>
              ) : (
                <p style={S.p}>
                  This will create <strong>{validCount} new {validCount === 1 ? "account" : "accounts"}</strong> with a Free plan and Past Client tags.
                  {dupCount > 0 && ` ${dupCount} duplicate ${dupCount === 1 ? "row" : "rows"} will be skipped.`}
                  {invalidCount > 0 && ` ${invalidCount} invalid ${invalidCount === 1 ? "row" : "rows"} will be skipped.`}
                  {" "}No passwords are set. Each client must activate their account via a secure email link.
                </p>
              )}
              <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                <button
                  style={S.btn("primary", validCount === 0 || importing)}
                  disabled={validCount === 0 || importing}
                  onClick={runImport}
                >
                  Import {validCount} {validCount === 1 ? "client" : "clients"}
                </button>
                <button style={S.btn("ghost")} onClick={() => { setParsedRows([]); setStep("upload"); }}>
                  Cancel
                </button>
              </div>
            </div>
          </>
        )}

        {/* ── STEP: Importing ────────────────────────────────────────────── */}
        {step === "importing" && (
          <div style={{ ...S.card, textAlign: "center", padding: "60px 24px" }}>
            <div style={{ width: 48, height: 48, border: "4px solid #eaf5ef", borderTop: "4px solid #2d6a4f", borderRadius: "50%", margin: "0 auto 20px", animation: "spin 0.8s linear infinite" }} />
            <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
            <p style={{ fontSize: 16, fontWeight: 700, color: "#111", margin: "0 0 6px" }}>Importing clients...</p>
            <p style={{ fontSize: 13, color: "#888", margin: 0 }}>This may take a moment for large files.</p>
          </div>
        )}

        {/* ── STEP: Report ───────────────────────────────────────────────── */}
        {step === "report" && importResult && (
          <>
            {/* Summary */}
            <div style={{ ...S.card, display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 0 }}>
              {[
                { num: importResult.totalProcessed, label: "Total processed", color: "#111" },
                { num: importResult.created, label: "Accounts created", color: "#166534" },
                { num: importResult.skipped, label: "Already existed", color: "#92400e" },
                { num: importResult.invalid, label: "Invalid rows", color: "#6b7280" },
                { num: importResult.failed, label: "Failed", color: "#9a3412" },
              ].map(({ num, label, color }, i) => (
                <div key={i} style={{ ...S.stat, borderRight: i < 4 ? "1px solid #f0f0f0" : "none" }}>
                  <p style={{ ...S.statNum, color }}>{num}</p>
                  <p style={S.statLabel}>{label}</p>
                </div>
              ))}
            </div>

            {/* Actions */}
            <div style={{ display: "flex", gap: 10, marginBottom: 12, flexWrap: "wrap" }}>
              <button style={S.btn("ghost")} onClick={exportReport}>Export report as CSV</button>
              <button style={S.btn("ghost")} onClick={() => { setParsedRows([]); setStep("upload"); setImportResult(null); }}>
                Import another file
              </button>
            </div>

            {/* Detailed results */}
            <div style={S.card}>
              <h2 style={{ ...S.h2, marginBottom: 16 }}>Import report</h2>
              <div style={{ overflowX: "auto" }}>
                <table style={S.table}>
                  <thead>
                    <tr>
                      <th style={S.th}>Status</th>
                      <th style={S.th}>Name</th>
                      <th style={S.th}>Email</th>
                      <th style={S.th}>Activation link</th>
                      <th style={S.th}>Notes</th>
                    </tr>
                  </thead>
                  <tbody>
                    {importResult.report.map((row, i) => {
                      const cfg = STATUS_CONFIG[row.status] || STATUS_CONFIG.valid;
                      return (
                        <tr key={i}>
                          <td style={S.td}>
                            <span style={S.tag(cfg.color, cfg.bg)}>{cfg.label || row.status}</span>
                          </td>
                          <td style={S.td}>{[row.firstName, row.lastName].filter(Boolean).join(" ") || "-"}</td>
                          <td style={S.td}>{row.email}</td>
                          <td style={S.td}>
                            {row.activationUrl ? (
                              <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                                <a
                                  href={row.activationUrl}
                                  target="_blank"
                                  rel="noreferrer"
                                  style={{ fontSize: 11, color: "#2d6a4f", wordBreak: "break-all" }}
                                >
                                  {row.activationUrl}
                                </a>
                                {row.uid && (
                                  <button
                                    style={{ ...S.btn("ghost"), fontSize: 11, padding: "4px 8px", opacity: resendingUid === row.uid ? 0.5 : 1 }}
                                    disabled={resendingUid === row.uid}
                                    onClick={() => resendToken(row.uid, row.email)}
                                  >
                                    {resendingUid === row.uid ? "Regenerating..." : "Regenerate link"}
                                  </button>
                                )}
                              </div>
                            ) : "-"}
                          </td>
                          <td style={S.td}>
                            <span style={{ fontSize: 12, color: "#888" }}>{row.reason || ""}</span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            <div style={{ ...S.card, backgroundColor: "#eaf5ef", border: "1px solid #b7e5cc" }}>
              <p style={{ fontSize: 13, fontWeight: 700, color: "#166534", margin: "0 0 6px" }}>Next step</p>
              <p style={{ fontSize: 13, color: "#1a3a2a", margin: 0 }}>
                Export the CSV above and use the activation URLs to send a personalised email to each past client.
                All imported clients are tagged <strong>Past Client</strong>, <strong>Imported</strong>, and <strong>Free Plan</strong>
                making them easy to filter for an email campaign.
              </p>
            </div>
          </>
        )}

      </div>
    </div>
  );
}
