import { PDFDocument } from 'pdf-lib';

/** ISO/US page sizes in PDF points, portrait. */
export const pageSizes = {
  a4: [595.28, 841.89],
  letter: [612, 792],
};

/** Chrome refuses canvases beyond this on either axis. */
const maxCanvasSide = 16384;

/**
 * Decodes anything the browser can display. `createImageBitmap` is the fast
 * path but refuses SVG, so an <img> element is used as the fallback — that one
 * handles SVG and a few malformed files the bitmap decoder rejects.
 */
async function decodeImage(blob) {
  try {
    return await createImageBitmap(blob);
  } catch {
    // fall through to the element decoder
  }

  const url = URL.createObjectURL(blob);
  try {
    const image = new Image();
    image.decoding = 'sync';
    await new Promise((resolve, reject) => {
      image.onload = resolve;
      image.onerror = () => reject(new Error('decode failed'));
      image.src = url;
    });
    if (!image.naturalWidth || !image.naturalHeight) throw new Error('decode failed');
    return image;
  } finally {
    URL.revokeObjectURL(url);
  }
}

/** Redraws a decoded image as baseline JPEG, which pdf-lib always accepts. */
async function reencodeAsJpeg(file, bytes) {
  const blob = new Blob([bytes], { type: file.type || 'application/octet-stream' });
  let source;
  try {
    source = await decodeImage(blob);
  } catch {
    throw new Error(
      `"${file.name}" tidak dapat dibaca sebagai gambar oleh browser ini. Format HEIC dari iPhone dan file yang rusak tidak didukung.`,
    );
  }

  const width = source.width || source.naturalWidth;
  const height = source.height || source.naturalHeight;
  // SVG without intrinsic size, or a photo larger than the canvas limit.
  const scale = Math.min(1, maxCanvasSide / Math.max(width, height, 1));

  const canvas = document.createElement('canvas');
  canvas.width = Math.max(Math.round(width * scale), 1);
  canvas.height = Math.max(Math.round(height * scale), 1);

  const context = canvas.getContext('2d');
  // JPEG has no alpha; without this, transparent pixels turn black.
  context.fillStyle = '#ffffff';
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.drawImage(source, 0, 0, canvas.width, canvas.height);
  source.close?.();

  const jpeg = await new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.92));
  if (!jpeg) {
    throw new Error(
      `"${file.name}" terlalu besar untuk diproses browser ini. Perkecil gambarnya lebih dulu.`,
    );
  }
  return new Uint8Array(await jpeg.arrayBuffer());
}

/**
 * Embeds one image, preferring the original bytes so quality is untouched, and
 * falling back to a browser re-encode when pdf-lib cannot parse them — CMYK
 * JPEGs and unusual PNG variants land here rather than failing outright.
 */
async function embedImage(output, file) {
  const bytes = new Uint8Array(await file.arrayBuffer());
  const isJpeg = file.type === 'image/jpeg' || /\.jpe?g$/i.test(file.name);
  const isPng = file.type === 'image/png' || /\.png$/i.test(file.name);

  if (isJpeg || isPng) {
    try {
      return isJpeg ? await output.embedJpg(bytes) : await output.embedPng(bytes);
    } catch {
      // Not a usable JPEG/PNG despite the extension — repair it below.
    }
  }

  return output.embedJpg(await reencodeAsJpeg(file, bytes));
}

/**
 * Builds a PDF from image files, one image per page.
 *
 * `pageSize` is either 'fit' (each page matches its image) or a key of
 * `pageSizes`. `margin` is in points and only applies to fixed page sizes.
 *
 * Files that cannot be converted are skipped and reported rather than aborting
 * the whole batch — one bad photo should not cost the other forty.
 */
export async function imagesToPdf(
  files,
  { pageSize = 'fit', margin = 0, orientation = 'auto' } = {},
  onFile,
) {
  if (files.length === 0) throw new Error('Pilih minimal satu gambar.');

  const output = await PDFDocument.create();
  output.setProducer('PDF Toolkit');
  output.setCreator('PDF Toolkit');

  const skipped = [];

  for (const [position, file] of files.entries()) {
    await onFile?.(position, file);

    let image;
    try {
      image = await embedImage(output, file);
    } catch (error) {
      skipped.push({ file, reason: error?.message ?? 'Gagal dibaca.' });
      continue;
    }

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
    throw new Error(
      skipped.length === 1
        ? skipped[0].reason
        : `Tidak ada gambar yang bisa dikonversi. ${skipped.length} file gagal dibaca.`,
    );
  }

  return { bytes: await output.save(), skipped };
}
