// ===== 08_entities.js : 落ちているアイテム・落下ブロック・動物・敵・ボス =====
let ents = [];
let _nid = 1;            // 生き物・落とし物の通し番号（みんなで遊ぶとき、どれのことか伝えるのに使う）
const MOB_TEX = 512;     // 生き物の絵をまとめた画像の大きさ
function addEnt(e) { e.nid = _nid++; ents.push(e); return e; }
const _cb = [];
// 段差（0.6マスまで）を のぼりながら動く。のぼった高さを返す。階段やハーフブロックを ジャンプなしで歩けるように
function moveStep(world, e, dx, dy, dz, step) {
  const x = e.x, y = e.y, z = e.z, vx = e.vx, vz = e.vz, wasG = e.onGround;
  moveAABB(world, e, dx, dy, dz);
  if (!e.hitH || step <= 0 || !(wasG || e.onGround) || (dx === 0 && dz === 0)) return 0;
  const ax = e.x, ay = e.y, az = e.z, aG = e.onGround, avx = e.vx, avy = e.vy, avz = e.vz;
  e.x = x; e.y = y; e.z = z;
  moveAABB(world, e, 0, step, 0);                       // いったん上がる
  const up = e.y - y;
  if (up > 0.01) {
    e.vx = vx; e.vz = vz;
    moveAABB(world, e, dx, 0, dz);                      // 進む
    const hit2 = e.hitH, bvx = e.vx, bvz = e.vz;
    moveAABB(world, e, 0, -up - 0.001, 0);              // おろす
    const d1 = (ax - x) * (ax - x) + (az - z) * (az - z), d2 = (e.x - x) * (e.x - x) + (e.z - z) * (e.z - z);
    if (e.onGround && d2 > d1 + 1e-7 && e.y > y + 0.01) { e.hitH = hit2; e.vx = bvx; e.vz = bvz; e.vy = 0; return e.y - y; }
  }
  e.x = ax; e.y = ay; e.z = az; e.onGround = aG; e.vx = avx; e.vy = avy; e.vz = avz; e.hitH = true;
  return 0;
}
// 箱どうしの当たり判定つき移動。e: {x,y,z（足もと中心）, hw（幅の半分）, h（高さ）}
function moveAABB(world, e, dx, dy, dz) {
  const hw = e.hw, E = 1e-7;
  let x0 = e.x - hw, x1 = e.x + hw, y0 = e.y, y1 = e.y + e.h, z0 = e.z - hw, z1 = e.z + hw;
  _cb.length = 0;
  world.collectBoxes(Math.min(x0, x0 + dx) - 0.02, Math.min(y0, y0 + dy) - 0.02, Math.min(z0, z0 + dz) - 0.02, Math.max(x1, x1 + dx) + 0.02, Math.max(y1, y1 + dy) + 0.02, Math.max(z1, z1 + dz) + 0.02, _cb);
  const b = _cb, n = b.length, ox = dx, oy = dy, oz = dz;
  for (let i = 0; i < n; i += 6) {
    if (x1 > b[i] + E && x0 < b[i + 3] - E && z1 > b[i + 2] + E && z0 < b[i + 5] - E) {
      if (dy > 0 && y1 <= b[i + 1] + E) { const m = b[i + 1] - y1; if (m < dy) dy = m; }
      else if (dy < 0 && y0 >= b[i + 4] - E) { const m = b[i + 4] - y0; if (m > dy) dy = m; }
    }
  }
  y0 += dy; y1 += dy;
  for (let i = 0; i < n; i += 6) {
    if (y1 > b[i + 1] + E && y0 < b[i + 4] - E && z1 > b[i + 2] + E && z0 < b[i + 5] - E) {
      if (dx > 0 && x1 <= b[i] + E) { const m = b[i] - x1; if (m < dx) dx = m; }
      else if (dx < 0 && x0 >= b[i + 3] - E) { const m = b[i + 3] - x0; if (m > dx) dx = m; }
    }
  }
  x0 += dx; x1 += dx;
  for (let i = 0; i < n; i += 6) {
    if (y1 > b[i + 1] + E && y0 < b[i + 4] - E && x1 > b[i] + E && x0 < b[i + 3] - E) {
      if (dz > 0 && z1 <= b[i + 2] + E) { const m = b[i + 2] - z1; if (m < dz) dz = m; }
      else if (dz < 0 && z0 >= b[i + 5] - E) { const m = b[i + 5] - z0; if (m > dz) dz = m; }
    }
  }
  e.x += dx; e.y += dy; e.z += dz;
  e.onGround = oy < 0 && dy !== oy;
  e.hitH = dx !== ox || dz !== oz;
  if (dy !== oy) e.vy = 0;
  if (dx !== ox) e.vx = 0;
  if (dz !== oz) e.vz = 0;
}
function fluidAt(world, x, y, z) { return FLUID[world.getBlock(Math.floor(x), Math.floor(y), Math.floor(z))]; }

// ---------------- アイテム・落下ブロック ----------------
function spawnDrop(x, y, z, id, n, d, vx, vy, vz, delay) {
  if (!ITEMS[id] || n <= 0) return null;
  const e = { kind: 'item', x, y, z, px: x, py: y, pz: z, vx: vx === undefined ? (Math.random() - 0.5) * 2 : vx, vy: vy === undefined ? 3 + Math.random() * 1.5 : vy, vz: vz === undefined ? (Math.random() - 0.5) * 2 : vz,
    hw: 0.125, h: 0.25, id, n, d: d || 0, age: 0, life: 6000, delay: delay === undefined ? 8 : delay, spin: Math.random() * 6.28, dead: false, onGround: false };
  return addEnt(e);
}
function spawnFalling(x, y, z, id) {
  return addEnt({ kind: 'falling', x: x + 0.5, y, z: z + 0.5, px: x + 0.5, py: y, pz: z + 0.5, vx: 0, vy: 0, vz: 0, hw: 0.49, h: 0.98, id, age: 0, dead: false, onGround: false });
}
function itemTick(world, e) {
  e.age++;
  if (e.age > e.life) { e.dead = true; return; }
  const fl = fluidAt(world, e.x, e.y + 0.1, e.z);
  if (fl === 2) { e.dead = true; fxPuff(e.x, e.y + 0.2, e.z, 4, 0.3, 0.3, 0.3); sfxAt('fizz', e.x, e.y, e.z); return; }
  if (fl === 1) { e.vy = e.vy * 0.8 + 0.5; e.vx *= 0.8; e.vz *= 0.8; } else e.vy -= 1.4;
  if (!player.dead && e.age > e.delay) {
    const dx = player.x - e.x, dy = player.y + 0.8 - e.y, dz = player.z - e.z, dd = dx * dx + dy * dy + dz * dz;
    if (dd < 2.9 && player.canTake(e.id, e.d)) {
      const d = Math.sqrt(dd) || 1;
      e.vx += dx / d * 2.2; e.vy += dy / d * 2.2 + 0.6; e.vz += dz / d * 2.2;
      if (dd < 1.1) {
        const left = player.give(e.id, e.n, e.d);
        if (left < e.n) { sfx('pop'); ui.pickupFx(e.id, e.n - left); player.stat('pick', e.id); }
        e.n = left; if (left <= 0) { e.dead = true; return; }
      }
    }
  }
  moveAABB(world, e, e.vx * 0.05, e.vy * 0.05, e.vz * 0.05);
  if (e.onGround) { e.vx *= 0.6; e.vz *= 0.6; } else { e.vx *= 0.98; e.vz *= 0.98; }
  if (e.y < -20) e.dead = true;
  if ((e.age & 31) === 7) {
    for (const o of ents) {
      if (o === e || o.kind !== 'item' || o.dead || o.id !== e.id || o.d !== e.d || o.d) continue;
      if (Math.abs(o.x - e.x) < 0.8 && Math.abs(o.y - e.y) < 0.8 && Math.abs(o.z - e.z) < 0.8 && e.n + o.n <= maxStack(e.id)) { e.n += o.n; o.dead = true; }
    }
  }
}
function fallingTick(world, e) {
  e.age++; e.vy -= 1.4;
  moveAABB(world, e, 0, e.vy * 0.05, 0);
  if (e.onGround || e.age > 600) {
    e.dead = true;
    const bx = Math.floor(e.x), by = Math.floor(e.y + 0.2), bz = Math.floor(e.z), cur = world.getBlock(bx, by, bz);
    if (cur === 0 || FLUID[cur] || (REPLACE[cur] && !SOLID[cur]) || SHAPE[cur] === S_CROSS) { if (cur && !FLUID[cur]) world.breakNatural(bx, by, bz); world.setBlock(bx, by, bz, e.id, 0); sfxAt('place_' + BLOCKS[e.id].sound, e.x, e.y, e.z); }
    else spawnDrop(e.x, e.y + 0.3, e.z, e.id, 1, 0);
  }
}

// ---------------- 生き物の定義 ----------------
const MOBS = {
  sheep: { name: 'ヒツジ', hw: 0.42, h: 1.15, hp: 8, speed: 1.3, model: 'sheep', voice: 'sheep', drops: () => [[I.raw_mutton, 1 + rnd(2)], [B.wool_white, 1]] },
  pig: { name: 'ブタ', hw: 0.42, h: 0.9, hp: 10, speed: 1.4, model: 'pig', voice: 'pig', drops: () => [[I.raw_pork, 1 + rnd(2)]] },
  cow: { name: 'ウシ', hw: 0.45, h: 1.3, hp: 10, speed: 1.2, model: 'cow', voice: 'cow', drops: () => [[I.raw_beef, 1 + rnd(2)]] },
  chicken: { name: 'ニワトリ', hw: 0.22, h: 0.7, hp: 4, speed: 1.3, model: 'chicken', voice: 'chicken', flutter: true, drops: () => [[I.raw_chicken, 1], [I.feather, rnd(3)]] },
  shade: { name: 'ヨルカゲ', hw: 0.3, h: 1.9, hp: 20, speed: 2.5, model: 'shade', voice: 'shade', hostile: true, dmg: 3, burns: true, drops: () => Math.random() < 0.7 ? [[I.shadow_shard, 1 + rnd(2)]] : [] },
  rock: { name: 'イワコロ', hw: 0.4, h: 0.8, hp: 14, speed: 0, model: 'rock', voice: 'rock', hostile: true, dmg: 3, hop: true, drops: () => [[B.cobble, 1 + rnd(2)], [I.coal, rnd(2)], [B.ore_iron, Math.random() < 0.12 ? 1 : 0]] },
  wisp: { name: 'ヒトダマ', hw: 0.25, h: 0.55, hp: 8, speed: 2.4, model: 'wisp', voice: 'wisp', hostile: true, dmg: 3, fly: true, glow: true, drops: () => [[I.glow_dust, 1 + rnd(2)]] },
  king: { name: 'カゲの王', hw: 0.7, h: 4.1, hp: 160, speed: 2.0, model: 'king', voice: 'king', hostile: true, dmg: 7, boss: true, scale: 2.2, drops: () => [[B.crown_block, 1], [I.shadow_shard, 6], [I.diamond, 3], [I.golden_apple, 2]] },
  // ---- ホムラの底 ----
  homurabi: { name: 'ホムラビ', hw: 0.35, h: 1.5, hp: 20, speed: 2.2, model: 'homurabi', voice: 'homurabi', hostile: true, dmg: 5, fly: true, glow: true, fireproof: true, drops: () => Math.random() < 0.7 ? [[I.homura_rod, 1]] : [] },
  ukikurage: { name: 'ウキクラゲ', hw: 1.0, h: 2.6, hp: 10, speed: 1.3, model: 'ukikurage', voice: 'kurage', hostile: true, dmg: 6, fly: true, fireproof: true, scale: 2, drops: () => [[I.glow_dust, rnd(3)], [I.homura_powder, rnd(2)]] },
  yakebone: { name: 'ヤケボネ', hw: 0.3, h: 1.9, hp: 26, speed: 2.4, model: 'yakebone', voice: 'bone', hostile: true, dmg: 6, fireproof: true, drops: () => [[I.coal, rnd(3)], [I.quartz, rnd(2)]] },
  magmadama: { name: 'マグマコロ', hw: 0.4, h: 0.8, hp: 12, speed: 0, model: 'magmadama', voice: 'magma', hostile: true, dmg: 4, hop: true, fireproof: true, glow: true, drops: () => Math.random() < 0.3 ? [[I.homura_powder, 1]] : [] },
  // ---- ソラのはて ----
  hoshikage: { name: 'ホシカゲ', hw: 0.3, h: 1.9, hp: 30, speed: 2.8, model: 'hoshikage', voice: 'shade', hostile: true, dmg: 5, drops: () => [[I.shadow_shard, 1 + rnd(2)]] },
  hoshikui: { name: 'ホシクイ', hw: 1.5, h: 2.2, hp: 260, speed: 0, model: 'hoshikui', voice: 'hoshi', hostile: true, dmg: 8, boss: true, fly: true, fireproof: true, deathT: 110, scale: 2.2, drops: () => [[I.diamond, 8], [I.golden_apple, 3], [I.quartz, 12]] }
};
function rnd(n) { return Math.floor(Math.random() * n); }

// ---- 体の形（1/16ブロック単位。-Z が前） ----
const MODELS = {};
function part(id, x0, y0, z0, x1, y1, z1, px, py, pz) { return { id, b: [x0, y0, z0, x1, y1, z1], pv: [px, py, pz], uv: null }; }
function quadruped(o) {
  const hbw = o.bw / 2, hbd = o.bd / 2, lw = o.legW, lx = hbw - lw / 2, lz = hbd - lw / 2;
  const p = [part('body', -hbw, o.legH, -hbd, hbw, o.legH + o.bh, hbd, 0, o.legH + o.bh / 2, 0),
    part('head', -o.hw / 2, o.hy, -hbd - o.hd + 2, o.hw / 2, o.hy + o.hh, -hbd + 2, 0, o.hy + o.hh / 2, -hbd + 1)];
  [['leg0', -lx, -lz], ['leg1', lx, -lz], ['leg2', -lx, lz], ['leg3', lx, lz]].forEach(([n, x, z]) => p.push(part(n, x - lw / 2, 0, z - lw / 2, x + lw / 2, o.legH, z + lw / 2, x, o.legH, z)));
  return p;
}
function buildModels() {
  MODELS.sheep = quadruped({ bw: 10, bh: 9, bd: 14, legH: 6, legW: 3, hw: 6, hh: 6, hd: 6, hy: 10 });
  MODELS.pig = quadruped({ bw: 10, bh: 8, bd: 14, legH: 5, legW: 4, hw: 8, hh: 8, hd: 7, hy: 6 });
  MODELS.pig.push(part('snout', -2, 7, -15, 2, 10, -13, 0, 10, -6));
  MODELS.cow = quadruped({ bw: 12, bh: 10, bd: 16, legH: 8, legW: 4, hw: 8, hh: 8, hd: 6, hy: 12 });
  MODELS.cow.push(part('hornL', -5, 19, -11, -4, 22, -10, 0, 16, -7), part('hornR', 4, 19, -11, 5, 22, -10, 0, 16, -7));
  MODELS.chicken = [part('body', -3, 4, -4, 3, 10, 4, 0, 7, 0), part('head', -2, 8, -7, 2, 13, -4, 0, 9, -4), part('beak', -2, 10, -9, 2, 12, -7, 0, 9, -4), part('comb', -1, 13, -7, 1, 15, -5, 0, 9, -4),
    part('leg0', -2.5, 0, -0.5, -1.5, 4, 0.5, -2, 4, 0), part('leg1', 1.5, 0, -0.5, 2.5, 4, 0.5, 2, 4, 0), part('wing0', -4, 5, -3, -3, 9, 3, -3, 9, 0), part('wing1', 3, 5, -3, 4, 9, 3, 3, 9, 0)];
  const shade = () => [part('body', -4, 11, -2, 4, 22, 2, 0, 16, 0), part('head', -4, 22, -4, 4, 30, 4, 0, 22, 0),
    part('arm0', -7, 8, -1.5, -4, 22, 1.5, -5.5, 21, 0), part('arm1', 4, 8, -1.5, 7, 22, 1.5, 5.5, 21, 0), part('leg0', -4, 0, -2, 0, 11, 2, -2, 11, 0), part('leg1', 0, 0, -2, 4, 11, 2, 2, 11, 0)];
  MODELS.shade = shade();
  MODELS.king = shade();
  MODELS.king.push(part('crown', -4.5, 30, -4.5, 4.5, 32, 4.5, 0, 22, 0), part('spike0', -4.5, 32, -4.5, -2.5, 34, -2.5, 0, 22, 0), part('spike1', 2.5, 32, -4.5, 4.5, 34, -2.5, 0, 22, 0), part('spike2', -1, 32, -4.5, 1, 35, -2.5, 0, 22, 0));
  MODELS.rock = [part('body', -6, 1, -6, 6, 12, 6, 0, 6, 0), part('foot0', -5, 0, -3, -1, 2, 3, -3, 2, 0), part('foot1', 1, 0, -3, 5, 2, 3, 3, 2, 0), part('eye0', -4, 7, -7, -2, 9, -6, 0, 6, 0), part('eye1', 2, 7, -7, 4, 9, -6, 0, 6, 0)];
  for (let i = 0; i < 4; i++) MODELS['pl' + i] = humanParts();   // 人の姿（0 は自分、1〜3 はほかの参加者）
  MODELS.yakebone = shade(); MODELS.hoshikage = shade();
  MODELS.homurabi = [part('fl0', -4, 2, -4, 4, 10, 4, 0, 6, 0), part('fl1', -3, 10, -3, 3, 16, 3, 0, 13, 0), part('fl2', -2, 16, -2, 2, 21, 2, 0, 18, 0), part('fl3', -1, 21, -1, 1, 24, 1, 0, 22, 0),
    part('mask', -4, 8, -6, 4, 17, -4, 0, 12, -5), part('hand0', 6, 8, -2, 9, 11, 1, 0, 9, 0), part('hand1', -9, 8, -2, -6, 11, 1, 0, 9, 0)];
  MODELS.ukikurage = [part('cap', -9, 11, -9, 9, 16, 9, 0, 13, 0), part('dome', -6, 16, -6, 6, 19, 6, 0, 17, 0), part('core', -3, 8, -3, 3, 11, 3, 0, 9, 0)];
  [[-6, -6], [6, -6], [-6, 6], [6, 6], [0, -7], [0, 7], [-7, 0], [7, 0]].forEach(([x, z], i) => MODELS.ukikurage.push(part('ten' + i, x - 1, i < 4 ? -1 : 3, z - 1, x + 1, 11, z + 1, x, 11, z)));
  MODELS.magmadama = [part('body', -6, 1, -6, 6, 12, 6, 0, 6, 0), part('foot0', -5, 0, -3, -1, 2, 3, -3, 2, 0), part('foot1', 1, 0, -3, 5, 2, 3, 3, 2, 0), part('eye0', -4, 7, -7, -2, 9, -6, 0, 6, 0), part('eye1', 2, 7, -7, 4, 9, -6, 0, 6, 0), part('tuft', -2, 12, -2, 2, 15, 2, 0, 12, 0)];
  // ホシクイ：頭・胴のふし・つばさ・尾
  MODELS.hoshikui = [part('head', -7, 0, -9, 7, 10, 9, 0, 5, 0), part('jaw', -6, -3, -9, 6, 0, 3, 0, 0, 3), part('horn0', -7, 10, 2, -4, 16, 6, -5.5, 10, 4), part('horn1', 4, 10, 2, 7, 16, 6, 5.5, 10, 4),
    part('eye0', -8, 5, -6, -7, 8, -2, 0, 5, 0), part('eye1', 7, 5, -6, 8, 8, -2, 0, 5, 0)];
  MODELS.hoshiseg = [part('seg', -6, 0, -8, 6, 9, 8, 0, 4.5, 0), part('fin', -1, 9, -5, 1, 13, 5, 0, 9, 0)];
  MODELS.hoshiwing = [part('wing0', -30, 4, -8, -6, 6, 8, -6, 5, 0), part('wing1', 6, 4, -8, 30, 6, 8, 6, 5, 0)];
  MODELS.hoshitail = [part('tail', -3, 1, -8, 3, 7, 8, 0, 4, 0), part('fluke', -10, 3, 6, 10, 5, 13, 0, 4, 8)];
  MODELS.wisp = [part('core', -3, 2, -3, 3, 8, 3, 0, 5, 0), part('orb0', 5, 4, -1, 7, 6, 1, 0, 5, 0), part('orb1', -7, 4, -1, -5, 6, 1, 0, 5, 0), part('orb2', -1, 4, 5, 1, 6, 7, 0, 5, 0), part('tail', -1.5, 0, 1, 1.5, 3, 4, 0, 5, 0)];
}
// ---- 生き物の絵（1枚の画像にまとめる） ----
function buildMobAtlas() {
  buildModels();
  const cv = document.createElement('canvas'); cv.width = cv.height = MOB_TEX;
  const ctx = cv.getContext('2d'), im = ctx.createImageData(MOB_TEX, MOB_TEX), d = im.data;
  let sx = 1, sy = 1, rowH = 0;
  const px = (x, y, c, a) => { const i = (y * MOB_TEX + x) * 4; d[i] = c[0]; d[i + 1] = c[1]; d[i + 2] = c[2]; d[i + 3] = a === undefined ? 255 : a; };
  for (const mname in MODELS) {
    const rng = mulberry32(strSeed('mob_' + mname));
    for (const p of MODELS[mname]) {
      const w = Math.ceil(p.b[3] - p.b[0]), h = Math.ceil(p.b[4] - p.b[1]), dd = Math.ceil(p.b[5] - p.b[2]);
      p.uv = [];
      for (let f = 0; f < 6; f++) {
        const fw = f < 2 ? dd : w, fh = (f === 2 || f === 3) ? dd : h;
        if (sx + fw + 1 > MOB_TEX) { sx = 1; sy += rowH + 1; rowH = 0; }
        p.uv.push([sx, sy, fw, fh]);
        const g = { w: fw, h: fh, rng, px: (x, y, c, a) => { if (x >= 0 && x < fw && y >= 0 && y < fh) px(sx + x, sy + y, c, a); },
          fill(pal) { for (let y = 0; y < fh; y++) for (let x = 0; x < fw; x++) px(sx + x, sy + y, pal[Math.floor(rng() * pal.length)]); },
          rect(x0, y0, w2, h2, c) { for (let y = y0; y < y0 + h2; y++) for (let x = x0; x < x0 + w2; x++) g.px(x, y, c); } };
        paintMob(mname, p.id, f, g);
        sx += fw + 1; if (fh > rowH) rowH = fh;
      }
    }
  }
  ctx.putImageData(im, 0, 0);
  MOB_CV = cv; MOB_USED = sy + rowH;
  return cv;
}
let MOB_USED = 0;
function paintMob(m, id, f, g) {
  if (m.length === 3 && m.startsWith('pl')) { paintHuman(id, f, g, [0, +m[2] % 6, 0, +m[2], 0]); return; }
  const front = f === 5, top = f === 2, isLeg = id.startsWith('leg') || id.startsWith('foot');
  if (m === 'sheep') {
    const wool = CP(['#efe9dc', '#e6dfd0', '#f6f1e6', '#ebe4d6']), skin = CP(['#6b5a4e', '#62524a', '#74635a']);
    if (isLeg) { g.fill(skin); if (!top) g.rect(0, 0, g.w, 2, wool[0]); if (f !== 2 && f !== 3) g.rect(0, g.h - 1, g.w, 1, C('#3d322c')); return; }
    if (id === 'head') {
      g.fill(skin); if (top || f === 4) { g.fill(wool); return; }
      g.rect(0, 0, g.w, 2, wool[1]);
      if (front) { g.px(1, 2, C('#f4f4f4')); g.px(4, 2, C('#f4f4f4')); g.px(1, 3, C('#1b1b1b')); g.px(4, 3, C('#1b1b1b')); g.rect(2, 4, 2, 1, C('#c9a09a')); g.px(2, 5, C('#4a3c35')); g.px(3, 5, C('#4a3c35')); }
      return;
    }
    g.fill(wool); for (let i = 0; i < g.w * g.h / 9; i++) g.px(Math.floor(g.rng() * g.w), Math.floor(g.rng() * g.h), C('#d8d0bf'));
  } else if (m === 'pig') {
    const pink = CP(['#f0a8a8', '#eb9c9c', '#f5b5b5', '#eea2a2']);
    g.fill(pink);
    if (isLeg && f !== 2 && f !== 3) g.rect(0, g.h - 1, g.w, 1, C('#9a5f5a'));
    if (id === 'head' && front) { g.px(1, 2, C('#ffffff')); g.px(6, 2, C('#ffffff')); g.px(1, 3, C('#1b1b1b')); g.px(6, 3, C('#1b1b1b')); }
    if (id === 'snout') { g.fill(CP(['#e08f8f', '#d98585'])); if (front) { g.px(0, 1, C('#a85f5f')); g.px(3, 1, C('#a85f5f')); } }
  } else if (m === 'cow') {
    const cream = CP(['#f2ede4', '#e8e2d6', '#f6f2ea']), brown = C('#5a3d2b'), brown2 = C('#4d3324');
    if (id.startsWith('horn')) { g.fill(CP(['#e8e0cf', '#d9d0bc'])); return; }
    g.fill(cream);
    for (let k = 0; k < 2 + Math.floor(g.w * g.h / 50); k++) { const cx = g.rng() * g.w, cy = g.rng() * g.h, r = 1.5 + g.rng() * 2.6; for (let y = 0; y < g.h; y++) for (let x = 0; x < g.w; x++) if (Math.hypot(x - cx, (y - cy) * 1.2) < r) g.px(x, y, g.rng() < 0.8 ? brown : brown2); }
    if (isLeg && f !== 2 && f !== 3) g.rect(0, g.h - 2, g.w, 2, C('#3a2a1f'));
    if (id === 'head') {
      if (front) { g.fill([brown, brown2]); g.rect(3, 0, 2, 5, cream[0]); g.rect(1, 5, 6, 3, C('#e2c4b4')); g.px(2, 6, C('#7a5a50')); g.px(5, 6, C('#7a5a50')); g.px(1, 2, C('#ffffff')); g.px(6, 2, C('#ffffff')); g.px(1, 3, C('#141414')); g.px(6, 3, C('#141414')); }
    }
  } else if (m === 'chicken') {
    if (id === 'beak') { g.fill(CP(['#f0a030', '#e6952a'])); return; }
    if (id === 'comb') { g.fill(CP(['#d63a2f', '#c53228'])); return; }
    if (isLeg) { g.fill(CP(['#e8b030', '#d9a428'])); return; }
    g.fill(CP(['#f8f8f4', '#eeeee8', '#ffffff']));
    if (id === 'head' && (f === 0 || f === 1)) g.px(f === 0 ? 2 : 0, 1, C('#141414'));
    if (id === 'head' && front) { g.px(0, 1, C('#141414')); g.px(3, 1, C('#141414')); g.rect(1, 4, 2, 1, C('#d63a2f')); }
    if (id.startsWith('wing')) for (let y = 1; y < g.h; y += 2) g.rect(0, y, g.w, 1, C('#e2e2da'));
  } else if (m === 'shade' || m === 'king') {
    const king = m === 'king';
    if (id === 'crown' || id.startsWith('spike')) { g.fill(CP(['#f6cf3e', '#e8bd2e', '#fff3a0'])); if (id === 'crown' && f !== 2 && f !== 3) for (let x = 1; x < g.w; x += 3) g.px(x, 0, x % 2 ? C('#d63a2f') : C('#6ee6de')); return; }
    const a = king ? C('#1c1338') : C('#2a2350'), b = king ? C('#0c0818') : C('#141028'), hi = king ? C('#6a3fd0') : C('#463b80');
    for (let y = 0; y < g.h; y++) for (let x = 0; x < g.w; x++) { const t = (top ? 0 : y / Math.max(1, g.h - 1)) + (g.rng() - 0.5) * 0.25; g.px(x, y, lerp3(a, b, clamp(t, 0, 1)).map(Math.round)); }
    for (let i = 0; i < g.w * g.h / 10; i++) { const x = Math.floor(g.rng() * g.w), y = Math.floor(g.rng() * g.h); g.px(x, y, hi); if (g.rng() < 0.5) g.px(x, y + 1, hi); }
    if (id === 'head' && front) {
      const e = king ? C('#ff4a3a') : C('#fff2a8'), e2 = king ? C('#ffb0a0') : C('#ffffff');
      g.rect(1, 3, 2, 1, e); g.rect(5, 3, 2, 1, e); g.px(1, 3, e2); g.px(6, 3, e2); g.px(2, 4, e, 255); g.px(5, 4, e, 255);
      if (king) { g.rect(2, 6, 4, 1, C('#ff4a3a')); g.px(2, 5, C('#ff4a3a')); g.px(5, 5, C('#ff4a3a')); }
    }
    if (id.startsWith('arm') && f !== 2 && f !== 3) g.rect(0, g.h - 2, g.w, 2, hi);
  } else if (m === 'rock') {
    if (id.startsWith('eye')) { g.fill(CP(['#ffb02e', '#ffd75a'])); if (front) g.px(1, 1, C('#5a2a00')); return; }
    g.fill(CP(['#8f9195', '#7e8085', '#9c9ea2', '#74767b', '#85878c']));
    for (let i = 0; i < g.w * g.h / 14; i++) { const x = Math.floor(g.rng() * g.w), y = Math.floor(g.rng() * g.h); g.rect(x, y, 2, 1, C('#5d8a3a')); }
    for (let i = 0; i < g.w * g.h / 20; i++) g.px(Math.floor(g.rng() * g.w), Math.floor(g.rng() * g.h), C('#55575c'));
    if (id === 'body' && front) { for (let x = 3; x < 9; x++) g.px(x, 8 + (x & 1), C('#2a2a2d')); g.rect(1, 2, 3, 3, C('#3a3a3d')); g.rect(8, 2, 3, 3, C('#3a3a3d')); }
    if (id === 'body' && top) for (let i = 0; i < 10; i++) g.px(Math.floor(g.rng() * g.w), Math.floor(g.rng() * g.h), C('#6a9a44'));
  } else if (m === 'yakebone') {
    const bone = CP(['#3a3436', '#2e292b', '#463f41', '#262123']);
    g.fill(bone);
    for (let i = 0; i < g.w * g.h / 7; i++) { const x = Math.floor(g.rng() * g.w), y = Math.floor(g.rng() * g.h); g.px(x, y, g.rng() < 0.5 ? C('#ff8a1c') : C('#c93d12')); }   // すき間から見える おき火
    if (id === 'body' && (front || f === 4)) for (let y = 1; y < g.h; y += 2) g.rect(1, y, g.w - 2, 1, C('#1a1617'));   // あばら
    if (id === 'head' && front) { g.rect(1, 2, 2, 2, C('#ffb02e')); g.rect(5, 2, 2, 2, C('#ffb02e')); g.px(1, 2, C('#fff3a0')); g.px(6, 2, C('#fff3a0')); g.rect(2, 6, 4, 1, C('#141011')); g.px(3, 5, C('#141011')); }
  } else if (m === 'hoshikage') {
    const a = C('#cfc8ee'), b = C('#8f86c8'), hi = C('#ffffff');
    for (let y = 0; y < g.h; y++) for (let x = 0; x < g.w; x++) { const t = (top ? 0 : y / Math.max(1, g.h - 1)) + (g.rng() - 0.5) * 0.25; g.px(x, y, lerp3(a, b, clamp(t, 0, 1)).map(Math.round)); }
    for (let i = 0; i < g.w * g.h / 9; i++) g.px(Math.floor(g.rng() * g.w), Math.floor(g.rng() * g.h), g.rng() < 0.5 ? hi : C('#f6cf3e'));
    if (id === 'head' && front) { g.rect(1, 3, 2, 2, C('#1a1038')); g.rect(5, 3, 2, 2, C('#1a1038')); g.px(1, 3, C('#f6cf3e')); g.px(6, 3, C('#f6cf3e')); }
  } else if (m === 'homurabi') {
    if (id === 'mask') {   // 炭のお面
      g.fill(CP(['#2b2624', '#231f1d', '#332d2a']));
      if (front) { g.rect(1, 3, 2, 2, C('#ffd75a')); g.rect(5, 3, 2, 2, C('#ffd75a')); g.px(1, 3, C('#ffffff')); g.px(5, 3, C('#ffffff')); g.rect(2, 7, 4, 1, C('#ff8a1c')); g.px(0, 0, C('#ff8a1c')); g.px(7, 0, C('#ff8a1c')); }
      return;
    }
    const lv = id === 'fl0' ? 0 : id === 'fl1' ? 1 : id === 'fl2' ? 2 : id === 'fl3' ? 3 : 1;   // 下ほど赤く、上ほど黄色い炎
    const pal = [CP(['#c93d12', '#e8591a', '#d94a16']), CP(['#e8591a', '#ff8a1c', '#f2701a']), CP(['#ff8a1c', '#ffb02e', '#ffa126']), CP(['#ffd75a', '#fff3a0', '#ffe27a'])][lv];
    g.fill(pal);
    if (!top && f !== 3) for (let x = 0; x < g.w; x++) if (g.rng() < 0.5) g.px(x, 0, [CP(['#ff8a1c']), CP(['#ffb02e']), CP(['#ffd75a']), CP(['#ffffff'])][lv][0]);
  } else if (m === 'ukikurage') {
    if (id === 'cap' || id === 'dome') {   // かさ：むらさき〜もも色。ふちに明るい玉
      g.fill(id === 'dome' ? CP(['#c477d9', '#b96bd0', '#cf85e2']) : CP(['#a558c4', '#9a4fb8', '#b064ce', '#8f47ad']));
      if (top) for (let k = 0; k < 5; k++) { const cx = 2 + g.rng() * (g.w - 4), cy = 2 + g.rng() * (g.h - 4); for (let y = 0; y < g.h; y++) for (let x = 0; x < g.w; x++) if (Math.hypot(x - cx, y - cy) < 1.5) g.px(x, y, C('#f3b6f0')); }
      if (id === 'cap' && !top && f !== 3) { for (let x = 0; x < g.w; x++) g.px(x, g.h - 1, x % 3 === 1 ? C('#ffe08a') : C('#6f3590')); if (front) { g.rect(4, 1, 2, 2, C('#1e1230')); g.rect(12, 1, 2, 2, C('#1e1230')); g.px(4, 1, C('#ffffff')); g.px(12, 1, C('#ffffff')); } }
      if (f === 3) g.fill(CP(['#6f3590', '#7a3d9c']));
    } else if (id === 'core') g.fill(CP(['#ffe08a', '#ffc23a', '#fff3a0']));
    else { for (let y = 0; y < g.h; y++) for (let x = 0; x < g.w; x++) g.px(x, y, C(y < 3 ? '#b064ce' : y < 8 ? '#d08ae0' : '#f3b6f0')); }
  } else if (m === 'magmadama') {
    if (id.startsWith('eye')) { g.fill(CP(['#fff3a0', '#ffd75a'])); if (front) g.px(1, 1, C('#3a1408')); return; }
    if (id === 'tuft') { g.fill(CP(['#ff8a1c', '#ffb02e', '#ffd75a'])); return; }
    g.fill(CP(['#4a2a22', '#3e221b', '#573228', '#44261f']));
    for (let k = 0; k < 3; k++) { let x = Math.floor(g.rng() * g.w), y = 0; for (let i = 0; i < g.h + 3; i++) { g.px(x, y, i % 4 === 0 ? C('#ffd75a') : C('#ff8a1c')); if (g.rng() < 0.5) x += g.rng() < 0.5 ? 1 : -1; else y++; } }
    if (id === 'body' && front) g.rect(3, 9, 6, 1, C('#ff8a1c'));
  } else if (m.startsWith('hoshi')) {
    // ホシクイ：夜空の色の体に、星のもよう。おなかは うすい色
    const a = C('#231a52'), b = C('#0f0a2a');
    if (id.startsWith('eye')) { g.fill(CP(['#fff3a0', '#ffe27a'])); g.px(Math.floor(g.w / 2), 1, C('#b0509a')); return; }
    if (id.startsWith('horn')) { g.fill(CP(['#e6dcff', '#cfc0f6', '#f6f0ff'])); return; }
    if (f === 3) { g.fill(CP(['#8f86c8', '#8279bd', '#9a92d2'])); return; }
    for (let y = 0; y < g.h; y++) for (let x = 0; x < g.w; x++) { const t = (top ? 0.15 : y / Math.max(1, g.h - 1)) + (g.rng() - 0.5) * 0.3; g.px(x, y, lerp3(a, b, clamp(t, 0, 1)).map(Math.round)); }
    for (let i = 0; i < g.w * g.h / 16; i++) { const x = Math.floor(g.rng() * g.w), y = Math.floor(g.rng() * g.h), c = g.rng() < 0.3 ? C('#fff3a0') : g.rng() < 0.5 ? C('#c8b6ff') : C('#ffffff'); g.px(x, y, c); if (g.rng() < 0.25) { g.px(x + 1, y, c); g.px(x, y + 1, c); g.px(x - 1, y, c); g.px(x, y - 1, c); } }
    if (id.startsWith('wing') && (f === 2)) for (let x = 2; x < g.w; x += 5) for (let y = 0; y < g.h; y++) g.px(x, y, C('#3d2f86'));   // つばさの すじ
    if (id === 'fin' || id === 'fluke') for (let x = 0; x < g.w; x++) if (!top) g.px(x, 0, C('#b0509a'));
    if (id === 'head' && front) { g.rect(2, 7, 10, 1, C('#b0509a')); for (let x = 2; x < 12; x += 2) g.px(x, 8, C('#f6f0ff')); }
    if (id === 'jaw' && front) for (let x = 1; x < g.w; x += 2) g.px(x, 0, C('#f6f0ff'));
  } else if (m === 'wisp') {
    if (id === 'core') { g.fill(CP(['#dff6ff', '#c8f0ff', '#ffffff'])); for (let i = 0; i < g.w; i++) { g.px(i, 0, C('#8fe0ff')); g.px(i, g.h - 1, C('#6fd0ff')); g.px(0, i, C('#8fe0ff')); g.px(g.w - 1, i, C('#8fe0ff')); } if (front) { g.px(1, 2, C('#1a4a70')); g.px(4, 2, C('#1a4a70')); } }
    else g.fill(CP(['#6fd0ff', '#8fe0ff', '#b8eeff']));
  }
}

// ---------------- 生き物の生成と動き ----------------
function spawnMob(type, x, y, z) {
  const d = MOBS[type];
  const e = { kind: 'mob', type, x, y, z, px: x, py: y, pz: z, vx: 0, vy: 0, vz: 0, hw: d.hw, h: d.h, hp: d.hp, maxHp: d.hp, yaw: Math.random() * 6.28, pyaw: 0, headPitch: 0,
    age: 0, hurt: 0, death: 0, atkCd: 0, walk: 0, walkAmp: 0, state: 0, timer: 0, moveYaw: 0, moving: false, panic: 0, kb: 0, dead: false, onGround: false, hitH: false, awake: type !== 'rock', swing: 0, burst: 0, shotCd: 60, summonCd: 200, slam: 0, voiceCd: 100 + rnd(300), fire: 0, spinOff0: Math.random() * 6.28, spinSeed0: Math.random() * 6.28 };
  e.pyaw = e.yaw;
  return addEnt(e);
}
function hurtMob(e, dmg, fromX, fromZ, kb) {
  if (e.hurt > 0 || e.hp <= 0) return false;
  if (e.remote) {   // ほかの人が動かしている生き物：たたいたことを持ち主に伝える（体力は持ち主が決める）
    e.hurt = 10; sfxAt('hurt_' + MOBS[e.type].voice, e.x, e.y, e.z);
    fxPuff(e.x, e.y + e.h * 0.6, e.z, 5, 0.75, 0.1, 0.1, { speed: 2, life: 0.4, size: 0.05, grav: 10 });
    net.dm(e.owner, { t: 'hit', n: e.rnid, d: r2(dmg), x: r2(fromX), z: r2(fromZ), k: kb === undefined ? 5.5 : kb });
    return true;
  }
  e.hp -= dmg; e.hurt = 10; e.awake = true;
  const dx = e.x - fromX, dz = e.z - fromZ, d = Math.hypot(dx, dz) || 1, k = (kb === undefined ? 5.5 : kb) * (MOBS[e.type].boss ? 0.15 : 1);
  e.vx = dx / d * k; e.vz = dz / d * k; if (e.onGround || MOBS[e.type].fly) e.vy = MOBS[e.type].boss ? 1 : 4.5; e.kb = 6;
  if (!MOBS[e.type].hostile) e.panic = 80 + rnd(40);
  sfxAt('hurt_' + MOBS[e.type].voice, e.x, e.y, e.z);
  fxPuff(e.x, e.y + e.h * 0.6, e.z, 5, 0.75, 0.1, 0.1, { speed: 2, life: 0.4, size: 0.05, grav: 10 });
  if (e.hp <= 0) { e.death = 1; sfxAt('die_' + MOBS[e.type].voice, e.x, e.y, e.z); }
  return true;
}
function mobTick(world, e) {
  const d = MOBS[e.type];
  e.age++;
  if (e.hurt > 0) e.hurt--; if (e.atkCd > 0) e.atkCd--; if (e.kb > 0) e.kb--;
  if (e.hp <= 0) {
    e.death++;
    const dT = d.deathT || (d.boss ? 50 : 13);
    if (e.type === 'hoshikui' && e.death < dT) { hoshiDying(world, e); return; }
    if (d.boss && e.death < dT) { if (e.death % 3 === 0) fxPuff(e.x, e.y + Math.random() * e.h, e.z, 6, 0.5, 0.3, 0.9, { glow: true, speed: 4, life: 1, size: 0.14, spread: 1.2 }); return; }
    if (e.death > dT) {
      e.dead = true;
      if (e.type === 'hoshikui') hoshiReward(world, e);
      for (const [id, n] of d.drops()) if (n > 0) spawnDrop(e.x, e.y + 0.4, e.z, id, n, 0);
      fxPuff(e.x, e.y + e.h * 0.5, e.z, d.boss ? 60 : 10, 0.85, 0.85, 0.85, { speed: d.boss ? 5 : 1.5, life: 0.9, size: 0.1, spread: e.hw * 2 });
      if (e.lastBy && net.on && e.lastBy !== net.pid) net.dm(e.lastBy, { t: 'kill', ty: e.type }); else if (!e.noCredit) player.onKill(e);
    }
    return;
  }
  const fl = fluidAt(world, e.x, e.y + 0.3, e.z);
  if (fl === 2 && e.age % 10 === 0 && !d.fireproof) hurtMob(e, 4, e.x, e.z, 0);
  const T = mobTarget(e);   // いちばん近い人をねらう
  const pdx = T.x - e.x, pdy = T.y - e.y, pdz = T.z - e.z, pdist = Math.hypot(pdx, pdz), pd3 = Math.hypot(pdx, pdy, pdz);
  const canTarget = d.hostile && !T.dead && T.mode === 0 && game.diff > 0;
  let wantSpeed = 0, wantYaw = e.yaw, chasing = false;
  if (--e.voiceCd <= 0) { e.voiceCd = 160 + rnd(400); if (pd3 < 20 && e.awake) sfxAt('say_' + d.voice, e.x, e.y, e.z); }

  if (e.type === 'wisp') { wispTick(world, e, canTarget, pdx, pdy, pdz, pd3, T); return; }
  if (e.type === 'homurabi') { homurabiTick(world, e, canTarget, pdx, pdy, pdz, pd3, T); return; }
  if (e.type === 'ukikurage') { kurageTick(world, e, canTarget, pdx, pdy, pdz, pd3, T); return; }
  if (e.type === 'hoshikui') { hoshiTick(world, e, canTarget, T); return; }
  if (d.boss) {
    kingTick(world, e, canTarget, pdx, pdz, pdist, pd3, T);
    wantYaw = e.moveYaw; wantSpeed = e.moving ? d.speed * (e.hp < e.maxHp / 2 ? 1.35 : 1) : 0; chasing = true;
  } else if (d.hop) {
    chasing = true;
    if (!e.awake) { if (canTarget && pd3 < 6.5) { e.awake = true; sfxAt('say_rock', e.x, e.y, e.z); } }
    else if (canTarget && pd3 < 22) {
      e.yaw = Math.atan2(-pdx, -pdz);
      if (e.onGround && --e.timer <= 0) { e.timer = 14 + rnd(12); e.squash = 6; e.vy = 7.6; e.vx = pdx / (pdist || 1) * 3.6; e.vz = pdz / (pdist || 1) * 3.6; sfxAt('hop', e.x, e.y, e.z); }
      if (e.atkCd === 0 && Math.abs(pdx) < e.hw + 0.45 && Math.abs(pdz) < e.hw + 0.45 && pdy > -1.8 && pdy < e.h + 0.2) { e.atkCd = 18; hitTarget(T, d.dmg * DIFF_DMG[game.diff], e.x, e.z, 6, d.name); }
    } else if (pd3 > 26) e.awake = false;
  } else if (d.hostile) {
    if (canTarget && pd3 < 22) {
      chasing = true;
      wantYaw = Math.atan2(-pdx, -pdz); wantSpeed = d.speed;
      if (pdist < 1.25 && Math.abs(pdy) < 1.8) {
        wantSpeed = 0;
        if (e.atkCd === 0) { e.atkCd = 20; e.swing = 8; hitTarget(T, d.dmg * DIFF_DMG[game.diff], e.x, e.z, 6, d.name); }
      }
    } else wander(world, e, d);
    if (d.burns && e.age % 20 === 0 && world.dayFactor() > 0.75 && (world.getLightRaw(Math.floor(e.x), Math.floor(e.y + e.h), Math.floor(e.z)) >> 4) === 15 && fl !== 1) {
      e.fire = 25; hurtMob(e, 3, e.x, e.z, 0); fxPuff(e.x, e.y + 1, e.z, 12, 0.25, 0.2, 0.45, { speed: 1.2, life: 1.1, size: 0.1, up: 1.4 });
    }
  } else {
    if (e.panic > 0) { e.panic--; if (e.panic % 20 === 0 || e.hitH) e.moveYaw = Math.random() * 6.28; e.moving = true; }
    else wander(world, e, d);
  }
  if (!chasing && e.moving) { wantYaw = e.moveYaw; wantSpeed = d.speed * (d.hostile ? 0.45 : e.panic > 0 ? 2.2 : 1); }
  if (e.swing > 0) e.swing--;
  // 向きと速さ
  if (!d.hop) {
    let dy = wantYaw - e.yaw; while (dy > Math.PI) dy -= Math.PI * 2; while (dy < -Math.PI) dy += Math.PI * 2;
    e.yaw += clamp(dy, -0.35, 0.35);
    if (e.kb === 0) {
      const tx = -Math.sin(e.yaw) * wantSpeed, tz = -Math.cos(e.yaw) * wantSpeed, acc = e.onGround || fl ? 0.4 : 0.08;
      e.vx += (tx - e.vx) * acc; e.vz += (tz - e.vz) * acc;
    }
    if (wantSpeed > 0 && e.hitH && e.onGround) e.vy = 8.3;
    if (wantSpeed > 0 && e.onGround && !d.hostile) {   // 崖に近づいたら向きを変える
      const ax = Math.floor(e.x - Math.sin(e.yaw) * 0.9), az = Math.floor(e.z - Math.cos(e.yaw) * 0.9), ay = Math.floor(e.y);
      if (!SOLID[world.getBlock(ax, ay - 1, az)] && !SOLID[world.getBlock(ax, ay - 2, az)] && !SOLID[world.getBlock(ax, ay - 3, az)]) { e.moveYaw += 2 + Math.random() * 2; e.vx *= 0.2; e.vz *= 0.2; }
    }
  } else if (e.onGround) { e.vx *= 0.5; e.vz *= 0.5; }
  if (fl) { e.vy = Math.min(e.vy * 0.8 + 0.9, 2.2); e.vx *= 0.85; e.vz *= 0.85; }
  else { e.vy -= (d.flutter && e.vy < 0) ? 0.5 : 1.4; if (d.flutter && e.vy < -2.5) e.vy = -2.5; }
  const ox = e.x, oz = e.z;
  moveStep(world, e, e.vx * 0.05, e.vy * 0.05, e.vz * 0.05, fl ? 0 : 0.6);   // 階段やハーフブロックは そのまま歩いてのぼる
  const moved = Math.hypot(e.x - ox, e.z - oz);
  e.walk += moved * 2.6; e.walkAmp += (Math.min(1, moved * 14) - e.walkAmp) * 0.3;
  if (e.y < -20) e.dead = true;
}
const DIFF_DMG = [0, 0.6, 1, 1.5];
function wander(world, e, d) {
  if (--e.timer <= 0) {
    if (e.moving) { e.moving = false; e.timer = 30 + rnd(90); }
    else { e.moving = true; e.moveYaw = Math.random() * 6.28; e.timer = 20 + rnd(60); }
  }
  if (e.moving && e.hitH && Math.random() < 0.1) e.moveYaw += 1.5;
}
function wispTick(world, e, canTarget, pdx, pdy, pdz, pd3, T) {
  let tx = e.x, ty = e.y, tz = e.z;
  if (canTarget && pd3 < 24) {
    const a = e.age * 0.02 + e.spinOff0, rr = 6.5;
    tx = T.x + Math.cos(a) * rr; tz = T.z + Math.sin(a) * rr; ty = T.y + 2.2 + Math.sin(e.age * 0.07) * 0.6;
    e.yaw = Math.atan2(-pdx, -pdz);
    if (--e.shotCd <= 0 && pd3 < 16) {
      e.shotCd = 50 + rnd(40);
      const sx = e.x, sy = e.y + 0.3, sz = e.z, dx = T.x - sx, dy = T.y + 1.0 - sy, dz = T.z - sz, dl = Math.hypot(dx, dy, dz) || 1;
      const hit = world.raycast(sx, sy, sz, dx / dl, dy / dl, dz / dl, dl);
      if (!hit) { spawnShot(sx, sy, sz, dx / dl * 9, dy / dl * 9, dz / dl * 9, MOBS.wisp.dmg, 0); sfxAt('shoot', sx, sy, sz); }
    }
  } else { if (--e.timer <= 0) { e.timer = 40 + rnd(60); e.moveYaw = Math.random() * 6.28; } tx = e.x - Math.sin(e.moveYaw) * 3; tz = e.z - Math.cos(e.moveYaw) * 3; ty = e.y + Math.sin(e.age * 0.05) * 0.5; }
  if (e.kb === 0) { e.vx += clamp((tx - e.x) * 0.6 - e.vx, -0.4, 0.4); e.vy += clamp((ty - e.y) * 0.8 - e.vy, -0.4, 0.4); e.vz += clamp((tz - e.z) * 0.6 - e.vz, -0.4, 0.4); }
  moveAABB(world, e, e.vx * 0.05, e.vy * 0.05, e.vz * 0.05);
  if (e.age % 3 === 0) fxPuff(e.x, e.y + 0.3, e.z, 1, 0.45, 0.8, 1, { glow: true, speed: 0.3, life: 0.5, size: 0.06, up: -0.2, grav: 0 });
  if (world.dayFactor() > 0.75 && e.age % 20 === 0 && (world.getLightRaw(Math.floor(e.x), Math.floor(e.y), Math.floor(e.z)) >> 4) === 15) hurtMob(e, 2, e.x, e.z, 0);
}
function kingTick(world, e, canTarget, pdx, pdz, pdist, pd3, T) {
  e.moving = false;
  if (!canTarget) return;
  e.moveYaw = Math.atan2(-pdx, -pdz);
  const rage = e.hp < e.maxHp / 2;
  if (e.slam > 0) {
    e.slam--;
    if (e.slam === 6) {
      sfxAt('slam', e.x, e.y, e.z); game.shake = 0.5;
      for (let i = 0; i < 40; i++) { const a = i / 40 * 6.283; fxPuff(e.x + Math.cos(a) * 2, e.y + 0.2, e.z + Math.sin(a) * 2, 1, 0.4, 0.25, 0.8, { glow: true, speed: 3, life: 0.7, size: 0.12, up: 1.5, grav: 6 }); }
      if (pd3 < 4.3) hitTarget(T, MOBS.king.dmg * DIFF_DMG[game.diff], e.x, e.z, 11, 'カゲの王');
      if (net.on) for (const p of net.peers.values()) if (p !== T && !p.dead && p.mode === 0 && Math.hypot(p.x - e.x, p.y - e.y, p.z - e.z) < 4.3) hitTarget(p, MOBS.king.dmg * DIFF_DMG[game.diff], e.x, e.z, 11, 'カゲの王');
      if (T !== player && !player.dead && Math.hypot(player.x - e.x, player.y - e.y, player.z - e.z) < 4.3) player.damage(MOBS.king.dmg * DIFF_DMG[game.diff], e.x, e.z, 11, 'カゲの王');
    }
    return;
  }
  if (pdist < 3.3 && e.atkCd === 0) { e.slam = 20; e.atkCd = rage ? 34 : 46; e.swing = 20; sfxAt('say_king', e.x, e.y, e.z); return; }
  e.moving = pdist > 2.6;
  if (--e.summonCd <= 0) {
    e.summonCd = rage ? 170 : 260;
    let minions = 0; for (const o of ents) if (o.kind === 'mob' && o.type === 'shade' && !o.dead) minions++;
    if (minions < 4) {
      for (let i = 0; i < 2; i++) { const a = Math.random() * 6.28, sx = e.x + Math.cos(a) * 3, sz = e.z + Math.sin(a) * 3, sy = findFloor(world, Math.floor(sx), Math.floor(e.y + 2), Math.floor(sz)); if (sy !== null) { spawnMob('shade', sx, sy, sz); fxPuff(sx, sy + 1, sz, 20, 0.4, 0.25, 0.8, { glow: true, speed: 2, life: 0.8, size: 0.1 }); } }
      sfxAt('summon', e.x, e.y, e.z);
    }
  }
  if (rage && --e.shotCd <= 0 && pd3 < 26) {
    e.shotCd = 70 + rnd(30);
    const sx = e.x, sy = e.y + 3.2, sz = e.z;
    for (let k = -1; k <= 1; k++) { const dx = T.x - sx, dy = T.y + 1 - sy, dz = T.z - sz, dl = Math.hypot(dx, dy, dz) || 1, a = k * 0.22, cs = Math.cos(a), sn = Math.sin(a); spawnShot(sx, sy, sz, (dx * cs - dz * sn) / dl * 10, dy / dl * 10, (dx * sn + dz * cs) / dl * 10, 4, 1); }
    sfxAt('shoot', sx, sy, sz);
  }
  if (pdist > 9 && e.onGround && e.age % 90 === 0) { e.vy = 9; e.vx = pdx / pdist * 9; e.vz = pdz / pdist * 9; e.kb = 14; sfxAt('hop', e.x, e.y, e.z); }
  // 進路をふさぐブロックをこわす
  if (e.hitH && e.age % 12 === 0 && game.rules.grief !== false) {
    for (let k = 0; k < 6; k++) { const bx = Math.floor(e.x - Math.sin(e.yaw) * 1.2 + (Math.random() - 0.5) * 1.4), by = Math.floor(e.y + Math.random() * 4), bz = Math.floor(e.z - Math.cos(e.yaw) * 1.2 + (Math.random() - 0.5) * 1.4), id = world.getBlock(bx, by, bz); if (id && BLOCKS[id].hard >= 0 && BLOCKS[id].hard < 20 && id !== B.altar && !FLUID[id]) { fxBlockBits(bx + 0.5, by + 0.5, bz + 0.5, id, 8, 0.8); world.spillEnt(bx, by, bz); world.setBlock(bx, by, bz, 0, 0); } }
  }
}
// 弾の種類（dark）：0 ヒトダマ 1 カゲの王 2 ホムラビ（火がつく） 3 ウキクラゲ（当たると はじける） 4 ホシクイ
const SHOT_COL = [[0.45, 0.8, 1], [0.55, 0.3, 1], [1, 0.55, 0.15], [1, 0.42, 0.12], [0.8, 0.7, 1]], SHOT_SRC = ['ヒトダマ', 'カゲの王', 'ホムラビ', 'ウキクラゲ', 'ホシクイ'];
function spawnShot(x, y, z, vx, vy, vz, dmg, dark) { return addEnt({ kind: 'shot', x, y, z, px: x, py: y, pz: z, vx, vy, vz, hw: 0.15, h: 0.3, dmg, dark: dark | 0, age: 0, dead: false }); }
// はじける（まわりの人にダメージ。やわらかいブロックをこわすのは、その弾を動かしている端末だけ）
function blast(world, x, y, z, dmg, rad, src, dig) {
  sfxAt('boom', x, y, z); if (Math.hypot(player.x - x, player.y - y, player.z - z) < 20) game.shake = Math.max(game.shake, 0.4);
  fxPuff(x, y, z, 26, 1, 0.6, 0.2, { glow: true, speed: 5, life: 0.5, size: 0.13, spread: 0.6 }); fxPuff(x, y, z, 18, 0.35, 0.32, 0.3, { speed: 2.5, life: 1.1, size: 0.16, spread: 1, up: 1 });
  const dd = Math.hypot(player.x - x, player.y + 0.9 - y, player.z - z);
  if (!player.dead && dd < rad) player.damage(dmg * (1 - dd / (rad + 0.6)) * DIFF_DMG[game.diff], x, z, 7, src);
  if (dig && game.rules.grief !== false) {
    for (let dy = -1; dy <= 1; dy++) for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) {
      if (Math.abs(dx) + Math.abs(dy) + Math.abs(dz) > 2) continue;
      const bx = Math.floor(x) + dx, by = Math.floor(y) + dy, bz = Math.floor(z) + dz, id = world.getBlock(bx, by, bz);
      if (id && BLOCKS[id].hard >= 0 && BLOCKS[id].hard < 2.2 && !FLUID[id] && !BLOCKS[id].ent && SHAPE[id] !== S_PORTAL) { fxBlockBits(bx + 0.5, by + 0.5, bz + 0.5, id, 4, 0.8); world.setBlock(bx, by, bz, 0, 0); }
    }
  }
}
function shotTick(world, e) {
  e.age++;
  const K = e.dark | 0, col = SHOT_COL[K] || SHOT_COL[0];
  if (e.age > (K === 3 ? 170 : 90)) { e.dead = true; return; }
  const nx = e.x + e.vx * 0.05, ny = e.y + e.vy * 0.05, nz = e.z + e.vz * 0.05;
  if (SOLID[world.getBlock(Math.floor(nx), Math.floor(ny), Math.floor(nz))]) {
    e.dead = true;
    if (K === 3) blast(world, e.x, e.y, e.z, e.dmg, 3.2, SHOT_SRC[3], !e.foreign);
    else { fxPuff(e.x, e.y, e.z, 8, col[0], col[1], col[2], { glow: true, speed: 2, life: 0.4, size: 0.07 }); sfxAt('fizz', e.x, e.y, e.z); }
    return;
  }
  e.x = nx; e.y = ny; e.z = nz;
  const hr = K === 3 ? 0.75 : 0.45;
  if (!player.dead && Math.abs(player.x - e.x) < hr && Math.abs(player.z - e.z) < hr && e.y > player.y - 0.2 - (hr - 0.45) && e.y < player.y + 1.9 + (hr - 0.45)) {
    e.dead = true;
    if (K === 3) blast(world, e.x, e.y, e.z, e.dmg, 3.2, SHOT_SRC[3], false);
    else { player.damage(e.dmg * DIFF_DMG[game.diff], e.x - e.vx, e.z - e.vz, 4, SHOT_SRC[K] || SHOT_SRC[0]); if (K === 2 && player.mode === 0) player.burnT = Math.max(player.burnT || 0, 70); }
  }
  fxPuff(e.x, e.y, e.z, K === 3 ? 2 : 1, col[0], col[1], col[2], { glow: true, speed: 0.4, life: K === 3 ? 0.55 : 0.35, size: K === 3 ? 0.14 : 0.08, up: 0, grav: 0 });
}

function tickEntities(world) {
  const mp = net.on;
  for (let i = 0; i < ents.length; i++) {
    const e = ents[i];
    e.px = e.x; e.py = e.y; e.pz = e.z; if (e.kind === 'mob') e.pyaw = e.yaw;
    if (e.remote) { puppetTick(world, e); continue; }
    if (e.type !== 'hoshikui' && !world.isLoaded(Math.floor(e.x), Math.floor(e.z))) { offloadEnt(world, e); continue; }
    if (e.kind === 'item') itemTick(world, e);
    else if (e.kind === 'mob') { mobTick(world, e); if (mp && !e.dead && e.type !== 'hoshikui' && (e.age & 15) === (e.nid & 15)) handOver(e); }   // 空を飛び回るボスは 持ち主を変えない（変えるたびに 動きが最初からになるため）
    else if (e.kind === 'falling') fallingTick(world, e);
    else shotTick(world, e);
  }
  let w = 0;
  for (let i = 0; i < ents.length; i++) { const e = ents[i]; if (!e.dead) ents[w++] = e; else if (mp && e._ns && !e.remote) net.rmQ.push(e.nid); }
  ents.length = w;
  // しまってあった動物を、その場所が読みこまれたらもどす（ひとり用。みんなの世界は net.pollStash）
  if (!mp && world.stash.size && world.tick % 20 === 3) for (const [k, a] of world.stash) { const c = world.chunks.get(k); if (c && c.stage >= 2) { world.stash.delete(k); for (const r of a) spawnFromRec(r); } }
}

// ---------------- 自然にわく ----------------
function findFloor(world, x, y, z) {
  for (let k = 0; k < 12; k++) {
    const yy = y - k;
    if (yy < 2) return null;
    if (SOLID[world.getBlock(x, yy - 1, z)] && !SOLID[world.getBlock(x, yy, z)] && !SOLID[world.getBlock(x, yy + 1, z)] && !FLUID[world.getBlock(x, yy, z)]) return yy;
  }
  return null;
}
// 原作の決まりにならう：
//  敵…明かりのない場所に、人から24〜128ブロックの間で、数匹まとまって出る。128より遠いと消え、32より遠いままだと少しずつ消える。
//  動物…明るい草の上にまれに出る。消えない（遠くなったらしまっておき、近づいたらもどす）。
const HOSTILE_CAP = [0, 26, 38, 50];
function darkEnough(world, x, y, z) {
  const raw = world.getLightRaw(x, y, z), bl = raw & 15, sky = raw >> 4;
  if (bl > 0 || sky > rnd(32)) return false;
  return sky - world.skyDarken() <= rnd(8);
}
function spawnSpot(world, x, y, z) {   // 下が固いブロックで、体の高さぶん空いているか
  const below = world.getBlock(x, y - 1, z), a = world.getBlock(x, y, z), b = world.getBlock(x, y + 1, z);
  return OPAQUE[below] === 1 && below !== B.bedrock && !SOLID[a] && !SOLID[b] && !FLUID[a] && !FLUID[b];
}
function trySpawnHostile(world, R) {
  if (world.dim === 1) return trySpawnHomura(world, R);
  if (world.dim === 2) return trySpawnSora(world, R);
  const a = Math.random() * 6.283, r = Math.sqrt(Math.random()) * R, x = Math.floor(player.x + Math.cos(a) * r), z = Math.floor(player.z + Math.sin(a) * r);
  if (!world.isLoaded(x, z)) return false;
  const c = world.getChunk(x >> 4, z >> 4), y = findFloor(world, x, 2 + rnd(Math.min(CH - 4, c.maxY + 2)), z);
  if (y === null || !spawnSpot(world, x, y, z) || !darkEnough(world, x, y, z)) return false;
  if (nearestPlayerDist(x + 0.5, y, z + 0.5) < 24) return false;
  const ws = game.worldSpawn; if (Math.hypot(ws.x - x, ws.y - y, ws.z - z) < 24) return false;
  if (world.biomeAt(x, z) === BIOME.MUSHROOM) return false;   // キノコの島には敵が出ない
  const under = (world.getLightRaw(x, y, z) >> 4) < 4, below = world.getBlock(x, y - 1, z), rr = Math.random();
  let type = 'shade';
  if (under) type = (rr < 0.35 && y < 46 && (below === B.stone || below === B.cobble || below === B.gravel || (below >= B.granite && below <= B.andesite))) ? 'rock' : (rr > 0.88 && y < 34) ? 'wisp' : 'shade';
  else type = rr > 0.9 ? 'wisp' : 'shade';
  const n = type === 'shade' ? 1 + rnd(3) : type === 'rock' ? 1 + rnd(2) : 1;
  let made = 0;
  for (let k = 0; k < n; k++) {
    const mx = k ? x + rnd(9) - 4 : x, mz = k ? z + rnd(9) - 4 : z, my = k ? findFloor(world, mx, y + 3, mz) : y;
    if (my === null || !world.isLoaded(mx, mz) || !spawnSpot(world, mx, my, mz) || (world.getLightRaw(mx, my, mz) & 15) > 0) continue;
    const e = spawnMob(type, mx + 0.5, type === 'wisp' ? my + 1.5 : my, mz + 0.5); made++;
    if (type === 'wisp') e.spinOff0 = Math.random() * 6.28;
  }
  return made > 0;
}
// バイオームごとに出る動物。地面が草（や落ち葉の土・きんしの土）の明るい場所に出る
const ANIMAL_POOL = [];
ANIMAL_POOL[BIOME.PLAINS] = ANIMAL_POOL[BIOME.FLOWER] = ANIMAL_POOL[BIOME.MEADOW] = ['sheep', 'cow', 'pig', 'chicken', 'sheep'];
ANIMAL_POOL[BIOME.FOREST] = ANIMAL_POOL[BIOME.BIRCH] = ['pig', 'chicken', 'cow'];
ANIMAL_POOL[BIOME.CHERRY] = ['chicken', 'sheep', 'pig'];
ANIMAL_POOL[BIOME.DARK] = ['pig', 'cow'];
ANIMAL_POOL[BIOME.JUNGLE] = ['chicken', 'pig', 'chicken'];
ANIMAL_POOL[BIOME.SAVANNA] = ['cow', 'sheep', 'chicken'];
ANIMAL_POOL[BIOME.SWAMP] = ['pig', 'chicken'];
ANIMAL_POOL[BIOME.SNOW] = ANIMAL_POOL[BIOME.TAIGA] = ANIMAL_POOL[BIOME.SNOW_TAIGA] = ANIMAL_POOL[BIOME.OLD_TAIGA] = ['sheep', 'sheep', 'chicken'];
ANIMAL_POOL[BIOME.MOUNTAIN] = ['sheep', 'cow'];
ANIMAL_POOL[BIOME.MUSHROOM] = ['cow'];
const ANIMAL_GROUND = new Uint8Array(NB); ANIMAL_GROUND[B.grass] = ANIMAL_GROUND[B.podzol] = ANIMAL_GROUND[B.mycelium] = 1;
function trySpawnPassive(world, R) {
  const a = Math.random() * 6.283, r = 24 + Math.random() * Math.max(8, Math.min(R, 96) - 24), x = Math.floor(player.x + Math.cos(a) * r), z = Math.floor(player.z + Math.sin(a) * r);
  if (!world.isLoaded(x, z)) return false;
  const sy = world.surfaceY(x, z);
  if (sy < SEA || !ANIMAL_GROUND[world.getBlock(x, sy, z)] || world.lightLevel(x, sy + 1, z) < 9) return false;
  if (nearestPlayerDist(x + 0.5, sy + 1, z + 0.5) < 24) return false;
  const bio = world.biomeAt(x, z);
  const pool = ANIMAL_POOL[bio];
  if (!pool) return false;
  const type = pool[rnd(pool.length)], cnt = 2 + rnd(3);
  let made = 0;
  for (let k = 0; k < cnt; k++) { const mx = x + rnd(7) - 3, mz = z + rnd(7) - 3, my = findFloor(world, mx, sy + 3, mz); if (my !== null && world.isLoaded(mx, mz) && ANIMAL_GROUND[world.getBlock(mx, my - 1, mz)]) { spawnMob(type, mx + 0.5, my, mz + 0.5); made++; } }
  return made > 0;
}
function spawnCycle(world) {
  const hostileOn = game.diff > 0 && game.rules.mobs !== false && player.mode === 0;
  let passive = 0, hostile = 0;
  for (const e of ents) {
    if (e.kind !== 'mob' || e.dead) continue;
    const d = MOBS[e.type]; if (d.boss) continue;
    const dl = Math.hypot(e.x - player.x, e.y - player.y, e.z - player.z);
    if (!d.hostile) { if (dl < 128) passive++; continue; }
    if (dl < 128) hostile++;
    if (e.remote) continue;
    if (game.diff === 0 || game.rules.mobs === false) { e.dead = true; e.noCredit = true; continue; }
    const dn = nearestPlayerDist(e.x, e.y, e.z);
    if (dn > 128) e.dead = true;
    else if (dn > 32) { e.farT = (e.farT || 0) + 20; if (e.farT > 600 && Math.random() < 0.025) e.dead = true; }
    else e.farT = 0;
  }
  if (player.dead) return;
  const R = Math.max(40, Math.min(128, (Math.min(settings.viewDist, world.dim === 1 ? 6 : 99) - 1) * 16));   // ホムラの底は 読みこむ広さが6チャンクまで
  // 上限は、読みこんでいる広さに合わせる（見える距離が短い端末で、まわりが敵だらけにならないように）
  const hcap = Math.max(4, Math.round(HOSTILE_CAP[game.diff] * (R / 128) * (R / 128))), pcap = R >= 96 ? 10 : 6;
  if (hostileOn && hostile < hcap) for (let t = 0; t < 10; t++) if (trySpawnHostile(world, R)) break;
  if (world.dim === 1 && hostileOn) fortSpawn(world);
  const every = (passive === 0 || game.sessionT < 1200) ? 60 : 400;
  if (!world.dim && passive < pcap && world.tick % every === 0) for (let t = 0; t < 12; t++) if (trySpawnPassive(world, R)) break;
}

// ---------------- 描画 ----------------
const _mm = m4(), _mp = m4(), _mt = m4(), _mr = m4(), _lcE = [1, 1, 1], _pp = new Float32Array(3);
function lerpAngle(a, b, t) { let d = b - a; while (d > Math.PI) d -= Math.PI * 2; while (d < -Math.PI) d += Math.PI * 2; return a + d * t; }
function drawEntities(world, cam, alpha) {
  for (const e of ents) {
    const x = e.px + (e.x - e.px) * alpha - cam.x, y = e.py + (e.y - e.py) * alpha - cam.y, z = e.pz + (e.z - e.pz) * alpha - cam.z;
    if (x * x + z * z > (e.type === 'hoshikui' ? 170 * 170 : 80 * 80)) continue;
    if (e.kind === 'item') {
      lightRGB(world.getLightRaw(Math.floor(e.x), Math.floor(e.y + 0.3), Math.floor(e.z)), _lcE);
      const bob = Math.sin((e.age + alpha) * 0.12 + e.spin) * 0.06 + 0.22, isCube = isBlk(e.id) && !ICON[e.id], s = isCube ? 0.27 : 0.42;
      m4Translate(_mm, x, y + bob, z); m4RotY(_mr, (e.age + alpha) * 0.06 + e.spin); m4Mul(_mm, _mm, _mr); m4Scale(_mr, s, s, s); m4Mul(_mm, _mm, _mr);
      addItemModel(dynTex, dynCol, _mm, e.id, _lcE[0], _lcE[1], _lcE[2]);
    } else if (e.kind === 'falling') {
      lightRGB(world.getLightRaw(Math.floor(e.x), Math.floor(e.y + 0.5), Math.floor(e.z)), _lcE);
      m4Translate(_mm, x, y + 0.5, z); addBlockCube(dynTex, _mm, e.id, _lcE[0], _lcE[1], _lcE[2], 1);
    } else if (e.kind === 'shot') {
      m4Translate(_mm, x, y, z); m4RotY(_mr, e.age * 0.5); m4Mul(_mm, _mm, _mr);
      const K = e.dark | 0, sc = SHOT_COL[K] || SHOT_COL[0], s = K === 3 ? 0.3 : K ? 0.14 : 0.11; addColorBox(dynGlow, _mm, -s, -s, -s, s, s, s, sc[0], sc[1], sc[2], 0.9);
    } else drawMob(world, e, x, y, z, alpha);
  }
}
function drawMob(world, e, x, y, z, alpha) {
  if (e.type === 'hoshikui') { drawHoshi(world, e, x, y, z, alpha); return; }
  const d = MOBS[e.type], model = MODELS[d.model], sc = (d.scale || 1) / 16;
  if (d.glow) { _lcE[0] = _lcE[1] = _lcE[2] = 1; } else lightRGB(world.getLightRaw(Math.floor(e.x), Math.floor(e.y + e.h * 0.6), Math.floor(e.z)), _lcE);
  let r = _lcE[0], g = _lcE[1], b = _lcE[2];
  if (e.hurt > 0 || e.hp <= 0) { r = Math.min(1.2, r * 1.6 + 0.2); g *= 0.45; b *= 0.45; }
  const yaw = lerpAngle(e.pyaw, e.yaw, alpha), t = e.age + alpha;
  m4Translate(_mm, x, y, z); m4RotY(_mr, yaw); m4Mul(_mm, _mm, _mr);
  if (e.hp <= 0 && !d.boss) { m4RotZ(_mr, Math.min(1, e.death / 10) * 1.5708); m4Mul(_mm, _mm, _mr); }
  if (d.boss && e.hp <= 0) { const k = 1 - Math.min(1, e.death / 50) * 0.5; m4Scale(_mr, k, 1 - e.death / 60, k); m4Mul(_mm, _mm, _mr); }
  m4Scale(_mr, sc, sc, sc); m4Mul(_mm, _mm, _mr);
  const sw = Math.sin(e.walk) * e.walkAmp;
  for (const p of model) {
    let rx = 0, ry = 0, rz = 0, ox = 0, oy = 0, oz = 0;
    const id = p.id;
    if (d.model === 'rock') {
      if (!e.awake && (id.startsWith('eye') || id.startsWith('foot'))) continue;
      if (!e.awake) oy = -1; else if (id.startsWith('eye')) oy = Math.sin(t * 0.3) * 0.2;
    } else if (d.model === 'homurabi') {
      if (id.startsWith('hand')) { ry = t * 0.16; oy = Math.sin(t * 0.2 + id.charCodeAt(4)) * 1.2 + (e.swing > 0 ? 3 : 0); }
      else if (id.startsWith('fl')) { const lv = id.charCodeAt(2) - 48; ox = Math.sin(t * 0.33 + lv * 1.3) * 0.35 * lv; oz = Math.cos(t * 0.27 + lv) * 0.3 * lv; ry = Math.sin(t * 0.1 + lv) * 0.3; }
      oy += Math.sin(t * 0.1) * 0.8;
    } else if (d.model === 'ukikurage') {
      const pulse = Math.sin(t * 0.11);
      if (id.startsWith('ten')) { const k = id.charCodeAt(3); rx = Math.sin(t * 0.09 + k) * 0.3 + pulse * 0.12; rz = Math.cos(t * 0.07 + k * 2) * 0.28; }
      oy = Math.sin(t * 0.06) * 1.2 + (id === 'cap' ? pulse * 0.5 : id === 'dome' ? pulse * 0.9 : 0) + (e.swing > 0 && id === 'core' ? -2 : 0);
    } else if (d.model === 'magmadama') {
      if (id.startsWith('eye')) oy = Math.sin(t * 0.3) * 0.2; else if (id === 'tuft') oy = Math.sin(t * 0.5) * 0.4;
    } else if (d.model === 'wisp') {
      if (id.startsWith('orb')) { ry = t * 0.16; oy = Math.sin(t * 0.2 + id.charCodeAt(3)) * 1.2; }
      else if (id === 'tail') { ry = Math.sin(t * 0.25) * 0.5; }
      oy += Math.sin(t * 0.12) * 0.8;
    } else if (d.model === 'shade' || d.model === 'king' || d.model === 'yakebone' || d.model === 'hoshikage') {
      if (id === 'leg0') rx = sw * 0.9; else if (id === 'leg1') rx = -sw * 0.9;
      else if (id === 'arm0' || id === 'arm1') {
        const side = id === 'arm0' ? 1 : -1;
        rx = -sw * 0.5 * side + Math.sin(t * 0.07 + side) * 0.08; rz = side * (0.08 + Math.sin(t * 0.05) * 0.04);
        if (e.swing > 0) rx = -1.9 * Math.sin(Math.min(1, e.swing / (d.boss ? 20 : 8)) * Math.PI);
        if (d.boss && e.slam > 6) rx = -2.6;
      } else if (id === 'head' || id === 'crown' || id.startsWith('spike')) { rz = Math.sin(t * 0.04) * 0.12; rx = 0.1; }
    } else if (d.model === 'chicken') {
      if (id === 'leg0') rx = sw * 1.1; else if (id === 'leg1') rx = -sw * 1.1;
      else if (id.startsWith('wing')) rz = (id === 'wing0' ? 1 : -1) * (e.onGround ? 0 : (0.9 + Math.sin(t * 1.6) * 0.7));
      else if (id !== 'body') rx = Math.sin(e.walk * 2) * 0.12 * e.walkAmp;
    } else {
      if (id === 'leg0' || id === 'leg3') rx = sw * 0.8; else if (id === 'leg1' || id === 'leg2') rx = -sw * 0.8;
      else if (id !== 'body') rx = e.headPitch + Math.sin(t * 0.05 + e.spinSeed0) * 0.06;
    }
    let M = _mm;
    if (rx || ry || rz || ox || oy || oz) {
      m4Translate(_mp, p.pv[0] + ox, p.pv[1] + oy, p.pv[2] + oz);
      if (ry) { m4RotY(_mt, ry); m4Mul(_mp, _mp, _mt); }
      if (rz) { m4RotZ(_mt, rz); m4Mul(_mp, _mp, _mt); }
      if (rx) { m4RotX(_mt, rx); m4Mul(_mp, _mp, _mt); }
      m4Translate(_mt, -p.pv[0], -p.pv[1], -p.pv[2]); m4Mul(_mp, _mp, _mt);
      m4Mul(_mp, _mm, _mp); M = _mp;
    }
    const bb = p.b;
    for (let f = 0; f < 6; f++) {
      const uv = p.uv[f], sh = FACE_SHADE[f] * 0.9 + 0.1;
      for (let k = 0; k < 4; k++) {
        const c = (f * 4 + k) * 3;
        m4Point(_pp, M, CPOS[c] ? bb[3] : bb[0], CPOS[c + 1] ? bb[4] : bb[1], CPOS[c + 2] ? bb[5] : bb[2]);
        dynEnt.v(_pp[0], _pp[1], _pp[2], (uv[0] + 0.02 + CORNER_UV[k][0] * (uv[2] - 0.04)) / MOB_TEX, (uv[1] + 0.02 + (1 - CORNER_UV[k][1]) * (uv[3] - 0.04)) / MOB_TEX, 0, r * sh, g * sh, b * sh, 1);
      }
    }
  }
}
// 視線が当たる生き物を探す
function pickMob(ox, oy, oz, dx, dy, dz, maxDist) {
  let best = null, bt = maxDist;
  for (const e of ents) {
    if (e.kind !== 'mob' || e.hp <= 0) continue;
    const h = rayBox(ox, oy, oz, dx, dy, dz, e.x - e.hw - 0.1, e.y, e.z - e.hw - 0.1, e.x + e.hw + 0.1, e.y + e.h, e.z + e.hw + 0.1);
    if (h && h.t < bt) { bt = h.t; best = e; }
    if (e.segs) for (let i = 1; i < e.segs.length; i++) { const s = e.segs[i], w = 1.25 - i * 0.07, h2 = rayBox(ox, oy, oz, dx, dy, dz, s.x - w, s.y, s.z - w, s.x + w, s.y + 1.7, s.z + w); if (h2 && h2.t < bt) { bt = h2.t; best = e; } }
  }
  return best ? { e: best, t: bt } : null;
}

// 世界側から呼ばれる小さな演出
function fxLeafDecay(x, y, z, id) { fxBlockBits(x + 0.5, y + 0.5, z + 0.5, id, 4, 0.8); }
function fxFizz(x, y, z) { fxPuff(x + 0.5, y + 0.8, z + 0.5, 8, 0.8, 0.8, 0.8, { speed: 0.8, life: 1, up: 1.2 }); sfxAt('fizz', x, y, z); }
function fxSmeltDone(x, y, z) { if (Math.hypot(x - player.x, z - player.z) < 12) sfxAt('ding', x, y, z); }

// ================= ホムラの底・ソラのはて の生き物 =================
// まわりの人（自分と、同じ世界にいるほかの人）にまとめてダメージ。test(x, y, z) が true の人だけ
function areaHit(test, amount, fx, fz, kb, src) {
  if (!player.dead && test(player.x, player.y, player.z)) player.damage(amount, fx, fz, kb, src);
  if (net.on) for (const p of net.peers.values()) if (!p.dead && p.mode === 0 && p.dim === game.world.dim && net.fresh(p) && test(p.x, p.y, p.z)) hitTarget(p, amount, fx, fz, kb, src);
}
function flyTo(world, e, tx, ty, tz, k) {
  if (e.kb === 0) { e.vx += clamp((tx - e.x) * 0.6 - e.vx, -k, k); e.vy += clamp((ty - e.y) * 0.8 - e.vy, -k, k); e.vz += clamp((tz - e.z) * 0.6 - e.vz, -k, k); }
  moveAABB(world, e, e.vx * 0.05, e.vy * 0.05, e.vz * 0.05);
}
// ホムラビ：まわりを回りながら、火の玉を3連発でうつ
function homurabiTick(world, e, canTarget, pdx, pdy, pdz, pd3, T) {
  let tx = e.x, ty = e.y, tz = e.z;
  if (canTarget && pd3 < 28) {
    const a = e.age * 0.025 + e.spinOff0, rr = 7;
    tx = T.x + Math.cos(a) * rr; tz = T.z + Math.sin(a) * rr; ty = T.y + 2.4 + Math.sin(e.age * 0.06) * 0.8;
    e.yaw = Math.atan2(-pdx, -pdz);
    if (--e.shotCd <= 0 && pd3 < 22) { e.burst = 3; e.shotCd = 95 + rnd(50); e.swing = 30; sfxAt('say_homurabi', e.x, e.y, e.z); }
    if (e.burst > 0 && e.age % 7 === 0 && e.shotCd < 125) {
      e.burst--;
      const sx = e.x, sy = e.y + 1.0, sz = e.z, dx = T.x - sx, dy = T.y + 1.0 - sy, dz = T.z - sz, dl = Math.hypot(dx, dy, dz) || 1;
      spawnShot(sx, sy, sz, dx / dl * 11, dy / dl * 11, dz / dl * 11, MOBS.homurabi.dmg, 2); sfxAt('shoot', sx, sy, sz);
    }
  } else { if (--e.timer <= 0) { e.timer = 40 + rnd(60); e.moveYaw = Math.random() * 6.28; } tx = e.x - Math.sin(e.moveYaw) * 3; tz = e.z - Math.cos(e.moveYaw) * 3; ty = e.y + Math.sin(e.age * 0.05) * 0.4 - (SOLID[world.getBlock(Math.floor(e.x), Math.floor(e.y - 2.5), Math.floor(e.z))] ? 0 : 0.3); }
  if (e.swing > 0) e.swing--;
  flyTo(world, e, tx, ty, tz, 0.4);
  if (e.age % 2 === 0) fxPuff(e.x + (Math.random() - 0.5) * 0.6, e.y + 0.4 + Math.random() * 0.8, e.z + (Math.random() - 0.5) * 0.6, 1, 1, 0.55 + Math.random() * 0.3, 0.15, { glow: true, speed: 0.3, life: 0.5, size: 0.07, up: 0.9, grav: 0 });
}
// ウキクラゲ：ゆっくり ただよい、見つけると 大きな火の玉をはく
function kurageTick(world, e, canTarget, pdx, pdy, pdz, pd3, T) {
  let tx = e.x, ty = e.y, tz = e.z;
  if (--e.timer <= 0) { e.timer = 60 + rnd(100); e.moveYaw = Math.random() * 6.28; e.rise = (Math.random() - 0.5) * 1.6; }
  tx = e.x - Math.sin(e.moveYaw) * 3; tz = e.z - Math.cos(e.moveYaw) * 3; ty = e.y + (e.rise || 0);
  if (canTarget && pd3 < 46) {
    e.yaw = Math.atan2(-pdx, -pdz);
    if (pd3 < 9) { tx = e.x - pdx / pd3 * 3; tz = e.z - pdz / pd3 * 3; ty = e.y + 1.5; }
    if (e.swing > 0) { if (--e.swing === 0) { const sx = e.x, sy = e.y + 1.2, sz = e.z, dx = T.x - sx, dy = T.y + 0.9 - sy, dz = T.z - sz, dl = Math.hypot(dx, dy, dz) || 1; spawnShot(sx + dx / dl * 1.2, sy, sz + dz / dl * 1.2, dx / dl * 7.5, dy / dl * 7.5, dz / dl * 7.5, MOBS.ukikurage.dmg, 3); sfxAt('shoot', sx, sy, sz); } }
    else if (--e.shotCd <= 0) {
      e.shotCd = 70 + rnd(50);
      const sx = e.x, sy = e.y + 1.2, sz = e.z, dx = T.x - sx, dy = T.y + 0.9 - sy, dz = T.z - sz, dl = Math.hypot(dx, dy, dz) || 1;
      if (!world.raycast(sx, sy, sz, dx / dl, dy / dl, dz / dl, dl)) { e.swing = 14; sfxAt('say_kurage', e.x, e.y, e.z); }
    }
  }
  flyTo(world, e, tx, ty, tz, 0.12);
  if (e.hitH) e.moveYaw += 1.2;
}
function mobCount(type, r) { let n = 0; for (const e of ents) if (e.kind === 'mob' && e.type === type && !e.dead && (!r || Math.hypot(e.x - player.x, e.z - player.z) < r)) n++; return n; }
function trySpawnHomura(world, R) {
  const a = Math.random() * 6.283, r = Math.sqrt(Math.random()) * R, x = Math.floor(player.x + Math.cos(a) * r), z = Math.floor(player.z + Math.sin(a) * r);
  if (!world.isLoaded(x, z)) return false;
  const y = findFloor(world, x, 8 + rnd(112), z);
  if (y === null || y <= H_LAVA || !spawnSpot(world, x, y, z)) return false;
  if (nearestPlayerDist(x + 0.5, y, z + 0.5) < 24) return false;
  const below = world.getBlock(x, y - 1, z), rr = Math.random();
  let type = null;
  if (below === B.yake_bricks) type = rr < 0.6 ? 'homurabi' : 'yakebone';
  else if (below === B.nageki_sand) type = rr < 0.55 ? 'yakebone' : 'ukikurage';
  else type = rr < 0.42 ? 'magmadama' : rr < 0.66 ? 'ukikurage' : rr < 0.72 ? 'homurabi' : null;
  if (!type) return false;
  if (type === 'ukikurage') {
    if (mobCount('ukikurage') >= 3) return false;
    for (let k = 2; k <= 7; k++) if (SOLID[world.getBlock(x, y + k, z)] || SOLID[world.getBlock(x + 2, y + k, z)] || SOLID[world.getBlock(x - 2, y + k, z)] || SOLID[world.getBlock(x, y + k, z + 2)] || SOLID[world.getBlock(x, y + k, z - 2)]) return false;
    spawnMob(type, x + 0.5, y + 3.5, z + 0.5); return true;
  }
  const n = type === 'homurabi' ? 1 : 1 + rnd(2);
  let made = 0;
  for (let k = 0; k < n; k++) {
    const mx = k ? x + rnd(7) - 3 : x, mz = k ? z + rnd(7) - 3 : z, my = k ? findFloor(world, mx, y + 3, mz) : y;
    if (my === null || !world.isLoaded(mx, mz) || !spawnSpot(world, mx, my, mz)) continue;
    spawnMob(type, mx + 0.5, type === 'homurabi' ? my + 1.2 : my, mz + 0.5); made++;
  }
  return made > 0;
}
// とりでの中（やけレンガの床の上）には ホムラビが わきやすい
function fortSpawn(world) {
  if (mobCount('homurabi', 56) >= 5) return;
  for (let t = 0; t < 8; t++) {
    const x = Math.floor(player.x + (Math.random() - 0.5) * 80), z = Math.floor(player.z + (Math.random() - 0.5) * 80), y = FORT_Y + 1;
    if (!world.isLoaded(x, z) || world.getBlock(x, y - 1, z) !== B.yake_bricks || SOLID[world.getBlock(x, y, z)] || SOLID[world.getBlock(x, y + 1, z)]) continue;
    if (nearestPlayerDist(x + 0.5, y, z + 0.5) < 14) continue;
    spawnMob('homurabi', x + 0.5, y + 1.2, z + 0.5); return;
  }
}
function trySpawnSora(world, R) {
  if ((game.boss && !game.boss.dead) || (!game.soraDone && game.diff > 0) || mobCount('hoshikage') >= 6) return false;   // ボスがいる間は出ない（戦いに集中できるように）
  const a = Math.random() * 6.283, r = 24 + Math.random() * Math.max(8, R - 24), x = Math.floor(player.x + Math.cos(a) * r), z = Math.floor(player.z + Math.sin(a) * r);
  if (!world.isLoaded(x, z)) return false;
  const sy = world.surfaceY(x, z);
  if (sy < 2 || world.getBlock(x, sy, z) !== B.soraishi || !spawnSpot(world, x, sy + 1, z)) return false;
  if (nearestPlayerDist(x + 0.5, sy + 1, z + 0.5) < 24) return false;
  spawnMob('hoshikage', x + 0.5, sy + 1, z + 0.5);
  return true;
}

// ---------------- ソラのはてのボス「ホシクイ」 ----------------
// まわる → とびかかる（すれちがいに たたける）→ まんなかの台にとまる（たたける。とちゅうで いきをはく）をくり返す。
// 柱の上の「ほしの結晶」が残っていると、体力がもどっていく。
const HOSHI_SEGS = 8, HOSHI_LINK = 1.9;
function hoshiTick(world, e, canTarget, T) {
  const d = MOBS.hoshikui, PX = 0.5, PZ = 0.5, PY = SORA_PED_Y + 5;
  if (e.ph === undefined) { e.ph = 0; e.bt = 0; e.pd = 140; e.ang = Math.atan2(e.z, e.x); e.cnt = 0; e.dirS = 1; e.land = 0; }
  e.bt++;
  let tx = e.x, ty = e.y, tz = e.z, sp = 10;
  const tgt = canTarget && Math.hypot(T.x, T.z) < 90 && T.y > 30;
  e.breath = false;
  if (e.ph === 0) {            // まわる
    e.ang += 0.0125 * e.dirS; tx = Math.cos(e.ang) * 42; tz = Math.sin(e.ang) * 42; ty = 86 + Math.sin(e.ang * 2) * 5; sp = 11;
    if (tgt && e.hp < e.maxHp * 0.65 && e.bt % 55 === 30) {
      const sx = e.x, sy = e.y + 1, sz = e.z;
      for (let k = -1; k <= 1; k++) { const dx = T.x - sx, dy = T.y + 1 - sy, dz = T.z - sz, dl = Math.hypot(dx, dy, dz) || 1, a = k * 0.16, cs = Math.cos(a), sn = Math.sin(a); spawnShot(sx, sy, sz, (dx * cs - dz * sn) / dl * 14, dy / dl * 14, (dx * sn + dz * cs) / dl * 14, 5, 4); }
      sfxAt('shoot', sx, sy, sz);
    }
    if (e.bt > e.pd) {
      if (tgt) { e.cnt++; if (e.cnt % 3 === 0) { e.ph = 2; e.land = 0; } else { e.ph = 1; e.sx = T.x; e.sy = T.y + 0.6; e.sz = T.z; e.hitDone = false; sfxAt('roar', e.x, e.y, e.z); } }
      e.bt = 0; e.pd = 110 + rnd(110); if (rnd(3) === 0) e.dirS = -e.dirS;
    }
  } else if (e.ph === 1) {     // とびかかる
    if (e.bt < 22 && tgt) { e.sx = T.x; e.sy = T.y + 0.6; e.sz = T.z; }
    tx = e.sx; ty = e.sy; tz = e.sz; sp = 17;
    if (!e.hitDone) {
      const hx = e.x, hy = e.y + 1, hz = e.z; let any = false;
      areaHit((x, y, z) => { const ok = Math.hypot(x - hx, y + 0.9 - hy, z - hz) < 3.1; if (ok) any = true; return ok; }, d.dmg * DIFF_DMG[game.diff], e.x - e.vx, e.z - e.vz, 13, d.name);
      if (any) e.hitDone = true;
    }
    if (Math.hypot(e.x - tx, e.y - ty, e.z - tz) < 2.2 || e.bt > 110) { e.ph = 3; e.bt = 0; const fl = Math.hypot(e.vx, e.vz) || 1; e.cx2 = e.x + e.vx / fl * 34; e.cz2 = e.z + e.vz / fl * 34; }
  } else if (e.ph === 2) {     // まんなかの台にとまる
    tx = PX; ty = PY; tz = PZ; sp = 11;
    if (!e.land) {
      if (Math.hypot(e.x - tx, e.y - ty, e.z - tz) < 1.3) { e.land = 1; e.bt = 0; e.x = PX; e.y = PY; e.z = PZ; sfxAt('slam', e.x, e.y, e.z); if (Math.hypot(player.x - e.x, player.z - e.z) < 40) game.shake = 0.45; }
      else if (e.bt > 320) { e.ph = 0; e.bt = 0; e.ang = Math.atan2(e.z, e.x); }
    } else {
      sp = 0;
      if (tgt) e.yawT = Math.atan2(-(T.x - e.x), -(T.z - e.z));
      if (e.bt === 30) sfxAt('breath', e.x, e.y, e.z);
      if (e.bt >= 42 && e.bt < 110) {   // 星のいき：台のまわりが あぶない
        e.breath = true;
        if (e.bt % 10 === 5) areaHit((x, y, z) => Math.hypot(x - PX, z - PZ) < 8.6 && y < PY + 3 && y > PY - 9, 3 * DIFF_DMG[game.diff], PX, PZ, 5, 'ホシクイのいき');
      }
      if (e.bt > 165) { e.ph = 3; e.bt = 0; e.land = 0; e.cx2 = Math.cos(e.ang) * 42; e.cz2 = Math.sin(e.ang) * 42; sfxAt('say_hoshi', e.x, e.y, e.z); }
    }
  } else {                     // 上へもどる
    tx = e.cx2; tz = e.cz2; ty = 86; sp = 12;
    if (e.bt > 70 || Math.hypot(e.x - tx, e.z - tz) < 4) { e.ph = 0; e.bt = 0; e.ang = Math.atan2(e.z, e.x); }
  }
  if (sp > 0) {
    if (e.kb === 0) { const dx = tx - e.x, dy = ty - e.y, dz = tz - e.z, dl = Math.hypot(dx, dy, dz) || 1, k = 0.12; e.vx += (dx / dl * sp - e.vx) * k; e.vy += (dy / dl * sp - e.vy) * k; e.vz += (dz / dl * sp - e.vz) * k; }
    e.x += e.vx * 0.05; e.y += e.vy * 0.05; e.z += e.vz * 0.05;
    if (Math.hypot(e.vx, e.vz) > 1) e.yaw = lerpAngle(e.yaw, Math.atan2(-e.vx, -e.vz), 0.25);
  } else { e.vx = e.vy = e.vz = 0; e.x = PX; e.y = PY; e.z = PZ; if (e.yawT !== undefined) e.yaw = lerpAngle(e.yaw, e.yawT, 0.08); }
  if (e.y < 20) e.y = 20;
  hoshiBody(world, e, true);
}
// 胴のふし・結晶からの回復・いきの見た目（動かしている端末でも、見ているだけの端末でも呼ぶ）
function hoshiBody(world, e, own) {
  if (!e.segs) { e.segs = []; for (let i = 0; i <= HOSHI_SEGS; i++) e.segs.push({ x: e.x + Math.sin(e.yaw) * i * HOSHI_LINK, y: e.y, z: e.z + Math.cos(e.yaw) * i * HOSHI_LINK }); e.pit = 0; }
  const s = e.segs; s[0].x = e.x; s[0].y = e.y; s[0].z = e.z;
  for (let i = 1; i < s.length; i++) {
    const a = s[i - 1], b = s[i]; let dx = b.x - a.x, dy = b.y - a.y, dz = b.z - a.z; const dl = Math.hypot(dx, dy, dz) || 1;
    b.x = a.x + dx / dl * HOSHI_LINK; b.y = a.y + dy / dl * HOSHI_LINK; b.z = a.z + dz / dl * HOSHI_LINK;
    if (e.land) b.y += (Math.max(SORA_PED_Y + 1.2, a.y - 0.9) - b.y) * 0.08;   // とまっている間は 体をたらす
  }
  const mvx = e.x - e.px, mvy = e.y - e.py, mvz = e.z - e.pz, hs = Math.hypot(mvx, mvz);
  e.pit += ((hs > 0.02 ? Math.atan2(mvy, hs) : 0) - e.pit) * 0.2;
  if (e.hp <= 0) return;
  if (e.age % 10 === 0) {   // いちばん近い結晶
    let best = null, bd = 70;
    for (const p of soraPillars()) { if (world.getBlock(p.x, p.top + 2, p.z) !== B.hoshi_crystal) continue; const dd = Math.hypot(p.x - e.x, p.top - e.y, p.z - e.z); if (dd < bd) { bd = dd; best = p; } }
    e.healP = best;
    if (own && best && e.hp < e.maxHp) e.hp = Math.min(e.maxHp, e.hp + 1);
  }
  if (e.healP && e.age % 3 === 0) {   // 結晶から光のすじ
    const p = e.healP, x0 = p.x + 0.5, y0 = p.top + 2.5, z0 = p.z + 0.5;
    for (let k = 0; k < 5; k++) { const t = Math.random(); fxPuff(x0 + (e.x - x0) * t, y0 + (e.y + 1 - y0) * t, z0 + (e.z - z0) * t, 1, 1, 0.6, 0.9, { glow: true, speed: 0.2, life: 0.4, size: 0.1, up: 0, grav: 0 }); }
  }
  if (e.breath) for (let k = 0; k < 7; k++) { const a = Math.random() * 6.283, r = 1.5 + Math.random() * 7; fxPuff(0.5 + Math.cos(a) * r, SORA_PED_Y + 1 + Math.random() * 3.5, 0.5 + Math.sin(a) * r, 1, 0.75, 0.6, 1, { glow: true, speed: 1.2, life: 0.7, size: 0.13, up: 0.8, grav: 0 }); }
}
// たおれるところ：ゆっくり上がりながら 光がふき出す
function hoshiDying(world, e) {
  e.breath = false; e.land = 0; e.y += 0.05; e.yaw += 0.05;
  hoshiBody(world, e, true);
  if (e.death === 2) { sfxAt('roar', e.x, e.y, e.z); game.shake = 0.6; }
  if (e.death % 2 === 0) { const s = e.segs[rnd(e.segs.length)]; fxPuff(s.x, s.y + 0.8, s.z, 8, 1, 0.9, 1, { glow: true, speed: 6, life: 1.1, size: 0.16, spread: 1 }); }
  if (e.death % 14 === 0) sfxAt('crystal', e.x, e.y, e.z);
}
// たおしたあと：まんなかの台に かえりの門と たまご（動かしていた端末だけが置く。ブロックの変更として全員に届く）
function hoshiReward(world, e) {
  for (const s of e.segs || []) fxPuff(s.x, s.y + 0.8, s.z, 30, 1, 0.9, 1, { glow: true, speed: 7, life: 1.4, size: 0.18, spread: 1.4 });
  sfxAt('boom', e.x, e.y, e.z);
  const y = SORA_PED_Y + 1;
  for (const [dx, dz] of soraGateCells()) { const id = world.getBlock(dx, y, dz); if (id && id !== B.sora_gate) world.setBlock(dx, y, dz, 0, 0, 1); }
  for (const [dx, dz] of soraGateCells()) world.setBlock(dx, y, dz, B.sora_gate, 2, 1);
  world.setBlock(0, SORA_PED_Y + 5, 0, B.hoshi_egg, 0);
  e.x = 0.5; e.z = 3.5; e.y = SORA_PED_Y + 3;   // 落とし物は 台のそばに
}
const _mb = m4(), _mq = m4();
// 形ひとつを 好きな向き・場所に描く。pose(id) は [rx, ry, rz]（なければ null）
function drawModel(model, base, r, g, b, pose) {
  for (const p of model) {
    let M = base; const a = pose ? pose(p.id) : null;
    if (a) {
      m4Translate(_mq, p.pv[0], p.pv[1], p.pv[2]);
      if (a[1]) { m4RotY(_mt, a[1]); m4Mul(_mq, _mq, _mt); }
      if (a[2]) { m4RotZ(_mt, a[2]); m4Mul(_mq, _mq, _mt); }
      if (a[0]) { m4RotX(_mt, a[0]); m4Mul(_mq, _mq, _mt); }
      m4Translate(_mt, -p.pv[0], -p.pv[1], -p.pv[2]); m4Mul(_mq, _mq, _mt);
      m4Mul(_mq, base, _mq); M = _mq;
    }
    const bb = p.b;
    for (let f = 0; f < 6; f++) {
      const uv = p.uv[f], sh = FACE_SHADE[f] * 0.9 + 0.1;
      for (let k = 0; k < 4; k++) {
        const c = (f * 4 + k) * 3;
        m4Point(_pp, M, CPOS[c] ? bb[3] : bb[0], CPOS[c + 1] ? bb[4] : bb[1], CPOS[c + 2] ? bb[5] : bb[2]);
        dynEnt.v(_pp[0], _pp[1], _pp[2], (uv[0] + 0.02 + CORNER_UV[k][0] * (uv[2] - 0.04)) / MOB_TEX, (uv[1] + 0.02 + (1 - CORNER_UV[k][1]) * (uv[3] - 0.04)) / MOB_TEX, 0, r * sh, g * sh, b * sh, 1);
      }
    }
  }
}
function drawHoshi(world, e, x, y, z, alpha) {
  const d = MOBS.hoshikui, sc = d.scale / 16, t = e.age + alpha;
  lightRGB(world.getLightRaw(Math.floor(e.x), clamp(Math.floor(e.y + 1), 0, CH - 1), Math.floor(e.z)), _lcE);
  let r = Math.max(0.7, _lcE[0]), g = Math.max(0.66, _lcE[1]), b = Math.max(0.8, _lcE[2]);
  if (e.hurt > 0 || e.hp <= 0) { r = Math.min(1.3, r * 1.6 + 0.2); g *= 0.5; b *= 0.6; }
  const yaw = lerpAngle(e.pyaw, e.yaw, alpha), fade = e.hp <= 0 ? Math.max(0.2, 1 - e.death / 110) : 1;
  m4Translate(_mb, x, y, z); m4RotY(_mr, yaw); m4Mul(_mb, _mb, _mr); m4RotX(_mr, clamp(e.pit || 0, -0.9, 0.9)); m4Mul(_mb, _mb, _mr); m4Scale(_mr, sc * fade, sc * fade, sc * fade); m4Mul(_mb, _mb, _mr);
  const mouth = e.breath ? 0.75 : e.ph === 1 ? 0.5 : 0.08 + Math.sin(t * 0.08) * 0.05;
  drawModel(MODELS.hoshikui, _mb, r, g, b, (id) => id === 'jaw' ? [mouth, 0, 0] : null);
  const s = e.segs; if (!s) return;
  const ox = x - e.x, oy = y - e.y, oz = z - e.z;   // カメラから見た位置へのずれ
  for (let i = 1; i < s.length; i++) {
    const a = s[i - 1], c = s[i], dx = a.x - c.x, dy = a.y - c.y, dz = a.z - c.z, hs = Math.hypot(dx, dz);
    const k = sc * fade * (1 - i * 0.065);
    m4Translate(_mb, c.x + ox, c.y + oy, c.z + oz); m4RotY(_mr, Math.atan2(-dx, -dz)); m4Mul(_mb, _mb, _mr); m4RotX(_mr, clamp(Math.atan2(dy, hs || 1e-4), -1.2, 1.2)); m4Mul(_mb, _mb, _mr); m4Scale(_mr, k, k, k); m4Mul(_mb, _mb, _mr);
    drawModel(i === s.length - 1 ? MODELS.hoshitail : MODELS.hoshiseg, _mb, r, g, b, null);
    if (i === 1 || i === 3) { const fl = e.land ? 1.15 : Math.sin(t * 0.22 + i) * 0.55 + 0.1; drawModel(MODELS.hoshiwing, _mb, r, g, b, (id) => [0, 0, id === 'wing0' ? fl : -fl]); }
  }
}
