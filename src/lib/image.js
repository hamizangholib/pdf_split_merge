/**
 * Turning whatever the visitor picked into bytes a PDF can hold.
 *
 * This is the half of the image tool that has to stay on the main thread: it is
 * where the browser's own decoders live, including the `<img>` element that
 * handles the files `createImageBitmap` refuses. The PDF itself is assembled in
 * the worker, which is why nothing here imports pdf-lib — a second copy of that
 * library on the main thread cost 410 kB for this one file.
 */

/** Chrome refuses canvases beyond this on either axis. */
const maxCanvasSide = 16384;

/**
 * What the worker should try first with these bytes: their original form is
 * always worth attempting, because embedding them untouched is the only way a
 * clean photo survives with its quality intact.
 */
export function imageKind(file) {
  if (file.type === 'image/jpeg' || /\.jpe?g$/i.test(file.name)) return 'jpeg';
  if (file.type === 'image/png' || /\.png$/i.test(file.name)) return 'png';
  return 'other';
}

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

/**
 * Redraws a file as baseline JPEG, which pdf-lib always accepts. This is the
 * repair path: it runs only for the files the worker could not embed as they
 * were — CMYK JPEGs, unusual PNG variants, WebP, AVIF, GIF, BMP.
 */
export async function reencodeAsJpeg(file) {
  const bytes = new Uint8Array(await file.arrayBuffer());
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
