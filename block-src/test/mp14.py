# みんなの世界での新しいブロック：512番以上の番号・向き・看板の字・門の開け閉めが相手に届く、入り直しても残る
import asyncio, sys, json
sys.path.insert(0, __import__('os').path.dirname(__import__('os').path.abspath(__file__)))
from mplib import Mp, K
ok_all = True
def check(name, cond, extra=''):
    global ok_all
    print(('OK  ' if cond else 'NG  ') + name, extra)
    if not cond: ok_all = False
READ = f"""() => {{ const k = {K}, w = k.world, B = k.B, o = window.__o; if (!o) return null; const g = (dx, dy, dz) => [k.ITEMS[w.getBlock(o[0] + dx, o[1] + dy, o[2] + dz)] ? k.ITEMS[w.getBlock(o[0] + dx, o[1] + dy, o[2] + dz)].key : w.getBlock(o[0] + dx, o[1] + dy, o[2] + dz), w.getMeta(o[0] + dx, o[1] + dy, o[2] + dz)];
  const e = w.getEnt(o[0] + 5, o[1], o[2]); return [g(0, 0, 0), g(1, 0, 0), g(2, 0, 0), g(3, 0, 0), g(4, 0, 0), g(5, 0, 0), g(6, 0, 0), g(7, 0, 0), e ? e.s : null]; }}"""
async def main():
    m = await Mp().start(2)
    await m.ev(0, f"() => {{ {K}.game.startNew('かたちの島', '4242', 1, 0, true, {{}}); }}")
    await m.playing(0)
    code = await m.ev(0, f"() => {K}.net.code")
    await m.ev(1, f"(c) => {{ {K}.game.joinOnline(c); }}", code)
    await m.playing(1); await m.wait(2500)
    v = await m.ev(0, f"() => {{ const n = {K}.net; return [n.meta && n.meta.v, {K}.NET_VER]; }}")
    check('世界の版が新しい', v[0] == v[1] and v[0] >= 2, v)
    o = await m.ev(0, f"""() => {{ const k = {K}, w = k.world, B = k.B, p = k.player; const ox = Math.floor(p.x) + 2, oz = Math.floor(p.z) + 2, Y = Math.floor(p.y) + 6; window.__o = [ox, Y, oz];
      for (let i = -1; i <= 8; i++) w.setBlock(ox + i, Y - 1, oz, B.stone, 0);
      w.setBlock(ox, Y, oz, B.stairs_walnut, 6); w.setBlock(ox + 1, Y, oz, B.slab_granite, 1); w.setBlock(ox + 2, Y, oz, B.fence_cherry, 0); w.setBlock(ox + 3, Y, oz, B.gate_oak, 1);
      w.setBlock(ox + 4, Y, oz, B.concrete_cyan, 0); w.setBlock(ox + 5, Y, oz, B.sign, 2); w.setEnt(ox + 5, Y, oz, {{ t: 'sign', s: 'ひみつ基地\\nこの下' }}); w.setBlock(ox + 6, Y, oz, B.trapdoor_acacia, 9); w.setBlock(ox + 7, Y, oz, B.lantern, 0);
      return window.__o; }}""")
    await m.ev(1, "(o) => { window.__o = o; }", o)
    want = [['stairs_walnut', 6], ['slab_granite', 1], ['fence_cherry', 0], ['gate_oak', 1], ['concrete_cyan', 0], ['sign', 2], ['trapdoor_acacia', 9], ['lantern', 0], 'ひみつ基地\nこの下']
    for i in range(40):
        r = await m.ev(1, READ)
        if r == want: break
        await m.wait(300)
    check('新しいブロックと向き・看板の字が相手に届く', r == want, r)
    # 相手が門を開ける・看板を書きかえる → 自分に届く
    await m.ev(1, f"""() => {{ const k = {K}, w = k.world, p = k.player, o = window.__o; const t = {{ x: o[0] + 3, y: o[1], z: o[2], id: w.getBlock(o[0] + 3, o[1], o[2]), meta: w.getMeta(o[0] + 3, o[1], o[2]), nx: 0, ny: 0, nz: -1, t: 2 }};
      p.interactBlock(w, t, 'gate'); w.setEnt(o[0] + 5, o[1], o[2], {{ t: 'sign', s: 'かいぞう中' }}); }}""")
    for i in range(40):
        r = await m.ev(0, READ)
        if r and (r[3][1] & 4) and r[8] == 'かいぞう中': break
        await m.wait(300)
    check('門の開け閉め・看板の書きかえが届く', r and (r[3][1] & 4) == 4 and r[8] == 'かいぞう中', r)
    # こわすと相手からも消える（看板の字も）
    await m.ev(0, f"() => {{ const k = {K}, w = k.world, o = window.__o; w.setBlock(o[0] + 5, o[1], o[2], 0, 0); w.setBlock(o[0] + 2, o[1], o[2], 0, 0); }}")
    for i in range(40):
        r = await m.ev(1, READ)
        if r and r[5][0] == 0 and r[2][0] == 0 and r[8] is None: break
        await m.wait(300)
    check('こわすと相手からも消える', r and r[5][0] == 0 and r[2][0] == 0 and r[8] is None, r)
    # 2人とも出て入り直す → 残っている
    await m.ev(0, f"() => {{ const k = {K}, w = k.world, B = k.B, o = window.__o; w.setBlock(o[0] + 5, o[1], o[2], B.sign, 1); w.setEnt(o[0] + 5, o[1], o[2], {{ t: 'sign', s: 'またね' }}); }}")
    await m.wait(1500)
    for i in (1, 0):
        await m.ev(i, f"() => {K}.game.quitToTitle()")
        await m.pg[i].wait_for_function('window.__kk.game.state === "title"', timeout=30000)
    await m.wait(800)
    await m.ev(1, f"(c) => {{ {K}.game.joinOnline(c); }}", code)
    await m.playing(1); await m.wait(2500)
    for i in range(40):
        r = await m.ev(1, READ)
        if r and r[8] == 'またね': break
        await m.wait(300)
    check('だれもいなくなってから入り直しても残る', r and r[0] == ['stairs_walnut', 6] and r[1] == ['slab_granite', 1] and r[2][0] == 0 and (r[3][1] & 4) == 4 and r[4] == ['concrete_cyan', 0] and r[5] == ['sign', 1] and r[6] == ['trapdoor_acacia', 9] and r[8] == 'またね', r)
    errs = [e for e in m.errs() if '404' not in e]
    check('エラーなし', len(errs) == 0, errs[:6])
    await m.close()
    print('ALL OK' if ok_all else 'SOME NG')
asyncio.run(main())
