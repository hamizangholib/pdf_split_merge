# PDF Toolkit

Web app statis untuk **menggabungkan** dan **memisahkan** file PDF. Seluruh proses
berjalan di browser dengan [pdf-lib](https://pdf-lib.js.org/) — tidak ada file yang
dikirim ke server mana pun.

## Menjalankan secara lokal

```bash
npm install
npm run dev
```

## Build produksi

```bash
npm run build
npm run preview
```

## Deploy ke GitHub Pages

1. Push repo ini ke GitHub dengan branch `main`.
2. Buka **Settings → Pages**, lalu set **Source** ke **GitHub Actions**.
3. Workflow di `.github/workflows/deploy.yml` akan build dan deploy otomatis
   setiap kali ada push ke `main`.

`vite.config.js` memakai `base: './'`, jadi situs bekerja baik di
`https://user.github.io/nama-repo/` maupun di domain kustom tanpa perlu diubah.

## Struktur

```
index.html            # shell: global nav + footer
src/main.js           # router berbasis hash (#/, #/merge, #/split)
src/style.css         # design token (Apple) di atas Tailwind CSS v4
src/lib/pdf.js        # merge, parsing rentang halaman, ekstraksi halaman
src/lib/ui.js         # helper DOM, dropzone, ikon, class recipe
src/views/            # welcome, merge, split
```
