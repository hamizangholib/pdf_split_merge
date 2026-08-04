import {
  attachDropzone,
  cls,
  downloadBytes,
  dropzoneMarkup,
  escapeHtml,
  formatBytes,
  html,
  paintIcons,
  setVisible,
  statusMarkup,
  stripPdfExtension,
} from '../lib/ui.js';
import { extractPages, loadDocument, parsePageRanges } from '../lib/pdf.js';
import { openPreview, renderThumbnail, renderWhenVisible } from '../lib/preview.js';

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
  let stopObserving = null;

  const root = html(`
    <div>
      <!-- sub-nav-frosted -->
      <div class="sticky top-11 z-40 border-b border-hairline bg-parchment/80 backdrop-blur-xl backdrop-saturate-150">
        <div class="mx-auto flex h-[52px] max-w-[980px] items-center gap-4 px-5">
          <a href="#/" class="flex items-center gap-1.5 text-caption ${cls.link}">
            <i data-lucide="arrow-left" class="size-4"></i>
            Beranda
          </a>
          <span class="text-tagline text-ink">Pisahkan</span>
          <a href="#/merge" class="ml-auto text-caption ${cls.link}">Gabungkan PDF</a>
        </div>
      </div>

      <section class="mx-auto max-w-[980px] space-y-8 px-5 py-16">
        <header class="space-y-3">
          <h1 class="text-display-md text-ink">Ambil halaman tertentu</h1>
          <p class="max-w-[620px] text-body text-ink-80">
            Unggah satu PDF, lihat pratinjau setiap halaman, pilih yang Anda perlukan,
            lalu simpan sebagai dokumen baru.
          </p>
        </header>

        <div data-upload>
          ${dropzoneMarkup({
            id: 'split',
            multiple: false,
            title: 'Tarik satu file PDF ke sini',
            hint: 'Atau klik untuk memilih file dari perangkat Anda.',
          })}
        </div>

        <div data-detail class="space-y-8" style="display: none">
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
              class="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5"
            ></div>
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
              class="h-11 w-full max-w-[420px] rounded-full border border-hairline bg-white px-5 text-body text-ink placeholder:text-ink-48"
            />
            <p data-preview class="text-caption text-ink-48"></p>
            <div class="flex flex-wrap gap-2">
              <button type="button" data-all class="rounded-full bg-pearl px-4 py-2 text-caption text-ink-80 transition-transform active:scale-95">
                Pilih semua halaman
              </button>
              <button type="button" data-none class="rounded-full bg-pearl px-4 py-2 text-caption text-ink-80 transition-transform active:scale-95">
                Kosongkan pilihan
              </button>
            </div>
          </div>

          <div data-status></div>

          <button type="button" data-split class="${cls.pillPrimary}">
            <i data-lucide="scissors" class="size-[18px]"></i>
            Pisahkan PDF
          </button>
        </div>
      </section>
    </div>
  `);

  const uploadHost = root.querySelector('[data-upload]');
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

  function pageCard(pageNumber) {
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
    return card;
  }

  function buildGrid() {
    stopObserving?.();
    pagesHost.innerHTML = '';

    const disconnectors = [];
    for (let pageNumber = 1; pageNumber <= state.pageCount; pageNumber++) {
      const card = pageCard(pageNumber);
      pagesHost.appendChild(card);

      const document_ = state.preview;
      disconnectors.push(
        renderWhenVisible(card, async () => {
          // The file may have been swapped out while this card waited offscreen.
          if (state.preview !== document_) return;
          const thumb = card.querySelector('[data-thumb]');
          try {
            const url = await renderThumbnail(document_, pageNumber);
            if (state.preview !== document_) return;
            thumb.innerHTML = `<img src="${url}" alt="Pratinjau halaman ${pageNumber}" class="h-full w-full object-contain" />`;
          } catch {
            thumb.innerHTML = '<i data-lucide="file-text" class="size-5"></i>';
            paintIcons(thumb);
          }
        }),
      );
    }

    stopObserving = () => disconnectors.forEach((stop) => stop());
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

  async function acceptFile(file) {
    setStatus('working', `Membaca "${escapeHtml(file.name)}"…`);
    try {
      const doc = await loadDocument(file);
      state.file = file;
      state.doc = doc;
      state.pageCount = doc.getPageCount();
      state.selection = [];

      if (state.pageCount === 0) throw new Error('Dokumen ini tidak memiliki halaman.');

      state.preview = await openPreview(file);

      nameHost.textContent = file.name;
      metaHost.textContent = `${state.pageCount} halaman · ${formatBytes(file.size)}`;
      rangeInput.value = '';

      setVisible(uploadHost, false);
      setVisible(detailHost, true);
      setStatus(null, '');
      buildGrid();
      renderPreview();
    } catch (error) {
      reset();
      setStatus('error', escapeHtml(error.message));
    }
  }

  function reset() {
    stopObserving?.();
    stopObserving = null;
    state.preview?.destroy?.();

    state.file = null;
    state.doc = null;
    state.preview = null;
    state.pageCount = 0;
    state.selection = [];
    rangeInput.value = '';
    pagesHost.innerHTML = '';
    setVisible(uploadHost, true);
    setVisible(detailHost, false);
    setStatus(null, '');
  }

  /* --------------------------------------------------------------- events */

  attachDropzone(
    root.querySelector('#split-zone'),
    root.querySelector('#split-input'),
    (files) => acceptFile(files[0]),
  );

  root.querySelector('[data-reset]').addEventListener('click', reset);

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
    setStatus('working', 'Mengekstrak halaman…');

    try {
      const raw = rangeInput.value.trim();
      const indices = parsePageRanges(raw, state.pageCount);
      const bytes = await extractPages(state.doc, indices);
      const filename = `${stripPdfExtension(state.file.name)}-halaman-${compressRanges(
        indices.map((index) => index + 1),
      ).replace(/\s+/g, '')}.pdf`;

      downloadBytes(bytes, filename);
      setStatus(
        'success',
        `Selesai. ${indices.length} halaman disimpan sebagai "${escapeHtml(filename)}".`,
      );
    } catch (error) {
      setStatus('error', escapeHtml(error.message));
    } finally {
      state.busy = false;
      renderPreview();
    }
  });

  renderPreview();
  return root;
}
