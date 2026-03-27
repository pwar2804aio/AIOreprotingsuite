export default async function handler(req, res) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-hubspot-token');

  if (req.method === 'OPTIONS') return res.status(204).end();

  const token = req.headers['x-hubspot-token'];
  if (!token) return res.status(401).json({ error: 'Missing HubSpot API token' });

  // Build HubSpot API URL from the catch-all path segments
  const pathSegments = req.query.path;
  const hsPath = Array.isArray(pathSegments) ? pathSegments.join('/') : pathSegments;
  const url = new URL(`https://api.hubapi.com/${hsPath}`);

  // Forward query params (except the catch-all 'path')
  Object.entries(req.query).forEach(([k, v]) => {
    if (k === 'path') return;
    if (Array.isArray(v)) v.forEach(val => url.searchParams.append(k, val));
    else url.searchParams.set(k, v);
  });

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
    const data = await hsRes.text();

    res.status(hsRes.status);
    res.setHeader('Content-Type', 'application/json');
    res.end(data);
  } catch (err) {
    console.error('HubSpot proxy error:', err.message);
    res.status(502).json({ error: 'Failed to reach HubSpot API', detail: err.message });
  }
}
