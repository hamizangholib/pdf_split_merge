/**
 * Draws the brand mark into the PNG assets the manifest and social cards need:
 * `node scripts/make-icons.mjs`
 *
 * The mark is the same geometry as the favicon in index.html — a gradient
 * rounded square, a white sheet, and a white page turning away from it — so all
 * three stay in step. Rasterised here rather than exported from a design tool so
 * a colour change in one place regenerates every size.
 *
 * No image dependency: shapes are sampled into a pixel buffer and written as a
 * PNG by hand, reusing the CRC-32 the ZIP writer already needs.
 */
import { deflateSync } from 'node:zlib';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { crc32 } from '../src/lib/zip.js';

const publicDir = join(dirname(fileURLToPath(import.meta.url)), '..', 'public');

const GRADIENT_FROM = [0x5b, 0x68, 0xeb];
const GRADIENT_TO = [0x28, 0xe1, 0xfd];

/* ------------------------------------------------------------------ shapes */

/** Signed test: is (x, y) inside a rounded rectangle given in 0..32 units? */
function inRoundedRect(x, y, { rx, ry, w, h, r }) {
  if (x < rx || x > rx + w || y < ry || y > ry + h) return false;
  const dx = Math.max(rx + r - x, 0, x - (rx + w - r));
  const dy = Math.max(ry + r - y, 0, y - (ry + h - r));
  return dx * dx + dy * dy <= r * r;
}

/** Even-odd test against a closed polygon given in 0..32 units. */
function inPolygon(x, y, points) {
  let inside = false;
  for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
    const [xi, yi] = points[i];
    const [xj, yj] = points[j];
    const crosses = yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi;
    if (crosses) inside = !inside;
  }
  return inside;
}

// The mark, in the 32×32 space the favicon uses.
const SHEET = { rx: 4, ry: 5, w: 10, h: 22, r: 2.5 };
const PAGE = [
  [18, 5.5],
  [27.5, 8.8],
  [27.5, 23.2],
  [18, 26.5],
];

/* --------------------------------------------------------------- rasteriser */

/**
 * @param size    output edge in pixels
 * @param margin  fraction of the edge kept clear around the mark (maskable
 *                icons need a safe zone; a plain icon does not)
 * @param corner  background corner radius in 0..32 units (32 = full bleed)
 */
function drawIcon(size, { margin = 0, corner = 7 } = {}) {
  const pixels = Buffer.alloc(size * size * 4);
  const samples = 3;
  const scale = 32 / size;

  const inset = size * margin;
  const markSize = size - inset * 2;

  for (let py = 0; py < size; py += 1) {
    for (let px = 0; px < size; px += 1) {
      let bg = 0;
      let fg = 0;

      for (let sy = 0; sy < samples; sy += 1) {
        for (let sx = 0; sx < samples; sx += 1) {
          const x = px + (sx + 0.5) / samples;
          const y = py + (sy + 0.5) / samples;

          // Background square covers the whole canvas; the mark sits inside it.
          if (inRoundedRect(x * scale, y * scale, { rx: 0, ry: 0, w: 32, h: 32, r: corner })) {
            bg += 1;
          }

          const mx = ((x - inset) / markSize) * 32;
          const my = ((y - inset) / markSize) * 32;
          if (inRoundedRect(mx, my, SHEET) || inPolygon(mx, my, PAGE)) fg += 1;
        }
      }

      const total = samples * samples;
      const bgAlpha = bg / total;
      const fgAlpha = fg / total;

      // 105° gradient ≈ left-to-right with a downward lean.
      const t = Math.min(Math.max((px * 0.82 + py * 0.28) / size, 0), 1);
      const base = GRADIENT_FROM.map((from, index) =>
        Math.round(from + (GRADIENT_TO[index] - from) * t),
      );

      const offset = (py * size + px) * 4;
      for (let channel = 0; channel < 3; channel += 1) {
        pixels[offset + channel] = Math.round(base[channel] * (1 - fgAlpha) + 255 * fgAlpha);
      }
      pixels[offset + 3] = Math.round(255 * Math.max(bgAlpha, fgAlpha));
    }
  }

  return { pixels, width: size, height: size };
}

/** The social card: the mark, centred on a full-bleed gradient. */
function drawCard(width, height) {
  const pixels = Buffer.alloc(width * height * 4);
  const samples = 3;
  const markSize = Math.round(height * 0.42);
  const originX = (width - markSize) / 2;
  const originY = (height - markSize) / 2;

  for (let py = 0; py < height; py += 1) {
    for (let px = 0; px < width; px += 1) {
      let fg = 0;

      for (let sy = 0; sy < samples; sy += 1) {
        for (let sx = 0; sx < samples; sx += 1) {
          const mx = ((px + (sx + 0.5) / samples - originX) / markSize) * 32;
          const my = ((py + (sy + 0.5) / samples - originY) / markSize) * 32;
          if (inRoundedRect(mx, my, SHEET) || inPolygon(mx, my, PAGE)) fg += 1;
        }
      }

      const alpha = fg / (samples * samples);
      const t = Math.min(Math.max((px * 0.82 + py * 0.28) / width, 0), 1);
      const offset = (py * width + px) * 4;

      for (let channel = 0; channel < 3; channel += 1) {
        const base = Math.round(
          GRADIENT_FROM[channel] + (GRADIENT_TO[channel] - GRADIENT_FROM[channel]) * t,
        );
        pixels[offset + channel] = Math.round(base * (1 - alpha) + 255 * alpha);
      }
      pixels[offset + 3] = 255;
    }
  }

  return { pixels, width, height };
}

/* -------------------------------------------------------------- PNG writer */

function chunk(type, body) {
  const head = Buffer.alloc(8);
  head.writeUInt32BE(body.length, 0);
  head.write(type, 4, 'ascii');

  const crcInput = Buffer.concat([Buffer.from(type, 'ascii'), body]);
  const tail = Buffer.alloc(4);
  tail.writeUInt32BE(crc32(new Uint8Array(crcInput)) >>> 0, 0);

  return Buffer.concat([head, body, tail]);
}

function encodePng({ pixels, width, height }) {
  const stride = width * 4;
  // One filter byte (0 = none) in front of every scanline.
  const raw = Buffer.alloc((stride + 1) * height);
  for (let y = 0; y < height; y += 1) {
    pixels.copy(raw, y * (stride + 1) + 1, y * stride, (y + 1) * stride);
  }

  const header = Buffer.alloc(13);
  header.writeUInt32BE(width, 0);
  header.writeUInt32BE(height, 4);
  header[8] = 8; // bit depth
  header[9] = 6; // colour type: RGBA

  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', header),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

/* --------------------------------------------------------------------- run */

mkdirSync(publicDir, { recursive: true });

const assets = [
  ['pwa-192.png', drawIcon(192)],
  ['pwa-512.png', drawIcon(512)],
  // Maskable icons are cropped to a circle by some launchers, so the mark is
  // inset and the background runs edge to edge.
  ['pwa-maskable-512.png', drawIcon(512, { margin: 0.18, corner: 32 })],
  ['apple-touch-icon.png', drawIcon(180, { corner: 32 })],
  ['og-card.png', drawCard(1200, 630)],
];

for (const [name, image] of assets) {
  const png = encodePng(image);
  writeFileSync(join(publicDir, name), png);
  console.log(`${name}  ${image.width}×${image.height}  ${(png.length / 1024).toFixed(1)} kB`);
}
