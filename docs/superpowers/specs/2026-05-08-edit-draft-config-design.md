# Edit Draft Config After Creation

## Problem
Draft settings (name, date, scoring format, players per team, payment details, etc.) cannot be edited after creation. Admins must delete and recreate the draft to fix mistakes or adjust settings.

## Design

### Backend: PATCH `/api/drafts/[id]`
- Admin-only (`getIsAdmin`)
- Accepts any draft fields: name, season_type, draft_date, draft_time, location, entry_fee, currency, payment_method, payment_info, notes, players_per_team, scoring_format
- No status restrictions — editable at any point (setup, in_progress, complete)
- Removes past-date validation for `draft_date` (draft may have already happened)
- Returns updated draft object

### Frontend: Config page edit mode
- Add "Edit" button next to the "Event Details" section divider on `/dashboard/drafts/[id]`
- Clicking "Edit" replaces the read-only info grid with the existing `DraftSetupForm` pre-filled with current draft data
- `submitLabel` set to "Save Changes"
- `onSubmit` calls `PATCH /api/drafts/[id]`
- On save: refresh draft state, return to read-only view
- Cancel button returns to read-only view without saving
- Only visible to admins

### Files changed
- `src/app/api/drafts/[id]/route.ts` — add PATCH handler
- `src/app/dashboard/drafts/[id]/page.tsx` — add edit mode toggle, reuse DraftSetupForm
- `src/components/DraftSetupForm.tsx` — minor: change redirect behavior when editing (don't push to new URL, stay on config page)
