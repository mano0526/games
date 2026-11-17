import asyncio, json, sys, time
sys.path.insert(0, __import__('os').path.dirname(__import__('os').path.abspath(__file__)))
from lib import Sess
async def main():
    s = await Sess().start()
    await s.new_world('12345')
    await s.wait(800)
    K = "window.__kk"
    # A: 足もとの草ブロックをこわす
    await s.ev(f"() => {{ const p = {K}.player; p.pitch = -1.5; p.yaw = 0.2; }}")
    await s.wait(300)
    tgt = await s.ev(f"() => {{ const t = {K}.player.target; return t ? [t.x, t.y, t.z, t.id] : null; }}")
    print('target', tgt)
    await s.pg.mouse.move(640, 360); await s.pg.mouse.down()
    await s.wait(2500)
    await s.pg.mouse.up()
    await s.wait(1500)
    inv = await s.ev(f"() => {K}.player.inv.filter(x => x).map(x => [{K}.ITEMS[x.id].name, x.n])")
    tb = await s.ev(f"() => {K}.world.getBlock({tgt[0]}, {tgt[1]}, {tgt[2]})") if tgt else None
    print('after break: block', tb, 'inv', inv)
    # B: クラフト
    r = await s.ev(f"""() => {{ const k = {K}, p = k.player; p.give(k.B.log_oak, 8, 0); p.give(k.B.cobble, 20, 0); p.give(k.I.coal, 4, 0);
      const out = [];
      k.ui.open('inv');
      const rec = (id) => k.RECIPES.find(r => r.out === id);
      k.ui.craftFromList(rec(k.B.planks_oak), false); k.ui.craftFromList(rec(k.B.planks_oak), false); k.ui.craftFromList(rec(k.I.stick), false); k.ui.craftFromList(rec(k.B.crafting_table), false);
      // 形あわせ：板を2x2
      const g = [ {{id: 5, n: 1, d: 0}}, {{id: 5, n: 1, d: 0}}, {{id: 5, n: 1, d: 0}}, {{id: 5, n: 1, d: 0}} ];
      out.push('grid2x2 -> ' + (k.matchGrid(g, 2) ? k.ITEMS[k.matchGrid(g, 2).out].name : null));
      const pk = [ {{id: 4, n: 1}}, {{id: 4, n: 1}}, {{id: 4, n: 1}}, null, {{id: 256, n: 1}}, null, null, {{id: 256, n: 1}}, null ];
      out.push('pick grid -> ' + (k.matchGrid(pk, 3) ? k.ITEMS[k.matchGrid(pk, 3).out].name : null));
      const ax = [ null, {{id: 19, n: 1}}, {{id: 19, n: 1}}, null, {{id: 256, n: 1}}, {{id: 19, n: 1}}, null, {{id: 256, n: 1}}, null ];
      out.push('axe mirrored -> ' + (k.matchGrid(ax, 3) ? k.ITEMS[k.matchGrid(ax, 3).out].name : null));
      out.push('inv: ' + p.inv.filter(x => x).map(x => k.ITEMS[x.id].name + 'x' + x.n).join(', '));
      out.push('ach: ' + Object.keys(k.game.ach).join(','));
      return out; }}""")
    for l in r: print(' ', l)
    await s.wait(600)
    await s.shot('inv')
    await s.ev(f"() => {K}.ui.close(true)")
    # C: 作業台を置く
    r = await s.ev(f"""() => {{ const k = {K}, p = k.player; const i = p.inv.findIndex(x => x && x.id === k.B.crafting_table); if (i < 0) return 'no table'; const t = p.inv[i]; p.inv[i] = p.inv[1]; p.inv[1] = t; p.sel = 1; p.pitch = -0.9; p.yaw = 0.2; p.invDirty = true; return 'ok'; }}""")
    await s.wait(300)
    await s.pg.mouse.click(640, 360, button='right')
    await s.wait(400)
    t2 = await s.ev(f"() => {{ const t = {K}.player.target; return t ? [t.x, t.y, t.z, {K}.BLOCKS[t.id].name] : null; }}")
    print('placed, now target', t2)
    await s.shot('placed')
    # 使う（作業台を開く）
    await s.pg.mouse.click(640, 360, button='right')
    await s.wait(500)
    print('screen', await s.ev(f"() => {K}.ui.screen"))
    await s.shot('table')
    s.dump()
    await s.close()
asyncio.run(main())
