const crypto = require('crypto');

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { username, password } = req.body || {};
  if (!username || !password) return res.status(400).json({ error: 'Username and password required' });

  // Users stored as env var: JSON object { "username": "password", ... }
  // Set in Vercel: APP_USERS = {"peter":"mypass","omar":"theirpass"}
  const usersRaw = process.env.APP_USERS;
  if (!usersRaw) return res.status(500).json({ error: 'User system not configured. Set APP_USERS env var.' });

  let users;
  try { users = JSON.parse(usersRaw); } catch {
    return res.status(500).json({ error: 'Invalid APP_USERS configuration' });
  }

  // Validate credentials (case-insensitive username)
  const userKey = Object.keys(users).find(k => k.toLowerCase() === username.toLowerCase());
  if (!userKey || users[userKey] !== password) {
    return res.status(401).json({ error: 'Invalid username or password' });
  }

  // Generate a session token: HMAC of username + expiry
  const secret = process.env.APP_SECRET || 'aio-reports-default-secret';
  const expiry = Date.now() + (24 * 60 * 60 * 1000); // 24 hours
  const payload = `${userKey}:${expiry}`;
  const hmac = crypto.createHmac('sha256', secret).update(payload).digest('hex');
  const token = Buffer.from(`${payload}:${hmac}`).toString('base64');

  res.status(200).json({ token, user: userKey, expiresIn: '24h' });
};
