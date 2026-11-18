// 版2の地形の統計：バイオームの割合・ひとかたまりの大きさ・最初の地点からの近さ
const { load, png } = require('./genlab_lib.js');
const G = load(['WorldGen2', 'CLIMATE', 'uni2', 'TK', 'genFeature', 'FEAT']);
const NB = G.BIOME_NAMES.length;
const seeds = process.argv[2] ? process.argv[2].split(',').map(Number) : [1, 2, 3, 4, 5, 6, 7, 8];
const R = +(process.argv[3] || 1500), STEP = 8;
const share = new Float64Array(NB), nearest = [];
let total = 0;
const runs = [];
for (const seed of seeds) {
  const g = new G.WorldGen2(seed);
  const near = new Float64Array(NB).fill(1e9);
  const N = Math.floor(2 * R / STEP) + 1, grid = new Uint8Array(N * N);
  for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
    const x = -R + i * STEP, z = -R + j * STEP;
    g.column(x, z); const b = g.colB; grid[j * N + i] = b;
    share[b]++; total++;
    const d = Math.hypot(x, z); if (d < near[b]) near[b] = d;
  }
  nearest.push(near);
  // 横と縦にまっすぐ歩いたとき、同じバイオームが続く長さ
  for (let j = 0; j < N; j += 6) { let s = 0; for (let i = 1; i <= N; i++) if (i === N || grid[j * N + i] !== grid[j * N + s]) { runs.push([grid[j * N + s], (i - s) * STEP]); s = i; } }
  for (let i = 0; i < N; i += 6) { let s = 0; for (let j = 1; j <= N; j++) if (j === N || grid[j * N + i] !== grid[s * N + i]) { runs.push([grid[s * N + i], (j - s) * STEP]); s = j; } }
}
const landIds = []; for (let b = 0; b < NB; b++) if (![0, 10, 22, 23].includes(b)) landIds.push(b);
let landTot = 0; for (const b of landIds) landTot += share[b];
console.log('種  = ' + seeds.join(',') + '   範囲 ±' + R + '   陸の割合 ' + (landTot / total * 100).toFixed(1) + '%');
const med = (a) => { a = a.slice().sort((x, y) => x - y); return a.length ? a[Math.floor(a.length / 2)] : 0; };
for (let b = 0; b < NB; b++) {
  const rl = runs.filter(r => r[0] === b).map(r => r[1]);
  const nr = nearest.map(n => n[b]);
  const found = nr.filter(v => v < 1e8).length;
  console.log((G.BIOME_NAMES[b] + '　　　　　　　　').slice(0, 9) + ' 全体 ' + (share[b] / total * 100).toFixed(1).padStart(5) + '%  陸の中 ' + (landIds.includes(b) ? (share[b] / landTot * 100).toFixed(1).padStart(5) + '%' : '   - ') +
    '  続く長さ(中央) ' + String(med(rl)).padStart(4) + '  近さ(中央) ' + String(Math.round(med(nr.map(v => v > 1e8 ? 99999 : v)))).padStart(5) + '  ある世界 ' + found + '/' + seeds.length);
}
const all = runs.map(r => r[1]); console.log('続く長さ 全体の中央 ' + med(all) + '  平均 ' + (all.reduce((a, b) => a + b, 0) / all.length).toFixed(0));
// 「自分が立っている場所のバイオームが、まっすぐ歩いて何マス続くか」の中央値（広さの実感に近い）
{
  const by = {}; for (const [b, L] of runs) { (by[b] = by[b] || []).push(L); }
  const wmed = (a) => { a = a.slice().sort((x, y) => x - y); const tot = a.reduce((p, c) => p + c, 0); let acc = 0; for (const v of a) { acc += v; if (acc >= tot / 2) return v; } return 0; };
  let line = '立っている場所の続く長さ: ';
  for (const b in by) if (![0, 1, 10, 22, 23].includes(+b)) line += G.BIOME_NAMES[b] + ' ' + wmed(by[b]) + ' / ';
  console.log(line);
  console.log('陸ぜんたい: ' + wmed(runs.filter(r => ![0, 1, 10, 22, 23].includes(r[0])).map(r => r[1])));
}
