# みんなの世界での動物：ほかの人が動かしている動物に えさ・ハサミ・肉を使う／子ども・毛・飼い主が 相手にも見える／出入りしても残る
import asyncio, sys, json
sys.path.insert(0, __import__('os').path.dirname(__import__('os').path.abspath(__file__)))
from mplib import Mp, K
ok_all = True
def check(name, cond, extra=''):
    global ok_all
    print(('OK  ' if cond else 'NG  ') + name, extra)
    if not cond: ok_all = False
async def poll(m, i, js, cond, n=60, ms=400):
    r = None
    for _ in range(n):
        r = await m.ev(i, js)
        if cond(r): break
        await m.wait(ms)
    return r
async def main():
    m = await Mp().start(2)
    await m.ev(0, f"() => {{ {K}.game.startNew('牧場の島', '5151', 0, 0, true, {{}}); }}")
    await m.playing(0)
    code = await m.ev(0, f"() => {K}.net.code")
    await m.ev(1, f"(c) => {{ {K}.game.joinOnline(c); }}", code)
    await m.playing(1); await m.wait(2500)
    # A が台を作って 動物を出す（A が動かす）。B は少しはなれた所に立つ
    o = await m.ev(0, f"""() => {{ const k = {K}, w = k.world, B = k.B, p = k.player; const ox = Math.floor(p.x), oz = Math.floor(p.z), Y = Math.floor(p.y) + 10;
      for (let z = -7; z <= 7; z++) for (let x = -7; x <= 7; x++) {{ w.setBlock(ox + x, Y - 1, oz + z, B.grass, 0); for (let y = Y; y < Y + 5; y++) w.setBlock(ox + x, y, oz + z, 0, 0); if (Math.abs(x) === 7 || Math.abs(z) === 7) w.setBlock(ox + x, Y, oz + z, B.fence_oak, 0); }}
      for (const e of k.ents) if (!e.remote) e.dead = true; p.x = ox - 4.5; p.y = Y + 0.01; p.z = oz + 0.5;
      const c1 = k.spawnMob('cow', ox - 2.5, Y, oz - 2.5), c2 = k.spawnMob('cow', ox - 2.5, Y, oz + 2.5), sh = k.spawnMob('sheep', ox - 1.5, Y, oz + 0.5), d = k.spawnMob('dog', ox - 3.5, Y, oz + 3.5);
      window.__n = [c1.nid, c2.nid, sh.nid, d.nid]; return [ox, Y, oz]; }}""")
    await m.wait(1500)
    await m.ev(1, f"(o) => {{ const p = {K}.player; window.__o = o; p.x = o[0] + 4.5; p.y = o[1] + 0.01; p.z = o[2] + 0.5; p.vx = p.vy = p.vz = 0; }}", o)
    r = await poll(m, 1, f"() => {K}.ents.filter(e => e.remote && e.kind === 'mob').map(e => e.type).sort()", lambda r: r == ['cow', 'cow', 'dog', 'sheep'])
    check('A の動物が B に見える', r == ['cow', 'cow', 'dog', 'sheep'], r)
    # B が えさ・ハサミ・肉を使う（動かしているのは A）
    r = await m.ev(1, f"""() => {{ const k = {K}, p = k.player, I = k.I; const cows = k.ents.filter(e => e.remote && e.type === 'cow'), sh = k.ents.find(e => e.remote && e.type === 'sheep'), d = k.ents.find(e => e.remote && e.type === 'dog');
      p.inv[0] = {{ id: I.wheat, n: 5, d: 0 }}; p.sel = 0; const a = cows.map(c => k.mobUse(c, p.held())); for (const c of cows) p.useOnMob(c, 'love', p.held());
      p.inv[1] = {{ id: I.shears, n: 1, d: 0 }}; p.sel = 1; const b = k.mobUse(sh, p.held()); p.useOnMob(sh, b, p.held());
      p.inv[2] = {{ id: I.steak, n: 40, d: 0 }}; p.sel = 2; window.__dog = d; return [a, b, k.mobUse(d, p.held()), p.inv[0].n]; }}""")
    check('B の画面でも 使える物が分かる', r == [['love', 'love'], 'shear', 'tame', 3], r)
    r = await poll(m, 0, f"() => {{ const k = {K}; const cows = k.ents.filter(e => !e.remote && e.type === 'cow'), sh = k.ents.find(e => !e.remote && e.type === 'sheep'); return [cows.some(c => c.love > 0 || c.breedCd > 0), sh && sh.sheared, k.ents.filter(e => e.kind === 'item' && e.id === k.B.wool_white).length > 0]; }}", lambda r: r == [True, True, True])
    check('B が使った えさ・ハサミが、A の動物に効く', r == [True, True, True], r)
    r = await poll(m, 1, f"() => {{ const k = {K}; return [k.ents.filter(e => e.remote && e.type === 'cow' && e.baby > 0).length, !!(k.ents.find(e => e.remote && e.type === 'sheep') || {{}}).sheared]; }}", lambda r: r == [1, True], 80)
    check('子どもと かられた毛が B にも見える', r == [1, True], r)
    # B がイヌに肉をあげる（なつくまで）→ 飼い主＝B。A にも B にも見える
    pid1 = await m.ev(1, f"() => {K}.net.pid")
    for i in range(60):
        st = await m.ev(1, f"() => {{ const k = {K}, p = k.player, d = k.ents.find(e => e.remote && e.type === 'dog') || k.ents.find(e => e.type === 'dog'); if (!d) return null; if (!d.tamer && d.remote) p.useOnMob(d, 'tame', p.held()); return [d.tamer, !!d.remote]; }}")
        if st and st[0] == pid1: break
        await m.wait(500)
    a = await m.ev(0, f"() => {{ const d = {K}.ents.find(e => e.type === 'dog'); return d ? [d.tamer, !!d.remote] : null; }}")
    check('B がなつかせると、飼い主は B（A にもそう見える）', st and st[0] == pid1 and a and a[0] == pid1, [st, a, pid1])
    # イヌは B についていく（B が動かすようになるか、A が動かしたまま B を追う）
    await m.ev(1, f"() => {{ const p = {K}.player, o = window.__o; p.x = o[0] + 5.5; p.z = o[2] - 5.5; }}")
    r = await poll(m, 1, f"() => {{ const k = {K}, p = k.player, d = k.ents.find(e => e.type === 'dog'); return d ? +Math.hypot(d.x - p.x, d.z - p.z).toFixed(1) : 99; }}", lambda r: r < 4.5, 60, 500)
    check('イヌは 飼い主（B）についていく', r < 4.5, r)
    # 2人とも出て、B が入り直す → イヌ（飼い主 B）・子ウシ・かられたヒツジが残っている
    for i in (0, 1):
        await m.ev(i, f"() => {K}.game.quitToTitle()")
        await m.pg[i].wait_for_function(f'{K}.game.state === "title"', timeout=30000)
    await m.wait(1000)
    await m.ev(1, f"(c) => {{ {K}.game.joinOnline(c); }}", code)
    await m.playing(1)
    r = await poll(m, 1, f"() => {K}.ents.filter(e => e.kind === 'mob' && !e.remote).map(e => [e.type, e.tamer, e.baby > 0, e.sheared]).sort()", lambda r: sum(1 for x in r if x[0] == 'dog' and x[1]) == 1 and sum(1 for x in r if x[0] == 'cow') >= 3, 60, 500)
    check('出入りしても 動物の状態が残る', [x for x in r if x[0] == 'dog' and x[1] == pid1] and any(x[0] == 'cow' and x[2] for x in r) and any(x[0] == 'sheep' and x[3] for x in r), r)
    errs = [e for e in m.errs() if '404' not in e]
    check('エラーなし', len(errs) == 0, errs[:6])
    await m.close()
    print('ALL OK' if ok_all else 'SOME NG')
asyncio.run(main())
