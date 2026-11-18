# みんなの世界での「べつの世界」：門の共有・行き来・べつの世界にいる人は見えない・ボスの共有
import asyncio, sys, json
sys.path.insert(0, __import__('os').path.dirname(__import__('os').path.abspath(__file__)))
from mplib import Mp, K
ok_all = True
def check(name, cond, extra=''):
    global ok_all
    print(('OK  ' if cond else 'NG  ') + name, extra)
    if not cond: ok_all = False
async def poll(m, i, js, cond, n=60, ms=400, arg=None):
    r = None
    for _ in range(n):
        r = await m.ev(i, js, arg) if arg is not None else await m.ev(i, js)
        if cond(r): break
        await m.wait(ms)
    return r
async def dim_is(m, i, d, timeout=120000):
    await m.pg[i].wait_for_function(f"{K}.world && {K}.world.dim === {d} && {K}.game.state === 'playing'", timeout=timeout)
async def main():
    m = await Mp().start(2)
    await m.ev(0, f"() => {{ {K}.game.startNew('門の島', '9753', 1, 2, true, {{}}); }}")
    await m.playing(0)
    code = await m.ev(0, f"() => {K}.net.code")
    await m.ev(1, f"(c) => {{ {K}.game.joinOnline(c); }}", code)
    await m.playing(1); await m.wait(2500)
    v = await m.ev(0, f"() => [{K}.net.meta.v, {K}.NET_VER]")
    check('通信の版', v[0] == v[1] == 3, v)
    # 1. A が門をひらく → B にも門と一覧が届く
    g = await m.ev(0, f"""() => {{ const k = {K}, w = k.world, B = k.B, p = k.player; const x = Math.floor(p.x) + 3, z = Math.floor(p.z), y = Math.floor(p.y) + 3;
      for (let dx = -1; dx <= 2; dx++) for (let dy = -1; dy <= 3; dy++) {{ const edge = dx === -1 || dx === 2 || dy === -1 || dy === 3; w.setBlock(x + dx, y + dy, z, edge ? B.obsidian : 0, 0); }}
      p.useLighter(w, {{ x: x, y: y - 1, z: z, nx: 0, ny: 1, nz: 0, id: B.obsidian, meta: 0, t: 2 }}); window.__g = [x, y, z]; return [x, y, z]; }}""")
    await m.ev(1, "(g) => { window.__g = g; }", g)
    r = await poll(m, 1, f"() => {{ const k = {K}, g = window.__g; return [k.world.getBlock(g[0], g[1], g[2]) === k.B.homura_gate, k.world.getBlock(g[0] + 1, g[1] + 2, g[2]) === k.B.homura_gate, k.game.gates.size]; }}", lambda r: r == [True, True, 1])
    check('門と 門の一覧が 相手に届く', r == [True, True, 1], r)
    # 2. A がくぐる → ホムラの底。B からは A が見えなくなる
    await m.ev(0, f"() => {{ const p = {K}.player, g = window.__g; p.flying = true; p.vy = 0; p.x = g[0] + 0.5; p.y = g[1] + 0.05; p.z = g[2] + 0.5; }}")
    await dim_is(m, 0, 1)
    await m.wait(1500)
    a = await m.ev(0, f"() => {{ const k = {K}, p = k.player; return [k.world.dim, Math.floor(p.x), Math.floor(p.y), Math.floor(p.z), k.game.gates.size]; }}")
    r = await poll(m, 1, f"() => {{ const k = {K}; return [[...k.net.peers.values()].map(p => p.dim), k.game.gates.size]; }}", lambda r: r == [[1], 2])
    check('相手がどの世界にいるか分かる・着いた先の門も一覧に入る', a[0] == 1 and a[4] == 2 and r == [[1], 2], [a, r])
    # 3. 同じ座標でも、世界がちがえば まざらない
    await m.ev(0, f"() => {{ const k = {K}, p = k.player; window.__q = [Math.floor(p.x) + 2, Math.floor(p.y) + 4, Math.floor(p.z) + 2]; k.world.setBlock(window.__q[0], window.__q[1], window.__q[2], k.B.gold_block, 0); }}")
    q = await m.ev(0, "() => window.__q")
    await m.ev(1, f"(q) => {{ const k = {K}; k.world.setBlock(q[0], q[1] + 1, q[2], k.B.diamond_block, 0); window.__q = q; }}", q)
    await m.wait(2500)
    r0 = await m.ev(0, f"() => {{ const k = {K}, q = window.__q; return [k.world.getBlock(q[0], q[1], q[2]) === k.B.gold_block, k.world.getBlock(q[0], q[1] + 1, q[2]) === k.B.diamond_block]; }}")
    r1 = await m.ev(1, f"() => {{ const k = {K}, q = window.__q; return [k.world.getBlock(q[0], q[1], q[2]) === k.B.gold_block, k.world.getBlock(q[0], q[1] + 1, q[2]) === k.B.diamond_block]; }}")
    check('世界がちがえば ブロックの変更は まざらない', r0 == [True, False] and r1 == [False, True], [r0, r1])
    # 4. B もくぐる → A と同じ門に出る。おたがいが見える。A の置いたブロックが見える
    await m.ev(1, f"() => {{ const p = {K}.player, g = window.__g; p.flying = true; p.vy = 0; p.x = g[0] + 0.5; p.y = g[1] + 0.05; p.z = g[2] + 0.5; }}")
    await dim_is(m, 1, 1)
    r = await poll(m, 1, f"() => {{ const k = {K}, p = k.player, q = window.__q; return [k.game.gates.size, Math.floor(p.x), Math.floor(p.y), Math.floor(p.z), k.world.getBlock(q[0], q[1], q[2]) === k.B.gold_block, [...k.net.peers.values()].map(o => [o.dim, k.net.fresh(o)])]; }}", lambda r: r[4] and r[5] == [[1, True]])
    check('2人目も 同じ門に出る（門はふえない）・むこうのブロックが見える', r[0] == 2 and abs(r[1] - a[1]) <= 2 and r[2] == a[2] and abs(r[3] - a[3]) <= 2 and r[4] and r[5] == [[1, True]], [a, r])
    # 5. ホムラの底の生き物が 相手にも見える
    await m.ev(0, f"() => {{ const k = {K}, p = k.player; p.gateWait = true; p.x += 3; const e = k.spawnMob('magmadama', p.x + 2, p.y, p.z); window.__mob = e.nid; }}")
    r = await poll(m, 1, f"() => {K}.ents.filter(e => e.remote && e.kind === 'mob').map(e => e.type)", lambda r: 'magmadama' in r)
    check('ホムラの底の生き物が 相手にも見える', 'magmadama' in r, r)
    # 6. B が帰る → もとの門に出る。A の生き物の影は消える
    await m.ev(1, f"() => {{ const p = {K}.player; p.gateWait = false; }}")
    await dim_is(m, 1, 0)
    r = await poll(m, 1, f"() => {{ const k = {K}, p = k.player, g = window.__g; return [Math.round(Math.hypot(p.x - g[0] - 0.5, p.z - g[2] - 0.5)), k.ents.filter(e => e.remote).length, k.game.gates.size]; }}", lambda r: r[1] == 0, 20)
    check('帰りは もとの門・むこうの生き物は見えない', r[0] <= 1 and r[1] == 0 and r[2] == 2, r)
    # 7. ホムラの底でやめた人は、入り直すと そこから
    await m.ev(0, f"() => {K}.game.quitToTitle()")
    await m.pg[0].wait_for_function(f'{K}.game.state === "title"', timeout=30000)
    await m.ev(0, f"(c) => {{ {K}.game.joinOnline(c); }}", code)
    await m.playing(0); await m.wait(1500)
    r = await m.ev(0, f"() => {{ const k = {K}, q = window.__q; return [k.world.dim, k.world.getBlock(q[0], q[1], q[2]) === k.B.gold_block, k.game.gates.size]; }}")
    check('べつの世界でやめても、入り直すと そこから', r == [1, True, 2], r)
    # 8. ソラのはて：2人で入る。ボスは1体だけ。たおすと 2人とも「たおした」になる
    for i in (0, 1):
        await m.ev(i, f"() => {{ const k = {K}; k.player.gateWait = true; k.game.travel(2, 'sora'); }}")
        await dim_is(m, i, 2)
        await m.wait(1500)
    r = await poll(m, 0, f"() => {{ const k = {K}; return [k.ents.filter(e => e.kind === 'mob' && e.type === 'hoshikui' && !e.dead).map(e => !!e.remote), !!k.game.boss]; }}", lambda r: len(r[0]) == 1 and r[1], 40, 500)
    r2 = await poll(m, 1, f"() => {{ const k = {K}; return [k.ents.filter(e => e.kind === 'mob' && e.type === 'hoshikui' && !e.dead).map(e => !!e.remote), !!k.game.boss]; }}", lambda r: len(r[0]) == 1 and r[1], 40, 500)
    check('ボスは1体だけ（1人が動かし、もう1人には影が見える）', len(r[0]) == 1 and len(r2[0]) == 1 and r[0][0] != r2[0][0] and r[1] and r2[1], [r, r2])
    own = 0 if not r[0][0] else 1
    await m.wait(3000)
    # 影のほうから たたく → 持ち主の体力がへる
    hp0 = await m.ev(own, f"() => {K}.game.boss.hp")
    await m.ev(1 - own, f"() => {{ const k = {K}; k.hurtMob(k.game.boss, 30, k.player.x, k.player.z, 0); }}")
    hp1 = await poll(m, own, f"() => {K}.game.boss ? {K}.game.boss.hp : -1", lambda h: h <= hp0 - 25, 30, 300)
    check('影をたたくと 持ち主に伝わる', 0 < hp1 <= hp0 - 25, [hp0, hp1])
    await m.ev(own, f"() => {{ const k = {K}, w = k.world; for (const q of k.soraPillars()) w.setBlock(q.x, q.top + 2, q.z, 0, 0); const b = k.game.boss; b.hp = 2; b.hurt = 0; k.hurtMob(b, 10, k.player.x, k.player.z, 0); }}")
    rs = []
    for i in (0, 1):
        rs.append(await poll(m, i, f"() => {{ const k = {K}, w = k.world, Y = k.SORA_PED_Y; let n = 0; for (let dz = -2; dz <= 2; dz++) for (let dx = -2; dx <= 2; dx++) if (w.getBlock(dx, Y + 1, dz) === k.B.sora_gate) n++; return [k.game.soraDone, k.game.ended, n, !!(k.net.meta && k.net.meta.sora), k.ents.filter(e => e.type === 'hoshikui' && !e.dead).length]; }}", lambda r: r[0] and r[1] and r[2] == 20 and r[4] == 0, 80, 500))
    check('たおすと 2人とも「たおした」。かえりの門も 2人に見える', all(r[0] and r[1] and r[2] == 20 and r[3] and r[4] == 0 for r in rs), rs)
    errs = [e for e in m.errs() if '404' not in e]
    check('エラーなし', len(errs) == 0, errs[:6])
    await m.close()
    print('ALL OK' if ok_all else 'SOME NG')
asyncio.run(main())
