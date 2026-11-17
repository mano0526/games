import asyncio, sys, json
sys.path.insert(0, __import__('os').path.dirname(__import__('os').path.abspath(__file__)))
from mplib import Mp, K
NEAR = f"""(a) => {{ let b = null, bd = 1e9; for (const e of {K}.ents) {{ if (e.kind !== 'mob' || e.type !== a[3] || e.dead) continue; const d = Math.hypot(e.x - a[0], e.z - a[2]); if (d < bd) {{ bd = d; b = e; }} }} window.__t = b; return b ? [b.type, !!b.remote, +b.x.toFixed(1), +b.y.toFixed(1), +b.z.toFixed(1), b.hp, +bd.toFixed(1)] : null; }}"""
async def main():
    lag = int(sys.argv[1]) if len(sys.argv) > 1 else 0
    m = await Mp().start(2, lag=lag)
    await m.ev(0, f"() => {{ {K}.game.startNew('みんなの島', '777', 0, 2, true, {{ mobs: false }}); }}")
    await m.playing(0)
    code = await m.ev(0, f"() => {K}.net.code")
    await m.ev(1, f"(c) => {{ {K}.game.joinOnline(c); }}", code)
    await m.playing(1); await m.wait(1500)
    base = await m.ev(0, f"() => {{ const p = {K}.player; return [Math.floor(p.x), Math.floor(p.y), Math.floor(p.z)]; }}")
    print('fps', await m.ev(0, f"() => {K}.game.fps"), await m.ev(1, f"() => {K}.game.fps"))
    # 5) p0 のウシを p1 が倒す
    await m.ev(0, f"(a) => {{ {K}.spawnMob('cow', a[0] + 2.5, a[1] + 1, a[2] - 1.5); }}", base)
    await m.wait(1500)
    q = [base[0] + 2.5, 0, base[2] - 1.5, 'cow']
    print('5 p1 sees', await m.ev(1, NEAR, q))
    hits = 0
    for k in range(40):
        r = await m.ev(1, f"() => {{ const e = window.__t; if (!e || e.dead || e.hp <= 0) return 'gone'; if (e.hurt > 0) return 'wait'; return {K}.hurtMob(e, 3, {K}.player.x, {K}.player.z, 1) ? 'hit' : 'no'; }}")
        if r == 'hit': hits += 1
        if r == 'gone': break
        await m.wait(350)
    for k in range(40):
        if await m.ev(0, NEAR, q) is None: break
        await m.wait(400)
    await m.wait(1500)
    print('5 hits', hits, 'kills p0/p1', await m.ev(0, f"() => {K}.player.stats.kills"), await m.ev(1, f"() => {K}.player.stats.kills"))
    nm = f"() => {K}.ents.filter(e => e.kind === 'item').map(e => [{K}.ITEMS[e.id].name, e.n, !!e.remote])"
    print('5 cow left p0', await m.ev(0, NEAR, q), 'drops p0', await m.ev(0, nm), 'p1', await m.ev(1, nm))
    # 10) 時刻：両方ほぼ同じ → p0（時計係かどうかにかかわらず）両方ベッドに入ると朝になる
    for i in (0, 1): print('10 time p%d' % i, await m.ev(i, f"() => [{K}.game.world.time, {K}.game.world.day, {K}.net.isFirst()]"))
    # 夜にする（時計係が書く）
    k = 0 if await m.ev(0, f"() => {K}.net.isFirst()") else 1
    await m.ev(k, f"() => {{ {K}.game.world.time = 14000; {K}.net.writeTime(); }}")
    await m.wait(1500)
    for i in (0, 1): print('10 night p%d' % i, await m.ev(i, f"() => [{K}.game.world.time, {K}.game.world.day, {K}.game.world.isNight()]"))
    # ベッドを置いて、p0 だけ入る → まだ夜。p1 も入る → 朝
    await m.ev(0, f"(a) => {{ const w = {K}.game.world, B = {K}.B; for (let i = 0; i < 2; i++) {{ const x = a[0] + 3 + i * 3, y = a[1] + 1, z = a[2] + 3; w.setBlock(x, y - 1, z, B.cobble, 0); w.setBlock(x, y - 1, z + 1, B.cobble, 0); w.setBlock(x, y, z, B.bed, 2, 1); w.setBlock(x, y, z + 1, B.bed, 2 | 4, 1); }} }}", base)
    await m.wait(800)
    bed = f"(a) => {{ const w = {K}.game.world, x = a[0], y = a[1], z = a[2]; {K}.game.sleep({{ x, y, z, id: w.getBlock(x, y, z), meta: w.getMeta(x, y, z) }}); return [{K}.game.inBed, {K}.player.x, {K}.player.y, {K}.player.z, {K}.player.yaw.toFixed(2)]; }}"
    print('10 p0 bed', await m.ev(0, bed, [base[0] + 3, base[1] + 1, base[2] + 3]))
    await m.wait(2500)
    print('10 only p0 asleep', await m.ev(0, f"() => [{K}.game.inBed, {K}.game.world.time, document.getElementById('sleepNote').textContent]"), 'p1 sees p0 sleeping', await m.ev(1, f"() => [...{K}.net.peers.values()].map(p => p.sleeping)"))
    await m.shot(1, 'mp5_sleep')
    print('10 p1 bed', await m.ev(1, bed, [base[0] + 6, base[1] + 1, base[2] + 3]))
    for k in range(30):
        if not await m.ev(0, f"() => {K}.game.inBed"): break
        await m.wait(500)
    await m.wait(1500)
    for i in (0, 1): print('10 morning p%d' % i, await m.ev(i, f"() => [{K}.game.inBed, {K}.game.world.time, {K}.game.world.day, {K}.player.hp]"))
    # 11) 通信が切れる → もどる
    await m.ev(1, "() => firebase.__offline()")
    await m.ev(1, f"(a) => {{ {K}.game.world.setBlock(a[0] - 4, a[1] + 3, a[2] - 4, {K}.B.cobble, 0); }}", base)
    await m.ev(0, f"(a) => {{ {K}.game.world.setBlock(a[0] - 5, a[1] + 3, a[2] - 4, {K}.B.glass, 0); }}", base)
    await m.wait(2500)
    print('11 offline: p0 peers', await m.ev(0, f"() => {K}.net.peers.size"), 'p1 badge', await m.ev(1, "() => document.getElementById('netBadge').textContent"), 'p1 sees glass', await m.ev(1, f"(a) => {K}.game.world.getBlock(a[0] - 5, a[1] + 3, a[2] - 4)", base))
    await m.ev(1, "() => firebase.__online()")
    await m.wait(3000)
    print('11 online: p0 peers', await m.ev(0, f"() => {K}.net.peers.size"), 'p1 peers', await m.ev(1, f"() => {K}.net.peers.size"), 'p1 badge', await m.ev(1, "() => document.getElementById('netBadge').textContent"),
          'p1 sees glass', await m.ev(1, f"(a) => {K}.game.world.getBlock(a[0] - 5, a[1] + 3, a[2] - 4)", base), 'p0 sees cobble', await m.ev(0, f"(a) => {K}.game.world.getBlock(a[0] - 4, a[1] + 3, a[2] - 4)", base))
    print('errs', [e for e in m.errs() if '404' not in e][:8])
    await m.close()
asyncio.run(main())
