import asyncio, sys, json, random
sys.path.insert(0, __import__('os').path.dirname(__import__('os').path.abspath(__file__)))
from mplib import Mp, K
HASH = f"""(a) => {{ const w = {K}.game.world; let h = 0, n = 0; for (let y = a[1] - 8; y <= a[1] + 10; y++) for (let z = a[2] - 14; z <= a[2] + 14; z++) for (let x = a[0] - 14; x <= a[0] + 14; x++) {{ const v = w.getBlock(x, y, z) | (w.getMeta(x, y, z) << 8); h = (Math.imul(h, 31) + v) | 0; if (v) n++; }} return [h, n]; }}"""
async def main():
    lag = int(sys.argv[1]) if len(sys.argv) > 1 else 150
    m = await Mp().start(3, lag=lag)
    await m.ev(0, f"() => {{ {K}.game.startNew('みんなの島', '9001', 1, 2, true, {{}}); }}")
    await m.playing(0)
    code = await m.ev(0, f"() => {K}.net.code")
    for i in (1, 2):
        await m.ev(i, f"(c) => {{ {K}.game.joinOnline(c); }}", code)
        await m.playing(i)
    await m.wait(2500)
    base = await m.ev(0, f"() => {{ const p = {K}.player; return [Math.floor(p.x), Math.floor(p.y), Math.floor(p.z)]; }}")
    print('peers', [await m.ev(i, f"() => [...{K}.net.peers.values()].map(p => p.name + ':' + p.slot).join(',')") for i in range(3)])
    # 3人がばらばらに、同じ場所あたりを30回ずつ変える（置く・こわす・水・砂）
    rnd = random.Random(5)
    EDIT = f"""(a) => {{ const w = {K}.game.world, B = {K}.B; const ids = [B.cobble, B.glass, 0, B.sand, 0, B.planks_oak || B.cobble, B.water, 0, B.torch]; w.setBlock(a[0], a[1], a[2], ids[a[3] % ids.length], 0); }}"""
    for k in range(40):
        for i in range(3):
            x = base[0] + rnd.randint(-8, 8); y = base[1] + rnd.randint(0, 6); z = base[2] + rnd.randint(-8, 8)
            await m.ev(i, EDIT, [x, y, z, rnd.randint(0, 50)])
        if k % 10 == 9: await m.wait(400)
    # 水が流れ終わるまで待つ（場所によって長さがちがうので、時間ではなく「3人とも同じになったか」で待つ）
    for t in range(12):
        await m.wait(5000)
        hs = [await m.ev(i, HASH, base) for i in range(3)]
        if hs[0] == hs[1] == hs[2]: break
    print('hash', hs, 'same', hs[0] == hs[1] == hs[2])
    if not (hs[0] == hs[1] == hs[2]):
        # どこがちがうか
        CELLS = f"""(a) => {{ const w = {K}.game.world, o = []; for (let y = a[1] - 8; y <= a[1] + 10; y++) for (let z = a[2] - 14; z <= a[2] + 14; z++) for (let x = a[0] - 14; x <= a[0] + 14; x++) o.push(w.getBlock(x, y, z) | (w.getMeta(x, y, z) << 8)); return o; }}"""
        cs = [await m.ev(i, CELLS, base) for i in range(3)]
        dif = [(j, cs[0][j], cs[1][j], cs[2][j]) for j in range(len(cs[0])) if not (cs[0][j] == cs[1][j] == cs[2][j])]
        print('differs', len(dif), dif[:12])
        # 中継サーバーにある値・各ページが覚えている値と比べる
        INFO = f"""(a) => {{ const n = {K}.net, w = {K}.game.world, out = []; for (const j of a.idx) {{ const dx = j % 29, r = (j - dx) / 29, dz = r % 29, dy = (r - dz) / 29; const x = a.b[0] - 14 + dx, y = a.b[1] - 8 + dy, z = a.b[2] - 14 + dz; const reg = n.regions.get('0_' + (x >> 6) + '_' + (z >> 6)); const m = reg && reg.cells.get(w.key(x >> 4, z >> 4)); const sv = m ? m.get((y << 8) | ((z & 15) << 4) | (x & 15)) : undefined; out.push([x, y, z, w.getBlock(x, y, z) | (w.getMeta(x, y, z) << 8), sv === undefined ? null : sv]); }} return out; }}"""
        idx = [d[0] for d in dif[:10]]
        for i in range(3): print(' p%d local/store' % i, await m.ev(i, INFO, {'idx': idx, 'b': base}))
        SRV = """(a) => firebase.__dump().then(t => { const w = Object.values(t.np.block.w)[0], out = []; for (const [x, y, z] of a) { const r = (w.c || {})['0_' + (x >> 6) + '_' + (z >> 6)] || {}; const v = r['c' + ((y << 12) | ((z & 63) << 6) | (x & 63)).toString(36)]; out.push(v === undefined ? null : v); } return out; })"""
        cells = [[c[0], c[1], c[2]] for c in await m.ev(0, INFO, {'idx': idx, 'b': base})]
        print(' server', await m.ev(0, SRV, cells))
    print('times', [await m.ev(i, f"() => {K}.game.world.time") for i in range(3)], 'ents', [await m.ev(i, f"() => [{K}.ents.filter(e => !e.remote).length, {K}.ents.filter(e => e.remote).length]") for i in range(3)])
    print('errs', [e for e in m.errs() if '404' not in e][:8])
    await m.close()
asyncio.run(main())
