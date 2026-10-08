const { test } = require('node:test');
const assert = require('node:assert/strict');
const Hotkeys = require('../renderer/hotkeys');

test('new users get F7 visibility and F8 mode cycling', () => {
  assert.deepEqual(Hotkeys.migrate(), { full: 'F7', toggle: 'F8' });
});

test('old default shortcuts move together to the new default pair', () => {
  const old = { toggle: 'F3', full: 'F4' };
  assert.deepEqual(Hotkeys.migrate(old), { full: 'F7', toggle: 'F8' });
  assert.deepEqual(old, { toggle: 'F3', full: 'F4' });
});

test('updates preserve custom shortcuts, disabled keys and partial preferences', () => {
  for (const keys of [
    { toggle: 'Ctrl+Alt+M', full: 'Ctrl+Alt+H' },
    { toggle: '', full: '' },
    { toggle: 'F3', full: 'F9' },
    { toggle: 'F9' },
  ]) {
    assert.deepEqual(Hotkeys.migrate(keys), { ...Hotkeys.defaults, ...keys });
  }
});

test('migration is stable across restarts', () => {
  const keys = Hotkeys.migrate({ toggle: 'F3', full: 'F4' });
  assert.deepEqual(Hotkeys.migrate(keys), keys);
});
