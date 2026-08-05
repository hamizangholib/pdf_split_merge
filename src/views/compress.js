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
import { loadDocument } from '../lib/pdf.js';
import { compressPdf } from '../lib/compress.js';
import { createFileLoader } from '../lib/loader.js';
import { subNavMarkup } from '../lib/nav.js';
import { brandIcon } from '../lib/icons.js';

export function renderCompress() {
  /** @type {{ file: File|null, bytes: Uint8Array|null, pageCount: number, status: string|null, message: string, busy: boolean }} */
  const state = { file: null, bytes: null, pageCount: 0, status: null, message: '', busy: false };

  const root = html(`
    <div>
      ${subNavMarkup('#/compress')}

      <section class="mx-auto max-w-[820px] space-y-8 px-5 py-16">
        <header class="space-y-3">
          <h1 class="text-display-md text-ink">Perkecil ukuran PDF</h1>
          <p class="max-w-[620px] text-body text-ink-80">
            Tanpa mengubah halaman menjadi gambar — teks tetap bisa diseleksi dan dicari,
            formulir tetap berfungsi.
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

          <fieldset class="space-y-3">
            <legend class="mb-3 text-tagline text-ink">Tingkat kompresi</legend>
            <label class="${cls.radioCard}">
              <input type="radio" name="level" value="light" checked class="mt-1 accent-action" />
              <span class="min-w-0">
                <span class="block text-caption text-ink">Ringan — rapikan struktur</span>
                <span class="block text-fine text-ink-48">
                  Menulis ulang file dan membuang sisa penyuntingan sebelumnya. Isi
                  dokumen sama persis. Penghematan biasanya kecil, dan pada file yang
                  sudah rapi bisa nol.
                </span>
              </span>
            </label>
            <label class="${cls.radioCard}">
              <input type="radio" name="level" value="medium" class="mt-1 accent-action" />
              <span class="min-w-0">
                <span class="block text-caption text-ink">Sedang — kecilkan gambar JPEG</span>
                <span class="block text-fine text-ink-48">
                  Gambar JPEG di dalam dokumen diturunkan ke maksimal 2000 piksel pada
                  sisi terpanjang dan dikompresi ulang. Sangat efektif untuk hasil
                  pindaian; hampir tidak berpengaruh pada dokumen yang isinya teks saja.
                </span>
              </span>
            </label>
          </fieldset>

          <p class="text-fine text-ink-48">
            Kompresi maksimal dan target ukuran tidak tersedia di sini: satu-satunya cara
            menjamin ukuran tertentu adalah mengubah setiap halaman menjadi gambar, dan
            itu menghapus teks dari dokumen.
          </p>

          <div data-status></div>

          <button type="button" data-compress class="${cls.pillPrimary}">
            ${brandIcon('compress', 'size-[18px]')}
            Perkecil PDF
          </button>
        </div>
      </section>
    </div>
  `);

  const detailHost = root.querySelector('[data-detail]');
  const nameHost = root.querySelector('[data-name]');
  const metaHost = root.querySelector('[data-meta]');
  const statusHost = root.querySelector('[data-status]');
  const compressButton = root.querySelector('[data-compress]');

  function setStatus(status, message) {
    state.status = status;
    state.message = message;
    statusHost.innerHTML = statusMarkup(status, message);
    paintIcons(statusHost);
  }

  function clearDocument() {
    state.file = null;
    state.bytes = null;
    state.pageCount = 0;
    setVisible(detailHost, false);
    setStatus(null, '');
  }

  const loader = createFileLoader({
    id: 'compress',
    onReset: clearDocument,
    onReady: async (file, bytes) => {
      const doc = await loadDocument(file, bytes);
      state.file = file;
      // Kept so every run starts from the untouched original rather than from
      // an already-compressed document.
      state.bytes = bytes;
      state.pageCount = doc.getPageCount();

      nameHost.textContent = file.name;
      metaHost.textContent = `${state.pageCount} halaman · ${formatBytes(file.size)}`;
      setVisible(detailHost, true);
    },
  });
  root.querySelector('[data-loader]').replaceWith(loader.element);

  root.querySelector('[data-reset]').addEventListener('click', () => loader.reset());

  compressButton.addEventListener('click', async () => {
    state.busy = true;
    compressButton.disabled = true;
    setStatus('working', 'Membaca ulang dokumen…');

    try {
      const level = root.querySelector('input[name="level"]:checked').value;
      const doc = await loadDocument(state.file, state.bytes.slice());

      const { bytes, recoded } = await compressPdf(doc, level, async (position, total) => {
        setStatus('working', `Mengompresi gambar ${position + 1} dari ${total}…`);
        // Yield so the progress line paints between images.
        await new Promise((resolve) => setTimeout(resolve));
      });

      const before = state.file.size;
      const saved = before - bytes.length;
      const percent = Math.round((saved / before) * 100);

      if (saved <= 0) {
        setStatus(
          'warning',
          `Tidak ada penghematan: hasilnya ${formatBytes(bytes.length)}, sama atau lebih besar dari aslinya (${formatBytes(before)}). File ini sudah padat — tidak diunduh agar Anda tidak menyimpan versi yang lebih besar.`,
        );
        return;
      }

      const filename = `${stripPdfExtension(state.file.name)}-kecil.pdf`;
      downloadBytes(bytes, filename);

      const detail = recoded ? ` ${recoded} gambar dikompresi ulang.` : '';
      setStatus(
        'success',
        `${formatBytes(before)} → ${formatBytes(bytes.length)}, hemat ${percent}%.${detail} Disimpan sebagai "${escapeHtml(filename)}".`,
      );
    } catch (error) {
      setStatus('error', escapeHtml(errorText(error)));
    } finally {
      state.busy = false;
      compressButton.disabled = false;
    }
  });

  return root;
}
