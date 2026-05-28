import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,

  // Only run in production — no noise in local dev
  enabled: process.env.NODE_ENV === "production",

  // Capture 10% of transactions for performance monitoring (free plan friendly)
  tracesSampleRate: 0.1,

  // Capture 100% of errors
  // Adjust this in production if volume gets high
  debug: false,
});
