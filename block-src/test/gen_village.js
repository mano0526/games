// 村（版3）の確認：最初の場所の近くに 村があるか・建物が そろっているか・版2と ちがうのは 村と塔の所だけか
const { load } = require('./genlab_lib.js');
const G = load(['WorldGen3', 'VIL_CELL', 'VIL_B', 'lotXZ', 'tradesOf', 'VJOBS', 'itemName']);
const { B, BLOCKS } = G;
let bad = 0; const fail = (m) => { console.log('NG', m); bad++; };
const show = process.argv[2] === 'show';
let nV = 0, nHome = 0, nLots = 0, nMarks = 0, tGen = 0, nTower = 0, nCells = 0;
const kinds = {}, biomes = {};
const SEEDS = show ? [+process.argv[3] || 1] : [1, 2, 3, 4, 5, 6, 7, 8, 20261118, -5551212, 987654321, 424242];
for (const seed of SEEDS) {
  const g = new G.GENS[3](seed), g2 = new G.GENS[2](seed);
  const home = g.village(0, 0);
  if (home) nHome++;
  // まわり 5×5 ますの村を数える
  for (let vz = -2; vz <= 2; vz++) for (let vx = -2; vx <= 2; vx++) { nCells++; const V = g.village(vx, vz); if (V) { nV++; nLots += V.lots.length; biomes[G.BIOME_NAMES[V.b]] = (biomes[G.BIOME_NAMES[V.b]] || 0) + 1; for (const l of V.lots) kinds[l.type] = (kinds[l.type] || 0) + 1; } }
  const V = home || g.nearestVillage(0, 0);
  if (!V) { console.log('種', seed, '近くに村なし'); continue; }
  const c0x = (V.x - V.rad) >> 4, c1x = (V.x + V.rad) >> 4, c0z = (V.z - V.rad) >> 4, c1z = (V.z + V.rad) >> 4;
  const W = (c1x - c0x + 1) * 16, H = (c1z - c0z + 1) * 16, top = new Array(W * H).fill(' ');
  const marks = [], chests = []; let doors = 0, beds = 0, diffOut = 0;
  const t0 = Date.now();
  for (let cz = c0z; cz <= c1z; cz++) for (let cx = c0x; cx <= c1x; cx++) {
    const r = g.genChunk(cx, cz), r2 = g2.genChunk(cx, cz);
    for (const e of r.ents) { if (e.t === 'vmark') marks.push([cx * 16 + (e.i & 15), e.i >> 8, cz * 16 + ((e.i >> 4) & 15), e]); if (e.t === 'chest') chests.push(e); }
    for (let i = 0; i < G.CVOL; i++) {
      const id = r.blocks[i];
      if (id && !BLOCKS[id]) fail('知らないブロック ' + id);
      if (id === B.vmark && !r.ents.some(e => e.i === i && e.t === 'vmark')) fail('しるしに 中身がない');
      if (G.SHAPE[id] === 10 && !(r.meta[i] & 8)) doors++;
      if (id === B.bed && !(r.meta[i] & 4)) beds++;
      if (id !== r2.blocks[i]) {   // 版2と ちがう所は、村の わくの中だけのはず
        const wx = cx * 16 + (i & 15), wz = cz * 16 + ((i >> 4) & 15);
        if (!V.rects.some(q => wx >= q[0] - 9 && wx <= q[2] + 9 && wz >= q[1] - 9 && wz <= q[3] + 9) && !g.ruinZone(wx, wz)) { const T = g.tower(cx, cz); if (!T) diffOut++; }
      }
    }
    for (let z = 0; z < 16; z++) for (let x = 0; x < 16; x++) {
      let y = r.maxY; while (y > 0 && !r.blocks[(y << 8) | (z << 4) | x]) y--;
      const id = r.blocks[(y << 8) | (z << 4) | x], k = BLOCKS[id].key;
      top[((cz - c0z) * 16 + z) * W + (cx - c0x) * 16 + x] = id === B.path || id === B.smooth_sandstone ? '.' : k.startsWith('stairs') ? '^' : k.startsWith('slab') ? '=' : id === B.water ? '~' : k.endsWith('_crop') ? 'w' : id === B.farmland ? 'f' : id === B.lantern ? '*' : k.startsWith('leaves') ? 'T' : k.startsWith('log') ? 'o' : id === B.hay ? 'h' : id === B.pumpkin ? 'p' : ' ';
    }
  }
  tGen += Date.now() - t0;
  nMarks += marks.length;
  const want = V.lots.reduce((a, l) => a + (l.type === 'hm' ? 2 : 1), 0), houses = V.lots.filter(l => l.type !== 'farm').length;
  if (marks.length !== want) fail('種 ' + seed + ' 村人のしるし ' + marks.length + ' / ' + want);
  if (doors !== houses) fail('種 ' + seed + ' ドア ' + doors + ' / ' + houses);
  if (new Set(marks.map(m => m[3].s)).size !== marks.length) fail('村人の番号が かぶっている');
  if (diffOut) fail('種 ' + seed + ' 村の外で 版2と ちがうマス ' + diffOut);
  for (const m of marks) { const tr = G.tradesOf(m[3].s); if (tr.length !== 6 || tr.some(t => !G.ITEMS[t[0]] || !G.ITEMS[t[2]] || !(t[1] > 0) || !(t[3] > 0))) fail('こうかんの表が おかしい'); }
  console.log('種', seed, home ? '最初のます' : '近くのます', '村', V.x, V.z, '高さ', V.y, G.BIOME_NAMES[V.b], '道', V.arms.join('/'), '建物', V.lots.map(l => l.type).join(','), 'しるし', marks.length, 'ドア', doors, 'ベッド', beds, '宝箱', chests.length, 'まん中から', Math.round(Math.hypot(V.x, V.z)));
  if (show) { for (let z = 0; z < H; z++) console.log(top.slice(z * W, z * W + W).join('')); for (const m of marks) console.log('村人', G.VJOBS[m[3].s & 3], m.slice(0, 3).join(','), G.tradesOf(m[3].s).map(t => G.ITEMS[t[0]].name + t[1] + '→' + G.ITEMS[t[2]].name + t[3]).join(' ／ ')); }
  // 見はり塔を さがす（まわり 40×40 チャンク）
  for (let cz = -20; cz < 20; cz++) for (let cx = -20; cx < 20; cx++) if (g.tower(cx, cz)) nTower++;
}
console.log('村', nV, '/', nCells, 'ます  最初のますに ある', nHome, '/', SEEDS.length, ' 建物', JSON.stringify(kinds), ' バイオーム', JSON.stringify(biomes), ' 塔（1種あたり 640×640の中）', (nTower / SEEDS.length).toFixed(1), ' 作る時間', tGen, 'ms');
if (!show && nHome < SEEDS.length * 0.7) fail('最初のますに 村が少ない');
console.log(bad ? 'NG ' + bad : 'OK');
process.exit(bad ? 1 : 0);
