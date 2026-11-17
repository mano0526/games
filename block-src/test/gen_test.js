const fs = require('fs');
const src = ['01_util.js','02_blocks.js','03_gen.js'].map(f => fs.readFileSync(__dirname + '/../src/' + f, 'utf8')).join('\n');
const M = new Function(src + '\nreturn {WorldGen, B, BLOCKS, BIOME, BIOME_NAMES, SEA, RECIPES, ITEMS, I, SMELT, FUEL, specMatch, TAGS};')();
const seed = parseInt(process.argv[2] || '12345');
const gen = new M.WorldGen(seed);
// timing
let t0 = Date.now(), n = 0; const hist = new Float64Array(256); let ents = 0; let carved = 0, under = 0;
for (let cz = -6; cz <= 6; cz++) for (let cx = -6; cx <= 6; cx++) {
  const r = gen.genChunk(cx, cz); n++;
  for (let i = 0; i < r.blocks.length; i++) hist[r.blocks[i]]++;
  ents += r.ents.length;
}
const dt = Date.now() - t0;
console.log('chunks', n, 'avg ms', (dt / n).toFixed(2), 'ents', ents);
const names = [];
for (let i = 0; i < 256; i++) if (hist[i] && i) names.push(M.BLOCKS[i].key + ':' + hist[i]);
console.log(names.join(' '));
// map
const W = 512, step = 4; const buf = Buffer.alloc(W * W * 3);
const bc = [[30,60,160],[230,220,160],[120,190,80],[40,130,50],[235,210,120],[240,240,250],[60,110,90],[130,130,130],[250,170,200],[200,220,90],[60,110,200]];
const bcount = new Array(11).fill(0);
for (let j = 0; j < W; j++) for (let i = 0; i < W; i++) {
  const x = (i - W / 2) * step, z = (j - W / 2) * step;
  const h = gen.column(x, z); const b = gen.colB; bcount[b]++;
  let c = bc[b]; const sh = b === 0 || b === 10 ? 0.6 + (h - 20) / 70 : 0.55 + (h - 48) / 90;
  const o = (j * W + i) * 3; buf[o] = Math.min(255, c[0] * sh); buf[o + 1] = Math.min(255, c[1] * sh); buf[o + 2] = Math.min(255, c[2] * sh);
}
fs.writeFileSync('/tmp/kk/map_' + seed + '.ppm', Buffer.concat([Buffer.from(`P6\n${W} ${W}\n255\n`), buf]));
console.log(bcount.map((c, i) => M.BIOME_NAMES[i] + ':' + (c / W / W * 100).toFixed(1) + '%').join(' '));
// recipe sanity
let bad = 0;
for (const r of M.RECIPES) { if (!M.ITEMS[r.out]) { console.log('bad out', r.out); bad++; } for (const [s] of r.need) { if (typeof s === 'number' ? !M.ITEMS[s] : !M.TAGS[s]) { console.log('bad need', s, 'for', r.out); bad++; } } }
for (const k in M.SMELT) { if (!M.ITEMS[k] || !M.ITEMS[M.SMELT[k][0]]) { console.log('bad smelt', k); bad++; } }
for (const k in M.FUEL) if (!M.ITEMS[k]) { console.log('bad fuel', k); bad++; }
console.log('recipes', M.RECIPES.length, 'bad', bad, 'items', Object.keys(M.ITEMS).length);
// vertical slice for caves
const sl = []; const cz0 = 0;
for (let y = 100; y >= 0; y -= 2) { let row = ''; for (let cx = -4; cx < 4; cx++) { const r = gen.genChunk(cx, cz0); for (let x = 0; x < 16; x++) { const id = r.blocks[(y << 8) | (8 << 4) | x]; row += id === 0 ? ' ' : id === M.B.water ? '~' : id === M.B.lava ? '!' : id === M.B.stone ? '#' : id === M.B.dirt || id === M.B.grass ? '=' : id >= 22 && id <= 26 ? 'o' : '+'; } } sl.push(row); }
console.log(sl.join('\n'));
