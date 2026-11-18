// ===== 05_world.js : 世界のデータ・明るさ・水の流れ・成長・セーブ用の圧縮 =====
const DX6 = [1, -1, 0, 0, 0, 0], DY6 = [0, 0, 1, -1, 0, 0], DZ6 = [0, 0, 0, 0, 1, -1];
const RTICK = new Uint8Array(256);
for (const k of ['grass', 'wheat_crop', 'farmland', 'cactus']) RTICK[B[k]] = 1;
for (const w of _woods) { RTICK[w[3]] = 1; RTICK[w[5]] = 1; }

function posKey(x, y, z) { return ((x + 1048576) * 2097152 + (z + 1048576)) * 128 + y; }
function rle(arr) {
  const out = []; let i = 0; const n = arr.length;
  while (i < n) { const v = arr[i]; let j = i + 1; while (j < n && arr[j] === v && j - i < 65535) j++; const len = j - i; out.push(v, len & 255, len >> 8); i = j; }
  return new Uint8Array(out);
}
function unrle(src, n) {
  const out = new Uint8Array(n); let o = 0;
  for (let i = 0; i + 2 < src.length; i += 3) { const v = src[i], len = src[i + 1] | (src[i + 2] << 8); if (v) out.fill(v, o, Math.min(n, o + len)); o += len; }
  return out;
}

// ---- 当たり判定・選択用の箱 ----
const BOX_FULL = [[0, 0, 0, 1, 1, 1]], BOX_NONE = [];
function doorBox(meta) {
  const side = (meta & 4) ? ((meta & 3) + 1) & 3 : meta & 3, t = 3 / 16;
  return side === 0 ? [0, 0, 1 - t, 1, 1, 1] : side === 1 ? [0, 0, 0, t, 1, 1] : side === 2 ? [0, 0, 0, 1, 1, t] : [1 - t, 0, 0, 1, 1, 1];
}
function collisionBoxes(id, meta) {
  switch (SHAPE[id]) {
    case S_CUBE: return BOX_FULL;
    case S_FARM: return [[0, 0, 0, 1, 0.9375, 1]];
    case S_CACTUS: return [[0.0625, 0, 0.0625, 0.9375, 1, 0.9375]];
    case S_CHEST: return [[0.0625, 0, 0.0625, 0.9375, 0.875, 0.9375]];
    case S_BED: return [[0, 0, 0, 1, 0.5625, 1]];
    case S_DOOR: return [doorBox(meta)];
    case S_FLAT: return [[0, 0, 0, 1, 0.02, 1]];
    default: return BOX_NONE;
  }
}
function selectionBoxes(id, meta) {
  switch (SHAPE[id]) {
    case S_NONE: case S_FLUID: return BOX_NONE;
    case S_CROSS: return [[0.15, 0, 0.15, 0.85, 0.8, 0.85]];
    case S_CROP: return [[0, 0, 0, 1, 0.3 + 0.2 * (meta & 3), 1]];
    case S_LAYER: return [[0, 0, 0, 1, 0.125, 1]];
    case S_FLAT: return [[0.06, 0, 0.06, 0.94, 0.08, 0.94]];
    case S_TORCH: {
      if (!meta) return [[0.4, 0, 0.4, 0.6, 0.65, 0.6]];
      const d = F4[(meta - 1) & 3], cx = 0.5 + d[0] * 0.35, cz = 0.5 + d[1] * 0.35;
      return [[cx - 0.15, 0.2, cz - 0.15, cx + 0.15, 0.8, cz + 0.15]];
    }
    case S_LADDER: {
      const f = meta & 3, t = 0.125;
      return [f === 0 ? [0, 0, 1 - t, 1, 1, 1] : f === 1 ? [0, 0, 0, t, 1, 1] : f === 2 ? [0, 0, 0, 1, 1, t] : [1 - t, 0, 0, 1, 1, 1]];
    }
    default: return collisionBoxes(id, meta);
  }
}
function blockDrops(id, meta, toolDef, rng) {
  const b = BLOCKS[id];
  if (!b) return [];
  if (b.needTool && (!toolDef || toolDef.type !== b.tool || toolDef.tier < b.level)) return [];
  if (b.drop === undefined) return ITEMS[id] ? [[id, 1]] : [];
  if (typeof b.drop === 'number') return [[b.drop, 1]];
  const r = b.drop(rng, meta, toolDef);
  return r === null ? (ITEMS[id] ? [[id, 1]] : []) : r;
}

class Chunk {
  constructor(cx, cz) {
    this.cx = cx; this.cz = cz;
    this.blocks = null; this.meta = null; this.light = null; this.biome = null;
    this.stage = 0; this.maxY = 0;
    this.ents = new Map();
    this.meshes = new Array(NSEC).fill(null);
    this.dirty = 0xFF; this.meshed = false;
    this.modified = false; this.saveDirty = false;
    this.requested = false;
  }
}

let _worldToken = 0;
class World {
  constructor(seed, saved) {
    this.seed = seed | 0;
    this.gen = new WorldGen(this.seed);
    this.chunks = new Map(); this._lc = null;
    this.saved = saved || new Map();   // 変更のあったチャンク（圧縮ずみ）
    this.savedDirty = new Set();
    this.tick = 0; this.time = 1000; this.day = 1;
    this.schedule = new Map(); this.scheduled = new Set();
    this.token = ++_worldToken;
    this.urgent = false;
    this.qcap = 1 << 15; this.qx = new Int32Array(this.qcap); this.qy = new Int16Array(this.qcap); this.qz = new Int32Array(this.qcap); this.qn = 0;
    this.rcap = 1 << 13; this.rx = new Int32Array(this.rcap); this.ry = new Int16Array(this.rcap); this.rz = new Int32Array(this.rcap); this.rv = new Uint8Array(this.rcap); this.rn = 0;
    this._top = new Int16Array(256);
    this.center = null; this.inflight = 0; this.natural = false;
    this.rng = mulberry32((Math.random() * 4294967296) | 0);
    this.onUnload = null;
    // みんなで遊ぶとき：net につながる。remote は「ほかの人の変更をあてはめている最中」
    this.net = null; this.dim = 0; this.remote = false;
    // 地形の版。gv0＝世界を作ったときの版。rgv＝区画（4×4チャンク）ごとに最初に作った版（null なら全部 gv0）
    this.gv0 = 1; this.rgv = null; this.gens = {}; this.gens[1] = this.gen;
    this.stash = new Map();   // しまってある動物（チャンクごと）
  }
  setGen(gv0, rgv) { this.gv0 = gv0 || 1; this.gen = this.genOf(this.gv0); this.rgv = rgv || null; }
  genOf(gv) { let g = this.gens[gv]; if (!g) { g = this.gens[gv] = new (GENS[gv] || GENS[1])(this.seed); } return g; }
  // そのチャンクを作る地形の版。0 ならまだ決まっていない（オンラインで問い合わせ中）
  genVer(cx, cz) {
    if (this.net) return this.net.genVer(this.dim, cx >> 2, cz >> 2);
    if (!this.rgv) return this.gv0;
    const k = (cx >> 2) + ',' + (cz >> 2); let v = this.rgv.get(k);
    if (!v) { v = GEN_CUR; this.rgv.set(k, v); }
    return v;
  }
  key(cx, cz) { return (cx + 32768) * 65536 + (cz + 32768); }
  getChunk(cx, cz) {
    const lc = this._lc;
    if (lc && lc.cx === cx && lc.cz === cz) return lc;
    const c = this.chunks.get((cx + 32768) * 65536 + (cz + 32768));
    if (c) this._lc = c;
    return c;
  }
  getBlock(x, y, z) {
    if (y < 0 || y >= CH) return 0;
    const c = this.getChunk(x >> 4, z >> 4);
    if (!c || c.stage < 1) return 0;
    return c.blocks[(y << 8) | ((z & 15) << 4) | (x & 15)];
  }
  getMeta(x, y, z) {
    if (y < 0 || y >= CH) return 0;
    const c = this.getChunk(x >> 4, z >> 4);
    if (!c || c.stage < 1) return 0;
    return c.meta[(y << 8) | ((z & 15) << 4) | (x & 15)];
  }
  isLoaded(x, z) { const c = this.getChunk(x >> 4, z >> 4); return !!c && c.stage >= 2; }
  // まわり r マスまでのブロックが全部読める状態か（読みこみ範囲のはしで、となりが無いのに「無い」と決めつけないため）
  areaLoaded(x, z, r) {
    for (let cz = (z - r) >> 4; cz <= (z + r) >> 4; cz++) for (let cx = (x - r) >> 4; cx <= (x + r) >> 4; cx++) { const c = this.getChunk(cx, cz); if (!c || c.stage < 1) return false; }
    return true;
  }
  getLightRaw(x, y, z) {
    if (y >= CH) return 0xF0; if (y < 0) return 0;
    const c = this.getChunk(x >> 4, z >> 4);
    if (!c || c.stage < 2) return 0xF0;
    return c.light[(y << 8) | ((z & 15) << 4) | (x & 15)];
  }
  // 昼夜をふまえた明るさ（0〜15）
  lightLevel(x, y, z) { const l = this.getLightRaw(x, y, z); return Math.max(l & 15, (l >> 4) - this.skyDarken()); }
  dayFactor() { return smoothstep(-0.2, 0.2, Math.sin(this.time / 24000 * Math.PI * 2)); }
  skyDarken() { return Math.round((1 - this.dayFactor()) * 11); }
  isNight() { return this.dayFactor() < 0.35; }
  biomeAt(x, z) { const c = this.getChunk(x >> 4, z >> 4); if (c && c.biome) return c.biome[((z & 15) << 4) | (x & 15)]; const g = this.genOf(this.genVer(x >> 4, z >> 4) || this.gv0); g.column(x, z); return g.colB; }
  getEnt(x, y, z) { const c = this.getChunk(x >> 4, z >> 4); return c ? c.ents.get((y << 8) | ((z & 15) << 4) | (x & 15)) : undefined; }
  setEnt(x, y, z, e) { const c = this.getChunk(x >> 4, z >> 4); if (c) { c.ents.set((y << 8) | ((z & 15) << 4) | (x & 15), e); c.modified = c.saveDirty = true; if (this.net && !this.remote) this.net.entDirty(x, y, z); } }
  // 入れ物の中身が変わったことを知らせる
  touch(x, y, z) { const c = this.getChunk(x >> 4, z >> 4); if (c) { c.modified = c.saveDirty = true; if (this.net && !this.remote) this.net.entDirty(x, y, z); } }

  // ---------- 明るさ ----------
  qpush(x, y, z) {
    if (this.qn === this.qcap) {
      this.qcap *= 2;
      const a = new Int32Array(this.qcap), b = new Int16Array(this.qcap), c = new Int32Array(this.qcap);
      a.set(this.qx); b.set(this.qy); c.set(this.qz); this.qx = a; this.qy = b; this.qz = c;
    }
    this.qx[this.qn] = x; this.qy[this.qn] = y; this.qz[this.qn] = z; this.qn++;
  }
  rpush(x, y, z, v) {
    if (this.rn === this.rcap) {
      this.rcap *= 2;
      const a = new Int32Array(this.rcap), b = new Int16Array(this.rcap), c = new Int32Array(this.rcap), d = new Uint8Array(this.rcap);
      a.set(this.rx); b.set(this.ry); c.set(this.rz); d.set(this.rv); this.rx = a; this.ry = b; this.rz = c; this.rv = d;
    }
    this.rx[this.rn] = x; this.ry[this.rn] = y; this.rz[this.rn] = z; this.rv[this.rn] = v; this.rn++;
  }
  lightDirty(c, lx, y, lz) {
    const s = y >> 4, ly = y & 15;
    let mask = 1 << s;
    if (ly === 0 && s > 0) mask |= 1 << (s - 1);
    if (ly === 15 && s < NSEC - 1) mask |= 1 << (s + 1);
    c.dirty |= mask;
    if (lx === 0 || lx === 15 || lz === 0 || lz === 15) {
      const dx = lx === 0 ? -1 : lx === 15 ? 1 : 0, dz = lz === 0 ? -1 : lz === 15 ? 1 : 0;
      const ch = this.chunks;
      if (dx) { const n = ch.get((c.cx + dx + 32768) * 65536 + (c.cz + 32768)); if (n) n.dirty |= mask; }
      if (dz) { const n = ch.get((c.cx + 32768) * 65536 + (c.cz + dz + 32768)); if (n) n.dirty |= mask; }
      if (dx && dz) { const n = ch.get((c.cx + dx + 32768) * 65536 + (c.cz + dz + 32768)); if (n) n.dirty |= mask; }
    }
  }
  // ch: 0=ブロックの光 1=空の光
  lightFlood(ch) {
    let head = 0;
    while (head < this.qn) {
      const x = this.qx[head], y = this.qy[head], z = this.qz[head]; head++;
      const c = this.getChunk(x >> 4, z >> 4);
      if (!c || c.stage < 2) continue;
      const L = ch ? c.light[(y << 8) | ((z & 15) << 4) | (x & 15)] >> 4 : c.light[(y << 8) | ((z & 15) << 4) | (x & 15)] & 15;
      if (L <= 1) continue;
      for (let d = 0; d < 6; d++) {
        const nx = x + DX6[d], ny = y + DY6[d], nz = z + DZ6[d];
        if (ny < 0 || ny >= CH) continue;
        let nc = c;
        if ((nx >> 4) !== c.cx || (nz >> 4) !== c.cz) { nc = this.getChunk(nx >> 4, nz >> 4); if (!nc || nc.stage < 2) continue; }
        const ni = (ny << 8) | ((nz & 15) << 4) | (nx & 15);
        const op = LOPAC[nc.blocks[ni]];
        if (op >= 15) continue;
        let nl = L - (op > 1 ? op : 1);
        if (ch && d === 3 && L === 15 && op === 0) nl = 15;
        if (nl <= 0) continue;
        const lv = nc.light[ni], cur = ch ? lv >> 4 : lv & 15;
        if (nl > cur) {
          nc.light[ni] = ch ? (lv & 15) | (nl << 4) : (lv & 240) | nl;
          this.lightDirty(nc, nx & 15, ny, nz & 15);
          this.qpush(nx, ny, nz);
        }
      }
    }
    this.qn = 0;
  }
  lightUnflood(ch) {
    let head = 0;
    while (head < this.rn) {
      const x = this.rx[head], y = this.ry[head], z = this.rz[head], L = this.rv[head]; head++;
      for (let d = 0; d < 6; d++) {
        const nx = x + DX6[d], ny = y + DY6[d], nz = z + DZ6[d];
        if (ny < 0 || ny >= CH) continue;
        const nc = this.getChunk(nx >> 4, nz >> 4);
        if (!nc || nc.stage < 2) continue;
        const ni = (ny << 8) | ((nz & 15) << 4) | (nx & 15);
        const lv = nc.light[ni], cur = ch ? lv >> 4 : lv & 15;
        if (cur === 0) continue;
        if (cur < L || (ch && d === 3 && L === 15)) {
          let nv = 0;
          if (!ch) { nv = LEMIT[nc.blocks[ni]]; }
          nc.light[ni] = ch ? (lv & 15) : (lv & 240) | nv;
          this.lightDirty(nc, nx & 15, ny, nz & 15);
          this.rpush(nx, ny, nz, cur);
          if (nv) this.qpush(nx, ny, nz);
        } else this.qpush(nx, ny, nz);
      }
    }
    this.rn = 0;
  }
  relight(c, x, y, z, i, oldId, newId) {
    const oOp = LOPAC[oldId], nOp = LOPAC[newId], oEm = LEMIT[oldId], nEm = LEMIT[newId];
    // ブロックの光
    let cur = c.light[i] & 15;
    if (cur > 0 && (nOp > oOp || nEm < oEm)) {
      c.light[i] &= 240; this.rpush(x, y, z, cur); this.lightUnflood(0); cur = 0;
    }
    if (nEm > cur) { c.light[i] = (c.light[i] & 240) | nEm; }
    this.qpush(x, y, z);
    for (let d = 0; d < 6; d++) this.qpush(x + DX6[d], y + DY6[d], z + DZ6[d]);
    this.lightFlood(0);
    // 空の光
    const sk = c.light[i] >> 4;
    if (sk > 0 && nOp > oOp) { c.light[i] &= 15; this.rpush(x, y, z, sk); this.lightUnflood(1); }
    for (let d = 0; d < 6; d++) { const ny = y + DY6[d]; if (ny >= 0 && ny < CH) this.qpush(x + DX6[d], ny, z + DZ6[d]); }
    this.lightFlood(1);
  }
  borderSeeds(c, ch) {
    const x0 = c.cx * 16, z0 = c.cz * 16;
    for (let side = 0; side < 4; side++) {
      const n = this.getChunk(c.cx + F4[side][0], c.cz + F4[side][1]);
      if (!n || n.stage < 2) continue;
      for (let t = 0; t < 16; t++) {
        let lx, lz, mx, mz;
        if (side === 0) { lx = t; lz = 15; mx = t; mz = 0; } else if (side === 1) { lx = 0; lz = t; mx = 15; mz = t; }
        else if (side === 2) { lx = t; lz = 0; mx = t; mz = 15; } else { lx = 15; lz = t; mx = 0; mz = t; }
        const ci = (lz << 4) | lx, ni = (mz << 4) | mx;
        for (let y = 0; y < CH; y++) {
          const a = ch ? c.light[(y << 8) | ci] >> 4 : c.light[(y << 8) | ci] & 15;
          const b = ch ? n.light[(y << 8) | ni] >> 4 : n.light[(y << 8) | ni] & 15;
          if (b > a + 1) this.qpush(n.cx * 16 + mx, y, n.cz * 16 + mz);
          else if (a > b + 1) this.qpush(x0 + lx, y, z0 + lz);
        }
      }
    }
  }
  lightChunk(c) {
    const blocks = c.blocks, light = c.light, top = this._top, maxY = Math.min(CH - 1, c.maxY);
    for (let col = 0; col < 256; col++) {
      let y = CH - 1;
      for (; y > maxY; y--) light[(y << 8) | col] = 0xF0;
      for (; y >= 0; y--) { const i = (y << 8) | col; if (LOPAC[blocks[i]] !== 0) break; light[i] = 0xF0; }
      top[col] = y;
    }
    c.stage = 2;
    const x0 = c.cx * 16, z0 = c.cz * 16;
    for (let z = 0; z < 16; z++) for (let x = 0; x < 16; x++) {
      const col = (z << 4) | x, t = top[col];
      let m = t;
      if (x > 0 && top[col - 1] > m) m = top[col - 1];
      if (x < 15 && top[col + 1] > m) m = top[col + 1];
      if (z > 0 && top[col - 16] > m) m = top[col - 16];
      if (z < 15 && top[col + 16] > m) m = top[col + 16];
      for (let y = t + 1; y <= m && y < CH; y++) this.qpush(x0 + x, y, z0 + z);
      if (t >= 0 && t + 1 < CH && t + 1 > m && LOPAC[blocks[(t << 8) | col]] < 15) this.qpush(x0 + x, t + 1, z0 + z);
    }
    this.borderSeeds(c, 1);
    this.lightFlood(1);
    const end = (maxY + 1) << 8;
    for (let i = 0; i < end; i++) {
      const em = LEMIT[blocks[i]];
      if (em) { light[i] = (light[i] & 240) | em; this.qpush(x0 + (i & 15), i >> 8, z0 + ((i >> 4) & 15)); }
    }
    this.borderSeeds(c, 0);
    this.lightFlood(0);
  }

  // ---------- ブロックの書きかえ ----------
  // flags: 1=まわりに知らせない 2=中身（チェストなど）を残す
  setBlock(x, y, z, id, meta, flags) {
    if (y < 0 || y >= CH) return false;
    const c = this.getChunk(x >> 4, z >> 4);
    if (!c || c.stage < 2) return false;
    const lx = x & 15, lz = z & 15, i = (y << 8) | (lz << 4) | lx;
    const old = c.blocks[i];
    meta = meta | 0;
    if (old === id && c.meta[i] === meta) return false;
    c.blocks[i] = id; c.meta[i] = meta;
    // 自然に起きた変化（草が広がる等）だけのチャンクは保存しない。プレイヤーが手を入れたチャンクは丸ごと保存する
    if (this.natural) { if (c.modified) c.saveDirty = true; } else c.modified = c.saveDirty = true;
    if (id && y > c.maxY) c.maxY = y;
    if (old !== id) {
      if (!(flags & 2) && c.ents.size && c.ents.has(i)) { c.ents.delete(i); if (this.net && !this.remote) this.net.entDirty(x, y, z); }
      if (LOPAC[old] !== LOPAC[id] || LEMIT[old] !== LEMIT[id]) this.relight(c, x, y, z, i, old, id);
      if (ISLOG[old] && !ISLOG[id] && !this.remote) this.queueLeafChecks(x, y, z);
    }
    this.lightDirty(c, lx, y, lz);
    this.urgent = true;
    // みんなの世界：保存される変化（＝ c.saveDirty が立つ変化）だけを送る
    if (this.net && !this.remote && c.saveDirty) this.net.cell(x, y, z, id, meta);
    if (!(flags & 1)) this.notifyAround(x, y, z);
    return true;
  }
  // ほかの人の変更をあてはめる（まわりへの通知はしない。水が流れる等の結果は、変えた人の端末が計算して送ってくる）
  remoteCell(x, y, z, v) {
    const c = this.getChunk(x >> 4, z >> 4);
    if (!c || c.stage < 1 || y < 0 || y >= CH) return false;
    const id = v & 255, meta = (v >> 8) & 255, i = (y << 8) | ((z & 15) << 4) | (x & 15), old = c.blocks[i];
    if (old === id && c.meta[i] === meta) return false;
    const keep = !!BLOCKS[old] && !!BLOCKS[id] && !!BLOCKS[old].ent && BLOCKS[old].ent === BLOCKS[id].ent;
    if (c.stage === 1) { c.blocks[i] = id; c.meta[i] = meta; if (old !== id && !keep) c.ents.delete(i); if (id && y > c.maxY) c.maxY = y; c.modified = true; return true; }
    this.remote = true; const nat = this.natural; this.natural = false;
    const ok = this.setBlock(x, y, z, id, meta, keep ? 3 : 1);
    this.natural = nat; this.remote = false;
    return ok ? old + 1 : false;
  }
  remoteEnt(x, y, z, e) {
    const c = this.getChunk(x >> 4, z >> 4);
    if (!c || c.stage < 1) return;
    const i = (y << 8) | ((z & 15) << 4) | (x & 15), cur = c.ents.get(i);
    if (!e) { if (cur) c.ents.delete(i); return; }
    if (cur && cur.t === e.t) {   // 開いている画面が同じ物を見続けられるよう、中身だけ入れかえる
      if (e.t === 'chest') { for (let k = 0; k < 27; k++) cur.items[k] = e.items[k] || null; if (e.g) cur.g = 1; else delete cur.g; }
      else { cur.in = e.in; cur.fuel = e.fuel; cur.out = e.out; cur.burn = e.burn; cur.burnMax = e.burnMax; cur.cook = e.cook; }
    } else c.ents.set(i, e);
    c.modified = true;
  }
  notifyAround(x, y, z) {
    this.blockUpdate(x, y, z);
    for (let d = 0; d < 6; d++) this.blockUpdate(x + DX6[d], y + DY6[d], z + DZ6[d]);
  }
  hasSupport(id, meta, x, y, z) {
    const b = BLOCKS[id], below = this.getBlock(x, y - 1, z);
    if (SHAPE[id] === S_TORCH) {
      if (!meta) return OPAQUE[below] === 1 || below === B.glass || SHAPE[below] === S_FARM;
      const d = F4[(meta - 1) & 3]; return OPAQUE[this.getBlock(x + d[0], y, z + d[1])] === 1;
    }
    if (SHAPE[id] === S_LADDER) {
      const d = F4[meta & 3], bk = this.getBlock(x + d[0], y, z + d[1]);
      if (id === B.vine) return OPAQUE[bk] === 1 || ISLEAF[bk] === 1 || (this.getBlock(x, y + 1, z) === id && this.getMeta(x, y + 1, z) === meta);   // つたは葉にもつく。上のつたからぶら下がれる
      return OPAQUE[bk] === 1;
    }
    switch (b.support) {
      case 'soil': return SOIL[below] === 1;
      case 'sandy': return below === B.sand || below === B.red_sand || SOIL[below] === 1 || (below >= B.terracotta && below <= B.terracotta_brown);
      case 'water': return below === B.water && this.getMeta(x, y - 1, z) === 0;
      case 'solid': return OPAQUE[below] === 1 || ISLEAF[below] === 1;
      case 'farmland': return below === B.farmland;
      case 'cactus':
        if (below !== B.sand && below !== B.red_sand && below !== B.cactus) return false;
        for (let d = 0; d < 4; d++) if (SOLID[this.getBlock(x + F4[d][0], y, z + F4[d][1])]) return false;
        return true;
    }
    return true;
  }
  blockUpdate(x, y, z) {
    const id = this.getBlock(x, y, z);
    if (!id) return;
    if (FLUID[id]) { this.sched(x, y, z, FLUID[id] === 1 ? 4 : 18); return; }
    if (GRAVITY[id]) { const bl = this.getBlock(x, y - 1, z); if (y > 0 && (bl === 0 || FLUID[bl] || (REPLACE[bl] && !SOLID[bl]))) this.sched(x, y, z, 2); return; }
    const b = BLOCKS[id], sh = SHAPE[id];
    if (b.support || sh === S_TORCH || sh === S_LADDER) {
      if (!this.hasSupport(id, this.getMeta(x, y, z), x, y, z)) this.breakNatural(x, y, z);
      return;
    }
    if (sh === S_DOOR) {
      const m = this.getMeta(x, y, z), oy = (m & 8) ? y - 1 : y + 1;
      if (this.getBlock(x, oy, z) !== id) this.setBlock(x, y, z, 0, 0);
      else if (!(m & 8) && !SOLID[this.getBlock(x, y - 1, z)]) this.breakNatural(x, y, z);
    } else if (sh === S_BED) {
      const m = this.getMeta(x, y, z), d = F4[m & 3], s = (m & 4) ? -1 : 1;
      if (this.getBlock(x + d[0] * s, y, z + d[1] * s) !== id) this.setBlock(x, y, z, 0, 0);
    }
  }
  // 道具なしで壊れたときの処理（草花が流される・支えを失う など）
  breakNatural(x, y, z) {
    const id = this.getBlock(x, y, z), meta = this.getMeta(x, y, z);
    if (!id) return;
    const sh = SHAPE[id];
    if (sh === S_DOOR && (meta & 8)) { this.setBlock(x, y, z, 0, 0); return; }
    if (sh === S_BED && (meta & 4)) { this.setBlock(x, y, z, 0, 0); return; }
    this.spillEnt(x, y, z);
    const drops = sh === S_LAYER ? [] : blockDrops(id, meta, null, this.rng);
    this.setBlock(x, y, z, 0, 0);
    for (const [did, n] of drops) spawnDrop(x + 0.5, y + 0.3, z + 0.5, did, n, 0);
  }
  spillEnt(x, y, z) {
    const e = this.getEnt(x, y, z);
    if (!e) return;
    const list = e.t === 'chest' ? e.items : [e.in, e.fuel, e.out];
    for (const s of list) if (s) spawnDrop(x + 0.5, y + 0.5, z + 0.5, s.id, s.n, s.d || 0);
  }

  // ---------- 予約された更新（水・落下・葉） ----------
  sched(x, y, z, delay) {
    const k = posKey(x, y, z);
    if (this.scheduled.has(k)) return;
    this.scheduled.add(k);
    const t = this.tick + delay;
    let a = this.schedule.get(t);
    if (!a) { a = []; this.schedule.set(t, a); }
    a.push(k);
  }
  runScheduled() {
    const a = this.schedule.get(this.tick);
    if (!a) return;
    this.schedule.delete(this.tick);
    const lim = Math.min(a.length, 1500);
    if (a.length > lim) { const rest = a.slice(lim); const nx = this.schedule.get(this.tick + 1); if (nx) for (const k of rest) nx.push(k); else this.schedule.set(this.tick + 1, rest); }
    for (let n = 0; n < lim; n++) {
      const k = a[n]; this.scheduled.delete(k);
      const y = k % 128, rest = (k - y) / 128, zz = rest % 2097152, x = (rest - zz) / 2097152 - 1048576, z = zz - 1048576;
      this.blockTick(x, y, z);
    }
  }
  blockTick(x, y, z) {
    const c = this.getChunk(x >> 4, z >> 4);
    if (!c || c.stage < 2) return;
    const i = (y << 8) | ((z & 15) << 4) | (x & 15), id = c.blocks[i], meta = c.meta[i];
    if (FLUID[id]) this.fluidTick(x, y, z, id, meta);
    else if (GRAVITY[id]) {
      const bl = this.getBlock(x, y - 1, z);
      if (y > 0 && (bl === 0 || FLUID[bl] || (REPLACE[bl] && !SOLID[bl]))) { this.setBlock(x, y, z, 0, 0); spawnFalling(x, y, z, id); }
    } else if (ISLEAF[id]) {
      if (!(meta & 1) && !this.leafHasLog(x, y, z)) { fxLeafDecay(x, y, z, id); this.breakNatural(x, y, z); }
    }
  }
  queueLeafChecks(x, y, z) {
    for (let dy = -4; dy <= 4; dy++) for (let dz = -4; dz <= 4; dz++) for (let dx = -4; dx <= 4; dx++) {
      if (ISLEAF[this.getBlock(x + dx, y + dy, z + dz)]) this.sched(x + dx, y + dy, z + dz, 30 + Math.floor(Math.random() * 110));
    }
  }
  leafHasLog(x, y, z) {
    if (!this.areaLoaded(x, z, 4)) return true;   // となりのチャンクがまだ無いときは 枯らさない（幹がそちらにあるかもしれない）
    for (let dy = -4; dy <= 4; dy++) for (let dz = -4; dz <= 4; dz++) for (let dx = -4; dx <= 4; dx++) if (ISLOG[this.getBlock(x + dx, y + dy, z + dz)]) return true;
    return false;
  }
  fluidCanEnter(nb, id) {
    if (nb === 0) return true;
    if (FLUID[nb]) return nb !== id;
    const sh = SHAPE[nb];
    return sh === S_CROSS || sh === S_CROP || sh === S_TORCH || sh === S_LAYER;
  }
  fluidInto(x, y, z, id, meta) {
    const nb = this.getBlock(x, y, z);
    if (FLUID[nb] && nb !== id) {
      const res = nb === B.lava ? (this.getMeta(x, y, z) === 0 ? B.obsidian : B.cobble) : B.cobble;
      this.setBlock(x, y, z, res, 0); fxFizz(x, y, z);
      return;
    }
    if (nb !== 0) this.breakNatural(x, y, z);
    this.setBlock(x, y, z, id, meta);
  }
  fluidTick(x, y, z, id, meta) {
    const isW = id === B.water, step = isW ? 1 : 2, maxL = isW ? 7 : 6;
    if (meta !== 0) {
      let nm;
      if (this.getBlock(x, y + 1, z) === id) nm = 8;
      else {
        let minL = 99, src = 0;
        for (let d = 0; d < 4; d++) {
          const nx = x + F4[d][0], nz = z + F4[d][1];
          if (this.getBlock(nx, y, nz) === id) { const m2 = this.getMeta(nx, y, nz), l = m2 >= 8 ? 0 : m2; if (m2 === 0) src++; if (l < minL) minL = l; }
        }
        nm = minL + step;
        if (nm > maxL) nm = -1;
        if (isW && src >= 2) { const bl = this.getBlock(x, y - 1, z); if (SOLID[bl] || (bl === id && this.getMeta(x, y - 1, z) === 0)) nm = 0; }
      }
      if (nm === -1) { this.setBlock(x, y, z, 0, 0); return; }
      if (nm !== meta) { this.setBlock(x, y, z, id, nm); meta = nm; }
    }
    if (y <= 0) return;
    const below = this.getBlock(x, y - 1, z);
    if (this.fluidCanEnter(below, id)) { this.fluidInto(x, y - 1, z, id, 8); return; }
    if (!(meta === 0 || (below !== id && !FLUID[below]))) return;
    const next = (meta >= 8 ? 0 : meta) + step;
    if (next > maxL) return;
    for (let d = 0; d < 4; d++) {
      const nx = x + F4[d][0], nz = z + F4[d][1];
      if (!this.isLoaded(nx, nz)) continue;
      const nb = this.getBlock(nx, y, nz);
      if (this.fluidCanEnter(nb, id)) this.fluidInto(nx, y, nz, id, next);
      else if (nb === id) { const m2 = this.getMeta(nx, y, nz); if (m2 !== 0 && m2 < 8 && m2 > next) this.setBlock(nx, y, nz, id, next); }
    }
  }

  // ---------- ときどき起きる変化（草が広がる・作物が育つ など） ----------
  randomTicks(pcx, pcz) {
    this.natural = true;
    for (let dz = -4; dz <= 4; dz++) for (let dx = -4; dx <= 4; dx++) {
      const c = this.getChunk(pcx + dx, pcz + dz);
      if (!c || c.stage < 2) continue;
      if (this.net && !this.net.owns(c.cx, c.cz)) continue;   // いちばん近い人の端末だけが育てる
      const top = Math.min(CH - 1, c.maxY + 1) + 1;
      for (let n = 0; n < 10; n++) {
        const lx = (Math.random() * 16) | 0, lz = (Math.random() * 16) | 0, y = (Math.random() * top) | 0;
        const i = (y << 8) | (lz << 4) | lx, id = c.blocks[i];
        if (RTICK[id]) this.randomTick(c.cx * 16 + lx, y, c.cz * 16 + lz, id, c.meta[i]);
      }
    }
    this.natural = false;
  }
  randomTick(x, y, z, id, meta) {
    if (id === B.grass) {
      const ab = this.getBlock(x, y + 1, z);
      if (OPAQUE[ab] || FLUID[ab]) { this.setBlock(x, y, z, B.dirt, 0); return; }
      if (this.lightLevel(x, y + 1, z) < 9) return;
      const nx = x + ((Math.random() * 3) | 0) - 1, nz = z + ((Math.random() * 3) | 0) - 1, ny = y + ((Math.random() * 3) | 0) - 1;
      if (this.getBlock(nx, ny, nz) === B.dirt) { const a2 = this.getBlock(nx, ny + 1, nz); if (!OPAQUE[a2] && !FLUID[a2] && this.lightLevel(nx, ny + 1, nz) >= 4) this.setBlock(nx, ny, nz, B.grass, 0); }
    } else if (SAP_TYPE[id] !== undefined) {
      if (this.lightLevel(x, y, z) >= 9 && Math.random() < 0.3 && this.areaLoaded(x, z, 7)) { const nat = this.natural; this.natural = false; this.growTree(x, y, z, SAP_TYPE[id]); this.natural = nat; }
    } else if (id === B.wheat_crop) {
      if (meta < 3 && this.lightLevel(x, y, z) >= 9) {
        const wet = this.getMeta(x, y - 1, z) === 1;
        if (Math.random() < (wet ? 0.75 : 0.35)) this.setBlock(x, y, z, id, meta + 1);
      }
    } else if (id === B.farmland) {
      if (!this.areaLoaded(x, z, 4)) return;
      let wet = false;
      for (let dz = -4; dz <= 4 && !wet; dz++) for (let dx = -4; dx <= 4; dx++) if (this.getBlock(x + dx, y, z + dz) === B.water || this.getBlock(x + dx, y + 1, z + dz) === B.water) { wet = true; break; }
      if (wet !== (meta === 1)) this.setBlock(x, y, z, id, wet ? 1 : 0);
      else if (!wet && this.getBlock(x, y + 1, z) !== B.wheat_crop && Math.random() < 0.25) this.setBlock(x, y, z, B.dirt, 0);
    } else if (ISLEAF[id]) {
      if (!(meta & 1) && !this.leafHasLog(x, y, z)) { fxLeafDecay(x, y, z, id); this.breakNatural(x, y, z); }
    } else if (id === B.cactus) {
      if (this.getBlock(x, y + 1, z) === 0 && this.getBlock(x, y - 2, z) !== B.cactus && Math.random() < 0.15) {
        let ok = true; for (let d = 0; d < 4; d++) if (SOLID[this.getBlock(x + F4[d][0], y + 1, z + F4[d][1])]) ok = false;
        if (ok) this.setBlock(x, y + 1, z, B.cactus, 0);
      }
    }
  }
  growTree(x, y, z, type) {
    for (let k = 1; k <= 5; k++) { const b = this.getBlock(x, y + k, z); if (b !== 0 && !ISLEAF[b]) return false; }
    if (y > 100) return false;
    this.setBlock(x, y, z, 0, 0, 1);
    genTreeShape(type, this.rng, (dx, dy, dz, id, m) => {
      if (y + dy < 1 || y + dy > 126) return;
      const cur = this.getBlock(x + dx, y + dy, z + dz);
      if (ISLOG[id]) { if (cur === 0 || ISLEAF[cur] || cur === B.vine || (REPLACE[cur] && !FLUID[cur])) this.setBlock(x + dx, y + dy, z + dz, id, 0, 1); }
      else if (cur === 0) this.setBlock(x + dx, y + dy, z + dz, id, m || 0, 1);
    });
    return true;
  }
  tickFurnaces() {
    for (const c of this.chunks.values()) {
      if (!c.ents.size || c.stage < 2) continue;
      const mine = !this.net || this.net.owns(c.cx, c.cz);
      for (const [i, e] of c.ents) if (e.t === 'furnace') { if (mine) this.tickFurnace(c, i, e); else this.showFurnace(e); }
    }
  }
  // ほかの人の端末が動かしているかまど：見た目の進み具合だけ進める（中身は変えない）
  showFurnace(e) {
    const rec = e.in ? SMELT[e.in.id] : null;
    const can = !!rec && (!e.out || (e.out.id === rec[0] && e.out.n + rec[1] <= maxStack(rec[0])));
    if (e.burn > 1) e.burn--;
    if (e.burn > 0 && can) e.cook = Math.min(SMELT_TIME - 1, e.cook + 1);
  }
  tickFurnace(c, i, e) {
    const rec = e.in ? SMELT[e.in.id] : null;
    const can = !!rec && (!e.out || (e.out.id === rec[0] && e.out.n + rec[1] <= maxStack(rec[0])));
    let changed = false;
    if (e.burn > 0) e.burn--;
    if (e.burn === 0 && can && e.fuel && FUEL[e.fuel.id]) {
      e.burn = e.burnMax = FUEL[e.fuel.id] * 20;
      if (e.fuel.id === I.lava_bucket) e.fuel = { id: I.bucket, n: 1, d: 0 };
      else { e.fuel.n--; if (e.fuel.n <= 0) e.fuel = null; }
      changed = true;
    }
    if (e.burn > 0 && can) {
      e.cook++;
      if (e.cook >= SMELT_TIME) {
        e.cook = 0;
        if (e.out) e.out.n += rec[1]; else e.out = { id: rec[0], n: rec[1], d: 0 };
        e.in.n--; if (e.in.n <= 0) e.in = null;
        changed = true; e.done = (e.done || 0) + 1;
        fxSmeltDone(c.cx * 16 + (i & 15), i >> 8, c.cz * 16 + ((i >> 4) & 15));
      }
    } else if (e.cook > 0) e.cook = Math.max(0, e.cook - 2);
    const lit = e.burn > 0, id = c.blocks[i];
    if (lit !== (id === B.furnace_lit)) this.setBlock(c.cx * 16 + (i & 15), i >> 8, c.cz * 16 + ((i >> 4) & 15), lit ? B.furnace_lit : B.furnace, c.meta[i], 3);
    if (changed) c.modified = c.saveDirty = true;
    if (this.net && (changed || (e.burn > 0 && this.tick % 40 === 0))) this.net.entDirty(c.cx * 16 + (i & 15), i >> 8, c.cz * 16 + ((i >> 4) & 15));
  }

  // ---------- チャンクの読みこみ・片づけ ----------
  installChunk(c, r) {
    c.blocks = r.blocks; c.meta = r.meta; c.biome = r.biome; c.maxY = r.maxY;
    c.light = new Uint8Array(CVOL);
    c.ents.clear();
    if (r.ents) for (const e of r.ents) { const o = Object.assign({}, e); delete o.i; c.ents.set(e.i, o); }
    c.stage = 1; c.dirty = 0xFF;
    if (this.net) this.net.applyStore(c);
  }
  loadSaved(c, s) {
    const blocks = unrle(s.b, CVOL), meta = unrle(s.m, CVOL), biome = new Uint8Array(256);
    const g = this.genOf(this.genVer(c.cx, c.cz) || this.gv0);
    for (let z = 0; z < 16; z++) for (let x = 0; x < 16; x++) { g.column(c.cx * 16 + x, c.cz * 16 + z); biome[(z << 4) | x] = g.colB; }
    let maxY = CH - 1;
    for (; maxY > 0; maxY--) { let any = false; const base = maxY << 8; for (let i = 0; i < 256; i++) if (blocks[base + i]) { any = true; break; } if (any) break; }
    this.installChunk(c, { blocks, meta, biome, maxY, ents: s.e ? JSON.parse(JSON.stringify(s.e)) : [] });
    c.modified = true;
  }
  serializeChunk(c) {
    const e = [];
    for (const [i, o] of c.ents) e.push(Object.assign({ i }, JSON.parse(JSON.stringify(o))));
    return { b: rle(c.blocks), m: rle(c.meta), e };
  }
  flushChunk(c) {
    if (!c.modified || !c.saveDirty || c.stage < 1 || this.net) return;   // みんなの世界は中継サーバーが正本なので、ここには残さない
    const k = c.cx + ',' + c.cz;
    this.saved.set(k, this.serializeChunk(c));
    this.savedDirty.add(k);
    c.saveDirty = false;
  }
  flushAll() { for (const c of this.chunks.values()) this.flushChunk(c); }
  canMesh(c) {
    if (c.stage < 2) return false;
    for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) {
      if (!dx && !dz) continue;
      const n = this.chunks.get((c.cx + dx + 32768) * 65536 + (c.cz + dz + 32768));
      if (!n || n.stage < 2) return false;
    }
    return true;
  }
  // 毎フレーム呼ぶ。プレイヤーのまわりのチャンクを用意する
  stream(px, pz, R, budgetMs) {
    const pcx = Math.floor(px / 16), pcz = Math.floor(pz / 16);
    const t0 = performance.now();
    const order = spiralOrder(R + 1);
    this._frame = (this._frame || 0) + 1;
    for (let n = 0; n < order.length; n += 2) {
      const cx = pcx + order[n], cz = pcz + order[n + 1];
      let c = this.chunks.get((cx + 32768) * 65536 + (cz + 32768));
      if (!c) {
        if (this.net && !this.net.chunkReady(this.dim, cx, cz)) continue;   // その区画の変更がまだ届いていない
        c = new Chunk(cx, cz);
        this.chunks.set(this.key(cx, cz), c);
        const s = this.saved.get(cx + ',' + cz);
        if (s) { this.loadSaved(c, s); }
      }
      if (c.stage === 0 && !c.requested) {
        const gv = this.genVer(cx, cz);
        if (!gv) continue;
        if (genWorkers.length) {
          if (this.inflight < genWorkers.length * 3) { c.requested = true; this.inflight++; requestGen(this, cx, cz, gv); }
        } else {
          if (performance.now() - t0 > budgetMs) break;
          this.installChunk(c, this.genOf(gv).genChunk(cx, cz));
        }
      }
      if (c.stage === 1) {
        if (performance.now() - t0 > budgetMs) break;
        this.lightChunk(c);
      }
    }
    // 遠くなったチャンクを片づける
    if ((this._frame & 31) === 0 || this.chunks.size > (2 * R + 9) * (2 * R + 9)) {
      const lim = R + 3;
      for (const c of this.chunks.values()) {
        if (Math.abs(c.cx - pcx) > lim || Math.abs(c.cz - pcz) > lim) {
          if (c.stage === 0 && c.requested) continue;
          this.flushChunk(c);
          if (this.onUnload) this.onUnload(c);
          this.chunks.delete(this.key(c.cx, c.cz));
          if (this._lc === c) this._lc = null;
        }
      }
    }
  }
  onGenResult(m) {
    this.inflight = Math.max(0, this.inflight - 1);
    const c = this.chunks.get(this.key(m.cx, m.cz));
    if (!c || c.stage !== 0) return;
    this.installChunk(c, m);
  }
  dispose() {
    for (const c of this.chunks.values()) if (this.onUnload) this.onUnload(c);
    this.chunks.clear(); this._lc = null;
  }

  // ---------- 当たり判定・視線 ----------
  // 範囲に重なるブロックの箱を out に追加する（6つの数で1つの箱）
  collectBoxes(x0, y0, z0, x1, y1, z1, out) {
    const ix0 = Math.floor(x0), iy0 = Math.max(0, Math.floor(y0)), iz0 = Math.floor(z0);
    const ix1 = Math.floor(x1), iy1 = Math.min(CH - 1, Math.floor(y1)), iz1 = Math.floor(z1);
    for (let z = iz0; z <= iz1; z++) for (let x = ix0; x <= ix1; x++) {
      const c = this.getChunk(x >> 4, z >> 4);
      if (!c || c.stage < 1) { out.push(x, -64, z, x + 1, 256, z + 1); continue; }
      const col = ((z & 15) << 4) | (x & 15);
      for (let y = iy0; y <= iy1; y++) {
        const id = c.blocks[(y << 8) | col];
        if (!SOLID[id]) continue;
        if (SHAPE[id] === S_CUBE) { out.push(x, y, z, x + 1, y + 1, z + 1); continue; }
        const bs = collisionBoxes(id, c.meta[(y << 8) | col]);
        for (const b of bs) out.push(x + b[0], y + b[1], z + b[2], x + b[3], y + b[4], z + b[5]);
      }
    }
    return out;
  }
  raycast(ox, oy, oz, dx, dy, dz, maxDist) {
    let x = Math.floor(ox), y = Math.floor(oy), z = Math.floor(oz);
    const sx = dx > 0 ? 1 : -1, sy = dy > 0 ? 1 : -1, sz = dz > 0 ? 1 : -1;
    const tdx = dx !== 0 ? Math.abs(1 / dx) : 1e30, tdy = dy !== 0 ? Math.abs(1 / dy) : 1e30, tdz = dz !== 0 ? Math.abs(1 / dz) : 1e30;
    let tx = dx !== 0 ? ((dx > 0 ? x + 1 - ox : ox - x) * tdx) : 1e30;
    let ty = dy !== 0 ? ((dy > 0 ? y + 1 - oy : oy - y) * tdy) : 1e30;
    let tz = dz !== 0 ? ((dz > 0 ? z + 1 - oz : oz - z) * tdz) : 1e30;
    let nx = 0, ny = 0, nz = 0, t = 0;
    for (let n = 0; n < 64; n++) {
      const id = this.getBlock(x, y, z);
      if (id && SHAPE[id] !== S_FLUID) {
        if (SHAPE[id] === S_CUBE) return { x, y, z, nx, ny, nz, id, meta: this.getMeta(x, y, z), t };
        else {
          const meta = this.getMeta(x, y, z), bs = selectionBoxes(id, meta);
          let best = null;
          for (const b of bs) {
            const h = rayBox(ox, oy, oz, dx, dy, dz, x + b[0], y + b[1], z + b[2], x + b[3], y + b[4], z + b[5]);
            if (h && h.t <= maxDist && (!best || h.t < best.t)) best = h;
          }
          if (best) return { x, y, z, nx: best.nx, ny: best.ny, nz: best.nz, id, meta, t: best.t, box: bs[0] };
        }
      }
      if (tx < ty && tx < tz) { t = tx; tx += tdx; x += sx; nx = -sx; ny = 0; nz = 0; }
      else if (ty < tz) { t = ty; ty += tdy; y += sy; nx = 0; ny = -sy; nz = 0; }
      else { t = tz; tz += tdz; z += sz; nx = 0; ny = 0; nz = -sz; }
      if (t > maxDist) return null;
    }
    return null;
  }
  // その場所の上から最初の固いブロックの高さ（なければ -1）
  surfaceY(x, z) {
    const c = this.getChunk(x >> 4, z >> 4);
    if (!c || c.stage < 1) return -1;
    const col = ((z & 15) << 4) | (x & 15);
    for (let y = Math.min(CH - 1, c.maxY + 1); y >= 0; y--) { const id = c.blocks[(y << 8) | col]; if (SOLID[id] || FLUID[id]) return y; }
    return -1;
  }
}
function rayBox(ox, oy, oz, dx, dy, dz, x0, y0, z0, x1, y1, z1) {
  let tmin = -1e30, tmax = 1e30, axis = 0, sign = 0;
  const o = [ox, oy, oz], d = [dx, dy, dz], lo = [x0, y0, z0], hi = [x1, y1, z1];
  for (let a = 0; a < 3; a++) {
    if (Math.abs(d[a]) < 1e-9) { if (o[a] < lo[a] || o[a] > hi[a]) return null; continue; }
    let t1 = (lo[a] - o[a]) / d[a], t2 = (hi[a] - o[a]) / d[a], s = -1;
    if (t1 > t2) { const tt = t1; t1 = t2; t2 = tt; s = 1; }
    if (t1 > tmin) { tmin = t1; axis = a; sign = s; }
    if (t2 < tmax) tmax = t2;
    if (tmin > tmax) return null;
  }
  if (tmax < 0) return null;
  const t = Math.max(0, tmin);
  return { t, nx: axis === 0 ? sign : 0, ny: axis === 1 ? sign : 0, nz: axis === 2 ? sign : 0 };
}
const _spiralCache = {};
function spiralOrder(R) {
  if (_spiralCache[R]) return _spiralCache[R];
  const list = [];
  for (let dz = -R; dz <= R; dz++) for (let dx = -R; dx <= R; dx++) list.push([dx, dz, dx * dx + dz * dz]);
  list.sort((a, b) => a[2] - b[2]);
  const out = new Int16Array(list.length * 2);
  list.forEach((e, i) => { out[i * 2] = e[0]; out[i * 2 + 1] = e[1]; });
  return (_spiralCache[R] = out);
}

// ---------- 地形づくりの作業スレッド ----------
const genWorkers = [];
let _activeWorld = null;
function startGenWorkers(seed) {
  stopGenWorkers();
  if (window.__kkNoWorker || typeof Worker === 'undefined' || typeof WORKER_SRC === 'undefined') return;
  try {
    const n = Math.max(1, Math.min(3, (navigator.hardwareConcurrency || 2) - 1));
    const url = URL.createObjectURL(new Blob([WORKER_SRC], { type: 'text/javascript' }));
    for (let i = 0; i < n; i++) {
      const w = new Worker(url);
      w.onmessage = (e) => { const m = e.data; if (_activeWorld && m.id === _activeWorld.token) _activeWorld.onGenResult(m); };
      w.onerror = () => { failGenWorkers(); };
      w.postMessage({ t: 'init', seed });
      genWorkers.push(w);
    }
  } catch (err) { failGenWorkers(); }
}
function failGenWorkers() {
  stopGenWorkers();
  if (_activeWorld) { _activeWorld.inflight = 0; for (const c of _activeWorld.chunks.values()) c.requested = false; }
}
function stopGenWorkers() { for (const w of genWorkers) { try { w.terminate(); } catch (e) { } } genWorkers.length = 0; }
let _genRR = 0;
function requestGen(world, cx, cz, gv) {
  const w = genWorkers[(_genRR++) % genWorkers.length];
  w.postMessage({ t: 'gen', id: world.token, cx, cz, gv: gv || 1, dim: world.dim });
}
