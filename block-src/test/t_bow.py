# 弓矢と盾、新しい敵（ユミカゲ・バクダケ・イトハキ）、はじけ箱（1人用）
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
    async def poll(js, cond, n=40, ms=300):
        r = None
        for _ in range(n):
            r = await s.ev(js)
            if cond(r): break
            await s.wait(ms)
        return r
    await s.ev(f"() => {{ const st = {K}.settings; st.viewDist = 4; st.music = 0; st.showInfo = false; st.minimap = false; }}")
    await s.new_world('9753', mode=0, diff=2)
    await s.wait(1200)
    # 平らな台（まわりは石のかべ。夜にする）
    FLOOR = f"""() => {{ const k = {K}, w = k.world, B = k.B, p = k.player; const o = window.__o || (window.__o = [Math.floor(p.x), Math.floor(p.y) + 14, Math.floor(p.z)]);
      for (let z = -12; z <= 12; z++) for (let x = -12; x <= 12; x++) {{ w.setBlock(o[0] + x, o[1] - 2, o[2] + z, B.stone, 0); w.setBlock(o[0] + x, o[1] - 1, o[2] + z, B.grass, 0); for (let y = o[1]; y < o[1] + 7; y++) w.setBlock(o[0] + x, y, o[2] + z, (Math.abs(x) === 12 || Math.abs(z) === 12) && y < o[1] + 3 ? B.stone : 0, 0); }}
      for (const e of k.ents) e.dead = true; p.x = o[0] + 0.5; p.y = o[1] + 0.01; p.z = o[2] + 8.5; p.vx = p.vy = p.vz = 0; p.yaw = 0; p.pitch = 0; p.hp = 20; p.food = 20; p.webT = 0; p.hurtT = 0; w.time = 18000; k.game.rules.day = false; k.touchSt.use = false; }}"""
    await s.ev(FLOOR); await s.wait(500)
    # 1. レシピ
    r = await s.ev(f"""() => {{ const k = {K}, B = k.B, I = k.I, g = (ids, w) => {{ const r = k.matchGrid(ids.map(id => id ? {{ id, n: 1, d: 0 }} : null), w); return r ? [k.ITEMS[r.out].name, r.n] : null; }};
      const S = I.stick, T = I.string, P = B.planks_oak, W = I.pop_powder, N = B.sand;
      return [g([0, S, T, S, 0, T, 0, S, T], 3), g([I.flint, 0, 0, S, 0, 0, I.feather, 0, 0], 3), g([P, I.iron_ingot, P, P, P, P, 0, P, 0], 3), g([W, N, W, N, W, N, W, N, W], 3), g([T, T, T, T], 2),
        Object.values(k.ITEMS).filter(d => d.hide).length, k.MOB_USED]; }}""")
    check('レシピ（弓・矢4本・盾・はじけ箱・糸→羊毛）', r[:5] == [['弓', 1], ['矢', 4], ['盾', 1], ['はじけ箱', 1], ['白い羊毛', 1]] and r[5] == 2, r)
    check('生き物の絵が 画像におさまっている', 0 < r[6] < 512, r[6])
    # 2. 弓：長くおして引き、はなすと飛ぶ。矢が1本へり、弓が すりへる
    await s.ev(f"() => {{ const k = {K}, p = k.player, I = k.I; p.inv.fill(null); p.inv[0] = {{ id: I.bow, n: 1, d: 0 }}; p.inv[1] = {{ id: I.arrow, n: 5, d: 0 }}; p.sel = 0; p.pitch = -0.08; window.__cow = k.spawnMob('cow', p.x, p.y, p.z - 9); window.__cow.speed0 = 1; k.touchSt.use = true; }}")
    r = await poll(f"() => {{ const p = {K}.player; return [+p.drawT.toFixed(2), p.blocking]; }}", lambda r: r[0] >= 1.05, 40, 100)
    await s.shot('bow_draw')
    check('使うボタンを おしている間、弓を引く', r[0] >= 1.05 and r[1] is False, r)
    await s.ev(f"() => {{ const k = {K}; window.__cow.x = k.player.x; window.__cow.z = k.player.z - 9; window.__cow.vx = window.__cow.vz = 0; k.touchSt.use = false; }}")
    r = await poll(f"() => {{ const k = {K}, p = k.player; return [k.ents.filter(e => e.kind === 'shot' && e.dark === 6).map(e => e.dmg), p.inv[1] ? p.inv[1].n : 0, p.inv[0].d, +p.drawT.toFixed(2)]; }}", lambda r: r[1] == 4, 20, 50)
    check('はなすと 矢が飛ぶ（矢 −1、弓がすりへる、いっぱいまで引くと 9ダメージ）', r[1] == 4 and r[2] == 1 and r[3] == 0 and (r[0] == [9] or r[0] == []), r)
    r = await poll(f"() => [window.__cow.hp, window.__cow.maxHp, window.__cow.dead]", lambda r: r[0] < r[1], 30, 100)
    check('矢が生き物に当たる', r[0] <= 1, r)
    # 少しだけ引くと 弱い。矢がないと うてない
    r = await s.ev(f"""() => {{ const k = {K}, p = k.player; for (const e of k.ents) e.dead = true; p.pitch = 0.5; p.ray = [0, Math.sin(0.5), -Math.cos(0.5)]; p.shootBow(0.3); const a = k.ents.filter(e => e.kind === 'shot' && !e.dead).map(e => [e.dmg, Math.round(Math.hypot(e.vx, e.vy, e.vz))]);
      p.shootBow(1); const b = k.ents.filter(e => e.kind === 'shot' && !e.dead).map(e => [e.dmg, Math.round(Math.hypot(e.vx, e.vy, e.vz))]); return [a, b, p.inv[1].n]; }}""")
    check('引く長さで 強さと速さが変わる', len(r[0]) == 1 and len(r[1]) == 2 and r[0][0][0] < 5 and r[1][1][0] == 9 and r[0][0][1] < 25 and r[1][1][1] >= 49 and r[2] == 2, r)
    # 矢はブロックにささり、少しすると落ちて ひろえる
    await s.ev(f"() => {{ const k = {K}, p = k.player; for (const e of k.ents) e.dead = true; p.pitch = -0.5; p.ray = [0, Math.sin(-0.5), -Math.cos(-0.5)]; p.shootBow(1); }}")
    r = await poll(f"() => {{ const k = {K}; return k.ents.filter(e => e.kind === 'shot').map(e => e.stuck | 0); }}", lambda r: len(r) == 1 and r[0] > 0, 30, 50)
    await s.shot('bow_stuck')
    check('矢が地面にささる', len(r) == 1 and r[0] > 0, r)
    r = await poll(f"() => {{ const k = {K}, p = k.player; return [k.ents.filter(e => e.kind === 'item' && e.id === k.I.arrow).length, k.ents.filter(e => e.kind === 'shot').length, p.inv[1] ? p.inv[1].n : 0]; }}", lambda r: r[0] == 1 and r[1] == 0, 40, 100)
    check('ささった矢は 落とし物になる', r[0] == 1 and r[1] == 0 and r[2] == 1, r)
    await s.ev(f"() => {{ const k = {K}, p = k.player, a = k.ents.find(e => e.kind === 'item' && e.id === k.I.arrow); p.x = a.x; p.z = a.z + 0.3; }}")
    r = await poll(f"() => {{ const p = {K}.player; return p.inv[1] ? p.inv[1].n : 0; }}", lambda r: r == 2, 30, 100)
    check('ひろえる', r == 2, r)
    r = await s.ev(f"""() => {{ const k = {K}, p = k.player; p.inv[1] = null; k.touchSt.use = true; return 1; }}"""); await s.wait(700)
    r = await s.ev(f"() => {{ const k = {K}, p = k.player; k.touchSt.use = false; return [p.drawT, k.ents.filter(e => e.kind === 'shot').length]; }}")
    check('矢がないと 引けない', r == [0, 0], r)
    # 3. 盾：前からは ふせぐ・後ろからは くらう。盾がすりへる
    await s.ev(FLOOR)
    r = await s.ev(f"""() => {{ const k = {K}, p = k.player, I = k.I; p.inv.fill(null); p.inv[0] = {{ id: I.iron_sword, n: 1, d: 0 }}; p.sel = 0; p.armor[4] = {{ id: I.shield, n: 1, d: 0 }}; p.yaw = 0; p.blocking = true;
      const a = p.damage(5, p.x, p.z - 3, 6, 'テスト'), hp1 = p.hp, d1 = p.armor[4].d; p.hurtT = 0; const b = p.damage(5, p.x, p.z + 3, 0, 'テスト'), hp2 = p.hp; p.hurtT = 0; p.blocking = false; const c = p.damage(2, p.x, p.z - 3, 0, 'テスト'); return [a, hp1, d1, b === undefined, hp2, c === undefined, p.hp, !!k.game.ach.shield]; }}""")
    check('盾：前は ふせぐ（盾がへる）／後ろ・かまえていない時は くらう', r[0] == 'block' and r[1] == 20 and r[2] == 6 and r[3] and r[4] < 20 and r[5] and r[6] < r[4] and r[7], r)
    await s.ev(f"() => {{ const k = {K}, p = k.player; p.hp = 20; p.hurtT = 0; p.target = null; k.touchSt.use = true; }}"); await s.wait(500)
    r = await s.ev(f"() => {{ const p = {K}.player; return [p.blocking, +p.blockK.toFixed(1)]; }}"); await s.shot('shield_up')
    check('使うボタンを おしている間 かまえる', r[0] is True and r[1] > 0.8, r)
    await s.ev(f"() => {{ const k = {K}; k.settings.view = 1; }}"); await s.wait(400); await s.shot('shield_3rd')
    await s.ev(f"() => {{ const k = {K}; k.settings.view = 0; k.touchSt.use = false; }}"); await s.wait(200)
    # 4. ユミカゲ：はなれた所から矢をうつ。盾でふせげる
    await s.ev(FLOOR)
    await s.ev(f"() => {{ const k = {K}, p = k.player; p.inv[0] = {{ id: k.I.iron_sword, n: 1, d: 0 }}; p.sel = 0; p.armor[4] = {{ id: k.I.shield, n: 1, d: 0 }}; window.__y = k.spawnMob('yumikage', p.x, p.y, p.z - 10); window.__y.shotCd = 10; }}")
    r = await poll(f"() => {{ const k = {K}, p = k.player; return [p.hp, k.ents.filter(e => e.kind === 'shot' && e.dark === 5).length, +Math.hypot(window.__y.x - p.x, window.__y.z - p.z).toFixed(1), window.__y.swing]; }}", lambda r: r[0] < 20, 80, 150)
    await s.shot('yumikage')
    check('ユミカゲの矢が当たる（近づいてこない）', r[0] < 20 and r[2] > 4, r)
    await s.ev(f"() => {{ const k = {K}, p = k.player; p.hp = 20; p.hurtT = 0; p.armor[4].d = 0; const y = window.__y; p.yaw = Math.atan2(-(y.x - p.x), -(y.z - p.z)); p.pitch = 0; k.touchSt.use = true; }}")
    r = await poll(f"() => {{ const k = {K}, p = k.player, y = window.__y; p.yaw = Math.atan2(-(y.x - p.x), -(y.z - p.z)); return [p.hp, p.armor[4] ? p.armor[4].d : -1, p.blocking]; }}", lambda r: r[1] >= 8 or r[0] < 20, 100, 150)
    check('盾をかまえていると ユミカゲの矢を はじく', r[0] == 20 and r[1] >= 4, r)
    r = await s.ev(f"""() => {{ const k = {K}; k.touchSt.use = false; const y = window.__y; const dr = k.MOBS.yumikage.drops().map(d => d[0]); k.hurtMob(y, 99, y.x, y.z + 1, 0); return [dr.includes(k.I.arrow), y.hp <= 0]; }}""")
    check('ユミカゲは 矢を落とす', r == [True, True], r)
    # 5. バクダケ：近づく→ふくらむ→はじける（地面がえぐれる）。はなれると しぼむ
    await s.ev(FLOOR)
    await s.ev(f"() => {{ const k = {K}, p = k.player; p.armor[4] = null; window.__b = k.spawnMob('bakudake', p.x, p.y, p.z - 6); }}")
    r = await poll(f"() => window.__b.fuse", lambda r: r >= 6, 80, 100)
    await s.shot('bakudake')
    check('バクダケが そばで ふくらみはじめる', r >= 6, r)
    await s.ev(f"() => {{ const p = {K}.player, b = window.__b; p.x = b.x + 9; p.z = b.z; }}")
    r = await poll(f"() => [window.__b.fuse, window.__b.dead]", lambda r: r[0] == 0 or r[1], 60, 100)
    check('はなれると しぼむ', r == [0, False], r)
    await s.ev(f"() => {{ const p = {K}.player, b = window.__b; p.x = b.x + 2; p.z = b.z; p.hp = 20; p.hurtT = 0; }}")
    r = await poll(f"""() => {{ const k = {K}, w = k.world, o = window.__o, p = k.player; let holes = 0; for (let z = -11; z <= 11; z++) for (let x = -11; x <= 11; x++) if (w.getBlock(o[0] + x, o[1] - 1, o[2] + z) === 0) holes++; return [window.__b.dead, p.hp, holes, p.dead]; }}""", lambda r: r[0], 80, 100)
    await s.wait(300); await s.shot('bakudake_boom')
    check('はじける（ダメージ・地面に穴）', r[0] and r[1] < 20 and r[2] >= 6, r)
    # 6. イトハキ：糸をはいて 足がおそくなる。糸を落とす
    await s.ev(FLOOR)
    await s.ev(f"() => {{ const k = {K}, p = k.player; p.dead = false; p.hp = 20; window.__i = k.spawnMob('itohaki', p.x, p.y, p.z - 8); window.__i.shotCd = 5; }}")
    await s.wait(400); await s.shot('itohaki')
    r = await poll(f"() => {{ const p = {K}.player; return [p.webT, p.hp]; }}", lambda r: r[0] > 0, 80, 100)
    dr = await s.ev(f"() => {{ const k = {K}; return [k.MOBS.itohaki.drops()[0][0] === k.I.string, k.MOBS.bakudake.drops()[0][0] === k.I.pop_powder]; }}")
    check('イトハキの糸で 足がおそくなる／糸・はじけ粉を落とす', r[0] > 0 and dr == [True, True], [r, dr])
    # 7. はじけ箱：火打ち金で火がつき、4秒後に はじける。となりの箱にも うつる
    await s.ev(FLOOR)
    r = await s.ev(f"""() => {{ const k = {K}, w = k.world, B = k.B, I = k.I, p = k.player, o = window.__o; p.hp = 20; p.x = o[0] + 0.5; p.z = o[2] + 10.5;
      w.setBlock(o[0], o[1], o[2] - 4, B.hajike_box, 0); w.setBlock(o[0] + 1, o[1], o[2] - 4, B.hajike_box, 0);
      p.inv[0] = {{ id: I.flint_steel, n: 1, d: 0 }}; p.sel = 0; p.target = {{ x: o[0], y: o[1], z: o[2] - 4, nx: 0, ny: 0, nz: 1, id: B.hajike_box, meta: 0, t: 3 }}; p.targetMob = null;
      const u = p.use(w); return [u, w.getBlock(o[0], o[1], o[2] - 4), k.ents.filter(e => e.kind === 'primed').map(e => e.fuse), !!k.game.ach.boom]; }}""")
    check('火打ち金で はじけ箱に火がつく', r[0] is True and r[1] == 0 and len(r[2]) == 1 and r[2][0] >= 78 and r[3], r)
    await s.wait(1500); await s.shot('hajike_primed')
    r = await poll(f"""() => {{ const k = {K}, w = k.world, o = window.__o; let holes = 0; for (let z = -9; z <= 1; z++) for (let x = -5; x <= 6; x++) if (w.getBlock(o[0] + x, o[1] - 1, o[2] + z) === 0) holes++; return [k.ents.filter(e => e.kind === 'primed').length, holes, w.getBlock(o[0] + 1, o[1], o[2] - 4), k.player.hp]; }}""", lambda r: r[0] == 0 and r[2] == 0, 120, 100)
    await s.wait(200); await s.shot('hajike_boom')
    check('はじける（大きな穴・となりの箱も はじける）', r[0] == 0 and r[1] >= 14 and r[2] == 0, r)
    # 8. セーブして読み直しても 盾が残る
    await s.ev(f"() => {{ const k = {K}, p = k.player; p.hp = 20; p.armor[4] = {{ id: k.I.shield, n: 1, d: 12 }}; p.inv[0] = {{ id: k.I.bow, n: 1, d: 3 }}; for (const e of k.ents) e.dead = true; }}")
    wid = await s.ev(f"() => {K}.game.worldId")
    await s.ev(f"async () => {{ await {K}.game.save(); }}")
    await s.ev(f"() => {K}.game.quitToTitle()")
    await s.pg.wait_for_function(f'{K}.game.state === "title"', timeout=30000)
    await s.ev(f"() => {K}.game.loadWorld('{wid}')")
    await s.pg.wait_for_function(f'{K}.game.state === "playing"', timeout=90000)
    r = await s.ev(f"() => {{ const p = {K}.player; return [p.armor.length, p.armor[4], p.inv[0]]; }}")
    check('読み直しても 盾と弓が残る', r[0] == 5 and r[1] and r[1]['id'] == 362 and r[1]['d'] == 12 and r[2]['id'] == 359 and r[2]['d'] == 3, r)
    errs = [l for l in s.logs if 'PAGEERROR' in l or l.startswith('error')]
    check('エラーなし', len(errs) == 0, errs[:6])
    await s.close()
    print('ALL OK' if ok_all else 'SOME NG')
asyncio.run(main())
