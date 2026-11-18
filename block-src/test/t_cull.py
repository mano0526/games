# 見えない区画をはぶくしくみの確認：はぶいたせいで 見えるはずの物が消えていないか（視線を何千本も飛ばして確かめる）、どれだけ減ったか
import asyncio, json, sys, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from lib import Sess
from PIL import Image, ImageChops
K = "window.__kk"
ok_all = True
def check(name, cond, extra=''):
    global ok_all
    print(('OK  ' if cond else 'NG  ') + name, extra)
    if not cond: ok_all = False
WAIT = f"""() => {{ const k = {K}, w = k.world, p = k.player; p.flying = true; p.vy = 0; const R = Math.min(k.settings.viewDist, w.dim === 1 ? 6 : 99), cx = Math.floor(p.x) >> 4, cz = Math.floor(p.z) >> 4; let n = 0, m = 0;
  for (let dz = -R; dz <= R; dz++) for (let dx = -R; dx <= R; dx++) {{ n++; const c = w.getChunk(cx + dx, cz + dz); if (c && c.stage >= 2 && c.meshed && !c.dirty) m++; }} return [n, m]; }}"""
# 視線を飛ばして、当たったブロックのある区画が「描く」ほうに入っているか
PROBE = f"""(N) => {{ const k = {K}, w = k.world, p = k.player, C = k.CULL, cam = k.game.cam; const R = Math.min(k.settings.viewDist, w.dim === 1 ? 6 : 99);
  const pcx = Math.floor(cam.x / 16), pcz = Math.floor(cam.z / 16);
  if (!C.ok) return {{ ok: false }};
  let hits = 0, miss = 0, missList = []; const rnd = (() => {{ let s = 12345; return () => (s = (s * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff; }})();
  for (let i = 0; i < N; i++) {{
    const u = rnd() * 2 - 1, a = rnd() * 6.283185, r = Math.sqrt(1 - u * u), dx = Math.cos(a) * r, dy = u, dz = Math.sin(a) * r;
    const t = w.raycast(cam.x, cam.y, cam.z, dx, dy, dz, R * 16 - 10); if (!t) continue;
    const ix = (t.x >> 4) - pcx + R, iz = (t.z >> 4) - pcz + R, s = t.y >> 4; if (ix < 0 || iz < 0 || ix >= C.W || iz >= C.W) continue;
    hits++; if (!C.seen[(iz * C.W + ix) * 8 + s]) {{ miss++; if (missList.length < 5) missList.push([t.x, t.y, t.z, t.id]); }}
  }}
  let tot = 0, vis = 0, vt = 0, vv = 0;
  for (const c of w.chunks.values()) {{ const dx = c.cx - pcx, dz = c.cz - pcz; if (Math.abs(dx) > R || Math.abs(dz) > R) continue; for (let s = 0; s < 8; s++) {{ const m = c.meshes[s]; if (!m) continue; const q = m.nO + m.nC + (m.nD || 0) + m.nT; tot++; vt += q; if (C.seen[((dz + R) * C.W + dx + R) * 8 + s]) {{ vis++; vv += q; }} }} }}
  return {{ ok: true, hits, miss, missList, tot, vis, vt, vv }}; }}"""
async def settle(s):
    for i in range(120):
        await s.wait(500)
        st = await s.ev(WAIT)
        if st[1] >= st[0]: break
    await s.wait(800)
async def spot(s, name, N=5000, shot=True):
    await settle(s)
    r = await s.pg.evaluate(PROBE, N)
    pct = 100 - round(r['vv'] / max(1, r['vt']) * 100)
    check(name + '：見えるはずの物が消えていない', r['ok'] and r['hits'] > 100 and r['miss'] == 0, {'視線': r['hits'], '消えた': r['miss'], '例': r['missList']})
    print('     区画 %d → %d、面の点 %d → %d（%d%% 減）' % (r['tot'], r['vis'], r['vt'], r['vv'], pct))
    if shot:   # はぶく・はぶかない で 絵が同じか
        await s.ev(f"() => {{ {K}.game.pause(); }}"); await s.wait(400)
        await s.ev("() => { document.getElementById('menu').style.visibility = 'hidden'; }")
        # 草のゆれ・水の動きで 絵が変わらないよう、時計を止めてから くらべる
        await s.ev(f"() => {{ Object.defineProperty({K}.R, 'time', {{ get: () => 100, set: () => {{}}, configurable: true }}); {K}.CULL.on = true; {K}.CULL.key = ''; }}"); await s.wait(500); await s.shot('cull_a_' + name)
        await s.ev(f"() => {{ {K}.CULL.on = false; }}"); await s.wait(500); await s.shot('cull_b_' + name)
        await s.ev(f"() => {{ Object.defineProperty({K}.R, 'time', {{ value: 100, writable: true, configurable: true }}); {K}.CULL.on = true; {K}.CULL.key = ''; document.getElementById('menu').style.visibility = ''; {K}.game.resume(true); }}")
        a = Image.open('/tmp/kk/cull_a_%s.png' % name).convert('RGB'); b = Image.open('/tmp/kk/cull_b_%s.png' % name).convert('RGB')
        d = ImageChops.difference(a, b).convert('L'); bad = sum(1 for v in d.getdata() if v > 40)
        check(name + '：はぶいても 絵が変わらない', bad < 200, '%d 画素' % bad)
    return pct
async def main():
    s = await Sess().start(1280, 720)
    await s.ev(f"() => {{ const st = {K}.settings; st.viewDist = 8; st.music = 0; st.autoQ = false; st.showInfo = false; st.minimap = false; st.handShow = false; st.clouds = false; {K}.R.clouds = false; }}")
    await s.new_world('31415', mode=1, diff=0)
    await s.ev(f"() => {{ {K}.world.time = 6000; {K}.game.rules.day = true; }}")
    res = {}
    res['地上'] = await spot(s, 'chijo')
    await s.ev(f"() => {{ const p = {K}.player; p.y += 45; p.pitch = -0.7; }}")
    res['空から'] = await spot(s, 'sora')
    # 地下：かべにかこまれた小部屋
    await s.ev(f"() => {{ const k = {K}, w = k.world, p = k.player, x = Math.floor(p.x), z = Math.floor(p.z); for (let dy = 0; dy < 3; dy++) for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) w.setBlock(x + dx, 20 + dy, z + dz, 0, 0); w.setBlock(x, 20, z, k.B.torch, 0); p.y = 20.2; p.x = x + 0.5; p.z = z + 0.5; p.pitch = 0; }}")
    res['地下の小部屋'] = await spot(s, 'heya')
    # 洞くつ：近くの地下で いちばん広い空間を探す
    r = await s.ev(f"""() => {{ const k = {K}, w = k.world, p = k.player; let best = null, bn = 0; const x0 = Math.floor(p.x), z0 = Math.floor(p.z);
      for (let dz = -60; dz <= 60; dz += 3) for (let dx = -60; dx <= 60; dx += 3) for (let y = 12; y < 44; y += 3) {{ if (w.getBlock(x0 + dx, y, z0 + dz)) continue; let n = 0; for (let a = -3; a <= 3; a++) for (let b = -3; b <= 3; b++) for (let c = -1; c <= 2; c++) if (!w.getBlock(x0 + dx + a, y + c, z0 + dz + b)) n++; if (n > bn) {{ bn = n; best = [x0 + dx, y, z0 + dz]; }} }}
      if (best) {{ p.x = best[0] + 0.5; p.y = best[1]; p.z = best[2] + 0.5; }} return [best, bn]; }}""")
    if r[0]: res['洞くつ'] = await spot(s, 'dokutsu')
    # ホムラの底・ソラのはて
    await s.ev(f"() => {{ {K}.game.travel(1, 'gate'); }}")
    await s.pg.wait_for_function(f"{K}.world.dim === 1 && {K}.game.state === 'playing'", timeout=120000)
    res['ホムラの底'] = await spot(s, 'homura')
    await s.ev(f"() => {{ {K}.game.travel(2, 'sora'); }}")
    await s.pg.wait_for_function(f"{K}.world.dim === 2 && {K}.game.state === 'playing'", timeout=120000)
    await s.ev(f"() => {{ for (const e of {K}.ents) e.dead = true; {K}.game.soraDone = true; }}")
    res['ソラのはて'] = await spot(s, 'hate', shot=False)
    # ブロックをこわして かべに穴をあけると、向こうが見えるようになる
    await s.ev(f"() => {{ {K}.game.travel(0, 'home'); }}")
    await s.pg.wait_for_function(f"{K}.world.dim === 0 && {K}.game.state === 'playing'", timeout=120000)
    await s.ev(f"() => {{ const k = {K}, w = k.world, p = k.player, x = Math.floor(p.x), z = Math.floor(p.z); for (let dy = 0; dy < 3; dy++) for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) w.setBlock(x + dx, 6 + dy, z + dz, 0, 0); p.y = 6.2; p.x = x + 0.5; p.z = z + 0.5; }}")
    await settle(s)
    a = await s.pg.evaluate(PROBE, 500)
    await s.ev(f"() => {{ const k = {K}, w = k.world, p = k.player, x = Math.floor(p.x), z = Math.floor(p.z); for (let y = 9; y < 120; y++) w.setBlock(x, y, z, 0, 0); }}")
    await settle(s)
    b = await s.pg.evaluate(PROBE, 3000)
    check('たて穴をほると、地上が見えるようになる', a['vis'] < b['vis'] and b['miss'] == 0, [a['vis'], b['vis'], b['miss']])
    print('  へった割合（面の点）：', res)
    errs = [l for l in s.logs if 'PAGEERROR' in l or l.startswith('error')]
    check('エラーなし', len(errs) == 0, errs[:6])
    await s.close()
    print('ALL OK' if ok_all else 'SOME NG')
asyncio.run(main())
