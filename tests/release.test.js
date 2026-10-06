const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const crypto = require('node:crypto');
const { verifyTag, verifyArtifacts } = require('../tools/verify-release.cjs');

test('release rejects mismatched versions and prerelease tags', () => {
  verifyTag('v1.3.2', '1.3.2');
  for (const tag of ['v1.3.1', '1.3.2', 'v1.3.2-beta.1', undefined]) assert.throws(() => verifyTag(tag, '1.3.2'));
});
test('release verifies metadata, installer integrity and blockmap before publishing', (t) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'token-battery-release-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  const filename = 'TokenBattery.Setup.1.3.2.exe';
  const bytes = Buffer.from('installer test fixture');
  const sum = crypto.createHash('sha512').update(bytes).digest('base64');
  fs.writeFileSync(path.join(dir, filename), bytes);
  fs.writeFileSync(path.join(dir, filename + '.blockmap'), 'blockmap');
  fs.writeFileSync(path.join(dir, 'latest.yml'), `version: 1.3.2\nfiles:\n  - url: ${filename}\n    sha512: ${sum}\n    size: ${bytes.length}\n`);
  verifyArtifacts(dir, '1.3.2');
  assert.match(fs.readFileSync(path.join(dir, 'SHA256SUMS.txt'), 'utf8'), /^[a-f0-9]{64}  TokenBattery/);
  assert.throws(() => verifyArtifacts(dir, '1.3.3'));
  fs.writeFileSync(path.join(dir, filename), 'corrupted installer');
  assert.throws(() => verifyArtifacts(dir, '1.3.2'), /checksum or size/);
  fs.writeFileSync(path.join(dir, filename), bytes);
  fs.unlinkSync(path.join(dir, filename + '.blockmap'));
  assert.throws(() => verifyArtifacts(dir, '1.3.2'));
});
