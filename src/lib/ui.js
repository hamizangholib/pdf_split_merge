import {
  ArrowDown,
  ArrowLeft,
  ArrowUp,
  ChevronRight,
  CircleAlert,
  CircleCheck,
  Combine,
  Download,
  FileText,
  Files,
  GripVertical,
  Layers,
  LoaderCircle,
  Scissors,
  ShieldCheck,
  Trash2,
  Upload,
  createIcons,
} from 'lucide';

// Only the icons this app actually renders — importing lucide's full `icons`
// map would ship every icon in the library.
const usedIcons = {
  ArrowDown,
  ArrowLeft,
  ArrowUp,
  ChevronRight,
  CircleAlert,
  CircleCheck,
  Combine,
  Download,
  FileText,
  Files,
  GripVertical,
  Layers,
  LoaderCircle,
  Scissors,
  ShieldCheck,
  Trash2,
  Upload,
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

export function formatBytes(bytes) {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 KB';
  const units = ['B', 'KB', 'MB', 'GB'];
  const exponent = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  const value = bytes / 1024 ** exponent;
  return `${value >= 10 || exponent === 0 ? Math.round(value) : value.toFixed(1)} ${units[exponent]}`;
}

/** Keeps only real PDFs, so a stray file dropped on the zone is ignored. */
export function keepPdfs(fileList) {
  return Array.from(fileList).filter(
    (file) => file.type === 'application/pdf' || /\.pdf$/i.test(file.name),
  );
}

/** Triggers a browser download for the produced bytes. */
export function downloadBytes(bytes, filename, type = 'application/pdf') {
  const url = URL.createObjectURL(new Blob([bytes], { type }));
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  // Give the browser a moment to start the download before releasing the blob.
  setTimeout(() => URL.revokeObjectURL(url), 4000);
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
export function attachDropzone(zone, input, onFiles) {
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
    const files = keepPdfs(event.dataTransfer?.files ?? []);
    if (files.length) onFiles(files);
  });

  input.addEventListener('change', () => {
    const files = keepPdfs(input.files ?? []);
    if (files.length) onFiles(files);
    input.value = '';
  });
}

/* -------------------------------------------------------------------------
   Shared class recipes — the design system expressed as Tailwind strings.
   ------------------------------------------------------------------------- */

export const cls = {
  pillPrimary:
    'inline-flex items-center justify-center gap-2 rounded-full bg-action px-[22px] py-[11px] text-body text-white transition-transform active:scale-95 disabled:pointer-events-none disabled:bg-hairline disabled:text-ink-48',
  pillGhost:
    'inline-flex items-center justify-center gap-2 rounded-full border border-action px-[22px] py-[11px] text-body text-action transition-transform active:scale-95',
  pillGhostDark:
    'inline-flex items-center justify-center gap-2 rounded-full border border-action-dark px-[22px] py-[11px] text-body text-action-dark transition-transform active:scale-95',
  iconButton:
    'inline-flex size-9 items-center justify-center rounded-sm text-ink-48 transition-transform hover:text-ink active:scale-95 disabled:pointer-events-none disabled:opacity-30',
  card: 'rounded-lg border border-hairline bg-white p-6',
  link: 'text-action transition-opacity hover:opacity-70',
};

/** The dropzone shell, shared by both tools. */
export function dropzoneMarkup({ id, multiple, title, hint }) {
  return `
    <div class="space-y-4">
      <div
        id="${id}-zone"
        role="button"
        tabindex="0"
        class="dropzone flex cursor-pointer flex-col items-center justify-center gap-4 rounded-lg border border-hairline bg-white px-6 py-16 text-center transition-colors"
      >
        <span class="flex size-14 items-center justify-center rounded-full bg-parchment text-action">
          <i data-lucide="upload" class="size-6"></i>
        </span>
        <span class="text-tagline text-ink">${title}</span>
        <span class="max-w-md text-caption text-ink-48">${hint}</span>
        <span class="${cls.pillGhost} pointer-events-none">Pilih file</span>
      </div>
      <input
        id="${id}-input"
        type="file"
        accept="application/pdf,.pdf"
        ${multiple ? 'multiple' : ''}
        class="hidden"
      />
    </div>
  `;
}

/** Inline status banner: idle | working | success | error. */
export function statusMarkup(state, message) {
  if (!state || !message) return '';

  const themes = {
    working: { icon: 'loader-circle', tone: 'text-ink-80', spin: true },
    success: { icon: 'circle-check', tone: 'text-action', spin: false },
    error: { icon: 'circle-alert', tone: 'text-[#b3261e]', spin: false },
  };
  const theme = themes[state] ?? themes.working;

  return `
    <div class="flex items-start gap-3 rounded-lg bg-parchment px-5 py-4 ${theme.tone}" role="status" aria-live="polite">
      <i data-lucide="${theme.icon}" class="mt-0.5 size-[18px] shrink-0 ${theme.spin ? 'animate-spin' : ''}"></i>
      <p class="text-caption">${message}</p>
    </div>
  `;
}
