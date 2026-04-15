# Hockey Fantasy Playoff Draft App

Data-driven edge for your NHL playoff fantasy draft.

## Setup

### Scraper
```bash
cd scraper
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate
pip install -r requirements.txt
python run.py  # Generates app/public/players.json
```

### Web App
```bash
cd app
npm install
npm run dev  # http://localhost:3000
```

## Data Sources
- NHL.com - Playoff rosters, injuries
- MoneyPuck.com - Team advancement odds, player stats, recent form
- FantasyPros.com - Expert rankings, ADP

## License
MIT
