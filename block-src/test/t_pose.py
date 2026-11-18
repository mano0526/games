# うしろから見た時の 自分の姿：歩く・走る・しゃがむ・ふる の動きが 体に伝わっているか
import asyncio, sys, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from lib import Sess
K = "window.__kk"
ok_all = True
def check(name, cond, extra=''):
    global ok_all
    print(('OK  ' if cond else 'NG  ') + name, extra)
    if not cond: ok_all = False
async def main():
    s = await Sess().start(1280, 720)
    await s.ev(f"() => {{ const st = {K}.settings; st.viewDist = 3; st.music = 0; st.showInfo = false; st.minimap = false; }}")
    await s.new_world('9753', mode=0, diff=0); await s.wait(800)
    await s.ev(f"""() => {{ const k = {K}, w = k.world, B = k.B, p = k.player; const o = [Math.floor(p.x), Math.floor(p.y) + 14, Math.floor(p.z)];
      for (let z = -30; z <= 6; z++) for (let x = -4; x <= 4; x++) {{ w.setBlock(o[0] + x, o[1] - 1, o[2] + z, B.grass, 0); for (let y = o[1]; y < o[1] + 5; y++) w.setBlock(o[0] + x, y, o[2] + z, 0, 0); }}
      p.x = o[0] + 0.5; p.y = o[1] + 0.01; p.z = o[2] + 0.5; p.yaw = 0; p.pitch = 0; k.settings.view = 1; }}""")
    await s.wait(500)
    r0 = await s.ev(f"() => {{ const q = {K}.selfPose; return [+q.walkAmp.toFixed(2), q.sneaking, q.swingT]; }}")
    await s.pg.keyboard.down('KeyW'); await s.wait(900)
    r1 = await s.ev(f"() => {{ const q = {K}.selfPose; return [+q.walkAmp.toFixed(2), +q.walk.toFixed(1)]; }}"); await s.shot('pose_walk')
    await s.wait(300)
    r2 = await s.ev(f"() => {{ const q = {K}.selfPose; return [+q.walkAmp.toFixed(2), +q.walk.toFixed(1)]; }}")
    await s.pg.keyboard.up('KeyW'); await s.wait(500)
    check('止まっている時は 手足が動かない', r0[0] < 0.1 and r0[1] is False, r0)
    check('歩くと 手足が ふれる（うしろから見た姿）', r1[0] > 0.6 and r2[1] > r1[1] + 0.5, [r1, r2])
    await s.pg.keyboard.down('ShiftLeft'); await s.wait(500)
    r = await s.ev(f"() => {{ const k = {K}; return [k.selfPose.sneaking, k.player.sneaking, +k.player.eyeOff.toFixed(2)]; }}"); await s.shot('pose_sneak')
    await s.pg.keyboard.up('ShiftLeft'); await s.wait(300)
    check('シフトで しゃがむ（姿も 目の高さも 下がる）', r[0] is True and r[1] is True and r[2] < 1.55, r)
    await s.ev(f"() => {{ {K}.player.swing(); }}"); await s.wait(60)
    r = await s.ev(f"() => {K}.selfPose.swingT")
    check('ふると うでが動く', r > 0, r)
    errs = [l for l in s.logs if 'PAGEERROR' in l or l.startswith('error')]
    check('エラーなし', len(errs) == 0, errs[:4])
    await s.close()
    print('ALL OK' if ok_all else 'SOME NG')
asyncio.run(main())
