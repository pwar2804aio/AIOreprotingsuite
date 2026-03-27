const crypto = require('crypto');
const kv = require('./_kv');
const { getEnvUsers } = require('./_auth');

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { username, password } = req.body || {};
  if (!username || !password) return res.status(400).json({ error: 'Username and password required' });

  let matchedUser = null;
  let isAdmin = false;

  // 1. Check KV store first
  if (kv.isConfigured()) {
    const kvUser = await kv.getUser(username);
    if (kvUser && kvUser.password === password) {
      matchedUser = kvUser.username;
      isAdmin = kvUser.isAdmin === 'true';
    }
  }

  // 2. Fallback to APP_USERS env var (these are always admins)
  if (!matchedUser) {
    const envUsers = getEnvUsers();
    const userKey = Object.keys(envUsers).find(k => k.toLowerCase() === username.toLowerCase());
    if (userKey && envUsers[userKey] === password) {
      matchedUser = userKey;
      isAdmin = true;
    }
  }

  if (!matchedUser) {
    return res.status(401).json({ error: 'Invalid username or password' });
  }

  // Generate session token
  const secret = process.env.APP_SECRET || 'aio-reports-default-secret';
  const expiry = Date.now() + (24 * 60 * 60 * 1000); // 24 hours
  const payload = `${matchedUser}:${expiry}`;
  const hmac = crypto.createHmac('sha256', secret).update(payload).digest('hex');
  const token = Buffer.from(`${payload}:${hmac}`).toString('base64');

  res.status(200).json({ token, user: matchedUser, isAdmin, expiresIn: '24h' });
};
