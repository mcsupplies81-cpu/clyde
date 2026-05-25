# Clyde v1

## What Clyde is
Clyde is a demo AI copilot for freight broker operations. It shows inbox triage, load visibility, and workflow surfaces for rules, analytics, and settings.

## Tech stack
- Next.js 14 (App Router)
- TypeScript
- React 18
- ESLint

## Environment variables
Create `.env.local`:

```bash
DATABASE_URL=postgresql://<user>:<password>@<host>/<db>?sslmode=require
OPENAI_API_KEY=<optional>
```

- `DATABASE_URL` is required for database-backed routes and seed.
- `OPENAI_API_KEY` is optional; if missing, Clyde uses mock classification and mock drafts.

## Neon setup
1. Create a Neon project.
2. Copy the connection string from Neon dashboard.
3. Set it as `DATABASE_URL` in `.env.local`.

## Install commands
```bash
npm install
```

## Database commands
```bash
# validate env and demo database access wiring
npm run typecheck
```

## Seed command
```bash
npm run seed
```

## Run dev command
```bash
npm run dev
```

## Build and quality commands
```bash
npm run build
npm run lint
npm run typecheck
```

## Known limitations
- No real Gmail/Outlook integration
- No real TMS integration
- No autonomous sending
- No auth
- Demo tenant only
- Mock fallback AI if no API key

## What is intentionally not built yet
- Production multi-tenant data model
- Real carrier/broker system integrations
- Background job queue and durable retries
- Full AI orchestration with tool calling and human approval gates
