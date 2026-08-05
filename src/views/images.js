import {
  attachDropzone,
  cls,
  downloadBytes,
  dropzoneMarkup,
  errorText,
  escapeHtml,
  formatBytes,
  html,
  keepImages,
  paintIcons,
  setVisible,
  statusMarkup,
} from '../lib/ui.js';
import { imagesToPdf } from '../lib/image.js';
import { attachDragReorder } from '../lib/pagegrid.js';
import { subNavMarkup } from '../lib/nav.js';
import { brandIcon } from '../lib/icons.js';

export function renderImages() {
  /** @type {{ files: File[], status: string|null, message: string, busy: boolean }} */
  const state = { files: [], status: null, message: '', busy: false };

  /** Object URLs live as long as their file stays in the list. */
  const previewUrls = new Map();

  const root = html(`
    <div>
      ${subNavMarkup('#/images')}

      <section class="mx-auto max-w-[1120px] space-y-8 px-5 py-16">
        <header class="space-y-3">
          <h1 class="text-display-md text-ink">Gambar ke PDF</h1>
          <p class="max-w-[620px] text-body text-ink-80">
            Tambahkan foto atau hasil pindaian, atur urutannya, lalu simpan sebagai satu
            PDF. Satu gambar menjadi satu halaman.
          </p>
        </header>

        ${dropzoneMarkup({
          id: 'images',
          multiple: true,
          accept: 'image/*',
          title: 'Tarik gambar ke sini',
          hint: 'JPG dan PNG langsung didukung. WebP, AVIF, GIF, dan BMP dikonversi otomatis. HEIC dari iPhone belum bisa dibaca browser.',
        })}

        <div data-list></div>

        <div data-options class="grid gap-6 md:grid-cols-2" style="display: none">
          <fieldset class="space-y-3">
            <legend class="mb-3 text-tagline text-ink">Ukuran halaman</legend>
            <label class="${cls.radioCard}">
              <input type="radio" name="page-size" value="fit" checked class="mt-1 accent-action" />
              <span class="min-w-0">
                <span class="block text-caption text-ink">Ikuti ukuran gambar</span>
                <span class="block text-fine text-ink-48">Tanpa bingkai putih, halaman persis sebesar gambarnya.</span>
              </span>
            </label>
            <label class="${cls.radioCard}">
              <input type="radio" name="page-size" value="a4" class="mt-1 accent-action" />
              <span class="min-w-0">
                <span class="block text-caption text-ink">A4</span>
                <span class="block text-fine text-ink-48">Gambar diperkecil agar muat, rasio tetap terjaga.</span>
              </span>
            </label>
            <label class="${cls.radioCard}">
              <input type="radio" name="page-size" value="letter" class="mt-1 accent-action" />
              <span class="min-w-0">
                <span class="block text-caption text-ink">Letter</span>
                <span class="block text-fine text-ink-48">Ukuran surat Amerika Utara.</span>
              </span>
            </label>
          </fieldset>

          <div class="space-y-6">
            <label class="block space-y-2">
              <span class="block text-tagline text-ink">Margin</span>
              <select
                data-margin
                class="h-11 w-full rounded-full border border-hairline bg-white px-5 text-body text-ink disabled:opacity-40"
              >
                <option value="0">Tanpa margin</option>
                <option value="28" selected>Sedang (1 cm)</option>
                <option value="57">Lebar (2 cm)</option>
              </select>
              <span data-margin-note class="block text-fine text-ink-48">
                Hanya berlaku untuk A4 dan Letter.
              </span>
            </label>
          </div>
        </div>

        <div data-status></div>

        <div class="flex flex-wrap items-center gap-4">
          <button type="button" data-build class="${cls.pillPrimary}" disabled>
            ${brandIcon('images', 'size-[18px]')}
            Buat PDF
          </button>
          <button type="button" data-clear class="${cls.pillGhost}" style="display: none">
            Bersihkan daftar
          </button>
        </div>
      </section>
    </div>
  `);

  const listHost = root.querySelector('[data-list]');
  const optionsHost = root.querySelector('[data-options]');
  const statusHost = root.querySelector('[data-status]');
  const marginSelect = root.querySelector('[data-margin]');
  const buildButton = root.querySelector('[data-build]');
  const clearButton = root.querySelector('[data-clear]');

  function previewUrl(file) {
    let url = previewUrls.get(file);
    if (!url) {
      url = URL.createObjectURL(file);
      previewUrls.set(file, url);
    }
    return url;
  }

  function forget(file) {
    const url = previewUrls.get(file);
    if (url) URL.revokeObjectURL(url);
    previewUrls.delete(file);
  }

  /* ------------------------------------------------------------------ list */

  function imageCard(file, index) {
    const isFirst = index === 0;
    const isLast = index === state.files.length - 1;

    const card = html(`
      <li
        draggable="true"
        data-index="${index}"
        class="relative flex cursor-grab flex-col gap-3 rounded-lg border border-hairline bg-white p-3 active:cursor-grabbing"
      >
        <span class="absolute left-5 top-5 z-10 flex size-6 items-center justify-center rounded-full bg-action text-fine font-semibold text-white">
          ${index + 1}
        </span>
        <i data-lucide="grip-vertical" class="absolute right-4 top-5 z-10 size-[18px] text-ink-48"></i>
        <span class="flex aspect-square w-full items-center justify-center overflow-hidden rounded-sm bg-parchment">
          <img src="${previewUrl(file)}" alt="Pratinjau ${escapeHtml(file.name)}" class="max-h-full max-w-full object-contain" />
        </span>
        <span class="min-w-0 px-1">
          <span class="block truncate text-caption text-ink" title="${escapeHtml(file.name)}">${escapeHtml(file.name)}</span>
          <span class="block text-fine text-ink-48">${formatBytes(file.size)}</span>
        </span>
        <span class="flex items-center justify-between">
          <span class="flex items-center gap-1">
            <button type="button" data-up class="${cls.iconButton}" aria-label="Pindahkan lebih awal" ${isFirst ? 'disabled' : ''}>
              <i data-lucide="arrow-up" class="size-[18px]"></i>
            </button>
            <button type="button" data-down class="${cls.iconButton}" aria-label="Pindahkan lebih akhir" ${isLast ? 'disabled' : ''}>
              <i data-lucide="arrow-down" class="size-[18px]"></i>
            </button>
          </span>
          <button type="button" data-remove class="${cls.iconButton}" aria-label="Hapus gambar">
            <i data-lucide="trash-2" class="size-[18px]"></i>
          </button>
        </span>
      </li>
    `);

    card.querySelector('[data-up]').addEventListener('click', () => move(index, index - 1));
    card.querySelector('[data-down]').addEventListener('click', () => move(index, index + 1));
    card.querySelector('[data-remove]').addEventListener('click', () => {
      forget(state.files[index]);
      state.files.splice(index, 1);
      state.status = null;
      renderList();
    });

    return card;
  }

  function move(from, to) {
    if (to < 0 || to >= state.files.length || from === to) return;
    const [moved] = state.files.splice(from, 1);
    state.files.splice(to, 0, moved);
    renderList();
  }

  function renderList() {
    listHost.innerHTML = '';

    if (state.files.length) {
      const heading = html(`
        <div class="mb-4 flex items-baseline justify-between">
          <h2 class="text-tagline text-ink">${state.files.length} gambar terpilih</h2>
          <p class="text-fine text-ink-48">Tarik kartu untuk mengubah urutan halaman</p>
        </div>
      `);
      const list = document.createElement('ul');
      list.className = 'grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4';
      state.files.forEach((file, index) => list.appendChild(imageCard(file, index)));
      attachDragReorder(list, move);

      const wrapper = document.createElement('div');
      wrapper.append(heading, list);
      listHost.appendChild(wrapper);
    }

    buildButton.disabled = state.busy || state.files.length === 0;
    setVisible(clearButton, state.files.length > 0);
    setVisible(optionsHost, state.files.length > 0);
    renderStatus();
    paintIcons(root);
  }

  function renderStatus() {
    statusHost.innerHTML = statusMarkup(state.status, state.message);
    paintIcons(statusHost);
  }

  function setStatus(status, message) {
    state.status = status;
    state.message = message;
    renderStatus();
  }

  /** Puts a red outline on the cards whose files could not be converted. */
  function markSkipped(skipped) {
    const failed = new Set(skipped.map((entry) => entry.file));
    [...listHost.querySelectorAll('li[data-index]')].forEach((card, index) => {
      const bad = failed.has(state.files[index]);
      card.classList.toggle('border-[#b3261e]', bad);
      card.classList.toggle('border-hairline', !bad);
    });
  }

  function currentPageSize() {
    return root.querySelector('input[name="page-size"]:checked').value;
  }

  function syncMarginState() {
    marginSelect.disabled = currentPageSize() === 'fit';
  }

  /* --------------------------------------------------------------- actions */

  attachDropzone(
    root.querySelector('#images-zone'),
    root.querySelector('#images-input'),
    (files) => {
      state.files.push(...files);
      state.status = null;
      renderList();
      syncMarginState();
    },
    keepImages,
  );

  root.querySelectorAll('input[name="page-size"]').forEach((input) =>
    input.addEventListener('change', syncMarginState),
  );

  clearButton.addEventListener('click', () => {
    state.files.forEach(forget);
    state.files = [];
    state.status = null;
    renderList();
  });

  buildButton.addEventListener('click', async () => {
    state.busy = true;
    buildButton.disabled = true;

    try {
      const { bytes, skipped } = await imagesToPdf(
        state.files,
        {
          pageSize: currentPageSize(),
          margin: Number(marginSelect.value),
        },
        async (position, file) => {
          setStatus(
            'working',
            `Menyiapkan gambar ${position + 1} dari ${state.files.length}: "${escapeHtml(file.name)}"…`,
          );
          // Yield so the progress line paints between images.
          await new Promise((resolve) => setTimeout(resolve));
        },
      );

      downloadBytes(bytes, 'gambar.pdf');

      const converted = state.files.length - skipped.length;
      const skippedNames = skipped.map((entry) => `"${escapeHtml(entry.file.name)}"`).join(', ');
      setStatus(
        skipped.length ? 'warning' : 'success',
        skipped.length
          ? `${converted} gambar disimpan sebagai "gambar.pdf". ${skipped.length} dilewati karena tidak bisa dibaca: ${skippedNames}.`
          : `Selesai. ${converted} gambar disimpan sebagai "gambar.pdf".`,
      );
      markSkipped(skipped);
    } catch (error) {
      setStatus('error', escapeHtml(errorText(error)));
    } finally {
      state.busy = false;
      buildButton.disabled = state.files.length === 0;
    }
  });

  renderList();
  syncMarginState();
  return root;
}
