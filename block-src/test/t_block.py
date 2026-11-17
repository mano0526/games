import asyncio, sys
sys.path.insert(0, __import__('os').path.dirname(__import__('os').path.abspath(__file__)))
from mplib import ARGS
from playwright.async_api import async_playwright
async def main():
    pw = await async_playwright().start()
    b = await pw.chromium.launch(executable_path='/usr/bin/google-chrome', args=ARGS, headless=True)
    for page in ['block.html', 'block.html?room=ABCD', 'test.html']:
        ctx = await b.new_context(viewport={'width': 800, 'height': 500}); pg = await ctx.new_page(); logs = []
        pg.on('pageerror', lambda e: logs.append('PAGEERROR: ' + str(e)))
        await pg.goto('http://127.0.0.1:8765/' + page, wait_until='load', timeout=60000)
        await pg.wait_for_function('window.__kk && window.__kk.game.state === "title"', timeout=60000)
        await pg.wait_for_timeout(1500)
        print(page, await pg.evaluate("() => [window.__kk.net.avail, !!window.__blockOnline, window.__kk.ui.menu, document.getElementById('homeLink').hidden, document.readyState]"))
        if page == 'block.html':
            await pg.click('#bOnline'); await pg.wait_for_timeout(300)
            print('  online screen:', await pg.evaluate("() => [window.__kk.ui.menu, document.getElementById('onlineOffA').textContent, document.getElementById('onlineLink').hidden]"))
        if page == 'test.html':
            await pg.click('#bOnline'); await pg.wait_for_timeout(300)
            print('  online screen:', await pg.evaluate("() => [window.__kk.ui.menu, document.getElementById('onlineOffA').textContent.slice(0, 30), document.getElementById('onlineLink').textContent]"))
            await pg.click('#mOnline [data-back]'); await pg.click('#bNew'); await pg.wait_for_timeout(300)
            print('  new world: rowNet hidden', await pg.evaluate("() => document.getElementById('rowNet').hidden"))
        print('  errors', logs[:3])
        await ctx.close()
    await b.close(); await pw.stop()
asyncio.run(main())
