/*
 * gen-splash-pngs.js — generate solid brand-dark iOS launch images.
 *
 * WHY: iOS does NOT use the manifest background_color for a home-screen PWA's
 * launch screen. With no apple-touch-startup-image it shows a WHITE screen
 * before any HTML renders (the "white flash on open" bug). These solid
 * #0B0B0F PNGs, referenced per-device in the page head, make that pre-render
 * screen dark so it blends seamlessly into the in-app #ss-splash — the flash
 * disappears. Solid colour means each file compresses to a few hundred bytes.
 *
 * Dependency-free: hand-rolls the PNG (zlib is built into Node). Run locally:
 *   node data/gen-splash-pngs.js
 * Output: ../splash/splash-<w>x<h>.png  (+ the <link> tags to paste, on stdout)
 */
'use strict';

const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

// Brand background — must match --bg (#0B0B0F) and #ss-splash.
const R = 0x0b, G = 0x0b, B = 0x0f;

// ── CRC32 (PNG chunk checksum) ──────────────────────────────────────────
const CRC_TABLE = (function () {
  const t = new Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
    t[n] = c >>> 0;
  }
  return t;
})();
function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function chunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length, 0);
  const typeBuf = Buffer.from(type, 'ascii');
  const body = Buffer.concat([typeBuf, data]);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(body), 0);
  return Buffer.concat([len, body, crc]);
}

// ── Solid-colour PNG (truecolor, 8-bit) ─────────────────────────────────
function solidPng(w, h) {
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0);
  ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8;   // bit depth
  ihdr[9] = 2;   // colour type: truecolor RGB
  ihdr[10] = 0;  // compression
  ihdr[11] = 0;  // filter
  ihdr[12] = 0;  // interlace
  // Raw scanlines: each row = filter byte (0) + w*3 RGB bytes.
  const rowLen = 1 + w * 3;
  const raw = Buffer.alloc(rowLen * h);
  for (let y = 0; y < h; y++) {
    const o = y * rowLen;
    raw[o] = 0; // filter: none
    for (let x = 0; x < w; x++) {
      const p = o + 1 + x * 3;
      raw[p] = R; raw[p + 1] = G; raw[p + 2] = B;
    }
  }
  const idat = zlib.deflateSync(raw, { level: 9 });
  return Buffer.concat([
    sig,
    chunk('IHDR', ihdr),
    chunk('IDAT', idat),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

// ── Device matrix: [cssW, cssH, dpr] portrait. Covers iPhone SE→16 + iPads ──
const DEVICES = [
  [320, 568, 2], [375, 667, 2], [414, 736, 3], [375, 812, 3], [414, 896, 2],
  [414, 896, 3], [390, 844, 3], [428, 926, 3], [393, 852, 3], [430, 932, 3],
  [402, 874, 3], [440, 956, 3], // iPhone 16 Pro / 16 Pro Max
  [820, 1180, 2], [834, 1194, 2], [768, 1024, 2], [810, 1080, 2],
  [834, 1112, 2], [1024, 1366, 2], [744, 1133, 2],
];

const outDir = path.join(__dirname, '..', 'splash');
fs.mkdirSync(outDir, { recursive: true });

const seen = new Set();
const links = [];
for (const [cw, ch, dpr] of DEVICES) {
  const pw = cw * dpr, ph = ch * dpr;
  const key = pw + 'x' + ph;
  const file = 'splash/splash-' + key + '.png';
  if (!seen.has(key)) {
    seen.add(key);
    fs.writeFileSync(path.join(outDir, 'splash-' + key + '.png'), solidPng(pw, ph));
  }
  // Portrait media query (the home-screen launch is always portrait here).
  links.push(
    '<link rel="apple-touch-startup-image" ' +
    'media="screen and (device-width: ' + cw + 'px) and (device-height: ' + ch + 'px) ' +
    'and (-webkit-device-pixel-ratio: ' + dpr + ') and (orientation: portrait)" ' +
    'href="' + file + '">'
  );
}

console.log('Wrote ' + seen.size + ' PNG(s) to ' + outDir + '\n');
console.log(links.join('\n'));
