// ===== 03d_gen3.js : 地形の版3（版2の地形は そのまま。その上に「村」と「見はり塔」をのせる） =====
// 出した後は 変えない（変えるときは 版4を足す）。村の場所・形は 種と ますの番号だけで決まる

const VIL_CELL = 320;       // 村を置く ますの大きさ（1ますに 多くて1つ）
const VIL_OK = new Uint8Array(32);
[BIOME.PLAINS, BIOME.FLOWER, BIOME.MEADOW, BIOME.DESERT, BIOME.SNOW, BIOME.SAVANNA, BIOME.TAIGA, BIOME.CHERRY, BIOME.FOREST, BIOME.BIRCH].forEach(b => { VIL_OK[b] = 1; });
// 建物の大きさ（w＝道に そったはば、d＝おくゆき、dx＝入口の位置）。入口は z=d-1 のかべにあって、+Z を向く
const VIL_B = { hs: { w: 5, d: 5, dx: 2 }, hm: { w: 7, d: 6, dx: 3 }, smith: { w: 7, d: 5, dx: 3 }, farm: { w: 9, d: 7, dx: 4 } };
const VIL_ORDER = ['hm', 'farm', 'smith', 'hs', 'hs', 'farm', 'hs', 'hm', 'hs', 'smith', 'hs', 'farm'];
const VIL_RING = [[14, 0], [10, 10], [0, 14], [-10, 10], [-14, 0], [-10, -10], [0, -14], [10, -10], [30, 0], [21, 21], [0, 30], [-21, 21], [-30, 0], [-21, -21], [0, -30], [21, -21]];

function lootVilHouse() {
  return [[I.bread, 2, 5, 10], [I.apple, 1, 4, 8], [I.wheat, 2, 6, 8], [I.carrot, 2, 5, 6], [I.potato, 2, 5, 6], [I.wheat_seeds, 2, 5, 5], [I.jade, 1, 2, 5],
    [I.string, 1, 4, 4], [I.coal, 2, 5, 5], [B.torch, 3, 8, 6], [I.arrow, 3, 8, 4], [I.glass_bottle, 1, 2, 3]];
}
function lootVilSmith() {
  return [[I.iron_ingot, 1, 4, 10], [I.coal, 3, 8, 10], [I.jade, 1, 3, 6], [I.iron_pick, 1, 1, 3], [I.iron_sword, 1, 1, 3], [I.iron_helmet, 1, 1, 2], [I.iron_boots, 1, 1, 2],
    [I.gold_ingot, 1, 3, 4], [I.bread, 1, 3, 5], [I.shield, 1, 1, 2], [I.diamond, 1, 1, 1], [B.obsidian, 1, 3, 2]];
}
function lootTower() {
  return [[I.arrow, 4, 12, 10], [I.bow, 1, 1, 4], [I.jade, 1, 4, 8], [I.iron_ingot, 1, 4, 8], [I.bread, 2, 4, 8], [I.gold_ingot, 1, 3, 5], [I.shield, 1, 1, 3],
    [I.diamond, 1, 2, 2], [I.golden_apple, 1, 1, 2], [I.glow_dust, 2, 5, 5], [I.string, 2, 6, 5]];
}
// 村の ふんいき（バイオームごとの素材）
function vilStyle(b) {
  const S = (k, roof, o) => Object.assign({ k, wall: B['planks_' + k], post: B['log_' + k], base: B.cobble, floor: B['planks_' + k], roof: B['stairs_' + roof], cap: B['slab_' + roof],
    door: B['door_' + k], fence: B['fence_' + k], path: B.path, bridge: B['planks_' + k] }, o);
  if (b === BIOME.DESERT) return S('acacia', 'sandstone', { wall: B.sandstone, post: B.chiseled_sandstone, base: B.sandstone, floor: B.smooth_sandstone, path: B.smooth_sandstone });
  if (b === BIOME.SNOW || b === BIOME.TAIGA) return S('spruce', 'cobble');
  if (b === BIOME.SAVANNA) return S('acacia', 'spruce');
  if (b === BIOME.CHERRY) return S('cherry', 'spruce');
  if (b === BIOME.BIRCH) return S('birch', 'spruce');
  return S('oak', 'spruce');
}

class WorldGen3 extends WorldGen2 {
  constructor(seed) { super(seed); this.vils = new Map(); this.towers = new Map(); }

  // 木を生やさない場所：版2の いせき ＋ 村の道と建物 ＋ 見はり塔
  ruinZone(wx, wz) {
    if (super.ruinZone(wx, wz)) return true;
    const V = this.village(Math.floor(wx / VIL_CELL), Math.floor(wz / VIL_CELL));
    if (V && Math.abs(wx - V.x) <= V.rad && Math.abs(wz - V.z) <= V.rad) {
      for (const r of V.rects) if (wx >= r[0] - 3 && wx <= r[2] + 3 && wz >= r[1] - 3 && wz <= r[3] + 3) return true;
    }
    const T = this.tower(wx >> 4, wz >> 4);
    return !!T && wx >= T.x - 3 && wx <= T.x + 7 && wz >= T.z - 3 && wz <= T.z + 7;
  }

  // そのますの村（なければ null）。1回 決めたら おぼえておく
  village(vx, vz) {
    const k = vx + ',' + vz; let V = this.vils.get(k);
    if (V === undefined) { V = this.planVillage(vx, vz); this.vils.set(k, V); }
    return V;
  }
  planVillage(vx, vz) {
    // 最初の場所（まん中）の近くには、なるべく村を1つ置く：まん中に ふれる4ますを 順に ためす
    const near = (vx === 0 || vx === -1) && (vz === 0 || vz === -1);
    let home = vx === 0 && vz === 0;
    if (near && !home) {
      home = !this.village(0, 0) && (vz === 0 || (!this.village(-1, 0) && (vx === 0 || !this.village(0, -1))));
      if (!home && (this.village(0, 0) || vz === 0 || this.village(-1, 0) || (vx === -1 && this.village(0, -1)))) return null;   // 近くに もう1つあるなら、ここには置かない
    }
    const rng = mulberry32(hash2(vx, vz, this.seed ^ 0x51A6E));
    if (!home && rng() < 0.4) return null;
    const n = home ? 20 : 3;
    for (let t = 0; t < n; t++) {
      let x, z;
      if (home) { const span = t < 10 ? 110 : 200, ox = 56 + Math.floor(rng() * span), oz = 56 + Math.floor(rng() * span); x = vx === 0 ? ox : -1 - ox; z = vz === 0 ? oz : -1 - oz; }
      else { x = vx * VIL_CELL + 64 + Math.floor(rng() * 192); z = vz * VIL_CELL + 64 + Math.floor(rng() * 192); }
      const V = this.tryVillage(x, z, mulberry32(hash2(x, z, this.seed ^ 0x7A11)));
      if (V) return V;
    }
    return null;
  }
  // (x, z) を広場にして 村を組んでみる。だめなら null
  tryVillage(x, z, rng) {
    const h0 = this.column(x, z), b0 = this.colB;
    if (h0 < SEA + 1 || h0 > 84 || !VIL_OK[b0]) return null;
    let lo = h0, hi = h0;
    for (const o of VIL_RING) { const h = this.column(x + o[0], z + o[1]); if (h < SEA) return null; if (h < lo) lo = h; if (h > hi) hi = h; }
    if (hi - lo > 8) return null;
    const V = { x, z, y: h0, b: b0, st: vilStyle(b0), arms: [], lots: [], rects: [[x - 4, z - 4, x + 4, z + 4]], rad: 0 };
    const cand = [];
    for (let k = 0; k < 4; k++) {
      const a = F4[k]; let L = 16 + Math.floor(rng() * 3) * 11, prev = h0;   // 道の長さ 16／27／38
      for (let t = 5; t <= L; t++) { const h = this.column(x + a[0] * t, z + a[1] * t); if (h < SEA || Math.abs(h - prev) > 2) { L = t - 1; break; } prev = h; }
      if (L < 8) L = 0;
      V.arms.push(L);
      if (!L) continue;
      const ex = x + a[0] * (L + 1), ez = z + a[1] * (L + 1), sx = x + a[0] * 5, sz = z + a[1] * 5;
      V.rects.push([Math.min(sx, ex) - 1, Math.min(sz, ez) - 1, Math.max(sx, ex) + 1, Math.max(sz, ez) + 1]);
      for (let t = 10; t + 5 <= L; t += 11) { cand.push([k, t, (k + 1) & 3]); cand.push([k, t, (k + 3) & 3]); }
    }
    for (let i = cand.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)), q = cand[i]; cand[i] = cand[j]; cand[j] = q; }
    let oi = 0, houses = 0; const maxLots = 6 + Math.floor(rng() * 4);   // 建物は 6〜9
    for (const c of cand) {
      if (V.lots.length >= maxLots) break;
      let lot = this.fitLot(V, VIL_ORDER[oi % VIL_ORDER.length], c[0], c[1], c[2]);
      if (!lot) lot = this.fitLot(V, 'hs', c[0], c[1], c[2]); else oi++;
      if (!lot) continue;
      if (lot.type === 'hs' || lot.type === 'hm') houses++;
      lot.job = lot.type === 'farm' ? 0 : lot.type === 'smith' ? 1 : lot.type === 'hm' ? 3 : Math.floor(rng() * 4) === 1 ? 2 : [0, 2, 3][Math.floor(rng() * 3)];
      V.lots.push(lot); V.rects.push(lot.r);
    }
    if (V.lots.length < 3 || !houses) return null;
    for (const r of V.rects) V.rad = Math.max(V.rad, x - r[0], r[2] - x, z - r[1], r[3] - z);
    V.rad += 4;
    return V;
  }
  // 建物の入口の場所と向きを決めて、置けるか しらべる。k＝道の向き、t＝広場からの きょり、pi＝道の どちらがわか
  fitLot(V, type, k, t, pi) {
    const a = F4[k], p = F4[pi], f = (pi + 2) & 3, T = VIL_B[type];
    const rx = V.x + a[0] * t, rz = V.z + a[1] * t;
    const y = this.column(rx + p[0], rz + p[1]);   // 入口の前の 道のはしの高さに そろえる
    if (y < SEA + 1) return null;
    const lot = { type, f, x: rx + p[0] * 3, z: rz + p[1] * 3, y, r: null, job: 0 };
    const c0 = lotXZ(lot, -1, -1), c1 = lotXZ(lot, T.w, T.d);
    lot.r = [Math.min(c0[0], c1[0]), Math.min(c0[1], c1[1]), Math.max(c0[0], c1[0]), Math.max(c0[1], c1[1])];
    for (const r of V.rects) if (lot.r[0] <= r[2] && lot.r[2] >= r[0] && lot.r[1] <= r[3] && lot.r[3] >= r[1]) return null;
    for (const q of [[0, 0], [T.w - 1, 0], [0, T.d - 1], [T.w - 1, T.d - 1], [T.w >> 1, T.d >> 1]]) {
      const w = lotXZ(lot, q[0], q[1]), h = this.column(w[0], w[1]);
      if (h < SEA || Math.abs(h - y) > 3) return null;
    }
    return lot;
  }
  // いちばん近い村（道しるべ・地図用）
  nearestVillage(x, z) {
    const vx = Math.floor(x / VIL_CELL), vz = Math.floor(z / VIL_CELL); let best = null, bd = 1e18;
    for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) { const V = this.village(vx + dx, vz + dz); if (!V) continue; const d = (V.x - x) * (V.x - x) + (V.z - z) * (V.z - z); if (d < bd) { bd = d; best = V; } }
    return best;
  }

  // 見はり塔：そのチャンクに あるか（村の近くには 建てない）
  tower(cx, cz) {
    const h = hash2(cx, cz, this.seed ^ 0x70E12);
    if ((h & 1023) >= 5) return null;
    const k = cx + ',' + cz; let T = this.towers.get(k);
    if (T === undefined) { T = this.planTower(cx, cz, h); this.towers.set(k, T); }
    return T;
  }
  planTower(cx, cz, h) {
    const x = cx * 16 + 5 + ((h >>> 10) & 3), z = cz * 16 + 5 + ((h >>> 12) & 3);
    const V = this.village(Math.floor(x / VIL_CELL), Math.floor(z / VIL_CELL));
    if (V && Math.abs(x - V.x) <= V.rad + 12 && Math.abs(z - V.z) <= V.rad + 12) return null;
    let lo = 999, hi = 0;
    for (const q of [[0, 0], [4, 0], [0, 4], [4, 4], [2, 2]]) { const y = this.column(x + q[0], z + q[1]); if (y < lo) lo = y; if (y > hi) hi = y; }
    if (lo < SEA + 1 || hi > 96 || hi - lo > 2) return null;
    return { x, z, y: lo };
  }

  genChunk(cx, cz) {
    const x0 = cx * 16, z0 = cz * 16, vs = [];
    // この区画（と、木が はみ出す分）に かかる村を 先に決めておく（地形を作っている とちゅうで 高さの計算を まぜないため）
    for (let k = 0; k < 4; k++) {
      const V = this.village(Math.floor((x0 + ((k & 1) ? 40 : -24)) / VIL_CELL), Math.floor((z0 + ((k & 2) ? 40 : -24)) / VIL_CELL));
      if (V && vs.indexOf(V) < 0 && x0 + 15 >= V.x - V.rad && x0 <= V.x + V.rad && z0 + 15 >= V.z - V.rad && z0 <= V.z + V.rad) vs.push(V);
    }
    for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) this.tower(cx + dx, cz + dz);   // となりの塔も 先に決めておく
    const T = this.tower(cx, cz);
    const r = super.genChunk(cx, cz);
    if (!vs.length && !T) return r;
    const blocks = new Uint16Array(CVOL); blocks.set(r.blocks);
    const meta = r.meta, ents = r.ents, seed = this.seed, gH = this.gH;
    const C = {
      x0, z0, seed, ents,
      inC: (wx, wz) => wx >= x0 && wx < x0 + 16 && wz >= z0 && wz < z0 + 16,
      idx: (wx, y, wz) => (y << 8) | ((wz - z0) << 4) | (wx - x0),
      get(wx, y, wz) { return C.inC(wx, wz) && y >= 0 && y < 127 ? blocks[C.idx(wx, y, wz)] : -1; },
      put(wx, y, wz, id, m) { if (!C.inC(wx, wz) || y < 1 || y > 125) return; const i = C.idx(wx, y, wz); blocks[i] = id; meta[i] = m || 0; },
      // (wx, y, wz) から下へ、土台になる物に当たるまで うめる
      fill(wx, y, wz, id) { if (!C.inC(wx, wz)) return; for (let yy = y, n = 0; yy > 1 && n < 10; yy--, n++) { const i = C.idx(wx, yy, wz); if (OPAQUE[blocks[i]]) break; blocks[i] = id; meta[i] = 0; } },
      clear(wx, y0, y1, wz) { if (!C.inC(wx, wz)) return; for (let y = y0; y <= y1 && y < 126; y++) { const i = C.idx(wx, y, wz); blocks[i] = 0; meta[i] = 0; } },
      hAt: (wx, wz) => gH[(wz - z0 + 4) * 24 + wx - x0 + 4],
      ent(wx, y, wz, e) { if (C.inC(wx, wz)) { e.i = C.idx(wx, y, wz); ents.push(e); } }
    };
    for (const V of vs) vilBuild(C, V);
    if (T) towerBuild(C, T);
    let maxY = 126;
    for (; maxY > 0; maxY--) { let any = false; const base = maxY << 8; for (let i = 0; i < 256; i++) if (blocks[base + i]) { any = true; break; } if (any) break; }
    if (maxY < 126) maxY++;
    return { blocks, meta, biome: r.biome, maxY, ents };
  }
}

// 建物の中の ます (cx, cz) → 世界の (x, z)。lot.x/z＝入口、lot.f＝入口の向き
function lotXZ(lot, cx, cz) {
  const T = VIL_B[lot.type], ux = cx - T.dx, uz = cz - (T.d - 1), f = lot.f;
  return f === 0 ? [lot.x + ux, lot.z + uz] : f === 1 ? [lot.x - uz, lot.z + ux] : f === 2 ? [lot.x - ux, lot.z - uz] : [lot.x + uz, lot.z - ux];
}
// 村人ごとの番号（しるしの場所から決まる。下2ビットが しごと）
function vilSeed(seed, wx, y, wz, job) { return (((hash2(wx * 131 + y, wz, seed ^ 0x5A70B) >>> 4) << 2) | (job & 3)) >>> 0; }

function vilBuild(C, V) {
  const st = V.st, Y = V.y;
  const edge = (wx, wz) => (hash2(wx, wz, C.seed ^ 0x9A7) & 7) === 0;
  // 道（地面の高さに そわせる。水の上は 板の橋）
  for (let k = 0; k < 4; k++) {
    const L = V.arms[k]; if (!L) continue;
    const a = F4[k], p = F4[(k + 1) & 3];
    for (let t = 5; t <= L; t++) for (let w = -1; w <= 1; w++) {
      const wx = V.x + a[0] * t + p[0] * w, wz = V.z + a[1] * t + p[1] * w;
      if (!C.inC(wx, wz) || (w && edge(wx, wz))) continue;
      const h = C.hAt(wx, wz);
      if (h < SEA) { C.put(wx, SEA, wz, st.bridge); C.clear(wx, SEA + 1, SEA + 4, wz); }
      else { C.put(wx, h, wz, st.path); C.clear(wx, h + 1, h + 4, wz); }
    }
    // 道のはしの あかり
    const ex = V.x + a[0] * (L + 1), ez = V.z + a[1] * (L + 1);
    if (C.inC(ex, ez)) { const h = C.hAt(ex, ez); if (h >= SEA) { C.put(ex, h + 1, ez, st.fence); C.put(ex, h + 2, ez, st.fence); C.put(ex, h + 3, ez, B.lantern, 0); C.clear(ex, h + 4, h + 5, ez); } }
  }
  // 広場と井戸
  for (let dz = -4; dz <= 4; dz++) for (let dx = -4; dx <= 4; dx++) {
    if (Math.abs(dx) === 4 && Math.abs(dz) === 4) continue;
    const wx = V.x + dx, wz = V.z + dz;
    if (!C.inC(wx, wz)) continue;
    C.clear(wx, Y + 1, Y + 7, wz); C.fill(wx, Y - 1, wz, B.dirt); C.put(wx, Y, wz, st.path);
    const ad = Math.max(Math.abs(dx), Math.abs(dz));
    if (ad === 1) { C.put(wx, Y - 2, wz, st.base); C.put(wx, Y - 1, wz, st.base); C.put(wx, Y, wz, st.base); C.put(wx, Y + 1, wz, st.base); if (dx && dz) { C.put(wx, Y + 2, wz, st.fence); C.put(wx, Y + 3, wz, st.fence); } }
    if (ad === 0) { C.put(wx, Y - 3, wz, st.base); C.put(wx, Y - 2, wz, B.water); C.put(wx, Y - 1, wz, B.water); C.put(wx, Y, wz, B.water); C.put(wx, Y + 3, wz, B.lantern, 1); }
    if (ad <= 1) C.put(wx, Y + 4, wz, st.cap, 0);
    if (Math.abs(dx) === 3 && Math.abs(dz) === 3) { C.put(wx, Y + 1, wz, st.fence); C.put(wx, Y + 2, wz, st.fence); C.put(wx, Y + 3, wz, B.lantern, 0); }
  }
  for (const lot of V.lots) lotBuild(C, V, lot);
}

function lotBuild(C, V, lot) {
  const st = V.st, T = VIL_B[lot.type], w = T.w, d = T.d, dx = T.dx, Y = lot.y, f = lot.f;
  const P = (cx, cy, cz, id, m) => { const q = lotXZ(lot, cx, cz); C.put(q[0], Y + cy, q[1], id, m); };
  const F = (cx, cy, cz, id) => { const q = lotXZ(lot, cx, cz); C.fill(q[0], Y + cy, q[1], id); };
  const D = (n) => (n + f) & 3;   // 向きを 建物の向きに合わせて回す
  const mark = (cx, cz, job, hx, hz, out) => {
    const q = lotXZ(lot, cx, cz), hq = lotXZ(lot, hx, hz);
    if (!C.inC(q[0], q[1])) return;
    C.put(q[0], Y + 1, q[1], B.vmark, 0);
    C.ent(q[0], Y + 1, q[1], { t: 'vmark', s: vilSeed(C.seed, q[0], Y + 1, q[1], job), h: [hq[0], Y + 1, hq[1]], f, o: out | 0 });   // o＝1 外ぐらし（畑）／2 家の中の 入口から4マスおく
  };
  const chest = (cx, cz, table) => {
    const q = lotXZ(lot, cx, cz);
    if (!C.inC(q[0], q[1])) return;
    C.put(q[0], Y + 1, q[1], B.chest, D(0));
    C.ent(q[0], Y + 1, q[1], { t: 'chest', g: 1, items: rollLoot(mulberry32(hash2(q[0], q[1], C.seed ^ 0xC4E57)), table, 4, 7) });
  };
  // 入口の前（道につなぐ）
  F(dx, -1, d, B.dirt); P(dx, 0, d, st.path); for (let y = 1; y <= 4; y++) P(dx, y, d, 0);
  if (lot.type === 'farm') {
    const rr = mulberry32(hash2(lot.x, lot.z, C.seed ^ 0xFA23)), crops = [B.wheat_crop, B.carrot_crop, B.potato_crop], ca = crops[Math.floor(rr() * 3)], cb = crops[Math.floor(rr() * 3)];
    for (let z = 0; z < d; z++) for (let x = 0; x < w; x++) {
      for (let y = 1; y <= 5; y++) P(x, y, z, 0);
      F(x, -1, z, B.dirt);
      const q = lotXZ(lot, x, z);
      if (x === 0 || x === w - 1 || z === 0 || z === d - 1) P(x, 0, z, st.post);
      else if (x === dx) P(x, 0, z, B.water);
      else { P(x, 0, z, B.farmland, 1); P(x, 1, z, x < dx ? ca : cb, 1 + (hash2(q[0], q[1], C.seed ^ 0xC20) % 3)); }
    }
    P(0, 1, 0, B.hay); P(w - 1, 1, 0, B.hay); P(w - 1, 2, 0, B.hay);
    P(0, 1, d - 1, st.fence); P(0, 2, d - 1, B.pumpkin);   // かかし
    mark(dx, d, 0, dx, d, 1);
    return;
  }
  const wallH = 3, half = (w - 1) >> 1, smith = lot.type === 'smith', wallId = smith ? st.base : st.wall;
  // まわりを あける → 土台と床 → かべ
  for (let z = -1; z <= d; z++) for (let x = -1; x <= w; x++) { if (z === d && x === dx) continue; for (let y = 1; y <= wallH + half + 2; y++) P(x, y, z, 0); }
  for (let z = 0; z < d; z++) for (let x = 0; x < w; x++) {
    const rim = x === 0 || x === w - 1 || z === 0 || z === d - 1, corner = (x === 0 || x === w - 1) && (z === 0 || z === d - 1);
    F(x, -1, z, st.base); P(x, 0, z, rim ? st.base : st.floor);
    if (!rim) continue;
    for (let y = 1; y <= wallH; y++) P(x, y, z, corner ? st.post : y === 1 && smith ? st.base : wallId);
    if (z === 0 || z === d - 1) for (let y = wallH + 1; y < wallH + Math.min(x + 1, w - x); y++) P(x, y, z, wallId);   // 三角のかべ
  }
  // やね（左右から 階段でのぼって、まん中は ハーフブロック）
  for (let z = -1; z <= d; z++) for (let x = -1; x <= w; x++) {
    const y = wallH + Math.min(x + 1, w - x);
    if (x === half) P(x, y, z, st.cap, 0); else P(x, y, z, st.roof, D(x < half ? 3 : 1));
  }
  // 入口（ドアは あけてある）と まど、あかり
  P(dx, 1, d - 1, st.door, D(0) | 4); P(dx, 2, d - 1, st.door, D(0) | 4 | 8);
  const win = smith ? B.iron_bars : B.glass_pane;
  for (let z = 2; z < d - 2; z++) { P(0, 2, z, win); P(w - 1, 2, z, win); }
  P(half, 2, 0, win);
  if (w >= 7) { P(1, 2, d - 1, win); P(w - 2, 2, d - 1, win); }
  P(half, wallH + half, d >> 1, B.lantern, 1);
  // 中の家具と 村人
  if (lot.type === 'hs') {
    P(1, 1, 2, B.bed, D(2)); P(1, 1, 1, B.bed, D(2) | 4);
    P(3, 1, 1, B.crafting_table);
    mark(dx, d - 3, lot.job, dx, d - 3, 0);
  } else if (lot.type === 'hm') {
    P(1, 1, 2, B.bed, D(2)); P(1, 1, 1, B.bed, D(2) | 4); P(2, 1, 2, B.bed, D(2)); P(2, 1, 1, B.bed, D(2) | 4);
    P(5, 1, 2, B.crafting_table); chest(5, 1, lootVilHouse()); P(4, 1, 1, B.furnace, D(0));
    mark(dx, d - 3, 3, dx, d - 3, 0); mark(dx + 1, d - 3, 2, dx, d - 4, 2);
  } else {
    P(1, 1, 1, B.furnace, D(0)); P(2, 1, 1, B.furnace, D(0)); P(3, 1, 1, B.smooth_stone); chest(5, 1, lootVilSmith());
    mark(dx, d - 3, 1, dx, d - 3, 0);
  }
}

// 見はり塔：石レンガの 5×5。中の はしごで 上へ。てっぺんに 宝箱
function towerBuild(C, T) {
  const Y = T.y, top = Y + 10, rr = mulberry32(hash2(T.x, T.z, C.seed ^ 0x70E13));
  const brick = () => { const v = rr(); return v < 0.16 ? B.mossy_bricks : v < 0.28 ? B.cracked_bricks : B.stone_bricks; };
  for (let z = 0; z < 5; z++) for (let x = 0; x < 5; x++) {
    const wx = T.x + x, wz = T.z + z, rim = x === 0 || x === 4 || z === 0 || z === 4;
    C.clear(wx, Y + 1, top + 4, wz); C.fill(wx, Y - 1, wz, B.cobble); C.put(wx, Y, wz, brick());
    if (rim) for (let y = Y + 1; y < top; y++) C.put(wx, y, wz, brick());
    C.put(wx, top, wz, B.stone_bricks);
    if (rim && ((x + z) & 1) === 0) C.put(wx, top + 1, wz, B.stone_bricks);   // てっぺんの でこぼこ
  }
  for (let y = Y + 1; y <= top; y++) C.put(T.x + 2, y, T.z + 1, B.ladder, 2);   // 北のかべに はしご
  C.put(T.x + 2, Y + 1, T.z + 4, 0); C.put(T.x + 2, Y + 2, T.z + 4, 0);   // 入口（南）
  C.put(T.x + 2, Y + 1, T.z + 5, 0); C.put(T.x + 2, Y + 2, T.z + 5, 0);
  C.put(T.x, Y + 5, T.z + 2, B.iron_bars); C.put(T.x + 4, Y + 5, T.z + 2, B.iron_bars);
  C.put(T.x + 2, top - 1, T.z + 3, B.lantern, 1);
  C.put(T.x + 3, top + 1, T.z + 3, B.chest, 0);
  C.ent(T.x + 3, top + 1, T.z + 3, { t: 'chest', g: 1, items: rollLoot(rr, lootTower(), 5, 8) });
}

GENS[3] = WorldGen3;
