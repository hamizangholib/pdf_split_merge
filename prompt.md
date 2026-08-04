Tolong buatkan web application client-side sederhana untuk memisah (split) dan menggabungkan (merge) file PDF dengan spesifikasi berikut:



1\. Tech Stack:

&#x20;  - Framework/Bundler: Vite (JS Vanilla atau React)

&#x20;  - Styling: Tailwind CSS

&#x20;  - Library PDF: `pdf-lib` untuk manipulasi file PDF

&#x20;  - Icons: Lucide Icons (jika diperlukan)

&#x20;  - Design: acuan "D:\\pdf merge dan split\\DESIGN-apple.md"



2\. Fitur Utama:

&#x20;  - Tab / Navigasi Antara Fitur Merge \& Split.

&#x20;  - Fitur Merge PDF:

&#x20;    \* Area drag \& drop untuk mengunggah multiple file PDF.

&#x20;    \* Daftar file yang diunggah dengan opsi untuk menghapus atau mengubah urutan file.

&#x20;    \* Tombol "Merge PDF" untuk menggabungkan file dan memicu download otomatis file hasil gabungan.

&#x20;  - Fitur Split PDF:

&#x20;    \* Area upload untuk 1 file PDF.

&#x20;    \* Menampilkan informasi nama file dan total jumlah halaman.

&#x20;    \* Form input rentang halaman yang ingin diambil (contoh format: "1-3, 5, 7-10").

&#x20;    \* Tombol "Split PDF" untuk mengekstrak halaman pilihan dan memicu download otomatis file PDF baru.



3\. Kriteria Non-Fungsional \& UI:

&#x20;  - Pemrosesan 100% di client-side (browser) menggunakan pdf-lib demi privasi data.

&#x20;  - Tampilan modern, bersih, dan responsif menggunakan Tailwind CSS.

&#x20;  - Sertakan indikator loading / status saat proses pemrosesan PDF berlangsung.

&#x20;  - Penanganan error yang rapi (misal: penanganan jika user memasukkan nomor halaman di luar jangkauan).



Tolong siapkan struktur project-nya, install paket-paket npm yang dibutuhkan, tuliskan kodenya dengan rapi, dan jalankan dev server-nya setelah selesai.

