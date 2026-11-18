// 「出した版の地形は 二度と変えない」を守るための確認。
//   node test/gen_freeze.js          … 記録（gen_hashes.json）と今のコードをくらべる。ちがえば失敗
//   node test/gen_freeze.js write 2  … 版2を記録する（その版を世に出すときに1回だけ）
const fs = require('fs'), path = require('path'), crypto = require('crypto');
const { load } = require('./genlab_lib.js');
const G = load();
const FILE = path.join(__dirname, 'gen_hashes.json');
const SEEDS = [1, 20261118, -5551212, 987654321];
const md5 = (r) => crypto.createHash('md5').update(r.blocks).update(r.meta).update(r.biome).update(JSON.stringify(r.ents)).update(String(r.maxY)).digest('hex').slice(0, 12);
function hashes(gv) {   // gv は 1・2…（もとの世界の版）か、h2（ホムラの底）・s2（ソラのはて）
  const out = [];
  for (const seed of SEEDS) {
    const g = new G.GENS[gv](seed);
    for (let k = 0; k < 60; k++) {
      const cx = ((k * 37) % 61) - 30, cz = ((k * 53) % 67) - 33, r = g.genChunk(cx, cz);
      out.push(md5(r));
    }
    if (g.village) {   // 村のある版：最初の場所の近くの村の まわりも 記録する
      const V = g.village(0, 0);
      if (V) for (let dz = -2; dz <= 2; dz++) for (let dx = -2; dx <= 2; dx++) out.push(md5(g.genChunk((V.x >> 4) + dx, (V.z >> 4) + dz)));
      out.push(JSON.stringify(V ? [V.x, V.z, V.y, V.arms, V.lots.length] : null));
    }
  }
  return out;
}
const rec = fs.existsSync(FILE) ? JSON.parse(fs.readFileSync(FILE, 'utf8')) : {};
if (process.argv[2] === 'write') {
  const gv = process.argv[3];
  if (!G.GENS[gv]) { console.log('その版はありません: ' + gv); process.exit(1); }
  rec[gv] = hashes(gv); fs.writeFileSync(FILE, JSON.stringify(rec));
  console.log('版' + gv + ' を記録しました（' + rec[gv].length + ' チャンク）');
} else {
  let bad = 0;
  for (const gv in rec) {
    if (!G.GENS[gv]) { console.log('版' + gv + ' がなくなっています'); bad++; continue; }
    const now = hashes(gv); let diff = 0;
    for (let i = 0; i < now.length; i++) if (now[i] !== rec[gv][i]) diff++;
    console.log('版' + gv + ': ' + now.length + ' チャンク中 ちがい ' + diff); if (diff) bad++;
  }
  for (const gv in G.GENS) if (!rec[gv]) console.log('版' + gv + ' は まだ記録されていません（出す前に write する）');
  process.exit(bad ? 1 : 0);
}
