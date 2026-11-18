# 天気（雨・雪・かみなり）：種と時計で決まる・空が暗くなる・屋根の下・畑がぬれる・火が消える・敵が昼に もえない・雪が つもる
import asyncio, json, sys, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from lib import Sess
K = "window.__kk"
ok_all = True
def check(name, cond, extra=''):
    global ok_all
    print(('OK  ' if cond else 'NG  ') + name, extra)
    if not cond: ok_all = False
async def main():
    s = await Sess().start(1280, 720)
    await s.ev(f"() => {{ const st = {K}.settings; st.viewDist = 4; st.music = 0; st.showInfo = false; st.minimap = false; }}")
    await s.new_world('2468', mode=0, diff=2)
    await s.wait(1000)
    r = await s.ev(f"""() => {{ const k = {K}, w = k.world; const n = [0, 0, 0]; let same = true;
      for (let i = 0; i < 4000; i++) {{ const a = k.weatherAt(w.seed, i); n[a]++; if (a !== k.weatherAt(w.seed, i)) same = false; }}
      return [n, same, [0, 1, 2].map(i => k.weatherAt(w.seed, i)), k.WX.kind, w.wx | 0]; }}""")
    frac = (r[0][1] + r[0][2]) / 4000
    check('天気は 種とこまで決まる（晴れが多い・雨は ときどき・かみなりは まれ・最初は晴れ）', 0.08 < frac < 0.32 and 0 < r[0][2] < r[0][1] and r[1] and r[2] == [0, 0, 0] and r[3] == 0 and r[4] == 0, (r, round(frac, 3)))
    await s.ev(f"""() => {{ const k = {K}, w = k.world, B = k.B, p = k.player; const ox = Math.floor(p.x), oz = Math.floor(p.z), Y = Math.floor(p.y) + 12; window.__o = [ox, Y, oz];
      for (let z = -8; z <= 8; z++) for (let x = -8; x <= 8; x++) {{ w.setBlock(ox + x, Y - 1, oz + z, B.grass, 0); for (let y = Y; y < Y + 6; y++) w.setBlock(ox + x, y, oz + z, 0, 0); }}
      for (let z = -2; z <= 2; z++) for (let x = 3; x <= 7; x++) w.setBlock(ox + x, Y + 3, oz + z, B.planks_oak, 0);
      w.setBlock(ox - 3, Y - 1, oz, B.farmland, 0); w.setBlock(ox + 5, Y - 1, oz, B.farmland, 0);
      for (const e of k.ents) e.dead = true; p.x = ox + 0.5; p.y = Y + 0.01; p.z = oz + 4.5; p.yaw = 0; p.pitch = 0.15; w.time = 6000; k.game.rules.day = true; }}""")
    await s.wait(1200)
    sky0 = await s.ev(f"() => {{ const k = {K}; return [k.R.sky.light.slice(), k.R.sky.zen.slice(), k.R.fogStart, k.R.wx || 0]; }}")
    await s.shot('wx_clear')
    await s.ev(f"() => {{ {K}.WX.force = 1; }}")
    for _ in range(40):
        if await s.ev(f"() => {K}.WX.amt") > 0.9: break
        await s.wait(500)
    await s.wait(600)
    sky1 = await s.ev(f"() => {{ const k = {K}; return [k.R.sky.light.slice(), k.R.sky.zen.slice(), k.R.fogStart, k.R.wx || 0, k.WX.kind, k.world.wx]; }}")
    check('雨：空が 灰色になって 少し暗く、遠くが かすむ', sky1[3] > 0.9 and sky1[4] == 1 and sky1[5] == 1 and sky1[0][0] < sky0[0][0] * 0.85 and sky1[1][2] < sky0[1][2] * 0.8 and sky1[2] < sky0[2] * 0.7, (sky0, sky1))
    await s.shot('wx_rain')
    r = await s.ev(f"() => {{ const k = {K}; return [k.WX.open(k.world, k.player.x, k.player.y, k.player.z), k.WX.open(k.world, window.__o[0] + 5.5, window.__o[1], window.__o[2] + 0.5), Array.from(k.WX.H).filter(h => h >= 0).length > 100]; }}")
    check('屋根の下かどうかを 見分ける', r[0] is True and r[1] is False and r[2], r)
    r = await s.ev(f"""() => {{ const k = {K}, w = k.world, B = k.B, p = k.player, o = window.__o;
      for (let i = 0; i < 30; i++) for (const x of [-3, 5]) if (w.getBlock(o[0] + x, o[1] - 1, o[2]) === B.farmland) w.randomTick(o[0] + x, o[1] - 1, o[2], B.farmland, w.getMeta(o[0] + x, o[1] - 1, o[2]));
      p.burnT = 200; window.__e = k.spawnMob('shade', o[0] + 0.5, o[1], o[2] - 4.5);
      return [-3, 5].map(x => w.getBlock(o[0] + x, o[1] - 1, o[2]) === B.farmland ? w.getMeta(o[0] + x, o[1] - 1, o[2]) : -1); }}""")
    await s.wait(2500)
    r2 = await s.ev(f"() => {{ const k = {K}, e = window.__e; return [k.player.burnT, e.hp, e.dead]; }}")
    check('雨で 畑が ぬれる（屋根の下は かわいたまま）', r[0] == 1 and r[1] != 1, r)
    check('雨で 自分の火が消える・ヨルカゲは 雨の昼は もえない', r2[0] == 0 and r2[1] == 20 and not r2[2], r2)
    await s.ev(f"() => {{ const k = {K}; window.__e.dead = true; k.WX.force = 2; k.WX.nextBolt = 5; }}")
    f = 0
    for _ in range(60):
        f = max(f, await s.ev(f"() => {K}.WX.flash"))
        if f > 0.3: break
        await s.wait(100)
    r = await s.ev(f"() => {{ const k = {K}; return [k.WX.kind, k.WX.storm > 0.02]; }}")
    check('かみなり：ときどき 光る', f > 0.3 and r[0] == 2 and r[1], (f, r))
    await s.ev(f"() => {{ const k = {K}; k.WX.strike(k.world); }}"); await s.wait(30); await s.shot('wx_storm')
    await s.ev(f"() => {{ {K}.WX.force = 0; }}")
    for _ in range(60):
        if await s.ev(f"() => {K}.WX.amt") < 0.03: break
        await s.wait(500)
    sky2 = await s.ev(f"() => {{ const k = {K}; return [k.R.sky.light.slice(), k.R.wx || 0, k.world.wx | 0]; }}")
    check('晴れに もどる', sky2[1] < 0.05 and sky2[2] == 0 and abs(sky2[0][0] - sky0[0][0]) < 0.06, sky2)
    r = await s.ev(f"""() => {{ const k = {K}, w = k.world, B = k.B, o = window.__o; k.WX.force = 1; w.wx = 1;
      const c = w.getChunk(o[0] >> 4, o[2] >> 4); const keep = c.biome.slice(); c.biome.fill(k.BIOME.SNOW);
      const cnt = () => {{ let n = 0; for (let z = 0; z < 16; z++) for (let x = 0; x < 16; x++) {{ const X = c.cx * 16 + x, Z = c.cz * 16 + z, sy = w.surfaceY(X, Z); if (w.getBlock(X, sy + 1, Z) === B.snow_layer) n++; }} return n; }};
      const n0 = cnt(); for (let i = 0; i < 500; i++) w.randomTicks(c.cx, c.cz); const n1 = cnt(); c.biome.set(keep); return [n0, n1]; }}""")
    check('雪：寒い所では 少しずつ つもる', r[1] > r[0] + 20, r)
    # 雪の見た目（寒い所のふりをして 撮る）
    await s.ev(f"() => {{ const k = {K}; k.world.biomeAt = () => k.BIOME.SNOW; k.WX.hx = 1e9; }}")
    for _ in range(30):
        if await s.ev(f"() => {K}.WX.amt") > 0.9: break
        await s.wait(500)
    await s.shot('wx_snow')
    await s.ev(f"() => {{ {K}.WX.force = null; }}")
    s.dump(8)
    print('結果:', 'ぜんぶOK' if ok_all else 'NGあり')
    await s.close()
    sys.exit(0 if ok_all else 1)
asyncio.run(main())
