const { test } = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const yaml = require('js-yaml');
const { verifyMacArtifacts } = require('../tools/verify-release.cjs');

function tempDir(t) {
  const root = path.resolve(os.tmpdir());
  const dir = fs.mkdtempSync(path.join(root, 'tokenbattery-release-'));
  t.after(() => {
    const relative = path.relative(root, path.resolve(dir));
    if (relative.startsWith('..') || path.isAbsolute(relative) || !path.basename(dir).startsWith('tokenbattery-release-')) {
      throw new Error(`Unexpected test cleanup path: ${dir}`);
    }
    fs.rmSync(dir, { recursive: true, force: true });
  });
  return dir;
}

test('macOS release verification checks update metadata and writes checksums for both downloads', (t) => {
  const dir = tempDir(t);
  const dmgName = 'TokenBattery-1.3.5-universal.dmg';
  const zipName = 'TokenBattery-1.3.5-universal.zip';
  const dmg = Buffer.from('DMG fixture');
  const zip = Buffer.from('ZIP fixture');
  fs.writeFileSync(path.join(dir, dmgName), dmg);
  fs.writeFileSync(path.join(dir, zipName), zip);
  fs.writeFileSync(path.join(dir, 'latest-mac.yml'), yaml.dump({
    version: '1.3.5',
    files: [{ url: zipName, sha512: crypto.createHash('sha512').update(zip).digest('base64'), size: zip.length }],
  }));

  verifyMacArtifacts(dir, '1.3.5');
  assert.equal(fs.readFileSync(path.join(dir, 'SHA256SUMS-macos.txt'), 'utf8'), [dmgName, zipName]
    .map((name, i) => `${crypto.createHash('sha256').update(i ? zip : dmg).digest('hex')}  ${name}`)
    .join('\n') + '\n');
});

test('macOS release verification rejects update metadata for another version', (t) => {
  const dir = tempDir(t);
  fs.writeFileSync(path.join(dir, 'latest-mac.yml'), yaml.dump({ version: '1.3.4', files: [] }));
  assert.throws(() => verifyMacArtifacts(dir, '1.3.5'), /latest-mac\.yml does not match/);
});
