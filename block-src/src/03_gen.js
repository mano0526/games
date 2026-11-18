// ===== 03_gen.js : 地形の自動生成（作業スレッドと共用） =====
// 0〜10 は版1から。11 以降は版2で増えた分（番号は変えない。セーブした世界で使うため）
const BIOME = { OCEAN: 0, BEACH: 1, PLAINS: 2, FOREST: 3, DESERT: 4, SNOW: 5, TAIGA: 6, MOUNTAIN: 7, CHERRY: 8, FLOWER: 9, RIVER: 10,
  BIRCH: 11, DARK: 12, JUNGLE: 13, SAVANNA: 14, SWAMP: 15, BADLANDS: 16, ICE: 17, SNOW_TAIGA: 18, OLD_TAIGA: 19, MEADOW: 20, SNOW_PEAK: 21, DEEP: 22, FROZEN: 23, MUSHROOM: 24 };
const BIOME_NAMES = ['海', '砂浜', '草原', '森', '砂漠', '雪原', '針葉樹の森', '山', 'サクラの丘', '花畑', '川',
  'シラカバの森', '暗い森', 'ジャングル', 'サバンナ', '湿地', '荒野', '氷のとげの原', '雪の針葉樹林', '大きなマツの森', '高原', '雪山', '深い海', 'こおった海', 'キノコの島'];
const BIOME_TINT = [3, 3, 0, 1, 3, 2, 2, 2, 0, 0, 0, 0, 7, 4, 5, 6, 5, 2, 2, 1, 0, 2, 3, 2, 1];   // 草の色の種類
const TREE_DENS = [0, 0, 0.0025, 0.07, 0, 0.003, 0.06, 0.012, 0.045, 0.002, 0];
const F4 = [[0, 1], [-1, 0], [0, -1], [1, 0]];   // 向き 0:南(+Z) 1:西(-X) 2:北(-Z) 3:東(+X)
const F4_TO_FACE = [4, 1, 5, 0];
const _FA = 0.0115, _FAY = 0.017, _FK = 0.0075, _FKY = 0.013;

function rollLoot(rng, table, minN, maxN) {
  const items = new Array(27).fill(null);
  let total = 0;
  for (const e of table) total += e[3];
  const cnt = minN + Math.floor(rng() * (maxN - minN + 1));
  for (let n = 0; n < cnt; n++) {
    let r = rng() * total, e = table[0];
    for (const t of table) { r -= t[3]; if (r < 0) { e = t; break; } }
    const c = e[1] + Math.floor(rng() * (e[2] - e[1] + 1));
    let slot = Math.floor(rng() * 27), tries = 0;
    while (items[slot] && tries++ < 27) slot = (slot + 1) % 27;
    if (!items[slot]) items[slot] = { id: e[0], n: c, d: 0 };
  }
  return items;
}
function lootRuin() {
  return [[I.bread, 2, 4, 10], [I.apple, 1, 3, 8], [I.coal, 3, 8, 10], [I.iron_ingot, 1, 4, 8], [I.wheat_seeds, 2, 6, 6],
    [B.torch, 4, 10, 8], [B.sapling_cherry, 1, 2, 4], [I.gold_ingot, 1, 3, 4], [I.iron_pick, 1, 1, 2], [I.bucket, 1, 1, 2],
    [I.golden_apple, 1, 1, 1], [I.diamond, 1, 1, 1], [B.wool_white, 2, 5, 4]];
}
function lootRoom() {
  return [[I.iron_ingot, 2, 6, 10], [I.gold_ingot, 1, 4, 8], [I.diamond, 1, 3, 4], [I.glow_dust, 2, 6, 8], [I.coal, 4, 10, 8],
    [I.bread, 2, 5, 6], [I.golden_apple, 1, 1, 3], [I.iron_chest, 1, 1, 2], [I.iron_helmet, 1, 1, 2], [I.iron_sword, 1, 1, 3],
    [I.shadow_shard, 1, 2, 4], [I.bucket, 1, 1, 3], [B.obsidian, 1, 3, 3]];
}

class WorldGen {
  constructor(seed) {
    seed |= 0; this.seed = seed;
    this.nC = new Simplex(seed ^ 0x1A2B3C); this.nE = new Simplex(seed ^ 0x2B3C4D); this.nD = new Simplex(seed ^ 0x3C4D5E);
    this.nR = new Simplex(seed ^ 0x4D5E6F); this.nT = new Simplex(seed ^ 0x5E6F70); this.nH = new Simplex(seed ^ 0x6F7081);
    this.nS = new Simplex(seed ^ 0x708192); this.nV = new Simplex(seed ^ 0x8192A3);
    this.nA = new Simplex(seed ^ 0x92A3B4); this.nB = new Simplex(seed ^ 0xA3B4C5); this.nK = new Simplex(seed ^ 0xB4C5D6);
    this.nP = new Simplex(seed ^ 0xC5D6E7);
    this.colH = 0; this.colB = 0; this.colCold = false;
    this.gH = new Int16Array(576); this.gB = new Uint8Array(576); this.gCold = new Uint8Array(576);
    this.latA = new Float32Array(825); this.latB = new Float32Array(825); this.latK = new Float32Array(825);
    this.cA = new Float32Array(34); this.cB = new Float32Array(34); this.cK = new Float32Array(34);
  }

  // その地点の地面の高さ・地域（バイオーム）・寒さを求める
  column(x, z) {
    const s = this.seed;
    let c = fbm2(this.nC, x * 0.0016, z * 0.0016, 4);
    c += 0.45 * Math.max(0, 1 - Math.sqrt(x * x + z * z) / 320);
    const e = fbm2(this.nE, x * 0.0032, z * 0.0032, 3);
    const d = fbm2(this.nD, x * 0.011, z * 0.011, 4);
    const land = smoothstep(-0.26, -0.06, c);
    const hill = smoothstep(-0.25, 0.45, e);
    const mount = smoothstep(0.14, 0.55, e) * smoothstep(-0.04, 0.2, c);
    let rr = 1 - Math.abs(this.nR.n2(x * 0.0045, z * 0.0045)); rr *= rr;
    const oceanH = SEA - 5 - 20 * smoothstep(-0.26, -0.8, c) + d * 3;
    const landH = SEA + 3 + Math.max(0, c) * 8 + d * (2.5 + hill * 8) + hill * 5 + mount * mount * (16 + rr * 40);
    let h = lerp(oceanH, landH, land);
    const rv = Math.abs(this.nV.n2(x * 0.0021, z * 0.0021));
    const rf = smoothstep(0.05, 0.012, rv) * land * (1 - mount * 0.85);
    if (rf > 0) h = lerp(h, Math.min(h, SEA - 3.5 + d), rf);
    const jit = (hash2(x, z, s ^ 0x77) / 4294967296 - 0.5) * 0.05;
    const T = fbm2(this.nT, x * 0.0019, z * 0.0019, 2) + jit;
    const H = fbm2(this.nH, x * 0.0026, z * 0.0026, 2) + jit;
    const hi = clamp(Math.floor(h), 8, 118);
    const T2 = T - Math.max(0, hi - 72) * 0.012;
    const cold = T2 < -0.3;
    let b;
    if (hi < SEA) b = (land > 0.6 && rf > 0.25) ? BIOME.RIVER : BIOME.OCEAN;
    else if (hi <= SEA + 1 && (land < 0.97 || rf > 0.08)) b = BIOME.BEACH;
    else if (mount > 0.45 && hi > 76) b = BIOME.MOUNTAIN;
    else if (cold) b = H > -0.05 ? BIOME.TAIGA : BIOME.SNOW;
    else if (T2 > 0.36 && H < 0.08) b = BIOME.DESERT;
    else {
      const sp = this.nS.n2(x * 0.0042, z * 0.0042);
      if (H > 0.12) b = sp > 0.42 ? BIOME.CHERRY : BIOME.FOREST;
      else b = sp < -0.5 ? BIOME.FLOWER : BIOME.PLAINS;
    }
    this.colH = hi; this.colB = b; this.colCold = cold;
    return hi;
  }

  carveTest(a, b, k, y, h, wet) {
    const depth = h - y;
    if (wet && depth < 7) return false;
    let thr = 0.008 + 0.004 * smoothstep(60, 14, y);
    if (depth < 5) thr *= 0.5;
    if (a * a + b * b < thr) return true;
    if (y < 44 && depth > 8 && k > 0.7 + y * 0.004) return true;
    return false;
  }
  // 1点だけ洞窟かどうか調べる（木が宙に浮かないようにするため）
  caveAt(x, y, z, h, wet) {
    if (y < 2) return false;
    const ix = Math.floor(x / 4), iy = y >> 2, iz = Math.floor(z / 4);
    const fx = (x - ix * 4) * 0.25, fy = (y & 3) * 0.25, fz = (z - iz * 4) * 0.25;
    let a = 0, b = 0, k = 0;
    for (let c = 0; c < 8; c++) {
      const dx = c & 1, dy = (c >> 1) & 1, dz = (c >> 2) & 1;
      const w = (dx ? fx : 1 - fx) * (dy ? fy : 1 - fy) * (dz ? fz : 1 - fz);
      if (w === 0) continue;
      const wx = (ix + dx) * 4, wy = (iy + dy) * 4, wz = (iz + dz) * 4;
      a += w * this.nA.n3(wx * _FA, wy * _FAY, wz * _FA);
      b += w * this.nB.n3(wx * _FA, wy * _FAY, wz * _FA);
      k += w * this.nK.n3(wx * _FK, wy * _FKY, wz * _FK);
    }
    return this.carveTest(a, b, k, y, h, wet);
  }

  genChunk(cx, cz) {
    const blocks = new Uint8Array(CVOL), meta = new Uint8Array(CVOL), biome = new Uint8Array(256);
    const ents = [];
    const x0 = cx * 16, z0 = cz * 16, seed = this.seed;
    const gH = this.gH, gB = this.gB, gCold = this.gCold;
    let hmax = 0;
    for (let gz = 0; gz < 24; gz++) for (let gx = 0; gx < 24; gx++) {
      this.column(x0 + gx - 4, z0 + gz - 4);
      const gi = gz * 24 + gx; gH[gi] = this.colH; gB[gi] = this.colB; gCold[gi] = this.colCold ? 1 : 0;
      if (this.colH > hmax) hmax = this.colH;
    }
    // 洞窟用のノイズを4マスおきに計算
    const lA = this.latA, lB = this.latB, lK = this.latK;
    const jTop = Math.min(32, (hmax >> 2) + 2);
    for (let j = 0; j <= jTop; j++) for (let k = 0; k < 5; k++) for (let i = 0; i < 5; i++) {
      const wx = x0 + i * 4, wy = j * 4, wz = z0 + k * 4, li = (j * 5 + k) * 5 + i;
      lA[li] = this.nA.n3(wx * _FA, wy * _FAY, wz * _FA);
      lB[li] = this.nB.n3(wx * _FA, wy * _FAY, wz * _FA);
      lK[li] = this.nK.n3(wx * _FK, wy * _FKY, wz * _FK);
    }
    const cA = this.cA, cB = this.cB, cK = this.cK;
    const STONE = B.stone, WATER = B.water, GRASS = B.grass, DIRT = B.dirt, SAND = B.sand;
    for (let z = 0; z < 16; z++) for (let x = 0; x < 16; x++) {
      const gi = (z + 4) * 24 + x + 4;
      const h = gH[gi], b = gB[gi], cold = gCold[gi];
      const wx = x0 + x, wz = z0 + z, col = (z << 4) | x;
      biome[col] = b;
      const ix = x >> 2, iz = z >> 2, fx = (x & 3) * 0.25, fz = (z & 3) * 0.25;
      const w00 = (1 - fx) * (1 - fz), w10 = fx * (1 - fz), w01 = (1 - fx) * fz, w11 = fx * fz;
      const jmax = Math.min(32, (h >> 2) + 1);
      for (let j = 0; j <= jmax; j++) {
        const base = (j * 5 + iz) * 5 + ix;
        cA[j] = lA[base] * w00 + lA[base + 1] * w10 + lA[base + 5] * w01 + lA[base + 6] * w11;
        cB[j] = lB[base] * w00 + lB[base + 1] * w10 + lB[base + 5] * w01 + lB[base + 6] * w11;
        cK[j] = lK[base] * w00 + lK[base + 1] * w10 + lK[base + 5] * w01 + lK[base + 6] * w11;
      }
      let top = GRASS, fill = DIRT;
      const fdepth = 3 + (hash2(wx, wz, seed ^ 0x33) & 1);
      const wet = b === BIOME.OCEAN || b === BIOME.RIVER || b === BIOME.BEACH || b === BIOME.DESERT || h <= SEA + 3;
      if (b === BIOME.OCEAN || b === BIOME.RIVER) {
        const p = this.nP.n2(wx * 0.06, wz * 0.06);
        top = fill = p > 0.55 ? B.gravel : (p < -0.62 && h >= SEA - 7) ? B.clay : SAND;
      } else if (b === BIOME.BEACH || b === BIOME.DESERT) { top = fill = SAND; }
      else if (b === BIOME.MOUNTAIN) {
        if (h >= 96) { top = B.snow_block; fill = STONE; }
        else if (h >= 82) { const p = rand2(wx, wz, seed ^ 0x41); top = p < 0.2 ? GRASS : p < 0.3 ? B.gravel : STONE; fill = STONE; }
      }
      for (let y = 0; y <= h; y++) {
        let id;
        if (y === 0) id = B.bedrock;
        else if (y <= 2 && rand3(wx, y, wz, seed) < (y === 1 ? 0.6 : 0.3)) id = B.bedrock;
        else {
          const depth = h - y;
          id = depth === 0 ? top : depth < fdepth ? fill : (b === BIOME.DESERT && depth < fdepth + 3) ? B.sandstone : STONE;
          if (y >= 2) {
            const j = y >> 2, fy = (y & 3) * 0.25;
            const a = cA[j] + (cA[j + 1] - cA[j]) * fy, bb = cB[j] + (cB[j + 1] - cB[j]) * fy, kk = cK[j] + (cK[j + 1] - cK[j]) * fy;
            if (this.carveTest(a, bb, kk, y, h, wet)) id = y <= 8 ? B.lava : 0;
          }
        }
        if (id) blocks[(y << 8) | col] = id;
      }
      if (h < SEA) {
        for (let y = h + 1; y <= SEA; y++) blocks[(y << 8) | col] = WATER;
        if (cold) blocks[(SEA << 8) | col] = B.ice;
      }
    }
    // 鉱石や土のかたまり
    const rng = mulberry32(hash2(cx, cz, seed ^ 0x0BE5));
    const vein = (id, count, size, y0, y1) => {
      for (let n = 0; n < count; n++) {
        let x = Math.floor(rng() * 16), z = Math.floor(rng() * 16), y = y0 + Math.floor(rng() * (y1 - y0));
        for (let s = 0; s < size; s++) {
          const i = (y << 8) | (z << 4) | x;
          if (blocks[i] === STONE) blocks[i] = id;
          const r = Math.floor(rng() * 6);
          if (r === 0) x = Math.min(15, x + 1); else if (r === 1) x = Math.max(0, x - 1);
          else if (r === 2) y = Math.min(126, y + 1); else if (r === 3) y = Math.max(1, y - 1);
          else if (r === 4) z = Math.min(15, z + 1); else z = Math.max(0, z - 1);
        }
      }
    };
    vein(DIRT, 3, 22, 20, 70); vein(B.gravel, 2, 16, 8, 60);
    vein(B.ore_coal, 12, 10, 6, 100); vein(B.ore_iron, 9, 7, 5, 60); vein(B.ore_gold, 3, 6, 4, 30);
    vein(B.ore_diamond, 2, 4, 2, 15); vein(B.ore_glow, 2, 5, 3, 26);

    // 木（となりのチャンクから枝葉がはみ出す分も含める）
    const treeSeed = seed ^ 0x7EE5;
    for (let gz = 1; gz < 23; gz++) for (let gx = 1; gx < 23; gx++) {
      const gi = gz * 24 + gx, b = gB[gi], h = gH[gi];
      const dens = TREE_DENS[b];
      if (!dens || h <= SEA || h > 108) continue;
      if (b === BIOME.MOUNTAIN && h >= 82) continue;
      const wx = x0 + gx - 4, wz = z0 + gz - 4;
      const r = hash2(wx, wz, treeSeed) / 4294967296;
      if (r >= dens) continue;
      let ok = true;
      for (let dz = -1; dz <= 1 && ok; dz++) for (let dx = -1; dx <= 1; dx++) {
        if ((dx || dz) && hash2(wx + dx, wz + dz, treeSeed) / 4294967296 < r) { ok = false; break; }
      }
      if (!ok) continue;
      if (this.caveAt(wx, h, wz, h, h <= SEA + 3)) continue;
      this.placeTree(blocks, x0, z0, wx, h + 1, wz, b);
    }

    // 草花・サボテンなど
    const pSeed = seed ^ 0x9A17;
    for (let z = 0; z < 16; z++) for (let x = 0; x < 16; x++) {
      const gi = (z + 4) * 24 + x + 4, h = gH[gi], b = gB[gi];
      if (h <= SEA || h >= 120) continue;
      const i = (h << 8) | (z << 4) | x, top = blocks[i];
      if (blocks[i + 256] !== 0) continue;
      const wx = x0 + x, wz = z0 + z;
      const r = hash2(wx, wz, pSeed) / 4294967296;
      const r2 = hash2(wx, wz, pSeed ^ 0x55) / 4294967296;
      let put = 0;
      if (top === GRASS) {
        const fl = 41 + Math.floor(r2 * 4);
        if (b === BIOME.PLAINS) put = r < 0.13 ? B.tallgrass : r < 0.142 ? fl : 0;
        else if (b === BIOME.FLOWER) {
          if (r < 0.1) put = B.tallgrass;
          else if (r < 0.3) { const p = this.nP.n2(wx * 0.045, wz * 0.045) * 0.5 + 0.5; put = r2 < 0.25 ? fl : 41 + clamp(Math.floor(p * 4), 0, 3); }
        }
        else if (b === BIOME.FOREST) put = r < 0.06 ? B.tallgrass : r < 0.068 ? fl : r < 0.074 ? B.mushroom_brown : r < 0.077 ? B.mushroom_red : 0;
        else if (b === BIOME.CHERRY) put = r < 0.07 ? B.tallgrass : r < 0.1 ? (r2 < 0.7 ? B.flower_white : B.flower_red) : 0;
        else if (b === BIOME.TAIGA) put = r < 0.03 ? B.tallgrass : r < 0.035 ? B.mushroom_brown : 0;
        else if (b === BIOME.SNOW) put = r < 0.01 ? B.tallgrass : 0;
        else if (b === BIOME.MOUNTAIN) put = r < 0.04 ? B.tallgrass : 0;
        if (put) blocks[i + 256] = put;
      } else if (top === SAND && b === BIOME.DESERT) {
        if (r < 0.008) blocks[i + 256] = B.deadbush;
        else if (r < 0.015 && x > 0 && x < 15 && z > 0 && z < 15) {
          const ch = 1 + Math.floor(r2 * 3);
          let ok = true;
          for (let k = 1; k <= ch && ok; k++) { const j = i + 256 * k; if (blocks[j] || blocks[j + 1] || blocks[j - 1] || blocks[j + 16] || blocks[j - 16]) ok = false; }
          if (ok) for (let k = 1; k <= ch; k++) blocks[i + 256 * k] = B.cactus;
        }
      }
    }
    // 洞窟のキノコ
    for (let n = 0; n < 5; n++) {
      const x = Math.floor(rng() * 16), z = Math.floor(rng() * 16), y = 8 + Math.floor(rng() * 38);
      const i = (y << 8) | (z << 4) | x;
      if (blocks[i] === 0 && blocks[i - 256] === STONE) blocks[i] = rng() < 0.6 ? B.mushroom_brown : B.mushroom_red;
    }

    // 建物（遺跡・地下の小部屋）
    const sr = mulberry32(hash2(cx, cz, seed ^ 0x51ED));
    const roll = sr();
    if (roll < 0.022) this.buildRuin(blocks, meta, ents, sr);
    else if (roll < 0.057) this.buildRoom(blocks, meta, ents, sr);

    // 高さの上限を調べてから雪を積もらせる
    let maxY = Math.min(126, hmax + 14);
    for (; maxY > 0; maxY--) {
      let any = false; const base = maxY << 8;
      for (let i = 0; i < 256; i++) if (blocks[base + i]) { any = true; break; }
      if (any) break;
    }
    for (let z = 0; z < 16; z++) for (let x = 0; x < 16; x++) {
      const gi = (z + 4) * 24 + x + 4;
      if (!(gCold[gi] || (gB[gi] === BIOME.MOUNTAIN && gH[gi] >= 90))) continue;
      const col = (z << 4) | x;
      for (let y = maxY; y > SEA; y--) {
        const id = blocks[(y << 8) | col];
        if (!id) continue;
        if ((OPAQUE[id] || ISLEAF[id]) && y < 126 && blocks[((y + 1) << 8) | col] === 0) blocks[((y + 1) << 8) | col] = B.snow_layer;
        break;
      }
    }
    if (maxY < 126) maxY++;
    return { blocks, meta, biome, maxY, ents };
  }

  placeTree(blocks, x0, z0, wx, y, wz, b) {
    const rng = mulberry32(hash2(wx, wz, this.seed ^ 0xBEEF));
    let type = 0;
    if (b === BIOME.FOREST) type = rng() < 0.25 ? 1 : 0;
    else if (b === BIOME.TAIGA || b === BIOME.SNOW || b === BIOME.MOUNTAIN) type = 2;
    else if (b === BIOME.CHERRY) type = 3;
    genTreeShape(type, rng, (dx, dy, dz, id) => {
      const lx = wx + dx - x0, lz = wz + dz - z0, yy = y + dy;
      if (lx < 0 || lx > 15 || lz < 0 || lz > 15 || yy < 1 || yy > 126) return;
      const i = (yy << 8) | (lz << 4) | lx, cur = blocks[i];
      if (ISLOG[id]) { if (cur === 0 || ISLEAF[cur] || SHAPE[cur] === S_CROSS || cur === B.snow_layer) blocks[i] = id; }
      else if (cur === 0) blocks[i] = id;
    });
  }

  buildRuin(blocks, meta, ents, sr) {
    const gH = this.gH, gB = this.gB;
    const ox = 3 + Math.floor(sr() * 4), oz = 3 + Math.floor(sr() * 4);
    let lo = 999, hi = 0;
    for (let dz = 0; dz < 7; dz++) for (let dx = 0; dx < 7; dx++) {
      const gi = (oz + dz + 4) * 24 + ox + dx + 4, b = gB[gi], h = gH[gi];
      if (b === BIOME.OCEAN || b === BIOME.RIVER || b === BIOME.BEACH || b === BIOME.MOUNTAIN) return;
      if (h < lo) lo = h; if (h > hi) hi = h;
    }
    if (hi - lo > 3 || lo <= SEA + 1 || hi > 100) return;
    const pick = () => { const r = sr(); return r < 0.55 ? B.stone_bricks : r < 0.8 ? B.cracked_bricks : B.mossy_cobble; };
    for (let dz = 0; dz < 7; dz++) for (let dx = 0; dx < 7; dx++) {
      const col = ((oz + dz) << 4) | (ox + dx);
      blocks[(lo << 8) | col] = pick();
      for (let y = lo + 1; y <= lo + 7; y++) blocks[(y << 8) | col] = 0;
      const edge = dx === 0 || dx === 6 || dz === 0 || dz === 6;
      if (!edge) continue;
      const corner = (dx === 0 || dx === 6) && (dz === 0 || dz === 6);
      let wh = corner ? 3 + Math.floor(sr() * 2) : Math.floor(sr() * 4);
      if (dz === 0 && dx === 3) wh = 0;
      for (let k = 1; k <= wh; k++) blocks[((lo + k) << 8) | col] = pick();
    }
    const ci = ((lo + 1) << 8) | ((oz + 5) << 4) | (ox + 1 + Math.floor(sr() * 5));
    blocks[ci] = B.chest; meta[ci] = 2;
    ents.push({ i: ci, t: 'chest', g: 1, items: rollLoot(sr, lootRuin(), 4, 7) });
  }

  buildRoom(blocks, meta, ents, sr) {
    const y0 = 14 + Math.floor(sr() * 22);
    if (this.gH[12 * 24 + 12] < y0 + 12) return;
    for (let dy = 0; dy <= 5; dy++) for (let z = 4; z <= 12; z++) for (let x = 4; x <= 12; x++) {
      const shell = dy === 0 || dy === 5 || x === 4 || x === 12 || z === 4 || z === 12;
      blocks[((y0 + dy) << 8) | (z << 4) | x] = shell ? (sr() < 0.55 ? B.cobble : B.mossy_cobble) : 0;
    }
    blocks[((y0 + 5) << 8) | (8 << 4) | 8] = B.ore_glow;
    blocks[((y0 + 5) << 8) | (6 << 4) | 10] = B.ore_glow;
    blocks[((y0 + 5) << 8) | (10 << 4) | 6] = B.ore_glow;
    const ci = ((y0 + 1) << 8) | (11 << 4) | 8;
    blocks[ci] = B.chest; meta[ci] = 2;
    ents.push({ i: ci, t: 'chest', g: 1, items: rollLoot(sr, lootRoom(), 5, 8) });
  }
}

// 木の形。put(dx, dy, dz, ブロック番号) を呼ぶ。苗木の成長でも使う
function genTreeShape(type, rng, put) {
  if (type >= 4) { genFeature(type, rng, put); return; }   // 版2で増えた木（03b_gen2.js）
  const LOG = [11, 13, 15, 17][type], LEAF = [12, 14, 16, 18][type];
  if (type === 0 || type === 1) {
    const H = (type === 0 ? 4 : 5) + Math.floor(rng() * 3);
    const rx = type === 0 ? 2.7 : 2.2, ry = type === 0 ? 2.3 : 2.6, cy = H - (type === 0 ? 0.3 : 0);
    for (let dy = Math.floor(cy - ry); dy <= Math.ceil(cy + ry); dy++) for (let dz = -3; dz <= 3; dz++) for (let dx = -3; dx <= 3; dx++) {
      const v = (dx * dx + dz * dz) / (rx * rx) + (dy - cy) * (dy - cy) / (ry * ry);
      if (v < 1 - rng() * 0.3) put(dx, dy, dz, LEAF);
    }
    for (let dy = 0; dy < H; dy++) put(0, dy, 0, LOG);
  } else if (type === 2) {
    const H = 6 + Math.floor(rng() * 4);
    const radii = [1, 2, 1, 2, 3, 2, 3, 2, 3, 2];
    put(0, H, 0, LEAF); put(0, H + 1, 0, LEAF);
    for (let dy = H - 1; dy >= 2; dy--) {
      const rad = radii[Math.min(radii.length - 1, H - 1 - dy)];
      for (let dz = -rad; dz <= rad; dz++) for (let dx = -rad; dx <= rad; dx++) {
        if (dx * dx + dz * dz > rad * rad + 1) continue;
        if (Math.abs(dx) === rad && Math.abs(dz) === rad) continue;
        put(dx, dy, dz, LEAF);
      }
    }
    for (let dy = 0; dy < H; dy++) put(0, dy, 0, LOG);
  } else {
    const H = 4 + Math.floor(rng() * 2);
    const rx = 3.5, ry = 1.75, cy = H + 0.2;
    const y0 = Math.floor(cy - ry), y1 = Math.ceil(cy + ry);
    for (let dy = y0; dy <= y1; dy++) for (let dz = -4; dz <= 4; dz++) for (let dx = -4; dx <= 4; dx++) {
      const v = (dx * dx + dz * dz) / (rx * rx) + (dy - cy) * (dy - cy) / (ry * ry);
      const hit = v < 1 - rng() * 0.25;
      if (hit) put(dx, dy, dz, LEAF);
      if (dy === y0 + 1 && hit && dx * dx + dz * dz > 5) {
        const r = rng();
        if (r < 0.3) { put(dx, dy - 1, dz, LEAF); if (r < 0.12) put(dx, dy - 2, dz, LEAF); }
      }
    }
    for (let dy = 0; dy < H; dy++) put(0, dy, 0, LOG);
    const side = Math.floor(rng() * 4);
    put(F4[side][0], H - 1, F4[side][1], LOG);
  }
}

