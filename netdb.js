/* netdb.js — 各自の端末で動かす方式のオンラインと、共通設定の部品（カート・ワナワナ・ラン・一覧ページ・netplay.js で共用）
   - NetDB.open(game)  : np/{game}/ の下を読み書きする小さなDB（Firebase。?np=local なら同じブラウザ内だけ）
   - NetDB.mem()       : メモリだけのDB（1台で遊ぶとき用。オンラインと同じ書き方で使える）
   - NetDB.lobby       : 全ゲーム共通の「いま開いている部屋」一覧（np/lobby/）
   - NetDB.name / NetDB.vol : 全ゲーム共通の名前と音量
   どのDBも API は同じ：now() set(p,v) update(p,v) remove(p) on(p,type,cb)->off dis(p) undis(p)
   type は 'value' | 'child_added' | 'child_changed'。cb(key,value)。 */
(function () {
  'use strict';
  var FB_CFG = { apiKey: 'AIzaSyBTuzvBh9qtf5F8JnHVa5bv1-igP3E_ebA', authDomain: 'claude-4d377.firebaseapp.com', databaseURL: 'https://claude-4d377-default-rtdb.asia-southeast1.firebasedatabase.app', projectId: 'claude-4d377', storageBucket: 'claude-4d377.firebasestorage.app', messagingSenderId: '652412386711', appId: '1:652412386711:web:a6033541ef4fa62da998d2' };
  var QS = new URLSearchParams(location.search);
  var LOCAL = QS.get('np') === 'local';
  var cache = {};

  function fbApp() {
    if (!window.firebase || !firebase.database) return null;
    try { return firebase.apps && firebase.apps.length ? firebase.app() : firebase.initializeApp(FB_CFG); } catch (e) { return null; }
  }
  var off = 0, offWatch = false;
  function fbDB(game) {
    var app = fbApp(); if (!app) return null;
    var db = firebase.database(app);
    if (!offWatch) { offWatch = true; db.ref('.info/serverTimeOffset').on('value', function (s) { off = s.val() || 0; }); }
    var root = 'np/' + game + '/';
    return {
      kind: 'fb', game: game,
      now: function () { return Date.now() + off; },
      set: function (p, v) { return db.ref(root + p).set(v); },
      update: function (p, v) { return db.ref(root + p).update(v); },
      remove: function (p) { return db.ref(root + p).remove(); },
      on: function (p, ty, cb) { var r = db.ref(root + p); var f = function (s) { cb(s.key, s.val()); }; r.on(ty, f); return function () { r.off(ty, f); }; },
      dis: function (p) { db.ref(root + p).onDisconnect().remove(); },
      undis: function (p) { db.ref(root + p).onDisconnect().cancel(); }
    };
  }
  // tree DB: in memory, optionally mirrored between tabs with BroadcastChannel (test mode)
  function treeDB(bcName) {
    var tree = {}, L = [], mine = {}, bc = bcName && window.BroadcastChannel ? new BroadcastChannel(bcName) : null;
    function keys(p) { return p.split('/').filter(Boolean); }
    function get(p) { var o = tree, k = keys(p); for (var i = 0; i < k.length; i++) { if (o == null || typeof o !== 'object') return null; o = o[k[i]]; } return o === undefined ? null : o; }
    function put(p, v) { var k = keys(p), o = tree; for (var i = 0; i < k.length - 1; i++) { if (o[k[i]] == null || typeof o[k[i]] !== 'object') o[k[i]] = {}; o = o[k[i]]; } if (v == null) delete o[k[k.length - 1]]; else o[k[k.length - 1]] = JSON.parse(JSON.stringify(v)); }
    var pend = false;
    function fire() {
      pend = false;
      L.slice().forEach(function (l) {
        if (l.dead) return; var v = get(l.p);
        if (l.ty === 'value') { var j = JSON.stringify(v); if (j !== l.last) { l.last = j; l.cb(keys(l.p).pop(), v == null ? null : JSON.parse(j)); } return; }
        var cur = {}; if (v && typeof v === 'object') for (var k in v) cur[k] = JSON.stringify(v[k]);
        for (var k2 in cur) { if (!(k2 in l.kids)) { if (l.ty === 'child_added') l.cb(k2, JSON.parse(cur[k2])); } else if (l.kids[k2] !== cur[k2] && l.ty === 'child_changed') l.cb(k2, JSON.parse(cur[k2])); }
        l.kids = cur;
      });
    }
    function soon() { if (!pend) { pend = true; Promise.resolve().then(fire); } }
    function apply(op, p, v) { if (op === 'set') put(p, v); else if (op === 'update') { for (var k in v) put(p + '/' + k, v[k]); } else if (op === 'remove') put(p, null); soon(); }
    if (bc) {
      bc.onmessage = function (e) {
        var m = e.data;
        if (m.op === 'dump?') { bc.postMessage({ op: 'dump', tree: tree }); return; }
        if (m.op === 'dump') { (function mg(d, s) { for (var k in s) { if (!(k in d)) d[k] = s[k]; else if (d[k] && typeof d[k] === 'object' && s[k] && typeof s[k] === 'object') mg(d[k], s[k]); } })(tree, m.tree); soon(); return; }
        apply(m.op, m.p, m.v);
      };
      bc.postMessage({ op: 'dump?' });
      addEventListener('pagehide', function () { for (var p in mine) { apply('remove', p); bc.postMessage({ op: 'remove', p: p }); } });
    }
    function w(op) { return function (p, v) { apply(op, p, v); if (bc) bc.postMessage({ op: op, p: p, v: v }); return Promise.resolve(); }; }
    return {
      kind: bc ? 'bc' : 'mem',
      now: function () { return Date.now(); },
      set: w('set'), update: w('update'), remove: w('remove'),
      on: function (p, ty, cb) { var l = { p: p, ty: ty, cb: cb, last: undefined, kids: {} }; L.push(l); soon(); return function () { l.dead = true; var i = L.indexOf(l); if (i >= 0) L.splice(i, 1); }; },
      dis: function (p) { mine[p] = 1; }, undis: function (p) { delete mine[p]; }
    };
  }
  function open(game) {
    if (cache[game]) return cache[game];
    var db = LOCAL ? treeDB('np-' + game) : fbDB(game);
    if (db) cache[game] = db;
    return db;
  }

  // ---- shared "open rooms" list: np/lobby/{game}-{code} ----
  var GAMES = {
    party: { name: 'コロコロ島パーティ', url: 'party.html', join: 'join' },
    kart: { name: 'ターボカートGP', url: 'kart.html', join: 'room' },
    kitchen: { name: 'てんやわんやキッチン', url: 'kitchen.html', join: 'join' },
    trap: { name: 'ワナワナ・ラン', url: 'trap.html', join: 'room' },
    asobi: { name: 'あそび大全', url: 'asobi.html', join: 'room' },
    bomber: { name: 'ドッカン・ひろば', url: 'bomber.html', join: 'room' },
    fall: { name: 'ドロップ・バトル', url: 'fall.html', join: 'room' }
  };
  var lobby = {
    GAMES: GAMES,
    // host side: returns {update(info), close()}. info = {host, n, max, st}
    publish: function (game, code, info) {
      var db = open('lobby'); if (!db) return { update: function () {}, close: function () {} };
      var key = game + '-' + code, cur = Object.assign({ g: game, code: code, st: 'lobby', n: 1, max: 4, host: '' }, info || {});
      function put() { cur.t = db.now(); db.set(key, cur); }
      put(); db.dis(key);
      var beat = setInterval(put, 45000); // stale entries (older than 2 min) are hidden
      return {
        update: function (o) { Object.assign(cur, o || {}); put(); },
        close: function () { clearInterval(beat); db.undis(key); db.remove(key); }
      };
    },
    // cb(list) with fresh entries only
    watch: function (cb) {
      var db = open('lobby'); if (!db) { cb([]); return function () {}; }
      var last = {};
      function emit() { var now = db.now(), out = []; for (var k in last) { var r = last[k]; if (r && r.g && GAMES[r.g] && now - (r.t || 0) < 120000) out.push(r); } out.sort(function (a, b) { return (b.t || 0) - (a.t || 0); }); cb(out); }
      var offv = db.on('', 'value', function (k, v) { last = v || {}; emit(); });
      var tick = setInterval(emit, 15000);
      return function () { offv(); clearInterval(tick); };
    },
    joinUrl: function (r) { var g = GAMES[r.g]; if (!g) return '#'; return g.url + '?' + g.join + '=' + encodeURIComponent(r.code) + (LOCAL ? '&np=local' : ''); }
  };

  // ---- shared settings ----
  function ls(k, v) { try { if (v === undefined) return localStorage.getItem(k); localStorage.setItem(k, v); } catch (e) { return null; } }
  var name = {
    get: function () { var n = ls('gm_name') || ls('tkgp_name') || ls('wn_name') || ''; return n.slice(0, 10); },
    set: function (n) { n = String(n || '').trim().slice(0, 10); if (n) ls('gm_name', n); return n; }
  };
  var vol = {
    get: function () { var v = parseFloat(ls('gm_vol')); return isNaN(v) ? 1 : Math.max(0, Math.min(1, v)); },
    set: function (v) { ls('gm_vol', String(Math.max(0, Math.min(1, +v || 0)))); }
  };

  // ---- みんなの部屋（ホームで合流）：?hub=XXXX で来たページは「ホームへ」がその部屋に戻る ----
  var HUBC = (QS.get('hub') || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 4);
  try { if (HUBC) sessionStorage.setItem('gm_hub', HUBC); else HUBC = sessionStorage.getItem('gm_hub') || ''; } catch (e) {}
  var hub = {
    code: HUBC, isHost: QS.get('hh') === '1',
    home: function () { var q = []; if (hub.code) q.push('hub=' + hub.code); if (LOCAL) q.push('np=local'); return 'index.html' + (q.length ? '?' + q.join('&') : ''); },
    // ゲームの部屋が できたら、みんなの部屋に コードを 知らせる（ほかの人は それを 見て 自動で 参加する）
    report: function (game, code) { if (!hub.code || !hub.isHost) return; var db = open('hub'); if (db) db.update('r/' + hub.code + '/m/go', { g: game, code: code }); },
    leave: function () { hub.code = ''; try { sessionStorage.removeItem('gm_hub'); } catch (e) {} }
  };
  document.addEventListener('click', function (e) { var a = e.target && e.target.closest ? e.target.closest('a[href]') : null; if (a && /(^|\/)index\.html(\?.*)?$/.test(a.getAttribute('href') || '')) a.setAttribute('href', hub.home()); }, true);
  window.NetDB = { LOCAL: LOCAL, FB_CFG: FB_CFG, open: open, mem: function () { return treeDB(null); }, lobby: lobby, name: name, vol: vol, hub: hub };
})();
