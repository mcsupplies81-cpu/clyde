import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

const isPublicPage = createRouteMatcher([
  "/",
  "/sign-in(.*)",
  "/sign-up(.*)",
]);

// Routes that handle their own auth — bypass Clerk entirely
function isSelfAuthRoute(pathname: string) {
  return (
    pathname.startsWith("/api/auth") ||   // Gmail OAuth init + callback
    pathname.startsWith("/api/v1") ||     // TMS API — Bearer token
    pathname.startsWith("/api/cron") ||   // Cron — CRON_SECRET
    pathname.startsWith("/api/webhooks")
  );
}

const hasClerkConfig = Boolean(process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY);

export default hasClerkConfig
  ? clerkMiddleware(async (auth, req) => {
      if (isSelfAuthRoute(req.nextUrl.pathname)) return NextResponse.next();
      if (!isPublicPage(req)) {
        await auth.protect();
      }
    })
  : () => NextResponse.next();

export const config = {
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
    "/__clerk/(.*)",
  ],
};
