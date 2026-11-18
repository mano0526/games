# 乗り物（ボート・ウマ・トロッコとレール）と ソラの羽（1人用）
import asyncio, json, sys, os, math
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
    await s.new_world('7373', mode=0, diff=0)
    await s.wait(1000)
    # 台（石）と 池（西がわ）
    await s.ev(f"""() => {{ const k = {K}, w = k.world, B = k.B, p = k.player; const ox = Math.floor(p.x), oz = Math.floor(p.z), Y = Math.floor(p.y) + 14; window.__o = [ox, Y, oz];
      for (let z = -16; z <= 16; z++) for (let x = -22; x <= 22; x++) {{ w.setBlock(ox + x, Y - 2, oz + z, B.stone, 0); w.setBlock(ox + x, Y - 1, oz + z, (x <= -4 && x >= -20 && Math.abs(z) <= 6) ? B.water : B.grass, 0); for (let y = Y; y < Y + 8; y++) w.setBlock(ox + x, y, oz + z, 0, 0); }}
      for (const e of k.ents) e.dead = true; p.x = ox - 2.5; p.y = Y + 0.01; p.z = oz + 0.5; p.yaw = Math.PI / 2; p.pitch = -0.55; p.hp = 20; p.food = 20; w.time = 6000; k.game.rules.day = true;
      for (let i = 0; i < 36; i++) p.inv[i] = null; p.inv[0] = {{ id: k.I.boat, n: 1, d: 0 }}; p.sel = 0; }}""")
    await s.wait(700)
    # 1. ボート
    r = await s.ev(f"() => {{ const k = {K}, p = k.player; p.targetMob = null; const u = p.use(k.world); return [u, k.ents.filter(e => e.type === 'boat').length, p.inv[0]]; }}")
    check('ボートを 水に うかべる', r[0] and r[1] == 1 and r[2] is None, r)
    await s.wait(1200)
    r = await s.ev(f"() => {{ const k = {K}, p = k.player, o = window.__o, e = k.ents.find(e => e.type === 'boat'); const a = [Math.round((e.y - o[1]) * 100) / 100, k.mobUse(e, null)]; p.useOnMob(e, 'ride', null); return a.concat([p.ride && p.ride.t, k.ents.filter(e => e.type === 'boat' && !e.dead).length]); }}")
    check('ボートは 水面に うく・「使う」で 乗る', -0.4 < r[0] < 0.2 and r[1] == 'ride' and r[2] == 'boat', r)
    await s.wait(900)
    p0 = await s.ev(f"() => {{ const p = {K}.player, o = window.__o; return [p.x - o[0], p.y - o[1], p.z - o[2], {K}.ents.filter(e => e.type === 'boat' && !e.dead).length]; }}")
    await s.pg.keyboard.down('KeyW'); await s.wait(1600); 
    await s.ev(f"() => {{ {K}.settings.view = 1; {K}.R.dbgCam = 1.0; }}"); await s.wait(120); await s.shot('ride_boat'); await s.ev(f"() => {{ {K}.R.dbgCam = 0; }}")
    await s.pg.keyboard.up('KeyW'); await s.wait(300)
    p1 = await s.ev(f"() => {{ const p = {K}.player, o = window.__o; return [p.x - o[0], p.y - o[1], p.z - o[2], {K}.rideCode(p)]; }}")
    check('ボートで 進む（水面の高さのまま・速い）', p0[3] == 0 and p0[0] - p1[0] > 5 and -0.35 < p1[1] < 0.1 and p1[3] == 1, (p0, p1))
    await s.pg.keyboard.down('ShiftLeft'); await s.wait(350); await s.pg.keyboard.up('ShiftLeft'); await s.wait(600)
    r = await s.ev(f"() => {{ const k = {K}, p = k.player; return [p.ride, k.ents.filter(e => e.type === 'boat' && !e.dead).length, !!k.game.ach.boat]; }}")
    check('しゃがむ で おりる（ボートは その場に のこる）', r[0] is None and r[1] == 1 and r[2], r)
    r = await s.ev(f"() => {{ const k = {K}, e = k.ents.find(e => e.type === 'boat'); e.pk = 1; k.hurtMob(e, 5, e.x + 1, e.z, 0); return e.hp; }}")
    await s.wait(1500)
    r = await s.ev(f"() => {{ const k = {K}; return [k.ents.filter(e => e.type === 'boat' && !e.dead).length, k.ents.filter(e => e.kind === 'item' && e.id === k.I.boat).length + k.player.countSpec(k.I.boat), k.ents.filter(e => e.kind === 'item' && e.id === k.I.xp_orb).length]; }}")
    check('たたくと ボートの持ち物に もどる（経験値は出ない）', r[0] == 0 and r[1] == 1 and r[2] == 0, r)
    # 2. ウマ
    r = await s.ev(f"""() => {{ const k = {K}, p = k.player, o = window.__o; p.x = o[0] + 4.5; p.y = o[1] + 0.01; p.z = o[2] - 8.5; p.vx = p.vy = p.vz = 0; p.yaw = -Math.PI / 2; p.pitch = 0;
      const e = k.spawnMob('horse', o[0] + 6.5, o[1], o[2] - 8.5); e.tameN = 9; window.__h = e;
      const a = [k.mobUse(e, null), k.mobUse(e, {{ id: k.I.saddle, n: 1, d: 0 }}), k.mobUse(e, {{ id: k.I.apple, n: 1, d: 0 }}), e.color >= 1];
      p.useOnMob(e, 'ride', null); p.ride.wild = 0.4; return a.concat([p.ride.t, !!p.ride.tm, p.h]); }}""")
    check('ウマに 乗る（まだ なついていない）', r[0] == 'ride' and r[1] == 'ride' and r[2] == 'wait' and r[3] and r[4] == 'horse' and not r[5] and r[6] > 2, r)
    await s.wait(1200)
    r = await s.ev(f"() => {{ const k = {K}, p = k.player; return [p.ride && p.ride.tm, !!k.game.ach.horse, p.ride && p.ride.n]; }}")
    check('乗りきると なつく', bool(r[0]) and r[1], r)
    await s.pg.keyboard.down('ShiftLeft'); await s.wait(350); await s.pg.keyboard.up('ShiftLeft'); await s.wait(500)
    r = await s.ev(f"""() => {{ const k = {K}, p = k.player, e = k.ents.filter(e => e.type === 'horse' && !e.dead).sort((a, b) => Math.hypot(a.x - k.player.x, a.z - k.player.z) - Math.hypot(b.x - k.player.x, b.z - k.player.z))[0]; p.inv[0] = {{ id: k.I.saddle, n: 1, d: 0 }}; p.sel = 0;
      const a = [!!e.tamer, k.mobUse(e, p.inv[0])]; p.useOnMob(e, 'saddle', p.inv[0]); a.push(e.saddle, p.inv[0]); p.useOnMob(e, k.mobUse(e, null), null); a.push(p.ride && p.ride.s, p.ride && p.ride.wild);
      const o = window.__o; p.x = o[0] - 18.5; p.z = o[2] + 11.5; p.y = o[1] + 0.01; p.yaw = -Math.PI / 2; return a; }}""")
    check('おりても なついたまま・くらを つける・また乗る', r[0] and r[1] == 'saddle' and r[2] and r[3] is None and r[4] == 1 and not r[5], r)
    await s.wait(400)
    p0 = await s.ev(f"() => {{ const p = {K}.player, o = window.__o; return [p.x - o[0], p.y - o[1]]; }}")
    await s.pg.keyboard.down('KeyW'); await s.wait(1500)
    await s.ev(f"() => {{ {K}.settings.view = 1; {K}.R.dbgCam = 1.1; }}"); await s.wait(120); await s.shot('ride_horse'); await s.ev(f"() => {{ {K}.R.dbgCam = 0; }}")
    await s.pg.keyboard.up('KeyW'); await s.wait(700)
    p1 = await s.ev(f"() => {{ const p = {K}.player, o = window.__o; return [p.x - o[0], p.y - o[1]]; }}")
    await s.ev(f"() => {{ window.__my = 0; window.__iv = setInterval(() => {{ window.__my = Math.max(window.__my, {K}.player.y - window.__o[1]); }}, 16); }}")
    await s.pg.keyboard.down('Space'); await s.wait(250); await s.pg.keyboard.up('Space'); await s.wait(1500)
    my = await s.ev("() => { clearInterval(window.__iv); return window.__my; }")
    check('くらつきのウマは 速く走れて 高く とべる', p1[0] - p0[0] > 8 and my > 1.5, (p0, p1, my))
    r = await s.ev(f"() => {{ const k = {K}, p = k.player; const q = JSON.parse(JSON.stringify(p.serialize())); const keep = p.ride; p.load(q); const a = [p.ride && p.ride.t, p.ride && p.ride.s, p.ride && p.ride.tm === keep.tm, p.h]; return a; }}")
    check('乗ったまま セーブして 読みなおせる', r[0] == 'horse' and r[1] == 1 and r[2] and r[3] > 2, r)
    await s.pg.keyboard.down('ShiftLeft'); await s.wait(350); await s.pg.keyboard.up('ShiftLeft'); await s.wait(500)
    r = await s.ev(f"() => {{ const k = {K}, e = k.ents.filter(e => e.type === 'horse' && !e.dead).sort((a, b) => Math.hypot(a.x - k.player.x, a.z - k.player.z) - Math.hypot(b.x - k.player.x, b.z - k.player.z))[0], x = k.mobEx(e); return [k.player.ride, k.player.h, e && e.saddle, x && x.sd, x && x.c >= 1, !!(x && x.o)]; }}")
    check('おりると ウマは くらを つけたまま のこる', r[0] is None and r[1] == 1.8 and r[2] and r[3] == 1 and r[4] and r[5], r)
    # 3. レールと トロッコ
    r = await s.ev(f"""() => {{ const k = {K}, w = k.world, B = k.B, o = window.__o, Y = o[1]; for (const e of k.ents) if (e.kind === 'mob') e.dead = true;
      const put = (x, y, z, id) => {{ w.setBlock(o[0] + x, y, o[2] + z, id || B.rail, 1); w.railFix(o[0] + x, y, o[2] + z, 1); }};
      for (let x = 2; x <= 12; x++) put(x, Y, 8); for (let z = 9; z <= 12; z++) put(12, Y, z);
      w.setBlock(o[0] + 12, Y, o[2] + 13, B.stone, 0); w.setBlock(o[0] + 12, Y, o[2] + 14, B.stone, 0); put(12, Y + 1, 13); put(12, Y + 1, 14);
      const m = (x, y, z) => w.getMeta(o[0] + x, y, o[2] + z);
      return [m(2, Y, 8), m(7, Y, 8), m(12, Y, 8), m(12, Y, 10), m(12, Y, 12), m(12, Y + 1, 13), k.matchGrid && 1]; }}""")
    check('レールが 自動で つながる（まっすぐ・まがり・坂）', r[:6] == [1, 1, 6, 0, 2, 0], r)
    r = await s.ev(f"""() => {{ const k = {K}, p = k.player, w = k.world, o = window.__o, Y = o[1]; p.x = o[0] + 3.5; p.y = Y + 0.01; p.z = o[2] + 6.5; p.yaw = -Math.PI / 2; p.pitch = 0;
      p.inv[0] = {{ id: k.I.cart, n: 1, d: 0 }}; p.sel = 0; p.targetMob = null; p.target = {{ x: o[0] + 3, y: Y, z: o[2] + 8, nx: 0, ny: 1, nz: 0, id: k.B.rail, meta: 1, t: 2 }};
      const u = p.use(w), e = k.ents.find(e => e.type === 'cart'); if (!e) return [u]; p.useOnMob(e, k.mobUse(e, null), null); return [u, p.ride && p.ride.t, p.x - o[0], p.z - o[2]]; }}""")
    check('トロッコを レールに置いて 乗る', r[0] and r[1] == 'cart', r)
    await s.pg.keyboard.down('KeyW'); await s.wait(2200)
    await s.ev(f"() => {{ {K}.settings.view = 1; {K}.R.dbgCam = 1.0; }}"); await s.wait(120); await s.shot('ride_cart'); await s.ev(f"() => {{ {K}.R.dbgCam = 0; }}")
    q1 = await s.ev(f"() => {{ const p = {K}.player, o = window.__o; return [p.x - o[0], p.y - o[1], p.z - o[2], p.ride.rv]; }}")
    await s.wait(3500); await s.pg.keyboard.up('KeyW')
    q2 = await s.ev(f"() => {{ const p = {K}.player, o = window.__o; return [p.x - o[0], p.y - o[1], p.z - o[2], p.ride.rv]; }}")
    check('トロッコが レールに そって 進み、まがる', q1[0] > 6 and abs(q1[1]) < 0.05 and q2[2] > 9.5 and abs(q2[0] - 12.5) < 0.1, (q1, q2))
    r = await s.ev(f"""() => {{ const k = {K}, p = k.player, w = k.world, B = k.B, o = window.__o, Y = o[1]; for (let x = 2; x <= 11; x++) w.setBlock(o[0] + x, Y, o[2] + 8, B.rail_fast, 1);
      p.x = o[0] + 2.5; p.z = o[2] + 8.5; p.y = Y; p.vx = p.vz = 0; p.ride.rv = 0; p.yaw = -Math.PI / 2; return 1; }}""")
    await s.pg.keyboard.down('KeyW'); await s.wait(900); await s.pg.keyboard.up('KeyW')
    q3 = await s.ev(f"() => {{ const p = {K}.player, o = window.__o; return [p.x - o[0], p.ride.rv, !!{K}.game.ach.cart]; }}")
    check('はやレールで 速くなる', q3[1] > 7 and q3[2], q3)
    await s.pg.keyboard.down('ShiftLeft'); await s.wait(350); await s.pg.keyboard.up('ShiftLeft'); await s.wait(400)
    # 4. ソラの羽
    r = await s.ev(f"""() => {{ const k = {K}, p = k.player, o = window.__o; p.armor[1] = {{ id: k.I.glider, n: 1, d: 0 }}; p.x = o[0] + 0.5; p.z = o[2] + 0.5; p.y = o[1] + 60; p.vx = p.vy = p.vz = 0; p.yaw = 0; p.pitch = -0.25; p.hp = 20; p.fallDist = 0;
      return [k.rideCode(p), p.ride]; }}""")
    await s.wait(500)
    await s.pg.keyboard.down('Space'); await s.wait(120); await s.pg.keyboard.up('Space'); await s.wait(1800)
    await s.ev(f"() => {{ {K}.R.dbgCam = 1.2; }}"); await s.wait(120); await s.shot('ride_glide'); await s.ev(f"() => {{ {K}.R.dbgCam = 0; }}")
    g = await s.ev(f"() => {{ const p = {K}.player, o = window.__o; return [p.gliding, Math.round(p.vy * 10) / 10, Math.round(Math.hypot(p.vx, p.vz) * 10) / 10, p.y - o[1], !!{K}.game.ach.glide, {K}.rideCode(p)]; }}")
    check('空中で ジャンプすると 滑空する（ゆっくり落ちて 前へ進む）', r[0] == 64 and g[0] and g[1] > -9 and g[2] > 7 and g[5] == 64, (r, g))
    await s.ev(f"() => {{ const p = {K}.player; p.pitch = -0.9; }}")
    for _ in range(40):
        if not await s.ev(f"() => {K}.player.gliding"): break
        await s.wait(300)
    g = await s.ev(f"() => {{ const p = {K}.player; return [p.gliding, p.hp, p.onGround || p.inWater, p.armor[1] && {K}.itemDmg(p.armor[1].d)]; }}")
    check('着地すると 滑空が おわる・羽が 少し すりへる', (not g[0]) and g[2] and g[3] >= 1, g)
    r = await s.ev(f"""() => {{ const k = {K}, B = k.B, I = k.I, P = B.planks_oak, g = (ids, w) => {{ const r = k.matchGrid(ids.map(id => id ? {{ id, n: 1, d: 0 }} : null), w); return r ? [k.ITEMS[r.out].name, r.n] : null; }};
      const Fe = I.iron_ingot, S = I.stick, W = B.wool_white, T = I.string, F = I.star_feather;
      return [g([P, 0, P, P, P, P, 0, 0, 0], 3), g([Fe, 0, Fe, Fe, Fe, Fe, 0, 0, 0], 3), g([Fe, 0, Fe, Fe, S, Fe, Fe, 0, Fe], 3), g([W, W, W, T, 0, T, Fe, 0, Fe], 3), g([F, T, F, F, F, F, F, 0, F], 3)]; }}""")
    check('レシピ（ボート・トロッコ・レール・くら・ソラの羽）', r == [['ボート', 1], ['トロッコ', 1], ['レール', 16], ['くら', 1], ['ソラの羽', 1]], r)
    s.dump(8)
    print('結果:', 'ぜんぶOK' if ok_all else 'NGあり')
    await s.close()
    sys.exit(0 if ok_all else 1)
asyncio.run(main())
