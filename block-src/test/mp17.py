# みんなの世界での 弓矢・盾・はじける敵・はじけ箱：矢が相手にも見える／ほかの人の生き物に当たる／はじけのダメージが それぞれに届く
import asyncio, sys, json
sys.path.insert(0, __import__('os').path.dirname(__import__('os').path.abspath(__file__)))
from mplib import Mp, K
ok_all = True
def check(name, cond, extra=''):
    global ok_all
    print(('OK  ' if cond else 'NG  ') + name, extra)
    if not cond: ok_all = False
async def poll(m, i, js, cond, n=60, ms=300):
    r = None
    for _ in range(n):
        r = await m.ev(i, js)
        if cond(r): break
        await m.wait(ms)
    return r
async def main():
    m = await Mp().start(2)
    await m.ev(0, f"() => {{ {K}.game.startNew('弓の島', '5252', 0, 2, true, {{ pvp: true }}); }}")
    await m.playing(0)
    code = await m.ev(0, f"() => {K}.net.code")
    await m.ev(1, f"(c) => {{ {K}.game.joinOnline(c); }}", code)
    await m.playing(1); await m.wait(2500)
    v = [await m.ev(i, f"() => {K}.NET_VER") for i in (0, 1)]
    check('通信の版（2人とも同じ。矢とはじけの版より新しい）', v[0] == v[1] and v[0] >= 5, v)
    # A が台を作る。A は南のはし、B は北のはし（14マスはなれる）
    o = await m.ev(0, f"""() => {{ const k = {K}, w = k.world, B = k.B, p = k.player; const ox = Math.floor(p.x), oz = Math.floor(p.z), Y = Math.floor(p.y) + 12;
      for (let z = -10; z <= 10; z++) for (let x = -10; x <= 10; x++) {{ w.setBlock(ox + x, Y - 2, oz + z, B.stone, 0); w.setBlock(ox + x, Y - 1, oz + z, B.grass, 0); for (let y = Y; y < Y + 6; y++) w.setBlock(ox + x, y, oz + z, (Math.abs(x) === 10 || Math.abs(z) === 10) && y < Y + 2 ? B.stone : 0, 0); }}
      for (const e of k.ents) if (!e.remote) e.dead = true; p.x = ox + 0.5; p.y = Y + 0.01; p.z = oz + 7.5; p.yaw = 0; p.pitch = 0; w.time = 18000; return [ox, Y, oz]; }}""")
    await m.wait(1500)
    await m.ev(1, f"(o) => {{ const k = {K}, p = k.player; window.__o = o; for (const e of k.ents) if (!e.remote) e.dead = true; p.x = o[0] + 0.5; p.y = o[1] + 0.01; p.z = o[2] - 6.5; p.vx = p.vy = p.vz = 0; p.yaw = Math.PI; p.pitch = 0; p.hp = 20; }}", o)
    await m.ev(0, f"(o) => {{ window.__o = o; }}", o)
    for i in (0, 1):   # 夜なので まわりに敵がわく。台の外のものは 消しておく
        await m.ev(i, f"() => {{ setInterval(() => {{ const k = {K}, o = window.__o; for (const e of k.ents) if (!e.remote && e.kind === 'mob' && Math.hypot(e.x - o[0] - 0.5, e.z - o[2] - 0.5) > 13) e.dead = true; }}, 150); }}")
    await m.wait(1200)
    # 1. B が、A の動かしているウシを 矢でうつ
    await m.ev(0, f"() => {{ const k = {K}, o = window.__o; window.__cow = k.spawnMob('cow', o[0] + 0.5, o[1], o[2] + 0.5); }}")
    r = await poll(m, 1, f"() => {K}.ents.filter(e => e.remote && e.type === 'cow').length", lambda r: r == 1)
    check('A のウシが B に見える', r == 1, r)
    await m.ev(0, f"() => {{ window.__seen = 0; window.__iv = setInterval(() => {{ const k = {K}; if (k.ents.some(e => e.kind === 'shot' && e.dark === 6 && e.foreign)) window.__seen++; const c = window.__cow; const o = window.__o; c.x = o[0] + 0.5; c.z = o[2] + 0.5; c.vx = c.vz = 0; }}, 30); }}")
    await m.ev(1, f"""() => {{ const k = {K}, p = k.player, I = k.I, c = k.ents.find(e => e.remote && e.type === 'cow'); p.inv.fill(null); p.inv[0] = {{ id: I.bow, n: 1, d: 0 }}; p.inv[1] = {{ id: I.arrow, n: 8, d: 0 }}; p.sel = 0;
      const dx = c.x - p.x, dy = c.y + 0.6 - (p.y + 1.52), dz = c.z - p.z, dl = Math.hypot(dx, dy, dz); p.yaw = Math.atan2(-dx, -dz); p.ray = [dx / dl * 0.9, 0.42, dz / dl * 0.9]; p.shootBow(1); window.__aim = [dx / dl, dy / dl - 0.02, dz / dl]; }}""")   # まず 高くうつ（長く飛ぶので 相手の画面にも出る）
    r = await poll(m, 0, f"() => window.__seen", lambda r: r > 0, 40, 150)
    check('B の矢が A の画面にも見える', r > 0, r)
    await m.ev(1, f"() => {{ const p = {K}.player; p.ray = window.__aim; p.shootBow(1); }}")
    r = await poll(m, 0, f"() => [window.__cow.hp, window.__cow.maxHp]", lambda r: r[0] < r[1], 40, 150)
    check('B の矢が A のウシに当たる', r[0] < r[1], r)
    await m.ev(0, f"() => {{ clearInterval(window.__iv); window.__cow.dead = true; }}")
    # 2. 弓を引く・盾をかまえる すがたが 相手に伝わる
    await m.ev(1, f"() => {{ const k = {K}, p = k.player; p.armor[4] = {{ id: k.I.shield, n: 1, d: 0 }}; k.touchSt.use = true; }}")
    r = await poll(m, 0, f"() => {{ const k = {K}; const p = [...k.net.peers.values()][0]; return [p.held, p.shield, p.blocking]; }}", lambda r: r[0] in (360, 361) and r[1], 40, 150)
    check('弓を引いているのが A に見える（盾も）', r[0] in (360, 361) and r[1] is True, r)
    await m.ev(1, f"() => {{ const k = {K}, p = k.player; k.touchSt.use = false; p.inv[0] = {{ id: k.I.iron_sword, n: 1, d: 0 }}; }}"); await m.wait(600)
    await m.ev(1, f"() => {{ const k = {K}; for (const e of k.ents) if (e.kind === 'shot') e.dead = true; k.player.target = null; k.touchSt.use = true; }}")
    r = await poll(m, 0, f"() => {{ const k = {K}; const p = [...k.net.peers.values()][0]; return [p.held, p.shield, p.blocking]; }}", lambda r: r[2] is True, 40, 150)
    check('盾をかまえているのが A に見える', r[1] is True and r[2] is True, r)
    # 3. 対戦がオンのとき：A の矢を B が盾で はじく → 盾をおろすと当たる
    SHOOT_B = f"""() => {{ const k = {K}, p = k.player, I = k.I, b = [...k.net.peers.values()][0]; p.inv[0] = {{ id: I.bow, n: 1, d: 0 }}; p.inv[1] = {{ id: I.arrow, n: 30, d: 0 }}; p.sel = 0;
      const dx = b.x - p.x, dz = b.z - p.z, dh = Math.hypot(dx, dz); p.yaw = Math.atan2(-dx, -dz); p.ray = [dx / dh, 0.03, dz / dh]; p.shootBow(1); }}"""
    await m.ev(1, f"() => {{ const k = {K}, p = k.player, a = [...k.net.peers.values()][0]; p.yaw = Math.atan2(-(a.x - p.x), -(a.z - p.z)); p.hp = 20; p.hurtT = 0; }}")
    for i in range(4): await m.ev(0, SHOOT_B); await m.wait(900)
    r = await m.ev(1, f"() => {{ const p = {K}.player; return [p.hp, p.armor[4] ? p.armor[4].d : -1, p.blocking]; }}")
    check('かまえた盾が ほかの人の矢を はじく', r[0] == 20 and r[1] >= 10, r)
    await m.ev(1, f"() => {{ {K}.touchSt.use = false; }}"); await m.wait(500)
    await m.ev(0, SHOOT_B)
    r = await poll(m, 1, f"() => [{K}.player.hp, {K}.player.dead]", lambda r: r[0] < 20, 40, 150)
    check('盾をおろすと 矢が当たる（対戦オン）', r[0] < 20 and not r[1], r)
    # 4. A が動かすバクダケが B のそばで はじける → B にダメージ、穴は 2人とも同じ
    await m.ev(1, f"() => {{ const p = {K}.player; p.hp = 20; p.hurtT = 0; p.armor[4] = null; }}")
    await m.ev(0, f"() => {{ const k = {K}, b = [...k.net.peers.values()][0]; for (const e of k.ents) if (e.kind === 'shot') e.dead = true; window.__b = k.spawnMob('bakudake', b.x, b.y, b.z + 3.5); }}")
    r = await poll(m, 1, f"() => {{ const es = {K}.ents.filter(e => e.type === 'bakudake'); return es.length ? [Math.max(...es.map(e => e.fuse | 0)), es.some(e => e.remote)] : [-1, false]; }}", lambda r: r[0] >= 5, 200, 150)
    check('ふくらむのが B の画面でも見える', r[0] >= 5, r)
    HOLES = f"""() => {{ const k = {K}, w = k.world, o = window.__o; let h = 0; for (let z = -9; z <= 9; z++) for (let x = -9; x <= 9; x++) if (w.getBlock(o[0] + x, o[1] - 1, o[2] + z) === 0) h++; return h; }}"""
    r = await poll(m, 1, f"() => {K}.player.hp", lambda r: r < 20, 200, 150)
    await m.wait(2500)
    h = [await m.ev(i, HOLES) for i in (0, 1)]
    a_hp = await m.ev(0, f"() => {K}.player.hp")
    check('はじけて B にダメージ（遠い A は 無傷）。穴は 2人とも同じ', r < 20 and a_hp == 20 and h[0] >= 5 and h[0] == h[1], [r, a_hp, h])
    # 5. A が はじけ箱に火をつける → B にも 火のついた箱が見え、はじけると B にもダメージ
    await m.ev(1, f"() => {{ const p = {K}.player, o = window.__o; p.hp = 20; p.hurtT = 0; p.x = o[0] + 4.5; p.z = o[2] + 3.5; }}")
    await m.ev(0, f"""() => {{ const k = {K}, w = k.world, B = k.B, I = k.I, p = k.player, o = window.__o; p.hp = 20; w.setBlock(o[0] + 4, o[1], o[2] + 1, B.hajike_box, 0);
      p.inv[0] = {{ id: I.flint_steel, n: 1, d: 0 }}; p.sel = 0; p.target = {{ x: o[0] + 4, y: o[1], z: o[2] + 1, nx: 0, ny: 0, nz: 1, id: B.hajike_box, meta: 0, t: 3 }}; p.targetMob = null; p.use(w); }}""")
    r = await poll(m, 1, f"() => {K}.ents.filter(e => e.remote && e.kind === 'primed').map(e => e.fuse)", lambda r: len(r) == 1, 40, 100)
    check('火のついた はじけ箱が B にも見える', len(r) == 1 and 0 < r[0] <= 80, r)
    r = await poll(m, 1, f"() => [{K}.player.hp, {K}.ents.filter(e => e.kind === 'primed').length]", lambda r: r[0] < 20 and r[1] == 0, 400, 100)
    await m.wait(2500)
    h2 = [await m.ev(i, HOLES) for i in (0, 1)]
    check('はじけ箱の ばくはつが B にも届く。穴は 2人とも同じ', r[0] < 20 and r[1] == 0 and h2[0] > h[0] and h2[0] == h2[1], [r, h2])
    errs = [e for e in m.errs() if '404' not in e]
    check('エラーなし', len(errs) == 0, errs[:6])
    await m.close()
    print('ALL OK' if ok_all else 'SOME NG')
asyncio.run(main())
