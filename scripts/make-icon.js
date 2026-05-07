const sharp = require('sharp');
const path = require('path');

const SRC = path.join(__dirname, '..', 'public', 'sprites', 'egg-store.png');
const DST = path.join(__dirname, '..', 'public', 'baselings-icon.png');

async function main() {
  const meta = await sharp(SRC).metadata();
  const size = Math.min(meta.width, meta.height);
  const left = Math.round((meta.width - size) / 2);
  const top = Math.round((meta.height - size) / 2);

  await sharp(SRC)
    .extract({ left, top, width: size, height: size })
    .resize(512, 512)
    .png()
    .toFile(DST);

  console.log('Icon created: 512x512 baselings-icon.png');
}

main().catch(e => { console.error(e); process.exit(1); });
