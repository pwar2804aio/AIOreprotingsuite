const { validateSession } = require('./_auth');

// Upstash Redis REST API — same as _kv.js but for commission records
const KV_URL = () => process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
const KV_TOKEN = () => process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;

async function kvCommand(args) {
  const res = await fetch(KV_URL(), {
    method: 'POST',
    headers: { Authorization: `Bearer ${KV_TOKEN()}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(args),
  });
  const data = await res.json();
  return data.result;
}

const COMM_KEY = 'commission_payments'; // Redis hash: dealId → JSON payment record

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(204).end();

  const user = validateSession(req.headers['authorization']);
  if (!user) return res.status(401).json({ error: 'Unauthorized' });

  if (!KV_URL() || !KV_TOKEN()) return res.status(500).json({ error: 'Redis not configured' });

  // GET — return all commission payment records
  if (req.method === 'GET') {
    const raw = await kvCommand(['HGETALL', COMM_KEY]);
    const payments = {};
    if (raw && raw.length) {
      for (let i = 0; i < raw.length; i += 2) {
        try { payments[raw[i]] = JSON.parse(raw[i + 1]); } catch (_) {}
      }
    }
    return res.status(200).json(payments);
  }

  // POST — save/update a commission payment record
  if (req.method === 'POST') {
    const { dealId, amountPaid, datePaid, isPrepay, status, notes } = req.body || {};
    if (!dealId) return res.status(400).json({ error: 'dealId required' });

    const record = {
      amountPaid: parseFloat(amountPaid) || 0,
      datePaid: datePaid || null,
      isPrepay: !!isPrepay,
      status: status || 'unpaid', // unpaid, prepaid, paid, clawback
      notes: notes || '',
      updatedAt: new Date().toISOString(),
      updatedBy: user.username,
    };
    await kvCommand(['HSET', COMM_KEY, String(dealId), JSON.stringify(record)]);
    return res.status(200).json({ ok: true, dealId, record });
  }

  // DELETE — remove a commission payment record
  if (req.method === 'DELETE') {
    const { dealId } = req.body || {};
    if (!dealId) return res.status(400).json({ error: 'dealId required' });
    await kvCommand(['HDEL', COMM_KEY, String(dealId)]);
    return res.status(200).json({ ok: true });
  }

  return res.status(405).json({ error: 'Method not allowed' });
};
