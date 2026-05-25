"use client";

import { useState, useTransition } from "react";
import { syncGmailAction } from "./actions";

export function SyncButton() {
  const [isPending, startTransition] = useTransition();
  const [notice, setNotice] = useState<string | null>(null);

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 6 }}>
      <button
        type="button"
        onClick={() => startTransition(async () => {
          const result = await syncGmailAction();
          const base = `Synced: ${result.newThreads} new threads, ${result.newMessages} new messages`;
          setNotice(result.errors.length ? `${base}. Errors: ${result.errors.join(" | ")}` : `${base}.`);
        })}
        disabled={isPending}
        style={{ padding: "6px 10px", borderRadius: 6, border: "1px solid #253347", background: "#1a2535", color: "#d6e0eb", fontSize: 12, cursor: isPending ? "wait" : "pointer" }}
      >
        {isPending ? "Syncing..." : "Sync Gmail"}
      </button>
      {notice ? <div style={{ fontSize: 11, color: "#7f92a8", maxWidth: 340, textAlign: "right" }}>{notice}</div> : null}
    </div>
  );
}
