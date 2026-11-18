// ===== 09_player.js : プレイヤーの動き・こわす／置く・持ち物・体力と空腹 =====
const input = { fwd: 0, strafe: 0, jump: false, sneak: false, sprint: false, breakHeld: false, breakPressed: false, useHeld: false, usePressed: false, lookDX: 0, lookDY: 0, rayNdc: null };
const DEATH_MSG = { '落下': '高いところから落ちてしまった', '溶岩': '溶岩に落ちてしまった', '空腹': 'おなかが空いて力尽きた', '水': 'おぼれてしまった', 'サボテン': 'サボテンのトゲにやられた', '奈落': '世界の底に落ちてしまった', '火': '火に つつまれてしまった', 'マグマ石': 'マグマ石の上で やけどしてしまった', '結晶': 'ほしの結晶が はじけて まきこまれた' };

class Player {
  constructor() { this.hw = 0.3; this.h = 1.8; this.reset(); }
  reset() {
    this.x = 0; this.y = 80; this.z = 0; this.vx = 0; this.vy = 0; this.vz = 0; this.yaw = 0; this.pitch = 0;
    this.onGround = false; this.hitH = false; this.mode = 0; this.flying = false;
    this.hp = 20; this.food = 20; this.sat = 5; this.exh = 0; this.air = 300; this.dead = false;
    this.inv = new Array(36).fill(null); this.armor = [null, null, null, null, null]; this.sel = 0;   // 防具4つ＋盾 this.cursor = null;
    this.spawn = null; this.brk = null; this.brkDelay = 0; this.swingT = 0; this.cool = 0; this.useCool = 0; this.eating = 0; this.eatSnd = 0; this.equipT = 0;
    this.sneaking = false; this.sprinting = false; this.inWater = false; this.inLava = false; this.headIn = 0;
    this.fallDist = 0; this.hurtT = 0; this.regenT = 0; this.starveT = 0; this.stepAcc = 0; this.bob = 0; this.bobAmp = 0; this.jumpCd = 0;
    this.target = null; this.targetMob = null; this.ray = [0, 0, -1]; this.eyeOff = 1.62; this.invDirty = true; this.deathPos = null; this.lastSel = -1;
    this.stats = { broken: 0, placed: 0, kills: 0, deaths: 0, crafted: 0, dist: 0 };
    this.burnT = 0; this.gateT = 0; this.gateWait = false;   // 火がついている残り時間／門の中にいる時間／門から出るまで待つ
    this.fx = { regen: 0, speed: 0, str: 0, fire: 0, night: 0 };   // くすりの効き目の のこり（20＝1秒）
    this.ride = null; this.gliding = false; this.airT = 0; this.jumpWas = false; this.sneakHold = false; this.glAcc = 0; this.glWear = 0; this.h = 1.8;   // 乗り物（ride＝{t, hp, c, s, tm, n, yaw, …}）と 滑空
    this.trades = {};   // 村人との こうかん：{村人の番号: [日にち, 1つ目を使った回数, …]}
    this.xpLv = 0; this.xpPt = 0; this.enchSeed = (Math.random() * 0x7fffffff) | 0;   // 経験値：レベルと、そのレベルの中で ためた数
    this.drawT = 0; this.autoBow = 0; this.blocking = false; this.blockK = 0; this.noBlockT = 0; this.webT = 0; this.noArrowT = 0;   // 弓を引いている時間／タップで自動で引く残り／盾をかまえているか／糸にからまっている残り
  }
  eyeY() { return this.y + this.eyeOff; }
  held() { return this.inv[this.sel]; }
  heldTool() { const s = this.inv[this.sel]; return s && ITEMS[s.id] && ITEMS[s.id].tool ? ITEMS[s.id].tool : null; }
  stat(kind, id) { game.onStat(kind, id); }
  lookF() { return ((2 - Math.round(this.yaw / (Math.PI / 2))) % 4 + 4) % 4; }

  // ---- 持ち物 ----
  give(id, n, d) {
    if (id === I.xp_orb) { this.addXp(n); return 0; }
    const max = maxStack(id);
    if (max > 1 && !d) for (let i = 0; i < 36 && n > 0; i++) { const s = this.inv[i]; if (s && s.id === id && s.n < max && !s.d) { const k = Math.min(n, max - s.n); s.n += k; n -= k; } }
    for (let i = 0; i < 36 && n > 0; i++) if (!this.inv[i]) { const k = Math.min(n, max); this.inv[i] = { id, n: k, d: d || 0 }; n -= k; }
    this.invDirty = true;
    return n;
  }
  canTake(id, d) {
    if (id === I.xp_orb) return true;
    const max = maxStack(id);
    for (let i = 0; i < 36; i++) { const s = this.inv[i]; if (!s) return true; if (max > 1 && !d && s.id === id && s.n < max && !s.d) return true; }
    return false;
  }
  tradeLeft(vs, i, max) { const r = this.trades[vs]; return r && r[0] === game.world.day ? Math.max(0, max - (r[i + 1] | 0)) : max; }
  tradeUse(vs, i) { const day = game.world.day; let r = this.trades[vs]; if (!r || r[0] !== day) r = this.trades[vs] = [day, 0, 0, 0, 0, 0, 0]; r[i + 1]++; }
  countSpec(spec) { let c = 0; for (const s of this.inv) if (s && specMatch(spec, s.id)) c += s.n; return c; }
  consumeSpec(spec, n) {
    for (let i = 35; i >= 0 && n > 0; i--) { const s = this.inv[i]; if (s && specMatch(spec, s.id)) { const k = Math.min(n, s.n); s.n -= k; n -= k; if (s.n <= 0) this.inv[i] = null; } }
    this.invDirty = true; return n === 0;
  }
  useHeldOne() { if (this.mode === 1) return; const s = this.inv[this.sel]; if (!s) return; s.n--; if (s.n <= 0) this.inv[this.sel] = null; this.invDirty = true; }
  wearHeld(n) {
    if (this.mode === 1) return;
    const s = this.inv[this.sel]; if (!s) return; const t = ITEMS[s.id].tool; if (!t) return;
    const un = unbrLv(s.id, s.d); if (un && Math.random() < un / (un + 1)) return;   // 「じょうぶ」
    s.d += n; this.invDirty = true;
    if (itemDmg(s.d) >= t.dur) { this.inv[this.sel] = null; sfx('toolbreak'); ui.toast(itemName(s.id) + ' がこわれた'); fxPuff(this.x - Math.sin(this.yaw) * 0.6, this.eyeY() - 0.3, this.z - Math.cos(this.yaw) * 0.6, 8, 0.6, 0.5, 0.35, { speed: 2, life: 0.5, grav: 12 }); }
  }
  // 経験値をもらう。レベルが上がったら 音と表示
  addXp(n) {
    if (!(n > 0)) return;
    this.xpPt += n; let up = false;
    while (this.xpPt >= xpNeed(this.xpLv)) { this.xpPt -= xpNeed(this.xpLv); this.xpLv++; up = true; }
    if (up) { sfx('levelup', 0.7); ui.levelFx(this.xpLv); } else sfx('xp', 0.45);
  }
  // レベルを使う（足りなければ false）
  spendLevels(k) { if (this.mode === 1) return true; if (this.xpLv < k) return false; this.xpLv -= k; this.xpPt = Math.min(this.xpPt, xpNeed(this.xpLv) - 1); return true; }
  smeltXp(id, n) { const x = n * (XP_SMELT[id] || 0.1), w = Math.floor(x) + (Math.random() < x - Math.floor(x) ? 1 : 0); if (w > 0) this.addXp(w); }
  armorPoints() { let p = 0; for (const a of this.armor) if (a) p += ITEMS[a.id].armor.def; return p; }
  swing() { this.swingT = 1; if (net.on) net.swingN = (net.swingN + 1) & 255; }

  // ---- 毎フレーム ----
  update(dt) {
    const world = game.world;
    this.yaw -= input.lookDX; this.pitch = clamp(this.pitch - input.lookDY, -1.55, 1.55); input.lookDX = input.lookDY = 0;
    if (this.yaw > Math.PI * 2) this.yaw -= Math.PI * 2; else if (this.yaw < 0) this.yaw += Math.PI * 2;
    if (this.sel !== this.lastSel) { this.lastSel = this.sel; this.equipT = 1; this.brk = null; this.eating = 0; ui.showHeldName(); }
    this.equipT = Math.max(0, this.equipT - dt * 5);
    if (this.dead || !world.isLoaded(Math.floor(this.x), Math.floor(this.z))) { input.usePressed = input.breakPressed = false; return; }
    let rem = dt;
    while (rem > 1e-5) { const st = Math.min(rem, 1 / 60); this.physics(world, st); rem -= st; }
    this.interact(world, dt);
    input.usePressed = input.breakPressed = false;
    this.sprintK = (this.sprintK || 0) + ((this.sprinting ? 1 : 0) - (this.sprintK || 0)) * Math.min(1, dt * 8);   // 走り出すと 画面が なめらかに広がる
    const want = this.ride ? RIDE_EYE[this.ride.t] : this.gliding ? 0.6 : this.sneaking ? 1.47 : 1.62; this.eyeOff += (want - this.eyeOff) * Math.min(1, dt * 14);
    if (this.stepLift) { this.stepLift -= Math.max(this.stepLift * dt * 16, dt * 1.2); if (this.stepLift < 0.004) this.stepLift = 0; }
  }
  // ---- 乗り物 ----
  mount(r) {
    r.wild = 0; r.rv = 0; r.walk = 0; r.walkAmp = 0; if (r.yaw === undefined) r.yaw = this.yaw;
    this.ride = r; this.flying = false; this.vx = this.vy = this.vz = 0; this.fallDist = 0; this.sprinting = false; this.sneaking = false; this.gliding = false; this.sneakHold = true;
    this.h = r.t === 'horse' ? 2.5 : 1.8;
    if (r.t === 'horse' && !r.tm) { r.wild = 2 + Math.random() * 2.5; sfx('say_horse', 0.8); ui.toast('ウマが あばれている！ ふり落とされずに いられるかな', 3); }
    else ui.toast(r.t === 'horse' && !r.s ? '「くら」を つけると、思いどおりに 走れる。しゃがむ で おりる' : 'しゃがむ で おりる', 3);
    sfx(r.t === 'horse' ? 'equip' : 'place_wood', 0.6); game.onStat('ride', r.t);
  }
  // おりる：その場に 乗り物を もどす
  dismount() {
    const r = this.ride; if (!r) return null; this.ride = null; this.h = 1.8; this.sneakHold = false;
    const e = spawnMob(r.t, this.x, this.y + 0.02, this.z); e.yaw = e.pyaw = r.yaw; e.hp = Math.max(1, r.hp);
    if (r.t === 'horse') { e.color = r.c || 1; e.saddle = !!r.s; e.tamer = r.tm || null; e.tameN = r.n | 0; }
    const world = game.world, sx = Math.cos(r.yaw), sz = -Math.sin(r.yaw);   // 横へ 1歩 おりる（ふさがっていたら その場で 上へ）
    if (r.t !== 'boat') for (const k of [1, -1]) {
      const nx = this.x + sx * k * 0.95, nz = this.z + sz * k * 0.95; _cb.length = 0;
      world.collectBoxes(nx - this.hw, this.y + 0.1, nz - this.hw, nx + this.hw, this.y + 1.9, nz + this.hw, _cb);
      if (!_cb.length) { this.x = nx; this.z = nz; break; }
    }
    this.vx = this.vz = 0; this.vy = r.t === 'boat' ? 5 : 3; this.fallDist = 0;
    return e;
  }
  ridePhysics(world, dt, f, s, jump) {
    const r = this.ride, fx = Math.floor(this.x), fz = Math.floor(this.z);
    this.sneaking = false; this.sprinting = false; this.blocking = false; this.inLava = false;
    this.headIn = FLUID[world.getBlock(fx, Math.floor(this.eyeY()), fz)];
    this.inWater = FLUID[world.getBlock(fx, Math.floor(this.y + 0.9), fz)] === 1;
    if (r.t === 'cart') { this.rideCart(world, dt, f); return; }
    const sy = Math.sin(this.yaw), cy = Math.cos(this.yaw), ox = this.x, oy = this.y, oz = this.z;
    if (r.t === 'boat') {
      let top = null;
      for (let yy = Math.floor(this.y + 1.2); yy >= Math.floor(this.y - 0.7); yy--) if (FLUID[world.getBlock(fx, yy, fz)] === 1) { top = yy + 0.88; break; }
      const speed = top !== null ? 7.4 : 0.9, k = 1 - Math.exp(-(top !== null ? 1.7 : 7) * dt);
      this.vx += ((-sy * f + cy * s * 0.45) * speed - this.vx) * k; this.vz += ((-cy * f - sy * s * 0.45) * speed - this.vz) * k;
      if (top !== null) { this.vy += ((top - 0.02 - this.y) * 34 - this.vy * 8) * dt; this.vy = clamp(this.vy, -4, 4); } else this.vy = Math.max(this.vy - 30 * dt, -40);
      moveStep(world, this, this.vx * dt, this.vy * dt, this.vz * dt, 0);
      const hs = Math.hypot(this.vx, this.vz);
      if (hs > 0.6) r.yaw = lerpAngle(r.yaw, Math.atan2(-this.vx, -this.vz), 1 - Math.exp(-5 * dt));
      if (top !== null && hs > 1.5) { this.stepAcc += hs * dt; if (this.stepAcc > 3.2) { this.stepAcc = 0; sfx('swim', 0.25); fxPuff(this.x, top, this.z, 4, 0.75, 0.88, 1, { speed: 1.2, life: 0.5, grav: 6, up: 1 }); } }
      this.fallDist = 0;
    } else {   // ウマ
      const inW = FLUID[world.getBlock(fx, Math.floor(this.y + 0.9), fz)] === 1;
      let wx, wz;
      if (r.wild > 0) {   // まだ なついていない：かってに 走り回って はねる
        r.wild -= dt; r.yaw += Math.sin(R.time * 3.1) * 2.6 * dt;
        wx = -Math.sin(r.yaw) * 6.5; wz = -Math.cos(r.yaw) * 6.5;
        if (this.onGround && Math.random() < dt * 2.2) { this.vy = 6.4; this.onGround = false; sfxAt('hop', this.x, this.y, this.z); }
        if (r.wild <= 0) { this.tameEnd(); if (!this.ride) return; }
      } else {
        const speed = (r.s ? 9.2 : 2.3) * (inW ? 0.4 : 1);
        wx = (-sy * f + cy * s * 0.6) * speed; wz = (-cy * f - sy * s * 0.6) * speed;
        if (jump && this.onGround) { this.vy = r.s ? 10.6 : 7.4; this.onGround = false; if (r.s) sfxAt('hop', this.x, this.y, this.z); }
      }
      const k = this.onGround ? 1 - Math.exp(-5 * dt) : 1 - Math.exp(-1.4 * dt);
      this.vx += (wx - this.vx) * k; this.vz += (wz - this.vz) * k;
      if (inW) this.vy = clamp(this.vy + 12 * dt, -3, 2.2); else this.vy = Math.max(this.vy - 30 * dt, -60);
      moveStep(world, this, this.vx * dt, this.vy * dt, this.vz * dt, inW ? 0 : 1.05);
      if (inW) this.fallDist = 0; else if (this.y < oy) this.fallDist += oy - this.y;
      if (this.onGround) { if (this.fallDist > 7 && this.mode === 0) this.damage(Math.floor(this.fallDist - 6), this.x, this.z, 0, '落下', true); this.fallDist = 0; }
      const hd = Math.hypot(this.x - ox, this.z - oz), hs = hd / dt;
      r.walk += hd * 2.2; r.walkAmp += ((this.onGround && hs > 0.3 ? Math.min(1, hs / 5) : 0) - r.walkAmp) * Math.min(1, dt * 8);
      if (!(r.wild > 0)) r.yaw = lerpAngle(r.yaw, hs > 0.8 ? Math.atan2(-this.vx, -this.vz) : this.yaw, 1 - Math.exp(-6 * dt));
      if (this.onGround && hs > 1) { this.stepAcc += hd; if (this.stepAcc > 2.6) { this.stepAcc = 0; const below = world.getBlock(Math.floor(this.x), Math.floor(this.y - 0.2), Math.floor(this.z)); if (below) sfx('step_' + BLOCKS[below].sound, 0.45); } }
    }
    this.stats.dist += Math.hypot(this.x - ox, this.z - oz); this.bobAmp = 0;
  }
  // あばれるウマに 乗りきった：なつくか、ふり落とされるか（乗るたびに なつきやすくなる）
  tameEnd() {
    const r = this.ride; r.wild = 0; r.n = (r.n | 0) + 1;
    if (Math.random() < 0.2 + 0.22 * r.n) {
      r.tm = meId(); sfx('levelup', 0.6); sfx('say_horse', 0.8);
      for (let i = 0; i < 8; i++) fxPuff(this.x + (Math.random() - 0.5) * 1.2, this.y + 1.6 + Math.random() * 0.6, this.z + (Math.random() - 0.5) * 1.2, 1, 1, 0.35, 0.5, { glow: true, speed: 0.2, life: 0.9, size: 0.09, up: 0.9, grav: 0 });
      ui.toast('ウマが なついた！「くら」を つけると、思いどおりに 走れる', 6); game.onStat('tame', 'horse');
    } else {
      this.dismount(); this.vy = 7; this.vx = (Math.random() - 0.5) * 6; this.vz = (Math.random() - 0.5) * 6; sfx('hit', 0.5);
      ui.toast('ふり落とされた！ もう一度 乗ってみよう（乗るたびに なつきやすくなる）', 4);
    }
  }
  // トロッコ：レールの線の上を すべる。前で おす・後ろで ブレーキ。坂と「はやレール」で 速くなる
  rideCart(world, dt, f) {
    const r = this.ride, bx = Math.floor(this.x), bz = Math.floor(this.z), by = Math.floor(this.y + 0.4);
    const ry = world.railAt(bx, by, bz) ? by : world.railAt(bx, by - 1, bz) ? by - 1 : world.railAt(bx, by + 1, bz) ? by + 1 : null;
    const lx = -Math.sin(this.yaw), lz = -Math.cos(this.yaw);
    if (ry === null) {   // レールの外：ほとんど進めない
      const k = 1 - Math.exp(-5 * dt); r.rv = 0;
      this.vx += (lx * f * 0.8 - this.vx) * k; this.vz += (lz * f * 0.8 - this.vz) * k; this.vy = Math.max(this.vy - 30 * dt, -40);
      moveStep(world, this, this.vx * dt, this.vy * dt, this.vz * dt, 0); this.fallDist = 0;
      return;
    }
    const id = world.getBlock(bx, ry, bz), c = RAIL_CON[world.getMeta(bx, ry, bz)] || RAIL_CON[0], A = F4[c[0]], Bd = F4[c[1]];
    const ax = bx + 0.5 + A[0] * 0.5, az = bz + 0.5 + A[1] * 0.5, ay = ry + (c[2] === c[0] ? 1 : 0);   // レールの両はし（マスのふちの まん中）
    const ex = bx + 0.5 + Bd[0] * 0.5, ez = bz + 0.5 + Bd[1] * 0.5, ey = ry + (c[2] === c[1] ? 1 : 0);
    const len = Math.hypot(ex - ax, ez - az), ux = (ex - ax) / len, uz = (ez - az) / len;
    const dot = this.vx * ux + this.vz * uz;
    let v = (dot < 0 ? -1 : 1) * r.rv;   // A→B を正とした速さ（まがっても 速さは そのまま）
    const look = lx * ux + lz * uz;
    if (f > 0.1 && Math.abs(v) < 4.5) v += (Math.abs(v) > 0.3 ? Math.sign(v) : (look < 0 ? -1 : 1)) * 6 * dt;   // 止まっている時は 見ている向きへ
    else if (f < -0.1) v -= Math.sign(v) * Math.min(Math.abs(v), 9 * dt);
    v -= (ey - ay) / len * 15 * dt;   // 坂
    if (id === B.rail_fast && Math.abs(v) > 0.25) v += Math.sign(v) * 16 * dt;
    v *= Math.exp(-(id === B.rail_fast ? 0.05 : 0.2) * dt); v = clamp(v, -11, 11);
    let t = clamp(((this.x - ax) * ux + (this.z - az) * uz) / len, 0, 1) + v * dt / len;
    if (t < 0 || t > 1) {   // 次のマスへ
      const out = t > 1 ? Bd : A, oy = t > 1 ? ey : ay, nx = bx + out[0], nz = bz + out[1], over = Math.max(0.02, (t > 1 ? t - 1 : -t) * len);
      if (world.railAt(nx, oy, nz) || world.railAt(nx, oy - 1, nz)) {
        this.x = bx + 0.5 + out[0] * (0.5 + over); this.z = bz + 0.5 + out[1] * (0.5 + over); this.y = oy;
        this.vx = out[0] * Math.abs(v); this.vz = out[1] * Math.abs(v); r.rv = Math.abs(v);
        if (Math.abs(v) > 1) sfx('step_metal', Math.min(0.5, Math.abs(v) / 20));
      } else { t = clamp(t, 0, 1); v = 0; }   // 行き止まり
    }
    if (t >= 0 && t <= 1) { this.x = ax + (ex - ax) * t; this.z = az + (ez - az) * t; this.y = ay + (ey - ay) * t; this.vx = ux * v; this.vz = uz * v; r.rv = Math.abs(v); }
    this.vy = 0; this.onGround = true; this.fallDist = 0;
    if (r.rv > 0.4) r.yaw = lerpAngle(r.yaw, Math.atan2(-this.vx, -this.vz), 1 - Math.exp(-10 * dt));
    this.stats.dist += r.rv * dt;
  }
  // 滑空（本家の羽と同じ式を 1/20秒きざみで）：下を向くと 速くなり、上を向くと その速さで のぼる
  glide(world, dt) {
    this.sneaking = false; this.sprinting = false; this.fallDist = 0;
    this.glAcc += dt;
    while (this.glAcc >= 0.05) {
      this.glAcc -= 0.05;
      let vx = this.vx / 20, vy = this.vy / 20, vz = this.vz / 20;
      const pm = -this.pitch, cp = Math.cos(pm), sq = cp * cp, lx = -Math.sin(this.yaw) * cp, lz = -Math.cos(this.yaw) * cp, hv = Math.hypot(vx, vz);
      vy += -0.08 + sq * 0.06;
      if (vy < 0 && cp > 0) { const d = vy * -0.1 * sq; vy += d; vx += lx * d / cp; vz += lz * d / cp; }
      if (pm < 0 && cp > 0) { const d = hv * -Math.sin(pm) * 0.04; vy += d * 3.2; vx -= lx * d / cp; vz -= lz * d / cp; }
      if (cp > 0) { vx += (lx / cp * hv - vx) * 0.1; vz += (lz / cp * hv - vz) * 0.1; }
      this.vx = vx * 0.99 * 20; this.vy = vy * 0.98 * 20; this.vz = vz * 0.99 * 20;
    }
    const ox = this.x, oz = this.z, sp0 = Math.hypot(this.vx, this.vz);
    moveStep(world, this, this.vx * dt, this.vy * dt, this.vz * dt, 0);
    if (this.hitH && sp0 > 14 && this.mode === 0) this.damage(Math.floor((sp0 - 12) * 0.6), this.x, this.z, 0, 'しょうとつ', true);   // かべに 速く ぶつかった
    this.stats.dist += Math.hypot(this.x - ox, this.z - oz);
    this.glWear += dt;
    if (this.glWear >= 1 && this.mode === 0) { this.glWear = 0; const a = this.armor[1]; if (a) { a.d = (a.d || 0) + 1; if (itemDmg(a.d) >= ITEMS[a.id].armor.dur) { this.armor[1] = null; this.gliding = false; sfx('toolbreak'); ui.toast('ソラの羽 がこわれた'); } this.invDirty = true; } }
  }
  hasFloor(world, x, z) {
    _cb.length = 0;
    world.collectBoxes(x - this.hw, this.y - 0.6, z - this.hw, x + this.hw, this.y - 0.001, z + this.hw, _cb);
    for (let i = 0; i < _cb.length; i += 6) if (_cb[i] < x + this.hw && _cb[i + 3] > x - this.hw && _cb[i + 2] < z + this.hw && _cb[i + 5] > z - this.hw && _cb[i + 4] > this.y - 0.6) return true;
    return false;
  }
  physics(world, dt) {
    const blocked = !!ui.screen;
    let f = blocked ? 0 : input.fwd, s = blocked ? 0 : input.strafe;
    const jump = !blocked && input.jump, sneak = !blocked && input.sneak;
    let l = Math.hypot(f, s); if (l > 1) { f /= l; s /= l; l = 1; }
    const fx = Math.floor(this.x), fz = Math.floor(this.z);
    const feet = world.getBlock(fx, Math.floor(this.y + 0.1), fz), body = world.getBlock(fx, Math.floor(this.y + 0.9), fz);
    const inW = FLUID[feet] === 1 || FLUID[body] === 1, inL = FLUID[feet] === 2 || FLUID[body] === 2;
    if (inW && !this.inWater && this.vy < -4) { sfx('splash'); fxPuff(this.x, this.y + 0.5, this.z, 14, 0.7, 0.85, 1, { speed: 3, life: 0.6, grav: 12, up: 2 }); }
    this.inWater = inW; this.inLava = inL; this.headIn = FLUID[world.getBlock(fx, Math.floor(this.eyeY()), fz)];
    const ladder = SHAPE[feet] === S_LADDER || SHAPE[body] === S_LADDER;
    if (this.ride) {   // 乗り物：しゃがむ で おりる
      if (sneak && !this.sneakHold) this.dismount();
      else { if (!sneak) this.sneakHold = false; this.ridePhysics(world, dt, f, s, jump); return; }
    }
    // 滑空：「ソラの羽」を つけて、空中で ジャンプ
    this.airT = this.onGround || inW || inL || ladder || this.flying ? 0 : this.airT + dt;
    const wing = this.armor[1] && ITEMS[this.armor[1].id].glide;
    if (this.gliding && (!wing || this.airT === 0)) this.gliding = false;
    else if (!this.gliding && wing && jump && !this.jumpWas && this.airT > 0.22) { this.gliding = true; this.glAcc = 0; sfx('glide', 0.5); game.onStat('glide', 0); }
    this.jumpWas = jump;
    if (this.gliding) { this.glide(world, dt); return; }
    this.sneaking = sneak && !this.flying;
    if (input.sprint && f > 0.5 && !this.sneaking && (this.mode === 1 || this.food > 6)) this.sprinting = true;
    if (f <= 0.1 || this.sneaking || (this.mode === 0 && this.food <= 6)) this.sprinting = false;
    let speed = this.flying ? (this.sprinting ? 21 : 10.5) : this.sneaking ? 1.3 : this.sprinting ? 5.6 : 4.3;
    if (this.onGround && !this.flying) { const ub = BLOCKS[world.getBlock(fx, Math.floor(this.y - 0.2), fz)]; if (ub && ub.slow) speed *= 0.45; }
    if (!this.flying) { if (this.fx.speed > 0) speed *= 1.25; if (this.webT > 0) speed *= 0.4; if (this.blocking || this.drawT > 0) { speed *= 0.45; this.sprinting = false; } }   // 糸にからまった／盾をかまえている／弓を引いている
    const sy = Math.sin(this.yaw), cy = Math.cos(this.yaw);
    const wx = (-sy * f + cy * s) * speed, wz = (-cy * f - sy * s) * speed;
    this.jumpCd -= dt;
    if (this.flying) {
      const k = 1 - Math.exp(-7 * dt);
      this.vx += (wx - this.vx) * k; this.vz += (wz - this.vz) * k;
      this.vy += (((jump ? 1 : 0) - (sneak ? 1 : 0)) * 7.5 - this.vy) * k;
    } else if (inW || inL) {
      const k = 1 - Math.exp(-6 * dt), sp = inL ? 0.3 : 0.5;
      this.vx += (wx * sp - this.vx) * k; this.vz += (wz * sp - this.vz) * k;
      this.vy -= 7 * dt; if (jump) this.vy += 24 * dt;
      this.vy = clamp(this.vy * (1 - 1.6 * dt), -3.6, 3.4);
      if (jump && this.hitH) this.vy = Math.max(this.vy, 4.6);
    } else if (ladder) {
      const k = 1 - Math.exp(-12 * dt);
      this.vx += (wx * 0.6 - this.vx) * k; this.vz += (wz * 0.6 - this.vz) * k;
      if (jump || (this.hitH && l > 0.1)) this.vy = 2.9; else if (this.sneaking) this.vy = 0; else this.vy = Math.max(this.vy - 30 * dt, -2.4);
    } else {
      const k = this.onGround ? 1 - Math.exp(-14 * dt) : 1 - Math.exp(-2.4 * dt);
      if (this.onGround || l > 0.05) { this.vx += (wx - this.vx) * k; this.vz += (wz - this.vz) * k; }
      this.vy = Math.max(this.vy - 30 * dt, -60);
      if (jump && this.onGround && this.jumpCd <= 0) { this.vy = this.webT > 0 ? 5.6 : 8.7; this.jumpCd = 0.08; if (this.sprinting && f > 0.5) { this.vx += -sy * 1.7; this.vz += -cy * 1.7; }   // 走りジャンプは 前へ のびる（本家と同じ）
        this.exh += this.sprinting ? 0.2 : 0.05; this.onGround = false; }
    }
    let dx = this.vx * dt, dz = this.vz * dt; const dy = this.vy * dt;
    if (this.sneaking && this.onGround && dy <= 0) {
      const st = 0.04;
      while (dx !== 0 && !this.hasFloor(world, this.x + dx, this.z)) { if (Math.abs(dx) < st) dx = 0; else dx -= Math.sign(dx) * st; }
      while (dz !== 0 && !this.hasFloor(world, this.x, this.z + dz)) { if (Math.abs(dz) < st) dz = 0; else dz -= Math.sign(dz) * st; }
      while (dx !== 0 && dz !== 0 && !this.hasFloor(world, this.x + dx, this.z + dz)) { if (Math.abs(dx) < st) dx = 0; else dx -= Math.sign(dx) * st; if (Math.abs(dz) < st) dz = 0; else dz -= Math.sign(dz) * st; }
    }
    const ox = this.x, oy = this.y, oz = this.z, wasG = this.onGround;
    const lift = moveStep(world, this, dx, dy, dz, this.flying || inW || inL || ladder ? 0 : 0.6);
    if (lift > 0) this.stepLift = Math.min(0.7, (this.stepLift || 0) + lift);   // 目の高さは なめらかに追いつかせる
    if (this.flying || inW || inL || ladder) this.fallDist = 0;
    else if (this.y < oy) this.fallDist += oy - this.y;
    if (this.onGround) {
      if (this.flying) this.flying = false;
      if (this.fallDist > 3.4 && this.mode === 0) { const bt = this.armor[3], dmg = Math.floor((this.fallDist - 3) * (1 - (bt ? enchOf(bt.d, 2) * 0.15 : 0))); if (dmg > 0) this.damage(dmg, this.x, this.z, 0, '落下', true); }
      if (this.fallDist > 0.7 && !wasG) { const below = world.getBlock(fx, Math.floor(this.y - 0.2), fz); if (below) sfx('step_' + BLOCKS[below].sound, 0.6); }
      this.fallDist = 0;
    }
    const hd = Math.hypot(this.x - ox, this.z - oz);
    this.stats.dist += hd;
    if (this.onGround && !inW) {
      this.stepAcc += hd; this.bob += hd;
      if (this.stepAcc > 2.0) { this.stepAcc = 0; const below = world.getBlock(fx, Math.floor(this.y - 0.2), fz); if (below) sfx('step_' + BLOCKS[below].sound, 0.3); }
    } else if (inW && hd > 0) { this.stepAcc += hd; if (this.stepAcc > 2.4) { this.stepAcc = 0; sfx('swim', 0.3); } }
    this.bobAmp += ((this.onGround && hd > 0.001 ? Math.min(1, hd / dt / 4.3) : 0) - this.bobAmp) * Math.min(1, dt * 8);
    if (this.mode === 0) this.exh += this.sprinting ? hd * 0.1 : hd * 0.008;
    if (settings.autoJump && this.onGround && this.hitH && l > 0.2 && !this.sneaking && !ladder && !inW) {
      const wl = Math.hypot(wx, wz) || 1, ax = Math.floor(this.x + wx / wl * (this.hw + 0.3)), az = Math.floor(this.z + wz / wl * (this.hw + 0.3)), ay = Math.floor(this.y + 0.1);
      if (SOLID[world.getBlock(ax, ay, az)] && !SOLID[world.getBlock(ax, ay + 1, az)] && !SOLID[world.getBlock(ax, ay + 2, az)] && !SOLID[world.getBlock(fx, ay + 2, fz)]) { this.vy = 8.7; this.onGround = false; }
    }
  }
  toggleFly() { if (this.mode !== 1) return; this.flying = !this.flying; if (this.flying) this.vy = 0; }

  // ---- 見ている先・こわす・使う ----
  interact(world, dt) {
    this.swingT = Math.max(0, this.swingT - dt * 3.4);
    this.cool = Math.max(0, this.cool - dt); this.useCool = Math.max(0, this.useCool - dt); this.brkDelay = Math.max(0, this.brkDelay - dt);
    const ex = this.x, ey = this.eyeY(), ez = this.z;
    let dx, dy, dz;
    if (input.rayNdc) {
      const m = R.invVP, nx = input.rayNdc[0], ny = input.rayNdc[1];
      const w = m[3] * nx + m[7] * ny + m[11] + m[15];
      dx = (m[0] * nx + m[4] * ny + m[8] + m[12]) / w; dy = (m[1] * nx + m[5] * ny + m[9] + m[13]) / w; dz = (m[2] * nx + m[6] * ny + m[10] + m[14]) / w;
      const dl = Math.hypot(dx, dy, dz) || 1; dx /= dl; dy /= dl; dz /= dl;
    } else { const cp = Math.cos(this.pitch); dx = -Math.sin(this.yaw) * cp; dy = Math.sin(this.pitch); dz = -Math.cos(this.yaw) * cp; }
    this.ray[0] = dx; this.ray[1] = dy; this.ray[2] = dz;
    if (ui.screen) { this.target = null; this.targetMob = null; this.brk = null; this.eating = 0; this.drawT = 0; this.autoBow = 0; this.blocking = false; return; }
    const reach = this.mode === 1 ? 6 : 5;
    this.target = world.raycast(ex, ey, ez, dx, dy, dz, reach);
    const mh = pickMob(ex, ey, ez, dx, dy, dz, Math.min(3.7, this.target ? this.target.t : 99));
    this.targetMob = mh ? mh.e : null;
    this.targetPeer = (!mh && net.on && game.rules.pvp) ? pickPeer(ex, ey, ez, dx, dy, dz, Math.min(3.7, this.target ? this.target.t : 99)) : null;
    if (input.breakHeld) {
      if (this.targetMob) { if (this.cool <= 0) this.attack(this.targetMob); this.brk = null; }
      else if (this.targetPeer) { if (this.cool <= 0) this.attackPeer(this.targetPeer); this.brk = null; }
      else if (this.target) this.breakStep(world, dt);
      else { this.brk = null; if (input.breakPressed) { this.swing(); sfx('swing', 0.3); } }
    } else this.brk = null;
    const it = this.held(), def = it ? ITEMS[it.id] : null;
    const tInteract = this.target && BLOCKS[this.target.id].interact && !this.sneaking;
    const mobAct = this.targetMob ? mobUse(this.targetMob, it) : null;   // 動物に使える物を持っているか
    const plant = !!def && !!def.place && !!this.target && this.target.id === B.farmland;   // 食べられる作物（ニンジンなど）を 畑に植えようとしている
    const canEat = !!def && !!def.food && !tInteract && !mobAct && !plant && (this.food < 20 || !!def.heal || !!def.drink || this.mode === 1);
    this.autoEat = Math.max(0, (this.autoEat || 0) - dt);
    const bowOk = !!def && !!def.tool && def.tool.type === 'bow' && !tInteract && !mobAct;   // 弓を持っている
    const hasArrow = bowOk && (this.mode === 1 || this.countSpec(I.arrow) > 0);
    this.autoBow = Math.max(0, this.autoBow - dt); this.noArrowT = Math.max(0, this.noArrowT - dt); this.noBlockT = Math.max(0, this.noBlockT - dt);
    if (input.tapPending) {   // 画面を軽くタップ：生き物なら攻撃、食べ物なら食べる、それ以外は置く・使う
      input.tapPending = false;
      if (this.targetMob && mobAct) { this.use(world); this.useCool = 0.24; }   // えさ・ハサミなどを持っていれば、たたかずに使う
      else if (this.targetMob) { if (this.cool <= 0) this.attack(this.targetMob); }
      else if (this.targetPeer) { if (this.cool <= 0) this.attackPeer(this.targetPeer); }
      else if (canEat) this.autoEat = 1.7;
      else if (bowOk) { if (hasArrow) this.autoBow = 1.05; else if (this.noArrowT <= 0) { this.noArrowT = 2; ui.toast('矢がない（火打ち石＋棒＋羽根で作れる）'); } }   // 軽くタップ：自動で いっぱいまで引いて はなつ
      else { this.use(world); this.useCool = 0.24; }
    }
    const pulling = bowOk && hasArrow && (input.useHeld || this.autoBow > 0);
    if (bowOk && !hasArrow && input.usePressed && this.noArrowT <= 0) { this.noArrowT = 2; ui.toast('矢がない（火打ち石＋棒＋羽根で作れる）'); }
    if (pulling) {   // 弓を引く：長く引くほど 遠くへ強く飛ぶ。はなすと うつ
      if (this.drawT === 0) sfx('bowdraw', 0.6);
      this.drawT += dt; this.eating = 0; this.blocking = false;
    } else {
    if (this.drawT > 0) { if (bowOk && hasArrow && this.drawT >= 0.18) this.shootBow(this.drawT); this.drawT = 0; }
    if (canEat && (input.useHeld || this.autoEat > 0)) {
      this.eating += dt; this.eatSnd -= dt;
      if (this.eatSnd <= 0) { this.eatSnd = 0.22; sfx('eat', 0.5); }
      if (this.eating >= 1.5) {
        this.eating = 0;
        this.food = Math.min(20, this.food + def.food[0]); this.sat = Math.min(20, this.sat + def.food[1]);
        if (def.heal) this.hp = Math.min(20, this.hp + def.heal);
        if (def.drink) this.burnT = 0;
        if (def.potion) this.applyPotion(def.potion);
        const id = it.id; this.useHeldOne();
        if (def.leftover && this.mode === 0) { if (!this.inv[this.sel]) this.inv[this.sel] = { id: def.leftover, n: 1, d: 0 }; else if (this.give(def.leftover, 1, 0)) spawnDrop(this.x, this.y + 1, this.z, def.leftover, 1, 0); }
        sfx(def.drink ? 'gulp' : 'burp'); ui.bumpFood(); this.stat('eat', id); this.invDirty = true;
      }
    } else {
      this.eating = 0;
      if (input.usePressed || (input.useHeld && this.useCool <= 0)) { if (this.use(world)) this.noBlockT = 0.35; this.useCool = 0.24; }
    }
    // 盾：左手のマスに入れておき、使うボタンを おしている間 かまえる（置く・食べるなど ほかのことをした時は かまえない）
    this.blocking = !!this.armor[4] && input.useHeld && !canEat && !bowOk && this.noBlockT <= 0;
    }
    this.blockK += ((this.blocking ? 1 : 0) - this.blockK) * Math.min(1, dt * 14);
  }
  // 矢をはなつ。t＝引いた秒数（1秒でいっぱい）
  shootBow(t) {
    const pw = Math.min(1, t), k = pw * pw * 0.6 + pw * 0.4, sp = 14 + 36 * k, dmg = Math.max(1, Math.round(2 + 7 * k)), r = this.ray;
    const bd = this.held() ? this.held().d : 0, ep = enchOf(bd, 0);   // 「つよ弓」「火の矢」
    const s = spawnShot(this.x + r[0] * 0.4, this.eyeY() - 0.1 + r[1] * 0.4, this.z + r[2] * 0.4, r[0] * sp, r[1] * sp + 1.2, r[2] * sp, ep ? Math.round(dmg * (1 + 0.25 * (ep + 1))) : dmg, 6);
    s.flame = enchOf(bd, 1);
    s.ox = this.x; s.oz = this.z; s.noPick = this.mode === 1; netShot(s);
    if (this.mode !== 1) this.consumeSpec(I.arrow, 1);
    this.wearHeld(1); this.swing(); sfx('bowshot'); this.exh += 0.05; this.stat('shoot', dmg);
  }
  breakTime(id) {
    const b = BLOCKS[id];
    if (b.hard < 0) return Infinity; if (b.hard === 0) return 0;
    const tool = this.heldTool(), match = !!tool && tool.type === b.tool;
    const can = !b.needTool || (match && tool.tier >= b.level);
    const ef = match && enchKind(this.held().id) === 'tool' ? enchOf(this.held().d, 0) : 0;   // 「はやほり」
    let t = b.hard * (can ? 1.5 : 5) / (match ? tool.speed + (ef ? ef * ef + 1 : 0) : 1);
    if (this.headIn === 1) t *= 3;
    if (!this.onGround && !this.flying) t *= 2;
    return t;
  }
  breakStep(world, dt) {
    const t = this.target, b = BLOCKS[t.id];
    if (b.hard < 0) { this.brk = null; if (input.breakPressed) { this.swing(); sfx('dig_stone', 0.4); } return; }
    if (this.mode === 1) { if (this.cool <= 0) { this.finishBreak(world, t); this.cool = 0.2; this.swing(); } return; }
    if (this.brkDelay > 0 && b.hard > 0) return;
    if (!this.brk || this.brk.x !== t.x || this.brk.y !== t.y || this.brk.z !== t.z) this.brk = { x: t.x, y: t.y, z: t.z, p: 0, s: 0 };
    const total = this.breakTime(t.id);
    this.brk.p += total <= 0 ? 1 : dt / total;
    this.brk.s -= dt;
    if (this.brk.s <= 0) {
      this.brk.s = 0.2; this.swing(); sfx('dig_' + b.sound, 0.5);
      fxBlockBits(this.x + this.ray[0] * t.t + t.nx * 0.05, this.eyeY() + this.ray[1] * t.t + t.ny * 0.05, this.z + this.ray[2] * t.t + t.nz * 0.05, t.id, 2, 0.15);
    }
    if (this.brk.p >= 1) { this.finishBreak(world, t); this.brk = null; this.brkDelay = b.hard > 0 ? 0.16 : 0; }
  }
  finishBreak(world, t) {
    const id = t.id, meta = t.meta, b = BLOCKS[id];
    fxBlockBits(t.x + 0.5, t.y + 0.5, t.z + 0.5, id, 20, 0.85);
    sfxAt('break_' + b.sound, t.x, t.y, t.z);
    world.spillEnt(t.x, t.y, t.z);
    if (this.mode === 0) {
      const tool = this.heldTool();
      const drops = (tool && tool.type === 'shears' && (ISLEAF[id] || id === B.vine || id === B.tallgrass || id === B.fern)) ? [[id, 1]] : blockDrops(id, meta, tool, world.rng);   // ハサミなら 葉・つた・草が そのまま手に入る
      const toWater = id === B.ice && (SOLID[world.getBlock(t.x, t.y - 1, t.z)] || FLUID[world.getBlock(t.x, t.y - 1, t.z)]);
      world.setBlock(t.x, t.y, t.z, toWater ? B.water : 0, 0);
      for (const [did, n] of drops) spawnDrop(t.x + 0.5, t.y + 0.35, t.z + 0.5, did, n, 0);
      const fo = tool && XP_ORE[id] && drops.length && drops[0][0] !== id && enchKind(this.held().id) === 'tool' ? enchOf(this.held().d, 2) : 0;   // 「ほりあて」：鉱石から 多く出る
      if (fo) { const ex = Math.max(0, rnd(fo + 2) - 1) * drops[0][1]; if (ex > 0) spawnDrop(t.x + 0.5, t.y + 0.35, t.z + 0.5, drops[0][0], ex, 0); }
      const xo = XP_ORE[id]; if (xo && drops.length && drops[0][0] !== id) spawnXp(t.x + 0.5, t.y + 0.35, t.z + 0.5, xo[0] + rnd(xo[1] - xo[0] + 1));   // 鉱石をほると 経験値
      if (tool && b.hard > 0 && tool.type !== 'lighter') this.wearHeld(tool.type === 'sword' ? 2 : 1);
      this.exh += 0.005;
    } else world.setBlock(t.x, t.y, t.z, 0, 0);
    if (id === B.hoshi_crystal) crystalBurst(world, t.x, t.y, t.z);
    this.stats.broken++; this.stat('break', id);
  }
  attack(e) {
    if (e.type === 'dog' && e.tamer === meId()) { this.swing(); this.cool = 0.32; return; }   // 自分のイヌは たたけない
    const tool = this.heldTool(); let dmg = tool ? tool.dmg : 1;
    const ed = tool && tool.type === 'sword' ? this.held().d : 0, sharp = enchOf(ed, 0);   // 剣に こめた力
    if (sharp) dmg += 0.5 * sharp + 0.5;
    if (this.fx.str > 0) dmg += 3;   // 「ちからの くすり」
    const crit = this.vy < -0.5 && !this.onGround && !this.inWater && !this.flying;
    if (crit) dmg *= 1.5;
    if (this.mode === 1) dmg = Math.max(dmg, 12);
    this.swing(); this.cool = 0.32;
    e.pk = 1;   // 人が たたいた（たおれた時に 経験値が出る）
    e.hb = enchOf(ed, 1) * 60; e.hl = enchOf(ed, 3);
    if (hurtMob(e, dmg, this.x, this.z, (this.sprinting ? 8 : 5.5) + enchOf(ed, 2) * 3)) {
      sfx('hit');
      if (crit) fxPuff(e.x, e.y + e.h * 0.7, e.z, 10, 1, 0.9, 0.3, { glow: true, speed: 3, life: 0.4, size: 0.06 });
      if (tool && tool.type !== 'lighter' && tool.type !== 'shears' && tool.type !== 'bow') this.wearHeld(tool.type === 'sword' ? 1 : 2);
      this.exh += 0.1;
    }
  }
  // 友だちへの攻撃（ルールでオンのときだけ）
  attackPeer(p) {
    const tool = this.heldTool(); let dmg = tool ? tool.dmg : 1;
    if (this.vy < -0.5 && !this.onGround && !this.inWater && !this.flying) dmg *= 1.5;
    this.swing(); this.cool = 0.32; p.hurtT = 0.3; sfx('hit');
    net.dm(p.pid, { t: 'pvp', a: dmg, x: r2(this.x), z: r2(this.z), k: this.sprinting ? 8 : 5.5 });
    if (tool) this.wearHeld(tool.type === 'sword' ? 1 : 2);
  }
  onKill(e) { this.stats.kills++; this.stat('kill', e.type); }
  // 動物に 手に持った物を使う（えさ・ハサミ・バケツ・染料・おすわり）
  useOnMob(e, act, it) {
    if (act === 'ride') {
      if (this.ride || this.dead) return true;
      if (e.remote) { const now = performance.now(); if (!this.rideAsk || now - this.rideAsk > 1200) { this.rideAsk = now; net.dm(e.owner, { t: 'ride', n: e.rnid }); } return true; }   // ほかの人が動かしている：ゆずってもらう
      this.x = e.x; this.y = e.y; this.z = e.z; e.dead = true; this.mount(rideRec(e)); return true;
    }
    if (act === 'trade') { ui.open('trade', e); sfx('click'); sfxAt('say_sato', e.x, e.y, e.z); return true; }
    this.swing();
    if (act === 'wait') return true;
    const me = meId(), arg = act === 'dye' ? DYE.indexOf(it.id) : 0;
    if (e.remote) net.dm(e.owner, { t: 'use', n: e.rnid, a: act, c: arg }); else applyMobUse(e, act, me, arg);
    if (act === 'saddle') this.useHeldOne();
    else if (act === 'love' || act === 'grow' || act === 'tame' || act === 'heal' || act === 'dye') { this.useHeldOne(); sfx('eat', 0.4); }
    else if (act === 'shear') this.wearHeld(1);
    else if (act === 'milk') {
      sfx('splash', 0.5);
      if (this.mode === 0) { it.n--; if (it.n <= 0) this.inv[this.sel] = { id: I.milk_bucket, n: 1, d: 0 }; else if (this.give(I.milk_bucket, 1, 0)) spawnDrop(this.x, this.y + 1, this.z, I.milk_bucket, 1, 0); this.invDirty = true; }
      else this.give(I.milk_bucket, 1, 0);
    }
    return true;
  }
  use(world) {
    const t = this.target, it = this.held(), def = it ? ITEMS[it.id] : null;
    if (this.targetMob) { const act = mobUse(this.targetMob, it); if (act) return this.useOnMob(this.targetMob, act, it); }
    if (t && !this.sneaking) { const b = BLOCKS[t.id]; if (b.interact) { this.swing(); this.interactBlock(world, t, b.interact); return true; } }
    if (!it) return false;
    if (def.tool && def.tool.type === 'lighter') return t ? this.useLighter(world, t) : false;
    if (def.vehicle) return this.useVehicle(world, it, def);
    if (def.bucket) return this.useBucket(world, it, def);
    if (def.bottle) return this.useBottle(world, it);
    if (def.tool && def.tool.type === 'shovel' && t && t.id === B.grass && t.ny === 1) {   // スコップで 草を たたくと 道になる
      const ab = world.getBlock(t.x, t.y + 1, t.z);
      if (ab === 0 || SHAPE[ab] === S_CROSS || ab === B.snow_layer) {
        if (ab) world.breakNatural(t.x, t.y + 1, t.z);
        world.setBlock(t.x, t.y, t.z, B.path, 0); sfx('dig_dirt'); fxBlockBits(t.x + 0.5, t.y + 1, t.z + 0.5, B.dirt, 5, 0.5);
        this.wearHeld(1); this.swing(); return true;
      }
    }
    if (def.tool && def.tool.type === 'hoe' && t && (t.id === B.grass || t.id === B.dirt)) {
      const ab = world.getBlock(t.x, t.y + 1, t.z);
      if (ab === 0 || SHAPE[ab] === S_CROSS || ab === B.snow_layer) {
        if (ab) world.breakNatural(t.x, t.y + 1, t.z);
        world.setBlock(t.x, t.y, t.z, B.farmland, 0); sfx('dig_dirt'); fxBlockBits(t.x + 0.5, t.y + 1, t.z + 0.5, B.dirt, 6, 0.6);
        this.wearHeld(1); this.swing(); this.stat('till', 0); return true;
      }
    }
    if (!t) return false;
    const pid = def.block || def.place;
    if (!pid) return false;
    return this.placeBlock(world, t, pid);
  }
  placeBlock(world, t, id) {
    let px = t.x + t.nx, py = t.y + t.ny, pz = t.z + t.nz;
    if (REPLACE[t.id] && !FLUID[t.id] && t.id !== id) { px = t.x; py = t.y; pz = t.z; }
    if (py < 1 || py > 125) { ui.toast('ここには置けません（高さの限界です）'); return false; }
    const sh = SHAPE[id], lf = this.lookF(), toward = (lf + 2) & 3;
    // 当たった場所が そのマスの上半分か（横の面に置くとき、ハーフブロックや階段の上下を決める）
    const hy = this.eyeY() + this.ray[1] * t.t - t.y, upper = t.ny === -1 || (t.ny === 0 && hy > 0.5);
    if (sh === S_SLAB) {   // 同じハーフブロックの あいているほうに置くと、1つのブロックになる
      const full = BLOCKS[id].base;
      if (t.id === id && ((t.ny === 1 && !(t.meta & 1)) || (t.ny === -1 && (t.meta & 1)))) { px = t.x; py = t.y; pz = t.z; }
      const here = world.getBlock(px, py, pz);
      if (here === id) {
        const hm = world.getMeta(px, py, pz), want = (px === t.x && py === t.y && pz === t.z) ? (hm ^ 1) : (upper ? 1 : 0);
        if (want === (hm & 1)) return false;
        for (const e of ents) if (e.kind === 'mob' && px < e.x + e.hw && px + 1 > e.x - e.hw && py < e.y + e.h && py + 1 > e.y && pz < e.z + e.hw && pz + 1 > e.z - e.hw) return false;
        if (px < this.x + this.hw && px + 1 > this.x - this.hw && py < this.y + this.h && py + 1 > this.y && pz < this.z + this.hw && pz + 1 > this.z - this.hw) return false;
        world.setBlock(px, py, pz, full, 0, 1);
        this.useHeldOne(); this.swing(); sfxAt('place_' + BLOCKS[id].sound, px, py, pz); this.stats.placed++; this.stat('place', id);
        return true;
      }
    }
    const cur = world.getBlock(px, py, pz);
    if (!(cur === 0 || REPLACE[cur])) return false;
    let meta = 0, extra = null;
    if (sh === S_TORCH) {
      if (t.ny === 1) meta = 0;
      else if (t.ny === 0 && (px !== t.x || pz !== t.z)) { meta = 1 + F4.findIndex(d => d[0] === -t.nx && d[1] === -t.nz); }
      else return false;
      if (!world.hasSupport(id, meta, px, py, pz)) { if (world.hasSupport(id, 0, px, py, pz)) meta = 0; else return false; }
    } else if (sh === S_LADDER) {
      if (t.ny !== 0 || (px === t.x && pz === t.z)) return false;
      meta = F4.findIndex(d => d[0] === -t.nx && d[1] === -t.nz);
      if (!world.hasSupport(id, meta, px, py, pz)) return false;
    } else if (sh === S_DOOR) {
      const ab = world.getBlock(px, py + 1, pz);
      if (!(ab === 0 || REPLACE[ab]) || !SOLID[world.getBlock(px, py - 1, pz)] || py > 124) return false;
      meta = toward; extra = [px, py + 1, pz, toward | 8];
    } else if (sh === S_BED) {
      const d = F4[lf], hx = px + d[0], hz = pz + d[1], hc = world.getBlock(hx, py, hz);
      if (!(hc === 0 || REPLACE[hc]) || !SOLID[world.getBlock(px, py - 1, pz)] || !SOLID[world.getBlock(hx, py - 1, hz)]) { ui.toast('ベッドを置くには平らな場所が2マス必要です'); return false; }
      meta = lf; extra = [hx, py, hz, lf | 4];
    } else if (sh === S_SLAB) meta = upper ? 1 : 0;
    else if (sh === S_STAIR) meta = lf | (upper ? 4 : 0);            // のぼる先が 向いているほう
    else if (sh === S_GATE) meta = lf;
    else if (sh === S_RAIL) { if (!world.hasSupport(id, 0, px, py, pz)) return false; meta = lf & 1; }
    else if (sh === S_TRAP) meta = toward | (upper ? 8 : 0);          // ちょうつがいは 手前がわ
    else if (sh === S_SIGN) { meta = toward; if (!world.hasSupport(id, meta, px, py, pz)) { ui.toast('看板は地面の上に立てます'); return false; } }
    else if (sh === S_LANTERN) {                                       // ブロックの下の面に置くと つるす。それ以外は床に置く
      meta = t.ny === -1 ? 1 : 0;
      if (!world.hasSupport(id, meta, px, py, pz)) { meta ^= 1; if (!world.hasSupport(id, meta, px, py, pz)) return false; }
    } else if (BLOCKS[id].support) { if (!world.hasSupport(id, 0, px, py, pz)) return false; }
    else if (BLOCKS[id].facing) meta = toward;
    else if (ISLEAF[id]) meta = 1;
    if (SOLID[id]) {
      for (const b of collisionBoxes(id, meta, 15)) {
        if (px + b[0] < this.x + this.hw && px + b[3] > this.x - this.hw && py + b[1] < this.y + this.h && py + b[4] > this.y && pz + b[2] < this.z + this.hw && pz + b[5] > this.z - this.hw) return false;
        for (const e of ents) if (e.kind === 'mob' && px + b[0] < e.x + e.hw && px + b[3] > e.x - e.hw && py + b[1] < e.y + e.h && py + b[4] > e.y && pz + b[2] < e.z + e.hw && pz + b[5] > e.z - e.hw) return false;
      }
    }
    if (cur && !FLUID[cur]) world.breakNatural(px, py, pz);
    if (extra) { const ec = world.getBlock(extra[0], extra[1], extra[2]); if (ec && !FLUID[ec]) world.breakNatural(extra[0], extra[1], extra[2]); world.setBlock(px, py, pz, id, meta, 1); world.setBlock(extra[0], extra[1], extra[2], id, extra[3]); }
    else world.setBlock(px, py, pz, id, meta);
    if (sh === S_RAIL) world.railFix(px, py, pz, meta);   // まわりのレールと つなぐ
    const be = BLOCKS[id].ent;
    if (be === 'chest') world.setEnt(px, py, pz, { t: 'chest', items: new Array(27).fill(null) });
    else if (be === 'furnace') world.setEnt(px, py, pz, { t: 'furnace', in: null, fuel: null, out: null, burn: 0, burnMax: 0, cook: 0 });
    else if (be === 'sign') { world.setEnt(px, py, pz, { t: 'sign', s: '' }); ui.editSign(px, py, pz); }
    this.useHeldOne(); this.swing();
    sfxAt('place_' + BLOCKS[id].sound, px, py, pz);
    this.stats.placed++; this.stat('place', id);
    if (id === B.sora_frame) game.checkSoraRing(px, py, pz);
    return true;
  }
  // 火打ち金：黒曜石のわくの内がわに使うと、ホムラの門がひらく
  useLighter(world, t) {
    const x = t.x + t.nx, y = t.y + t.ny, z = t.z + t.nz;
    this.swing(); sfxAt('spark', t.x, t.y, t.z); this.wearHeld(1);
    if (t.id === B.hajike_box) { world.setBlock(t.x, t.y, t.z, 0, 0); spawnPrimed(t.x + 0.5, t.y, t.z + 0.5, 80); this.stat('prime', 0); return true; }   // はじけ箱に火をつける（4秒後に はじける）
    fxPuff(t.x + 0.5 + t.nx * 0.55, t.y + 0.5 + t.ny * 0.55, t.z + 0.5 + t.nz * 0.55, 7, 1, 0.75, 0.25, { glow: true, speed: 1.6, life: 0.3, size: 0.05, grav: 6 });
    if (world.dim === 2) { if (t.id === B.obsidian) ui.toast('ここでは ホムラの門は ひらかない'); return true; }
    const g = tryLightGate(world, x, y, z);
    if (g) {
      sfxAt('ignite', x, y, z); game.shake = Math.max(game.shake, 0.25);
      for (let i = 0; i < g.w; i++) for (let j = 0; j < g.h; j++) fxPuff(g.x + (g.a ? 0 : i) + 0.5, g.y + j + 0.5, g.z + (g.a ? i : 0) + 0.5, 5, 0.9, 0.4, 0.9, { glow: true, speed: 2.2, life: 0.8, size: 0.09, spread: 0.5 });
      game.gateAdd(world.dim, g.x, g.y, g.z); game.unlock('gate');
      ui.toast('ホムラの門が ひらいた！ 中に立つと、べつの世界へ行ける', 6);
    } else if (t.id === B.obsidian) ui.toast('黒曜石で 四角いわくを作ろう（内がわが よこ2×たて3 以上）。火打ち金は わくの内がわに使う', 7);
    return true;
  }
  // ガラスびんで 水をくむ（水は へらない）
  useBottle(world, it) {
    const ex = this.x, ey = this.eyeY(), ez = this.z, r = this.ray, maxT = this.target ? this.target.t : 5;
    for (let d = 0.2; d <= maxT + 0.05; d += 0.12) {
      if (world.getBlock(Math.floor(ex + r[0] * d), Math.floor(ey + r[1] * d), Math.floor(ez + r[2] * d)) !== B.water) continue;
      sfx('splash', 0.5); this.swing();
      if (this.mode === 0) { it.n--; if (it.n <= 0) this.inv[this.sel] = null; }
      if (this.give(I.water_bottle, 1, 0)) spawnDrop(this.x, this.y + 1, this.z, I.water_bottle, 1, 0);
      this.invDirty = true; return true;
    }
    return false;
  }
  // くすりを のんだ
  applyPotion(k) {
    const P = POTIONS[k]; if (!P) return;
    if (k === 'heal') { this.hp = Math.min(20, this.hp + 8); ui.bumpHearts(); } else this.fx[k] = Math.max(this.fx[k], P[2]);
    if (k === 'fire') this.burnT = 0;
    const c = C(P[1]); for (let i = 0; i < 16; i++) { const a = Math.random() * 6.283, rr = 0.5 + Math.random() * 0.25; fxPuff(this.x + Math.cos(a) * rr, this.y + 0.1 + Math.random() * 1.0, this.z + Math.sin(a) * rr, 1, c[0] / 255, c[1] / 255, c[2] / 255, { glow: true, speed: 0.3, life: 0.9, size: 0.045, up: 1, grav: 0 }); }   // 目の前に出すと 画面いっぱいに見えてしまうので、足もとのまわりに
    sfx('potion', 0.7); ui.toast(P[0] + '：' + P[4], 4); this.stat('potion', k); ui.fxKey = '';
  }
  // ボートは 水（か 地面）に、トロッコは レールに 置く
  useVehicle(world, it, def) {
    const t = this.target; let x, y, z;
    if (def.vehicle === 'cart') { if (!t || SHAPE[t.id] !== S_RAIL) { ui.toast('トロッコは レールの上に 置きます'); return false; } x = t.x + 0.5; y = t.y; z = t.z + 0.5; }
    else {
      const ex = this.x, ey = this.eyeY(), ez = this.z, r = this.ray, maxT = t ? t.t : 5; let hit = false;
      for (let d = 0.3; d <= maxT + 0.05 && !hit; d += 0.12) { const bx = Math.floor(ex + r[0] * d), by = Math.floor(ey + r[1] * d), bz = Math.floor(ez + r[2] * d); if (FLUID[world.getBlock(bx, by, bz)] === 1) { x = bx + 0.5; y = by + 0.6; z = bz + 0.5; hit = true; } }
      if (!hit) { if (!t || t.ny !== 1) return false; x = t.x + 0.5; y = t.y + 1.02; z = t.z + 0.5; }
    }
    const e = spawnMob(def.vehicle, x, y, z); e.yaw = e.pyaw = this.yaw;
    sfx('place_wood'); this.swing(); this.useHeldOne(); return true;
  }
  useBucket(world, it, def) {
    const ex = this.x, ey = this.eyeY(), ez = this.z, r = this.ray, t = this.target;
    if (def.bucket === 'empty') {
      const maxT = t ? t.t : 5;
      for (let d = 0.2; d <= maxT + 0.05; d += 0.12) {
        const bx = Math.floor(ex + r[0] * d), by = Math.floor(ey + r[1] * d), bz = Math.floor(ez + r[2] * d), id = world.getBlock(bx, by, bz);
        if (FLUID[id] && world.getMeta(bx, by, bz) === 0) {
          world.setBlock(bx, by, bz, 0, 0); sfx('splash'); this.swing();
          const filled = id === B.water ? I.water_bucket : I.lava_bucket;
          if (this.mode === 0) { it.n--; if (it.n <= 0) this.inv[this.sel] = { id: filled, n: 1, d: 0 }; else if (this.give(filled, 1, 0)) spawnDrop(this.x, this.y + 1, this.z, filled, 1, 0); }
          this.invDirty = true; this.stat('bucket', filled);
          return true;
        }
      }
      return false;
    }
    if (!t) return false;
    let px = t.x + t.nx, py = t.y + t.ny, pz = t.z + t.nz;
    if (REPLACE[t.id] && !FLUID[t.id]) { px = t.x; py = t.y; pz = t.z; }
    if (py < 1 || py > 125) return false;
    const cur = world.getBlock(px, py, pz);
    if (!(cur === 0 || REPLACE[cur] || SHAPE[cur] === S_CROSS)) return false;
    if (def.bucket === 'water' && world.dim === 1) {   // ホムラの底では 水は置けない
      fxFizz(px, py - 0.5, pz); this.swing(); ui.toast('あつすぎて、水は すぐに じょうはつしてしまった');
      if (this.mode === 0) { this.inv[this.sel] = { id: I.bucket, n: 1, d: 0 }; this.invDirty = true; }
      return true;
    }
    if (cur && !FLUID[cur]) world.breakNatural(px, py, pz);
    world.setBlock(px, py, pz, def.bucket === 'water' ? B.water : B.lava, 0); sfx('splash'); this.swing();
    if (this.mode === 0) { this.inv[this.sel] = { id: I.bucket, n: 1, d: 0 }; this.invDirty = true; }
    return true;
  }
  interactBlock(world, t, kind) {
    if ((kind === 'furnace' || kind === 'chest') && net.on) { const p = net.openBy(t.x, t.y, t.z); if (p) { ui.toast(p.name + ' が使っています'); sfx('deny', 0.4); return; } }
    if (kind === 'table') { ui.open('table'); sfx('click'); }
    else if (kind === 'ench') { ui.open('ench'); ui.enchPos = { x: t.x, y: t.y, z: t.z }; sfx('click'); }
    else if (kind === 'furnace') {
      let e = world.getEnt(t.x, t.y, t.z);
      if (!e) { e = { t: 'furnace', in: null, fuel: null, out: null, burn: 0, burnMax: 0, cook: 0 }; world.setEnt(t.x, t.y, t.z, e); }
      ui.open('furnace', e, t); sfx('click');
    } else if (kind === 'chest') {
      let e = world.getEnt(t.x, t.y, t.z);
      if (!e) { e = { t: 'chest', items: new Array(27).fill(null) }; world.setEnt(t.x, t.y, t.z, e); }
      if (e.g) { delete e.g; world.touch(t.x, t.y, t.z); this.stat('loot', 0); fxPuff(t.x + 0.5, t.y + 1.1, t.z + 0.5, 16, 1, 0.85, 0.3, { glow: true, speed: 1.5, life: 0.9, size: 0.06 }); sfx('treasure'); }
      ui.open('chest', e, t); sfx('chest');
    } else if (kind === 'door') {
      const m = t.meta ^ 4, oy = (t.meta & 8) ? t.y - 1 : t.y + 1;
      world.setBlock(t.x, t.y, t.z, t.id, m, 1);
      if (world.getBlock(t.x, oy, t.z) === t.id) world.setBlock(t.x, oy, t.z, t.id, world.getMeta(t.x, oy, t.z) ^ 4, 1);
      sfxAt('door', t.x, t.y, t.z);
    } else if (kind === 'gate') {
      let m = t.meta ^ 4;
      if (m & 4) { const f = m & 3, d = F4[f], away = (this.x - (t.x + 0.5)) * d[0] + (this.z - (t.z + 0.5)) * d[1] > 0; if (away) m = (m & ~3) | ((f + 2) & 3); }   // 自分とは反対がわへ開く
      world.setBlock(t.x, t.y, t.z, t.id, m, 1); sfxAt('door', t.x, t.y, t.z);
    } else if (kind === 'trap') { world.setBlock(t.x, t.y, t.z, t.id, t.meta ^ 4, 1); sfxAt('door', t.x, t.y, t.z); }
    else if (kind === 'sign') ui.editSign(t.x, t.y, t.z);
    else if (kind === 'bed') {
      if (world.dim) { ui.toast('この世界では ねむれない（復活地点にも できない）'); sfx('deny', 0.4); return; }
      this.spawn = { x: t.x + 0.5, y: t.y + 0.6, z: t.z + 0.5 };
      if (!world.isNight()) { ui.toast('ここを復活地点にしました。眠れるのは夜だけです'); return; }
      for (const e of ents) if (e.kind === 'mob' && MOBS[e.type].hostile && e.hp > 0 && Math.hypot(e.x - this.x, e.y - this.y, e.z - this.z) < 9) { ui.toast('近くに敵がいて眠れません'); return; }
      game.sleep(t);
    } else if (kind === 'altar') game.summonBoss(t.x, t.y, t.z);
  }

  // ---- 体力まわり（1秒に20回） ----
  tick() {
    if (this.dead) return;
    const world = game.world;
    if (this.hurtT > 0) this.hurtT--;
    if (this.mode === 0) {
      if (this.exh >= 4) { this.exh -= 4; if (this.sat > 0) this.sat = Math.max(0, this.sat - 1); else if (game.diff > 0) this.food = Math.max(0, this.food - 1); }
      if (game.diff === 0 && this.food < 20 && world.tick % 20 === 0) this.food++;
      if (this.food >= 18 && this.hp < 20) { if (++this.regenT >= (this.sat > 0 && this.food >= 20 ? 20 : 70)) { this.regenT = 0; this.hp = Math.min(20, this.hp + 1); this.exh += 3; ui.bumpHearts(); } }
      else if (this.food <= 0) { if (++this.starveT >= 80) { this.starveT = 0; if (this.hp > (game.diff >= 3 ? 0 : game.diff === 2 ? 1 : 10)) this.damage(1, this.x, this.z, 0, '空腹', true); } }
      if (this.headIn === 1) { this.air--; if (this.air <= -20) { this.air = 0; this.damage(2, this.x, this.z, 0, '水', true); } }
      else this.air = Math.min(300, this.air + 6);
      if (this.inLava && world.tick % 10 === 0) { this.damage(4, this.x, this.z, 0, '溶岩', true); this.burnT = Math.max(this.burnT, 60); }
      for (const k in this.fx) if (this.fx[k] > 0) {   // くすりの効き目
        this.fx[k]--;
        if (k === 'regen' && this.fx[k] % 50 === 0 && this.hp < 20) { this.hp = Math.min(20, this.hp + 1); ui.bumpHearts(); }
        if (world.tick % 8 === 0) { const c = C(POTIONS[k][1]), a = Math.random() * 6.283; fxPuff(this.x + Math.cos(a) * 0.55, this.y + 0.1 + Math.random() * 0.8, this.z + Math.sin(a) * 0.55, 1, c[0] / 255, c[1] / 255, c[2] / 255, { glow: true, speed: 0.1, life: 0.7, size: 0.035, up: 0.6, grav: 0 }); }
        if (this.fx[k] === 0) { ui.toast(POTIONS[k][0] + 'の 効き目が きれた'); sfx('fizz', 0.3); }
      }
      if (this.fx.fire > 0) this.burnT = 0;
      if (this.webT > 0) { this.webT--; if (world.tick % 3 === 0) fxPuff(this.x + (Math.random() - 0.5) * 0.6, this.y + 0.2 + Math.random() * 1.3, this.z + (Math.random() - 0.5) * 0.6, 1, 0.95, 0.97, 0.92, { speed: 0.2, life: 0.5, size: 0.06, up: 0, grav: 0 }); }
      if (this.burnT > 0) {   // 火がついている：水に入ると消える
        if (this.inWater) { this.burnT = 0; sfx('fizz', 0.5); }
        else { this.burnT--; if (this.burnT % 20 === 10 && !this.inLava) this.damage(1, this.x, this.z, 0, '火', true); if (world.tick % 2 === 0) fxPuff(this.x + (Math.random() - 0.5) * 0.5, this.y + 0.3 + Math.random() * 1.2, this.z + (Math.random() - 0.5) * 0.5, 1, 1, 0.55 + Math.random() * 0.3, 0.15, { glow: true, speed: 0.3, life: 0.5, size: 0.07, up: 1, grav: 0 }); }
      }
      if (world.tick % 10 === 0 && this.onGround && !this.sneaking) { const ub = BLOCKS[world.getBlock(Math.floor(this.x), Math.floor(this.y - 0.2), Math.floor(this.z))]; if (ub && ub.hot) this.damage(1, this.x, this.z, 0, 'マグマ石', true); }
      if (world.tick % 10 === 0) {
        const x0 = Math.floor(this.x - this.hw - 0.08), x1 = Math.floor(this.x + this.hw + 0.08), z0 = Math.floor(this.z - this.hw - 0.08), z1 = Math.floor(this.z + this.hw + 0.08);
        let hit = false;
        for (let y = Math.floor(this.y - 0.05); y <= Math.floor(this.y + this.h); y++) for (let z = z0; z <= z1; z++) for (let x = x0; x <= x1; x++) if (world.getBlock(x, y, z) === B.cactus) hit = true;
        if (hit) this.damage(1, this.x, this.z, 0, 'サボテン', true);
      }
    } else { this.air = 300; }
    if (this.y < -12) { if (this.mode === 1) { this.y = 100; this.vy = 0; } else this.damage(6, this.x, this.z, 0, '奈落', true); }
    // 門の中にいるか（ホムラの門は しばらく立っていると移る。ソラの門は ふれたらすぐ）
    if (this.dead || game.state === 'loading') return;
    const gx = Math.floor(this.x), gz = Math.floor(this.z), g0 = world.getBlock(gx, Math.floor(this.y + 0.1), gz), g1 = world.getBlock(gx, Math.floor(this.y + 1), gz);
    if (g0 === B.homura_gate || g1 === B.homura_gate) {
      if (!this.gateWait && world.dim !== 2) {
        if (this.gateT === 0) sfx('gatehum', 0.8);
        this.gateT++;
        if (this.gateT >= (this.mode === 1 ? 12 : 70)) { this.gateT = 0; game.travel(world.dim === 1 ? 0 : 1, 'gate'); }
      }
    } else if (g0 === B.sora_gate) {
      if (!this.gateWait) game.travel(world.dim === 2 ? 0 : 2, world.dim === 2 ? 'home' : 'sora');
    } else { this.gateT = Math.max(0, this.gateT - 3); this.gateWait = false; }
  }
  damage(amount, fromX, fromZ, kb, source, raw) {
    if (this.dead || this.mode === 1 || amount <= 0) return;
    if (this.fx.fire > 0 && (source === '溶岩' || source === '火' || source === 'マグマ石')) return;   // 「ひよけの くすり」
    if (this.hurtT > 0 && !raw) return;
    if (!raw && this.blocking && this.armor[4]) {   // 盾：前から来たものは ふせぐ（盾が すりへる）
      const dx = fromX - this.x, dz = fromZ - this.z, dl = Math.hypot(dx, dz);
      if (dl > 0.05 && (dx * -Math.sin(this.yaw) + dz * -Math.cos(this.yaw)) / dl > 0.1) {
        const a = this.armor[4], un = unbrLv(a.id, a.d || 0); if (!(un && Math.random() < un / (un + 1))) a.d = (a.d || 0) + 1 + Math.floor(amount); this.invDirty = true;
        if (itemDmg(a.d) >= ITEMS[a.id].armor.dur) { this.armor[4] = null; this.blocking = false; sfx('toolbreak'); ui.toast('盾 がこわれた'); }
        if (kb) { this.vx -= dx / dl * kb * 0.25; this.vz -= dz / dl * kb * 0.25; }
        this.hurtT = 5; sfx('shieldhit'); game.camKick = 0.4; this.stat('block', 0);
        fxPuff(this.x - Math.sin(this.yaw) * 0.6, this.eyeY() - 0.35, this.z - Math.cos(this.yaw) * 0.6, 7, 1, 0.9, 0.6, { glow: true, speed: 2.4, life: 0.25, size: 0.05, grav: 8 });
        return 'block';
      }
    }
    if (!raw) {
      amount *= 1 - Math.min(20, this.armorPoints()) * 0.04;
      let prot = 0; for (let i = 0; i < 4; i++) if (this.armor[i]) prot += enchOf(this.armor[i].d || 0, 0);   // 「まもり」：1レベルごとに 4% へる（64%まで）
      amount *= 1 - Math.min(0.64, prot * 0.04);
      for (let i = 0; i < 4; i++) { const a = this.armor[i]; if (a) { const un = unbrLv(a.id, a.d || 0); if (!(un && Math.random() < un / (un + 1))) a.d = (a.d || 0) + 1; if (itemDmg(a.d) >= ITEMS[a.id].armor.dur) { this.armor[i] = null; sfx('toolbreak'); ui.toast(itemName(a.id) + ' がこわれた'); } } }
      this.invDirty = true;
    }
    this.hp -= amount; this.hurtT = 10; this.exh += 0.1; if (game.inBed) game.wake();
    if (kb) { const dx = this.x - fromX, dz = this.z - fromZ, d = Math.hypot(dx, dz) || 1; this.vx += dx / d * kb; this.vz += dz / d * kb; this.vy = Math.max(this.vy, 4.2); this.onGround = false; }
    game.camKick = 1; ui.hurtFlash(); sfx('hurt'); ui.bumpHearts();
    if (this.hp <= 0) { this.hp = 0; this.die(source); }
  }
  die(source) {
    if (this.ride) this.dismount(); this.gliding = false;
    this.dead = true; this.stats.deaths++; this.burnT = 0; this.gateT = 0; this.drawT = 0; this.autoBow = 0; this.blocking = false; this.webT = 0; for (const k in this.fx) this.fx[k] = 0;
    this.deathPos = { x: Math.floor(this.x), y: Math.floor(this.y), z: Math.floor(this.z) };
    let dropped = false;
    if (!game.rules.keep) {
      const all = this.inv.concat(this.armor);
      for (const s of all) if (s) { const e = spawnDrop(this.x, this.y + 0.6, this.z, s.id, s.n, s.d || 0, (Math.random() - 0.5) * 4, 3 + Math.random() * 2, (Math.random() - 0.5) * 4, 40); if (e) e.life = 12000; dropped = true; }
      this.inv.fill(null); this.armor = [null, null, null, null, null];
      spawnXp(this.x, this.y + 0.6, this.z, Math.min(100, this.xpLv * 7)); this.xpLv = 0; this.xpPt = 0;   // 経験値も その場に落ちる（レベル×7、100まで）
    }
    this.invDirty = true; this.brk = null;
    if (ui.screen) ui.close(true);   // 持ち物や地図を開いたままにしない
    sfx('death');
    ui.showDeath(DEATH_MSG[source] || (source ? source + ' にやられてしまった' : '力尽きてしまった'), dropped);
  }
  respawn() {
    const world = game.world;
    let sp = this.spawn;
    if (sp && world.getBlock(Math.floor(sp.x), Math.floor(sp.y - 0.6), Math.floor(sp.z)) !== B.bed && world.isLoaded(Math.floor(sp.x), Math.floor(sp.z))) { sp = null; this.spawn = null; ui.toast('ベッドがなくなったので最初の場所にもどります'); }
    if (!sp) sp = game.worldSpawn;
    this.x = sp.x; this.y = sp.y; this.z = sp.z; this.vx = this.vy = this.vz = 0;
    this.hp = 20; this.food = 20; this.sat = 5; this.exh = 0; this.air = 300; this.dead = false; this.hurtT = 60; this.fallDist = 0; this.burnT = 0; this.gateT = 0; this.gateWait = true;
    game.needSafeSpot = sp === game.worldSpawn ? 1 : 2;
  }
  serialize() {
    const day = game.world ? game.world.day : 0, tr = {}; for (const k in this.trades) if (this.trades[k][0] === day) tr[k] = this.trades[k];   // きょうの分だけ のこす
    return { trades: tr, ride: this.ride, x: this.x, y: this.y, z: this.z, yaw: this.yaw, pitch: this.pitch, hp: this.hp, food: this.food, sat: this.sat, air: this.air, inv: this.inv, armor: this.armor, sel: this.sel, spawn: this.spawn, flying: this.flying, stats: this.stats, dead: this.dead, deathPos: this.deathPos, xpLv: this.xpLv, xpPt: this.xpPt, enchSeed: this.enchSeed, fx: this.fx };
  }
  load(o) {
    for (const k of ['x', 'y', 'z', 'yaw', 'pitch', 'hp', 'food', 'sat', 'air', 'sel', 'spawn', 'flying', 'deathPos', 'xpLv', 'xpPt', 'enchSeed']) if (o[k] !== undefined) this[k] = o[k];
    if (o.fx) for (const k in this.fx) this.fx[k] = Math.max(0, Math.min(12000, o.fx[k] | 0));
    this.xpLv = Math.max(0, this.xpLv | 0); this.xpPt = Math.max(0, +this.xpPt || 0);
    if (o.inv) this.inv = o.inv.map(s => s ? { id: s.id, n: s.n, d: s.d || 0 } : null); while (this.inv.length < 36) this.inv.push(null);
    if (o.armor) this.armor = o.armor.map(s => s ? { id: s.id, n: s.n, d: s.d || 0 } : null); while (this.armor.length < 5) this.armor.push(null);   // 昔のセーブには 盾のマスがない
    if (o.stats) Object.assign(this.stats, o.stats);
    this.ride = null; this.h = 1.8; if (o.ride && RIDE_EYE[o.ride.t]) { const q = o.ride; this.ride = { t: q.t, hp: +q.hp || 1, c: q.c | 0, s: q.s ? 1 : 0, tm: q.tm ? String(q.tm) : null, n: q.n | 0, yaw: +q.yaw || 0, wild: 0, rv: 0, walk: 0, walkAmp: 0 }; if (q.t === 'horse') this.h = 2.5; }
    this.trades = {}; if (o.trades && typeof o.trades === 'object') for (const k in o.trades) { const r = o.trades[k]; if (Array.isArray(r) && r.length === 7) this.trades[k] = r.map(n => n | 0); }
    if (o.dead) { this.hp = 20; this.food = 20; }
    this.invDirty = true;
  }

  // ---- 視点 ----
  camera(cam) {
    const b = settings.bobbing ? this.bobAmp : 0;
    cam.x = this.x; cam.y = this.eyeY() - (this.stepLift || 0) + Math.abs(Math.sin(this.bob * 1.9)) * 0.045 * b; cam.z = this.z;
    cam.yaw = this.yaw; cam.pitch = this.pitch;
    cam.roll = Math.sin(this.bob * 1.9) * 0.006 * b + game.camKick * 0.09 * Math.sin(game.camKick * 9) + (game.shake > 0 ? (Math.random() - 0.5) * game.shake * 0.08 : 0);
    if (game.shake > 0) { cam.x += (Math.random() - 0.5) * game.shake * 0.2; cam.y += (Math.random() - 0.5) * game.shake * 0.2; }
    cam.fov = settings.fov * (this.sprintK === undefined ? 1 : 1 + 0.13 * this.sprintK) * (this.flying && this.sprinting ? 1.05 : 1) * (this.drawT > 0 ? 1 - 0.15 * Math.min(1, this.drawT) : 1);   // 弓を引くと 少し ねらいやすく
    if (this.dead) { cam.roll = 0.5; cam.y = this.y + 0.4; }
    else if (settings.view) {   // うしろから／前から見る：かべにめりこまないよう、ぶつかる手前で止める
      const back = settings.view === 1 ? 1 : -1, cp = Math.cos(this.pitch), cyaw = this.yaw + (R.dbgCam || 0);   // dbgCam＝試験で 横から撮るため（カメラだけ 回す）
      const dx = Math.sin(cyaw) * cp * back, dy = -Math.sin(this.pitch) * back, dz = Math.cos(cyaw) * cp * back;
      let dist = 4; const hit = game.world.raycast(cam.x, cam.y, cam.z, dx, dy, dz, dist + 0.4);
      if (hit && SOLID[hit.id]) dist = Math.max(0.2, hit.t - 0.4);
      cam.x += dx * dist; cam.y += dy * dist; cam.z += dz * dist;
      if (back < 0) { cam.yaw = cyaw + Math.PI; cam.pitch = -this.pitch; } else cam.yaw = cyaw;
    }
    return cam;
  }
  drawHand(world) {
    if (this.dead) return;
    const it = this.held();
    lightRGB(world.getLightRaw(Math.floor(this.x), Math.floor(this.eyeY()), Math.floor(this.z)), _lcE);
    let r = _lcE[0], g = _lcE[1], b = _lcE[2];
    const p = 1 - this.swingT, s1 = Math.sin(Math.sqrt(p) * Math.PI), s2 = Math.sin(p * Math.PI);
    const ba = settings.bobbing ? this.bobAmp : 0;
    const bx = Math.sin(this.bob * 1.9) * 0.018 * ba, by = -Math.abs(Math.cos(this.bob * 1.9)) * 0.02 * ba - this.equipT * 0.45;
    const eat = this.eating > 0 ? Math.min(1, this.eating * 5) : 0, ew = eat ? Math.sin(this.eating * 26) * 0.02 : 0;
    const asp = R.w / R.h, hx = 0.7 * asp, sc = clamp(asp / 1.4, 0.55, 1);
    if (this.armor[4]) {   // 左手の盾：ふだんは下に少しだけ見え、かまえると 前に出る
      const k = this.blockK, W = [0.65 * r, 0.48 * g, 0.27 * b], Wd = [0.5 * r, 0.36 * g, 0.2 * b], Fe = [0.72 * r, 0.74 * g, 0.78 * b];
      m4Translate(_mm, -hx * (0.66 - k * 0.3) + bx, -0.74 + k * 0.3 + by, -0.95 + k * 0.08);
      m4RotY(_mr, -0.55 + k * 0.4); m4Mul(_mm, _mm, _mr); m4RotX(_mr, -0.1 - k * 0.08); m4Mul(_mm, _mm, _mr); m4RotZ(_mr, -0.1 + k * 0.08); m4Mul(_mm, _mm, _mr); m4Scale(_mr, sc, sc, sc); m4Mul(_mm, _mm, _mr);
      addColorBox(handCol, _mm, -0.27, -0.36, -0.02, 0.27, 0.36, 0.02, W[0], W[1], W[2], 1);
      addColorBox(handCol, _mm, -0.095, -0.36, 0.02, -0.075, 0.36, 0.026, Wd[0], Wd[1], Wd[2], 1); addColorBox(handCol, _mm, 0.075, -0.36, 0.02, 0.095, 0.36, 0.026, Wd[0], Wd[1], Wd[2], 1);
      addColorBox(handCol, _mm, -0.29, 0.34, -0.03, 0.29, 0.38, 0.03, Fe[0], Fe[1], Fe[2], 1); addColorBox(handCol, _mm, -0.29, -0.38, -0.03, 0.29, -0.34, 0.03, Fe[0], Fe[1], Fe[2], 1);
      addColorBox(handCol, _mm, -0.29, -0.34, -0.03, -0.25, 0.34, 0.03, Fe[0], Fe[1], Fe[2], 1); addColorBox(handCol, _mm, 0.25, -0.34, -0.03, 0.29, 0.34, 0.03, Fe[0], Fe[1], Fe[2], 1);
      addColorBox(handCol, _mm, -0.07, -0.07, 0.02, 0.07, 0.07, 0.05, Fe[0] * 1.15, Fe[1] * 1.15, Fe[2] * 1.15, 1);
    }
    if (it && ITEMS[it.id].tool && ITEMS[it.id].tool.type === 'bow' && this.drawT > 0.02) {   // 弓を引いている：つるを たてにして、矢が画面のおくを向くように持つ。いっぱいまで引くと 小さく ふるえる
      const d = Math.min(1, this.drawT), full = this.drawT >= 1 ? Math.sin(this.drawT * 55) * 0.004 : 0, id = this.drawT > 0.55 ? I.bow_p2 : I.bow_p1;
      m4Translate(_mm, hx * (0.42 - d * 0.12) + bx + full, -0.3 + d * 0.04 + by + full, -0.85 + d * 0.07);
      m4RotZ(_mr, -0.16); m4Mul(_mm, _mm, _mr); m4RotY(_mr, -1.08); m4Mul(_mm, _mm, _mr); m4RotZ(_mr, Math.PI / 4); m4Mul(_mm, _mm, _mr);
      m4Scale(_mr, 0.62 * sc, 0.62 * sc, 0.62 * sc); m4Mul(_mm, _mm, _mr);
      addItemMesh(handCol, _mm, id, r, g, b, 1);
      return;
    }
    if (!it) {
      m4Translate(_mm, hx * 0.62 - s1 * 0.3 * sc + bx, -0.78 + s2 * 0.2 + by, -0.7 - s2 * 0.25);
      m4RotX(_mr, -1.05 - s2 * 0.9); m4Mul(_mm, _mm, _mr); m4RotZ(_mr, 0.22 + s1 * 0.3); m4Mul(_mm, _mm, _mr); m4Scale(_mr, sc, sc, sc); m4Mul(_mm, _mm, _mr);
      addColorBox(handCol, _mm, -0.075, 0.3, -0.075, 0.075, 0.62, 0.075, 0.93 * r, 0.74 * g, 0.58 * b, 1);
      addColorBox(handCol, _mm, -0.085, -0.2, -0.085, 0.085, 0.3, 0.085, 0.82 * r, 0.38 * g, 0.2 * b, 1);
      return;
    }
    const isCube = isBlk(it.id) && !ICON[it.id];
    if (enchAny(it.d)) { const gl = 0.5 + 0.5 * Math.sin(R.time * 3.5); r *= 1 + 0.2 * gl; g *= 0.94; b *= 1.12 + 0.45 * gl; }   // 力のこもった物は むらさきに ゆらめく
    if (isCube) {
      m4Translate(_mm, hx * 0.56 - s1 * 0.34 * sc + bx - eat * hx * 0.45, -0.5 + s2 * 0.12 + by + ew, -1.0 - s2 * 0.2);
      m4RotX(_mr, 0.12 - s2 * 0.8); m4Mul(_mm, _mm, _mr); m4RotY(_mr, 0.78 + s1 * 0.5); m4Mul(_mm, _mm, _mr); m4Scale(_mr, 0.34 * sc, 0.34 * sc, 0.34 * sc); m4Mul(_mm, _mm, _mr);
      addBlockCube(handTex, _mm, it.id, r, g, b, 1);
    } else {
      // 平たい物：板を 見ている向きに そわせて、右下から前へ つき出すように持つ（柄は 画面の下に かくれる＝にぎっているように見える）。ふると 前へ ふりおろす
      const tool = holdKind(it.id) === 2, S = (tool ? 0.66 : 0.5) * sc;
      m4Translate(_mm, hx * (tool ? 0.62 : 0.6) - s1 * 0.3 * sc + bx - eat * hx * 0.48, (tool ? -0.5 : -0.52) + s2 * 0.04 - s1 * 0.12 + by + ew, (tool ? -0.95 : -0.98) - s2 * 0.12);
      m4RotX(_mr, -s2 * 1.0); m4Mul(_mm, _mm, _mr); m4RotY(_mr, 1.8 + s1 * 0.25 + eat * 0.8); m4Mul(_mm, _mm, _mr); m4RotZ(_mr, tool ? -0.2 : -0.1); m4Mul(_mm, _mm, _mr);
      m4Scale(_mr, S, S, S); m4Mul(_mm, _mm, _mr);
      addItemMesh(handCol, _mm, it.id, r, g, b, 1);
    }
  }
}
let player = new Player();

// クラフトの形あわせ。cells: 幅 w の正方形に並んだ持ち物
function matchGrid(cells, w) {
  let minX = w, minY = w, maxX = -1, maxY = -1, cnt = 0;
  for (let y = 0; y < w; y++) for (let x = 0; x < w; x++) if (cells[y * w + x]) { cnt++; if (x < minX) minX = x; if (x > maxX) maxX = x; if (y < minY) minY = y; if (y > maxY) maxY = y; }
  if (!cnt) return null;
  const gw = maxX - minX + 1, gh = maxY - minY + 1;
  for (const r of RECIPES) {
    if (r.list) {
      if (cnt !== r.list.length) continue;
      const used = new Array(cells.length).fill(false); let ok = true;
      for (const spec of r.list) { let f = false; for (let i = 0; i < cells.length; i++) if (cells[i] && !used[i] && specMatch(spec, cells[i].id)) { used[i] = true; f = true; break; } if (!f) { ok = false; break; } }
      if (ok) return r;
    } else {
      const rh = r.rows.length, rw = r.rows[0].length;
      if (rw !== gw || rh !== gh) continue;
      for (let mir = 0; mir < 2; mir++) {
        let ok = true;
        for (let y = 0; y < rh && ok; y++) for (let x = 0; x < rw; x++) {
          const ch = r.rows[y][mir ? rw - 1 - x : x], c = cells[(minY + y) * w + minX + x];
          if (ch === ' ') { if (c) { ok = false; break; } } else if (!c || !specMatch(r.key[ch], c.id)) { ok = false; break; }
        }
        if (ok) return r;
      }
    }
  }
  return null;
}
