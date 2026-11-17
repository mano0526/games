import asyncio, json, sys, time, os
sys.path.insert(0, __import__('os').path.dirname(__import__('os').path.abspath(__file__)))
from lib import Sess
K = "window.__kk"
async def main():
    s = await Sess().start()
    await s.new_world('555', mode=0, diff=2)
    await s.wait(800)
    pos = await s.ev(f"() => {{ const p = {K}.player, w = {K}.world; return [p.x, p.y, p.z, {K}.BLOCKS[w.getBlock(Math.floor(p.x), Math.floor(p.y - 0.5), Math.floor(p.z))].name]; }}")
    print('spawn', pos)
    await s.shot('spawn555')
    # 夜の敵のわき
    await s.ev(f"() => {{ {K}.world.time = 15000; }}")
    for i in range(4):
        await s.wait(5000)
        print('night', i, await s.ev(f"() => {{ const k = {K}; const c = {{}}; for (const e of k.ents) if (e.kind === 'mob') c[e.type] = (c[e.type] || 0) + 1; return JSON.stringify([c, +k.player.hp.toFixed(1), k.world.tick]); }}"))
    await s.ev(f"() => {{ const k = {K}; k.world.time = 3000; k.player.hp = 20; for (const e of k.ents) if (e.kind === 'mob' && k.MOBS[e.type].hostile) e.dead = true; const p = k.player, w = k.world; w.setBlock(Math.floor(p.x) + 1, Math.floor(p.y) + 3, Math.floor(p.z), k.B.diamond_block, 0); }}")
    await s.ev(f"() => {K}.game.quitToTitle()")
    await s.pg.wait_for_function('window.__kk.game.state === "title"', timeout=30000)
    await s.pg.click('#bLoad'); await s.wait(600); await s.shot('worlds')
    # 書き出し
    async with s.pg.expect_download(timeout=15000) as dl:
        await s.pg.click('#worldList [data-a="export"]')
    d = await dl.value
    path = '/tmp/kk/export.json'; await d.save_as(path)
    print('exported', d.suggested_filename, os.path.getsize(path), 'bytes')
    j = json.load(open(path))
    print('export meta', j['meta']['name'], 'chunks', len(j['chunks']), 'ver', j['ver'])
    # 読みこみ
    await s.pg.set_input_files('#inFile', path)
    await s.wait(1500)
    lst = await s.ev(f"async () => (await {K}.storage.list()).map(w => [w.id, w.name, w.day])")
    print('list after import', lst)
    await s.shot('worlds2')
    await s.ev(f"() => {K}.game.loadWorld('{lst[0][0]}')")
    await s.pg.wait_for_function('window.__kk.game.state === "playing"', timeout=60000)
    await s.wait(800)
    print('imported world', await s.ev(f"() => {{ const k = {K}, p = k.player, w = k.world; return [w.getBlock(Math.floor({pos[0]}) + 1, Math.floor({pos[1]}) + 3, Math.floor({pos[2]})) === k.B.diamond_block, p.x, p.y, p.z]; }}"))
    # 消す
    await s.ev(f"() => {K}.game.quitToTitle()"); await s.pg.wait_for_function('window.__kk.game.state === "title"', timeout=30000)
    await s.pg.click('#bLoad'); await s.wait(500)
    await s.pg.click('#worldList [data-a="del"]'); await s.wait(300); await s.shot('confirm')
    await s.pg.click('#bConfYes'); await s.wait(800)
    print('after delete', await s.ev(f"async () => (await {K}.storage.list()).length"), await s.ev(f"() => {K}.ui.menu"))
    s.dump()
    await s.close()
asyncio.run(main())
