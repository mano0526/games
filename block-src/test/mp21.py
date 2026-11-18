# みんなの世界での天気：2人とも 同じ時計・同じ天気になる（通信しなくても 種と サーバーの時計で決まる）
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
    await m.ev(0, f"() => {{ {K}.game.startNew('天気の島', '2468', 0, 0, true, {{}}); }}")
    await m.playing(0)
    code = await m.ev(0, f"() => {K}.net.code")
    await m.ev(1, f"(c) => {{ {K}.game.joinOnline(c); }}", code)
    await m.playing(1)
    for i in range(2): await m.ev(i, f"() => {{ {K}.WX.force = null; }}")   # この試験だけは 本当の天気で
    await m.wait(2000)
    JS = f"() => {{ const k = {K}; return [k.WX.clock(), k.world.seed, k.WX.kind, k.world.wx | 0]; }}"
    a, b = await asyncio.gather(m.ev(0, JS), m.ev(1, JS))
    check('2人の 時計と種が そろっている', abs(a[0] - b[0]) < 60 and a[1] == b[1], (a, b))
    # 雨のこまを さがして、2人とも 時計を そこへ進める（サーバーの時計の ずれを 同じだけ足す）
    slot = await m.ev(0, f"() => {{ const k = {K}; const s0 = Math.floor(k.WX.clock() / k.WX_SLOT); for (let s = s0 + 1; s < s0 + 400; s++) if (k.weatherAt(k.world.seed, s) === 1 && k.weatherAt(k.world.seed, s + 1) === 0) return [s, s0]; return null; }}")
    check('先の こまに 雨がある', slot is not None, slot)
    add = (slot[0] - slot[1]) * 4800 * 50
    for i in range(2): await m.ev(i, f"(d) => {{ {K}.net.off += d; }}", add)
    await m.wait(1500)
    a, b = await asyncio.gather(m.ev(0, JS), m.ev(1, JS))
    check('2人とも 同じ時に 雨になる', a[2] == 1 and b[2] == 1 and a[3] == 1 and b[3] == 1, (a, b))
    for i in range(2): await m.ev(i, f"(d) => {{ {K}.net.off += d; }}", 4800 * 50)
    await m.wait(1500)
    a, b = await asyncio.gather(m.ev(0, JS), m.ev(1, JS))
    check('2人とも 同じ時に 晴れる', a[2] == 0 and b[2] == 0, (a, b))
    e = [x for x in m.errs() if '404' not in x]
    check('エラーなし', not e, e[:3])
    print('結果:', 'ぜんぶOK' if ok_all else 'NGあり')
    await m.close()
    sys.exit(0 if ok_all else 1)
asyncio.run(main())
