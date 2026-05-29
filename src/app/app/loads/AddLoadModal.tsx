"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";

type Props = { action: (formData: FormData) => Promise<{ error?: string; id?: string }> };

const STATUS_OPTIONS = [
  "Booked", "Dispatched", "At Pickup", "In Transit",
  "Out for Delivery", "Delivered", "Exception",
];

export function AddLoadModal({ action }: Props) {
  const [open, setOpen]   = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);
  const router  = useRouter();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!formRef.current) return;
    setSaving(true);
    setError(null);
    const fd = new FormData(formRef.current);
    const result = await action(fd);
    setSaving(false);
    if (result.error) { setError(result.error); return; }
    setOpen(false);
    formRef.current.reset();
    router.refresh();
  }

  if (!open) {
    return (
      <button onClick={() => setOpen(true)} style={triggerStyle}>
        + Add Load
      </button>
    );
  }

  return (
    <div style={overlayStyle} onClick={(e) => { if (e.target === e.currentTarget) setOpen(false); }}>
      <div style={modalStyle}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
          <h2 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: "#292929" }}>Add Load</h2>
          <button onClick={() => setOpen(false)} style={closeBtnStyle}>✕</button>
        </div>

        <form ref={formRef} onSubmit={handleSubmit}>
          <div style={gridStyle}>

            {/* Load Number */}
            <div style={fieldStyle}>
              <label style={labelStyle}>Load # <span style={{ color: "#DC2626" }}>*</span></label>
              <input name="loadNumber" required placeholder="HFB-1234" style={inputStyle} />
            </div>

            {/* Status */}
            <div style={fieldStyle}>
              <label style={labelStyle}>Status</label>
              <select name="currentStatus" style={inputStyle} defaultValue="Booked">
                {STATUS_OPTIONS.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>

            {/* Customer */}
            <div style={fieldStyle}>
              <label style={labelStyle}>Customer</label>
              <input name="customerName" placeholder="Acme Foods Inc." style={inputStyle} />
            </div>

            {/* Carrier */}
            <div style={fieldStyle}>
              <label style={labelStyle}>Carrier</label>
              <input name="carrierName" placeholder="Blue Ridge Transport" style={inputStyle} />
            </div>

            {/* Carrier Email */}
            <div style={{ ...fieldStyle, gridColumn: "1 / -1" }}>
              <label style={labelStyle}>Carrier email</label>
              <input name="carrierEmail" type="email" placeholder="dispatch@carrier.com" style={inputStyle} />
            </div>

            {/* Origin */}
            <div style={fieldStyle}>
              <label style={labelStyle}>Origin city</label>
              <input name="originCity" placeholder="Chicago" style={inputStyle} />
            </div>
            <div style={fieldStyle}>
              <label style={labelStyle}>Origin state</label>
              <input name="originState" placeholder="IL" maxLength={2} style={inputStyle} />
            </div>

            {/* Destination */}
            <div style={fieldStyle}>
              <label style={labelStyle}>Destination city</label>
              <input name="destinationCity" placeholder="Dallas" style={inputStyle} />
            </div>
            <div style={fieldStyle}>
              <label style={labelStyle}>Destination state</label>
              <input name="destinationState" placeholder="TX" maxLength={2} style={inputStyle} />
            </div>

            {/* Pickup date */}
            <div style={fieldStyle}>
              <label style={labelStyle}>Pickup date</label>
              <input name="pickupAt" type="date" style={inputStyle} />
            </div>

            {/* Delivery date */}
            <div style={fieldStyle}>
              <label style={labelStyle}>Delivery date</label>
              <input name="deliveryAt" type="date" style={inputStyle} />
            </div>

            {/* Rate */}
            <div style={fieldStyle}>
              <label style={labelStyle}>Rate ($)</label>
              <input name="rate" type="number" step="0.01" min="0" placeholder="2500.00" style={inputStyle} />
            </div>

            {/* Equipment */}
            <div style={fieldStyle}>
              <label style={labelStyle}>Equipment</label>
              <input name="equipmentType" placeholder="Dry Van" style={inputStyle} />
            </div>

            {/* Driver name */}
            <div style={fieldStyle}>
              <label style={labelStyle}>Driver name</label>
              <input name="driverName" placeholder="John Smith" style={inputStyle} />
            </div>

            {/* Driver phone */}
            <div style={fieldStyle}>
              <label style={labelStyle}>Driver phone</label>
              <input name="driverPhone" type="tel" placeholder="555-123-4567" style={inputStyle} />
            </div>

            {/* PO Number */}
            <div style={fieldStyle}>
              <label style={labelStyle}>PO #</label>
              <input name="poNumber" placeholder="PO-9876" style={inputStyle} />
            </div>

            {/* Risk level */}
            <div style={fieldStyle}>
              <label style={labelStyle}>Risk level</label>
              <select name="riskLevel" style={inputStyle} defaultValue="low">
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
                <option value="critical">Critical</option>
              </select>
            </div>

          </div>

          {error && (
            <div style={{ marginTop: 12, padding: "8px 12px", background: "#FEF2F2", border: "1px solid #FECACA", borderRadius: 6, fontSize: 12, color: "#DC2626" }}>
              {error}
            </div>
          )}

          <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 20 }}>
            <button type="button" onClick={() => setOpen(false)} style={cancelStyle}>Cancel</button>
            <button type="submit" disabled={saving} style={{ ...saveStyle, opacity: saving ? 0.7 : 1 }}>
              {saving ? "Saving…" : "Add Load"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Styles ──────────────────────────────────────────────────────────────────
const triggerStyle: React.CSSProperties = {
  background: "#2563EB", color: "#FFFFFF", border: "none",
  borderRadius: 7, padding: "8px 14px", fontSize: 12,
  fontWeight: 600, cursor: "pointer",
};
const overlayStyle: React.CSSProperties = {
  position: "fixed", inset: 0, background: "rgba(0,0,0,0.35)",
  display: "flex", alignItems: "center", justifyContent: "center",
  zIndex: 1000,
};
const modalStyle: React.CSSProperties = {
  background: "#FFFFFF", borderRadius: 12, padding: 28,
  width: "100%", maxWidth: 580, maxHeight: "90vh",
  overflowY: "auto", boxShadow: "0 20px 60px rgba(0,0,0,0.15)",
};
const closeBtnStyle: React.CSSProperties = {
  background: "none", border: "none", cursor: "pointer",
  fontSize: 16, color: "#9CA3AF", padding: 4, lineHeight: 1,
};
const gridStyle: React.CSSProperties = {
  display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12,
};
const fieldStyle: React.CSSProperties = { display: "flex", flexDirection: "column", gap: 4 };
const labelStyle: React.CSSProperties = { fontSize: 11, fontWeight: 600, color: "#5D5D5D", textTransform: "uppercase", letterSpacing: "0.4px" };
const inputStyle: React.CSSProperties = {
  background: "#FAFAF8", border: "1px solid #E8E8E8", borderRadius: 6,
  color: "#292929", padding: "7px 10px", fontSize: 13, outline: "none",
};
const cancelStyle: React.CSSProperties = {
  background: "transparent", color: "#5D5D5D", border: "1px solid #E8E8E8",
  borderRadius: 6, padding: "8px 16px", fontSize: 13, cursor: "pointer",
};
const saveStyle: React.CSSProperties = {
  background: "#2563EB", color: "#FFFFFF", border: "none",
  borderRadius: 6, padding: "8px 20px", fontSize: 13,
  fontWeight: 600, cursor: "pointer",
};
