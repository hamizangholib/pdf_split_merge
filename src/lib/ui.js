import {
  ArrowDown,
  ArrowLeft,
  ArrowUp,
  ChevronRight,
  CircleAlert,
  CircleCheck,
  Download,
  FileText,
  GripVertical,
  Layers,
  LoaderCircle,
  Menu,
  RotateCw,
  ShieldCheck,
  Trash2,
  Upload,
  X,
  createIcons,
} from 'lucide';
import { riseIn } from './motion.js';

// Only the icons this app actually renders — importing lucide's full `icons`
// map would ship every icon in the library. The five tool marks and the brand
// glyph are not here: those live in icons.js as hand-drawn SVG.
const usedIcons = {
  ArrowDown,
  ArrowLeft,
  ArrowUp,
  ChevronRight,
  CircleAlert,
  CircleCheck,
  Download,
  FileText,
  GripVertical,
  Layers,
  LoaderCircle,
  Menu,
  RotateCw,
  ShieldCheck,
  Trash2,
  Upload,
  X,
};

/** Replaces every [data-lucide] placeholder inside `root` with its SVG. */
export function paintIcons(root = document.body) {
  createIcons({ icons: usedIcons, root, attrs: { 'stroke-width': 1.8 } });
}

/** Builds an element from an HTML string. */
export function html(markup) {
  const template = document.createElement('template');
  template.innerHTML = markup.trim();
  return template.content.firstElementChild;
}

/**
 * Shows or hides an element. Uses an inline style rather than Tailwind's
 * `hidden` class, which loses to display utilities such as `inline-flex`.
 */
export function setVisible(element, visible) {
  element.style.display = visible ? '' : 'none';
}

/** Escapes user-supplied text (file names, error messages) before interpolation. */
export function escapeHtml(value) {
  return String(value).replace(
    /[&<>"']/g,
    (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char],
  );
}

/**
 * Not every thrown value carries a usable `message` — pdf-lib's image decoders
 * in particular throw objects that stringify to nothing, which used to surface
 * in the UI as the literal word "undefined".
 */
export function errorText(error) {
  const message = error?.message ?? (typeof error === 'string' ? error : '');
  return message.trim() || 'Terjadi kesalahan yang tidak terduga saat memproses file ini.';
}

export function formatBytes(bytes) {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 KB';
  const units = ['B', 'KB', 'MB', 'GB'];
  const exponent = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  const value = bytes / 1024 ** exponent;
  return `${value >= 10 || exponent === 0 ? Math.round(value) : value.toFixed(1)} ${units[exponent]}`;
}

/**
 * A stable identity for a picked file.
 *
 * The lists rebuild themselves from scratch on every change, so a card needs
 * something that survives the rebuild to be recognised as the same card. Name
 * and size will not do — the same document can legitimately be added twice —
 * so identity follows the File object itself.
 */
const fileKeys = new WeakMap();
let nextFileKey = 0;

export function fileKey(file) {
  if (!fileKeys.has(file)) fileKeys.set(file, `file-${++nextFileKey}`);
  return fileKeys.get(file);
}

/** Keeps only real PDFs, so a stray file dropped on the zone is ignored. */
export function keepPdfs(fileList) {
  return Array.from(fileList).filter(
    (file) => file.type === 'application/pdf' || /\.pdf$/i.test(file.name),
  );
}

/** Keeps only images the browser can decode into a canvas. */
export function keepImages(fileList) {
  return Array.from(fileList).filter(
    (file) => file.type.startsWith('image/') || /\.(jpe?g|png|webp|gif|bmp|avif)$/i.test(file.name),
  );
}

/** Keeps only text files a markdown parser can make sense of. */
export function keepMarkdown(fileList) {
  return Array.from(fileList).filter(
    (file) =>
      file.type === 'text/markdown' ||
      file.type === 'text/plain' ||
      /\.(md|markdown|mdown|mkd|txt)$/i.test(file.name),
  );
}

/**
 * The blob behind the most recent result that is still openable. Only one is
 * kept: the previous one goes the moment a new result replaces it, so a long
 * session never accumulates finished documents in memory.
 */
let lastKeptUrl = null;

/**
 * Triggers a browser download for the produced bytes and returns its blob URL.
 *
 * With `keep`, the URL stays alive so the result can also be opened in a tab —
 * otherwise it is released a few seconds after the download starts.
 */
export function downloadBytes(bytes, filename, type = 'application/pdf', { keep = false } = {}) {
  const url = URL.createObjectURL(new Blob([bytes], { type }));
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();

  if (keep) {
    if (lastKeptUrl) URL.revokeObjectURL(lastKeptUrl);
    lastKeptUrl = url;
  } else {
    // Give the browser a moment to start the download before releasing the blob.
    setTimeout(() => URL.revokeObjectURL(url), 4000);
  }

  return url;
}

/**
 * "Open the result" link for a status message.
 *
 * A downloaded file is easy to lose track of — in a folder, behind a download
 * shelf, or on a phone where the download UI is a notification. This puts the
 * finished document one click away, in the browser's own viewer.
 */
export function resultLink(url, label = 'Lihat hasil') {
  return ` <a href="${url}" target="_blank" rel="noopener" class="font-medium underline underline-offset-2">${label}</a>`;
}

/**
 * Reads a File into memory while reporting progress (0..1).
 *
 * Nothing is uploaded — this is the browser pulling the file off disk — but it
 * is the only phase with a real percentage, so it is what the bar shows.
 */
export function readFileBytes(file, onProgress) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onprogress = (event) => {
      if (event.lengthComputable) onProgress?.(event.loaded / event.total);
    };
    reader.onload = () => {
      onProgress?.(1);
      resolve(new Uint8Array(reader.result));
    };
    reader.onerror = () =>
      reject(new Error(`"${file.name}" gagal dibaca dari perangkat Anda.`));
    reader.readAsArrayBuffer(file);
  });
}

/* --------------------------------------------------------- file progress */

const stageLabels = {
  idle: 'Belum diunggah',
  reading: 'Membaca file',
  processing: 'Memproses PDF',
  ready: 'Siap',
  error: 'Gagal dibaca',
};

/** Progress row: a stage label, a percentage, and a bar. */
export function progressMarkup() {
  return `
    <span data-progress class="block space-y-1.5">
      <span class="flex items-center justify-between gap-3">
        <span data-stage class="text-fine text-ink-48">${stageLabels.idle}</span>
        <span data-percent class="text-fine tabular-nums text-ink-48"></span>
      </span>
      <span class="block h-1.5 overflow-hidden rounded-full bg-parchment">
        <span data-bar class="block h-full w-0 rounded-full bg-action transition-[width] duration-150"></span>
      </span>
    </span>
  `;
}

/**
 * Paints a progress row. `ratio` only applies to the reading stage; the other
 * stages have no measurable percentage, so the bar just reflects the state.
 */
export function setProgress(host, stage, ratio = 0, detail = '') {
  const bar = host.querySelector('[data-bar]');
  const percent = stage === 'reading' ? Math.round(ratio * 100) : stage === 'idle' ? 0 : 100;

  host.querySelector('[data-stage]').textContent = detail || stageLabels[stage];
  host.querySelector('[data-percent]').textContent =
    stage === 'reading' ? `${percent}%` : stage === 'ready' ? 'Selesai' : '';

  bar.style.width = `${percent}%`;
  bar.classList.toggle('bg-action', stage !== 'error');
  bar.classList.toggle('bg-[#b3261e]', stage === 'error');
  bar.classList.toggle('animate-pulse', stage === 'processing');
}

export function stripPdfExtension(name) {
  return name.replace(/\.pdf$/i, '');
}

/**
 * Wires the shared drag & drop behaviour onto a dropzone element.
 * `onFiles` receives an array of PDF files.
 */
export function attachDropzone(zone, input, onFiles, filter = keepPdfs) {
  const setDragging = (active) => zone.classList.toggle('is-dragging', active);

  zone.addEventListener('click', () => input.click());
  zone.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      input.click();
    }
  });

  ['dragenter', 'dragover'].forEach((type) =>
    zone.addEventListener(type, (event) => {
      event.preventDefault();
      setDragging(true);
    }),
  );

  ['dragleave', 'drop'].forEach((type) =>
    zone.addEventListener(type, (event) => {
      event.preventDefault();
      if (type === 'dragleave' && zone.contains(event.relatedTarget)) return;
      setDragging(false);
    }),
  );

  zone.addEventListener('drop', (event) => {
    const files = filter(event.dataTransfer?.files ?? []);
    if (files.length) onFiles(files);
  });

  input.addEventListener('change', () => {
    const files = filter(input.files ?? []);
    if (files.length) onFiles(files);
    input.value = '';
  });

  // Paste anywhere on the page, so a screenshot or a file copied in the file
  // manager can go straight in. The listener has to sit on the document — a
  // paste is only delivered to the focused element — so it retires itself once
  // its zone has been replaced by another view.
  const onPaste = (event) => {
    if (!zone.isConnected) {
      document.removeEventListener('paste', onPaste);
      return;
    }
    const files = filter(event.clipboardData?.files ?? []);
    if (!files.length) return;
    event.preventDefault();
    onFiles(files);
  };
  document.addEventListener('paste', onPaste);
}

/* -------------------------------------------------------------------------
   Shared class recipes — the design system expressed as Tailwind strings.
   ------------------------------------------------------------------------- */

export const cls = {
  pillPrimary:
    'inline-flex items-center justify-center gap-2 rounded-full bg-brand-gradient px-7 py-3 text-caption font-medium text-white shadow-soft transition-all hover:-translate-y-0.5 active:translate-y-0 disabled:pointer-events-none disabled:bg-none disabled:bg-hairline disabled:text-ink-48 disabled:shadow-none',
  pillGhost:
    'inline-flex items-center justify-center gap-2 rounded-full border border-action bg-white px-7 py-3 text-caption font-medium text-action transition-all hover:bg-action hover:text-white active:translate-y-0',
  pillGhostDark:
    'inline-flex items-center justify-center gap-2 rounded-full border border-action-dark px-7 py-3 text-caption font-medium text-action-dark transition-all hover:bg-action-dark hover:text-tile-1',
  iconButton:
    'inline-flex size-9 items-center justify-center rounded-full text-ink-48 transition-colors hover:bg-parchment hover:text-action active:scale-95 disabled:pointer-events-none disabled:opacity-30',
  card: 'rounded-md bg-white p-6 shadow-soft',
  link: 'text-action transition-opacity hover:opacity-70',
  chip: 'rounded-full bg-parchment px-4 py-2 text-caption text-ink-80 transition-colors hover:bg-white hover:text-action hover:shadow-soft disabled:pointer-events-none disabled:opacity-40',
  radioCard:
    'flex cursor-pointer items-start gap-3 rounded-md border border-hairline bg-white p-4 transition-colors has-checked:border-action has-checked:shadow-soft',
};

/** The dropzone shell, shared by both tools. */
export function dropzoneMarkup({ id, multiple, title, hint, accept = 'application/pdf,.pdf' }) {
  return `
    <div class="space-y-4">
      <div
        id="${id}-zone"
        role="button"
        tabindex="0"
        class="dropzone flex cursor-pointer flex-col items-center justify-center gap-4 rounded-md border border-dashed border-hairline bg-white px-6 py-16 text-center shadow-soft transition-colors"
      >
        <span class="dropzone-glyph flex size-14 items-center justify-center rounded-full bg-brand-gradient text-white">
          <i data-lucide="upload" class="size-6"></i>
        </span>
        <span class="text-tagline text-ink">${title}</span>
        <span class="max-w-md text-caption text-ink-48">${hint}</span>
        <span class="${cls.pillGhost} pointer-events-none">Pilih file</span>
        <span class="text-fine text-ink-48">atau tempel dengan Ctrl + V</span>
      </div>
      <input
        id="${id}-input"
        type="file"
        accept="${accept}"
        ${multiple ? 'multiple' : ''}
        class="hidden"
      />
    </div>
  `;
}

/**
 * Paints a status banner into `host`, animating it only when the state itself
 * changes.
 *
 * Every tool used to hard-swap the banner, so "processing" vanished and
 * "finished" appeared as two unrelated events for one thing happening. The
 * message can still tick along inside a state (file 3 of 12) without the banner
 * jumping each time.
 */
const bannerState = new WeakMap();

export function paintStatus(host, state, message) {
  const previous = bannerState.get(host);
  host.innerHTML = statusMarkup(state, message);
  paintIcons(host);
  bannerState.set(host, state);

  if (state && state !== previous) riseIn(host.firstElementChild);
}

/** Inline status banner: idle | working | success | error. */
export function statusMarkup(state, message) {
  if (!state || !message) return '';

  const themes = {
    working: { icon: 'loader-circle', tone: 'text-ink-80', spin: true },
    success: { icon: 'circle-check', tone: 'text-action', spin: false },
    warning: { icon: 'circle-alert', tone: 'text-[#8a5a00]', spin: false },
    error: { icon: 'circle-alert', tone: 'text-[#b3261e]', spin: false },
  };
  const theme = themes[state] ?? themes.working;

  return `
    <div class="flex items-start gap-3 rounded-md bg-parchment px-5 py-4 ${theme.tone}" role="status" aria-live="polite">
      <i data-lucide="${theme.icon}" class="mt-0.5 size-[18px] shrink-0 ${theme.spin ? 'animate-spin' : ''}"></i>
      <p class="text-caption">${message}</p>
    </div>
  `;
}
