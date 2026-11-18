// バイオームの地図を画像にする： node map.js 種 半径 1ドットのマス数 出力
const { load, png } = require('./genlab_lib.js');
const G = load(['WorldGen2']);
const seed = +(process.argv[2] || 1), R = +(process.argv[3] || 1500), ST = +(process.argv[4] || 4), out = process.argv[5] || '/tmp/kk/map.png', gv = +(process.argv[6] || 2);
const COL = { 0: [52, 98, 200], 1: [226, 214, 160], 2: [124, 190, 84], 3: [60, 140, 60], 4: [232, 200, 110], 5: [236, 242, 248], 6: [50, 104, 84], 7: [128, 128, 132], 8: [240, 160, 196], 9: [200, 220, 110], 10: [80, 130, 230],
  11: [150, 196, 110], 12: [26, 84, 40], 13: [40, 180, 30], 14: [178, 164, 84], 15: [84, 110, 70], 16: [196, 100, 50], 17: [160, 210, 250], 18: [150, 180, 170], 19: [90, 80, 50], 20: [140, 220, 150], 21: [255, 255, 255], 22: [30, 60, 150], 23: [190, 215, 240], 24: [170, 110, 190] };
const g = new G.GENS[gv](seed);
const N = Math.floor(2 * R / ST), rgb = new Uint8Array(N * N * 3);
let prevH = 0;
for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
  const x = -R + i * ST, z = -R + j * ST;
  const h = g.column(x, z), b = g.colB, c = COL[b] || [255, 0, 255];
  let sh = 1; if (h >= 48) sh = 0.82 + Math.min(0.3, (h - 48) / 160) + (i > 0 ? Math.max(-0.14, Math.min(0.14, (h - prevH) * 0.035)) : 0);
  prevH = h;
  const o = (j * N + i) * 3; rgb[o] = Math.min(255, c[0] * sh); rgb[o + 1] = Math.min(255, c[1] * sh); rgb[o + 2] = Math.min(255, c[2] * sh);
}
// まん中に しるし
const m = Math.floor(N / 2); for (let k = -3; k <= 3; k++) { for (const [a, b2] of [[m + k, m], [m, m + k]]) { const o = (b2 * N + a) * 3; rgb[o] = 255; rgb[o + 1] = 0; rgb[o + 2] = 0; } }
png(out, N, N, rgb);
console.log('wrote', out, N);
