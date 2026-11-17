import asyncio, sys
sys.path.insert(0, __import__('os').path.dirname(__import__('os').path.abspath(__file__)))
from lib import Sess
from PIL import Image
K = "window.__kk"
async def main():
    s = await Sess().start(900, 600)
    pg = s.pg
    await pg.click('#bSet'); await s.wait(300)
    shots = []
    for t in ['video', 'ctrl', 'keys', 'audio']:
        await pg.click(f'#setTabs [data-t={t}]'); await s.wait(250); await s.shot('set_' + t); shots.append('/tmp/kk/set_' + t + '.png')
        print(t, await s.ev("() => { const m = document.getElementById('menu'), r = m.querySelector('section.on').getBoundingClientRect(); return [m.scrollHeight, m.clientHeight, Math.round(r.width), document.getElementById('setBody').children.length]; }"))
    # キーの割り当て：「前へ」を I に、次に「後ろへ」を I に（入れかわるはず）
    await pg.click('#setTabs [data-t=keys]'); await s.wait(200)
    await pg.click('#setBody [data-key=fwd]'); await s.wait(150)
    print('waiting', await s.ev(f"() => [{K}.ui.keyWait, document.querySelector('#setBody [data-key=fwd]').textContent]"))
    await pg.keyboard.press('KeyI'); await s.wait(150)
    await pg.click('#setBody [data-key=back]'); await pg.keyboard.press('KeyI'); await s.wait(150)
    print('keys', await s.ev(f"() => [{K}.settings.keys.fwd, {K}.settings.keys.back, document.querySelector('#setBody [data-key=fwd]').textContent, document.querySelector('#setBody [data-key=back]').textContent]"))
    await pg.click('#setBody [data-key=fwd]'); await pg.keyboard.press('Escape'); await s.wait(150)
    print('esc cancels', await s.ev(f"() => [{K}.ui.keyWait, {K}.ui.menu, {K}.settings.keys.fwd]"))
    await pg.click('#setBody [data-key=fwd]'); await pg.keyboard.press('ArrowUp'); await s.wait(150)
    saved = await s.ev("() => JSON.parse(localStorage.getItem('kk_settings')).keys.fwd")
    print('saved fwd', saved)
    await pg.click('#mSettings [data-back]'); await s.wait(200)
    # 遊んで、割り当てたキーで歩けるか
    await s.ev(f"() => {{ {K}.R.skip = true; }}")
    await s.new_world('2468', 0, 2); await s.wait(800)
    p0 = await s.ev(f"() => [{K}.player.x, {K}.player.z]")
    await pg.keyboard.down('ArrowUp'); await s.wait(1200); await pg.keyboard.up('ArrowUp')
    p1 = await s.ev(f"() => [{K}.player.x, {K}.player.z]")
    await pg.keyboard.down('KeyW'); await s.wait(600); await pg.keyboard.up('KeyW')
    p2 = await s.ev(f"() => [{K}.player.x, {K}.player.z]")
    print('moved with new key', round(((p1[0]-p0[0])**2 + (p1[1]-p0[1])**2) ** 0.5, 2), 'old key W moves', round(((p2[0]-p1[0])**2 + (p2[1]-p1[1])**2) ** 0.5, 2))
    # 視点の切りかえ
    await s.ev(f"() => {{ {K}.R.skip = false; {K}.player.inv[0] = {{ id: {K}.I.iron_pick, n: 1, d: 0 }}; {K}.player.invDirty = true; {K}.player.pitch = -0.25; }}")
    for v in (1, 2):
        await pg.keyboard.press('F5'); await s.wait(900); await s.shot('view%d' % v); shots.append('/tmp/kk/view%d.png' % v)
    print('view', await s.ev(f"() => {K}.settings.view"))
    # 設定を最初にもどす
    await pg.keyboard.press('Escape'); await s.wait(400); await pg.click('#bSet2'); await s.wait(200)
    await pg.click('#setTabs [data-t=keys]'); await pg.click('#bSetReset'); await s.wait(200)
    print('reset keys', await s.ev(f"() => [{K}.settings.keys.fwd, {K}.settings.keys.back]"))
    errs = [l for l in s.logs if 'PAGEERROR' in l or l.startswith('error')]
    print('errors', errs[:5])
    ims = [Image.open(f) for f in shots]; w, h = ims[0].size
    sheet = Image.new('RGB', (w * 3, h * 2))
    for i, im in enumerate(ims): sheet.paste(im, ((i % 3) * w, (i // 3) * h))
    sheet = sheet.resize((w * 3 * 5 // 9, h * 2 * 5 // 9)); sheet.save('/tmp/kk/sheet_set.png'); print(sheet.size)
    await s.close()
asyncio.run(main())
