import asyncio, sys
sys.path.insert(0, __import__('os').path.dirname(__import__('os').path.abspath(__file__)))
from lib import Sess
K = "window.__kk"
async def main():
    s = await Sess().start(640, 400)
    await s.ev(f"() => {{ {K}.R.skip = true; {K}.settings.viewDist = 4; }}")
    await s.new_world('2468', 0, 2)
    await s.wait(500)
    print('rules', await s.ev(f"() => JSON.stringify({K}.game.rules)"))
    pos = await s.ev(f"() => {{ const p = {K}.player; p.give({K}.I.diamond, 5, 0); p.give({K}.I.iron_pick, 1, 0); return [p.x, p.y, p.z]; }}")
    await s.ev(f"() => {{ {K}.player.damage(50, 0, 0, 0, '落下', true); }}")
    await s.wait(1500)
    print('dead', await s.ev(f"() => [{K}.player.dead, {K}.player.inv.filter(x => x).length, {K}.ents.filter(e => e.kind === 'item').map(e => [e.id, e.n, e.life, e.age])]"))
    await s.ev(f"() => {{ {K}.game.respawn(); }}")
    await s.wait(1500)
    await s.ev(f"(a) => {{ const p = {K}.player; p.x = a[0]; p.y = a[1] + 0.2; p.z = a[2]; {K}.game.needSafeSpot = 2; }}", pos) if False else await s.pg.evaluate(f"(a) => {{ const p = {K}.player; p.x = a[0]; p.y = a[1] + 0.2; p.z = a[2]; {K}.game.needSafeSpot = 2; }}", pos)
    await s.wait(2500)
    print('picked up again', await s.ev(f"() => [{K}.player.inv.filter(x => x).map(x => [x.id, x.n]), {K}.ents.filter(e => e.kind === 'item').length]"))
    # 動物：しまう・もどす（ひとり用）とセーブ
    await s.ev(f"() => {{ for (const e of {K}.ents) e.dead = true; const p = {K}.player; for (let i = 0; i < 3; i++) {K}.spawnMob('pig', p.x + 2 + i, p.y + 1, p.z + 2).hp = 4 + i; }}")
    await s.wait(500)
    await s.ev(f"() => {{ const p = {K}.player; p.x += 220; {K}.game.needSafeSpot = 1; }}")
    await s.wait(5000)
    print('far: pigs live', await s.ev(f"() => {K}.ents.filter(e => e.type === 'pig' && e.hp < 10).length"), 'stash', await s.ev(f"() => [...{K}.game.world.stash.values()].reduce((n, a) => n + a.length, 0)"))
    await s.ev(f"() => {K}.game.save()"); await s.wait(500)
    await s.ev(f"() => {{ const p = {K}.player; p.x -= 220; {K}.game.needSafeSpot = 1; }}")
    await s.wait(6000)
    print('back: pigs live', await s.ev(f"() => {K}.ents.filter(e => e.type === 'pig' && e.hp < 10).map(e => e.hp)"))
    # 敵のわき方：夜にして数える
    await s.ev(f"() => {{ {K}.game.world.time = 14000; }}")
    for k in range(6):
        await s.wait(5000)
        print('night t+%ds' % ((k + 1) * 5), await s.ev(f"() => {{ const o = {{}}; let under = 0, surf = 0; for (const e of {K}.ents) if (e.kind === 'mob') {{ o[e.type] = (o[e.type] || 0) + 1; if ({K}.MOBS[e.type].hostile) {{ if (({K}.game.world.getLightRaw(Math.floor(e.x), Math.floor(e.y), Math.floor(e.z)) >> 4) < 4) under++; else surf++; }} }} o.under = under; o.surface = surf; return o; }}"))
    errs = [l for l in s.logs if 'PAGEERROR' in l or l.startswith('error')]
    print('errors', errs[:5])
    await s.close()
asyncio.run(main())
