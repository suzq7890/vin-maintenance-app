# Vehicle Maintenance Guide — Vercel Deployment

## What's in this project

```
vin-maintenance-app/
├── vercel.json          # Vercel routing config
├── api/
│   └── maintenance.js   # Serverless proxy (calls Anthropic API)
└── public/
    └── index.html       # Frontend app
```

---

## How to deploy (step by step)

### Step 1 — Create a free Vercel account
Go to https://vercel.com and sign up. You can use your GitHub, Google, or email.

### Step 2 — Get the Vercel CLI (optional but easiest)
If you have Node.js installed, open Terminal and run:
```
npm install -g vercel
```
Then from inside the `vin-maintenance-app` folder, run:
```
vercel
```
Follow the prompts. It will ask you to log in and confirm settings. Accept all defaults.

### Step 2 (alternative) — Deploy via drag and drop
1. Go to https://vercel.com/new
2. Choose "Browse" and select the entire `vin-maintenance-app` folder
3. Click Deploy

### Step 3 — Add your Anthropic API key
After deploying, go to your project in the Vercel dashboard:
1. Click **Settings** → **Environment Variables**
2. Add a new variable:
   - Name: `ANTHROPIC_API_KEY`
   - Value: your API key (from https://console.anthropic.com)
3. Click **Save**
4. Go to **Deployments** and click **Redeploy** to apply the key

### Step 4 — Done
Vercel gives you a live URL like `https://your-app.vercel.app`. Share it with anyone.

---

## Getting an Anthropic API key
1. Go to https://console.anthropic.com
2. Sign up or log in
3. Click **API Keys** in the left menu
4. Click **Create Key**, give it a name, copy it
5. Paste it into the Vercel environment variable in Step 3

---

## Cost expectations
- Vercel free tier: $0 (up to 100GB bandwidth/month, plenty for an MVP)
- Anthropic API: ~$0.003–0.005 per VIN lookup (Sonnet pricing)
- 1,000 lookups ≈ $3–5 total

---

## Connecting a custom domain (optional)
In your Vercel project dashboard → **Settings** → **Domains** → add your domain.
Vercel handles SSL automatically.

---

## Questions?
See Vercel docs: https://vercel.com/docs
See Anthropic docs: https://docs.anthropic.com
