// チャンクを作って、落ちないか・時間・木の葉が幹から4マス以内か を調べる
const { load } = require('./genlab_lib.js');
const G = load(['WorldGen2', 'TK', 'genFeature', 'F4', 'FEAT']);
const { B, BLOCKS, ISLEAF, ISLOG } = G;
// 1) 形ごとの確認
let bad = 0;
for (const name in G.TK) {
  const kind = G.TK[name]; let maxR = 0, maxH = 0, nLeaf = 0, far = 0;
  for (let n = 0; n < 300; n++) {
    const rng = G.mulberry32(n * 7919 + kind), cells = [];
    const put = (x, y, z, id, m) => cells.push([x, y, z, id, m]);
    if (kind < 4) G.genTreeShape(kind, rng, put); else G.genFeature(kind, rng, put);
    const logs = cells.filter(c => ISLOG[c[3]]);
    for (const c of cells) {
      maxR = Math.max(maxR, Math.abs(c[0]), Math.abs(c[2])); maxH = Math.max(maxH, c[1]);
      if (ISLEAF[c[3]]) { nLeaf++; let ok = false; for (const l of logs) if (Math.abs(l[0] - c[0]) <= 4 && Math.abs(l[1] - c[1]) <= 4 && Math.abs(l[2] - c[2]) <= 4) { ok = true; break; } if (!ok) far++; }
      if (c[3] === undefined || !BLOCKS[c[3]]) { console.log('知らないブロック', name, c); bad++; }
    }
  }
  console.log(name.padEnd(9), 'はば', maxR, '高さ', maxH, '葉', nLeaf, '遠い葉', far);
  if (far) bad++;
}
// 2) チャンクを作る
const cnt = new Float64Array(256); let t0 = Date.now(), nch = 0, ents = 0;
for (const seed of [1, 2, 3]) {
  const g = new G.WorldGen2(seed);
  for (let cz = -20; cz < 20; cz += 1) for (let cx = -20; cx < 20; cx += 1) {
    if (((cx * 7 + cz * 13) & 7) !== 0) continue;
    const r = g.genChunk(cx * 3, cz * 3); nch++; ents += r.ents.length;
    for (let i = 0; i < r.blocks.length; i++) cnt[r.blocks[i]]++;
  }
}
console.log('チャンク', nch, '1こあたり', ((Date.now() - t0) / nch).toFixed(2), 'ms  チェスト', ents);
const rows = []; for (let i = 1; i < 256; i++) if (cnt[i]) rows.push([BLOCKS[i].name, Math.round(cnt[i] / nch)]);
console.log(rows.map(r => r[0] + ' ' + r[1]).join(' / '));
const miss = []; for (let i = 74; i < 110; i++) if (BLOCKS[i] && !cnt[i] && !/板|苗木|素焼き$/.test(BLOCKS[i].name)) miss.push(BLOCKS[i].name); console.log('一度も出なかった:', miss.join('、'));
// 3) 世界の中での確認：3×3チャンクを作って、まん中のチャンクの葉が どれも幹から4マス以内にあるか
{
  let leaves = 0, orphan = 0, chunks = 0; const ex = [];
  for (const seed of [11, 12, 13]) {
    const g = new G.WorldGen2(seed), cache = new Map();
    const get = (cx, cz) => { const k = cx + ',' + cz; let c = cache.get(k); if (!c) { c = g.genChunk(cx, cz).blocks; cache.set(k, c); } return c; };
    const at = (wx, y, wz) => (y < 0 || y > 127) ? 0 : get(wx >> 4, wz >> 4)[(y << 8) | ((wz & 15) << 4) | (wx & 15)];
    for (let n = 0; n < 60; n++) {
      // 森の多い場所をえらぶ
      let cx = 0, cz = 0, found = false;
      for (let t = 0; t < 40 && !found; t++) { cx = Math.floor((G.rand2(n, t, seed) - 0.5) * 300); cz = Math.floor((G.rand2(t, n, seed ^ 5) - 0.5) * 300); g.column(cx * 16 + 8, cz * 16 + 8); if (G.FEAT[g.colB] && G.FEAT[g.colB].d > 0.02) found = true; }
      if (!found) continue;
      chunks++;
      const c = get(cx, cz);
      for (let i = 0; i < c.length; i++) if (ISLEAF[c[i]]) {
        leaves++;
        const lx = i & 15, lz = (i >> 4) & 15, y = i >> 8, wx = cx * 16 + lx, wz = cz * 16 + lz; let ok = false;
        for (let dy = -4; dy <= 4 && !ok; dy++) for (let dz = -4; dz <= 4 && !ok; dz++) for (let dx = -4; dx <= 4; dx++) if (ISLOG[at(wx + dx, y + dy, wz + dz)]) { ok = true; break; }
        if (!ok) { orphan++; if (ex.length < 5) ex.push([seed, wx, y, wz, BLOCKS[c[i]].name]); }
      }
    }
  }
  console.log('森のチャンク', chunks, ' 葉', leaves, ' 幹から遠い葉', orphan, JSON.stringify(ex));
  if (orphan) bad++;
}
process.exit(bad ? 1 : 0);
