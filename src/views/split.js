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
import { extractPages, loadDocument, parsePageRanges } from '../lib/pdf.js';
import { openPreview } from '../lib/preview.js';
import { attachThumbnails } from '../lib/pagegrid.js';
import { createFileLoader } from '../lib/loader.js';
import { zipStore } from '../lib/zip.js';
import { subNavMarkup } from '../lib/nav.js';

/** Turns [1,2,3,5] into "1-3, 5", collapsing only ascending runs. */
function compressRanges(pages) {
  const parts = [];
  let start = null;
  let previous = null;

  for (const page of pages) {
    if (start === null) {
      start = page;
    } else if (page !== previous + 1) {
      parts.push(start === previous ? `${start}` : `${start}-${previous}`);
      start = page;
    }
    previous = page;
  }
  if (start !== null) parts.push(start === previous ? `${start}` : `${start}-${previous}`);
  return parts.join(', ');
}

/**
 * Filename tail describing the selection — the literal ranges when they stay
 * short, a plain count once they would make an unwieldy file name.
 */
function outputSuffix(indices) {
  const ranges = compressRanges(indices.map((index) => index + 1)).replace(/\s+/g, '');
  return ranges.length <= 40 ? `halaman-${ranges}` : `${indices.length}-halaman`;
}

export function renderSplit() {
  /** @type {{ file: File|null, doc: any, preview: any, pageCount: number, selection: number[], status: string|null, message: string, busy: boolean }} */
  const state = {
    file: null,
    doc: null,
    preview: null,
    pageCount: 0,
    selection: [],
    status: null,
    message: '',
    busy: false,
  };

  /** Torn down whenever a new file replaces the current one. */
  let stopThumbnails = null;

  const root = html(`
    <div>
      ${subNavMarkup('#/split')}

      <section class="mx-auto max-w-[1120px] space-y-8 px-5 py-16">
        <header class="space-y-3">
          <h1 class="text-display-md text-ink">Ambil halaman tertentu</h1>
          <p class="max-w-[620px] text-body text-ink-80">
            Unggah satu PDF, lihat pratinjau setiap halaman, pilih yang Anda perlukan,
            lalu simpan sebagai dokumen baru.
          </p>
        </header>

        <div data-loader></div>

        <!-- Controls on the left, page preview in its own scroller on the right,
             so a long document never pushes the controls off screen. -->
        <div
          data-detail
          class="grid items-start gap-8 lg:grid-cols-[minmax(0,380px)_minmax(0,1fr)]"
          style="display: none"
        >
          <div class="space-y-8 lg:sticky lg:top-[124px]">
            <!-- File info -->
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

            <!-- Range input -->
            <div class="space-y-4">
              <label for="ranges" class="block text-tagline text-ink">Halaman yang diambil</label>
              <input
                id="ranges"
                type="text"
                inputmode="numeric"
                autocomplete="off"
                placeholder="contoh: 1-3, 5, 7-10"
                class="h-11 w-full rounded-full border border-hairline bg-white px-5 text-body text-ink placeholder:text-ink-48"
              />
              <p data-preview class="text-caption text-ink-48"></p>
              <div class="flex flex-wrap gap-2">
                <button type="button" data-all class="${cls.chip}">Pilih semua halaman</button>
                <button type="button" data-none class="${cls.chip}">Kosongkan pilihan</button>
              </div>
            </div>

            <!-- Output shape -->
            <fieldset class="space-y-3">
              <legend class="mb-3 text-tagline text-ink">Bentuk hasil unduhan</legend>
              <label class="${cls.radioCard}">
                <input type="radio" name="output" value="single" checked class="mt-1 accent-action" />
                <span class="min-w-0">
                  <span class="block text-caption text-ink">Satu file gabungan</span>
                  <span class="block text-fine text-ink-48">Halaman terpilih digabung ke dalam satu PDF.</span>
                </span>
              </label>
              <label class="${cls.radioCard}">
                <input type="radio" name="output" value="zip" class="mt-1 accent-action" />
                <span class="min-w-0">
                  <span class="block text-caption text-ink">Terpisah per halaman (.zip)</span>
                  <span class="block text-fine text-ink-48">Setiap halaman jadi PDF sendiri, dibungkus satu arsip ZIP.</span>
                </span>
              </label>
            </fieldset>

            <div data-status></div>

            <button type="button" data-split class="${cls.pillPrimary}">
              <i data-lucide="scissors" class="size-[18px]"></i>
              Pisahkan PDF
            </button>
          </div>

          <!-- Page preview -->
          <div class="space-y-4">
            <div class="flex flex-wrap items-baseline justify-between gap-2">
              <h2 class="text-tagline text-ink">Pratinjau halaman</h2>
              <p class="text-fine text-ink-48">Klik halaman untuk memilih atau membatalkannya</p>
            </div>
            <div
              data-pages
              role="group"
              aria-label="Pilih halaman"
              class="grid max-h-[calc(100vh-190px)] grid-cols-2 gap-4 overflow-y-auto rounded-lg bg-pearl p-4 sm:grid-cols-3 xl:grid-cols-4"
            ></div>
          </div>
        </div>
      </section>
    </div>
  `);

  const detailHost = root.querySelector('[data-detail]');
  const nameHost = root.querySelector('[data-name]');
  const metaHost = root.querySelector('[data-meta]');
  const pagesHost = root.querySelector('[data-pages]');
  const previewHost = root.querySelector('[data-preview]');
  const statusHost = root.querySelector('[data-status]');
  const rangeInput = root.querySelector('#ranges');
  const splitButton = root.querySelector('[data-split]');

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

  function buildGrid() {
    stopThumbnails?.();
    pagesHost.innerHTML = '';

    for (let pageNumber = 1; pageNumber <= state.pageCount; pageNumber++) {
      const card = html(`
        <button
          type="button"
          data-page="${pageNumber}"
          aria-pressed="false"
          class="group relative flex flex-col gap-2 rounded-md border border-hairline bg-white p-2 text-left transition-transform active:scale-95"
        >
          <span data-thumb class="flex aspect-[3/4] w-full items-center justify-center overflow-hidden rounded-sm bg-parchment text-ink-48">
            <i data-lucide="loader-circle" class="size-5 animate-spin"></i>
          </span>
          <span class="flex items-center justify-between px-1 pb-0.5">
            <span class="text-fine text-ink-80">Halaman ${pageNumber}</span>
            <span data-order class="hidden size-5 items-center justify-center rounded-full bg-action text-[10px] font-semibold text-white"></span>
          </span>
        </button>
      `);
      card.addEventListener('click', () => togglePage(pageNumber));
      pagesHost.appendChild(card);
    }

    const document_ = state.preview;
    stopThumbnails = attachThumbnails(pagesHost, document_, {
      isStale: () => state.preview !== document_,
    });
    paintIcons(pagesHost);
  }

  /** Paints selected/unselected state and the 1-based output position badge. */
  function paintSelection() {
    const position = new Map(state.selection.map((page, index) => [page, index + 1]));

    for (const card of pagesHost.children) {
      const pageNumber = Number(card.dataset.page);
      const order = position.get(pageNumber);
      const selected = order !== undefined;

      card.setAttribute('aria-pressed', String(selected));
      card.classList.toggle('border-action', selected);
      card.classList.toggle('ring-2', selected);
      card.classList.toggle('ring-action', selected);
      card.classList.toggle('border-hairline', !selected);
      card.classList.toggle('opacity-45', !selected);

      const badge = card.querySelector('[data-order]');
      badge.textContent = order ?? '';
      badge.classList.toggle('hidden', !selected);
      badge.classList.toggle('flex', selected);
    }
  }

  function togglePage(pageNumber) {
    const index = state.selection.indexOf(pageNumber);
    if (index === -1) {
      state.selection.push(pageNumber);
      state.selection.sort((a, b) => a - b);
    } else {
      state.selection.splice(index, 1);
    }
    if (state.status === 'error' || state.status === 'success') setStatus(null, '');
    rangeInput.value = compressRanges(state.selection);
    renderPreview();
  }

  /** Live validation: the typed range drives both the summary and the grid. */
  function renderPreview() {
    const raw = rangeInput.value.trim();
    if (!raw) {
      state.selection = [];
      paintSelection();
      previewHost.textContent = `Dokumen ini punya ${state.pageCount} halaman. Klik halaman di atas, atau ketik rentang seperti 1-3, 5.`;
      previewHost.className = 'text-caption text-ink-48';
      splitButton.disabled = true;
      return;
    }

    try {
      state.selection = parsePageRanges(raw, state.pageCount).map((index) => index + 1);
      paintSelection();
      previewHost.textContent = `${state.selection.length} halaman akan diambil: ${state.selection.join(', ')}`;
      previewHost.className = 'text-caption text-ink-80';
      splitButton.disabled = state.busy;
    } catch (error) {
      previewHost.textContent = error.message;
      previewHost.className = 'text-caption text-[#b3261e]';
      splitButton.disabled = true;
    }
  }

  /* ------------------------------------------------------------ file intake */

  function clearDocument() {
    stopThumbnails?.();
    stopThumbnails = null;
    state.preview?.destroy?.();

    state.file = null;
    state.doc = null;
    state.preview = null;
    state.pageCount = 0;
    state.selection = [];
    rangeInput.value = '';
    pagesHost.innerHTML = '';
    setVisible(detailHost, false);
    setStatus(null, '');
  }

  const loader = createFileLoader({
    id: 'split',
    onReset: clearDocument,
    onReady: async (file, bytes) => {
      const doc = await loadDocument(file, bytes);
      state.file = file;
      state.doc = doc;
      state.pageCount = doc.getPageCount();
      state.selection = [];

      if (state.pageCount === 0) throw new Error('Dokumen ini tidak memiliki halaman.');

      state.preview = await openPreview(bytes);

      nameHost.textContent = file.name;
      metaHost.textContent = `${state.pageCount} halaman · ${formatBytes(file.size)}`;
      rangeInput.value = '';

      setVisible(detailHost, true);
      buildGrid();
      renderPreview();
    },
  });
  root.querySelector('[data-loader]').replaceWith(loader.element);

  /* --------------------------------------------------------------- events */

  root.querySelector('[data-reset]').addEventListener('click', () => loader.reset());

  root.querySelector('[data-all]').addEventListener('click', () => {
    rangeInput.value = `1-${state.pageCount}`;
    renderPreview();
  });

  root.querySelector('[data-none]').addEventListener('click', () => {
    rangeInput.value = '';
    renderPreview();
  });

  rangeInput.addEventListener('input', () => {
    if (state.status === 'error' || state.status === 'success') setStatus(null, '');
    renderPreview();
  });

  rangeInput.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' && !splitButton.disabled) splitButton.click();
  });

  splitButton.addEventListener('click', async () => {
    state.busy = true;
    splitButton.disabled = true;

    try {
      const raw = rangeInput.value.trim();
      const indices = parsePageRanges(raw, state.pageCount);
      const base = stripPdfExtension(state.file.name);
      const zipped = root.querySelector('input[name="output"]:checked').value === 'zip';

      let bytes;
      let filename;

      if (zipped) {
        const width = String(state.pageCount).length;
        const entries = [];

        for (const [position, index] of indices.entries()) {
          setStatus('working', `Menyiapkan halaman ${position + 1} dari ${indices.length}…`);
          // Yield so the progress line actually paints between pages.
          await new Promise((resolve) => setTimeout(resolve));
          entries.push({
            name: `${base}-halaman-${String(index + 1).padStart(width, '0')}.pdf`,
            bytes: await extractPages(state.doc, [index]),
          });
        }

        setStatus('working', 'Membungkus arsip ZIP…');
        bytes = zipStore(entries);
        filename = `${base}-${outputSuffix(indices)}.zip`;
      } else {
        setStatus('working', 'Mengekstrak halaman…');
        bytes = await extractPages(state.doc, indices);
        filename = `${base}-${outputSuffix(indices)}.pdf`;
      }

      downloadBytes(bytes, filename, zipped ? 'application/zip' : 'application/pdf');
      setStatus(
        'success',
        zipped
          ? `Selesai. ${indices.length} file PDF dibungkus dalam "${escapeHtml(filename)}".`
          : `Selesai. ${indices.length} halaman disimpan sebagai "${escapeHtml(filename)}".`,
      );
    } catch (error) {
      setStatus('error', escapeHtml(errorText(error)));
    } finally {
      state.busy = false;
      renderPreview();
    }
  });

  renderPreview();
  return root;
}
