import sharp from 'sharp';
import { mkdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');
const src = path.join(root, 'public', 'logo.png');
const iconsDir = path.join(root, 'public', 'icons');
mkdirSync(iconsDir, { recursive: true });

const SIZES = [72, 96, 128, 144, 152, 192, 384, 512];
const input = sharp(src).resize(512, 512, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } });

// PNG per size
for (const size of SIZES) {
  const buf = await input.clone().resize(size, size).png().toBuffer();
  await sharp(buf).toFile(path.join(iconsDir, `icon-${size}x${size}.png`));
  console.log('icon', size);
}

// apple-touch-icon 180
const apple = await input.clone().resize(180, 180).png().toBuffer();
await sharp(apple).toFile(path.join(root, 'public', 'apple-touch-icon.png'));
console.log('apple-touch-icon 180');

// favicon.ico: multi-frame ICO with PNG frames (16, 32, 48)
const pngs = [];
for (const s of [16, 32, 48]) {
  pngs.push({ size: s, buf: await input.clone().resize(s, s).png().toBuffer() });
}
const ico = buildIco(pngs);
const fs = await import('node:fs');
fs.writeFileSync(path.join(root, 'public', 'favicon.ico'), ico);
console.log('favicon.ico (16/32/48)');

function buildIco(images) {
const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0);      // reserved
  header.writeUInt16LE(1, 2);      // type = icon
  header.writeUInt16LE(images.length, 4);
  const dir = images.length * 16;
  let offset = 6 + dir;
  const chunks = [header];
  images.forEach((img) => {
    const entry = Buffer.alloc(16);
    entry.writeUInt8(img.size >= 256 ? 0 : img.size, 0);
    entry.writeUInt8(img.size >= 256 ? 0 : img.size, 1);
    entry.writeUInt8(0, 2);              // colors
    entry.writeUInt8(0, 3);              // reserved
    entry.writeUInt16LE(1, 4);           // planes
    entry.writeUInt16LE(32, 6);          // bpp
    entry.writeUInt32LE(img.buf.length, 8);
    entry.writeUInt32LE(offset, 12);
    chunks.push(entry);
    offset += img.buf.length;
  });
  for (const img of images) chunks.push(img.buf);
  return Buffer.concat(chunks);
}
console.log('Done.');