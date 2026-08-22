/**
 * Every heavy pdf-lib operation, with no DOM in sight.
 *
 * This module is what the worker in `pdfops.worker.js` runs, and what `pdf.js`
 * imports directly on the rare browser where a module worker cannot be created.
 * Nothing here may touch `window`, `document`, or `import.meta.env`.
 *
 * Documents are held as raw bytes rather than as parsed `PDFDocument`s: pdf-lib
 * mutates a document as it copies pages out of it, so every operation reloads a
 * fresh one. Re-parsing costs a few milliseconds and buys the guarantee that
 * running a tool twice gives the same answer twice.
 */

import { PDFDocument, degrees } from 'pdf-lib';
import { compressPdf } from './compress.js';
import { zipStore } from './zip.js';

/** docId -> the untouched bytes of an opened file. */
const documents = new Map();
/** mergeId -> the document being assembled, one source file at a time. */
const merges = new Map();
let nextId = 1;

function stamp(document_) {
  document_.setProducer('PDF Toolkit');
  document_.setCreator('PDF Toolkit');
  return document_;
}

/**
 * Parses bytes into a pdf-lib document, translating both failure modes into
 * messages a person can act on.
 *
 * Encryption is the important one. pdf-lib can read the structure of an
 * encrypted file but cannot decrypt its content streams, so `ignoreEncryption`
 * would happily produce an output PDF whose every page is garbage — a silent
 * corruption the user only discovers after the download. Refusing up front is
 * the only honest answer.
 */
export async function loadDocument(bytes, name = 'File ini') {
  let document_;
  try {
    document_ = await PDFDocument.load(bytes, { ignoreEncryption: true });
  } catch {
    throw new Error(
      `"${name}" tidak dapat dibaca. File mungkin rusak atau bukan PDF yang valid.`,
    );
  }

  if (document_.isEncrypted) {
    throw new Error(
      `"${name}" dilindungi kata sandi, jadi isinya tidak bisa dibaca di sini. Buka file ini di pembaca PDF, simpan ulang tanpa proteksi, lalu coba lagi.`,
    );
  }

  return document_;
}

async function documentOf(docId) {
  const bytes = documents.get(docId);
  if (!bytes) throw new Error('Dokumen sudah ditutup. Muat ulang filenya lalu coba lagi.');
  return loadDocument(bytes);
}

/* ------------------------------------------------------------ open / close */

/** Validates a file and keeps its bytes for later operations. */
export async function open({ bytes, name }) {
  const document_ = await loadDocument(bytes, name);
  const pageCount = document_.getPageCount();
  if (pageCount === 0) throw new Error(`"${name}" tidak memiliki halaman.`);

  const docId = nextId++;
  documents.set(docId, bytes);
  return { docId, pageCount };
}

export function close({ docId }) {
  documents.delete(docId);
}

/* ------------------------------------------------------------------- merge */

/**
 * Merging streams: the caller hands over one file at a time so a twenty-file
 * merge never holds twenty files in memory at once.
 */
export async function mergeStart() {
  const mergeId = nextId++;
  merges.set(mergeId, stamp(await PDFDocument.create()));
  return { mergeId };
}

export async function mergeAdd({ mergeId, bytes, name }) {
  const merged = merges.get(mergeId);
  if (!merged) throw new Error('Sesi penggabungan sudah berakhir. Coba gabungkan ulang.');

  const source = await loadDocument(bytes, name);
  const pages = await merged.copyPages(source, source.getPageIndices());
  pages.forEach((page) => merged.addPage(page));
}

export async function mergeFinish({ mergeId }) {
  const merged = merges.get(mergeId);
  merges.delete(mergeId);
  if (!merged) throw new Error('Sesi penggabungan sudah berakhir. Coba gabungkan ulang.');

  if (merged.getPageCount() === 0) {
    throw new Error('File yang dipilih tidak memiliki halaman apa pun.');
  }
  return merged.save();
}

export function mergeAbort({ mergeId }) {
  merges.delete(mergeId);
}

/* ----------------------------------------------------------------- extract */

/** Copies the given zero-based page indices into one new document. */
export async function extract({ docId, indices }) {
  const source = await documentOf(docId);
  const output = stamp(await PDFDocument.create());

  const pages = await output.copyPages(source, indices);
  pages.forEach((page) => output.addPage(page));

  return output.save();
}

/**
 * One single-page PDF per selected page, packed into a ZIP. The whole loop runs
 * here rather than page-by-page across the worker boundary, so a 200-page split
 * costs one message instead of two hundred.
 */
export async function extractZip({ docId, indices, base, width }, onProgress) {
  const source = await documentOf(docId);
  const entries = [];

  for (const [position, index] of indices.entries()) {
    onProgress?.({ position, total: indices.length });

    const output = stamp(await PDFDocument.create());
    const [page] = await output.copyPages(source, [index]);
    output.addPage(page);

    entries.push({
      name: `${base}-halaman-${String(index + 1).padStart(width, '0')}.pdf`,
      bytes: await output.save(),
    });
  }

  onProgress?.({ zipping: true });
  return zipStore(entries);
}

/* ---------------------------------------------------------------- arrange */

/**
 * Rebuilds a document from `order` — a list of { index, rotation } describing
 * which source page goes where, and how much extra rotation it gets on top of
 * the rotation it already carries.
 */
export async function arrange({ docId, order }) {
  if (order.length === 0) throw new Error('Tidak ada halaman yang tersisa untuk disimpan.');

  const source = await documentOf(docId);
  const output = stamp(await PDFDocument.create());

  const pages = await output.copyPages(
    source,
    order.map((entry) => entry.index),
  );

  pages.forEach((page, position) => {
    const extra = order[position].rotation ?? 0;
    if (extra) {
      page.setRotation(degrees((page.getRotation().angle + extra) % 360));
    }
    output.addPage(page);
  });

  return output.save();
}

/* ---------------------------------------------------------------- images */

/** ISO/US page sizes in PDF points, portrait. */
const pageSizes = {
  a4: [595.28, 841.89],
  letter: [612, 792],
};

/** imagesId -> the document being filled and the images embedded so far. */
const imageJobs = new Map();

export async function imagesStart() {
  const imagesId = nextId++;
  imageJobs.set(imagesId, { document: stamp(await PDFDocument.create()), images: [] });
  return { imagesId };
}

/**
 * Embeds one image, preferring the bytes exactly as they came off disk so a
 * clean photo is never re-compressed.
 *
 * When pdf-lib cannot parse them — a CMYK JPEG, an unusual PNG variant, a
 * format only the browser knows — the answer is `needsReencode`, and the caller
 * redraws the image through a canvas and sends it back as `kind: 'jpeg'`. The
 * decoding stays on the main thread because that is where the fallbacks for
 * awkward files live.
 */
export async function imagesAdd({ imagesId, bytes, kind }) {
  const job = imageJobs.get(imagesId);
  if (!job) throw new Error('Sesi konversi gambar sudah berakhir. Coba buat ulang PDF-nya.');

  if (kind === 'other') return { ok: false, needsReencode: true };

  try {
    const image =
      kind === 'png' ? await job.document.embedPng(bytes) : await job.document.embedJpg(bytes);
    job.images.push(image);
    return { ok: true };
  } catch {
    return { ok: false, needsReencode: kind !== 'reencoded' };
  }
}

/**
 * Lays the embedded images out, one per page.
 *
 * `pageSize` is either 'fit' (each page matches its image) or a key of
 * `pageSizes`. `margin` is in points and only applies to fixed page sizes.
 */
export async function imagesBuild({
  imagesId,
  pageSize = 'fit',
  margin = 0,
  // 'auto' turns a wide image onto a landscape page; it is the default the
  // view has always relied on without passing it.
  orientation = 'auto',
}) {
  const job = imageJobs.get(imagesId);
  imageJobs.delete(imagesId);
  if (!job) throw new Error('Sesi konversi gambar sudah berakhir. Coba buat ulang PDF-nya.');

  const output = job.document;

  for (const image of job.images) {
    if (pageSize === 'fit') {
      const page = output.addPage([image.width, image.height]);
      page.drawImage(image, { x: 0, y: 0, width: image.width, height: image.height });
      continue;
    }

    const [shortSide, longSide] = pageSizes[pageSize] ?? pageSizes.a4;
    const landscape =
      orientation === 'landscape' || (orientation === 'auto' && image.width > image.height);
    const [pageWidth, pageHeight] = landscape ? [longSide, shortSide] : [shortSide, longSide];

    const page = output.addPage([pageWidth, pageHeight]);
    const boxWidth = Math.max(pageWidth - margin * 2, 1);
    const boxHeight = Math.max(pageHeight - margin * 2, 1);
    const scale = Math.min(boxWidth / image.width, boxHeight / image.height);
    const width = image.width * scale;
    const height = image.height * scale;

    page.drawImage(image, {
      x: (pageWidth - width) / 2,
      y: (pageHeight - height) / 2,
      width,
      height,
    });
  }

  if (output.getPageCount() === 0) {
    throw new Error('Tidak ada gambar yang bisa dikonversi.');
  }
  return output.save();
}

export function imagesAbort({ imagesId }) {
  imageJobs.delete(imagesId);
}

/* --------------------------------------------------------------- compress */

export async function compress({ docId, level }, onProgress) {
  const document_ = await documentOf(docId);
  return compressPdf(document_, level, (position, total) => onProgress?.({ position, total }));
}

/**
 * Rebuilds a document from pages already rasterised to JPEG on the main thread
 * (see `rasterizePages`). Each entry's `width`/`height` are the original page
 * size in points, so the result keeps its paper size no matter what resolution
 * the bitmap was rendered at.
 */
export async function buildFromPages({ pages }, onProgress) {
  if (!pages?.length) throw new Error('Tidak ada halaman yang bisa dikompresi.');

  const output = stamp(await PDFDocument.create());

  for (const [position, entry] of pages.entries()) {
    onProgress?.({ position, total: pages.length });

    const image = await output.embedJpg(entry.bytes);
    const page = output.addPage([entry.width, entry.height]);
    page.drawImage(image, { x: 0, y: 0, width: entry.width, height: entry.height });
  }

  return output.save({ useObjectStreams: true });
}
