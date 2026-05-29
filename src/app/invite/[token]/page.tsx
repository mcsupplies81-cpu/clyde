import { db } from "@/db";
import { inviteTokens, tenants } from "@/db/schema";
import { eq, and, gt, isNull } from "drizzle-orm";
import { redirect } from "next/navigation";
import Link from "next/link";

export default async function InvitePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;

  const invite = await db.query.inviteTokens.findFirst({
    where: and(
      eq(inviteTokens.token, token),
      gt(inviteTokens.expiresAt, new Date()),
      isNull(inviteTokens.usedAt),
    ),
  });

  if (!invite) {
    return (
      <div style={pageStyle}>
        <div style={cardStyle}>
          <div style={{ fontSize: 40, marginBottom: 16 }}>🔗</div>
          <h1 style={headingStyle}>Invite link expired</h1>
          <p style={subStyle}>This link has already been used or has expired. Contact your Clyde admin for a new link.</p>
          <a href="mailto:cam@usexiq.com" style={btnStyle}>Contact support</a>
        </div>
      </div>
    );
  }

  const tenant = await db.query.tenants.findFirst({
    where: eq(tenants.id, invite.tenantId),
    columns: { name: true, seatLimit: true, plan: true },
  });

  // Pass the token through to sign-up via query param
  // After sign-up, auth.ts picks up the invite by matching email
  const signUpUrl = `/sign-up?invite=${token}${invite.email ? `&email=${encodeURIComponent(invite.email)}` : ""}`;

  return (
    <div style={pageStyle}>
      <div style={cardStyle}>
        {/* Logo */}
        <div style={{ fontSize: 13, fontWeight: 800, letterSpacing: "-0.5px", color: "#2563EB", marginBottom: 24 }}>
          CLYDE
        </div>

        <div style={{ fontSize: 32, marginBottom: 16 }}>📬</div>

        <h1 style={headingStyle}>
          You&apos;re invited to Clyde
        </h1>

        {tenant && (
          <div style={{
            background: "#EFF6FF", border: "1px solid #BFDBFE",
            borderRadius: 8, padding: "10px 16px", marginBottom: 20,
            fontSize: 13, color: "#1D4ED8",
          }}>
            Setting up workspace for <strong>{tenant.name}</strong>
          </div>
        )}

        <p style={subStyle}>
          Clyde is an AI-powered inbox for freight brokers — it classifies emails, drafts replies, and chases documents automatically.
        </p>

        <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 24 }}>
          {[
            "AI classifies every email by category and urgency",
            "Drafts replies using load data from your TMS",
            "Auto-chases BOL, POD, and rate confirmations",
          ].map((item) => (
            <div key={item} style={{ display: "flex", gap: 10, alignItems: "flex-start", fontSize: 13, color: "#5D5D5D" }}>
              <span style={{ color: "#16A34A", marginTop: 1, flexShrink: 0 }}>✓</span>
              {item}
            </div>
          ))}
        </div>

        <Link href={signUpUrl} style={{ ...btnStyle, display: "block", textAlign: "center" as const }}>
          Create your account →
        </Link>

        {invite.email && (
          <p style={{ marginTop: 12, fontSize: 11, color: "#9CA3AF", textAlign: "center" as const }}>
            Sign up with <strong>{invite.email}</strong> to join the correct workspace.
          </p>
        )}

        <p style={{ marginTop: 16, fontSize: 11, color: "#C4C4C4", textAlign: "center" as const }}>
          Expires {new Date(invite.expiresAt).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}
        </p>
      </div>
    </div>
  );
}

const pageStyle: React.CSSProperties = {
  minHeight: "100vh",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  background: "#FAFAF8",
  fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
  padding: 24,
};

const cardStyle: React.CSSProperties = {
  background: "#FFFFFF",
  border: "1px solid #E8E8E8",
  borderRadius: 16,
  padding: 40,
  maxWidth: 440,
  width: "100%",
  boxShadow: "0 4px 24px rgba(0,0,0,0.06)",
};

const headingStyle: React.CSSProperties = {
  margin: "0 0 12px",
  fontSize: 22,
  fontWeight: 700,
  color: "#292929",
  letterSpacing: "-0.5px",
};

const subStyle: React.CSSProperties = {
  margin: "0 0 20px",
  fontSize: 13,
  color: "#7F7F7F",
  lineHeight: 1.7,
};

const btnStyle: React.CSSProperties = {
  background: "#2563EB",
  color: "#FFFFFF",
  border: "none",
  borderRadius: 8,
  padding: "12px 24px",
  fontSize: 14,
  fontWeight: 600,
  cursor: "pointer",
  textDecoration: "none",
};
