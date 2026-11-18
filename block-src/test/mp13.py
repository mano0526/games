# みんなの世界での地図：しるしが全員に届く・友だちが地図に出る・歩いた所が端末に残る
import asyncio, sys, json
sys.path.insert(0, __import__('os').path.dirname(__import__('os').path.abspath(__file__)))
from mplib import Mp, K
ok_all = True
def check(name, cond, extra=''):
    global ok_all
    print(('OK  ' if cond else 'NG  ') + name, extra)
    if not cond: ok_all = False
async def main():
    m = await Mp().start(2)
    await m.ev(0, f"() => {{ {K}.game.startNew('地図の島', '777', 1, 0, true, {{}}); }}")
    await m.playing(0)
    code = await m.ev(0, f"() => {K}.net.code")
    await m.ev(1, f"(c) => {{ {K}.game.joinOnline(c); }}", code)
    await m.playing(1); await m.wait(2500)
    # しるしを置く → 相手に届く
    await m.ev(0, f"() => {{ const k = {K}; k.map.pinAdd(30, -12, 'みんなの家', 4); }}")
    for i in range(30):
        r = await m.ev(1, f"() => {K}.map.pins.map(p => [p.x, p.z, p.n, p.c, p.by])")
        if r: break
        await m.wait(300)
    check('しるしが相手に届く', r == [[30, -12, 'みんなの家', 4, 'アオ']], r)
    # 相手が消す → 自分のも消える
    await m.ev(1, f"() => {{ const k = {K}; k.map.pinDel(k.map.pins[0].id); }}")
    for i in range(30):
        r = await m.ev(0, f"() => {K}.map.pins.length")
        if r == 0: break
        await m.wait(300)
    check('消したら相手のも消える', r == 0, r)
    # おかしなデータは受けつけない
    await m.ev(0, f"() => {{ const r = {K}.net.root; r.child('pins/bad1').set({{ x: 'あ', z: 3 }}); r.child('pins/ok1').set({{ x: 5.7, z: -3.2, n: 'ながいながいながいながいなまえです', c: 99, by: 12345 }}); }}")
    await m.wait(1500)
    r = await m.ev(1, f"() => {K}.map.pins.map(p => [p.id, p.x, p.z, p.n, p.c, p.by])")
    check('おかしなデータは直すか捨てる', r == [['ok1', 6, -3, 'ながいながいながいな', 5, '12345']], r)
    # 友だちが地図に出る（大きな地図を開いて絵を確かめる）
    await m.ev(1, f"() => {{ const p = {K}.player; p.x += 20; p.z += 6; {K}.game.needSafeSpot = 1; }}")
    await m.wait(2500)
    r = await m.ev(0, f"() => {{ const k = {K}; return [...k.net.peers.values()].map(p => [p.name, Math.round(p.x - k.player.x), Math.round(p.z - k.player.z), k.net.here(p)]); }}")
    check('友だちの場所が分かる', len(r) == 1 and r[0][1] == 20 and r[0][2] == 6 and r[0][3], r)
    await m.ev(0, f"() => {{ {K}.R.skip = false; {K}.map.openMap(); }}"); await m.wait(1500)
    await m.pg[0].screenshot(path='/tmp/kk/mp13_map.png')
    await m.ev(0, f"() => {{ {K}.map.closeMap(true); {K}.R.skip = true; }}")
    # 歩いた所は 端末に残り、入り直しても続き
    n0 = await m.ev(1, f"() => {{ const k = {K}; k.net.savePlayer(); const pd = JSON.parse(localStorage.getItem('blk_pd_' + k.net.code)); let n = 0; for (const key in pd.map.seen) {{ const s = atob(pd.map.seen[key]); for (let i = 0; i < s.length; i++) for (let b = 0; b < 8; b++) if (s.charCodeAt(i) >> b & 1) n++; }} return [n, !!pd.map.pins]; }}")
    check('歩いた所が端末に保存される（しるしは保存しない）', n0[0] >= 20 and not n0[1], n0)
    await m.ev(1, f"() => {K}.game.quitToTitle()")
    await m.pg[1].wait_for_function('window.__kk.game.state === "title"', timeout=30000)
    await m.ev(1, f"(c) => {{ {K}.game.joinOnline(c); }}", code)
    await m.playing(1); await m.wait(2000)
    r = await m.ev(1, f"() => {{ const m = {K}.map; let n = 0; for (const b of m.seen.values()) for (const v of b) for (let i = 0; i < 8; i++) if (v >> i & 1) n++; return [n, m.pins.map(p => p.id)]; }}")
    check('入り直しても 地図が続きから', r[0] >= n0[0] and r[1] == ['ok1'], r)
    errs = [e for e in m.errs() if '404' not in e]
    check('エラーなし', len(errs) == 0, errs[:6])
    await m.close()
    print('ALL OK' if ok_all else 'SOME NG')
asyncio.run(main())
