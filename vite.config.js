import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { defineConfig } from 'vite';
import tailwindcss from '@tailwindcss/vite';
import { VitePWA } from 'vite-plugin-pwa';
import { routes, site, tools } from './src/lib/routes.js';

// GitHub Pages serves this repository from a sub-path. An absolute base is what
// makes the pre-rendered `/<slug>/index.html` pages below resolve their assets:
// a relative base would look for them inside the slug's own directory.
const base = '/pdf_split_merge/';

const escapeHtml = (value) =>
  String(value).replace(
    /[&<>"]/g,
    (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[character],
  );

const urlOf = (slug) => `${site}${slug ? `/${slug}/` : '/'}`;

/**
 * The markup a crawler (or a visitor whose JavaScript has not arrived yet) sees
 * at a tool's URL. The app replaces it with the real view on boot, so it only
 * has to carry the things indexing depends on: one heading, one paragraph of
 * genuine description, and links onward to the other tools.
 */
function skeleton(route) {
  const links = tools
    .filter((tool) => tool.slug !== route.slug)
    .map(
      (tool) =>
        `<li><a href="${base}${tool.slug}/">${escapeHtml(tool.title.split('—')[0].trim())}</a></li>`,
    )
    .join('');

  return `
      <section class="mx-auto max-w-[1120px] space-y-8 px-5 py-16">
        <h1 class="text-display-md text-ink">${escapeHtml(route.heading)}</h1>
        <p class="max-w-[620px] text-body text-ink-80">${escapeHtml(route.intro)}</p>
        <nav aria-label="Alat lainnya" class="text-caption text-ink-80">
          <h2 class="text-tagline text-ink">Alat lainnya</h2>
          <ul>${links}</ul>
        </nav>
      </section>`;
}

/** Per-route metadata swapped into the built shell. */
function pageHtml(shell, route) {
  const url = urlOf(route.slug);

  return shell
    .replace(/<title>[\s\S]*?<\/title>/, `<title>${escapeHtml(route.title)}</title>`)
    .replace(
      /(<meta\s+name="description"\s+content=")[\s\S]*?(")/,
      `$1${escapeHtml(route.description)}$2`,
    )
    .replace(/(<link\s+rel="canonical"\s+href=")[^"]*(")/, `$1${url}$2`)
    .replace(
      /(<meta\s+property="og:title"\s+content=")[\s\S]*?(")/,
      `$1${escapeHtml(route.title)}$2`,
    )
    .replace(
      /(<meta\s+property="og:description"\s+content=")[\s\S]*?(")/,
      `$1${escapeHtml(route.description)}$2`,
    )
    .replace(/(<meta\s+property="og:url"\s+content=")[^"]*(")/, `$1${url}$2`)
    .replace(
      /(<meta\s+name="twitter:title"\s+content=")[\s\S]*?(")/,
      `$1${escapeHtml(route.title)}$2`,
    )
    .replace(
      /(<meta\s+name="twitter:description"\s+content=")[\s\S]*?(")/,
      `$1${escapeHtml(route.description)}$2`,
    )
    .replace(
      /(<main id="app"[^>]*>)(<\/main>)/,
      (_match, open, close) => `${open}${skeleton(route)}${close}`,
    );
}

/**
 * Writes one real HTML file per route, plus the files a crawler looks for.
 *
 * Without this the site is a single URL: six tools sharing one title, one
 * description, and one empty `<main>`. With it, each tool is its own indexable
 * page that still boots into the same single-page app.
 */
function seoPages() {
  let outDir;

  return {
    name: 'seo-pages',
    apply: 'build',
    configResolved(config) {
      outDir = config.build.outDir;
    },
    async closeBundle() {
      const shell = await readFile(join(outDir, 'index.html'), 'utf8');

      for (const route of routes) {
        if (!route.slug) continue;
        const directory = join(outDir, route.slug);
        await mkdir(directory, { recursive: true });
        await writeFile(join(directory, 'index.html'), pageHtml(shell, route));
      }

      // GitHub Pages serves this for any path it does not recognise; the router
      // sorts out where the visitor actually meant to go.
      await writeFile(join(outDir, '404.html'), shell);

      const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${routes
  .map(
    (route) =>
      `  <url>\n    <loc>${urlOf(route.slug)}</loc>\n    <changefreq>monthly</changefreq>\n    <priority>${route.slug ? '0.8' : '1.0'}</priority>\n  </url>`,
  )
  .join('\n')}
</urlset>
`;
      await writeFile(join(outDir, 'sitemap.xml'), sitemap);

      await writeFile(
        join(outDir, 'robots.txt'),
        `User-agent: *\nAllow: /\n\nSitemap: ${site}/sitemap.xml\n`,
      );
    },
  };
}

export default defineConfig({
  base,
  plugins: [
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['apple-touch-icon.png'],
      manifest: {
        name: 'PDF Toolkit — Gabungkan, Pisahkan & Ubah Dokumen',
        short_name: 'PDF Toolkit',
        description:
          'Gabungkan, pisahkan, atur, perkecil PDF, dan ubah Markdown menjadi PDF langsung di browser. Tanpa unggah, tanpa server.',
        lang: 'id',
        start_url: base,
        scope: base,
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
        // The social card is only ever fetched by crawlers, straight from the
        // network — the app itself never asks for it. Precaching it just spent
        // 29 kB of every visitor's first load on a file they never see.
        globIgnores: ['og-card.png'],
        // Every tool path is a client route; offline navigations to them are
        // served by the precached shell rather than by the network.
        navigateFallback: `${base}index.html`,
        // The pdf.js chunk alone is ~430 kB; the default 2 MiB cap is enough,
        // but state it so a future dependency bump fails loudly instead of
        // silently dropping a file from the offline cache.
        maximumFileSizeToCacheInBytes: 3 * 1024 * 1024,
      },
    }),
    seoPages(),
  ],
});
