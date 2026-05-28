import Link from "next/link";

type Props = {
  hasInbox: boolean;
  hasGmail: boolean;
  inboxEmail: string | null;
};

type Step = {
  num: number;
  title: string;
  description: React.ReactNode;
  done: boolean;
  action?: React.ReactNode;
};

export function InboxEmptyState({ hasInbox, hasGmail, inboxEmail }: Props) {
  // Step 1: Connect an inbox (Gmail or Postmark forwarding)
  const step1Done = hasGmail;

  // Step 2: Forward your email / set up Postmark
  const step2Done = hasInbox && !!inboxEmail && !inboxEmail.includes("@inbox.clydefreight.com");

  // Step 3: Import loads
  const step3Done = false; // only true once first load exists — handled in page

  const steps: Step[] = [
    {
      num: 1,
      title: "Connect Gmail",
      description: "Let Clyde read and send emails from your Gmail or Google Workspace account.",
      done: step1Done,
      action: !step1Done ? (
        <a
          href="/api/auth/gmail"
          style={btnStyle}
        >
          Connect Gmail →
        </a>
      ) : null,
    },
    {
      num: 2,
      title: "Set up your inbound address",
      description: step2Done
        ? <>Your inbound address is <code style={{ background: "#F2F2F2", padding: "1px 6px", borderRadius: 4, fontSize: 12 }}>{inboxEmail}</code>. Emails forwarded here appear in Clyde.</>
        : "Add your Postmark inbound address in Settings so carrier and broker emails flow into Clyde automatically.",
      done: step2Done,
      action: !step2Done ? (
        <Link href="/app/settings" style={btnStyle}>
          Go to Settings →
        </Link>
      ) : null,
    },
    {
      num: 3,
      title: "Import your first load",
      description: "Push load data from your TMS using the API, or add a load manually. Clyde matches emails to loads automatically.",
      done: step3Done,
      action: (
        <Link href="/app/loads" style={btnStyle}>
          View Loads →
        </Link>
      ),
    },
  ];

  const allDone = step1Done && step2Done;

  return (
    <div style={{
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      minHeight: "100%",
      background: "#FAFAF8",
      padding: "60px 24px",
    }}>
      <div style={{ maxWidth: 520, width: "100%" }}>

        {/* Header */}
        <div style={{ textAlign: "center", marginBottom: 40 }}>
          <div style={{ fontSize: 36, marginBottom: 12 }}>📬</div>
          <h1 style={{ margin: "0 0 8px", fontSize: 22, fontWeight: 700, color: "#292929", letterSpacing: "-0.5px" }}>
            Welcome to Clyde
          </h1>
          <p style={{ margin: 0, fontSize: 14, color: "#7F7F7F", lineHeight: 1.6 }}>
            Complete these steps to start handling freight emails on autopilot.
          </p>
        </div>

        {/* Steps */}
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {steps.map((step) => (
            <div
              key={step.num}
              style={{
                background: "#FFFFFF",
                border: `1px solid ${step.done ? "#BBF7D0" : "#E8E8E8"}`,
                borderRadius: 10,
                padding: "16px 20px",
                display: "flex",
                gap: 16,
                alignItems: "flex-start",
                opacity: step.done ? 0.7 : 1,
              }}
            >
              {/* Step number / check */}
              <div style={{
                width: 28,
                height: 28,
                borderRadius: "50%",
                background: step.done ? "#16A34A" : "#EFF6FF",
                border: step.done ? "none" : "1px solid #BFDBFE",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 12,
                fontWeight: 700,
                color: step.done ? "#FFFFFF" : "#2563EB",
                flexShrink: 0,
                marginTop: 1,
              }}>
                {step.done ? "✓" : step.num}
              </div>

              {/* Content */}
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 14, fontWeight: 600, color: "#292929", marginBottom: 4, display: "flex", alignItems: "center", gap: 8 }}>
                  {step.title}
                  {step.done && <span style={{ fontSize: 11, fontWeight: 500, color: "#16A34A", background: "#F0FDF4", padding: "1px 8px", borderRadius: 99 }}>Done</span>}
                </div>
                <div style={{ fontSize: 12, color: "#7F7F7F", lineHeight: 1.6, marginBottom: step.action ? 12 : 0 }}>
                  {step.description}
                </div>
                {step.action}
              </div>
            </div>
          ))}
        </div>

        {/* All done — waiting for first email */}
        {allDone && (
          <div style={{
            marginTop: 24,
            background: "#EFF6FF",
            border: "1px solid #BFDBFE",
            borderRadius: 10,
            padding: "14px 20px",
            fontSize: 13,
            color: "#1D4ED8",
            lineHeight: 1.6,
            textAlign: "center",
          }}>
            🎉 Setup complete! Forward a carrier or broker email to your inbound address and it will appear here automatically.
          </div>
        )}

        {/* Shortcut to docs / support */}
        <div style={{ marginTop: 20, textAlign: "center", fontSize: 12, color: "#9CA3AF" }}>
          Need help?{" "}
          <a href="mailto:cam@usexiq.com" style={{ color: "#2563EB", textDecoration: "none" }}>
            Contact support
          </a>
        </div>

      </div>
    </div>
  );
}

const btnStyle: React.CSSProperties = {
  display: "inline-block",
  background: "#2563EB",
  color: "#FFFFFF",
  border: "none",
  borderRadius: 6,
  padding: "7px 14px",
  fontSize: 12,
  fontWeight: 600,
  cursor: "pointer",
  textDecoration: "none",
};
