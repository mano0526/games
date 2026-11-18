// ===== 11b_net.js : みんなで遊ぶ。世界の「変えたところ」を中継サーバー（Firebase）に置き、全員が同じ世界を見る =====
// 置き場所: np/block/w/{コード}/  （くわしい形は NOTES.md）
//   meta  世界の設定      time 時刻      gv/区画 地形の版
//   c/区画/マス 変えたブロック   e/区画/マス 入れ物の中身   a/区画/… しまってある動物
//   pl/人 参加者   st/人 位置と、その人が動かしている生き物   dm/人 個別の連絡
const NET_VER = 5, NET_MAX = 4;   // 5: 火のついた はじけ箱の記録（種類4）と はじけの連絡 ／ 4: 動物の記録に「その動物だけの状態」が入った   // 2: ブロックの番号が256以上になった ／ 3: べつの世界（ホムラの底・ソラのはて）と門（2026-11-18）
const NET_CFG = { apiKey: 'AIzaSyBTuzvBh9qtf5F8JnHVa5bv1-igP3E_ebA', authDomain: 'claude-4d377.firebaseapp.com', databaseURL: 'https://claude-4d377-default-rtdb.asia-southeast1.firebasedatabase.app', projectId: 'claude-4d377', storageBucket: 'claude-4d377.firebasestorage.app', messagingSenderId: '652412386711', appId: '1:652412386711:web:a6033541ef4fa62da998d2' };
const NET_URL = 'https://mano0526.github.io/games/block.html';
function withTimeout(p, ms) {
  return new Promise((res, rej) => {
    const t = setTimeout(() => rej(new Error('中継サーバーから返事がありません。通信を確かめて、もう一度ためしてください')), ms);
    p.then((v) => { clearTimeout(t); res(v); }, (e) => { clearTimeout(t); rej(e); });
  });
}
function r2(v) { return Math.round(v * 100) / 100; }
function stackStr(s) { return s ? (s.d ? s.id + ',' + s.n + ',' + s.d : s.id + ',' + s.n) : null; }
function parseStack(v) { if (typeof v !== 'string') return null; const a = v.split(','), id = +a[0], n = +a[1]; if (!ITEMS[id] || !(n > 0)) return null; return { id, n, d: +a[2] || 0 }; }
// 入れ物の中身 ⇔ 中継サーバーに置く形（欄ごとに分けて、同時に触っても ほかの欄を消さないようにする）
function entToNet(e) {
  if (e.t === 'chest') { const i = {}; for (let k = 0; k < 27; k++) if (e.items[k]) i[k] = stackStr(e.items[k]); const o = { t: 'c', i }; if (e.g) o.g = 1; return o; }
  if (e.t === 'sign') return { t: 's', s: String(e.s || '').slice(0, 40) };
  const o = { t: 'f', b: e.burn | 0, bm: e.burnMax | 0, k: e.cook | 0 };
  if (e.in) o.in = stackStr(e.in); if (e.fuel) o.fuel = stackStr(e.fuel); if (e.out) o.out = stackStr(e.out);
  return o;
}
function entFromNet(v) {
  if (!v || typeof v !== 'object') return null;
  if (v.t === 'c') {
    const items = new Array(27).fill(null), src = v.i;
    if (src && typeof src === 'object') for (const k in src) { const s = parseStack(src[k]); if (s && +k >= 0 && +k < 27) items[+k] = s; }
    const e = { t: 'chest', items }; if (v.g) e.g = 1; return e;
  }
  if (v.t === 's') return { t: 'sign', s: String(v.s == null ? '' : v.s).slice(0, 40) };
  if (v.t === 'f') return { t: 'furnace', in: parseStack(v.in), fuel: parseStack(v.fuel), out: parseStack(v.out), burn: v.b | 0, burnMax: v.bm | 0, cook: v.k | 0 };
  return null;
}
// 正本（sh）と手元（nv）のちがいを「欄と値」の組にする。全部書きかえるときは [['', nv]]。own でなければ かまどの進み具合は送らない
function entDiff(sh, nv, own) {
  if (!sh || sh.t !== nv.t) return [['', nv]];
  const out = [];
  if (nv.t === 'c') {
    const a = sh.i || {};
    for (let k = 0; k < 27; k++) { const v = nv.i[k] || null, o = a[k] || null; if (v !== o) out.push(['i/' + k, v]); }
    if ((nv.g || 0) !== (sh.g || 0)) out.push(['g', nv.g || null]);
  } else if (nv.t === 's') { if (nv.s !== sh.s) out.push(['s', nv.s]); }
  else for (const f of (own ? ['in', 'fuel', 'out', 'b', 'bm', 'k'] : ['in', 'fuel', 'out'])) { const v = nv[f] === undefined ? null : nv[f], o = sh[f] === undefined ? null : sh[f]; if (v !== o) out.push([f, v]); }
  return out;
}
function entPatch(o, diff) {
  for (const [f, v] of diff) {
    if (f === '') return JSON.parse(JSON.stringify(v));
    if (f.startsWith('i/')) {
      if (Array.isArray(o.i)) { const t = {}; o.i.forEach((s, k) => { if (s) t[k] = s; }); o.i = t; }
      if (!o.i || typeof o.i !== 'object') o.i = {};
      if (v === null) delete o.i[f.slice(2)]; else o.i[f.slice(2)] = v;
    } else if (v === null) delete o[f]; else o[f] = v;
  }
  return o;
}
function mkPeer(pid) {
  return { pid, name: '？', look: [0, 0, 0, 0, 0], slot: 1, x: 0, y: -999, z: 0, yaw: 0, pitch: 0, buf: [], held: 0, flags: 0, dead: false, mode: 0, sneaking: false, sleeping: false, eating: false,
    swingN: -1, swingT: 0, open: 0, dim: 0, seen: 0, walk: 0, walkAmp: 0, hw: 0.3, h: 1.8, ents: new Map(), tag: null, hurtT: 0, known: false };
}

const net = {
  avail: false, on: false, db: null, root: null, world: null, code: '', pid: '', meta: null, own: false,
  off: 0, connected: true, discAt: 0, entered: 0, failed: false,
  peers: new Map(), regions: new Map(), gvMap: new Map(), gvAsk: new Set(), gvReady: false,
  out: {}, outN: 0, dirtyEnts: new Map(), subs: [], rmQ: [], timeRec: null, flags: {},
  accFlush: 0, accSt: 0, accIdle: 0, accEnt: 0, accFull: 0, accSlow: 0, tSlow: 0, lastP: '', swingN: 0, entTick: 0, lastLobby: 0, lastTime: 0, lastAl: 0, alWas: '',

  init() {
    try {
      if (!window.firebase || !firebase.database) {   // 置き場の版では、中継サーバーの部品があとから読みこまれる
        if (window.__blockOnline && !this._waited) { this._waited = true; window.addEventListener('load', () => { this.init(); if (this.avail) game.onNetReady(); }); }
        return;
      }
      const app = firebase.apps && firebase.apps.length ? firebase.app() : firebase.initializeApp((window.NetDB && NetDB.FB_CFG) || NET_CFG);
      this.db = firebase.database(app);
      this.db.ref('.info/serverTimeOffset').on('value', (s) => { this.off = s.val() || 0; });
      this.db.ref('.info/connected').on('value', (s) => this.onConn(s.val() === true));
      this.avail = true;
    } catch (e) { console.error(e); this.avail = false; }
  },
  now() { return Date.now() + this.off; },
  stamp() { return firebase.database.ServerValue.TIMESTAMP; },
  getName() { let n = ''; try { n = (window.NetDB ? NetDB.name.get() : localStorage.getItem('gm_name')) || ''; } catch (e) { } return String(n).slice(0, 10); },
  setName(n) { n = String(n || '').trim().slice(0, 10); try { if (n) { if (window.NetDB) NetDB.name.set(n); else localStorage.setItem('gm_name', n); } } catch (e) { } return n; },
  // この端末で入ったことのある世界
  known() { try { const a = JSON.parse(localStorage.getItem('blk_worlds') || '[]'); return Array.isArray(a) ? a : []; } catch (e) { return []; } },
  remember(code, name, own) { try { let a = this.known(); const old = a.find(w => w.code === code); a = a.filter(w => w.code !== code); a.unshift({ code, name, t: Date.now(), own: own || (old && old.own) ? 1 : 0 }); localStorage.setItem('blk_worlds', JSON.stringify(a.slice(0, 30))); } catch (e) { } },
  forget(code) { try { localStorage.setItem('blk_worlds', JSON.stringify(this.known().filter(w => w.code !== code))); localStorage.removeItem('blk_pd_' + code); } catch (e) { } },
  cleanCode(c) { return String(c || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 4); },
  fail(e) {
    console.error(e);
    if (this.failed) return;
    const msg = String((e && (e.code || e.message)) || e);
    if (/permission/i.test(msg)) { this.failed = true; ui.error('中継サーバーに読み書きできませんでした。サーバーの利用ルールの期限が切れているかもしれません（Firebase の「ルール」を確かめてください）。'); }
  },

  // ---------- 世界をつくる・入る・出る ----------
  async create(info) {
    if (!this.avail) throw new Error('この画面ではオンラインが使えません');
    const A = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    for (let t = 0; t < 8; t++) {
      let code = ''; for (let i = 0; i < 4; i++) code += A[Math.floor(Math.random() * A.length)];
      const m = { v: NET_VER, id: 'o' + code, name: info.name, seed: info.seed, mode: info.mode, diff: info.diff, rules: info.rules || {}, gv0: GEN_CUR, created: this.now() };
      const ref = this.db.ref('np/block/w/' + code);
      const res = await withTimeout(ref.child('meta').transaction((cur) => cur === null ? JSON.stringify(m) : undefined), 15000);
      if (res.committed) { await ref.child('time').set({ t: 600, d: 1, at: this.stamp() }); this.remember(code, m.name, true); return code; }
    }
    throw new Error('コードを作れませんでした。もう一度ためしてください');
  },
  async join(code) {
    code = this.cleanCode(code);
    if (code.length < 4) throw new Error('コードは4文字です');
    if (!this.avail) throw new Error('この画面ではオンラインが使えません');
    const root = this.db.ref('np/block/w/' + code);
    const raw = (await withTimeout(root.child('meta').once('value'), 15000)).val();
    if (!raw) throw new Error('コード「' + code + '」の世界は見つかりませんでした');
    let meta; try { meta = JSON.parse(raw); } catch (e) { throw new Error('世界の情報を読めませんでした'); }
    if ((meta.v || 1) > NET_VER || (meta.gv0 || 1) > GEN_CUR) throw new Error('ゲームが新しくなっています。ページを読みこみ直してから入ってください');
    const ps = await withTimeout(root.child('pl').once('value'), 15000);
    if (ps.numChildren() >= NET_MAX) throw new Error('この世界は満員です（' + NET_MAX + '人まで）');
    const time = (await withTimeout(root.child('time').once('value'), 15000)).val();
    return { code, meta, time };
  },
  enter(code, meta, time) {
    this.leave(true);
    this.code = code; this.meta = meta; this.root = this.db.ref('np/block/w/' + code);
    this.pid = Date.now().toString(36).slice(-6) + Math.random().toString(36).slice(2, 6);
    this.on = true; this.leaving = false; this.failed = false; this.entered = performance.now(); this.timeRec = time || null; this.timeInit = false; this.skipped = false; this.gvReady = false; this.flags = {};
    this.lastP = ''; this.out = {}; this.outN = 0; this.rmQ = []; this.lastLobby = 0; this.lastTime = performance.now(); this.lastAl = performance.now(); this.alWas = '';
    const R = this.root;
    const sub = (ref, ev, fn) => { const cb = (s) => { try { fn(s); } catch (e) { console.error(e); } }; ref.on(ev, cb, (err) => this.fail(err)); this.subs.push(() => ref.off(ev, cb)); };
    this.announce();
    sub(R.child('pl'), 'child_added', (s) => this.onPeer(s.key, s.val()));
    sub(R.child('pl'), 'child_changed', (s) => this.onPeer(s.key, s.val()));
    sub(R.child('pl'), 'child_removed', (s) => this.onPeerGone(s.key));
    sub(R.child('st'), 'child_added', (s) => this.onState(s.key, s.val()));
    sub(R.child('st'), 'child_changed', (s) => this.onState(s.key, s.val()));
    sub(R.child('dm/' + this.pid), 'child_added', (s) => { const v = s.val(); s.ref.remove(); this.onDm(v); });
    sub(R.child('time'), 'value', (s) => { const v = s.val(); if (v) this.onTime(v); });
    sub(R.child('gv'), 'value', (s) => { const v = s.val() || {}; for (const k in v) { this.gvMap.set(k, v[k]); if (v[k] > GEN_CUR) this.old(); } this.gvReady = true; });
    sub(R.child('meta'), 'value', (s) => this.onMeta(s.val()));
    sub(R.child('fl'), 'value', (s) => { this.flags = s.val() || {}; });
    // 地図の「しるし」は みんなで同じものを見る
    game.gates = new Map();   // 門の一覧（全員共通）
    sub(R.child('gates'), 'child_added', (s) => game.gateIn(s.key, s.val()));
    sub(R.child('gates'), 'child_removed', (s) => game.gates.delete(s.key));
    sub(R.child('pins'), 'child_added', (s) => map.pinIn(s.key, s.val()));
    sub(R.child('pins'), 'child_changed', (s) => map.pinIn(s.key, s.val()));
    sub(R.child('pins'), 'child_removed', (s) => map.pinOut(s.key));
    // 自分の名札が（通信のゆらぎで）消されてしまったら、名のり直す
    sub(R.child('pl/' + this.pid), 'value', (s) => { if (s.val() === null && this.on && !this.leaving && this.connected && performance.now() - this.entered > 3000) this.announce(); });
    this.remember(code, meta.name, false);
    setTimeout(() => { if (this.on && this.code === code) this.recoverStale(); }, 6000);
  },
  old() { if (this.failed) return; this.failed = true; ui.error('ゲームが新しくなっています。ページを読みこみ直してください。'); },
  // 参加者として名のる。通信が切れたら自動で消えるようにしておく
  announce() {
    const R = this.root, me = R.child('pl/' + this.pid);
    me.onDisconnect().remove(); R.child('st/' + this.pid).onDisconnect().remove(); R.child('dm/' + this.pid).onDisconnect().remove();
    me.set({ n: this.getName() || 'ななし', l: settings.look.join(','), t: this.stamp() });
  },
  onConn(ok) {
    const was = this.connected; this.connected = ok;
    if (!ok) { if (was) this.discAt = performance.now(); return; }
    if (this.on && !was) { this.announce(); this.lastP = ''; }
  },
  leave(silent) {
    if (!this.on) return;
    this.leaving = true;
    try {
      this.flush();
      if (!silent) { this.savePlayer(); this.stashOnLeave(); }
      const R = this.root;
      R.child('pl/' + this.pid).update({ bye: 1 });   // 「自分から出た」と伝える（通信のゆらぎと区別して、すぐ引き取ってもらうため）
      for (const k of ['pl/', 'st/', 'dm/', 'al/']) { if (k !== 'al/') R.child(k + this.pid).onDisconnect().cancel(); R.child(k + this.pid).remove(); }
      if (this.count() <= 1) this.db.ref('np/lobby/block-' + this.code).remove();
    } catch (e) { console.error(e); }
    for (const f of this.subs) { try { f(); } catch (e) { } } this.subs = [];
    for (const reg of this.regions.values()) for (const f of reg.offs) { try { f(); } catch (e) { } }
    this.regions.clear(); this.gvMap.clear(); this.gvAsk.clear();
    for (const p of this.peers.values()) this.dropPeer(p);
    this.peers.clear(); this.dirtyEnts.clear();
    this.on = false; this.root = null; this.world = null; ui.netHud();
  },
  onMeta(raw) {
    if (!raw) { if (performance.now() - this.entered > 3000 && !this.failed) { this.failed = true; ui.error('この世界は消されました。'); } return; }
    let m; try { m = JSON.parse(raw); } catch (e) { return; }
    if ((m.v || 1) > NET_VER) { this.old(); return; }   // もっと新しい版の人が入ってきた → 読みこみ直してもらう
    this.meta = m; game.applyMeta(m);
    // 自分のほうが新しければ、世界の版を上げておく（古い版のままの人が あとから入って 知らないブロックでおかしくならないように）
    if ((m.v || 1) < NET_VER && this.on && !this.failed) this.setMeta({ v: NET_VER });
  },
  setMeta(patch) { this.meta = Object.assign({}, this.meta, patch); this.root.child('meta').set(JSON.stringify(this.meta)); game.applyMeta(this.meta); },
  destroy(code) { return this.db.ref('np/block/w/' + code).remove(); },
  // 何人いるか（一覧の表示用）
  async countAt(code) { try { return (await withTimeout(this.db.ref('np/block/w/' + code + '/pl').once('value'), 8000)).numChildren(); } catch (e) { return -1; } },
  async exists(code) { try { return (await withTimeout(this.db.ref('np/block/w/' + code + '/meta').once('value'), 8000)).val() !== null; } catch (e) { return null; } },

  pinSet(id, v) { if (this.on) this.root.child('pins/' + id).set({ x: v.x, z: v.z, n: v.n, c: v.c, by: v.by }).catch((e) => this.fail(e)); },
  pinDel(id) { if (this.on) this.root.child('pins/' + id).remove().catch((e) => this.fail(e)); },
  gateSet(g) { if (this.on) this.root.child('gates/' + g.id).set({ d: g.d, x: g.x, y: g.y, z: g.z }).catch((e) => this.fail(e)); },
  gateDel(id) { if (this.on) this.root.child('gates/' + id).remove().catch((e) => this.fail(e)); },
  // ---------- 持ち物など（参加者ごと。端末に保存する） ----------
  loadPlayer(code) { try { return JSON.parse(localStorage.getItem('blk_pd_' + code) || 'null'); } catch (e) { return null; } },
  savePlayer() {
    if (!this.on || !this.world) return;
    try { localStorage.setItem('blk_pd_' + this.code, JSON.stringify({ player: player.serialize(), ach: game.ach, ended: game.ended, map: map.save(false), dim: this.world.dim, t: Date.now() })); } catch (e) { }
  },

  // ---------- 参加者 ----------
  fresh(p) { return performance.now() - p.seen < 8000; },
  // 名のっていて、いなくなった様子のない人だけを数える
  here(p) { return p.known && !p.goneAt; },
  count() { let n = 1; for (const p of this.peers.values()) if (this.here(p)) n++; return n; },
  // 同じ世界（dim）にいる人の中で、自分の番号がいちばん小さいか（ボスを出す役などを1人に決める）
  isFirstInDim() { for (const p of this.peers.values()) if (this.here(p) && this.fresh(p) && p.dim === this.world.dim && p.pid < this.pid) return false; return true; },
  isFirst(except) { for (const p of this.peers.values()) if (p.pid !== except && this.here(p) && p.pid < this.pid) return false; return true; },
  addPeer(pid) {
    const p = mkPeer(pid); this.peers.set(pid, p);
    const used = new Set(); for (const o of this.peers.values()) if (o !== p) used.add(o.slot);
    p.slot = [1, 2, 3].find(s => !used.has(s)) || 3;
    return p;
  },
  onPeer(pid, v) {
    if (pid === this.pid || !v) return;
    let p = this.peers.get(pid);
    if (!p) p = this.addPeer(pid);
    const name = String(v.n || 'ななし').slice(0, 10);
    if (!p.known) { p.known = true; if (performance.now() - this.entered > 4000) { ui.toast(name + ' が入ってきた', 4); sfx('pop', 0.6); } }
    p.goneAt = 0; p.name = name; if (v.bye) p.bye = true; p.look = parseLook(v.l); paintSkin(p.slot, p.look);
    ui.netHud();
  },
  dropPeer(p) { for (const e of p.ents.values()) if (e !== true) e.dead = true; p.ents.clear(); if (p.tag) { p.tag.remove(); p.tag = null; } },
  // 名札が消えた。通信のゆらぎかもしれないので、少し待ってから「いなくなった」と決める
  onPeerGone(pid) { const p = this.peers.get(pid); if (!p) return; if (p.bye) this.finishGone(p); else if (!p.goneAt) p.goneAt = performance.now(); },
  finishGone(p) {
    const pid = p.pid, adopt = this.isFirst(pid), got = [];   // 残った人のうち、番号がいちばん小さい人が生き物と落とし物を引き取る
    if (adopt) for (const [nid, e] of p.ents) {
      if (e === true || (e.kind !== 'mob' && e.kind !== 'item') || (e.kind === 'mob' && e.hp <= 0)) continue;
      e.remote = false; e.owner = null; e.nid = _nid++; e._ns = ''; e.vx = e.vy = e.vz = 0; got.push(nid); p.ents.set(nid, true);
      if (e.kind === 'mob' && MOBS[e.type].boss) game.boss = e;
    }
    this.dropPeer(p); this.peers.delete(pid);
    if (adopt) { this.recoverAl(pid, new Set(got)); if (got.length) this.dm(pid, { t: 'adopted', ids: got }); }   // もどってきたときに二重にならないよう、引き取った分を伝えておく
    if (p.known) ui.toast(p.name + ' が出ていった', 4);
    ui.netHud();
  },
  onState(pid, raw) {
    if (pid === this.pid || typeof raw !== 'string') return;
    let m; try { m = JSON.parse(raw); } catch (e) { return; }
    let p = this.peers.get(pid); if (!p) p = this.addPeer(pid);
    if (p.goneAt) return;   // いなくなった様子の人から おくれて届いた分は使わない
    const P = m[0], now = performance.now();
    if (P) {
      const last = p.buf[p.buf.length - 1];
      if (last && Math.hypot(P[0] - last.x, P[1] - last.y, P[2] - last.z) > 12) p.buf.length = 0;   // 遠くへ飛んだときは つなげずに切りかえる
      p.buf.push({ t: now, x: P[0], y: P[1], z: P[2], yaw: P[3], pitch: P[4] });
      if (p.buf.length > 12) p.buf.shift();
      if (p.y < -900) { p.x = P[0]; p.y = P[1]; p.z = P[2]; p.yaw = P[3]; }
      p.held = P[5] | 0; p.flags = P[6] | 0; p.sneaking = !!(p.flags & 1); p.sleeping = !!(p.flags & 2); p.dead = !!(p.flags & 4); p.mode = (p.flags & 16) ? 1 : 0; p.eating = !!(p.flags & 32); p.blocking = !!(p.flags & 64); p.shield = !!(p.flags & 128); p.sprinting = !!(p.flags & 512);
      if (p.swingN !== P[7]) { if (p.swingN >= 0) p.swingT = 1; p.swingN = P[7]; }
      p.open = P[8] || 0; p.dim = P[9] | 0; p.armorC = P[10] | 0;   // 身につけている防具（姿に出す）
    }
    p.seen = now;
    if (p.dim !== this.world.dim) { if (p.ents.size) { for (const e of p.ents.values()) if (e !== true) e.dead = true; p.ents.clear(); } return; }   // べつの世界にいる人の生き物・落とし物は見えない
    if (m[1] || m[2] || m[3]) netEnts(p, m[1] || [], m[2] || null, !!m[3]);
  },
  updPeers(dt) {
    const rt = performance.now() - 130;
    for (const p of this.peers.values()) {
      const b = p.buf; if (!b.length) continue;
      while (b.length > 2 && b[1].t <= rt) b.shift();
      const a = b[0], c = b[1] || a, k = c.t > a.t ? clamp((rt - a.t) / (c.t - a.t), 0, 1) : 1;
      const ox = p.x, oz = p.z;
      p.x = a.x + (c.x - a.x) * k; p.y = a.y + (c.y - a.y) * k; p.z = a.z + (c.z - a.z) * k;
      p.yaw = lerpAngle(a.yaw, c.yaw, k); p.pitch = a.pitch + (c.pitch - a.pitch) * k;
      const moved = Math.hypot(p.x - ox, p.z - oz);
      if (moved < 3) { p.walk += moved * 2.4; p.walkAmp += (Math.min(1, moved / Math.max(dt, 0.001) / 3.5) - p.walkAmp) * Math.min(1, dt * 10); }
      p.swim = (p.swim || 0) + (((p.flags & 256) && p.walkAmp > 0.2 ? 1 : 0) - (p.swim || 0)) * Math.min(1, dt * 7);   // 水の中を動いている → 泳ぐ姿
      p.swingT = Math.max(0, p.swingT - dt * 3.4); if (p.hurtT > 0) p.hurtT -= dt;
    }
  },
  nearPeer(x, z) {
    let best = null, bd = 1e9;
    for (const p of this.peers.values()) { if (p.dim !== this.world.dim || !this.fresh(p) || p.goneAt) continue; const d = Math.hypot(p.x - x, p.z - z); if (d < bd) { bd = d; best = p; } }
    this._npd = bd; return best;
  },
  // そのチャンクの「成長・かまど・動物の引き取り」を自分が受け持つか（いちばん近い人が受け持つ）
  owns(cx, cz) {
    if (!this.peers.size) return true;
    const d = Math.max(Math.abs(cx - (Math.floor(player.x) >> 4)), Math.abs(cz - (Math.floor(player.z) >> 4)));
    for (const p of this.peers.values()) {
      if (p.dim !== this.world.dim || !this.fresh(p) || p.goneAt) continue;
      const dp = Math.max(Math.abs(cx - (Math.floor(p.x) >> 4)), Math.abs(cz - (Math.floor(p.z) >> 4)));
      if (dp < d || (dp === d && p.pid < this.pid)) return false;
    }
    return true;
  },
  // その入れ物を、ほかの人が開いているか
  openBy(x, y, z) { const k = posKey(x, y, z); for (const p of this.peers.values()) if (p.open === k && this.fresh(p)) return p; return null; },

  // ---------- 送る ----------
  dm(pid, o) { if (!this.on) return; o.f = this.pid; this.root.child('dm/' + pid).push(JSON.stringify(o)); },
  cell(x, y, z, id, meta) {
    this.out['c/' + this.world.dim + '_' + (x >> 6) + '_' + (z >> 6) + '/c' + ((y << 12) | ((z & 63) << 6) | (x & 63)).toString(36)] = cellPack(id, meta);
    this.outN++;
  },
  entDirty(x, y, z) { this.dirtyEnts.set(posKey(x, y, z), [x, y, z]); },
  flush() {
    if (!this.on || !this.world) return;
    const w = this.world;
    for (const [x, y, z] of this.dirtyEnts.values()) this.sendEnt(x, y, z);
    this.dirtyEnts.clear();
    if (this.outN) { const o = this.out; this.out = {}; this.outN = 0; this.root.update(o).catch((e) => this.fail(e)); }
  },
  // 入れ物ひとつ分の、まだ送っていない変更を送る列に入れる。返り値は送った「ちがい」
  sendEnt(x, y, z) {
    const w = this.world, rk = w.dim + '_' + (x >> 6) + '_' + (z >> 6), reg = this.regions.get(rk);
    const ck = w.key(x >> 4, z >> 4), ci = (y << 8) | ((z & 15) << 4) | (x & 15);
    const path = 'e/' + rk + '/c' + ((y << 12) | ((z & 63) << 6) | (x & 63)).toString(36);
    const cur = w.getEnt(x, y, z), em = reg ? reg.entv.get(ck) : null, sh = em ? em.get(ci) : null;
    if (!cur) { if (sh) { this.putEnt(path, '', null); em.delete(ci); } return null; }
    const diff = entDiff(sh, entToNet(cur), this.owns(x >> 4, z >> 4));
    if (!diff.length) return diff;
    for (const [f, v] of diff) this.putEnt(path, f, v);
    if (reg) { let m = reg.entv.get(ck); if (!m) reg.entv.set(ck, m = new Map()); m.set(ci, entPatch(sh ? JSON.parse(JSON.stringify(sh)) : {}, diff)); }
    return diff;
  },
  // 1回の送信の中で「入れ物まるごと」と「その欄」が両方あると送れないので、ここでまとめる
  putEnt(path, f, v) {
    this.outN++;
    if (f === '') { for (const k in this.out) if (k.startsWith(path + '/')) delete this.out[k]; this.out[path] = v; return; }
    const pend = this.out[path];
    if (pend === undefined) this.out[path + '/' + f] = v; else if (pend !== null) entPatch(pend, [[f, v]]);
  },
  sendState(dt) {
    this.accSt += dt; this.accIdle += dt; this.accEnt += dt; this.accFull += dt;
    if (this.accSt < 0.1) return;
    const p = player, h = p.held();
    const fl = (p.sneaking ? 1 : 0) | (game.inBed ? 2 : 0) | (p.dead ? 4 : 0) | (p.flying ? 8 : 0) | (p.mode === 1 ? 16 : 0) | (p.eating > 0 ? 32 : 0) | (p.blocking ? 64 : 0) | (p.armor[4] ? 128 : 0) | (p.inWater && !p.onGround && !p.flying ? 256 : 0) | (p.sprinting ? 512 : 0);
    const P = [r2(p.x), r2(p.y), r2(p.z), r2(p.yaw), r2(p.pitch), h ? (p.drawT > 0.55 ? I.bow_p2 : p.drawT > 0.02 ? I.bow_p1 : h.id) : 0, fl, this.swingN, ui.entPos ? posKey(ui.entPos.x, ui.entPos.y, ui.entPos.z) : 0, this.world.dim, armorCode(p.armor)];
    const ps = P.join(',');
    let E = null, full = 0;
    if (this.peers.size && this.accEnt >= 0.2) {
      this.accEnt = 0; if (this.accFull >= 2) { full = 1; this.accFull = 0; }
      E = netCollect(full);
    }
    const RM = this.rmQ.length ? this.rmQ : null;
    if (ps === this.lastP && !(E && E.length) && !RM && !full && this.accIdle < 1) return;
    this.accSt = 0; this.accIdle = 0; this.lastP = ps; this.rmQ = [];
    this.root.child('st/' + this.pid).set(JSON.stringify([P, E && E.length ? E : 0, RM || 0, full]));
  },

  // ---------- 区画（4×4チャンク）ごとの変更を受け取る ----------
  attach(dim, rx, rz) {
    const key = dim + '_' + rx + '_' + rz, now = performance.now();
    const reg = { key, dim, rx, rz, ready: false, t0: now, used: now, cells: new Map(), entv: new Map(), stash: new Map(), claim: new Set(), offs: [] };
    this.regions.set(key, reg);
    const R = this.root, rc = R.child('c/' + key), re = R.child('e/' + key), ra = R.child('a/' + key);
    const on = (ref, ev, fn) => { const cb = (s) => { try { fn(s.key, s.val()); } catch (e) { console.error(e); } }; ref.on(ev, cb, (e) => this.fail(e)); reg.offs.push(() => ref.off(ev, cb)); };
    on(rc, 'child_added', (k, v) => this.onCell(reg, k, v)); on(rc, 'child_changed', (k, v) => this.onCell(reg, k, v));
    on(re, 'child_added', (k, v) => this.onEnt(reg, k, v)); on(re, 'child_changed', (k, v) => this.onEnt(reg, k, v)); on(re, 'child_removed', (k) => this.onEnt(reg, k, null));
    on(ra, 'child_added', (k, v) => reg.stash.set(k, v)); on(ra, 'child_changed', (k, v) => reg.stash.set(k, v)); on(ra, 'child_removed', (k) => reg.stash.delete(k));
    let n = 0; const done = () => { if (++n === 2) reg.ready = true; };
    rc.once('value').then(done, done); re.once('value').then(done, done);
    return reg;
  },
  chunkReady(dim, cx, cz) {
    const key = dim + '_' + (cx >> 2) + '_' + (cz >> 2); let reg = this.regions.get(key);
    const now = performance.now();
    if (!reg) { reg = this.attach(dim, cx >> 2, cz >> 2); return false; }
    reg.used = now;
    return reg.ready || now - reg.t0 > 6000;
  },
  genVer(dim, rx, rz) {
    const k = dim + '_' + rx + '_' + rz, v = this.gvMap.get(k);
    if (v) return v;
    if (!this.gvReady) return 0;
    if (!this.gvAsk.has(k)) {
      this.gvAsk.add(k);
      this.root.child('gv/' + k).transaction((cur) => cur === null ? GEN_CUR : undefined).then((r) => { const val = r.snapshot && r.snapshot.val(); if (val) this.gvMap.set(k, val); this.gvAsk.delete(k); }, (e) => { this.gvAsk.delete(k); this.fail(e); });
    }
    return 0;
  },
  cellPos(reg, key, out) {
    const idx = parseInt(String(key).slice(1), 36); if (!(idx >= 0)) return false;
    out[0] = reg.rx * 64 + (idx & 63); out[1] = idx >> 12; out[2] = reg.rz * 64 + ((idx >> 6) & 63); return true;
  },
  onCell(reg, key, v) {
    const q = this._q || (this._q = [0, 0, 0]); if (!this.cellPos(reg, key, q) || typeof v !== 'number') return;
    const w = this.world; if (!w) return;
    const x = q[0], y = q[1], z = q[2], ck = w.key(x >> 4, z >> 4), ci = (y << 8) | ((z & 15) << 4) | (x & 15);
    let m = reg.cells.get(ck); if (!m) reg.cells.set(ck, m = new Map());
    m.set(ci, v);
    if (reg.dim !== w.dim) return;
    const r = w.remoteCell(x, y, z, v);
    if (r && reg.ready && game.state !== 'loading') netBlockFx(x, y, z, r - 1, cellId(v));
  },
  onEnt(reg, key, v) {
    const q = this._q || (this._q = [0, 0, 0]); if (!this.cellPos(reg, key, q)) return;
    const w = this.world; if (!w) return;
    const x = q[0], y = q[1], z = q[2], ck = w.key(x >> 4, z >> 4), ci = (y << 8) | ((z & 15) << 4) | (x & 15);
    let m = reg.entv.get(ck); if (!m) reg.entv.set(ck, m = new Map());
    // 自分がまだ送っていない変更があれば、先にそれを送る列に入れてから、届いた内容に重ねる（自分が変えた欄は自分の値、ほかの欄は届いた値）
    const pk = posKey(x, y, z); let mine = null;
    if (reg.dim === w.dim && this.dirtyEnts.has(pk)) { this.dirtyEnts.delete(pk); mine = this.sendEnt(x, y, z); }
    if (v && typeof v === 'object') { if (mine && mine.length && !(mine[0][0] === '')) v = entPatch(JSON.parse(JSON.stringify(v)), mine); m.set(ci, v); } else { v = null; m.delete(ci); }
    if (reg.dim !== w.dim) return;
    w.remoteEnt(x, y, z, entFromNet(v));
    const ep = ui.entPos;
    if (ep && ep.x === x && ep.y === y && ep.z === z) { if (!v) ui.close(); else { ui._fk = ''; ui.refresh(); } }
  },
  // チャンクができたとき、その区画でこれまでに変えられたマスをあてはめる
  applyStore(c) {
    const w = this.world, reg = this.regions.get(w.dim + '_' + (c.cx >> 2) + '_' + (c.cz >> 2));
    if (!reg) return;
    const ck = w.key(c.cx, c.cz), m = reg.cells.get(ck);
    if (m && m.size) {
      for (const [i, v] of m) {
        const id = cellId(v), old = c.blocks[i];
        if (!BLOCKS[id] && id !== 0) continue;
        if (old !== id && c.ents.size && c.ents.has(i) && !(BLOCKS[old] && BLOCKS[id] && BLOCKS[old].ent && BLOCKS[old].ent === BLOCKS[id].ent)) c.ents.delete(i);
        c.blocks[i] = id; c.meta[i] = cellMeta(v);
        if (id && (i >> 8) > c.maxY) c.maxY = i >> 8;
      }
      c.modified = true;
    }
    const em = reg.entv.get(ck);
    if (em) for (const [i, nv] of em) { const e = entFromNet(nv); if (e) c.ents.set(i, e); }
  },
  gcRegions() {
    const w = this.world, now = performance.now();
    for (const c of w.chunks.values()) { const reg = this.regions.get(w.dim + '_' + (c.cx >> 2) + '_' + (c.cz >> 2)); if (reg) reg.used = now; }
    for (const [k, reg] of this.regions) if (now - reg.used > 25000) { for (const f of reg.offs) { try { f(); } catch (e) { } } this.regions.delete(k); }
  },

  // ---------- 時刻 ----------
  // 世界の時刻は、置いてある「基準」とサーバーの時計から計算する（端末の速さに左右されず、全員で同じになる）
  applyTime() {
    const v = this.timeRec, w = this.world; if (!v || !w) return false;
    if (game.rules.day) { w.time = 6000; return true; }
    let el = (this.now() - (v.at || 0)) / 50; if (!(el >= 0)) el = 0;
    if (el > 1200) el = 0;   // 基準が1分以上古い＝世界に人がいなかった。入った人が基準を書き直すまで止めておく
    let t = (v.t || 0) + el, d = v.d || 1; while (t >= 24000) { t -= 24000; d++; }
    if (d > w.day && this.timeInit && game.state !== 'loading') { if (this.skipped) game.onMorning(d); else { ui.dayBanner(d + '日目'); sfx('dawn'); } }
    this.skipped = false; this.timeInit = true;
    w.time = Math.floor(t); w.day = d;
    return true;
  },
  onTime(v) {
    const w = this.world;
    if (w && this.timeInit) { const jump = Math.abs((v.t || 0) - w.time); if ((v.d || 1) > w.day && Math.min(jump, 24000 - jump) > 300) this.skipped = true; }   // 眠って朝になった
    this.timeRec = v; if (w) this.applyTime();
  },
  writeTime(t, d) {
    const w = this.world; this.lastTime = performance.now();
    const rec = { t: t === undefined ? w.time : t, d: d === undefined ? w.day : d };
    this.timeRec = Object.assign({ at: this.now() }, rec); this.root.child('time').set(Object.assign({ at: this.stamp() }, rec));
  },
  // 全員がベッドに入っていたら朝にする（番号がいちばん小さい人の端末が決める）
  checkSleep() {
    const w = this.world; if (!game.inBed || !w.isNight()) { this.sleepT = 0; return; }
    for (const p of this.peers.values()) if (this.here(p) && this.fresh(p) && !p.dead && !p.sleeping && !p.dim) { this.sleepT = 0; return; }   // べつの世界にいる人は数えない
    if ((this.sleepT = (this.sleepT || 0) + 1) < 3) return;
    this.sleepT = 0; this.skipped = true; this.writeTime(0, w.day + 1); this.applyTime();
  },

  // ---------- 動物（消えない生き物）をしまう・引き取る ----------
  stash(rec) { this.root.child('a/' + this.world.dim + '_' + (Math.floor(rec[1]) >> 6) + '_' + (Math.floor(rec[3]) >> 6)).push(JSON.stringify(rec)); },
  pollStash() {
    const w = this.world;
    for (const reg of this.regions.values()) {
      if (!reg.stash.size || reg.dim !== w.dim) continue;
      for (const [id, raw] of reg.stash) {
        if (reg.claim.has(id)) continue;
        let rec; try { rec = JSON.parse(raw); } catch (e) { continue; }
        const cx = Math.floor(rec[1]) >> 4, cz = Math.floor(rec[3]) >> 4, c = w.getChunk(cx, cz);
        if (!c || c.stage < 2 || !this.owns(cx, cz)) continue;
        reg.claim.add(id);
        this.root.child('a/' + reg.key + '/' + id).transaction((cur) => cur === null ? undefined : null).then((r) => { reg.claim.delete(id); if (r.committed && this.on) spawnFromRec(rec); }, () => reg.claim.delete(id));
      }
    }
  },
  // 自分が動かしている動物の控えを、ときどき置いておく（急に通信が切れても、動物が消えないように）
  checkpoint() {
    const list = []; for (const e of ents) if (!e.remote && !e.dead && keepsMob(e)) list.push([e.nid].concat(mobRec(e)));
    const s = list.length ? JSON.stringify(list) : '';
    if (s === this.alWas) return; this.alWas = s;
    if (s) this.root.child('al/' + this.pid).set(s); else this.root.child('al/' + this.pid).remove();
  },
  recoverAl(pid, got) {
    let taken = null;
    this.root.child('al/' + pid).transaction((cur) => { taken = cur; return null; }).then(() => {
      if (typeof taken !== 'string' || !this.on) return;
      let list; try { list = JSON.parse(taken); } catch (e) { return; }
      for (const r of list) if (!got.has(r[0])) this.stash(r.slice(1));
    }, () => { });
  },
  // 前に急に切れた人の控えが残っていたら、しまい直す
  recoverStale() {
    if (!this.isFirst()) return;
    this.root.child('al').once('value').then((s) => { const v = s.val(); if (!v || !this.on) return; for (const pid in v) if (pid !== this.pid && !this.peers.has(pid)) this.recoverAl(pid, new Set()); }, () => { });
  },
  stashOnLeave() {
    for (const e of ents) {
      if (e.remote || e.dead || !keepsMob(e)) continue;
      this.nearPeer(e.x, e.z);
      if (this._npd > 60) { this.stash(mobRec(e)); e.dead = true; }   // 近くに人がいる分は、その人が引き取る
    }
  },

  // ---------- 毎フレーム・ときどき ----------
  frame(dt) {
    if (!this.on || !this.world) return;
    this.updPeers(dt);
    this.sendState(dt);
    if ((this.accFlush += dt) >= 0.1) { this.accFlush = 0; this.flush(); }
    if ((this.accSlow += dt) >= 0.5) { this.accSlow = 0; this.slow(); }
  },
  slow() {
    const now = performance.now(); this.tSlow++;
    for (const p of [...this.peers.values()]) {
      if (p.goneAt && now - p.goneAt > 5000) this.finishGone(p);
      else if (!p.known && now - p.seen > 12000) { this.dropPeer(p); this.peers.delete(p.pid); }   // 名のらないまま止まった人
    }
    if (this.tSlow % 4 === 0) this.gcRegions();
    if (this.isFirst()) {
      if (now - this.lastTime > 15000 || !this.timeRec || this.now() - (this.timeRec.at || 0) > 60000) this.writeTime();
      this.checkSleep();
      if (now - this.lastLobby > 40000 || this._lobbyN !== this.count()) {
        this.lastLobby = now; this._lobbyN = this.count();
        const ref = this.db.ref('np/lobby/block-' + this.code);
        ref.onDisconnect().remove(); ref.set({ g: 'block', code: this.code, st: 'lobby', n: this.count(), max: NET_MAX, host: this.meta.name || 'block', t: this.now() });
      }
    }
    if (now - this.lastAl > 30000) { this.lastAl = now; this.checkpoint(); this.savePlayer(); }
    ui.netHud();
  },
  tick() { if (this.on && this.world && this.world.tick % 20 === 7) this.pollStash(); }
};
// ほかの人がブロックを変えたときの音と かけら（近くだけ）
function netBlockFx(x, y, z, old, id) {
  if (Math.abs(x - player.x) > 24 || Math.abs(z - player.z) > 24 || Math.abs(y - player.y) > 24) return;
  if (old === id) return;
  if (old && !id && !FLUID[old] && BLOCKS[old]) { fxBlockBits(x + 0.5, y + 0.5, z + 0.5, old, 10, 0.8); sfxAt('break_' + BLOCKS[old].sound, x, y, z); }
  else if (id && !FLUID[id] && (!old || FLUID[old] || REPLACE[old]) && BLOCKS[id] && SOLID[id]) sfxAt('place_' + BLOCKS[id].sound, x, y, z);
}
