import asyncio, json
from playwright.async_api import async_playwright
ARGS = ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--enable-webgl', '--no-sandbox', '--autoplay-policy=no-user-gesture-required',
        '--disable-renderer-backgrounding', '--disable-background-timer-throttling', '--disable-backgrounding-occluded-windows']
K = 'window.__kk'
class Mp:
    """同じブラウザの中に何ページか開いて、にせの中継サーバーでつなぐ"""
    async def start(self, n=2, w=420, h=260, lag=0, page='test_mp.html'):
        self.pw = await async_playwright().start()
        self.b = await self.pw.chromium.launch(executable_path='/usr/bin/google-chrome', args=ARGS, headless=True)
        self.ctx = await self.b.new_context(viewport={'width': w, 'height': h}, device_scale_factor=1)
        self.pg = []; self.logs = []; self.lag = lag; self.page = page
        for i in range(n): await self.add()
        return self
    async def add(self, query='', name=None, w=None, h=None, touch=False):
        i = len(self.pg); logs = []
        if w:
            ctx = await self.b.new_context(viewport={'width': w, 'height': h}, device_scale_factor=1, has_touch=touch, is_mobile=touch)   # 注意：別の context は にせサーバーを共有しない（画面の見た目の確認用）
            pg = await ctx.new_page()
        else: pg = await self.ctx.new_page()
        pg.on('console', lambda m: logs.append(m.type + ': ' + m.text) if 'GPU stall' not in m.text and 'ERR_TUNNEL' not in m.text and 'fonts.googleapis' not in m.text else None)
        pg.on('pageerror', lambda e: logs.append('PAGEERROR: ' + str(e)))
        # ページごとに保存場所を分ける（同じブラウザだと localStorage が共有されるため）
        await pg.add_init_script("(() => { const P = 'p%d_'; const g = Storage.prototype.getItem, s = Storage.prototype.setItem, r = Storage.prototype.removeItem; Storage.prototype.getItem = function (k) { return g.call(this, P + k); }; Storage.prototype.setItem = function (k, v) { return s.call(this, P + k, v); }; Storage.prototype.removeItem = function (k) { return r.call(this, P + k); }; window.__kkNoIdb = true; %s })();" % (i, ("localStorage.setItem('gm_name', '%s');" % name) if name else ''))
        q = ('?lag=%d' % self.lag) if self.lag else ''
        if query: q = (q + '&' if q else '?') + query
        await pg.goto('http://127.0.0.1:8765/' + self.page + q)
        await pg.wait_for_function('window.__kk && window.__kk.game.state !== "boot"', timeout=60000)
        await pg.evaluate("(n) => { if (!window.__kk.net.getName() && !location.search.includes('room=')) window.__kk.net.setName(n); window.__kk.settings.viewDist = 3; window.__kk.settings.quality = 0.5; window.__kk.settings.clouds = false; window.__kk.settings.fancyLeaves = false; window.__kk.settings.sfx = 0; window.__kk.settings.music = 0; window.__kk.R.scale = 0.5; window.__kk.R.skip = true; }", ['アオ', 'ミドリ', 'キイロ', 'モモ'][i % 4])
        self.pg.append(pg); self.logs.append(logs)
        return pg
    async def ev(self, i, js, arg=None): return await self.pg[i].evaluate(js, arg)
    async def wait(self, ms): await self.pg[0].wait_for_timeout(ms)
    async def playing(self, i, timeout=180000):
        await self.pg[i].wait_for_function('window.__kk.game.state === "playing"', timeout=timeout)
        await self.pg[i].evaluate("() => { if (window.__kk.WX) window.__kk.WX.force = 0; }")   # 試験の間は 晴れに しておく（みんなの世界の天気は 本当の時計で決まるので、日によって 雨になる）
    async def shot(self, i, name):
        # 絵を描くのは写真をとるときだけ（2ページ同時だと遅いので、ふだんは計算だけ進める）
        await self.pg[i].evaluate("() => { window.__kk.R.skip = false; }")
        await self.pg[i].wait_for_timeout(700)
        await self.pg[i].screenshot(path='/tmp/kk/' + name + '.png')
        await self.pg[i].evaluate("() => { window.__kk.R.skip = true; }")
    def errs(self):
        out = []
        for i, l in enumerate(self.logs):
            for x in l:
                if 'PAGEERROR' in x or x.startswith('error'): out.append('p%d %s' % (i, x[:300]))
        return out
    async def close(self):
        await self.b.close(); await self.pw.stop()
