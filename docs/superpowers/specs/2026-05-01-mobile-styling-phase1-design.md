# Mobile Styling — Phase 1: Nav + Live Draft Pages

## Scope

Phase 1 covers the nav bar and live draft experience — the most critical mobile touchpoints. Phase 2 (remaining pages) will follow.

## Pages in Scope

1. **Navigation.tsx** — hamburger menu on mobile
2. **draft/[id]/live/page.tsx** — live draft board
3. **draft/[id]/coach/page.tsx** — coach view
4. **draft/[id]/team/page.tsx** — team view

## Design

### 1. Navigation

**Desktop (md+):** Current layout unchanged — logo left, links right.

**Mobile (<md):** 
- Logo on left, hamburger icon (☰) on right
- Hamburger opens a full-width dropdown panel below the nav bar
- Panel contains: Dashboard, Rankings, Bracket links stacked vertically
- External Draft dropdown nested inside (tap to expand)
- User email + Sign Out at the bottom
- Tap outside or tap hamburger to close

### 2. Live Draft Board (`live/page.tsx`)

**Desktop (lg+):** Current side-by-side layout — board left, `w-96` sidebar right.

**Mobile (<lg):**
- Header: stack vertically — draft name + round on top row, status badge full width below, action buttons (Undo/Reset) in a row below that
- Board: **vertical layout** — rounds go top-to-bottom, teams go left-to-right (scrollable). Current round highlighted. Player picker docked at bottom of screen.
- On mobile the board grid is transposed: team names as column headers, round numbers as row headers. This matches natural vertical scroll and keeps the current round visible.
- Desktop keeps the existing horizontal board (teams as rows, rounds as columns)
- Touch targets increased to minimum 44px height

### 3. Coach View (`coach/page.tsx`)

Already mostly vertical. Fixes:
- Tab buttons: increase height from `py-1.5` to `py-2.5` (44px touch target)
- Header links: increase from `px-3 py-1` to `px-4 py-2`
- Draft name: `text-xl md:text-2xl`

### 4. Team View (`team/page.tsx`)

Same pattern as coach view:
- Tab buttons: `py-2.5` for touch targets
- Header links: `px-4 py-2`
- Draft name: `text-xl md:text-2xl`

## Cross-Cutting Changes

- **Touch targets:** All interactive buttons/links minimum 44px height (`py-2` or `py-2.5` with `text-sm`)
- **Text sizes:** Minimum `text-xs` (12px) on mobile — replace `text-[10px]` and `text-[11px]` with `text-xs`
- **Logo:** `h-8 md:h-[55px]` in nav

## Files to Modify

| File | Changes |
|------|---------|
| `app/src/components/Navigation.tsx` | Hamburger menu, mobile drawer panel |
| `app/src/app/draft/[id]/live/page.tsx` | Mobile tab toggle for board/sidebar, stacked header |
| `app/src/app/draft/[id]/coach/page.tsx` | Touch targets, text sizing |
| `app/src/app/draft/[id]/team/page.tsx` | Touch targets, text sizing |
| `app/src/components/DraftBoardGrid.tsx` | Min text size `text-xs` |

## Out of Scope (Phase 2)

- Home page / landing page
- Draft admin (setup, invite, start modal)
- Standings, results, bracket
- Rankings, external draft, rosters
- Auth pages
