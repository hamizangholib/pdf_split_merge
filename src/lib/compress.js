import { PDFArray, PDFName, PDFNumber, PDFRawStream, decodePDFRawStream } from 'pdf-lib';

/**
 * The three levels this tool offers.
 *
 * `light` and `medium` never rasterise a page, so text stays selectable and
 * form fields keep working — which also caps how much they can save. `strong`
 * is a different pipeline entirely (`rasterizePages` in `preview.js`): it
 * redraws every page as one JPEG, which always shrinks a bulky document but
 * throws the text layer away.
 */
export const levels = {
  light: { recodeImages: false },
  // 1600 px on the long side still prints acceptably at ~150 DPI on A4, and
  // 0.62 is about where JPEG artefacts stop being obvious on photographs.
  medium: { recodeImages: true, maxSide: 1600, quality: 0.62 },
};

/** Below this an image costs more in overhead than a recode can win back. */
const minImageBytes = 12 * 1024;

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

function numberOf(dict, key) {
  const value = dict.lookup(name(key));
  return value instanceof PDFNumber ? value.asNumber() : null;
}

function filtersOf(dict) {
  const filter = dict.lookup(name('Filter'));
  if (filter instanceof PDFName) return [filter];
  if (filter instanceof PDFArray) return filter.asArray().map((entry) => dict.context.lookup(entry));
  return [];
}

/** True when a stream carries a PNG/TIFF predictor, which `decode()` ignores. */
function hasPredictor(dict) {
  const parms = dict.lookup(name('DecodeParms')) ?? dict.lookup(name('DP'));
  const entries =
    parms instanceof PDFArray ? parms.asArray().map((entry) => dict.context.lookup(entry)) : [parms];

  return entries.some((entry) => {
    const predictor = entry?.lookup?.(name('Predictor'));
    return predictor instanceof PDFNumber && predictor.asNumber() > 1;
  });
}

/** 1 for greyscale, 3 for RGB, null for a colour space this module skips. */
function componentsOf(dict) {
  const space = dict.lookup(name('ColorSpace'));
  if (space === name('DeviceGray')) return 1;
  if (space === name('DeviceRGB')) return 3;

  if (space instanceof PDFArray && space.lookup(0) === name('ICCBased')) {
    const profile = space.lookup(1);
    const count = profile?.dict ? numberOf(profile.dict, 'N') : null;
    if (count === 1 || count === 3) return count;
  }
  return null;
}

/**
 * Describes what an image XObject holds, or null when this module should leave
 * it alone.
 *
 * `jpeg` means the bytes are a JPEG the browser can decode as-is. `raw` means
 * 8-bit samples in a colour space a canvas accepts — the shape a pasted
 * screenshot ends up as. Anything else (indexed palettes, CMYK, 1-bit fax
 * scans, JPEG 2000, stencil masks) is skipped: rewriting those correctly is a
 * decoder, not a compressor.
 */
export function describeImage(dict) {
  if (dict.lookup(name('Subtype')) !== name('Image')) return null;
  if (dict.lookup(name('ImageMask'))) return null;
  if (dict.lookup(name('Decode'))) return null;

  const filters = filtersOf(dict);
  if (filters.includes(name('DCTDecode'))) {
    return filters.length === 1 ? { kind: 'jpeg' } : null;
  }

  const decodable = ['FlateDecode', 'LZWDecode', 'RunLengthDecode'].map(name);
  if (filters.length === 0 || !filters.every((filter) => decodable.includes(filter))) return null;
  if (hasPredictor(dict)) return null;
  if (numberOf(dict, 'BitsPerComponent') !== 8) return null;

  const width = numberOf(dict, 'Width');
  const height = numberOf(dict, 'Height');
  const components = componentsOf(dict);
  if (!width || !height || !components) return null;

  return { kind: 'raw', width, height, components };
}

/** Draws a decoded bitmap onto a canvas no larger than `maxSide`, as JPEG. */
async function encodeScaled(draw, sourceWidth, sourceHeight, { maxSide, quality }) {
  const scale = Math.min(1, maxSide / Math.max(sourceWidth, sourceHeight));
  const width = Math.max(Math.round(sourceWidth * scale), 1);
  const height = Math.max(Math.round(sourceHeight * scale), 1);

  const canvas = makeCanvas(width, height);
  const context = canvas.getContext('2d');
  // JPEG has no alpha channel: without this, anything transparent turns black.
  context.fillStyle = '#ffffff';
  context.fillRect(0, 0, width, height);
  draw(context, width, height);

  const blob = await canvasToJpeg(canvas, quality);
  if (!blob) return null;

  return { bytes: new Uint8Array(await blob.arrayBuffer()), width, height };
}

/** Re-encodes an existing JPEG stream smaller. */
async function shrinkJpeg(bytes, settings) {
  let bitmap;
  try {
    bitmap = await createImageBitmap(new Blob([bytes], { type: 'image/jpeg' }));
  } catch {
    // Exotic JPEGs (JPEG 2000 mislabelled, damaged scans) are left untouched.
    return null;
  }

  const result = await encodeScaled(
    (context, width, height) => context.drawImage(bitmap, 0, 0, width, height),
    bitmap.width,
    bitmap.height,
    settings,
  );
  bitmap.close();
  return result;
}

/** Turns uncompressed samples — where a pasted screenshot usually lives — into JPEG. */
async function shrinkRaw(samples, { width, height, components }, settings) {
  if (samples.length < width * height * components) return null;

  const pixels = new Uint8ClampedArray(width * height * 4);
  for (let index = 0; index < width * height; index++) {
    const source = index * components;
    const target = index * 4;
    pixels[target] = samples[source];
    pixels[target + 1] = components === 1 ? samples[source] : samples[source + 1];
    pixels[target + 2] = components === 1 ? samples[source] : samples[source + 2];
    pixels[target + 3] = 255;
  }

  const decoded = makeCanvas(width, height);
  decoded.getContext('2d').putImageData(new ImageData(pixels, width, height), 0, 0);

  return encodeScaled(
    (context, targetWidth, targetHeight) =>
      context.drawImage(decoded, 0, 0, targetWidth, targetHeight),
    width,
    height,
    settings,
  );
}

/**
 * Compresses a loaded document in place and returns the saved bytes.
 *
 * `light` only re-serialises the file: duplicate cross-reference tables and
 * leftovers from incremental edits go, everything else stays byte-identical.
 * `medium` additionally re-encodes every image it can safely decode, which is
 * where the bulk of a scanned or screenshot-heavy document's size lives.
 */
export async function compressPdf(document_, level = 'light', onProgress) {
  const settings = levels[level] ?? levels.light;
  let recoded = 0;

  if (settings.recodeImages) {
    const images = document_.context
      .enumerateIndirectObjects()
      .filter(([, object]) => object instanceof PDFRawStream)
      .map(([ref, stream]) => [ref, stream, describeImage(stream.dict)])
      .filter(([, stream, info]) => info && stream.getContents().length >= minImageBytes);

    for (const [position, [ref, stream, info]] of images.entries()) {
      await onProgress?.(position, images.length);

      const bytes = stream.getContents();
      let shrunk = null;
      try {
        shrunk =
          info.kind === 'jpeg'
            ? await shrinkJpeg(bytes, settings)
            : await shrinkRaw(decodePDFRawStream(stream).decode(), info, settings);
      } catch {
        // A stream that will not decode is a stream we have no business rewriting.
        shrunk = null;
      }

      if (!shrunk || shrunk.bytes.length >= bytes.length) continue;

      const dict = stream.dict;
      dict.set(name('Width'), PDFNumber.of(shrunk.width));
      dict.set(name('Height'), PDFNumber.of(shrunk.height));
      dict.set(name('BitsPerComponent'), PDFNumber.of(8));
      dict.set(name('Filter'), name('DCTDecode'));
      // The canvas always hands back RGB, even for greyscale or CMYK sources.
      dict.set(name('ColorSpace'), name('DeviceRGB'));
      dict.delete(name('Decode'));
      dict.delete(name('DecodeParms'));
      dict.delete(name('DP'));
      dict.set(name('Length'), PDFNumber.of(shrunk.bytes.length));

      document_.context.assign(ref, PDFRawStream.of(dict, shrunk.bytes));
      recoded += 1;
    }

    // XMP metadata duplicates the document info dictionary and routinely runs
    // to several kilobytes of boilerplate from the exporting application.
    document_.catalog.delete(name('Metadata'));
  }

  document_.setProducer('PDF Toolkit');
  const bytes = await document_.save({ useObjectStreams: true });
  return { bytes, recoded };
}
