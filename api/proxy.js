const https = require('https');

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-hubspot-token');

  if (req.method === 'OPTIONS') return res.status(204).end();

  const token = req.headers['x-hubspot-token'];
  if (!token) return res.status(401).json({ error: 'Missing HubSpot API token' });

  const hsPath = req.query.hsPath;
  if (!hsPath) return res.status(400).json({ error: 'Missing hsPath query parameter' });

  const url = new URL(`https://api.hubapi.com/${hsPath}`);

  // Forward other query params
  Object.entries(req.query).forEach(([k, v]) => {
    if (k === 'hsPath') return;
    if (Array.isArray(v)) v.forEach(val => url.searchParams.append(k, val));
    else url.searchParams.set(k, v);
  });

  return new Promise((resolve) => {
    const options = {
      hostname: url.hostname,
      path: url.pathname + url.search,
      method: req.method,
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    };

    const proxyReq = https.request(options, (proxyRes) => {
      let data = '';
      proxyRes.on('data', chunk => { data += chunk; });
      proxyRes.on('end', () => {
        res.status(proxyRes.statusCode);
        res.setHeader('Content-Type', 'application/json');
        res.end(data);
        resolve();
      });
    });

    proxyReq.on('error', (err) => {
      res.status(502).json({ error: 'Failed to reach HubSpot API', detail: err.message });
      resolve();
    });

    if (['POST', 'PATCH', 'PUT'].includes(req.method) && req.body) {
      proxyReq.write(JSON.stringify(req.body));
    }
    proxyReq.end();
  });
};
