// ===== 11c_netent.js : 生き物・落とし物を全員で共有するしくみと、ほかの人の姿（見た目えらび・名前の札） =====
// 生き物と落とし物は「持ち主の端末」が動かして、位置を配る。ほかの人の画面では影（e.remote = true）として表示する。

// ---- 消えない生き物（動物）をしまう・もどす ----
function keepsMob(e) { return e.kind === 'mob' && !MOBS[e.type].hostile && e.hp > 0; }
function mobRec(e) { return [e.type, r2(e.x), r2(e.y), r2(e.z), Math.max(1, Math.ceil(e.hp)), r2(e.yaw)]; }
function spawnFromRec(r) {
  if (!r || !MOBS[r[0]]) return null;
  const e = spawnMob(r[0], +r[1], +r[2], +r[3]); e.hp = Math.min(e.maxHp, +r[4] || e.maxHp); e.yaw = e.pyaw = +r[5] || 0;
  return e;
}
function stashMob(world, e) {
  e.dead = true;
  const rec = mobRec(e);
  if (world.net) { world.net.stash(rec); return; }
  const k = world.key(Math.floor(e.x) >> 4, Math.floor(e.z) >> 4); let a = world.stash.get(k);
  if (!a) world.stash.set(k, a = []);
  a.push(rec);
}
// セーブ用：動いている動物と、しまってある動物をまとめる
function collectMobs(world) {
  const out = [];
  for (const e of ents) if (!e.remote && !e.dead && keepsMob(e)) out.push(mobRec(e));
  for (const a of world.stash.values()) for (const r of a) out.push(r);
  return out;
}
function restoreMobs(world, list) {
  if (!Array.isArray(list)) return;
  for (const r of list) { if (!r || !MOBS[r[0]]) continue; const k = world.key(Math.floor(r[1]) >> 4, Math.floor(r[3]) >> 4); let a = world.stash.get(k); if (!a) world.stash.set(k, a = []); a.push(r); }
}

// ---- ねらう相手・近くの人 ----
function mobTarget(e) {
  let best = player, bd = (player.dead || player.mode === 1) ? 1e9 : Math.hypot(player.x - e.x, player.y - e.y, player.z - e.z);
  if (net.on) for (const p of net.peers.values()) {
    if (p.dead || p.mode === 1 || p.dim !== game.world.dim || !net.fresh(p)) continue;
    const d = Math.hypot(p.x - e.x, p.y - e.y, p.z - e.z);
    if (d < bd) { bd = d; best = p; }
  }
  return best;
}
function hitTarget(T, amount, fx, fz, kb, src) {
  if (T === player) player.damage(amount, fx, fz, kb, src);
  else net.dm(T.pid, { t: 'dmg', a: r2(amount), x: r2(fx), z: r2(fz), k: kb, s: src });
}
function nearestPlayerDist(x, y, z) {
  let d = Math.hypot(player.x - x, player.y - y, player.z - z);
  if (net.on) for (const p of net.peers.values()) { if (p.dim !== game.world.dim || !net.fresh(p)) continue; d = Math.min(d, Math.hypot(p.x - x, p.y - y, p.z - z)); }
  return d;
}
function ownEnt(nid) { for (const e of ents) if (!e.remote && !e.dead && e.nid === nid) return e; return null; }
// 自分の画面では読みこまれていない場所にいる生き物
function offloadEnt(world, e) {
  if (e.kind !== 'mob') return;
  if (net.on) { const p = net.nearPeer(e.x, e.z); if (p && net._npd < 72) { netGive(e, p.pid); return; } }
  if (MOBS[e.type].boss) return;
  if (keepsMob(e)) { stashMob(world, e); return; }
  if (nearestPlayerDist(e.x, e.y, e.z) > 100) e.dead = true;
}
// 自分よりずっと近い人がいれば、その人の端末に動かしてもらう（ねらわれている人の画面で なめらかに動くように）
function handOver(e) {
  const p = net.nearPeer(e.x, e.z); if (!p) return;
  const dl = Math.hypot(player.x - e.x, player.z - e.z);
  if (net._npd + 10 < dl && dl > 18) netGive(e, p.pid);
}
function netGive(e, pid) {
  net.dm(pid, { t: 'give', n: e.nid, m: mobRec(e).concat([e.awake ? 1 : 0, Math.ceil(e.hp)]) });
  e.dead = true; e.given = true;
}
function netTake(m) {
  const p = net.peers.get(m.f), a = m.m; if (!a || !MOBS[a[0]]) return;
  let e = p ? p.ents.get(m.n) : null;
  if (e && e !== true && e.kind === 'mob' && !e.dead) { p.ents.set(m.n, true); e.remote = false; e.owner = null; e.nid = _nid++; e._ns = ''; }
  else e = spawnMob(a[0], a[1], a[2], a[3]);
  e.x = e.px = a[1]; e.y = e.py = a[2]; e.z = e.pz = a[3]; e.yaw = e.pyaw = a[5] || 0; e.awake = !!a[6]; e.hp = a[7] || a[4]; e.vx = e.vy = e.vz = 0;
  if (MOBS[e.type].boss) { game.boss = e; game.bossLost = 0; ui.dark(true); }
}

// ---- 送る側：自分が動かしているものの一覧 ----
function entRec(e) {
  if (e.kind === 'mob') return [e.nid, 0, e.type, r2(e.x), r2(e.y), r2(e.z), r2(e.yaw), Math.max(0, Math.ceil(e.hp)), (e.awake ? 1 : 0) | (e.swing > 0 ? 2 : 0) | (e.slam > 6 ? 4 : 0) | (e.onGround ? 8 : 0)];
  if (e.kind === 'item') return [e.nid, 1, e.id, e.n, e.d, r2(e.x), r2(e.y), r2(e.z)];
  if (e.kind === 'falling') return [e.nid, 2, e.id, r2(e.x), r2(e.y), r2(e.z)];
  return [e.nid, 3, e.dark ? 1 : 0, r2(e.x), r2(e.y), r2(e.z), r2(e.vx), r2(e.vy), r2(e.vz), e.dmg];
}
function netCollect(full) {
  const out = []; net.entTick = (net.entTick + 1) & 3;
  for (const e of ents) {
    if (e.remote || e.foreign || e.dead) continue;
    net.nearPeer(e.x, e.z); const dn = net._npd;
    if (dn > 64) { if (e._ns) { e._ns = ''; net.rmQ.push(e.nid); } continue; }
    if (e.kind === 'shot') { if (e._ns) continue; e._ns = '1'; out.push(entRec(e)); continue; }
    if (!full && e.kind === 'mob' && dn > 28 && net.entTick) continue;   // 遠い生き物は ゆっくり送る
    const r = entRec(e), s = r.join(',');
    if (!full && s === e._ns) continue;
    e._ns = s; out.push(r);
  }
  return out;
}

// ---- 受け取る側：影をつくる・動かす・消す ----
function netEnts(p, list, rm, full) {
  const seen = full ? new Set() : null;
  for (const r of list) {
    if (!Array.isArray(r)) continue;
    const nid = r[0]; if (seen) seen.add(nid);
    const e = p.ents.get(nid);
    if (e === true) continue;
    if (!e) { const n = mkPuppet(p, r); if (n) p.ents.set(nid, n); } else updPuppet(e, r);
  }
  if (rm) for (const nid of rm) dropPuppet(p, nid);
  if (seen) for (const nid of [...p.ents.keys()]) if (!seen.has(nid)) dropPuppet(p, nid);
}
function mkPuppet(p, r) {
  const k = r[1]; let e = null;
  if (k === 0) {
    if (!MOBS[r[2]]) return null;
    e = spawnMob(r[2], r[3], r[4], r[5]); e.yaw = e.pyaw = r[6]; e.hp = r[7]; e.awake = !!(r[8] & 1); e.onGround = !!(r[8] & 8);
    if (MOBS[r[2]].boss && r[7] > 0) { game.boss = e; game.bossLost = 0; ui.dark(true); }
  } else if (k === 1) { e = spawnDrop(r[5], r[6], r[7], r[2], r[3], r[4], 0, 0, 0, 0); if (!e) return null; }
  else if (k === 2) { e = addEnt({ kind: 'falling', x: r[3], y: r[4], z: r[5], px: r[3], py: r[4], pz: r[5], vx: 0, vy: 0, vz: 0, hw: 0.49, h: 0.98, id: r[2], age: 0, dead: false, onGround: false }); }
  else { const s = spawnShot(r[3] + r[6] * 0.15, r[4] + r[7] * 0.15, r[5] + r[8] * 0.15, r[6], r[7], r[8], r[9], r[2]); s.foreign = true; return true; }   // 弾は、見えた人それぞれの画面で飛ばす（よけやすいように）
  e.remote = true; e.owner = p.pid; e.rnid = r[0]; e.tx = e.x; e.ty = e.y; e.tz = e.z; e.tyaw = e.yaw || 0;
  return e;
}
function updPuppet(e, r) {
  if (e.kind === 'mob') {
    e.tx = r[3]; e.ty = r[4]; e.tz = r[5]; e.tyaw = r[6];
    const hp = r[7], b = r[8], d = MOBS[e.type];
    if (hp < e.hp) { e.hurt = 10; sfxAt((hp <= 0 ? 'die_' : 'hurt_') + d.voice, e.x, e.y, e.z); if (hp <= 0 && !e.death) e.death = 1; }
    e.hp = hp; e.awake = !!(b & 1); e.onGround = !!(b & 8);
    if ((b & 2) && !e._sw) e.swing = d.boss ? 20 : 8; e._sw = !!(b & 2);
    if ((b & 4) && !e._sl) e.slam = 20; e._sl = !!(b & 4);
  } else if (e.kind === 'item') { e.n = r[3]; e.tx = r[5]; e.ty = r[6]; e.tz = r[7]; }
  else { e.tx = r[3]; e.ty = r[4]; e.tz = r[5]; }
}
function dropPuppet(p, nid) {
  const e = p.ents.get(nid); if (e === undefined) return;
  p.ents.delete(nid);
  if (e === true) return;
  e.dead = true;
  if (e.kind === 'mob' && e.hp <= 0) { const boss = MOBS[e.type].boss; fxPuff(e.x, e.y + e.h * 0.5, e.z, boss ? 60 : 10, 0.85, 0.85, 0.85, { speed: boss ? 5 : 1.5, life: 0.9, size: 0.1, spread: e.hw * 2 }); }
}
function puppetTick(world, e) {
  e.age++; if (e.hurt > 0) e.hurt--;
  const ox = e.x, oz = e.z;
  e.x += (e.tx - e.x) * 0.45; e.y += (e.ty - e.y) * 0.45; e.z += (e.tz - e.z) * 0.45;
  if (e.kind === 'mob') {
    if (e.swing > 0) e.swing--;
    if (e.slam > 0) { e.slam--; if (e.slam === 6) kingSlamFx(e); }
    if (e.hp <= 0) e.death++;
    e.yaw = lerpAngle(e.yaw, e.tyaw, 0.45);
    const moved = Math.hypot(e.x - ox, e.z - oz);
    e.walk += moved * 2.6; e.walkAmp += (Math.min(1, moved * 14) - e.walkAmp) * 0.3;
    if (e.type === 'wisp' && e.age % 3 === 0) fxPuff(e.x, e.y + 0.3, e.z, 1, 0.45, 0.8, 1, { glow: true, speed: 0.3, life: 0.5, size: 0.06, up: -0.2, grav: 0 });
  } else if (e.kind === 'item') {
    if (!player.dead && (e.pickCd = (e.pickCd || 0) - 1) <= 0) {
      const dx = player.x - e.x, dy = player.y + 0.8 - e.y, dz = player.z - e.z;
      if (dx * dx + dy * dy + dz * dz < 1.8 && player.canTake(e.id, e.d)) { e.pickCd = 14; net.dm(e.owner, { t: 'pick', n: e.rnid }); }
    }
  }
}
function kingSlamFx(e) {
  sfxAt('slam', e.x, e.y, e.z);
  if (Math.hypot(player.x - e.x, player.z - e.z) < 24) game.shake = 0.5;
  for (let i = 0; i < 40; i++) { const a = i / 40 * 6.283; fxPuff(e.x + Math.cos(a) * 2, e.y + 0.2, e.z + Math.sin(a) * 2, 1, 0.4, 0.25, 0.8, { glow: true, speed: 3, life: 0.7, size: 0.12, up: 1.5, grav: 6 }); }
}
// 個別の連絡を受け取ったとき
net.onDm = function (raw) {
  let m; try { m = JSON.parse(raw); } catch (e) { return; }
  if (!m || !this.world) return;
  const from = this.peers.get(m.f);
  switch (m.t) {
    case 'hit': { const e = ownEnt(m.n); if (e && e.kind === 'mob' && e.hurt <= 5) { e.hurt = 0; e.lastBy = m.f; hurtMob(e, +m.d || 1, +m.x || 0, +m.z || 0, m.k); } break; }   // たたいた側で間隔は見ているので、こちらでは少しゆるく受け付ける
    case 'dmg': if (!player.dead) player.damage(+m.a || 0, +m.x || 0, +m.z || 0, +m.k || 0, String(m.s || '')); break;
    case 'pvp': if (game.rules.pvp && !player.dead) player.damage(+m.a || 0, +m.x || 0, +m.z || 0, +m.k || 0, from ? from.name : 'だれか'); break;
    case 'pick': { const e = ownEnt(m.n); if (e && e.kind === 'item' && e.age > e.delay) { e.dead = true; this.dm(m.f, { t: 'got', id: e.id, c: e.n, d: e.d }); } break; }
    case 'got': {
      if (!ITEMS[m.id]) break;
      const left = player.give(m.id, m.c, m.d);
      if (left < m.c) { sfx('pop'); ui.pickupFx(m.id, m.c - left); player.stat('pick', m.id); }
      if (left > 0) spawnDrop(player.x, player.y + 0.8, player.z, m.id, left, m.d);
      break;
    }
    case 'give': netTake(m); break;
    case 'adopted': if (Array.isArray(m.ids)) for (const nid of m.ids) { const e = ownEnt(nid); if (e) { e.dead = true; e._ns = ''; } } break;   // 通信が切れている間に、ほかの人が引き取った分
    case 'kill': player.onKill({ type: m.ty }); break;
  }
};

// ---------------- ほかの人の姿 ----------------
// 見た目：[はだ, かみの色, かみがた, 服, ズボン]
const LOOK_SKIN = ['#f3cba4', '#dfa97a', '#b47d52', '#7c5034'];
const LOOK_HAIR = ['#2b2118', '#6b4424', '#d9b25a', '#b5482a', '#d9d9de', '#3b5fa8'];
const LOOK_SHIRT = ['#d6453a', '#3f7fd6', '#3fa35a', '#e3b53a', '#8a5bd0', '#e98a2e', '#3bb7b2', '#e87fb0'];
const LOOK_PANTS = ['#34405e', '#5a4632', '#3a3a3e', '#6f7f90'];
const LOOK_STYLE = ['みじかい', 'ながい', 'ぼうし', 'ぼうず'];
const LOOK_MAX = [LOOK_SKIN.length, LOOK_HAIR.length, LOOK_STYLE.length, LOOK_SHIRT.length, LOOK_PANTS.length];
function parseLook(v) {
  const a = Array.isArray(v) ? v : String(v || '').split(',').map(Number), o = [0, 0, 0, 0, 0];
  for (let i = 0; i < 5; i++) { const n = a[i] | 0; o[i] = n >= 0 && n < LOOK_MAX[i] ? n : 0; }
  return o;
}
function humanParts() {
  return [part('head', -4, 24, -4, 4, 32, 4, 0, 24, 0), part('body', -4, 12, -2, 4, 24, 2, 0, 12, 0),
    part('arm0', -8, 12, -2, -4, 24, 2, -6, 22, 0), part('arm1', 4, 12, -2, 8, 24, 2, 6, 22, 0),
    part('leg0', -4, 0, -2, 0, 12, 2, -2, 12, 0), part('leg1', 0, 0, -2, 4, 12, 2, 2, 12, 0)];
}
function shadeC(c, k) { return [Math.min(255, Math.round(c[0] * k)), Math.min(255, Math.round(c[1] * k)), Math.min(255, Math.round(c[2] * k))]; }
// 人の体の1面をドットで描く。f: 0,1=横 2=上 3=下 4=うしろ 5=前
function paintHuman(id, f, g, look) {
  const skin = C(LOOK_SKIN[look[0]]), hair = C(LOOK_HAIR[look[1]]), style = look[2], shirt = C(LOOK_SHIRT[look[3]]), pants = C(LOOK_PANTS[look[4]]);
  const top = f === 2, bottom = f === 3, front = f === 5, back = f === 4, side = f < 2;
  const fillN = (c, amt) => { for (let y = 0; y < g.h; y++) for (let x = 0; x < g.w; x++) g.px(x, y, shadeC(c, 1 - amt + ((x * 7 + y * 13 + f * 5) % 5) * amt * 0.5)); };
  if (id === 'head') {
    const cap = style === 2 ? shadeC(shirt, 0.85) : null, hc = cap || (style === 3 ? shadeC(skin, 0.72) : hair);
    if (top) { fillN(hc, 0.1); return; }
    fillN(skin, 0.05);
    if (bottom) return;
    const rows = style === 3 ? 1 : 2;
    g.rect(0, 0, g.w, rows, hc);
    if (front) {
      if (style === 0) { g.px(0, 2, hc); g.px(7, 2, hc); }
      if (style === 1) { g.rect(0, 2, 1, 5, hc); g.rect(7, 2, 1, 5, hc); g.px(1, 2, hc); g.px(6, 2, hc); }
      if (cap) g.rect(0, 2, 8, 1, shadeC(shirt, 0.6));
      g.px(1, 4, [250, 250, 250]); g.px(2, 4, [38, 30, 30]); g.px(5, 4, [38, 30, 30]); g.px(6, 4, [250, 250, 250]);
      g.px(3, 6, shadeC(skin, 0.68)); g.px(4, 6, shadeC(skin, 0.68));
    } else if (back) { g.rect(0, 0, g.w, style === 1 ? 8 : style === 3 ? 2 : style === 2 ? 3 : 5, hc); if (style === 2) g.rect(0, 3, g.w, 2, hair); }
    else { g.rect(0, 0, g.w, style === 3 ? 2 : 3, hc); if (style === 1) g.rect(f === 0 ? 0 : 4, 3, 4, 5, hc); if (style === 2) g.rect(0, 2, g.w, 1, shadeC(shirt, 0.6)); }
    return;
  }
  if (id === 'body') {
    if (bottom) { fillN(pants, 0.08); return; }
    fillN(shirt, 0.08);
    if (top) return;
    if (front) { g.px(3, 0, skin); g.px(4, 0, skin); g.px(3, 1, shadeC(shirt, 0.75)); g.px(4, 1, shadeC(shirt, 0.75)); g.rect(5, 4, 2, 2, shadeC(shirt, 0.8)); }
    g.rect(0, g.h - 1, g.w, 1, shadeC(pants, 0.7));
    if (!side) { for (let y = 0; y < g.h - 1; y++) { g.px(0, y, shadeC(shirt, 0.86)); g.px(g.w - 1, y, shadeC(shirt, 0.86)); } }
    return;
  }
  if (id.startsWith('arm')) {
    if (top) { fillN(shirt, 0.08); return; }
    fillN(skin, 0.05);
    if (bottom) return;
    g.rect(0, 0, g.w, 5, shirt); g.rect(0, 4, g.w, 1, shadeC(shirt, 0.78)); g.rect(0, g.h - 1, g.w, 1, shadeC(skin, 0.85));
    return;
  }
  fillN(pants, 0.08);
  if (bottom) { fillN([52, 44, 40], 0.05); return; }
  if (!top) g.rect(0, g.h - 2, g.w, 2, [52, 44, 40]);
}
let MOB_CV = null;
// 参加者ごとの見た目を、生き物の絵の中の自分の場所に描きなおす（slot 0 は自分）
function paintSkin(slot, look) {
  const cv = MOB_CV, model = MODELS['pl' + slot]; if (!cv || !model) return;
  const ctx = cv.getContext('2d'), im = ctx.getImageData(0, 0, cv.width, cv.height), d = im.data, W = cv.width;
  for (const p of model) for (let f = 0; f < 6; f++) {
    const u = p.uv[f], sx = u[0], sy = u[1], fw = u[2], fh = u[3];
    const g = { w: fw, h: fh, px(x, y, c) { if (x >= 0 && x < fw && y >= 0 && y < fh) { const i = ((sy + y) * W + sx + x) * 4; d[i] = c[0]; d[i + 1] = c[1]; d[i + 2] = c[2]; d[i + 3] = 255; } }, rect(x0, y0, w2, h2, c) { for (let y = y0; y < y0 + h2; y++) for (let x = x0; x < x0 + w2; x++) g.px(x, y, c); } };
    paintHuman(p.id, f, g, look);
  }
  ctx.putImageData(im, 0, 0);
  uploadMobTexture(cv);
}
// 設定画面用：正面から見た姿を小さなキャンバスに描く
function drawLookPreview(cv, look) {
  const ctx = cv.getContext('2d'); cv.width = 16; cv.height = 32; ctx.clearRect(0, 0, 16, 32);
  const put = (id, ox, oy, w, h) => {
    const g = { w, h, px(x, y, c) { if (x >= 0 && x < w && y >= 0 && y < h) { ctx.fillStyle = 'rgb(' + c[0] + ',' + c[1] + ',' + c[2] + ')'; ctx.fillRect(ox + x, oy + y, 1, 1); } }, rect(x0, y0, w2, h2, c) { for (let y = y0; y < y0 + h2; y++) for (let x = x0; x < x0 + w2; x++) g.px(x, y, c); } };
    paintHuman(id, 5, g, look);
  };
  put('head', 4, 0, 8, 8); put('body', 4, 8, 8, 12); put('arm0', 0, 8, 4, 12); put('arm1', 12, 8, 4, 12); put('leg0', 4, 20, 4, 12); put('leg1', 8, 20, 4, 12);
}
const _hm = m4(), _hp = m4(), _ht = m4(), _hi = m4();
function drawPeers(world, cam) {
  for (const p of net.peers.values()) {
    if (p.dead || p.y < -900 || p.dim !== world.dim || !net.fresh(p)) continue;
    const x = p.x - cam.x, y = p.y - cam.y, z = p.z - cam.z;
    if (x * x + z * z > 100 * 100) continue;
    drawHuman(world, MODELS['pl' + p.slot], p, x, y, z);
  }
}
// 自分の姿（うしろから／前から見るとき）
const _self = { x: 0, y: 0, z: 0, yaw: 0, pitch: 0, walk: 0, walkAmp: 0, swingT: 0, sneaking: false, sleeping: false, held: 0, hurtT: 0, eating: false };
function drawSelf(world, cam) {
  const p = player, s = _self, h = p.held();
  s.x = p.x; s.y = p.y; s.z = p.z; s.yaw = p.yaw; s.pitch = p.pitch; s.walk = p.bob * 1.9; s.walkAmp = p.bobAmp; s.swingT = p.swingT; s.sneaking = p.sneaking; s.sleeping = game.inBed;
  s.held = h ? h.id : 0; s.hurtT = p.hurtT > 0 ? 1 : 0; s.eating = p.eating > 0;
  drawHuman(world, MODELS.pl0, s, p.x - cam.x, p.y - cam.y, p.z - cam.z);
}
// 人の形を描く。p: {x,y,z,yaw,pitch,walk,walkAmp,swingT,sneaking,sleeping,held,hurtT,eating}
function drawHuman(world, model, p, x, y, z) {
  const sc = 0.9 / 16;
  lightRGB(world.getLightRaw(Math.floor(p.x), Math.floor(p.y + 1), Math.floor(p.z)), _lcE);
  let r = _lcE[0], g = _lcE[1], b = _lcE[2];
  if (p.hurtT > 0) { r = Math.min(1.2, r * 1.6 + 0.2); g *= 0.45; b *= 0.45; }
  m4Translate(_hm, x, y, z); m4RotY(_mr, p.yaw); m4Mul(_hm, _hm, _mr);
  if (p.sleeping) { m4Translate(_mr, 0, 0.22, -0.9); m4Mul(_hm, _hm, _mr); m4RotX(_mr, Math.PI / 2); m4Mul(_hm, _hm, _mr); }
  m4Scale(_mr, sc, sc, sc); m4Mul(_hm, _hm, _mr);
  const sw = p.sleeping ? 0 : Math.sin(p.walk) * p.walkAmp, sn = p.sneaking && !p.sleeping, sp = p.swingT > 0 ? Math.sin((1 - p.swingT) * Math.PI) : 0;
  let handM = null;
  for (const pt of model) {
    let rx = 0, rz = 0, oy = sn ? -2 : 0, oz = 0; const id = pt.id;
    if (id === 'head') { rx = p.sleeping ? 0 : clamp(p.pitch, -1.2, 1.2); if (sn) { oy -= 1; oz = -4.5; } }
    else if (id === 'body') { if (sn) rx = -0.4; }
    else if (id === 'arm0') { rx = -sw * 0.8; rz = -0.04; if (sn) { oy -= 1; oz = -4; rx += 0.25; } }
    else if (id === 'arm1') { rx = sw * 0.8 + (p.held ? 0.32 : 0) + sp * 1.5 + (p.eating ? 1.2 + Math.sin(R.time * 22) * 0.12 : 0); rz = 0.04; if (sn) { oy -= 1; oz = -4; rx += 0.25; } }
    else if (id === 'leg0') rx = sw * 0.9;
    else if (id === 'leg1') rx = -sw * 0.9;
    let M = _hm;
    if (rx || rz || oy || oz) {
      m4Translate(_hp, pt.pv[0], pt.pv[1] + oy, pt.pv[2] + oz);
      if (rz) { m4RotZ(_ht, rz); m4Mul(_hp, _hp, _ht); }
      if (rx) { m4RotX(_ht, rx); m4Mul(_hp, _hp, _ht); }
      m4Translate(_ht, -pt.pv[0], -pt.pv[1], -pt.pv[2]); m4Mul(_hp, _hp, _ht);
      m4Mul(_hp, _hm, _hp); M = _hp;
    }
    if (id === 'arm1' && p.held && ITEMS[p.held]) { handM = _hi; m4Translate(_ht, 6, 12.5, -1.5); m4Mul(handM, M, _ht); }
    const bb = pt.b;
    for (let f = 0; f < 6; f++) {
      const uv = pt.uv[f], sh = FACE_SHADE[f] * 0.9 + 0.1;
      for (let k = 0; k < 4; k++) {
        const c = (f * 4 + k) * 3;
        m4Point(_pp, M, CPOS[c] ? bb[3] : bb[0], CPOS[c + 1] ? bb[4] : bb[1], CPOS[c + 2] ? bb[5] : bb[2]);
        dynEnt.v(_pp[0], _pp[1], _pp[2], (uv[0] + 0.02 + CORNER_UV[k][0] * (uv[2] - 0.04)) / MOB_TEX, (uv[1] + 0.02 + (1 - CORNER_UV[k][1]) * (uv[3] - 0.04)) / MOB_TEX, 0, r * sh, g * sh, b * sh, 1);
      }
    }
  }
  if (handM) {   // 手に持っている物
    const cube = p.held < 256 && !ICON[p.held], s = cube ? 4.6 : 8.5;
    if (cube) { m4RotY(_ht, 0.6); m4Mul(handM, handM, _ht); }
    else { m4RotY(_ht, Math.PI / 2); m4Mul(handM, handM, _ht); m4RotZ(_ht, -0.9); m4Mul(handM, handM, _ht); m4Translate(_ht, 2.5, 2.5, 0); m4Mul(handM, handM, _ht); }
    m4Scale(_ht, s, s, s); m4Mul(handM, handM, _ht);
    addItemModel(dynTex, dynCol, handM, p.held, r, g, b);
  }
}
// 名前の札（かべごしでも見える。遠いと距離を出す。画面の外にいるときは、いる方向のはしに出す）
function updTags(cam) {
  const box = $('ntags'); if (!box) return;
  const W = box.clientWidth || innerWidth, H = box.clientHeight || innerHeight, m = R.vp;
  for (const p of net.peers.values()) {
    const show = net.on && !p.dead && p.y > -900 && p.dim === game.world.dim && net.fresh(p) && game.state !== 'loading';
    if (!show) { if (p.tag) p.tag.hidden = true; continue; }
    if (!p.tag) { p.tag = document.createElement('div'); p.tag.className = 'ntag'; p.tag.innerHTML = '<i></i><b></b><span></span>'; box.appendChild(p.tag); }
    const t = p.tag; t.hidden = false;
    const x = p.x - cam.x, y = p.y + (p.sneaking ? 1.75 : 2.05) - cam.y, z = p.z - cam.z, dist = Math.hypot(x, p.y - cam.y, z);
    let cx = m[0] * x + m[4] * y + m[8] * z + m[12], cy = m[1] * x + m[5] * y + m[9] * z + m[13]; const cw = m[3] * x + m[7] * y + m[11] * z + m[15];
    let nx, ny, off = false;
    if (cw > 0.05) { nx = cx / cw; ny = cy / cw; if (Math.abs(nx) > 0.94 || Math.abs(ny) > 0.9) off = true; }
    else { nx = -cx; ny = -cy; off = true; if (!nx && !ny) ny = -1; }
    if (off) { const k = 1 / Math.max(Math.abs(nx) / 0.9, Math.abs(ny) / 0.82, 1e-6); nx *= k; ny *= k; if (cw <= 0.05 && Math.abs(nx) < 0.9 && Math.abs(ny) < 0.82) { ny = -0.82; } }
    const name = p.name, far = dist > 14 ? Math.round(dist) + 'm' : '';
    if (t._n !== name) { t._n = name; t.children[1].textContent = name; }
    if (t._d !== far) { t._d = far; t.children[2].textContent = far; }
    const col = LOOK_SHIRT[p.look[3]]; if (t._c !== col) { t._c = col; t.children[0].style.background = col; }
    t.classList.toggle('edge', off);
    t.style.transform = 'translate(' + Math.round((nx + 1) / 2 * W) + 'px,' + Math.round((1 - ny) / 2 * H) + 'px) translate(-50%,-100%)';
  }
}
function pickPeer(ox, oy, oz, dx, dy, dz, maxDist) {
  let best = null, bt = maxDist;
  if (net.on) for (const p of net.peers.values()) {
    if (p.dead || p.dim !== game.world.dim || !net.fresh(p)) continue;
    const h = rayBox(ox, oy, oz, dx, dy, dz, p.x - 0.4, p.y, p.z - 0.4, p.x + 0.4, p.y + 1.8, p.z + 0.4);
    if (h && h.t < bt) { bt = h.t; best = p; }
  }
  return best;
}
