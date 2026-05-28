import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs";

const nextConfig: NextConfig = {
  // Suppress the lockfile workspace root warning (multiple projects on this machine)
  outputFileTracingRoot: "/Users/cameron/clyde/repo",
};

export default withSentryConfig(nextConfig, {
  // Set these after creating your Sentry project at sentry.io
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,

  // Auth token for source map uploads — add SENTRY_AUTH_TOKEN to Vercel env vars
  authToken: process.env.SENTRY_AUTH_TOKEN,

  silent: true,
  disableLogger: true,

  // Don't fail build if Sentry upload fails (e.g. no token in local dev)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  errorHandler(err: any) {
    console.warn("Sentry build warning:", err);
  },
});
