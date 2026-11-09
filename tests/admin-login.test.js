const test = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const session = require('express-session');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const fs = require('node:fs');
const vm = require('node:vm');

require.cache[require.resolve('../config/db')] = { exports: {} };
process.env.JWT_SECRET = 'test-only-admin-login-secret';

test('admin login persists session, returns usable JWT, and logout ends page access', async () => {
  const hash = await bcrypt.hash('test-password', 4);
  const app = express();
  app.use(express.json());
  app.use(session({ secret: 'test-only-session-secret', resave: false, saveUninitialized: false }));
  app.set('mysqlPool', { async query() { return [[{ id: 9, username: 'admin', name: 'Test Admin', password_hash: hash }]]; } });
  app.use('/api/admin', require('../routes/adminRoutes'));
  // Register the real dashboard page route and guard without starting server.js.
  const source = fs.readFileSync(require.resolve('../server'), 'utf8');
  const guard = source.slice(source.indexOf('const isAdmin ='), source.indexOf('const isVendor ='));
  const route = source.slice(source.indexOf("app.get('/admin/dashboard'"), source.indexOf("app.get('/admin/vouchers'"));
  vm.runInNewContext(guard + route, { app, logger: { debug() {} }, path: require('node:path'), __dirname: require('node:path').resolve(__dirname, '..') });
  const server = app.listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  try {
    const denied = await fetch(base + '/admin/dashboard');
    assert.equal(denied.status, 403);
    const bad = await fetch(base + '/api/admin/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username: 'admin', password: 'wrong' }) });
    assert.equal(bad.status, 401);
    assert.equal(bad.headers.get('set-cookie'), null);
    const login = await fetch(base + '/api/admin/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username: 'admin', password: 'test-password' }) });
    assert.equal(login.status, 200);
    const data = await login.json();
    assert.equal(jwt.verify(data.token, process.env.JWT_SECRET).adminId, 9);
    const cookie = login.headers.get('set-cookie').split(';')[0];
    const page = await fetch(base + '/admin/dashboard', { headers: { Cookie: cookie } });
    assert.equal(page.status, 200);
    const api = await fetch(base + '/api/admin/me', { headers: { Authorization: `Bearer ${data.token}` } });
    assert.equal(api.status, 200);
    const logout = await fetch(base + '/api/admin/logout', { method: 'POST', headers: { Cookie: cookie } });
    assert.equal(logout.status, 200);
    const afterLogout = await fetch(base + '/admin/dashboard', { headers: { Cookie: cookie } });
    assert.equal(afterLogout.status, 403);
  } finally {
    server.closeAllConnections();
    await new Promise(resolve => server.close(resolve));
  }
});

test('login page stores the JWT before navigating to dashboard', async () => {
  const html = fs.readFileSync(require.resolve('../views/admin-login.html'), 'utf8');
  const script = html.match(/<script>([\s\S]*?)<\/script>/)[1];
  let submit;
  const events = [];
  const button = { textContent: 'Login', disabled: false };
  const context = {
    console: { log() {}, error() {} }, alert(message) { assert.fail(message); },
    document: { getElementById(id) {
      if (id === 'loginForm') return { addEventListener(event, callback) { submit = callback; } };
      return { value: id === 'username' ? 'admin' : 'test-password' };
    } },
    localStorage: { setItem(key, value) { events.push([key, value]); } },
    window: { location: { origin: 'https://app.nsacoe.edu.gh', set href(value) { events.push(['navigate', value]); } } },
    fetch: async () => ({ ok: true, status: 200, headers: new Map(), json: async () => ({ success: true, token: 'test-token' }) }),
  };
  vm.runInNewContext(script, context);
  await submit({ preventDefault() {}, target: { querySelector() { return button; } } });
  assert.deepEqual(events, [['admin_token', 'test-token'], ['navigate', '/admin/dashboard']]);
});
