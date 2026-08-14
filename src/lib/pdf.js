/**
 * The main thread's view of PDF processing.
 *
 * Nothing here does any real work: every operation is forwarded to the worker
 * in `pdfops.worker.js`, which keeps the tab responsive no matter how large the
 * document is. The one exception is `parsePageRanges`, which validates what the
 * user is typing and has to answer on the keystroke.
 */

/** id -> the promise waiting on that message. */
const pending = new Map();
let worker;
let sequence = 0;

function failPending(message) {
  for (const entry of pending.values()) entry.reject(new Error(message));
  pending.clear();
}

/**
 * The worker is bundled as a classic script, so it is created without
 * `type: 'module'` and works in any browser that has Workers at all. That is
 * why there is no main-thread fallback: keeping one meant shipping a second
 * copy of pdf-lib (410 kB) to cover browsers that could not run the rest of the
 * app either.
 */
function ensureWorker() {
  if (worker !== undefined) return worker;

  worker = new Worker(new URL('./pdfops.worker.js', import.meta.url));

  worker.onmessage = ({ data }) => {
    const entry = pending.get(data.id);
    if (!entry) return;

    if (data.progress !== undefined) {
      entry.onProgress?.(data.progress);
      return;
    }

    pending.delete(data.id);
    if (data.ok) entry.resolve(data.result);
    else entry.reject(new Error(data.error));
  };

  worker.onerror = () => {
    // A worker that failed to boot never recovers. Retire it so the next call
    // starts a fresh one instead of every request hanging on a dead thread.
    worker = undefined;
    failPending('Pemrosesan PDF di latar belakang gagal dimulai. Coba muat ulang halaman.');
  };

  return worker;
}

function run(op, payload, { transfer = [], onProgress } = {}) {
  const active = ensureWorker();
  const id = ++sequence;

  return new Promise((resolve, reject) => {
    pending.set(id, { resolve, reject, onProgress });
    active.postMessage({ id, op, payload }, transfer);
  });
}

/* -------------------------------------------------------------- public API */

/**
 * Starts the worker before anything needs it.
 *
 * Otherwise the first thing a visitor does — picking a file — pays for
 * creating the thread and parsing pdf-lib on top of reading their document.
 * The script is already in the service worker's cache by then, so this costs
 * no extra network.
 */
export const warmUp = () => void ensureWorker();

/**
 * Validates a file and returns a handle for the tools to work against.
 *
 * `bytes` is handed to the worker rather than copied, so the caller must not
 * touch it afterwards — that is the whole point: one copy of the file exists,
 * and it lives on the thread doing the work.
 */
export function openDocument(bytes, name) {
  return run('open', { bytes, name }, { transfer: [bytes.buffer] });
}

export function closeDocument(docId) {
  if (docId != null) run('close', { docId });
}

export const startMerge = () => run('mergeStart', {});

export const addToMerge = (mergeId, bytes, name) =>
  run('mergeAdd', { mergeId, bytes, name }, { transfer: [bytes.buffer] });

export const finishMerge = (mergeId) => run('mergeFinish', { mergeId });

export const abortMerge = (mergeId) => run('mergeAbort', { mergeId }).catch(() => {});

export const extractPages = (docId, indices) => run('extract', { docId, indices });

export const extractPagesToZip = (docId, indices, base, width, onProgress) =>
  run('extractZip', { docId, indices, base, width }, { onProgress });

export const arrangePages = (docId, order) => run('arrange', { docId, order });

export const startImages = () => run('imagesStart', {});

export const addImage = (imagesId, bytes, kind) =>
  run('imagesAdd', { imagesId, bytes, kind }, { transfer: [bytes.buffer] });

export const buildImages = (imagesId, options) => run('imagesBuild', { imagesId, ...options });

export const abortImages = (imagesId) => run('imagesAbort', { imagesId }).catch(() => {});

export const compressDocument = (docId, level, onProgress) =>
  run('compress', { docId, level }, { onProgress });

/* ------------------------------------------------------------- pure helper */

/**
 * Parses a human page-range string ("1-3, 5, 7-10") into zero-based page
 * indices, preserving the order the user typed and dropping duplicates.
 */
export function parsePageRanges(input, totalPages) {
  const raw = String(input ?? '').trim();
  if (!raw) throw new Error('Rentang halaman belum diisi. Contoh: 1-3, 5, 7-10');

  const indices = [];
  const seen = new Set();

  for (const part of raw.split(',')) {
    const token = part.trim();
    if (!token) continue;

    const match = token.match(/^(\d+)\s*(?:-\s*(\d+))?$/);
    if (!match) {
      throw new Error(`Bagian "${token}" tidak dikenali. Gunakan format seperti 1-3, 5, 7-10.`);
    }

    const start = Number(match[1]);
    const end = match[2] === undefined ? start : Number(match[2]);

    if (start < 1 || end < 1) {
      throw new Error('Nomor halaman dimulai dari 1.');
    }
    if (start > end) {
      throw new Error(`Rentang "${token}" terbalik. Tulis halaman yang lebih kecil lebih dulu.`);
    }
    if (end > totalPages) {
      throw new Error(
        `Halaman ${end} di luar jangkauan. Dokumen ini hanya memiliki ${totalPages} halaman.`,
      );
    }

    for (let page = start; page <= end; page++) {
      if (seen.has(page)) continue;
      seen.add(page);
      indices.push(page - 1);
    }
  }

  if (indices.length === 0) throw new Error('Tidak ada halaman yang terpilih.');
  return indices;
}
