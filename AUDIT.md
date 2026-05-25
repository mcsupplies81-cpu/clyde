# Clyde Workflow State Machine Audit

## Summary by edge case

1. **Duplicate classification** — **Broken**. Fixed by adding a DB unique constraint on `ai_classifications.message_id` and changing classification writes to upsert (`ON CONFLICT DO UPDATE`) so rapid duplicate clicks overwrite the same row. Also added an audit comment and OpenAI fallback logging.  
2. **Duplicate draft** — **Broken**. Fixed by adding a DB unique constraint on `(message_id, status)` in `ai_drafts` and switching insert to upsert targeting `(message_id, status)` so repeated generate calls replace existing pending draft content instead of creating duplicates.  
3. **Rejected draft + autopilot reruns** — **Not fully auditable in this repo**. No `runAutopilotAction` implementation exists in current codebase. Current draft generation logic does allow creating a new pending draft after rejection (expected behavior), but no auto-send path was found to gate on rejection reason.  
4. **Sent thread receives new inbound message** — **Not auditable in this repo**. No Gmail sync action or reopen UI banner code was found.  
5. **Escalated thread accidentally auto-processes** — **Not auditable in this repo**. No `runAutopilotAction` implementation exists in current codebase.  
6. **Missing load data** — **Broken**. Fixed by blocking draft generation with HTTP 409 when classification extracts a load number but no matching load is found; logs `load_match_no_result` with `{ confidence: 0, requiresReview: true }`. Inbox right panel now explicitly shows `No load found — manual lookup required`.  
7. **Missing document (POD)** — **Partially broken**. Fixed draft generation to load `load_documents`, detect missing POD for `pod_request`, inject missing-info context into the AI prompt, and ensure mock draft text says POD is being retrieved (not already provided).  
8. **OpenAI failure** — **Broken**. Fixed in both classify and draft routes with try/catch fallback to mock behavior and `audit_logs` action `ai_fallback`.  
9. **Gmail send failure** — **Not auditable in this repo**. No send-via-Gmail action found in current codebase.  
10. **Partial sync failure** — **Not auditable in this repo**. No sync loop action found in current codebase.

## Files changed
- `src/db/schema.ts`
- `src/app/api/ai/classify-email/route.ts`
- `src/app/api/ai/draft-reply/route.ts`
- `src/app/app/inbox/page.tsx`
- `src/lib/ai-classifier.ts`
