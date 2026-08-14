import {
  cls,
  downloadBytes,
  errorText,
  escapeHtml,
  formatBytes,
  html,
  paintIcons,
  paintStatus,
  resultLink,
  setVisible,
  stripPdfExtension,
} from '../lib/ui.js';
import { arrangePages, closeDocument, openDocument } from '../lib/pdf.js';
import { captureRects, collapseOut, playFlip, rotateTo } from '../lib/motion.js';
import { openPreview } from '../lib/preview.js';
import { attachDragReorder, attachThumbnails } from '../lib/pagegrid.js';
import { createFileLoader } from '../lib/loader.js';
import { subNavMarkup } from '../lib/nav.js';
import { brandIcon } from '../lib/icons.js';

export function renderOrganize() {
  /**
   * `order` is the document being built: one entry per surviving page, in
   * output order. `index` points at the source page, `rotation` is the extra
   * turn applied on top of whatever rotation that page already had.
   * @type {{ file: File|null, docId: number|null, pageCount: number, preview: any, order: {index:number, rotation:number}[], removed: number, status: string|null, message: string, busy: boolean }}
   */
  const state = {
    file: null,
    docId: null,
    pageCount: 0,
    preview: null,
    order: [],
    removed: 0,
    status: null,
    message: '',
    busy: false,
  };

  let stopThumbnails = null;
  /** Source page number -> data URL, so reordering never re-rasterises. */
  let thumbCache = new Map();
  /** Source page index -> the angle its card last showed, so a rebuilt grid can
   *  turn a thumbnail rather than redraw it already turned. */
  let rotationMemory = new Map();

  /**
   * Snapshots taken before every edit. Deleting a page used to be the one
   * irreversible thing in the app: the only way back was "Kembalikan ke urutan
   * asli", which also threw away every other change.
   */
  let past = [];
  const undoLimit = 50;

  function remember() {
    past.push({ order: state.order.map((entry) => ({ ...entry })), removed: state.removed });
    if (past.length > undoLimit) past.shift();
  }

  function undo() {
    const previous = past.pop();
    if (!previous) return;
    state.order = previous.order;
    state.removed = previous.removed;
    setStatus(null, '');
    renderGrid();
  }

  const root = html(`
    <div>
      ${subNavMarkup('atur-halaman-pdf')}

      <section class="mx-auto max-w-[1120px] space-y-8 px-5 py-16">
        <header class="space-y-3">
          <h1 class="text-display-md text-ink">Atur halaman</h1>
          <p class="max-w-[620px] text-body text-ink-80">
            Tarik halaman untuk mengubah urutannya, putar halaman yang miring, dan buang
            halaman yang tidak diperlukan. Halaman aslinya tidak pernah diubah.
          </p>
        </header>

        <div data-loader></div>

        <div data-detail class="space-y-8" style="display: none">
          <div class="flex flex-wrap items-center gap-4 rounded-lg border border-hairline bg-white px-5 py-4">
            <span class="flex size-11 shrink-0 items-center justify-center rounded-sm bg-parchment text-action">
              <i data-lucide="file-text" class="size-5"></i>
            </span>
            <span class="min-w-0 flex-1">
              <span data-name class="block truncate text-body text-ink"></span>
              <span data-meta class="block text-fine text-ink-48"></span>
            </span>
            <button type="button" data-reset class="${cls.iconButton}" aria-label="Ganti file">
              <i data-lucide="trash-2" class="size-[18px]"></i>
            </button>
          </div>

          <div class="flex flex-wrap items-center gap-2">
            <button type="button" data-undo class="${cls.chip}" disabled>
              Batalkan
            </button>
            <button type="button" data-rotate-all class="${cls.chip}">
              Putar semua 90°
            </button>
            <button type="button" data-restore class="${cls.chip}">
              Kembalikan ke urutan asli
            </button>
            <p data-summary class="ml-auto text-fine text-ink-48"></p>
          </div>

          <p class="text-fine text-ink-48">
            Tarik kartu untuk mengurutkan, atau gunakan tombol panah pada tiap kartu.
            Ctrl + Z membatalkan perubahan terakhir.
          </p>

          <div
            data-pages
            class="grid grid-cols-2 gap-4 rounded-lg bg-pearl p-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5"
          ></div>

          <div data-status></div>

          <button type="button" data-save class="${cls.pillPrimary}">
            ${brandIcon('organize', 'size-[18px]')}
            Simpan PDF
          </button>
        </div>
      </section>
    </div>
  `);

  const detailHost = root.querySelector('[data-detail]');
  const nameHost = root.querySelector('[data-name]');
  const metaHost = root.querySelector('[data-meta]');
  const pagesHost = root.querySelector('[data-pages]');
  const summaryHost = root.querySelector('[data-summary]');
  const statusHost = root.querySelector('[data-status]');
  const saveButton = root.querySelector('[data-save]');
  const undoButton = root.querySelector('[data-undo]');

  function setStatus(status, message) {
    state.status = status;
    state.message = message;
    paintStatus(statusHost, status, message);
  }

  /* ------------------------------------------------------------- page grid */

  function pageCard(entry, position) {
    const sourcePage = entry.index + 1;

    const card = html(`
      <li
        draggable="true"
        data-index="${position}"
        data-page="${sourcePage}"
        data-key="page-${entry.index}"
        class="relative flex cursor-grab flex-col gap-2 rounded-md border border-hairline bg-white p-2 active:cursor-grabbing"
      >
        <span class="absolute left-4 top-4 z-10 flex size-6 items-center justify-center rounded-full bg-action text-fine font-semibold text-white">
          ${position + 1}
        </span>
        <span data-thumb class="flex aspect-square w-full items-center justify-center overflow-hidden rounded-sm bg-parchment text-ink-48">
          <i data-lucide="loader-circle" class="size-5 animate-spin"></i>
        </span>
        <span class="block px-1 text-fine text-ink-48">Asal hal. ${sourcePage}</span>
        <span class="flex items-center justify-between px-1">
          <span class="flex items-center gap-0.5">
            <button type="button" data-up class="${cls.iconButton} size-8" aria-label="Pindahkan halaman ${sourcePage} lebih awal" ${position === 0 ? 'disabled' : ''}>
              <i data-lucide="arrow-up" class="size-4"></i>
            </button>
            <button type="button" data-down class="${cls.iconButton} size-8" aria-label="Pindahkan halaman ${sourcePage} lebih akhir" ${position === state.order.length - 1 ? 'disabled' : ''}>
              <i data-lucide="arrow-down" class="size-4"></i>
            </button>
          </span>
          <span class="flex items-center gap-0.5">
            <button type="button" data-rotate class="${cls.iconButton} size-8" aria-label="Putar halaman ${sourcePage}">
              <i data-lucide="rotate-cw" class="size-4"></i>
            </button>
            <button type="button" data-remove class="${cls.iconButton} size-8" aria-label="Hapus halaman ${sourcePage}">
              <i data-lucide="trash-2" class="size-4"></i>
            </button>
          </span>
        </span>
      </li>
    `);

    // The thumbnail is square and rendered longest-side-first, so any quarter
    // turn stays inside the box without extra layout maths.
    //
    // `turningFrom` is the angle this page was showing before the grid was
    // rebuilt, which is what makes "Putar semua" and Undo turn visibly rather
    // than snap. It is null when nothing changed, and is consumed once — the
    // thumbnail may still be rasterising when the card is built, so the turn
    // waits for `thumbready`.
    let turningFrom = rotationMemory.get(entry.index);
    if (turningFrom === entry.rotation) turningFrom = null;
    rotationMemory.set(entry.index, entry.rotation);

    const applyRotation = () => {
      const image = card.querySelector('[data-thumb] img');
      if (!image) return;

      if (turningFrom === null || turningFrom === undefined) {
        image.style.transform = `rotate(${entry.rotation}deg)`;
        return;
      }
      rotateTo(image, turningFrom, entry.rotation);
      turningFrom = null;
    };
    card.addEventListener('thumbready', applyRotation);
    applyRotation();

    card.querySelector('[data-up]').addEventListener('click', (event) => {
      event.stopPropagation();
      move(position, position - 1, '[data-up]');
    });

    card.querySelector('[data-down]').addEventListener('click', (event) => {
      event.stopPropagation();
      move(position, position + 1, '[data-down]');
    });

    card.querySelector('[data-rotate]').addEventListener('click', (event) => {
      event.stopPropagation();
      remember();
      turningFrom = entry.rotation;
      entry.rotation = (entry.rotation + 90) % 360;
      rotationMemory.set(entry.index, entry.rotation);
      applyRotation();
      renderSummary();
    });

    card.querySelector('[data-remove]').addEventListener('click', async (event) => {
      event.stopPropagation();
      await collapseOut(card);

      // The grid may have been rebuilt while the card was shrinking, so the
      // entry itself says where it now lives — `position` could be stale.
      const index = state.order.indexOf(entry);
      if (index === -1) return;

      remember();
      state.order.splice(index, 1);
      state.removed += 1;
      renderGrid();
    });

    return card;
  }

  function renderGrid() {
    // Where every card sits before the grid is rebuilt, so each one can slide
    // from its old place to its new one instead of jumping there.
    const rects = captureRects(pagesHost);

    stopThumbnails?.();
    pagesHost.innerHTML = '';

    const list = document.createElement('ul');
    list.className = 'contents';
    state.order.forEach((entry, position) => list.appendChild(pageCard(entry, position)));
    pagesHost.appendChild(list);

    attachDragReorder(list, move);

    const document_ = state.preview;
    stopThumbnails = attachThumbnails(pagesHost, document_, {
      cache: thumbCache,
      isStale: () => state.preview !== document_,
    });

    renderSummary();
    paintIcons(pagesHost);
    // Last, so the icons have already taken their final size.
    playFlip(pagesHost, rects);
  }

  /**
   * `focusSelector` names the button that was pressed, so a keyboard user who
   * walks a page up the grid keeps hold of it instead of losing focus to the
   * body every time the grid re-renders.
   */
  function move(from, to, focusSelector) {
    if (to < 0 || to >= state.order.length || from === to) return;
    remember();
    const [moved] = state.order.splice(from, 1);
    state.order.splice(to, 0, moved);
    renderGrid();

    if (!focusSelector) return;
    const card = pagesHost.querySelector(`[data-index="${to}"]`);
    const pressed = card?.querySelector(focusSelector);
    // At either end the button just pressed is now disabled, so focus falls to
    // whatever else the card still offers rather than to nothing.
    const target = pressed && !pressed.disabled ? pressed : card?.querySelector('button:enabled');
    target?.focus();
  }

  function renderSummary() {
    const rotated = state.order.filter((entry) => entry.rotation !== 0).length;
    const parts = [`${state.order.length} halaman disimpan`];
    if (state.removed) parts.push(`${state.removed} dibuang`);
    if (rotated) parts.push(`${rotated} diputar`);

    summaryHost.textContent = parts.join(' · ');
    saveButton.disabled = state.busy || state.order.length === 0;
    undoButton.disabled = past.length === 0;
  }

  /* ------------------------------------------------------------ file intake */

  function clearDocument() {
    stopThumbnails?.();
    stopThumbnails = null;
    state.preview?.destroy?.();
    closeDocument(state.docId);

    state.file = null;
    state.docId = null;
    state.pageCount = 0;
    state.preview = null;
    state.order = [];
    state.removed = 0;
    past = [];
    thumbCache = new Map();
    rotationMemory = new Map();
    pagesHost.innerHTML = '';
    setVisible(detailHost, false);
    setStatus(null, '');
  }

  const loader = createFileLoader({
    id: 'organize',
    onReset: clearDocument,
    onReady: async (file, bytes) => {
      // `bytes` is handed to the worker, not copied, so the preview reads the
      // file again rather than sharing a buffer that no longer exists here.
      const { docId, pageCount } = await openDocument(bytes, file.name);

      state.file = file;
      state.docId = docId;
      state.pageCount = pageCount;
      state.preview = await openPreview(file);
      state.order = Array.from({ length: pageCount }, (_, index) => ({ index, rotation: 0 }));
      state.removed = 0;
      past = [];

      nameHost.textContent = file.name;
      metaHost.textContent = `${pageCount} halaman · ${formatBytes(file.size)}`;

      setVisible(detailHost, true);
      renderGrid();
    },
  });
  root.querySelector('[data-loader]').replaceWith(loader.element);

  /* --------------------------------------------------------------- events */

  root.querySelector('[data-reset]').addEventListener('click', () => loader.reset());

  undoButton.addEventListener('click', undo);

  // Ctrl/Cmd + Z, unless the visitor is typing somewhere.
  root.addEventListener('keydown', (event) => {
    if (!(event.ctrlKey || event.metaKey) || event.key.toLowerCase() !== 'z') return;
    if (event.target.closest('input, textarea')) return;
    event.preventDefault();
    undo();
  });

  root.querySelector('[data-rotate-all]').addEventListener('click', () => {
    remember();
    state.order.forEach((entry) => {
      entry.rotation = (entry.rotation + 90) % 360;
    });
    renderGrid();
  });

  root.querySelector('[data-restore]').addEventListener('click', () => {
    remember();
    state.order = Array.from({ length: state.pageCount }, (_, index) => ({
      index,
      rotation: 0,
    }));
    state.removed = 0;
    setStatus(null, '');
    renderGrid();
  });

  saveButton.addEventListener('click', async () => {
    state.busy = true;
    saveButton.disabled = true;
    setStatus('working', 'Menyusun ulang halaman…');

    try {
      const bytes = await arrangePages(state.docId, state.order);
      const filename = `${stripPdfExtension(state.file.name)}-tersusun.pdf`;

      const url = downloadBytes(bytes, filename, 'application/pdf', { keep: true });
      setStatus(
        'success',
        `Selesai. ${state.order.length} halaman disimpan sebagai "${escapeHtml(filename)}".` +
          resultLink(url),
      );
    } catch (error) {
      setStatus('error', escapeHtml(errorText(error)));
    } finally {
      state.busy = false;
      renderSummary();
    }
  });

  return root;
}
