"use client";

import { useState, useRef } from "react";

type ImportResult = {
  imported: number;
  skipped: number;
  duplicates: number;
  errors: string[];
  total: number;
};

const SAMPLE_CSV = `Load Number,Customer,Carrier,Origin City,Origin State,Destination City,Destination State,Status,Pickup Date,Delivery Date,Rate,Equipment,Driver Name,Driver Phone
HFB-1001,Walmart,Blue Ridge Transport,Chicago,IL,Memphis,TN,In Transit,2024-01-15,2024-01-17,2800,53ft Dry Van,John Smith,555-0101
HFB-1002,Home Depot,Eagle Logistics,Dallas,TX,Houston,TX,Delivered,2024-01-14,2024-01-15,1200,Flatbed,Mike Jones,555-0102`;

export function ImportLoadsModal() {
  const [open, setOpen]             = useState(false);
  const [dragging, setDragging]     = useState(false);
  const [loading, setLoading]       = useState(false);
  const [result, setResult]         = useState<ImportResult | null>(null);
  const [error, setError]           = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  function reset() {
    setResult(null);
    setError(null);
    setLoading(false);
    setDragging(false);
  }

  function close() {
    setOpen(false);
    setTimeout(reset, 200);
  }

  async function upload(file: File) {
    if (!file.name.toLowerCase().endsWith(".csv")) {
      setError("Please upload a .csv file.");
      return;
    }
    setLoading(true);
    setError(null);
    setResult(null);
    const form = new FormData();
    form.append("file", file);
    try {
      const res = await fetch("/api/v1/loads/import", { method: "POST", body: form });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Import failed");
      } else {
        setResult(data);
        // Reload the page after a short delay to show updated load list
        if (data.imported > 0) setTimeout(() => window.location.reload(), 1800);
      }
    } catch {
      setError("Network error — please try again.");
    } finally {
      setLoading(false);
    }
  }

  function handleFile(files: FileList | null) {
    if (files && files[0]) upload(files[0]);
  }

  function downloadSample() {
    const blob = new Blob([SAMPLE_CSV], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "clyde-load-import-sample.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        style={{
          padding: "6px 14px",
          background: "#F9FAFB",
          border: "1px solid #E5E7EB",
          borderRadius: 6,
          fontSize: 12,
          fontWeight: 600,
          color: "#374151",
          cursor: "pointer",
          display: "flex",
          alignItems: "center",
          gap: 5,
        }}
      >
        ↑ Import CSV
      </button>
    );
  }

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={close}
        style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", zIndex: 200 }}
      />

      {/* Modal */}
      <div style={{
        position: "fixed",
        top: "50%", left: "50%",
        transform: "translate(-50%, -50%)",
        width: 480,
        background: "#FFFFFF",
        borderRadius: 12,
        boxShadow: "0 20px 60px rgba(0,0,0,0.18)",
        zIndex: 201,
        overflow: "hidden",
      }}>
        {/* Header */}
        <div style={{ padding: "16px 20px 12px", borderBottom: "1px solid #F0F0F0", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <div style={{ fontSize: 15, fontWeight: 700, color: "#111827" }}>Import Loads from CSV</div>
            <div style={{ fontSize: 11, color: "#9CA3AF", marginTop: 2 }}>Upload a .csv file to bulk-import your load board</div>
          </div>
          <button onClick={close} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 18, color: "#9CA3AF", padding: "0 4px" }}>✕</button>
        </div>

        <div style={{ padding: 20 }}>
          {!result && (
            <>
              {/* Drop zone */}
              <div
                onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
                onDragLeave={() => setDragging(false)}
                onDrop={(e) => { e.preventDefault(); setDragging(false); handleFile(e.dataTransfer.files); }}
                onClick={() => fileRef.current?.click()}
                style={{
                  border: `2px dashed ${dragging ? "#2563EB" : "#E5E7EB"}`,
                  borderRadius: 8,
                  padding: "28px 20px",
                  textAlign: "center",
                  cursor: "pointer",
                  background: dragging ? "#EFF6FF" : "#FAFAF8",
                  transition: "all 0.15s",
                  marginBottom: 14,
                }}
              >
                {loading ? (
                  <div>
                    <div style={{ fontSize: 22, marginBottom: 8 }}>⏳</div>
                    <div style={{ fontSize: 13, color: "#6B7280" }}>Importing loads…</div>
                  </div>
                ) : (
                  <div>
                    <div style={{ fontSize: 26, marginBottom: 8 }}>📂</div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: "#374151", marginBottom: 4 }}>
                      Drop your CSV here or click to browse
                    </div>
                    <div style={{ fontSize: 11, color: "#9CA3AF" }}>.csv files only</div>
                  </div>
                )}
                <input
                  ref={fileRef}
                  type="file"
                  accept=".csv"
                  style={{ display: "none" }}
                  onChange={(e) => handleFile(e.target.files)}
                />
              </div>

              {/* Column guide */}
              <div style={{ background: "#F9FAFB", borderRadius: 8, padding: "10px 12px", marginBottom: 14, fontSize: 11, color: "#6B7280" }}>
                <div style={{ fontWeight: 700, color: "#374151", marginBottom: 5 }}>Supported columns (flexible naming)</div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "2px 16px" }}>
                  {[
                    ["Load Number", "required"],
                    ["Customer", "optional"],
                    ["Carrier", "optional"],
                    ["Origin City / State", "optional"],
                    ["Destination City / State", "optional"],
                    ["Status", "optional"],
                    ["Pickup Date / Delivery Date", "optional"],
                    ["Rate", "optional"],
                    ["Equipment", "optional"],
                    ["Driver Name / Phone", "optional"],
                    ["PO Number", "optional"],
                    ["Notes", "optional"],
                  ].map(([col, req]) => (
                    <div key={col} style={{ display: "flex", gap: 4, alignItems: "center" }}>
                      <span style={{ color: req === "required" ? "#DC2626" : "#9CA3AF" }}>
                        {req === "required" ? "✦" : "·"}
                      </span>
                      <span>{col}</span>
                    </div>
                  ))}
                </div>
              </div>

              {error && (
                <div style={{ background: "#FEF2F2", border: "1px solid #FECACA", borderRadius: 6, padding: "8px 12px", fontSize: 12, color: "#DC2626", marginBottom: 12 }}>
                  {error}
                </div>
              )}

              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <button
                  onClick={downloadSample}
                  style={{ fontSize: 11, color: "#2563EB", background: "none", border: "none", cursor: "pointer", textDecoration: "underline", padding: 0 }}
                >
                  ↓ Download sample CSV
                </button>
                <button onClick={close} style={{ fontSize: 12, color: "#9CA3AF", background: "none", border: "1px solid #E5E7EB", borderRadius: 5, padding: "5px 14px", cursor: "pointer" }}>
                  Cancel
                </button>
              </div>
            </>
          )}

          {result && (
            <div>
              {/* Success summary */}
              <div style={{ textAlign: "center", padding: "12px 0 20px" }}>
                <div style={{ fontSize: 32, marginBottom: 8 }}>
                  {result.imported > 0 ? "✅" : "⚠️"}
                </div>
                <div style={{ fontSize: 16, fontWeight: 700, color: "#111827", marginBottom: 4 }}>
                  {result.imported > 0
                    ? `${result.imported} load${result.imported > 1 ? "s" : ""} imported!`
                    : "No new loads imported"}
                </div>
                {result.imported > 0 && (
                  <div style={{ fontSize: 12, color: "#9CA3AF" }}>Refreshing the load board…</div>
                )}
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, marginBottom: 16 }}>
                {[
                  { label: "Imported", value: result.imported, color: "#16A34A", bg: "#F0FDF4" },
                  { label: "Duplicates skipped", value: result.duplicates, color: "#D97706", bg: "#FFFBEB" },
                  { label: "Blank rows skipped", value: result.skipped, color: "#6B7280", bg: "#F9FAFB" },
                ].map(({ label, value, color, bg }) => (
                  <div key={label} style={{ background: bg, borderRadius: 8, padding: "10px 8px", textAlign: "center" }}>
                    <div style={{ fontSize: 20, fontWeight: 700, color }}>{value}</div>
                    <div style={{ fontSize: 10, color: "#9CA3AF", marginTop: 3 }}>{label}</div>
                  </div>
                ))}
              </div>

              {result.errors.length > 0 && (
                <div style={{ background: "#FEF2F2", borderRadius: 6, padding: 10, marginBottom: 12 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: "#DC2626", marginBottom: 5 }}>
                    {result.errors.length} row error{result.errors.length > 1 ? "s" : ""}:
                  </div>
                  {result.errors.slice(0, 5).map((e, i) => (
                    <div key={i} style={{ fontSize: 11, color: "#7F1D1D", marginBottom: 2 }}>• {e}</div>
                  ))}
                  {result.errors.length > 5 && (
                    <div style={{ fontSize: 11, color: "#9CA3AF" }}>…and {result.errors.length - 5} more</div>
                  )}
                </div>
              )}

              <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
                <button
                  onClick={reset}
                  style={{ fontSize: 12, color: "#2563EB", background: "#EFF6FF", border: "1px solid #BFDBFE", borderRadius: 5, padding: "6px 14px", cursor: "pointer", fontWeight: 600 }}
                >
                  Import another file
                </button>
                <button onClick={close} style={{ fontSize: 12, color: "#374151", background: "#F9FAFB", border: "1px solid #E5E7EB", borderRadius: 5, padding: "6px 14px", cursor: "pointer" }}>
                  Done
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
