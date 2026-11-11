'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { spawnSync } = require('node:child_process');
const manifest = require('./manifest.json');
for (const file of manifest.files) {
  const absolute = path.join(__dirname, file.path);
  const bytes = fs.readFileSync(absolute);
  assert.equal(bytes.length, file.bytes, file.path + ': size mismatch');
  assert.equal(crypto.createHash('sha256').update(bytes).digest('hex'), file.sha256, file.path + ': SHA-256 mismatch');
  const result = spawnSync(process.execPath, ['--check', absolute], { encoding: 'utf8' });
  assert.equal(result.status, 0, file.path + ': syntax error\n' + result.stderr);
}
console.log('Verified 8 source files: byte lengths, SHA-256 hashes and JavaScript syntax.');
console.log('This does not run the 31 mocked behavior tests or validate production deployment.');
