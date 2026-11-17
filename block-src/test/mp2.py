import asyncio, sys, json
sys.path.insert(0, __import__('os').path.dirname(__import__('os').path.abspath(__file__)))
from mplib import Mp, K
async def main():
    m = await Mp().start(2)
    await m.ev(0, f"() => {{ {K}.game.startNew('みんなの島', '12345', 1, 2, true, {{}}); }}")
    await m.playing(0)
    code = await m.ev(0, f"() => {K}.net.code")
    await m.ev(1, f"(c) => {{ {K}.game.joinOnline(c); }}", code)
    await m.playing(1); await m.wait(1500)
    # p1 を p0 の前に立たせて、p0 から見る
    await m.ev(0, f"() => {{ const p = {K}.player; p.yaw = 0; p.pitch = -0.1; }}")
    await m.ev(1, f"() => {{ const p = {K}.player; p.z -= 3.2; p.x += 0.6; p.yaw = Math.PI; p.inv[0] = {{ id: {K}.I.iron_pick, n: 1, d: 0 }}; p.sel = 0; p.invDirty = true; {K}.game.needSafeSpot = 2; }}")
    await m.wait(1500)
    await m.shot(0, 'mp2_see1')
    # 歩かせる・しゃがむ・ブロックを持つ
    await m.pg[1].keyboard.down('KeyD'); await m.wait(700); await m.shot(0, 'mp2_walk'); await m.pg[1].keyboard.up('KeyD')
    await m.ev(1, f"() => {{ const p = {K}.player; p.inv[0] = {{ id: {K}.B.planks_oak || 5, n: 1, d: 0 }}; p.invDirty = true; }}")
    await m.pg[1].keyboard.down('ShiftLeft'); await m.wait(700); await m.shot(0, 'mp2_sneak'); await m.pg[1].keyboard.up('ShiftLeft')
    # 遠くへ行かせて、名前の札の距離と、画面外の表示
    await m.ev(1, f"() => {{ const p = {K}.player; p.x += 30; p.z += 40; {K}.game.needSafeSpot = 1; }}")
    await m.wait(2500); await m.shot(0, 'mp2_far')
    print('tags', await m.ev(0, "() => [...document.querySelectorAll('.ntag')].map(t => [t.textContent, t.className, t.style.transform, t.hidden])"))
    print('errs', [e for e in m.errs() if '404' not in e][:8])
    await m.close()
asyncio.run(main())
