import asyncio, json, sys, time
sys.path.insert(0, __import__('os').path.dirname(__import__('os').path.abspath(__file__)))
from lib import Sess
K = "window.__kk"
async def main():
    s = await Sess().start()
    await s.new_world('12345')
    await s.wait(500)
    # 平らな場所へ：少し先に移動してから
    await s.ev(f"() => {{ const k = {K}, p = k.player; p.x = 6.5; p.z = 6.5; k.game.placeSafe(1); p.yaw = 0; p.pitch = -0.55; p.give(k.B.crafting_table, 1, 0); p.give(k.B.furnace, 1, 0); p.give(k.B.chest, 1, 0); p.give(k.B.torch, 8, 0); p.give(k.B.bed, 1, 0); p.give(k.B.door, 2, 0); p.give(k.B.glass, 8, 0); p.give(k.B.planks_oak, 30, 0); p.give(k.I.iron_pick, 1, 0); }}")
    await s.wait(400)
    async def place(slot, yaw, pitch=-0.95):
        await s.ev(f"() => {{ const p = {K}.player; p.sel = {slot}; p.yaw = {yaw}; p.pitch = {pitch}; }}")
        await s.wait(250)
        await s.pg.mouse.click(640, 360, button='right')
        await s.wait(250)
        return await s.ev(f"() => {{ const t = {K}.player.target; return t ? {K}.BLOCKS[t.id].name + '@' + [t.x,t.y,t.z].join(',') + ' m' + t.meta : null; }}")
    print('table', await place(0, 0.0))
    print('furnace', await place(1, 0.9))
    print('chest', await place(2, -0.9))
    print('torch', await place(3, 1.8, -0.95))
    print('bed', await place(4, 2.6, -0.8))
    print('door', await place(5, 3.6, -0.8))
    await s.ev(f"() => {{ const p = {K}.player; p.yaw = 0.0; p.pitch = -0.35; }}")
    await s.wait(500); await s.shot('blocks_a')
    await s.ev(f"() => {{ const p = {K}.player; p.yaw = 2.9; p.pitch = -0.45; }}")
    await s.wait(500); await s.shot('blocks_b')
    # かまどを開いて焼く
    await s.ev(f"() => {{ const p = {K}.player; p.yaw = 0.9; p.pitch = -0.95; }}")
    await s.wait(250); await s.pg.mouse.click(640, 360, button='right'); await s.wait(300)
    print('screen', await s.ev(f"() => {K}.ui.screen"))
    r = await s.ev(f"""() => {{ const k = {K}, e = k.ui.ent; if (!e) return 'no ent'; e.in = {{id: k.B.ore_iron, n: 3, d: 0}}; e.fuel = {{id: k.I.coal, n: 2, d: 0}}; return 'set'; }}""")
    await s.wait(3000)
    await s.shot('furnace')
    r = await s.ev(f"""() => {{ const k = {K}, e = k.ui.ent; for (let i = 0; i < 420; i++) k.world.tickFurnaces(); return JSON.stringify([e.in, e.fuel, e.out, e.burn, e.cook]); }}""")
    print('furnace after', r)
    await s.ev(f"() => {K}.ui.close(true)")
    # 夜
    await s.ev(f"() => {{ const k = {K}; k.world.time = 18000; const p = k.player; p.yaw = 0.3; p.pitch = 0.25; }}")
    await s.wait(1500); await s.shot('night')
    # 生き物を並べる
    await s.ev(f"""() => {{ const k = {K}, p = k.player; k.world.time = 5000; p.x = 6.5; p.z = 6.5; k.game.placeSafe(1); p.yaw = 0; p.pitch = -0.12; k.game.diff = 0;
      const types = ['sheep', 'pig', 'cow', 'chicken', 'shade', 'rock', 'wisp']; types.forEach((t, i) => {{ const e = k.spawnMob(t, p.x - 6 + i * 2, p.y + 2, p.z - 6); e.yaw = 3.14; e.awake = true; }}); }}""")
    await s.wait(2500); await s.shot('mobs')
    await s.ev(f"""() => {{ const k = {K}, p = k.player; for (const e of k.ents) e.dead = true; const e = k.spawnMob('king', p.x, p.y + 1, p.z - 8); e.yaw = 3.14; p.pitch = 0.1; }}""")
    await s.wait(2500); await s.shot('king')
    s.dump()
    await s.close()
asyncio.run(main())
