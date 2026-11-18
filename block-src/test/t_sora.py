# ソラのはて：門の輪・ボス「ホシクイ」の戦い・かえりの門・おわりの画面（1人用）
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
    s = await Sess().start(1280, 720)
    await s.ev(f"() => {{ const st = {K}.settings; st.viewDist = 6; st.showInfo = true; st.music = 0; }}")
    await s.new_world('1357', mode=1, diff=2)
    await s.wait(1000)
    # 1. わく12こで輪をつくる（最後の1こは 手で置く）
    r = await s.ev(f"""() => {{ const k = {K}, w = k.world, B = k.B, p = k.player;
      const cx = Math.floor(p.x) + 6, cz = Math.floor(p.z), y = Math.floor(p.y) + 2; window.__r = [cx, y, cz];
      for (let dz = -3; dz <= 3; dz++) for (let dx = -3; dx <= 3; dx++) {{ w.setBlock(cx + dx, y - 1, cz + dz, B.stone_bricks, 0); for (let dy = 0; dy < 4; dy++) w.setBlock(cx + dx, y + dy, cz + dz, 0, 0); }}
      const ring = []; for (let dz = -2; dz <= 2; dz++) for (let dx = -2; dx <= 2; dx++) {{ const e = Math.abs(dx) === 2 || Math.abs(dz) === 2, c = Math.abs(dx) === 2 && Math.abs(dz) === 2; if (e && !c) ring.push([dx, dz]); }}
      for (let i = 0; i < 11; i++) w.setBlock(cx + ring[i][0], y, cz + ring[i][1], B.sora_frame, 0);
      const before = w.getBlock(cx, y, cz);
      const L = ring[11]; p.inv[0] = {{ id: B.sora_frame, n: 1, d: 0 }}; p.sel = 0; p.x = cx - 6; p.z = cz + 0.5;
      const t = {{ x: cx + L[0], y: y - 1, z: cz + L[1], nx: 0, ny: 1, nz: 0, id: B.stone_bricks, meta: 0, t: 3 }};
      const placed = p.placeBlock(w, t, B.sora_frame);
      let n = 0; for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) if (w.getBlock(cx + dx, y, cz + dz) === B.sora_gate) n++;
      return [ring.length, before, placed, n, w.getMeta(cx, y, cz)]; }}""")
    check('わく12この輪で ソラの門がひらく', r == [12, 0, True, 9, 2], r)
    await s.ev(f"() => {{ const p = {K}.player, g = window.__r; p.flying = true; p.vy = 0; p.x = g[0] + 0.5; p.y = g[1] + 4.5; p.z = g[2] + 6.5; p.yaw = 0; p.pitch = -0.75; {K}.world.time = 6000; }}")
    await s.wait(1200); await s.shot('sora_ring')
    r = await s.ev(f"() => {{ const k = {K}, w = k.world, g = window.__r; w.setBlock(g[0] + 2, g[1], g[2], 0, 0); let n = 0; for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) if (w.getBlock(g[0] + dx, g[1], g[2] + dz) === k.B.sora_gate) n++; w.setBlock(g[0] + 2, g[1], g[2], k.B.sora_frame, 0); k.game.checkSoraRing(g[0] + 2, g[1], g[2]); let m = 0; for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) if (w.getBlock(g[0] + dx, g[1], g[2] + dz) === k.B.sora_gate) m++; return [n, m]; }}")
    check('わくを1こ外すと門が消え、もどすと またひらく', r == [0, 9], r)
    # 2. とびこむ → ソラのはて
    await s.ev(f"() => {{ const p = {K}.player, g = window.__r; p.mode = 0; p.flying = false; p.hp = 20; p.x = g[0] + 0.5; p.y = g[1] + 1.2; p.z = g[2] + 0.5; p.vy = 0; }}")
    await until(s, f"{K}.world.dim === 2 && {K}.game.state === 'playing'", 90000)
    await s.wait(1200)
    r = await s.ev(f"() => {{ const k = {K}, w = k.world, p = k.player; return [w.dim, Math.round(p.x), Math.round(p.y), Math.round(p.z), p.onGround, w.getBlock(Math.floor(p.x), Math.floor(p.y - 0.5), Math.floor(p.z)) === k.B.soraishi, k.BIOME_NAMES[w.biomeAt(Math.floor(p.x), Math.floor(p.z))]]; }}")
    check('ソラのはての島の上に出る', r[0] == 2 and abs(r[1] - 50) < 9 and r[5], r)
    await s.shot('sora_arrive')
    await until(s, f"{K}.game.boss && {K}.game.boss.type === 'hoshikui'", 20000)
    await s.ev(f"() => {{ const p = {K}.player; p.yaw = Math.PI / 2; p.pitch = 0.45; }}"); await s.wait(2500); await s.shot('sora_boss1')
    # 3. 戦い：90秒ながめる（体力はへらないようにしておく）。動き方と、受けた攻撃を数える
    await s.ev(f"""() => {{ const k = {K}, p = k.player; window.__log = {{ ph: [], hits: 0, breath: 0, land: 0, minD: 99, shots: 0 }}; let last = -1, lastHp = 20;
      window.__iv = setInterval(() => {{ const b = k.game.boss; if (!b) {{ p.hp = 20; return; }} if (b.ph !== last) {{ last = b.ph; window.__log.ph.push(b.ph); }} if (p.hp < lastHp) window.__log.hits++; p.hp = 20; lastHp = 20; p.food = 20; if (b.breath) window.__log.breath++; if (b.land) window.__log.land++;
        const d = Math.hypot(b.x - p.x, b.y - p.y, b.z - p.z); if (d < window.__log.minD) window.__log.minD = d; window.__log.shots = Math.max(window.__log.shots, k.ents.filter(e => e.kind === 'shot').length);
        if (b.land && !window.__shotLand) window.__shotLand = 1; }}, 50); }}""")
    # 台の近くに立って待つ
    await s.ev(f"() => {{ const k = {K}, p = k.player; p.x = 7.5; p.z = 0.5; p.y = k.world.surfaceY(7, 0) + 1.01; p.yaw = Math.PI / 2; p.pitch = 0.25; }}")
    got = False
    for i in range(75):
        await s.wait(2000)
        st = await s.ev(f"() => {{ const b = {K}.game.boss; return b ? [b.ph, b.land, b.breath, Math.round(b.x), Math.round(b.y), Math.round(b.z), Math.round(b.hp)] : null; }}")
        if st and st[1] and not got: got = True; await s.wait(300); await s.shot('sora_perch'); await s.wait(2600); await s.shot('sora_breath')
        if st and st[0] == 1 and i > 2 and not os.path.exists('/tmp/kk/sora_swoop_done'): await s.shot('sora_swoop')
        lg = await s.ev("() => window.__log")
        if got and lg['hits'] >= 1 and 1 in lg['ph'] and i > 20: break
    lg = await s.ev("() => window.__log")
    check('ボスが まわる・とびかかる・台にとまる・いきをはく', 0 in lg['ph'] and 1 in lg['ph'] and 2 in lg['ph'] and lg['land'] > 20 and lg['breath'] > 10, lg)
    check('ボスの攻撃が当たる（とびかかり・いき）', lg['hits'] >= 1 and lg['minD'] < 5, [lg['hits'], round(lg['minD'], 1)])
    # 4. 結晶：残っている間は回復する。こわすと はじけて、つながっていたボスにダメージ
    r = await s.ev(f"""async () => {{ const k = {K}, w = k.world, b = k.game.boss, p = k.player; const pil = k.soraPillars();
      b.hp = 150; await new Promise(r => setTimeout(r, 2600)); const healed = b.hp; b.hp = 158;
      p.x = 0.5; p.z = 0.5; p.y = 96; p.flying = true; p.mode = 1; p.vy = 0;
      await new Promise(r => setTimeout(r, 1500));
      const hp = b.healP; if (!hp) return [healed, null];
      const t = {{ x: hp.x, y: hp.top + 2, z: hp.z, id: w.getBlock(hp.x, hp.top + 2, hp.z), meta: 0, nx: 0, ny: 1, nz: 0, t: 2 }};
      const before = b.hp; p.finishBreak(w, t);
      let left = 0; for (const q of pil) if (w.getBlock(q.x, q.top + 2, q.z) === k.B.hoshi_crystal) left++;
      return [healed, t.id === k.B.hoshi_crystal, before, b.hp, left, w.isLoaded(hp.x, hp.z)]; }}""")
    check('結晶で回復する・こわすとボスにダメージ', r[0] > 150 and r[1] and r[3] <= r[2] - 8 and r[4] == 7, r)
    await s.wait(400); await s.shot('sora_crystal')
    # 5. たおす → かえりの門・たまご・おわりの画面
    await s.ev(f"() => {{ const k = {K}, w = k.world, p = k.player, b = k.game.boss; for (const q of k.soraPillars()) w.setBlock(q.x, q.top + 2, q.z, 0, 0); p.mode = 0; p.flying = false; p.x = 9.5; p.z = 4.5; p.y = w.surfaceY(9, 4) + 1.01; p.hp = 20; b.hp = 3; b.hurt = 0; k.hurtMob(b, 10, p.x, p.z, 0); }}")
    await s.wait(2500); await s.shot('sora_dying')
    # たおれる瞬間が「1秒ごとの見回り」と同じ回に重なっても、次のボスが出ない（前はここで出てしまうことがあった）
    await s.ev(f"() => {{ const k = {K}, b = k.game.boss, w = k.world; if (b) {{ b.death = 110; w.tick = w.tick - (w.tick % 20) + 19; }} }}")
    await until(s, f"{K}.game.soraDone === true", 30000)
    await s.wait(600)
    r = await s.ev(f"() => {{ const k = {K}, w = k.world, B = k.B, Y = k.SORA_PED_Y; let n = 0; for (let dz = -2; dz <= 2; dz++) for (let dx = -2; dx <= 2; dx++) if (w.getBlock(dx, Y + 1, dz) === B.sora_gate) n++; return [n, w.getBlock(0, Y + 5, 0) === B.hoshi_egg, k.game.ended, k.game.soraDone, k.ents.filter(e => e.kind === 'item').map(e => k.ITEMS[e.id].name + '×' + e.n)]; }}")
    nb = await s.ev(f"() => {K}.ents.filter(e => e.kind === 'mob' && e.type === 'hoshikui' && !e.dead).length")
    check('たおすと かえりの門・たまご・ごほうび（次のボスは出ない）', r[0] == 20 and r[1] and r[2] and r[3] and len(r[4]) >= 2 and nb == 0, [r, nb])
    await s.ev(f"() => {{ const p = {K}.player; p.x = 9.5; p.z = 0.5; p.yaw = Math.PI / 2; p.pitch = -0.2; }}"); await s.wait(700); await s.shot('sora_gate')
    await until(s, f"{K}.ui.menu === 'mEnd'", 20000)
    await s.shot('sora_end')
    await s.pg.click('#bEndGo'); await s.wait(500)
    print('  おわりの画面のあと', await s.ev(f"() => [{K}.game.state, {K}.ui.menu, {K}.player.dead, {K}.player.gateWait, !!{K}.game.arrive]"))
    # 6. かえりの門に入る → もとの世界の最初の場所
    await s.ev(f"() => {{ const k = {K}, p = k.player; p.gateWait = false; p.x = 1.5; p.z = 0.5; p.y = k.SORA_PED_Y + 1.3; p.vy = 0; }}")
    await s.wait(1500)
    print('  門に入った', await s.ev(f"() => {{ const k = {K}, p = k.player, w = k.world; return [k.game.state, w.dim, +p.x.toFixed(1), +p.y.toFixed(1), +p.z.toFixed(1), w.getBlock(Math.floor(p.x), Math.floor(p.y + 0.1), Math.floor(p.z)), k.B.sora_gate, p.gateWait, p.dead]; }}"))
    await until(s, f"{K}.world.dim === 0 && {K}.game.state === 'playing'", 90000)
    await s.wait(700)
    r = await s.ev(f"() => {{ const k = {K}, p = k.player, ws = k.game.worldSpawn; return [Math.round(Math.hypot(p.x - ws.x, p.z - ws.z)), p.hp > 0, !!k.game.ach.hoshikui, !!k.game.ach.ring, !!k.game.ach.crystal, k.game.boss === null]; }}")
    check('かえりの門で もとの世界へ', r[0] < 12 and r[1] and r[5], r)
    # 7. もう一度行っても ボスは出ない（門は残っている）
    await s.ev(f"() => {{ const p = {K}.player, g = window.__r; p.gateWait = false; p.flying = false; p.x = g[0] + 0.5; p.y = g[1] + 1.2; p.z = g[2] + 0.5; p.vy = 0; }}")
    await until(s, f"{K}.world.dim === 2 && {K}.game.state === 'playing'", 90000)
    await s.wait(7000)
    r = await s.ev(f"() => {{ const k = {K}, w = k.world; return [k.game.boss === null, k.ents.filter(e => e.kind === 'mob' && e.type === 'hoshikui').length, w.getBlock(1, k.SORA_PED_Y + 1, 0) === k.B.sora_gate]; }}")
    check('たおしたあとは ボスが出ない', r == [True, 0, True], r)
    errs = [l for l in s.logs if 'PAGEERROR' in l or l.startswith('error')]
    check('エラーなし', len(errs) == 0, errs[:6])
    await s.close()
    print('ALL OK' if ok_all else 'SOME NG')
asyncio.run(main())
