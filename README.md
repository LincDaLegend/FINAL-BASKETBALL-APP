# Card Arb Engine (Next.js)

This repo hosts **Card Arb Engine** as a **Next.js** app for easy deployment on **Vercel**.

## Local dev

1. Create an env file:

```bash
cp .env.example .env
```

2. Set `EBAY_APP_ID` in `.env` (your eBay Production App ID / Client ID).

3. Install + run:

```bash
npm install
npm run dev
```

Open `http://localhost:3000`.

## Deploy to Vercel

- Import the GitHub repo into Vercel (it auto-detects Next.js).\n- Add an environment variable:\n  - `EBAY_APP_ID` = your eBay Production App ID (Client ID)\n- Deploy.

## Notes

- **eBay search** runs through a Next.js API route (`/api/ebay/search`) to avoid browser CORS issues.\n- **Claude/Anthropic AI scoring is disabled** in this build (rule-based scoring only).

