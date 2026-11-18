// ===== 10b_map.js : 地図（最初から持っている。歩いた所が描かれていく） =====
// ・絵は 地形づくりの式（gen.column）から描く。だから保存するのは「歩いた所」の印だけで軽い。建てた物は地図に出ない（そのかわり「しるし」を置ける）
// ・1枚の絵＝256×256ブロック（1ドット＝1ブロック）。見えている所だけ 少しずつ描く
// ・小さな地図（画面のすみ）と 大きな地図（M キー、または小さな地図をタップ）
const MAP_COL = [[58, 104, 206], [226, 214, 160], [124, 190, 84], [66, 146, 64], [232, 204, 118], [236, 242, 248], [54, 108, 86], [134, 134, 138], [240, 164, 198], [176, 208, 104], [72, 124, 224],
  [150, 196, 110], [30, 92, 46], [44, 176, 40], [178, 166, 86], [88, 116, 74], [196, 104, 54], [176, 214, 248], [158, 186, 176], [98, 88, 56], [140, 214, 150], [250, 252, 255], [40, 76, 170], [190, 215, 240], [170, 116, 190]];
const MAP_WOODS = new Uint8Array(32);   // 木の多いバイオーム（つぶつぶを足す）
for (const b of [BIOME.FOREST, BIOME.TAIGA, BIOME.CHERRY, BIOME.BIRCH, BIOME.DARK, BIOME.JUNGLE, BIOME.SNOW_TAIGA, BIOME.OLD_TAIGA, BIOME.SWAMP]) MAP_WOODS[b] = 1;
const MAP_SNOWY = new Uint8Array(32);   // もともと白いバイオーム
for (const b of [BIOME.SNOW, BIOME.ICE, BIOME.SNOW_PEAK, BIOME.FROZEN]) MAP_SNOWY[b] = 1;
const PIN_COL = ['#e2463a', '#f08a2e', '#f2cf3a', '#4fb34a', '#3f7fe0', '#a060e0'];
const MAP_ZOOMS = [0.5, 1, 2, 4, 8];

const map = {
  seen: new Map(),      // 区画（32×32チャンク）ごとの「歩いた所」。1チャンク1ビット
  ver: 0,               // 歩いた所が増えるたびに進む
  tiles: new Map(), none: new Map(), queue: [], queued: new Set(), sortAt: 0, frame: 0, img: null,
  pins: [],             // しるし {id, x, z, n なまえ, c 色, by 置いた人}
  open: false, cx: 0, cz: 0, zi: 2, sel: null, ptr: new Map(), moved: 0, pinch: 0, pinCol: 0, dpr: 1, mctx: null, fctx: null, dirty: true,

  reset() { this.seen.clear(); this.tiles.clear(); this.none.clear(); this.queue.length = 0; this.queued.clear(); this.pins = []; this.ver++; this.sel = null; this.dirty = true; },
  // ---------- 歩いた所 ----------
  has(cx, cz) { const b = this.seen.get((cx >> 5) + ',' + (cz >> 5)); if (!b) return false; const i = ((cz & 31) << 5) | (cx & 31); return ((b[i >> 3] >> (i & 7)) & 1) === 1; },
  add(cx, cz) {
    const k = (cx >> 5) + ',' + (cz >> 5); let b = this.seen.get(k);
    if (!b) { b = new Uint8Array(128); this.seen.set(k, b); }
    const i = ((cz & 31) << 5) | (cx & 31);
    if ((b[i >> 3] >> (i & 7)) & 1) return false;
    b[i >> 3] |= 1 << (i & 7); this.ver++; return true;
  },
  pack() { const o = {}; for (const [k, b] of this.seen) { let s = ''; for (let i = 0; i < 128; i++) s += String.fromCharCode(b[i]); o[k] = btoa(s); } return o; },
  unpack(o) {
    this.seen.clear();
    if (o && typeof o === 'object') for (const k in o) {
      try { const s = atob(o[k]); if (s.length !== 128 || !/^-?\d+,-?\d+$/.test(k)) continue; const b = new Uint8Array(128); for (let i = 0; i < 128; i++) b[i] = s.charCodeAt(i); this.seen.set(k, b); } catch (e) { }
    }
    this.ver++;
  },
  // 世界に入るとき・出るとき
  load(o) {
    this.reset();
    if (!o) return;
    this.unpack(o.seen);
    if (Array.isArray(o.pins)) for (const p of o.pins) this.pinIn(p && p.id, p);
  },
  save(withPins) { const o = { seen: this.pack() }; if (withPins) o.pins = this.pins.map(p => ({ id: p.id, x: p.x, z: p.z, n: p.n, c: p.c, by: p.by })); return o; },
  // まわりの 読みこまれたチャンクを「歩いた所」にする
  mark() {
    const w = game.world; if (!w || game.isDemo) return;
    const pcx = Math.floor(player.x) >> 4, pcz = Math.floor(player.z) >> 4;
    for (let dz = -6; dz <= 6; dz++) for (let dx = -6; dx <= 6; dx++) {
      if (dx * dx + dz * dz > 38) continue;
      const cx = pcx + dx, cz = pcz + dz;
      if (this.has(cx, cz)) continue;
      const c = w.getChunk(cx, cz);
      if (c && c.stage >= 2 && this.add(cx, cz)) { this.enqueue(cx, cz); this.dirty = true; }
    }
  },
  // ---------- 絵 ----------
  enqueue(cx, cz) { const k = cx + ',' + cz; if (this.queued.has(k)) return; this.queued.add(k); this.queue.push([cx, cz]); this.sortAt = 0; },
  // 見えている1枚を用意する。歩いた所が1つもなければ null
  need(tx, tz) {
    const k = tx + ',' + tz; let t = this.tiles.get(k);
    if (!t) {
      if (this.none.get(k) === this.ver) return null;
      let any = false;
      for (let j = 0; j < 16 && !any; j++) for (let i = 0; i < 16; i++) if (this.has(tx * 16 + i, tz * 16 + j)) { any = true; break; }
      if (!any) { this.none.set(k, this.ver); return null; }
      const cv = document.createElement('canvas'); cv.width = cv.height = 256;
      t = { tx, tz, cv, ctx: cv.getContext('2d'), done: new Uint8Array(32), ver: -1, used: 0 }; this.tiles.set(k, t);
    }
    t.used = this.frame;
    if (t.ver !== this.ver) {   // まだ描いていない所を 描く列に入れる
      t.ver = this.ver;
      for (let j = 0; j < 16; j++) for (let i = 0; i < 16; i++) { const n = j * 16 + i; if (!((t.done[n >> 3] >> (n & 7)) & 1) && this.has(tx * 16 + i, tz * 16 + j)) this.enqueue(tx * 16 + i, tz * 16 + j); }
    }
    return t;
  },
  // 1チャンクぶんを描く
  paint(cx, cz) {
    const t = this.tiles.get((cx >> 4) + ',' + (cz >> 4)); if (!t) return;
    const w = game.world, gv = w.genVer(cx, cz);
    if (!gv) { t.ver = -1; return; }   // 地形の版がまだ分からない（オンラインで問い合わせ中）。あとでやり直す
    const g = w.genOf(gv), img = this.img || (this.img = new ImageData(16, 16)), d = img.data, x0 = cx * 16, z0 = cz * 16;
    for (let z = 0; z < 16; z++) {
      let ph = g.column(x0 - 1, z0 + z);
      for (let x = 0; x < 16; x++) {
        const h = g.column(x0 + x, z0 + z), b = g.colB, cold = g.colCold, o = (z * 16 + x) * 4;
        let r, gg, bl;
        if (h < SEA) {
          if (cold) { r = 186; gg = 212; bl = 238; }                       // 氷
          else {
            const f = 1 - Math.min(0.42, (SEA - h) * 0.022);                // 深いほど暗く
            if (b === BIOME.SWAMP) { r = 66 * f; gg = 104 * f; bl = 122 * f; } else { r = 58 * f; gg = 104 * f; bl = 206 * f; }
          }
        } else {
          const c = MAP_COL[b] || MAP_COL[2];
          let f = 0.86 + Math.min(0.22, (h - SEA) / 190) + clamp((h - ph) * 0.05, -0.16, 0.16);   // 高さと かたむきで 明るさを変える
          if (MAP_WOODS[b] && (hash2(x0 + x, z0 + z, 7) & 3) === 0) f *= 0.8;
          r = c[0]; gg = c[1]; bl = c[2];
          if (cold && !MAP_SNOWY[b]) { r = r * 0.3 + 165; gg = gg * 0.3 + 169; bl = bl * 0.3 + 174; }   // 雪をかぶっている
          r *= f; gg *= f; bl *= f;
        }
        d[o] = r > 255 ? 255 : r; d[o + 1] = gg > 255 ? 255 : gg; d[o + 2] = bl > 255 ? 255 : bl; d[o + 3] = 255;
        ph = h;
      }
    }
    t.ctx.putImageData(img, (cx & 15) * 16, (cz & 15) * 16);
    const n = (cz & 15) * 16 + (cx & 15); t.done[n >> 3] |= 1 << (n & 7);
    this.dirty = true;
  },
  // 毎フレーム：少しずつ描く（ms＝使ってよい時間）
  work(ms) {
    this.frame++;
    if (this.frame % 240 === 0 && this.tiles.size > 64) { for (const [k, t] of this.tiles) if (t.used < this.frame - 600) this.tiles.delete(k); }   // 長く見ていない絵は捨てる
    if (!this.queue.length) return;
    const t0 = performance.now();
    if (this.frame >= this.sortAt) {   // 見ている場所に近い順に
      const fx = (this.open ? this.cx : player.x) / 16, fz = (this.open ? this.cz : player.z) / 16;
      this.queue.sort((a, b) => ((b[0] - fx) * (b[0] - fx) + (b[1] - fz) * (b[1] - fz)) - ((a[0] - fx) * (a[0] - fx) + (a[1] - fz) * (a[1] - fz)));
      this.sortAt = this.frame + 45;
    }
    do { const q = this.queue.pop(); this.queued.delete(q[0] + ',' + q[1]); this.paint(q[0], q[1]); } while (this.queue.length && performance.now() - t0 < ms);
  },
  // ---------- しるし ----------
  pinIn(id, v) {   // 外から来たデータは 形を確かめてから使う
    if (typeof id !== 'string' || !/^[a-z0-9]{1,20}$/.test(id) || !v || typeof v !== 'object') return;
    const x = Math.round(+v.x), z = Math.round(+v.z);
    if (!isFinite(x) || !isFinite(z) || Math.abs(x) > 3e7 || Math.abs(z) > 3e7) return;
    const p = { id, x, z, n: String(v.n == null ? '' : v.n).slice(0, 10), c: clamp(Math.floor(+v.c) || 0, 0, PIN_COL.length - 1), by: String(v.by == null ? '' : v.by).slice(0, 10) };
    const i = this.pins.findIndex(q => q.id === id);
    if (i >= 0) this.pins[i] = p; else if (this.pins.length < 60) this.pins.push(p);
    this.dirty = true;
  },
  pinOut(id) { const i = this.pins.findIndex(q => q.id === id); if (i >= 0) { this.pins.splice(i, 1); this.dirty = true; if (this.sel && this.sel.pin && this.sel.pin.id === id) { this.sel = null; this.panel(); } } },
  pinAdd(x, z, n, c) {
    if (this.pins.length >= 40) { ui.toast('しるしは40こまでです。いらないものを消してください'); return; }
    const id = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
    const v = { x: Math.round(x), z: Math.round(z), n: String(n || '').trim().slice(0, 10), c, by: game.online ? net.getName() : '' };
    this.pinIn(id, v);
    if (game.online) net.pinSet(id, v); else game.save();
    sfx('place_wood');
  },
  pinDel(id) { this.pinOut(id); if (game.online) net.pinDel(id); else game.save(); sfx('pop', 0.6); },
  // ---------- 目印を描く ----------
  // x0,z0＝左上の世界座標、sc＝1ブロックのドット数、u＝絵の細かさ（文字や印の大きさの倍率）
  marks(ctx, x0, z0, sc, W, H, mini, u) {
    const P = (wx, wz, edge) => {
      let x = (wx - x0) * sc, y = (wz - z0) * sc, out = false;
      if (edge) { const m = 6 * u; if (x < m) { x = m; out = true; } else if (x > W - m) { x = W - m; out = true; } if (y < m) { y = m; out = true; } else if (y > H - m) { y = H - m; out = true; } }
      return [Math.round(x), Math.round(y), out];
    };
    const inside = (p) => p[0] > -20 * u && p[1] > -20 * u && p[0] < W + 20 * u && p[1] < H + 20 * u;
    const label = (text, x, y) => {
      if (mini || !text) return;
      ctx.font = Math.round(13 * u) + 'px DotGothic16, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'top';
      ctx.lineWidth = 3 * u; ctx.strokeStyle = 'rgba(0,0,0,.85)'; ctx.strokeText(text, x, y + 9 * u); ctx.fillStyle = '#fff'; ctx.fillText(text, x, y + 9 * u);
    };
    const box = (x, y, w, h, c) => { ctx.fillStyle = c; ctx.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h)); };
    const s = mini ? 1 : u * 1.5;
    // しるし（旗）。さおの根もとが その場所
    for (const p of this.pins) {
      const q = P(p.x + 0.5, p.z + 0.5, false); if (!inside(q)) continue;
      box(q[0] - 1 * s, q[1] - 9 * s, 2 * s, 10 * s, '#000'); box(q[0] + 1 * s, q[1] - 10 * s, 8 * s, 7 * s, '#000');
      box(q[0] + 1 * s, q[1] - 9 * s, 6 * s, 5 * s, PIN_COL[p.c]); box(q[0], q[1] - 8 * s, 1 * s, 8 * s, '#e8e0d0');
      if (this.sel && this.sel.pin === p) { ctx.strokeStyle = '#fff'; ctx.lineWidth = 2 * u; ctx.strokeRect(q[0] - 7 * u, q[1] - 19 * u, 26 * u, 24 * u); }
      label(p.n, q[0] + 3 * u, q[1]);
    }
    // 最初の地点（家の形）
    const ws = game.worldSpawn;
    if (ws) { const q = P(ws.x, ws.z, mini); box(q[0] - 5 * s, q[1] - 1 * s, 10 * s, 6 * s, '#000'); box(q[0] - 4 * s, q[1], 8 * s, 4 * s, '#ffe08a'); box(q[0] - 3 * s, q[1] - 3 * s, 6 * s, 3 * s, '#000'); box(q[0] - 2 * s, q[1] - 2 * s, 4 * s, 2 * s, '#d6453a'); box(q[0] - 1 * s, q[1] + 1 * s, 2 * s, 3 * s, '#5b3d18'); label('はじまりの場所', q[0], q[1]); }
    // ベッド（次に目をさます場所）
    const bs = player.spawn;
    if (bs) { const q = P(bs.x, bs.z, mini); box(q[0] - 5 * s, q[1] - 3 * s, 10 * s, 6 * s, '#000'); box(q[0] - 4 * s, q[1] - 2 * s, 8 * s, 4 * s, '#c9413a'); box(q[0] - 4 * s, q[1] - 2 * s, 3 * s, 4 * s, '#f2f2f0'); label('ベッド', q[0], q[1]); }
    // 力つきた場所
    const dp = player.deathPos;
    if (dp) { const q = P(dp.x + 0.5, dp.z + 0.5, mini); ctx.lineWidth = 4 * s; ctx.strokeStyle = '#000'; ctx.beginPath(); ctx.moveTo(q[0] - 4 * s, q[1] - 4 * s); ctx.lineTo(q[0] + 4 * s, q[1] + 4 * s); ctx.moveTo(q[0] + 4 * s, q[1] - 4 * s); ctx.lineTo(q[0] - 4 * s, q[1] + 4 * s); ctx.stroke(); ctx.lineWidth = 2 * s; ctx.strokeStyle = '#ff6a5a'; ctx.stroke(); label('力つきた場所', q[0], q[1]); }
    // 友だち
    if (net.on) for (const p of net.peers.values()) {
      if (!net.here(p) || p.y < -900) continue;
      const q = P(p.x, p.z, true);
      box(q[0] - 4 * s, q[1] - 4 * s, 8 * s, 8 * s, '#000'); box(q[0] - 3 * s, q[1] - 3 * s, 6 * s, 6 * s, LOOK_SHIRT[p.look[3]] || '#fff'); box(q[0] - 1 * s, q[1] - 1 * s, 2 * s, 2 * s, '#fff');
      label(p.name, q[0], q[1]);
    }
    // 自分（向いているほうを指す矢印）
    const me = P(player.x, player.z, !mini);
    ctx.save(); ctx.translate(me[0], me[1]); ctx.rotate(-player.yaw);
    const a = (mini ? 1 : u) * 1.15;
    ctx.beginPath(); ctx.moveTo(0, -7 * a); ctx.lineTo(5.5 * a, 6 * a); ctx.lineTo(0, 3 * a); ctx.lineTo(-5.5 * a, 6 * a); ctx.closePath();
    ctx.lineWidth = 3 * a; ctx.strokeStyle = '#000'; ctx.lineJoin = 'miter'; ctx.stroke(); ctx.fillStyle = '#fff'; ctx.fill();
    ctx.restore();
  },
  // ---------- 小さな地図 ----------
  drawMini() {
    const cv = $('mini'), on = !!settings.minimap && !game.isDemo && (game.state === 'playing' || game.state === 'paused') && !this.open;
    if (cv.hidden === on) cv.hidden = !on;
    if (!on) return;
    const ctx = this.mctx || (this.mctx = cv.getContext('2d')), S = cv.width, x0 = Math.floor(player.x) - S / 2, z0 = Math.floor(player.z) - S / 2;
    ctx.fillStyle = '#16130f'; ctx.fillRect(0, 0, S, S);
    for (let tz = z0 >> 8; tz <= (z0 + S - 1) >> 8; tz++) for (let tx = x0 >> 8; tx <= (x0 + S - 1) >> 8; tx++) { const t = this.need(tx, tz); if (t) ctx.drawImage(t.cv, tx * 256 - x0, tz * 256 - z0); }
    this.marks(ctx, x0, z0, 1, S, S, true, 1);
    box4(ctx, S);
  },
  // ---------- 大きな地図 ----------
  toggle() { if (this.open) this.closeMap(); else this.openMap(); },
  openMap() {
    if (this.open || game.isDemo || player.dead || (game.state !== 'playing' && game.state !== 'paused')) return;
    if (game.state === 'paused') game.resume(true);
    if (ui.screen) ui.close(true);
    if (document.pointerLockElement) { ui.expectUnlock = true; document.exitPointerLock(); }
    ui.screen = 'map'; this.open = true; this.cx = player.x; this.cz = player.z; this.sel = null; this.ptr.clear(); this.dirty = true;
    $('mapScr').classList.add('on'); $('app').classList.add('uiopen');
    this.resize(); this.panel(); sfx('click');
    $('mapHint').textContent = touchSt.touchUsed ? 'なぞって動かす ／ 2本指で大きさを変える ／ タップで しるしを置く' : 'ドラッグで動かす ／ ホイールで大きさを変える ／ クリックで しるしを置く ／ ' + keyName(settings.keys.map) + ' か Esc でとじる';
  },
  closeMap(silent) {
    if (!this.open) return;
    this.open = false; ui.screen = null; this.sel = null;
    $('mapScr').classList.remove('on'); $('app').classList.remove('uiopen');
    if (document.activeElement && document.activeElement.blur) document.activeElement.blur();
    if (!silent && game.state === 'playing') requestLock(true);
  },
  resize() {
    const cv = $('mapCv'); this.dpr = Math.min(2, window.devicePixelRatio || 1);
    const w = Math.max(1, Math.round(cv.clientWidth * this.dpr)), h = Math.max(1, Math.round(cv.clientHeight * this.dpr));
    if (cv.width !== w || cv.height !== h) { cv.width = w; cv.height = h; }
    this.fctx = cv.getContext('2d'); this.dirty = true;
  },
  zoomBy(dir, px, py) {   // px,py＝そこを動かさずに 大きさを変える（画面のドット）
    const cv = $('mapCv'), z0 = MAP_ZOOMS[this.zi], zi = clamp(this.zi + dir, 0, MAP_ZOOMS.length - 1);
    if (zi === this.zi) return;
    const z1 = MAP_ZOOMS[zi], ox = (px === undefined ? cv.clientWidth / 2 : px) - cv.clientWidth / 2, oy = (py === undefined ? cv.clientHeight / 2 : py) - cv.clientHeight / 2;
    this.cx += ox / z0 - ox / z1; this.cz += oy / z0 - oy / z1; this.zi = zi; this.dirty = true;
  },
  drawFull() {
    if (!this.open) return;
    const cv = $('mapCv');
    if (Math.round(cv.clientWidth * this.dpr) !== cv.width || Math.round(cv.clientHeight * this.dpr) !== cv.height) this.resize();
    $('mapPos').textContent = 'いまの場所  X ' + Math.floor(player.x) + '  Z ' + Math.floor(player.z);
    const ctx = this.fctx, W = cv.width, H = cv.height, z = MAP_ZOOMS[this.zi] * this.dpr, u = this.dpr;
    ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.imageSmoothingEnabled = false;
    ctx.fillStyle = '#1a1612'; ctx.fillRect(0, 0, W, H);
    const x0 = this.cx - W / 2 / z, z0 = this.cz - H / 2 / z;
    for (let tz = Math.floor(z0 / 256); tz <= Math.floor((z0 + H / z) / 256); tz++) for (let tx = Math.floor(x0 / 256); tx <= Math.floor((x0 + W / z) / 256); tx++) {
      const t = this.need(tx, tz); if (!t) continue;
      const dx = Math.round((tx * 256 - x0) * z), dy = Math.round((tz * 256 - z0) * z);
      ctx.drawImage(t.cv, dx, dy, Math.round(((tx + 1) * 256 - x0) * z) - dx, Math.round(((tz + 1) * 256 - z0) * z) - dy);
    }
    if (this.sel && !this.sel.pin) {   // えらんだ場所
      const sx = Math.round((this.sel.x + 0.5 - x0) * z), sy = Math.round((this.sel.z + 0.5 - z0) * z), k = 7 * u;
      ctx.lineWidth = 4 * u; ctx.strokeStyle = '#000'; ctx.strokeRect(sx - k, sy - k, k * 2, k * 2); ctx.lineWidth = 2 * u; ctx.strokeStyle = '#ffe08a'; ctx.strokeRect(sx - k, sy - k, k * 2, k * 2);
    }
    this.marks(ctx, x0, z0, z, W, H, false, u);
    // ものさし（100マス）と 方角
    const bar = 100 * z, bx = 14 * u, by = H - 16 * u;
    ctx.fillStyle = '#000'; ctx.fillRect(bx - 2 * u, by - 2 * u, bar + 4 * u, 8 * u); ctx.fillStyle = '#fff'; ctx.fillRect(bx, by, bar, 4 * u);
    ctx.font = Math.round(13 * u) + 'px DotGothic16, sans-serif'; ctx.textAlign = 'left'; ctx.textBaseline = 'bottom'; ctx.lineWidth = 3 * u; ctx.strokeStyle = 'rgba(0,0,0,.85)';
    ctx.strokeText('100マス', bx, by - 4 * u); ctx.fillStyle = '#fff'; ctx.fillText('100マス', bx, by - 4 * u);
    ctx.textAlign = 'right'; ctx.strokeText('上が北', W - 14 * u, by + 6 * u); ctx.fillText('上が北', W - 14 * u, by + 6 * u);
  },
  // 下のパネル（えらんだ場所・しるし）
  panel() {
    const el = $('mapPanel'), s = this.sel;
    el.hidden = !s; $('mapHint').hidden = !!s; if (!s) return;
    const pin = s.pin;
    $('mapPinEdit').hidden = !!pin; $('mapPinAdd').hidden = !!pin; $('mapPinDel').hidden = !pin;
    if (pin) $('mapSelText').textContent = 'しるし「' + (pin.n || 'なまえなし') + '」  X ' + pin.x + '  Z ' + pin.z + (pin.by ? '  （' + pin.by + ' が置いた）' : '');
    else {
      let where = 'まだ行っていない場所';
      if (this.has(s.x >> 4, s.z >> 4)) { const w = game.world, gv = w.genVer(s.x >> 4, s.z >> 4); if (gv) { const g = w.genOf(gv); g.column(s.x, s.z); where = BIOME_NAMES[g.colB]; } }
      $('mapSelText').textContent = 'X ' + s.x + '  Z ' + s.z + '  （' + where + '）';
      for (const b of $('mapPinCols').children) b.classList.toggle('on', +b.dataset.c === this.pinCol);
    }
  },
  pick(px, py) {   // 画面の場所をえらぶ（クリック・タップ）
    const cv = $('mapCv'), z = MAP_ZOOMS[this.zi], wx = this.cx + (px - cv.clientWidth / 2) / z, wz = this.cz + (py - cv.clientHeight / 2) / z;
    let best = null, bd = 16 * 16;
    for (const p of this.pins) { const dx = (p.x + 0.5 - wx) * z + 3, dy = (p.z + 0.5 - wz) * z - 4, d2 = dx * dx + dy * dy; if (d2 < bd) { bd = d2; best = p; } }
    this.sel = best ? { x: best.x, z: best.z, pin: best } : { x: Math.floor(wx), z: Math.floor(wz), pin: null };
    if (!best) $('mapPinName').value = '';
    this.panel(); this.dirty = true; sfx('click', 0.5);
  },
  bind() {
    const cv = $('mapCv'), pos = (e) => { const r = cv.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; };
    PIN_COL.forEach((c, i) => { const b = document.createElement('button'); b.type = 'button'; b.className = 'btn sw'; b.style.background = c; b.dataset.c = i; b.setAttribute('aria-label', '色' + (i + 1)); b.onclick = () => { this.pinCol = i; this.panel(); }; $('mapPinCols').appendChild(b); });
    cv.addEventListener('pointerdown', (e) => { e.preventDefault(); try { cv.setPointerCapture(e.pointerId); } catch (er) { } const p = pos(e); this.ptr.set(e.pointerId, { x: p[0], y: p[1], x0: p[0], y0: p[1] }); if (this.ptr.size === 1) this.moved = 0; else { this.moved = 99; this.pinch = 0; } });
    cv.addEventListener('pointermove', (e) => {
      const q = this.ptr.get(e.pointerId); if (!q) return;
      const p = pos(e), z = MAP_ZOOMS[this.zi];
      if (this.ptr.size === 1) { this.cx -= (p[0] - q.x) / z; this.cz -= (p[1] - q.y) / z; this.moved += Math.abs(p[0] - q.x) + Math.abs(p[1] - q.y); this.dirty = true; }
      q.x = p[0]; q.y = p[1];
      if (this.ptr.size === 2) {   // 2本指：開く・とじるで 大きさを変える
        const a = [...this.ptr.values()], d = Math.hypot(a[0].x - a[1].x, a[0].y - a[1].y);
        if (!this.pinch) this.pinch = d;
        else if (d > this.pinch * 1.35) { this.zoomBy(1, (a[0].x + a[1].x) / 2, (a[0].y + a[1].y) / 2); this.pinch = d; }
        else if (d < this.pinch / 1.35) { this.zoomBy(-1, (a[0].x + a[1].x) / 2, (a[0].y + a[1].y) / 2); this.pinch = d; }
      }
    });
    const up = (e) => { const q = this.ptr.get(e.pointerId); if (!q) return; this.ptr.delete(e.pointerId); if (e.type === 'pointerup' && this.ptr.size === 0 && this.moved < 8) this.pick(q.x, q.y); };
    cv.addEventListener('pointerup', up); cv.addEventListener('pointercancel', up);
    cv.addEventListener('wheel', (e) => { e.preventDefault(); const p = pos(e); this.zoomBy(e.deltaY < 0 ? 1 : -1, p[0], p[1]); }, { passive: false });
    $('mapIn').onclick = () => this.zoomBy(1); $('mapOut').onclick = () => this.zoomBy(-1);
    $('mapMe').onclick = () => { this.cx = player.x; this.cz = player.z; this.dirty = true; };
    $('mapClose').onclick = () => this.closeMap();
    $('mapPinAdd').onclick = () => { const s = this.sel; if (!s || s.pin) return; this.pinAdd(s.x, s.z, $('mapPinName').value, this.pinCol); this.sel = null; this.panel(); };
    $('mapPinDel').onclick = () => { const s = this.sel; if (s && s.pin) this.pinDel(s.pin.id); this.sel = null; this.panel(); };
    $('mapPinCancel').onclick = () => { this.sel = null; this.panel(); this.dirty = true; };
    $('mapPinName').addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); $('mapPinAdd').click(); } else if (e.key === 'Escape') { e.preventDefault(); $('mapPinCancel').click(); } });
    $('mini').addEventListener('pointerdown', (e) => { e.preventDefault(); e.stopPropagation(); this.openMap(); });
    window.addEventListener('resize', () => { if (this.open) this.resize(); });
    window.addEventListener('keydown', (e) => {
      if (!this.open || (e.target && e.target.tagName === 'INPUT')) return;
      if (e.key === '+' || e.key === ';' || e.code === 'NumpadAdd') this.zoomBy(1); else if (e.key === '-' || e.code === 'NumpadSubtract') this.zoomBy(-1);
    });
  }
};
// 小さな地図のふち
function box4(ctx, S) { ctx.fillStyle = 'rgba(0,0,0,.55)'; ctx.fillRect(0, 0, S, 1); ctx.fillRect(0, S - 1, S, 1); ctx.fillRect(0, 0, 1, S); ctx.fillRect(S - 1, 0, 1, S); }
