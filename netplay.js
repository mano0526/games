/* netplay.js — リモートプレイ方式のオンライン対戦
   ホストの端末だけがゲームを動かし、画面と音を映像で配信する。
   参加者の入力は「仮想コントローラー」としてホストのゲームに届く。
   ゲーム本体のコードは書き換えない（navigator.getGamepads と音の出口を横取りする）。 */
(function () {
  'use strict';
  if (window.__NP) return;

  /* ---------- 設定 ---------- */
  var SCRIPT = document.currentScript || {};
  var DS = SCRIPT.dataset || {};
  var GAME = (DS.game || 'game').replace(/[^a-z0-9_-]/gi, '');
  var FPS = +DS.fps || 30;
  var QUALITY = {
    std:  { h: 720,  br: 4500000, label: '標準（720p）' },
    high: { h: 1080, br: 9000000, label: '高画質（1080p）' },
    low:  { h: 540,  br: 2000000, label: '軽量（540p）' }
  };
  var QKEY = 'std';
  try { QKEY = localStorage.getItem('np-quality') || 'std'; } catch (e) {}
  if (!QUALITY[QKEY]) QKEY = 'std';
  var MAX_H = +DS.maxh || QUALITY[QKEY].h;     // 送る映像の最大の高さ
  var BITRATE = +DS.bitrate || QUALITY[QKEY].br; // 送る映像の最大ビットレート
  var MAX_GUESTS = +DS.guests || 3;
  var POS = DS.pos || 'tl';              // オンラインボタンの位置 tl / bl / tr / br
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
  var QS = new URLSearchParams(location.search);
  var LOCAL = QS.get('np') === 'local';  // テスト用：同じブラウザ内だけでつなぐ

  /* ---------- 横取り0：WebGLの画面を読み取れるようにする（複数キャンバスを合成するゲーム用） ---------- */
  var COMPOSITE = !!(DS.canvas && DS.canvas.indexOf(',') >= 0);
  if (COMPOSITE && window.HTMLCanvasElement) {
    var origGC = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (type, attrs) {
      if (/^(webgl|webgl2|experimental-webgl)$/.test(type)) { attrs = Object.assign({}, attrs || {}, { preserveDrawingBuffer: true }); return origGC.call(this, type, attrs); }
      return origGC.apply(this, arguments);
    };
  }

  /* ---------- 横取り1：requestAnimationFrame（参加者側でゲームを止める） ---------- */
  var realRAF = window.requestAnimationFrame.bind(window);
  var freezeGame = false;
  window.requestAnimationFrame = function (cb) { return freezeGame ? 0 : realRAF(cb); };

  /* ---------- 横取り2：コントローラー ---------- */
  var realGet = navigator.getGamepads ? navigator.getGamepads.bind(navigator) : function () { return []; };
  var NB = 17;
  var vpads = [];   // 仮想コントローラー（参加者1人に1つ）
  var frameNo = 0;
  (function tick() { frameNo++; realRAF(tick); })();

  function VPad(label) {
    this.id = 'Remote Player ' + label + ' (STANDARD GAMEPAD Vendor: 0000 Product: 0000)';
    this.index = -1; this.connected = true; this.mapping = 'standard'; this.timestamp = performance.now();
    this.axes = [0, 0, 0, 0];
    this.buttons = []; for (var i = 0; i < NB; i++) this.buttons.push({ pressed: false, touched: false, value: 0 });
    this.vibrationActuator = null;
    this._down = new Array(NB).fill(false);
    this._latch = new Array(NB).fill(0);    // 押して離した短いタップを1フレームは残す
    this._ax = [0, 0, 0, 0];
  }
  VPad.prototype.setState = function (mask, ax) {
    for (var i = 0; i < NB; i++) {
      var d = !!(mask & (1 << i));
      if (d && !this._down[i]) this._latch[i] = -1;
      this._down[i] = d;
    }
    for (var k = 0; k < 4; k++) this._ax[k] = (ax && typeof ax[k] === 'number') ? Math.max(-1, Math.min(1, ax[k])) : 0;
    this.timestamp = performance.now();
  };
  VPad.prototype.snapshot = function () {
    for (var i = 0; i < NB; i++) {
      var p = this._down[i];
      if (this._latch[i] === -1) { p = true; this._latch[i] = frameNo; }
      else if (this._latch[i] > 0) { if (frameNo > this._latch[i]) this._latch[i] = 0; else p = true; }
      var b = this.buttons[i]; b.pressed = p; b.touched = p; b.value = p ? 1 : 0;
    }
    for (var k = 0; k < 4; k++) this.axes[k] = this._ax[k];
    return this;
  };
  function mergedPads() {
    var arr;
    try { arr = Array.prototype.slice.call(realGet() || []); } catch (e) { arr = []; }
    while (arr.length < 4) arr.push(null);
    for (var j = 0; j < vpads.length; j++) {
      var v = vpads[j];
      var i = v.index >= 0 ? v.index : 0;
      while (arr[i] && arr[i] !== v) i++;
      v.index = i;
      while (arr.length <= i) arr.push(null);
      arr[i] = v.snapshot();
    }
    return arr;
  }
  try { Object.defineProperty(navigator, 'getGamepads', { value: mergedPads, configurable: true, writable: true }); }
  catch (e) { try { navigator.getGamepads = mergedPads; } catch (e2) {} }
  function padEvent(type, pad) {
    try { var ev = new Event(type); Object.defineProperty(ev, 'gamepad', { value: pad }); window.dispatchEvent(ev); } catch (e) {}
  }
  function addVPad(label) {
    var v = new VPad(label);
    var used = {};
    var real = []; try { real = realGet() || []; } catch (e) {}
    for (var i = 0; i < real.length; i++) if (real[i]) used[i] = 1;
    vpads.forEach(function (p) { used[p.index] = 1; });
    var k = 0; while (used[k]) k++;
    v.index = k;
    vpads.push(v);
    padEvent('gamepadconnected', v.snapshot());
    return v;
  }
  function removeVPad(v) {
    var i = vpads.indexOf(v); if (i < 0) return;
    vpads.splice(i, 1); v.connected = false;
    padEvent('gamepaddisconnected', v);
  }

  /* ---------- 横取り3：音（ホストの音を配信に混ぜる・参加者側は消音） ---------- */
  var AudioNodeP = window.AudioNode && window.AudioNode.prototype;
  var ctxOut = [];  // {ctx, nodes:[], tap}
  var audioTap = false;
  function ctxEntry(ctx) {
    for (var i = 0; i < ctxOut.length; i++) if (ctxOut[i].ctx === ctx) return ctxOut[i];
    var e = { ctx: ctx, nodes: [], tap: null }; ctxOut.push(e); return e;
  }
  if (AudioNodeP && AudioNodeP.connect) {
    var origConnect = AudioNodeP.connect;
    AudioNodeP.connect = function (dest) {
      var isOut = false;
      try { isOut = !!(dest && window.AudioDestinationNode && dest instanceof window.AudioDestinationNode); } catch (e) {}
      if (isOut && freezeGame) return dest;
      var r = origConnect.apply(this, arguments);
      if (isOut) {
        try {
          var e = ctxEntry(this.context);
          if (e.nodes.indexOf(this) < 0) e.nodes.push(this);
          if (audioTap) ensureTap(e, origConnect);
          else if (e.tap) origConnect.call(this, e.tap);
        } catch (e2) {}
      }
      return r;
    };
    var _oc = origConnect;
    window.__NP_connect = function (e) { ensureTap(e, _oc); };
  }
  function ensureTap(e, oc) {
    if (!e.tap) {
      if (!e.ctx.createMediaStreamDestination) return;
      e.tap = e.ctx.createMediaStreamDestination();
      e.nodes.forEach(function (n) { try { oc.call(n, e.tap); n.__npTapped = 1; } catch (x) {} });
      onAudioTrack(e.tap.stream.getAudioTracks()[0]);
    } else {
      e.nodes.forEach(function (n) { if (!n.__npTapped) { try { oc.call(n, e.tap); n.__npTapped = 1; } catch (x) {} } });
    }
  }
  var audioTrack = null;
  function onAudioTrack(t) { if (!t || audioTrack) return; audioTrack = t; Host.setAudio(t); }

  /* ---------- 通信の土台（Firebase / テスト用の同じブラウザ内） ---------- */
  var ALPHA = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  function makeCode() { var s = ''; for (var i = 0; i < 4; i++) s += ALPHA[Math.floor(Math.random() * ALPHA.length)]; return s; }
  function uid() { return Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4); }

  var Sig = null;
  function firebaseSig() {
    if (!window.firebase || !firebase.database) return null;
    var app;
    try { app = firebase.apps && firebase.apps.length ? firebase.app() : firebase.initializeApp(FIREBASE); } catch (e) { return null; }
    var db = firebase.database(app);
    var root = db.ref('np/' + GAME);
    return {
      kind: 'firebase',
      createRoom: function () {
        var tries = 0;
        function attempt() {
          var code = makeCode();
          var ref = root.child(code);
          return ref.child('h').transaction(function (cur) { return cur ? undefined : { t: firebase.database.ServerValue.TIMESTAMP }; })
            .then(function (res) {
              if (!res.committed) { if (++tries > 6) throw new Error('busy'); return attempt(); }
              ref.onDisconnect().remove();
              return { code: code, ref: ref };
            });
        }
        return attempt().then(function (r) {
          var ref = r.ref;
          return {
            code: r.code,
            onGuest: function (cb) {
              ref.child('g').on('child_added', function (snap) {
                var gid = snap.key, gref = snap.ref;
                var api = {
                  id: gid,
                  onOffer: function (f) { gref.child('o').on('value', function (s) { var v = s.val(); if (v) { gref.child('o').off(); f(v); } }); },
                  sendAnswer: function (sdp) { gref.child('a').set(sdp); },
                  sendCand: function (c) { gref.child('hi').push(c); },
                  onCand: function (f) { gref.child('gi').on('child_added', function (s) { f(s.val()); }); },
                  reject: function (why) { gref.child('x').set(why); },
                  close: function () { gref.child('gi').off(); gref.off(); }
                };
                cb(api);
              });
              ref.child('g').on('child_removed', function (snap) { Host.guestGone(snap.key); });
            },
            close: function () { ref.child('g').off(); ref.onDisconnect().cancel(); ref.remove(); }
          };
        });
      },
      join: function (code) {
        var ref = root.child(code);
        return ref.child('h').once('value').then(function (s) {
          if (!s.exists()) throw new Error('noroom');
          var gref = ref.child('g').push();
          gref.onDisconnect().remove();
          return {
            sendOffer: function (sdp) { gref.child('o').set(sdp); },
            onAnswer: function (f) { gref.child('a').on('value', function (s) { var v = s.val(); if (v) { gref.child('a').off(); f(v); } }); },
            sendCand: function (c) { gref.child('gi').push(c); },
            onCand: function (f) { gref.child('hi').on('child_added', function (s) { f(s.val()); }); },
            onReject: function (f) { gref.child('x').on('value', function (s) { if (s.val()) f(s.val()); }); },
            onRoomGone: function (f) { ref.child('h').on('value', function (s) { if (!s.exists()) f(); }); },
            close: function () { gref.child('hi').off(); gref.child('x').off(); ref.child('h').off(); gref.onDisconnect().cancel(); gref.remove(); }
          };
        });
      }
    };
  }
  function localSig() {
    if (!window.BroadcastChannel) return null;
    var bc = new BroadcastChannel('np-' + GAME);
    var me = uid(), handlers = [];
    bc.onmessage = function (e) { var m = e.data; if (!m || (m.to && m.to !== me)) return; handlers.slice().forEach(function (h) { h(m); }); };
    function send(m) { m.from = me; bc.postMessage(m); }
    function on(f) { handlers.push(f); return function () { var i = handlers.indexOf(f); if (i >= 0) handlers.splice(i, 1); }; }
    return {
      kind: 'local',
      createRoom: function () {
        var code = makeCode();
        var guests = {};
        on(function (m) {
          if (m.room !== code) return;
          if (m.type === 'ping') send({ type: 'pong', to: m.from, room: code });
          else if (m.type === 'offer') { var g = guests[m.from]; if (!g) return; g.offerF ? g.offerF(m.data) : (g.offer = m.data); }
          else if (m.type === 'gcand') { var g2 = guests[m.from]; if (g2) { g2.candF ? g2.candF(m.data) : g2.cands.push(m.data); } }
          else if (m.type === 'leave') { delete guests[m.from]; Host.guestGone(m.from); }
          else if (m.type === 'hello') {
            var gid = m.from; var g3 = guests[gid] = { cands: [] };
            var api = {
              id: gid,
              onOffer: function (f) { if (g3.offer) f(g3.offer); else g3.offerF = f; },
              sendAnswer: function (sdp) { send({ type: 'answer', to: gid, room: code, data: sdp }); },
              sendCand: function (c) { send({ type: 'hcand', to: gid, room: code, data: c }); },
              onCand: function (f) { g3.candF = f; g3.cands.splice(0).forEach(f); },
              reject: function (why) { send({ type: 'reject', to: gid, room: code, data: why }); },
              close: function () {}
            };
            if (onGuestCb) onGuestCb(api);
          }
        });
        var onGuestCb = null;
        return Promise.resolve({
          code: code,
          onGuest: function (cb) { onGuestCb = cb; },
          close: function () { send({ type: 'gone', room: code }); }
        });
      },
      join: function (code) {
        return new Promise(function (res, rej) {
          var off = on(function (m) { if (m.type === 'pong' && m.room === code) { off(); clearTimeout(t); ok(); } });
          var t = setTimeout(function () { off(); rej(new Error('noroom')); }, 1500);
          send({ type: 'ping', room: code });
          function ok() {
            var ansF = null, candF = null, cands = [], rejF = null, goneF = null;
            on(function (m) {
              if (m.room !== code) return;
              if (m.type === 'answer' && ansF) ansF(m.data);
              else if (m.type === 'hcand') { candF ? candF(m.data) : cands.push(m.data); }
              else if (m.type === 'reject' && rejF) rejF(m.data);
              else if (m.type === 'gone' && goneF) goneF();
            });
            send({ type: 'hello', room: code });
            res({
              sendOffer: function (sdp) { send({ type: 'offer', room: code, data: sdp }); },
              onAnswer: function (f) { ansF = f; },
              sendCand: function (c) { send({ type: 'gcand', room: code, data: c }); },
              onCand: function (f) { candF = f; cands.splice(0).forEach(f); },
              onReject: function (f) { rejF = f; },
              onRoomGone: function (f) { goneF = f; },
              close: function () { send({ type: 'leave', room: code }); }
            });
          }
        });
      }
    };
  }
  function getSig() {
    if (Sig) return Sig;
    Sig = LOCAL ? localSig() : firebaseSig();
    return Sig;
  }
  function candJSON(c) { return c && c.toJSON ? c.toJSON() : c; }

  /* ---------- HTMLで描かれたメニューを参加者に写す ---------- */
  var MIRROR_SEL = DS.mirror || '';
  var Mirror = {
    last: '', obs: null, pending: false,
    start: function () {
      if (!MIRROR_SEL || this.obs || !window.MutationObserver) return;
      var self = this;
      this.obs = new MutationObserver(function () { self.kick(); });
      this.obs.observe(document.body, { subtree: true, childList: true, attributes: true, characterData: true });
      this.kick();
      setInterval(function () { self.kick(); }, 1000);
    },
    kick: function () {
      if (this.pending) return; this.pending = true;
      var self = this;
      setTimeout(function () { self.pending = false; if (Host.room) self.send(); }, 120);
    },
    build: function () {
      var nodes = Array.prototype.filter.call(document.querySelectorAll(MIRROR_SEL), function (n) { return !(n.closest && n.closest('.np-ui')); });
      var budget = 600000;
      return nodes.map(function (n) {
        var c = n.cloneNode(true);
        var oc = n.querySelectorAll('canvas'), cc = c.querySelectorAll('canvas');
        for (var i = 0; i < oc.length && i < cc.length; i++) {
          var o = oc[i], img = document.createElement('img');
          for (var a = 0; a < o.attributes.length; a++) { var at = o.attributes[a]; try { img.setAttribute(at.name, at.value); } catch (e) {} }
          if (o.width * o.height <= 200000 && budget > 0) { try { var u = o.toDataURL('image/png'); budget -= u.length; img.src = u; } catch (e) {} }
          cc[i].parentNode.replaceChild(img, cc[i]);
        }
        var oi = n.querySelectorAll('input,select,textarea'), ci = c.querySelectorAll('input,select,textarea');
        for (var j = 0; j < oi.length && j < ci.length; j++) {
          var e1 = oi[j], e2 = ci[j];
          if (e1.tagName === 'SELECT') { Array.prototype.forEach.call(e2.options, function (op, k) { if (k === e1.selectedIndex) op.setAttribute('selected', ''); else op.removeAttribute('selected'); }); }
          else if (e1.tagName === 'TEXTAREA') e2.textContent = e1.value;
          else if (e1.type === 'checkbox' || e1.type === 'radio') { if (e1.checked) e2.setAttribute('checked', ''); else e2.removeAttribute('checked'); }
          else e2.setAttribute('value', e1.value);
        }
        if (document.activeElement && n.contains(document.activeElement)) {
          var path = [], x = document.activeElement;
          while (x && x !== n) { path.unshift(Array.prototype.indexOf.call(x.parentNode.children, x)); x = x.parentNode; }
          var y = c; path.forEach(function (k) { y = y && y.children[k]; });
          if (y) y.setAttribute('data-np-focus', '');
        }
        return c.outerHTML;
      }).join('');
    },
    send: function () {
      var h = this.build();
      if (h === this.last) return;
      this.last = h;
      Host.broadcastUI(h);
    }
  };

  /* ---------- ホスト ---------- */
  var Host = {
    room: null, guests: {}, videoTrack: null, audioTrack: null, canvas: null, order: 0,
    start: function () {
      var sig = getSig();
      if (!sig) return Promise.reject(new Error('nosig'));
      var cv = COMPOSITE ? makeCompositor() : pickCanvas();
      if (!cv || !cv.captureStream) return Promise.reject(new Error('nocapture'));
      this.canvas = cv;
      Mirror.start();
      var st = cv.captureStream(FPS);
      this.videoTrack = st.getVideoTracks()[0];
      if (cv.__start) cv.__start();
      try { this.videoTrack.contentHint = 'detail'; } catch (e) {}
      audioTap = true;
      ctxOut.forEach(function (e) { if (window.__NP_connect) window.__NP_connect(e); });
      var self = this;
      return sig.createRoom().then(function (room) {
        self.room = room;
        room.onGuest(function (api) { self.addGuest(api); });
        return room.code;
      });
    },
    setAudio: function (t) {
      this.audioTrack = t;
      for (var k in this.guests) { var g = this.guests[k]; if (g.audioSender) g.audioSender.replaceTrack(t).catch(function () {}); }
    },
    usedSlots: function () { var s = {}; for (var k in this.guests) s[this.guests[k].slot] = 1; return s; },
    addGuest: function (api) {
      var self = this;
      if (Object.keys(this.guests).length >= MAX_GUESTS) { api.reject('full'); return; }
      var used = this.usedSlots(); var slot = 0; while (used[slot]) slot++;
      var g = { id: api.id, api: api, slot: slot, pc: null, dc: null, pad: null, ping: null, state: 'つないでいます', order: ++this.order };
      this.guests[api.id] = g;
      var pc = g.pc = new RTCPeerConnection({ iceServers: ICE });
      pc.onicecandidate = function (e) { if (e.candidate) api.sendCand(candJSON(e.candidate)); };
      api.onCand(function (c) { pc.addIceCandidate(c).catch(function () {}); });
      pc.ondatachannel = function (e) {
        if (e.channel.label === 'ui') {
          var uc = g.ui = e.channel;
          uc.onopen = function () { if (Mirror.last) { try { uc.send(JSON.stringify({ t: 'ui', h: Mirror.last })); } catch (x) {} } };
          return;
        }
        var dc = g.dc = e.channel;
        dc.onmessage = function (m) { self.onMsg(g, m.data); };
        dc.onopen = function () { self.sendInfo(); };
      };
      pc.onconnectionstatechange = function () {
        var s = pc.connectionState;
        if (s === 'connected') { g.state = 'つながりました'; if (!g.pad) g.pad = addVPad(g.slot + 2); tuneSender(g.videoSender, self.canvas, g.q); }
        else if (s === 'failed') { g.state = 'つながりませんでした'; self.drop(g.id); }
        else if (s === 'disconnected') g.state = '通信が不安定です';
        UI.refresh();
      };
      api.onOffer(function (sdp) {
        try { sdp = { type: sdp.type, sdp: boostSDP(sdp.sdp) }; } catch (e) {}
        pc.setRemoteDescription(sdp).then(function () {
          pc.getTransceivers().forEach(function (t) {
            var kind = t.receiver && t.receiver.track && t.receiver.track.kind;
            if (kind === 'video' && !g.videoSender) { t.direction = 'sendonly'; g.videoSender = t.sender; t.sender.replaceTrack(self.videoTrack); }
            else if (kind === 'audio' && !g.audioSender) { t.direction = 'sendonly'; g.audioSender = t.sender; if (self.audioTrack) t.sender.replaceTrack(self.audioTrack); }
          });
          return pc.createAnswer();
        }).then(function (ans) { return pc.setLocalDescription(ans); })
          .then(function () { api.sendAnswer({ type: pc.localDescription.type, sdp: pc.localDescription.sdp }); })
          .catch(function (e) { console.warn('[netplay] answer', e); g.state = 'エラー'; UI.refresh(); });
      });
      UI.refresh();
    },
    onMsg: function (g, raw) {
      var m; try { m = JSON.parse(raw); } catch (e) { return; }
      if (m.t === 's' && g.pad) g.pad.setState(m.b | 0, m.a);
      else if (m.t === 'qq') { g.q = QUALITY[m.k] ? m.k : null; tuneSender(g.videoSender, this.canvas, g.q); }
      else if (m.t === 'p') { try { g.dc.send(JSON.stringify({ t: 'q', ts: m.ts })); } catch (e) {} if (typeof m.r === 'number') { g.ping = m.r; UI.refresh(); } }
    },
    broadcastUI: function (h) {
      var msg = JSON.stringify({ t: 'ui', h: h });
      if (msg.length > 250000) msg = JSON.stringify({ t: 'ui', h: h.replace(/src="data:[^"]*"/g, '') });
      for (var k in this.guests) { var g = this.guests[k]; if (g.ui && g.ui.readyState === 'open') { try { g.ui.send(msg); } catch (e) {} } }
    },
    sendInfo: function () {
      var list = this.list();
      for (var k in this.guests) {
        var g = this.guests[k];
        if (g.dc && g.dc.readyState === 'open') { try { g.dc.send(JSON.stringify({ t: 'i', slot: g.slot, n: list.length + 1 })); } catch (e) {} }
      }
    },
    list: function () { var a = []; for (var k in this.guests) a.push(this.guests[k]); a.sort(function (x, y) { return x.slot - y.slot; }); return a; },
    drop: function (id) {
      var g = this.guests[id]; if (!g) return;
      delete this.guests[id];
      try { g.pc.close(); } catch (e) {}
      try { g.api.close(); } catch (e) {}
      if (g.pad) removeVPad(g.pad);
      this.sendInfo(); UI.refresh();
    },
    guestGone: function (id) { this.drop(id); },
    stop: function () {
      for (var k in this.guests) this.drop(k);
      if (this.room) { try { this.room.close(); } catch (e) {} }
      this.room = null;
      if (this.videoTrack) { try { this.videoTrack.stop(); } catch (e) {} this.videoTrack = null; }
    }
  };
  function boostSDP(sdp) {
    var kb = Math.round(BITRATE / 1000), start = Math.round(kb * 0.6), min = Math.round(kb * 0.25);
    var extra = 'x-google-start-bitrate=' + start + ';x-google-min-bitrate=' + min + ';x-google-max-bitrate=' + kb;
    var sections = sdp.split(/(?=\r?\nm=)/);
    return sections.map(function (sec) {
      if (!/^\r?\n?m=video/.test(sec)) return sec;
      var nl = sec.indexOf('\r\n') >= 0 ? '\r\n' : '\n';
      var pts = []; var re = /a=rtpmap:(\d+) (VP8|VP9|H264|AV1)\/90000/g, m;
      while ((m = re.exec(sec))) pts.push(m[1]);
      pts.forEach(function (pt) {
        var fre = new RegExp('a=fmtp:' + pt + ' ([^\\r\\n]*)');
        if (fre.test(sec)) sec = sec.replace(fre, function (all, prm) { return /x-google-start/.test(prm) ? all : 'a=fmtp:' + pt + ' ' + prm + ';' + extra; });
        else sec = sec.replace(new RegExp('(a=rtpmap:' + pt + ' [^\\r\\n]*)'), '$1' + nl + 'a=fmtp:' + pt + ' ' + extra);
      });
      return sec;
    }).join('');
  }
  function tuneSender(sender, cv, q) {
    if (!sender || !sender.getParameters) return;
    var mh = q && QUALITY[q] ? QUALITY[q].h : MAX_H, br = q && QUALITY[q] ? QUALITY[q].br : BITRATE;
    try {
      var p = sender.getParameters();
      if (!p.encodings || !p.encodings.length) p.encodings = [{}];
      var h = cv ? cv.height : mh;
      p.encodings[0].maxBitrate = br;
      p.encodings[0].maxFramerate = FPS;
      p.encodings[0].scaleResolutionDownBy = Math.max(1, h / mh);
      p.degradationPreference = 'balanced';
      sender.setParameters(p).catch(function () {});
    } catch (e) {}
  }
  function makeCompositor() {
    var list = DS.canvas.split(',').map(function (q) { return document.querySelector(q.trim()); }).filter(Boolean);
    if (!list.length) return null;
    var out = document.createElement('canvas');
    var g = out.getContext('2d');
    function size() {
      var b = list[0], w = b.width || 1280, h = b.height || 720;
      var k = Math.min(1, MAX_H / h); w = Math.round(w * k); h = Math.round(h * k);
      if (out.width !== w || out.height !== h) { out.width = w; out.height = h; }
    }
    size();
    function draw() {
      if (!Host.videoTrack) return;
      size();
      g.fillStyle = '#000'; g.fillRect(0, 0, out.width, out.height);
      list.forEach(function (c) {
        if (!c.width || !c.height) return;
        var cs = getComputedStyle(c); if (cs.display === 'none' || cs.visibility === 'hidden') return;
        try { g.drawImage(c, 0, 0, out.width, out.height); } catch (e) {}
      });
      realRAF(draw);
    }
    out.__start = function () { realRAF(draw); };
    g.fillStyle = '#000'; g.fillRect(0, 0, out.width, out.height);
    return out;
  }
  function pickCanvas() {
    if (DS.canvas) { var c = document.querySelector(DS.canvas); if (c) return c; }
    var best = null, area = 0;
    Array.prototype.forEach.call(document.querySelectorAll('canvas'), function (c) {
      if (c.closest && c.closest('.np-ui')) return;
      var a = c.width * c.height;
      var r = c.getBoundingClientRect();
      if (r.width < 50 || r.height < 50) a = a / 100;
      if (a > area) { area = a; best = c; }
    });
    return best;
  }

  /* ---------- 参加者 ---------- */
  var Guest = {
    pc: null, dc: null, sig: null, slot: -1, n: 0, ping: null, timer: 0, lastSent: '', video: null, code: '',
    join: function (code) {
      var sig = getSig();
      if (!sig) return Promise.reject(new Error('nosig'));
      var self = this;
      this.code = code;
      return sig.join(code).then(function (s) {
        self.sig = s;
        enterGuestMode();
        var pc = self.pc = new RTCPeerConnection({ iceServers: ICE });
        pc.addTransceiver('video', { direction: 'recvonly' });
        pc.addTransceiver('audio', { direction: 'recvonly' });
        var dc = self.dc = pc.createDataChannel('in', { ordered: false, maxRetransmits: 0 });
        dc.onopen = function () { self.startSending(); UI.guestStatus('つながりました'); self.sendQuality(); };
        dc.onmessage = function (m) { self.onMsg(m.data); };
        var uc = pc.createDataChannel('ui', { ordered: true });
        uc.onmessage = function (m) { self.onMsg(m.data); };
        var ms = new MediaStream();
        pc.ontrack = function (e) {
          ms.addTrack(e.track);
          try { if (e.receiver && 'jitterBufferTarget' in e.receiver) e.receiver.jitterBufferTarget = 0; } catch (x) {}
          try { if (e.receiver && 'playoutDelayHint' in e.receiver) e.receiver.playoutDelayHint = 0; } catch (x) {}
          UI.attachVideo(ms);
        };
        pc.onicecandidate = function (e) { if (e.candidate) s.sendCand(candJSON(e.candidate)); };
        s.onCand(function (c) { pc.addIceCandidate(c).catch(function () {}); });
        s.onAnswer(function (a) { pc.setRemoteDescription(a).catch(function (e) { console.warn('[netplay] remote', e); }); });
        s.onReject(function (why) { UI.guestFail(why === 'full' ? 'この部屋は満員です（最大' + (MAX_GUESTS + 1) + '人）。' : '参加できませんでした。'); self.leave(true); });
        s.onRoomGone(function () { UI.guestFail('ホストが部屋を閉じました。'); self.leave(true); });
        pc.onconnectionstatechange = function () {
          var st = pc.connectionState;
          if (st === 'failed') { UI.guestFail('つながりませんでした。回線の組み合わせによっては直接つながらないことがあります。Wi-Fiを切り替えるか、別の回線で試してください。'); self.leave(true); }
          else if (st === 'disconnected') UI.guestStatus('通信が不安定です…');
          else if (st === 'connected') UI.guestStatus('つながりました');
        };
        return pc.createOffer().then(function (o) { return pc.setLocalDescription(o); })
          .then(function () { s.sendOffer({ type: pc.localDescription.type, sdp: pc.localDescription.sdp }); });
      });
    },
    onMsg: function (raw) {
      var m; try { m = JSON.parse(raw); } catch (e) { return; }
      if (m.t === 'q') { this.ping = Math.round(performance.now() - m.ts); UI.guestPing(this.ping); }
      else if (m.t === 'i') { this.slot = m.slot; this.n = m.n; UI.guestInfo(m.slot, m.n); }
      else if (m.t === 'ui') UI.mirror(m.h || '');
    },
    sendQuality: function () {
      var k = null; try { k = localStorage.getItem('np-gq'); } catch (e) {}
      if (this.dc && this.dc.readyState === 'open') { try { this.dc.send(JSON.stringify({ t: 'qq', k: QUALITY[k] ? k : null })); } catch (e) {} }
    },
    startSending: function () {
      var self = this;
      clearInterval(this.timer);
      var pingT = 0;
      this.timer = setInterval(function () {
        if (!self.dc || self.dc.readyState !== 'open') return;
        var st = GuestInput.read();
        var msg = JSON.stringify({ t: 's', b: st.b, a: st.a });
        try { self.dc.send(msg); } catch (e) {}
        if (++pingT >= 60) { pingT = 0; try { self.dc.send(JSON.stringify({ t: 'p', ts: performance.now(), r: self.ping })); } catch (e) {} }
      }, 16);
      GuestInput.onChange = function () {
        if (!self.dc || self.dc.readyState !== 'open') return;
        var st = GuestInput.read();
        try { self.dc.send(JSON.stringify({ t: 's', b: st.b, a: st.a })); } catch (e) {}
      };
    },
    leave: function (silent) {
      clearInterval(this.timer); GuestInput.onChange = null;
      if (this.pc) { try { this.pc.close(); } catch (e) {} this.pc = null; }
      if (this.sig) { try { this.sig.close(); } catch (e) {} this.sig = null; }
      if (!silent) location.href = location.pathname;
    }
  };
  function enterGuestMode() {
    freezeGame = true;
    ctxOut.forEach(function (e) { try { e.ctx.suspend(); } catch (x) {} });
    document.documentElement.classList.add('np-guest');
  }

  /* ---------- 参加者の入力（キーボード・タッチ・コントローラー → 標準コントローラー形式） ---------- */
  var KEYMAP = {
    ArrowUp: [12], KeyW: [12], ArrowDown: [13], KeyS: [13], ArrowLeft: [14], KeyA: [14], ArrowRight: [15], KeyD: [15],
    Space: [0], Enter: [0], KeyF: [0], KeyG: [1], ShiftLeft: [1], Backspace: [1]
  };
  var KEYHELP = DS.keyhelp || '移動：WASD / 矢印　A：Space / Enter　B：G / Shift';
  try { if (DS.keys) { var km = JSON.parse(DS.keys); KEYMAP = {}; for (var kk in km) KEYMAP[kk] = [].concat(km[kk]); } } catch (e) { console.warn('[netplay] data-keys', e); }
  var MENUKEYS = { Escape: 1, KeyP: 1 };
  var menuOpen = false;
  var GuestInput = {
    keys: 0, touch: 0, onChange: null,
    padPrev: 0,
    read: function () {
      var b = this.keys | this.touch, a = [0, 0, 0, 0];
      var gps = []; try { gps = realGet() || []; } catch (e) {}
      for (var i = 0; i < gps.length; i++) {
        var g = gps[i]; if (!g || !g.connected) continue;
        for (var j = 0; j < Math.min(NB, g.buttons.length); j++) { var bt = g.buttons[j]; if (bt && (bt.pressed || bt.value > 0.5)) b |= (1 << j); }
        for (var k = 0; k < 4; k++) a[k] = Math.round((g.axes[k] || 0) * 100) / 100;
        break;
      }
      // コントローラーの START / SELECT は自分用メニュー（ゲームには送らない）
      var mb = b & ((1 << 8) | (1 << 9));
      if (mb && !(this.padPrev & mb)) UI.toggleMenu();
      this.padPrev = mb;
      b &= ~((1 << 8) | (1 << 9));
      if (menuOpen) return { b: 0, a: [0, 0, 0, 0] };
      return { b: b, a: a };
    }
  };
  function guestKey(e, down) {
    if (!document.documentElement.classList.contains('np-guest')) return;
    var t = e.target; if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA')) return;
    if (MENUKEYS[e.code]) { e.preventDefault(); e.stopImmediatePropagation(); if (down && !e.repeat) UI.toggleMenu(); return; }
    var list = KEYMAP[e.code]; if (!list) return;
    e.preventDefault(); e.stopImmediatePropagation();
    var before = GuestInput.keys;
    list.forEach(function (i) { if (down) GuestInput.keys |= (1 << i); else GuestInput.keys &= ~(1 << i); });
    if (before !== GuestInput.keys && GuestInput.onChange) GuestInput.onChange();
  }
  window.addEventListener('keydown', function (e) { guestKey(e, true); }, true);
  window.addEventListener('keyup', function (e) { guestKey(e, false); }, true);
  window.addEventListener('blur', function () { GuestInput.keys = 0; GuestInput.touch = 0; });

  /* ---------- 画面（ロビー・ホストの表示・参加者の画面） ---------- */
  var CSS = [
    '.np-ui{--np-bg:#141826;--np-panel:#1f2537;--np-line:#38415c;--np-fg:#f3f5fa;--np-mute:#a3abc2;--np-acc:#ffcc33;--np-ok:#4fd18b;--np-bad:#ff6b5e;',
    'font-family:"M PLUS Rounded 1c","Hiragino Maru Gothic ProN","Hiragino Sans","Yu Gothic",system-ui,sans-serif;color:var(--np-fg);-webkit-user-select:none;user-select:none;-webkit-tap-highlight-color:transparent}',
    '.np-fab,.np-card,.np-card *,.np-gbar,.np-gbar *,.np-pad,.np-pad *{box-sizing:border-box}',
    '.np-fab,.np-card button,.np-gbar button,.np-pad button{font:inherit;color:inherit;cursor:pointer}',
    '.np-fab:focus-visible,.np-card button:focus-visible,.np-gbar button:focus-visible,.np-card input:focus-visible{outline:2px solid var(--np-acc);outline-offset:2px}',
    '.np-fab{position:fixed;z-index:2147483000;font-weight:800;font-size:13px;background:rgba(20,24,38,.82);border:1px solid rgba(255,255,255,.3);border-radius:999px;padding:7px 13px;display:flex;align-items:center;gap:7px;backdrop-filter:blur(4px);-webkit-backdrop-filter:blur(4px)}',
    '.np-fab .np-dot{width:8px;height:8px;border-radius:50%;background:var(--np-mute)}',
    '.np-fab.on .np-dot{background:var(--np-ok);box-shadow:0 0 0 3px rgba(79,209,139,.25)}',
    '.np-tl{top:calc(env(safe-area-inset-top,0px) + 8px);left:max(12px,env(safe-area-inset-left,0px))}',
    '.np-tr{top:calc(env(safe-area-inset-top,0px) + 8px);right:max(12px,env(safe-area-inset-right,0px))}',
    '.np-bl{bottom:calc(env(safe-area-inset-bottom,0px) + 8px);left:max(12px,env(safe-area-inset-left,0px))}',
    '.np-br{bottom:calc(env(safe-area-inset-bottom,0px) + 8px);right:max(12px,env(safe-area-inset-right,0px))}',
    '.np-modal{position:fixed;inset:0;z-index:2147483001;display:grid;place-items:center;background:rgba(8,10,18,.6);padding:16px max(16px,env(safe-area-inset-right,0px)) 16px max(16px,env(safe-area-inset-left,0px))}',
    '.np-card{width:min(100%,420px);max-height:100%;overflow:auto;background:var(--np-panel);border:1px solid var(--np-line);border-radius:16px;padding:20px;display:flex;flex-direction:column;gap:14px;box-shadow:0 20px 50px rgba(0,0,0,.45)}',
    '.np-card h2{margin:0;font-size:20px;font-weight:800}',
    '.np-card p{margin:0;color:var(--np-mute);font-size:13px;line-height:1.6}',
    '.np-row{display:flex;gap:10px;flex-wrap:wrap}',
    '.np-btn{flex:1 1 140px;min-height:48px;border-radius:12px;border:1px solid var(--np-line);background:#2a3149;font-weight:800;font-size:15px;padding:10px 12px}',
    '.np-btn.pri{background:var(--np-acc);color:#1d1606;border-color:var(--np-acc)}',
    '.np-btn.ghost{background:transparent}',
    '.np-btn:disabled{opacity:.5;cursor:default}',
    '.np-code{font-size:44px;font-weight:800;letter-spacing:.18em;text-align:center;font-variant-numeric:tabular-nums;background:var(--np-bg);border-radius:12px;padding:10px 0;border:1px dashed var(--np-line)}',
    '.np-in{width:100%;font:800 30px/1.2 inherit;letter-spacing:.3em;text-align:center;text-transform:uppercase;background:var(--np-bg);color:var(--np-fg);border:1px solid var(--np-line);border-radius:12px;padding:10px}',
    '.np-link{font-size:12px;color:var(--np-mute);word-break:break-all;background:var(--np-bg);border-radius:8px;padding:8px 10px}',
    '.np-list{display:flex;flex-direction:column;gap:6px;margin:0;padding:0;list-style:none}',
    '.np-list li{display:flex;justify-content:space-between;align-items:center;gap:8px;background:var(--np-bg);border-radius:10px;padding:9px 12px;font-size:14px}',
    '.np-list small{color:var(--np-mute);font-variant-numeric:tabular-nums}',
    '.np-q{display:flex;flex-direction:column;gap:6px}',
    '.np-q>span{font-size:13px;font-weight:800}',
    '.np-q .np-btn{flex:1 1 90px;min-height:40px;font-size:13px;padding:6px 8px}',
    '.np-me{position:absolute;inset:0;z-index:5;display:grid;place-items:center;background:rgba(8,10,18,.55);padding:12px max(12px,env(safe-area-inset-right,0px)) 12px max(12px,env(safe-area-inset-left,0px));overflow:auto}',
    '.np-lab{font-size:13px;font-weight:800;display:flex;justify-content:space-between}',
    '.np-range{width:100%;accent-color:#ffcc33}',
    '.np-keys{font-size:12px!important}',
    '.np-err{color:var(--np-bad)!important}',
    'html.np-guest,html.np-guest body{overflow:hidden!important}',
    '.np-gv{position:fixed;inset:0;z-index:2147482999;background:#000;display:flex;flex-direction:column}',
    '.np-gbar{display:flex;align-items:center;gap:8px;padding:calc(env(safe-area-inset-top,0px) + 6px) max(12px,env(safe-area-inset-right,0px)) 6px max(12px,env(safe-area-inset-left,0px));font-size:13px;font-weight:800;background:#0c0f18;flex-wrap:wrap}',
    '.np-gbar .np-sp{flex:1}',
    '.np-gbar button{border:1px solid #3a4260;background:#1c2236;border-radius:8px;padding:5px 10px;font-size:12px;font-weight:800}',
    '.np-chip{background:#1c2236;border-radius:999px;padding:3px 10px;font-variant-numeric:tabular-nums}',
    '.np-stage{position:relative;flex:1 1 0;min-height:0;overflow:hidden;background:#000}',
    '.np-stage video{position:absolute;inset:0;width:100%;height:100%;max-width:none;object-fit:contain;background:#000}',
    '.np-stage.fill video{object-fit:cover}',
    '.np-snd{position:absolute;z-index:4;left:50%;top:14px;transform:translateX(-50%);background:#ffcc33;color:#1d1606;border:0;border-radius:999px;padding:10px 18px;font:800 15px/1.2 inherit;box-shadow:0 4px 14px rgba(0,0,0,.45);cursor:pointer}',
    '.np-snd[hidden]{display:none}',
    '.np-mirror{position:absolute;inset:0;z-index:1;transform:translateZ(0);pointer-events:none;overflow:hidden}',
    '.np-mirror [data-np-focus]{outline:3px solid #ffcc33;outline-offset:2px}',
    '.np-msg{position:absolute;inset:0;z-index:2;display:grid;place-items:center;text-align:center;padding:24px;font-size:15px;line-height:1.7;color:var(--np-mute);pointer-events:none}',
    '.np-pad{position:absolute;z-index:3;left:0;right:0;bottom:0;display:flex;justify-content:space-between;align-items:flex-end;padding:0 max(14px,env(safe-area-inset-right,0px)) calc(env(safe-area-inset-bottom,0px) + 12px) max(14px,env(safe-area-inset-left,0px));pointer-events:none}',
    '.np-gv .np-pad button{pointer-events:auto;touch-action:none;background:rgba(12,16,30,.5);border:2px solid rgba(255,255,255,.7);color:#fff;font-weight:800;border-radius:12px;box-shadow:0 1px 4px rgba(0,0,0,.4)}',
    '.np-pad button.on{background:rgba(255,204,51,.6)}',
    '.np-dp{position:relative;width:150px;height:150px}',
    '.np-dp button{position:absolute;width:50px;height:50px}',
    '.np-dp [data-npb="12"]{left:50px;top:0}.np-dp [data-npb="13"]{left:50px;bottom:0}.np-dp [data-npb="14"]{left:0;top:50px}.np-dp [data-npb="15"]{right:0;top:50px}',
    '.np-face{position:relative;width:170px;height:170px}',
    '.np-face button{position:absolute;width:58px;height:58px;border-radius:50%;font-size:18px}',
    '.np-face [data-npb="0"]{left:56px;bottom:0}.np-face [data-npb="1"]{right:0;top:56px}.np-face [data-npb="2"]{left:0;top:56px}.np-face [data-npb="3"]{left:56px;top:0}',
    '.np-mid{display:flex;flex-direction:column;gap:8px;align-items:center;padding-bottom:10px}',
    '.np-mid .np-r{display:flex;gap:8px}',
    '.np-mid button{min-width:52px;height:34px;font-size:12px;border-radius:999px}',
    '@media (max-height:420px){.np-dp{transform:scale(.8);transform-origin:left bottom}.np-face{transform:scale(.8);transform-origin:right bottom}}',
    '@media (prefers-reduced-motion:reduce){.np-ui *{transition:none!important}}'
  ].join('\n');

  function el(tag, cls, html) { var e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; }
  function esc(s) { return String(s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function slotName(slot) { return (slot + 2) + 'P'; }

  var UI = {
    fab: null, modal: null, gv: null, mode: 'idle', open: false,
    init: function () {
      var st = el('style'); st.textContent = CSS; document.head.appendChild(st);
      var fab = this.fab = el('button', 'np-ui np-fab np-' + POS, '<span class="np-dot"></span><span class="np-t">オンライン</span>');
      fab.type = 'button'; fab.setAttribute('aria-label', 'オンライン対戦');
      fab.addEventListener('click', function (e) { e.stopPropagation(); UI.show(); });
      fab.addEventListener('pointerdown', function (e) { e.stopPropagation(); });
      document.body.appendChild(fab);
      var j = (QS.get('join') || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 4);
      if (j.length === 4) this.show(j);
    },
    close: function () { if (this.modal) { this.modal.remove(); this.modal = null; } this.open = false; },
    card: function (html) {
      this.close();
      var m = this.modal = el('div', 'np-ui np-modal');
      var c = el('div', 'np-card', html);
      c.setAttribute('role', 'dialog'); c.setAttribute('aria-modal', 'true');
      m.appendChild(c);
      ['keydown', 'keyup', 'pointerdown', 'touchstart'].forEach(function (t) { m.addEventListener(t, function (e) { e.stopPropagation(); }); });
      m.addEventListener('click', function (e) { if (e.target === m && UI.mode !== 'joining') UI.close(); });
      document.body.appendChild(m);
      this.open = true;
      return c;
    },
    show: function (joinCode) {
      if (this.mode === 'host') return this.hostCard();
      var c = this.card(
        '<h2>オンライン対戦</h2>' +
        '<p>ホストの画面と音を、参加した人の端末に映して遊びます。参加した人の操作は、ホストのゲームでコントローラーとして扱われます。</p>' +
        '<div class="np-row"><button class="np-btn pri" data-npa="host" type="button">部屋を作る</button></div>' +
        '<label for="np-code" style="font-size:13px;font-weight:800">部屋コードで参加</label>' +
        '<input id="np-code" class="np-in" maxlength="4" autocomplete="off" autocapitalize="characters" spellcheck="false" placeholder="ABCD">' +
        '<div class="np-row"><button class="np-btn" data-npa="join" type="button">参加する</button><button class="np-btn ghost" data-npa="x" type="button">閉じる</button></div>' +
        '<p class="np-note"></p>');
      var inp = c.querySelector('#np-code'), note = c.querySelector('.np-note');
      if (joinCode) inp.value = joinCode;
      inp.addEventListener('input', function () { inp.value = inp.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 4); });
      inp.addEventListener('keydown', function (e) { if (e.key === 'Enter') go(); });
      c.querySelector('[data-npa=x]').onclick = function () { UI.close(); };
      c.querySelector('[data-npa=host]').onclick = function () {
        var b = this; b.disabled = true; note.className = 'np-note'; note.textContent = '部屋を作っています…';
        Host.start().then(function () { UI.mode = 'host'; UI.fab.classList.add('on'); UI.hostCard(); })
          .catch(function (e) { b.disabled = false; note.className = 'np-note np-err'; note.textContent = errText(e); });
      };
      function go() {
        var code = inp.value.trim();
        if (code.length !== 4) { note.className = 'np-note np-err'; note.textContent = '4文字の部屋コードを入れてください。'; return; }
        var b = c.querySelector('[data-npa=join]'); b.disabled = true; note.className = 'np-note'; note.textContent = '部屋をさがしています…';
        UI.mode = 'joining';
        initGuestAudioUnlock();
        Guest.join(code).then(function () { UI.close(); UI.guestView(code); })
          .catch(function (e) { UI.mode = 'idle'; b.disabled = false; note.className = 'np-note np-err'; note.textContent = errText(e); });
      }
      c.querySelector('[data-npa=join]').onclick = go;
      if (joinCode) setTimeout(function () { inp.focus(); }, 50); else setTimeout(function () { c.querySelector('[data-npa=host]').focus(); }, 50);
    },
    hostCard: function () {
      var code = Host.room ? Host.room.code : '----';
      var url = location.origin + location.pathname + '?join=' + code + (LOCAL ? '&np=local' : '');
      var c = this.card(
        '<h2>部屋ができました</h2>' +
        '<p>友達にこのコードか招待リンクを送ってください。参加した人は 2P・3P・4P のコントローラーになります。</p>' +
        '<div class="np-code" aria-label="部屋コード">' + esc(code) + '</div>' +
        '<div class="np-link">' + esc(url) + '</div>' +
        '<div class="np-row"><button class="np-btn" data-npa="copy" type="button">招待リンクをコピー</button></div>' +
        '<div class="np-q"><span>画質</span><div class="np-row">' +
        ['low', 'std', 'high'].map(function (k) { return '<button class="np-btn' + (k === QKEY ? ' pri' : '') + '" data-npq="' + k + '" type="button">' + QUALITY[k].label + '</button>'; }).join('') +
        '</div><p>友達の回線が遅いと、高画質ではカクつきます。</p></div>' +
        '<ul class="np-list"></ul>' +
        '<div class="np-row"><button class="np-btn pri" data-npa="x" type="button">ゲームにもどる</button><button class="np-btn ghost" data-npa="end" type="button">部屋を閉じる</button></div>' +
        '<p class="np-note"></p>');
      var note = c.querySelector('.np-note');
      c.querySelector('[data-npa=copy]').onclick = function () {
        var done = function () { note.className = 'np-note'; note.textContent = 'コピーしました。'; };
        try { navigator.clipboard.writeText(url).then(done, function () { selectText(c.querySelector('.np-link')); note.textContent = 'リンクを選択しました。長押しでコピーしてください。'; }); }
        catch (e) { selectText(c.querySelector('.np-link')); }
      };
      Array.prototype.forEach.call(c.querySelectorAll('[data-npq]'), function (b) {
        b.onclick = function () {
          QKEY = b.dataset.npq; MAX_H = QUALITY[QKEY].h; BITRATE = QUALITY[QKEY].br;
          try { localStorage.setItem('np-quality', QKEY); } catch (e) {}
          Array.prototype.forEach.call(c.querySelectorAll('[data-npq]'), function (x) { x.classList.toggle('pri', x === b); });
          for (var k in Host.guests) tuneSender(Host.guests[k].videoSender, Host.canvas, Host.guests[k].q);
        };
      });
      c.querySelector('[data-npa=x]').onclick = function () { UI.close(); };
      c.querySelector('[data-npa=end]').onclick = function () { Host.stop(); UI.mode = 'idle'; UI.fab.classList.remove('on'); UI.refresh(); UI.close(); };
      this.refresh();
    },
    refresh: function () {
      if (this.mode === 'host') {
        var n = Host.list().filter(function (g) { return g.pad; }).length;
        this.fab.querySelector('.np-t').textContent = '部屋 ' + (Host.room ? Host.room.code : '') + ' · ' + (n + 1) + '人';
      } else if (this.mode === 'idle') this.fab.querySelector('.np-t').textContent = 'オンライン';
      if (!this.modal) return;
      var ul = this.modal.querySelector('.np-list'); if (!ul) return;
      var rows = '<li><span>1P　ホスト（この端末）</span><small>—</small></li>';
      Host.list().forEach(function (g) {
        rows += '<li><span>' + slotName(g.slot) + '　' + esc(g.state) + '</span><small>' + (g.ping != null ? g.ping + ' ms' : '') + '</small></li>';
      });
      if (!Host.list().length) rows += '<li><span style="color:var(--np-mute)">参加を待っています…</span><small></small></li>';
      ul.innerHTML = rows;
    },
    /* --- 参加者の画面 --- */
    guestView: function (code) {
      this.mode = 'guest';
      this.fab.style.display = 'none';
      var gv = this.gv = el('div', 'np-ui np-gv',
        '<div class="np-gbar"><span class="np-chip">部屋 ' + esc(code) + '</span><span class="np-chip np-slot">接続中</span><span class="np-chip np-ping">— ms</span><span class="np-sp"></span>' +
        '<button type="button" data-npa="menu">メニュー（Esc）</button></div>' +
        '<div class="np-stage"><video playsinline autoplay muted></video><div class="np-mirror" aria-hidden="true"></div><div class="np-msg">ホストにつないでいます…</div><button type="button" class="np-snd" hidden>タップで音を出す</button>' +
        '<div class="np-me" hidden role="dialog" aria-label="自分用メニュー"><div class="np-card">' +
        '<h2>自分用メニュー</h2><p>ここでの設定は、あなたの画面だけに効きます。ほかの人のゲームは止まりません。</p>' +
        '<label class="np-lab" for="np-vol">音量 <span class="np-volv">100</span></label><input id="np-vol" class="np-range" type="range" min="0" max="100" step="5" value="100">' +
        '<div class="np-q"><span>画質</span><div class="np-row">' +
        '<button class="np-btn" data-npgq="" type="button">ホストに合わせる</button>' +
        ['low', 'std', 'high'].map(function (k) { return '<button class="np-btn" data-npgq="' + k + '" type="button">' + QUALITY[k].label + '</button>'; }).join('') +
        '</div></div>' +
        '<div class="np-row"><button class="np-btn" data-npa="fit" type="button">表示：全体</button><button class="np-btn" data-npa="pad" type="button">画面のボタン：表示</button><button class="np-btn" data-npa="fs" type="button">全画面</button></div>' +
        '<p class="np-keys"></p>' +
        '<div class="np-row"><button class="np-btn pri" data-npa="close" type="button">ゲームにもどる</button><button class="np-btn ghost" data-npa="leave" type="button">部屋から出る</button></div>' +
        '</div></div>' +
        '<div class="np-pad" hidden><div class="np-dp"><button data-npb="12" type="button">▲</button><button data-npb="14" type="button">◀</button><button data-npb="15" type="button">▶</button><button data-npb="13" type="button">▼</button></div>' +
        '<div class="np-mid"><div class="np-r"><button data-npb="4" type="button">L</button><button data-npb="5" type="button">R</button></div><div class="np-r"><button data-npb="8" type="button">SELECT</button><button data-npb="9" type="button">START</button></div></div>' +
        '<div class="np-face"><button data-npb="3" type="button">Y</button><button data-npb="2" type="button">X</button><button data-npb="1" type="button">B</button><button data-npb="0" type="button">A</button></div></div></div>');
      document.body.appendChild(gv);
      var v = gv.querySelector('video'); Guest.video = v;
      var big = gv.querySelector('.np-snd');
      function label() { var on = (!v.muted && !v.paused) || !!Vol.gain; big.hidden = on || !v.srcObject || UI._sndOff; }
      // 必ずタップの中から呼ぶ（iPhoneはタップ以外で音を出せない）
      function setSnd(on) {
        UI._sndOff = !on;
        v.muted = !on;
        var p = v.play();
        if (p && p.catch) p.catch(function () { v.muted = true; v.play().catch(function () {}); UI._sndOff = false; label(); });
        label();
      }
      big.onclick = function () { setSnd(true); Vol.apply(); };
      v.addEventListener('volumechange', label); v.addEventListener('play', label); v.addEventListener('pause', label);
      this._sndLabel = label;
      var fit = gv.querySelector('[data-npa=fit]'), stage = gv.querySelector('.np-stage');
      fit.onclick = function () { stage.classList.toggle('fill'); fit.textContent = '表示：' + (stage.classList.contains('fill') ? '拡大' : '全体'); };
      gv.querySelector('[data-npa=menu]').onclick = function () { UI.toggleMenu(); };
      gv.querySelector('[data-npa=close]').onclick = function () { UI.toggleMenu(false); };
      gv.querySelector('.np-keys').textContent = 'キーボード：' + KEYHELP + '　メニュー：Esc / P（コントローラーは START）';
      var vol = gv.querySelector('#np-vol'), volv = gv.querySelector('.np-volv');
      vol.value = Vol.get(); volv.textContent = vol.value;
      vol.addEventListener('input', function () { volv.textContent = vol.value; Vol.set(+vol.value, v); });
      var gq = ''; try { gq = localStorage.getItem('np-gq') || ''; } catch (e) {}
      function markQ() { Array.prototype.forEach.call(gv.querySelectorAll('[data-npgq]'), function (b) { b.classList.toggle('pri', b.dataset.npgq === gq); }); }
      Array.prototype.forEach.call(gv.querySelectorAll('[data-npgq]'), function (b) {
        b.onclick = function () { gq = b.dataset.npgq; try { localStorage.setItem('np-gq', gq); } catch (e) {} markQ(); Guest.sendQuality(); };
      });
      markQ();
      Vol.video = v;
      gv.querySelector('[data-npa=leave]').onclick = function () { Guest.leave(false); };
      gv.querySelector('[data-npa=fs]').onclick = function () { try { if (document.fullscreenElement) document.exitFullscreen(); else gv.requestFullscreen().catch(function () {}); } catch (e) {} };
      var pad = gv.querySelector('.np-pad');
      var coarse = window.matchMedia && matchMedia('(pointer: coarse)').matches;
      pad.hidden = !coarse;
      var padBtn = gv.querySelector('[data-npa=pad]');
      function padLabel() { padBtn.textContent = '画面のボタン：' + (pad.hidden ? '非表示' : '表示'); }
      padBtn.onclick = function () { pad.hidden = !pad.hidden; padLabel(); };
      padLabel();
      Array.prototype.forEach.call(pad.querySelectorAll('button'), function (b) {
        var bit = 1 << (+b.dataset.npb);
        function on(e) { e.preventDefault(); try { b.setPointerCapture(e.pointerId); } catch (x) {} b.classList.add('on'); GuestInput.touch |= bit; if (GuestInput.onChange) GuestInput.onChange(); }
        function off(e) { e.preventDefault(); b.classList.remove('on'); GuestInput.touch &= ~bit; if (GuestInput.onChange) GuestInput.onChange(); }
        b.addEventListener('pointerdown', on); b.addEventListener('pointerup', off); b.addEventListener('pointercancel', off); b.addEventListener('lostpointercapture', off);
        b.addEventListener('contextmenu', function (e) { e.preventDefault(); });
      });
      this._setSnd = setSnd;
    },
    attachVideo: function (ms) {
      if (!this.gv) return;
      var v = this.gv.querySelector('video');
      if (v.srcObject !== ms) v.srcObject = ms;
      var msg = this.gv.querySelector('.np-msg');
      v.onloadeddata = function () { msg.textContent = ''; };
      v.play().catch(function () {});
      if (this._sndLabel) this._sndLabel();
      Vol.video = v; Vol.apply();
    },
    guestStatus: function (s) { if (!this.gv) return; var msg = this.gv.querySelector('.np-msg'); var v = this.gv.querySelector('video'); if (!v.videoWidth) msg.textContent = s === 'つながりました' ? '映像を待っています…' : s; else if (s !== 'つながりました') msg.textContent = s; else msg.textContent = ''; },
    toggleMenu: function (force) {
      if (!this.gv) return;
      var m = this.gv.querySelector('.np-me');
      menuOpen = typeof force === 'boolean' ? force : !menuOpen;
      m.hidden = !menuOpen;
      GuestInput.keys = 0; GuestInput.touch = 0;
      if (GuestInput.onChange) GuestInput.onChange();
      if (menuOpen) { var b = m.querySelector('[data-npa=close]'); if (b) b.focus(); }
    },
    mirror: function (h) {
      if (!this.gv) return; var m = this.gv.querySelector('.np-mirror'); if (!m) return;
      if (!m.__styled) {
        m.__styled = 1;
        try { var bs = getComputedStyle(document.body); m.style.fontFamily = bs.fontFamily; m.style.color = bs.color; m.style.fontSize = bs.fontSize; m.style.lineHeight = bs.lineHeight; m.style.fontWeight = bs.fontWeight; } catch (e) {}
      }
      var t = document.createElement('div'); t.innerHTML = h;
      morph(m, t);
    },
    guestPing: function (ms) { if (this.gv) this.gv.querySelector('.np-ping').textContent = ms + ' ms'; },
    guestInfo: function (slot, n) { if (this.gv) this.gv.querySelector('.np-slot').textContent = 'あなたは ' + slotName(slot) + '（' + n + '人）'; },
    guestFail: function (text) {
      if (this.gv) { var msg = this.gv.querySelector('.np-msg'); msg.innerHTML = '<span class="np-err">' + esc(text) + '</span>'; msg.style.pointerEvents = 'none'; }
      else alertCard(text);
    }
  };
  // 変わったところだけ書き換える（アニメーションが毎回やり直しにならないように）
  function morph(cur, next) {
    var a = cur.childNodes, b = next.childNodes;
    var i = 0;
    for (; i < b.length; i++) {
      var nb = b[i], na = a[i];
      if (!na) { cur.appendChild(nb.cloneNode(true)); continue; }
      if (na.nodeType !== nb.nodeType || na.nodeName !== nb.nodeName || (na.nodeType === 1 && na.id !== nb.id)) { cur.replaceChild(nb.cloneNode(true), na); continue; }
      if (na.nodeType === 3 || na.nodeType === 8) { if (na.nodeValue !== nb.nodeValue) na.nodeValue = nb.nodeValue; continue; }
      if (na.nodeType === 1) {
        var k, at;
        for (k = na.attributes.length - 1; k >= 0; k--) { at = na.attributes[k].name; if (!nb.hasAttribute(at)) na.removeAttribute(at); }
        for (k = 0; k < nb.attributes.length; k++) { at = nb.attributes[k]; if (na.getAttribute(at.name) !== at.value) na.setAttribute(at.name, at.value); }
        morph(na, nb);
      }
    }
    while (a.length > b.length) cur.removeChild(cur.lastChild);
  }
  var Vol = {
    video: null, ctx: null, gain: null, src: null,
    get: function () { var v = 100; try { var x = localStorage.getItem('np-vol'); if (x !== null) v = Math.max(0, Math.min(100, +x)); } catch (e) {} return v; },
    set: function (n) { try { localStorage.setItem('np-vol', n); } catch (e) {} this.apply(); },
    apply: function () {
      var v = this.video; if (!v) return;
      var k = this.get() / 100;
      if (this.gain) { this.gain.gain.value = k; return; }
      try { v.volume = k; } catch (e) {}
      // iPhone は video.volume が効かない（常に1）。100%以外を選んだときだけ WebAudio に切り替える
      if (k < 1 && Math.abs(v.volume - k) > 0.01) this.useWebAudio(k);
    },
    useWebAudio: function (k) {
      var v = this.video;
      try {
        var tr = v.srcObject && v.srcObject.getAudioTracks()[0]; if (!tr) return;
        var A = window.AudioContext || window.webkitAudioContext; if (!A) return;
        this.ctx = new A();
        this.src = this.ctx.createMediaStreamSource(new MediaStream([tr]));
        this.gain = this.ctx.createGain(); this.gain.gain.value = k;
        this.src.connect(this.gain); this.gain.connect(this.ctx.destination);
        if (this.ctx.state === 'suspended') this.ctx.resume();
        v.muted = true; UI._sndOff = false;
      } catch (e) { this.ctx = null; this.gain = null; }
    }
  };
  var guestAudioWanted = false;
  function initGuestAudioUnlock() { guestAudioWanted = true; }
  function alertCard(text) { var c = UI.card('<h2>オンライン対戦</h2><p class="np-err">' + esc(text) + '</p><div class="np-row"><button class="np-btn" type="button">閉じる</button></div>'); c.querySelector('button').onclick = function () { UI.close(); }; }
  function selectText(node) { try { var r = document.createRange(); r.selectNodeContents(node); var s = getSelection(); s.removeAllRanges(); s.addRange(r); } catch (e) {} }
  function errText(e) {
    var m = e && e.message;
    if (m === 'noroom') return 'その部屋コードの部屋が見つかりません。コードを確かめてください。';
    if (m === 'nosig') return '通信サーバーにつなげません。インターネット接続を確かめてください。';
    if (m === 'nocapture') return 'このブラウザでは画面の配信ができません。ChromeかSafariの新しい版で開いてください。';
    if (m === 'busy') return '部屋を作れませんでした。もう一度試してください。';
    if (e && (e.code === 'PERMISSION_DENIED' || /permission/i.test(m || ''))) return '通信サーバーに書き込めません。データベースのルールを確かめてください。';
    return 'うまくいきませんでした（' + esc(m || e) + '）。もう一度試してください。';
  }

  window.addEventListener('beforeunload', function () { if (UI.mode === 'host') Host.stop(); if (UI.mode === 'guest') Guest.leave(true); });
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', function () { UI.init(); });
  else UI.init();

  window.__NP = { Host: Host, Guest: Guest, UI: UI, vpads: vpads, input: GuestInput };
})();
