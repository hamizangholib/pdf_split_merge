import {
  cls,
  downloadBytes,
  errorText,
  escapeHtml,
  formatBytes,
  html,
  paintIcons,
  setVisible,
  statusMarkup,
  stripPdfExtension,
} from '../lib/ui.js';
import { arrangePages, loadDocument } from '../lib/pdf.js';
import { openPreview } from '../lib/preview.js';
import { attachDragReorder, attachThumbnails } from '../lib/pagegrid.js';
import { createFileLoader } from '../lib/loader.js';
import { subNavMarkup } from '../lib/nav.js';

export function renderOrganize() {
  /**
   * `order` is the document being built: one entry per surviving page, in
   * output order. `index` points at the source page, `rotation` is the extra
   * turn applied on top of whatever rotation that page already had.
   * @type {{ file: File|null, doc: any, preview: any, order: {index:number, rotation:number}[], removed: number, status: string|null, message: string, busy: boolean }}
   */
  const state = {
    file: null,
    doc: null,
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

  const root = html(`
    <div>
      ${subNavMarkup('#/organize')}

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
            <button type="button" data-rotate-all class="${cls.chip}">
              Putar semua 90°
            </button>
            <button type="button" data-restore class="${cls.chip}">
              Kembalikan ke urutan asli
            </button>
            <p data-summary class="ml-auto text-fine text-ink-48"></p>
          </div>

          <div
            data-pages
            class="grid grid-cols-2 gap-4 rounded-lg bg-pearl p-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5"
          ></div>

          <div data-status></div>

          <button type="button" data-save class="${cls.pillPrimary}">
            <i data-lucide="save" class="size-[18px]"></i>
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

  function renderStatus() {
    statusHost.innerHTML = statusMarkup(state.status, state.message);
    paintIcons(statusHost);
  }

  function setStatus(status, message) {
    state.status = status;
    state.message = message;
    renderStatus();
  }

  /* ------------------------------------------------------------- page grid */

  function pageCard(entry, position) {
    const sourcePage = entry.index + 1;

    const card = html(`
      <li
        draggable="true"
        data-index="${position}"
        data-page="${sourcePage}"
        class="relative flex cursor-grab flex-col gap-2 rounded-md border border-hairline bg-white p-2 active:cursor-grabbing"
      >
        <span class="absolute left-4 top-4 z-10 flex size-6 items-center justify-center rounded-full bg-action text-fine font-semibold text-white">
          ${position + 1}
        </span>
        <span data-thumb class="flex aspect-square w-full items-center justify-center overflow-hidden rounded-sm bg-parchment text-ink-48">
          <i data-lucide="loader-circle" class="size-5 animate-spin"></i>
        </span>
        <span class="flex items-center justify-between px-1">
          <span class="text-fine text-ink-48">Asal hal. ${sourcePage}</span>
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
    const applyRotation = () => {
      const image = card.querySelector('[data-thumb] img');
      if (image) image.style.transform = `rotate(${entry.rotation}deg)`;
    };
    card.addEventListener('thumbready', applyRotation);
    applyRotation();

    card.querySelector('[data-rotate]').addEventListener('click', (event) => {
      event.stopPropagation();
      entry.rotation = (entry.rotation + 90) % 360;
      applyRotation();
      renderSummary();
    });

    card.querySelector('[data-remove]').addEventListener('click', (event) => {
      event.stopPropagation();
      state.order.splice(position, 1);
      state.removed += 1;
      renderGrid();
    });

    return card;
  }

  function renderGrid() {
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
  }

  function move(from, to) {
    if (to < 0 || to >= state.order.length || from === to) return;
    const [moved] = state.order.splice(from, 1);
    state.order.splice(to, 0, moved);
    renderGrid();
  }

  function renderSummary() {
    const rotated = state.order.filter((entry) => entry.rotation !== 0).length;
    const parts = [`${state.order.length} halaman disimpan`];
    if (state.removed) parts.push(`${state.removed} dibuang`);
    if (rotated) parts.push(`${rotated} diputar`);

    summaryHost.textContent = parts.join(' · ');
    saveButton.disabled = state.busy || state.order.length === 0;
  }

  /* ------------------------------------------------------------ file intake */

  function clearDocument() {
    stopThumbnails?.();
    stopThumbnails = null;
    state.preview?.destroy?.();

    state.file = null;
    state.doc = null;
    state.preview = null;
    state.order = [];
    state.removed = 0;
    thumbCache = new Map();
    pagesHost.innerHTML = '';
    setVisible(detailHost, false);
    setStatus(null, '');
  }

  const loader = createFileLoader({
    id: 'organize',
    onReset: clearDocument,
    onReady: async (file, bytes) => {
      const doc = await loadDocument(file, bytes);
      const pageCount = doc.getPageCount();
      if (pageCount === 0) throw new Error('Dokumen ini tidak memiliki halaman.');

      state.file = file;
      state.doc = doc;
      state.preview = await openPreview(bytes);
      state.order = Array.from({ length: pageCount }, (_, index) => ({ index, rotation: 0 }));
      state.removed = 0;

      nameHost.textContent = file.name;
      metaHost.textContent = `${pageCount} halaman · ${formatBytes(file.size)}`;

      setVisible(detailHost, true);
      renderGrid();
    },
  });
  root.querySelector('[data-loader]').replaceWith(loader.element);

  /* --------------------------------------------------------------- events */

  root.querySelector('[data-reset]').addEventListener('click', () => loader.reset());

  root.querySelector('[data-rotate-all]').addEventListener('click', () => {
    state.order.forEach((entry) => {
      entry.rotation = (entry.rotation + 90) % 360;
    });
    renderGrid();
  });

  root.querySelector('[data-restore]').addEventListener('click', () => {
    state.order = Array.from({ length: state.doc.getPageCount() }, (_, index) => ({
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
      const bytes = await arrangePages(state.doc, state.order);
      const filename = `${stripPdfExtension(state.file.name)}-tersusun.pdf`;

      downloadBytes(bytes, filename);
      setStatus(
        'success',
        `Selesai. ${state.order.length} halaman disimpan sebagai "${escapeHtml(filename)}".`,
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
