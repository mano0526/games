import asyncio, json, sys, time
sys.path.insert(0, __import__('os').path.dirname(__import__('os').path.abspath(__file__)))
from lib import Sess
K = "window.__kk"
async def main():
    s = await Sess().start()
    await s.wait(5000)
    for i in range(3):
        await s.ev(f"() => {{ {K}.game.titleAng = {i * 2.1}; }}"); await s.wait(1500); await s.shot('title_%d' % i)
    print(await s.ev(f"() => JSON.stringify({K}.game.titlePos)"))
    # 速さの測定（作業スレッドあり）
    await s.new_world('31337')
    await s.wait(1000)
    r = await s.ev(f"""() => {{ const k = {K}, w = k.world, g = w.gen, p = k.player; k.game.state = 'paused';
      const pcx = Math.floor(p.x / 16) + 40, pcz = Math.floor(p.z / 16);
      let t0 = performance.now(); const res = []; for (let i = 0; i < 20; i++) res.push(g.genChunk(pcx + (i % 5), pcz + Math.floor(i / 5))); const tGen = (performance.now() - t0) / 20;
      // 手元の世界にチャンクを足して光と面の計算時間をはかる
      const cs = [];
      for (let dz = -1; dz <= 4; dz++) for (let dx = -1; dx <= 5; dx++) {{ const cx = pcx + dx, cz = pcz + dz; let c = w.chunks.get(w.key(cx, cz)); if (!c) {{ c = new (w.getChunk(Math.floor(p.x / 16), Math.floor(p.z / 16)).constructor)(cx, cz); w.chunks.set(w.key(cx, cz), c); }} if (c.stage === 0) w.installChunk(c, g.genChunk(cx, cz)); cs.push(c); }}
      t0 = performance.now(); let nl = 0; for (const c of cs) if (c.stage === 1) {{ w.lightChunk(c); nl++; }} const tLight = (performance.now() - t0) / Math.max(1, nl);
      return {{ tGen: +tGen.toFixed(2), tLight: +tLight.toFixed(2), nl }}; }}""")
    print('timings', json.dumps(r))
    await s.close()
asyncio.run(main())
