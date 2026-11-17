import asyncio, json
from playwright.async_api import async_playwright
ARGS = ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--enable-webgl', '--no-sandbox', '--autoplay-policy=no-user-gesture-required']
class Sess:
    async def start(self, w=1280, h=720, touch=False, noworker=False, mobile=False):
        self.pw = await async_playwright().start()
        self.b = await self.pw.chromium.launch(executable_path='/usr/bin/google-chrome', args=ARGS, headless=True)
        ctx = await self.b.new_context(viewport={'width': w, 'height': h}, has_touch=touch, is_mobile=mobile, device_scale_factor=1)
        self.pg = await ctx.new_page()
        self.logs = []
        self.pg.on('console', lambda m: self.logs.append(m.type + ': ' + m.text) if 'GPU stall' not in m.text and 'ERR_TUNNEL' not in m.text else None)
        self.pg.on('pageerror', lambda e: self.logs.append('PAGEERROR: ' + str(e)))
        if noworker: await self.pg.add_init_script('window.__kkNoWorker = true;')
        await self.pg.goto('file://' + __import__('os').path.join(__import__('os').path.dirname(__import__('os').path.dirname(__import__('os').path.abspath(__file__))), 'dist', 'test.html'))
        await self.pg.wait_for_function('window.__kk && window.__kk.game.state === "title"', timeout=30000)
        return self
    async def ev(self, js): return await self.pg.evaluate(js)
    async def shot(self, name): await self.pg.screenshot(path='/tmp/kk/' + name + '.png')
    async def new_world(self, seed='12345', mode=0, diff=2, timeout=120000):
        await self.ev(f"() => window.__kk.game.startNew('テスト', '{seed}', {mode}, {diff})")
        await self.pg.wait_for_function('window.__kk.game.state === "playing"', timeout=timeout)
    async def wait(self, ms): await self.pg.wait_for_timeout(ms)
    def dump(self, n=30):
        for l in self.logs[:n]: print('  LOG', l)
    async def close(self):
        await self.b.close(); await self.pw.stop()
