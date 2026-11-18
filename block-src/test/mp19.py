# みんなの世界での村：村人が ふえすぎない（2人が同時に近づいても しるし1つにつき1人）／ほかの人が動かしている村人と こうかん／出入りしても そのまま
import asyncio, sys, json
sys.path.insert(0, __import__('os').path.dirname(__import__('os').path.abspath(__file__)))
from mplib import Mp, K
ok_all = True
def check(name, cond, extra=''):
    global ok_all
    print(('OK  ' if cond else 'NG  ') + name, extra)
    if not cond: ok_all = False
async def poll(m, i, js, cond, n=60, ms=500):
    r = None
    for _ in range(n):
        r = await m.ev(i, js)
        if cond(r): break
        await m.wait(ms)
    return r
COUNT = f"""() => {{ const k = {K}; const vs = k.ents.filter(e => e.type === 'sato' && !e.dead); let m = 0; for (const c of k.world.chunks.values()) if (c.stage >= 2) for (const e of c.ents.values()) if (e.t === 'vmark') m++;
  return [vs.length, new Set(vs.map(e => e.vs)).size, vs.filter(e => !e.remote).length, m]; }}"""
async def main():
    m = await Mp().start(2)
    await m.ev(0, f"() => {{ {K}.game.startNew('村の島', '8642', 0, 0, true, {{}}); }}")
    await m.playing(0)
    code = await m.ev(0, f"() => {K}.net.code")
    await m.ev(1, f"(c) => {{ {K}.game.joinOnline(c); }}", code)
    await m.playing(1); await m.wait(2000)
    for i in range(2): await m.ev(i, f"() => {{ const st = {K}.settings; st.viewDist = 4; }}")
    v = await m.ev(0, f"() => {{ const k = {K}, V = k.game.villageNear(k.player.x, k.player.z); return V ? [V.x, V.y, V.z, V.lots.reduce((a, l) => a + (l.type === 'hm' ? 2 : 1), 0), k.NET_VER, k.world.gv0] : null; }}")
    check('村がある（版3の世界）', v is not None and v[5] == 3, v)
    want = v[3]
    # 2人が同時に 村の両がわへ行く
    await asyncio.gather(
        m.ev(0, f"(v) => {{ const k = {K}, p = k.player; k.game.rules.day = true; k.world.time = 6000; p.x = v[0] - 5.5; p.z = v[2] + 0.5; p.y = v[1] + 1.2; p.vx = p.vy = p.vz = 0; p.hp = 20; }}", v),
        m.ev(1, f"(v) => {{ const k = {K}, p = k.player; p.x = v[0] + 6.5; p.z = v[2] + 0.5; p.y = v[1] + 1.2; p.vx = p.vy = p.vz = 0; p.hp = 20; }}", v))
    r0 = await poll(m, 0, COUNT, lambda r: r[0] == want and r[3] == 0, 80)
    await m.wait(5000)
    r0 = await m.ev(0, COUNT); r1 = await m.ev(1, COUNT)
    check('村人は しるしの数だけ（2人で見ても ふえない）', r0[0] == want and r1[0] == want and r0[1] == want and r1[1] == want and r0[3] == 0 and r1[3] == 0 and r0[2] + r1[2] == want, (want, r0, r1))
    # B が、A の動かしている村人と こうかんする
    r = await m.ev(1, f"""() => {{ const k = {K}, p = k.player, I = k.I; const e = k.ents.find(e => e.type === 'sato' && !e.dead && e.remote && (e.vs & 3) === 0) || k.ents.find(e => e.type === 'sato' && !e.dead && e.remote);
      if (!e) return null; window.__e = e; const t = k.tradesOf(e.vs)[0];
      for (let i = 0; i < 36; i++) p.inv[i] = null; p.inv[0] = {{ id: t[0], n: t[1] * 2, d: 0 }}; p.sel = 0;
      p.x = e.x + 1.5; p.z = e.z; p.y = e.y + 0.1; p.vx = p.vy = p.vz = 0;
      const act = k.mobUse(e, p.inv[0]); p.useOnMob(e, act, p.inv[0]); k.ui.doTrade(0);
      return [act, k.ui.screen, p.countSpec(I.jade), p.countSpec(t[0]), t[1], e.rnid, e.vs, p.tradeLeft(e.vs, 0, t[4]), t[4]]; }}""")
    check('B：ほかの人が動かしている村人と こうかんできる', r is not None and r[0] == 'trade' and r[1] == 'trade' and r[2] == 1 and r[3] == r[4] and r[7] == r[8] - 1, r)
    if r:
        a = await poll(m, 0, f"(vs) => {{ const e = {K}.ents.find(e => e.type === 'sato' && e.vs === vs && !e.remote); return e ? [e.busy > 0, e.swing] : null; }}".replace('(vs) =>', f'() => ((vs) =>').replace('return e ? [e.busy > 0, e.swing] : null; }', 'return e ? [e.busy > 0, e.swing] : null; })(' + str(r[6]) + ')'), lambda q: q and q[0], 20, 300)
        check('A：その村人が 立ち止まる（こうかん中）', bool(a) and a[0], a)
    await m.shot(1, 'mp19_b')
    await m.ev(1, f"() => {{ {K}.ui.close(); }}")
    # B が出て、入りなおす。A も出て 入りなおす（だれもいない間は しまわれる）
    await m.ev(1, f"() => {K}.game.quitToTitle()"); await m.wait(1500)
    await m.ev(0, f"() => {K}.game.quitToTitle()"); await m.wait(2500)
    await m.ev(0, f"(c) => {{ {K}.game.joinOnline(c); }}", code); await m.playing(0)
    await m.wait(2000)
    r0 = await poll(m, 0, COUNT, lambda r: r[0] == want and r[3] == 0, 60)
    await m.wait(3000); r0 = await m.ev(0, COUNT)
    check('入りなおしても 村人の数は同じ', r0[0] == want and r0[1] == want and r0[3] == 0, (want, r0))
    await m.ev(1, f"(c) => {{ {K}.game.joinOnline(c); }}", code); await m.playing(1); await m.wait(4000)
    r1 = await poll(m, 1, COUNT, lambda r: r[0] == want and r[3] == 0, 40)
    r = await m.ev(1, f"(vs) => {{ const k = {K}; return [k.player.countSpec(k.I.jade), Object.keys(k.player.trades).length]; }}")
    check('B も 同じ数が見える・ヒスイと回数が のこっている', r1[0] == want and r1[1] == want and r[0] == 1 and r[1] == 1, (r1, r))
    e = [x for x in m.errs() if '404' not in x]
    check('エラーなし', not e, e[:3])
    print('結果:', 'ぜんぶOK' if ok_all else 'NGあり')
    await m.close()
    sys.exit(0 if ok_all else 1)
asyncio.run(main())
