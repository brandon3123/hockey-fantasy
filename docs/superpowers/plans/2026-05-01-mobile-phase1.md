# Mobile Styling Phase 1 — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the nav bar and live draft pages usable on mobile (<768px).

**Architecture:** Tailwind responsive breakpoints (sm: 640px, md: 768px, lg: 1024px). Nav gets a hamburger menu. Live draft board gets a transposed (vertical) layout on mobile with sidebar as a bottom sheet. Coach/team views get touch target fixes.

**Tech Stack:** Tailwind CSS, React state for mobile toggles

---

## File Structure

| File | Changes |
|------|---------|
| `app/src/components/Navigation.tsx` | Add hamburger menu, mobile dropdown panel |
| `app/src/app/draft/[id]/live/page.tsx` | Responsive header, vertical board on mobile, bottom sheet sidebar |
| `app/src/app/draft/[id]/coach/page.tsx` | Touch targets, text sizing |
| `app/src/app/draft/[id]/team/page.tsx` | Touch targets, text sizing |

---

### Task 1: Mobile hamburger nav

**Files:**
- Modify: `app/src/components/Navigation.tsx`

**Current state:** All nav links rendered in a single horizontal flex row. Zero breakpoints. Overflows on any screen under ~900px.

- [ ] **Step 1: Add hamburger state and mobile menu**

Add `mobileOpen` state. On mobile (<md), show logo + hamburger icon. On md+, show current desktop layout. The hamburger opens a full-width dropdown panel with links stacked vertically.

Replace the entire return block in Navigation.tsx with:

```tsx
  return (
    <nav className="bg-[#0a0f0a] border-b border-[#141e12]">
      <div className="max-w-7xl mx-auto px-4">
        <div className="flex items-center justify-between py-2">
          <div className="flex items-center">
            <Link href="/" className="flex items-center">
              <img src="/logo/logo-horizontal.svg" alt="Top Shelf Draft" className="h-8 md:h-[55px]" />
            </Link>
          </div>

          {/* Desktop nav */}
          <div className="hidden md:flex items-center gap-1">
            {navLink('/', 'Dashboard')}
            {navLink('/rankings', 'Rankings')}
            {navLink('/bracket', 'Bracket')}
            {user && isAdmin && (
              <>
                <span className="w-px h-5 bg-[#141e12] mx-2" />
                <div ref={dropdownRef} className="relative">
                  <button
                    onClick={() => setExternalOpen(!externalOpen)}
                    className={`px-4 py-2 text-sm font-medium transition-colors rounded-md ${
                      pathname === '/draft' || pathname === '/rosters'
                        ? 'bg-[#4a7c59] text-[#c8d9c3]'
                        : 'text-[#6b9b7a] border border-[#4a7c59] hover:bg-[#141e12]'
                    }`}
                  >
                    External Draft ▾
                  </button>
                  {externalOpen && (
                    <div className="absolute right-0 mt-1 w-44 bg-[#0a0f0a] border border-[#4a7c59] rounded-lg overflow-hidden z-50">
                      <Link
                        href="/draft"
                        onClick={() => setExternalOpen(false)}
                        className="block px-4 py-2.5 text-sm text-[#c8d9c3] hover:bg-[#141e12] transition-colors"
                      >
                        Draft Board
                      </Link>
                      <Link
                        href="/rosters"
                        onClick={() => setExternalOpen(false)}
                        className="block px-4 py-2.5 text-sm text-[#c8d9c3] hover:bg-[#141e12] transition-colors"
                      >
                        Team Rosters
                      </Link>
                    </div>
                  )}
                </div>
              </>
            )}
            <span className="w-px h-5 bg-[#141e12] mx-2" />
            <div className="flex items-center gap-3">
              {loading ? (
                <span className="text-sm text-[#5a6b57]">Loading...</span>
              ) : user ? (
                <>
                  <span className="text-sm text-[#c8d9c3]">{user.email}</span>
                  <button
                    onClick={signOut}
                    className="px-3 py-1.5 text-sm text-[#5a6b57] hover:text-[#c8d9c3] transition-colors"
                  >
                    Sign Out
                  </button>
                </>
              ) : (
                <Link
                  href="/auth/login"
                  className="px-4 py-2 text-sm font-medium bg-[#4a7c59] text-[#c8d9c3] rounded-md hover:bg-[#3d664a] transition-colors"
                >
                  Sign In
                </Link>
              )}
            </div>
          </div>

          {/* Mobile hamburger */}
          <button
            className="md:hidden p-2 text-[#6b9b7a]"
            onClick={() => setMobileOpen(!mobileOpen)}
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              {mobileOpen ? (
                <path d="M6 18L18 6M6 6l12 12" />
              ) : (
                <path d="M4 6h16M4 12h16M4 18h16" />
              )}
            </svg>
          </button>
        </div>

        {/* Mobile dropdown */}
        {mobileOpen && (
          <div className="md:hidden border-t border-[#141e12] py-2">
            <Link href="/" onClick={() => setMobileOpen(false)} className="block px-4 py-3 text-sm text-[#c8d9c3] hover:bg-[#141e12]">Dashboard</Link>
            <Link href="/rankings" onClick={() => setMobileOpen(false)} className="block px-4 py-3 text-sm text-[#5a6b57] hover:bg-[#141e12]">Rankings</Link>
            <Link href="/bracket" onClick={() => setMobileOpen(false)} className="block px-4 py-3 text-sm text-[#5a6b57] hover:bg-[#141e12]">Bracket</Link>
            {user && isAdmin && (
              <>
                <div className="h-px bg-[#141e12] my-1 mx-4" />
                <Link href="/draft" onClick={() => setMobileOpen(false)} className="block px-4 py-3 text-sm text-[#6b9b7a] hover:bg-[#141e12]">Draft Board</Link>
                <Link href="/rosters" onClick={() => setMobileOpen(false)} className="block px-4 py-3 text-sm text-[#6b9b7a] hover:bg-[#141e12]">Team Rosters</Link>
              </>
            )}
            <div className="h-px bg-[#141e12] my-1 mx-4" />
            {loading ? (
              <div className="px-4 py-3 text-sm text-[#5a6b57]">Loading...</div>
            ) : user ? (
              <div className="px-4 py-3 flex items-center justify-between">
                <span className="text-sm text-[#c8d9c3] truncate">{user.email}</span>
                <button onClick={() => { signOut(); setMobileOpen(false); }} className="text-sm text-[#5a6b57] ml-4">Sign Out</button>
              </div>
            ) : (
              <Link href="/auth/login" onClick={() => setMobileOpen(false)} className="block px-4 py-3 text-sm font-medium text-[#4a7c59] hover:bg-[#141e12]">Sign In</Link>
            )}
          </div>
        )}
      </div>
    </nav>
  );
```

Add `const [mobileOpen, setMobileOpen] = useState(false);` near the other useState hooks at the top of the component.

- [ ] **Step 2: Verify build**

```bash
cd app && npx next build
```

Expected: Build succeeds.

- [ ] **Step 3: Commit**

```bash
git add app/src/components/Navigation.tsx
git commit -m "add mobile hamburger menu to navigation"
```

---

### Task 2: Live draft page — responsive layout

**Files:**
- Modify: `app/src/app/draft/[id]/live/page.tsx`

This is the largest task. The live page has three parts to make responsive:
1. Header bar (lines 502-555)
2. Board + sidebar layout (lines 557-621)
3. DraftBoardGrid component (lines 197-348)

- [ ] **Step 1: Add mobile state**

Add near the other useState hooks (around line 354):

```tsx
const [mobileBoardTab, setMobileBoardTab] = useState<'board' | 'players'>('board');
```

- [ ] **Step 2: Make the header responsive**

Replace lines 502-555 (the header `<div className="shrink-0 ...">`) with:

```tsx
      <div className="shrink-0 border-b border-[#141e12] bg-[#0a0f0a] px-4 py-3">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2 md:gap-4">
            <h1 className="text-base md:text-lg font-bold text-[#c8d9c3]">{draft.name}</h1>
            <div className="text-xs md:text-sm text-[#5a6b57]">
              Round {currentRound} &bull; Pick {currentPick}
            </div>
          </div>
          <div className="flex items-center gap-2 md:gap-3 flex-wrap">
            {isDraftComplete ? (
              <div className="flex items-center gap-2">
                <div className="px-3 py-1.5 bg-[#4a7c59] rounded-lg text-xs md:text-sm font-bold text-[#c8d9c3]">
                  DRAFT COMPLETE
                </div>
                <Link
                  href={`/draft/${draftId}/results`}
                  className="px-3 py-1.5 text-xs md:text-sm font-bold text-[#050a05] bg-[#6b9b7a] rounded-lg hover:bg-[#8ab89a] transition-colors"
                >
                  View Results
                </Link>
              </div>
            ) : (
              <div className="px-3 py-1.5 bg-[#4a7c59] rounded-lg text-xs md:text-sm font-bold text-white animate-pulse">
                ON THE CLOCK: {currentParticipant?.team_name || '...'}
              </div>
            )}
            <div className="text-xs md:text-sm text-[#5a6b57]">
              {totalPicks}/{totalSlots}
            </div>
            {isAdmin && (
              <>
                {!isDraftComplete && (
                  <button
                    onClick={handleUndo}
                    disabled={totalPicks === 0}
                    className="px-3 py-2 text-xs font-medium text-[#c8d9c3] bg-[#050a05] border border-[#141e12] rounded-lg hover:bg-[#141e12] hover:border-[#4a7c59] transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                  >
                    Undo
                  </button>
                )}
                <button
                  onClick={handleReset}
                  className="px-3 py-2 text-xs font-medium text-red-400 bg-[#050a05] border border-[#3d1a1a] rounded-lg hover:bg-[#3d1a1a] transition-colors"
                >
                  Reset
                </button>
              </>
            )}
          </div>
        </div>
      </div>
```

- [ ] **Step 3: Make board + sidebar responsive**

Replace lines 557-621 (the `<div className="flex-1 flex min-h-0">` section) with a responsive layout. On mobile, show a tab toggle between board and sidebar. On desktop, keep current side-by-side.

```tsx
      {/* Mobile tab toggle */}
      <div className="lg:hidden flex border-b border-[#141e12]">
        <button
          onClick={() => setMobileBoardTab('board')}
          className={`flex-1 py-3 text-center text-sm font-semibold transition-colors ${
            mobileBoardTab === 'board' ? 'text-[#c8d9c3] bg-[#1a2f1a] border-b-2 border-[#4a7c59]' : 'text-[#5a6b57]'
          }`}
        >
          Draft Board
        </button>
        <button
          onClick={() => setMobileBoardTab('players')}
          className={`flex-1 py-3 text-center text-sm font-semibold transition-colors ${
            mobileBoardTab === 'players' ? 'text-[#c8d9c3] bg-[#1a2f1a] border-b-2 border-[#4a7c59]' : 'text-[#5a6b57]'
          }`}
        >
          Players
        </button>
      </div>

      <div className="flex-1 flex min-h-0">
        {/* Board — always visible on desktop, conditional on mobile */}
        <div className={`flex-1 overflow-auto p-4 ${mobileBoardTab !== 'board' ? 'hidden lg:block' : ''}`}>
          <DraftBoardGrid
            participants={participants}
            picks={picks}
            players={players}
            currentRound={currentRound}
            currentPick={currentPick}
            playersPerTeam={draft.players_per_team || 10}
            currentParticipant={currentParticipant}
            onPickClick={(pick) => isAdmin && setReplacePick(pick)}
          />
        </div>

        {/* Sidebar — always visible on desktop, conditional on mobile */}
        <div className={`${mobileBoardTab !== 'players' ? 'hidden lg:flex' : 'flex'} w-full lg:w-96 shrink-0 flex-col border-t lg:border-t-0 lg:border-l border-[#141e12] bg-[#050a05]`}>
          <div className="shrink-0 flex gap-1 p-2 border-b border-[#141e12]">
            <button
              onClick={() => setSidebarTab('players')}
              className={`flex-1 px-2 py-2.5 text-xs font-semibold rounded transition-colors ${
                sidebarTab === 'players'
                  ? 'bg-[#4a7c59] text-[#c8d9c3]'
                  : 'bg-[#0a0f0a] text-[#5a6b57] hover:bg-[#141e12]'
              }`}
            >
              Players
            </button>
            <button
              onClick={() => setSidebarTab('teams')}
              className={`flex-1 px-2 py-2.5 text-xs font-semibold rounded transition-colors ${
                sidebarTab === 'teams'
                  ? 'bg-[#4a7c59] text-[#c8d9c3]'
                  : 'bg-[#0a0f0a] text-[#5a6b57] hover:bg-[#141e12]'
              }`}
            >
              Teams
            </button>
          </div>
          {sidebarTab === 'players' ? (
            <PlayerList
              availablePlayers={availablePlayers}
              onPickPlayer={handlePickPlayer}
              loading={loading}
              picking={picking}
              isDraftComplete={isDraftComplete}
              currentParticipant={currentParticipant}
              pickTimerSeconds={draft.pick_timer_seconds}
              showSearch={true}
              showHeader={true}
            />
          ) : (
            <div className="flex-1 overflow-y-auto p-4">
              <TeamBrowserTab
                players={players}
                picks={picks}
                participants={participants}
                onDraftPlayer={handlePickPlayer}
                isDraftComplete={isDraftComplete}
                seasonType={draft?.season_type ?? 'playoffs'}
                playoffTeams={playoffTeams}
              />
            </div>
          )}
        </div>
      </div>
```

- [ ] **Step 4: Increase touch targets in DraftBoardGrid**

In the DraftBoardGrid function (line 197), update text sizes and touch targets:
- Change all `text-[10px]` to `text-xs`
- Change all `text-[11px]` to `text-xs`
- Change all `px-1 py-1` table cells to `px-1 py-2`
- Change `min-w-[120px]` manager header to `min-w-[80px]`
- Change `min-w-[70px]` round headers to `min-w-[50px]`

Specific edits:
- Line 249: `min-w-[120px]` → `min-w-[80px]`
- Line 255: `min-w-[70px]` → `min-w-[50px]`
- Line 285: `text-[10px]` → `text-xs`
- Line 300: `px-1 py-1` → `px-1 py-2`
- Line 310: `text-[11px]` → `text-xs`
- Line 315: `text-[10px]` → `text-xs`
- Line 326: `text-[11px]` → `text-xs`

- [ ] **Step 5: Verify build**

```bash
cd app && npx next build
```

Expected: Build succeeds.

- [ ] **Step 6: Commit**

```bash
git add app/src/app/draft/[id]/live/page.tsx
git commit -m "add responsive layout to live draft page with mobile tab toggle"
```

---

### Task 3: Coach view — mobile fixes

**Files:**
- Modify: `app/src/app/draft/[id]/coach/page.tsx`

- [ ] **Step 1: Fix touch targets and text sizing**

Changes needed:
- Tab buttons: `px-3 py-1.5 text-xs` → `px-3 py-2.5 text-xs` (all tab buttons)
- Header links: `px-3 py-1` → `px-4 py-2`
- Draft name: add responsive sizing `text-xl md:text-2xl`

Find all `px-3 py-1` patterns in the file and replace with `px-4 py-2` for link/button elements.

- [ ] **Step 2: Verify build**

```bash
cd app && npx tsc --noEmit
```

Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add app/src/app/draft/[id]/coach/page.tsx
git commit -m "fix mobile touch targets in coach view"
```

---

### Task 4: Team view — mobile fixes

**Files:**
- Modify: `app/src/app/draft/[id]/team/page.tsx`

- [ ] **Step 1: Fix touch targets and text sizing**

Same pattern as coach view:
- Tab buttons: `px-3 py-1.5 text-xs` → `px-3 py-2.5 text-xs`
- Header links: `px-3 py-1` → `px-4 py-2`
- Draft name: `text-xl md:text-2xl`

- [ ] **Step 2: Verify build**

```bash
cd app && npx tsc --noEmit
```

Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add app/src/app/draft/[id]/team/page.tsx
git commit -m "fix mobile touch targets in team view"
```
