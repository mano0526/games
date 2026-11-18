// ===== 10c_weather.js : 天気（晴れ・雨／雪・かみなり） =====
// 天気は「種」と「時計」だけで決まる（通信しなくても 全員が同じ天気になる）。時計は、1人用＝世界の刻み、みんなの世界＝サーバーの時計
const WX_SLOT = 4800;   // 天気の ひとこま（4分）
const WX_COLD = new Uint8Array(32); [BIOME.SNOW, BIOME.ICE, BIOME.SNOW_TAIGA, BIOME.SNOW_PEAK, BIOME.FROZEN].forEach(b => { WX_COLD[b] = 1; });
[BIOME.DESERT, BIOME.BADLANDS].forEach(b => { WX_COLD[b] = 2; });   // 2＝かわいた所（雨が ふらない）
// そのこまの天気：0 晴れ／1 雨（寒い所は雪）／2 かみなり。雨は 2こま つづくことがある。最初の3こまは 晴れ
function weatherAt(seed, slot) {
  if (slot < 3) return 0;
  const h = hash2(slot, 77, seed ^ 0x3EA7) >>> 0, h0 = hash2(slot - 1, 77, seed ^ 0x3EA7) >>> 0;
  const start = (h & 1023) < 135, cont = (h0 & 1023) < 135 && ((h0 >> 10) & 1) === 1;
  if (!start && !cont) return 0;
  return (((start ? h : h0) >> 11) & 3) === 0 ? 2 : 1;
}
const WX = {
  kind: 0, amt: 0, storm: 0, flash: 0, force: null, dry: false, nextBolt: 100, bolt: null, hx: 1e9, hz: 0, hT: -9, R: 9,
  H: new Int16Array(19 * 19), C: new Uint8Array(19 * 19), snowy: false, drip: 0,
  clock() { return net.on ? Math.floor(net.now() / 50) : game.world.tick; },
  reset() { this.kind = 0; this.amt = 0; this.storm = 0; this.flash = 0; this.bolt = null; this.hx = 1e9; R.wx = 0; R.wxStorm = 0; R.flash = 0; audio.rain(0, false); },
  // 空が見えているか（上に 屋根がないか）
  open(world, x, y, z) { const s = world.surfaceY(Math.floor(x), Math.floor(z)); return s >= 0 && s < y + 0.5; },
  // 1/20秒ごと
  tick(world) {
    const k = world.dim || game.isDemo ? 0 : this.force !== null ? this.force : weatherAt(world.seed, Math.floor(this.clock() / WX_SLOT));
    if (k !== this.kind) {
      const was = this.kind; this.kind = k;
      if (game.state === 'playing' && !world.dim) ui.toast(k === 2 ? 'かみなりが 鳴りはじめた' : k === 1 ? (was === 2 ? 'かみなりが おさまった' : this.dry ? '空が くもってきた' : this.snowy ? '雪が ふってきた' : '雨が ふってきた') : (this.dry ? '空が 晴れてきた' : this.snowy ? '雪が やんだ' : '雨が あがった'), 3);
    }
    world.wx = k;
    this.amt += ((k ? 1 : 0) - this.amt) * 0.012; if (this.amt < 0.004 && !k) this.amt = 0;
    this.storm += ((k === 2 ? 1 : 0) - this.storm) * 0.012; if (this.storm < 0.004 && k !== 2) this.storm = 0;
    if (world.dim) return;
    const pb = WX_COLD[world.biomeAt(Math.floor(player.x), Math.floor(player.z))];
    this.snowy = pb === 1 || (player.y > 104 && pb !== 2); this.dry = pb === 2;
    if (this.amt > 0.5 && !this.snowy && !this.dry && player.burnT > 0 && this.open(world, player.x, player.y, player.z)) { player.burnT = 0; sfx('fizz', 0.5); }   // 雨で 火が消える
    if (k === 2 && this.amt > 0.7 && --this.nextBolt <= 0) { this.nextBolt = 110 + ((Math.random() * 260) | 0); this.strike(world); }
  },
  // かみなり：近くに落ちる（見た目と音だけ）。音は 遠いほど おくれて とどく
  strike(world) {
    const a = Math.random() * 6.283, d = 22 + Math.random() * 70, x = Math.floor(player.x + Math.cos(a) * d), z = Math.floor(player.z + Math.sin(a) * d);
    let y = world.surfaceY(x, z); if (y < 0) y = Math.floor(player.y);
    const pts = []; let px = x + 0.5, pz = z + 0.5;
    for (let yy = y + 1; yy < y + 60; yy += 5) { pts.push(px, yy, pz); px += (Math.random() - 0.5) * 5; pz += (Math.random() - 0.5) * 5; }
    this.bolt = { pts, t: 0.3 }; this.flash = 1;
    setTimeout(() => { if (game.state === 'playing') sfx('thunder', clamp(1.2 - d / 110, 0.25, 1)); }, d * 9);
  },
  // 毎フレーム：空の色・音に つたえる
  frame(world, dt) {
    this.flash = Math.max(0, this.flash - dt * 3.2);
    if (this.bolt && (this.bolt.t -= dt) <= 0) this.bolt = null;
    const on = !world.dim && game.state !== 'title';
    R.wx = on ? this.amt : 0; R.wxStorm = on ? this.storm : 0; R.flash = on ? this.flash : 0;
    const out = on && this.amt > 0.02 && !this.snowy && !this.dry ? this.open(world, player.x, player.eyeY(), player.z) : false;
    audio.rain(on && !this.snowy && !this.dry && game.state === 'playing' ? this.amt * (out ? 1 : 0.3) : 0, !out);
  },
  // 雨つぶ・雪を描く。カメラのまわりのマスごとに 3本。屋根や地面より下は 描かない
  draw(world, cam) {
    const a = this.amt; if (world.dim) return;
    if (this.bolt) { const p = this.bolt.pts, k = Math.min(1, this.bolt.t / 0.12); for (let i = 0; i + 5 < p.length; i += 3) this.seg(cam, p[i], p[i + 1], p[i + 2], p[i + 3], p[i + 4], p[i + 5], 0.22, 0.9 * k, 0.92 * k, 1 * k); }
    if (a < 0.02 || settings.rainFx === false) return;
    const Rr = this.R, W = 2 * Rr + 1, cx = Math.floor(cam.x), cz = Math.floor(cam.z), t = R.time;
    if (cx !== this.hx || cz !== this.hz || t - this.hT > 1.5 || t < this.hT) {   // 地面（屋根）の高さと 寒さを おぼえなおす
      this.hx = cx; this.hz = cz; this.hT = t;
      for (let dz = -Rr; dz <= Rr; dz++) for (let dx = -Rr; dx <= Rr; dx++) { const i = (dz + Rr) * W + dx + Rr, s = world.surfaceY(cx + dx, cz + dz); this.H[i] = s; const wb = WX_COLD[world.biomeAt(cx + dx, cz + dz)]; this.C[i] = wb === 2 ? 2 : s >= 0 && (wb === 1 || s > 102) ? 1 : 0; }
    }
    const rx = Math.cos(cam.yaw), rz = -Math.sin(cam.yaw), day = 0.45 + 0.55 * R.sky.day, span = 18;
    for (let dz = -Rr; dz <= Rr; dz++) for (let dx = -Rr; dx <= Rr; dx++) {
      const d2 = dx * dx + dz * dz; if (d2 > Rr * Rr) continue;
      const i = (dz + Rr) * W + dx + Rr, h = this.H[i]; if (h < 0 || this.C[i] === 2) continue;
      const cold = this.C[i] === 1, fade = Math.sqrt(1 - Math.sqrt(d2) / (Rr + 0.5));
      for (let k = 0; k < 3; k++) {
        const hs = hash2(cx + dx + k * 977, cz + dz, 0x5EED) >>> 0;
        if (((hs >>> 26) & 63) / 63 > a) continue;   // 降りはじめ・やみぎわは まばらに
        const ph = ((hs >>> 16) & 1023) / 1023, sp = cold ? 2.4 + ph : 17 + ph * 5, len = cold ? 0.07 : 0.7;
        const y = cam.y + 9 - ((t * sp + ph * span) % span);
        if (y < h + 1) continue;
        let x = cx + dx + (hs & 255) / 255 - cam.x, z = cz + dz + ((hs >>> 8) & 255) / 255 - cam.z; const yy = y - cam.y;
        if (cold) { x += Math.sin(t * 1.3 + ph * 40) * 0.3; z += Math.cos(t * 1.1 + ph * 31) * 0.3; }
        if (x * x + z * z < (cold ? 1.6 : 0.5)) continue;   // 目の前すぎる つぶは 描かない（大きく うつりすぎる）
        const w = cold ? 0.04 : 0.014, al = (cold ? 0.85 : 0.5) * fade, c = cold ? day : day * 0.8;
        dynGlow.v(x - rx * w, yy, z - rz * w, 0, 0, 0, c * 0.85, c * 0.92, c, al); dynGlow.v(x + rx * w, yy, z + rz * w, 0, 0, 0, c * 0.85, c * 0.92, c, al);
        dynGlow.v(x + rx * w, yy + len, z + rz * w, 0, 0, 0, c * 0.85, c * 0.92, c, al); dynGlow.v(x - rx * w, yy + len, z - rz * w, 0, 0, 0, c * 0.85, c * 0.92, c, al);
      }
    }
    // 地面の しぶき（雨だけ）
    this.drip += a * 0.5;
    while (this.drip >= 1) {
      this.drip -= 1;
      const dx = ((Math.random() * 13) | 0) - 6, dz = ((Math.random() * 13) | 0) - 6, i = (dz + Rr) * W + dx + Rr, h = this.H[i];
      if (h >= 0 && !this.C[i] && Math.abs(h + 1 - cam.y) < 8) fxPuff(cx + dx + Math.random(), h + 1.02, cz + dz + Math.random(), 1, 0.75, 0.85, 1, { speed: 0.8, life: 0.25, size: 0.035, up: 1.2, grav: 9 });
    }
  },
  // 光る線（かみなり）：2点を むすぶ 細長い板を 2まい（たて・よこ）
  seg(cam, x0, y0, z0, x1, y1, z1, w, r, g, b) {
    const ax = x0 - cam.x, ay = y0 - cam.y, az = z0 - cam.z, bx = x1 - cam.x, by = y1 - cam.y, bz = z1 - cam.z;
    for (const [ox, oz] of [[w, 0], [0, w]]) {
      dynGlow.v(ax - ox, ay, az - oz, 0, 0, 0, r, g, b, 1); dynGlow.v(ax + ox, ay, az + oz, 0, 0, 0, r, g, b, 1); dynGlow.v(bx + ox, by, bz + oz, 0, 0, 0, r, g, b, 1); dynGlow.v(bx - ox, by, bz - oz, 0, 0, 0, r, g, b, 1);
    }
  }
};
