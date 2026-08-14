import { defineConfig } from 'vite';
import tailwindcss from '@tailwindcss/vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  // Relative base so the build works on GitHub Pages regardless of the
  // repository sub-path (https://user.github.io/<repo>/).
  base: './',
  plugins: [
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['apple-touch-icon.png', 'og-card.png'],
      // Relative start_url/scope keep the app installable from any sub-path,
      // matching the relative `base` above.
      manifest: {
        name: 'PDF Toolkit — Gabungkan, Pisahkan & Ubah Dokumen',
        short_name: 'PDF Toolkit',
        description:
          'Gabungkan, pisahkan, atur, perkecil PDF, dan ubah Markdown menjadi PDF langsung di browser. Tanpa unggah, tanpa server.',
        lang: 'id',
        start_url: './',
        scope: './',
        display: 'standalone',
        orientation: 'portrait-primary',
        background_color: '#ffffff',
        theme_color: '#4b8ef1',
        icons: [
          { src: 'pwa-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512.png', sizes: '512x512', type: 'image/png' },
          {
            src: 'pwa-maskable-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
      workbox: {
        // `mjs` matters: pdf.js ships its worker as .mjs, and without it in the
        // precache the page previews break the moment the device goes offline.
        globPatterns: ['**/*.{js,mjs,css,html,png,svg,woff2}'],
        // The pdf.js chunk alone is ~430 kB; the default 2 MiB cap is enough,
        // but state it so a future dependency bump fails loudly instead of
        // silently dropping a file from the offline cache.
        maximumFileSizeToCacheInBytes: 3 * 1024 * 1024,
      },
    }),
  ],
});
