// ===== 作業スレッドの入口：地形づくりだけを受け持つ =====
let _seed = 0; const _gens = {};
self.onmessage = (e) => {
  const m = e.data;
  if (m.t === 'init') { _seed = m.seed; for (const k in _gens) delete _gens[k]; return; }
  if (m.t === 'gen') {
    const gv = m.gv || 1, key = gv + ':' + (m.dim || 0);
    const g = _gens[key] || (_gens[key] = new (dimGenClass(gv, m.dim || 0))(_seed));
    const r = g.genChunk(m.cx, m.cz);
    self.postMessage({ t: 'chunk', id: m.id, cx: m.cx, cz: m.cz, blocks: r.blocks, meta: r.meta, biome: r.biome, maxY: r.maxY, ents: r.ents }, [r.blocks.buffer, r.meta.buffer, r.biome.buffer]);
  }
};
