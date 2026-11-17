import asyncio, sys, json
sys.path.insert(0, __import__('os').path.dirname(__import__('os').path.abspath(__file__)))
from mplib import Mp, K
async def main():
    m = await Mp().start(2)
    await m.ev(0, f"() => {{ {K}.game.startNew('みんなの島', '777', 0, 2, true, {{ mobs: false }}); }}")
    await m.playing(0)
    code = await m.ev(0, f"() => {K}.net.code")
    await m.ev(1, f"(c) => {{ {K}.game.joinOnline(c); }}", code)
    await m.playing(1); await m.wait(1500)
    async def rate(tag):
        a = [await m.ev(i, f"() => [{K}.game.world.tick, {K}.game.frames, performance.now(), document.visibilityState, document.hasFocus()]") for i in (0, 1)]
        await m.wait(3000)
        b = [await m.ev(i, f"() => [{K}.game.world.tick, {K}.game.frames, performance.now()]") for i in (0, 1)]
        print(tag, [(round((b[i][0] - a[i][0]) / (b[i][2] - a[i][2]) * 1000, 1), a[i][3], a[i][4]) for i in (0, 1)], 'fps', [await m.ev(i, f"() => {K}.game.fps") for i in (0, 1)])
    await rate('plain TPS')
    for pg in m.pg:
        c = await m.ctx.new_cdp_session(pg)
        await c.send('Emulation.setFocusEmulationEnabled', {'enabled': True})
    await rate('focus-emulated TPS')
    await m.close()
asyncio.run(main())
