'use strict';
const fs = require('node:fs/promises');
const path = require('node:path');
const { createHash, randomBytes } = require('node:crypto');
function createAsyncCache({ maxEntries = 128, maxBytes = 16 * 1024 * 1024, ttlMs = 300000, negativeTtlMs = 15000, now = Date.now } = {}) {
  const entries = new Map(), pending = new Map(); let bytes = 0;
  function remove(key) { const row = entries.get(key); if (row) bytes -= row.size; entries.delete(key); }
  function save(key, value) {
    const size = Buffer.isBuffer(value) ? value.length : typeof value === 'string' ? Buffer.byteLength(value) : 0;
    if (size > maxBytes) return;
    remove(key); entries.set(key, { value, size, until: now() + (value === null ? negativeTtlMs : ttlMs) }); bytes += size;
    while (entries.size > maxEntries || bytes > maxBytes) remove(entries.keys().next().value);
  }
  async function get(key, produce) {
    const old = entries.get(key);
    if (old && old.until > now()) { entries.delete(key); entries.set(key, old); return old.value; }
    if (old) remove(key);
    if (pending.has(key)) return pending.get(key);
    const task = Promise.resolve().then(produce).then(value => { save(key, value); return value; }).finally(() => pending.delete(key));
    pending.set(key, task); return task;
  }
  return { get, get size() { return entries.size; }, get bytes() { return bytes; } };
}
function createGalleryCache({ directory, namespace, render, maxFiles = 96, maxDiskBytes = 64 * 1024 * 1024 }) {
  const memory = createAsyncCache({ maxEntries: 48, maxBytes: 24 * 1024 * 1024, ttlMs: 24 * 3600000 });
  let pruning = false;
  async function prune() {
    if (pruning) return; pruning = true;
    try {
      const files = [];
      for (const row of await fs.readdir(directory, { withFileTypes: true })) if (row.isFile() && /^[a-f0-9]{64}\.png$/.test(row.name)) {
        const file = path.join(directory, row.name), stat = await fs.stat(file); files.push({ file, size: stat.size, time: stat.mtimeMs });
      }
      files.sort((a, b) => b.time - a.time); let kept = 0, bytes = 0;
      for (const file of files) { if (kept < maxFiles && bytes + file.size <= maxDiskBytes) { kept++; bytes += file.size; } else await fs.unlink(file.file).catch(() => {}); }
    } finally { pruning = false; }
  }
  async function get(items) {
    const key = createHash('sha256').update(`${namespace}|${items.map(i => i.id).join('|')}`).digest('hex');
    return memory.get(key, async () => {
      const destination = path.join(directory, `${key}.png`);
      try { const bytes = await fs.readFile(destination); if (bytes.length > 32 && bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) return bytes; } catch { /* Disk caching is optional. */ }
      const bytes = await render(items);
      const temporary = `${destination}.${process.pid}.${randomBytes(4).toString('hex')}.tmp`;
      try { await fs.mkdir(directory, { recursive: true }); await fs.writeFile(temporary, bytes); await fs.rename(temporary, destination); void prune().catch(() => {}); }
      catch { await fs.unlink(temporary).catch(() => {}); }
      return bytes;
    });
  }
  return { get, memory };
}
function rendererNamespace(root) {
  const sync = require('node:fs'), hash = createHash('sha256'); hash.update('shop-gallery-864-v2-scoped-assets');
  for (const name of ['community-cards.js', 'card-render-worker.js', 'atelier-art.js', 'points-store.js', 'profile-accessories.js', 'profile-sets.js', 'hero-cosmetics.js', 'character-sets.js', 'premium-art.js', 'theme-art.js', 'collector.js', 'profile-geometry.js', 'anime-frame-art.js', 'anime-frames.js', 'remaster-art.js', 'mee6-progression.js']) {
    hash.update(name); try { hash.update(sync.readFileSync(path.join(root, name))); } catch { hash.update('missing'); }
  }
  // Match the disk paths used by hero-cosmetics, anime-frame-art, collector
  // and the shelf renderer. Raid/workshop artwork is not a gallery input.
  const isFont = name => ['NotoSansKR-Regular.otf', 'NotoSansKR-Bold.otf'].includes(name);
  const rootAsset = name => isFont(name) || name === 'collector-badges.png' || /^(?:mlbb-|anime-).+\.(?:png|jpe?g|gif|webp)$/i.test(name);
  function assets(folder, accept) {
    let rows; try { rows = sync.readdirSync(folder, { withFileTypes: true }); } catch { return; }
    for (const row of rows.sort((a, b) => a.name.localeCompare(b.name))) {
      const file = path.join(folder, row.name);
      if (row.isFile() && accept(row.name)) { const stat = sync.statSync(file); hash.update(`${path.relative(root, file)}:${stat.size}:${stat.mtimeMs}`); }
    }
  }
  assets(root, rootAsset);
  assets(path.join(root, 'assets'), isFont);
  for (const folder of ['hero-cosmetics', 'anime-atlases', 'anime-frames']) assets(path.join(root, 'assets', folder), name => /\.(?:png|jpe?g|gif|webp)$/i.test(name));
  return hash.digest('hex');
}
module.exports = { createAsyncCache, createGalleryCache, rendererNamespace };
