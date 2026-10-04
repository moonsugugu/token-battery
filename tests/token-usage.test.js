const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');
const { TokenUsage, tokenRecord } = require('../token-usage');

const codex = (total, at, last = 100) => ({ timestamp: new Date(at).toISOString(), type: 'event_msg', payload: { type: 'token_count', info: {
  total_token_usage: { input_tokens: total, output_tokens: 0, cached_input_tokens: total - 10 },
  last_token_usage: { input_tokens: last, output_tokens: 0 },
} } });
const claude = (id, output, at) => ({ timestamp: new Date(at).toISOString(), type: 'assistant', message: { id, content: 'PRIVATE-CONVERSATION', usage: { input_tokens: 5, output_tokens: output, cache_read_input_tokens: 500, cache_creation_input_tokens: 100 } } });
const jsonl = (record) => JSON.stringify(record) + '\n';
const sum = (events) => events.reduce((n, event) => n + event.tokens, 0);

async function setup(t) {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'token-battery-test-'));
  await fs.mkdir(path.join(root, 'claude')); await fs.mkdir(path.join(root, 'codex'));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  return { root, roots: { claude: path.join(root, 'claude'), codex: path.join(root, 'codex') } };
}

test('Codex includes cache/reasoning in its existing counts; Claude cache fields are additive', () => {
  const c = codex(1000, Date.now());
  c.payload.info.total_token_usage.output_tokens = 50;
  c.payload.info.total_token_usage.reasoning_output_tokens = 30;
  assert.equal(tokenRecord('codex', c).total, 1050);
  const a = claude('msg-a', 25, Date.now());
  a.message.usage.output_tokens_details = { thinking_tokens: 10 };
  a.message.usage.iterations = [{ input_tokens: 10000, output_tokens: 10000 }];
  assert.equal(tokenRecord('claude', a).total, 630);
  assert.equal(tokenRecord('claude', { ...a, type: 'user' }), null);
  assert.equal(tokenRecord('codex', { timestamp: 'bad', payload: c.payload }), null);
});

test('incremental Codex reads ignore history, repeats and fork copies; partial lines wait for completion', async (t) => {
  const { roots } = await setup(t);
  const file = path.join(roots.codex, 'session.jsonl');
  const now = Date.now();
  await fs.writeFile(file, jsonl(codex(1000, now - 10000)));
  const tracker = await new TokenUsage(roots).start(); t.after(() => tracker.close());
  const at = Date.now() + 10;
  await fs.appendFile(file, jsonl(codex(1110, at, 110)) + jsonl(codex(1110, at + 1, 110)));
  tracker.dirty.set(file, 'codex');
  assert.equal(sum(await tracker.poll()), 110);
  assert.equal(sum(await tracker.poll()), 0);
  const fork = path.join(roots.codex, 'fork.jsonl');
  await fs.writeFile(fork, jsonl(codex(1000, now - 10000)) + jsonl(codex(1110, at, 110)) + jsonl(codex(1310, at + 2, 200)));
  tracker.dirty.set(fork, 'codex'); assert.equal(sum(await tracker.poll()), 200);
  const line = jsonl(codex(1410, at + 3));
  await fs.appendFile(fork, line.slice(0, 40)); tracker.dirty.set(fork, 'codex'); assert.equal(sum(await tracker.poll()), 0);
  await fs.appendFile(fork, line.slice(40)); tracker.dirty.set(fork, 'codex'); assert.equal(sum(await tracker.poll()), 100);
  assert.equal(tracker.ledger.totals.codex, 410);
});

test('Claude streaming fragments/copies only add changes once and store no conversation content', async (t) => {
  const { roots } = await setup(t);
  const tracker = await new TokenUsage(roots).start(); t.after(() => tracker.close());
  const file = path.join(roots.claude, 'assistant.jsonl'), at = Date.now() + 10;
  await fs.writeFile(file, jsonl(claude('msg-a', 20, at)) + jsonl(claude('msg-a', 20, at + 1)) + jsonl(claude('msg-a', 40, at + 2)));
  tracker.dirty.set(file, 'claude'); assert.equal(sum(await tracker.poll()), 645);
  const copy = path.join(roots.claude, 'copy.jsonl');
  await fs.writeFile(copy, jsonl(claude('msg-a', 40, at + 2))); tracker.dirty.set(copy, 'claude');
  assert.equal(sum(await tracker.poll()), 0);
  assert.doesNotMatch(JSON.stringify(tracker.ledger), /PRIVATE-CONVERSATION|msg-a|assistant\.jsonl/);
});

test('restart excludes offline tokens, and truncation/replay does not double count', async (t) => {
  const { roots } = await setup(t);
  const file = path.join(roots.codex, 'session.jsonl'), now = Date.now();
  await fs.writeFile(file, jsonl(codex(1000, now - 1000)));
  const first = await new TokenUsage(roots).start(); t.after(() => first.close());
  await fs.appendFile(file, jsonl(codex(1100, Date.now() + 1))); first.dirty.set(file, 'codex');
  assert.equal(sum(await first.poll()), 100); first.close();
  await fs.appendFile(file, jsonl(codex(1800, Date.now() + 2, 700)));
  const second = await new TokenUsage(roots, JSON.parse(JSON.stringify(first.ledger))).start(); t.after(() => second.close());
  const at = Date.now() + 20;
  await fs.appendFile(file, jsonl(codex(1900, at))); second.dirty.set(file, 'codex');
  assert.equal(sum(await second.poll()), 100);
  await fs.writeFile(file, jsonl(codex(1900, at))); second.dirty.set(file, 'codex');
  assert.equal(sum(await second.poll()), 0);
  await fs.appendFile(file, jsonl(codex(2000, at + 1))); second.dirty.set(file, 'codex');
  assert.equal(sum(await second.poll()), 100);
  assert.equal(second.ledger.totals.codex, 300);
});
