import {
  attachDropzone,
  cls,
  downloadBytes,
  dropzoneMarkup,
  errorText,
  escapeHtml,
  fileKey,
  formatBytes,
  html,
  paintIcons,
  paintStatus,
  progressMarkup,
  resultLink,
  setProgress,
  setVisible,
} from '../lib/ui.js';
import { abortMerge, addToMerge, finishMerge, startMerge } from '../lib/pdf.js';
import { captureRects, collapseOut, fadeIn, playFlip } from '../lib/motion.js';

/** Files whose cover has already been on screen once. */
const coverShown = new WeakSet();
import { coverThumbnail } from '../lib/preview.js';
import { attachDragReorder } from '../lib/pagegrid.js';
import { subNavMarkup } from '../lib/nav.js';
import { brandIcon } from '../lib/icons.js';

export function renderMerge() {
  /** @type {{ files: File[], status: string|null, message: string, busy: boolean }} */
  const state = { files: [], status: null, message: '', busy: false };

  const root = html(`
    <div>
      ${subNavMarkup('gabungkan-pdf')}

      <section class="mx-auto max-w-[1120px] space-y-8 px-5 py-16">
        <header class="space-y-3">
          <h1 class="text-display-md text-ink">Gabungkan beberapa PDF</h1>
          <p class="max-w-[620px] text-body text-ink-80">
            Tambahkan dua file atau lebih, lihat pratinjau tiap file, atur urutannya
            dengan menariknya, lalu unduh hasil gabungannya.
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
            ${brandIcon('merge', 'size-[18px]')}
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
        data-key="${fileKey(file)}"
        class="relative flex cursor-grab flex-col gap-3 rounded-lg border border-hairline bg-white p-3 active:cursor-grabbing"
      >
        <span class="absolute left-5 top-5 z-10 flex size-6 items-center justify-center rounded-full bg-action text-fine font-semibold text-white">
          ${index + 1}
        </span>
        <i data-lucide="grip-vertical" class="absolute right-4 top-5 z-10 size-[18px] text-ink-48"></i>
        <span data-thumb class="flex aspect-[3/4] w-full items-center justify-center overflow-hidden rounded-sm bg-parchment text-ink-48">
          <i data-lucide="loader-circle" class="size-5 animate-spin"></i>
        </span>
        <span class="min-w-0 space-y-2 px-1">
          <span class="block truncate text-caption text-ink" title="${escapeHtml(file.name)}">${escapeHtml(file.name)}</span>
          <span data-meta class="block text-fine text-ink-48">${formatBytes(file.size)}</span>
          ${progressMarkup()}
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
          <button type="button" data-remove class="${cls.iconButton}" aria-label="Hapus file">
            <i data-lucide="trash-2" class="size-[18px]"></i>
          </button>
        </span>
      </li>
    `);

    const progressHost = row.querySelector('[data-progress]');
    setProgress(progressHost, 'reading', 0);

    // Cached per File, so dragging and reordering never re-rasterises a cover.
    coverThumbnail(file, {
      onStage: (stage, ratio) => setProgress(progressHost, stage, ratio),
    }).then((cover) => {
      const thumb = row.querySelector('[data-thumb]');
      if (!cover) {
        thumb.innerHTML = '<i data-lucide="circle-alert" class="size-5 text-[#b3261e]"></i>';
        paintIcons(thumb);
        return;
      }
      thumb.innerHTML = `<img src="${cover.url}" alt="Pratinjau ${escapeHtml(file.name)}" class="h-full w-full object-contain" />`;
      // The cover is cached per File, so only its first appearance is news;
      // every later re-render replays it and should not blink.
      if (!coverShown.has(file)) {
        coverShown.add(file);
        fadeIn(thumb.firstElementChild);
      }
      row.querySelector('[data-meta]').textContent =
        `${cover.pageCount} halaman · ${formatBytes(file.size)}`;
      // Cover and page count are proof enough that the file is ready.
      setVisible(progressHost, false);
    });

    row.querySelector('[data-up]').addEventListener('click', () => move(index, index - 1));
    row.querySelector('[data-down]').addEventListener('click', () => move(index, index + 1));
    row.querySelector('[data-remove]').addEventListener('click', async () => {
      await collapseOut(row);
      // The list may have been rebuilt while the row was shrinking, so the file
      // itself says where it now lives — `index` could be stale.
      const at = state.files.indexOf(file);
      if (at === -1) return;

      state.files.splice(at, 1);
      state.status = null;
      renderList();
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
    // Card positions before the wipe, so a reorder reads as movement.
    const rects = captureRects(listHost);
    listHost.innerHTML = '';

    if (state.files.length) {
      const heading = html(`
        <div class="mb-4 flex items-baseline justify-between">
          <h2 class="text-tagline text-ink">${state.files.length} file terpilih</h2>
          <p class="text-fine text-ink-48">Tarik kartu untuk mengubah urutan gabungan</p>
        </div>
      `);
      const list = document.createElement('ul');
      list.className = 'grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4';
      state.files.forEach((file, index) => list.appendChild(fileRow(file, index)));
      attachDragReorder(list, move);

      const wrapper = document.createElement('div');
      wrapper.append(heading, list);
      listHost.appendChild(wrapper);
    }

    mergeButton.disabled = state.busy || state.files.length < 2;
    setVisible(clearButton, state.files.length > 0);
    paintStatus(statusHost, state.status, state.message);
    paintIcons(root);
    // Last, so the icons have already taken their final size.
    playFlip(listHost, rects);
  }

  function setStatus(status, message) {
    state.status = status;
    state.message = message;
    paintStatus(statusHost, status, message);
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
    if (state.files.length < 2) {
      setStatus('error', 'Pilih minimal dua file PDF untuk digabungkan.');
      return;
    }

    state.busy = true;
    mergeButton.disabled = true;
    setStatus('working', `Menggabungkan ${state.files.length} file…`);

    // Files go over to the worker one at a time, so a twenty-file merge never
    // holds twenty files in memory at once.
    const { mergeId } = await startMerge();

    try {
      for (const [position, file] of state.files.entries()) {
        setStatus(
          'working',
          `Menggabungkan file ${position + 1} dari ${state.files.length}: "${escapeHtml(file.name)}"…`,
        );
        await addToMerge(mergeId, new Uint8Array(await file.arrayBuffer()), file.name);
      }

      const bytes = await finishMerge(mergeId);
      const url = downloadBytes(bytes, 'gabungan.pdf', 'application/pdf', { keep: true });
      setStatus('success', 'Selesai. File "gabungan.pdf" sedang diunduh.' + resultLink(url));
    } catch (error) {
      abortMerge(mergeId);
      setStatus('error', escapeHtml(errorText(error)));
    } finally {
      state.busy = false;
      mergeButton.disabled = state.files.length < 2;
    }
  });

  renderList();
  return root;
}
