import asyncio, sys, json
sys.path.insert(0, __import__('os').path.dirname(__import__('os').path.abspath(__file__)))
from mplib import Mp, K
DUMP = "() => firebase.__dump().then(t => { const w = Object.values(t.np.block.w)[0]; return { a: w.a ? Object.values(w.a).reduce((n, r) => n + Object.keys(r).length, 0) : 0, al: w.al ? Object.keys(w.al).length : 0, pl: Object.keys(w.pl || {}).length, c: w.c ? Object.values(w.c).reduce((n, r) => n + Object.keys(r).length, 0) : 0, gv: Object.keys(w.gv || {}).length, lobby: Object.keys(t.np.lobby || {}) }; })"
MOBS = f"() => {{ const o = {{}}; for (const e of {K}.ents) if (e.kind === 'mob') {{ const k = e.type + (e.remote ? '(影)' : ''); o[k] = (o[k] || 0) + 1; }} return o; }}"
async def main():
    lag = int(sys.argv[1]) if len(sys.argv) > 1 else 0
    m = await Mp().start(1, lag=lag)
    await m.ev(0, f"() => {{ {K}.game.startNew('みんなの島', '4242', 0, 2, true, {{ mobs: false }}); }}")
    await m.playing(0); await m.wait(1000)
    code = await m.ev(0, f"() => {K}.net.code")
    base = await m.ev(0, f"() => {{ const p = {K}.player; return [Math.floor(p.x), Math.floor(p.y), Math.floor(p.z)]; }}")
    # A) 動物を出して、遠くへ歩く → しまわれる（サーバーに置かれる）→ もどる → 引き取る
    await m.ev(0, f"(a) => {{ for (const e of {K}.ents) e.dead = true; for (let i = 0; i < 3; i++) {K}.spawnMob('sheep', a[0] + 2 + i, a[1] + 1, a[2] + 2).hp = 5 + i; }}", base)
    await m.wait(700)
    print('A0 mobs', await m.ev(0, MOBS), 'server', await m.ev(0, DUMP))
    await m.ev(0, f"(a) => {{ const p = {K}.player; p.x = a[0] + 200; p.z = a[2] + 200; {K}.game.needSafeSpot = 1; }}", base)
    await m.wait(6000)
    print('A1 far: mobs', await m.ev(0, f"() => {K}.ents.filter(e => e.kind === 'mob' && e.type === 'sheep' && e.hp < 8).length"), 'server', await m.ev(0, DUMP))
    await m.ev(0, f"(a) => {{ const p = {K}.player; p.x = a[0] + 0.5; p.z = a[2] + 0.5; {K}.game.needSafeSpot = 1; }}", base)
    for k in range(30):
        n = await m.ev(0, f"() => {K}.ents.filter(e => e.kind === 'mob' && e.type === 'sheep' && e.hp < 8).length")
        if n >= 3: break
        await m.wait(500)
    print('A2 back: test sheep', await m.ev(0, f"() => {K}.ents.filter(e => e.kind === 'mob' && e.type === 'sheep' && e.hp < 8).map(e => [e.hp, +e.x.toFixed(0), +e.z.toFixed(0)])"), 'server', await m.ev(0, DUMP))
    # B) 控え（急に切れたとき用）：30秒ごと。ここではすぐ書かせてから、急に切る
    await m.ev(0, f"() => {{ {K}.net.checkpoint(); {K}.net.savePlayer(); }}")
    await m.wait(600)
    print('B0 server', await m.ev(0, DUMP))
    await m.add()                    # 先に2人目のページを開いておく（全部閉じると にせサーバーが消えるため）
    await m.pg[0].close()            # 1人目を急に閉じる
    await m.pg[1].wait_for_timeout(1000)
    print('B1 after crash server', await m.ev(1, DUMP))
    # C) 別の人が入る → 残っていた控えを しまい直して、近くなら引き取る
    await m.ev(1, f"(c) => {{ {K}.game.joinOnline(c); }}", code)
    await m.playing(1)
    for k in range(40):
        n = await m.ev(1, f"() => {K}.ents.filter(e => e.kind === 'mob' && e.type === 'sheep' && e.hp < 8 && !e.remote).length")
        if n >= 3: break
        await m.pg[1].wait_for_timeout(500)
    print('C newcomer has test sheep', await m.ev(1, f"() => {K}.ents.filter(e => e.kind === 'mob' && e.type === 'sheep' && e.hp < 8).map(e => [e.hp, !!e.remote])"), 'server', await m.ev(1, DUMP))
    print('errs', [e for e in m.errs() if '404' not in e and 'p0' not in e][:8])
    await m.b.close(); await m.pw.stop()
asyncio.run(main())
