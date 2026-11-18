// 地形づくりの確認用（Node で動かす）。共有ソース（01〜03）を読みこんで、中の物を返す
const fs = require('fs'), path = require('path'), zlib = require('zlib');
function load(extra) {
  const root = path.join(__dirname, '..', 'src');
  const src = ['01_util.js', '02_blocks.js', '03_gen.js', '03b_gen2.js', '03c_dims.js'].map(f => fs.readFileSync(path.join(root, f), 'utf8')).join('\n');
  const names = ['CW', 'CH', 'CVOL', 'SEA', 'clamp', 'lerp', 'smoothstep', 'mulberry32', 'hash2', 'hash3', 'rand2', 'strSeed', 'Simplex', 'fbm2', 'BLOCKS', 'B', 'I', 'ITEMS', 'OPAQUE', 'SOLID', 'ISLEAF', 'ISLOG', 'SHAPE', 'BIOME', 'BIOME_NAMES', 'GENS', 'GEN_CUR', 'genTreeShape', 'WorldGen', 'dimGenClass', 'fortInfo', 'nearestFort', 'soraPillars', 'H_LAVA', 'SORA_PED_Y'].concat(extra || []);
  const body = "'use strict';\n" + src + '\nreturn {' + names.map(n => n + ': (typeof ' + n + " !== 'undefined' ? " + n + ' : undefined)').join(',') + '};';
  return new Function(body)();
}
// 画像（PNG）を書き出す。rgb は 幅×高さ×3
function crc32(buf) { let c, crc = ~0; for (let n = 0; n < buf.length; n++) { c = (crc ^ buf[n]) & 0xff; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; crc = (crc >>> 8) ^ c; } return ~crc >>> 0; }
function png(file, w, h, rgb) {
  const raw = Buffer.alloc((w * 3 + 1) * h);
  for (let y = 0; y < h; y++) { raw[y * (w * 3 + 1)] = 0; Buffer.from(rgb.buffer, rgb.byteOffset + y * w * 3, w * 3).copy(raw, y * (w * 3 + 1) + 1); }
  const chunk = (type, data) => { const len = Buffer.alloc(4); len.writeUInt32BE(data.length); const td = Buffer.concat([Buffer.from(type), data]); const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(td)); return Buffer.concat([len, td, crc]); };
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = 2;
  fs.writeFileSync(file, Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]));
}
module.exports = { load, png };
