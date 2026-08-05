import { PDFDocument, degrees } from 'pdf-lib';

/**
 * Loads a File/Blob into a pdf-lib document, translating library errors into
 * messages a person can act on.
 */
export async function loadDocument(file, source) {
  const bytes = source ?? (await file.arrayBuffer());
  try {
    return await PDFDocument.load(bytes, { ignoreEncryption: true });
  } catch {
    throw new Error(
      `"${file.name}" tidak dapat dibaca. File mungkin rusak, terenkripsi, atau bukan PDF yang valid.`,
    );
  }
}

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

/** Merges the given PDF files, in order, into a single document. */
export async function mergePdfs(files, onFile, decorate) {
  if (files.length < 2) throw new Error('Pilih minimal dua file PDF untuk digabungkan.');

  const merged = await PDFDocument.create();
  merged.setProducer('PDF Toolkit');
  merged.setCreator('PDF Toolkit');

  for (const [position, file] of files.entries()) {
    await onFile?.(position, file);
    const source = await loadDocument(file);
    const pages = await merged.copyPages(source, source.getPageIndices());
    pages.forEach((page) => merged.addPage(page));
  }

  if (merged.getPageCount() === 0) {
    throw new Error('File yang dipilih tidak memiliki halaman apa pun.');
  }
  decorate?.(merged);
  return merged.save();
}

/** Extracts the given zero-based page indices into a brand new document. */
export async function extractPages(sourceDocument, indices, decorate) {
  const output = await PDFDocument.create();
  output.setProducer('PDF Toolkit');
  output.setCreator('PDF Toolkit');

  const pages = await output.copyPages(sourceDocument, indices);
  pages.forEach((page) => output.addPage(page));

  decorate?.(output);
  return output.save();
}

/**
 * Rebuilds a document from `order` — a list of { index, rotation } describing
 * which source page goes where, and how much extra rotation it gets on top of
 * the rotation it already carries.
 */
export async function arrangePages(sourceDocument, order, decorate) {
  if (order.length === 0) throw new Error('Tidak ada halaman yang tersisa untuk disimpan.');

  const output = await PDFDocument.create();
  output.setProducer('PDF Toolkit');
  output.setCreator('PDF Toolkit');

  const pages = await output.copyPages(
    sourceDocument,
    order.map((entry) => entry.index),
  );

  pages.forEach((page, position) => {
    const extra = order[position].rotation ?? 0;
    if (extra) {
      page.setRotation(degrees((page.getRotation().angle + extra) % 360));
    }
    output.addPage(page);
  });

  decorate?.(output);
  return output.save();
}
