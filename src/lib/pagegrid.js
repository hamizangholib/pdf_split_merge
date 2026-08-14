import { paintIcons } from './ui.js';
import { renderThumbnail, renderWhenVisible } from './preview.js';
import { fadeIn } from './motion.js';

/**
 * Lazily rasterises every `[data-thumb]` inside `container` whose card carries
 * a `data-page` number. Returns a teardown function; call it before the grid is
 * rebuilt or the document is swapped, so cards that never scrolled into view
 * stop waiting.
 */
export function attachThumbnails(container, pdfDocument, { size = 220, isStale, cache } = {}) {
  const stops = [];

  /**
   * `arriving` separates a page that has just finished rasterising from one
   * being repainted out of the cache. Only the first deserves a fade — fading
   * the cached ones too would flash the whole grid on every reorder.
   */
  const paint = (thumb, url, pageNumber, arriving) => {
    thumb.innerHTML = `<img src="${url}" alt="Pratinjau halaman ${pageNumber}" class="max-h-full max-w-full object-contain transition-transform duration-200" />`;
    if (arriving) fadeIn(thumb.firstElementChild);
    thumb.dispatchEvent(new CustomEvent('thumbready', { bubbles: true }));
  };

  for (const card of container.querySelectorAll('[data-page]')) {
    const pageNumber = Number(card.dataset.page);
    const thumb = card.querySelector('[data-thumb]');

    // Grids that re-render on every reorder would otherwise rasterise the same
    // pages again and again.
    const cached = cache?.get(pageNumber);
    if (cached) {
      paint(thumb, cached, pageNumber, false);
      continue;
    }

    stops.push(
      renderWhenVisible(card, async () => {
        // The document may have been replaced while this card waited offscreen.
        if (isStale?.()) return;
        try {
          const url = await renderThumbnail(pdfDocument, pageNumber, size);
          if (isStale?.()) return;
          cache?.set(pageNumber, url);
          paint(thumb, url, pageNumber, true);
        } catch {
          thumb.innerHTML = '<i data-lucide="circle-alert" class="size-5 text-[#b3261e]"></i>';
          paintIcons(thumb);
        }
      }),
    );
  }

  return () => stops.forEach((stop) => stop());
}

/**
 * Drag-to-reorder for a list of `[data-index]` children. `onMove(from, to)`
 * owns the actual reordering and re-render.
 */
export function attachDragReorder(list, onMove) {
  let dragIndex = null;

  list.addEventListener('dragstart', (event) => {
    const item = event.target.closest('[data-index]');
    if (!item) return;
    dragIndex = Number(item.dataset.index);
    item.classList.add('opacity-40');
  });

  list.addEventListener('dragend', (event) => {
    event.target.closest('[data-index]')?.classList.remove('opacity-40');
    dragIndex = null;
  });

  list.addEventListener('dragover', (event) => event.preventDefault());

  list.addEventListener('drop', (event) => {
    event.preventDefault();
    event.stopPropagation();
    const item = event.target.closest('[data-index]');
    if (!item || dragIndex === null) return;
    onMove(dragIndex, Number(item.dataset.index));
  });
}
