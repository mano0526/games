import asyncio, sys, json
sys.path.insert(0, __import__('os').path.dirname(__import__('os').path.abspath(__file__)))
from mplib import Mp, K
NEAR = f"""(a) => {{ let b = null, bd = 1e9; for (const e of {K}.ents) {{ if (e.kind !== 'mob' || e.type !== a[3] || e.dead) continue; const d = Math.hypot(e.x - a[0], e.z - a[2]); if (d < bd) {{ bd = d; b = e; }} }} window.__t = b; return b ? [b.type, !!b.remote, +b.x.toFixed(1), +b.y.toFixed(1), +b.z.toFixed(1), b.hp, +bd.toFixed(1)] : null; }}"""
async def main():
    m = await Mp().start(2)
    await m.ev(0, f"() => {{ {K}.game.startNew('みんなの島', '777', 0, 2, true, {{ mobs: false }}); }}")
    await m.playing(0)
    code = await m.ev(0, f"() => {K}.net.code")
    await m.ev(1, f"(c) => {{ {K}.game.joinOnline(c); }}", code)
    await m.playing(1); await m.wait(1500)
    base = await m.ev(0, f"() => {{ const p = {K}.player; return [Math.floor(p.x), Math.floor(p.y), Math.floor(p.z)]; }}")
    await m.ev(0, f"(a) => {{ window.__cow = {K}.spawnMob('cow', a[0] + 2.5, a[1] + 1, a[2] - 1.5); const n = {K}.net, f = n.onDm; window.__dm = []; n.onDm = function (raw) {{ window.__dm.push(raw); return f.call(this, raw); }}; }}", base)
    await m.wait(1500)
    q = [base[0] + 2.5, 0, base[2] - 1.5, 'cow']
    print('p1 sees', await m.ev(1, NEAR, q))
    for k in range(8):
        r = await m.ev(1, f"() => {{ const e = window.__t; if (!e || e.dead || e.hp <= 0) return 'gone'; if (e.hurt > 0) return 'wait'; return [{K}.hurtMob(e, 3, {K}.player.x, {K}.player.z, 1) ? 'hit' : 'no', e.rnid, !!e.remote, e.hp]; }}")
        await m.wait(500)
        print(k, r, 'p0:', await m.ev(0, "() => { const c = window.__cow; return [c.nid, c.hp, c.hurt, c.dead, !!c.remote, window.__dm.length, window.__dm[window.__dm.length - 1]]; }"))
    await m.close()
asyncio.run(main())
