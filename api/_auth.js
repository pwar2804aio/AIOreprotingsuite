// Shared session validation and admin checks
const crypto = require('crypto');
const kv = require('./_kv');

function validateSession(authHeader) {
  if (!authHeader || !authHeader.startsWith('Bearer ')) return null;
  try {
    const decoded = Buffer.from(authHeader.slice(7), 'base64').toString();
    const [username, expiry, hmac] = decoded.split(':');
    if (!username || !expiry || !hmac) return null;
    if (Date.now() > parseInt(expiry)) return null;
    const secret = process.env.APP_SECRET || 'aio-reports-default-secret';
    const expected = crypto.createHmac('sha256', secret).update(`${username}:${expiry}`).digest('hex');
    if (hmac !== expected) return null;
    return username;
  } catch { return null; }
}

function getEnvUsers() {
  try { return JSON.parse(process.env.APP_USERS || '{}'); } catch { return {}; }
}

function isEnvAdmin(username) {
  const users = getEnvUsers();
  return Object.keys(users).some(k => k.toLowerCase() === username.toLowerCase());
}

async function isAdmin(username) {
  // Env var users are always admins
  if (isEnvAdmin(username)) return true;
  // Check KV store
  const kvUser = await kv.getUser(username);
  return kvUser && kvUser.isAdmin === 'true';
}

module.exports = { validateSession, getEnvUsers, isEnvAdmin, isAdmin };
