import asyncio, json, sys, time
sys.path.insert(0, __import__('os').path.dirname(__import__('os').path.abspath(__file__)))
from lib import Sess
K = "window.__kk"
async def main():
    s = await Sess().start()
    await s.wait(3000); await s.shot('f_title')
    await s.pg.click('#bNew'); await s.wait(300)
    await s.pg.fill('#inName', 'はじまりの大地'); await s.pg.fill('#inSeed', 'さくら')
    await s.pg.click('#bStart')
    await s.pg.wait_for_function('window.__kk.game.state === "playing"', timeout=120000)
    await s.wait(2500); await s.shot('f_play')
    # 歩く・ジャンプ・こわす
    await s.pg.keyboard.down('KeyW'); await s.wait(1500); await s.pg.keyboard.press('Space'); await s.wait(800); await s.pg.keyboard.up('KeyW')
    print('moved', await s.ev(f"() => {{ const p = {K}.player; return [+p.x.toFixed(1), +p.y.toFixed(1), +p.z.toFixed(1), p.onGround, +p.stats.dist.toFixed(1)]; }}"))
    await s.pg.keyboard.press('Escape'); await s.wait(600)
    print('after esc', await s.ev(f"() => [{K}.game.state, {K}.ui.menu]"))
    await s.shot('f_pause')
    await s.pg.click('#bSet2'); await s.wait(300); await s.shot('f_settings')
    await s.pg.click('#mSettings [data-back]'); await s.wait(200)
    await s.pg.click('#bResume'); await s.wait(500)
    print('resumed', await s.ev(f"() => [{K}.game.state, {K}.ui.menu]"))
    errs = [l for l in s.logs if 'PAGEERROR' in l or l.startswith('error')]
    print('errors', errs[:5])
    await s.close()
asyncio.run(main())
