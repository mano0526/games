// べつの世界（ホムラの底・ソラのはて）の地形の確認。 node test/gen_dims.js [種]
const { load } = require('./genlab_lib.js');
const G = load(['dimGenClass', 'fortInfo', 'nearestFort', 'soraPillars', 'H_LAVA', 'SORA_PED_Y', 'FORT_Y', 'FORT_CELL']);
const seed = +(process.argv[2] || 12345), B = G.B, BL = G.BLOCKS;
let bad = 0; const ng = (m) => { console.log('NG  ' + m); bad++; }, ok = (m) => console.log('OK  ' + m);
// ---- ホムラの底 ----
{
  const g = new (G.dimGenClass(2, 1))(seed), cnt = {}; let t0 = Date.now(), n = 0, air = 0, tot = 0, chests = 0, unknown = 0;
  const f = G.fortInfo(seed, 0, 0), fcx = f.x >> 4, fcz = f.z >> 4;
  const chunks = new Map();
  for (let cz = fcz - 5; cz <= fcz + 5; cz++) for (let cx = fcx - 5; cx <= fcx + 5; cx++) { const r = g.genChunk(cx, cz); chunks.set(cx + ',' + cz, r); n++; chests += r.ents.length;
    for (let i = 0; i < r.blocks.length; i++) { const id = r.blocks[i]; cnt[id] = (cnt[id] || 0) + 1; if (id && !BL[id]) unknown++; const y = i >> 8; if (y > G.H_LAVA && y < 100) { tot++; if (!id) air++; } } }
  const ms = (Date.now() - t0) / n;
  console.log('ホムラの底：1チャンク ' + ms.toFixed(1) + 'ms  空間の割合(32〜99) ' + (air / tot * 100).toFixed(0) + '%');
  const top = Object.entries(cnt).sort((a, b) => b[1] - a[1]).slice(0, 16).map(([id, c]) => (id === '0' ? '空気' : BL[id].name) + ' ' + (c / (n * 32768) * 100).toFixed(2) + '%').join('、');
  console.log('  ' + top);
  if (unknown) ng('知らない番号のブロック ' + unknown); else ok('ブロックの番号');
  if (ms > 60) ng('地形づくりが遅い'); else ok('速さ');
  if (!(air / tot > 0.3 && air / tot < 0.7)) ng('空間の割合がおかしい'); else ok('空間の割合');
  for (const k of ['yake_bricks', 'fence_yake', 'glow_block', 'ore_quartz', 'lava', 'magma']) if (!cnt[B[k]]) ng(k + ' がない'); 
  if (chests < 4) ng('とりでの宝箱が ' + chests + ' こ（4こ以上のはず）'); else ok('とりでの宝箱 ' + chests + 'こ');
  // とりでのまんなか：床があって、上が空いている
  const c = chunks.get(fcx + ',' + fcz), at = (x, y, z) => c.blocks[(y << 8) | ((z & 15) << 4) | (x & 15)];
  if (at(f.x + 2, G.FORT_Y, f.z + 2) !== B.yake_bricks || at(f.x + 2, G.FORT_Y + 2, f.z + 2) !== 0) ng('とりでの広場がおかしい'); else ok('とりでの広場（x ' + f.x + ' z ' + f.z + '）');
  // となりのチャンクとの つなぎ目：木のかさが 切れていないか（かさの となりに 何もないのに 幹から遠い、を数える）
  const gb = (x, y, z) => { const r = chunks.get((x >> 4) + ',' + (z >> 4)); return r ? r.blocks[(y << 8) | ((z & 15) << 4) | (x & 15)] : -1; };
  let caps = 0, lone = 0;
  for (const [k, r] of chunks) { const [cx, cz] = k.split(',').map(Number); if (Math.abs(cx - fcx) > 4 || Math.abs(cz - fcz) > 4) continue;
    for (let i = 0; i < r.blocks.length; i++) { if (r.blocks[i] !== B.aobi_cap) continue; caps++; const x = cx * 16 + (i & 15), z = cz * 16 + ((i >> 4) & 15), y = i >> 8; let near = false;
      for (let dy = -1; dy <= 1 && !near; dy++) for (let dz = -2; dz <= 2 && !near; dz++) for (let dx = -2; dx <= 2 && !near; dx++) if (gb(x + dx, y + dy, z + dz) === B.aobi_stem) near = true;
      if (!near) lone++; } }
  if (caps && lone) ng('幹から離れた かさ ' + lone + '/' + caps); else ok('アオビの木 かさ ' + caps + '（つなぎ目も切れていない）');
  let nf = 0; for (let fz = -3; fz <= 3; fz++) for (let fx = -3; fx <= 3; fx++) if (G.fortInfo(seed, fx, fz)) nf++;
  console.log('  とりで：49ます中 ' + nf + 'こ。原点からいちばん近い所まで ' + Math.round(Math.hypot(f.x, f.z)) + 'ブロック');
}
// ---- ソラのはて ----
{
  const g = new (G.dimGenClass(2, 2))(seed); let t0 = Date.now(), n = 0, crystals = 0, stone = 0, gateRim = 0;
  for (let cz = -6; cz <= 5; cz++) for (let cx = -6; cx <= 5; cx++) { const r = g.genChunk(cx, cz); n++; for (let i = 0; i < r.blocks.length; i++) { const id = r.blocks[i]; if (id === B.hoshi_crystal) crystals++; else if (id === B.soraishi) stone++; else if (id === B.bedrock) gateRim++; } }
  console.log('ソラのはて：1チャンク ' + ((Date.now() - t0) / n).toFixed(1) + 'ms  そら石 ' + stone + '  まんなかの高さ ' + g.column(0, 0) + '  着く所の高さ ' + g.column(50, 0) + '  ふち(68,0) ' + g.column(68, 0) + '  外(120,0) ' + g.column(120, 0));
  if (crystals !== 8) ng('結晶が ' + crystals + ' こ'); else ok('結晶 8こ');
  if (g.column(0, 0) !== G.SORA_PED_Y - 1) ng('まんなかの高さ'); else ok('まんなかの台の下は平ら');
  if (!(g.column(50, 0) > 50)) ng('着く所に島がない'); else ok('着く所');
  if (g.column(120, 0) !== 0) ng('島のまわりが空でない'); else ok('島のまわりは空');
  let far = 0; for (let k = 0; k < 2000; k++) { const a = k * 2.399, r = 240 + (k % 400); if (g.column(Math.round(Math.cos(a) * r), Math.round(Math.sin(a) * r)) > 0) far++; }
  console.log('  遠くの小島：しらべた2000地点のうち ' + far + ' が島の上');
  console.log('  柱：' + G.soraPillars().map(p => '(' + p.x + ',' + p.z + ' 高さ' + p.top + ' 太さ' + p.r + ')').join(' '));
}
process.exit(bad ? 1 : 0);
