# 畑の作物（ニンジン・ジャガイモ・カボチャ・スイカ）と、動物を飼う・ふやす・イヌ（1人用）
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
    await s.new_world('8642', mode=0, diff=0)
    await s.wait(1200)
    # 平らな台を作る
    await s.ev(f"""() => {{ const k = {K}, w = k.world, B = k.B, p = k.player; const ox = Math.floor(p.x), oz = Math.floor(p.z), Y = Math.floor(p.y) + 12; window.__o = [ox, Y, oz];
      for (let z = -9; z <= 9; z++) for (let x = -9; x <= 9; x++) {{ w.setBlock(ox + x, Y - 1, oz + z, B.grass, 0); for (let y = Y; y < Y + 6; y++) w.setBlock(ox + x, y, oz + z, 0, 0); if (Math.abs(x) === 9 || Math.abs(z) === 9) w.setBlock(ox + x, Y, oz + z, B.fence_oak, 0); }}
      for (const e of k.ents) e.dead = true; p.x = ox + 0.5; p.y = Y + 0.01; p.z = oz + 6.5; p.yaw = 0; p.pitch = -0.2; p.hp = 20; p.food = 20; w.time = 6000; k.game.rules.day = true; }}""")
    await s.wait(600)
    # 1. 作物：植える・育つ・とれる
    r = await s.ev(f"""() => {{ const k = {K}, w = k.world, B = k.B, I = k.I, p = k.player, o = window.__o;
      for (let i = 0; i < 4; i++) w.setBlock(o[0] - 6 + i, o[1] - 1, o[2] - 6, B.farmland, 1);
      const put = (i, item) => {{ p.inv[0] = {{ id: item, n: 1, d: 0 }}; p.sel = 0; const t = {{ x: o[0] - 6 + i, y: o[1] - 1, z: o[2] - 6, nx: 0, ny: 1, nz: 0, id: B.farmland, meta: 1, t: 2 }}; p.target = t; return p.use(w); }};
      const a = [put(0, I.carrot), put(1, I.potato), put(2, I.pumpkin_seeds), put(3, I.melon_seeds)];
      const ids = [0, 1, 2, 3].map(i => k.ITEMS[w.getBlock(o[0] - 6 + i, o[1], o[2] - 6)] ? 1 : k.BLOCKS[w.getBlock(o[0] - 6 + i, o[1], o[2] - 6)].key);
      for (let n = 0; n < 400; n++) for (let i = 0; i < 4; i++) {{ const x = o[0] - 6 + i, id = w.getBlock(x, o[1], o[2] - 6); if (id) w.randomTick(x, o[1], o[2] - 6, id, w.getMeta(x, o[1], o[2] - 6)); }}
      const metas = [0, 1, 2, 3].map(i => w.getMeta(o[0] - 6 + i, o[1], o[2] - 6));
      let fruit = []; for (let i = 2; i < 4; i++) for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {{ const id = w.getBlock(o[0] - 6 + i + dx, o[1], o[2] - 6 + dz); if (id === B.pumpkin || id === B.melon) fruit.push(k.BLOCKS[id].key); }}
      const rng = () => 0.5, d0 = k.blockDrops(B.carrot_crop, 3, null, rng), d1 = k.blockDrops(B.potato_crop, 0, null, rng), d2 = k.blockDrops(B.melon, 0, null, rng);
      return [a, ids, metas, fruit.sort(), d0, d1, d2]; }}""")
    check('作物を植える・育つ・実がなる・とれる', r[0] == [True] * 4 and r[1] == ['carrot_crop', 'potato_crop', 'pumpkin_stem', 'melon_stem'] and r[2] == [3, 3, 3, 3] and r[3] == ['melon', 'pumpkin'] and r[4] == [[346, 3]] and r[5] == [[347, 1]] and r[6][0][0] == 351, r)
    await s.ev(f"() => {{ const p = {K}.player, o = window.__o; p.x = o[0] - 4; p.z = o[2] - 2.5; p.yaw = 0.2; p.pitch = -0.5; }}"); await s.wait(900); await s.shot('farm_crops')
    # レシピ・かまど
    r = await s.ev(f"""() => {{ const k = {K}, B = k.B, I = k.I, g = (ids, w) => {{ const r = k.matchGrid(ids.map(id => id ? {{ id, n: 1, d: 0 }} : null), w); return r ? [k.ITEMS[r.out].name, r.n] : null; }};
      return [g([0, I.iron_ingot, I.iron_ingot, 0], 2), g([B.pumpkin, B.torch, 0, 0], 2), g([B.pumpkin, I.egg, I.wheat, 0], 2), g([I.melon_slice, 0, 0, 0], 2), g([B.pumpkin, 0, 0, 0], 2)]; }}""")
    check('レシピ（ハサミ・カボチャのランタン・パイ・種）', r == [['ハサミ', 1], ['カボチャのランタン', 1], ['パンプキンパイ', 1], ['スイカの種', 1], ['カボチャの種', 4]], r)
    # 2. 動物：好物でついてくる・ふやす・子どもが育つ
    await s.ev(f"""() => {{ const k = {K}, p = k.player, o = window.__o, I = k.I; p.x = o[0] + 0.5; p.z = o[2] + 2.5; p.yaw = 0; p.pitch = -0.15;
      window.__c = [k.spawnMob('cow', o[0] - 3.5, o[1], o[2] - 3.5), k.spawnMob('cow', o[0] + 3.5, o[1], o[2] - 3.5)]; p.inv[0] = {{ id: I.wheat, n: 8, d: 0 }}; p.sel = 0; }}""")
    for i in range(30):
        await s.wait(500)
        r = await s.ev(f"() => {{ const k = {K}, p = k.player; return window.__c.map(e => +Math.hypot(e.x - p.x, e.z - p.z).toFixed(1)); }}")
        if r[0] < 3.5 and r[1] < 3.5: break
    check('好物（小麦）を持っていると ウシがついてくる', r[0] < 4.5 and r[1] < 4.5, r)
    r = await s.ev(f"""() => {{ const k = {K}, p = k.player; const acts = window.__c.map(e => k.mobUse(e, p.held())); for (const e of window.__c) p.useOnMob(e, 'love', p.held()); return [acts, window.__c.map(e => e.love > 0), p.inv[0].n, k.mobUse(window.__c[0], p.held())]; }}""")
    check('えさをあげると その気になる（小麦が減る）', r == [['love', 'love'], [True, True], 6, 'wait'], r)
    await s.ev(f"() => {{ {K}.player.inv[0] = null; }}")
    for i in range(40):
        await s.wait(500)
        n = await s.ev(f"() => {{ const k = {K}; return [k.ents.filter(e => e.kind === 'mob' && e.type === 'cow' && e.baby > 0).map(e => +e.hw.toFixed(2)), window.__c.map(e => [e.love > 0, e.breedCd > 0])]; }}")
        if len(n[0]) == 1: break
    check('子どもが生まれる（親はしばらく休み）', n[0] == [0.25] and n[1] == [[False, True], [False, True]], n)
    await s.wait(500); await s.shot('farm_baby')
    r = await s.ev(f"""() => {{ const k = {K}, b = k.ents.find(e => e.type === 'cow' && e.baby > 0); const t0 = b.baby; k.applyMobUse(b, 'grow', 'me', 0); const t1 = b.baby; b.baby = 2; return [t0, t1 < t0, k.ach && 0, !!k.game.ach.breed]; }}""")
    await s.wait(600)
    r2 = await s.ev(f"() => {{ const k = {K}; return k.ents.filter(e => e.type === 'cow' && !e.dead).map(e => [e.baby > 0, +e.hw.toFixed(2)]); }}")
    check('えさで早く育つ・大人になる', r[1] and r[3] and len(r2) >= 3 and all((not x[0]) and x[1] == 0.45 for x in r2), [r, r2])
    # 3. ヒツジ：ハサミ・染料・毛がのびる。ウシ：ミルク。ニワトリ：たまご
    r = await s.ev(f"""() => {{ const k = {K}, p = k.player, o = window.__o, I = k.I, B = k.B; for (const e of k.ents) e.dead = true;
      const sh = k.spawnMob('sheep', o[0] + 1.5, o[1], o[2] + 3.5), cw = k.spawnMob('cow', o[0] - 1.5, o[1], o[2] + 3.5), ch = k.spawnMob('chicken', o[0] + 3.5, o[1], o[2] + 3.5); window.__a = [sh, cw, ch];
      p.inv[0] = {{ id: I.dye_cyan, n: 1, d: 0 }}; p.sel = 0; const a0 = k.mobUse(sh, p.held()); p.useOnMob(sh, a0, p.held()); const col = sh.color;
      p.inv[0] = {{ id: I.shears, n: 1, d: 0 }}; const a1 = k.mobUse(sh, p.held()); p.useOnMob(sh, a1, p.held()); const wool = k.ents.filter(e => e.kind === 'item').map(e => k.ITEMS[e.id].key); const a2 = k.mobUse(sh, p.held());
      p.inv[0] = {{ id: I.bucket, n: 1, d: 0 }}; const a3 = k.mobUse(cw, p.held()); p.useOnMob(cw, a3, p.held()); const milk = p.inv[0].id === I.milk_bucket;
      ch.eggT = 2; return [a0, col, a1, [...new Set(wool)], sh.sheared, a2, a3, milk]; }}""")
    await s.wait(700)
    r2 = await s.ev(f"() => {{ const k = {K}; return [k.ents.filter(e => e.kind === 'item' && e.id === k.I.egg).length, k.SMELT ? 1 : 0]; }}")
    check('染料で毛の色・ハサミで毛・バケツでミルク・たまご', r == ['dye', 9, 'shear', ['wool_cyan'], True, None, 'milk', True] and r2[0] == 1, [r, r2])
    await s.ev(f"() => {{ const p = {K}.player; p.inv[0] = null; p.yaw = 0; p.pitch = -0.25; }}"); await s.wait(500); await s.shot('farm_sheep')
    r = await s.ev(f"""() => {{ const k = {K}, sh = window.__a[0]; for (let i = 0; i < 4000 && sh.sheared; i++) {{ sh.age = 40 * (i + 1); sh.onGround = true; k.passiveLife(k.world, sh, k.MOBS.sheep); }} return [sh.sheared, k.world.getBlock(Math.floor(sh.x), Math.floor(sh.y - 0.5), Math.floor(sh.z)) === k.B.dirt]; }}""")
    check('草を食べると 毛がのびる', r == [False, True], r)
    # ミルクをのむ・ニンジンは畑に植えられる／畑でなければ食べる
    # 4. イヌ：肉でなつく・ついてくる・おすわり・敵にかみつく
    r = await s.ev(f"""() => {{ const k = {K}, p = k.player, o = window.__o, I = k.I; for (const e of k.ents) e.dead = true;
      const d = k.spawnMob('dog', o[0] + 2.5, o[1], o[2] + 2.5); window.__d = d; p.inv[0] = {{ id: I.raw_beef, n: 30, d: 0 }}; p.sel = 0;
      let tries = 0; while (!d.tamer && tries < 30) {{ p.useOnMob(d, k.mobUse(d, p.held()), p.held()); tries++; }}
      return [d.tamer, tries, p.inv[0].n, k.mobUse(d, p.held()), k.mobUse(d, null)]; }}""")
    check('肉をあげると イヌがなつく', r[0] == 'me' and r[1] >= 1 and r[2] == 30 - r[1] and r[3] == 'sit' and r[4] == 'sit', r)
    await s.ev(f"() => {{ const k = {K}, p = k.player, o = window.__o; p.inv[0] = null; p.x = o[0] - 6.5; p.z = o[2] - 6.5; }}")
    for i in range(30):
        await s.wait(500)
        r = await s.ev(f"() => {{ const k = {K}, p = k.player, d = window.__d; return +Math.hypot(d.x - p.x, d.z - p.z).toFixed(1); }}")
        if r < 3.5: break
    check('なついたイヌは ついてくる', r < 4.5, r)
    await s.ev(f"() => {{ const k = {K}, p = k.player, d = window.__d, o = window.__o; d.x = o[0] + 0.5; d.z = o[2] - 1.5; d.yaw = d.pyaw = Math.PI; d.sit = true; const w = k.spawnMob('dog', o[0] + 2.5, o[1], o[2] - 1.5); w.yaw = w.pyaw = Math.PI * 0.8; w.timer = 999; w.moving = false; window.__w = w; p.x = o[0] + 1.5; p.z = o[2] + 1.6; p.yaw = 0; p.pitch = -0.3; }}")
    await s.wait(500); await s.shot('farm_dog')
    await s.ev(f"() => {{ window.__d.sit = false; window.__w.dead = true; }}")
    r = await s.ev(f"() => {{ const k = {K}, p = k.player, o = window.__o, d = window.__d; p.useOnMob(d, k.mobUse(d, null), null); const sit = d.sit; p.x = o[0] + 6.5; p.z = o[2] + 6.5; return sit; }}")
    await s.wait(3000)
    r2 = await s.ev(f"() => {{ const k = {K}, p = k.player, d = window.__d; const far = +Math.hypot(d.x - p.x, d.z - p.z).toFixed(1); p.useOnMob(d, 'sit', null); return [far, d.sit]; }}")
    check('おすわり中は 動かない', r and r2[0] > 9 and r2[1] is False, [r, r2])
    await s.ev(f"() => {{ const k = {K}, p = k.player, o = window.__o; k.game.diff = 2; const z = k.spawnMob('shade', o[0] + 2.5, o[1], o[2] + 2.5); z.hp = 12; window.__z = z; p.mode = 1; }}")
    for i in range(30):
        await s.wait(500)
        z = await s.ev("() => [window.__z.hp, window.__z.dead]")
        if z[1] or z[0] <= 0: break
    check('イヌが 敵にかみつく', z[1] or z[0] < 12, z)
    # 5. セーブして読み直す：イヌ（飼い主・おすわり）と 子ども・毛の色が残る
    await s.ev(f"""() => {{ const k = {K}, o = window.__o, p = k.player; for (const e of k.ents) if (e.type !== 'dog') e.dead = true; p.mode = 0; k.game.diff = 0; window.__d.sit = true;
      const sh = k.spawnMob('sheep', o[0] - 2.5, o[1], o[2] + 1.5); sh.color = 14; sh.sheared = true; const b = k.spawnMob('pig', o[0] - 4.5, o[1], o[2] + 1.5); k.setBaby ? 0 : 0; b.baby = 5000; b.hw = 0.23; b.h = 0.5; }}""")
    wid = await s.ev(f"() => {K}.game.worldId")
    await s.ev(f"async () => {{ await {K}.game.save(); }}")
    await s.ev(f"() => {K}.game.quitToTitle()")
    await s.pg.wait_for_function(f'{K}.game.state === "title"', timeout=30000)
    await s.ev(f"() => {K}.game.loadWorld('{wid}')")
    await s.pg.wait_for_function(f'{K}.game.state === "playing"', timeout=90000)
    for i in range(20):
        await s.wait(500)
        r = await s.ev(f"() => {K}.ents.filter(e => e.kind === 'mob').map(e => [e.type, e.tamer, e.sit, e.color, e.sheared, e.baby > 0]).sort()")
        if len(r) >= 3 and any(x[1] == 'me' for x in r): break
    check('読み直しても 飼い主・おすわり・毛の色・子ども が残る', all(x in r for x in [['dog', 'me', True, 0, False, False], ['pig', None, False, 0, False, True], ['sheep', None, False, 14, True, False]]), r)
    errs = [l for l in s.logs if 'PAGEERROR' in l or l.startswith('error')]
    check('エラーなし', len(errs) == 0, errs[:6])
    await s.close()
    print('ALL OK' if ok_all else 'SOME NG')
asyncio.run(main())
