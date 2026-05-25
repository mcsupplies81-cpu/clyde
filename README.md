# Clyde v1 Demo

Freight-native AI inbox demo for SMB freight brokerages.

## Stack
- Next.js App Router + TypeScript + Tailwind
- Neon Postgres + Drizzle ORM
- OpenAI-compatible API routes

## Run
1. `cp .env.example .env.local`
2. `npm install`
3. `npm run dev`

## DB
- `npm run db:migrate`
- `npm run db:seed`

## Scope / non-goals
- Not a full TMS
- Not a CRM
- No autonomous sending
- No Gmail/Outlook live integration yet
