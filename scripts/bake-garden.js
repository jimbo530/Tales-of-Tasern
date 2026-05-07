const sharp = require('sharp');
const path = require('path');
const fs = require('fs');

const DST = 'C:/Users/bigji/Documents/Tales-of-Tasern/public/sprites/garden';
const BG = path.join(DST, 'garden.png');
const OUT = path.join(DST, 'garden-baked.png');

// Sprite types in order: 18 sprouts, 9 btc buds, 9 eth buds, 9 btc blooms, 9 eth blooms
const types = [];
for (let i = 0; i < 18; i++) types.push('sprout.png');
for (let i = 0; i < 9; i++) types.push('buds-btc.png');
for (let i = 0; i < 9; i++) types.push('buds-eth.png');
for (let i = 0; i < 9; i++) types.push('bloom-btc.png');
for (let i = 0; i < 9; i++) types.push('bloom-eth.png');

// Positions from design mode (% of container)
const positions = [
  {x:32.6,y:-3.7},{x:37.9,y:2},{x:28.7,y:-0.4},{x:35.7,y:-0.5},{x:48,y:10},
  {x:44.9,y:22.3},{x:66.2,y:6.9},{x:68.9,y:2.9},{x:86.1,y:31.2},{x:11.1,y:16.9},
  {x:17.2,y:22.8},{x:31.9,y:2.7},{x:40.9,y:18},{x:48.2,y:26.1},{x:45,y:14},
  {x:51.7,y:22.6},{x:78,y:24},{x:89,y:27.8},{x:11.6,y:28.5},{x:22,y:38.1},
  {x:74.7,y:27.6},{x:83.8,y:36.6},{x:10.6,y:61.2},{x:48.4,y:18.2},{x:81.2,y:20.1},
  {x:80.1,y:32.2},{x:82.2,y:27.6},{x:8.9,y:23.4},{x:22.2,y:49.5},{x:28,y:52},
  {x:32.5,y:45},{x:67.7,y:57},{x:59.1,y:48.1},{x:66.9,y:47.4},{x:74.2,y:47.8},
  {x:25.1,y:34.9},{x:18.3,y:44.2},{x:14.2,y:20.1},{x:25.4,y:44.5},{x:84.6,y:70.5},
  {x:28.2,y:39.4},{x:88.5,y:65.4},{x:77.9,y:70.3},{x:80.7,y:65.4},{x:84.5,y:60.9},
  {x:7.6,y:58.3},{x:13.5,y:65.3},{x:84.9,y:23.2},{x:62.9,y:43.5},{x:63.1,y:53.2},
  {x:66.4,y:39.4},{x:70.6,y:52.9},{x:81.9,y:75.4},{x:69.8,y:44.1},
];

const SCALE_VW = 5; // 5vw — treat image width as 100vw

async function main() {
  const bgMeta = await sharp(BG).metadata();
  const W = bgMeta.width;
  const H = bgMeta.height;
  const spriteW = Math.round(W * SCALE_VW / 100); // 5% of image width

  // Pre-resize each unique sprite
  const cache = {};
  const composites = [];

  for (let i = 0; i < types.length; i++) {
    const spriteName = types[i];
    const pos = positions[i];
    if (!pos) continue;

    if (!cache[spriteName]) {
      cache[spriteName] = await sharp(path.join(DST, spriteName))
        .resize(spriteW)
        .png()
        .toBuffer();
    }

    const buf = cache[spriteName];
    const meta = await sharp(buf).metadata();
    const px = Math.round(W * pos.x / 100);
    const py = Math.round(H * pos.y / 100);

    composites.push({
      input: buf,
      left: Math.max(0, Math.min(W - meta.width, px)),
      top: Math.max(0, Math.min(H - meta.height, py)),
    });
  }

  await sharp(BG)
    .composite(composites)
    .png()
    .toFile(OUT);

  console.log('Baked ' + composites.length + ' sprites into garden-baked.png (' + W + 'x' + H + ')');
}

main().catch(e => { console.error(e); process.exit(1); });
