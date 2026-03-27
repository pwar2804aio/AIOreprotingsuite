# AIO Reporting Suite

HubSpot CRM reporting dashboard with real-time analytics for deals, contacts, companies, and tickets.

## Reports

- **Dashboard** — Overview with pipeline snapshot, ticket breakdowns, and key metrics
- **Sales Pipeline** — Full funnel visualization with deal counts and values per stage
- **Deals by Rep** — Performance breakdown by sales rep (deals, win rate, revenue)
- **Ticket Analytics** — Open tickets by category, priority, source, and recent activity
- **Contacts** — Lifecycle stage breakdown and recent contact activity
- **Companies** — City distribution, industry mix, and company details

## Setup

### 1. HubSpot Private App Token

1. Go to **HubSpot Settings** → **Integrations** → **Private Apps**
2. Create a new Private App
3. Add these scopes:
   - `crm.objects.contacts.read`
   - `crm.objects.companies.read`
   - `crm.objects.deals.read`
   - `crm.objects.owners.read`
   - `tickets` (read)
4. Copy the generated token

### 2. Run Locally

**With Python (no dependencies):**
```bash
python3 proxy.py
# Open http://localhost:8082
```

**With Node.js:**
```bash
npm install
npm start
# Open http://localhost:3000
```

### 3. Deploy

**Vercel (recommended):**
```bash
npm i -g vercel
vercel
```

**Render / Railway:**
- Connect the GitHub repo
- Set build command: `npm install`
- Set start command: `node server.js`
- Set environment variable `PORT` if needed

## Tech Stack

- Pure HTML/CSS/JS frontend (no frameworks, no build step)
- Express.js or Python proxy backend (handles HubSpot API CORS)
- SVG donut charts and CSS bar charts (no chart libraries)
- Deployable to any Node.js or Python hosting platform
