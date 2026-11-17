import asyncio, json, sys, time
sys.path.insert(0, __import__('os').path.dirname(__import__('os').path.abspath(__file__)))
from lib import Sess
K = "window.__kk"
async def main():
    s = await Sess().start()
    await s.new_world('777', mode=1, diff=2)
    await s.wait(500)
    # 空中に石の舞台を作って、生き物を並べる
    await s.ev(f"""() => {{ const k = {K}, w = k.world, p = k.player; const bx = Math.floor(p.x), bz = Math.floor(p.z);
      for (let x = -9; x <= 9; x++) for (let z = -12; z <= 3; z++) w.setBlock(bx + x, 100, bz + z, (x + z) & 1 ? k.B.stone_bricks : k.B.planks_birch, 0);
      p.x = bx + 0.5; p.y = 101.01; p.z = bz + 1.5; p.yaw = 0; p.pitch = -0.08; w.time = 6000; p.flying = false;
      const types = ['sheep', 'pig', 'cow', 'chicken', 'shade', 'rock', 'wisp']; types.forEach((t, i) => {{ const e = k.spawnMob(t, bx + 0.5 - 6 + i * 2, 101.01, bz - 4.5); e.yaw = 3.14; e.pyaw = 3.14; e.awake = true; e.px = e.x; e.py = e.y; e.pz = e.z; }});
      k.game.state = 'paused'; }}""")
    await s.wait(1500); await s.shot('mobs')
    await s.ev(f"""() => {{ const k = {K}, p = k.player; for (const e of k.ents) e.dead = true; k.ents.length = 0; const e = k.spawnMob('king', p.x, 101.01, p.z - 8); e.yaw = e.pyaw = 3.14; e.px = e.x; e.py = e.y; e.pz = e.z; p.pitch = 0.12; }}""")
    await s.wait(1200); await s.shot('king')
    # 持ち物を手に持ったときの見た目
    await s.ev(f"""() => {{ const k = {K}, p = k.player; k.ents.length = 0; p.inv[0] = {{id: k.I.iron_pick, n: 1, d: 0}}; p.inv[1] = {{id: k.I.diamond_sword, n: 1, d: 0}}; p.inv[2] = {{id: k.I.bread, n: 3, d: 0}}; p.inv[3] = {{id: k.B.stone, n: 9, d: 0}}; p.inv[4] = {{id: k.B.torch, n: 9, d: 0}}; p.sel = 0; p.invDirty = true; p.pitch = -0.3; }}""")
    for i in range(5):
        await s.ev(f"() => {{ {K}.player.sel = {i}; }}"); await s.wait(500); await s.shot('hand%d' % i)
    s.dump()
    await s.close()
asyncio.run(main())
