#!/usr/bin/env python3
# 1つのページにまとめる
import json, os, sys
root = os.path.dirname(os.path.abspath(__file__))
rd = lambda f: open(os.path.join(root, 'src', f), encoding='utf8').read()
shared = '\n'.join(rd(f) for f in ['01_util.js', '02_blocks.js', '03_gen.js'])
worker = "'use strict';\n" + shared + '\n' + rd('worker_boot.js')
mains = ['04_textures.js', '05_world.js', '06_mesher.js', '07_render.js', '08_entities.js', '09_player.js', '10_ui.js', '11_audio.js', '11b_net.js', '11c_netent.js', '12_main.js']
js = "(function(){\n'use strict';\n" + shared + "\nconst WORKER_SRC = " + json.dumps(worker, ensure_ascii=False).replace('</', '<\\/') + ";\n" + '\n'.join(rd(f) for f in mains) + "\n})();\n"
assert '</script' not in js
os.makedirs(os.path.join(root, 'dist'), exist_ok=True)
open(os.path.join(root, 'dist', 'game.js'), 'w', encoding='utf8').write(js)
page = rd('index.template.html') + "\n<script>\n" + js + "</script>\n"
open(os.path.join(root, 'dist', 'kakukaku.html'), 'w', encoding='utf8').write(page)
# 手元で試すための、枠つきの版
reset = ':root{color-scheme:light;padding:env(safe-area-inset-top,0px) 0 env(safe-area-inset-bottom,0px)}html{box-sizing:border-box}body{margin:0;font:14px system-ui,sans-serif}img{max-width:100%}[hidden]{display:none!important}'
head = '<!doctype html><html lang="ja"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><style>' + reset + '</style>'
open(os.path.join(root, 'dist', 'test.html'), 'w', encoding='utf8').write(head + '</head><body>' + page + '</body></html>')
# にせの中継サーバーにつなぐ版（2ページ以上のテスト用）
open(os.path.join(root, 'dist', 'test_mp.html'), 'w', encoding='utf8').write(head + '<script src="fakefb.js"></script></head><body>' + page + '</body></html>')
for f in ['fakefb.js', 'fakefb_worker.js']:
    open(os.path.join(root, 'dist', f), 'w', encoding='utf8').write(open(os.path.join(root, 'test', f), encoding='utf8').read())
# ゲーム置き場（GitHub Pages）に置く版：本物の中継サーバーにつながる
sdk = '<script>window.__blockOnline=1</script><script defer src="https://www.gstatic.com/firebasejs/10.12.2/firebase-app-compat.js"></script><script defer src="https://www.gstatic.com/firebasejs/10.12.2/firebase-database-compat.js"></script><script defer src="netdb.js"></script>'
open(os.path.join(root, 'dist', 'block.html'), 'w', encoding='utf8').write(head + sdk + '</head><body>' + page + '</body></html>')
print('built', len(page) // 1024, 'KB', 'lines', js.count('\n'))
