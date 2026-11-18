# 手に持った物の見え方を ならべて見る（自分の目線・前から・うしろから）
import asyncio, sys, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from lib import Sess
from PIL import Image
K = "window.__kk"
ITEMS = sys.argv[2].split(',') if len(sys.argv) > 2 else ['iron_pick', 'iron_sword', 'iron_axe', 'iron_shovel', 'iron_hoe', 'bow', 'shears', 'flint_steel', 'bucket', 'stick', 'torch', 'bread', 'stone', 'stairs', 'slab', 'fence', 'door', 'lantern', 'glass_pane', 'sign', 'carpet', 'wheat_seeds', 'shield', 'arrow']
OUT = sys.argv[1] if len(sys.argv) > 1 else 'hold'
async def main():
    s = await Sess().start(1280, 720)
    await s.ev(f"() => {{ const st = {K}.settings; st.viewDist = 3; st.music = 0; st.showInfo = false; st.minimap = false; st.bobbing = false; }}")
    await s.new_world('9753', mode=0, diff=0)
    await s.wait(1000)
    await s.ev(f"""() => {{ const k = {K}, w = k.world, B = k.B, p = k.player; const o = [Math.floor(p.x), Math.floor(p.y) + 14, Math.floor(p.z)];
      for (let z = -8; z <= 8; z++) for (let x = -8; x <= 8; x++) {{ w.setBlock(o[0] + x, o[1] - 1, o[2] + z, B.grass, 0); for (let y = o[1]; y < o[1] + 7; y++) w.setBlock(o[0] + x, y, o[2] + z, 0, 0); }}
      for (const e of k.ents) e.dead = true; p.x = o[0] + 0.5; p.y = o[1] + 0.01; p.z = o[2] + 0.5; p.yaw = 0.6; p.pitch = -0.05; w.time = 6000; k.game.rules.day = true;
      document.querySelectorAll('#toast,#hint,#tip').forEach(e => e.style.display = 'none'); }}""")
    await s.wait(500)
    rows = []
    for name in ITEMS:
        ok = await s.pg.evaluate(f"""(name) => {{ const k = {K}, p = k.player; let id = k.I[name]; if (id === undefined) id = k.B[name];
          if (id === undefined) {{ const key = Object.keys(k.B).find(q => q.startsWith(name)) || Object.keys(k.I).find(q => q.startsWith(name)); id = k.B[key] !== undefined ? k.B[key] : k.I[key]; }}
          if (id === undefined) return null; p.inv.fill(null); p.inv[0] = {{ id, n: 1, d: 0 }}; p.sel = 0; p.invDirty = true; p.equipT = 0; k.settings.view = 0; return k.ITEMS[id].name; }}""", name)
        if not ok: print('なし', name); continue
        await s.wait(350); await s.pg.screenshot(path='/tmp/kk/_h0.png')
        await s.ev(f"() => {{ {K}.settings.view = 2; }}"); await s.wait(250); await s.pg.screenshot(path='/tmp/kk/_h1.png')
        await s.ev(f"() => {{ {K}.R.dbgYaw = 1.35; }}"); await s.wait(250); await s.pg.screenshot(path='/tmp/kk/_h2.png'); await s.ev(f"() => {{ {K}.R.dbgYaw = 0; }}")
        a = Image.open('/tmp/kk/_h0.png').resize((373, 210))
        b = Image.open('/tmp/kk/_h1.png').crop((500, 290, 780, 620)).resize((178, 210))
        c = Image.open('/tmp/kk/_h2.png').crop((500, 290, 780, 620)).resize((178, 210))
        row = Image.new('RGB', (735, 210), (20, 20, 20)); row.paste(a, (0, 0)); row.paste(b, (375, 0)); row.paste(c, (555, 0)); rows.append(row)
    per = 6
    for i in range(0, len(rows), per):
        chunk = rows[i:i + per]; im = Image.new('RGB', (735 * 2 + 4, 212 * ((len(chunk) + 1) // 2)), (0, 0, 0))
        for j, r in enumerate(chunk): im.paste(r, ((j % 2) * 739, (j // 2) * 212))
        im.save(f'/tmp/kk/{OUT}_{i // per}.png')
    print('枚数', (len(rows) + per - 1) // per, [l for l in s.logs if 'PAGEERROR' in l][:3])
    await s.close()
asyncio.run(main())
