const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { version } = require('../package.json');

function verifyTag(tag, appVersion) {
  if (!/^v\d+\.\d+\.\d+$/.test(tag || '') || tag !== `v${appVersion}`) {
    throw new Error(`Stable release tag ${tag} must match package.json version v${appVersion}`);
  }
}
function verifyArtifacts(dir, appVersion) {
  const yaml = require('js-yaml');
  const installer = `TokenBattery.Setup.${appVersion}.exe`;
  const metadata = yaml.load(fs.readFileSync(path.join(dir, 'latest.yml'), 'utf8'));
  const file = metadata.files?.find((entry) => entry.url === installer);
  if (metadata.version !== appVersion || !file) throw new Error('latest.yml does not match the installer/version');
  const bytes = fs.readFileSync(path.join(dir, installer));
  if (file.sha512 !== crypto.createHash('sha512').update(bytes).digest('base64') || file.size !== bytes.length) {
    throw new Error('Installer checksum or size does not match latest.yml');
  }
  if (!fs.statSync(path.join(dir, installer + '.blockmap')).size) throw new Error('Empty blockmap');
  const sum = crypto.createHash('sha256').update(bytes).digest('hex');
  fs.writeFileSync(path.join(dir, 'SHA256SUMS.txt'), `${sum}  ${installer}\n`);
}
if (require.main === module) {
  verifyTag(process.env.RELEASE_TAG, version);
  if (process.argv.includes('--artifacts')) verifyArtifacts(path.join(__dirname, '..', 'dist'), version);
  console.log(`Verified v${version}${process.argv.includes('--artifacts') ? ' installer, checksums and update metadata' : ' release tag'}`);
}
module.exports = { verifyTag, verifyArtifacts };
