import asyncio, sys, json
sys.path.insert(0, __import__('os').path.dirname(__import__('os').path.abspath(__file__)))
from mplib import Mp, K
NEAR = f"""(a) => {{ let b = null, bd = 1e9; for (const e of {K}.ents) {{ if (e.kind !== 'mob' || e.type !== a[3]) continue; const d = Math.hypot(e.x - a[0], e.z - a[2]); if (d < bd) {{ bd = d; b = e; }} }} window.__t = b; return b ? [b.type, !!b.remote, +b.x.toFixed(1), +b.y.toFixed(1), +b.z.toFixed(1), b.hp, +bd.toFixed(1)] : null; }}"""
async def main():
    lag = int(sys.argv[1]) if len(sys.argv) > 1 else 0
    m = await Mp().start(2, lag=lag)
    await m.ev(0, f"() => {{ {K}.game.startNew('みんなの島', '777', 0, 2, true, {{ mobs: false }}); }}")
    await m.playing(0)
    code = await m.ev(0, f"() => {K}.net.code")
    await m.ev(1, f"(c) => {{ {K}.game.joinOnline(c); }}", code)
    await m.playing(1); await m.wait(1500)
    base = await m.ev(0, f"() => {{ const p = {K}.player; return [Math.floor(p.x), Math.floor(p.y), Math.floor(p.z)]; }}")
    print('rules p1', await m.ev(1, f"() => JSON.stringify({K}.game.rules)"), 'own', await m.ev(0, f"() => {K}.net.own"), await m.ev(1, f"() => {K}.net.own"))
    # 5) p0 がウシを出す → p1 がたたく → 倒す → 落とし物は p0 の持ち物として出る → 倒した数は p1 につく
    await m.ev(0, f"(a) => {{ {K}.spawnMob('cow', a[0] + 2.5, a[1] + 1, a[2] - 1.5); }}", base)
    await m.wait(1200)
    q = [base[0] + 2.5, 0, base[2] - 1.5, 'cow']
    print('5 p1 sees', await m.ev(1, NEAR, q))
    for k in range(6):
        await m.ev(1, f"() => {{ const e = window.__t; if (e && !e.dead) {K}.hurtMob(e, 3, {K}.player.x, {K}.player.z, 2); }}")
        await m.wait(700)
    await m.wait(1500)
    print('5 p0 cow', await m.ev(0, NEAR, q), 'p1 cow', await m.ev(1, NEAR, q))
    print('5 kills p0/p1', await m.ev(0, f"() => {K}.player.stats.kills"), await m.ev(1, f"() => {K}.player.stats.kills"))
    print('5 drops on p0', await m.ev(0, f"() => {K}.ents.filter(e => e.kind === 'item').map(e => [e.id, e.n, !!e.remote])"), 'on p1', await m.ev(1, f"() => {K}.ents.filter(e => e.kind === 'item').map(e => [e.id, e.n, !!e.remote])"))
    # 7) 持ち主を近い人に移す：p0 の近くで出したヒツジを、p1 だけが近くにいる場所へ（p0 は遠くへ）
    await m.ev(0, f"(a) => {{ window.__s = {K}.spawnMob('sheep', a[0] - 2.5, a[1] + 1, a[2] - 2.5); }}", base)
    await m.wait(800)
    await m.ev(0, f"(a) => {{ const p = {K}.player; p.x = a[0] + 44; p.z = a[2] + 3; {K}.game.needSafeSpot = 1; }}", base)
    await m.wait(4000)
    q2 = [base[0] - 2.5, 0, base[2] - 2.5, 'sheep']
    print('7 handover p0', await m.ev(0, NEAR, q2), 'p1', await m.ev(1, NEAR, q2))
    # 8) p0 が抜ける → p0 の持ち物（落とし物）と生き物を p1 が引き取る
    await m.ev(0, f"() => {{ {K}.spawnDrop({K}.player.x + 1, {K}.player.y + 1, {K}.player.z, {K}.I.coal, 9, 0, 0, 0, 0, 0); window.__c = {K}.spawnMob('chicken', {K}.player.x + 2, {K}.player.y + 1, {K}.player.z); }}")
    await m.ev(1, f"(a) => {{ const p = {K}.player; p.x = a[0] + 40; p.z = a[2] + 3; {K}.game.needSafeSpot = 1; }}", base)
    await m.wait(2500)
    print('8 before leave p1', await m.ev(1, f"() => [{K}.net.peers.size, {K}.ents.filter(e => e.remote).length, {K}.ents.filter(e => !e.remote).length]"))
    await m.ev(0, f"() => {{ {K}.game.quitToTitle(); }}")
    await m.wait(2500)
    print('8 after leave p1', await m.ev(1, f"() => [{K}.net.peers.size, {K}.ents.filter(e => e.remote).length, {K}.ents.filter(e => !e.remote).map(e => e.kind + ':' + (e.type || e.id))]"))
    print('8 server a/al', await m.ev(1, "() => firebase.__dump().then(t => { const w = Object.values(t.np.block.w)[0]; return [JSON.stringify(w.a || null).slice(0, 300), JSON.stringify(w.al || null).slice(0, 200), Object.keys(w.pl || {}).length]; })"))
    # 9) p0 が入りなおす：置いたブロック・持ち物がもどる
    await m.ev(0, f"(c) => {{ {K}.game.joinOnline(c); }}", code)
    await m.playing(0); await m.wait(2000)
    print('9 rejoin p0', await m.ev(0, f"() => [{K}.net.peers.size, {K}.player.x.toFixed(1), {K}.player.z.toFixed(1), {K}.ents.filter(e => e.remote).length]"))
    print('errs', [e for e in m.errs() if '404' not in e][:8])
    await m.close()
asyncio.run(main())
