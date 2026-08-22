import {
  cls,
  downloadBytes,
  errorText,
  escapeHtml,
  formatBytes,
  html,
  paintIcons,
  paintStatus,
  readFileBytes,
  resultLink,
  setVisible,
  stripPdfExtension,
} from '../lib/ui.js';
import { buildFromPages, closeDocument, compressDocument, openDocument } from '../lib/pdf.js';
import { rasterizePages } from '../lib/preview.js';
import { createFileLoader } from '../lib/loader.js';
import { subNavMarkup } from '../lib/nav.js';
import { brandIcon } from '../lib/icons.js';

/**
 * How hard the "kuat" level squeezes. Resolution matters more than JPEG quality
 * here: below ~110 DPI small text starts to blur, above ~200 the file stops
 * shrinking much.
 */
const rasterPresets = {
  crisp: { dpi: 200, quality: 0.75, label: 'Tajam — 200 DPI' },
  balanced: { dpi: 150, quality: 0.62, label: 'Seimbang — 150 DPI' },
  small: { dpi: 110, quality: 0.5, label: 'Sekecil mungkin — 110 DPI' },
};

export function renderCompress() {
  /** @type {{ file: File|null, docId: number|null, pageCount: number, status: string|null, message: string, busy: boolean }} */
  const state = { file: null, docId: null, pageCount: 0, status: null, message: '', busy: false };

  const root = html(`
    <div>
      ${subNavMarkup('perkecil-pdf')}

      <section class="mx-auto max-w-[820px] space-y-8 px-5 py-16">
        <header class="space-y-3">
          <h1 class="text-display-md text-ink">Perkecil ukuran PDF</h1>
          <p class="max-w-[620px] text-body text-ink-80">
            Pilih seberapa jauh Anda mau menukar kualitas dengan ukuran — dari
            merapikan struktur saja sampai menggambar ulang seluruh halaman.
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
              <input type="radio" name="level" value="light" class="mt-1 accent-action" />
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
              <input type="radio" name="level" value="medium" checked class="mt-1 accent-action" />
              <span class="min-w-0">
                <span class="block text-caption text-ink">Sedang — kecilkan gambar</span>
                <span class="block text-fine text-ink-48">
                  Setiap gambar di dalam dokumen diturunkan ke maksimal 1600 piksel pada
                  sisi terpanjang dan dikompresi ulang sebagai JPEG. Teks tetap bisa
                  diseleksi dan formulir tetap berfungsi. Sangat efektif untuk pindaian
                  dan tangkapan layar; hampir tidak berpengaruh pada dokumen teks saja.
                </span>
              </span>
            </label>
            <label class="${cls.radioCard}">
              <input type="radio" name="level" value="strong" class="mt-1 accent-action" />
              <span class="min-w-0">
                <span class="block text-caption text-ink">Kuat — gambar ulang setiap halaman</span>
                <span class="block text-fine text-ink-48">
                  Setiap halaman digambar ulang menjadi satu JPEG. Ini selalu mengecilkan
                  dokumen yang berat, tetapi <strong class="font-medium text-ink-80">teks
                  berubah menjadi gambar</strong>: tidak bisa lagi diseleksi, dicari, atau
                  diisi sebagai formulir. Ukuran kertas tetap sama.
                </span>
                <span data-preset-wrap class="mt-3 block" style="display: none">
                  <span class="block text-fine text-ink-48">Kualitas hasil</span>
                  <select
                    data-preset
                    class="mt-1 w-full max-w-xs rounded-sm border border-hairline bg-white px-3 py-2 text-caption text-ink"
                  >
                    ${Object.entries(rasterPresets)
                      .map(
                        ([key, preset]) =>
                          `<option value="${key}"${key === 'balanced' ? ' selected' : ''}>${preset.label}</option>`,
                      )
                      .join('')}
                  </select>
                </span>
              </span>
            </label>
          </fieldset>

          <p class="text-fine text-ink-48">
            Target ukuran pasti tidak tersedia: seberapa besar hasil akhirnya tergantung
            isi dokumen. Kalau hasilnya ternyata tidak lebih kecil, file tidak diunduh.
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
  const presetWrap = root.querySelector('[data-preset-wrap]');
  const presetSelect = root.querySelector('[data-preset]');

  const chosenLevel = () => root.querySelector('input[name="level"]:checked').value;

  function setStatus(status, message) {
    state.status = status;
    state.message = message;
    paintStatus(statusHost, status, message);
  }

  function clearDocument() {
    closeDocument(state.docId);
    state.file = null;
    state.docId = null;
    state.pageCount = 0;
    setVisible(detailHost, false);
    setStatus(null, '');
  }

  // The resolution picker only means anything for the level that rasterises.
  for (const radio of root.querySelectorAll('input[name="level"]')) {
    radio.addEventListener('change', () => setVisible(presetWrap, chosenLevel() === 'strong'));
  }

  const loader = createFileLoader({
    id: 'compress',
    onReset: clearDocument,
    onReady: async (file, bytes) => {
      // The worker keeps the untouched original, so every run starts from the
      // same bytes rather than from an already-compressed document.
      const { docId, pageCount } = await openDocument(bytes, file.name);
      state.file = file;
      state.docId = docId;
      state.pageCount = pageCount;

      nameHost.textContent = file.name;
      metaHost.textContent = `${state.pageCount} halaman · ${formatBytes(file.size)}`;
      setVisible(detailHost, true);
      setVisible(presetWrap, chosenLevel() === 'strong');
      paintIcons(detailHost);
    },
  });
  root.querySelector('[data-loader]').replaceWith(loader.element);

  root.querySelector('[data-reset]').addEventListener('click', () => loader.reset());

  /**
   * The `strong` path runs where pdf.js already lives — the main thread — and
   * hands the finished page images to the worker to be sewn back into a PDF.
   * The file is re-read from disk because the original bytes were transferred
   * to the worker when it was opened.
   */
  async function rasterize() {
    const preset = rasterPresets[presetSelect.value] ?? rasterPresets.balanced;
    const bytes = await readFileBytes(state.file);

    const pages = await rasterizePages(bytes, {
      dpi: preset.dpi,
      quality: preset.quality,
      onProgress: (position, total) =>
        setStatus('working', `Menggambar ulang halaman ${position + 1} dari ${total}…`),
    });

    setStatus('working', 'Menyusun ulang dokumen…');
    return { bytes: await buildFromPages(pages), recoded: pages.length, rasterised: true };
  }

  compressButton.addEventListener('click', async () => {
    state.busy = true;
    compressButton.disabled = true;
    setStatus('working', 'Membaca ulang dokumen…');

    try {
      const level = chosenLevel();

      const { bytes, recoded, rasterised } =
        level === 'strong'
          ? await rasterize()
          : await compressDocument(state.docId, level, (detail) =>
              setStatus('working', `Mengompresi gambar ${detail.position + 1} dari ${detail.total}…`),
            );

      const before = state.file.size;
      const saved = before - bytes.length;
      const percent = Math.round((saved / before) * 100);

      if (saved <= 0) {
        const advice =
          level === 'strong'
            ? ' Dokumen ini isinya teks dan vektor, yang justru lebih boros sebagai gambar — gunakan tingkat Ringan atau Sedang.'
            : ' Coba tingkat berikutnya kalau Anda bersedia menukar sedikit kualitas.';
        setStatus(
          'warning',
          `Tidak ada penghematan: hasilnya ${formatBytes(bytes.length)}, sama atau lebih besar dari aslinya (${formatBytes(before)}). Tidak diunduh agar Anda tidak menyimpan versi yang lebih besar.${advice}`,
        );
        return;
      }

      const filename = `${stripPdfExtension(state.file.name)}-kecil.pdf`;
      const url = downloadBytes(bytes, filename, 'application/pdf', { keep: true });

      let detail = '';
      if (rasterised) detail = ` ${recoded} halaman digambar ulang; teks kini berupa gambar.`;
      else if (recoded) detail = ` ${recoded} gambar dikompresi ulang.`;
      else if (level === 'medium') {
        detail = ' Tidak ada gambar yang bisa dikecilkan — coba tingkat Kuat kalau perlu lebih kecil.';
      }

      setStatus(
        'success',
        `${formatBytes(before)} → ${formatBytes(bytes.length)}, hemat ${percent}%.${detail} Disimpan sebagai "${escapeHtml(filename)}".` +
          resultLink(url, 'Periksa hasilnya'),
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
