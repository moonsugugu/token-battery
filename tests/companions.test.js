const { test } = require('node:test');
const assert = require('node:assert/strict');
const C = require('../renderer/companions');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const WEEK = 7 * 86400000;
const START = 1800000000000;
function sample(percent, time, reset = START + WEEK, extra = {}) {
  return { claude: { ok: true, source: 'oauth', updatedAt: time, weekly: { percent, resetsAt: reset }, ...extra } };
}
const options = { theme: 'mascot', claude: true, codex: true };
const points = (state, theme = 'mascot', service = 'claude') => C.view(state, theme, service).points;

test('only new automatic usage earns points; repeated polls and downward corrections earn nothing', () => {
  const state = {};
  C.observe(state, sample(40, START), options, START);
  assert.equal(points(state), 0); // Existing usage is a baseline, not a retroactive reward.
  C.observe(state, sample(60, START + 1), options, START + 1);
  C.observe(state, sample(60, START + 1), options, START + 2);
  C.observe(state, sample(60, START + 3), options, START + 3);
  C.observe(state, sample(50, START + 4), options, START + 4);
  C.observe(state, sample(65, START + 5), options, START + 5);
  C.observe(state, sample(95, START + 2), options, START + 6); // Out-of-order response.
  assert.equal(points(state), 25);
});

test('disabled friends, theme switches, restarts and failed/manual readings do not backfill progress', () => {
  let state = {};
  let tick = START;
  const read = (percent, opts = options, extra = {}) => C.observe(state, sample(percent, ++tick, START + WEEK, extra), opts, tick);
  read(0); read(10);
  C.pause(state); // Store settings changed.
  read(40, { ...options, claude: false });
  read(60); read(65);
  assert.equal(points(state), 15);
  C.pause(state);
  read(75, { ...options, theme: 'garden' });
  read(80, { ...options, theme: 'garden' });
  assert.equal(points(state, 'garden'), 5);
  state = JSON.parse(JSON.stringify(state));
  C.pause(state); // The actual loadStore restart path.
  read(90); read(92);
  assert.equal(points(state), 17);
  read(94, options, { manual: true, source: 'manual' });
  read(96); read(97);
  assert.equal(points(state), 18);
  C.observe(state, { claude: { ok: false } }, options, ++tick);
  read(99); read(100);
  assert.equal(points(state), 19);
});

test('weekly resets preserve achievements and 30 days of full quota unlocks soulmate', () => {
  const state = {};
  let time = START;
  let reset = START + WEEK;
  C.observe(state, sample(0, time, reset), options, time);
  const events = [];
  for (let week = 0; week < 4; week++) {
    events.push(...C.observe(state, sample(100, ++time, reset), options, time));
    time = reset + 1;
    reset += WEEK;
    C.observe(state, sample(0, time, reset), options, time);
  }
  assert.equal(points(state), 400);
  assert.equal(C.view(state, 'mascot', 'claude').unlocked, 3);
  events.push(...C.observe(state, sample(100 * 2 / 7, ++time, reset), options, time));
  assert.equal(C.view(state, 'mascot', 'claude').unlocked, 4);
  assert.equal(events.at(-1).to, 4);
  assert.equal(C.view(state, 'mascot', 'claude').progress, 100);
});

test('first read after an observed reset credits only the current window, not missing weeks', () => {
  const state = {};
  C.observe(state, sample(80, START), options, START);
  const now = START + 3 * WEEK;
  C.observe(state, sample(12, now, now + WEEK), options, now);
  assert.equal(points(state), 12);
  C.observe(state, sample(12, now + 1, now + WEEK), options, now + 1);
  assert.equal(points(state), 12);
});

test('five-hour fallback is weighted once and switching window sources starts a baseline', () => {
  const state = {};
  const read = (percent, now) => C.observe(state, sample(0, now, START + WEEK, {
    weekly: null, fiveHour: { percent, resetsAt: START + 5 * 3600000 },
  }), options, now);
  read(0, START); read(100, START + 1);
  assert.ok(Math.abs(points(state) - 100 * 5 / 168) < 1e-10);
  C.observe(state, sample(50, START + 2), options, START + 2);
  C.observe(state, sample(60, START + 3), options, START + 3);
  assert.ok(Math.abs(points(state) - (10 + 100 * 5 / 168)) < 1e-10);
});

test('unlocked lower looks stay selectable while earning and cannot unlock another friend', () => {
  const state = {};
  C.observe(state, sample(0, START), options, START);
  C.observe(state, sample(75, START + 1), options, START + 1);
  assert.equal(C.select(state, 'mascot', 'claude', 1), true);
  assert.equal(C.select(state, 'mascot', 'claude', 4), false);
  assert.equal(C.select(state, 'mascot', 'codex', 1), false);
  assert.equal(C.select(state, 'garden', 'claude', 1), false);
  assert.equal(C.select(state, 'unknown', 'claude', 0), false);
  C.observe(state, sample(100, START + 2), options, START + 2);
  assert.equal(C.view(state, 'mascot', 'claude').selected, 1);
  assert.equal(C.select(state, 'mascot', 'claude', null), true);
  assert.equal(C.view(state, 'mascot', 'claude').selected, 2);
});

test('invalid or expired readings are not rewarded; both services earn independently', () => {
  const state = {};
  C.observe(state, sample(0, START), options, START);
  for (const percent of [NaN, Infinity, -1, 110]) C.observe(state, sample(percent, START + 1), options, START + 1);
  C.observe(state, sample(50, START + 2, START - 1), options, START + 2);
  const data = sample(60, START + 3);
  data.codex = { ...data.claude, source: 'codex-log' };
  C.observe(state, data, options, START + 3);
  data.claude = { ...data.claude, updatedAt: START + 4, weekly: { ...data.claude.weekly, percent: 65 } };
  data.codex = { ...data.codex, updatedAt: START + 4, weekly: { ...data.codex.weekly, percent: 80 } };
  C.observe(state, data, options, START + 4);
  assert.equal(points(state), 5);
  assert.equal(points(state, 'mascot', 'codex'), 20);
});

test('all 100 theme/service/stage combinations preserve animation and have distinct art', () => {
  const context = vm.createContext({});
  vm.runInContext(fs.readFileSync(path.join(__dirname, '../renderer/characters.js'), 'utf8'), context);
  for (const theme of C.themes) {
    for (const service of ['claude', 'codex']) {
      const designs = new Set();
      for (let rank = 0; rank < 5; rank++) {
        const html = vm.runInContext(`drawCharacter('${theme}', '${service}', 'tired', null, ${rank})`, context);
        assert.match(html, new RegExp(`crew-animation/${theme}-${service}.png`));
        assert.match(html, /usage-sprite st-tired/);
        if (rank) assert.match(html, new RegExp(`bond-art-${rank}`));
        designs.add(html);
      }
      assert.equal(designs.size, 5);
    }
  }
});
