import asyncio, sys, json, random, time
sys.path.insert(0, __import__('os').path.dirname(__import__('os').path.abspath(__file__)))
from mplib import Mp, K
async def main():
    seed = int(sys.argv[1]) if len(sys.argv) > 1 else 1
    secs = int(sys.argv[2]) if len(sys.argv) > 2 else 70
    lag = int(sys.argv[3]) if len(sys.argv) > 3 else 120
    random.seed(seed)
    m = await Mp().start(2, lag=lag)
    await m.ev(0, f"() => {{ {K}.game.startNew('みんなの島', '{random.randint(1, 99999)}', 0, 3, true, {{ pvp: true }}); }}")
    await m.playing(0)
    code = await m.ev(0, f"() => {K}.net.code")
    await m.ev(1, f"(c) => {{ {K}.game.joinOnline(c); }}", code)
    await m.playing(1); await m.wait(800)
    for i in (0, 1):
        await m.ev(i, f"""() => {{ const k = {K}, p = k.player; const ids = Object.keys(k.ITEMS).map(Number); for (let j = 0; j < 30; j++) {{ const id = ids[Math.floor(Math.random() * ids.length)]; p.give(id, k.ITEMS[id].stack > 1 ? 16 : 1, 0); }} }}""")
    await m.ev(0, f"() => {{ {K}.game.world.time = 13500; {K}.net.writeTime(); }}")
    keys = ['KeyW', 'KeyA', 'KeyS', 'KeyD', 'Space', 'KeyE', 'KeyQ', 'Digit1', 'Digit2', 'Digit3', 'Digit4', 'Digit5', 'ShiftLeft', 'KeyF']
    held = [set(), set()]
    t0 = time.time(); n = 0
    while time.time() - t0 < secs:
        i = random.randint(0, 1); pg = m.pg[i]; r = random.random(); n += 1
        if r < 0.25:
            k = random.choice(keys)
            if k in held[i]: await pg.keyboard.up(k); held[i].discard(k)
            else: await pg.keyboard.down(k); held[i].add(k)
        elif r < 0.45:
            await pg.mouse.down(button=random.choice(['left', 'right'])); await pg.wait_for_timeout(random.randint(50, 600)); await pg.mouse.up(button='left'); await pg.mouse.up(button='right')
        elif r < 0.6:
            await m.ev(i, f"() => {{ const p = {K}.player; p.yaw = Math.random() * 6.28; p.pitch = Math.random() * 2.4 - 1.4; p.sel = Math.floor(Math.random() * 9); }}")
        elif r < 0.68:
            await m.ev(i, f"""() => {{ const k = {K}; if (!k.ui.screen && k.game.state === 'playing' && !k.player.dead) k.ui.open(['inv', 'table'][Math.floor(Math.random() * 2)]); }}""")
            for _ in range(random.randint(1, 6)): await pg.mouse.click(random.randint(60, 380), random.randint(40, 240), button=random.choice(['left', 'right']))
            await m.ev(i, f"""() => {{ const k = {K}; if (k.ui.screen) k.ui.close(true); }}""")
        elif r < 0.74:
            await m.ev(i, f"""() => {{ const k = {K}, p = k.player; if (p.dead) k.game.respawn(); else if (k.game.state === 'paused') k.game.resume(); else if (Math.random() < 0.4) {{ k.game.pause(); }} }}""")
        elif r < 0.8:
            await m.ev(i, f"""() => {{ const k = {K}, p = k.player; const t = ['sheep', 'pig', 'cow', 'chicken', 'shade', 'rock', 'wisp'][Math.floor(Math.random() * 7)]; k.spawnMob(t, p.x + Math.random() * 6 - 3, p.y + 1, p.z + Math.random() * 6 - 3); }}""")
        elif r < 0.86:
            # 入れ物を置いて、開いて、いじる
            await m.ev(i, f"""() => {{ const k = {K}, p = k.player, w = k.game.world, B = k.B; const x = Math.floor(p.x) + 1, y = Math.floor(p.y), z = Math.floor(p.z); if (!w.getBlock(x, y, z)) {{ const id = Math.random() < 0.5 ? B.chest : B.furnace; w.setBlock(x, y, z, id, 0); w.setEnt(x, y, z, id === B.chest ? {{ t: 'chest', items: new Array(27).fill(null) }} : {{ t: 'furnace', in: {{ id: B.ore_iron, n: 4, d: 0 }}, fuel: {{ id: k.I.coal, n: 3, d: 0 }}, out: null, burn: 0, burnMax: 0, cook: 0 }}); }}
              const id = w.getBlock(x, y, z); if (!k.ui.screen && k.game.state === 'playing' && !p.dead && (id === B.chest || id === B.furnace || id === B.furnace_lit)) p.interactBlock(w, {{ x, y, z, id, meta: w.getMeta(x, y, z) }}, id === B.chest ? 'chest' : 'furnace'); }}""")
            for _ in range(random.randint(1, 6)): await pg.mouse.click(random.randint(60, 380), random.randint(40, 240), button=random.choice(['left', 'right']))
            await m.ev(i, f"""() => {{ const k = {K}; if (k.ui.screen) k.ui.close(true); }}""")
        elif r < 0.9:
            # 相手のそばへ・遠くへ
            await m.ev(i, f"""() => {{ const k = {K}, p = k.player, o = [...k.net.peers.values()][0]; if (!o || p.dead) return; if (Math.random() < 0.6) {{ p.x = o.x + 1.5; p.z = o.z + 0.5; p.y = o.y + 0.5; }} else {{ p.x += Math.random() * 160 - 80; p.z += Math.random() * 160 - 80; k.game.needSafeSpot = 1; }} }}""")
        elif r < 0.93:
            await m.ev(i, f"""() => {{ const k = {K}, p = k.player, w = k.game.world; const x = Math.floor(p.x) + 2, y = Math.floor(p.y) + 1, z = Math.floor(p.z); w.setBlock(x, y, z, [k.B.water, k.B.lava, k.B.sand, k.B.torch, k.B.bed, k.B.altar][Math.floor(Math.random() * 6)], 0); }}""")
        elif r < 0.95:
            await m.ev(i, "() => { if (Math.random() < 0.5) firebase.__offline(); else firebase.__online(); }")
        else:
            await m.ev(i, f"""() => {{ const k = {K}, p = k.player, w = k.game.world; const x = Math.floor(p.x) + Math.floor(Math.random() * 7) - 3, y = Math.floor(p.y) + Math.floor(Math.random() * 5) - 1, z = Math.floor(p.z) + Math.floor(Math.random() * 7) - 3; w.setBlock(x, y, z, Math.random() < 0.5 ? 0 : k.B.cobble, 0); }}""")
        await m.wait(random.randint(20, 150))
    for i in (0, 1):
        for k in held[i]: await m.pg[i].keyboard.up(k)
        await m.ev(i, "() => firebase.__online()")
    await m.wait(3000)
    for i in (0, 1):
        print('p%d' % i, await m.ev(i, f"() => {{ const k = {K}, p = k.player; return JSON.stringify({{ state: k.game.state, hp: p.hp, dead: p.dead, pos: [Math.round(p.x), Math.round(p.y), Math.round(p.z)], own: k.ents.filter(e => !e.remote).length, shadow: k.ents.filter(e => e.remote).length, peers: k.net.peers.size, regions: k.net.regions.size, deaths: p.stats.deaths, kills: p.stats.kills, conn: k.net.connected }}); }}"))
    errs = [e for e in m.errs() if '404' not in e]
    print('actions', n, 'errors', len(errs))
    for e in errs[:12]: print('  ', e[:500])
    await m.close()
asyncio.run(main())
