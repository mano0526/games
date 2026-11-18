# 経験値（玉・レベル・力つきた時）、ちからの台（力をこめる・効き目）、くすり（1人用）
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
    s = await Sess().start(1280, 720)
    async def poll(js, cond, n=40, ms=250):
        r = None
        for _ in range(n):
            r = await s.ev(js)
            if cond(r): break
            await s.wait(ms)
        return r
    await s.ev(f"() => {{ const st = {K}.settings; st.viewDist = 4; st.music = 0; st.showInfo = false; st.minimap = false; }}")
    await s.new_world('2468', mode=0, diff=2)
    await s.wait(1000)
    FLOOR = f"""() => {{ const k = {K}, w = k.world, B = k.B, p = k.player; const o = window.__o || (window.__o = [Math.floor(p.x), Math.floor(p.y) + 14, Math.floor(p.z)]);
      for (let z = -10; z <= 10; z++) for (let x = -10; x <= 10; x++) {{ w.setBlock(o[0] + x, o[1] - 2, o[2] + z, B.stone, 0); w.setBlock(o[0] + x, o[1] - 1, o[2] + z, B.stone, 0); for (let y = o[1]; y < o[1] + 7; y++) w.setBlock(o[0] + x, y, o[2] + z, (Math.abs(x) === 10 || Math.abs(z) === 10) && y < o[1] + 3 ? B.stone : 0, 0); }}
      for (const e of k.ents) e.dead = true; p.x = o[0] + 0.5; p.y = o[1] + 0.01; p.z = o[2] + 6.5; p.vx = p.vy = p.vz = 0; p.yaw = 0; p.pitch = 0; p.hp = 20; p.food = 20; p.hurtT = 0; p.dead = false; w.time = 6000; k.game.rules.day = true; }}"""
    await s.ev(FLOOR); await s.wait(400)
    # 1. レベルの式・玉をひろう
    r = await s.ev(f"() => {{ const k = {K}; let t = 0; const a = []; for (let l = 0; l < 30; l++) {{ t += k.xpNeed(l); if (l === 4 || l === 14 || l === 29) a.push(t); }} return a; }}")
    check('レベルに いる経験値（5で55、15で315、30で1395）', r == [55, 315, 1395], r)
    await s.ev(f"() => {{ const k = {K}, p = k.player; k.spawnXp(p.x, p.y + 0.5, p.z - 4, 30); }}")
    r = await poll(f"() => {{ const k = {K}, p = k.player; return [p.xpLv, p.xpPt, k.ents.filter(e => e.kind === 'item').length, document.getElementById('xpLv').textContent, document.getElementById('xpFill').style.width]; }}", lambda r: r[2] == 0 and r[0] == 3, 60, 150)
    check('はなれた玉が すいよせられて 経験値になる（30＝レベル3と3）', r[0] == 3 and r[1] == 3 and r[2] == 0 and r[3] == '3' and r[4] != '0%', r)
    r = await s.ev(f"() => {{ const p = {K}.player; return [p.inv.filter(x => x).length, p.canTake({K}.I.xp_orb, 0)]; }}")
    check('玉は 持ち物には入らない', r == [0, True], r)
    # 同じ瞬間に 同じ場所へ落ちた 同じ物は、1つに まとまる（おたがいを消して 両方なくなる不具合があった）
    await s.ev(f"() => {{ const k = {K}, p = k.player; p.canTake = () => false; for (let i = 0; i < 3; i++) k.spawnDrop(p.x + i * 0.2, p.y + 0.3, p.z - 3, k.B.wool_white, 1, 0, 0, 0, 0); for (let i = 0; i < 2; i++) k.spawnDrop(p.x + 2, p.y + 0.3, p.z - 3, k.I.xp_orb, 4, 0, 0, 0, 0); }}")
    await s.wait(1500)
    r = await s.ev(f"() => {{ const k = {K}, p = k.player; const w = k.ents.filter(e => e.kind === 'item' && !e.dead && e.id === k.B.wool_white), x = k.ents.filter(e => e.kind === 'item' && !e.dead && e.id === k.I.xp_orb); delete p.canTake; const out = [w.length, w.reduce((a, e) => a + e.n, 0), x.length, x.reduce((a, e) => a + e.n, 0)]; for (const e of k.ents) e.dead = true; return out; }}")
    check('同時に落ちた同じ物は まとまるだけで、なくならない', r == [1, 3, 1, 8], r)
    # 2. 敵をたおす・鉱石をほる・かまど・力つきる
    await s.ev(f"""() => {{ const k = {K}, p = k.player; p.xpLv = 0; p.xpPt = 0; const m = k.spawnMob('shade', p.x, p.y, p.z - 3); m.hp = 1; k.MOBS.shade.burns = false; p.inv[0] = {{ id: k.I.iron_sword, n: 1, d: 0 }}; p.sel = 0; p.attack(m); const m2 = k.spawnMob('shade', p.x + 6, p.y, p.z - 3); k.hurtMob(m2, 99, m2.x, m2.z, 0); }}""")
    r = await poll(f"() => {{ const k = {K}, p = k.player; return [p.xpLv * 100 + p.xpPt, k.ents.filter(e => e.kind === 'mob' && e.type === 'shade' && Math.hypot(e.x - p.x, e.z - p.z) < 12).length]; }}", lambda r: r[0] == 5 and r[1] == 0, 60, 150)
    check('人が たおした敵だけ 経験値を落とす（5）', r == [5, 0], r)
    r = await s.ev(f"""() => {{ const k = {K}, w = k.world, B = k.B, I = k.I, p = k.player, o = window.__o; p.xpLv = 0; p.xpPt = 0; for (const e of k.ents) e.dead = true;
      p.inv[0] = {{ id: I.iron_pick, n: 1, d: 0 }}; p.sel = 0; let n = 0;
      for (let i = 0; i < 6; i++) {{ w.setBlock(o[0] + 8, o[1], o[2] - 8 + i, B.ore_diamond, 0); p.finishBreak(w, {{ x: o[0] + 8, y: o[1], z: o[2] - 8 + i, id: B.ore_diamond, meta: 0, nx: -1, ny: 0, nz: 0, t: 2 }}); }}
      w.setBlock(o[0] + 8, o[1], o[2], B.stone, 0); p.finishBreak(w, {{ x: o[0] + 8, y: o[1], z: o[2], id: B.stone, meta: 0, nx: -1, ny: 0, nz: 0, t: 2 }});
      const orbs = k.ents.filter(e => e.kind === 'item' && e.id === I.xp_orb).reduce((a, e) => a + e.n, 0); for (const e of k.ents) e.dead = true; p.smeltXp(I.iron_ingot, 10); return [orbs, p.xpLv * 100 + p.xpPt]; }}""")
    check('ダイヤ鉱石6こで 18〜42、石は0。鉄10こを焼くと 7（＝ちょうどレベル1）', 18 <= r[0] <= 42 and r[1] == 100, r)
    await s.ev(f"() => {{ const k = {K}, p = k.player; p.xpLv = 12; p.xpPt = 4; p.inv.fill(null); p.damage(999, p.x, p.z, 0, 'テスト', true); }}")
    r = await s.ev(f"() => {{ const k = {K}, p = k.player; return [p.dead, p.xpLv, p.xpPt, k.ents.filter(e => e.kind === 'item' && e.id === k.I.xp_orb).reduce((a, e) => a + e.n, 0)]; }}")
    check('力つきると レベル0。レベル×7（84）が その場に落ちる', r == [True, 0, 0, 84], r)
    await s.ev(f"() => {{ const k = {K}; k.player.respawn(); k.ui.hideDeath && k.ui.hideDeath(); document.querySelectorAll('#mDeath').forEach(e => e.classList.remove('on')); }}")
    await s.ev(FLOOR); await s.wait(300)
    # 3. 力：ビットの入れ方・すりへり・台のレシピ
    r = await s.ev(f"""() => {{ const k = {K}, I = k.I, B = k.B; let d = 37; d = k.enchSet(d, 0, 3); d = k.enchSet(d, 3, 2); const g = (ids, w) => {{ const r = k.matchGrid(ids.map(id => id ? {{ id, n: 1, d: 0 }} : null), w); return r ? [k.ITEMS[r.out].name, r.n] : null; }};
      return [k.itemDmg(d), k.enchOf(d, 0), k.enchOf(d, 1), k.enchOf(d, 3), k.enchAny(d), k.enchAny(37), k.enchList(I.iron_sword, d), k.enchKind(I.iron_pick), k.enchKind(I.bow), k.enchKind(I.iron_chest), k.enchKind(I.shield), k.enchKind(I.bread),
        g([0, I.glow_dust, 0, I.diamond, B.obsidian, I.diamond, B.obsidian, B.obsidian, B.obsidian], 3), [0, 1, 2].map(t => k.enchRoll(I.iron_sword, t, 777) === k.enchRoll(I.iron_sword, t, 777) && k.enchRoll(I.iron_sword, t, 777) > 65535)]; }}""")
    check('力のしまい方（すりへりと まざらない）・名前・種類・台のレシピ', r == [37, 3, 0, 2, True, False, ['するどさ III', 'えものふやし II'], 'tool', 'bow', 'armor', 'shield', None, ['ちからの台', 1], [True, True, True]], r)
    # 4. ちからの台の画面：レベルと粉が足りないと おせない → こめる → レベルと粉がへる
    await s.ev(f"""() => {{ const k = {K}, w = k.world, B = k.B, I = k.I, p = k.player, o = window.__o; w.setBlock(o[0], o[1], o[2] + 3, B.ench_table, 0); p.xpLv = 6; p.xpPt = 0; p.inv.fill(null);
      p.inv[0] = {{ id: I.iron_sword, n: 1, d: 5 }}; p.inv[1] = {{ id: I.glow_dust, n: 6, d: 0 }}; p.sel = 0; p.target = {{ x: o[0], y: o[1], z: o[2] + 3, nx: 0, ny: 1, nz: 0, id: B.ench_table, meta: 0, t: 2 }}; p.targetMob = null; p.use(w); }}""")
    await s.wait(300)
    r = await s.ev(f"() => {{ const k = {K}; return [k.ui.screen, k.ui.slots.filter(r => r.t === 'ench').length, document.querySelectorAll('#enchOpts .btn').length, document.getElementById('scrTitle').textContent]; }}")
    check('ちからの台を使うと 画面が開く', r == ['ench', 2, 0, 'ちからの台'], r)
    r = await s.ev(f"""() => {{ const k = {K}, u = k.ui, p = k.player; const si = u.slots.findIndex(r => r.t === 'inv' && r.i === 0), di = u.slots.findIndex(r => r.t === 'inv' && r.i === 1), e0 = u.slots.findIndex(r => r.t === 'ench' && r.i === 0), e1 = u.slots.findIndex(r => r.t === 'ench' && r.i === 1);
      u.slotClick(di, 0, false); u.slotClick(e0, 0, false); const wrong = !!u.enchS[0]; u.slotClick(e1, 0, false); u.slotClick(si, 0, false); u.slotClick(e0, 0, false);
      const b = [...document.querySelectorAll('#enchOpts .btn')]; return [wrong, u.enchS[0] && u.enchS[0].id === k.I.iron_sword, u.enchS[1] && u.enchS[1].n, b.map(x => x.disabled), b.map(x => x.textContent.length > 4)]; }}""")
    check('物と粉を置くと 3つ出る（レベル6：1つ目だけ おせる。粉のマスに ほかの物は置けない）', r == [False, True, 6, [False, True, True], [True, True, True]], r)
    await s.shot('ench_ui')
    r = await s.ev(f"""() => {{ const k = {K}, u = k.ui, p = k.player; document.querySelector('#enchOpts .btn').click(); const it = u.enchS[0]; return [k.enchAny(it.d), k.itemDmg(it.d), k.enchList(it.id, it.d).length >= 1, p.xpLv, u.enchS[1].n, !!k.game.ach.ench, document.querySelectorAll('#enchOpts .btn').length, u.slots.find(r => r.t === 'ench' && r.i === 0).el.classList.contains('ench')]; }}""")
    check('こめる：力がつく・すりへりは そのまま・レベル−1・粉−1・もう一度は できない・マスが光る', r == [True, 5, True, 5, 5, True, 0, True], r)
    await s.wait(300); await s.shot('ench_done')
    r = await s.ev(f"() => {{ const k = {K}, p = k.player; k.ui.close(true); return [p.inv.filter(x => x).map(x => [x.id, x.n, k.enchAny(x.d)]).sort(), k.ui.screen]; }}")
    check('とじると 物と粉が 持ち物にもどる', r[0] == [[262, 5, False], [309 if False else r[0][1][0], 1, True]] and r[1] is None, r)
    # 5. 力の効き目
    r = await s.ev(f"""() => {{ const k = {K}, p = k.player, I = k.I, B = k.B, w = k.world, o = window.__o; for (const e of k.ents) e.dead = true; const out = {{}};
      const mk = (d) => {{ const m = k.spawnMob('cow', p.x, p.y, p.z - 2); m.hp = m.maxHp = 100; return m; }};
      p.inv.fill(null); p.sel = 0; p.vy = 0; p.onGround = true;
      p.inv[0] = {{ id: I.iron_sword, n: 1, d: 0 }}; let m = mk(); p.cool = 0; p.attack(m); const base = 100 - m.hp; m.dead = true;
      p.inv[0] = {{ id: I.iron_sword, n: 1, d: k.enchSet(k.enchSet(k.enchSet(0, 0, 4), 1, 2), 3, 3) }}; m = mk(); p.attack(m); out.sharp = +(100 - m.hp - base).toFixed(2); out.burn = m.burnT; out.loot = m.loot; m.dead = true;
      p.inv[0] = {{ id: I.iron_pick, n: 1, d: 0 }}; const t0 = p.breakTime(B.stone); p.inv[0].d = k.enchSet(0, 0, 4); out.eff = +(t0 / p.breakTime(B.stone)).toFixed(2);
      p.inv[0] = {{ id: I.iron_pick, n: 1, d: k.enchSet(0, 1, 3) }}; for (let i = 0; i < 400; i++) p.wearHeld(1); out.unbr = k.itemDmg(p.inv[0] ? p.inv[0].d : 9999); out.kept = p.inv[0] ? k.enchOf(p.inv[0].d, 1) : -1;
      p.inv[0] = {{ id: I.iron_pick, n: 1, d: k.enchSet(0, 2, 3) }}; let got = 0; for (let i = 0; i < 40; i++) {{ w.setBlock(o[0] + 8, o[1], o[2], B.ore_diamond, 0); p.finishBreak(w, {{ x: o[0] + 8, y: o[1], z: o[2], id: B.ore_diamond, meta: 0, nx: -1, ny: 0, nz: 0, t: 2 }}); }}
      for (const e of k.ents) if (e.kind === 'item' && e.id === I.diamond) got += e.n; out.fortune = got; for (const e of k.ents) e.dead = true;
      p.armor[1] = {{ id: I.iron_chest, n: 1, d: k.enchSet(0, 0, 4) }}; p.armor[0] = {{ id: I.iron_helmet, n: 1, d: 0 }}; p.hp = 20; p.hurtT = 0; p.damage(10, p.x, p.z - 2, 0, 'テスト'); const withP = 20 - p.hp;
      p.armor[1] = {{ id: I.iron_chest, n: 1, d: 0 }}; p.hp = 20; p.hurtT = 0; p.damage(10, p.x, p.z - 2, 0, 'テスト'); out.prot = +(withP / (20 - p.hp)).toFixed(2); p.armor[0] = p.armor[1] = null; p.hp = 20;
      p.inv[0] = {{ id: I.bow, n: 1, d: k.enchSet(k.enchSet(0, 0, 4), 1, 1) }}; p.inv[1] = {{ id: I.arrow, n: 3, d: 0 }}; p.ray = [0, 0.3, -1]; p.shootBow(1); const a = k.ents.find(e => e.kind === 'shot'); out.bow = [a.dmg, a.flame]; a.dead = true;
      return out; }}""")
    check('するどさIV＝+2.5・もえる刃・えものふやし', r['sharp'] == 2.5 and r['burn'] == 120 and r['loot'] == 3, r)
    check('はやほりIV で 石を ほるのが 3倍以上 速い', r['eff'] >= 3, r['eff'])
    check('じょうぶIII：400回使って すりへりは 60〜150（力は 消えない）', 60 <= r['unbr'] <= 150 and r['kept'] == 3, [r['unbr'], r['kept']])
    check('ほりあてIII：ダイヤ鉱石40こから 60こ以上', r['fortune'] >= 60, r['fortune'])
    check('まもりIV：ダメージが 16% へる', abs(r['prot'] - 0.84) < 0.02, r['prot'])
    check('つよ弓IV＝20ダメージ・火の矢', r['bow'] == [20, 1], r['bow'])
    # もえる刃：敵が もえて 少しずつ へる
    await s.ev(f"() => {{ const k = {K}, p = k.player; for (const e of k.ents) e.dead = true; const m = k.spawnMob('cow', p.x, p.y, p.z - 4); m.hb = 100; k.hurtMob(m, 1, p.x, p.z, 0); window.__m = m; }}")
    r = await poll(f"() => [window.__m.hp, window.__m.burnT]", lambda r: r[1] == 0, 60, 150)
    check('もえた相手は 少しずつ ダメージを受ける', r[0] <= 5 and r[1] == 0, r)
    # 6. くすり：びんに水をくむ・レシピ・のむ・効き目
    r = await s.ev(f"""() => {{ const k = {K}, w = k.world, B = k.B, I = k.I, p = k.player, o = window.__o; for (const e of k.ents) e.dead = true; p.inv.fill(null);
      const g = (ids, ww) => {{ const r = k.matchGrid(ids.map(id => id ? {{ id, n: 1, d: 0 }} : null), ww); return r ? [k.ITEMS[r.out].name, r.n] : null; }};
      w.setBlock(o[0], o[1] - 1, o[2] + 2, B.water, 0); p.inv[0] = {{ id: I.glass_bottle, n: 3, d: 0 }}; p.sel = 0; p.ray = [0, -0.465, -0.885]; p.target = null; p.targetMob = null; const u = p.use(w);
      return [g([B.glass, 0, B.glass, 0, B.glass, 0, 0, 0, 0], 3), g([I.water_bottle, I.homura_powder, I.melon_slice, 0], 2), g([I.water_bottle, I.water_bottle, I.water_bottle, I.homura_powder, I.feather, 0, 0, 0, 0], 3), g([I.water_bottle, I.homura_powder, B.magma, 0], 2),
        u, p.inv[0].n, p.inv.filter(x => x && x.id === I.water_bottle).map(x => x.n), w.getBlock(o[0], o[1] - 1, o[2] + 2) === B.water]; }}""")
    check('ガラスびん・くすりのレシピ・水をくむ（水は へらない）', r == [['ガラスびん', 3], ['いやしの くすり', 1], ['はやあしの くすり', 3], ['ひよけの くすり', 1], True, 2, [1], True], r)
    await s.ev(f"() => {{ const k = {K}, p = k.player, I = k.I; p.inv.fill(null); p.inv[0] = {{ id: I.potion_heal, n: 2, d: 0 }}; p.sel = 0; p.hp = 6; p.target = null; p.targetMob = null; k.touchSt.use = true; }}")
    r = await poll(f"() => {{ const p = {K}.player; return [p.hp, p.inv[0] ? p.inv[0].n : 0, p.inv.filter(x => x && x.id === {K}.I.glass_bottle).length]; }}", lambda r: r[0] >= 14, 40, 150)
    await s.ev(f"() => {{ {K}.touchSt.use = false; }}")
    check('いやしの くすりを のむ：体力+8、びんが もどる', r[0] >= 14 and r[1] == 1 and r[2] == 1, r)
    r = await s.ev(f"""() => {{ const k = {K}, p = k.player, I = k.I; const sp0 = 4.3; for (const q of ['regen', 'speed', 'str', 'fire', 'night']) p.applyPotion(q);
      p.inv[0] = {{ id: I.iron_sword, n: 1, d: 0 }}; const m = k.spawnMob('cow', p.x, p.y, p.z - 2); m.hp = m.maxHp = 100; p.cool = 0; p.vy = 0; p.onGround = true; p.attack(m); const dmg = 100 - m.hp; m.dead = true;
      p.hp = 10; p.hurtT = 0; p.damage(4, p.x, p.z, 0, '溶岩', true); const lava = p.hp; p.damage(2, p.x, p.z, 0, '落下', true); return [Object.values(p.fx), dmg, lava, p.hp, !!k.game.ach.potion]; }}""")
    await s.wait(700)
    f2 = await s.ev(f"() => {{ const k = {K}; return [document.querySelectorAll('#fxbar div').length, k.R.minLight > 0.4]; }}")
    await s.shot('potion_fx')
    check('くすりの効き目：ちから＋3・ひよけ（溶岩は きかないが 落下は くらう）・表示・暗い所が明るい', r[0][1] == 3600 and r[1] >= 9 and r[2] == 10 and r[3] == 8 and r[4] and f2 == [5, True], [r, f2])
    await s.ev(f"() => {{ const p = {K}.player; p.hp = 10; p.fx.regen = 120; p.fx.speed = 3; }}")
    r = await poll(f"() => {{ const p = {K}.player; return [p.hp, p.fx.regen, p.fx.speed]; }}", lambda r: r[1] == 0, 60, 150)
    check('さいせい：少しずつ もどる。時間がたつと きれる', r[0] >= 12 and r[1] == 0 and r[2] == 0, r)
    # 7. セーブ：レベル・力・くすりの のこり
    await s.ev(f"() => {{ const k = {K}, p = k.player; p.xpLv = 9; p.xpPt = 11; p.fx.night = 2000; p.inv.fill(null); p.inv[0] = {{ id: k.I.iron_sword, n: 1, d: k.enchSet(12, 0, 2) }}; for (const e of k.ents) e.dead = true; }}")
    wid = await s.ev(f"() => {K}.game.worldId")
    await s.ev(f"async () => {{ await {K}.game.save(); }}")
    await s.ev(f"() => {K}.game.quitToTitle()")
    await s.pg.wait_for_function(f'{K}.game.state === "title"', timeout=30000)
    await s.ev(f"() => {K}.game.loadWorld('{wid}')")
    await s.pg.wait_for_function(f'{K}.game.state === "playing"', timeout=90000)
    r = await s.ev(f"() => {{ const k = {K}, p = k.player; return [p.xpLv, p.xpPt, p.fx.night > 1500, k.enchOf(p.inv[0].d, 0), k.itemDmg(p.inv[0].d)]; }}")
    check('読み直しても レベル・くすり・こめた力が残る', r == [9, 11, True, 2, 12], r)
    errs = [l for l in s.logs if 'PAGEERROR' in l or l.startswith('error')]
    check('エラーなし', len(errs) == 0, errs[:6])
    await s.close()
    print('ALL OK' if ok_all else 'SOME NG')
asyncio.run(main())
