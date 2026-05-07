const sharp = require('sharp');
const path = require('path');
const fs = require('fs');

const SRC = 'C:/art/Baselings/eggs';
const DST = 'C:/Users/bigji/Documents/Tales-of-Tasern/public/sprites/eggs';

// Final verified mapping: grok-image-{id}.png → color-Nstar.png
const MAP = {
  // WHITE (6 sprites — 2 variants at 1-star and 3-star)
  'e4e78c91': 'white-0star',
  '3bb5d822': 'white-1star',
  'e39f91bf': 'white-1star-b',
  'a4428399': 'white-2star',
  'cece5b80': 'white-3star',
  'd520fb91': 'white-3star-b',
  // GREEN
  '57f78f8e': 'green-0star',
  '45d40108': 'green-1star',
  '8390284c': 'green-2star',
  'd5311513': 'green-3star',
  // RED
  '3ce560e3': 'red-0star',
  '4f773f06': 'red-1star',
  '2204bb76': 'red-2star',
  '25169604': 'red-3star',
  // BLUE
  'f5d49d55': 'blue-0star',
  'a65d2d42': 'blue-1star',
  '46e444d0': 'blue-2star',
  'b01f5e77': 'blue-3star',
  // BROWN
  '7c97164d': 'brown-0star',
  'ca213762': 'brown-1star',
  'ed1348be': 'brown-2star',
  'ca53c158': 'brown-3star',
};

async function processEgg(id, name) {
  const src = path.join(SRC, `grok-image-${id}-${getFullId(id)}.png`);
  const dst = path.join(DST, `${name}.png`);

  const { data, info } = await sharp(src)
    .raw()
    .ensureAlpha()
    .toBuffer({ resolveWithObject: true });

  const pixels = Buffer.from(data);
  for (let i = 0; i < pixels.length; i += 4) {
    const r = pixels[i], g = pixels[i+1], b = pixels[i+2];
    if (r < 30 && g < 30 && b < 30) {
      pixels[i+3] = 0; // alpha = 0
    }
  }

  await sharp(pixels, { raw: { width: info.width, height: info.height, channels: 4 } })
    .png()
    .toFile(dst);

  console.log(`  OK: ${name}.png (${info.width}x${info.height})`);
}

// Get full UUID suffix from actual files
function getFullId(shortId) {
  const files = fs.readdirSync(SRC);
  const match = files.find(f => f.includes(shortId));
  if (!match) throw new Error(`No file found for id ${shortId}`);
  // Extract everything between grok-image-{shortId}- and .png
  // Filename format: grok-image-XXXXXXXX-XXXX-XXXX-XXXX-XXXXXXXXXXXX.png
  // shortId is the first 8 chars
  return null; // we'll use a different approach
}

async function main() {
  // Build lookup from actual filenames
  const files = fs.readdirSync(SRC);
  console.log(`Processing ${Object.keys(MAP).length} eggs...\n`);

  for (const [id, name] of Object.entries(MAP)) {
    const file = files.find(f => f.includes(id));
    if (!file) {
      console.log(`  SKIP: no file for ${id} (${name})`);
      continue;
    }
    const src = path.join(SRC, file);
    const dst = path.join(DST, `${name}.png`);

    const { data, info } = await sharp(src)
      .raw()
      .ensureAlpha()
      .toBuffer({ resolveWithObject: true });

    const pixels = Buffer.from(data);
    for (let i = 0; i < pixels.length; i += 4) {
      const r = pixels[i], g = pixels[i+1], b = pixels[i+2];
      if (r < 30 && g < 30 && b < 30) {
        pixels[i+3] = 0;
      }
    }

    await sharp(pixels, { raw: { width: info.width, height: info.height, channels: 4 } })
      .png()
      .toFile(dst);

    console.log(`  OK: ${name}.png (${info.width}x${info.height})`);
  }

  console.log('\nDone!');
}

main().catch(e => { console.error(e); process.exit(1); });
