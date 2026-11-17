const fs = require('fs');
const src = ['01_util.js','02_blocks.js','03_gen.js'].map(f => fs.readFileSync(__dirname + '/../src/' + f, 'utf8')).join('\n');
const M = new Function(src + '\nreturn {WorldGen, B, BLOCKS, BIOME, BIOME_NAMES, SEA};')();
for (const seed of [12345, 777, 20261118]) {
  const gen = new M.WorldGen(seed);
  let air = 0, tot = 0, lava = 0, open = 0, cols = 0; const byY = new Float64Array(128), totY = new Float64Array(128);
  for (let cz = -8; cz <= 8; cz++) for (let cx = -8; cx <= 8; cx++) {
    const r = gen.genChunk(cx, cz);
    for (let z = 0; z < 16; z++) for (let x = 0; x < 16; x++) {
      const h = gen.gH[(z + 4) * 24 + x + 4]; cols++;
      if (h > M.SEA && r.blocks[(h << 8) | (z << 4) | x] === 0) open++;
      for (let y = 1; y <= h - 5; y++) { const id = r.blocks[(y << 8) | (z << 4) | x]; tot++; totY[y]++; if (id === 0) { air++; byY[y]++; } if (id === M.B.lava) { lava++; byY[y]++; } }
    }
  }
  console.log('seed', seed, 'carved %', ((air + lava) / tot * 100).toFixed(2), 'lava %', (lava / tot * 100).toFixed(2), 'surface openings % of land cols', (open / cols * 100).toFixed(2));
  let s = ''; for (let y = 4; y < 80; y += 6) s += 'y' + y + ':' + (byY[y] / Math.max(1, totY[y]) * 100).toFixed(1) + ' '; console.log(s);
}
