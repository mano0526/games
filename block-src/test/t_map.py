# 地図の確認（1人用）
import asyncio, json, sys, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from lib import Sess
K = "window.__kk"
ok_all = True
def check(name, cond, extra=''):
    global ok_all
    print(('OK  ' if cond else 'NG  ') + name, extra)
    if not cond: ok_all = False
async def main():
    s = await Sess().start(1100, 660)
    await s.ev(f"() => {{ {K}.settings.viewDist = 6; }}")
    await s.new_world('2468', mode=0, diff=0)
    await s.wait(3000)
    for i in range(40):
        if await s.ev(f"() => {K}.map.queue.length") == 0: break
        await s.wait(500)
    r = await s.ev(f"() => {{ const m = {K}.map; let n = 0; for (const b of m.seen.values()) for (const v of b) for (let i = 0; i < 8; i++) if (v >> i & 1) n++; return [n, m.tiles.size, m.queue.length, !document.getElementById('mini').hidden]; }}")
    check('歩いた所が記録され、小さな地図が出る', r[0] >= 60 and r[1] >= 1 and r[2] == 0 and r[3], r)
    await s.shot('map_mini')
    # 小さな地図に絵が描かれている（まっ黒でない）
    r = await s.ev("() => { const cv = document.getElementById('mini'), d = cv.getContext('2d').getImageData(0, 0, 112, 112).data; let lit = 0; const cols = new Set(); for (let i = 0; i < d.length; i += 4) { if (d[i] + d[i + 1] + d[i + 2] > 120) lit++; cols.add((d[i] >> 4) + ',' + (d[i + 1] >> 4) + ',' + (d[i + 2] >> 4)); } return [lit, cols.size]; }")
    check('小さな地図に絵がある', r[0] > 9000 and r[1] >= 4, r)
    # 大きな地図
    await s.pg.keyboard.press('KeyM'); await s.wait(700)
    r = await s.ev(f"() => [{K}.ui.screen, {K}.map.open, document.getElementById('mapScr').classList.contains('on'), {K}.game.state]")
    check('M で大きな地図が開く', r == ['map', True, True, 'playing'], r)
    await s.shot('map_full')
    await s.pg.mouse.move(550, 380); await s.pg.mouse.wheel(0, 300); await s.wait(300); await s.pg.mouse.wheel(0, 300); await s.wait(600)
    await s.shot('map_out')
    r1 = await s.ev(f"() => {K}.map.zi")
    await s.pg.click('#mapIn'); await s.pg.click('#mapIn'); await s.pg.click('#mapIn'); await s.wait(300)
    r2 = await s.ev(f"() => {K}.map.zi")
    check('大きさを変えられる', r1 == 0 and r2 == 3, [r1, r2])
    await s.pg.click('#mapOut'); await s.wait(200)   # 1マス＝4ドットにもどす
    # ドラッグで動かす
    c0 = await s.ev(f"() => [{K}.map.cx, {K}.map.cz]")
    await s.pg.mouse.move(500, 400); await s.pg.mouse.down(); await s.pg.mouse.move(580, 430, steps=4); await s.pg.mouse.up(); await s.wait(200)
    c1 = await s.ev(f"() => [{K}.map.cx, {K}.map.cz, {K}.map.sel]")
    check('ドラッグで動く（しるしの画面は出ない）', abs((c0[0] - c1[0]) - 80 / 2) < 0.6 and abs((c0[1] - c1[1]) - 30 / 2) < 0.6 and c1[2] is None, [c0, c1])
    # クリックして しるしを置く
    await s.pg.mouse.click(700, 300); await s.wait(300)
    r = await s.ev(f"() => [{K}.map.sel && {K}.map.sel.x, !document.getElementById('mapPanel').hidden, document.getElementById('mapSelText').textContent]")
    check('クリックで場所をえらべる', r[0] is not None and r[1] and 'X ' in r[2], r)
    await s.pg.fill('#mapPinName', 'ひみつきち'); await s.pg.click('#mapPinCols button:nth-child(4)'); await s.pg.click('#mapPinAdd'); await s.wait(400)
    r = await s.ev(f"() => [{K}.map.pins.map(p => [p.n, p.c]), document.getElementById('mapPanel').hidden]")
    check('しるしを置ける', r == [[['ひみつきち', 3]], True], r)
    await s.shot('map_pin')
    # しるしをクリック → 消す画面
    await s.pg.mouse.click(700, 300); await s.wait(300)
    r = await s.ev(f"() => [!!({K}.map.sel && {K}.map.sel.pin), document.getElementById('mapSelText').textContent, document.getElementById('mapPinDel').hidden]")
    check('しるしをえらべる', r[0] and 'ひみつきち' in r[1] and not r[2], r)
    await s.pg.click('#mapPinCancel'); await s.wait(200)
    # とじる
    await s.pg.keyboard.press('KeyM'); await s.wait(400)
    r = await s.ev(f"() => [{K}.ui.screen, {K}.map.open, !document.getElementById('mini').hidden, {K}.game.state]")
    check('M でとじる', r == [None, False, True, 'playing'], r)
    await s.pg.keyboard.press('KeyM'); await s.wait(300); await s.pg.keyboard.press('Escape'); await s.wait(400)
    r = await s.ev(f"() => [{K}.ui.screen, {K}.map.open, {K}.game.state]")
    check('Esc でもとじる（メニューは開かない）', r == [None, False, 'playing'], r)
    # メニューの「地図」から開く
    await s.ev(f"() => {K}.game.pause()"); await s.wait(400)
    await s.pg.click('#bMap'); await s.wait(500)
    r = await s.ev(f"() => [{K}.ui.screen, {K}.game.state, {K}.ui.menu]")
    check('メニューから開ける', r == ['map', 'playing', None], r)
    await s.pg.click('#mapClose'); await s.wait(300)
    # 歩くと地図が広がる
    n0 = await s.ev(f"() => {{ const m = {K}.map; let n = 0; for (const b of m.seen.values()) for (const v of b) for (let i = 0; i < 8; i++) if (v >> i & 1) n++; return n; }}")
    await s.ev(f"() => {{ const p = {K}.player; p.mode = 1; p.flying = true; p.x += 150; p.y += 20; }}")
    await s.wait(6000)
    n1 = await s.ev(f"() => {{ const m = {K}.map; let n = 0; for (const b of m.seen.values()) for (const v of b) for (let i = 0; i < 8; i++) if (v >> i & 1) n++; return n; }}")
    check('歩くと広がる', n1 > n0 + 30, [n0, n1])
    # セーブして読み直しても残る
    wid = await s.ev(f"() => {K}.game.worldId")
    await s.ev(f"async () => {{ await {K}.game.save(); }}")
    await s.ev(f"() => {K}.game.quitToTitle()")
    await s.pg.wait_for_function('window.__kk.game.state === "title"', timeout=30000)
    r = await s.ev(f"() => [{K}.map.seen.size, {K}.map.pins.length, document.getElementById('mini').hidden]")
    check('タイトルでは地図は空', r == [0, 0, True], r)
    await s.ev(f"() => {K}.game.loadWorld('{wid}')")
    await s.pg.wait_for_function('window.__kk.game.state === "playing"', timeout=90000)
    await s.wait(1500)
    r = await s.ev(f"() => {{ const m = {K}.map; let n = 0; for (const b of m.seen.values()) for (const v of b) for (let i = 0; i < 8; i++) if (v >> i & 1) n++; return [n, m.pins.map(p => p.n)]; }}")
    check('読み直しても 歩いた所と しるしが残る', r[0] >= n1 and r[1] == ['ひみつきち'], r)
    await s.pg.keyboard.press('KeyM'); await s.wait(2500); await s.shot('map_reload')
    await s.pg.keyboard.press('Escape'); await s.wait(300)
    # 設定で小さな地図を消せる
    await s.ev(f"() => {{ {K}.settings.minimap = false; }}")
    for i in range(20):
        r = await s.ev("() => document.getElementById('mini').hidden")
        if r: break
        await s.wait(300)
    check('設定で小さな地図を消せる', r is True, r)
    errs = [l for l in s.logs if 'PAGEERROR' in l or l.startswith('error')]
    check('エラーなし', len(errs) == 0, errs[:5])
    await s.close()
    print('ALL OK' if ok_all else 'SOME NG')
asyncio.run(main())
