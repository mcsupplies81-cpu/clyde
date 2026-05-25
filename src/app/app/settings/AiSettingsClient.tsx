"use client";

import { useEffect, useState } from "react";

const STORAGE_KEY = "clyde:classification-preview";

export function AiSettingsClient() {
  const [previewOn, setPreviewOn] = useState(true);

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === "false") setPreviewOn(false);
  }, []);

  function onToggle() {
    const next = !previewOn;
    setPreviewOn(next);
    localStorage.setItem(STORAGE_KEY, String(next));
  }

  return (
    <>
      <div style={rowStyle}>
        <div>
          <div style={labelStyle}>Auto-classify on arrival</div>
          <div style={subtleStyle}>Local preview only — does not affect server behavior</div>
        </div>
        <button
          onClick={onToggle}
          style={{
            border: "none",
            borderRadius: 999,
            padding: "4px 12px",
            fontSize: 11,
            fontWeight: 600,
            cursor: "pointer",
            background: previewOn ? "#F0FDF4" : "#F9FAFB",
            color: previewOn ? "#16A34A" : "#9CA3AF",
          }}
        >
          {previewOn ? "On" : "Off"}
        </button>
      </div>
    </>
  );
}

const rowStyle = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  padding: "10px 0",
  borderTop: "1px solid #F2F2F2",
} as const;

const labelStyle  = { fontSize: 13, color: "#292929", fontWeight: 500 } as const;
const subtleStyle = { marginTop: 3, fontSize: 11, color: "#9CA3AF" } as const;
