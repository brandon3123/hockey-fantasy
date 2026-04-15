# Hockey Fantasy Playoff Draft App

Data-driven edge for your NHL playoff fantasy draft. 1 point per goal/assist, skaters only.

## Features

- **Player Rankings** — Sortable, filterable table with projections
- **Live Draft Board** — Snake draft with configurable managers (3-12)
- **Best Available** — Real-time recommendations with ADP value indicators
- **Team Stacking** — See available teammates from your invested teams
- **Hot/Cold Indicators** — Recent form analysis (last 10/20 games)
- **Injury Tracking** — Expected return dates, automatic exclusion if out for playoffs

## Quick Start

### 1. Generate Player Data

```bash
cd scraper
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate
pip install -r requirements.txt
python run.py
```

This scrapes current data and generates `app/public/players.json`.

### 2. Run the Web App

```bash
cd app
npm install
npm run dev
```

Visit http://localhost:3000

### 3. Draft Day Workflow

1. Run scraper day-of to get fresh data
2. Browse rankings, star players you want
3. Go to Draft Board, set up your draft config
4. Click players to assign picks as the draft happens
5. Check Rosters page after for analysis

## Data Sources

- **NHL.com** — Playoff rosters, injury status
- **MoneyPuck.com** — Team advancement odds, player stats, recent form
- **FantasyPros.com** — Expert rankings, ADP

## Projection Formula

`projectedPlayoffPoints = pointsPerGame × projectedPlayoffGames`

`projectedPlayoffGames = (R1 odds × 7) + (R2 odds × 7) + (R3 odds × 7) + (R4 odds × 7)`

## Strategy Tips

1. **Stack deep teams** — Players on teams that go far = more games = more points
2. **Watch for hot streaks** — Players entering playoffs on a tear often outperform
3. **Target ADP value** — If a player goes later than their projection rank, they're a steal
4. **Injuries** — Day-to-day is fine, "out indefinitely" is a risk to monitor
