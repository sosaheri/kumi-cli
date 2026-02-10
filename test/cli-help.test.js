const child = require('child_process');
const path = require('path');

describe('CLI help', () => {
  test('prints help and lists commands', () => {
    const bin = path.join(__dirname, '..', 'bin', 'kumi.js');
    const out = child.execSync(`node "${bin}" --help`, { encoding: 'utf8' });
    expect(out).toMatch(/KUMI CLI - Deployment tool for KUMI/);
    expect(out).toMatch(/wizard/);
    expect(out).toMatch(/create <name>/);
  }, 10000);
});
