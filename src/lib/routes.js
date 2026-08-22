/**
 * Every page the site has, as plain data.
 *
 * This module is the single source of truth for three consumers that cannot
 * share anything else: the client router, the navigation markup, and the build
 * step in `vite.config.js` that pre-renders one crawlable HTML file per route.
 * That last one runs in Node, so nothing here may touch `import.meta.env`, the
 * DOM, or any Vite-only import.
 *
 * `slug` is what appears in the URL. The slugs are Indonesian and carry the
 * words people actually search for — the tool key ("merge") stays internal.
 */

export const site = 'https://hamizangholib.github.io/pdf_split_merge';

export const routes = [
  {
    slug: '',
    key: 'home',
    name: 'Beranda',
    label: 'Beranda',
    title: 'PDF Toolkit — Gabungkan, Pisahkan & Ubah PDF di Browser',
    description:
      'Gabungkan, pisahkan, atur halaman, perkecil PDF, dan ubah gambar atau Markdown menjadi PDF langsung di browser. Tanpa unggah, tanpa server, 100% privat.',
    heading: 'Rapikan PDF Anda, tanpa meninggalkan browser.',
    intro:
      'Enam alat PDF yang berjalan sepenuhnya di perangkat Anda: gabungkan, pisahkan, atur halaman, ubah gambar dan Markdown menjadi PDF, lalu perkecil ukurannya. Tidak ada berkas yang diunggah ke server mana pun.',
  },
  {
    slug: 'gabungkan-pdf',
    name: 'Gabungkan PDF',
    key: 'merge',
    label: 'Gabungkan',
    icon: 'merge',
    title: 'Gabungkan PDF Online Gratis — Tanpa Unggah | PDF Toolkit',
    description:
      'Gabungkan beberapa file PDF menjadi satu dokumen, atur urutannya dengan drag & drop, lalu unduh hasilnya. Berjalan di browser Anda — file tidak pernah diunggah.',
    heading: 'Gabungkan beberapa PDF',
    intro:
      'Tambahkan dua file atau lebih, lihat pratinjau tiap file, atur urutannya dengan menariknya, lalu unduh hasil gabungannya.',
    blurb: 'Satukan beberapa file PDF menjadi satu dokumen, dengan urutan yang Anda tentukan.',
  },
  {
    slug: 'pisahkan-pdf',
    name: 'Pisahkan PDF',
    key: 'split',
    label: 'Pisahkan',
    icon: 'split',
    title: 'Pisahkan PDF & Ambil Halaman Tertentu Online | PDF Toolkit',
    description:
      'Ambil halaman tertentu dari PDF — misalnya 1-3, 5, 7-10 — sebagai satu file baru atau arsip ZIP per halaman. Diproses di browser, tanpa unggah.',
    heading: 'Ambil halaman tertentu',
    intro:
      'Unggah satu PDF, lihat pratinjau setiap halaman, pilih yang Anda perlukan, lalu simpan sebagai dokumen baru.',
    blurb: 'Ambil halaman tertentu — misalnya 1-3, 5, 7-10 — sebagai satu file atau arsip ZIP.',
  },
  {
    slug: 'atur-halaman-pdf',
    name: 'Atur Halaman PDF',
    key: 'organize',
    label: 'Atur Halaman',
    icon: 'organize',
    title: 'Atur Halaman PDF — Urutkan, Putar, Hapus | PDF Toolkit',
    description:
      'Susun ulang urutan halaman PDF, putar halaman yang miring, dan buang halaman yang tidak perlu. Semua diproses di dalam browser Anda.',
    heading: 'Atur halaman',
    intro:
      'Tarik halaman untuk mengubah urutannya, putar halaman yang miring, dan buang halaman yang tidak diperlukan. Halaman aslinya tidak pernah diubah.',
    blurb: 'Tarik untuk mengurutkan ulang, putar halaman yang miring, dan buang yang tidak perlu.',
  },
  {
    slug: 'gambar-ke-pdf',
    name: 'Gambar ke PDF',
    key: 'images',
    label: 'Gambar ke PDF',
    icon: 'images',
    title: 'Gambar ke PDF — Ubah JPG & PNG Jadi PDF | PDF Toolkit',
    description:
      'Ubah kumpulan JPG, PNG, WebP, atau hasil pindaian menjadi satu PDF dengan ukuran halaman dan margin yang Anda atur. Tanpa unggah.',
    heading: 'Gambar ke PDF',
    intro:
      'Tambahkan foto atau hasil pindaian, atur urutannya, lalu simpan sebagai satu PDF. Satu gambar menjadi satu halaman.',
    blurb: 'Ubah kumpulan JPG atau PNG menjadi satu PDF, lengkap dengan pengaturan halaman.',
  },
  {
    slug: 'markdown-ke-pdf',
    name: 'Markdown ke PDF',
    key: 'markdown',
    label: 'Markdown ke PDF',
    icon: 'markdown',
    title: 'Markdown ke PDF — Ubah Catatan .md Jadi PDF | PDF Toolkit',
    description:
      'Ubah catatan Markdown — lengkap dengan tabel, blok kode, kutipan, dan gambar — menjadi PDF rapi yang teksnya tetap bisa dicari. Diproses di browser.',
    heading: 'Markdown ke PDF',
    intro:
      'Tempel teks Markdown atau unggah berkas .md, lihat pratinjaunya, lalu simpan sebagai PDF yang teksnya tetap bisa diseleksi dan dicari.',
    blurb: 'Ubah catatan .md — lengkap dengan tabel, blok kode, dan gambar — menjadi PDF rapi.',
  },
  {
    slug: 'perkecil-pdf',
    name: 'Perkecil PDF',
    key: 'compress',
    label: 'Perkecil',
    icon: 'compress',
    title: 'Perkecil Ukuran PDF Tanpa Merusak Teks | PDF Toolkit',
    description:
      'Kurangi ukuran file PDF dengan tiga tingkat kompresi: rapikan struktur, kecilkan gambar tanpa merusak teks, atau gambar ulang setiap halaman untuk hasil paling kecil. Tanpa unggah.',
    heading: 'Perkecil ukuran PDF',
    intro:
      'Pilih seberapa jauh Anda mau menukar kualitas dengan ukuran — dari merapikan struktur saja sampai menggambar ulang seluruh halaman.',
    blurb: 'Kecilkan gambar di dalam PDF tanpa merusak teks, atau gambar ulang halaman untuk hasil paling kecil.',
  },
];

/** The six tool routes, in the order they appear in every navigation. */
export const tools = routes.filter((route) => route.slug !== '');

export const routeBySlug = (slug) => routes.find((route) => route.slug === slug);

export const routeByKey = (key) => routes.find((route) => route.key === key);

/**
 * Hash URLs from the first version of the site. Kept so links people bookmarked
 * or shared before the move to real paths still land on the right tool.
 */
export const legacyHashes = {
  '#/': '',
  '#/merge': 'gabungkan-pdf',
  '#/split': 'pisahkan-pdf',
  '#/organize': 'atur-halaman-pdf',
  '#/images': 'gambar-ke-pdf',
  '#/markdown': 'markdown-ke-pdf',
  '#/compress': 'perkecil-pdf',
};
