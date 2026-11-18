// ===== 03c_dims.js : べつの世界の地形（作業スレッドと共用） =====
// dim 0＝もとの世界、1＝ホムラの底（溶岩の海と洞くつの世界）、2＝ソラのはて（空に浮かぶ島）
// ※ここの地形も「出した版は変えない」。変えるときは新しいクラスを作って GENS に足す（dimGenClass で選ぶ）
const DIM_NAMES = ['もとの世界', 'ホムラの底', 'ソラのはて'];
const H_LAVA = 31;          // ホムラの底：溶岩の海の高さ
const HOMURA_SCALE = 8;     // もとの世界の8ブロック＝ホムラの底の1ブロック
const FORT_CELL = 176;      // とりでを置くますの大きさ
const FORT_Y = 64;

function lootFort() {
  return [[I.gold_ingot, 2, 6, 10], [I.iron_ingot, 2, 6, 8], [I.diamond, 1, 3, 5], [I.quartz, 3, 9, 8], [I.glow_dust, 3, 8, 6], [B.obsidian, 2, 4, 6],
    [I.golden_apple, 1, 1, 3], [I.flint_steel, 1, 1, 4], [I.homura_rod, 1, 2, 7], [I.diamond_sword, 1, 1, 1], [I.iron_chest, 1, 1, 2], [I.steak, 2, 5, 6], [I.shadow_shard, 1, 3, 4]];
}
// そのますにある とりで（なければ null）。まんなかの広場と、4方向にのびる橋
function fortInfo(seed, fx, fz) {
  const h = hash2(fx, fz, seed ^ 0xF027A), home = fx === 0 && fz === 0;
  if (!home && (h & 7) >= 6) return null;
  const x = fx * FORT_CELL + (home ? 44 + ((h >>> 3) % 24) : 44 + ((h >>> 3) % 88)), z = fz * FORT_CELL + (home ? 44 + ((h >>> 11) % 24) : 44 + ((h >>> 11) % 88));
  const arms = []; for (let d = 0; d < 4; d++) arms.push(24 + ((h >>> (17 + d * 3)) & 7) * 4);   // 橋の長さ 24〜52
  return { x, z, y: FORT_Y, arms };
}
// いちばん近い とりで（道しるべ用）
function nearestFort(seed, x, z) {
  const fx = Math.floor(x / FORT_CELL), fz = Math.floor(z / FORT_CELL); let best = null, bd = 1e18;
  for (let dz = -2; dz <= 2; dz++) for (let dx = -2; dx <= 2; dx++) { const f = fortInfo(seed, fx + dx, fz + dz); if (!f) continue; const d = (f.x - x) * (f.x - x) + (f.z - z) * (f.z - z); if (d < bd) { bd = d; best = f; } }
  return best;
}

class HomuraGen {
  constructor(seed) {
    seed |= 0; this.seed = seed; this.dim = 1;
    this.nA = new Simplex(seed ^ 0x51A7E1); this.nB = new Simplex(seed ^ 0x62B8F2); this.nC = new Simplex(seed ^ 0x73C903); this.nT = new Simplex(seed ^ 0x84DA14);
    this.colH = 40; this.colB = BIOME.HOMURA; this.colCold = false;
    this.lat = new Float32Array(7 * 7 * 33);
    this.cd = new Float32Array(130);
  }
  biome(x, z) {
    const t = fbm2(this.nT, x * 0.006, z * 0.006, 2), u = this.nC.n2(x * 0.004 + 40, z * 0.004 - 17);
    return t > 0.2 ? BIOME.AOBI : (t < -0.16 && u > -0.35) ? BIOME.NAGEKI : BIOME.HOMURA;
  }
  column(x, z) { this.colB = this.biome(x, z); this.colH = 40; this.colCold = false; return 40; }
  // 岩のつまり具合（0 より大きければ岩）。4マスおきの点で計算して、あいだは なめらかにつなぐ
  dens(x, y, z) {
    let d = this.nA.n3(x * 0.018, y * 0.026, z * 0.018) + this.nB.n3(x * 0.045, y * 0.06, z * 0.045) * 0.45 - 0.1;
    if (y < 28) { const f = (28 - y) / 24; d += f * f * 2.6; }
    if (y > 94) { const c = (y - 94) / 26; d += c * c * 2.8; }
    return d;
  }
  // チャンクの中の座標（-4〜19）の たて1列ぶんを this.cd に入れる
  colDens(lx, lz) {
    const L = this.lat, cd = this.cd, gx = (lx + 4) >> 2, gz = (lz + 4) >> 2, fx = ((lx + 4) & 3) / 4, fz = ((lz + 4) & 3) / 4;
    const w00 = (1 - fx) * (1 - fz), w10 = fx * (1 - fz), w01 = (1 - fx) * fz, w11 = fx * fz;
    let a = 0, b = 0;
    for (let j = 0; j <= 32; j++) {
      const o = (j * 7 + gz) * 7 + gx;
      b = L[o] * w00 + L[o + 1] * w10 + L[o + 7] * w01 + L[o + 8] * w11;
      if (j > 0) { const y0 = (j - 1) * 4; cd[y0] = a; cd[y0 + 1] = a * 0.75 + b * 0.25; cd[y0 + 2] = (a + b) * 0.5; cd[y0 + 3] = a * 0.25 + b * 0.75; }
      a = b;
    }
    return cd;
  }
  genChunk(cx, cz) {
    const blocks = new Uint16Array(CVOL), meta = new Uint8Array(CVOL), biome = new Uint8Array(256), ents = [];
    const x0 = cx * 16, z0 = cz * 16, seed = this.seed, L = this.lat;
    const YAKE = B.yakeishi, LAVA = B.lava, BED = B.bedrock;
    for (let j = 0; j <= 32; j++) for (let k = 0; k < 7; k++) for (let i = 0; i < 7; i++) L[(j * 7 + k) * 7 + i] = this.dens(x0 + (i - 1) * 4, j * 4, z0 + (k - 1) * 4);
    // 岩・溶岩の海・岩盤
    for (let z = 0; z < 16; z++) for (let x = 0; x < 16; x++) {
      const wx = x0 + x, wz = z0 + z, col = (z << 4) | x, cd = this.colDens(x, z), bio = this.biome(wx, wz);
      biome[col] = bio;
      for (let y = 0; y < CH; y++) {
        let id = 0;
        if (y === 0 || y === CH - 1) id = BED;
        else if (y < 4) id = (hash3(wx, y, wz, seed) & 3) >= y ? BED : YAKE;
        else if (y > CH - 5) id = (hash3(wx, y, wz, seed) & 3) >= (CH - 1 - y) ? BED : YAKE;
        else if (cd[y] > 0) {
          id = YAKE;
          if (rand3(wx >> 1, y >> 1, wz >> 1, seed ^ 0x0E0E) < 0.016 && (hash3(wx, y, wz, seed ^ 0x77) & 3) !== 0) id = B.ore_quartz;
        } else if (y <= H_LAVA) id = LAVA;
        blocks[(y << 8) | col] = id;
      }
      // 地面と天井の かざり
      const hh = hash2(wx, wz, seed ^ 0xC0FFE);
      for (let y = CH - 6; y > 4; y--) {
        const i = (y << 8) | col, id = blocks[i];
        if (id !== YAKE) continue;
        const up = blocks[i + 256];
        if (up !== 0) continue;
        if (bio === BIOME.AOBI) {
          blocks[i] = B.aobi_soil;
          if ((hash3(wx, y, wz, seed ^ 0xA0B1) % 100) < 11) blocks[i + 256] = B.aobi_sprout;
        } else if (bio === BIOME.NAGEKI) {
          blocks[i] = B.nageki_sand; if (blocks[i - 256] === YAKE) blocks[i - 256] = B.nageki_sand;
          if ((hh % 100) < 5) { const n = 2 + ((hh >>> 8) % 8); for (let k = 1; k <= n && y + k < CH - 6 && blocks[i + k * 256] === 0; k++) blocks[i + k * 256] = B.kurohashira; }   // 黒い柱
          else if ((hh % 100) < 9 && blocks[i - 256] === B.nageki_sand) blocks[i] = B.kurohashira;
        } else {
          if (y <= H_LAVA + 2 && (hash3(wx, y, wz, seed ^ 0x3A6) & 3) < 2) blocks[i] = B.magma;        // 溶岩のきわ
          else if (this.nC.n2(wx * 0.07, wz * 0.07) > 0.62) blocks[i] = B.gravel;
        }
      }
    }
    const put = (lx, y, lz, id, soft) => {
      if (lx < 0 || lx > 15 || lz < 0 || lz > 15 || y < 1 || y > CH - 2) return;
      const i = (y << 8) | (lz << 4) | lx; if (soft && blocks[i] !== 0) return;
      blocks[i] = id; meta[i] = 0;
    };
    // アオビの木と、天井からさがる ひかり石（となりのチャンクにまたがるので、外がわ3マスの分も見る）
    for (let lz = -3; lz < 19; lz++) for (let lx = -3; lx < 19; lx++) {
      const wx = x0 + lx, wz = z0 + lz, h = hash2(wx, wz, seed ^ 0xF00D);
      const tree = (h & 1023) < 20 && this.biome(wx, wz) === BIOME.AOBI, glow = ((h >>> 12) & 1023) < 13;
      if (!tree && !glow) continue;
      const cd = this.colDens(lx, lz);
      if (tree) {
        let made = 0;
        for (let y = 104; y > H_LAVA + 1 && made < 2; y--) {
          if (!(cd[y] > 0 && cd[y + 1] <= 0)) continue;
          let room = 0; while (room < 12 && cd[y + 1 + room] <= 0) room++;
          if (room < 7) continue;
          const H = Math.min(room - 3, 4 + ((h >>> 22) % 5)), ty = y + H;
          for (let k = 1; k <= H; k++) put(lx, y + k, lz, B.aobi_stem);
          for (let dz = -2; dz <= 2; dz++) for (let dx = -2; dx <= 2; dx++) {
            const edge = Math.abs(dx) === 2 || Math.abs(dz) === 2, corner = Math.abs(dx) === 2 && Math.abs(dz) === 2, hv = hash3(wx + dx, ty, wz + dz, seed ^ 0xCA9);
            if (corner) continue;
            put(lx + dx, ty, lz + dz, (hv % 9) === 0 ? B.aobi_lamp : B.aobi_cap, true);
            if (!edge) put(lx + dx, ty + 1, lz + dz, B.aobi_cap, true);
            else if ((hv >>> 8) % 5 < 2) put(lx + dx, ty - 1, lz + dz, ((hv >>> 12) % 5) === 0 ? B.aobi_lamp : B.aobi_cap, true);   // ふちから たれる
          }
          put(lx, ty, lz, B.aobi_stem); made++; y -= 12;
        }
      }
      if (glow) {
        for (let y = 112; y > 44; y--) {
          if (!(cd[y] > 0 && cd[y - 1] <= 0 && cd[y - 3] <= 0 && cd[y - 5] <= 0)) continue;
          for (let dy = 1; dy <= 4; dy++) for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) {
            const hv = hash3(wx + dx, y - dy, wz + dz, seed ^ 0x610) % 10, far = Math.abs(dx) + Math.abs(dz);
            if (hv < 9 - dy * 2 - far * 2) put(lx + dx, y - dy, lz + dz, B.glow_block, true);
          }
          break;
        }
      }
    }
    // とりで
    const fx0 = Math.floor((x0 - 64) / FORT_CELL), fx1 = Math.floor((x0 + 80) / FORT_CELL), fz0 = Math.floor((z0 - 64) / FORT_CELL), fz1 = Math.floor((z0 + 80) / FORT_CELL);
    for (let fz = fz0; fz <= fz1; fz++) for (let fx = fx0; fx <= fx1; fx++) {
      const f = fortInfo(seed, fx, fz);
      if (f && f.x + 62 >= x0 && f.x - 62 <= x0 + 15 && f.z + 62 >= z0 && f.z - 62 <= z0 + 15) this.buildFort(blocks, meta, ents, x0, z0, f);
    }
    let maxY = CH - 1;
    return { blocks, meta, biome, maxY, ents };
  }
  buildFort(blocks, meta, ents, x0, z0, f) {
    const BR = B.yake_bricks, Y = f.y, seed = this.seed;
    const set = (wx, y, wz, id, m) => { const lx = wx - x0, lz = wz - z0; if (lx < 0 || lx > 15 || lz < 0 || lz > 15) return; const i = (y << 8) | (lz << 4) | lx; blocks[i] = id; meta[i] = m || 0; };
    const get = (wx, y, wz) => { const lx = wx - x0, lz = wz - z0; if (lx < 0 || lx > 15 || lz < 0 || lz > 15) return -1; return blocks[(y << 8) | (lz << 4) | lx]; };
    const leg = (wx, wz) => { for (let y = Y - 1; y > 3; y--) { const id = get(wx, y, wz); if (id < 0) return; if (id === B.yakeishi || id === B.bedrock || id === B.nageki_sand || id === B.aobi_soil) { if (get(wx, y - 1, wz) !== 0 && get(wx, y - 2, wz) !== 0) return; } set(wx, y, wz, BR); } };
    // 橋（幅5。まんなか3マスが通路、両がわに低いへい）
    for (let d = 0; d < 4; d++) {
      const dx = F4[d][0], dz = F4[d][1], px = -dz, pz = dx, len = f.arms[d];
      for (let t = 7; t <= len; t++) {
        for (let s = -2; s <= 2; s++) {
          const wx = f.x + dx * t + px * s, wz = f.z + dz * t + pz * s;
          set(wx, Y, wz, BR);
          for (let y = Y + 1; y <= Y + 5; y++) set(wx, y, wz, 0);
          if (s === -2 || s === 2) set(wx, Y + 1, wz, (t % 4) === 3 ? BR : B.fence_yake);
          if ((t % 12) === 3 && Math.abs(s) <= 1) leg(wx, wz);
        }
        if ((t % 12) === 3) for (const s of [-2, 2]) set(f.x + dx * t + px * s, Y + 2, f.z + dz * t + pz * s, B.glow_block);   // 柱の上の明かり
      }
      // 橋のはしの小部屋（宝箱つき）
      const ex = f.x + dx * (len + 4), ez = f.z + dz * (len + 4);
      for (let a = -3; a <= 3; a++) for (let b = -3; b <= 3; b++) {
        const wx = ex + a, wz = ez + b, edge = Math.abs(a) === 3 || Math.abs(b) === 3;
        set(wx, Y, wz, BR); set(wx, Y + 6, wz, BR);
        for (let y = Y + 1; y <= Y + 5; y++) {
          let id = edge ? BR : 0;
          const along = a * dx + b * dz, side = a * px + b * pz;
          if (edge && along === -3 && Math.abs(side) <= 1 && y <= Y + 3) id = 0;                                   // 入口
          else if (edge && y === Y + 3 && (Math.abs(a) === 3) !== (Math.abs(b) === 3) && ((a + b) & 1) === 0) id = B.fence_yake;   // まど
          set(wx, y, wz, id);
        }
        if (Math.abs(a) === 3 && Math.abs(b) === 3) leg(wx, wz);
      }
      set(ex, Y + 6, ez, B.glow_block);
      const cxp = ex + dx * 2, czp = ez + dz * 2, lx = cxp - x0, lz = czp - z0;
      if (lx >= 0 && lx <= 15 && lz >= 0 && lz <= 15) {
        const ci = ((Y + 1) << 8) | (lz << 4) | lx;
        blocks[ci] = B.chest; meta[ci] = (d + 2) & 3;
        ents.push({ i: ci, t: 'chest', g: 1, items: rollLoot(mulberry32(hash2(cxp, czp, seed ^ 0x10075)), lootFort(), 4, 7) });
      }
    }
    // まんなかの広場（13×13。かどに塔、橋の向きに出入口）
    for (let a = -6; a <= 6; a++) for (let b = -6; b <= 6; b++) {
      const wx = f.x + a, wz = f.z + b, edge = Math.abs(a) === 6 || Math.abs(b) === 6, tower = Math.abs(a) >= 5 && Math.abs(b) >= 5;
      set(wx, Y, wz, BR); set(wx, Y - 1, wz, BR);
      for (let y = Y + 1; y <= Y + 8; y++) {
        let id = 0;
        if (tower) id = y <= Y + 7 ? BR : (Math.abs(a) === 6 || Math.abs(b) === 6 ? B.fence_yake : B.glow_block);
        else if (edge) { const gate = Math.abs(a) <= 1 || Math.abs(b) <= 1; id = gate ? (y >= Y + 5 && y <= Y + 5 ? BR : 0) : y <= Y + 2 ? BR : y === Y + 3 ? B.fence_yake : 0; }
        set(wx, y, wz, id);
      }
      if (tower && Math.abs(a) === 6 && Math.abs(b) === 6) leg(wx, wz);
      if ((Math.abs(a) === 6 || Math.abs(b) === 6) && (a === 0 || b === 0)) leg(wx, wz);
    }
    for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) set(f.x + a, Y + 1, f.z + b, (a || b) ? BR : B.magma);   // まんなかの台（火のしるし）
    set(f.x, Y + 2, f.z, B.glow_block);
  }
}

// ---- ソラのはて ----
const SORA_PED_Y = 60;                 // まんなかの台（かえりの門ができる所）の床の高さ
const SORA_ARRIVE = [50, 0];           // 入ったときに出る場所（x, z）
function soraPillars() {
  const out = [];
  for (let i = 0; i < 8; i++) { const a = i * Math.PI / 4 + Math.PI / 8; out.push({ x: Math.round(Math.cos(a) * 38), z: Math.round(Math.sin(a) * 38), r: 2 + (i & 1), top: 70 + Math.round(((i * 5) % 8) * 2.5) }); }
  return out;
}
class SoraGen {
  constructor(seed) {
    seed |= 0; this.seed = seed; this.dim = 2;
    this.nA = new Simplex(seed ^ 0x50AA11); this.nB = new Simplex(seed ^ 0x61BB22);
    this.colH = 0; this.colB = BIOME.SORA; this.colCold = false; this.top = -1; this.bot = 0;
    this.pil = soraPillars();
  }
  // 島の上の面と下の面（島がなければ top < 0）
  shape(x, z) {
    const r = Math.hypot(x, z); let top = -1, bot = 0;
    if (r < 100) {
      const R = 70 + this.nA.n2(x * 0.03, z * 0.03) * 7, t = 1 - (r / R) * (r / R);
      if (t > 0) {
        const flat = smoothstep(14, 6, r);
        top = Math.round(lerp(56 + this.nB.n2(x * 0.045, z * 0.045) * 2.5 + t * 3, SORA_PED_Y - 1, flat));
        bot = top - Math.max(1, Math.round(Math.sqrt(t) * 30 * (0.75 + 0.25 * this.nA.n2(x * 0.09 + 9, z * 0.09))));
      }
    } else if (r > 210) {
      const n = fbm2(this.nA, x * 0.011, z * 0.011, 3), t = (n - 0.3) * smoothstep(210, 270, r);
      if (t > 0) { top = Math.round(52 + this.nB.n2(x * 0.02, z * 0.02) * 10 + t * 14); bot = top - Math.max(1, Math.round(t * 75)); }
    }
    this.top = top; this.bot = bot; return top;
  }
  column(x, z) { const t = this.shape(x, z); this.colH = t < 0 ? 0 : t; this.colB = BIOME.SORA; this.colCold = false; return this.colH; }
  genChunk(cx, cz) {
    const blocks = new Uint16Array(CVOL), meta = new Uint8Array(CVOL), biome = new Uint8Array(256).fill(BIOME.SORA), ents = [];
    const x0 = cx * 16, z0 = cz * 16, ST = B.soraishi;
    let maxY = 1;
    for (let z = 0; z < 16; z++) for (let x = 0; x < 16; x++) {
      const wx = x0 + x, wz = z0 + z, col = (z << 4) | x, top = this.shape(wx, wz), bot = this.bot;
      if (top >= 0) { for (let y = Math.max(1, bot); y <= top; y++) blocks[(y << 8) | col] = ST; if (top > maxY) maxY = top; }
      const d2 = wx * wx + wz * wz;
      if (d2 < 2500) {
        // 柱（黒曜石）と てっぺんの結晶
        for (const p of this.pil) {
          const dx = wx - p.x, dz = wz - p.z;
          if (dx * dx + dz * dz > (p.r + 0.5) * (p.r + 0.5)) continue;
          for (let y = Math.max(1, top < 0 ? 40 : top - 3); y <= p.top; y++) blocks[(y << 8) | col] = B.obsidian;
          if (!dx && !dz) { blocks[((p.top + 1) << 8) | col] = B.bedrock; blocks[((p.top + 2) << 8) | col] = B.hoshi_crystal; }
          if (p.top + 2 > maxY) maxY = p.top + 2;
        }
        // まんなかの台（岩盤）。ボスをたおすと、ここに かえりの門ができる
        if (d2 <= 12.25) {
          blocks[(SORA_PED_Y << 8) | col] = B.bedrock;
          if (d2 > 6.25) blocks[((SORA_PED_Y + 1) << 8) | col] = B.bedrock;
          if (d2 === 0) for (let y = SORA_PED_Y + 1; y <= SORA_PED_Y + 4; y++) blocks[(y << 8) | col] = B.bedrock;
          if (SORA_PED_Y + 4 > maxY) maxY = SORA_PED_Y + 4;
        }
      }
    }
    if (maxY < CH - 2) maxY++;
    return { blocks, meta, biome, maxY, ents };
  }
}
// かえりの門ができるマス（まんなかの台の中。まんなかの柱はのぞく）
function soraGateCells() { const out = []; for (let dz = -2; dz <= 2; dz++) for (let dx = -2; dx <= 2; dx++) if ((dx || dz) && dx * dx + dz * dz <= 6.25) out.push([dx, dz]); return out; }

GENS.h2 = HomuraGen; GENS.s2 = SoraGen;
// 世界（dim）と版から、地形づくりのクラスを選ぶ
function dimGenClass(gv, dim) { return dim === 1 ? GENS.h2 : dim === 2 ? GENS.s2 : (GENS[gv] || GENS[1]); }
