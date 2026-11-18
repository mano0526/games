# べつの世界（ホムラの底・ソラのはて）：門・行き来・生き物・ボス・保存（1人用）
import asyncio, json, sys, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from lib import Sess
K = "window.__kk"
ok_all = True
def check(name, cond, extra=''):
    global ok_all
    print(('OK  ' if cond else 'NG  ') + name, extra)
    if not cond: ok_all = False
async def until(s, js, timeout=60000):
    try: await s.pg.wait_for_function(js, timeout=timeout)
    except Exception as e:
        print('  待ちきれなかった：', js[:90]); print('  状態', await s.ev(f"() => {{ const k = {K}; return [k.game.state, k.world.dim, k.ui.menu, k.player.dead, !!k.game.arrive, k.game.loadT, k.ents.length]; }}"))
        for l in [l for l in s.logs if 'PAGEERROR' in l or l.startswith('error')][:8]: print('  LOG', l[:400])
        raise
async def main():
    only = sys.argv[1] if len(sys.argv) > 1 else ''
    s = await Sess().start(1280, 720)
    await s.ev(f"() => {{ const st = {K}.settings; st.viewDist = 5; st.showInfo = true; st.music = 0; }}")
    await s.new_world('2468', mode=1, diff=2)
    await s.wait(1200)
    # 1. 黒曜石のわくを作って 火打ち金で門をひらく
    r = await s.ev(f"""() => {{ const k = {K}, w = k.world, B = k.B, I = k.I, p = k.player;
      const x = Math.floor(p.x) + 3, z = Math.floor(p.z), y = Math.floor(p.y) + 3; window.__g = [x, y, z];
      for (let dx = -1; dx <= 2; dx++) for (let dy = -1; dy <= 3; dy++) {{ const edge = dx === -1 || dx === 2 || dy === -1 || dy === 3; w.setBlock(x + dx, y + dy, z, edge ? B.obsidian : 0, 0); }}
      const bad = k.tryLightGate(w, x + 5, y, z);                      // わくの外では ひらかない
      p.inv[0] = {{ id: I.flint_steel, n: 1, d: 0 }}; p.sel = 0;
      const t = {{ x: x, y: y - 1, z: z, nx: 0, ny: 1, nz: 0, id: B.obsidian, meta: 0, t: 2 }};
      p.useLighter(w, t);
      return [bad, w.getBlock(x, y, z) === B.homura_gate, w.getBlock(x + 1, y + 2, z) === B.homura_gate, w.getMeta(x, y, z), [...k.game.gates.keys()], p.inv[0] && p.inv[0].d, !!k.game.ach.gate]; }}""")
    check('火打ち金で門がひらく（わくの外ではひらかない）', r[0] is None and r[1] and r[2] and r[3] == 0 and len(r[4]) == 1, r)
    await s.ev(f"() => {{ const p = {K}.player, g = window.__g; p.flying = true; p.x = g[0] + 1; p.y = g[1] + 1; p.z = g[2] + 4.5; p.yaw = 0; p.pitch = -0.1; {K}.world.time = 6000; }}")
    await s.wait(900); await s.shot('dim_gate')
    # わくをこわすと 門が消える → もう一度ひらく
    r = await s.ev(f"""() => {{ const k = {K}, w = k.world, B = k.B, g = window.__g; w.setBlock(g[0] - 1, g[1] + 1, g[2], 0, 0);
      const gone = w.getBlock(g[0], g[1], g[2]) === 0 && w.getBlock(g[0] + 1, g[1] + 2, g[2]) === 0;
      w.setBlock(g[0] - 1, g[1] + 1, g[2], B.obsidian, 0); const again = !!k.tryLightGate(w, g[0], g[1], g[2]); return [gone, again]; }}""")
    check('わくをこわすと門が消える', r == [True, True], r)
    # 2. 門に入る → ホムラの底
    await s.ev(f"() => {{ const p = {K}.player, g = window.__g; p.flying = true; p.vy = 0; p.x = g[0] + 1; p.y = g[1] + 0.05; p.z = g[2] + 0.5; }}")
    await until(s, f"{K}.world.dim === 1 && {K}.game.state === 'playing'", 90000)
    await s.wait(1500)
    r = await s.ev(f"""() => {{ const k = {K}, w = k.world, p = k.player, B = k.B; const fx = Math.floor(p.x - 0.01), fy = Math.floor(p.y + 0.1), fz = Math.floor(p.z);
      return [w.dim, w.getBlock(fx, fy, fz) === B.homura_gate, [...k.game.gates.values()].map(g => [g.d, g.x, g.y, g.z]), +p.x.toFixed(1), +p.y.toFixed(1), +p.z.toFixed(1), !!k.game.ach.homura, k.BIOME_NAMES[w.biomeAt(Math.floor(p.x), Math.floor(p.z))], document.getElementById('mini').hidden]; }}""")
    g0 = (await s.ev("() => window.__g"))
    check('門をくぐると ホムラの底（着いた先にも門ができる）', r[0] == 1 and r[1] and len(r[2]) == 2 and abs(r[3] - g0[0] / 8) < 14 and abs(r[5] - g0[2] / 8) < 14 and r[8], r)
    await s.ev(f"() => {{ const p = {K}.player; p.flying = true; p.vy = 0; p.z += 3; p.yaw = 0; p.pitch = -0.15; }}"); await s.wait(1500); await s.shot('dim_homura1')
    # まわりを見る（高い所から）
    for i, (dx, dy, dz, yaw, pit) in enumerate([(0, 6, 8, 0.6, -0.5), (10, 2, -6, 3.4, -0.2), (-14, 10, 0, 1.6, -0.6)]):
        await s.ev(f"() => {{ const p = {K}.player; p.flying = true; p.vy = 0; p.x += {dx}; p.y = Math.min(110, Math.max(36, p.y + {dy})); p.z += {dz}; p.yaw = {yaw}; p.pitch = {pit}; }}")
        await s.wait(2200); await s.shot('dim_homura%d' % (i + 2))
    # 3. とりで
    r = await s.ev(f"""() => {{ const k = {K}, p = k.player, f = k.nearestFort(k.world.seed, p.x, p.z); p.flying = true; p.vy = 0; p.x = f.x + 0.5; p.z = f.z + 3.5; p.y = f.y + 9; p.yaw = 0.5; p.pitch = -0.6; return [f.x, f.z, f.y, f.arms]; }}""")
    await until(s, f"{K}.world.isLoaded(Math.floor({K}.player.x), Math.floor({K}.player.z))", 60000)
    await s.wait(3500); await s.shot('dim_fort1')
    await s.ev(f"() => {{ const k = {K}, p = k.player, f = k.nearestFort(k.world.seed, p.x, p.z); p.x = f.x + 0.5; p.z = f.z + 12.5; p.y = f.y + 2.2; p.yaw = 0; p.pitch = -0.05; }}"); await s.wait(1800); await s.shot('dim_fort2')
    r2 = await s.ev(f"""() => {{ const k = {K}, w = k.world, B = k.B, p = k.player, f = k.nearestFort(w.seed, p.x, p.z); p.x = f.x + 0.5; p.z = f.z + 2.5; p.y = f.y + 1.01; p.flying = false; p.mode = 0; p.hp = 20; let chest = null;
      const d = 0, ex = f.x, ez = f.z + f.arms[0] + 4 + 2; const e = w.getEnt(ex, f.y + 1, ez); if (e) chest = e.items.filter(Boolean).map(s => k.ITEMS[s.id].name + '×' + s.n);
      return [w.getBlock(f.x + 3, f.y, f.z + 3) === B.yake_bricks, chest, w.isLoaded(ex, ez)]; }}""")
    for _ in range(20):
        await s.wait(500)
        r3 = await s.ev(f"() => [!!{K}.game.ach.fort]")
        if r3[0]: break
    check('とりで（広場・宝箱・ノートの目標）', r2[0] and r3[0] and (r2[1] is None and not r2[2] or (r2[1] and len(r2[1]) >= 3)), [r, r2, r3])
    # 4. 生き物：わき方と見た目
    r = await s.ev(f"""() => {{ const k = {K}, w = k.world; const cnt = {{}}; for (let i = 0; i < 400; i++) k.spawnCycle(w); for (const e of k.ents) if (e.kind === 'mob') cnt[e.type] = (cnt[e.type] || 0) + 1; return cnt; }}""")
    check('ホムラの底の生き物がわく（とりでには ホムラビ）', r.get('homurabi', 0) >= 1 and sum(r.values()) >= 4 and not any(t in r for t in ['sheep', 'shade', 'cow']), r)
    await s.ev(f"""() => {{ const k = {K}, p = k.player, f = k.nearestFort(k.world.seed, p.x, p.z); for (const e of k.ents) e.dead = true; p.mode = 1; p.flying = true; p.x = f.x + 0.5; p.z = f.z - 3.5; p.y = f.y + 1.8; p.yaw = Math.PI; p.pitch = -0.08;
      const mk = (t, dx, dy) => {{ const e = k.spawnMob(t, f.x + 0.5 + dx, f.y + 1 + dy, f.z + 3.5); e.yaw = e.pyaw = 0; return e; }};
      mk('homurabi', -4, 1); mk('yakebone', -2, 0); mk('magmadama', 0, 0); mk('ukikurage', 3.5, 1.5); }}""")
    await s.wait(700); await s.shot('dim_mobs')
    # ホムラビの火の玉で 火がつく／ウキクラゲの玉は はじける
    r = await s.ev(f"""() => {{ const k = {K}, p = k.player; for (const e of k.ents) e.dead = true; p.mode = 0; p.flying = false; p.hp = 20; p.burnT = 0; p.hurtT = 0;
      const s1 = k.spawnShot ? 1 : 0; return s1; }}""")
    await s.ev(f"""() => {{ const k = {K}, p = k.player; const sh = (kind) => {{ const e = {{ kind: 'shot', x: p.x, y: p.y + 1, z: p.z + 2, px: p.x, py: p.y + 1, pz: p.z + 2, vx: 0, vy: 0, vz: -10, hw: 0.15, h: 0.3, dmg: 5, dark: kind, age: 0, dead: false, nid: 99990 + kind }}; k.ents.push(e); }}; sh(2); }}""")
    await s.wait(900)
    r = await s.ev(f"() => {{ const p = {K}.player; return [p.hp, p.burnT > 0]; }}")
    check('火の玉に当たると ダメージと火', r[0] < 20 and r[1], r)
    await s.ev(f"() => {{ const p = {K}.player; p.hp = 20; p.burnT = 0; p.hurtT = 0; }}")
    # 5. 水は置けない・ベッドでねむれない
    r = await s.ev(f"""() => {{ const k = {K}, w = k.world, B = k.B, I = k.I, p = k.player, fx = Math.floor(p.x), fy = Math.floor(p.y), fz = Math.floor(p.z);
      p.inv[1] = {{ id: I.water_bucket, n: 1, d: 0 }}; p.sel = 1; p.target = {{ x: fx, y: fy - 1, z: fz + 1, nx: 0, ny: 1, nz: 0, id: w.getBlock(fx, fy - 1, fz + 1), meta: 0, t: 2 }};
      p.useBucket(w, p.inv[1], k.ITEMS[I.water_bucket]);
      return [w.getBlock(fx, fy, fz + 1), p.inv[1].id === I.bucket]; }}""")
    check('ホムラの底では 水が置けない', r == [0, True], r)
    # 6. 力つきる → もとの世界で復活。落とした物は ホムラの底に残る
    await s.ev(f"() => {{ const k = {K}, p = k.player; p.inv[2] = {{ id: k.I.diamond, n: 5, d: 0 }}; p.hurtT = 0; p.damage(999, p.x, p.z, 0, 'テスト', true); }}")
    await s.wait(1500)
    r0 = await s.ev(f"() => [{K}.player.dead, {K}.ents.filter(e => e.kind === 'item').length]")
    await s.ev(f"() => {K}.game.respawn()")
    await until(s, f"{K}.world.dim === 0 && {K}.game.state === 'playing'", 90000)
    await s.wait(800)
    r = await s.ev(f"() => {{ const k = {K}, p = k.player, ws = k.game.worldSpawn; return [p.dead, p.hp, Math.round(Math.hypot(p.x - ws.x, p.z - ws.z)), k.game.limbo[1].length, k.ents.filter(e => e.kind === 'item').length, k.world.getBlock(Math.floor(p.x), Math.floor(p.y - 0.5), Math.floor(p.z)) > 0]; }}")
    check('べつの世界で力つきると もとの世界で復活（落とし物は むこうに残る）', r0[0] and r0[1] >= 2 and (not r[0]) and r[1] == 20 and r[2] < 12 and r[3] >= 2 and r[4] == 0 and r[5], [r0, r])
    # 7. もう一度 門へ → 前と同じ門に出る → 落とし物を拾える
    await s.ev(f"() => {{ const p = {K}.player, g = window.__g; p.mode = 1; p.flying = true; p.vy = 0; p.gateWait = false; p.x = g[0] + 1; p.y = g[1] + 0.05; p.z = g[2] + 0.5; }}")
    await until(s, f"{K}.world.dim === 1 && {K}.game.state === 'playing'", 90000)
    await s.wait(800)
    r = await s.ev(f"() => {{ const k = {K}; return [k.game.gates.size, k.ents.filter(e => e.kind === 'item').length, k.game.limbo[1].length]; }}")
    check('同じ門に出る（門はふえない）・落とし物がもどっている', r[0] == 2 and r[1] >= 2 and r[2] == 0, r)
    # 8. ホムラの底でセーブ → 読み直すと ホムラの底から
    wid = await s.ev(f"() => {K}.game.worldId")
    await s.ev(f"() => {{ const p = {K}.player; p.gateWait = true; p.z += 2; }}"); await s.wait(300)
    await s.ev(f"async () => {{ await {K}.game.save(); }}")
    await s.ev(f"() => {K}.game.quitToTitle()")
    await until(s, f'{K}.game.state === "title"', 30000)
    await s.ev(f"() => {K}.game.loadWorld('{wid}')")
    await until(s, f'{K}.game.state === "playing"', 90000)
    await s.wait(1000)
    r = await s.ev(f"() => {{ const k = {K}, w = k.world, p = k.player; return [w.dim, k.game.gates.size, w.getBlock(Math.floor(p.x), Math.floor(p.y + 0.1), Math.floor(p.z) - 2) === k.B.homura_gate || w.getBlock(Math.floor(p.x - 0.01), Math.floor(p.y + 0.1), Math.floor(p.z) - 2) === k.B.homura_gate, k.BIOME_NAMES[w.biomeAt(Math.floor(p.x), Math.floor(p.z))]]; }}")
    check('ホムラの底でやめても、そこから続き', r[0] == 1 and r[1] == 2 and r[2], r)
    # 9. 門で帰る → もとの門のそば
    await s.ev(f"() => {{ const p = {K}.player; p.flying = true; p.vy = 0; p.gateWait = false; p.z -= 2; }}")
    await until(s, f"{K}.world.dim === 0 && {K}.game.state === 'playing'", 90000)
    await s.wait(800)
    r = await s.ev(f"() => {{ const k = {K}, p = k.player, g = window.__g; return [Math.round(Math.hypot(p.x - g[0] - 1, p.z - g[2] - 0.5) * 10) / 10, Math.round((p.y - g[1]) * 10) / 10, k.game.gates.size]; }}")
    check('帰りは もとの門に出る', r[0] < 1.5 and abs(r[1]) < 0.5 and r[2] == 2, r)
    errs = [l for l in s.logs if 'PAGEERROR' in l or l.startswith('error')]
    check('エラーなし', len(errs) == 0, errs[:6])
    await s.close()
    print('ALL OK' if ok_all else 'SOME NG')
asyncio.run(main())
