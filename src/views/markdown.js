import {
  attachDropzone,
  cls,
  dropzoneMarkup,
  errorText,
  escapeHtml,
  html,
  keepMarkdown,
  paintIcons,
  paintStatus,
  setVisible,
} from '../lib/ui.js';
import { documentCss, guessTitle, printMarkdown, renderMarkdown } from '../lib/markdown.js';
import { subNavMarkup } from '../lib/nav.js';
import { brandIcon } from '../lib/icons.js';

const SAMPLE = `# Judul Dokumen

Tulis atau tempel **Markdown** di sini, lalu klik *Buat PDF*.

## Yang didukung

- Heading, paragraf, dan daftar
- **Tebal**, *miring*, \`kode\`, dan [tautan](https://example.com)
- Tabel dan blok kode
- Gambar lewat URL

| Fitur     | Status |
| --------- | ------ |
| Tabel     | Ya     |
| Blok kode | Ya     |

\`\`\`js
console.log('halo dari blok kode');
\`\`\`

> Semua diproses di browser Anda. Tidak ada yang diunggah.
`;

export function renderMarkdownView() {
  const state = { source: SAMPLE, name: '', status: null, message: '' };

  const root = html(`
    <div>
      ${subNavMarkup('markdown-ke-pdf')}

      <section class="mx-auto max-w-[1200px] space-y-8 px-5 py-16">
        <header class="space-y-3">
          <h1 class="text-display-md text-ink">Markdown ke PDF</h1>
          <p class="max-w-[640px] text-body text-ink-80">
            Unggah berkas <code class="rounded bg-parchment px-1.5 py-0.5 text-fine">.md</code>
            atau tempel langsung teksnya. Pratinjau di sebelah kanan adalah wujud
            persis dokumen yang akan tercetak — teksnya tetap teks, bisa dipilih
            dan dicari di dalam PDF.
          </p>
        </header>

        ${dropzoneMarkup({
          id: 'markdown',
          multiple: true,
          accept: '.md,.markdown,.mdown,.mkd,.txt,text/markdown,text/plain',
          title: 'Tarik berkas Markdown ke sini',
          hint: 'Mendukung .md, .markdown, dan .txt. Beberapa berkas sekaligus akan disambung berurutan.',
        })}

        <div class="grid gap-6 lg:grid-cols-2">
          <div class="space-y-3">
            <div class="flex items-baseline justify-between gap-3">
              <h2 class="text-tagline text-ink">Sumber Markdown</h2>
              <button type="button" data-clear class="text-fine ${cls.link}">Kosongkan</button>
            </div>
            <textarea
              data-source
              spellcheck="false"
              class="h-[520px] w-full resize-y rounded-md border border-hairline bg-white p-5 font-mono text-caption leading-relaxed text-ink shadow-soft"
              aria-label="Sumber Markdown"
            ></textarea>
            <p data-meta class="text-fine text-ink-48"></p>
          </div>

          <div class="space-y-3">
            <div class="flex items-baseline justify-between gap-3">
              <h2 class="text-tagline text-ink">Pratinjau</h2>
              <span class="text-fine text-ink-48">Sesuai hasil cetak</span>
            </div>
            <style>${documentCss}</style>
            <div
              data-preview
              class="markdown-body h-[520px] overflow-auto rounded-md border border-hairline bg-white p-8 shadow-soft"
            ></div>
          </div>
        </div>

        <div class="grid gap-6 md:grid-cols-2">
          <label class="block space-y-2">
            <span class="block text-tagline text-ink">Ukuran halaman</span>
            <select
              data-page-size
              class="h-11 w-full rounded-lg border border-hairline bg-white px-5 text-body text-ink"
            >
              <option value="A4" selected>A4</option>
              <option value="Letter">Letter</option>
              <option value="A5">A5</option>
              <option value="Legal">Legal</option>
            </select>
          </label>

          <label class="block space-y-2">
            <span class="block text-tagline text-ink">Margin</span>
            <select
              data-margin
              class="h-11 w-full rounded-lg border border-hairline bg-white px-5 text-body text-ink"
            >
              <option value="12mm">Sempit (1,2 cm)</option>
              <option value="20mm" selected>Sedang (2 cm)</option>
              <option value="28mm">Lebar (2,8 cm)</option>
            </select>
          </label>
        </div>

        <div data-status></div>

        <div class="rounded-md bg-parchment px-5 py-4">
          <p class="text-caption text-ink-80">
            Tombol di bawah membuka dialog cetak bawaan browser. Pilih tujuan
            <span class="text-ink">"Save as PDF"</span> atau
            <span class="text-ink">"Simpan sebagai PDF"</span>, lalu Simpan. Nama berkas
            sudah terisi dari judul dokumen.
          </p>
        </div>

        <div class="flex flex-wrap items-center gap-4">
          <button type="button" data-print class="${cls.pillPrimary}">
            ${brandIcon('markdown', 'size-[18px]')}
            Buat PDF
          </button>
          <button type="button" data-sample class="${cls.pillGhost}">Muat contoh</button>
        </div>
      </section>
    </div>
  `);

  const sourceInput = root.querySelector('[data-source]');
  const previewHost = root.querySelector('[data-preview]');
  const metaHost = root.querySelector('[data-meta]');
  const statusHost = root.querySelector('[data-status]');
  const printButton = root.querySelector('[data-print]');

  function setStatus(status, message) {
    state.status = status;
    state.message = message;
    paintStatus(statusHost, status, message);
  }

  function documentTitle() {
    return (
      guessTitle(state.source) ||
      state.name.replace(/\.(md|markdown|mdown|mkd|txt)$/i, '') ||
      'dokumen'
    );
  }

  function renderPreview() {
    previewHost.innerHTML = renderMarkdown(state.source);
    const words = state.source.trim() ? state.source.trim().split(/\s+/).length : 0;
    metaHost.textContent = `${state.source.length} karakter · ${words} kata${
      state.name ? ` · ${state.name}` : ''
    }`;
    printButton.disabled = state.source.trim().length === 0;
  }

  function setSource(text, name = '') {
    state.source = text;
    state.name = name;
    sourceInput.value = text;
    setStatus(null, '');
    renderPreview();
  }

  /* --------------------------------------------------------------- inputs */

  // Repaint on a short idle so typing stays smooth on long documents.
  let repaintTimer;
  sourceInput.addEventListener('input', () => {
    state.source = sourceInput.value;
    clearTimeout(repaintTimer);
    repaintTimer = setTimeout(renderPreview, 150);
  });

  attachDropzone(
    root.querySelector('#markdown-zone'),
    root.querySelector('#markdown-input'),
    async (files) => {
      try {
        const texts = await Promise.all(files.map((file) => file.text()));
        // Several files become one document, separated by a rule.
        setSource(texts.join('\n\n---\n\n'), files.map((file) => file.name).join(', '));
        setStatus(
          'success',
          files.length === 1
            ? `"${escapeHtml(files[0].name)}" dimuat.`
            : `${files.length} berkas disambung menjadi satu dokumen.`,
        );
      } catch (error) {
        setStatus('error', escapeHtml(errorText(error)));
      }
    },
    keepMarkdown,
  );

  root.querySelector('[data-clear]').addEventListener('click', () => setSource('', ''));
  root.querySelector('[data-sample]').addEventListener('click', () => setSource(SAMPLE, ''));

  printButton.addEventListener('click', async () => {
    if (!state.source.trim()) return;

    printButton.disabled = true;
    setStatus('working', 'Menyiapkan dokumen…');

    try {
      await printMarkdown(renderMarkdown(state.source), {
        title: documentTitle(),
        pageSize: root.querySelector('[data-page-size]').value,
        margin: root.querySelector('[data-margin]').value,
      });
      setStatus(
        'success',
        'Dialog cetak terbuka. Pilih "Save as PDF" pada tujuan, lalu Simpan.',
      );
    } catch (error) {
      setStatus('error', escapeHtml(errorText(error)));
    } finally {
      printButton.disabled = false;
    }
  });

  setSource(SAMPLE, '');
  setVisible(statusHost, true);
  return root;
}
