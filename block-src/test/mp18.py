# みんなの世界での 経験値の玉・力のこもった物・もえている敵
import asyncio, sys, json
sys.path.insert(0, __import__('os').path.dirname(__import__('os').path.abspath(__file__)))
from mplib import Mp, K
ok_all = True
def check(name, cond, extra=''):
    global ok_all
    print(('OK  ' if cond else 'NG  ') + name, extra)
    if not cond: ok_all = False
async def poll(m, i, js, cond, n=80, ms=250):
    r = None
    for _ in range(n):
        r = await m.ev(i, js)
        if cond(r): break
        await m.wait(ms)
    return r
async def main():
    m = await Mp().start(2)
    await m.ev(0, f"() => {{ {K}.game.startNew('力の島', '6161', 0, 0, true, {{}}); }}")
    await m.playing(0)
    code = await m.ev(0, f"() => {K}.net.code")
    await m.ev(1, f"(c) => {{ {K}.game.joinOnline(c); }}", code)
    await m.playing(1); await m.wait(2500)
    o = await m.ev(0, f"""() => {{ const k = {K}, w = k.world, B = k.B, p = k.player; const ox = Math.floor(p.x), oz = Math.floor(p.z), Y = Math.floor(p.y) + 12;
      for (let z = -8; z <= 8; z++) for (let x = -8; x <= 8; x++) {{ w.setBlock(ox + x, Y - 1, oz + z, B.stone, 0); for (let y = Y; y < Y + 5; y++) w.setBlock(ox + x, y, oz + z, (Math.abs(x) === 8 || Math.abs(z) === 8) && y < Y + 2 ? B.stone : 0, 0); }}
      for (const e of k.ents) if (!e.remote) e.dead = true; p.x = ox + 0.5; p.y = Y + 0.01; p.z = oz + 6.5; p.yaw = 0; return [ox, Y, oz]; }}""")
    await m.wait(1500)
    for i in (0, 1): await m.ev(i, f"(o) => {{ window.__o = o; }}", o)
    await m.ev(1, f"() => {{ const k = {K}, p = k.player, o = window.__o; for (const e of k.ents) if (!e.remote) e.dead = true; p.x = o[0] + 0.5; p.y = o[1] + 0.01; p.z = o[2] - 5.5; p.vx = p.vy = p.vz = 0; p.yaw = Math.PI; p.xpLv = 0; p.xpPt = 0; }}")
    await m.wait(1200)
    # 1. A のウシを B が「もえる刃・えものふやし」の剣でたたく → A のウシが もえる。B にも もえて見える
    await m.ev(0, f"() => {{ const k = {K}, o = window.__o; const c = window.__cow = k.spawnMob('cow', o[0] + 0.5, o[1], o[2] - 4.2); c.hp = c.maxHp = 30; setInterval(() => {{ c.x = o[0] + 0.5; c.z = o[2] - 4.2; c.vx = c.vz = 0; }}, 30); }}")
    r = await poll(m, 1, f"() => {K}.ents.filter(e => e.remote && e.type === 'cow').length", lambda r: r == 1)
    await m.ev(1, f"""() => {{ const k = {K}, p = k.player, I = k.I, c = k.ents.find(e => e.remote && e.type === 'cow'); p.inv.fill(null); p.inv[0] = {{ id: I.iron_sword, n: 1, d: k.enchSet(k.enchSet(0, 1, 2), 3, 3) }}; p.sel = 0; p.cool = 0; p.attack(c); }}""")
    r = await poll(m, 0, f"() => [window.__cow.burnT > 0, window.__cow.loot, window.__cow.pk, window.__cow.hp < 30]", lambda r: r[0] and r[3])
    check('B の剣の力（もえる刃・えものふやし）が A のウシに とどく', r == [True, 3, 1, True], r)
    r = await poll(m, 1, f"() => {{ const c = {K}.ents.find(e => e.remote && e.type === 'cow'); return c ? c.burnT > 0 : null; }}", lambda r: r is True)
    check('もえているのが B にも見える', r is True, r)
    # 2. B が たおす → A の端末が 経験値の玉を出す → B がひろって B の経験値になる
    for i in range(60):   # 2ページ同時だと 進みがおそいので、回数ではなく「たおれるまで」
        await m.ev(1, f"() => {{ const k = {K}, p = k.player, c = k.ents.find(e => e.remote && e.type === 'cow' && Math.hypot(e.x - p.x, e.z - p.z) < 4); if (c) {{ p.cool = 0; p.attack(c); }} }}"); await m.wait(500)
        if await m.ev(0, f"() => window.__cow.hp <= 0"): break
    r = await poll(m, 0, f"() => window.__cow.dead", lambda r: r is True, 120, 250)
    check('A のウシが たおれる', r is True, r)
    r = await poll(m, 1, f"() => {{ const p = {K}.player; return p.xpLv * 100 + p.xpPt; }}", lambda r: r >= 1, 80, 250)
    check('3マスほど はなれた玉も ひろえる（玉を動かしているのは A）', r >= 1, r)
    await m.ev(1, f"() => {{ const p = {K}.player, o = window.__o; p.z = o[2] - 4.4; }}")
    r = await poll(m, 1, f"() => {{ const k = {K}, p = k.player; return [p.xpLv * 100 + p.xpPt, p.inv.filter(x => x && x.id === k.I.raw_beef).reduce((a, x) => a + x.n, 0), p.inv.some(x => x && x.id === k.I.xp_orb)]; }}", lambda r: r[0] >= 1 and r[1] >= 1, 120, 250)
    a = await m.ev(0, f"() => {{ const p = {K}.player; return p.xpLv * 100 + p.xpPt; }}")
    check('たおすと 玉が出て、ひろった B の経験値になる（A は 0 のまま。玉は 持ち物に入らない）', r[0] >= 1 and r[1] >= 1 and r[2] is False and a == 0, [r, a])
    # 3. 力のこもった物を 落とす → 相手がひろっても 力は そのまま。チェストに入れても そのまま
    await m.ev(1, f"() => {{ const k = {K}, p = k.player, o = window.__o; const d = k.enchSet(k.enchSet(7, 0, 4), 2, 1); window.__d = d; k.spawnDrop(o[0] + 0.5, o[1] + 0.5, o[2] + 5.5, k.I.diamond_pick, 1, d, 0, 0, 0, 0); p.inv.fill(null); return d; }}")
    d = await m.ev(1, "() => window.__d")
    r = await poll(m, 0, f"() => {{ const k = {K}, s = k.player.inv.find(x => x && x.id === k.I.diamond_pick); return s ? [s.d, k.itemDmg(s.d), k.enchList(s.id, s.d)] : null; }}", lambda r: r is not None, 80, 250)
    check('落とした「力のこもったツルハシ」を A がひろう：力も すりへりも同じ', r is not None and r[0] == d and r[1] == 7 and r[2] == ['はやほり IV', 'ほりあて I'], [r, d])
    await m.ev(0, f"""() => {{ const k = {K}, w = k.world, B = k.B, p = k.player, o = window.__o; w.setBlock(o[0] + 3, o[1], o[2], B.chest, 0); const e = {{ t: 'chest', items: new Array(27).fill(null) }}; e.items[4] = p.inv.find(x => x && x.id === k.I.diamond_pick); w.setEnt(o[0] + 3, o[1], o[2], e); w.touch(o[0] + 3, o[1], o[2]); p.inv.fill(null); }}""")
    r = await poll(m, 1, f"() => {{ const k = {K}, o = window.__o, e = k.world.getEnt(o[0] + 3, o[1], o[2]); return e && e.items && e.items[4] ? e.items[4].d : null; }}", lambda r: r is not None, 80, 250)
    check('チェストに入れても、相手から見て 力は そのまま', r == d, [r, d])
    # 4. 走っている・泳いでいる すがたが 相手に伝わる
    await m.pg[1].bring_to_front(); await m.pg[1].keyboard.down('KeyW'); await m.pg[1].keyboard.down('KeyF')
    r = await poll(m, 0, f"() => {{ const p = [...{K}.net.peers.values()][0]; return [p.sprinting, +p.walkAmp.toFixed(1)]; }}", lambda r: r[0] is True and r[1] > 0.3, 60, 150)
    await m.pg[1].keyboard.up('KeyF'); await m.pg[1].keyboard.up('KeyW')
    check('B が走ると、A の画面でも 走る姿になる', r[0] is True and r[1] > 0.3, r)
    await m.ev(1, f"() => {{ const k = {K}, p = k.player; p.armor[1] = {{ id: k.I.diamond_chest, n: 1, d: 0 }}; }}")
    r = await poll(m, 0, f"() => [...{K}.net.peers.values()][0].armorC", lambda r: r == 8, 60, 150)
    check('B の防具が A の画面の B の姿にも出る', r == 8, r)
    errs = [e for e in m.errs() if '404' not in e]
    check('エラーなし', len(errs) == 0, errs[:6])
    await m.close()
    print('ALL OK' if ok_all else 'SOME NG')
asyncio.run(main())
