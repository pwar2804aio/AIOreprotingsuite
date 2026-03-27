const express = require('express');
const path = require('path');
const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

// Serve static frontend
app.use(express.static(path.join(__dirname, 'public')));

// ── HubSpot API Proxy ──────────────────────────────────────────────
// Proxies requests to HubSpot CRM API using the token provided in the header.
// This avoids CORS issues when calling HubSpot from the browser.

app.all('/api/hubspot/*', async (req, res) => {
  const token = req.headers['x-hubspot-token'];
  if (!token) return res.status(401).json({ error: 'Missing HubSpot API token' });

  // Build the HubSpot API URL from the wildcard path
  const hubspotPath = req.params[0];
  const url = new URL(`https://api.hubapi.com/${hubspotPath}`);

  // Forward query params for GET requests
  if (req.method === 'GET') {
    Object.entries(req.query).forEach(([k, v]) => {
      if (Array.isArray(v)) v.forEach(val => url.searchParams.append(k, val));
      else url.searchParams.set(k, v);
    });
  }

  try {
    const fetchOpts = {
      method: req.method,
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    };
    if (['POST', 'PATCH', 'PUT'].includes(req.method) && req.body) {
      fetchOpts.body = JSON.stringify(req.body);
    }

    const hsRes = await fetch(url.toString(), fetchOpts);
    const data = await hsRes.json().catch(() => ({}));
    res.status(hsRes.status).json(data);
  } catch (err) {
    console.error('HubSpot proxy error:', err.message);
    res.status(502).json({ error: 'Failed to reach HubSpot API', detail: err.message });
  }
});

// SPA fallback
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => console.log(`HubSpot Reports running on http://localhost:${PORT}`));

module.exports = app;
