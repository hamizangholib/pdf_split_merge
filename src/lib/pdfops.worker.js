/**
 * The thread every pdf-lib operation actually runs on.
 *
 * Copying pages, re-encoding images, and serialising a document are all
 * synchronous and can take seconds on a large file. On the main thread that is
 * a frozen tab: no scroll, no progress bar, no way to leave. Here it is just a
 * background thread the page never waits on.
 */

import * as operations from './pdfops.js';

/** Hands the result's buffer over instead of copying it across the boundary. */
function transferableOf(result) {
  if (result instanceof Uint8Array) return [result.buffer];
  if (result?.bytes instanceof Uint8Array) return [result.bytes.buffer];
  return [];
}

self.onmessage = async ({ data: { id, op, payload } }) => {
  const operation = Object.hasOwn(operations, op) ? operations[op] : null;

  if (typeof operation !== 'function') {
    self.postMessage({ id, error: `Operasi "${op}" tidak dikenali.` });
    return;
  }

  try {
    const result = await operation(payload, (detail) => self.postMessage({ id, progress: detail }));
    self.postMessage({ id, ok: true, result }, transferableOf(result));
  } catch (error) {
    self.postMessage({ id, error: error?.message || 'Gagal memproses dokumen.' });
  }
};
