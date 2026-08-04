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
} from '../lib/ui.js';
import { mergePdfs } from '../lib/pdf.js';

export function renderMerge() {
  /** @type {{ files: File[], status: string|null, message: string, busy: boolean }} */
  const state = { files: [], status: null, message: '', busy: false };
  let dragIndex = null;

  const root = html(`
    <div>
      <!-- sub-nav-frosted -->
      <div class="sticky top-11 z-40 border-b border-hairline bg-parchment/80 backdrop-blur-xl backdrop-saturate-150">
        <div class="mx-auto flex h-[52px] max-w-[980px] items-center gap-4 px-5">
          <a href="#/" class="flex items-center gap-1.5 text-caption ${cls.link}">
            <i data-lucide="arrow-left" class="size-4"></i>
            Beranda
          </a>
          <span class="text-tagline text-ink">Gabungkan</span>
          <a href="#/split" class="ml-auto text-caption ${cls.link}">Pisahkan PDF</a>
        </div>
      </div>

      <section class="mx-auto max-w-[980px] space-y-8 px-5 py-16">
        <header class="space-y-3">
          <h1 class="text-display-md text-ink">Gabungkan beberapa PDF</h1>
          <p class="max-w-[620px] text-body text-ink-80">
            Tambahkan dua file atau lebih, atur urutannya, lalu unduh hasil gabungannya.
          </p>
        </header>

        ${dropzoneMarkup({
          id: 'merge',
          multiple: true,
          title: 'Tarik file PDF ke sini',
          hint: 'Atau klik untuk memilih. Anda bisa memilih beberapa file sekaligus, dan menambahkannya lagi kapan saja.',
        })}

        <div data-list></div>
        <div data-status></div>

        <div class="flex flex-wrap items-center gap-4">
          <button type="button" data-merge class="${cls.pillPrimary}" disabled>
            <i data-lucide="combine" class="size-[18px]"></i>
            Gabungkan PDF
          </button>
          <button type="button" data-clear class="${cls.pillGhost}" style="display: none">
            Bersihkan daftar
          </button>
        </div>
      </section>
    </div>
  `);

  const listHost = root.querySelector('[data-list]');
  const statusHost = root.querySelector('[data-status]');
  const mergeButton = root.querySelector('[data-merge]');
  const clearButton = root.querySelector('[data-clear]');

  /* ------------------------------------------------------------------ list */

  function fileRow(file, index) {
    const isFirst = index === 0;
    const isLast = index === state.files.length - 1;

    const row = html(`
      <li
        draggable="true"
        data-index="${index}"
        class="flex cursor-grab items-center gap-4 rounded-lg border border-hairline bg-white px-4 py-3 active:cursor-grabbing"
      >
        <i data-lucide="grip-vertical" class="size-[18px] shrink-0 text-ink-48"></i>
        <span class="flex size-10 shrink-0 items-center justify-center rounded-sm bg-parchment text-action">
          <i data-lucide="file-text" class="size-[18px]"></i>
        </span>
        <span class="min-w-0 flex-1">
          <span class="block truncate text-body text-ink">${escapeHtml(file.name)}</span>
          <span class="block text-fine text-ink-48">${index + 1} dari ${state.files.length} · ${formatBytes(file.size)}</span>
        </span>
        <span class="flex shrink-0 items-center gap-1">
          <button type="button" data-up class="${cls.iconButton}" aria-label="Naikkan urutan" ${isFirst ? 'disabled' : ''}>
            <i data-lucide="arrow-up" class="size-[18px]"></i>
          </button>
          <button type="button" data-down class="${cls.iconButton}" aria-label="Turunkan urutan" ${isLast ? 'disabled' : ''}>
            <i data-lucide="arrow-down" class="size-[18px]"></i>
          </button>
          <button type="button" data-remove class="${cls.iconButton}" aria-label="Hapus file">
            <i data-lucide="trash-2" class="size-[18px]"></i>
          </button>
        </span>
      </li>
    `);

    row.querySelector('[data-up]').addEventListener('click', () => move(index, index - 1));
    row.querySelector('[data-down]').addEventListener('click', () => move(index, index + 1));
    row.querySelector('[data-remove]').addEventListener('click', () => {
      state.files.splice(index, 1);
      state.status = null;
      renderList();
    });

    row.addEventListener('dragstart', () => {
      dragIndex = index;
      row.classList.add('opacity-40');
    });
    row.addEventListener('dragend', () => {
      dragIndex = null;
      row.classList.remove('opacity-40');
    });
    row.addEventListener('dragover', (event) => event.preventDefault());
    row.addEventListener('drop', (event) => {
      event.preventDefault();
      event.stopPropagation();
      if (dragIndex !== null) move(dragIndex, index);
    });

    return row;
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
          <h2 class="text-tagline text-ink">${state.files.length} file terpilih</h2>
          <p class="text-fine text-ink-48">Tarik baris untuk mengubah urutan</p>
        </div>
      `);
      const list = document.createElement('ul');
      list.className = 'space-y-2';
      state.files.forEach((file, index) => list.appendChild(fileRow(file, index)));

      const wrapper = document.createElement('div');
      wrapper.append(heading, list);
      listHost.appendChild(wrapper);
    }

    mergeButton.disabled = state.busy || state.files.length < 2;
    setVisible(clearButton, state.files.length > 0);
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

  /* --------------------------------------------------------------- actions */

  attachDropzone(
    root.querySelector('#merge-zone'),
    root.querySelector('#merge-input'),
    (files) => {
      state.files.push(...files);
      state.status = null;
      renderList();
    },
  );

  clearButton.addEventListener('click', () => {
    state.files = [];
    state.status = null;
    renderList();
  });

  mergeButton.addEventListener('click', async () => {
    state.busy = true;
    mergeButton.disabled = true;
    setStatus('working', `Menggabungkan ${state.files.length} file…`);

    try {
      const bytes = await mergePdfs(state.files);
      downloadBytes(bytes, 'gabungan.pdf');
      setStatus('success', 'Selesai. File "gabungan.pdf" sedang diunduh.');
    } catch (error) {
      setStatus('error', escapeHtml(error.message));
    } finally {
      state.busy = false;
      mergeButton.disabled = state.files.length < 2;
    }
  });

  renderList();
  return root;
}
