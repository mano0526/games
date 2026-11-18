# 形のあるブロック・色の素材・明かりの確認（1人用）
import asyncio, json, sys, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from lib import Sess
K = "window.__kk"
ok_all = True
def check(name, cond, extra=''):
    global ok_all
    print(('OK  ' if cond else 'NG  ') + name, extra)
    if not cond: ok_all = False
MOVE = """() => { const k = window.__kk, p = k.player; const ox = Math.floor(p.x) + 200, oz = Math.floor(p.z), Y = 100; window.__o = [ox, Y, oz];
  p.mode = 1; p.flying = true; p.x = ox + 0.5; p.y = Y + 9; p.z = oz - 22; p.yaw = Math.PI; p.pitch = -0.42; k.world.time = 6000; return 1; }"""
SETUP = """() => {
  const k = window.__kk, w = k.world, B = k.B, p = k.player;
  const [ox, Y, oz] = window.__o;
  for (let z = -14; z <= 14; z++) for (let x = -20; x <= 20; x++) { w.setBlock(ox + x, Y - 1, oz + z, B.smooth_stone, 0); for (let y = Y; y < Y + 12; y++) if (w.getBlock(ox + x, y, oz + z)) w.setBlock(ox + x, y, oz + z, 0, 0); }
  const S = (x, y, z, key, m) => w.setBlock(ox + x, Y + y, oz + z, B[key], m || 0);
  const woods = ['oak', 'birch', 'spruce', 'cherry', 'mahog', 'acacia', 'walnut'];
  const cols = ['white', 'orange', 'magenta', 'lightblue', 'yellow', 'lime', 'pink', 'gray', 'lightgray', 'cyan', 'purple', 'blue', 'brown', 'green', 'red', 'black'];
  // 色の素材（5列）
  cols.forEach((c, i) => { S(-16 + i * 2, 0, -12, 'wool_' + c); S(-16 + i * 2, 0, -10, 'concrete_' + c); S(-16 + i * 2, 0, -8, 'terracotta_' + c); S(-16 + i * 2, 0, -6, 'glass_' + c); S(-16 + i * 2, 1, -6, 'glass_' + c); S(-16 + i * 2, 0, -4, 'carpet_' + c); });
  // 階段（4つの向き＋さかさま）とハーフブロック
  const mats = ['oak', 'birch', 'spruce', 'cherry', 'mahog', 'acacia', 'walnut', 'cobble', 'stone', 'stone_bricks', 'bricks', 'sandstone', 'mossy_cobble', 'granite', 'diorite', 'andesite'];
  mats.forEach((m, i) => { S(-16 + i * 2, 0, -1, 'stairs_' + m, i & 3); S(-16 + i * 2, 0, 1, 'slab_' + m, 0); S(-16 + i * 2, 1, 1, 'slab_' + m, 1); S(-16 + i * 2, 0, 3, 'stairs_' + m, (i & 3) | 4); });
  // フェンス・門・へい・ガラス板
  woods.forEach((wd, i) => { for (let d = 0; d < 3; d++) S(-16 + i * 4 + d, 0, 6, 'fence_' + wd); S(-16 + i * 4 + 3, 0, 6, 'gate_' + wd, i & 1 ? 4 : 0); S(-16 + i * 4, 0, 7, 'fence_' + wd); });
  ['cobble', 'mossy_cobble', 'stone_bricks', 'bricks', 'sandstone'].forEach((m, i) => { for (let d = 0; d < 3; d++) S(-16 + i * 4 + d, 0, 9, 'wall_' + m); S(-16 + i * 4, 0, 10, 'wall_' + m); });
  for (let d = 0; d < 4; d++) { S(6 + d, 0, 9, 'glass_pane'); S(6 + d, 1, 9, 'glass_pane'); S(12 + d, 0, 9, 'iron_bars'); S(12 + d, 1, 9, 'iron_bars'); }
  S(11, 0, 9, 'glass_pane'); S(18, 0, 9, 'iron_bars');
  // ドア・トラップドア
  woods.forEach((wd, i) => { S(-16 + i * 2, 0, 12, 'door_' + wd, 2); S(-16 + i * 2, 1, 12, 'door_' + wd, 2 | 8); S(i * 2, 0, 12, 'trapdoor_' + wd, i % 3 === 0 ? 0 : i % 3 === 1 ? 4 : 8); });
  // 明かり・かざり・看板
  S(14, 0, 12, 'lantern'); S(16, 2, 12, 'stone'); S(16, 1, 12, 'lantern', 1); S(18, 0, 12, 'chochin'); S(14, 2, 14, 'stone'); S(14, 1, 14, 'chochin', 1); S(16, 0, 14, 'campfire'); S(18, 0, 14, 'crystal_lamp');
  ['hay', 'granite_smooth', 'diorite_smooth', 'andesite_smooth', 'smooth_stone', 'chiseled_bricks', 'mossy_bricks', 'smooth_sandstone', 'chiseled_sandstone', 'red_sandstone'].forEach((n, i) => S(-16 + i * 2, 0, 14, n));
  S(6, 0, 14, 'sign', 0); w.setEnt(ox + 6, Y, oz + 14, { t: 'sign', s: 'ようこそ\\nみんなの村へ' });
  S(8, 0, 14, 'sign', 3); w.setEnt(ox + 8, Y, oz + 14, { t: 'sign', s: 'こっち→' });
  p.mode = 1; p.flying = true; p.x = ox + 0.5; p.y = Y + 9; p.z = oz - 22; p.yaw = Math.PI; p.pitch = -0.42; k.world.time = 6000;
  return [ox, Y, oz];
}"""
async def main():
    s = await Sess().start(1280, 720)
    await s.ev(f"() => {{ const st = {K}.settings; st.viewDist = 5; st.minimap = false; st.showInfo = false; }}")
    await s.new_world('31415', mode=1, diff=0)
    await s.wait(1500)
    await s.ev(MOVE)
    WAITC = f"() => {{ const k = {K}, w = k.world, p = k.player; p.flying = true; p.vy = 0; let n = 0, m = 0; const cx = Math.floor(p.x) >> 4, cz = Math.floor(p.z) >> 4; for (let dz = -3; dz <= 3; dz++) for (let dx = -3; dx <= 3; dx++) {{ const c = w.getChunk(cx + dx, cz + dz); n++; if (c && c.stage >= 2 && c.meshed && !c.dirty) m++; }} return [n, m]; }}"
    for i in range(60):
        await s.wait(500)
        st = await s.ev(WAITC)
        if st[1] >= st[0] - 1: break
    o = await s.ev(SETUP)
    for i in range(40):
        await s.wait(500)
        st = await s.ev(f"() => {{ const k = {K}, w = k.world, p = k.player; p.flying = true; p.vy = 0; let n = 0, m = 0; const cx = Math.floor(p.x) >> 4, cz = Math.floor(p.z) >> 4; for (let dz = -3; dz <= 3; dz++) for (let dx = -3; dx <= 3; dx++) {{ const c = w.getChunk(cx + dx, cz + dz); n++; if (c && c.stage >= 2 && c.meshed && !c.dirty) m++; }} return [n, m]; }}")
        if st[1] >= st[0] - 1: break
    await s.wait(1200); await s.shot('blk_all')
    # 近くから（色の素材／形）
    await s.ev(f"() => {{ const p = {K}.player, o = window.__o; p.x = o[0] - 6; p.y = o[1] + 5; p.z = o[2] - 17; p.yaw = Math.PI; p.pitch = -0.5; }}"); await s.wait(1200); await s.shot('blk_color')
    await s.ev(f"() => {{ const p = {K}.player, o = window.__o; p.x = o[0] - 8; p.y = o[1] + 4.5; p.z = o[2] - 5; p.yaw = Math.PI; p.pitch = -0.55; }}"); await s.wait(1200); await s.shot('blk_shape')
    await s.ev(f"() => {{ const p = {K}.player, o = window.__o; p.x = o[0] - 6; p.y = o[1] + 4; p.z = o[2] + 3; p.yaw = Math.PI; p.pitch = -0.5; }}"); await s.wait(1200); await s.shot('blk_fence')
    await s.ev(f"() => {{ const p = {K}.player, o = window.__o; p.x = o[0] + 12; p.y = o[1] + 3.2; p.z = o[2] + 7.5; p.yaw = Math.PI; p.pitch = -0.35; {K}.world.time = 18000; }}"); await s.wait(2500); await s.shot('blk_light')
    r = await s.ev("() => [...document.querySelectorAll('.stag')].filter(t => !t.hidden).map(t => t.textContent)")
    check('看板の字が出る', sorted(r) == sorted(['ようこそ\nみんなの村へ', 'こっち→']), r)
    await s.ev(f"() => {{ {K}.world.time = 6000; }}")
    # 明かり
    r = await s.ev(f"() => {{ const w = {K}.world, o = window.__o; return [w.getLightRaw(o[0] + 14, o[1] + 1, o[2] + 12) & 15, w.getLightRaw(o[0] + 18, o[1] + 1, o[2] + 12) & 15, w.getLightRaw(o[0] + 16, o[1] + 1, o[2] + 14) & 15]; }}")
    check('ランタン・ちょうちん・たき火が光る', r[0] >= 13 and r[1] >= 11 and r[2] >= 13, r)
    # つながり
    r = await s.ev(f"() => {{ const k = {K}, w = k.world, o = window.__o, B = k.B; return [w.linkMask(o[0] - 16, o[1], o[2] + 6, B.fence_oak), w.linkMask(o[0] - 15, o[1], o[2] + 6, B.fence_oak), w.linkMask(o[0] - 14, o[1], o[2] + 6, B.fence_oak), w.linkMask(o[0] + 6, o[1], o[2] + 9, B.glass_pane)]; }}")
    check('フェンスがつながる（かど・まっすぐ・門のとなり）', r == [9, 10, 10, 8], r)
    # 歩いてハーフブロックにのぼる（ジャンプなし）・フェンスはこえられない・開いた門は通れる
    r = await s.ev(f"""async () => {{ const k = {K}, w = k.world, B = k.B, p = k.player, o = window.__o;
      const X = o[0] + 10, Z = o[2] - 1, Y = o[1];
      w.setBlock(X, Y, Z - 2, B.slab_oak, 0); w.setBlock(X, Y, Z - 3, B.planks_oak, 0); w.setBlock(X, Y + 1, Z - 4, B.slab_oak, 0); w.setBlock(X, Y, Z - 4, B.planks_oak, 0); for (let y = 1; y <= 4; y++) w.setBlock(X, Y + y, Z - 5, B.stone, 0);
      p.mode = 0; p.flying = false; p.x = X + 0.5; p.y = Y + 0.01; p.z = Z + 0.5; p.vx = p.vy = p.vz = 0; p.yaw = 0; p.pitch = 0;
      return 1; }}""")
    await s.wait(600)
    await s.pg.keyboard.down('KeyW'); await s.wait(1400); await s.pg.keyboard.up('KeyW'); await s.wait(300)
    r = await s.ev(f"() => {{ const p = {K}.player, o = window.__o; return [+(p.y - o[1]).toFixed(2), +(o[2] - 1 - p.z).toFixed(1), p.onGround]; }}")
    check('ハーフブロックと その上の段を 歩いてのぼれる', abs(r[0] - 1.5) < 0.05 and r[1] > 3 and r[1] < 4 and r[2], r)
    r = await s.ev(f"""() => {{ const k = {K}, w = k.world, B = k.B, p = k.player, o = window.__o;
      const X = o[0] + 10, Z = o[2] + 2, Y = o[1];
      for (let d = -2; d <= 2; d++) w.setBlock(X + d, Y, Z + 3, B.fence_oak, 0);
      p.x = X + 0.5; p.y = Y + 0.01; p.z = Z + 0.5; p.vx = p.vy = p.vz = 0; p.yaw = Math.PI; return 1; }}""")
    await s.wait(300)
    await s.pg.keyboard.down('KeyW'); await s.pg.keyboard.down('Space'); await s.wait(1500); await s.pg.keyboard.up('Space'); await s.pg.keyboard.up('KeyW'); await s.wait(300)
    r = await s.ev(f"() => {{ const p = {K}.player, o = window.__o; return +(p.z - (o[2] + 2)).toFixed(2); }}")
    check('フェンスは ジャンプしてもこえられない', r < 3.2, r)
    await s.ev(f"() => {{ const k = {K}, w = k.world, B = k.B, o = window.__o; w.setBlock(o[0] + 10, o[1], o[2] + 5, B.gate_oak, 4); }}")
    await s.pg.keyboard.down('KeyW'); await s.wait(1200); await s.pg.keyboard.up('KeyW'); await s.wait(200)
    r = await s.ev(f"() => {{ const p = {K}.player, o = window.__o; return +(p.z - (o[2] + 2)).toFixed(2); }}")
    check('開いたフェンスゲートは通れる', r > 3.6, r)
    # 置き方：ハーフブロックを2つ重ねると1つのブロックに／階段の向き
    r = await s.ev(f"""() => {{ const k = {K}, w = k.world, B = k.B, p = k.player, o = window.__o, X = o[0] - 2, Y = o[1], Z = o[2] - 3;
      p.mode = 1; p.x = X + 0.5; p.y = Y + 0.01; p.z = Z + 3.5; p.yaw = 0; p.ray[0] = 0; p.ray[1] = -0.5; p.ray[2] = -0.86;
      const t0 = {{ x: X, y: Y - 1, z: Z, nx: 0, ny: 1, nz: 0, id: w.getBlock(X, Y - 1, Z), meta: 0, t: 3 }};
      const a = p.placeBlock(w, t0, B.slab_stone); const m1 = [w.getBlock(X, Y, Z) === B.slab_stone, w.getMeta(X, Y, Z)];
      const t1 = {{ x: X, y: Y, z: Z, nx: 0, ny: 1, nz: 0, id: B.slab_stone, meta: 0, t: 3 }};
      const b = p.placeBlock(w, t1, B.slab_stone); const m2 = w.getBlock(X, Y, Z) === B.stone;
      const t2 = {{ x: X + 2, y: Y - 1, z: Z, nx: 0, ny: 1, nz: 0, id: w.getBlock(X + 2, Y - 1, Z), meta: 0, t: 3 }};
      p.placeBlock(w, t2, B.stairs_oak); const m3 = [w.getBlock(X + 2, Y, Z) === B.stairs_oak, w.getMeta(X + 2, Y, Z), p.lookF()];
      return [a, m1, b, m2, m3]; }}""")
    check('ハーフブロックを重ねると1つに・階段は向いたほうへのぼる', r[0] and r[1] == [True, 0] and r[2] and r[3] and r[4][0] and r[4][1] == r[4][2], r)
    # レシピ
    r = await s.ev(f"""() => {{ const k = {K}, B = k.B, I = k.I, g = (ids, w) => {{ const r = k.matchGrid(ids.map(id => id ? {{ id, n: 1, d: 0 }} : null), w); return r ? [r.out, r.n] : null; }};
      return [g([B.planks_birch, 0, 0, B.planks_birch, B.planks_birch, 0, B.planks_birch, B.planks_birch, B.planks_birch], 3), g([B.cobble, B.cobble, B.cobble, 0, 0, 0, 0, 0, 0], 3), g([B.planks_oak, I.stick, B.planks_oak, B.planks_oak, I.stick, B.planks_oak, 0, 0, 0], 3),
        g([B.wool_white, I.dye_cyan, 0, 0], 2), g([B.planks_walnut, B.planks_walnut, 0, B.planks_walnut, B.planks_walnut, 0, B.planks_walnut, B.planks_walnut, 0], 3), g([I.dye_blue, I.dye_green, 0, 0], 2)].map(v => v && [k.ITEMS[v[0]].name, v[1]]); }}""")
    check('レシピ', r == [['シラカバの階段', 4], ['丸石のハーフブロック', 6], ['オークのフェンス', 3], ['青緑の羊毛', 1], ['クルミのドア', 3], ['青緑の染料', 2]], r)
    # 持ち物の絵が全部ある
    r = await s.ev(f"() => {{ const k = {K}; let n = 0, bad = []; for (const id in k.ITEMS) {{ n++; const u = k.ICON_URL[id]; if (!u || u.length < 200) bad.push(k.ITEMS[id].name); }} return [n, bad.slice(0, 8)]; }}")
    check('持ち物の絵', r[0] >= 320 and r[1] == [], r)
    # セーブして読み直す（512以上の番号・看板の字）。昔の形（8ビット）のチャンクも読める
    wid = await s.ev(f"() => {K}.game.worldId")
    await s.ev(f"() => {{ const p = {K}.player; p.flying = true; p.vy = 0; }}")
    await s.ev(f"async () => {{ await {K}.game.save(); }}")
    await s.ev(f"() => {K}.game.quitToTitle()")
    await s.pg.wait_for_function('window.__kk.game.state === "title"', timeout=30000)
    await s.ev(f"() => {K}.game.loadWorld('{wid}')")
    await s.pg.wait_for_function('window.__kk.game.state === "playing"', timeout=90000)
    await s.wait(2000)
    r = await s.ev(f"() => {{ const k = {K}, w = k.world, B = k.B, o = window.__o; const e = w.getEnt(o[0] + 6, o[1], o[2] + 14); return [w.getBlock(o[0] - 16, o[1], o[2] - 10) === B.concrete_white, w.getBlock(o[0] + 14, o[1], o[2] - 6) === B.glass_black, w.getBlock(o[0] - 16, o[1], o[2] + 3) === B.stairs_oak, w.getMeta(o[0] - 14, o[1], o[2] + 3), e && e.s]; }}")
    check('読み直しても残る', r == [True, True, True, 5, 'ようこそ\nみんなの村へ'], r)
    r = await s.ev(f"""() => {{ const k = {K}, w = k.world;   // 昔の保存の形を作って読ませる
      const u8 = new Uint8Array(16 * 16 * 128); u8.fill(1, 0, 256 * 60); u8[256 * 60 + 5] = 73;
      const rle = (arr) => {{ const out = []; let i = 0; while (i < arr.length) {{ const v = arr[i]; let j = i + 1; while (j < arr.length && arr[j] === v && j - i < 65535) j++; out.push(v, (j - i) & 255, (j - i) >> 8); i = j; }} return new Uint8Array(out); }};
      const c = {{ cx: 900, cz: 900, ents: new Map(), meshes: [], stage: 0 }};
      w.loadSaved(c, {{ b: rle(u8), m: rle(new Uint8Array(16 * 16 * 128)), e: [] }});
      return [c.blocks instanceof Uint16Array, c.blocks[0], c.blocks[256 * 60 + 5], c.maxY]; }}""")
    check('昔の保存の形（8ビット）も読める', r == [True, 1, 73, 60], r)
    errs = [l for l in s.logs if 'PAGEERROR' in l or l.startswith('error')]
    check('エラーなし', len(errs) == 0, errs[:5])
    await s.close()
    print('ALL OK' if ok_all else 'SOME NG')
asyncio.run(main())
