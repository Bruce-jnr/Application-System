const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const express = require('express');
const jwt = require('jsonwebtoken');

// Stub database access: these checks must never connect to production.
const calls = [];
const db = { query: async (...args) => { calls.push(args); return [[], []]; } };
require.cache[require.resolve('../config/db')] = { exports: db };
process.env.JWT_SECRET = 'test-only-secret-that-is-never-used-in-production';

test('voucher and API-key administration requires an admin JWT', async () => {
  const app = express();
  app.use(express.json());
  app.set('mysqlPool', db);
  app.use('/api/vouchers', require('../routes/voucherRoutes'));
  app.use('/api/vendor', require('../routes/vendorApiRoutes'));
  const server = app.listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  try {
    for (const [method, path] of [['GET', '/api/vouchers'], ['POST', '/api/vouchers'], ['POST', '/api/vendor/generate-api-key']]) {
      const response = await fetch(base + path, { method });
      assert.equal(response.status, 401);
    }
    assert.equal(calls.length, 0);
    const token = jwt.sign({ adminId: 1, userType: 'admin' }, process.env.JWT_SECRET);
    const response = await fetch(base + '/api/vouchers', { headers: { Authorization: `Bearer ${token}` } });
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), []);
    assert.equal(calls.length, 1);
    assert.ok(!calls[0][0].includes('pin_hash'));
    const invalid = await fetch(base + '/api/vouchers', {
      method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ serialNumber: {}, pin: [] }),
    });
    assert.equal(invalid.status, 400);
    assert.equal(calls.length, 1);
  } finally {
    server.closeAllConnections();
    await new Promise(resolve => server.close(resolve));
  }
});

test('production CORS preserves trusted origins and rejects foreign origins', () => {
  const source = fs.readFileSync(require.resolve('../server'), 'utf8');
  const config = source.slice(source.indexOf('const corsOptions ='), source.indexOf('app.use(cors(corsOptions))'));
  const warnings = [];
  const options = vm.runInNewContext(config + '\ncorsOptions;', {
    URL, process: { env: { NODE_ENV: 'production', FRONTEND_URL: 'https://portal.example.com/' } },
    logger: { warn: message => warnings.push(message) },
  });
  for (const origin of [undefined, 'https://nsacoe.edu.gh', 'https://www.nsacoe.edu.gh', 'https://app.nsacoe.edu.gh', 'https://portal.example.com']) {
    options.origin(origin, (error, allowed) => { assert.equal(error, null); assert.equal(allowed, true); });
  }
  for (const origin of ['https://attacker.example', 'null', 'https://nsacoe.edu.gh.attacker.example']) {
    options.origin(origin, error => assert.equal(error.status, 403));
  }
  assert.equal(warnings.length, 3);
  assert.ok(options.allowedHeaders.includes('X-API-Key'));
});

test('admin JWT rejects non-admin and unexpected signing algorithms', () => {
  const auth = require('../middleware/adminJwtAuth');
  for (const token of [
    jwt.sign({ adminId: 1, userType: 'vendor' }, process.env.JWT_SECRET),
    jwt.sign({ adminId: 1, userType: 'admin' }, process.env.JWT_SECRET, { algorithm: 'HS384' }),
  ]) {
    let status;
    const res = { status(value) { status = value; return this; }, json() {} };
    auth({ headers: { authorization: `Bearer ${token}` } }, res, () => assert.fail('Token should be rejected'));
    assert.ok(status === 401 || status === 403);
  }
});
