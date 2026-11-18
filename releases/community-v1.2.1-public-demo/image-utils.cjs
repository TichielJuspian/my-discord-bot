'use strict';
const { crc32 } = require('node:zlib');
const PNG_SIGNATURE = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
// Structural/chunk-integrity check, not an image decoder. Does not allocate
// decompressed pixels or claim to validate CRC-correct invalid deflate data.
function isGalleryPng(bytes) {
  if (!Buffer.isBuffer(bytes) || bytes.length < 57 || !bytes.subarray(0, 8).equals(PNG_SIGNATURE)) return false;
  let offset = 8, header = false, image = false, imageEnded = false, palette = false, imageBytes = 0, color;
  while (offset + 12 <= bytes.length) {
    const length = bytes.readUInt32BE(offset), end = offset + 12 + length;
    if (end > bytes.length) return false;
    const type = bytes.toString('latin1', offset + 4, offset + 8);
    if (!/^[A-Za-z]{4}$/.test(type) || type[2] !== type[2].toUpperCase()) return false;
    if (crc32(bytes.subarray(offset + 4, end - 4)) !== bytes.readUInt32BE(end - 4)) return false;
    if (!header && type !== 'IHDR') return false;
    if (type === 'IHDR') {
      if (header || length !== 13) return false;
      const width = bytes.readUInt32BE(offset + 8), height = bytes.readUInt32BE(offset + 12), depth = bytes[offset + 16];
      color = bytes[offset + 17];
      const depths = {0:[1,2,4,8,16],2:[8,16],3:[1,2,4,8],4:[8,16],6:[8,16]};
      if (!width || !height || width > 0x7fffffff || height > 0x7fffffff || !depths[color]?.includes(depth) || bytes[offset+18] !== 0 || bytes[offset+19] !== 0 || bytes[offset+20] > 1) return false;
      header = true;
    } else if (type === 'PLTE') {
      if (palette || image || !length || length % 3 || length > 768 || color === 0 || color === 4) return false;
      palette = true;
    } else if (type === 'IDAT') {
      if (imageEnded || (color === 3 && !palette)) return false;
      image = true; imageBytes += length;
    } else if (type === 'IEND') {
      return length === 0 && image && imageBytes > 0 && end === bytes.length;
    } else {
      if (type[0] === type[0].toUpperCase()) return false;
      if (image) imageEnded = true;
    }
    offset = end;
  }
  return false;
}

function createAsyncCache({ maxEntries = 128, maxBytes = 16 * 1024 * 1024, ttlMs = 300000, negativeTtlMs = 15000, now = Date.now, onEvent = () => {} } = {}) {
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
    if (old && old.until > now()) { onEvent('memory_hit'); entries.delete(key); entries.set(key, old); return old.value; }
    if (old) remove(key);
    if (pending.has(key)) { onEvent('inflight_hit'); return pending.get(key); }
    onEvent('memory_miss');
    const task = Promise.resolve().then(produce).then(value => { save(key, value); return value; }).finally(() => pending.delete(key));
    pending.set(key, task); return task;
  }
  return { get, get size() { return entries.size; }, get bytes() { return bytes; } };
}

module.exports = { isGalleryPng, createAsyncCache };
