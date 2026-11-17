// にせの中継サーバー（テスト専用）。SharedWorker の中に1本の木を持ち、つながった全ページに変更を配る。
// 本物の Firebase Realtime Database の「置く・消す・聞く・切れたら消す・同時に取り合う」をまねる。
'use strict';
let tree = {};
const ports = new Set();
const segs = (p) => String(p || '').split('/').filter(Boolean);
function getAt(path) { let o = tree; for (const k of path) { if (o === null || typeof o !== 'object') return null; o = o[k]; if (o === undefined) return null; } return o === undefined ? null : o; }
function stamp(v) {
  if (v && typeof v === 'object') { if (v['.sv'] === 'timestamp') return Date.now(); const o = Array.isArray(v) ? [] : {}; for (const k in v) { const s = stamp(v[k]); if (s !== null && s !== undefined) o[k] = s; } return o; }
  return v;
}
function norm(v) {   // 空の入れ物と null は「ない」あつかい。配列は 番号つきの入れ物にする
  if (v === undefined || v === null) return null;
  if (typeof v !== 'object') return v;
  const o = {}; let n = 0;
  for (const k in v) { const s = norm(v[k]); if (s !== null) { o[k] = s; n++; } }
  return n ? o : null;
}
function setAt(path, v) {
  v = norm(stamp(v));
  if (!path.length) { tree = v || {}; return; }
  if (v === null) {
    const chain = [tree]; let o = tree;
    for (let i = 0; i < path.length - 1; i++) { o = o[path[i]]; if (o === null || typeof o !== 'object') return; chain.push(o); }
    delete o[path[path.length - 1]];
    for (let i = chain.length - 1; i > 0; i--) { if (Object.keys(chain[i]).length) break; delete chain[i - 1][path[i - 1]]; }
    return;
  }
  let o = tree;
  for (let i = 0; i < path.length - 1; i++) { const k = path[i]; if (o[k] === null || typeof o[k] !== 'object') o[k] = {}; o = o[k]; }
  o[path[path.length - 1]] = v;
}
const J = (v) => JSON.stringify(v === undefined ? null : v);
function isPrefix(a, b) { if (a.length > b.length) return false; for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false; return true; }
// 1つの書きこみ。聞いている人に、変わったところだけ知らせる
function write(path, v) {
  const jobs = [];
  for (const port of ports) for (const [id, L] of port.L) {
    if (isPrefix(L.path, path)) {
      if (L.type === 'value') jobs.push({ port, id, L, mode: 'value', old: J(getAt(L.path)) });
      else if (path.length > L.path.length) { const k = path[L.path.length]; jobs.push({ port, id, L, mode: 'one', k, old: J(getAt(L.path.concat([k]))) }); }
      else jobs.push({ port, id, L, mode: 'all', old: kids(getAt(L.path)) });
    } else if (isPrefix(path, L.path)) {
      if (L.type === 'value') jobs.push({ port, id, L, mode: 'value', old: J(getAt(L.path)) }); else jobs.push({ port, id, L, mode: 'all', old: kids(getAt(L.path)) });
    }
  }
  setAt(path, v);
  for (const j of jobs) {
    if (j.port.dead || j.port.offline) continue;
    if (j.mode === 'value') { const nv = getAt(j.L.path), n = J(nv); if (n !== j.old) j.port.postMessage({ ev: 'value', id: j.id, v: nv }); }
    else if (j.mode === 'one') { const nv = getAt(j.L.path.concat([j.k])); emitChild(j.port, j.id, j.L.type, j.k, j.old, nv); }
    else { const now = getAt(j.L.path) || {}, old = j.old; const ks = new Set(Object.keys(old).concat(typeof now === 'object' ? Object.keys(now) : [])); for (const k of [...ks].sort()) emitChild(j.port, j.id, j.L.type, k, old[k] === undefined ? 'null' : old[k], typeof now === 'object' && now[k] !== undefined ? now[k] : null); }
  }
}
function kids(node) { const o = {}; if (node && typeof node === 'object') for (const k in node) o[k] = J(node[k]); return o; }
function emitChild(port, id, type, k, oldJ, nv) {
  const n = J(nv); if (n === oldJ) return;
  const ev = oldJ === 'null' ? 'child_added' : nv === null ? 'child_removed' : 'child_changed';
  port.postMessage({ ev, id, k, v: nv });   // 種類がちがっても知らせる（ページ側が中身を覚えておくため。呼び出すかどうかはページ側で決める）
}
function update(path, obj) { for (const k in obj) write(path.concat(segs(k)), obj[k]); }
function dropPort(port) {   // つながりが切れた：予約されていた「切れたら消す」を実行する
  const od = port.od; port.od = new Map();
  for (const [p, a] of od) { if (a.act === 'remove') write(segs(p), null); else if (a.act === 'set') write(segs(p), a.v); else if (a.act === 'update') update(segs(p), a.v); }
}
function handle(port, m) {
  switch (m.op) {
    case 'set': write(segs(m.p), m.v); port.postMessage({ ack: m.n }); break;
    case 'update': update(segs(m.p), m.v); port.postMessage({ ack: m.n }); break;
    case 'get': port.postMessage({ ack: m.n, v: getAt(segs(m.p)) }); break;
    case 'cas': { const cur = getAt(segs(m.p)); if (J(cur) === m.expect) { write(segs(m.p), m.v); port.postMessage({ ack: m.n, ok: true, v: getAt(segs(m.p)) }); } else port.postMessage({ ack: m.n, ok: false, v: cur }); break; }
    case 'on': {
      const path = segs(m.p); port.L.set(m.id, { path, type: m.type });
      if (m.type === 'value') port.postMessage({ ev: 'value', id: m.id, v: getAt(path) });
      else { const node = getAt(path); if (node && typeof node === 'object') for (const k of Object.keys(node).sort()) port.postMessage({ ev: 'child_added', id: m.id, k, v: node[k] }); }
      break;
    }
    case 'sync': {   // つなぎ直したとき：聞いている場所の今の中身を全部わたす（ページ側で前との差を出す）
      const L = port.L.get(m.id); if (L) port.postMessage({ ev: 'sync', id: m.id, v: getAt(L.path) });
      break;
    }
    case 'off': port.L.delete(m.id); break;
    case 'od': if (m.act === 'cancel') port.od.delete(m.p); else port.od.set(m.p, { act: m.act, v: m.v }); break;
    case 'offline': port.offline = true; dropPort(port); break;
    case 'online': port.offline = false; port.postMessage({ ack: m.n }); break;
    case 'bye': port.dead = true; dropPort(port); ports.delete(port); break;
    case 'dump': port.postMessage({ ack: m.n, v: tree }); break;
    case 'reset': tree = {}; port.postMessage({ ack: m.n }); break;
  }
}
self.onconnect = (e) => {
  const port = e.ports[0]; port.L = new Map(); port.od = new Map(); port.dead = false; port.offline = false;
  ports.add(port);
  port.onmessage = (ev) => { try { handle(port, ev.data); } catch (err) { port.postMessage({ err: String(err && err.stack || err) }); } };
  port.start();
};
