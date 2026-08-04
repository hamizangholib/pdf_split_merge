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

export function renderSplit() {
  /** @type {{ file: File|null, doc: any, pageCount: number, status: string|null, message: string, busy: boolean }} */
  const state = {
    file: null,
    doc: null,
    pageCount: 0,
    status: null,
    message: '',
    busy: false,
  };

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
            Unggah satu PDF, tentukan halaman yang Anda perlukan, lalu simpan sebagai
            dokumen baru.
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
            <button type="button" data-all class="rounded-full bg-pearl px-4 py-2 text-caption text-ink-80 transition-transform active:scale-95">
              Pilih semua halaman
            </button>
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

  /** Live validation: turns the typed range into a plain-language summary. */
  function renderPreview() {
    const raw = rangeInput.value.trim();
    if (!raw) {
      previewHost.textContent = `Dokumen ini punya ${state.pageCount} halaman. Gunakan tanda hubung untuk rentang dan koma untuk memisahkan.`;
      previewHost.className = 'text-caption text-ink-48';
      splitButton.disabled = true;
      return;
    }

    try {
      const indices = parsePageRanges(raw, state.pageCount);
      previewHost.textContent = `${indices.length} halaman akan diambil: ${indices
        .map((index) => index + 1)
        .join(', ')}`;
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

      if (state.pageCount === 0) throw new Error('Dokumen ini tidak memiliki halaman.');

      nameHost.textContent = file.name;
      metaHost.textContent = `${state.pageCount} halaman · ${formatBytes(file.size)}`;
      rangeInput.value = '';

      setVisible(uploadHost, false);
      setVisible(detailHost, true);
      setStatus(null, '');
      renderPreview();
      rangeInput.focus();
    } catch (error) {
      reset();
      setStatus('error', escapeHtml(error.message));
    }
  }

  function reset() {
    state.file = null;
    state.doc = null;
    state.pageCount = 0;
    rangeInput.value = '';
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
      const filename = `${stripPdfExtension(state.file.name)}-halaman-${raw.replace(/\s+/g, '')}.pdf`;

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
