# Card Arb Engine 🏀

AI-powered basketball card arbitrage sourcing tool for the Philippine market, sourcing from eBay US.

## Features

- **Live eBay search** — pull real listings by player name and category
- **AI scoring** — Claude AI scores each card using your past deal history as ML context
- **Deal log** — log every flip to train the AI (ROI %, days to sell, aesthetic notes)
- **Category rules** — set custom price/ROI thresholds for: low end, mid end, high end, quick sell, margin bet
- **Aesthetic scoring** — detects chrome/prizm/holo/gold variants automatically
- **USD → PHP conversion** — adjustable live exchange rate
- **ML weight tuning** — balance ROI focus vs flip speed in scoring

## Quick Start

### Option 1 — Open directly in browser (simplest)

```bash
# Just open index.html in any modern browser
open index.html
```

> Note: Some browsers block ES modules from `file://` URLs. Use Option 2 if you see errors.

### Option 2 — Local dev server (recommended)

```bash
# Using Python
python3 -m http.server 3000

# Using Node.js (npx)
npx serve .

# Using VS Code
# Install "Live Server" extension → right-click index.html → Open with Live Server
```

Then visit `http://localhost:3000`

### Option 3 — Deploy to the web

Upload all files to any static hosting:
- **Netlify** — drag the folder to netlify.com/drop
- **Vercel** — `npx vercel`
- **GitHub Pages** — push to a repo, enable Pages in Settings

## Setup

1. Open the app → go to **Settings**
2. Paste your **eBay Production App ID** (get it at developer.ebay.com → Create app → Production Client ID)
3. Set your current **USD → PHP rate**
4. Go to **Deal Log** → log some past deals to seed the ML model
5. Go to **Search** → type a player name → hit Search eBay

## Project Structure

```
card-arb-engine/
├── index.html
└── src/
    ├── main.js                  # App entry point + global bindings
    ├── styles/
    │   └── main.css             # Full dark-mode stylesheet
    ├── components/
    │   ├── Search.js            # eBay search + AI results page
    │   ├── Deals.js             # Deal log + ML training data
    │   ├── Rules.js             # Category rules + ML weight tuning
    │   └── Settings.js          # API keys, rate, data management
    └── utils/
        ├── api.js               # eBay API + Claude AI scoring
        ├── constants.js         # Categories, default rules, sample data
        ├── state.js             # App state + persistence helpers
        └── storage.js           # localStorage wrapper
```

## How AI Scoring Works

1. **Rule check** — Does the card fit the category's max price and min ROI threshold?
2. **ML layer** — Compare estimated ROI and flip speed against your logged deal averages for that category
3. **Aesthetic score** — Chrome / Prizm / Holo / Gold variants auto-score higher; condition from eBay signals
4. **Claude AI** — Sends listings + your last 25 deals to Claude for a final nuanced score and reasoning
5. **Verdict** — buy now (≥70/100) · consider (45–69) · skip (<45)

## eBay API Notes

This app uses the **eBay Finding API** (free tier):
- 5,000 calls/day on the free tier
- Returns BIN + auction listings
- Images, condition, price, and item URLs included

To get your key:
1. Go to [developer.ebay.com](https://developer.ebay.com)
2. Sign in with your eBay account
3. Create an application → get the **Production App ID (Client ID)**
4. Paste it in the app's Settings tab

## Data Privacy

- All data (deals, rules, API key) is stored in **your browser's localStorage only**
- Nothing is sent to any server except eBay's Finding API and Anthropic's API
- Use the Export feature in Settings to back up your data

## Customization

### Adding new categories
Edit `src/utils/constants.js` → `CATEGORIES` array and `DEFAULT_RULES` object.

### Changing the PHP rate permanently
Edit `phpRate` default in `src/utils/state.js`, or update it in the Settings tab.

### Pointing at a different Anthropic model
Edit `model` in `src/utils/api.js` → `aiScoreListings()`.
