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
    await s.pg.keyboard.down('KeyW'); await s.pg.keyboard.down('KeyF'); await s.wait(700)
    r = await s.ev(f"() => {{ const k = {K}; return [k.selfPose.sprinting, k.player.sprinting, +Math.hypot(k.player.vx, k.player.vz).toFixed(1)]; }}")
    await s.pg.keyboard.up('KeyF'); await s.pg.keyboard.up('KeyW'); await s.wait(400)
    check('走る（F をおしながら前へ）：速さ5.6、姿も 走る動きになる', r[0] is True and r[1] is True and 5.3 <= r[2] <= 5.9, r)
    await s.pg.keyboard.down('ShiftLeft'); await s.wait(500)
    r = await s.ev(f"() => {{ const k = {K}; return [k.selfPose.sneaking, k.player.sneaking, +k.player.eyeOff.toFixed(2)]; }}"); await s.shot('pose_sneak')
    await s.pg.keyboard.up('ShiftLeft'); await s.wait(300)
    check('シフトで しゃがむ（姿も 目の高さも 下がる）', r[0] is True and r[1] is True and r[2] < 1.55, r)
    await s.ev(f"() => {{ const k = {K}, w = k.world, p = k.player, B = k.B, x = Math.floor(p.x), y = Math.floor(p.y), z = Math.floor(p.z); for (let dz = -14; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) {{ w.setBlock(x + dx, y - 3, z + dz, B.stone, 0); w.setBlock(x + dx, y - 2, z + dz, B.water, 0); w.setBlock(x + dx, y - 1, z + dz, B.water, 0); }} }}")
    await s.ev(f"() => {{ const k = {K}; window.__sw = 0; window.__si = setInterval(() => {{ if (k.player.inWater) window.__sw = Math.max(window.__sw, k.selfPose.swim); }}, 30); }}")
    await s.wait(300); await s.pg.keyboard.down('KeyW'); await s.pg.keyboard.down('Space'); await s.wait(1600)
    await s.pg.keyboard.up('KeyW'); await s.pg.keyboard.up('Space'); await s.wait(300)
    r = await s.ev("() => { clearInterval(window.__si); return +window.__sw.toFixed(2); }")
    check('水の中を進むと 泳ぐ姿になる', r > 0.6, r)
    await s.ev(f"() => {{ {K}.player.swing(); }}"); await s.wait(60)
    r = await s.ev(f"() => {K}.selfPose.swingT")
    check('ふると うでが動く', r > 0, r)
    await s.ev(f"() => {{ {K}.player.food = 9; }}"); await s.wait(400)
    r = await s.ev("() => { const c = [...document.getElementById('foods').children]; const full = c[0].src; return [c[0].getBoundingClientRect().left < c[9].getBoundingClientRect().left, c.map(x => x.src === full ? 1 : 0).join('')]; }")
    check('おなかは 右から へる（満タンが左、空が右）', r[0] is True and __import__('re').fullmatch('1+0+', r[1]) is not None, r)
    r = await s.ev(f"() => {{ const k = {K}, p = k.player, I = k.I; const a0 = k.selfPose.armorC; p.armor[0] = {{ id: I.iron_helmet, n: 1, d: 0 }}; p.armor[3] = {{ id: I.diamond_boots, n: 1, d: 0 }}; k.ui.open('inv'); const d = document.querySelector('#scrTop .doll'); return [a0, d ? d._ac : -1]; }}")
    await s.wait(300)
    r2 = await s.ev(f"() => {{ const k = {K}; const g = document.querySelectorAll('#scrTop .slot.ghost').length; k.ui.close(true); return [k.selfPose.armorC, g]; }}")
    check('身につけた防具が 姿と 持ち物画面の姿に出る（鉄のかぶと＝1、ダイヤのくつ＝2<<6）', r == [0, 129] and r2 == [129, 3], [r, r2])
    errs = [l for l in s.logs if 'PAGEERROR' in l or l.startswith('error')]
    check('エラーなし', len(errs) == 0, errs[:4])
    await s.close()
    print('ALL OK' if ok_all else 'SOME NG')
asyncio.run(main())
