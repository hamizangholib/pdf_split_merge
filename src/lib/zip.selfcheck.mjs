/**
 * Self-check for the ZIP writer: `node src/lib/zip.selfcheck.mjs`
 * Writes an archive to a temp dir and asks the OS to unpack it, so the check
 * fails if the headers are wrong in a way a real unzip tool would notice.
 */
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { crc32, zipStore } from './zip.js';

// Known-answer test from the CRC-32 spec.
assert.equal(crc32(new TextEncoder().encode('123456789')), 0xcbf43926);

const entries = [
  { name: 'halaman-1.txt', bytes: new TextEncoder().encode('satu') },
  { name: 'halaman-2.txt', bytes: new TextEncoder().encode('dua dua dua') },
];
const archive = zipStore(entries);

const dir = mkdtempSync(join(tmpdir(), 'zipcheck-'));
const archivePath = join(dir, 'out.zip');
writeFileSync(archivePath, archive);

// bsdtar reads ZIP; on Windows it lives in System32 while `tar` on PATH may be
// GNU tar, which does not. Run from inside the temp dir so no drive-letter path
// is passed (some tar builds read "C:\..." as a remote host).
const tar = process.platform === 'win32' ? 'C:/Windows/System32/tar.exe' : 'tar';
execFileSync(tar, ['-xf', 'out.zip'], { cwd: dir, stdio: 'pipe' });

for (const entry of entries) {
  assert.deepEqual(new Uint8Array(readFileSync(join(dir, entry.name))), entry.bytes);
}

console.log('zip self-check ok');
