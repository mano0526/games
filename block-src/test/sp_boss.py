import asyncio, sys
sys.path.insert(0, __import__('os').path.dirname(__import__('os').path.abspath(__file__)))
from lib import Sess
K = "window.__kk"
async def main():
    s = await Sess().start(640, 400)
    await s.ev(f"() => {{ {K}.R.skip = true; {K}.settings.viewDist = 4; }}")
    await s.new_world('2468', 0, 2)
    await s.wait(500)
    r = await s.ev(f"() => {{ const k = {K}, p = k.player; k.game.summonBoss(Math.floor(p.x), Math.floor(p.y), Math.floor(p.z)); const b = k.game.boss; return b ? [b.type, b.hp, b.nid] : null; }}")
    print('boss', r)
    await s.wait(1500)
    t0 = await s.ev(f"() => {K}.game.world.tick")
    r = await s.ev(f"() => {{ const k = {K}, p = k.player, b = k.game.boss; p.hp = 20; for (let i = 0; i < 60 && b.hp > 0; i++) {{ b.hurt = 0; k.hurtMob(b, 7, p.x, p.z); }} return [b.hp, b.death, b.dead]; }}")
    print('after hits', r)
    for k in range(20):
        await s.wait(500)
        st = await s.ev(f"() => {{ const g = {K}.game, b = g.boss; return [g.world.tick, !!b, b ? [b.hp, b.death, b.dead] : null, g.ended, Object.keys(g.ach), {K}.ents.filter(e => e.kind === 'item').length, g.state, {K}.ui.menu]; }}")
        if not st[1] and st[3]: break
    print('ticks', st[0] - t0, st)
    errs = [l for l in s.logs if 'PAGEERROR' in l or l.startswith('error')]
    print('errors', errs[:5])
    await s.close()
asyncio.run(main())
