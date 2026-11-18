import asyncio, sys, json
sys.path.insert(0, __import__('os').path.dirname(__import__('os').path.abspath(__file__)))
from mplib import Mp, K
HASH = f"""(a) => {{ const w = {K}.game.world; let h = 0, n = 0; for (let y = a[1] - 6; y <= a[1] + 8; y++) for (let z = a[2] - 10; z <= a[2] + 10; z++) for (let x = a[0] - 10; x <= a[0] + 10; x++) {{ const v = w.getBlock(x, y, z) | (w.getMeta(x, y, z) << 8); h = (Math.imul(h, 31) + v) | 0; if (v) n++; }} return [h, n]; }}"""
async def main():
    m = await Mp().start(2)
    await m.ev(0, f"() => {{ {K}.game.startNew('みんなの島', '12345', 0, 2, true, {{}}); }}")
    await m.playing(0)
    code = await m.ev(0, f"() => {K}.net.code")
    await m.ev(1, f"(c) => {{ {K}.game.joinOnline(c); }}", code)
    await m.playing(1); await m.wait(1500)
    base = await m.ev(0, f"() => {{ const p = {K}.player; return [Math.floor(p.x), Math.floor(p.y), Math.floor(p.z)]; }}")
    print('base', base, 'hash0', await m.ev(0, HASH, base), 'hash1', await m.ev(1, HASH, base))
    # 1) ブロックを置く・こわす（両方向）
    await m.ev(0, f"(a) => {{ const w = {K}.game.world, B = {K}.B; for (let i = 0; i < 5; i++) w.setBlock(a[0] + 2 + i, a[1] + 1, a[2] + 2, B.planks_oak || B.cobble, 0); w.setBlock(a[0] + 2, a[1] - 1, a[2] + 3, 0, 0); }}", base)
    await m.ev(1, f"(a) => {{ const w = {K}.game.world, B = {K}.B; for (let i = 0; i < 5; i++) w.setBlock(a[0] - 2 - i, a[1] + 2, a[2] - 2, B.glass, 0); }}", base)
    await m.wait(900)
    print('1 blocks  hash0', await m.ev(0, HASH, base), 'hash1', await m.ev(1, HASH, base))
    # 2) 水を流す（結果は置いた人の端末が計算して送る）
    await m.ev(0, f"(a) => {{ const w = {K}.game.world, B = {K}.B; w.setBlock(a[0] + 4, a[1] + 3, a[2] - 4, B.water, 0); }}", base)
    await m.wait(5000)
    h0 = await m.ev(0, HASH, base); h1 = await m.ev(1, HASH, base)
    print('2 water   hash0', h0, 'hash1', h1, 'same', h0 == h1)
    # 3) チェスト：p0 が置いて入れる → p1 に見える → p1 が1つ取る → p0 に反映
    await m.ev(0, f"(a) => {{ const w = {K}.game.world, B = {K}.B, I = {K}.I; const x = a[0] + 3, y = a[1] + 1, z = a[2] + 5; w.setBlock(x, y - 1, z, B.cobble, 0); w.setBlock(x, y, z, B.chest, 0); const e = {{ t: 'chest', items: new Array(27).fill(null) }}; e.items[0] = {{ id: I.coal, n: 12, d: 0 }}; e.items[5] = {{ id: I.iron_pick, n: 1, d: 7 }}; w.setEnt(x, y, z, e); }}", base)
    await m.wait(900)
    print('3 chest p1 sees', await m.ev(1, f"(a) => {{ const e = {K}.game.world.getEnt(a[0] + 3, a[1] + 1, a[2] + 5); return e ? [e.t, JSON.stringify(e.items.filter(s => s))] : null; }}", base))
    await m.ev(1, f"(a) => {{ const w = {K}.game.world, e = w.getEnt(a[0] + 3, a[1] + 1, a[2] + 5); e.items[0].n -= 5; e.items[9] = {{ id: {K}.B.dirt, n: 3, d: 0 }}; w.touch(a[0] + 3, a[1] + 1, a[2] + 5); }}", base)
    await m.wait(900)
    print('3 chest p0 sees', await m.ev(0, f"(a) => {{ const e = {K}.game.world.getEnt(a[0] + 3, a[1] + 1, a[2] + 5); return e ? JSON.stringify(e.items.filter(s => s)) : null; }}", base))
    # 4) かまど：p0 が置いて燃やす → p1 に見える
    await m.ev(0, f"(a) => {{ const w = {K}.game.world, B = {K}.B, I = {K}.I; const x = a[0] + 5, y = a[1] + 1, z = a[2] + 5; w.setBlock(x, y - 1, z, B.cobble, 0); w.setBlock(x, y, z, B.furnace, 0); w.setEnt(x, y, z, {{ t: 'furnace', in: {{ id: B.ore_iron, n: 3, d: 0 }}, fuel: {{ id: I.coal, n: 2, d: 0 }}, out: null, burn: 0, burnMax: 0, cook: 0 }}); }}", base)
    await m.wait(12500)
    for i in (0, 1):
        print('4 furnace p%d' % i, await m.ev(i, f"(a) => {{ const w = {K}.game.world, e = w.getEnt(a[0] + 5, a[1] + 1, a[2] + 5); return e ? [JSON.stringify([e.in, e.fuel, e.out]), e.burn, e.cook, w.getBlock(a[0] + 5, a[1] + 1, a[2] + 5)] : null; }}", base))
    # 5) 生き物：p0 がヒツジを出す → p1 に影 → p1 がたたく → p0 の体力がへる
    await m.ev(0, f"(a) => {{ const e = {K}.spawnMob('sheep', a[0] + 1.5, a[1] + 1, a[2] - 2.5); window.__sheep = e; }}", base)
    await m.wait(1200)
    print('5 mob p1 puppets', await m.ev(1, f"() => {K}.ents.filter(e => e.kind === 'mob').map(e => [e.type, !!e.remote, +e.x.toFixed(1), +e.z.toFixed(1), e.hp])"))
    await m.ev(1, f"() => {{ const e = {K}.ents.find(e => e.kind === 'mob' && e.type === 'sheep' && e.remote); if (e) {K}.hurtMob(e, 3, {K}.player.x, {K}.player.z, 5.5); }}")
    await m.wait(900)
    print('5 mob p0 hp', await m.ev(0, "() => window.__sheep ? [window.__sheep.hp, window.__sheep.dead, window.__sheep.lastBy ? 'by-peer' : ''] : null"))
    print('5 mob p1 sees hp', await m.ev(1, f"() => {K}.ents.filter(e => e.kind === 'mob' && e.type === 'sheep').map(e => [e.hp, !!e.remote])"))
    # 6) 落とし物：p0 が落とす → p1 が近づいて拾う
    await m.ev(0, f"(a) => {{ {K}.spawnDrop(a[0] - 3.5, a[1] + 1, a[2] + 3.5, {K}.I.diamond, 4, 0, 0, 0, 0, 0); }}", base)
    await m.wait(1000)
    await m.ev(1, f"(a) => {{ const p = {K}.player; p.x = a[0] - 3.5; p.z = a[2] + 3.5; p.y = a[1] + 0.2; {K}.game.needSafeSpot = 2; }}", base)
    await m.wait(1500)
    print('6 pick p1 inv', await m.ev(1, f"() => {K}.player.inv.filter(s => s).map(s => [s.id, s.n])"), 'p0 items left', await m.ev(0, f"() => {K}.ents.filter(e => e.kind === 'item').length"))
    for t in range(10):   # 水などが動き終わって、2人の世界が同じになるまで待つ
        h0 = await m.ev(0, HASH, base); h1 = await m.ev(1, HASH, base)
        if h0 == h1: break
        await m.wait(4000)
    print('end hash0', h0, 'hash1', h1, 'same', h0 == h1)
    print('errs', [e for e in m.errs() if '404' not in e][:8])
    await m.close()
asyncio.run(main())
