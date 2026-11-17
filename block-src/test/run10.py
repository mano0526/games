import asyncio, json, sys, time
sys.path.insert(0, __import__('os').path.dirname(__import__('os').path.abspath(__file__)))
from lib import Sess
K = "window.__kk"
async def main():
    s = await Sess().start(noworker=True)
    t0 = time.time()
    await s.new_world('2026')
    print('no-worker load time', round(time.time() - t0, 1), 'workers:', await s.ev("() => typeof Worker"))
    await s.wait(1500)
    # 面づくりの時間
    r = await s.ev(f"""() => {{ const k = {K}, w = k.world, p = k.player; k.game.state = 'paused';
      const pcx = Math.floor(p.x / 16), pcz = Math.floor(p.z / 16); let n = 0, t = 0, verts = 0, mx = 0;
      for (let dz = -2; dz <= 2; dz++) for (let dx = -2; dx <= 2; dx++) {{ const c = w.getChunk(pcx + dx, pcz + dz); if (!c || !w.canMesh(c)) continue;
        for (let sct = 0; sct < 8; sct++) {{ const t0 = performance.now(); const m = k.meshSection(w, c, sct); const d = performance.now() - t0; if (m) {{ n++; t += d; verts += m.nO + m.nC + m.nT; if (d > mx) mx = d; }} }} }}
      k.game.state = 'playing';
      return {{ sections: n, avgMs: +(t / n).toFixed(3), maxMs: +mx.toFixed(2), avgVerts: Math.round(verts / n) }}; }}""")
    print('mesh timing', json.dumps(r))
    # 平らな舞台を作って試す
    r = await s.ev(f"""() => {{ const k = {K}, w = k.world, p = k.player; const bx = Math.floor(p.x), bz = Math.floor(p.z); k.T = {{ bx, bz }};
      for (let x = -10; x <= 10; x++) for (let z = -10; z <= 10; z++) {{ for (let y = 90; y < 99; y++) w.setBlock(bx + x, y, bz + z, y === 90 ? k.B.stone : y === 91 ? k.B.dirt : y === 92 ? k.B.grass : 0, 0, 1); }}
      p.x = bx + 0.5; p.y = 93.01; p.z = bz + 0.5; p.vx = p.vy = p.vz = 0; p.fallDist = 0; w.time = 18000; return [bx, bz]; }}""")
    await s.wait(500)
    # 敵に近づかれて攻撃される
    r = await s.ev(f"""() => {{ const k = {K}, p = k.player; for (const e of k.ents) e.dead = true; const e = k.spawnMob('shade', p.x + 5, 93.01, p.z); k.T.e = e; return p.hp; }}""")
    await s.wait(6000)
    r = await s.ev(f"""() => {{ const k = {K}, p = k.player, e = k.T.e; return {{ hp: p.hp, dist: +Math.hypot(e.x - p.x, e.z - p.z).toFixed(2), mobHp: e.hp, dead: p.dead }}; }}""")
    print('shade attack', json.dumps(r))
    r = await s.ev(f"""() => {{ const k = {K}, p = k.player, e = k.T.e; p.hp = 20; let hits = 0; for (let i = 0; i < 30 && e.hp > 0; i++) {{ e.hurt = 0; if (k.hurtMob(e, 6, p.x, p.z)) hits++; }} return [hits, e.hp]; }}""")
    await s.wait(2500)
    r2 = await s.ev(f"""() => {{ const k = {K}, p = k.player; return {{ ents: k.ents.map(e => e.kind + ':' + (e.type || e.id)), inv: p.inv.filter(x => x).map(x => k.ITEMS[x.id].name + 'x' + x.n), ach: Object.keys(k.game.ach), kills: p.stats.kills }}; }}""")
    print('kill', r, json.dumps(r2, ensure_ascii=False))
    # 畑：たがやす → 種 → 育つ → 収穫
    r = await s.ev(f"""() => {{ const k = {K}, w = k.world, p = k.player; const {{ bx, bz }} = k.T; for (const e of k.ents) e.dead = true; w.time = 6000;
      w.setBlock(bx + 3, 92, bz + 3, k.B.farmland, 0); w.setBlock(bx + 3, 93, bz + 3, k.B.wheat_crop, 0); w.setBlock(bx + 4, 92, bz + 3, k.B.water, 0, 1);
      let n = 0; for (let i = 0; i < 4000 && w.getMeta(bx + 3, 93, bz + 3) < 3; i++) {{ w.randomTick(bx + 3, 93, bz + 3, k.B.wheat_crop, w.getMeta(bx + 3, 93, bz + 3)); w.randomTick(bx + 3, 92, bz + 3, k.B.farmland, w.getMeta(bx + 3, 92, bz + 3)); n++; }}
      const st = w.getMeta(bx + 3, 93, bz + 3), wet = w.getMeta(bx + 3, 92, bz + 3);
      w.breakNatural(bx + 3, 93, bz + 3);
      // 苗木が育つ
      w.setBlock(bx - 4, 93, bz - 4, k.B.sapling_cherry, 0); const g = w.growTree(bx - 4, 93, bz - 4, 3);
      let logs = 0, leaves = 0; for (let y = 93; y < 103; y++) for (let x = -9; x <= 1; x++) for (let z = -9; z <= 1; z++) {{ const id = w.getBlock(bx + x, y, bz + z); if (id === k.B.log_cherry) logs++; if (id === k.B.leaves_cherry) leaves++; }}
      // 砂が落ちる
      w.setBlock(bx + 6, 96, bz - 6, k.B.sand, 0);
      return {{ ticks: n, stage: st, wet, grew: g, logs, leaves }}; }}""")
    print('farm/tree', json.dumps(r))
    await s.wait(3000)
    r = await s.ev(f"""() => {{ const k = {K}, w = k.world; const {{ bx, bz }} = k.T; return {{ sandLanded: w.getBlock(bx + 6, 93, bz - 6) === k.B.sand, sandGone: w.getBlock(bx + 6, 96, bz - 6) === 0, drops: k.ents.filter(e => e.kind === 'item').map(e => k.ITEMS[e.id].name + 'x' + e.n) }}; }}""")
    print('sand/drops', json.dumps(r, ensure_ascii=False))
    await s.ev(f"() => {{ const p = {K}.player; p.yaw = 0.8; p.pitch = 0.1; }}"); await s.wait(800); await s.shot('stage1')
    # 木を切る → 葉が消える
    r = await s.ev(f"""() => {{ const k = {K}, w = k.world; const {{ bx, bz }} = k.T; for (let y = 93; y < 103; y++) for (let x = -9; x <= 1; x++) for (let z = -9; z <= 1; z++) if (w.getBlock(bx + x, y, bz + z) === k.B.log_cherry) w.setBlock(bx + x, y, bz + z, 0, 0);
      for (let i = 0; i < 200; i++) {{ w.tick++; w.runScheduled(); }}
      let leaves = 0; for (let y = 93; y < 103; y++) for (let x = -9; x <= 1; x++) for (let z = -9; z <= 1; z++) if (w.getBlock(bx + x, y, bz + z) === k.B.leaves_cherry) leaves++; return leaves; }}""")
    print('leaves left after cutting', r)
    # ベッドで眠る
    r = await s.ev(f"""() => {{ const k = {K}, w = k.world, p = k.player; const {{ bx, bz }} = k.T; for (const e of k.ents) e.dead = true; w.time = 15000;
      w.setBlock(bx + 2, 93, bz - 2, k.B.bed, 2, 1); w.setBlock(bx + 2, 93, bz - 3, k.B.bed, 2 | 4);
      p.interactBlock(w, {{ x: bx + 2, y: 93, z: bz - 2, id: k.B.bed, meta: 2 }}, 'bed'); return [w.time, w.day]; }}""")
    await s.wait(2600)
    print('sleep', r, await s.ev(f"() => [{K}.world.time, {K}.world.day, JSON.stringify({K}.player.spawn), Object.keys({K}.game.ach)]"))
    # ボス
    r = await s.ev(f"""() => {{ const k = {K}, w = k.world, p = k.player; const {{ bx, bz }} = k.T; w.time = 16000; w.setBlock(bx - 3, 93, bz + 4, k.B.altar, 0);
      p.armor = [{{id: k.I.diamond_helmet, n: 1, d: 0}}, {{id: k.I.diamond_chest, n: 1, d: 0}}, {{id: k.I.diamond_legs, n: 1, d: 0}}, {{id: k.I.diamond_boots, n: 1, d: 0}}];
      p.interactBlock(w, {{ x: bx - 3, y: 93, z: bz + 4, id: k.B.altar, meta: 0 }}, 'altar'); const b = k.game.boss; return b ? [b.type, b.hp, +b.x.toFixed(1), +b.y.toFixed(1), +b.z.toFixed(1)] : null; }}""")
    print('boss', r)
    await s.ev(f"() => {{ const k = {K}, p = k.player, b = k.game.boss; p.yaw = Math.atan2(-(b.x - p.x), -(b.z - p.z)); p.pitch = 0.15; }}")
    await s.wait(4000); await s.shot('boss_fight')
    r = await s.ev(f"""() => {{ const k = {K}, p = k.player, b = k.game.boss; return {{ php: +p.hp.toFixed(1), dist: +Math.hypot(b.x - p.x, b.z - p.z).toFixed(1), minions: k.ents.filter(e => e.type === 'shade').length, bossbar: !document.getElementById('bossbar').hidden }}; }}""")
    print('boss fight state', json.dumps(r))
    r = await s.ev(f"""() => {{ const k = {K}, p = k.player, b = k.game.boss; p.hp = 20; for (let i = 0; i < 60 && b.hp > 0; i++) {{ b.hurt = 0; k.hurtMob(b, 7, p.x, p.z); }} return b.hp; }}""")
    await s.wait(5000)
    print('after boss', await s.ev(f"() => JSON.stringify({{ boss: !!{K}.game.boss, ended: {K}.game.ended, ach: Object.keys({K}.game.ach), drops: {K}.ents.filter(e => e.kind === 'item').map(e => {K}.ITEMS[e.id].name + 'x' + e.n) }})"))
    await s.wait(4000)
    print('ending', await s.ev(f"() => [{K}.game.state, {K}.ui.menu]"))
    await s.shot('ending')
    s.dump()
    await s.close()
asyncio.run(main())
