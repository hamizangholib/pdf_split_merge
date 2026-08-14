import { html, cls } from '../lib/ui.js';
import { tools } from '../lib/nav.js';
import { brandIcon } from '../lib/icons.js';

/**
 * The landing surface, laid out the way the reference template does it:
 * a split hero, a card grid of services on a soft grey field, a counted-up
 * fact strip, a three-step explainer, and a technology ticker. Sections
 * alternate white / #f7f7f7 and are joined by a shallow wave, so the colour
 * change itself carries the rhythm — no dividers needed.
 */

/** Formats supported anywhere in the toolkit — shown as chips under the hero. */
const formats = ['PDF', 'JPG', 'PNG', 'WEBP', 'MD', 'TXT', 'ZIP'];

const facts = [
  { value: tools.length, suffix: '', label: 'alat siap pakai' },
  { value: 100, suffix: '%', label: 'diproses di perangkat' },
  { value: formats.length, suffix: '', label: 'format didukung' },
];

const steps = [
  {
    icon: 'organize',
    title: 'Pilih alatnya',
    body: 'Gabungkan, pisahkan, atur halaman, ubah gambar atau Markdown, atau perkecil ukuran.',
  },
  {
    icon: 'images',
    title: 'Jatuhkan berkasnya',
    body: 'Tarik ke area unggah atau pilih dari perangkat. Berkas dibaca langsung dari disk Anda.',
  },
  {
    icon: 'compress',
    title: 'Simpan hasilnya',
    body: 'Hasil terunduh otomatis begitu selesai — tanpa antrean dan tanpa tautan kedaluwarsa.',
  },
];

const stack = ['Vite', 'Tailwind CSS', 'pdf-lib', 'pdf.js', 'marked', 'Lucide', 'GitHub Pages'];

/** A shallow wave closing a section, filled with the colour of the next one. */
function wave(fill) {
  return `
    <div aria-hidden="true" class="pointer-events-none -mb-px">
      <svg viewBox="0 0 1440 56" preserveAspectRatio="none" class="block h-10 w-full md:h-14" fill="${fill}">
        <path d="M0,30 C240,58 480,4 720,18 C960,32 1200,58 1440,28 L1440,56 L0,56 Z" />
      </svg>
    </div>
  `;
}

export function renderWelcome() {
  const root = html(`
    <div>
      <!-- Hero -->
      <section class="relative overflow-hidden bg-white pt-16 md:pt-24">
        <div aria-hidden="true" class="pointer-events-none absolute inset-0">
          <span class="dot-grid absolute inset-x-0 top-0 h-64 opacity-60"></span>
          <span class="gradient-drift absolute -left-32 -top-24 size-80 rounded-full bg-brand-gradient opacity-15 blur-3xl"></span>
          <span class="gradient-drift absolute -right-24 top-40 size-96 rounded-full bg-brand-gradient opacity-10 blur-3xl"></span>
        </div>

        <div class="relative mx-auto grid max-w-[1200px] items-center gap-14 px-5 pb-20 md:grid-cols-2">
          <div class="reveal space-y-6">
            <span class="inline-flex items-center gap-2 rounded-full bg-parchment px-4 py-2 text-fine font-medium text-action">
              <i data-lucide="shield-check" class="size-3.5"></i>
              100% diproses di perangkat Anda
            </span>
            <h1 class="text-display-md text-ink md:text-display-lg lg:text-hero">
              Rapikan PDF Anda,<br />
              <span class="text-brand-gradient">tanpa meninggalkan browser.</span>
            </h1>
            <p class="max-w-[520px] text-lead-airy text-ink-80">
              Gabungkan, pisahkan, susun ulang halaman, ubah gambar dan catatan Markdown
              menjadi PDF, lalu perkecil ukurannya. Tidak ada berkas yang diunggah.
            </p>
            <div class="flex flex-wrap items-center gap-4">
              <a href="#/merge" class="${cls.pillPrimary}">
                Mulai gabungkan
                <i data-lucide="chevron-right" class="size-4"></i>
              </a>
              <a href="#/markdown" class="${cls.pillGhost}">Markdown ke PDF</a>
            </div>

            <div class="space-y-2 pt-2">
              <p class="text-fine text-ink-48">Format yang dikenali</p>
              <ul class="flex flex-wrap gap-2">
                ${formats
                  .map(
                    (format) => `
                      <li class="rounded-full border border-hairline bg-white px-3.5 py-1.5 text-fine font-medium text-ink-80 transition-colors hover:border-action hover:text-action">
                        ${format}
                      </li>
                    `,
                  )
                  .join('')}
              </ul>
            </div>
          </div>

          <!-- A stack of pages, drawn rather than photographed. -->
          <div class="reveal relative mx-auto hidden aspect-square w-full max-w-[440px] md:block">
            <div class="gradient-drift absolute inset-0 rounded-[42%] bg-brand-gradient opacity-10"></div>
            <div class="float-slow absolute left-[14%] top-[16%] h-[62%] w-[46%] rotate-[-8deg] rounded-md bg-white shadow-product"></div>
            <div class="float-slower absolute left-[30%] top-[12%] h-[68%] w-[48%] rotate-[6deg] rounded-md bg-white shadow-product"></div>
            <div class="absolute left-[24%] top-[22%] flex h-[60%] w-[52%] flex-col gap-3 rounded-md bg-white p-6 shadow-product">
              <span class="flex size-10 items-center justify-center rounded-md bg-brand-gradient text-white">
                ${brandIcon('merge', 'size-5')}
              </span>
              <span class="h-2.5 w-4/5 rounded-full bg-parchment"></span>
              <span class="h-2.5 w-full rounded-full bg-parchment"></span>
              <span class="h-2.5 w-3/5 rounded-full bg-parchment"></span>
              <span class="mt-auto h-8 w-28 rounded-full bg-brand-gradient opacity-80"></span>
            </div>
          </div>
        </div>

        ${wave('#f7f7f7')}
      </section>

      <!-- Services -->
      <section class="relative overflow-hidden bg-parchment px-5 py-20">
        <span aria-hidden="true" class="gradient-drift pointer-events-none absolute -right-40 bottom-0 size-96 rounded-full bg-brand-gradient opacity-10 blur-3xl"></span>

        <div class="relative mx-auto max-w-[1200px] space-y-12">
          <div class="reveal mx-auto max-w-[620px] space-y-4 text-center">
            <span class="text-caption font-medium text-action">Alat yang tersedia</span>
            <h2 class="text-display-md text-ink">Apa yang ingin Anda lakukan?</h2>
            <p class="text-body text-ink-80">
              Enam alat, satu halaman, tanpa akun. Pilih satu dan berkas Anda selesai
              dalam hitungan detik.
            </p>
          </div>

          <div class="stagger grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            ${tools
              .map(
                (tool) => `
                  <a
                    href="${tool.hash}"
                    class="reveal group flex flex-col gap-4 rounded-md bg-white p-8 shadow-soft transition-transform hover:-translate-y-1.5"
                  >
                    <span class="flex size-14 items-center justify-center rounded-md bg-parchment text-action transition-colors group-hover:bg-brand-gradient group-hover:text-white">
                      ${brandIcon(tool.icon, 'size-7')}
                    </span>
                    <h3 class="text-tagline font-bold text-ink">${tool.title}</h3>
                    <p class="text-caption text-ink-80">${tool.blurb}</p>
                    <span class="mt-auto inline-flex items-center gap-1.5 pt-2 text-caption font-medium text-action">
                      Buka
                      <i data-lucide="chevron-right" class="size-4 transition-transform group-hover:translate-x-1"></i>
                    </span>
                  </a>
                `,
              )
              .join('')}
          </div>
        </div>
      </section>

      <!-- Facts -->
      <section class="bg-white px-5 py-16">
        <div class="stagger mx-auto grid max-w-[900px] gap-10 text-center sm:grid-cols-3">
          ${facts
            .map(
              (fact) => `
                <div class="reveal space-y-1">
                  <p class="text-display-lg text-brand-gradient">
                    <span data-count="${fact.value}">${fact.value}</span>${fact.suffix}
                  </p>
                  <p class="text-caption text-ink-80">${fact.label}</p>
                </div>
              `,
            )
            .join('')}
        </div>
      </section>

      <!-- How it works -->
      <section class="relative overflow-hidden bg-white px-5 pb-20">
        <div class="mx-auto max-w-[1120px] space-y-12">
          <div class="reveal mx-auto max-w-[560px] space-y-4 text-center">
            <span class="text-caption font-medium text-action">Cara kerja</span>
            <h2 class="text-display-md text-ink">Tiga langkah, selesai</h2>
          </div>

          <div class="relative">
            <!-- The line the three steps sit on. -->
            <span
              aria-hidden="true"
              class="absolute left-0 right-0 top-7 hidden h-0.5 bg-brand-gradient opacity-30 md:block"
            ></span>

            <ol class="stagger relative grid gap-10 md:grid-cols-3">
              ${steps
                .map(
                  (step, index) => `
                    <li class="reveal space-y-3 text-center md:px-4">
                      <span class="mx-auto flex size-14 items-center justify-center rounded-full bg-brand-gradient text-white shadow-soft ring-8 ring-white">
                        ${brandIcon(step.icon, 'size-6')}
                      </span>
                      <p class="text-fine font-medium text-action">Langkah ${index + 1}</p>
                      <h3 class="text-tagline font-bold text-ink">${step.title}</h3>
                      <p class="text-caption text-ink-80">${step.body}</p>
                    </li>
                  `,
                )
                .join('')}
            </ol>
          </div>
        </div>

        ${wave('#f7f7f7')}
      </section>

      <!-- Why -->
      <section class="bg-parchment px-5 py-20">
        <div class="stagger mx-auto grid max-w-[1120px] gap-12 md:grid-cols-3">
          <div class="reveal space-y-3">
            <span class="flex size-12 items-center justify-center rounded-md bg-brand-gradient text-white">
              <i data-lucide="shield-check" class="size-6"></i>
            </span>
            <h3 class="text-tagline font-bold text-ink">Privat sepenuhnya</h3>
            <p class="text-caption text-ink-80">
              Berkas tidak pernah diunggah. Seluruh proses berjalan di dalam browser Anda,
              bahkan saat koneksi terputus.
            </p>
          </div>
          <div class="reveal space-y-3">
            <span class="flex size-12 items-center justify-center rounded-md bg-brand-gradient text-white">
              <i data-lucide="layers" class="size-6"></i>
            </span>
            <h3 class="text-tagline font-bold text-ink">Urutan sesuai keinginan</h3>
            <p class="text-caption text-ink-80">
              Susun ulang, putar, naikkan, turunkan, atau hapus halaman sebelum hasil
              akhirnya dibuat.
            </p>
          </div>
          <div class="reveal space-y-3">
            <span class="flex size-12 items-center justify-center rounded-md bg-brand-gradient text-white">
              <i data-lucide="download" class="size-6"></i>
            </span>
            <h3 class="text-tagline font-bold text-ink">Langsung tersimpan</h3>
            <p class="text-caption text-ink-80">
              Hasilnya terunduh otomatis begitu proses selesai — tanpa antrean, tanpa
              tautan kedaluwarsa.
            </p>
          </div>
        </div>
      </section>

      <!-- Technology ticker. One pass of the list is ~900px wide; the list is
           repeated six times and the track scrolls by half its width, so half a
           track (~2700px) still fills an ultrawide screen rather than leaving a
           gap at one end. -->
      <section class="border-t border-hairline bg-parchment py-10">
        <p class="mb-5 text-center text-caption text-ink-48">Dibangun dengan</p>
        <div class="marquee">
          <div class="marquee-track">
            ${[...stack, ...stack, ...stack, ...stack, ...stack, ...stack]
              .map(
                (name) =>
                  `<span class="text-tagline font-medium text-ink-48">${name}</span>`,
              )
              .join('')}
          </div>
        </div>
      </section>
    </div>
  `);

  attachCounters(root);
  return root;
}

/**
 * Counts each fact up from zero the first time it scrolls into view. A browser
 * without IntersectionObserver simply keeps the final number, which is already
 * in the markup.
 */
function attachCounters(root) {
  const numbers = [...root.querySelectorAll('[data-count]')];

  if (!('IntersectionObserver' in window)) return;

  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        observer.unobserve(entry.target);

        const target = Number(entry.target.dataset.count);
        const startedAt = performance.now();

        const step = (now) => {
          const progress = Math.min((now - startedAt) / 900, 1);
          // Ease-out cubic: fast at first, settling on the final number.
          entry.target.textContent = Math.round(target * (1 - (1 - progress) ** 3));
          if (progress < 1) requestAnimationFrame(step);
        };

        requestAnimationFrame(step);
      });
    },
    { threshold: 0.4 },
  );

  numbers.forEach((element) => {
    element.textContent = '0';
    observer.observe(element);
  });
}
