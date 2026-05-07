const sharp = require('sharp');
const path = require('path');
const fs = require('fs');

const SRC = 'C:/art/Baselings/garden';
const DST = 'C:/Users/bigji/Documents/Tales-of-Tasern/public/sprites/garden';

const FILES = [
  { src: 'sprout.png', dst: 'sprout.png' },
  { src: 'BTC buds.png', dst: 'buds-btc.png' },
  { src: 'ETH buds.png', dst: 'buds-eth.png' },
  { src: 'BTC flowers.png', dst: 'bloom-btc.png' },
  { src: 'ETH flower.png', dst: 'bloom-eth.png' },
];

async function main() {
  // Copy background
  fs.copyFileSync(path.join(SRC, 'garden.png'), path.join(DST, 'garden.png'));
  console.log('  OK: garden.png (background)');

  for (const f of FILES) {
    const src = path.join(SRC, f.src);
    const dst = path.join(DST, f.dst);

    const { data, info } = await sharp(src)
      .raw()
      .ensureAlpha()
      .toBuffer({ resolveWithObject: true });

    const pixels = Buffer.from(data);
    for (let i = 0; i < pixels.length; i += 4) {
      const r = pixels[i], g = pixels[i+1], b = pixels[i+2];
      if (r < 25 && g < 25 && b < 25) {
        pixels[i+3] = 0;
      }
    }

    await sharp(pixels, { raw: { width: info.width, height: info.height, channels: 4 } })
      .png()
      .toFile(dst);

    console.log(`  OK: ${f.dst} (${info.width}x${info.height})`);
  }

  console.log('\nDone!');
}

main().catch(e => { console.error(e); process.exit(1); });
