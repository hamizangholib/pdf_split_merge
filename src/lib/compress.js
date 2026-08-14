import { PDFName, PDFNumber, PDFRawStream } from 'pdf-lib';

/**
 * The two levels that can be delivered honestly in a browser.
 *
 * Neither one rasterises pages, so text stays selectable and searchable and
 * form fields keep working. That also caps how much can be saved: a text-only
 * PDF has almost nothing to squeeze.
 */
export const levels = {
  light: { maxSide: Infinity, quality: 1, recodeImages: false },
  medium: { maxSide: 2000, quality: 0.72, recodeImages: true },
};

const name = (value) => PDFName.of(value);

/**
 * A canvas that works wherever this module runs. `OffscreenCanvas` is the only
 * option inside the worker; the DOM branch is the fallback for the browser that
 * could not create a module worker in the first place.
 */
function makeCanvas(width, height) {
  if (typeof OffscreenCanvas !== 'undefined') return new OffscreenCanvas(width, height);

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  return canvas;
}

function canvasToJpeg(canvas, quality) {
  if (canvas.convertToBlob) return canvas.convertToBlob({ type: 'image/jpeg', quality });
  return new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', quality));
}

/** True for image XObjects stored as a plain JPEG stream. */
function isJpegImage(dict) {
  if (dict.get(name('Subtype')) !== name('Image')) return false;
  if (dict.get(name('ImageMask'))) return false;

  const filter = dict.get(name('Filter'));
  if (filter === name('DCTDecode')) return true;
  // A single-entry filter array is still a plain JPEG.
  return Boolean(filter?.asArray && filter.asArray().length === 1 && filter.get(0) === name('DCTDecode'));
}

/**
 * Re-encodes one JPEG stream at a smaller size and lower quality. Returns the
 * replacement bytes plus dimensions, or null when the attempt is not worth it —
 * a decode failure, or a result no smaller than the original.
 */
async function shrinkJpeg(bytes, { maxSide, quality }) {
  let bitmap;
  try {
    bitmap = await createImageBitmap(new Blob([bytes], { type: 'image/jpeg' }));
  } catch {
    // Exotic JPEGs (JPEG 2000 mislabelled, damaged scans) are left untouched.
    return null;
  }

  const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
  const canvas = makeCanvas(
    Math.max(Math.round(bitmap.width * scale), 1),
    Math.max(Math.round(bitmap.height * scale), 1),
  );

  const context = canvas.getContext('2d');
  context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();

  const blob = await canvasToJpeg(canvas, quality);
  if (!blob || blob.size >= bytes.length) return null;

  return {
    bytes: new Uint8Array(await blob.arrayBuffer()),
    width: canvas.width,
    height: canvas.height,
  };
}

/**
 * Compresses a loaded document in place and returns the saved bytes.
 *
 * `light` only re-serialises the file: duplicate cross-reference tables and
 * leftovers from incremental edits go, everything else stays byte-identical.
 * `medium` additionally re-encodes JPEG images, which is where the bulk of a
 * scanned document's size lives.
 */
export async function compressPdf(document_, level = 'light', onProgress) {
  const settings = levels[level] ?? levels.light;
  let recoded = 0;

  if (settings.recodeImages) {
    const images = document_.context
      .enumerateIndirectObjects()
      .filter(([, object]) => object instanceof PDFRawStream && isJpegImage(object.dict));

    for (const [position, [ref, stream]] of images.entries()) {
      await onProgress?.(position, images.length);

      const shrunk = await shrinkJpeg(stream.getContents(), settings);
      if (!shrunk) continue;

      const dict = stream.dict;
      dict.set(name('Width'), PDFNumber.of(shrunk.width));
      dict.set(name('Height'), PDFNumber.of(shrunk.height));
      dict.set(name('BitsPerComponent'), PDFNumber.of(8));
      dict.set(name('Filter'), name('DCTDecode'));
      // The canvas always hands back RGB, even for CMYK or greyscale sources.
      dict.set(name('ColorSpace'), name('DeviceRGB'));
      dict.delete(name('Decode'));
      dict.delete(name('DecodeParms'));
      dict.set(name('Length'), PDFNumber.of(shrunk.bytes.length));

      document_.context.assign(ref, PDFRawStream.of(dict, shrunk.bytes));
      recoded += 1;
    }
  }

  document_.setProducer('PDF Toolkit');
  const bytes = await document_.save({ useObjectStreams: true });
  return { bytes, recoded };
}
