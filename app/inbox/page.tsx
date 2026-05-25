"use client";

import { useState } from "react";

type Classification = {
  category: string;
  urgency: string;
  confidence: number;
  extractedLoadNumber: string | null;
  extractedPoNumber: string | null;
  extractedCustomer: string | null;
  extractedCarrier: string | null;
  extractedLane: string | null;
  suggestedAction: string;
  reasoning: string;
};

const selectedMessage = {
  messageId: "msg_123",
  subject: "Status update request for load #LD-4421",
  body: "Hi team, can you send ETA for load #LD-4421? PO #PO-9912. Customer: ACME. Carrier: Fast Trucking",
  senderName: "Jane Dispatcher",
  senderEmail: "jane@example.com",
};

export default function InboxPage() {
  const [classification, setClassification] = useState<Classification | null>(null);
  const [loading, setLoading] = useState(false);

  const classify = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/ai/classify-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(selectedMessage),
      });
      if (!res.ok) throw new Error("Classification failed");
      setClassification((await res.json()) as Classification);
    } finally {
      setLoading(false);
    }
  };

  return (
    <main style={{ padding: 24 }}>
      <h1>Inbox</h1>
      <p>Selected message: {selectedMessage.subject}</p>
      <button type="button" onClick={classify} disabled={loading}>
        {loading ? "Classifying..." : "Classify selected message"}
      </button>
      {classification ? (
        <pre style={{ marginTop: 16, background: "#f5f5f5", padding: 12 }}>{JSON.stringify(classification, null, 2)}</pre>
      ) : null}
    </main>
  );
}
