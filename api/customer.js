const fs = require('fs');
const path = require('path');

const CUSTOMERS_FILE = path.join(__dirname, '..', 'data', 'customers.json');

function readCustomers() {
  try { return JSON.parse(fs.readFileSync(CUSTOMERS_FILE, 'utf8')); }
  catch { return []; }
}

module.exports = async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Extract email from query param (Vercel serverless can't do path params like /customer/:email)
  const email = (req.query.email || '').toLowerCase().trim();
  if (!email) {
    return res.status(400).json({ error: 'Email query param required' });
  }

  const customers = readCustomers();
  const customer = customers.find(c => c.email === email && c.status === 'active');

  res.json({
    active: !!customer,
    plan: customer ? customer.plan : null
  });
};
