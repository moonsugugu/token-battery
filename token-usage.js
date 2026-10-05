// Read only token metadata from local JSONL logs. Conversation content never leaves this PC.
const fs = require('node:fs/promises');
const { watch, createReadStream } = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const count = (n) => Number.isSafeInteger(n) && n >= 0 ? n : 0;

function tokenRecord(service, record) {
  const at = Date.parse(record.timestamp);
  if (!Number.isFinite(at)) return null;
  if (service === 'codex') {
    const info = record.payload?.type === 'token_count' && record.payload.info;
    if (!info?.total_token_usage || !info.last_token_usage) return null;
    // Cached input is already in input_tokens; reasoning is already in output_tokens.
    const total = count(info.total_token_usage.input_tokens) + count(info.total_token_usage.output_tokens);
    const last = count(info.last_token_usage.input_tokens) + count(info.last_token_usage.output_tokens);
    return { at, total, last, id: `codex:${at}:${total}` };
  }
  const usage = record.type === 'assistant' && record.message?.usage;
  if (!usage || !record.message.id) return null;
  // Anthropic's cache read/write counts are separate from ordinary input_tokens.
  const total = count(usage.input_tokens) + count(usage.output_tokens)
    + count(usage.cache_creation_input_tokens) + count(usage.cache_read_input_tokens);
  return { at, total, id: `claude:${record.message.id}` };
}

class TokenUsage {
  constructor(roots, ledger = {}) {
    this.roots = roots;
    this.ledger = ledger;
    ledger.seen ||= {};
    ledger.totals ||= { claude: 0, codex: 0 };
    ledger.lastSeen ||= {};
    this.files = new Map();
    this.available = { claude: false, codex: false };
    this.dirty = new Map();
    this.watchers = new Map();
    this.startedAt = Date.now();
    this.lastDiscovery = 0;
    this.pending = null;
    this.closed = false;
  }
  async start() {
    // Rebase at EOF on every restart: never award tokens used while the widget was closed.
    await this.discover(true);
    return this;
  }
  async discover(baseline = false) {
    this.lastDiscovery = Date.now();
    for (const [service, root] of Object.entries(this.roots)) {
      try {
        if (!this.watchers.has(service)) {
          const watcher = watch(root, { recursive: true }, (_event, name) => {
            if (!name?.toString().endsWith('.jsonl')) return;
            const file = path.resolve(root, name.toString());
            if (file.startsWith(path.resolve(root) + path.sep)) this.dirty.set(file, service);
          });
          watcher.on('error', () => { watcher.close(); this.watchers.delete(service); });
          this.watchers.set(service, watcher);
        }
        const entries = await fs.readdir(root, { recursive: true, withFileTypes: true });
        for (const entry of entries) {
          if (!entry.isFile() || !entry.name.endsWith('.jsonl')) continue;
          const file = path.join(entry.parentPath, entry.name);
          if (this.files.has(file)) continue;
          if (baseline) {
            const stat = await fs.stat(file);
            this.files.set(file, { service, offset: stat.size, total: null, baseline: stat.size });
            this.available[service] = true;
          } else this.dirty.set(file, service);
        }
      } catch (error) {
        if (error.code !== 'ENOENT') this.error = 'read-error';
      }
    }
  }
  async codexBaseline(file, offset) {
    if (!offset) return 0;
    const handle = await fs.open(file, 'r');
    try {
      const start = Math.max(0, offset - 2 * 1024 * 1024);
      const buffer = Buffer.alloc(offset - start);
      await handle.read(buffer, 0, buffer.length, start);
      const lines = buffer.toString('utf8').split('\n');
      for (let i = lines.length - 1; i >= 0; i--) {
        if (!lines[i].includes('token_count')) continue;
        try { const record = tokenRecord('codex', JSON.parse(lines[i])); if (record) return record.total; } catch {}
      }
      return null;
    } finally { await handle.close(); }
  }
  async read(file, service, events) {
    const stat = await fs.stat(file);
    let cursor = this.files.get(file);
    if (!cursor || stat.size < cursor.offset) {
      cursor = { service, offset: 0, total: 0, baseline: 0 };
      this.files.set(file, cursor);
      this.available[service] = true;
    }
    if (stat.size === cursor.offset) return;
    if (service === 'codex' && cursor.baseline && cursor.total === null) cursor.total = await this.codexBaseline(file, cursor.baseline);
    let pending = Buffer.alloc(0);
    for await (const chunk of createReadStream(file, { start: cursor.offset, end: stat.size - 1 })) {
      pending = Buffer.concat([pending, chunk]);
      let newline;
      while ((newline = pending.indexOf(10)) !== -1) {
        const line = pending.subarray(0, newline).toString('utf8');
        pending = pending.subarray(newline + 1);
        cursor.offset += newline + 1;
        if (!line.includes(service === 'codex' ? 'token_count' : 'usage')) continue;
        let record;
        try { record = tokenRecord(service, JSON.parse(line)); } catch { continue; }
        if (!record) continue;
        const id = crypto.createHash('sha256').update(record.id).digest('hex');
        const prev = this.ledger.seen[id];
        let tokens = 0;
        if (service === 'codex') {
          if (cursor.total !== null && !prev) tokens = record.total >= cursor.total ? record.total - cursor.total : record.last;
          cursor.total = record.total;
        } else tokens = Math.max(0, record.total - (prev?.total || 0));
        this.ledger.seen[id] = { total: Math.max(prev?.total || 0, record.total), at: record.at };
        this.ledger.lastSeen[service] = Math.max(this.ledger.lastSeen[service] || 0, record.at);
        if (record.at < this.startedAt || record.at > Date.now() + 60000 || !tokens) continue;
        this.ledger.totals[service] = (this.ledger.totals[service] || 0) + tokens;
        events.push({ service, tokens, at: record.at });
      }
    }
    // An unfinished last line stays unread until its newline arrives.
  }
  async poll() {
    if (this.closed) return [];
    if (this.pending) return this.pending;
    this.pending = (async () => {
      if (Date.now() - this.lastDiscovery > 300000) await this.discover();
      const files = [...this.dirty];
      this.dirty.clear();
      const events = [];
      this.error = null;
      for (const [file, service] of files) {
        try { await this.read(file, service, events); }
        catch (error) { if (error.code !== 'ENOENT') { this.error = 'read-error'; this.dirty.set(file, service); } }
      }
      return events;
    })().finally(() => { this.pending = null; });
    return this.pending;
  }
  status() {
    return Object.fromEntries(['claude', 'codex'].map((service) => [service, {
      available: this.available[service],
      total: this.ledger.totals[service] || 0, lastSeen: this.ledger.lastSeen[service] || null,
      error: this.error,
    }]));
  }
  close() { this.closed = true; for (const watcher of this.watchers.values()) watcher.close(); }
}

module.exports = { TokenUsage, tokenRecord };
