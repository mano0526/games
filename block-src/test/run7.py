import asyncio, json, sys, time
sys.path.insert(0, __import__('os').path.dirname(__import__('os').path.abspath(__file__)))
from lib import Sess
K = "window.__kk"
async def main():
    s = await Sess().start()
    await s.shot('title2')
    # アイコン一覧
    await s.ev(f"""() => {{ const k = {K}; const d = document.createElement('div'); d.id = 'sheet'; d.style.cssText = 'position:fixed;inset:0;z-index:999;background:#2b2622;display:flex;flex-wrap:wrap;align-content:flex-start;gap:2px;padding:6px;overflow:hidden';
      const ICON_URL = k.ui.constructor; const ids = Object.keys(k.ITEMS).map(Number).sort((a, b) => a - b);
      for (const id of ids) {{ const el = k.ui.mkSlotEl(); el.style.width = el.style.height = '56px'; k.ui.paintSlot(el, {{ id, n: 1, d: 0 }}); d.appendChild(el); }}
      document.body.appendChild(d); return ids.length; }}""")
    await s.wait(500); await s.shot('icons')
    await s.ev("() => document.getElementById('sheet').remove()")
    # メニュー各種
    await s.pg.click('#bNew'); await s.wait(300); await s.shot('menu_new')
    await s.pg.click('#mNew [data-back]'); await s.wait(200)
    await s.pg.click('#bSet'); await s.wait(300); await s.shot('menu_settings')
    await s.pg.click('#mSettings [data-back]'); await s.wait(200)
    await s.pg.click('#bHow'); await s.wait(300); await s.shot('menu_how')
    await s.pg.click('#mHow [data-back]'); await s.wait(200)
    await s.pg.click('#bLoad'); await s.wait(500); await s.shot('menu_worlds')
    await s.pg.click('#mWorlds [data-back]'); await s.wait(200)
    await s.new_world('12345')
    await s.wait(500)
    await s.ev(f"""() => {{ const k = {K}, p = k.player; p.give(k.B.log_oak, 12, 0); p.give(k.B.cobble, 30, 0); p.give(k.I.coal, 6, 0); p.give(k.I.iron_ingot, 10, 0); p.give(k.I.stick, 8, 0); p.give(k.I.iron_sword, 1, 30); p.give(k.I.bread, 5, 0); p.give(k.B.wool_white, 3, 0); p.give(k.I.iron_helmet, 1, 0); }}""")
    await s.pg.keyboard.press('KeyE'); await s.wait(600); await s.shot('inv2')
    await s.pg.click('#recTabs [data-t="tool"]'); await s.wait(300); await s.shot('inv_tools')
    await s.pg.keyboard.press('KeyE'); await s.wait(300)
    await s.ev(f"() => {{ {K}.ui.open('table'); }}"); await s.wait(400); await s.shot('table2')
    await s.ev(f"() => {{ {K}.ui.close(true); {K}.game.pause(); }}"); await s.wait(500); await s.shot('menu_pause')
    await s.pg.click('#bNotes'); await s.wait(400); await s.shot('menu_notes')
    await s.pg.click('#mNotes [data-back]'); await s.wait(200)
    await s.pg.click('#bResume'); await s.wait(300)
    # 効果音と音楽：例外が出ないか
    r = await s.ev(f"""() => {{ const k = {K}; k.audio.unlock(); const names = ['pop','click','deny','craft','achieve','treasure','dawn','sleep','hurt','death','eat','burp','hit','swing','splash','swim','fizz','door','chest','ding','toolbreak','equip','hop','slam','summon','shoot','victory'];
      for (const m of ['stone','wood','grass','leaf','dirt','sand','gravel','glass','cloth','snow','metal','water']) for (const h of ['dig','break','place','step']) names.push(h + '_' + m);
      for (const v of ['sheep','pig','cow','chicken','shade','rock','wisp','king']) for (const h of ['say','hurt','die']) names.push(h + '_' + v);
      let n = 0; for (const nm of names) {{ k.audio.last = {{}}; k.audio.play(nm, 1, 0.2); n++; }}
      k.audio.mus.restUntil = 0; for (let i = 0; i < 40; i++) {{ k.audio.tickMusic(i % 2 === 0); if (k.audio.mus.piece) k.audio.mus.nextBar = k.audio.ctx.currentTime; }}
      return [n, k.audio.ctx.state, !!k.audio.mus.piece]; }}""")
    print('audio', r)
    # ダメージ → 死亡 → 復活
    await s.ev(f"() => {{ const p = {K}.player; p.damage(7, p.x + 1, p.z, 5, 'ヨルカゲ'); }}"); await s.wait(250); await s.shot('hurt')
    await s.ev(f"() => {{ const p = {K}.player; p.hurtT = 0; p.damage(50, p.x + 1, p.z, 5, 'ヨルカゲ'); }}"); await s.wait(1600); await s.shot('death')
    print('dead', await s.ev(f"() => [{K}.player.dead, {K}.ui.menu, {K}.ents.filter(e => e.kind === 'item').length]"))
    await s.pg.click('#bRespawn'); await s.wait(800)
    print('respawned', await s.ev(f"() => {{ const p = {K}.player; return [p.dead, p.hp, {K}.game.state, p.x, p.y, p.z]; }}"))
    s.dump()
    await s.close()
asyncio.run(main())
