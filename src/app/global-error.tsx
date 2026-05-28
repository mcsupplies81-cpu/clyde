"use client";

import * as Sentry from "@sentry/nextjs";
import { useEffect } from "react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <html>
      <body>
        <div style={{
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#FAFAF8",
          fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
        }}>
          <div style={{
            background: "#FFFFFF",
            border: "1px solid #E8E8E8",
            borderRadius: 12,
            padding: 40,
            maxWidth: 420,
            textAlign: "center",
          }}>
            <div style={{ fontSize: 32, marginBottom: 16 }}>⚠️</div>
            <h2 style={{ margin: "0 0 8px", fontSize: 18, fontWeight: 700, color: "#292929" }}>
              Something went wrong
            </h2>
            <p style={{ margin: "0 0 24px", fontSize: 13, color: "#7F7F7F", lineHeight: 1.6 }}>
              We&apos;ve been notified and are looking into it. Try refreshing — if it keeps happening, contact support.
            </p>
            <button
              onClick={reset}
              style={{
                background: "#2563EB",
                color: "#FFFFFF",
                border: "none",
                borderRadius: 8,
                padding: "10px 24px",
                fontSize: 13,
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              Try again
            </button>
          </div>
        </div>
      </body>
    </html>
  );
}
