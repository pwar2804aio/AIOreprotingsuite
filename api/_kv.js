// Vercel KV (Upstash Redis) REST API helper — no npm packages needed

const KV_URL = () => process.env.KV_REST_API_URL;
const KV_TOKEN = () => process.env.KV_REST_API_TOKEN;

function isConfigured() {
  return !!(KV_URL() && KV_TOKEN());
}

async function kvCommand(args) {
  const res = await fetch(KV_URL(), {
    method: 'POST',
    headers: { Authorization: `Bearer ${KV_TOKEN()}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(args),
  });
  const data = await res.json();
  return data.result;
}

async function kvPipeline(commands) {
  const res = await fetch(`${KV_URL()}/pipeline`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${KV_TOKEN()}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(commands),
  });
  const data = await res.json();
  return data.map(d => d.result);
}

function parseHash(arr) {
  if (!arr || !arr.length) return null;
  const obj = {};
  for (let i = 0; i < arr.length; i += 2) obj[arr[i]] = arr[i + 1];
  return obj;
}

async function getUser(username) {
  if (!isConfigured()) return null;
  const result = await kvCommand(['HGETALL', `user:${username.toLowerCase()}`]);
  return parseHash(result);
}

async function setUser(username, { password, isAdmin = false, createdBy = 'system' }) {
  if (!isConfigured()) throw new Error('KV not configured');
  const key = `user:${username.toLowerCase()}`;
  await kvPipeline([
    ['HSET', key, 'username', username, 'password', password, 'isAdmin', isAdmin ? 'true' : 'false', 'createdBy', createdBy, 'createdAt', new Date().toISOString()],
    ['SADD', 'users:index', username.toLowerCase()],
  ]);
}

async function deleteUser(username) {
  if (!isConfigured()) throw new Error('KV not configured');
  await kvPipeline([
    ['DEL', `user:${username.toLowerCase()}`],
    ['SREM', 'users:index', username.toLowerCase()],
  ]);
}

async function listUsers() {
  if (!isConfigured()) return [];
  const index = await kvCommand(['SMEMBERS', 'users:index']);
  if (!index || !index.length) return [];
  const commands = index.map(u => ['HGETALL', `user:${u}`]);
  const results = await kvPipeline(commands);
  return results.map(r => parseHash(r)).filter(Boolean);
}

async function updateUser(username, fields) {
  if (!isConfigured()) throw new Error('KV not configured');
  const key = `user:${username.toLowerCase()}`;
  const args = ['HSET', key];
  if (fields.password !== undefined) args.push('password', fields.password);
  if (fields.isAdmin !== undefined) args.push('isAdmin', fields.isAdmin ? 'true' : 'false');
  await kvCommand(args);
}

module.exports = { isConfigured, getUser, setUser, deleteUser, listUsers, updateUser };
