const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

// Execute the actual registered submission handler without starting the server,
// loading environment credentials, or opening a database connection.
function submission({ failure, invalidVoucher, smsFailure } = {}) {
  const events = [];
  let handler;
  const connection = {
    async beginTransaction() { events.push('begin'); if (failure === 'begin') throw Error('begin failed'); },
    async execute(sql) {
      events.push(sql.startsWith('SELECT') ? 'voucher' : sql.startsWith('INSERT') ? 'applicant' : 'used');
      if (sql.startsWith('SELECT')) return [invalidVoucher ? [] : [{ serial_number: 'NSCE25123456' }]];
      return [{ insertId: 42 }];
    },
    async query(sql) { events.push('documents'); if (failure === 'documents') throw Error('write failed'); return [[]]; },
    async commit() { events.push('commit'); if (failure === 'commit') throw Error('commit failed'); },
    async rollback() { events.push('rollback'); },
    release() { events.push('release'); },
  };
  const source = fs.readFileSync(require.resolve('../server'), 'utf8').replace(/\r\n/g, '\n');
  const start = source.indexOf("app.post(\n  '/api/applications',");
  assert.ok(start >= 0);
  vm.runInNewContext(source.slice(start, source.indexOf('// Routes', start)), {
    app: { post(path, ...handlers) { handler = handlers.at(-1); } },
    upload: { fields() {} },
    pool: { async getConnection() { return connection; } },
    logger: { info() {}, debug() {}, error() { events.push('error'); } },
    smsService: {
      getApplicationReceivedMessage(name, serial) { assert.equal(serial, 'NSCE25123456'); return name; },
      async sendSMS(phone) {
        events.push('sms');
        assert.equal(phone, '0241234567');
        assert.ok(events.indexOf('commit') < events.indexOf('release'));
        assert.ok(events.indexOf('release') < events.indexOf('sms'));
        if (smsFailure === 'throw') throw Error('provider unavailable');
        return { success: !smsFailure, error: 'provider unavailable' };
      },
    },
  });
  const res = { code: 200, status(code) { this.code = code; return this; }, json(body) { this.body = body; events.push('response'); return this; } };
  const req = {
    session: { voucherId: 1 },
    body: { firstName: 'Test', lastName: 'Applicant', phone: ['0241234567'] },
    files: { photo: [{ originalname: 'photo.png', mimetype: 'image/png', buffer: Buffer.from('test') }] },
  };
  return { run: () => handler(req, res), res, events };
}

test('submission commits and releases before SMS, preserving the response', async () => {
  const scenario = submission();
  await scenario.run();
  assert.equal(scenario.res.code, 200);
  assert.equal(JSON.stringify(scenario.res.body), JSON.stringify({ success: true, applicantId: 42, redirectUrl: '/application-success?ref=42' }));
  assert.deepEqual(scenario.events, ['begin', 'voucher', 'applicant', 'documents', 'used', 'commit', 'release', 'sms', 'response']);
});

for (const failure of ['begin', 'documents', 'commit']) {
  test(`${failure} failure releases the connection and sends no SMS`, async () => {
    const scenario = submission({ failure });
    await scenario.run();
    assert.equal(scenario.res.code, 500);
    assert.ok(scenario.events.includes('rollback'));
    assert.equal(scenario.events.filter(event => event === 'release').length, 1);
    assert.ok(!scenario.events.includes('sms'));
  });
}

test('invalid voucher preserves 400 response and sends no SMS', async () => {
  const scenario = submission({ invalidVoucher: true });
  await scenario.run();
  assert.equal(scenario.res.code, 400);
  assert.ok(scenario.events.includes('release'));
  assert.ok(!scenario.events.includes('sms'));
});

for (const smsFailure of ['throw', 'result']) {
  test(`SMS ${smsFailure} failure preserves saved application success`, async () => {
    const scenario = submission({ smsFailure });
    await scenario.run();
    assert.equal(scenario.res.code, 200);
    assert.equal(scenario.res.body.success, true);
    assert.ok(!scenario.events.includes('rollback'));
    assert.ok(scenario.events.includes('error'));
  });
}
