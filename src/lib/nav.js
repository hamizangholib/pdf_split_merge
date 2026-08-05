import { cls } from './ui.js';

/** Every tool, in the order they appear in the header and on the home page. */
export const tools = [
  {
    hash: '#/merge',
    label: 'Gabungkan',
    title: 'Gabungkan PDF',
    icon: 'combine',
    blurb: 'Satukan beberapa file PDF menjadi satu dokumen, dengan urutan yang Anda tentukan.',
  },
  {
    hash: '#/split',
    label: 'Pisahkan',
    title: 'Pisahkan PDF',
    icon: 'scissors',
    blurb: 'Ambil halaman tertentu — misalnya 1-3, 5, 7-10 — sebagai satu file atau arsip ZIP.',
  },
  {
    hash: '#/organize',
    label: 'Atur Halaman',
    title: 'Atur Halaman',
    icon: 'layout-grid',
    blurb: 'Tarik untuk mengurutkan ulang, putar halaman yang miring, dan buang yang tidak perlu.',
  },
  {
    hash: '#/images',
    label: 'Gambar ke PDF',
    title: 'Gambar ke PDF',
    icon: 'image',
    blurb: 'Ubah kumpulan JPG atau PNG menjadi satu PDF, lengkap dengan pengaturan halaman.',
  },
  {
    hash: '#/compress',
    label: 'Perkecil',
    title: 'Perkecil PDF',
    icon: 'archive',
    blurb: 'Kurangi ukuran file tanpa mengubah halaman menjadi gambar — teks tetap utuh.',
  },
];

/** The frosted sub-navigation every tool page carries. */
export function subNavMarkup(currentHash) {
  const current = tools.find((tool) => tool.hash === currentHash);
  const others = tools
    .filter((tool) => tool.hash !== currentHash)
    .map(
      (tool) =>
        `<a href="${tool.hash}" class="shrink-0 text-caption ${cls.link}">${tool.label}</a>`,
    )
    .join('');

  return `
    <div class="sticky top-11 z-40 border-b border-hairline bg-parchment/80 backdrop-blur-xl backdrop-saturate-150">
      <div class="mx-auto flex h-[52px] max-w-[1120px] items-center gap-4 overflow-x-auto px-5">
        <a href="#/" class="flex shrink-0 items-center gap-1.5 text-caption ${cls.link}">
          <i data-lucide="arrow-left" class="size-4"></i>
          Beranda
        </a>
        <span class="shrink-0 text-tagline text-ink">${current?.label ?? ''}</span>
        <span class="ml-auto flex shrink-0 items-center gap-4">${others}</span>
      </div>
    </div>
  `;
}
