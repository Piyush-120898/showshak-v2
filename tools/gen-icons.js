'use strict';
/*
 * gen-icons.js — rasterize icon.svg → PWA PNG icons for reliable installability.
 *
 * WHY: some Android Chrome builds won't fire the install prompt from an SVG-only
 * manifest. Proper 192/512 PNGs (both "any" and "maskable" purpose) close that gap,
 * and apple-touch-icon.png gives iOS a real home-screen icon.
 *
 * One-time DEV tool — keeps the shipped app dependency-free (sharp is never saved):
 *   npm install sharp --no-save
 *   node tools/gen-icons.js
 * Output: PNGs written to the repo root. Then wire them into manifest.webmanifest.
 */
const path = require('path');
const sharp = require('sharp');

const ROOT = path.join(__dirname, '..');
const SRC = path.join(ROOT, 'icon.svg');
const BLACK = { r: 0, g: 0, b: 0, alpha: 1 };            // matches the icon's own #000 square
const TRANSPARENT = { r: 0, g: 0, b: 0, alpha: 0 };

// Render the SVG as-is onto an opaque square (the icon already carries ~15% inset).
function flat(size, out) {
  return sharp(SRC, { density: 512 })
    .resize(size, size, { fit: 'contain', background: BLACK })
    .png()
    .toFile(path.join(ROOT, out))
    .then(() => console.log('  wrote', out));
}

// Maskable: shrink the whole mark to 80% of the canvas so Android's circle/squircle
// crop never clips it (safe zone = central 80%).
async function maskable(size, out) {
  const inner = Math.round(size * 0.8);
  const logo = await sharp(SRC, { density: 512 })
    .resize(inner, inner, { fit: 'contain', background: TRANSPARENT })
    .png()
    .toBuffer();
  await sharp({ create: { width: size, height: size, channels: 4, background: BLACK } })
    .composite([{ input: logo, gravity: 'center' }])
    .png()
    .toFile(path.join(ROOT, out));
  console.log('  wrote', out);
}

(async () => {
  console.log('Generating icons from', SRC);
  await flat(192, 'icon-192.png');
  await flat(512, 'icon-512.png');
  await maskable(192, 'icon-192-maskable.png');
  await maskable(512, 'icon-512-maskable.png');
  await flat(180, 'apple-touch-icon.png');   // iOS home-screen icon (opaque)
  console.log('Done. Now confirm manifest.webmanifest references these PNGs.');
})().catch((e) => { console.error(e); process.exit(1); });
