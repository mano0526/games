import asyncio, json, sys, time, random
sys.path.insert(0, __import__('os').path.dirname(__import__('os').path.abspath(__file__)))
from lib import Sess
K = "window.__kk"
async def main():
    random.seed(int(sys.argv[1]) if len(sys.argv) > 1 else 1)
    s = await Sess().start()
    await s.new_world(str(random.randint(1, 99999)), mode=0, diff=3)
    await s.wait(500)
    await s.ev(f"""() => {{ const k = {K}, p = k.player; const ids = Object.keys(k.ITEMS).map(Number); for (let i = 0; i < 30; i++) {{ const id = ids[Math.floor(Math.random() * ids.length)]; p.give(id, k.ITEMS[id].stack > 1 ? 16 : 1, 0); }} k.world.time = 13000; }}""")
    keys = ['KeyW', 'KeyA', 'KeyS', 'KeyD', 'Space', 'KeyE', 'KeyQ', 'Digit1', 'Digit2', 'Digit3', 'Digit4', 'Digit5', 'Digit6', 'Digit7', 'Digit8', 'Digit9', 'ShiftLeft', 'KeyF']
    held = set()
    t0 = time.time(); n = 0
    while time.time() - t0 < 75:
        r = random.random(); n += 1
        if r < 0.3:
            k = random.choice(keys)
            if k in held: await s.pg.keyboard.up(k); held.discard(k)
            else: await s.pg.keyboard.down(k); held.add(k)
        elif r < 0.5:
            await s.pg.mouse.move(random.randint(100, 1180), random.randint(100, 620))
        elif r < 0.7:
            await s.pg.mouse.down(button=random.choice(['left', 'right'])); await s.wait(random.randint(50, 900)); await s.pg.mouse.up(button='left'); await s.pg.mouse.up(button='right')
        elif r < 0.8:
            await s.ev(f"() => {{ const p = {K}.player; p.yaw = Math.random() * 6.28; p.pitch = Math.random() * 2.4 - 1.4; p.sel = Math.floor(Math.random() * 9); }}")
        elif r < 0.86:
            await s.ev(f"""() => {{ const k = {K}; const kinds = ['inv', 'table']; if (!k.ui.screen && k.game.state === 'playing' && !k.player.dead) k.ui.open(kinds[Math.floor(Math.random() * 2)]); }}""")
            for _ in range(random.randint(1, 8)):
                await s.pg.mouse.click(random.randint(300, 1000), random.randint(100, 650), button=random.choice(['left', 'right']))
            await s.ev(f"""() => {{ const k = {K}; if (k.ui.screen) {{ const rs = k.RECIPES; for (let i = 0; i < 4; i++) k.ui.craftFromList(rs[Math.floor(Math.random() * rs.length)], Math.random() < 0.3); k.ui.close(true); }} }}""")
        elif r < 0.9:
            await s.ev(f"""() => {{ const k = {K}, p = k.player; if (p.dead) {{ k.game.respawn(); }} else if (k.game.state === 'paused') k.game.resume(); else if (Math.random() < 0.3) {{ k.game.pause(); k.game.resume(); }} }}""")
        elif r < 0.94:
            await s.ev(f"""() => {{ const k = {K}, p = k.player, w = k.world; const t = ['sheep', 'pig', 'cow', 'chicken', 'shade', 'rock', 'wisp'][Math.floor(Math.random() * 7)]; k.spawnMob(t, p.x + Math.random() * 6 - 3, p.y + 1, p.z + Math.random() * 6 - 3); if (Math.random() < 0.2) w.time = Math.floor(Math.random() * 24000); }}""")
        else:
            await s.ev(f"""() => {{ const k = {K}, p = k.player, w = k.world; const x = Math.floor(p.x) + Math.floor(Math.random() * 7) - 3, y = Math.floor(p.y) + Math.floor(Math.random() * 5) - 1, z = Math.floor(p.z) + Math.floor(Math.random() * 7) - 3; const ids = [k.B.water, k.B.lava, k.B.sand, k.B.torch, k.B.chest, k.B.furnace, k.B.door, k.B.bed, k.B.sapling_oak, k.B.cactus, k.B.gravel, 0, 0]; w.setBlock(x, y, z, ids[Math.floor(Math.random() * ids.length)], Math.floor(Math.random() * 4)); }}""")
        await s.wait(random.randint(20, 200))
    for k in held: await s.pg.keyboard.up(k)
    st = await s.ev(f"() => {{ const k = {K}, p = k.player; return JSON.stringify({{ state: k.game.state, hp: p.hp, dead: p.dead, pos: [Math.round(p.x), Math.round(p.y), Math.round(p.z)], ents: k.ents.length, deaths: p.stats.deaths, broken: p.stats.broken, placed: p.stats.placed, crafted: p.stats.crafted, tick: k.world.tick, sched: k.world.scheduled.size }}); }}")
    print('actions', n, st)
    errs = [l for l in s.logs if 'PAGEERROR' in l or l.startswith('error')]
    print('errors:', len(errs))
    for e in errs[:12]: print('  ', e[:400])
    await s.shot('monkey')
    await s.close()
asyncio.run(main())
