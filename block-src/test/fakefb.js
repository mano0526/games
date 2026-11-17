// にせの Firebase（テスト専用）。本物の「compat」版と同じ呼び方で使えるようにして、同じブラウザの中のページどうしをつなぐ。
// 使っている機能だけ：ref/child/set/update/remove/push/on/off/once/transaction/onDisconnect、.info/connected、.info/serverTimeOffset、ServerValue.TIMESTAMP
(function () {
  'use strict';
  const QS = new URLSearchParams(location.search), LAG = +(QS.get('lag') || 0);
  const worker = new SharedWorker('fakefb_worker.js'), port = worker.port;
  let seq = 1, lid = 1, online = true, pushN = 0;
  const waits = new Map(), L = new Map(), infoL = [], queue = [];
  const later = (fn) => { if (LAG) setTimeout(fn, LAG / 2); else fn(); };
  // 順番を守ったまま、少し遅らせて送る・受け取る（まとめて配るので、数が多くても遅れがたまらない）
  const outL = [], inL = [];
  function pump() { const now = Date.now(); while (outL.length && outL[0].t <= now) port.postMessage(outL.shift().m); while (inL.length && inL[0].t <= now) recv(inL.shift().m); }
  if (LAG) setInterval(pump, 8);
  function post(m) { if (!online && m.op !== 'online' && m.op !== 'offline') { queue.push(m); return; } if (LAG) outL.push({ t: Date.now() + LAG / 2, m }); else port.postMessage(m); }
  function ask(m) { return new Promise((res) => { m.n = seq++; waits.set(m.n, res); post(m); }); }
  port.onmessage = (e) => { if (LAG) inL.push({ t: Date.now() + LAG / 2, m: e.data }); else recv(e.data); };
  port.start();
  addEventListener('pagehide', () => port.postMessage({ op: 'bye' }));
  function arr(v) {   // 本物と同じく、番号が0から詰まっている入れ物は配列にして返す
    if (v === null || typeof v !== 'object') return v;
    const ks = Object.keys(v); let ints = ks.length > 0, max = -1;
    for (const k of ks) { if (!/^(0|[1-9]\d*)$/.test(k)) { ints = false; break; } if (+k > max) max = +k; }
    if (ints && max < ks.length * 2) { const a = []; for (let i = 0; i <= max; i++) a.push(v[i] === undefined ? null : arr(v[i])); return a; }
    const o = {}; for (const k of ks) o[k] = arr(v[k]); return o;
  }
  function snap(ref, v) { return { key: ref.key, ref, val: () => (v === undefined || v === null ? null : arr(JSON.parse(JSON.stringify(v)))), exists: () => v !== null && v !== undefined, numChildren: () => (v && typeof v === 'object' ? Object.keys(v).length : 0) }; }
  function fire(l, ev, k, v) {
    if (ev === 'value') { l.cur = JSON.stringify(v === undefined ? null : v); try { l.cb(snap(l.ref, v)); } catch (e) { console.error(e); } return; }
    if (ev === 'child_removed') l.kids.delete(k); else l.kids.set(k, JSON.stringify(v));
    if (l.type === ev) { try { l.cb(snap(l.ref.child(k), v)); } catch (e) { console.error(e); } }
  }
  function recv(m) {
    if (m.err) { console.error('fakefb worker: ' + m.err); return; }
    if (m.ack) { const f = waits.get(m.ack); waits.delete(m.ack); if (f) f(m); return; }
    const l = L.get(m.id); if (!l) return;
    if (m.ev === 'sync') {   // つなぎ直し：前に知っていた中身との差だけを知らせる
      if (l.type === 'value') { if (JSON.stringify(m.v === undefined ? null : m.v) !== l.cur) fire(l, 'value', null, m.v); return; }
      const now = m.v && typeof m.v === 'object' ? m.v : {};
      for (const k of [...l.kids.keys()]) if (now[k] === undefined) { if (l.type === 'child_removed') fire(l, 'child_removed', k, JSON.parse(l.kids.get(k))); else l.kids.delete(k); }
      for (const k of Object.keys(now).sort()) { const j = JSON.stringify(now[k]), o = l.kids.get(k); if (o === undefined) { if (l.type === 'child_added') fire(l, 'child_added', k, now[k]); else l.kids.set(k, j); } else if (o !== j) { if (l.type === 'child_changed') fire(l, 'child_changed', k, now[k]); else l.kids.set(k, j); } }
      return;
    }
    fire(l, m.ev, m.k, m.v);
  }
  function setConn(v) { for (const l of infoL) if (l.what === 'connected') { try { l.cb({ val: () => v }); } catch (e) { console.error(e); } } }
  function mkRef(path) {
    const parts = String(path || '').split('/').filter(Boolean), p = parts.join('/');
    const ref = {
      key: parts.length ? parts[parts.length - 1] : null, _p: p,
      child(c) { return mkRef(p + '/' + c); },
      set(v) { return ask({ op: 'set', p, v }).then(() => undefined); },
      update(v) { for (const a in v) for (const b in v) if (a !== b && (b + '/').indexOf(a + '/') === 0) throw new Error('update: ' + a + ' は ' + b + ' の親です（本物でもエラーになります）'); return ask({ op: 'update', p, v }).then(() => undefined); },
      remove() { return ask({ op: 'set', p, v: null }).then(() => undefined); },
      push(v) { const key = Date.now().toString(36).padStart(9, '0') + (pushN++ % 46656).toString(36).padStart(3, '0') + Math.random().toString(36).slice(2, 6); const r = mkRef(p + '/' + key); if (v !== undefined) r.set(v); return r; },
      on(type, cb, errCb) {
        if (p === '.info/connected') { infoL.push({ what: 'connected', cb }); later(() => cb({ val: () => online })); return cb; }
        if (p === '.info/serverTimeOffset') { infoL.push({ what: 'offset', cb }); later(() => cb({ val: () => 0 })); return cb; }
        const id = lid++; L.set(id, { id, ref, type, cb, kids: new Map(), cur: undefined });
        post({ op: 'on', id, p, type });
        return cb;
      },
      off(type, cb) { for (const [id, l] of L) if (l.ref._p === p && (!type || l.type === type) && (!cb || l.cb === cb)) { L.delete(id); post({ op: 'off', id }); } },
      once(type) { return ask({ op: 'get', p }).then((m) => snap(ref, m.v)); },
      transaction(fn) {
        const step = (cur) => {
          const v = fn(cur === null || cur === undefined ? null : arr(JSON.parse(JSON.stringify(cur))));
          if (v === undefined) return Promise.resolve({ committed: false, snapshot: snap(ref, cur) });
          return ask({ op: 'cas', p, expect: JSON.stringify(cur === undefined ? null : cur), v }).then((m) => m.ok ? { committed: true, snapshot: snap(ref, m.v) } : step(m.v));
        };
        return ask({ op: 'get', p }).then((m) => step(m.v));
      },
      onDisconnect() {
        return { remove() { post({ op: 'od', p, act: 'remove' }); return Promise.resolve(); }, set(v) { post({ op: 'od', p, act: 'set', v }); return Promise.resolve(); }, update(v) { post({ op: 'od', p, act: 'update', v }); return Promise.resolve(); }, cancel() { post({ op: 'od', p, act: 'cancel' }); return Promise.resolve(); } };
      }
    };
    return ref;
  }
  const db = { ref: (p) => mkRef(p) };
  const fb = {
    apps: [], initializeApp() { const app = { name: 'fake' }; fb.apps.push(app); return app; }, app() { return fb.apps[0]; },
    database() { return db; },
    // テスト用：通信が切れた・もどった をまねる
    __offline() { if (!online) return; online = false; port.postMessage({ op: 'offline' }); setConn(false); },
    __online() { if (online) return; online = true; port.postMessage({ op: 'online' }); for (const [id] of L) port.postMessage({ op: 'sync', id }); const q = queue.splice(0); for (const m of q) post(m); setConn(true); },
    __dump() { return ask({ op: 'dump' }).then((m) => m.v); },
    __reset() { return ask({ op: 'reset' }); }
  };
  fb.database.ServerValue = { TIMESTAMP: { '.sv': 'timestamp' } };
  window.firebase = fb;
})();
