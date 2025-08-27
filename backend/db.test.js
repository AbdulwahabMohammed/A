const test = require('node:test');
const assert = require('node:assert');

// Stub mysql.createPool before requiring the module
const mysql = require('mysql2/promise');
mysql.createPool = () => ({ query: async () => {} });

test('skips DB1 pool and warns when DB1 env vars are missing', async () => {
  const originalEnv = { ...process.env };
  delete process.env.DB1_HOST;
  delete process.env.DB1_DATABASE;
  delete process.env.DB1_USER;
  delete process.env.DB1_PASSWORD;

  let warning;
  const originalWarn = console.warn;
  console.warn = (msg) => {
    warning = msg;
  };

  delete require.cache[require.resolve('./db.js')];
  const { pools } = require('./db.js');

  console.warn = originalWarn;
  Object.assign(process.env, originalEnv);

  assert.strictEqual(pools.length, 2);
  assert.ok(warning.includes('Missing DB1 env variables'));
});
