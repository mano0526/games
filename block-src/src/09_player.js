// ===== 09_player.js : プレイヤーの動き・こわす／置く・持ち物・体力と空腹 =====
const input = { fwd: 0, strafe: 0, jump: false, sneak: false, sprint: false, breakHeld: false, breakPressed: false, useHeld: false, usePressed: false, lookDX: 0, lookDY: 0, rayNdc: null };
const DEATH_MSG = { '落下': '高いところから落ちてしまった', '溶岩': '溶岩に落ちてしまった', '空腹': 'おなかが空いて力尽きた', '水': 'おぼれてしまった', 'サボテン': 'サボテンのトゲにやられた', '奈落': '世界の底に落ちてしまった' };

class Player {
  constructor() { this.hw = 0.3; this.h = 1.8; this.reset(); }
  reset() {
    this.x = 0; this.y = 80; this.z = 0; this.vx = 0; this.vy = 0; this.vz = 0; this.yaw = 0; this.pitch = 0;
    this.onGround = false; this.hitH = false; this.mode = 0; this.flying = false;
    this.hp = 20; this.food = 20; this.sat = 5; this.exh = 0; this.air = 300; this.dead = false;
    this.inv = new Array(36).fill(null); this.armor = [null, null, null, null]; this.sel = 0; this.cursor = null;
    this.spawn = null; this.brk = null; this.brkDelay = 0; this.swingT = 0; this.cool = 0; this.useCool = 0; this.eating = 0; this.eatSnd = 0; this.equipT = 0;
    this.sneaking = false; this.sprinting = false; this.inWater = false; this.inLava = false; this.headIn = 0;
    this.fallDist = 0; this.hurtT = 0; this.regenT = 0; this.starveT = 0; this.stepAcc = 0; this.bob = 0; this.bobAmp = 0; this.jumpCd = 0;
    this.target = null; this.targetMob = null; this.ray = [0, 0, -1]; this.eyeOff = 1.62; this.invDirty = true; this.deathPos = null; this.lastSel = -1;
    this.stats = { broken: 0, placed: 0, kills: 0, deaths: 0, crafted: 0, dist: 0 };
  }
  eyeY() { return this.y + this.eyeOff; }
  held() { return this.inv[this.sel]; }
  heldTool() { const s = this.inv[this.sel]; return s && ITEMS[s.id] && ITEMS[s.id].tool ? ITEMS[s.id].tool : null; }
  stat(kind, id) { game.onStat(kind, id); }
  lookF() { return ((2 - Math.round(this.yaw / (Math.PI / 2))) % 4 + 4) % 4; }

  // ---- 持ち物 ----
  give(id, n, d) {
    const max = maxStack(id);
    if (max > 1 && !d) for (let i = 0; i < 36 && n > 0; i++) { const s = this.inv[i]; if (s && s.id === id && s.n < max && !s.d) { const k = Math.min(n, max - s.n); s.n += k; n -= k; } }
    for (let i = 0; i < 36 && n > 0; i++) if (!this.inv[i]) { const k = Math.min(n, max); this.inv[i] = { id, n: k, d: d || 0 }; n -= k; }
    this.invDirty = true;
    return n;
  }
  canTake(id, d) {
    const max = maxStack(id);
    for (let i = 0; i < 36; i++) { const s = this.inv[i]; if (!s) return true; if (max > 1 && !d && s.id === id && s.n < max && !s.d) return true; }
    return false;
  }
  countSpec(spec) { let c = 0; for (const s of this.inv) if (s && specMatch(spec, s.id)) c += s.n; return c; }
  consumeSpec(spec, n) {
    for (let i = 35; i >= 0 && n > 0; i--) { const s = this.inv[i]; if (s && specMatch(spec, s.id)) { const k = Math.min(n, s.n); s.n -= k; n -= k; if (s.n <= 0) this.inv[i] = null; } }
    this.invDirty = true; return n === 0;
  }
  useHeldOne() { if (this.mode === 1) return; const s = this.inv[this.sel]; if (!s) return; s.n--; if (s.n <= 0) this.inv[this.sel] = null; this.invDirty = true; }
  wearHeld(n) {
    if (this.mode === 1) return;
    const s = this.inv[this.sel]; if (!s) return; const t = ITEMS[s.id].tool; if (!t) return;
    s.d += n; this.invDirty = true;
    if (s.d >= t.dur) { this.inv[this.sel] = null; sfx('toolbreak'); ui.toast(itemName(s.id) + ' がこわれた'); fxPuff(this.x - Math.sin(this.yaw) * 0.6, this.eyeY() - 0.3, this.z - Math.cos(this.yaw) * 0.6, 8, 0.6, 0.5, 0.35, { speed: 2, life: 0.5, grav: 12 }); }
  }
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
    const want = this.sneaking ? 1.47 : 1.62; this.eyeOff += (want - this.eyeOff) * Math.min(1, dt * 14);
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
    this.sneaking = sneak && !this.flying;
    if (input.sprint && f > 0.5 && !this.sneaking && (this.mode === 1 || this.food > 6)) this.sprinting = true;
    if (f <= 0.1 || this.sneaking || (this.mode === 0 && this.food <= 6)) this.sprinting = false;
    let speed = this.flying ? (this.sprinting ? 21 : 10.5) : this.sneaking ? 1.3 : this.sprinting ? 5.6 : 4.3;
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
      if (jump && this.onGround && this.jumpCd <= 0) { this.vy = 8.7; this.jumpCd = 0.08; this.exh += this.sprinting ? 0.2 : 0.05; this.onGround = false; }
    }
    let dx = this.vx * dt, dz = this.vz * dt; const dy = this.vy * dt;
    if (this.sneaking && this.onGround && dy <= 0) {
      const st = 0.04;
      while (dx !== 0 && !this.hasFloor(world, this.x + dx, this.z)) { if (Math.abs(dx) < st) dx = 0; else dx -= Math.sign(dx) * st; }
      while (dz !== 0 && !this.hasFloor(world, this.x, this.z + dz)) { if (Math.abs(dz) < st) dz = 0; else dz -= Math.sign(dz) * st; }
      while (dx !== 0 && dz !== 0 && !this.hasFloor(world, this.x + dx, this.z + dz)) { if (Math.abs(dx) < st) dx = 0; else dx -= Math.sign(dx) * st; if (Math.abs(dz) < st) dz = 0; else dz -= Math.sign(dz) * st; }
    }
    const ox = this.x, oy = this.y, oz = this.z, wasG = this.onGround;
    moveAABB(world, this, dx, dy, dz);
    if (this.flying || inW || inL || ladder) this.fallDist = 0;
    else if (this.y < oy) this.fallDist += oy - this.y;
    if (this.onGround) {
      if (this.flying) this.flying = false;
      if (this.fallDist > 3.4 && this.mode === 0) { const dmg = Math.floor(this.fallDist - 3); if (dmg > 0) this.damage(dmg, this.x, this.z, 0, '落下', true); }
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
    if (ui.screen) { this.target = null; this.targetMob = null; this.brk = null; this.eating = 0; return; }
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
    const canEat = !!def && !!def.food && !tInteract && (this.food < 20 || !!def.heal || this.mode === 1);
    this.autoEat = Math.max(0, (this.autoEat || 0) - dt);
    if (input.tapPending) {   // 画面を軽くタップ：生き物なら攻撃、食べ物なら食べる、それ以外は置く・使う
      input.tapPending = false;
      if (this.targetMob) { if (this.cool <= 0) this.attack(this.targetMob); }
      else if (this.targetPeer) { if (this.cool <= 0) this.attackPeer(this.targetPeer); }
      else if (canEat) this.autoEat = 1.7;
      else { this.use(world); this.useCool = 0.24; }
    }
    if (canEat && (input.useHeld || this.autoEat > 0)) {
      this.eating += dt; this.eatSnd -= dt;
      if (this.eatSnd <= 0) { this.eatSnd = 0.22; sfx('eat', 0.5); }
      if (this.eating >= 1.5) {
        this.eating = 0;
        this.food = Math.min(20, this.food + def.food[0]); this.sat = Math.min(20, this.sat + def.food[1]);
        if (def.heal) this.hp = Math.min(20, this.hp + def.heal);
        const id = it.id; this.useHeldOne();
        if (def.leftover && this.mode === 0) { if (!this.inv[this.sel]) this.inv[this.sel] = { id: def.leftover, n: 1, d: 0 }; else if (this.give(def.leftover, 1, 0)) spawnDrop(this.x, this.y + 1, this.z, def.leftover, 1, 0); }
        sfx('burp'); ui.bumpFood(); this.stat('eat', id); this.invDirty = true;
      }
    } else {
      this.eating = 0;
      if (input.usePressed || (input.useHeld && this.useCool <= 0)) { this.use(world); this.useCool = 0.24; }
    }
  }
  breakTime(id) {
    const b = BLOCKS[id];
    if (b.hard < 0) return Infinity; if (b.hard === 0) return 0;
    const tool = this.heldTool(), match = !!tool && tool.type === b.tool;
    const can = !b.needTool || (match && tool.tier >= b.level);
    let t = b.hard * (can ? 1.5 : 5) / (match ? tool.speed : 1);
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
      const drops = blockDrops(id, meta, tool, world.rng);
      const toWater = id === B.ice && (SOLID[world.getBlock(t.x, t.y - 1, t.z)] || FLUID[world.getBlock(t.x, t.y - 1, t.z)]);
      world.setBlock(t.x, t.y, t.z, toWater ? B.water : 0, 0);
      for (const [did, n] of drops) spawnDrop(t.x + 0.5, t.y + 0.35, t.z + 0.5, did, n, 0);
      if (tool && b.hard > 0) this.wearHeld(tool.type === 'sword' ? 2 : 1);
      this.exh += 0.005;
    } else world.setBlock(t.x, t.y, t.z, 0, 0);
    this.stats.broken++; this.stat('break', id);
  }
  attack(e) {
    const tool = this.heldTool(); let dmg = tool ? tool.dmg : 1;
    const crit = this.vy < -0.5 && !this.onGround && !this.inWater && !this.flying;
    if (crit) dmg *= 1.5;
    if (this.mode === 1) dmg = Math.max(dmg, 12);
    this.swing(); this.cool = 0.32;
    if (hurtMob(e, dmg, this.x, this.z, this.sprinting ? 8 : 5.5)) {
      sfx('hit');
      if (crit) fxPuff(e.x, e.y + e.h * 0.7, e.z, 10, 1, 0.9, 0.3, { glow: true, speed: 3, life: 0.4, size: 0.06 });
      if (tool) this.wearHeld(tool.type === 'sword' ? 1 : 2);
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
  use(world) {
    const t = this.target, it = this.held(), def = it ? ITEMS[it.id] : null;
    if (t && !this.sneaking) { const b = BLOCKS[t.id]; if (b.interact) { this.swing(); this.interactBlock(world, t, b.interact); return true; } }
    if (!it) return false;
    if (def.bucket) return this.useBucket(world, it, def);
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
    const cur = world.getBlock(px, py, pz);
    if (!(cur === 0 || REPLACE[cur])) return false;
    const sh = SHAPE[id], lf = this.lookF(), toward = (lf + 2) & 3;
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
    } else if (BLOCKS[id].support) { if (!world.hasSupport(id, 0, px, py, pz)) return false; }
    else if (BLOCKS[id].facing) meta = toward;
    else if (ISLEAF[id]) meta = 1;
    if (SOLID[id]) {
      for (const b of collisionBoxes(id, meta)) {
        if (px + b[0] < this.x + this.hw && px + b[3] > this.x - this.hw && py + b[1] < this.y + this.h && py + b[4] > this.y && pz + b[2] < this.z + this.hw && pz + b[5] > this.z - this.hw) return false;
        for (const e of ents) if (e.kind === 'mob' && px + b[0] < e.x + e.hw && px + b[3] > e.x - e.hw && py + b[1] < e.y + e.h && py + b[4] > e.y && pz + b[2] < e.z + e.hw && pz + b[5] > e.z - e.hw) return false;
      }
    }
    if (cur && !FLUID[cur]) world.breakNatural(px, py, pz);
    if (extra) { const ec = world.getBlock(extra[0], extra[1], extra[2]); if (ec && !FLUID[ec]) world.breakNatural(extra[0], extra[1], extra[2]); world.setBlock(px, py, pz, id, meta, 1); world.setBlock(extra[0], extra[1], extra[2], id, extra[3]); }
    else world.setBlock(px, py, pz, id, meta);
    const be = BLOCKS[id].ent;
    if (be === 'chest') world.setEnt(px, py, pz, { t: 'chest', items: new Array(27).fill(null) });
    else if (be === 'furnace') world.setEnt(px, py, pz, { t: 'furnace', in: null, fuel: null, out: null, burn: 0, burnMax: 0, cook: 0 });
    this.useHeldOne(); this.swing();
    sfxAt('place_' + BLOCKS[id].sound, px, py, pz);
    this.stats.placed++; this.stat('place', id);
    return true;
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
    if (cur && !FLUID[cur]) world.breakNatural(px, py, pz);
    world.setBlock(px, py, pz, def.bucket === 'water' ? B.water : B.lava, 0); sfx('splash'); this.swing();
    if (this.mode === 0) { this.inv[this.sel] = { id: I.bucket, n: 1, d: 0 }; this.invDirty = true; }
    return true;
  }
  interactBlock(world, t, kind) {
    if ((kind === 'furnace' || kind === 'chest') && net.on) { const p = net.openBy(t.x, t.y, t.z); if (p) { ui.toast(p.name + ' が使っています'); sfx('deny', 0.4); return; } }
    if (kind === 'table') { ui.open('table'); sfx('click'); }
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
    } else if (kind === 'bed') {
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
      if (this.inLava && world.tick % 10 === 0) this.damage(4, this.x, this.z, 0, '溶岩', true);
      if (world.tick % 10 === 0) {
        const x0 = Math.floor(this.x - this.hw - 0.08), x1 = Math.floor(this.x + this.hw + 0.08), z0 = Math.floor(this.z - this.hw - 0.08), z1 = Math.floor(this.z + this.hw + 0.08);
        let hit = false;
        for (let y = Math.floor(this.y - 0.05); y <= Math.floor(this.y + this.h); y++) for (let z = z0; z <= z1; z++) for (let x = x0; x <= x1; x++) if (world.getBlock(x, y, z) === B.cactus) hit = true;
        if (hit) this.damage(1, this.x, this.z, 0, 'サボテン', true);
      }
    } else { this.air = 300; }
    if (this.y < -12) { if (this.mode === 1) { this.y = 100; this.vy = 0; } else this.damage(6, this.x, this.z, 0, '奈落', true); }
  }
  damage(amount, fromX, fromZ, kb, source, raw) {
    if (this.dead || this.mode === 1 || amount <= 0) return;
    if (this.hurtT > 0 && !raw) return;
    if (!raw) {
      amount *= 1 - Math.min(20, this.armorPoints()) * 0.04;
      for (let i = 0; i < 4; i++) { const a = this.armor[i]; if (a) { a.d = (a.d || 0) + 1; if (a.d >= ITEMS[a.id].armor.dur) { this.armor[i] = null; sfx('toolbreak'); ui.toast(itemName(a.id) + ' がこわれた'); } } }
      this.invDirty = true;
    }
    this.hp -= amount; this.hurtT = 10; this.exh += 0.1; if (game.inBed) game.wake();
    if (kb) { const dx = this.x - fromX, dz = this.z - fromZ, d = Math.hypot(dx, dz) || 1; this.vx += dx / d * kb; this.vz += dz / d * kb; this.vy = Math.max(this.vy, 4.2); this.onGround = false; }
    game.camKick = 1; ui.hurtFlash(); sfx('hurt'); ui.bumpHearts();
    if (this.hp <= 0) { this.hp = 0; this.die(source); }
  }
  die(source) {
    this.dead = true; this.stats.deaths++;
    this.deathPos = { x: Math.floor(this.x), y: Math.floor(this.y), z: Math.floor(this.z) };
    let dropped = false;
    if (!game.rules.keep) {
      const all = this.inv.concat(this.armor);
      for (const s of all) if (s) { const e = spawnDrop(this.x, this.y + 0.6, this.z, s.id, s.n, s.d || 0, (Math.random() - 0.5) * 4, 3 + Math.random() * 2, (Math.random() - 0.5) * 4, 40); if (e) e.life = 12000; dropped = true; }
      this.inv.fill(null); this.armor = [null, null, null, null];
    }
    this.invDirty = true; this.brk = null;
    sfx('death');
    ui.showDeath(DEATH_MSG[source] || (source ? source + ' にやられてしまった' : '力尽きてしまった'), dropped);
  }
  respawn() {
    const world = game.world;
    let sp = this.spawn;
    if (sp && world.getBlock(Math.floor(sp.x), Math.floor(sp.y - 0.6), Math.floor(sp.z)) !== B.bed && world.isLoaded(Math.floor(sp.x), Math.floor(sp.z))) { sp = null; this.spawn = null; ui.toast('ベッドがなくなったので最初の場所にもどります'); }
    if (!sp) sp = game.worldSpawn;
    this.x = sp.x; this.y = sp.y; this.z = sp.z; this.vx = this.vy = this.vz = 0;
    this.hp = 20; this.food = 20; this.sat = 5; this.exh = 0; this.air = 300; this.dead = false; this.hurtT = 60; this.fallDist = 0;
    game.needSafeSpot = sp === game.worldSpawn ? 1 : 2;
  }
  serialize() {
    return { x: this.x, y: this.y, z: this.z, yaw: this.yaw, pitch: this.pitch, hp: this.hp, food: this.food, sat: this.sat, air: this.air, inv: this.inv, armor: this.armor, sel: this.sel, spawn: this.spawn, flying: this.flying, stats: this.stats, dead: this.dead, deathPos: this.deathPos };
  }
  load(o) {
    for (const k of ['x', 'y', 'z', 'yaw', 'pitch', 'hp', 'food', 'sat', 'air', 'sel', 'spawn', 'flying', 'deathPos']) if (o[k] !== undefined) this[k] = o[k];
    if (o.inv) this.inv = o.inv.map(s => s ? { id: s.id, n: s.n, d: s.d || 0 } : null); while (this.inv.length < 36) this.inv.push(null);
    if (o.armor) this.armor = o.armor.map(s => s ? { id: s.id, n: s.n, d: s.d || 0 } : null);
    if (o.stats) Object.assign(this.stats, o.stats);
    if (o.dead) { this.hp = 20; this.food = 20; }
    this.invDirty = true;
  }

  // ---- 視点 ----
  camera(cam) {
    const b = settings.bobbing ? this.bobAmp : 0;
    cam.x = this.x; cam.y = this.eyeY() + Math.abs(Math.sin(this.bob * 1.9)) * 0.045 * b; cam.z = this.z;
    cam.yaw = this.yaw; cam.pitch = this.pitch;
    cam.roll = Math.sin(this.bob * 1.9) * 0.006 * b + game.camKick * 0.09 * Math.sin(game.camKick * 9) + (game.shake > 0 ? (Math.random() - 0.5) * game.shake * 0.08 : 0);
    if (game.shake > 0) { cam.x += (Math.random() - 0.5) * game.shake * 0.2; cam.y += (Math.random() - 0.5) * game.shake * 0.2; }
    cam.fov = settings.fov * (this.sprinting ? 1.08 : 1) * (this.flying && this.sprinting ? 1.05 : 1);
    if (this.dead) { cam.roll = 0.5; cam.y = this.y + 0.4; }
    else if (settings.view) {   // うしろから／前から見る：かべにめりこまないよう、ぶつかる手前で止める
      const back = settings.view === 1 ? 1 : -1, cp = Math.cos(this.pitch);
      const dx = Math.sin(this.yaw) * cp * back, dy = -Math.sin(this.pitch) * back, dz = Math.cos(this.yaw) * cp * back;
      let dist = 4; const hit = game.world.raycast(cam.x, cam.y, cam.z, dx, dy, dz, dist + 0.4);
      if (hit && SOLID[hit.id]) dist = Math.max(0.2, hit.t - 0.4);
      cam.x += dx * dist; cam.y += dy * dist; cam.z += dz * dist;
      if (back < 0) { cam.yaw = this.yaw + Math.PI; cam.pitch = -this.pitch; }
    }
    return cam;
  }
  drawHand(world) {
    if (this.dead) return;
    const it = this.held();
    lightRGB(world.getLightRaw(Math.floor(this.x), Math.floor(this.eyeY()), Math.floor(this.z)), _lcE);
    const r = _lcE[0], g = _lcE[1], b = _lcE[2];
    const p = 1 - this.swingT, s1 = Math.sin(Math.sqrt(p) * Math.PI), s2 = Math.sin(p * Math.PI);
    const ba = settings.bobbing ? this.bobAmp : 0;
    const bx = Math.sin(this.bob * 1.9) * 0.018 * ba, by = -Math.abs(Math.cos(this.bob * 1.9)) * 0.02 * ba - this.equipT * 0.45;
    const eat = this.eating > 0 ? Math.min(1, this.eating * 5) : 0, ew = eat ? Math.sin(this.eating * 26) * 0.02 : 0;
    const asp = R.w / R.h, hx = 0.7 * asp, sc = clamp(asp / 1.4, 0.55, 1);
    if (!it) {
      m4Translate(_mm, hx * 0.62 - s1 * 0.3 * sc + bx, -0.78 + s2 * 0.2 + by, -0.7 - s2 * 0.25);
      m4RotX(_mr, -1.05 - s2 * 0.9); m4Mul(_mm, _mm, _mr); m4RotZ(_mr, 0.22 + s1 * 0.3); m4Mul(_mm, _mm, _mr); m4Scale(_mr, sc, sc, sc); m4Mul(_mm, _mm, _mr);
      addColorBox(handCol, _mm, -0.075, 0.3, -0.075, 0.075, 0.62, 0.075, 0.93 * r, 0.74 * g, 0.58 * b, 1);
      addColorBox(handCol, _mm, -0.085, -0.2, -0.085, 0.085, 0.3, 0.085, 0.82 * r, 0.38 * g, 0.2 * b, 1);
      return;
    }
    const isCube = it.id < 256 && !ICON[it.id];
    if (isCube) {
      m4Translate(_mm, hx * 0.56 - s1 * 0.34 * sc + bx - eat * hx * 0.45, -0.5 + s2 * 0.12 + by + ew, -1.0 - s2 * 0.2);
      m4RotX(_mr, 0.12 - s2 * 0.8); m4Mul(_mm, _mm, _mr); m4RotY(_mr, 0.78 + s1 * 0.5); m4Mul(_mm, _mm, _mr); m4Scale(_mr, 0.34 * sc, 0.34 * sc, 0.34 * sc); m4Mul(_mm, _mm, _mr);
      addBlockCube(handTex, _mm, it.id, r, g, b, 1);
    } else {
      m4Translate(_mm, hx * 0.56 - s1 * 0.36 * sc + bx - eat * hx * 0.5, -0.4 + s2 * 0.1 + by + ew - eat * 0.05, -1.0 - s2 * 0.22);
      m4RotY(_mr, Math.PI + 0.62 + s1 * 0.7); m4Mul(_mm, _mm, _mr); m4RotX(_mr, s2 * 1.0); m4Mul(_mm, _mm, _mr); m4RotZ(_mr, -0.12 + s2 * 0.5); m4Mul(_mm, _mm, _mr);
      m4Scale(_mr, 0.46 * sc, 0.46 * sc, 0.46 * sc); m4Mul(_mm, _mm, _mr);
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
