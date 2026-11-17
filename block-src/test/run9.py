import asyncio, json, sys, time
sys.path.insert(0, __import__('os').path.dirname(__import__('os').path.abspath(__file__)))
from lib import Sess
K = "window.__kk"
async def mobile(w, h, tag):
    s = await Sess().start(w=w, h=h, touch=True, mobile=True)
    await s.wait(2500)
    await s.shot('m_title_' + tag)
    await s.pg.touchscreen.tap(w // 2, h // 2 - 150)
    await s.wait(200)
    await s.new_world('12345')
    await s.wait(1500)
    print(tag, 'settings', await s.ev(f"() => JSON.stringify([{K}.settings.viewDist, {K}.settings.quality, {K}.settings.autoJump, {K}.touchSt.touchUsed, document.getElementById('app').className])"))
    await s.shot('m_play_' + tag)
    await s.ev(f"""() => {{ const k = {K}, p = k.player; p.give(k.B.log_oak, 12, 0); p.give(k.B.cobble, 30, 0); p.give(k.I.coal, 6, 0); p.give(k.I.stick, 8, 0); p.give(k.I.bread, 5, 0); k.ui.open('inv'); }}""")
    await s.wait(600); await s.shot('m_inv_' + tag)
    await s.ev(f"() => {{ {K}.ui.close(true); {K}.game.pause(); }}"); await s.wait(400); await s.shot('m_pause_' + tag)
    await s.ev(f"() => {{ {K}.ui.openSettings(); }}"); await s.wait(400); await s.shot('m_set_' + tag)
    ov = await s.ev("() => [document.documentElement.scrollWidth, window.innerWidth, document.body.scrollHeight, window.innerHeight]")
    print(tag, 'overflow check', ov)
    s.dump()
    await s.close()
async def main():
    await mobile(390, 844, 'port')
    await mobile(844, 390, 'land')
asyncio.run(main())
