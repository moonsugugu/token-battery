const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const MINUTE = 60000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;
const NOW = new Date('2026-10-01T12:00:00+09:00').getTime();

function renderer(timeBasis = 'remaining') {
  const elements = new Map();
  const context = vm.createContext({
    Date: class extends Date { static now() { return NOW; } },
    window: { widget: {} },
    document: { getElementById(id) {
      if (!elements.has(id)) elements.set(id, { innerHTML: '', classList: { toggle() {} } });
      return elements.get(id);
    } },
    getComputedStyle: () => ({ getPropertyValue: () => '#888' }),
    charState: () => 'fresh',
    drawHeroSprite: () => '',
    drawCharacter: () => '',
    renderCost() {},
    fit() {},
  });
  const root = path.join(__dirname, '..', 'renderer');
  vm.runInContext(fs.readFileSync(path.join(root, 'i18n.js'), 'utf8'), context);
  vm.runInContext(fs.readFileSync(path.join(root, 'companions.js'), 'utf8'), context);
  const app = fs.readFileSync(path.join(root, 'app.js'), 'utf8');
  // Load the actual formatting and rendering functions without starting Electron or polling real accounts.
  vm.runInContext(app.slice(0, app.indexOf('// ---------- 사용량 알림')), context);
  const run = (code) => vm.runInContext(code, context);
  run(`store = { timeBasis: ${JSON.stringify(timeBasis)}, theme: 'cyber', costOn: false };`);
  return { run, elements };
}

test('the smallest mode keeps rounded-up days for both time settings', () => {
  for (const basis of ['clock', 'remaining']) {
    const { run } = renderer(basis);
    assert.equal(run(`weeklyResetDisplay(${NOW + 2 * DAY + HOUR}, { compact: true })`), '3일');
    assert.equal(run(`weeklyResetDisplay(${NOW + HOUR}, { compact: true })`), '1일');
    assert.equal(run(`weeklyResetDisplay(${NOW + 30000}, { compact: true })`), '1분');
  }
});

test('detailed countdown includes days, hours and minutes', () => {
  const { run } = renderer();
  assert.equal(run(`weeklyResetDisplay(${NOW + 2 * DAY + 3 * HOUR + 15 * MINUTE})`), '2일 03시간 15분 남음');
  assert.equal(run(`weeklyResetDisplay(${NOW + 3 * HOUR + 15 * MINUTE})`), '03시간 15분 남음');
  assert.equal(run(`weeklyResetDisplay(${NOW + 5 * MINUTE})`), '00시간 05분 남음');
});

test('day and minute boundaries never show 0 days or 0 minutes before reset', () => {
  const { run } = renderer();
  assert.equal(run(`weeklyResetDisplay(${NOW + DAY})`), '1일 00시간 00분 남음');
  assert.equal(run(`weeklyResetDisplay(${NOW + DAY - MINUTE})`), '23시간 59분 남음');
  assert.equal(run(`weeklyResetDisplay(${NOW + 1})`), '00시간 01분 남음');
  assert.equal(run(`weeklyResetDisplay(${NOW})`), '리셋됨');
  assert.equal(run(`weeklyResetDisplay(${NOW - MINUTE})`), '리셋됨');
});

test('clock setting shows remaining days and the local reset time', () => {
  const { run } = renderer('clock');
  const reset = new Date('2026-10-03T22:00:00+09:00').getTime();
  const clock = new Date(reset).toLocaleTimeString('ko', { hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
  assert.equal(run(`weeklyResetDisplay(${reset})`), `3일 남음 · ${clock} 리셋`);
  assert.match(run(`weeklyResetDisplay(${NOW + 3 * HOUR + 15 * MINUTE})`), /^03시간 15분 남음 · .+ 리셋$/);
});

test('unknown and invalid resets show a placeholder', () => {
  const { run } = renderer();
  for (const value of ['null', 'undefined', '0', 'NaN', 'Infinity']) {
    assert.equal(run(`weeklyResetDisplay(${value})`), '–');
  }
});

test('all five languages have localized detailed reset text', () => {
  const { run } = renderer();
  for (const lang of ['ko', 'en', 'ja', 'zh', 'es']) {
    run(`LANG = '${lang}';`);
    for (const basis of ['clock', 'remaining']) {
      run(`store.timeBasis = '${basis}';`);
      const value = run(`weeklyResetDisplay(${NOW + DAY + 3 * HOUR + 15 * MINUTE})`);
      assert.doesNotMatch(value, /weeklyLeft|weeklyClock|\{|\}/);
      if (lang !== 'ko') assert.doesNotMatch(value, /남음|리셋/);
    }
  }
});

test('both services render detailed weekly resets in character, full and recovery views', () => {
  const { run, elements } = renderer();
  run(`usage = { now: ${NOW}, claude: { ok: true, fiveHour: { percent: 10, resetsAt: ${NOW + HOUR} }, weekly: { percent: 40, resetsAt: ${NOW + DAY + 3 * HOUR + 15 * MINUTE} } }, codex: { ok: true, fiveHour: { percent: 20, resetsAt: ${NOW + HOUR} }, weekly: { percent: 60, resetsAt: ${NOW + 5 * MINUTE} } } }; renderUsage(); renderChar(); renderMini();`);
  for (const id of ['crew', 'recover', 'scene']) {
    assert.match(elements.get(id).innerHTML, /1일 03시간 15분 남음/);
    assert.match(elements.get(id).innerHTML, /00시간 05분 남음/);
    assert.match(elements.get(id).innerHTML, /title="/);
  }
  assert.match(elements.get('miniRows').innerHTML, /<em>2일<\/em>/);
  assert.doesNotMatch(elements.get('miniRows').innerHTML, /<em>[^<]*남음/);
  run("store.timeBasis = 'clock'; renderUsage(); renderChar();");
  for (const id of ['crew', 'recover', 'scene']) assert.match(elements.get(id).innerHTML, /남음 · .+ 리셋/);
});
