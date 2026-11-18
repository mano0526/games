# バイオームめぐり：それぞれのバイオームの場所へ飛んで 写真をとる（見た目の確認用）
#   python3 test/biome_tour.py [種] [バイオーム番号,…]
import asyncio, json, sys, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from lib import Sess
K = "window.__kk"
async def main():
    seed = sys.argv[1] if len(sys.argv) > 1 else '777'
    only = [int(v) for v in sys.argv[2].split(',')] if len(sys.argv) > 2 and sys.argv[2] != '-' else None
    ground = len(sys.argv) > 3   # 3つ目の引数があれば 地面に立って見る
    s = await Sess().start(960, 600)
    await s.ev(f"() => {{ const st = {K}.settings; st.viewDist = 7; st.quality = 1; st.clouds = true; st.showInfo = true; }}")
    await s.new_world(seed, mode=1, diff=0)
    await s.wait(500)
    # 近くにある それぞれのバイオームの「まん中あたり」を探す
    spots = await s.ev(f"""() => {{
      const k = {K}, g = k.world.gen, out = {{}}, best = {{}};
      for (let r = 0; r < 1700; r += 24) for (let a = 0; a < Math.max(1, r / 5); a++) {{
        const an = a / Math.max(1, r / 5) * 6.2832, x = Math.round(Math.cos(an) * r), z = Math.round(Math.sin(an) * r);
        const h = g.column(x, z), b = g.colB;
        if (out[b]) continue;
        let same = 0; for (const [dx, dz] of [[20, 0], [-20, 0], [0, 20], [0, -20], [14, 14], [-14, -14], [14, -14], [-14, 14]]) {{ g.column(x + dx, z + dz); if (g.colB === b) same++; }}
        if (same >= 7 || (same >= 4 && !best[b])) {{ best[b] = [x, h, z]; if (same >= 7) out[b] = [x, h, z]; }}
      }}
      for (const b in best) if (!out[b]) out[b] = best[b];
      return out;
    }}""")
    names = await s.ev("() => { const n = []; for (let i = 0; i < 25; i++) n.push(i); return n; }")
    print('found', len(spots), 'biomes:', sorted(int(b) for b in spots))
    for b in sorted(spots, key=lambda v: int(v)):
        if only and int(b) not in only: continue
        x, h, z = spots[b]
        await s.ev(f"() => {{ const k = {K}, p = k.player; p.flying = true; p.x = {x} + 0.5; p.z = {z} + 0.5 + 14; p.y = {max(h, 48)} + 13; p.vx = p.vy = p.vz = 0; p.yaw = 0; p.pitch = -0.5; k.world.time = 5000; }}")
        # まわりのチャンクが そろうまで待つ
        for i in range(60):
            await s.wait(500)
            st = await s.ev(f"() => {{ const k = {K}, w = k.world, p = k.player; let n = 0, m = 0; const cx = Math.floor(p.x) >> 4, cz = Math.floor(p.z) >> 4; for (let dz = -5; dz <= 5; dz++) for (let dx = -5; dx <= 5; dx++) {{ const c = w.getChunk(cx + dx, cz + dz); n++; if (c && c.stage >= 2 && !c.dirtyMesh) m++; }} p.flying = true; p.vy = 0; p.y = {max(h, 48)} + 13; return [n, m]; }}")
            if st[1] >= st[0] - 2: break
        if ground:
            await s.ev(f"() => {{ const k = {K}, p = k.player; p.flying = false; p.x = {x} + 0.5; p.z = {z} + 0.5; p.y = {max(h, 48)} + 30; k.game.placeSafe(1); p.pitch = -0.08; p.yaw = 0.6; }}")
            await s.wait(1500)
        await s.wait(700)
        info = await s.ev(f"() => document.getElementById('info') ? document.getElementById('info').textContent : ''")
        await s.pg.screenshot(path=f'/tmp/kk/bio/{"g" if ground else "b"}{int(b):02d}.png')
        print(b, spots[b], st, info.replace('\\n', ' | ')[:80])
    errs = [l for l in s.logs if 'PAGEERROR' in l or l.startswith('error')]
    print('errors', len(errs)); [print('  ', e[:300]) for e in errs[:10]]
    await s.close()
asyncio.run(main())
