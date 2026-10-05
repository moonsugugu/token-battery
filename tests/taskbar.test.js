const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { taskbarBounds } = require('../taskbar');

test('taskbar stacking recovers without activating or showing a deliberately hidden window', () => {
  const source = fs.readFileSync(path.join(__dirname, '../main.js'), 'utf8');
  const calls = [];
  let visible = true, minimized = false;
  const win = { isDestroyed: () => false, isVisible: () => visible, isMinimized: () => minimized, moveTop: () => calls.push('raise') };
  const context = vm.createContext({ win, store: { mode: 'taskbar' }, taskbarMenuOpen: false });
  vm.runInContext(source.slice(source.indexOf('function raiseTaskbar()'), source.indexOf('function placeTaskbar()')), context);
  vm.runInContext('raiseTaskbar();raiseTaskbar();', context);
  assert.deepEqual(calls, ['raise', 'raise']);
  vm.runInContext('taskbarMenuOpen=true;raiseTaskbar();taskbarMenuOpen=false;', context);
  visible = false; vm.runInContext('raiseTaskbar()', context);
  visible = true; minimized = true; vm.runInContext('raiseTaskbar()', context);
  minimized = false; vm.runInContext("store.mode='mini';raiseTaskbar()", context);
  assert.equal(calls.length, 2);
  assert.ok(source.includes("['show', 'restore', 'blur']"));
});

test('taskbar rows center beside the notification area and remain visible with auto-hide', () => {
  const display = { bounds: { x: 0, y: 0, width: 2560, height: 1440 }, workArea: { x: 0, y: 0, width: 2560, height: 1392 } };
  const layout = { bar: { x: 0, y: 1392, width: 2560, height: 48 }, notify: { x: 2314, y: 1392, width: 246, height: 48 } };
  assert.deepEqual(taskbarBounds(display, 172, 40, layout), { x: 2136, y: 1396, width: 172, height: 40 });
  assert.equal(taskbarBounds(display, 172, 23, layout).y, 1405);
  const hidden = { ...display, workArea: { ...display.bounds } };
  const result = taskbarBounds(hidden, 172, 40, { ...layout, bar: { ...layout.bar, y: 1438 } });
  assert.equal(result.y, 1394);
  const small = taskbarBounds({ bounds: { x: -800, y: 0, width: 800, height: 600 }, workArea: { x: -800, y: 0, width: 800, height: 600 } }, 172, 40);
  assert.ok(small.x >= -800 && small.x + small.width <= 0);
});

test('real taskbar rendering uses only enabled services, live percentages, selected basis and unknown placeholders', () => {
  const elements = new Map();
  const context = vm.createContext({ window: { widget: {} }, document: { getElementById(id) { if (!elements.has(id)) elements.set(id, { innerHTML: '' }); return elements.get(id); } }, fit() {} });
  const dir = path.join(__dirname, '../renderer');
  vm.runInContext(fs.readFileSync(path.join(dir, 'i18n.js'), 'utf8'), context);
  vm.runInContext(fs.readFileSync(path.join(dir, 'companions.js'), 'utf8'), context);
  const source = fs.readFileSync(path.join(dir, 'app.js'), 'utf8');
  vm.runInContext(source.slice(0, source.indexOf('// ---------- 캐릭터 모드 ----------')), context);
  const run = (js) => vm.runInContext(js, context);
  run("store={basis:'remain'};usage={claude:{ok:true,fiveHour:{percent:22},weekly:{percent:50}},codex:{ok:true,fiveHour:{percent:70},weekly:{percent:100}}};renderTaskbar();");
  const html = () => elements.get('taskbarRows').innerHTML;
  assert.equal((html().match(/class="taskbar-row"/g) || []).length, 2);
  assert.match(html(), /78%/); assert.match(html(), /30%/); assert.match(html(), /0%/);
  run("store.showClaude=false;renderTaskbar();");
  assert.equal((html().match(/class="taskbar-row"/g) || []).length, 1);
  assert.doesNotMatch(html(), /Claude/);
  run("store.basis='used';renderTaskbar();"); assert.match(html(), /70%/);
  run("usage.codex={ok:false};renderTaskbar();"); assert.match(html(), /–%/); assert.doesNotMatch(html(), /NaN|undefined/);
  run("store.showCodex=false;renderTaskbar();"); assert.match(html(), /taskbar-empty/);
  for (const lang of ['ko','en','ja','zh','es']) { run(`LANG='${lang}';`); assert.ok(run("t('taskbarMode')") !== 'taskbarMode'); }
});
