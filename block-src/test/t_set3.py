import asyncio, sys
sys.path.insert(0, __import__('os').path.dirname(__import__('os').path.abspath(__file__)))
from lib import Sess
async def main():
    for (w, h, tag) in [(390, 780, 'sp'), (780, 360, 'land')]:
        s = await Sess().start(w, h, touch=True, mobile=True); pg = s.pg
        await pg.evaluate("() => window.__kk.ui.openSettings('video')"); await s.wait(300)
        for t in ['video', 'ctrl', 'keys', 'audio']:
            await pg.evaluate("(t) => { const u = window.__kk.ui; u.setTab = t; u.paintSettings(); }", t); await s.wait(150)
            r = await pg.evaluate("() => { const m = document.getElementById('menu'), sec = m.querySelector('section.on'), b = sec.getBoundingClientRect(); let over = 0; for (const el of sec.querySelectorAll('*')) { const r = el.getBoundingClientRect(); if (r.width && (r.right > b.right + 0.5 || r.left < b.left - 0.5)) over++; } return [Math.round(b.left), Math.round(b.right), innerWidth, document.documentElement.scrollWidth, over]; }")
            print(tag, t, r)
        await s.shot('set_' + tag)
        await s.close()
asyncio.run(main())
