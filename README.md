# 📄 PDF Toolkit — Merge, Split, Organize, Convert & Compress PDF Client-Side

[![Vite](https://img.shields.io/badge/Vite-8.2-646CFF?style=flat&logo=vite&logoColor=white)](https://vitejs.dev/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-v4-06B6D4?style=flat&logo=tailwindcss&logoColor=white)](https://tailwindcss.com/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Privacy First](https://img.shields.io/badge/Privacy-100%25_Client--Side-green.svg)](#-privasi--keamanan-data)

Aplikasi web modern, cepat, dan aman berbasis browser untuk mengolah dokumen PDF: **menggabungkan (Merge)**, **memisahkan (Split)**, **mengatur halaman (Organize)**, **mengonversi Gambar ke PDF**, **mengonversi Markdown ke PDF**, dan **memperkecil ukuran PDF (Compress)**.

Seluruh proses pengolahan dilakukan **100% secara lokal di browser Anda** menggunakan `pdf-lib` dan `pdfjs-dist` — **tidak ada berkas atau data yang diunggah ke server mana pun.**

---

## ✨ Fitur Utama

- 🔒 **100% Privasi & Aman**: Berkas PDF tidak pernah meninggalkan perangkat atau diunggah ke server luar (*in-memory client-side processing*).
- 🧩 **Gabungkan PDF (Merge)**:
  - Kombinasikan beberapa berkas PDF menjadi satu dokumen utuh.
  - Atur ulang urutan berkas (Reorder) dengan drag & drop sebelum digabungkan.
- ✂️ **Memisahkan PDF (Split)**:
  - Pratinjau visual (thumbnail) untuk setiap halaman PDF dengan renderer PDF.js.
  - Pemilihan rentang halaman fleksibel (contoh: `1-3, 5, 7-10`).
  - Ekstraksi halaman pilihan menjadi file terpisah atau unduh sekaligus dalam arsip `.zip`.
- 🗂️ **Atur Halaman (Organize)**:
  - Pratinjau visual grid seluruh halaman dokumen PDF.
  - Susun ulang (reorder) urutan halaman secara bebas dengan drag & drop.
  - Putar (rotate) posisi halaman (90°, 180°, 270°).
  - Hapus halaman tertentu yang tidak diperlukan.
- 🖼️ **Gambar ke PDF (Images to PDF)**:
  - Konversi berbagai berkas gambar (JPG, PNG, WebP, GIF, BMP) menjadi satu dokumen PDF.
  - Atur urutan tampilan gambar sebelum PDF dibuat.
- 📝 **Markdown ke PDF**:
  - Unggah berkas `.md`/`.txt` atau tempel langsung teksnya dengan pratinjau instan.
  - Mendukung sintaks Markdown/GFM (heading, daftar, tabel, blok kode, kutipan, dan gambar).
  - Hasil PDF tetap berupa teks berbasis vektor (searchable & selectable) via mesin cetak browser.
  - Pembersihan HTML otomatis (sanitizer) untuk mencegah skrip berbahaya.
- 🗜️ **Perkecil Ukuran PDF (Compress)**:
  - Optimalkan dan kurangi ukuran berkas PDF secara efisien.
  - Teks tetap dapat dicari/diseleksi dan formulir PDF tetap berfungsi (tanpa meraster teks menjadi gambar).
- 🎨 **Antarmuka Modern & Responsif**:
  - Desain elegan bergaya *Chain App Dev* dengan tema warna biru modern.
  - Kartu berbayangan lembut, animasi *scroll-reveal*, preloader halus, serta dukungan area *Drag & Drop*.

---

## 🛠️ Teknologi & Library

- **Core**: Vanilla JavaScript (ES Modules), HTML5, CSS3
- **Bundler & Dev Server**: [Vite](https://vitejs.dev/) v8.2+
- **Styling**: [Tailwind CSS v4](https://tailwindcss.com/) (`@tailwindcss/vite`)
- **PDF Processing**: [pdf-lib](https://pdf-lib.js.org/) *(Manipulasi, pembuatan, & ekstraksi PDF)*
- **PDF Rendering**: [pdfjs-dist](https://mozilla.github.io/pdf.js/) *(Render thumbnail & visual pratinjau halaman)*
- **Markdown Parser**: [marked](https://marked.js.org/) *(Parser Markdown/GFM)*
- **Icons**: [Lucide Icons](https://lucide.dev/) *(Sistem ikon UI)*

---

## 🚀 Panduan Jalankan Secara Lokal

### Prasyarat
Pastikan Anda sudah menginstall [Node.js](https://nodejs.org/) (versi 18 ke atas) dan `npm`.

1. **Clone repositori ini**:
   ```bash
   git clone https://github.com/username/pdf-toolkit.git
   cd pdf-toolkit
   ```

2. **Install dependensi**:
   ```bash
   npm install
   ```

3. **Jalankan server pengembang (Dev Server)**:
   ```bash
   npm run dev
   ```
   Buka alamat lokal di browser Anda (biasanya `http://localhost:5173`).

4. **Build untuk Produksi**:
   ```bash
   npm run build
   ```
   Hasil build statis akan tersimpan di direktori `dist/`. Anda dapat mempratinjaunya dengan:
   ```bash
   npm run preview
   ```

---

## 🌐 Deploy ke GitHub Pages

Proyek ini telah dilengkapi dengan workflow CI/CD via **GitHub Actions** (`.github/workflows/deploy.yml`).

1. Push perubahan Anda ke branch `main`:
   ```bash
   git push origin main
   ```
2. Buka repositori Anda di GitHub → **Settings** → **Pages**.
3. Pada bagian **Source**, pilih **GitHub Actions**.
4. Aplikasi akan otomatis di-build dan di-deploy setiap kali ada pembaruan di branch `main`.

---

## 📁 Struktur Direktori

```
pdf-toolkit/
├── .github/
│   └── workflows/          # GitHub Actions workflow untuk deployment otomatis
├── src/
│   ├── lib/                # Core utility modules & helpers
│   │   ├── compress.js     # Algoritma kompresi & optimasi PDF
│   │   ├── icons.js        # Helper & renderer ikon Lucide
│   │   ├── image.js        # Konversi gambar ke PDF & pemrosesan gambar
│   │   ├── loader.js       # Manager uploader berkas & dropzone UI
│   │   ├── markdown.js     # Parser Markdown, HTML sanitizer & mesin cetak PDF
│   │   ├── nav.js          # Sub-navigasi antar fitur PDF
│   │   ├── pagegrid.js     # Pratinjau grid halaman & drag-reorder handler
│   │   ├── pdf.js          # Pengolah PDF utama (Merge, Split, Extract, Organize)
│   │   ├── preview.js      # PDF.js page renderer untuk thumbnail
│   │   ├── reveal.js       # Animasi scroll-reveal (IntersectionObserver)
│   │   ├── ui.js           # Utility DOM, format bytes & helper antarmuka
│   │   └── zip.js          # Generator file ZIP client-side
│   ├── views/              # Tampilan halaman / modul view SPA
│   │   ├── welcome.js      # Halaman Utama (Dashboard / Landing Page)
│   │   ├── merge.js        # Fitur penggabungan PDF
│   │   ├── split.js        # Fitur pemisahan PDF
│   │   ├── organize.js     # Fitur rotasi, susun ulang & hapus halaman
│   │   ├── images.js       # Fitur konversi Gambar ke PDF
│   │   ├── markdown.js     # Fitur konversi Markdown ke PDF
│   │   └── compress.js     # Fitur kompresi PDF
│   ├── main.js             # Hash router SPA, scroll header handler & entry point
│   └── style.css           # Styling utama & Tailwind CSS v4 imports
├── index.html              # Shell HTML utama
├── vite.config.js          # Konfigurasi Vite bundler
├── package.json            # Dependensi & script proyek
└── README.md               # Dokumentasi proyek
```

---

## 🔒 Privasi & Keamanan Data

Keamanan dokumen pengguna adalah fokus utama proyek ini:
- Pemrosesan dokumen berlangsung sepenuhnya di memori browser pengguna (*in-memory processing*).
- Tidak ada backend API yang menyimpan maupun membaca isi dokumen Anda.
- Aman digunakan untuk dokumen sensitif atau rahasia.

---

## 📄 Lisensi

Proyek ini dilindungi di bawah lisensi [MIT License](LICENSE).

