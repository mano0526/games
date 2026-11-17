import asyncio, sys
sys.path.insert(0, __import__('os').path.dirname(__import__('os').path.abspath(__file__)))
from mplib import Mp, K
from PIL import Image
async def main():
    m = await Mp().start(0)
    shots = []
    for (w, h, touch, tag) in [(900, 560, False, 'pc'), (390, 780, True, 'sp'), (780, 360, True, 'land')]:
        ctx = await m.b.new_context(viewport={'width': w, 'height': h}, device_scale_factor=1, has_touch=touch, is_mobile=touch)
        pg = await ctx.new_page()
        await pg.goto('http://127.0.0.1:8765/test_mp.html'); await pg.wait_for_function('window.__kk && window.__kk.game.state === "title"', timeout=60000)
        await pg.wait_for_timeout(1500)
        await pg.evaluate("() => { const u = window.__kk.ui; window.__kk.net.setName('アオ'); window.__kk.net.remember('ABCD', 'はじまりの島', true); window.__kk.net.remember('WXYZ', 'ともだちの世界', false); }")
        for (name, js) in [('title', "() => {}"), ('online', "() => window.__kk.ui.openOnline()"), ('look', "() => window.__kk.ui.openLook()"), ('new', "() => { const u = window.__kk.ui; u.back(); u.back(); u.setSeg('segNet', 1); u.showMenu('mNew', true, true); u.updNotes(); }"), ('newbottom', "() => { document.getElementById('menu').scrollTop = 9999; }")]:
            await pg.evaluate(js); await pg.wait_for_timeout(500)
            f = '/tmp/kk/ui2_%s_%s.png' % (tag, name); await pg.screenshot(path=f); shots.append(f)
            ov = await pg.evaluate("() => { const m = document.getElementById('menu'), s = m.querySelector('section.on'), r = s.getBoundingClientRect(); return [Math.round(r.left), Math.round(r.right), innerWidth, m.scrollHeight, m.clientHeight, document.documentElement.scrollWidth]; }")
            print(tag, name, ov)
        await ctx.close()
    await m.close()
asyncio.run(main())
