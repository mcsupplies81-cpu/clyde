"use client";

import { useState } from "react";
import { useFormStatus } from "react-dom";
import type { CSSProperties } from "react";

function SubmitButton({ label, pendingLabel, style }: { label: string; pendingLabel: string; style: CSSProperties }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} style={{ ...style, opacity: pending ? 0.7 : 1, cursor: pending ? "wait" : "pointer" }}>
      {pending ? pendingLabel : label}
    </button>
  );
}

export function ClassifyForm({
  action,
  message,
}: {
  action: (formData: FormData) => void | Promise<void>;
  message: { id: string; subject: string | null; body: string; senderName: string | null; senderEmail: string };
}) {
  return (
    <form action={action} style={{ marginTop: 10 }}>
      <input type="hidden" name="messageId" value={message.id} />
      <input type="hidden" name="subject" value={message.subject ?? ""} />
      <input type="hidden" name="body" value={message.body} />
      <input type="hidden" name="senderName" value={message.senderName ?? ""} />
      <input type="hidden" name="senderEmail" value={message.senderEmail} />
      <SubmitButton
        label="Classify"
        pendingLabel="Classifying..."
        style={{ padding: "6px 14px", background: "#1a2535", color: "#d6e0eb", border: "1px solid #253347", borderRadius: 5, fontSize: 12 }}
      />
    </form>
  );
}

export function GenerateDraftForm({ action, messageId, classificationId, loadId }: { action: (formData: FormData) => void | Promise<void>; messageId: string; classificationId?: string; loadId?: string }) {
  return (
    <form action={action} style={{ marginTop: 12 }}>
      <input type="hidden" name="messageId" value={messageId} />
      {classificationId ? <input type="hidden" name="classificationId" value={classificationId} /> : null}
      {loadId ? <input type="hidden" name="loadId" value={loadId} /> : null}
      <SubmitButton label="Generate Draft" pendingLabel="Generating..." style={{ padding: "8px 12px", background: "#1a2535", border: "1px solid #253347", borderRadius: 6, color: "#60a5fa", fontSize: 12 }} />
    </form>
  );
}

export function DraftActions({ approveAction, rejectAction, editAction }: { approveAction: (formData: FormData) => void | Promise<void>; rejectAction: (formData: FormData) => void | Promise<void>; editAction: (formData: FormData) => void | Promise<void> }) {
  const [isEditing, setIsEditing] = useState(false);
  return (
    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
      <form action={approveAction}>
        <SubmitButton label="Approve & Send Manually" pendingLabel="Approving..." style={{ padding: "6px 14px", background: "#22c55e", color: "#000", border: "none", borderRadius: 5, fontSize: 12, fontWeight: 600 }} />
      </form>
      {!isEditing ? (
        <button type="button" onClick={() => setIsEditing(true)} style={{ padding: "6px 14px", background: "#1e2d3d", color: "#d6e0eb", border: "1px solid #253347", borderRadius: 5, fontSize: 12, cursor: "pointer" }}>
          Edit
        </button>
      ) : null}
      <form action={rejectAction}>
        <SubmitButton label="Reject" pendingLabel="Rejecting..." style={{ padding: "6px 14px", background: "transparent", color: "#f87171", border: "1px solid #450a0a", borderRadius: 5, fontSize: 12 }} />
      </form>
      {isEditing ? (
        <form action={editAction} style={{ width: "100%", marginTop: 10 }}>
          <textarea name="draftBody" required style={{ width: "100%", minHeight: 120, background: "#141c24", color: "#d6e0eb", border: "1px solid #253347", borderRadius: 6, padding: 8, marginBottom: 8 }} />
          <div style={{ display: "flex", gap: 8 }}>
            <SubmitButton label="Save Edit" pendingLabel="Saving..." style={{ padding: "6px 14px", background: "#1e2d3d", color: "#d6e0eb", border: "1px solid #253347", borderRadius: 5, fontSize: 12 }} />
            <button type="button" onClick={() => setIsEditing(false)} style={{ padding: "6px 14px", background: "transparent", color: "#7f92a8", border: "1px solid #253347", borderRadius: 5, fontSize: 12, cursor: "pointer" }}>Cancel</button>
          </div>
        </form>
      ) : null}
    </div>
  );
}
