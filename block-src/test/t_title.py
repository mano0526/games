import asyncio, sys
sys.path.insert(0, __import__('os').path.dirname(__import__('os').path.abspath(__file__)))
from lib import Sess
async def main():
    for (w, h, name, mob) in [(1280, 720, 'title_pc', False), (390, 780, 'title_sp', True), (780, 360, 'title_land', True)]:
        s = await Sess().start(w, h, touch=mob, mobile=mob)
        await s.wait(2500)
        await s.shot(name)
        print(name, await s.ev("() => { const r = document.getElementById('logo').getBoundingClientRect(); return [Math.round(r.left), Math.round(r.right), Math.round(r.width), innerWidth, document.title] }"))
        errs = [l for l in s.logs if 'error' in l.lower()]
        print(' errs', errs[:5])
        await s.close()
asyncio.run(main())
