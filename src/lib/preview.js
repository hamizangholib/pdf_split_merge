import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';

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

/** Opens a File as a pdf.js document, used purely for on-screen previews. */
export async function openPreview(file) {
  const pdfjs = await loadPdfjs();
  const bytes = new Uint8Array(await file.arrayBuffer());
  return pdfjs.getDocument({ data: bytes }).promise;
}

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

/** First-page thumbnail of a file, cached per File so re-renders are free. */
const coverCache = new WeakMap();

export function coverThumbnail(file, size = 220) {
  let pending = coverCache.get(file);
  if (!pending) {
    pending = (async () => {
      const document_ = await openPreview(file);
      const url = await renderThumbnail(document_, 1, size);
      return { url, pageCount: document_.numPages };
    })().catch(() => null);
    coverCache.set(file, pending);
  }
  return pending;
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
