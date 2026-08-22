import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import { readFileBytes } from './ui.js';

// pdf.js is ~500 kB and only needed once a file is picked, so it is pulled in
// on demand rather than shipped in the entry chunk.
let pdfjsPromise = null;

function loadPdfjs() {
  pdfjsPromise ??= import('pdfjs-dist').then((pdfjs) => {
    pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;
    return pdfjs;
  });
  return pdfjsPromise;
}

/**
 * Opens a File (or bytes already read from one) as a pdf.js document, used
 * purely for on-screen previews. pdf.js transfers the buffer to its worker, so
 * shared bytes are copied rather than handed over.
 */
export async function openPreview(source) {
  const pdfjs = await loadPdfjs();
  const bytes =
    source instanceof Uint8Array ? source.slice() : new Uint8Array(await source.arrayBuffer());

  const task = pdfjs.getDocument({ data: bytes });
  const document_ = await task.promise;
  loadingTasks.set(document_, task);
  return document_;
}

/**
 * Only the loading task can release a document — the proxy pdf.js hands back
 * has no `destroy` of its own — and letting it go frees the file's bytes on
 * pdf.js's worker as well as this thread's.
 */
const loadingTasks = new WeakMap();

export const closePreview = (document_) => loadingTasks.get(document_)?.destroy();

/**
 * Rasterises one page into a data URL, scaled so its longest side is `size`.
 * Data URLs (rather than live canvases) keep the thumbnail cheap to cache and
 * survive the list re-renders that reordering causes.
 */
export async function renderThumbnail(document_, pageNumber, size = 220) {
  const page = await document_.getPage(pageNumber);
  const base = page.getViewport({ scale: 1 });
  const viewport = page.getViewport({ scale: size / Math.max(base.width, base.height) });

  const canvas = document.createElement('canvas');
  canvas.width = Math.ceil(viewport.width);
  canvas.height = Math.ceil(viewport.height);

  await page.render({
    canvas,
    canvasContext: canvas.getContext('2d'),
    viewport,
  }).promise;

  return canvas.toDataURL('image/jpeg', 0.75);
}

/**
 * Redraws every page as one JPEG — the pipeline behind the strongest
 * compression level.
 *
 * This is the only way to guarantee a smaller file whatever the document
 * contains: vector art, embedded fonts, colour profiles and revision history
 * all collapse into a bitmap. The cost is the text layer, which is why the view
 * says so before running it.
 *
 * Each entry carries the page's size in PDF points, not pixels, so the rebuilt
 * document still prints at its original dimensions.
 */
export async function rasterizePages(source, { dpi = 150, quality = 0.62, onProgress } = {}) {
  const document_ = await openPreview(source);
  const canvas = document.createElement('canvas');
  const context = canvas.getContext('2d');
  const pages = [];

  try {
    for (let number = 1; number <= document_.numPages; number++) {
      onProgress?.(number - 1, document_.numPages);

      const page = await document_.getPage(number);
      // Scale 1 is the page at its true size in points, rotation included.
      const box = page.getViewport({ scale: 1 });
      // Browsers refuse canvases beyond a few thousand pixels a side, so a
      // poster-sized page gets less than the requested DPI rather than failing.
      const scale = Math.min(dpi / 72, 4000 / Math.max(box.width, box.height));
      const viewport = page.getViewport({ scale });

      canvas.width = Math.max(Math.ceil(viewport.width), 1);
      canvas.height = Math.max(Math.ceil(viewport.height), 1);
      // JPEG has no alpha: an unpainted page would come out black.
      context.fillStyle = '#ffffff';
      context.fillRect(0, 0, canvas.width, canvas.height);

      // 'print' rather than 'display': it draws annotations the way they are
      // meant to appear on paper, and it does not drive the render loop from
      // requestAnimationFrame — which a backgrounded tab never fires, leaving a
      // display-intent render stalled halfway.
      await page.render({ canvas, canvasContext: context, viewport, intent: 'print' }).promise;
      page.cleanup();

      const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', quality));
      if (!blob) throw new Error('Halaman tidak dapat diubah menjadi gambar di peramban ini.');

      pages.push({
        bytes: new Uint8Array(await blob.arrayBuffer()),
        width: box.width,
        height: box.height,
      });
    }
  } finally {
    await closePreview(document_);
  }

  return pages;
}

/** First-page thumbnail of a file, cached per File so re-renders are free. */
const coverCache = new WeakMap();

export function coverThumbnail(file, { size = 220, onStage } = {}) {
  let pending = coverCache.get(file);
  if (!pending) {
    pending = (async () => {
      const bytes = await readFileBytes(file, (ratio) => onStage?.('reading', ratio));
      onStage?.('processing');
      const document_ = await openPreview(bytes);
      const url = await renderThumbnail(document_, 1, size);
      return { url, pageCount: document_.numPages };
    })();
    coverCache.set(file, pending);
  }
  // Cached results replay instantly; only the first caller sees real progress.
  pending.then(() => onStage?.('ready')).catch(() => onStage?.('error'));
  return pending.catch(() => null);
}

/**
 * Renders `element`'s thumbnail only once it scrolls near the viewport, so a
 * 300-page document does not rasterise 300 pages up front.
 */
export function renderWhenVisible(element, render) {
  const observer = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        observer.unobserve(entry.target);
        render(entry.target);
      }
    },
    { rootMargin: '300px' },
  );
  observer.observe(element);
  return () => observer.disconnect();
}
