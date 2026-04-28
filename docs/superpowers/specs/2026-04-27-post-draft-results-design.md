# Post-Draft Results Page Design

**Route:** `/draft/[id]/results`
**Access:** Participants and admin only (same auth pattern as coach/team pages)
**When:** Visible when `draft.status === 'complete'`

## Data Source

All data comes from existing `useDraftState` hook — no new API endpoints needed. The hook returns `draft`, `participants`, `picks`, `players` which is sufficient to compute everything.

## Sections

### 1. Header
- Draft name (large bold)
- Season type badge ("Regular Season" or "Playoffs")
- Manager count + rounds count
- "FINAL RESULTS" badge

### 2. Standings
Table ranking all teams by total projected points (sum of `displayPoints` for each participant's picks).

Columns: Rank (🥇🥈🥉 for top 3), Team Name, Roster count, Total Pts.

First place row gets green highlight (`bg-[#1a3d1a]`).

### 3. Team Rosters
Expandable/collapsible cards — one per team, ordered by standings rank.

Each card shows:
- Header: medal + team name + total points
- Expanded: player rows with round number, team logo, name, position, PPG, and points
- Collapsed: just header with player count

First place card is expanded by default, others collapsed. Click to toggle.

### 4. Draft Awards
2x2 grid of award cards:

- **MVP** — player with highest `displayPoints` among all drafted players
- **Best Pick** — biggest ADP steal: `ADP - actual_pick_number` (highest positive). Only if ADP data exists.
- **Worst Pick** — biggest ADP reach: `actual_pick_number - ADP` (highest positive). Only if ADP data exists.
- **Mr. Irrelevant** — last player drafted (highest `pick_number`)

Each card shows: award icon + label, team logo + player name + position + key stat, "Drafted by [Team] (R[N])"

### 5. Draft Stats

**Team Distribution Bar Chart** (recharts `BarChart`):
- Horizontal bars showing count of drafted players per NHL team
- Each bar has the team logo and abbreviation on the left
- Sorted descending by count
- Only teams with ≥1 drafted player shown

**Position Breakdown Donut Chart** (recharts `PieChart`):
- Donut showing C, LW, RW, D split
- Center text: total picks count
- Legend below with count and percentage per position
- Colors: C=#4a7c59, LW=#6b9b7a, RW=#2d5a2d, D=#1a3d1a

## Navigation
- Dashboard "View Results" button → `/draft/[id]/results` (instead of live board)
- Coach page: add "Results" button in header when draft complete
- Team page: add "Results" button in header when draft complete

## Dependencies
- Install `recharts` package
- Uses existing `TeamLogo` component for all logo rendering
- Uses existing `useDraftState` hook for all data
