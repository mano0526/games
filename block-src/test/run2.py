import asyncio, json, sys, time
sys.path.insert(0, __import__('os').path.dirname(__import__('os').path.abspath(__file__)))
from lib import Sess
async def main():
    s = await Sess().start()
    t0 = time.time()
    await s.new_world('12345')
    print('load time', round(time.time() - t0, 1))
    await s.wait(1500)
    await s.shot('play1')
    info = await s.ev("""() => { const k = window.__kk, p = k.player, w = k.world; return { pos: [p.x, p.y, p.z], onGround: p.onGround, chunks: w.chunks.size, meshed: [...w.chunks.values()].filter(c => c.meshed).length, fps: k.game.fps, sections: k.R.stats.sections, biome: w.biomeAt(Math.floor(p.x), Math.floor(p.z)), ents: k.ents.length, light: w.getLightRaw(Math.floor(p.x), Math.floor(p.y + 1), Math.floor(p.z)) }; }""")
    print(json.dumps(info))
    # 見回す
    for i, (yaw, pitch) in enumerate([(1.5, -0.3), (3.1, -0.15), (4.6, -0.5), (0.3, 0.3)]):
        await s.ev(f"() => {{ const p = window.__kk.player; p.yaw = {yaw}; p.pitch = {pitch}; }}")
        await s.wait(700)
        await s.shot('play_look%d' % i)
    s.dump()
    await s.close()
asyncio.run(main())
