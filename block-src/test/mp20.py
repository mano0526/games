# みんなの世界での乗り物：ほかの人が置いた（動かしている）ボート・ウマに 乗る／乗っている姿が 相手に見える／おりると 1つだけ のこる
import asyncio, sys, json
sys.path.insert(0, __import__('os').path.dirname(__import__('os').path.abspath(__file__)))
from mplib import Mp, K
ok_all = True
def check(name, cond, extra=''):
    global ok_all
    print(('OK  ' if cond else 'NG  ') + name, extra)
    if not cond: ok_all = False
async def poll(m, i, js, cond, n=50, ms=300):
    r = None
    for _ in range(n):
        r = await m.ev(i, js)
        if cond(r): break
        await m.wait(ms)
    return r
async def main():
    m = await Mp().start(2)
    await m.ev(0, f"() => {{ {K}.game.startNew('のりものの島', '7373', 0, 0, true, {{}}); }}")
    await m.playing(0)
    code = await m.ev(0, f"() => {K}.net.code")
    await m.ev(1, f"(c) => {{ {K}.game.joinOnline(c); }}", code)
    await m.playing(1); await m.wait(2500)
    o = await m.ev(0, f"""() => {{ const k = {K}, w = k.world, B = k.B, p = k.player; const ox = Math.floor(p.x), oz = Math.floor(p.z), Y = Math.floor(p.y) + 10;
      for (let z = -7; z <= 7; z++) for (let x = -9; x <= 9; x++) {{ w.setBlock(ox + x, Y - 2, oz + z, B.stone, 0); w.setBlock(ox + x, Y - 1, oz + z, x < -2 ? B.water : B.grass, 0); for (let y = Y; y < Y + 5; y++) w.setBlock(ox + x, y, oz + z, 0, 0); }}
      for (const e of k.ents) if (!e.remote) e.dead = true; k.game.rules.day = true; p.x = ox + 6.5; p.y = Y + 0.01; p.z = oz + 0.5;
      const b = k.spawnMob('boat', ox - 5.5, Y - 0.1, oz + 0.5), h = k.spawnMob('horse', ox + 3.5, Y, oz + 3.5); h.tamer = k.net.pid; h.saddle = true; h.color = 3; window.__n = [b.nid, h.nid]; return [ox, Y, oz]; }}""")
    await m.wait(1200)
    await m.ev(1, f"(o) => {{ const p = {K}.player; window.__o = o; p.x = o[0] + 0.5; p.y = o[1] + 0.01; p.z = o[2] + 0.5; p.vx = p.vy = p.vz = 0; }}", o)
    r = await poll(m, 1, f"() => {K}.ents.filter(e => e.remote && e.kind === 'mob').map(e => e.type + (e.type === 'horse' ? (e.saddle ? 's' : '') + e.color + (e.tamer ? 't' : '') : '')).sort()", lambda r: 'boat' in r and 'horses3t' in r)
    check('A の ボートとウマが B に見える（くら・毛色・なつき）', 'boat' in r and 'horses3t' in r, r)
    # B が A のボートに 乗る
    await m.ev(1, f"() => {{ const k = {K}, p = k.player, e = k.ents.find(e => e.remote && e.type === 'boat'); p.x = e.x + 1.5; p.z = e.z; p.y = e.y + 0.6; p.useOnMob(e, k.mobUse(e, null), null); }}")
    r = await poll(m, 1, f"() => {{ const p = {K}.player; return [p.ride && p.ride.t, {K}.ents.filter(e => e.type === 'boat' && !e.dead).length]; }}", lambda r: r[0] == 'boat' and r[1] == 0)
    check('B：ほかの人のボートに 乗れる', r[0] == 'boat' and r[1] == 0, r)
    a = await poll(m, 0, f"() => {{ const k = {K}, q = [...k.net.peers.values()][0]; return [q.rideC & 3, k.ents.filter(e => e.type === 'boat' && !e.dead).length]; }}", lambda r: r[0] == 1 and r[1] == 0)
    check('A：B が ボートに乗っている姿になる・ボートは 一覧から消える', a == [1, 0], a)
    await m.shot(0, 'mp20_a')
    await m.ev(1, f"() => {{ {K}.player.dismount(); }}")
    r = await poll(m, 0, f"() => {{ const k = {K}, q = [...k.net.peers.values()][0]; return [q.rideC & 3, k.ents.filter(e => e.type === 'boat' && !e.dead).length]; }}", lambda r: r[0] == 0 and r[1] == 1)
    r1 = await m.ev(1, f"() => [{K}.player.ride, {K}.ents.filter(e => e.type === 'boat' && !e.dead).length]")
    check('おりると ボートは 1つだけ のこる（2人とも）', r == [0, 1] and r1 == [None, 1], (r, r1))
    # B が A のウマに 乗って走る
    await m.ev(1, f"() => {{ const k = {K}, p = k.player, e = k.ents.find(e => e.remote && e.type === 'horse' && e.saddle); p.x = e.x + 1.2; p.z = e.z; p.y = e.y + 0.05; p.useOnMob(e, k.mobUse(e, null), null); }}")
    r = await poll(m, 1, f"() => {{ const p = {K}.player; return p.ride ? [p.ride.t, p.ride.s, !!p.ride.tm, p.ride.c, p.ride.wild > 0] : null; }}", lambda r: r is not None)
    check('B：ほかの人のウマ（なついて くらつき）に そのまま乗れる', r == ['horse', 1, True, 3, False], r)
    a = await poll(m, 0, f"() => {{ const k = {K}, q = [...k.net.peers.values()][0]; return [q.rideC & 3, (q.rideC >> 2) & 7, !!(q.rideC & 32), k.ents.filter(e => e.type === 'horse' && !e.dead && e.saddle).length]; }}", lambda r: r[0] == 3 and r[3] == 0)
    check('A：B が ウマに乗っている姿になる（毛色・くら）', a == [3, 3, True, 0], a)
    await m.ev(1, f"() => {{ {K}.player.dismount(); }}")
    r = await poll(m, 0, f"() => {{ const k = {K}; const h = k.ents.filter(e => e.type === 'horse' && !e.dead && e.saddle); return [h.length, h[0] && h[0].saddle, h[0] && !!h[0].tamer, h[0] && h[0].color]; }}", lambda r: r[0] == 1)
    check('おりると ウマは 1頭だけ のこる（くら・なつき・毛色は そのまま）', r == [1, True, True, 3], r)
    # 滑空している姿
    await m.ev(1, f"() => {{ const k = {K}, p = k.player; p.armor[1] = {{ id: k.I.glider, n: 1, d: 0 }}; p.y += 40; p.onGround = false; p.airT = 1; p.gliding = true; p.pitch = 0.3; }}")
    a = await poll(m, 0, f"() => {{ const q = [...{K}.net.peers.values()][0]; return [q.gliding, q.rideC & 64]; }}", lambda r: r[0])
    check('A：B が 滑空している姿になる', a == [True, 64], a)
    v = await m.ev(0, f"() => {K}.NET_VER"); v1 = await m.ev(1, f"() => {K}.NET_VER")
    check('通信の版が そろっている', v == v1 and v >= 7, (v, v1))
    e = [x for x in m.errs() if '404' not in x]
    check('エラーなし', not e, e[:3])
    print('結果:', 'ぜんぶOK' if ok_all else 'NGあり')
    await m.close()
    sys.exit(0 if ok_all else 1)
asyncio.run(main())
