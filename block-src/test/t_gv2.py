# 版2の地形と 新しいブロックの確認（1人用）
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
    s = await Sess().start(900, 560)
    await s.ev(f"() => {{ {K}.settings.viewDist = 5; }}")
    await s.new_world('4242', mode=1, diff=0)
    await s.wait(9000)   # しばらく置いて、はしのチャンクの葉が枯れないことも見る
    r = await s.ev(f"() => {{ const k = {K}, w = k.world; return [w.gv0, k.GEN_CUR, w.gen === w.genOf(k.GEN_CUR), w.genVer(0, 0)]; }}")
    check('新しい世界は いまの版（2より後）', r[0] == r[1] and r[1] >= 2 and r[2] and r[3] == r[1], r)   # 版の数は きめ打ちしない
    # 作業スレッドで作ったチャンクと、その場で作ったチャンクが同じ
    r = await s.ev(f"""() => {{ const k = {K}, w = k.world, p = k.player; let n = 0, bad = 0;
      const cx0 = Math.floor(p.x) >> 4, cz0 = Math.floor(p.z) >> 4;
      for (let dz = -5; dz <= 5; dz++) for (let dx = -5; dx <= 5; dx++) {{ const c = w.getChunk(cx0 + dx, cz0 + dz); if (!c || c.stage < 2 || c.modified) continue;
        const g = w.genOf(2).genChunk(c.cx, c.cz); n++; let same = true;
        // 草⇔土は 時間がたつと自然に変わるので数えない。それ以外（葉が枯れる など）は ちがいとして数える
        for (let i = 0; i < g.blocks.length; i++) if ((g.blocks[i] !== c.blocks[i] && !((g.blocks[i] === 2 || g.blocks[i] === 3) && (c.blocks[i] === 2 || c.blocks[i] === 3))) || g.meta[i] !== c.meta[i]) {{ same = false; break; }}
        for (let i = 0; i < 256; i++) if (g.biome[i] !== c.biome[i]) same = false; if (!same) bad++; }}
      return [n, bad]; }}""")
    check('作業スレッドと同じ地形（はしの葉も枯れない）', r[0] >= 20 and r[1] == 0, r)
    # 苗木から 新しい木が育つ（葉は幹から4マス以内）
    r = await s.ev(f"""() => {{ const k = {K}, w = k.world, p = k.player, B = k.B, out = [];
      const bx = Math.floor(p.x), bz = Math.floor(p.z), by = 100;
      for (let t = 0; t < 7; t++) {{
        const x = bx + (t % 4) * 12 - 18, z = bz + (t >> 2) * 12 - 6;
        for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) w.setBlock(x + dx, by - 1, z + dz, B.dirt, 0);
        const okg = w.growTree(x, by, z, t);
        let logs = 0, leaves = 0, far = 0;
        for (let dy = -1; dy < 22; dy++) for (let dz = -7; dz <= 7; dz++) for (let dx = -7; dx <= 7; dx++) {{ const id = w.getBlock(x + dx, by + dy, z + dz); if (k.BLOCKS[id] && k.BLOCKS[id].log) logs++; else if (k.BLOCKS[id] && k.BLOCKS[id].leaves) {{ leaves++; if (!w.leafHasLog(x + dx, by + dy, z + dz)) far++; }} }}
        out.push([t, okg, logs, leaves, far]);
      }}
      return out; }}""")
    check('苗木から7種類の木', all(v[1] and v[2] >= 3 and v[3] >= 20 and v[4] == 0 for v in r), r)
    # つた：幹につく・上のつたからぶら下がる・支えがなくなると消える
    r = await s.ev(f"""() => {{ const k = {K}, w = k.world, p = k.player, B = k.B;
      const x = Math.floor(p.x) + 30, z = Math.floor(p.z), y = 100;
      w.setBlock(x, y, z, B.log_oak, 0);
      w.setBlock(x, y, z - 1, B.vine, 0); w.setBlock(x, y - 1, z - 1, B.vine, 0); w.setBlock(x, y - 2, z - 1, B.vine, 0);   // 向き0＝+Z に相手がいる
      const a = [w.hasSupport(B.vine, 0, x, y, z - 1), w.hasSupport(B.vine, 0, x, y - 1, z - 1), w.hasSupport(B.vine, 1, x, y - 1, z - 1)];
      w.setBlock(x, y, z, 0, 0);
      return [a, [w.getBlock(x, y, z - 1), w.getBlock(x, y - 1, z - 1), w.getBlock(x, y - 2, z - 1)]]; }}""")
    await s.wait(600)
    r2 = await s.ev(f"() => {{ const k = {K}, w = k.world, p = k.player; const x = Math.floor(p.x) + 30, z = Math.floor(p.z), y = 100; return [w.getBlock(x, y, z - 1), w.getBlock(x, y - 1, z - 1), w.getBlock(x, y - 2, z - 1)]; }}")
    check('つたの支え', r[0] == [True, True, False] and r2 == [0, 0, 0], [r, r2])
    # スイレンの葉：水の上にだけ置ける・上に立てる・水がなくなると消える
    r = await s.ev(f"""() => {{ const k = {K}, w = k.world, p = k.player, B = k.B;
      const x = Math.floor(p.x) - 30, z = Math.floor(p.z), y = 100;
      for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) {{ w.setBlock(x + dx, y - 1, z + dz, B.stone, 0); if (dx || dz) w.setBlock(x + dx, y, z + dz, B.stone, 0); }}
      w.setBlock(x, y, z, B.water, 0);
      const a = w.hasSupport(B.lily_pad, 0, x, y + 1, z), b = w.hasSupport(B.lily_pad, 0, x + 1, y + 1, z);
      w.setBlock(x, y + 1, z, B.lily_pad, 0);
      p.flying = false; p.x = x + 0.5; p.z = z + 0.5; p.y = y + 2.2; p.vy = 0;
      return [a, b, k.collisionBoxes(B.lily_pad, 0).length]; }}""")
    await s.wait(1500)
    r2 = await s.ev(f"() => {{ const p = {K}.player; return [+p.y.toFixed(2), p.onGround]; }}")
    check('スイレンの葉に立てる', r[0] and not r[1] and r[2] == 1 and abs(r2[0] - 101.02) < 0.05 and r2[1], [r, r2])
    r = await s.ev(f"() => {{ const k = {K}, w = k.world, p = k.player; const x = Math.floor(p.x), z = Math.floor(p.z); w.setBlock(x, 100, z, 0, 0); return 1; }}")
    await s.wait(600)
    r = await s.ev(f"() => {{ const k = {K}, w = k.world, p = k.player; return w.getBlock(Math.floor(p.x), 101, Math.floor(p.z)); }}")
    check('水がなくなると スイレンの葉が消える', r == 0, r)
    # 大きなキノコ：オノならブロックのまま
    r = await s.ev(f"() => {{ const k = {K}, B = k.B, I = k.I, rng = () => 0.3; return [k.blockDrops(B.mush_red, 0, k.ITEMS[I.iron_axe].tool, rng), k.blockDrops(B.mush_red, 0, null, rng), k.blockDrops(B.mush_stem, 0, null, rng), k.blockDrops(B.leaves_mahog, 0, null, () => 0.01)]; }}")
    check('キノコのかさの落とし物', r[0] == [[100, 1]] and r[1] and r[1][0][0] == 53 and r[2] == [[101, 1]], r)
    # レシピ：新しい原木から板、板から棒
    r = await s.ev(f"() => {{ const k = {K}, B = k.B; return [k.RECIPES.filter(q => q.out === B.planks_mahog || q.out === B.planks_acacia || q.out === B.planks_walnut).length, k.RECIPES.filter(q => q.out === B.coarse_dirt || q.out === B.terracotta_red).length]; }}")
    check('新しい板などのレシピ', r == [3, 2], r)
    # セーブして読み直す：版2のまま・変えたブロックが残る・バイオームが同じ
    await s.ev(f"() => {{ const k = {K}, p = k.player; p.flying = true; p.vy = 0; }}")
    pos = await s.ev(f"() => {{ const k = {K}, w = k.world, p = k.player; const x = Math.floor(p.x) + 3, z = Math.floor(p.z) + 3; w.setBlock(x, 110, z, k.B.terracotta_yellow, 0); return [x, z, w.biomeAt(x, z), k.game.worldId]; }}")
    await s.ev(f"async () => {{ await {K}.game.save(); }}")
    await s.ev(f"() => {K}.game.quitToTitle()")
    await s.pg.wait_for_function('window.__kk.game.state === "title"', timeout=30000)
    await s.ev(f"() => {K}.game.loadWorld('{pos[3]}')")
    await s.pg.wait_for_function('window.__kk.game.state === "playing"', timeout=90000)
    await s.wait(1500)
    r = await s.ev(f"() => {{ const k = {K}, w = k.world; return [w.gv0, w.getBlock({pos[0]}, 110, {pos[1]}) === k.B.terracotta_yellow, w.biomeAt({pos[0]}, {pos[1]})]; }}")
    check('読み直しても同じ', r[0] >= 2 and r[1] and r[2] == pos[2], r)
    # 昔の世界（版の記録がない）は 版1のまま
    await s.ev(f"() => {K}.game.quitToTitle()")
    await s.pg.wait_for_function('window.__kk.game.state === "title"', timeout=30000)
    await s.ev(f"() => {K}.game.beginWorld({{ id: 'wold', name: 'むかしの世界', seed: 4242, mode: 1, diff: 0, day: 1, time: 600, tick: 0, player: null, ach: {{}}, ended: false }}, new Map())")
    await s.pg.wait_for_function('window.__kk.game.state === "playing"', timeout=90000)
    await s.wait(1500)
    r = await s.ev(f"""() => {{ const k = {K}, w = k.world, p = k.player; const cx = Math.floor(p.x) >> 4, cz = Math.floor(p.z) >> 4, c = w.getChunk(cx, cz);
      const g = new k.GENS[1](w.seed).genChunk(cx, cz); let same = c && c.stage >= 2; if (same) for (let i = 0; i < g.blocks.length; i++) if (g.blocks[i] !== c.blocks[i] && !((g.blocks[i] === 2 || g.blocks[i] === 3) && (c.blocks[i] === 2 || c.blocks[i] === 3))) {{ same = false; break; }}
      let mx = 0; for (let i = 0; i < c.blocks.length; i++) if (c.blocks[i] > mx) mx = c.blocks[i];
      return [w.gv0, w.genVer(cx, cz), same, mx <= 73]; }}""")
    check('昔の世界は版1のまま', r == [1, 1, True, True], r)
    errs = [l for l in s.logs if 'PAGEERROR' in l or l.startswith('error')]
    check('エラーなし', len(errs) == 0, errs[:5])
    await s.close()
    print('ALL OK' if ok_all else 'SOME NG')
asyncio.run(main())
