/**
 * Self-check for the Markdown pipeline: `node src/lib/markdown.selfcheck.mjs`
 *
 * Covers the parts that do not need a DOM: what marked is asked to produce, the
 * two rules the sanitiser enforces, and the title guesser that names the PDF.
 * The DOM walk itself is glue over those rules.
 */
import assert from 'node:assert/strict';
import { marked } from 'marked';
import { guessTitle, isBannedTag, isSafeAttribute } from './markdown.js';

/* --- GFM must stay on: tables and fenced code are the reason for it. ------ */
const parsed = marked.parse('| a | b |\n|---|---|\n| 1 | 2 |\n\n```js\nconst x = 1;\n```\n');
assert.match(parsed, /<table/);
assert.match(parsed, /<pre>/);

/* --- Sanitiser rules ------------------------------------------------------ */
for (const tag of ['script', 'IFRAME', 'object', 'form', 'link', 'svg']) {
  assert.equal(isBannedTag(tag), true, `${tag} must be dropped`);
}
for (const tag of ['p', 'table', 'img', 'a', 'pre', 'code']) {
  assert.equal(isBannedTag(tag), false, `${tag} must survive`);
}

assert.equal(isSafeAttribute('onerror', 'alert(1)'), false);
assert.equal(isSafeAttribute('ONCLICK', 'alert(1)'), false);
assert.equal(isSafeAttribute('href', 'javascript:alert(1)'), false);
assert.equal(isSafeAttribute('href', '  JavaScript:alert(1)'), false);
assert.equal(isSafeAttribute('src', 'data:image/png;base64,iVBORw0KGgo='), true);
assert.equal(isSafeAttribute('href', 'https://example.com'), true);
assert.equal(isSafeAttribute('class', 'anything'), true);

/* --- Title, which becomes the suggested PDF file name --------------------- */
assert.equal(guessTitle('# Laporan *Akhir* Tahun\n\nisi'), 'Laporan Akhir Tahun');
assert.equal(guessTitle('### Bab 2\n'), 'Bab 2');
assert.equal(guessTitle('tanpa heading\nbaris kedua'), 'tanpa heading');
assert.equal(guessTitle(''), '');

console.log('markdown self-check ok');
