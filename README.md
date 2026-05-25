# Clyde — Freight AI Inbox

AI-powered email operations for freight brokerages. Reads inbound logistics emails, matches them to loads, classifies intent, and generates human-approved draft replies.

## Stack

- **Next.js 15** App Router + TypeScript
- **Neon Postgres** + Drizzle ORM
- **OpenAI API** (optional — falls back to mock classifier)
- **Tailwind CSS**
- Deployable on Vercel

## Setup

### 1. Install dependencies
```bash
npm install
```

### 2. Configure environment
```bash
cp .env.example .env.local
```

Edit `.env.local`:
```env
DATABASE_URL="your_neon_pooled_connection_string"
OPENAI_API_KEY="sk-..."          # optional
DEMO_TENANT_ID=""                # fill in after seed
```

### 3. Push schema to Neon
```bash
npm run db:push
```

### 4. Seed demo data
```bash
npm run db:seed
```
Copy the tenant ID printed at the end into `DEMO_TENANT_ID` in `.env.local`.

### 5. Run dev server
```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

## Database commands

| Command | What it does |
|---|---|
| `npm run db:push` | Push schema to Neon (no migration files) |
| `npm run db:generate` | Generate migration SQL files |
| `npm run db:migrate` | Run migrations |
| `npm run db:seed` | Seed demo freight data |
| `npm run db:studio` | Open Drizzle Studio |

## Routes

| Route | Page |
|---|---|
| `/app/inbox` | Main AI inbox — 3-column command center |
| `/app/loads` | Load list with search and filters |
| `/app/loads/[id]` | Load detail workspace |
| `/app/rules` | SOP rules management |
| `/app/analytics` | Ops metrics dashboard |
| `/app/settings` | Demo configuration |

## API routes

| Endpoint | What it does |
|---|---|
| `POST /api/ai/classify-email` | Classify an inbound email |
| `POST /api/ai/draft-reply` | Generate AI draft reply for a message |

## Known limitations (v1)

- No real Gmail/Outlook integration — demo data only
- No real TMS integration — mock data
- No autonomous sending — human approval always required
- No authentication — demo tenant hardcoded via `DEMO_TENANT_ID`
- No real document storage — placeholder URLs

## What's next

- 3-column inbox with full interactivity (classify + draft buttons)
- Loads list and detail pages
- SOP rules CRUD
- Analytics dashboard
- Approval workflow actions (approve/reject/edit draft)
