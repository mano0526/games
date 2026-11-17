import asyncio, sys
sys.path.insert(0, __import__('os').path.dirname(__import__('os').path.abspath(__file__)))
from mplib import Mp, K
from PIL import Image
async def main():
    m = await Mp().start(2, w=420, h=300)
    await m.ev(0, f"() => {{ {K}.game.startNew('みんなの島', '12345', 1, 0, true, {{}}); }}")
    await m.playing(0)
    code = await m.ev(0, f"() => {K}.net.code")
    await m.ev(1, f"(c) => {{ {K}.settings.look = [1, 3, 1, 4, 1]; {K}.game.joinOnline(c); }}", code)
    await m.playing(1); await m.wait(1500)
    # 平らな台をつくって、その上で向かい合う
    await m.ev(0, f"() => {{ const k = {K}, p = k.player, w = k.game.world, x0 = Math.floor(p.x), z0 = Math.floor(p.z), y = Math.floor(p.y) + 12; for (let x = -4; x <= 4; x++) for (let z = -6; z <= 3; z++) w.setBlock(x0 + x, y, z0 + z, k.B.planks_oak || k.B.cobble, 0); w.setBlock(x0, y + 1, z0 - 4, k.B.bed, 0, 1); w.setBlock(x0, y + 1, z0 - 5, k.B.bed, 4, 1); p.x = x0 + 0.5; p.z = z0 + 0.5; p.y = y + 1.01; p.yaw = 0; p.pitch = -0.12; p.flying = false; window.__b = [x0, y + 1, z0]; }}")
    b = await m.ev(0, "() => window.__b")
    await m.wait(800)
    shots = []
    async def pose(name, js, wait=900):
        await m.ev(1, js, b); await m.wait(wait)
        await m.shot(0, 'pose_' + name); shots.append('/tmp/kk/pose_' + name + '.png')
    await pose('front_pick', f"(b) => {{ const k = {K}, p = k.player; p.flying = false; p.x = b[0] + 0.5; p.y = b[1] + 0.01; p.z = b[2] - 2.2; p.yaw = Math.PI; p.pitch = 0; p.inv[0] = {{ id: k.I.iron_pick, n: 1, d: 0 }}; p.sel = 0; p.invDirty = true; }}")
    await pose('side_block', f"(b) => {{ const k = {K}, p = k.player; p.yaw = Math.PI / 2; p.inv[0] = {{ id: k.B.grass, n: 1, d: 0 }}; p.invDirty = true; }}")
    await pose('back_sword', f"(b) => {{ const k = {K}, p = k.player; p.yaw = 0; p.pitch = 0.6; p.inv[0] = {{ id: k.I.diamond_sword, n: 1, d: 0 }}; p.invDirty = true; }}")
    await m.pg[1].keyboard.down('ShiftLeft')
    await pose('sneak', f"(b) => {{ const k = {K}, p = k.player; p.yaw = Math.PI * 0.75; p.pitch = 0; }}")
    await m.pg[1].keyboard.up('ShiftLeft')
    await pose('swing', f"(b) => {{ const k = {K}, p = k.player; p.yaw = Math.PI * 0.8; setInterval(() => p.swing(), 150); }}", 500)
    await m.ev(1, f"() => {{ {K}.game.world.time = 14000; {K}.net.writeTime(); }}"); await m.wait(600)
    await pose('sleep', f"(b) => {{ const k = {K}, w = k.game.world; k.game.sleep({{ x: b[0], y: b[1], z: b[2] - 4, id: w.getBlock(b[0], b[1], b[2] - 4), meta: w.getMeta(b[0], b[1], b[2] - 4) }}); }}", 1200)
    ims = [Image.open(f) for f in shots]; w, h = ims[0].size
    sheet = Image.new('RGB', (w * 3, h * 2))
    for i, im in enumerate(ims): sheet.paste(im, ((i % 3) * w, (i // 3) * h))
    sheet.save('/tmp/kk/sheet_pose.png'); print(sheet.size, 'errs', [e for e in m.errs() if '404' not in e][:5])
    await m.close()
asyncio.run(main())
