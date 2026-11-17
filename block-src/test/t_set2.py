import asyncio, sys
sys.path.insert(0, __import__('os').path.dirname(__import__('os').path.abspath(__file__)))
from lib import Sess
K = "window.__kk"
async def main():
    s = await Sess().start(900, 600); pg = s.pg
    await s.ev(f"() => {{ {K}.R.skip = true; {K}.settings.keys.fwd = 'KeyI'; }}")
    await s.new_world('2468', 0, 2); await s.wait(800)
    for yaw in (0, 1.57, 3.14, 4.71):
        await s.ev(f"() => {{ {K}.player.yaw = {yaw}; }}")
        p0 = await s.ev(f"() => [{K}.player.x, {K}.player.z]")
        await pg.keyboard.down('KeyI'); await s.wait(1000); await pg.keyboard.up('KeyI'); await s.wait(200)
        p1 = await s.ev(f"() => [{K}.player.x, {K}.player.z, {K}.input.fwd, {K}.game.state]")
        print('yaw', yaw, 'moved', round(((p1[0]-p0[0])**2 + (p1[1]-p0[1])**2) ** 0.5, 2), p1[2:])
    await s.close()
asyncio.run(main())
