import asyncio, json, sys, time
sys.path.insert(0, __import__('os').path.dirname(__import__('os').path.abspath(__file__)))
from lib import Sess
K = "window.__kk"
async def main():
    s = await Sess().start()
    print('workers at title', await s.ev(f"() => {K}.genWorkers.length"))
    await s.new_world('99', mode=1, diff=2)
    await s.wait(1000)
    # 計測用に包む
    await s.ev(f"""() => {{ const k = {K}, w = k.world; k.prof = {{ stream: 0, n: 0, maxStream: 0 }};
      const os = w.stream.bind(w); w.stream = function (a, b, c, d) {{ const t = performance.now(); os(a, b, c, d); const e = performance.now() - t; k.prof.stream += e; k.prof.n++; if (e > k.prof.maxStream) k.prof.maxStream = e; }};
      const p = k.player; p.y = 95; p.flying = true; p.yaw = 0.6; p.pitch = -0.2; }}""")
    await s.pg.keyboard.down('KeyW'); await s.pg.keyboard.down('KeyF')
    for i in range(6):
        await s.wait(5000)
        r = await s.ev(f"""() => {{ const k = {K}, w = k.world, p = k.player; let meshed = 0, st0 = 0, st1 = 0; for (const c of w.chunks.values()) {{ if (c.meshed) meshed++; if (c.stage === 0) st0++; if (c.stage === 1) st1++; }}
          const pcx = Math.floor(p.x / 16), pcz = Math.floor(p.z / 16); const here = w.getChunk(pcx, pcz);
          return JSON.stringify({{ pos: [Math.round(p.x), Math.round(p.y), Math.round(p.z)], chunks: w.chunks.size, meshed, st0, st1, inflight: w.inflight, hereMeshed: !!(here && here.meshed), fps: k.game.fps, avgStream: +(k.prof.stream / k.prof.n).toFixed(2), maxStream: +k.prof.maxStream.toFixed(1), saved: w.saved.size, ents: k.ents.length }}); }}""")
        print(i, r)
    await s.pg.keyboard.up('KeyW'); await s.pg.keyboard.up('KeyF')
    await s.wait(4000)
    await s.shot('far')
    print('after stop', await s.ev(f"""() => {{ const k = {K}, w = k.world, p = k.player; let meshed = 0; for (const c of w.chunks.values()) if (c.meshed) meshed++; return [w.chunks.size, meshed, w.inflight]; }}"""))
    s.dump()
    await s.close()
asyncio.run(main())
