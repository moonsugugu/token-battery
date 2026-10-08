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
function verifyMacArtifacts(dir, appVersion) {
  const yaml = require('js-yaml');
  const dmg = `TokenBattery-${appVersion}-universal.dmg`;
  const zip = `TokenBattery-${appVersion}-universal.zip`;
  const metadata = yaml.load(fs.readFileSync(path.join(dir, 'latest-mac.yml'), 'utf8'));
  const file = metadata.files?.find((entry) => entry.url === zip);
  if (metadata.version !== appVersion || !file) throw new Error('latest-mac.yml does not match the universal ZIP/version');
  const zipBytes = fs.readFileSync(path.join(dir, zip));
  if (file.sha512 !== crypto.createHash('sha512').update(zipBytes).digest('base64') || file.size !== zipBytes.length) {
    throw new Error('Universal ZIP checksum or size does not match latest-mac.yml');
  }
  const sums = [dmg, zip].map((name) => {
    const bytes = fs.readFileSync(path.join(dir, name));
    if (!bytes.length) throw new Error(`Empty macOS artifact: ${name}`);
    return `${crypto.createHash('sha256').update(bytes).digest('hex')}  ${name}`;
  });
  fs.writeFileSync(path.join(dir, 'SHA256SUMS-macos.txt'), `${sums.join('\n')}\n`);
}
if (require.main === module) {
  verifyTag(process.env.RELEASE_TAG, version);
  if (process.argv.includes('--artifacts')) verifyArtifacts(path.join(__dirname, '..', 'dist'), version);
  if (process.argv.includes('--mac-artifacts')) verifyMacArtifacts(path.join(__dirname, '..', 'dist'), version);
  const checks = process.argv.includes('--artifacts') ? 'Windows installer' : process.argv.includes('--mac-artifacts') ? 'universal macOS artifacts' : 'release tag';
  console.log(`Verified v${version} ${checks}`);
}
module.exports = { verifyTag, verifyArtifacts, verifyMacArtifacts };
