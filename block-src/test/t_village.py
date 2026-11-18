# 村と村人（1人用）：村人が出る・家から出入りする・こうかん・回数・セーブ・道・見はり塔
import asyncio, json, sys, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from lib import Sess
K = "window.__kk"
ok_all = True
def check(name, cond, extra=''):
    global ok_all
    print(('OK  ' if cond else 'NG  ') + name, extra)
    if not cond: ok_all = False
async def poll(s, js, ms=20000, step=500):
    t = 0
    while t < ms:
        r = await s.ev(js)
        if r: return r
        await s.wait(step); t += step
    return await s.ev(js)
async def main():
    s = await Sess().start(1280, 720)
    await s.ev(f"() => {{ const st = {K}.settings; st.viewDist = 5; st.music = 0; st.showInfo = false; st.minimap = false; }}")
    await s.new_world('8642', mode=0, diff=0)
    await s.wait(800)
    r = await s.ev(f"""() => {{ const k = {K}, w = k.world, p = k.player; const V = k.game.villageNear(p.x, p.z); if (!V) return null; window.__V = V;
      w.time = 6000; k.game.rules.day = true; p.x = V.x + 2.5; p.z = V.z + 2.5; p.y = V.y + 1.2; p.yaw = 0; p.pitch = 0; p.hp = 20;
      return [V.lots.reduce((a, l) => a + (l.type === 'hm' ? 2 : 1), 0), V.lots.length, Math.round(Math.hypot(V.x - k.game.worldSpawn.x, V.z - k.game.worldSpawn.z)), !!k.game.ach.village]; }}""")
    check('最初の場所の近くに 村がある', r is not None and r[2] < 420, r)
    want = r[0]
    n = await poll(s, f"() => {{ const k = {K}; let m = 0; for (const c of k.world.chunks.values()) for (const e of c.ents.values()) if (e.t === 'vmark') m++; const n = k.ents.filter(e => e.type === 'sato' && !e.dead).length; return m === 0 && n >= {want} ? n : 0; }}", 30000)
    r = await s.ev(f"""() => {{ const k = {K}, vs = k.ents.filter(e => e.type === 'sato' && !e.dead); let blk = 0; const w = k.world, V = window.__V;
      for (let x = V.x - V.rad; x <= V.x + V.rad; x++) for (let z = V.z - V.rad; z <= V.z + V.rad; z++) for (let y = V.y - 4; y < V.y + 8; y++) if (w.getBlock(x, y, z) === k.B.vmark) blk++;
      return [vs.length, new Set(vs.map(e => e.vs)).size, vs.every(e => e.home && e.home.length === 5), blk, [0, 1, 2, 3].map(j => vs.filter(e => (e.vs & 3) === j).length), !!k.game.ach.village]; }}""")
    check('村人が しるしの数だけ出る・しるしは消える・番号は かぶらない', n == want and r[0] == want and r[1] == want and r[2] and r[3] == 0, (want, r))
    check('はたけの人と かじやが いる', r[4][0] >= 1 and r[4][1] >= 1, r[4])
    await poll(s, f"() => !!{K}.game.ach.village", 6000)
    check('実績「村を見つける」', await s.ev(f"() => !!{K}.game.ach.village"))
    await s.shot('vil_1')
    # 家の中の村人が 入口から外へ出られる（ドアは あいている）
    r = await s.ev(f"() => {{ const k = {K}; const vs = k.ents.filter(e => e.type === 'sato' && !e.dead && e.home[4] !== 1); for (const e of vs) e.vt = 1; window.__in = vs; return vs.length; }}")
    out = await poll(s, f"() => window.__in.every(e => e.vst === 2) ? 1 : 0", 45000, 1000)
    r2 = await s.ev(f"() => window.__in.map(e => [e.vst, Math.round(e.x * 10) / 10, Math.round(e.z * 10) / 10, e.home.slice(0, 4)])")
    check('家の中の村人が 外へ出る', bool(out), r2)
    # 夜は 家にもどる
    await s.ev(f"() => {{ const k = {K}; k.game.rules.day = false; k.world.time = 15000; }}")
    back = await poll(s, f"() => {{ const k = {K}; k.world.time = 15000; return window.__in.filter(e => e.vst === 0).length >= window.__in.length - 1 ? 1 : 0; }}", 90000, 1000)
    r2 = await s.ev(f"() => window.__in.map(e => [e.vst, Math.round(e.x * 10) / 10, Math.round(e.z * 10) / 10, e.home.slice(0, 4)])")
    check('夜は 家にもどる', bool(back), r2)
    await s.ev(f"() => {{ const k = {K}; k.game.rules.day = true; k.world.time = 6000; }}")
    # こうかん
    r = await s.ev(f"""() => {{ const k = {K}, p = k.player, I = k.I; const e = k.ents.find(e => e.type === 'sato' && !e.dead && (e.vs & 3) === 0); window.__f = e;
      p.x = e.x + 1.6; p.z = e.z; p.y = e.y + 0.05; p.yaw = Math.PI / 2; p.pitch = 0; e.busy = 100;
      for (let i = 0; i < 36; i++) p.inv[i] = null; p.inv[0] = {{ id: I.wheat, n: 40, d: 0 }}; p.sel = 0; p.xpLv = 0; p.xpPt = 0;
      const act = k.mobUse(e, p.inv[0]); const ok = p.useOnMob(e, act, p.inv[0]);
      return [act, ok, k.ui.screen, k.tradesOf(e.vs).map(t => [k.ITEMS[t[0]].name, t[1], k.ITEMS[t[2]].name, t[3], t[4]]), document.getElementById('tradeOpts').children.length, document.getElementById('scrTitle').textContent]; }}""")
    check('村人に「使う」で こうかんの画面', r[0] == 'trade' and r[2] == 'trade' and r[4] == 6 and 'はたけの人' in r[5], r[:3] + r[4:])
    print('   ', json.dumps(r[3], ensure_ascii=False))
    await s.wait(500); await s.shot('vil_trade')
    r = await s.ev(f"""() => {{ const k = {K}, p = k.player, I = k.I, e = window.__f; const cnt = (id) => p.countSpec(id);
      k.ui.doTrade(0); k.ui.doTrade(0); const a = [cnt(I.wheat), cnt(I.jade), p.tradeLeft(e.vs, 0, 6), p.xpPt + p.xpLv * 100 > 0, !!k.game.ach.trade, e.swing > 0];
      k.ui.doTrade(0); const b = [cnt(I.wheat), cnt(I.jade)];   // 小麦が足りない
      k.ui.doTrade(3); const c = [cnt(I.jade), cnt(I.bread)];
      p.inv[5] = {{ id: I.wheat, n: 64, d: 0 }}; p.inv[6] = {{ id: I.wheat, n: 64, d: 0 }};
      for (let i = 0; i < 8; i++) k.ui.doTrade(0);
      const d = [cnt(I.wheat), cnt(I.jade), p.tradeLeft(e.vs, 0, 6)];
      k.world.day++; const f = p.tradeLeft(e.vs, 0, 6); k.world.day--;
      return [a, b, c, d, f]; }}""")
    check('こうかん：小麦16→ヒスイ1（2回）', r[0][:3] == [8, 2, 4] and r[0][3] and r[0][4] and r[0][5], r[0])
    check('足りないときは できない', r[1] == [8, 2], r[1])
    check('ヒスイ1→パン4', r[2] == [1, 4], r[2])
    check('1日の回数まで（6回）。次の日に もどる', r[3] == [8 + 128 - 64, 5, 0] and r[4] == 6, (r[3], r[4]))
    await s.wait(400); await s.shot('vil_trade2')
    # セーブして読みなおす：村人は そのまま（ふえない）・回数も のこる
    await s.ev(f"() => {{ {K}.ui.close(); }}")
    r = await s.ev(f"async () => {{ const k = {K}; const n0 = k.ents.filter(e => e.type === 'sato' && !e.dead).length; await k.game.save(); return [n0, k.game.worldId]; }}")
    await s.ev(f"async () => {{ const k = {K}; const id = k.game.worldId; await k.game.quitToTitle(); await k.game.loadWorld(id); }}")
    await s.wait(2500)
    n1 = await poll(s, f"() => {{ const k = {K}; return k.game.state === 'playing' ? k.ents.filter(e => e.type === 'sato' && !e.dead).length + (k.world.stash.size ? [...k.world.stash.values()].reduce((a, l) => a + l.filter(q => q[0] === 'sato').length, 0) : 0) : 0; }}", 20000)
    await s.wait(3000)
    r2 = await s.ev(f"""() => {{ const k = {K}, p = k.player; const vs = k.ents.filter(e => e.type === 'sato' && !e.dead); let m = 0; for (const c of k.world.chunks.values()) for (const e of c.ents.values()) if (e.t === 'vmark') m++;
      const st = [...k.world.stash.values()].reduce((a, l) => a + l.filter(q => q[0] === 'sato').length, 0);
      const f = vs.find(e => (e.vs & 3) === 0 && p.trades[e.vs]);
      return [vs.length + st, new Set(vs.map(e => e.vs)).size === vs.length, m, vs.every(e => e.home && e.home.length === 5), f ? p.tradeLeft(f.vs, 0, 6) : -1, p.countSpec(k.I.jade)]; }}""")
    check('読みなおしても 村人の数は同じ・家をおぼえている・回数ものこる', r2[0] == r[0] and r2[1] and r2[2] == 0 and r2[3] and r2[4] == 0 and r2[5] == 5, (r, r2))
    # スコップで 道を作る
    r = await s.ev(f"""() => {{ const k = {K}, p = k.player, w = k.world, B = k.B, I = k.I; const x = Math.floor(p.x) + 2, z = Math.floor(p.z) + 2; let y = Math.floor(p.y) + 6; while (y > 1 && !w.getBlock(x, y, z)) y--;
      w.setBlock(x, y, z, B.grass, 0); w.setBlock(x, y + 1, z, 0, 0); p.inv[0] = {{ id: I.iron_shovel, n: 1, d: 0 }}; p.sel = 0; p.targetMob = null;
      p.target = {{ x, y, z, nx: 0, ny: 1, nz: 0, id: B.grass, meta: 0, t: 2 }}; const u = p.use(w); return [u, w.getBlock(x, y, z) === B.path, k.blockDrops(B.path, 0, null, () => 0.5)]; }}""")
    check('スコップで 草を「ふみかためた道」に', r[0] and r[1] and r[2] == [[3, 1]], r)
    # 見はり塔
    r = await s.ev(f"""() => {{ const k = {K}, w = k.world, p = k.player, g = w.genOf(3, 0); let T = null;
      for (let d = 0; d < 40 && !T; d++) for (let cz = -d; cz <= d && !T; cz++) for (let cx = -d; cx <= d && !T; cx++) if (Math.max(Math.abs(cx), Math.abs(cz)) === d) T = g.tower((p.x >> 4) + cx, (p.z >> 4) + cz);
      if (!T) return null; window.__T = T; p.x = T.x + 2.5; p.z = T.z + 9.5; p.y = T.y + 1.2; p.yaw = 0; p.pitch = 0.25; return T; }}""")
    check('見はり塔が見つかる', r is not None, r)
    if r:
        await poll(s, f"() => {{ const k = {K}, T = window.__T; return k.world.isLoaded(T.x, T.z) && k.world.getBlock(T.x, T.y + 3, T.z) ? 1 : 0; }}", 20000)
        await s.wait(1500)
        r = await s.ev(f"""() => {{ const k = {K}, w = k.world, T = window.__T, B = k.B; const e = w.getEnt(T.x + 3, T.y + 11, T.z + 3);
          let lad = 0; for (let y = T.y + 1; y <= T.y + 10; y++) if (w.getBlock(T.x + 2, y, T.z + 1) === B.ladder && w.hasSupport(B.ladder, 2, T.x + 2, y, T.z + 1)) lad++;
          return [w.getBlock(T.x + 3, T.y + 11, T.z + 3) === B.chest, !!e && e.t === 'chest' && e.items.filter(q => q).length, lad, w.getBlock(T.x + 2, T.y + 1, T.z + 4), w.getBlock(T.x + 2, T.y + 9, T.z + 3) === B.lantern]; }}""")
        check('塔：はしご10段・てっぺんに宝箱・入口', r[0] and r[1] >= 3 and r[2] == 10 and r[3] == 0 and r[4], r)
        await s.shot('vil_tower')
    # 古い地形（版2）の世界には 村の道しるべを出さない
    r = await s.ev(f"() => {{ const k = {K}, w = k.world, g0 = w.gv0, r0 = w.rgv; w.gv0 = 2; w.rgv = null; const a = k.game.villageNear(0, 0); w.gv0 = g0; w.rgv = r0; return [a === null, !!k.game.villageNear(0, 0)]; }}")
    check('古い地形の世界では 村を あんないしない', r == [True, True], r)
    errs = [e for e in s.errors] if hasattr(s, 'errors') else []
    s.dump(8)
    print('結果:', 'ぜんぶOK' if ok_all else 'NGあり')
    await s.close()
    sys.exit(0 if ok_all else 1)
asyncio.run(main())
