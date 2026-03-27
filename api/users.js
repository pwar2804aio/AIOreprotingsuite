const auth = require('./_auth');
const kv = require('./_kv');

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') return res.status(204).end();

  // Authenticate
  const user = auth.validateSession(req.headers['authorization']);
  if (!user) return res.status(401).json({ error: 'Unauthorized' });

  // Admin check
  const admin = await auth.isAdmin(user);
  if (!admin) return res.status(403).json({ error: 'Admin access required' });

  // GET — list all users
  if (req.method === 'GET') {
    const envUsers = auth.getEnvUsers();
    const envList = Object.keys(envUsers).map(u => ({
      username: u, isAdmin: true, source: 'env',
    }));

    let kvList = [];
    if (kv.isConfigured()) {
      const kvUsers = await kv.listUsers();
      kvList = kvUsers.map(u => ({
        username: u.username, isAdmin: u.isAdmin === 'true', source: 'kv',
        createdBy: u.createdBy || '', createdAt: u.createdAt || '',
      }));
    }

    // Merge, env users take priority
    const envNames = new Set(Object.keys(envUsers).map(k => k.toLowerCase()));
    const merged = [...envList, ...kvList.filter(u => !envNames.has(u.username.toLowerCase()))];
    return res.status(200).json({ users: merged });
  }

  // POST — create user
  if (req.method === 'POST') {
    if (!kv.isConfigured()) return res.status(500).json({ error: 'User storage not configured. Set UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN env vars.' });
    const { username, password, isAdmin: makeAdmin } = req.body || {};
    if (!username || !password) return res.status(400).json({ error: 'Username and password required' });
    if (username.length < 2) return res.status(400).json({ error: 'Username must be at least 2 characters' });
    if (password.length < 4) return res.status(400).json({ error: 'Password must be at least 4 characters' });

    // Check for conflict with env users
    if (auth.isEnvAdmin(username)) return res.status(409).json({ error: 'Username conflicts with a system admin' });

    // Check if already exists in KV
    const existing = await kv.getUser(username);
    if (existing) return res.status(409).json({ error: 'Username already exists' });

    await kv.setUser(username, { password, isAdmin: !!makeAdmin, createdBy: user });
    return res.status(201).json({ ok: true });
  }

  // PUT — update user
  if (req.method === 'PUT') {
    if (!kv.isConfigured()) return res.status(500).json({ error: 'KV not configured' });
    const targetUser = req.query.user;
    if (!targetUser) return res.status(400).json({ error: 'Missing user query parameter' });
    if (auth.isEnvAdmin(targetUser)) return res.status(403).json({ error: 'Cannot modify system admins' });

    const existing = await kv.getUser(targetUser);
    if (!existing) return res.status(404).json({ error: 'User not found' });

    const updates = {};
    if (req.body.password) updates.password = req.body.password;
    if (req.body.isAdmin !== undefined) updates.isAdmin = req.body.isAdmin;

    await kv.updateUser(targetUser, updates);
    return res.status(200).json({ ok: true });
  }

  // DELETE — remove user
  if (req.method === 'DELETE') {
    if (!kv.isConfigured()) return res.status(500).json({ error: 'KV not configured' });
    const targetUser = req.query.user;
    if (!targetUser) return res.status(400).json({ error: 'Missing user query parameter' });
    if (auth.isEnvAdmin(targetUser)) return res.status(403).json({ error: 'Cannot delete system admins' });

    await kv.deleteUser(targetUser);
    return res.status(200).json({ ok: true });
  }

  return res.status(405).json({ error: 'Method not allowed' });
};
