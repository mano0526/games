import asyncio, sys, json
sys.path.insert(0, __import__('os').path.dirname(__import__('os').path.abspath(__file__)))
from mplib import Mp, K
async def main():
    m = await Mp().start(2)
    print('avail', await m.ev(0, f"() => {K}.net.avail"), await m.ev(1, f"() => {K}.net.avail"))
    await m.ev(0, f"() => {{ {K}.game.startNew('みんなの島', '12345', 0, 2, true, {{}}); }}")
    await m.playing(0)
    code = await m.ev(0, f"() => {K}.net.code")
    print('code', code, 'p0 pos', await m.ev(0, f"() => [{K}.player.x, {K}.player.y, {K}.player.z].map(v => +v.toFixed(1))"))
    await m.ev(1, f"(c) => {{ {K}.game.joinOnline(c); }}", code)
    await m.playing(1)
    await m.wait(2500)
    for i in (0, 1):
        print('p%d' % i, await m.ev(i, f"() => {{ const n = {K}.net, p = {K}.player; return {{ pos: [p.x, p.y, p.z].map(v => +v.toFixed(1)), peers: [...n.peers.values()].map(q => [q.name, +q.x.toFixed(1), +q.y.toFixed(1), +q.z.toFixed(1), q.slot, q.look.join('')]), regions: n.regions.size, ready: [...n.regions.values()].filter(r => r.ready).length, fps: {K}.game.fps, time: {K}.game.world.time, day: {K}.game.world.day, conn: n.connected }}; }}"))
    await m.shot(0, 'mp1_p0'); await m.shot(1, 'mp1_p1')
    print('errs', m.errs()[:8])
    await m.close()
asyncio.run(main())
