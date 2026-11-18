# 持ち物の画面の大きさ（PC・スマホ横・スマホたて）と、手に持った物の持ち方の種類
import asyncio, sys, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from lib import Sess
K = "window.__kk"
ok_all = True
def check(name, cond, extra=''):
    global ok_all
    print(('OK  ' if cond else 'NG  ') + name, extra)
    if not cond: ok_all = False
M = "() => { const e = document.querySelector('#screen .panel').getBoundingClientRect(), sl = document.querySelector('#scrInv .slot').getBoundingClientRect(), sc = document.querySelector('#screen'); const all = [...document.querySelectorAll('#screen .slot')].map(x => x.getBoundingClientRect()); return { w: Math.round(e.width), h: Math.round(e.height), s: Math.round(sl.width), vw: innerWidth, vh: innerHeight, over: sc.scrollHeight > innerHeight + 1 || sc.scrollWidth > innerWidth + 1, out: all.filter(r => r.width > 0 && (r.left < 0 || r.right > innerWidth + 0.5)).length }; }"
async def run(tag, w, h, touch, want):
    s = await Sess().start(w, h, touch=touch, mobile=touch)
    await s.ev(f"() => {{ const st = {K}.settings; st.viewDist = 3; st.music = 0; st.showInfo = false; }}")
    await s.new_world('9753', mode=0, diff=0); await s.wait(600)
    await s.ev(f"() => {{ const k = {K}, p = k.player, I = k.I, B = k.B; p.inv[0] = {{ id: I.iron_pick, n: 1, d: 0 }}; p.inv[9] = {{ id: B.cobble, n: 64, d: 0 }}; p.invDirty = true; k.ui.open('inv'); }}")
    await s.wait(300); m = await s.ev(M)
    check(f'{tag} 持ち物：マスが大きい・画面におさまる', m['s'] >= want[0] and not m['over'] and m['out'] == 0, m)
    r = await s.ev(f"() => {{ const k = {K}; const d = document.querySelector('#scrTop .doll'), c = getComputedStyle(document.querySelector('#screen .panel')).backgroundColor.match(/\\d+/g).map(Number); return [k.ui.slots.filter(r => r.t === 'armor').map(r => r.i), document.querySelectorAll('#scrTop .eqBox .slot.ghost').length, !!d && d.getBoundingClientRect().height > 60, Math.min(c[0], c[1], c[2]) > 215]; }}")
    check(f'{tag} 防具4つ＋盾のマス（空のマスに うすい絵）。板は白っぽい色', r[0] == [0, 1, 2, 3, 4] and r[1] == 5 and r[3], r)
    if tag in ('PC', 'たて'): check(f'{tag} まん中に 自分の姿', r[2], r)
    # つかんだ物の大きさが マスと同じ
    r = await s.ev(f"() => {{ const k = {K}, p = k.player; p.cursor = {{ id: k.I.stick, n: 3, d: 0 }}; k.ui.refresh(); const c = document.getElementById('cursorItem'); const w = c.getBoundingClientRect().width; p.cursor = null; k.ui.refresh(); return Math.round(w); }}")
    check(f'{tag} つかんだ物も 同じ大きさ', abs(r - m['s']) <= 1, [r, m['s']])
    for kind in ['table', 'chest', 'furnace']:
        await s.ev(f"""() => {{ const k = {K}; k.ui.close(true); const ent = '{kind}' === 'chest' ? {{ items: new Array(27).fill(null) }} : '{kind}' === 'furnace' ? {{ in: null, fuel: null, out: null, burn: 0, burnMax: 0, cook: 0 }} : null; k.ui.open('{kind}', ent, null); }}""")
        await s.wait(250); m = await s.ev(M)
        check(f'{tag} {kind}：マスが大きい・よこに はみ出さない', m['s'] >= want[1] and m['out'] == 0 and (not m['over'] or tag == 'たて'), m)
    await s.ev(f"() => {{ const k = {K}; k.ui.close(true); k.player.mode = 1; k.ui.open('inv'); }}"); await s.wait(300); m = await s.ev(M)
    r = await s.ev("() => { const p = document.getElementById('palette').getBoundingClientRect(), i = document.getElementById('scrInv').getBoundingClientRect(); return [document.querySelectorAll('#palette .slot').length, Math.round(p.left - i.right), Math.round(p.height / document.querySelector('#palette .slot').getBoundingClientRect().height)]; }")
    check(f'{tag} クリエイティブ：マスが大きい・一覧が見える', m['s'] >= want[2] and m['out'] == 0 and not m['over'] and r[0] > 300 and r[2] >= 4 and (r[1] > 0 or tag == 'たて'), [m, r])
    r = await s.ev(f"() => {{ const k = {K}; return [k.ui.slots.some(r => r.t === 'pal' && k.ITEMS[r.id].hide), k.ui.slots.some(r => r.t === 'trash')]; }}")
    check(f'{tag} クリエイティブ：かくした物は出ない・すてるマスがある', r == [False, True], r)
    await s.ev(f"() => {{ const k = {K}; k.ui.close(true); k.player.mode = 0; }}")
    if tag == 'PC':
        r = await s.ev(f"() => {{ const k = {K}, I = k.I, B = k.B; return [I.iron_pick, I.iron_sword, I.bow, I.stick, I.arrow, I.bread, I.shears, I.bucket, B.torch, B.stone, B.planks_oak].map(k.holdKind); }}")
        check('持ち方の種類（道具＝2、小物＝1、ブロック＝0）', r == [2, 2, 2, 2, 2, 1, 1, 1, 1, 0, 0], r)
    errs = [l for l in s.logs if 'PAGEERROR' in l or l.startswith('error')]
    check(f'{tag} エラーなし', len(errs) == 0, errs[:4])
    await s.close()
async def main():
    await run('PC', 1280, 720, False, (54, 58, 54))
    await run('スマホ横', 844, 390, True, (44, 39, 45))
    await run('小さいスマホ横', 667, 375, True, (41, 37, 34))
    await run('たて', 390, 844, True, (38, 38, 38))
    print('ALL OK' if ok_all else 'SOME NG')
asyncio.run(main())
