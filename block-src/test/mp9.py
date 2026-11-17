import asyncio, sys, json
sys.path.insert(0, __import__('os').path.dirname(__import__('os').path.abspath(__file__)))
from mplib import Mp, K
async def main():
    m = await Mp().start(1, w=900, h=560)
    pg = m.pg[0]
    await m.ev(0, f"() => {{ {K}.game.startNew('みんなの島', '777', 0, 2, true, {{}}); }}")
    await m.playing(0); await m.wait(1500)
    await m.ev(0, f"() => {{ const g = {K}.game, r = g.resume, p = g.pause; window.__log = []; g.resume = function () {{ window.__log.push('resume ' + g.state + ' ' + new Error().stack.split('\\n').slice(2, 5).join(' | ')); return r.apply(this, arguments); }}; g.pause = function () {{ window.__log.push('pause ' + g.state); return p.apply(this, arguments); }}; }}")
    await pg.keyboard.press('Escape'); await m.wait(900)
    print(await m.ev(0, f"() => [{K}.game.state, {K}.ui.menu, window.__log]"))
    await m.close()
asyncio.run(main())
