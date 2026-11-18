// 最初の地点の確認（ゲームの findSpawn と同じ探し方）と、そこから各バイオームまでの近さ
const { load } = require('./genlab_lib.js');
const G = load(['WorldGen2']);
const SEA = G.SEA, BI = G.BIOME;
function findSpawn(gen) {
  let fallback = null;
  for (let r = 0; r < 140; r++) for (let k = 0; k < Math.max(1, r * 6); k++) {
    const a = k / Math.max(1, r * 6) * Math.PI * 2, x = Math.round(Math.cos(a) * r * 12), z = Math.round(Math.sin(a) * r * 12);
    const h = gen.column(x, z), b = gen.colB;
    if (!(h >= SEA + 2 && h < 76 && (b === BI.PLAINS || b === BI.FOREST || b === BI.FLOWER || b === BI.CHERRY || b === BI.BIRCH || b === BI.MEADOW))) continue;
    if (!fallback) fallback = { x, z, b, r: r * 12 };
    let lo = h, hi = h;
    for (let dz = -12; dz <= 12; dz += 4) for (let dx = -12; dx <= 12; dx += 4) { const hh = gen.column(x + dx, z + dz); if (hh < lo) lo = hh; if (hh > hi) hi = hh; }
    if (hi - lo <= 7 && lo >= SEA) return { x, z, b, r: r * 12 };
  }
  return fallback || { x: 0, z: 0, b: -1, r: -1 };
}
const NS = +(process.argv[2] || 60), R = 2600, ST = 16;
const spawnB = {}, dists = {}; let far = 0, noTree = 0;
const forestish = new Set([BI.FOREST, BI.BIRCH, BI.CHERRY, BI.DARK, BI.TAIGA, BI.JUNGLE, BI.OLD_TAIGA, BI.SNOW_TAIGA]);
for (let n = 0; n < NS; n++) {
  const seed = (n * 2654435761) | 0, g = new G.WorldGen2(seed), sp = findSpawn(g);
  spawnB[G.BIOME_NAMES[sp.b] || 'なし'] = (spawnB[G.BIOME_NAMES[sp.b] || 'なし'] || 0) + 1;
  if (sp.r > 100) far++;
  // 木のあるバイオームまでの近さ
  let tree = 9999; for (let r = 0; r <= 120 && tree > 9000; r += 8) for (let a = 0; a < 16; a++) { g.column(Math.round(sp.x + Math.cos(a / 16 * 6.283) * r), Math.round(sp.z + Math.sin(a / 16 * 6.283) * r)); if (forestish.has(g.colB)) { tree = r; break; } }
  if (tree > 64) noTree++;
  const near = {};
  for (let z = -R; z <= R; z += ST) for (let x = -R; x <= R; x += ST) { g.column(x, z); const b = g.colB, d = Math.hypot(x - sp.x, z - sp.z); if (near[b] === undefined || d < near[b]) near[b] = d; }
  for (let b = 0; b < G.BIOME_NAMES.length; b++) (dists[b] = dists[b] || []).push(near[b] === undefined ? 99999 : near[b]);
}
console.log('最初の地点のバイオーム', JSON.stringify(spawnB), ' まん中から100より遠い', far, ' 64マス以内に森がない', noTree, '/', NS);
for (let b = 0; b < G.BIOME_NAMES.length; b++) { const a = dists[b].sort((x, y) => x - y); console.log((G.BIOME_NAMES[b] + '　　　　　　　').slice(0, 8), '近さ 中央', String(Math.round(a[Math.floor(a.length / 2)])).padStart(5), ' 9割の世界で', String(Math.round(a[Math.floor(a.length * 0.9)])).padStart(5), '以内  見つからない世界', a.filter(v => v > 90000).length); }
