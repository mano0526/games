// ===== 06_mesher.js : ブロックのかたまりを描画用の面データにする =====
const FN = [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]];
const FU = [[0, 0, -1], [0, 0, 1], [1, 0, 0], [1, 0, 0], [1, 0, 0], [-1, 0, 0]];
const FV = [[0, 1, 0], [0, 1, 0], [0, 0, -1], [0, 0, 1], [0, 1, 0], [0, 1, 0]];
const FBASE = [[1, 0, 1], [0, 0, 0], [0, 1, 1], [0, 0, 0], [0, 0, 1], [1, 0, 0]];
const FACE_SHADE = [0.66, 0.66, 1.0, 0.5, 0.83, 0.83];
const AO_F = [0.48, 0.66, 0.83, 1.0];
const CORNER_UV = [[0, 0], [1, 0], [1, 1], [0, 1]];
const NOFF = new Int32Array(6), AOT = new Int32Array(72), CPOS = new Int8Array(72), SHTAB = new Uint8Array(24);
(function () {
  const off = (v) => v[0] + v[2] * 18 + v[1] * 324;
  for (let f = 0; f < 6; f++) {
    NOFF[f] = off(FN[f]);
    for (let k = 0; k < 4; k++) {
      const cu = CORNER_UV[k][0], cv = CORNER_UV[k][1];
      const su = cu ? 1 : -1, sv = cv ? 1 : -1;
      const s1 = NOFF[f] + su * off(FU[f]), s2 = NOFF[f] + sv * off(FV[f]);
      AOT[(f * 4 + k) * 3] = s1; AOT[(f * 4 + k) * 3 + 1] = s2; AOT[(f * 4 + k) * 3 + 2] = s1 + sv * off(FV[f]);
      for (let a = 0; a < 3; a++) CPOS[(f * 4 + k) * 3 + a] = FBASE[f][a] + cu * FU[f][a] + cv * FV[f][a];
    }
    for (let a = 0; a < 4; a++) SHTAB[f * 4 + a] = Math.round(255 * FACE_SHADE[f] * AO_F[a]);
  }
})();

class MeshBuf {
  constructor(cap) { this.alloc(cap); this.n = 0; }
  alloc(cap) { this.cap = cap; this.buf = new ArrayBuffer(cap * 16); this.i16 = new Int16Array(this.buf); this.u16 = new Uint16Array(this.buf); this.u8 = new Uint8Array(this.buf); }
  ensure(k) {
    if (this.n + k <= this.cap) return;
    const old = this.u8; this.alloc(Math.max(this.cap * 2, this.n + k)); this.u8.set(old.subarray(0, this.n * 16));
  }
  vert(x, y, z, layer, u, v, sky, blk, shade, flags, anim) {
    const o = this.n * 8, b = this.n * 16 + 8, u8 = this.u8;
    this.i16[o] = x; this.i16[o + 1] = y; this.i16[o + 2] = z; this.u16[o + 3] = layer;
    u8[b] = u; u8[b + 1] = v; u8[b + 2] = sky; u8[b + 3] = blk; u8[b + 4] = shade; u8[b + 5] = flags; u8[b + 6] = anim; u8[b + 7] = 0;
    this.n++;
  }
}
const mbO = new MeshBuf(16384), mbC = new MeshBuf(8192), mbT = new MeshBuf(4096);
const mB = new Uint8Array(5832), mM = new Uint8Array(5832), mL = new Uint8Array(5832);
const CUBE_TL = new Uint16Array(256 * 6);
let TL_GRASS_TOP = [], TL_GRASS_SIDE = [], TL_TALL = [], TL_SNOWSIDE = 0, TL_WHEAT = [], TL_LEAF_FAST = {};
const meshOpts = { fancyLeaves: true };

function initMesher() {
  for (let id = 1; id < 256; id++) { const b = BLOCKS[id]; if (b && b.tl) for (let f = 0; f < 6; f++) CUBE_TL[id * 6 + f] = b.tl[f]; }
  TL_GRASS_TOP = [0, 1, 2, 3].map(i => TEX['grass_top_' + i]);
  TL_GRASS_SIDE = [0, 1, 2, 3].map(i => TEX['grass_side_' + i]);
  TL_TALL = [0, 1, 2, 3].map(i => TEX['tallgrass_' + i]);
  TL_WHEAT = [0, 1, 2, 3].map(i => TEX['wheat_' + i]);
  TL_SNOWSIDE = TEX.grass_side_snow;
  for (const k of ['oak', 'birch', 'spruce', 'cherry']) TL_LEAF_FAST[B['leaves_' + k]] = TEX['leaves_' + k + '_f'];
}

// 任意の4点の面
function quadP(buf, p, layer, uv, sky, blk, shade, flags, anim, both) {
  buf.ensure(8);
  for (let k = 0; k < 4; k++) buf.vert(p[k * 3], p[k * 3 + 1], p[k * 3 + 2], layer, uv[k * 2], uv[k * 2 + 1], sky, blk, shade, (flags && flags.length) ? flags[k] : (flags || 0), anim || 0);
  if (both) for (let k = 3; k >= 0; k--) buf.vert(p[k * 3], p[k * 3 + 1], p[k * 3 + 2], layer, uv[k * 2], uv[k * 2 + 1], sky, blk, shade, (flags && flags.length) ? flags[k] : (flags || 0), anim || 0);
}
const _qp = new Float32Array(12), _quv = new Float32Array(8);
// セルの中の箱（1/16 きざみ）。境界にある面はとなりで隠れるか調べる
function emitBox(buf, bx, by, bz, x0, y0, z0, x1, y1, z1, tl, pi, topRot, noCull) {
  const own = mL[pi];
  for (let f = 0; f < 6; f++) {
    const onB = f === 0 ? x1 === 16 : f === 1 ? x0 === 0 : f === 2 ? y1 === 16 : f === 3 ? y0 === 0 : f === 4 ? z1 === 16 : z0 === 0;
    let l = own;
    if (onB) { const nb = mB[pi + NOFF[f]]; if (!noCull && OPAQUE[nb]) continue; l = mL[pi + NOFF[f]]; if ((l >> 4) < (own >> 4)) l = (own & 0xF0) | (l & 15); if ((l & 15) < (own & 15)) l = (l & 0xF0) | (own & 15); }
    const p = _qp, uv = _quv;
    switch (f) {
      case 0: p[0] = x1; p[1] = y0; p[2] = z1; p[3] = x1; p[4] = y0; p[5] = z0; p[6] = x1; p[7] = y1; p[8] = z0; p[9] = x1; p[10] = y1; p[11] = z1;
        uv[0] = 16 - z1; uv[1] = 16 - y0; uv[2] = 16 - z0; uv[3] = 16 - y0; uv[4] = 16 - z0; uv[5] = 16 - y1; uv[6] = 16 - z1; uv[7] = 16 - y1; break;
      case 1: p[0] = x0; p[1] = y0; p[2] = z0; p[3] = x0; p[4] = y0; p[5] = z1; p[6] = x0; p[7] = y1; p[8] = z1; p[9] = x0; p[10] = y1; p[11] = z0;
        uv[0] = z0; uv[1] = 16 - y0; uv[2] = z1; uv[3] = 16 - y0; uv[4] = z1; uv[5] = 16 - y1; uv[6] = z0; uv[7] = 16 - y1; break;
      case 2: p[0] = x0; p[1] = y1; p[2] = z1; p[3] = x1; p[4] = y1; p[5] = z1; p[6] = x1; p[7] = y1; p[8] = z0; p[9] = x0; p[10] = y1; p[11] = z0;
        for (let k = 0; k < 4; k++) {
          const px = p[k * 3], pz = p[k * 3 + 2];
          if (topRot === 0) { uv[k * 2] = 16 - px; uv[k * 2 + 1] = 16 - pz; }
          else if (topRot === 1) { uv[k * 2] = 16 - pz; uv[k * 2 + 1] = px; }
          else if (topRot === 3) { uv[k * 2] = pz; uv[k * 2 + 1] = 16 - px; }
          else { uv[k * 2] = px; uv[k * 2 + 1] = pz; }
        } break;
      case 3: p[0] = x0; p[1] = y0; p[2] = z0; p[3] = x1; p[4] = y0; p[5] = z0; p[6] = x1; p[7] = y0; p[8] = z1; p[9] = x0; p[10] = y0; p[11] = z1;
        uv[0] = x0; uv[1] = 16 - z0; uv[2] = x1; uv[3] = 16 - z0; uv[4] = x1; uv[5] = 16 - z1; uv[6] = x0; uv[7] = 16 - z1; break;
      case 4: p[0] = x0; p[1] = y0; p[2] = z1; p[3] = x1; p[4] = y0; p[5] = z1; p[6] = x1; p[7] = y1; p[8] = z1; p[9] = x0; p[10] = y1; p[11] = z1;
        uv[0] = x0; uv[1] = 16 - y0; uv[2] = x1; uv[3] = 16 - y0; uv[4] = x1; uv[5] = 16 - y1; uv[6] = x0; uv[7] = 16 - y1; break;
      default: p[0] = x1; p[1] = y0; p[2] = z0; p[3] = x0; p[4] = y0; p[5] = z0; p[6] = x0; p[7] = y1; p[8] = z0; p[9] = x1; p[10] = y1; p[11] = z0;
        uv[0] = 16 - x1; uv[1] = 16 - y0; uv[2] = 16 - x0; uv[3] = 16 - y0; uv[4] = 16 - x0; uv[5] = 16 - y1; uv[6] = 16 - x1; uv[7] = 16 - y1;
    }
    buf.ensure(4);
    const sky = (l >> 4) * 16, blk = (l & 15) * 16, sh = SHTAB[f * 4 + 3];
    for (let k = 0; k < 4; k++) buf.vert(bx + p[k * 3], by + p[k * 3 + 1], bz + p[k * 3 + 2], tl[f], uv[k * 2], uv[k * 2 + 1], sky, blk, sh, 0, 0);
  }
}
function fluidH(pi, id) {
  if (mB[pi + 324] === id) return 16;
  const m = mM[pi];
  return (m === 0 || m >= 8) ? 14 : Math.round(14 - m * 1.75);
}
function fluidCorner(pi, id, dx, dz) {
  let sum = 0, cnt = 0;
  for (let a = 0; a < 2; a++) for (let b = 0; b < 2; b++) {
    const q = pi + (a ? dx : 0) + (b ? dz * 18 : 0);
    if (mB[q] === id) { if (mB[q + 324] === id) return 16; sum += fluidH(q, id); cnt++; }
  }
  return cnt ? Math.round(sum / cnt) : 14;
}
const _tl6 = new Uint16Array(6);

// 1つの区画（16x16x16）を面データにする。何もなければ null
function meshSection(world, c, sy) {
  if (sy * 16 > c.maxY + 1) return null;
  const ch3 = [];
  for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) ch3.push(world.getChunk(c.cx + dx, c.cz + dz));
  for (let py = 0; py < 18; py++) {
    const wy = sy * 16 + py - 1;
    for (let pz = 0; pz < 18; pz++) {
      const czI = pz === 0 ? 0 : pz === 17 ? 2 : 1, lz = (pz - 1) & 15;
      let pi = (py * 18 + pz) * 18;
      if (wy < 0) { for (let px = 0; px < 18; px++, pi++) { mB[pi] = 6; mM[pi] = 0; mL[pi] = 0; } continue; }
      if (wy >= CH) { for (let px = 0; px < 18; px++, pi++) { mB[pi] = 0; mM[pi] = 0; mL[pi] = 0xF0; } continue; }
      const rowBase = (wy << 8) | (lz << 4);
      const cm = ch3[czI * 3 + 1], cl = ch3[czI * 3], cr = ch3[czI * 3 + 2];
      mB[pi] = cl.blocks[rowBase | 15]; mM[pi] = cl.meta[rowBase | 15]; mL[pi] = cl.light[rowBase | 15];
      for (let lx = 0; lx < 16; lx++) { const i = rowBase | lx, q = pi + 1 + lx; mB[q] = cm.blocks[i]; mM[q] = cm.meta[i]; mL[q] = cm.light[i]; }
      mB[pi + 17] = cr.blocks[rowBase]; mM[pi + 17] = cr.meta[rowBase]; mL[pi + 17] = cr.light[rowBase];
    }
  }
  mbO.n = mbC.n = mbT.n = 0;
  const fancy = meshOpts.fancyLeaves, biome = c.biome;
  const wx0 = c.cx * 16, wz0 = c.cz * 16, wy0 = sy * 16;
  for (let y = 0; y < 16; y++) for (let z = 0; z < 16; z++) {
    let pi = ((y + 1) * 18 + z + 1) * 18 + 1;
    for (let x = 0; x < 16; x++, pi++) {
      const id = mB[pi];
      if (!id) continue;
      const sh = SHAPE[id], bx = x * 16, by = y * 16, bz = z * 16;
      if (sh === S_CUBE) {
        const rc = RCLASS[id], leaf = ISLEAF[id];
        const buf = rc === 2 ? mbT : (rc === 1 && !(leaf && !fancy)) ? mbC : mbO;
        const meta = mM[pi];
        let front = -1, tint = -1;
        if (BLOCKS[id].facing) front = F4_TO_FACE[meta & 3];
        if (id === 2) tint = BIOME_TINT[biome[(z << 4) | x]];
        for (let f = 0; f < 6; f++) {
          const ni = pi + NOFF[f], nb = mB[ni];
          if (OPAQUE[nb]) continue;
          if (nb === id && rc !== 0 && !(leaf && fancy)) continue;
          let layer = CUBE_TL[id * 6 + f];
          if (front >= 0 && f !== 2 && f !== 3) layer = f === front ? CUBE_TL[id * 6 + 4] : CUBE_TL[id * 6];
          else if (tint >= 0) { if (f === 2) layer = TL_GRASS_TOP[tint]; else if (f !== 3) { const ab = mB[pi + 324]; layer = (ab === 34 || ab === 35) ? TL_SNOWSIDE : TL_GRASS_SIDE[tint]; } }
          else if (leaf && !fancy) layer = TL_LEAF_FAST[id];
          const ln = mL[ni];
          let a0, a1, a2, a3, s0, s1, s2, s3, b0, b1, b2, b3;
          for (let k = 0; k < 4; k++) {
            const t = (f * 4 + k) * 3;
            const q1 = ni + AOT[t] - NOFF[f], q2 = ni + AOT[t + 1] - NOFF[f], q3 = ni + AOT[t + 2] - NOFF[f];
            const o1 = OPAQUE[mB[q1]], o2 = OPAQUE[mB[q2]], oc = OPAQUE[mB[q3]];
            let sky = ln >> 4, blk = ln & 15, cnt = 1, ao;
            if (!o1) { const l = mL[q1]; sky += l >> 4; blk += l & 15; cnt++; }
            if (!o2) { const l = mL[q2]; sky += l >> 4; blk += l & 15; cnt++; }
            if (o1 && o2) ao = 0;
            else { ao = 3 - o1 - o2 - oc; if (!oc) { const l = mL[q3]; sky += l >> 4; blk += l & 15; cnt++; } }
            sky = (sky * 16 / cnt) | 0; blk = (blk * 16 / cnt) | 0;
            if (k === 0) { a0 = ao; s0 = sky; b0 = blk; } else if (k === 1) { a1 = ao; s1 = sky; b1 = blk; } else if (k === 2) { a2 = ao; s2 = sky; b2 = blk; } else { a3 = ao; s3 = sky; b3 = blk; }
          }
          buf.ensure(4);
          const cp = f * 12, st = f * 4;
          const x0 = bx + CPOS[cp] * 16, y0 = by + CPOS[cp + 1] * 16, z0 = bz + CPOS[cp + 2] * 16;
          const x1 = bx + CPOS[cp + 3] * 16, y1 = by + CPOS[cp + 4] * 16, z1 = bz + CPOS[cp + 5] * 16;
          const x2 = bx + CPOS[cp + 6] * 16, y2 = by + CPOS[cp + 7] * 16, z2 = bz + CPOS[cp + 8] * 16;
          const x3 = bx + CPOS[cp + 9] * 16, y3 = by + CPOS[cp + 10] * 16, z3 = bz + CPOS[cp + 11] * 16;
          if (a0 + a2 + (s0 + s2 + b0 + b2) / 512 < a1 + a3 + (s1 + s3 + b1 + b3) / 512) {
            buf.vert(x1, y1, z1, layer, 16, 16, s1, b1, SHTAB[st + a1], 0, 0);
            buf.vert(x2, y2, z2, layer, 16, 0, s2, b2, SHTAB[st + a2], 0, 0);
            buf.vert(x3, y3, z3, layer, 0, 0, s3, b3, SHTAB[st + a3], 0, 0);
            buf.vert(x0, y0, z0, layer, 0, 16, s0, b0, SHTAB[st + a0], 0, 0);
          } else {
            buf.vert(x0, y0, z0, layer, 0, 16, s0, b0, SHTAB[st + a0], 0, 0);
            buf.vert(x1, y1, z1, layer, 16, 16, s1, b1, SHTAB[st + a1], 0, 0);
            buf.vert(x2, y2, z2, layer, 16, 0, s2, b2, SHTAB[st + a2], 0, 0);
            buf.vert(x3, y3, z3, layer, 0, 0, s3, b3, SHTAB[st + a3], 0, 0);
          }
        }
        continue;
      }
      const meta = mM[pi], own = mL[pi], sky = (own >> 4) * 16, blk = (own & 15) * 16, tl = BLOCKS[id].tl;
      switch (sh) {
        case S_CROSS: {
          let layer = tl[0];
          if (id === 40) layer = TL_TALL[BIOME_TINT[biome[(z << 4) | x]]];
          const hsh = hash3(wx0 + x, wy0 + y, wz0 + z, 77);
          const jx = id === 72 ? 0 : ((hsh & 7) - 3), jz = id === 72 ? 0 : (((hsh >> 3) & 7) - 3);
          const a = 2, b = 14, fl = id === 72 ? 0 : [0, 0, 1, 1];
          quadP(mbC, [bx + a + jx, by, bz + a + jz, bx + b + jx, by, bz + b + jz, bx + b + jx, by + 16, bz + b + jz, bx + a + jx, by + 16, bz + a + jz], layer, [0, 16, 16, 16, 16, 0, 0, 0], sky, blk, 235, fl, 0, true);
          quadP(mbC, [bx + a + jx, by, bz + b + jz, bx + b + jx, by, bz + a + jz, bx + b + jx, by + 16, bz + a + jz, bx + a + jx, by + 16, bz + b + jz], layer, [0, 16, 16, 16, 16, 0, 0, 0], sky, blk, 235, fl, 0, true);
          break;
        }
        case S_CROP: {
          const layer = TL_WHEAT[meta & 3], fl = [0, 0, 1, 1], uv = [0, 16, 16, 16, 16, 0, 0, 0];
          for (const o of [4, 12]) {
            quadP(mbC, [bx + o, by - 1, bz, bx + o, by - 1, bz + 16, bx + o, by + 15, bz + 16, bx + o, by + 15, bz], layer, uv, sky, blk, 235, fl, 0, true);
            quadP(mbC, [bx, by - 1, bz + o, bx + 16, by - 1, bz + o, bx + 16, by + 15, bz + o, bx, by + 15, bz + o], layer, uv, sky, blk, 235, fl, 0, true);
          }
          break;
        }
        case S_TORCH: {
          let cx = 8, cz = 8, tx = 8, tz = 8, y0 = 0;
          if (meta) { const d = F4[(meta - 1) & 3]; cx = 8 + d[0] * 7; cz = 8 + d[1] * 7; tx = 8 + d[0] * 3; tz = 8 + d[1] * 3; y0 = 3; }
          const y1 = y0 + 14, layer = tl[0], sb = 240;
          const P8 = (px, py, pz) => [bx + px, by + py, bz + pz];
          const b00 = P8(cx - 1, y0, cz - 1), b10 = P8(cx + 1, y0, cz - 1), b11 = P8(cx + 1, y0, cz + 1), b01 = P8(cx - 1, y0, cz + 1);
          const t00 = P8(tx - 1, y1, tz - 1), t10 = P8(tx + 1, y1, tz - 1), t11 = P8(tx + 1, y1, tz + 1), t01 = P8(tx - 1, y1, tz + 1);
          const suv = [7, 16, 9, 16, 9, 2, 7, 2];
          quadP(mbC, [...b01, ...b11, ...t11, ...t01], layer, suv, sky, sb, 235, 0, 0);
          quadP(mbC, [...b10, ...b00, ...t00, ...t10], layer, suv, sky, sb, 235, 0, 0);
          quadP(mbC, [...b11, ...b10, ...t10, ...t11], layer, suv, sky, sb, 210, 0, 0);
          quadP(mbC, [...b00, ...b01, ...t01, ...t00], layer, suv, sky, sb, 210, 0, 0);
          quadP(mbC, [...t01, ...t11, ...t10, ...t00], layer, [7, 4, 9, 4, 9, 2, 7, 2], sky, sb, 255, 0, 0);
          break;
        }
        case S_FLUID: {
          const isW = id === 7, buf = isW ? mbT : mbO, layer = tl[0], anim = isW ? 8 : 4, fl = isW ? 0 : 2;
          const ab = mB[pi + 324], full = ab === id;
          const h00 = full ? 16 : fluidCorner(pi - 19, id, 1, 1), h10 = full ? 16 : fluidCorner(pi - 18, id, 1, 1);
          const h01 = full ? 16 : fluidCorner(pi - 1, id, 1, 1), h11 = full ? 16 : fluidCorner(pi, id, 1, 1);
          let ls = sky, lb = blk;
          if (!full) { const la = mL[pi + 324]; if ((la >> 4) * 16 > ls) ls = (la >> 4) * 16; if ((la & 15) * 16 > lb) lb = (la & 15) * 16; }
          if (!full && !OPAQUE[ab]) {
            quadP(buf, [bx, by + h01, bz + 16, bx + 16, by + h11, bz + 16, bx + 16, by + h10, bz, bx, by + h00, bz], layer, [0, 16, 16, 16, 16, 0, 0, 0], ls, lb, 255, fl, anim, isW);
          }
          const nbm = mB[pi - 324];
          if (nbm !== id && !OPAQUE[nbm]) quadP(buf, [bx, by, bz, bx + 16, by, bz, bx + 16, by, bz + 16, bx, by, bz + 16], layer, [0, 16, 16, 16, 16, 0, 0, 0], ls, lb, 128, fl, anim);
          const side = (f, ha, hb, p0x, p0z, p1x, p1z) => {
            const nb = mB[pi + NOFF[f]];
            if (nb === id || OPAQUE[nb]) return;
            quadP(buf, [bx + p0x, by, bz + p0z, bx + p1x, by, bz + p1z, bx + p1x, by + hb, bz + p1z, bx + p0x, by + ha, bz + p0z], layer, [0, 16, 16, 16, 16, 16 - hb, 0, 16 - ha], ls, lb, SHTAB[f * 4 + 3], fl, anim, isW);
          };
          side(0, h11, h10, 16, 16, 16, 0); side(1, h00, h01, 0, 0, 0, 16);
          side(4, h01, h11, 0, 16, 16, 16); side(5, h10, h00, 16, 0, 0, 0);
          break;
        }
        case S_LAYER: _tl6.fill(tl[0]); emitBox(mbO, bx, by, bz, 0, 0, 0, 16, 2, 16, _tl6, pi, 2, false); break;
        case S_FARM: _tl6.set(tl); _tl6[2] = meta ? TEX.farmland_wet : TEX.farmland_dry; emitBox(mbO, bx, by, bz, 0, 0, 0, 16, 15, 16, _tl6, pi, 2, false); break;
        case S_CACTUS: emitBox(mbO, bx, by, bz, 1, 0, 1, 15, 16, 15, tl, pi, 2, false); break;
        case S_CHEST: {
          const front = F4_TO_FACE[meta & 3];
          for (let f = 0; f < 6; f++) _tl6[f] = (f === 2 || f === 3) ? tl[f] : (f === front ? tl[4] : tl[0]);
          emitBox(mbO, bx, by, bz, 1, 0, 1, 15, 14, 15, _tl6, pi, 2, false); break;
        }
        case S_BED: {
          const head = (meta & 4) !== 0;
          _tl6.fill(TEX.bed_side); _tl6[2] = head ? TEX.bed_top_head : TEX.bed_top_foot; _tl6[3] = TEX.planks_oak;
          emitBox(mbO, bx, by, bz, 0, 0, 0, 16, 9, 16, _tl6, pi, meta & 3, true); break;
        }
        case S_DOOR: {
          const b = doorBox(meta);
          _tl6.fill((meta & 8) ? TEX.door_top : TEX.door_bottom);
          emitBox(mbC, bx, by, bz, b[0] * 16, 0, b[2] * 16, b[3] * 16, 16, b[5] * 16, _tl6, pi, 2, true); break;
        }
        case S_LADDER: {
          const f = meta & 3, layer = tl[0], uv = [0, 16, 16, 16, 16, 0, 0, 0];
          if (f === 0) quadP(mbC, [bx + 16, by, bz + 15, bx, by, bz + 15, bx, by + 16, bz + 15, bx + 16, by + 16, bz + 15], layer, uv, sky, blk, 215, 0, 0, true);
          else if (f === 1) quadP(mbC, [bx + 1, by, bz + 16, bx + 1, by, bz, bx + 1, by + 16, bz, bx + 1, by + 16, bz + 16], layer, uv, sky, blk, 215, 0, 0, true);
          else if (f === 2) quadP(mbC, [bx, by, bz + 1, bx + 16, by, bz + 1, bx + 16, by + 16, bz + 1, bx, by + 16, bz + 1], layer, uv, sky, blk, 215, 0, 0, true);
          else quadP(mbC, [bx + 15, by, bz, bx + 15, by, bz + 16, bx + 15, by + 16, bz + 16, bx + 15, by + 16, bz], layer, uv, sky, blk, 215, 0, 0, true);
          break;
        }
      }
    }
  }
  const total = mbO.n + mbC.n + mbT.n;
  if (!total) return null;
  const data = new Uint8Array(total * 16);
  data.set(mbO.u8.subarray(0, mbO.n * 16), 0);
  data.set(mbC.u8.subarray(0, mbC.n * 16), mbO.n * 16);
  data.set(mbT.u8.subarray(0, mbT.n * 16), (mbO.n + mbC.n) * 16);
  return { data, nO: mbO.n, nC: mbC.n, nT: mbT.n };
}
