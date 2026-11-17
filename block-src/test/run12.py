import asyncio, json, sys, time
sys.path.insert(0, __import__('os').path.dirname(__import__('os').path.abspath(__file__)))
from lib import Sess
K = "window.__kk"
async def main():
    s = await Sess().start()
    await s.new_world('12345', mode=1)
    await s.wait(1000)
    shots = []
    for name, t, yaw, pitch in shots:
        await s.ev(f"() => {{ const k = {K}, p = k.player; k.world.time = {t}; p.yaw = {yaw}; p.pitch = {pitch}; p.y = 75; p.flying = true; }}")
        await s.wait(1200); await s.shot('sky_' + name)
    # 洞窟の中（暗さとたいまつ）
    r = await s.ev(f"""() => {{ const k = {K}, w = k.world, p = k.player; w.time = 6000; const bx = Math.floor(p.x), bz = Math.floor(p.z);
      for (let x = -3; x <= 3; x++) for (let z = -8; z <= 2; z++) for (let y = 30; y < 34; y++) w.setBlock(bx + x, y, bz + z, 0, 0, 1);
      w.setBlock(bx + 2, 30, bz - 4, k.B.torch, 0); w.setBlock(bx - 3, 32, bz - 6, k.B.torch, 2);
      w.setBlock(bx - 1, 30, bz - 5, k.B.chest, 0); w.setBlock(bx, 30, bz - 6, k.B.furnace_lit, 0); w.setBlock(bx + 1, 30, bz - 6, k.B.crafting_table, 0); w.setBlock(bx - 2, 30, bz - 3, k.B.ladder, 1);
      w.setBlock(bx + 3, 30, bz - 2, k.B.door, 1, 1); w.setBlock(bx + 3, 31, bz - 2, k.B.door, 1 | 8, 1);
      p.x = bx + 0.5; p.y = 30.01; p.z = bz + 0.5; p.flying = false; p.yaw = 0; p.pitch = -0.1; return w.getBlock(bx, 29, bz); }}""")
    await s.wait(1500); await s.shot('cave')
    s.dump()
    await s.close()
asyncio.run(main())
