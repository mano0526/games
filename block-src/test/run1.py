import asyncio, sys, json, time
from playwright.async_api import async_playwright
ARGS = ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--enable-webgl', '--no-sandbox', '--autoplay-policy=no-user-gesture-required']
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path='/usr/bin/google-chrome', args=ARGS, headless=True)
        pg = await b.new_page(viewport={'width': 1280, 'height': 720})
        logs = []
        pg.on('console', lambda m: logs.append(m.type + ': ' + m.text))
        pg.on('pageerror', lambda e: logs.append('PAGEERROR: ' + str(e)))
        await pg.goto('file:///home/claude/kakukaku/dist/test.html')
        await pg.wait_for_timeout(6000)
        await pg.screenshot(path='/tmp/kk/title.png')
        info = await pg.evaluate("() => { const k = window.__kk; return k ? { state: k.game.state, chunks: k.world ? k.world.chunks.size : -1, fps: k.game.fps, tex: Object.keys(k.TEX).length, workers: 'n/a', sections: k.R.stats.sections, lost: k.R.lost } : 'no __kk'; }")
        print(json.dumps(info, ensure_ascii=False))
        for l in logs[:40]: print(l)
        await b.close()
asyncio.run(main())
