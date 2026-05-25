"use client";

import { useEffect, useState, type CSSProperties } from "react";

const STORAGE_KEY = "clyde:classification-enabled";

export function AiSettingsClient() {
  const [classificationEnabled, setClassificationEnabled] = useState(true);

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === "false") {
      setClassificationEnabled(false);
    }
  }, []);

  function onToggle() {
    const next = !classificationEnabled;
    setClassificationEnabled(next);
    localStorage.setItem(STORAGE_KEY, String(next));
  }

  return (
    <div style={sectionStyle}>
      <h2 style={sectionTitleStyle}>AI Settings</h2>
      <div style={rowStyle}>
        <div>
          <div style={labelStyle}>Approval required for all drafts</div>
          <div style={subtleStyle}>Always enabled in v1</div>
        </div>
        <div style={{ ...pillStyle, background: "#1f2d3d", color: "#8ea6bf" }}>Locked · true</div>
      </div>

      <div style={rowStyle}>
        <div>
          <div style={labelStyle}>Classification enabled</div>
          <div style={subtleStyle}>Local UI state only</div>
        </div>
        <button onClick={onToggle} style={{ ...toggleStyle, background: classificationEnabled ? "#16a34a" : "#374151" }}>
          {classificationEnabled ? "On" : "Off"}
        </button>
      </div>
    </div>
  );
}

const sectionStyle: CSSProperties = {
  background: "#111827",
  border: "1px solid #1f2937",
  borderRadius: 10,
  padding: 20,
};

const sectionTitleStyle: CSSProperties = {
  margin: "0 0 16px",
  fontSize: 14,
  color: "#d1d5db",
  fontWeight: 600,
};

const rowStyle: CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  padding: "10px 0",
  borderTop: "1px solid #1f2937",
};

const labelStyle: CSSProperties = { fontSize: 13, color: "#e5e7eb", fontWeight: 500 };
const subtleStyle: CSSProperties = { marginTop: 3, fontSize: 12, color: "#6b7280" };
const pillStyle: CSSProperties = { padding: "6px 10px", borderRadius: 999, fontSize: 12, fontWeight: 600 };
const toggleStyle: CSSProperties = {
  border: "none",
  color: "#f9fafb",
  borderRadius: 999,
  padding: "6px 12px",
  fontSize: 12,
  fontWeight: 600,
  cursor: "pointer",
};
