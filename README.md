# 📄 PDF Toolkit — Merge & Split PDF Client-Side

[![Vite](https://img.shields.io/badge/Vite-8.2-646CFF?style=flat&logo=vite&logoColor=white)](https://vitejs.dev/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-v4-06B6D4?style=flat&logo=tailwindcss&logoColor=white)](https://tailwindcss.com/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Privacy First](https://img.shields.io/badge/Privacy-100%25_Client--Side-green.svg)](#-privasi--keamanan)

Aplikasi web modern, cepat, dan aman berbasis browser untuk **menggabungkan (Merge)** dan **memisahkan (Split)** dokumen PDF. Seluruh proses pengolahan dilakukan **100% secara lokal di browser Anda** menggunakan `pdf-lib` dan `pdfjs-dist` — **tidak ada berkas atau data yang diunggah ke server mana pun.**

---

## ✨ Fitur Utama

- 🔒 **100% Privasi & Aman**: Berkas PDF tidak pernah meninggalkan perangkat atau diunggah ke server luar.
- 🧩 **Gabungkan PDF (Merge)**:
  - Kombinasikan beberapa berkas PDF menjadi satu dokumen utuh.
  - Atur ulang urutan berkas (Reorder) dengan drag/drop sebelum digabungkan.
- ✂️ **Memisahkan PDF (Split)**:
  - Pratinjau visual (thumbnail) untuk setiap halaman PDF dengan renderer PDF.js.
  - Pemilihan rentang halaman fleksibel (contoh: `1-3, 5, 7-10`).
  - Ekstraksi tiap halaman menjadi file PDF terpisah dan unduh sekaligus dalam format `.zip`.
- 🎨 **Antarmuka Premium (Apple-inspired UI)**:
  - Tampilan bersih, minimalis, dan responsif menggunakan Tailwind CSS v4.
  - Dukungan visual intuitif dengan fitur area dropzone (Drag & Drop).

---

## 🛠️ Teknologi & Library

- **Core**: Vanilla JavaScript (ES Modules), HTML5, CSS3
- **Bundler & Dev Server**: [Vite](https://vitejs.dev/)
- **Styling**: [Tailwind CSS v4](https://tailwindcss.com/)
- **PDF Processing**: [pdf-lib](https://pdf-lib.js.org/) *(Manipulasi & pembuatan berkas PDF)*
- **PDF Rendering**: [pdfjs-dist](https://mozilla.github.io/pdf.js/) *(Render thumbnail halaman)*
- **Icons**: [Lucide Icons](https://lucide.dev/)

---

## 🚀 Panduan Jalankan Secara Lokal

### Prasyarat
Pastikan Anda sudah menginstall [Node.js](https://nodejs.org/) (versi 18 ke atas) dan `npm`.

1. **Clone repositori ini**:
   ```bash
   git clone https://github.com/username/pdf-toolkit.git
   cd pdf-toolkit
