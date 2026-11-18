// ===== 03b_gen2.js : 地形づくり 版2（作業スレッドと共用） =====
// 版1とのちがい
//  ・バイオームを「気温」と「しめり気」の表（CLIMATE）から決める。種類を増やし、かたよりをなくした
//  ・起伏や湿地・台地の形は、気候の近さでなめらかに混ぜる（バイオームの境目に段差を作らない）
//  ・陸と海・山・川・洞窟の大もとの式は版1と同じ（版がちがう場所どうしでも地面がつながるように。これからの版でも変えない）

// 2オクターブのノイズの値を、0〜1 にほぼ均等にちらばる数に直す（こうすると表の広さ＝世界での割合になる）
const QT2 = [-0.966, -0.5066, -0.4002, -0.3188, -0.2486, -0.1843, -0.1224, -0.0612, 0, 0.0612, 0.1224, 0.1843, 0.2486, 0.3188, 0.4002, 0.5066, 0.966];
function uni2(v) {
  if (v <= QT2[0]) return 0;
  if (v >= QT2[16]) return 1;
  let i = v < 0 ? 0 : 8;
  while (QT2[i + 1] < v) i++;
  return (i + (v - QT2[i]) / (QT2[i + 1] - QT2[i])) / 16;
}

// 気候の表。t 気温（0 寒い〜1 暑い）、h しめり気（0 かわいた〜1 しめった）、b バイオーム、a 起伏の倍率、c 雪がつもる、
// f その気候の中に まだらに出る特別な地形（1 暗い森の中の湿地／2 砂漠の中の荒野／3 雪原の中の氷のとげ）
// どのますも 気温・しめり気の両方に 0.25 以上の幅を持たせる（細い帯のようなバイオームを作らないため）
const CLIMATE = [
  { t: 0.06, h: 0.25, b: BIOME.SNOW, a: 0.55, c: 1, f: 3 },
  { t: 0.06, h: 0.75, b: BIOME.SNOW_TAIGA, a: 0.9, c: 1 },
  { t: 0.29, h: 0.15, b: BIOME.PLAINS, a: 0.6 },
  { t: 0.29, h: 0.49, b: BIOME.TAIGA, a: 1.0 },
  { t: 0.29, h: 0.84, b: BIOME.OLD_TAIGA, a: 1.1 },
  { t: 0.56, h: 0.15, b: BIOME.PLAINS, a: 0.55 },
  { t: 0.56, h: 0.49, b: BIOME.FOREST, a: 1.0 },
  { t: 0.56, h: 0.84, b: BIOME.DARK, a: 0.9, f: 1 },
  { t: 0.85, h: 0.165, b: BIOME.DESERT, a: 0.7, f: 2 },
  { t: 0.85, h: 0.5, b: BIOME.SAVANNA, a: 0.8 },
  { t: 0.85, h: 0.835, b: BIOME.JUNGLE, a: 1.15 }
];
const CL_N = CLIMATE.length, CL_T = new Float64Array(CL_N), CL_H = new Float64Array(CL_N), CL_A = new Float64Array(CL_N), CL_B = new Uint8Array(CL_N), CL_F = new Uint8Array(CL_N), CL_C = new Uint8Array(CL_N);
CLIMATE.forEach((q, i) => { CL_T[i] = q.t; CL_H[i] = q.h; CL_A[i] = q.a; CL_B[i] = q.b; CL_F[i] = q.f || 0; CL_C[i] = q.c || 0; });
const G2 = { ft: 0.0005, fh: 0.00075, fv: 0.002, fs: 0.0032, vth: 0.3 };   // 気温・しめり気・まだらの ゆれの細かさ、まだらになる しきい値

// 木など（地面から生えるもの）の種類。0〜6 は苗木から育つ木（_woods の順）
const TK = { OAK: 0, BIRCH: 1, SPRUCE: 2, CHERRY: 3, MAHOG: 4, ACACIA: 5, WALNUT_S: 6, BIGOAK: 7, GSPRUCE: 8, GMAHOG: 9, SWAMPOAK: 10, BUSH: 11, TBIRCH: 12, PINE: 13, MUSH_B: 14, MUSH_R: 15, WALNUT: 16, SPIKE: 17, BOULDER: 18, BERG: 19 };
// バイオームごとの「生えるもの」。d 1マスあたりの数（めやす）、n 1 なら こみぐあいに むらをつける、k [種類, 重み, …]
const FEAT = [];
FEAT[BIOME.PLAINS] = { d: 0.0022, k: [TK.OAK, 70, TK.BIGOAK, 20, TK.BIRCH, 10] };
FEAT[BIOME.FLOWER] = { d: 0.002, k: [TK.OAK, 50, TK.BIRCH, 50] };
FEAT[BIOME.FOREST] = { d: 0.07, n: 1, k: [TK.OAK, 62, TK.BIRCH, 28, TK.BIGOAK, 10] };
FEAT[BIOME.BIRCH] = { d: 0.065, n: 1, k: [TK.BIRCH, 70, TK.TBIRCH, 30] };
FEAT[BIOME.CHERRY] = { d: 0.045, n: 1, k: [TK.CHERRY, 100] };
FEAT[BIOME.DARK] = { d: 0.1, n: 1, k: [TK.WALNUT, 80, TK.MUSH_B, 6, TK.MUSH_R, 5, TK.OAK, 6, TK.BIGOAK, 3] };
FEAT[BIOME.JUNGLE] = { d: 0.11, n: 1, k: [TK.MAHOG, 45, TK.GMAHOG, 9, TK.BUSH, 40, TK.OAK, 6] };
FEAT[BIOME.SAVANNA] = { d: 0.011, k: [TK.ACACIA, 88, TK.OAK, 12] };
FEAT[BIOME.SWAMP] = { d: 0.035, n: 1, k: [TK.SWAMPOAK, 100] };
FEAT[BIOME.TAIGA] = { d: 0.065, n: 1, k: [TK.SPRUCE, 70, TK.PINE, 30] };
FEAT[BIOME.SNOW_TAIGA] = { d: 0.055, n: 1, k: [TK.SPRUCE, 80, TK.PINE, 20] };
FEAT[BIOME.OLD_TAIGA] = { d: 0.075, n: 1, k: [TK.GSPRUCE, 30, TK.SPRUCE, 40, TK.PINE, 22, TK.BOULDER, 8] };
FEAT[BIOME.SNOW] = { d: 0.0035, k: [TK.SPRUCE, 100] };
FEAT[BIOME.ICE] = { d: 0.012, k: [TK.SPIKE, 100] };
FEAT[BIOME.MOUNTAIN] = { d: 0.014, k: [TK.SPRUCE, 60, TK.PINE, 40] };
FEAT[BIOME.MEADOW] = { d: 0.0025, k: [TK.SPRUCE, 40, TK.OAK, 30, TK.BIRCH, 30] };
FEAT[BIOME.BADLANDS] = { d: 0.03, k: [TK.OAK, 100] };
FEAT[BIOME.MUSHROOM] = { d: 0.011, k: [TK.MUSH_B, 50, TK.MUSH_R, 50] };
FEAT[BIOME.FROZEN] = { d: 0.0012, k: [TK.BERG, 100] };
let FEAT_MAX = 0;
for (const f of FEAT) if (f) { f.tot = 0; for (let i = 1; i < f.k.length; i += 2) f.tot += f.k[i]; FEAT_MAX = Math.max(FEAT_MAX, f.d * (f.n ? 1.7 : 1)); }
// 生えるものが置きかえてよいブロック。F_HARD＝幹や氷など（葉や草をおしのける）
const F_HARD = new Uint8Array(256), F_SOFT = new Uint8Array(256);
for (let i = 1; i < 256; i++) if (BLOCKS[i]) {
  if (ISLOG[i]) F_HARD[i] = 1;
  if (ISLEAF[i] || SHAPE[i] === S_CROSS || SHAPE[i] === S_FLAT) F_SOFT[i] = 1;
}
for (const k of ['mush_stem', 'packed_ice', 'cobble', 'mossy_cobble']) F_HARD[B[k]] = 1;
for (const k of ['snow_layer', 'water', 'ice', 'vine']) F_SOFT[B[k]] = 1;
// 幹や枝は 地面にめりこんでもよい（坂で枝が置けず、葉だけが残って枯れるのを防ぐ）
const F_TERR = new Uint8Array(256);
for (const k of ['stone', 'grass', 'dirt', 'sand', 'gravel', 'snow_block', 'red_sand', 'terracotta', 'terracotta_white', 'terracotta_yellow', 'terracotta_orange', 'terracotta_red', 'terracotta_brown', 'podzol', 'mud', 'coarse_dirt', 'moss', 'mycelium', 'granite', 'diorite', 'andesite', 'sandstone', 'clay']) F_TERR[B[k]] = 1;
const FL4 = [41, 42, 43, 44], FL6 = [41, 42, 43, 44, 108, 109];

class WorldGen2 extends WorldGen {
  constructor(seed) {
    super(seed);
    const s = this.seed;
    this.nT2 = new Simplex(s ^ 0x1F2E3D); this.nH2 = new Simplex(s ^ 0x2E3D4C); this.nW = new Simplex(s ^ 0x3D4C5B);
    this.nM = new Simplex(s ^ 0x4C5B6A); this.nI = new Simplex(s ^ 0x5B6A79); this.nF = new Simplex(s ^ 0x6A7988); this.nQ = new Simplex(s ^ 0x798897);
    this.nX = new Simplex(s ^ 0x8897A6);
    this.latQ = new Float32Array(825); this.cQ = new Float32Array(34);
    // 荒野の地層（高さごとの色）
    const r = mulberry32(s ^ 0x57A7A), TC = B.terracotta, pal = [TC, B.terracotta_orange, TC, B.terracotta_yellow, B.terracotta_red, B.terracotta_orange, B.terracotta_white, B.terracotta_brown, TC, B.terracotta_orange, B.terracotta_red, B.terracotta_yellow];
    this.bands = new Uint8Array(64);
    for (let i = 0; i < 64;) { const id = pal[Math.floor(r() * pal.length)], len = (id === TC ? 2 : 1) + Math.floor(r() * 3); for (let k = 0; k < len && i < 64; k++) this.bands[i++] = id; }
    this.colT = 0; this.colW = 0;
  }

  // その地点の地面の高さ・バイオーム・雪がつもるかを求める
  column(x, z) {
    const s = this.seed, dist = Math.sqrt(x * x + z * z);
    // ---- 大もとの地形（版1と同じ式） ----
    const c = fbm2(this.nC, x * 0.0016, z * 0.0016, 4) + 0.45 * Math.max(0, 1 - dist / 320);
    const e = fbm2(this.nE, x * 0.0032, z * 0.0032, 3);
    const d = fbm2(this.nD, x * 0.011, z * 0.011, 4);
    const land = smoothstep(-0.26, -0.06, c);
    const hill = smoothstep(-0.25, 0.45, e);
    let rr = 1 - Math.abs(this.nR.n2(x * 0.0045, z * 0.0045)); rr *= rr;
    const oceanH = SEA - 5 - 20 * smoothstep(-0.26, -0.8, c) + d * 3;
    // ---- 気候（最初の地点のまわりは おだやかな気候によせる） ----
    const jit = (hash2(x, z, s ^ 0x77) / 4294967296 - 0.5) * 0.018;
    const home = 0.85 * smoothstep(330, 110, dist);
    let T = uni2(fbm2(this.nT2, x * G2.ft, z * G2.ft, 2)) + this.nW.n2(x * 0.019, z * 0.019) * 0.02 + jit;
    let H = uni2(fbm2(this.nH2, x * G2.fh, z * G2.fh, 2)) + this.nW.n2(z * 0.019 + 31.7, x * 0.019 - 12.3) * 0.02 - jit;
    T = lerp(T, 0.52, home); H = lerp(H, 0.27, home);   // 森と草原の さかい目あたり（木がすぐ手に入り、見通しもよい）
    let best = 0, bd = 9, amp = 0, w1 = 0, w2 = 0, ws = 0;
    for (let i = 0; i < CL_N; i++) {
      const dt = T - CL_T[i], dh = H - CL_H[i], d2 = dt * dt + dh * dh;
      if (d2 < bd) { bd = d2; best = i; }
      const w = Math.exp(-d2 * 260), f = CL_F[i];
      ws += w; amp += w * CL_A[i];
      if (f === 1) w1 += w; else if (f === 2) w2 += w;
    }
    amp /= ws;
    // まだら（その気候の中に ところどころ出る 特別な地形）
    const vx = this.nX.n2(x * G2.fv, z * G2.fv) + jit * 4, vk = smoothstep(G2.vth - 0.08, G2.vth + 0.12, vx);
    const sw = w1 / ws * vk, ms = w2 / ws * vk, dn = w2 / ws * (1 - vk);
    // ---- 高さ ----
    const mount = smoothstep(0.14, 0.55, e) * smoothstep(-0.04, 0.2, c) * (1 - sw) * (1 - 0.6 * ms);
    let landH = SEA + 3 + Math.max(0, c) * 8 + (d * (2.5 + hill * 8) + hill * 5) * amp + mount * mount * (16 + rr * 40);
    if (sw > 0.003) {   // 湿地：水面すれすれの平らな土地と 水たまり
      const pool = -2.4 * smoothstep(-0.25, -0.5, this.nP.n2(x * 0.033, z * 0.033));
      landH = lerp(landH, SEA + 0.45 + d * 2.4 + pool, sw * 0.92);
    }
    if (ms > 0.003) {   // 荒野：段になった台地
      const p = fbm2(this.nM, x * 0.006, z * 0.006, 3);
      const m = SEA + 5 + d * 2.5 + 12 * smoothstep(-0.12, -0.02, p) + 10 * smoothstep(0.1, 0.17, p) + 9 * smoothstep(0.28, 0.33, p);
      landH = lerp(landH, m, ms);
    }
    if (dn > 0.003) { let q = 1 - Math.abs(this.nP.n2(x * 0.017 + 9.1, z * 0.03 - 4.7)); landH += dn * 2.8 * q * q; }   // 砂丘
    let h = lerp(oceanH, landH, land);
    let mush = 0;   // 遠い海の キノコの島
    if (c < -0.34) {
      const mi = this.nI.n2(x * 0.0011, z * 0.0011);
      if (mi > 0.74) { mush = smoothstep(0.74, 0.86, mi) * smoothstep(-0.34, -0.46, c); h = lerp(h, SEA + 2.2 + d * 3 + 2.5 * mush, smoothstep(0, 0.55, mush)); }
    }
    // 川（版1は ときどき定規で引いたようにまっすぐになるので、少しうねらせる）
    const rwx = this.nW.n2(x * 0.0061 + 17.3, z * 0.0061 - 8.9) * 26, rwz = this.nW.n2(x * 0.0061 - 40.1, z * 0.0061 + 23.7) * 26;
    const rv = Math.abs(this.nV.n2((x + rwx) * 0.0021, (z + rwz) * 0.0021));
    const rf = smoothstep(0.05, 0.012, rv) * land * (1 - mount * 0.85);
    if (rf > 0) h = lerp(h, Math.min(h, SEA - 3.5 + d), rf);
    const hi = clamp(Math.floor(h), 8, 118);
    // ---- バイオーム ----
    const site = CL_B[best], siteCold = CL_C[best] === 1;
    const snowline = 100 - (0.5 - T) * 36;                                  // 雪になる高さ（寒いほど低い）
    const hz = hi + ((hash2(x, z, s ^ 0x5A) & 7) - 3.5) * 0.55;             // 高さの境目を ぎざぎざにする
    const cold = siteCold || hz >= snowline;
    let b;
    if (hi < SEA) {
      if (land > 0.6 && rf > 0.25) b = BIOME.RIVER;
      else if (site === BIOME.DARK && vx > G2.vth && land > 0.9) b = BIOME.SWAMP;
      else b = siteCold ? BIOME.FROZEN : hi <= SEA - 16 ? BIOME.DEEP : BIOME.OCEAN;
    } else if (mush > 0.35) b = BIOME.MUSHROOM;
    else if (hi <= SEA + 1 && (land < 0.97 || rf > 0.08) && !(site === BIOME.DARK && vx > G2.vth)) b = BIOME.BEACH;
    else if (site === BIOME.DESERT && vx > G2.vth) b = BIOME.BADLANDS;
    else if (hz >= snowline) b = BIOME.SNOW_PEAK;
    else if (hz >= snowline - 15) b = BIOME.MOUNTAIN;
    else {
      b = site;
      const sp = this.nS.n2(x * G2.fs, z * G2.fs) + jit * 5;
      if (hz >= snowline - 25 && (site === BIOME.PLAINS || site === BIOME.FOREST || site === BIOME.TAIGA || site === BIOME.OLD_TAIGA || site === BIOME.DARK)) b = BIOME.MEADOW;
      else if (site === BIOME.FOREST) { if (sp > 0.6) b = BIOME.CHERRY; else if (sp < -0.3) b = BIOME.BIRCH; }
      else if (site === BIOME.PLAINS) { if (sp < -0.5) b = BIOME.FLOWER; else if (sp > 0.42) b = BIOME.FOREST; }   // 草原の中の 花畑と 木立ち
      else if (site === BIOME.SNOW) { if (vx > G2.vth + 0.15) b = BIOME.ICE; }
      else if (site === BIOME.DARK) { if (vx > G2.vth) b = BIOME.SWAMP; }
    }
    this.colH = hi; this.colB = b; this.colCold = cold; this.colT = T; this.colW = H;
    return hi;
  }

  // 遺跡のための空き地かどうか（木を生やさない）。遺跡の場所はチャンクごとに番号だけで決まる
  ruinZone(wx, wz) {
    const sr = mulberry32(hash2(wx >> 4, wz >> 4, this.seed ^ 0x51ED));
    if (sr() >= 0.022) return false;
    const ox = 3 + Math.floor(sr() * 4), oz = 3 + Math.floor(sr() * 4), lx = wx & 15, lz = wz & 15;
    return lx >= ox - 1 && lx <= ox + 7 && lz >= oz - 1 && lz <= oz + 7;
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
    // 洞窟と 岩の種類のノイズを4マスおきに計算
    const lA = this.latA, lB = this.latB, lK = this.latK, lQ = this.latQ;
    const jTop = Math.min(32, (hmax >> 2) + 2);
    for (let j = 0; j <= jTop; j++) for (let k = 0; k < 5; k++) for (let i = 0; i < 5; i++) {
      const wx = x0 + i * 4, wy = j * 4, wz = z0 + k * 4, li = (j * 5 + k) * 5 + i;
      lA[li] = this.nA.n3(wx * _FA, wy * _FAY, wz * _FA);
      lB[li] = this.nB.n3(wx * _FA, wy * _FAY, wz * _FA);
      lK[li] = this.nK.n3(wx * _FK, wy * _FKY, wz * _FK);
      lQ[li] = this.nQ.n3(wx * 0.021, wy * 0.03, wz * 0.021);
    }
    const cA = this.cA, cB = this.cB, cK = this.cK, cQ = this.cQ, bands = this.bands;
    const STONE = B.stone, WATER = B.water, GRASS = B.grass, DIRT = B.dirt, SAND = B.sand, GRAVEL = B.gravel;
    const BANDED = 255;   // 「荒野の地層の色」を表すしるし
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
        cQ[j] = lQ[base] * w00 + lQ[base + 1] * w10 + lQ[base + 5] * w01 + lQ[base + 6] * w11;
      }
      // 地面の表と そのすぐ下
      let top = GRASS, fill = DIRT, fdepth = 3 + (hash2(wx, wz, seed ^ 0x33) & 1), under = 0;   // under 1:砂岩 2:地層
      const pn = this.nP.n2(wx * 0.06, wz * 0.06);
      switch (b) {
        case BIOME.OCEAN: case BIOME.RIVER: case BIOME.FROZEN: top = fill = pn > 0.55 ? GRAVEL : (pn < -0.62 && h >= SEA - 7) ? B.clay : SAND; break;
        case BIOME.DEEP: top = fill = pn > 0.1 ? GRAVEL : SAND; break;
        case BIOME.BEACH: top = fill = SAND; break;
        case BIOME.DESERT: top = fill = SAND; under = 1; break;
        case BIOME.BADLANDS:
          under = 2;
          if (h <= SEA + 6) { top = fill = B.red_sand; fdepth = 2; }
          else if (h >= 83) { top = pn > 0.35 ? B.coarse_dirt : GRASS; fill = DIRT; fdepth = 2; }
          else { top = fill = BANDED; fdepth = 1; }
          break;
        case BIOME.MOUNTAIN: { const p = rand2(wx, wz, seed ^ 0x41); top = p < 0.22 ? GRASS : p < 0.34 ? GRAVEL : STONE; fill = STONE; break; }
        case BIOME.SNOW_PEAK: top = fill = B.snow_block; fdepth = 2; break;
        case BIOME.ICE: top = B.snow_block; break;
        case BIOME.SWAMP:
          if (h < SEA) top = fill = pn > 0.25 ? B.mud : pn < -0.55 ? B.clay : DIRT;
          else if (h === SEA && pn > 0.3) top = B.mud;
          break;
        case BIOME.OLD_TAIGA: top = pn > 0.5 ? B.coarse_dirt : pn > -0.4 ? B.podzol : GRASS; break;
        case BIOME.TAIGA: if (pn > 0.62) top = B.podzol; break;
        case BIOME.DARK: if (pn > 0.7) top = B.moss; break;
        case BIOME.SAVANNA: if (pn > 0.64) top = B.coarse_dirt; break;
        case BIOME.MUSHROOM: top = B.mycelium; break;
      }
      const wet = h <= SEA + 3 || b === BIOME.DESERT || (top !== BANDED && GRAVITY[top] === 1);
      const boff = under === 2 ? Math.round(this.nP.n2(wx * 0.011, wz * 0.011) * 3) + 64 : 0;
      for (let y = 0; y <= h; y++) {
        let id;
        if (y === 0) id = B.bedrock;
        else if (y <= 2 && rand3(wx, y, wz, seed) < (y === 1 ? 0.6 : 0.3)) id = B.bedrock;
        else {
          const depth = h - y, j = y >> 2, fy = (y & 3) * 0.25;
          const kk = cK[j] + (cK[j + 1] - cK[j]) * fy;
          if (depth < fdepth) { id = depth === 0 ? top : fill; if (id === BANDED) id = bands[(y + boff) & 63]; }
          else if (under === 1 && depth < fdepth + 3) id = B.sandstone;
          else if (under === 2 && depth < fdepth + 14) id = bands[(y + boff) & 63];
          else { const q = cQ[j] + (cQ[j + 1] - cQ[j]) * fy; id = q > 0.7 ? B.granite : q < -0.7 ? B.diorite : kk < -0.72 ? B.andesite : STONE; }
          if (y >= 2) {
            const a = cA[j] + (cA[j + 1] - cA[j]) * fy, bb = cB[j] + (cB[j + 1] - cB[j]) * fy;
            if (this.carveTest(a, bb, kk, y, h, wet)) id = y <= 8 ? B.lava : 0;
          }
        }
        if (id) blocks[(y << 8) | col] = id;
      }
      if (h < SEA) {
        for (let y = h + 1; y <= SEA; y++) blocks[(y << 8) | col] = WATER;
        if (cold && (b !== BIOME.FROZEN || this.nP.n2(wx * 0.03, wz * 0.03) > -0.3)) blocks[(SEA << 8) | col] = B.ice;   // こおった海は ところどころ水面が見える
      }
    }
    // 鉱石や土のかたまり
    const rng = mulberry32(hash2(cx, cz, seed ^ 0x0BE5));
    const vein = (id, count, size, y0, y1) => {
      for (let n = 0; n < count; n++) {
        let x = Math.floor(rng() * 16), z = Math.floor(rng() * 16), y = y0 + Math.floor(rng() * (y1 - y0));
        for (let s = 0; s < size; s++) {
          const i = (y << 8) | (z << 4) | x, cur = blocks[i];
          if (cur === STONE || (cur >= 105 && cur <= 107)) blocks[i] = id;
          const r = Math.floor(rng() * 6);
          if (r === 0) x = Math.min(15, x + 1); else if (r === 1) x = Math.max(0, x - 1);
          else if (r === 2) y = Math.min(126, y + 1); else if (r === 3) y = Math.max(1, y - 1);
          else if (r === 4) z = Math.min(15, z + 1); else z = Math.max(0, z - 1);
        }
      }
    };
    vein(DIRT, 3, 22, 20, 70); vein(GRAVEL, 2, 16, 8, 60);
    vein(B.ore_coal, 12, 10, 6, 100); vein(B.ore_iron, 9, 7, 5, 60); vein(B.ore_gold, 3, 6, 4, 30);
    vein(B.ore_diamond, 2, 4, 2, 15); vein(B.ore_glow, 2, 5, 3, 26);
    if (gB[12 * 24 + 12] === BIOME.BADLANDS) vein(B.ore_gold, 5, 6, 30, 84);   // 荒野は 浅いところにも金が出る

    // 建物（遺跡・地下の小部屋）。木より先に作る
    const sr = mulberry32(hash2(cx, cz, seed ^ 0x51ED));
    const roll = sr();
    if (roll < 0.022) this.buildRuin(blocks, meta, ents, sr);
    else if (roll < 0.057) this.buildRoom(blocks, meta, ents, sr);

    // 木・大きなキノコ・氷のとげ など（となりのチャンクから はみ出す分も含める）
    const fSeed = seed ^ 0x7EE5;
    const hAt = (gx, gz) => (gx >= -4 && gx < 20 && gz >= -4 && gz < 20) ? gH[(gz + 4) * 24 + gx + 4] : this.column(x0 + gx, z0 + gz);
    for (let gz = -7; gz < 23; gz++) for (let gx = -7; gx < 23; gx++) {
      const wx = x0 + gx, wz = z0 + gz;
      const r = hash2(wx, wz, fSeed) / 4294967296;
      if (r >= FEAT_MAX) continue;
      let h, b;
      if (gx >= -4 && gx < 20 && gz >= -4 && gz < 20) { const gi = (gz + 4) * 24 + gx + 4; h = gH[gi]; b = gB[gi]; }
      else { h = this.column(wx, wz); b = this.colB; }
      const f = FEAT[b];
      if (!f) continue;
      let dens = f.d;
      if (f.n) dens *= 0.3 + 1.4 * smoothstep(-0.4, 0.3, this.nF.n2(wx * 0.013, wz * 0.013));   // 森の中の こみぐあいの むら
      if (r >= dens) continue;
      let ok = true;   // となりに もっと小さい数があれば ゆずる（幹がくっつかないように）
      for (let dz = -1; dz <= 1 && ok; dz++) for (let dx = -1; dx <= 1; dx++) {
        if ((dx || dz) && hash2(wx + dx, wz + dz, fSeed) / 4294967296 < r) { ok = false; break; }
      }
      if (!ok) continue;
      const tr = mulberry32(hash2(wx, wz, seed ^ 0xBEEF));
      let kind = f.k[0], pick = tr() * f.tot;
      for (let i = 0; i < f.k.length; i += 2) { pick -= f.k[i + 1]; if (pick < 0) { kind = f.k[i]; break; } }
      let y = h + 1;
      if (kind === TK.BERG) { if (h > SEA - 4) continue; y = SEA + 1; }
      else if (kind === TK.SWAMPOAK) { if (h < SEA - 2 || h > 100) continue; }
      else if (h < SEA || h > 108) continue;
      if (b === BIOME.BADLANDS && h < 83) continue;
      if (b === BIOME.MOUNTAIN && rand2(wx, wz, seed ^ 0x41) >= 0.22) continue;   // 山では 草の生えた所だけ
      if (kind === TK.WALNUT || kind === TK.GSPRUCE || kind === TK.GMAHOG) {   // 太い幹は 4マスとも ほぼ同じ高さのときだけ
        const h1 = hAt(gx + 1, gz), h2 = hAt(gx, gz + 1), h3 = hAt(gx + 1, gz + 1);
        if (Math.abs(h1 - h) > 1 || Math.abs(h2 - h) > 1 || Math.abs(h3 - h) > 1 || h > 96) kind = kind === TK.WALNUT ? TK.WALNUT_S : kind === TK.GSPRUCE ? TK.SPRUCE : TK.MAHOG;
      }
      if (kind !== TK.BERG && this.caveAt(wx, h, wz, h, h <= SEA + 3)) continue;
      if (this.ruinZone(wx, wz)) continue;
      if (h < SEA) { for (let yy = h + 1; yy <= SEA; yy++) this.putF(blocks, meta, x0, z0, wx, yy, wz, B.log_oak, 0); y = SEA + 1; }   // 水の中から生える木
      const put = (dx, dy, dz, id, m) => this.putF(blocks, meta, x0, z0, wx + dx, y + dy, wz + dz, id, m);
      if (kind < 4) genTreeShape(kind, tr, put); else genFeature(kind, tr, put);
    }

    // 草花・サボテンなど
    const pSeed = seed ^ 0x9A17;
    for (let z = 0; z < 16; z++) for (let x = 0; x < 16; x++) {
      const gi = (z + 4) * 24 + x + 4, h = gH[gi], b = gB[gi], col = (z << 4) | x;
      const wx = x0 + x, wz = z0 + z;
      const r = hash2(wx, wz, pSeed) / 4294967296;
      if (h < SEA) {
        if (b === BIOME.SWAMP && r < 0.09 && blocks[(SEA << 8) | col] === WATER && blocks[((SEA + 1) << 8) | col] === 0) blocks[((SEA + 1) << 8) | col] = B.lily_pad;
        continue;
      }
      if (h >= 120) continue;
      const i = (h << 8) | col, top = blocks[i];
      if (blocks[i + 256] !== 0) continue;
      const r2 = hash2(wx, wz, pSeed ^ 0x55) / 4294967296;
      const TG = B.tallgrass, FERN = B.fern, MB = B.mushroom_brown, MR = B.mushroom_red;
      let put = 0;
      if (SOIL[top] && top !== B.mud) {
        switch (b) {
          case BIOME.PLAINS: put = r < 0.14 ? TG : r < 0.152 ? FL4[Math.floor(r2 * 4)] : 0; break;
          case BIOME.FLOWER:
            if (r < 0.1) put = TG;
            else if (r < 0.34) { const p = this.nP.n2(wx * 0.045, wz * 0.045) * 0.5 + 0.5; put = r2 < 0.25 ? FL6[Math.floor(r2 * 24)] : FL6[clamp(Math.floor(p * 6), 0, 5)]; }
            break;
          case BIOME.MEADOW:
            if (r < 0.16) put = TG;
            else if (r < 0.3) { const p = this.nP.n2(wx * 0.04 + 77, wz * 0.04 - 55) * 0.5 + 0.5; put = r2 < 0.3 ? FL6[Math.floor(r2 * 20)] : FL6[clamp(Math.floor(p * 6), 0, 5)]; }
            break;
          case BIOME.FOREST: put = r < 0.06 ? TG : r < 0.068 ? FL4[Math.floor(r2 * 4)] : r < 0.074 ? MB : r < 0.077 ? MR : 0; break;
          case BIOME.BIRCH: put = r < 0.07 ? TG : r < 0.085 ? [44, 42, 108][Math.floor(r2 * 3)] : 0; break;
          case BIOME.CHERRY: put = r < 0.07 ? TG : r < 0.1 ? (r2 < 0.7 ? B.flower_white : B.flower_red) : 0; break;
          case BIOME.DARK: put = r < 0.04 ? TG : r < 0.055 ? FERN : r < 0.07 ? MB : r < 0.08 ? MR : 0; break;
          case BIOME.JUNGLE: put = r < 0.2 ? TG : r < 0.32 ? FERN : r < 0.327 ? (r2 < 0.6 ? B.flower_orange : B.flower_red) : 0; break;
          case BIOME.SAVANNA: put = r < 0.3 ? TG : r < 0.304 ? B.deadbush : 0; break;
          case BIOME.SWAMP: put = r < 0.1 ? TG : r < 0.115 ? B.flower_blue : r < 0.125 ? MB : r < 0.14 ? FERN : 0; break;
          case BIOME.TAIGA: put = r < 0.03 ? TG : r < 0.11 ? FERN : r < 0.116 ? MB : 0; break;
          case BIOME.SNOW_TAIGA: put = r < 0.01 ? TG : r < 0.03 ? FERN : 0; break;
          case BIOME.OLD_TAIGA: put = r < 0.03 ? TG : r < 0.17 ? FERN : r < 0.185 ? MB : r < 0.192 ? MR : 0; break;
          case BIOME.SNOW: put = r < 0.01 ? TG : 0; break;
          case BIOME.MOUNTAIN: put = r < 0.04 ? TG : 0; break;
          case BIOME.MUSHROOM: put = r < 0.025 ? MB : r < 0.05 ? MR : 0; break;
          case BIOME.BADLANDS: put = r < 0.05 ? TG : r < 0.06 ? B.deadbush : 0; break;
        }
        if (put) blocks[i + 256] = put;
      } else if ((top === SAND && b === BIOME.DESERT) || (b === BIOME.BADLANDS && (top === B.red_sand || (top >= 87 && top <= 92)))) {
        const sandy = top === SAND || top === B.red_sand;
        if (r < (sandy ? 0.008 : 0.012)) blocks[i + 256] = B.deadbush;
        else if (sandy && r < 0.015 && x > 0 && x < 15 && z > 0 && z < 15) {
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
      const i = (y << 8) | (z << 4) | x, bl = blocks[i - 256];
      if (blocks[i] === 0 && (bl === STONE || (bl >= 105 && bl <= 107))) blocks[i] = rng() < 0.6 ? B.mushroom_brown : B.mushroom_red;
    }

    // 高さの上限を調べてから雪を積もらせる
    let maxY = 126;
    for (; maxY > 0; maxY--) {
      let any = false; const base = maxY << 8;
      for (let i = 0; i < 256; i++) if (blocks[base + i]) { any = true; break; }
      if (any) break;
    }
    for (let z = 0; z < 16; z++) for (let x = 0; x < 16; x++) {
      if (!gCold[(z + 4) * 24 + x + 4]) continue;
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

  // 生えるものの1ブロックを置く（チャンクの外は捨てる）
  putF(blocks, meta, x0, z0, wx, yy, wz, id, m) {
    const lx = wx - x0, lz = wz - z0;
    if (lx < 0 || lx > 15 || lz < 0 || lz > 15 || yy < 1 || yy > 126) return;
    const i = (yy << 8) | (lz << 4) | lx, cur = blocks[i];
    if (F_HARD[id]) { if (cur === 0 || F_SOFT[cur] || (F_TERR[cur] && ISLOG[id])) { blocks[i] = id; meta[i] = 0; } }
    else if (cur === 0) { blocks[i] = id; meta[i] = m || 0; }
  }
}

// ---- 木などの形。put(dx, dy, dz, ブロック番号, メタ) を呼ぶ。葉は必ず 幹から4マス以内（枯れないように） ----
function leafBlob(put, id, cx, cy, cz, rx, ry, rng, fuzz) {
  for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++) for (let z = Math.floor(cz - rx); z <= Math.ceil(cz + rx); z++) for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++) {
    const v = ((x - cx) * (x - cx) + (z - cz) * (z - cz)) / (rx * rx) + (y - cy) * (y - cy) / (ry * ry);
    if (v < 1 - rng() * fuzz) put(x, y, z, id);
  }
}
// 角の丸い四角の 葉の層
function leafPad(put, id, cx, y, cz, r, rng, fuzz) {
  const r3 = r * r * r;
  for (let z = Math.floor(cz - r); z <= Math.ceil(cz + r); z++) for (let x = Math.floor(cx - r); x <= Math.ceil(cx + r); x++) {
    const ax = Math.abs(x - cx), az = Math.abs(z - cz);
    if (ax * ax * ax + az * az * az < r3 * (1 - rng() * fuzz)) put(x, y, z, id);
  }
}
function genFeature(kind, rng, put) {
  const rnd = (n) => Math.floor(rng() * n);
  // 葉と幹の場所を覚えておいて、あとで つたを下げる
  const cells = new Map(), key = (x, y, z) => (x + 32) + (z + 32) * 64 + (y + 16) * 4096;
  const P = (x, y, z, id) => { put(x, y, z, id); const k = key(x, y, z); if (ISLOG[id] || !cells.has(k)) cells.set(k, id); };
  const vines = (pLeaf, lenMin, lenMax, pLog) => {
    for (const [k, id] of [...cells]) {
      const x = (k & 63) - 32, z = ((k >> 6) & 63) - 32, y = (k >> 12) - 16;
      const p = ISLOG[id] ? pLog : pLeaf;
      if (p <= 0 || (ISLOG[id] && y < 1)) continue;
      for (let f = 0; f < 4; f++) {
        if (rng() >= p) continue;
        const vx = x - F4[f][0], vz = z - F4[f][1];   // つたの場所。f は「くっついている相手のある向き」
        if (cells.has(key(vx, y, vz))) continue;
        const len = ISLOG[id] ? 1 : lenMin + rnd(lenMax - lenMin + 1);
        for (let n = 0; n < len; n++) { if (cells.has(key(vx, y - n, vz)) && n > 0) break; put(vx, y - n, vz, B.vine, f); }
      }
    }
  };
  switch (kind) {
    case TK.MAHOG: {   // ジャングルの高い木
      const H = 7 + rnd(6), LOG = B.log_mahog, LEAF = B.leaves_mahog;
      leafBlob(P, LEAF, 0, H - 0.5, 0, 3.3, 2.1, rng, 0.3);
      if (rng() < 0.6) { const s = rnd(4), hm = 3 + rnd(Math.max(1, H - 6)); P(F4[s][0], hm, F4[s][1], LOG); leafBlob(P, LEAF, F4[s][0] * 2, hm + 0.3, F4[s][1] * 2, 1.6, 1.2, rng, 0.3); }
      for (let dy = 0; dy < H; dy++) P(0, dy, 0, LOG);
      vines(0.07, 1, 4, 0.16);
      break;
    }
    case TK.GMAHOG: {   // 幹が4マスの とても高い木
      const H = 15 + rnd(9), LOG = B.log_mahog, LEAF = B.leaves_mahog;
      leafBlob(P, LEAF, 0.5, H - 0.5, 0.5, 5.3, 2.6, rng, 0.25);
      for (const [bx, bz, ex, ez] of [[-1, 0, -1, 0], [2, 1, 1, 0], [0, -1, 0, -1], [1, 2, 0, 1]]) { P(bx, H - 2, bz, LOG); P(bx + ex, H - 2, bz + ez, LOG); }
      for (let n = 0; n < 2; n++) {
        const s = rnd(4), hm = Math.floor(H * (0.4 + 0.25 * n)) + rnd(2), bx = F4[s][0] > 0 ? 2 : F4[s][0] < 0 ? -1 : rnd(2), bz = F4[s][1] > 0 ? 2 : F4[s][1] < 0 ? -1 : rnd(2);
        P(bx, hm, bz, LOG); P(bx + F4[s][0], hm, bz + F4[s][1], LOG);
        leafBlob(P, LEAF, bx + F4[s][0] * 1.5, hm + 0.4, bz + F4[s][1] * 1.5, 2.2, 1.5, rng, 0.3);
      }
      for (let dy = -2; dy < H; dy++) { P(0, dy, 0, LOG); P(1, dy, 0, LOG); P(0, dy, 1, LOG); P(1, dy, 1, LOG); }
      vines(0.08, 2, 6, 0.2);
      break;
    }
    case TK.ACACIA: {   // 幹が曲がって、上が平たい木
      const LOG = B.log_acacia, LEAF = B.leaves_acacia;
      const H1 = 2 + rnd(2), dir = rnd(4), L = 2 + rnd(2), dx = F4[dir][0], dz = F4[dir][1];
      const crown = (cx, cy, cz, r) => { leafPad(P, LEAF, cx, cy, cz, r, rng, 0.25); leafPad(P, LEAF, cx, cy + 1, cz, r - 1.2, rng, 0.2); };
      crown(dx * L, H1 + L, dz * L, 3.2);
      if (rng() < 0.55) {
        const d2 = (dir + 1 + rnd(3)) & 3, L2 = 1 + rnd(2), ex = F4[d2][0], ez = F4[d2][1];
        for (let k = 1; k <= L2; k++) P(ex * k, H1 - 1 + k, ez * k, LOG);
        crown(ex * L2, H1 + L2, ez * L2, 2.3);
      }
      for (let dy = 0; dy < H1; dy++) P(0, dy, 0, LOG);
      for (let k = 1; k <= L; k++) P(dx * k, H1 - 1 + k, dz * k, LOG);
      break;
    }
    case TK.WALNUT: {   // 幹が4マスで、葉が広く厚い木
      const H = 5 + rnd(3), LOG = B.log_walnut, LEAF = B.leaves_walnut;
      leafPad(P, LEAF, 0.5, H - 2, 0.5, 2.7, rng, 0.25);
      leafPad(P, LEAF, 0.5, H - 1, 0.5, 4.1, rng, 0.2);
      leafPad(P, LEAF, 0.5, H, 0.5, 4.1, rng, 0.3);
      leafPad(P, LEAF, 0.5, H + 1, 0.5, 2.8, rng, 0.3);
      for (let n = 0; n < 3; n++) { const s = rnd(4); P(F4[s][0] > 0 ? 2 : F4[s][0] < 0 ? -1 : rnd(2), H - 1, F4[s][1] > 0 ? 2 : F4[s][1] < 0 ? -1 : rnd(2), LOG); }
      for (let dy = -2; dy < H; dy++) { P(0, dy, 0, LOG); P(1, dy, 0, LOG); P(0, dy, 1, LOG); P(1, dy, 1, LOG); }
      break;
    }
    case TK.WALNUT_S: {   // 苗木から育つ 小さめのクルミ
      const H = 4 + rnd(2), LOG = B.log_walnut, LEAF = B.leaves_walnut;
      leafPad(P, LEAF, 0, H - 2, 0, 1.9, rng, 0.3);
      leafPad(P, LEAF, 0, H - 1, 0, 2.8, rng, 0.2);
      leafPad(P, LEAF, 0, H, 0, 2.8, rng, 0.3);
      leafPad(P, LEAF, 0, H + 1, 0, 1.7, rng, 0.3);
      for (let dy = 0; dy < H; dy++) P(0, dy, 0, LOG);
      break;
    }
    case TK.BIGOAK: {   // 枝分かれした大きなオーク
      const H = 7 + rnd(4), LOG = B.log_oak, LEAF = B.leaves_oak;
      leafBlob(P, LEAF, 0, H - 0.3, 0, 2.6, 2.0, rng, 0.3);
      const nb = 3 + rnd(2), lo = Math.floor(H * 0.45);
      for (let n = 0; n < nb; n++) {
        const sy = lo + rnd(H - lo - 1), a = rng() * 6.2832, len = 2 + rnd(2);
        let ex = 0, ey = sy, ez = 0;
        for (let k = 1; k <= len; k++) { ex = Math.round(Math.cos(a) * k); ez = Math.round(Math.sin(a) * k); ey = sy + ((k + 1) >> 1); P(ex, ey, ez, LOG); }
        leafBlob(P, LEAF, ex, ey + 0.6, ez, 2.1, 1.6, rng, 0.3);
      }
      for (let dy = 0; dy < H; dy++) P(0, dy, 0, LOG);
      break;
    }
    case TK.GSPRUCE: {   // 幹が4マスの 大きなマツ
      const H = 16 + rnd(9), LOG = B.log_spruce, LEAF = B.leaves_spruce;
      const radii = [1.5, 2.5, 2, 3, 2.5, 3.5, 3, 4, 3.2, 4.4, 3.4, 4.6];
      for (let dy = H; dy <= H + 1; dy++) { P(0, dy, 0, LEAF); P(1, dy, 0, LEAF); P(0, dy, 1, LEAF); P(1, dy, 1, LEAF); }
      for (let i = 0; i < radii.length; i++) {
        const rad = radii[i], dy = H - 1 - i;
        for (let z = -4; z <= 5; z++) for (let x = -4; x <= 5; x++) if ((x - 0.5) * (x - 0.5) + (z - 0.5) * (z - 0.5) <= rad * rad) P(x, dy, z, LEAF);
      }
      for (let dy = -2; dy < H; dy++) { P(0, dy, 0, LOG); P(1, dy, 0, LOG); P(0, dy, 1, LOG); P(1, dy, 1, LOG); }
      break;
    }
    case TK.PINE: {   // 上のほうにだけ葉がある 細いマツ
      const H = 7 + rnd(4), LOG = B.log_spruce, LEAF = B.leaves_spruce, radii = [1, 2, 2, 1];
      P(0, H, 0, LEAF); P(0, H + 1, 0, LEAF);
      for (let i = 0; i < 4; i++) { const rad = radii[i], dy = H - 1 - i; for (let z = -rad; z <= rad; z++) for (let x = -rad; x <= rad; x++) if (!(Math.abs(x) === rad && Math.abs(z) === rad && rad > 1)) P(x, dy, z, LEAF); }
      for (let dy = 0; dy < H; dy++) P(0, dy, 0, LOG);
      break;
    }
    case TK.TBIRCH: {   // 背の高いシラカバ
      const H = 8 + rnd(4);
      leafBlob(P, B.leaves_birch, 0, H - 0.2, 0, 2.2, 2.8, rng, 0.3);
      for (let dy = 0; dy < H; dy++) P(0, dy, 0, B.log_birch);
      break;
    }
    case TK.SWAMPOAK: {   // 湿地のオーク。葉が広く、つたが下がる
      const H = 4 + rnd(3), LOG = B.log_oak, LEAF = B.leaves_oak;
      leafPad(P, LEAF, 0, H - 2, 0, 3.4, rng, 0.3);
      leafPad(P, LEAF, 0, H - 1, 0, 3.4, rng, 0.2);
      leafPad(P, LEAF, 0, H, 0, 2.4, rng, 0.3);
      leafPad(P, LEAF, 0, H + 1, 0, 1.5, rng, 0.3);
      for (let dy = 0; dy < H; dy++) P(0, dy, 0, LOG);
      vines(0.13, 1, 3, 0);
      break;
    }
    case TK.BUSH: P(0, 0, 0, B.log_mahog); leafBlob(P, B.leaves_mahog, 0, 0.6, 0, 2.1, 1.4, rng, 0.35); break;
    case TK.MUSH_B: {   // 大きな茶色いキノコ（平たいかさ）
      const H = 4 + rnd(3);
      for (let z = -3; z <= 3; z++) for (let x = -3; x <= 3; x++) if (!(Math.abs(x) === 3 && Math.abs(z) === 3)) put(x, H, z, B.mush_brown);
      for (let dy = 0; dy < H; dy++) put(0, dy, 0, B.mush_stem);
      break;
    }
    case TK.MUSH_R: {   // 大きな赤いキノコ（丸いかさ）
      const H = 5 + rnd(3);
      for (let z = -1; z <= 1; z++) for (let x = -1; x <= 1; x++) put(x, H, z, B.mush_red);
      for (let dy = H - 3; dy < H; dy++) for (let z = -2; z <= 2; z++) for (let x = -2; x <= 2; x++) if ((Math.abs(x) === 2) !== (Math.abs(z) === 2)) put(x, dy, z, B.mush_red);
      for (let dy = 0; dy < H; dy++) put(0, dy, 0, B.mush_stem);
      break;
    }
    case TK.SPIKE: {   // 氷のとげ
      const big = rng() < 0.22, H = big ? 12 + rnd(16) : 3 + rnd(5), r0 = big ? 2.2 + rng() * 0.8 : 1.1 + rng() * 0.6;
      for (let dy = -3; dy <= H; dy++) {
        const r = r0 * Math.pow(1 - Math.max(0, dy) / (H + 1), 0.8), ri = Math.ceil(r);
        for (let z = -ri; z <= ri; z++) for (let x = -ri; x <= ri; x++) if (x * x + z * z <= r * r + 0.2) put(x, dy, z, B.packed_ice);
      }
      break;
    }
    case TK.BOULDER: {   // 苔むした岩
      const r = 1.2 + rng() * 1.1, ri = Math.ceil(r);
      for (let dy = -1; dy <= ri; dy++) for (let z = -ri; z <= ri; z++) for (let x = -ri; x <= ri; x++) {
        if (x * x + z * z + (dy - r * 0.3) * (dy - r * 0.3) * 1.4 <= r * r * (1 - rng() * 0.3)) put(x, dy, z, rng() < 0.7 ? B.mossy_cobble : B.cobble);
      }
      break;
    }
    case TK.BERG: {   // 海に浮かぶ氷山（dy=0 が水面のすぐ上）
      const r = 2 + rng() * 3, up = 2 + rnd(5), down = 3 + rnd(3), ri = Math.ceil(r);
      for (let z = -ri; z <= ri; z++) for (let x = -ri; x <= ri; x++) {
        const q = Math.sqrt(x * x + z * z) / r;
        if (q >= 1) continue;
        const top = Math.floor(up * (1 - Math.pow(q, 1.5)) - rng() * 0.8), bot = -Math.floor(down * (1 - q * q) + 1);
        for (let dy = bot; dy <= top; dy++) put(x, dy, z, B.packed_ice);
      }
      break;
    }
  }
}

// 地形の版。新しい版を足しても、古い場所は古い版のまま作れるように全部残す
const GENS = { 1: WorldGen, 2: WorldGen2 };
const GEN_CUR = 2;
