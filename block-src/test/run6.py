import asyncio, json, sys, time
sys.path.insert(0, __import__('os').path.dirname(__import__('os').path.abspath(__file__)))
from lib import Sess
K = "window.__kk"
async def main():
    s = await Sess().start()
    await s.new_world('4242', mode=1, diff=0)
    await s.wait(3000)
    # --- 明るさの検証：でたらめに書きかえてから、最初から計算し直した結果と比べる ---
    r = await s.ev(f"""() => {{ const k = {K}, w = k.world, p = k.player; k.game.state = 'paused';
      const pcx = Math.floor(p.x / 16), pcz = Math.floor(p.z / 16);
      const rnd = (n) => Math.floor(Math.random() * n);
      const ids = [0, 0, 0, k.B.stone, k.B.stone, k.B.glass, k.B.leaves_oak, k.B.water, k.B.torch, k.B.glow_block, k.B.dirt, k.B.lava, k.B.ice];
      let edits = 0; const t0 = performance.now();
      for (let n = 0; n < 600; n++) {{
        const x = pcx * 16 + rnd(16), z = pcz * 16 + rnd(16), sy = w.surfaceY(x, z), y = Math.max(2, Math.min(120, sy - 8 + rnd(18)));
        if (w.setBlock(x, y, z, ids[rnd(ids.length)], 0, 1)) edits++;
      }}
      const ms = performance.now() - t0;
      const cs = []; for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) cs.push(w.getChunk(pcx + dx, pcz + dz));
      if (cs.some(c => !c || c.stage < 2)) return 'chunks not ready';
      const before = cs.map(c => c.light.slice());
      for (const c of cs) {{ c.light.fill(0); c.stage = 1; }}
      for (const c of cs) w.lightChunk(c);
      let diff = 0, total = 0, ex = [];
      cs.forEach((c, i) => {{ for (let j = 0; j < c.light.length; j++) {{ total++; if (c.light[j] !== before[i][j]) {{ diff++; if (ex.length < 8) ex.push([i, j & 15, j >> 8, (j >> 4) & 15, before[i][j], c.light[j], c.blocks[j]]); }} }} }});
      return {{ edits, ms: Math.round(ms), diff, total, ex }}; }}""")
    print('light check', json.dumps(r))
    # --- 水の流れ ---
    r = await s.ev(f"""() => {{ const k = {K}, w = k.world, p = k.player; const bx = Math.floor(p.x) + 40, bz = Math.floor(p.z);
      return [bx, bz, w.isLoaded(bx, bz)]; }}""")
    print('area', r)
    r = await s.ev(f"""() => {{ const k = {K}, w = k.world, p = k.player; const bx = Math.floor(p.x), bz = Math.floor(p.z);
      for (let x = -8; x <= 8; x++) for (let z = -8; z <= 8; z++) {{ w.setBlock(bx + x, 110, bz + z, k.B.stone, 0, 1); for (let y = 111; y < 116; y++) w.setBlock(bx + x, y, bz + z, 0, 0, 1); }}
      for (let x = -8; x <= 8; x++) for (const z of [-8, 8]) w.setBlock(bx + x, 111, bz + z, k.B.glass, 0, 1);
      for (let z = -8; z <= 8; z++) for (const x of [-8, 8]) w.setBlock(bx + x, 111, bz + z, k.B.glass, 0, 1);
      w.setBlock(bx, 114, bz - 4, k.B.stone, 0, 1); w.setBlock(bx, 115, bz - 4, k.B.water, 0);
      w.setBlock(bx + 5, 111, bz + 3, k.B.lava, 0);
      p.x = bx + 0.5; p.y = 111.01; p.z = bz + 6.5; p.yaw = 0; p.pitch = -0.25; p.flying = false;
      for (let i = 0; i < 400; i++) {{ w.tick++; w.runScheduled(); }}
      let water = 0, lava = 0, obs = 0, cob = 0;
      for (let x = -8; x <= 8; x++) for (let z = -8; z <= 8; z++) for (let y = 111; y < 116; y++) {{ const id = w.getBlock(bx + x, y, bz + z); if (id === k.B.water) water++; else if (id === k.B.lava) lava++; else if (id === k.B.obsidian) obs++; else if (id === k.B.cobble) cob++; }}
      return {{ water, lava, obs, cob }}; }}""")
    print('fluid', json.dumps(r))
    await s.ev(f"() => {{ {K}.game.state = 'playing'; }}")
    await s.wait(2500); await s.shot('water')
    # 水源を取りのぞく → 引いていく
    r = await s.ev(f"""() => {{ const k = {K}, w = k.world, p = k.player; const bx = Math.floor(p.x), bz = Math.floor(p.z) - 6;
      w.setBlock(bx, 115, bz - 4, 0, 0);
      for (let i = 0; i < 600; i++) {{ w.tick++; w.runScheduled(); }}
      let water = 0; for (let x = -8; x <= 8; x++) for (let z = -8; z <= 8; z++) for (let y = 111; y < 116; y++) if (w.getBlock(bx + x, y, bz + z) === k.B.water) water++;
      return water; }}""")
    print('water left after removing source', r)
    # --- セーブして読み直す ---
    r = await s.ev(f"""async () => {{ const k = {K}, w = k.world, p = k.player; const bx = Math.floor(p.x), bz = Math.floor(p.z);
      w.setBlock(bx + 2, 111, bz, k.B.gold_block, 0); p.give(k.I.diamond, 5, 0); w.setBlock(bx + 3, 111, bz, k.B.chest, 0); w.setEnt(bx + 3, 111, bz, {{ t: 'chest', items: [{{id: k.I.bread, n: 7, d: 0}}].concat(new Array(26).fill(null)) }});
      await k.game.save(); return {{ id: k.game.worldId, ok: k.storage.ok, pos: [p.x, p.y, p.z], gold: [bx + 2, 111, bz], chest: [bx + 3, 111, bz], saved: w.saved.size }}; }}""")
    print('saved', json.dumps(r))
    wid = r['id']; gold = r['gold']; chest = r['chest']
    await s.pg.reload()
    await s.pg.wait_for_function('window.__kk && window.__kk.game.state === "title"', timeout=30000)
    await s.wait(1500)
    lst = await s.ev(f"async () => (await {K}.storage.list()).map(w => [w.id, w.name, w.day])")
    print('list', lst)
    await s.ev(f"() => {K}.game.loadWorld('{wid}')")
    await s.pg.wait_for_function('window.__kk.game.state === "playing"', timeout=60000)
    await s.wait(1000)
    r = await s.ev(f"""() => {{ const k = {K}, w = k.world, p = k.player; const e = w.getEnt({chest[0]}, {chest[1]}, {chest[2]});
      return {{ pos: [p.x, p.y, p.z], gold: w.getBlock({gold[0]}, {gold[1]}, {gold[2]}) === k.B.gold_block, chest: e ? e.items.filter(x => x) : null, inv: p.inv.filter(x => x).map(x => k.ITEMS[x.id].name + 'x' + x.n), mode: p.mode, day: w.day }}; }}""")
    print('reloaded', json.dumps(r, ensure_ascii=False))
    await s.shot('reloaded')
    s.dump()
    await s.close()
asyncio.run(main())
