import { html, cls } from '../lib/ui.js';
import { tools } from '../lib/nav.js';

/**
 * The landing surface: a greeting, then the single decision the visitor has to
 * make — merge or split. Built as alternating full-bleed tiles (light /
 * near-black) so the colour change itself acts as the section divider.
 */
export function renderWelcome() {
  return html(`
    <div>
      <!-- Hero -->
      <section class="bg-white px-5 py-20 text-center md:py-[100px]">
        <div class="mx-auto max-w-[820px] space-y-6">
          <p class="text-caption text-ink-48">Selamat datang di PDF Toolkit</p>
          <h1 class="text-display-md text-ink md:text-display-lg lg:text-hero">
            Rapikan PDF Anda.<br />Tanpa meninggalkan browser.
          </h1>
          <p class="mx-auto max-w-[620px] text-lead-airy text-ink-80">
            Gabungkan, pisahkan, susun ulang halaman, ubah gambar menjadi PDF, dan
            perkecil ukuran file. Semuanya diproses di perangkat Anda sendiri.
          </p>
          <p class="text-tagline text-ink">Apa yang ingin Anda lakukan?</p>
        </div>
      </section>

      <!-- Every tool, alternating light and near-black tiles -->
      <section class="grid md:grid-cols-2">
        ${tools
          .map((tool, index) => {
            const dark = index % 2 === 1;
            return `
              <a
                href="${tool.hash}"
                class="group flex flex-col items-center gap-5 px-6 py-16 text-center transition-transform active:scale-[0.99] ${
                  dark ? 'bg-tile-1' : 'bg-parchment'
                } ${index === tools.length - 1 && tools.length % 2 === 1 ? 'md:col-span-2' : ''}"
              >
                <span class="flex size-20 items-center justify-center rounded-lg shadow-product ${
                  dark ? 'bg-tile-2 text-action-dark' : 'bg-white text-action'
                }">
                  <i data-lucide="${tool.icon}" class="size-9"></i>
                </span>
                <h2 class="text-display-md ${dark ? 'text-white' : 'text-ink'}">${tool.title}</h2>
                <p class="max-w-[380px] text-body ${dark ? 'text-muted-dark' : 'text-ink-80'}">
                  ${tool.blurb}
                </p>
                <span class="${cls.pillPrimary}">
                  Buka
                  <i data-lucide="chevron-right" class="size-4"></i>
                </span>
              </a>
            `;
          })
          .join('')}
      </section>

      <!-- Reassurance strip -->
      <section class="bg-white px-5 py-20">
        <div class="mx-auto grid max-w-[980px] gap-12 text-center md:grid-cols-3 md:text-left">
          <div class="space-y-3">
            <i data-lucide="shield-check" class="mx-auto size-6 text-action md:mx-0"></i>
            <h3 class="text-tagline text-ink">Privat sepenuhnya</h3>
            <p class="text-caption text-ink-80">
              File tidak pernah diunggah. Seluruh proses berjalan di dalam browser Anda.
            </p>
          </div>
          <div class="space-y-3">
            <i data-lucide="layers" class="mx-auto size-6 text-action md:mx-0"></i>
            <h3 class="text-tagline text-ink">Urutan sesuai keinginan</h3>
            <p class="text-caption text-ink-80">
              Susun ulang, naikkan, turunkan, atau hapus file sebelum digabungkan.
            </p>
          </div>
          <div class="space-y-3">
            <i data-lucide="download" class="mx-auto size-6 text-action md:mx-0"></i>
            <h3 class="text-tagline text-ink">Langsung terunduh</h3>
            <p class="text-caption text-ink-80">
              Hasilnya tersimpan otomatis ke perangkat begitu proses selesai.
            </p>
          </div>
        </div>
      </section>
    </div>
  `);
}
