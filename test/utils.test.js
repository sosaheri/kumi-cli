const fs = require('fs');
const path = require('path');
const os = require('os');
const { readJsonSafe } = require('../lib/utils');

describe('readJsonSafe', () => {
  test('returns default and creates backup for invalid JSON', () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'kumi-test-'));
    const p = path.join(tmp, 'sections.json');
    fs.writeFileSync(p, '{ invalid json,,,', 'utf8');
    const def = { hello: 'world' };
    const res = readJsonSafe(p, def);
    expect(res).toEqual(def);
    const backups = fs.readdirSync(tmp).filter(f => f.includes('corrupt'));
    expect(backups.length).toBeGreaterThan(0);
  });

  test('parses valid json', () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'kumi-test-'));
    const p = path.join(tmp, 'sections.json');
    fs.writeFileSync(p, JSON.stringify({ a: 1 }), 'utf8');
    const res = readJsonSafe(p, {});
    expect(res).toEqual({ a: 1 });
  });
});
