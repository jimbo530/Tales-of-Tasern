const sharp = require('sharp');
const path = require('path');
const fs = require('fs');

const SRC = 'C:/art/Baselings/food';
const DST = path.join(__dirname, '..', 'public', 'sprites', 'food');

const FILES = [
  { src: 'grok-image-59b6b208-ee73-4482-b775-eb06b6171df3.png', dst: 'salad.png' },
  { src: 'grok-image-58d09149-366a-4395-8289-1d0c3bb84c42.png', dst: 'rice.png' },
  { src: 'grok-image-b5234b21-d6d8-410d-affb-9c920b65524a.png', dst: 'burger.png' },
];

// Pink background — flood fill from edges through pink-ish pixels
function isPink(r, g, b) {
  return r > 160 && g < 120 && b > 80 && b < 180 && r > g + 60;
}

async function processFile(f) {
  const { data, info } = await sharp(path.join(SRC, f.src))
    .raw()
    .ensureAlpha()
    .toBuffer({ resolveWithObject: true });

  const w = info.width, h = info.height;
  const pixels = Buffer.from(data);
  const visited = new Uint8Array(w * h);

  function isBg(idx) {
    return isPink(pixels[idx], pixels[idx+1], pixels[idx+2]);
  }

  // Flood fill from all edge pixels — only spread through pink pixels
  const queue = [];
  for (let x = 0; x < w; x++) {
    if (isBg(x * 4)) queue.push(x);
    const bot = (h - 1) * w + x;
    if (isBg(bot * 4)) queue.push(bot);
  }
  for (let y = 0; y < h; y++) {
    const left = y * w;
    if (isBg(left * 4)) queue.push(left);
    const right = y * w + w - 1;
    if (isBg(right * 4)) queue.push(right);
  }

  // BFS flood fill
  for (const s of queue) visited[s] = 1;
  let head = 0;
  while (head < queue.length) {
    const pos = queue[head++];
    const x = pos % w, y = Math.floor(pos / w);
    const neighbors = [];
    if (x > 0) neighbors.push(pos - 1);
    if (x < w - 1) neighbors.push(pos + 1);
    if (y > 0) neighbors.push(pos - w);
    if (y < h - 1) neighbors.push(pos + w);
    for (const n of neighbors) {
      if (!visited[n] && isBg(n * 4)) {
        visited[n] = 1;
        queue.push(n);
      }
    }
  }

  // Make visited (background) pixels transparent
  for (let i = 0; i < w * h; i++) {
    if (visited[i]) pixels[i * 4 + 3] = 0;
  }

  const dst = path.join(DST, f.dst);
  await sharp(pixels, { raw: { width: w, height: h, channels: 4 } })
    .png()
    .toFile(dst + '.tmp');
  fs.renameSync(dst + '.tmp', dst);
  console.log('OK: ' + f.dst + ' (' + w + 'x' + h + ')');
}

async function main() {
  for (const f of FILES) await processFile(f);
  console.log('Done!');
}

main().catch(e => { console.error(e); process.exit(1); });
