/* fakeroom.js — 格ゲー（Dockside Drive）用。
   ゲームが元々使っている claude.ai の「room」機能と同じ形の仕組みを、
   Firebase（部屋さがし・つなぎ役）＋ WebRTC（スマホ同士の直接通信）で作り直す。
   ゲーム側のロールバック処理には手を入れない。 */
(function () {
  'use strict';
  var FIREBASE = {
    apiKey: 'AIzaSyBTuzvBh9qtf5F8JnHVa5bv1-igP3E_ebA',
    authDomain: 'claude-4d377.firebaseapp.com',
    databaseURL: 'https://claude-4d377-default-rtdb.asia-southeast1.firebasedatabase.app',
    projectId: 'claude-4d377',
    storageBucket: 'claude-4d377.firebasestorage.app',
    messagingSenderId: '652412386711',
    appId: '1:652412386711:web:a6033541ef4fa62da998d2'
  };
  var ICE = [{ urls: ['stun:stun.l.google.com:19302', 'stun:stun1.l.google.com:19302'] }];
  var GAME = (document.currentScript && document.currentScript.dataset.game) || 'fight';
  var LOCAL = new URLSearchParams(location.search).get('np') === 'local';
  var ME = Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);

  /* ---------- 保存先：Firebase か、テスト用の同じブラウザ内 ---------- */
  function fbStore() {
    if (!window.firebase || !firebase.database) return null;
    var app;
    try { app = firebase.apps && firebase.apps.length ? firebase.app() : firebase.initializeApp(FIREBASE); } catch (e) { return null; }
    var db = firebase.database(app), root = db.ref('np/' + GAME);
    return {
      set: function (path, v) { return root.child(path).set(v); },
      remove: function (path) { return root.child(path).remove(); },
      autoRemove: function (path) { root.child(path).onDisconnect().remove(); },
      cancelAuto: function (path) { root.child(path).onDisconnect().cancel(); },
      push: function (path, v) { return root.child(path).push(v); },
      watch: function (path, f) { var r = root.child(path); var h = r.on('value', function (s) { f(s.val()); }); return function () { r.off('value', h); }; },
      added: function (path, f) { var r = root.child(path); var h = r.on('child_added', function (s) { f(s.val(), s.key); }); return function () { r.off('child_added', h); }; },
      onConn: function (f) { var r = db.ref('.info/connected'); r.on('value', function (s) { f(!!s.val()); }); }
    };
  }
  function localStore() {
    // テスト用：localStorage を共有データ置き場にする（同じブラウザ内のタブ同士だけ）
    var KEY = 'npfake-' + GAME, ws = [];
    function all() { try { return JSON.parse(localStorage.getItem(KEY) || '{}'); } catch (e) { return {}; } }
    function save(d) { localStorage.setItem(KEY, JSON.stringify(d)); fire(); }
    function get(d, path) { return path.split('/').reduce(function (o, k) { return o && o[k]; }, d); }
    function put(d, path, v) { var ks = path.split('/'), o = d; for (var i = 0; i < ks.length - 1; i++) { o = o[ks[i]] = o[ks[i]] || {}; } if (v == null) delete o[ks[ks.length - 1]]; else o[ks[ks.length - 1]] = v; }
    function fire() { var d = all(); ws.slice().forEach(function (w) { w(d); }); }
    addEventListener('storage', function (e) { if (e.key === KEY) fire(); });
    var mine = [];
    addEventListener('beforeunload', function () { var d = all(); mine.forEach(function (p) { put(d, p, null); }); localStorage.setItem(KEY, JSON.stringify(d)); });
    var n = 0;
    return {
      set: function (path, v) { var d = all(); put(d, path, JSON.parse(JSON.stringify(v))); save(d); return Promise.resolve(); },
      remove: function (path) { var d = all(); put(d, path, null); save(d); return Promise.resolve(); },
      autoRemove: function (path) { mine.push(path); },
      cancelAuto: function (path) { var i = mine.indexOf(path); if (i >= 0) mine.splice(i, 1); },
      push: function (path, v) { var d = all(); put(d, path + '/' + (Date.now().toString(36) + (n++) + ME.slice(0, 4)), v); save(d); return Promise.resolve(); },
      watch: function (path, f) { var last; var w = function (d) { var v = get(d, path); var s = JSON.stringify(v); if (s !== last) { last = s; f(v == null ? null : JSON.parse(s)); } }; ws.push(w); setTimeout(function () { w(all()); }, 0); return function () { var i = ws.indexOf(w); if (i >= 0) ws.splice(i, 1); }; },
      added: function (path, f) { var seen = {}; var w = function (d) { var v = get(d, path) || {}; Object.keys(v).sort().forEach(function (k) { if (!seen[k]) { seen[k] = 1; f(v[k], k); } }); }; ws.push(w); setTimeout(function () { w(all()); }, 0); return function () { var i = ws.indexOf(w); if (i >= 0) ws.splice(i, 1); }; },
      onConn: function (f) { setTimeout(function () { f(true); }, 0); }
    };
  }
  var DB = null;
  function store() { if (!DB) DB = LOCAL ? localStore() : fbStore(); return DB; }

  /* ---------- 共通：presence を持つ「部屋」 ---------- */
  function strip(o) { var r = {}; for (var k in o) if (o[k] !== null && o[k] !== undefined) r[k] = o[k]; return r; }
  function mergeInto(obj, patch) { for (var k in patch) { if (patch[k] === null) delete obj[k]; else obj[k] = patch[k]; } }

  function Space(path, p2p) {
    this.path = path; this.p2p = p2p;
    this.mine = {}; this.others = {};   // peerId -> {presence, updatedAt, frozen}
    this.handlers = []; this.connH = []; this.left = false;
    this.links = {};                     // P2P の接続（peerId -> Link）
    this.fbLast = 0; this.fbTimer = 0; this.dirty = false;
    this.snap = null; this.pending = false;
    this.unwatch = null;
    var self = this, db = store();
    db.autoRemove(path + '/m/' + ME);
    db.set(path + '/m/' + ME, { p: {}, t: Date.now() });
    this.unwatch = db.watch(path + '/m', function (v) { self.onMembers(v || {}); });
    this.hb = setInterval(function () { self.writeFB(true); }, 20000);
  }
  Space.prototype.onMembers = function (v) {
    var self = this, changed = false, seen = {};
    Object.keys(v).forEach(function (pid) {
      if (pid === ME) return;
      seen[pid] = 1;
      var o = self.others[pid];
      var fp = strip((v[pid] && v[pid].p) || {});
      if (!o) { o = self.others[pid] = { presence: fp, updatedAt: Date.now(), seq: -1 }; changed = true; if (self.p2p) self.link(pid); }
      else if (!self.linkOpen(pid)) { if (JSON.stringify(fp) !== JSON.stringify(o.presence)) { o.presence = fp; o.updatedAt = Date.now(); changed = true; } }
    });
    Object.keys(this.others).forEach(function (pid) { if (!seen[pid]) { delete self.others[pid]; self.unlink(pid); changed = true; } });
    if (changed) this.notify();
  };
  Space.prototype.linkOpen = function (pid) { var l = this.links[pid]; return !!(l && l.dc && l.dc.readyState === 'open'); };
  Space.prototype.presence = function (patch) {
    if (this.left) return Promise.resolve();
    mergeInto(this.mine, patch || {});
    var msg = null, sentP2P = true;
    for (var pid in this.others) {
      if (this.linkOpen(pid)) { if (!msg) msg = JSON.stringify({ s: ++this.seq0, p: this.mine }); try { this.links[pid].dc.send(msg); } catch (e) { sentP2P = false; } }
      else sentP2P = false;
    }
    this.dirty = true;
    this.writeFB(false, sentP2P && Object.keys(this.others).length > 0);
    this.notify();
    return Promise.resolve();
  };
  Space.prototype.seq0 = 0;
  // Firebase への書き込みは間引く（直接通信できているときは1秒に1回、できないときは1秒に12回まで）
  Space.prototype.writeFB = function (force, p2pOk) {
    var self = this, gap = p2pOk ? 1000 : 80;
    if (this.left) return;
    var now = Date.now();
    if (!force && !this.dirty) return;
    if (now - this.fbLast >= gap || force) {
      this.fbLast = now; this.dirty = false;
      store().set(this.path + '/m/' + ME, { p: this.mine, t: now });
    } else if (!this.fbTimer) {
      this.fbTimer = setTimeout(function () { self.fbTimer = 0; self.writeFB(false, Object.keys(self.others).every(function (p) { return self.linkOpen(p); })); }, gap - (now - this.fbLast));
    }
  };
  Space.prototype.peers = function () {
    if (this.snap) return this.snap;
    var arr = [Object.freeze({ peer: ME, by: null, isMe: true, sameTab: true, kind: 'viewer', guest: false, presence: Object.freeze(Object.assign({}, this.mine)), updatedAt: Date.now() })];
    for (var pid in this.others) { var o = this.others[pid]; arr.push(Object.freeze({ peer: pid, by: null, isMe: false, sameTab: false, kind: 'viewer', guest: false, presence: Object.freeze(Object.assign({}, o.presence)), updatedAt: o.updatedAt })); }
    this.snap = Object.freeze(arr);
    return this.snap;
  };
  Space.prototype.notify = function () {
    this.snap = null;
    if (this.pending) return; this.pending = true;
    var self = this;
    var run = function () { self.pending = false; var ps = self.peers(); self.handlers.slice().forEach(function (h) { try { h({ peers: ps, joined: [], left: [], updated: ps }); } catch (e) { console.error(e); } }); };
    if (document.hidden) setTimeout(run, 0); else requestAnimationFrame(run);
  };
  Space.prototype.onPeers = function (fn) { var self = this; this.handlers.push(fn); this.notify(); return function () { var i = self.handlers.indexOf(fn); if (i >= 0) self.handlers.splice(i, 1); }; };
  Space.prototype.connected = function () { return true; };
  Space.prototype.onConnection = function (fn) { setTimeout(function () { fn(true); }, 0); return function () {}; };
  Space.prototype.emit = function () { return Promise.resolve(); };
  Space.prototype.on = function () { return function () {}; };
  Space.prototype.leave = function () {
    if (this.left) return Promise.resolve();
    this.left = true;
    clearInterval(this.hb); clearTimeout(this.fbTimer);
    if (this.unwatch) this.unwatch();
    for (var pid in this.links) this.unlink(pid);
    var db = store(); db.cancelAuto(this.path + '/m/' + ME);
    return db.remove(this.path + '/m/' + ME);
  };

  /* ---------- 直接通信（WebRTC） ---------- */
  Space.prototype.link = function (pid) {
    if (this.links[pid]) return;
    var self = this, db = store();
    var offerer = ME < pid;
    var me2them = this.path + '/s/' + ME + '_' + pid, them2me = this.path + '/s/' + pid + '_' + ME;
    var L = this.links[pid] = { pc: new RTCPeerConnection({ iceServers: ICE }), dc: null, offs: [] };
    var pc = L.pc;
    db.autoRemove(me2them);
    pc.onicecandidate = function (e) { if (e.candidate) db.push(me2them + '/c', e.candidate.toJSON ? e.candidate.toJSON() : e.candidate); };
    function setupDC(dc) {
      L.dc = dc;
      dc.onopen = function () { self.seq0++; try { dc.send(JSON.stringify({ s: self.seq0, p: self.mine })); } catch (e) {} self.notify(); };
      dc.onmessage = function (m) {
        var d; try { d = JSON.parse(m.data); } catch (e) { return; }
        var o = self.others[pid]; if (!o) return;
        if (typeof d.s === 'number') { if (d.s <= o.seq) return; o.seq = d.s; }
        o.presence = strip(d.p || {}); o.updatedAt = Date.now();
        self.notify();
      };
      dc.onclose = function () { self.notify(); };
    }
    if (offerer) {
      setupDC(pc.createDataChannel('p', { ordered: false, maxRetransmits: 0 }));
      pc.createOffer().then(function (o) { return pc.setLocalDescription(o); })
        .then(function () { db.set(me2them + '/o', { type: pc.localDescription.type, sdp: pc.localDescription.sdp }); });
      L.offs.push(db.watch(them2me + '/a', function (a) { if (a && !pc.currentRemoteDescription) pc.setRemoteDescription(a).catch(function () {}); }));
    } else {
      pc.ondatachannel = function (e) { setupDC(e.channel); };
      L.offs.push(db.watch(them2me + '/o', function (o) {
        if (!o || pc.currentRemoteDescription) return;
        pc.setRemoteDescription(o).then(function () { return pc.createAnswer(); })
          .then(function (a) { return pc.setLocalDescription(a); })
          .then(function () { db.set(me2them + '/a', { type: pc.localDescription.type, sdp: pc.localDescription.sdp }); })
          .catch(function () {});
      }));
    }
    L.offs.push(db.added(them2me + '/c', function (c) { if (c) pc.addIceCandidate(c).catch(function () {}); }));
    pc.onconnectionstatechange = function () { if (pc.connectionState === 'failed') console.warn('[fakeroom] 直接通信できませんでした。サーバー経由で続けます。'); self.notify(); };
  };
  Space.prototype.unlink = function (pid) {
    var L = this.links[pid]; if (!L) return;
    delete this.links[pid];
    L.offs.forEach(function (f) { try { f(); } catch (e) {} });
    try { L.pc.close(); } catch (e) {}
    var db = store(); var p = this.path + '/s/' + ME + '_' + pid; db.cancelAuto(p); db.remove(p);
  };

  /* ---------- ゲームから見える入口：window.claude.use('room') ---------- */
  var lobby = null, rooms = {};
  function getLobby() {
    if (lobby) return lobby;
    lobby = new Space('lobby', false);
    lobby.join = function (name) {
      name = String(name).toLowerCase().replace(/[^a-z0-9_.-]/g, '').slice(0, 48);
      if (rooms[name] && !rooms[name].left) return Promise.resolve(rooms[name]);
      var r = rooms[name] = new Space('rooms/' + name, true);
      r.name = name;
      return Promise.resolve(r);
    };
    return lobby;
  }
  var api = {
    use: function (name) {
      if (name !== 'room') return Promise.resolve(null);
      if (!store()) return Promise.resolve(null);
      return Promise.resolve(getLobby());
    }
  };
  try { Object.defineProperty(window, 'claude', { value: api, configurable: true, writable: true }); } catch (e) { window.claude = api; }
  window.__FAKEROOM = { me: ME, rooms: rooms, lobby: function () { return lobby; } };
})();
