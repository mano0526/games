// ===== 04_textures.js : ドット絵の生成（ブロック・アイテム・画面用アイコン） =====
const TEX = {};        // 名前 → 層の番号
const TEX_DATA = [];   // 層 → 16x16 の RGBA
function C(h) { return [parseInt(h.substr(1, 2), 16), parseInt(h.substr(3, 2), 16), parseInt(h.substr(5, 2), 16)]; }
function CP(list) { return list.map(C); }
function shadeC(c, f) { return [clamp(Math.round(c[0] * f), 0, 255), clamp(Math.round(c[1] * f), 0, 255), clamp(Math.round(c[2] * f), 0, 255)]; }

function painter(d, rng) {
  const o = {
    d, rng,
    px(x, y, c, a) { x &= 15; y &= 15; const i = (y * 16 + x) * 4; d[i] = c[0]; d[i + 1] = c[1]; d[i + 2] = c[2]; d[i + 3] = a === undefined ? 255 : a; },
    clr(x, y) { const i = ((y & 15) * 16 + (x & 15)) * 4; d[i + 3] = 0; },
    get(x, y) { const i = ((y & 15) * 16 + (x & 15)) * 4; return [d[i], d[i + 1], d[i + 2], d[i + 3]]; },
    rect(x0, y0, w, h, c, a) { for (let y = y0; y < y0 + h; y++) for (let x = x0; x < x0 + w; x++) o.px(x, y, c, a); },
    speckle(pal, a) { for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) o.px(x, y, pal[Math.floor(rng() * pal.length)], a); },
    // なめらかな斑点模様（つなぎ目なし）
    blot(pal, cell, a) {
      const n = 16 / cell, g = [];
      for (let i = 0; i < n * n; i++) g.push(rng());
      for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
        const gx = x / cell, gy = y / cell, x0 = Math.floor(gx), y0 = Math.floor(gy), fx = gx - x0, fy = gy - y0;
        const v = lerp(lerp(g[(y0 % n) * n + x0 % n], g[(y0 % n) * n + (x0 + 1) % n], fx), lerp(g[((y0 + 1) % n) * n + x0 % n], g[((y0 + 1) % n) * n + (x0 + 1) % n], fx), fy);
        const t = clamp(v + (rng() - 0.5) * 0.25, 0, 0.999);
        o.px(x, y, pal[Math.floor(t * pal.length)], a);
      }
    },
    dash(n, len, c) { for (let i = 0; i < n; i++) { const x = Math.floor(rng() * 16), y = Math.floor(rng() * 16), l = 1 + Math.floor(rng() * len); for (let k = 0; k < l; k++) o.px(x + k, y, c); } },
    dots(n, c, a) { for (let i = 0; i < n; i++) o.px(Math.floor(rng() * 16), Math.floor(rng() * 16), c, a); },
    copy(name) { d.set(TEX_DATA[TEX[name]]); },
    mul(f) { for (let i = 0; i < 1024; i += 4) { d[i] *= f; d[i + 1] *= f; d[i + 2] *= f; } }
  };
  return o;
}
function newTex(name, fn) {
  const d = new Uint8ClampedArray(1024);
  fn(painter(d, mulberry32(strSeed('t_' + name))));
  TEX[name] = TEX_DATA.length; TEX_DATA.push(d);
  return d;
}
// 文字で描いたドット絵を RGBA にする
function sprite(rows, pal) {
  const d = new Uint8ClampedArray(1024);
  for (let y = 0; y < 16; y++) {
    const row = (rows[y] || '').padEnd(16, '.');
    for (let x = 0; x < 16; x++) {
      const ch = row[x]; if (ch === '.' || ch === ' ') continue;
      const c = pal[ch]; if (!c) continue;
      const i = (y * 16 + x) * 4; d[i] = c[0]; d[i + 1] = c[1]; d[i + 2] = c[2]; d[i + 3] = 255;
    }
  }
  return d;
}
function P(obj) { const o = {}; for (const k in obj) o[k] = C(obj[k]); return o; }

const GRASS_PALS = [
  CP(['#6fb64a', '#64aa42', '#7bc254', '#5a9e3b']), CP(['#4f9a3e', '#458f37', '#5aa647', '#3d8431']),
  CP(['#5f9f6a', '#559560', '#6aaa74', '#4c8a58']), CP(['#a3b24d', '#98a745', '#aebd58', '#8c9b3e']),
  // 4 ジャングル  5 サバンナ  6 湿地  7 暗い森
  CP(['#4fc03c', '#45b433', '#5bcc47', '#3aa32b']), CP(['#aaa550', '#9d9848', '#b6b15b', '#908b3f']),
  CP(['#5c7a45', '#52703d', '#66844e', '#496636']), CP(['#3a8040', '#327538', '#448c49', '#2a6a31'])
];
const WOOD_COL = {
  oak: { m: '#b08a55', d: '#8f6d40', l: '#c09a63', bark: ['#6b4f2f', '#5c4327', '#7a5a37', '#4f3920'], leaf: ['#4f9a38', '#438a2f', '#5aa842', '#3b7b2a'], hole: '#2c5a22' },
  birch: { m: '#d9c896', d: '#bfad7d', l: '#e6d7a8', bark: ['#e8e4d8', '#dcd8cc', '#f1eee4', '#e3dfd2'], leaf: ['#7fb24a', '#72a541', '#8cbe56', '#659638'], hole: '#4a7a2c' },
  spruce: { m: '#7a5a38', d: '#5f4428', l: '#8a6843', bark: ['#4a3423', '#3d2a1b', '#57402c', '#33231a'], leaf: ['#3a6e4a', '#2f6040', '#457a55', '#28543a'], hole: '#1d3f2c' },
  cherry: { m: '#e0a3a8', d: '#c98489', l: '#ecb7ba', bark: ['#4d2f33', '#402629', '#5c3a3e', '#35201f'], leaf: ['#f2a7c3', '#ec93b4', '#f7bdd2', '#e27fa6'], hole: '#b85f86' },
  mahog: { m: '#a8623f', d: '#864a2c', l: '#ba734e', bark: ['#5e5234', '#4f4529', '#6b5e3c', '#443b22'], leaf: ['#3fa82f', '#339a26', '#4cb83a', '#2a8a1f'], hole: '#1f6a18' },
  acacia: { m: '#c26d3f', d: '#9f552d', l: '#d07f50', bark: ['#6e6a62', '#5f5b54', '#7b776e', '#55514a'], leaf: ['#7a9a3a', '#6c8c30', '#88a845', '#5e7e28'], hole: '#4a6620' },
  walnut: { m: '#4f3320', d: '#3a2416', l: '#5c3d27', bark: ['#3a2a1c', '#2e2115', '#463322', '#261b11'], leaf: ['#2f6a2a', '#275c23', '#387832', '#1f4f1c'], hole: '#173d15' }
};
const TERRA_COL = { '': '#9c5e45', _white: '#d2b1a1', _yellow: '#ba8524', _orange: '#a25426', _red: '#8e3c2e', _brown: '#4d3324' };
const WOOL_COL = { white: '#ececec', red: '#c9413a', yellow: '#f0cc3a', blue: '#3f66c9', green: '#5a8f3a', black: '#2e2e33', pink: '#f0a0bd' };
const ORE_SPOTS = [[3, 3], [4, 3], [3, 4], [10, 2], [11, 2], [11, 3], [12, 3], [6, 7], [7, 7], [7, 8], [8, 8], [6, 8], [12, 9], [13, 9], [12, 10], [2, 11], [3, 11], [3, 12], [4, 12], [8, 12], [9, 12], [9, 13], [10, 13]];
const ORE_HL = [[3, 3], [10, 2], [6, 7], [12, 9], [2, 11], [8, 12]];
const ORE_SH = [[5, 4], [4, 5], [13, 4], [12, 4], [9, 9], [8, 9], [14, 10], [13, 11], [5, 13], [4, 13], [11, 14], [10, 14]];

function buildTextures() {
  const stonePal = CP(['#8b8d91', '#84868a', '#7c7e83', '#93959a', '#888a8e']);
  const dirtPal = CP(['#8a5f3d', '#7d5535', '#946a45', '#6f4a2e', '#855a39']);
  newTex('stone', p => { p.speckle(stonePal); p.dash(7, 3, C('#6e7075')); p.dash(4, 3, C('#9c9ea3')); });
  newTex('dirt', p => { p.speckle(dirtPal); p.dots(6, C('#a37a52')); p.dots(5, C('#5e3f27')); });
  GRASS_PALS.forEach((pal, i) => {
    newTex('grass_top_' + i, p => { p.speckle(pal); p.dots(10, shadeC(pal[3], 0.86)); p.dots(5, shadeC(pal[2], 1.1)); });
    newTex('grass_side_' + i, p => {
      p.copy('dirt');
      for (let x = 0; x < 16; x++) {
        const dep = 2 + Math.floor(p.rng() * 3);
        for (let y = 0; y < dep; y++) p.px(x, y, pal[Math.floor(p.rng() * pal.length)]);
        p.px(x, dep, shadeC(pal[3], 0.72));
      }
    });
    newTex('tallgrass_' + i, p => {
      for (let x = 1; x < 16; x += 1 + Math.floor(p.rng() * 2)) {
        const hgt = 5 + Math.floor(p.rng() * 9); let cx = x;
        for (let k = 0; k < hgt; k++) {
          if (k > 3 && p.rng() < 0.22) cx += p.rng() < 0.5 ? 1 : -1;
          p.px(clamp(cx, 0, 15), 15 - k, k > hgt - 3 ? pal[2] : (x & 1 ? pal[1] : pal[3]));
        }
      }
    });
  });
  newTex('grass_side_snow', p => {
    p.copy('dirt');
    for (let x = 0; x < 16; x++) { const dep = 3 + Math.floor(p.rng() * 3); for (let y = 0; y < dep; y++) p.px(x, y, y === dep - 1 ? C('#cfdde8') : C('#f4f8fb')); }
  });
  newTex('cobble', p => cobbleTex(p, CP(['#8f9195', '#7e8085', '#9c9ea2', '#74767b']), C('#55575c')));
  newTex('mossy_cobble', p => {
    cobbleTex(p, CP(['#8f9195', '#7e8085', '#9c9ea2', '#74767b']), C('#55575c'));
    const g = CP(['#5d8a3a', '#4d7a30', '#6a9a44']);
    for (let i = 0; i < 9; i++) { const x = Math.floor(p.rng() * 16), y = Math.floor(p.rng() * 16); for (let k = 0; k < 7; k++) p.px(x + Math.floor(p.rng() * 4) - 1, y + Math.floor(p.rng() * 3) - 1, g[Math.floor(p.rng() * 3)]); }
  });
  newTex('bedrock', p => p.blot(CP(['#2a2a2d', '#3b3b3f', '#55555a', '#343438', '#6a6a70', '#27272a']), 4));
  newTex('sand', p => { p.speckle(CP(['#e3d6a1', '#dccf98', '#e9ddac', '#d8ca92'])); p.dots(6, C('#c9ba82')); });
  newTex('gravel', p => { p.blot(CP(['#8e8a86', '#7a7672', '#a09c97', '#6b6763', '#8f7f72', '#99948e']), 2); p.dots(8, C('#5d5955')); });
  newTex('clay', p => { p.speckle(CP(['#9aa3b0', '#929ba8', '#a3acb8', '#97a0ad'])); p.dash(3, 4, C('#8a93a0')); });
  newTex('snow', p => { p.speckle(CP(['#f4f8fb', '#eaf1f6', '#ffffff', '#f0f5f9'])); p.dots(6, C('#dbe7ef')); });
  newTex('ice', p => {
    p.rect(0, 0, 16, 16, C('#a8d4f2'), 175);
    for (let k = 0; k < 5; k++) { let x = Math.floor(p.rng() * 16), y = Math.floor(p.rng() * 16); for (let i = 0; i < 5; i++) { p.px(x, y, C('#dceffc'), 200); x++; if (p.rng() < 0.6) y--; } }
    p.dots(8, C('#8fc0e6'), 185);
  });
  for (const k in WOOD_COL) {
    const w = WOOD_COL[k], m = C(w.m), dk = C(w.d), lt = C(w.l);
    newTex('planks_' + k, p => {
      for (let b = 0; b < 4; b++) {
        const tone = [1, 0.96, 1.03, 0.98][b];
        for (let y = b * 4; y < b * 4 + 4; y++) for (let x = 0; x < 16; x++) p.px(x, y, shadeC(p.rng() < 0.2 ? lt : m, tone));
        for (let x = 0; x < 16; x++) p.px(x, b * 4 + 3, dk);
        const jx = (b * 5 + 3) % 16; for (let y = b * 4; y < b * 4 + 3; y++) p.px(jx, y, dk);
        for (let i = 0; i < 2; i++) { const x = Math.floor(p.rng() * 13), y = b * 4 + Math.floor(p.rng() * 3); p.px(x, y, shadeC(m, 0.9)); p.px(x + 1, y, shadeC(m, 0.9)); }
      }
    });
    const bark = CP(w.bark);
    newTex('log_' + k, p => {
      for (let x = 0; x < 16; x++) { let c = bark[Math.floor(p.rng() * 3)]; for (let y = 0; y < 16; y++) { if (p.rng() < 0.18) c = bark[Math.floor(p.rng() * 4)]; p.px(x, y, c); } }
      if (k === 'birch') for (let i = 0; i < 9; i++) { const x = Math.floor(p.rng() * 16), y = Math.floor(p.rng() * 16), l = 2 + Math.floor(p.rng() * 3); for (let j = 0; j < l; j++) p.px(x + j, y, C('#3d3b36')); }
      else for (let x = 1; x < 16; x += 3 + Math.floor(p.rng() * 2)) for (let y = 0; y < 16; y++) if (p.rng() < 0.8) p.px(x, y, bark[3]);
      if (k === 'cherry') for (let i = 0; i < 6; i++) { const x = Math.floor(p.rng() * 14), y = Math.floor(p.rng() * 16); p.px(x, y, C('#7a5055')); p.px(x + 1, y, C('#7a5055')); }
    });
    newTex('log_' + k + '_top', p => {
      for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
        const dx = Math.abs(x - 7.5), dy = Math.abs(y - 7.5);
        const r = Math.max(dx, dy) * 0.65 + Math.hypot(dx, dy) * 0.35;
        if (Math.max(dx, dy) > 6.6) p.px(x, y, bark[(x + y) & 1 ? 0 : 1]);
        else p.px(x, y, Math.floor(r + 0.3) % 2 ? lt : (r < 1.2 ? dk : m));
      }
    });
    const lp = CP(w.leaf);
    const leafFn = (fast) => p => {
      p.blot(lp, 2);
      for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
        const hsh = hash2(x * 7 + (y >> 1), y * 5 + (x >> 1), 91 + k.length) / 4294967296;
        if (hsh < 0.2) { if (fast) p.px(x, y, C(w.hole)); else p.clr(x, y); }
        else if (hsh > 0.93) p.px(x, y, shadeC(lp[2], 1.12));
      }
      if (k === 'cherry') p.dots(7, C('#fde4ee'));
    };
    newTex('leaves_' + k, leafFn(false));
    newTex('leaves_' + k + '_f', leafFn(true));
    newTex('sapling_' + k, p => {
      const s = sprite(['', '', '', '.....aa..bb.....', '....abba.abb....', '....abbbabba....', '.....abbbba.....', '..aa..abba..aa..', '.abba..tt..abba.', '.abbba.tt.abbba.', '..abbbattabbba..', '...aaa.tt.aaa...', '.......tt.......', '.......tt.......', '.......tt.......', '......tttt......'],
        { a: lp[3], b: lp[2], t: bark[0] });
      p.d.set(s);
    });
  }
  // ---- 版2の地形で使うブロックの絵 ----
  newTex('red_sand', p => { p.speckle(CP(['#c96f33', '#c0672e', '#d2783a', '#bb6229'])); p.dots(6, C('#a9541f')); });
  for (const k in TERRA_COL) newTex('terracotta' + k, p => {
    const c = C(TERRA_COL[k]);
    p.blot([shadeC(c, 0.95), c, shadeC(c, 1.04), c, shadeC(c, 0.98)], 4);
    p.dash(3, 5, shadeC(c, 0.9)); p.dash(2, 4, shadeC(c, 1.08));
  });
  newTex('packed_ice', p => {
    p.blot(CP(['#86b0e8', '#8fb8ee', '#9cc2f3', '#8fb8ee', '#7ea8e2']), 4);
    for (let k = 0; k < 4; k++) { let x = Math.floor(p.rng() * 16), y = Math.floor(p.rng() * 16); for (let i = 0; i < 6; i++) { p.px(x, y, C('#c4dcfa')); x++; if (p.rng() < 0.55) y++; } }
    p.dots(5, C('#6f98d6'));
  });
  newTex('podzol_top', p => { p.blot(CP(['#6a4a25', '#5a3d1d', '#7a5a2f', '#4f351a', '#83622f']), 2); p.dots(9, C('#9a7a3f')); p.dots(7, C('#3d2913')); p.dash(4, 2, C('#a0522d')); });
  newTex('podzol_side', p => {
    p.copy('dirt'); const pal = CP(['#6a4a25', '#5a3d1d', '#7a5a2f']);
    for (let x = 0; x < 16; x++) { const dep = 2 + Math.floor(p.rng() * 2); for (let y = 0; y < dep; y++) p.px(x, y, pal[Math.floor(p.rng() * 3)]); p.px(x, dep, C('#3d2913')); }
  });
  newTex('mud', p => { p.blot(CP(['#3d3531', '#46403a', '#352e2a', '#4a433d', '#403832']), 4); p.dash(4, 3, C('#5a524b')); p.dots(6, C('#2a2421')); });
  newTex('coarse_dirt', p => { p.speckle(CP(['#7a5234', '#6c482c', '#86603f', '#5e3f27'])); p.dots(12, C('#9a8d80')); p.dots(8, C('#4a3220')); p.dots(5, C('#b3a698')); });
  newTex('moss', p => { p.blot(CP(['#5d8a3a', '#527e33', '#689642', '#487229', '#5d8a3a']), 2); p.dots(9, C('#7aa84f')); p.dots(6, C('#3c6222')); });
  const mycPal = CP(['#7a6a80', '#70617a', '#857590', '#695a72']);
  newTex('mycelium_top', p => { p.speckle(mycPal); p.dots(9, C('#a79bb0')); p.dots(6, C('#544660')); });
  newTex('mycelium_side', p => {
    p.copy('dirt');
    for (let x = 0; x < 16; x++) { const dep = 2 + Math.floor(p.rng() * 3); for (let y = 0; y < dep; y++) p.px(x, y, mycPal[Math.floor(p.rng() * 4)]); p.px(x, dep, C('#544660')); }
  });
  newTex('mush_brown', p => { p.blot(CP(['#9a7352', '#8f694a', '#a67d5b', '#94704f']), 4); p.dots(8, C('#b38a66')); p.dots(5, C('#7d5a3e')); });
  newTex('mush_red', p => {
    p.blot(CP(['#c23a30', '#b8332a', '#cc4338', '#bd372d']), 4);
    for (const [x, y, w, h] of [[2, 2, 3, 2], [10, 1, 2, 2], [6, 6, 3, 3], [12, 8, 2, 2], [1, 10, 2, 2], [5, 12, 2, 2], [10, 12, 3, 2]]) { p.rect(x, y, w, h, C('#f6ece6')); p.px(x + w - 1, y + h - 1, C('#dccbc2')); }
  });
  newTex('mush_stem', p => {
    for (let x = 0; x < 16; x++) { const c = C(['#d9ccb4', '#cfc2a9', '#e3d7c0', '#d9ccb4'][Math.floor(p.rng() * 4)]); for (let y = 0; y < 16; y++) p.px(x, y, p.rng() < 0.12 ? C('#c4b69c') : c); }
    p.dash(4, 1, C('#b5a78c'));
  });
  newTex('mush_pore', p => { p.speckle(CP(['#c9b18a', '#c2aa83', '#d0b992'])); for (let y = 1; y < 16; y += 2) for (let x = (y >> 1) & 1; x < 16; x += 2) p.px(x, y, C('#a48c66')); });
  const rock = (name, pal, lt, dk) => newTex(name, p => { p.blot(CP(pal), 2); p.dots(14, C(lt)); p.dots(12, C(dk)); });
  rock('granite', ['#9a6b5c', '#a07363', '#8f6455', '#a87d6e', '#96685a'], '#c9a79a', '#6e4a40');
  rock('diorite', ['#cfcfd1', '#bdbdc0', '#dcdcde', '#c4c4c7', '#b2b2b6'], '#efeff0', '#7e7e84');
  rock('andesite', ['#8a8d8a', '#828582', '#939693', '#7b7e7b', '#8a8d8a'], '#a9aca9', '#666966');
  const oreDef = { coal: ['#2b2b2e', '#4f4f56'], iron: ['#c9a383', '#ecd2ba'], gold: ['#f2c53d', '#fff0a0'], diamond: ['#5fe0d8', '#d2fffb'], glow: ['#ffb84a', '#fff6c8'] };
  for (const k in oreDef) newTex('ore_' + k, p => {
    p.copy('stone');
    for (const [x, y] of ORE_SH) p.px(x, y, C('#62646a'));
    for (const [x, y] of ORE_SPOTS) p.px(x, y, C(oreDef[k][0]));
    for (const [x, y] of ORE_HL) p.px(x, y, C(oreDef[k][1]));
  });
  newTex('sandstone', p => {
    p.speckle(CP(['#dccf98', '#d5c78f', '#e3d6a1']));
    for (const y of [0]) for (let x = 0; x < 16; x++) p.px(x, y, C('#ece1b4'));
    for (const y of [4, 9, 13]) for (let x = 0; x < 16; x++) if (p.rng() < 0.85) p.px(x, y, C('#c4b57d'));
    for (let x = 0; x < 16; x++) p.px(x, 15, C('#b9aa73'));
  });
  newTex('sandstone_top', p => { p.speckle(CP(['#e3d6a1', '#dccf98', '#e6daa7'])); for (let i = 0; i < 16; i++) { p.px(i, 0, C('#ece1b4')); p.px(0, i, C('#ece1b4')); p.px(i, 15, C('#c4b57d')); p.px(15, i, C('#c4b57d')); } });
  newTex('glass', p => {
    for (let i = 0; i < 16; i++) { p.px(i, 0, C('#dff3f8')); p.px(0, i, C('#dff3f8')); p.px(i, 15, C('#a9cdd8')); p.px(15, i, C('#a9cdd8')); }
    for (const [x, y] of [[2, 5], [3, 4], [4, 3], [5, 2], [11, 13], [12, 12], [13, 11]]) p.px(x, y, C('#ffffff'), 230);
  });
  newTex('bricks', p => {
    p.rect(0, 0, 16, 16, C('#c9c1b4'));
    const bp = CP(['#a5503c', '#964634', '#b35b45', '#9e4a38']);
    for (let r = 0; r < 4; r++) for (let x = 0; x < 16; x++) {
      const off = r % 2 ? 4 : 0, bx = (x + off) % 8;
      if (bx === 7) continue;
      const tone = bp[((x + off) >> 3) + r & 3];
      for (let y = r * 4; y < r * 4 + 3; y++) p.px(x, y, p.rng() < 0.15 ? shadeC(tone, 0.9) : tone);
    }
  });
  const sbrick = (p, cracked) => {
    const pal = CP(['#909296', '#888a8e', '#96989c']);
    p.speckle(pal);
    const bricks = [[0, 0, 8, 8], [8, 0, 8, 8], [4, 8, 8, 8], [12, 8, 8, 8]];
    for (const [bx, by, bw, bh] of bricks) for (let i = 0; i < bw; i++) for (let j = 0; j < bh; j++) {
      if (j === 0 || i === 0) p.px(bx + i, by + j, C('#a6a8ad'));
      if (j === bh - 1 || i === bw - 1) p.px(bx + i, by + j, C('#5f6166'));
    }
    if (cracked) for (const [x, y] of [[2, 2], [3, 3], [3, 4], [4, 5], [5, 5], [11, 1], [11, 2], [12, 3], [13, 3], [13, 4], [7, 10], [8, 11], [8, 12], [9, 13], [10, 13], [1, 12], [2, 13], [14, 11], [15, 12]]) p.px(x, y, C('#4a4c50'));
  };
  newTex('stone_bricks', p => sbrick(p, false));
  newTex('cracked_bricks', p => sbrick(p, true));
  newTex('obsidian', p => { p.blot(CP(['#16112a', '#1d1730', '#241c3a', '#2d2447', '#1a1430']), 4); p.dots(6, C('#5b4a8a')); });
  const metal = (name, m, l, s) => newTex(name, p => {
    p.rect(0, 0, 16, 16, C(m));
    for (let y = 2; y < 14; y += 3) for (let x = 2; x < 14; x++) p.px(x, y, shadeC(C(m), 0.94));
    for (let i = 0; i < 16; i++) { p.px(i, 0, C(l)); p.px(0, i, C(l)); p.px(i, 15, C(s)); p.px(15, i, C(s)); }
    for (let i = 1; i < 15; i++) { p.px(i, 1, shadeC(C(l), 0.95)); p.px(1, i, shadeC(C(l), 0.95)); p.px(i, 14, shadeC(C(s), 1.1)); p.px(14, i, shadeC(C(s), 1.1)); }
    p.px(4, 4, C(l)); p.px(5, 4, C(l)); p.px(4, 5, C(l));
  });
  metal('iron_block', '#d8d8d8', '#f6f6f6', '#a2a2a2'); metal('gold_block', '#f6cf3e', '#fff3a0', '#c99a1e'); metal('diamond_block', '#6ee6de', '#d2fffb', '#35b3ab');
  newTex('glow_block', p => { p.blot(CP(['#ffc23a', '#ffd45c', '#ffe9a0', '#fff6cf', '#ffd45c']), 4); for (let i = 0; i < 16; i++) { p.px(i, 0, C('#e6a52e')); p.px(0, i, C('#e6a52e')); p.px(i, 15, C('#c98a22')); p.px(15, i, C('#c98a22')); } p.dash(4, 3, C('#e6a52e')); });
  newTex('altar_top', p => {
    p.copy('obsidian');
    const g = C('#f6cf3e'), g2 = C('#c99a1e');
    for (let i = 0; i < 16; i++) { p.px(i, 0, g2); p.px(0, i, g2); p.px(i, 15, g2); p.px(15, i, g2); }
    for (let i = 0; i < 5; i++) { p.px(7 - i, 3 + i, g); p.px(8 + i, 3 + i, g); p.px(3 + i, 8 + i, g); p.px(12 - i, 8 + i, g); }
    p.rect(7, 7, 2, 2, C('#6ee6de')); p.px(7, 7, C('#d2fffb'));
    for (const [x, y] of [[2, 2], [13, 2], [2, 13], [13, 13]]) p.px(x, y, C('#8f6fe0'));
  });
  newTex('altar_side', p => {
    p.copy('obsidian');
    for (let x = 0; x < 16; x++) { p.px(x, 2, C('#f6cf3e')); p.px(x, 3, C('#c99a1e')); p.px(x, 14, C('#c99a1e')); }
    for (const [x, y] of [[3, 7], [3, 8], [3, 9], [4, 8], [7, 6], [8, 6], [7, 7], [8, 8], [7, 9], [8, 9], [12, 7], [11, 8], [12, 8], [13, 8], [12, 9], [12, 10]]) p.px(x, y, C('#8f6fe0'));
  });
  for (const k in WOOL_COL) newTex('wool_' + k, p => {
    const c = C(WOOL_COL[k]);
    for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
      const w = ((x + (y >> 1) * 2) % 4 === 0) ? 0.9 : ((x + y) % 5 === 0 ? 1.06 : 1);
      p.px(x, y, shadeC(c, w * (0.97 + p.rng() * 0.06)));
    }
  });
  // 作業台・かまど・チェスト
  newTex('table_top', p => {
    p.copy('planks_oak'); const dk = C('#6b4a25');
    for (let i = 0; i < 16; i++) { p.px(i, 0, dk); p.px(0, i, dk); p.px(i, 15, dk); p.px(15, i, dk); }
    for (let i = 2; i < 14; i++) { p.px(i, 5, dk); p.px(i, 10, dk); p.px(5, i, dk); p.px(10, i, dk); }
    for (let i = 2; i < 14; i++) { p.px(i, 2, C('#c9a46b')); p.px(2, i, C('#c9a46b')); }
  });
  const tableSide = (p, alt) => {
    p.copy('planks_oak'); const dk = C('#6b4a25'), ir = C('#c9c9c9'), ir2 = C('#8c8c8c'), hd = C('#8a6238');
    for (let i = 0; i < 16; i++) { p.px(i, 0, dk); p.px(i, 1, C('#c9a46b')); p.px(0, i, dk); p.px(15, i, dk); p.px(i, 15, dk); }
    if (!alt) {   // のこぎりと金づち
      for (let i = 0; i < 6; i++) { p.px(3 + i, 5, ir); p.px(3 + i, 6, i % 2 ? ir2 : ir); } p.px(9, 5, hd); p.px(10, 5, hd); p.px(9, 6, hd); p.px(10, 6, hd);
      p.rect(4, 9, 4, 2, ir2); p.px(5, 11, hd); p.px(6, 11, hd); p.px(5, 12, hd); p.px(6, 12, hd); p.px(5, 13, hd); p.px(6, 13, hd);
      p.px(11, 9, hd); p.px(11, 10, hd); p.px(11, 11, hd); p.px(11, 12, hd); p.px(10, 9, ir); p.px(12, 9, ir);
    } else {      // はさみとオノ
      p.px(4, 4, ir); p.px(5, 5, ir); p.px(6, 6, ir); p.px(8, 4, ir); p.px(7, 5, ir); p.px(5, 7, hd); p.px(4, 8, hd); p.px(7, 7, hd); p.px(8, 8, hd);
      p.rect(10, 9, 3, 3, ir); p.px(10, 9, ir2); p.px(11, 12, hd); p.px(11, 13, hd); p.px(11, 8, hd); p.px(11, 7, hd);
      p.px(4, 11, hd); p.px(5, 11, hd); p.px(6, 11, hd); p.px(7, 11, hd); p.px(4, 12, ir2); p.px(7, 12, ir2);
    }
  };
  newTex('table_side', p => tableSide(p, false));
  newTex('table_front', p => tableSide(p, true));
  newTex('furnace_top', p => { p.copy('stone'); for (let i = 0; i < 16; i++) { p.px(i, 0, C('#a6a8ad')); p.px(0, i, C('#a6a8ad')); p.px(i, 15, C('#5f6166')); p.px(15, i, C('#5f6166')); } for (let i = 4; i < 12; i++) { p.px(i, 4, C('#6e7075')); p.px(i, 11, C('#6e7075')); p.px(4, i, C('#6e7075')); p.px(11, i, C('#6e7075')); } });
  newTex('furnace_side', p => { cobbleTex(p, CP(['#8f9195', '#84868a', '#9a9ca0']), C('#606267')); for (let i = 0; i < 16; i++) { p.px(i, 0, C('#a6a8ad')); p.px(i, 15, C('#55575c')); } });
  const furnaceFront = (p, lit) => {
    p.copy('furnace_side');
    p.rect(3, 2, 10, 4, C('#55575c')); p.rect(4, 3, 8, 2, C('#2a2a2d')); for (let x = 5; x < 12; x += 2) p.px(x, 3, C('#55575c'));
    p.rect(3, 8, 10, 7, C('#55575c')); p.rect(4, 9, 8, 5, C('#1b1b1d'));
    if (lit) {
      const f = CP(['#d9421f', '#ff8a2b', '#ffd23d', '#fff3a8']);
      for (let x = 4; x < 12; x++) { const hgt = 2 + Math.floor(p.rng() * 3); for (let k = 0; k < hgt; k++) p.px(x, 13 - k, f[clamp(2 - k + Math.floor(p.rng() * 2), 0, 3)]); }
    } else { for (let x = 4; x < 12; x++) if (p.rng() < 0.6) p.px(x, 13, C('#3a3a3d')); }
  };
  newTex('furnace_front', p => furnaceFront(p, false));
  newTex('furnace_front_lit', p => furnaceFront(p, true));
  const chest = (p, kind) => {
    const m = C('#a8742f'), dk = C('#5b3d18'), lt = C('#c48d42');
    for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) p.px(x, y, p.rng() < 0.2 ? lt : m);
    for (let i = 0; i < 16; i++) { p.px(i, 0, dk); p.px(0, i, dk); p.px(i, 15, dk); p.px(15, i, dk); }
    if (kind !== 'top') { for (let x = 0; x < 16; x++) { p.px(x, 5, dk); p.px(x, 6, shadeC(m, 0.8)); } for (let y = 1; y < 15; y++) if (y !== 5) { p.px(5, y, shadeC(m, 0.88)); p.px(10, y, shadeC(m, 0.88)); } }
    else { for (let i = 2; i < 14; i++) { p.px(i, 2, lt); p.px(2, i, lt); p.px(i, 13, shadeC(m, 0.8)); p.px(13, i, shadeC(m, 0.8)); } }
    if (kind === 'front') { p.rect(6, 3, 4, 5, C('#3d3d40')); p.rect(7, 4, 2, 3, C('#d9d9d9')); p.px(7, 4, C('#ffffff')); }
  };
  newTex('chest_top', p => chest(p, 'top')); newTex('chest_side', p => chest(p, 'side')); newTex('chest_front', p => chest(p, 'front'));
  newTex('torch', p => {
    for (let y = 6; y < 16; y++) { p.px(7, y, C('#8a6238')); p.px(8, y, C('#6e4c29')); }
    p.px(7, 2, C('#fff3a8')); p.px(8, 2, C('#fff3a8')); p.px(7, 3, C('#ffd84a')); p.px(8, 3, C('#ffe880'));
    p.px(7, 4, C('#ffb02e')); p.px(8, 4, C('#ffc247')); p.px(7, 5, C('#f08a1a')); p.px(8, 5, C('#d9741a'));
  });
  newTex('cactus_side', p => {
    const g = CP(['#4f9a4a', '#488f44', '#56a551']);
    for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) p.px(x, y, (x % 4 === 1) ? C('#3a7a36') : g[Math.floor(p.rng() * 3)]);
    for (let y = 1; y < 16; y += 3) for (let x = 1; x < 16; x += 4) p.px(x + ((y / 3) & 1 ? 2 : 0), y, C('#e8e6a0'));
  });
  newTex('cactus_top', p => { p.speckle(CP(['#5aa955', '#4f9a4a', '#63b45e'])); for (let i = 1; i < 15; i++) { p.px(i, 1, C('#3a7a36')); p.px(1, i, C('#3a7a36')); p.px(i, 14, C('#3a7a36')); p.px(14, i, C('#3a7a36')); } p.rect(7, 7, 2, 2, C('#7ac474')); });
  const flower = (name, rows, pal) => { const d = sprite(rows, P(pal)); TEX[name] = TEX_DATA.length; TEX_DATA.push(d); };
  flower('flower_red', ['', '', '', '......rr........', '.....rRRr.rr....', '.....rRyRrRRr...', '......rRRrRyR...', '.......rr.rRr...', '.......s...s....', '.......s..s.....', '....ll.s.s......', '...lLLlss.......', '....lLLs..ll....', '......ls.lLl....', '.......sll......', '.......s........'],
    { r: '#b82e25', R: '#e2463a', y: '#ffd84a', s: '#3f8a35', l: '#3f8a35', L: '#5aa842' });
  flower('flower_yellow', ['', '', '', '', '......yYy.......', '.....yYYYy......', '.....YYoYY......', '.....yYYYy......', '......yYy.......', '.......s........', '.......s........', '....ll.s........', '...lLLls..ll....', '....lLss.lLl....', '......sll.......', '.......s........'],
    { y: '#e0b81e', Y: '#f8d93a', o: '#e0801e', s: '#3f8a35', l: '#3f8a35', L: '#5aa842' });
  flower('flower_blue', ['', '', '.......b........', '......bBb.......', '......bBb..b....', '...b...s..bBb...', '..bBb..s..bBb...', '..bBb..s...s....', '...s...s..s.....', '...s..ss.s......', '....s.sss.......', '.....sss........', '...ll.s..ll.....', '..lLLls.lLLl....', '...lllsllll.....', '.......s........'],
    { b: '#3a5fc4', B: '#6f9bf5', s: '#3f8a35', l: '#3f8a35', L: '#5aa842' });
  flower('flower_white', ['', '', '', '', '.....w.w.w......', '......www.......', '.....wwyww......', '......www.......', '.....w.w.w......', '.......s........', '.......s........', '.......s..ll....', '...ll..s.lLl....', '..lLLl.sll......', '...lLLss........', '.......s........'],
    { w: '#f6f6f2', y: '#f8d93a', s: '#3f8a35', l: '#3f8a35', L: '#5aa842' });
  flower('deadbush', ['', '', '', '', '...b......b.....', '....b..b.b......', '.b...b.b.b...b..', '..b..b.bb...b...', '...b..bb...b....', '....b.bb..b.....', '.....bbb.b......', '......bbb.......', '.......bb.......', '.......b........', '.......b........', '.......b........'], { b: '#8a6a3a' });
  flower('mushroom_brown', ['', '', '', '', '', '', '', '', '.....cccccc.....', '....cCCcCCCc....', '...cCCCCCCcCc...', '...cccccccccc...', '......ssss......', '......sSss......', '......sSss......', '.....ssssss.....'], { c: '#7a5236', C: '#a67650', s: '#d9ccb4', S: '#f1e8d6' });
  flower('mushroom_red', ['', '', '', '', '', '', '', '.....rrrrrr.....', '....rRRwRRRr....', '...rRwRRRRwRr...', '...rRRRRwRRRr...', '...rrrrrrrrrr...', '......ssss......', '......sSss......', '......sSss......', '.....ssssss.....'], { r: '#a8261e', R: '#d63a2f', w: '#fbeeea', s: '#d9ccb4', S: '#f1e8d6' });
  flower('flower_purple', ['', '', '.......p........', '......pPp.......', '......PpP.......', '.....pPPp.......', '......PpP..p....', '......pPp.pPp...', '.......s..PpP...', '.......s..pPp...', '....ll.s...s....', '...lLLls..s.....', '....lLss.s......', '......sss.......', '.......s........', '.......s........'],
    { p: '#7a4fc4', P: '#a583ea', s: '#3f8a35', l: '#3f8a35', L: '#5aa842' });
  flower('flower_orange', ['', '', '', '.....o.o.o......', '.....oOoOo......', '.....oOOOo......', '.....oOOOo......', '......ooo.......', '.......s........', '.......s........', '...l...s...l....', '...lL..s..Ll....', '....lL.s.Ll.....', '.....lLsLl......', '......lsl.......', '.......s........'],
    { o: '#d9651e', O: '#f58a3a', s: '#3f8a35', l: '#3f8a35', L: '#5aa842' });
  flower('fern', ['', '', '', '.......g........', '..g....G....g...', '...g...G...g....', '.g..G..G..G..g..', '..g..G.G.G..g...', '...G..GGG..G....', '.g..G..G..G..g..', '..gG.G.G.G.Gg...', '....G.GGG.G.....', '.....GGGGG......', '......GGG.......', '.......G........', '.......G........'],
    { g: '#57a84c', G: '#2f7a35' });
  flower('lily_pad', ['', '', '.....dddddd.....', '...ddllllllddd..', '..dllllllllllld.', '..dlllvllllvlld.', '.dlllllvllvllld.', '.dllllllvvlllld.', '.dlllvvvvdd.....', '.dllllllvvlllld.', '.dlllllvllvllld.', '..dlllvllllvlld.', '..dllllllllllld.', '...ddllllllddd..', '.....dddddd.....', ''],
    { d: '#2a6a2c', l: '#3f8f3a', v: '#57a84c' });
  flower('vine', ['..g....g.....g..', '..gl...g....lg..', '.lg....gl....g..', '..g...lg.....gl.', '..gl...g....lg..', '..g....gl....g..', '.lg....g.....g..', '..g...lg....lg..', '..gl...g.....gl.', '..g....gl....g..', '.lg...lg....lg..', '..g....g.....g..', '..gl...gl....gl.', '..g....g....lg..', '.lg...lg.....g..', '..g....g.....g..'],
    { g: '#2f7a2c', l: '#4fa03f' });
  flower('crown', ['', '', '', '', '', '', '', '..g...gg...g....', '.gGg.gGGg.gGg...', '.gGg.gGGg.gGg...', '.gGGgGrGGgGGg...', '.gGGGGGGGGGGg...', '.gbGGGrrGGGbg...', '.gGGGGGGGGGGg...', '.ggggggggggggg..', '..dddddddddd....'], { g: '#c99a1e', G: '#f6cf3e', r: '#d63a2f', b: '#6ee6de', d: '#8c6a12' });
  newTex('farmland_dry', p => { p.speckle(CP(['#6f4a2e', '#7d5535', '#644227'])); for (let y = 2; y < 16; y += 4) for (let x = 0; x < 16; x++) p.px(x, y, C('#553720')); p.dots(6, C('#946a45')); });
  newTex('farmland_wet', p => { p.speckle(CP(['#4a2f1c', '#553722', '#412817'])); for (let y = 2; y < 16; y += 4) for (let x = 0; x < 16; x++) p.px(x, y, C('#33200f')); p.dots(6, C('#6a4a30')); });
  for (let s = 0; s < 4; s++) newTex('wheat_' + s, p => {
    const hgt = 4 + s * 3, g = s < 3 ? CP([['#4f9a38', '#5aa842'], ['#6aa83a', '#7fb845'], ['#9ab33e', '#b0c44c']][s]) : CP(['#c9a035', '#e0bb48']);
    for (let x = 1; x < 16; x += 2) {
      const hh = hgt - Math.floor(p.rng() * 2);
      for (let k = 0; k < hh; k++) p.px(x + (k > 5 && p.rng() < 0.2 ? 1 : 0), 15 - k, g[k & 1]);
      if (s === 3) { p.px(x, 15 - hh, C('#f0d060')); p.px(x, 14 - hh, C('#d9b13c')); p.px(x - 1, 15 - hh + 1, C('#b98f25')); p.px(x + 1, 15 - hh + 2, C('#b98f25')); }
    }
  });
  // ベッド・ドア・はしご
  newTex('bed_top_head', p => { p.rect(0, 0, 16, 16, C('#c9413a')); p.rect(0, 0, 16, 2, C('#8a6238')); p.rect(2, 3, 12, 6, C('#f2f2f0')); for (let x = 2; x < 14; x++) p.px(x, 8, C('#cfcfcc')); p.px(2, 3, C('#cfcfcc')); p.px(13, 3, C('#cfcfcc')); for (let x = 0; x < 16; x++) p.px(x, 10, C('#f2f2f0')); p.rect(0, 11, 16, 5, C('#c9413a')); for (let x = 0; x < 16; x++) if (x % 3 === 0) p.px(x, 13, C('#a8322c')); });
  newTex('bed_top_foot', p => { p.rect(0, 0, 16, 16, C('#c9413a')); for (let y = 1; y < 16; y += 3) for (let x = 0; x < 16; x++) if ((x + y) % 3 === 0) p.px(x, y, C('#a8322c')); p.rect(0, 14, 16, 2, C('#8a6238')); for (let i = 0; i < 16; i++) { p.px(0, i, C('#b33830')); p.px(15, i, C('#b33830')); } });
  newTex('bed_side', p => { p.rect(0, 7, 16, 3, C('#c9413a')); p.rect(0, 10, 16, 2, C('#e6e6e2')); p.rect(0, 12, 16, 4, C('#6e4c29')); p.rect(0, 12, 3, 4, C('#8a6238')); p.rect(13, 12, 3, 4, C('#8a6238')); p.rect(3, 13, 10, 3, C('#3d2a16')); for (let x = 0; x < 16; x++) p.px(x, 7, C('#de5a52')); });
  // ドアとトラップドアは 白っぽく描いておき、木の色をかけ算する（TINT）。こうすると木の種類ごとに絵を持たなくてすむ
  const door = (p, top) => {
    const m = C('#ffffff'), dk = C('#b2b2b2'), lt = C('#f0f0f0');
    for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) p.px(x, y, p.rng() < 0.15 ? lt : m);
    for (let i = 0; i < 16; i++) { p.px(0, i, dk); p.px(15, i, dk); } for (let x = 0; x < 16; x++) p.px(x, top ? 0 : 15, dk);
    if (top) { for (const x0 of [3, 9]) { p.rect(x0 - 1, 2, 6, 7, dk); for (let y = 3; y < 8; y++) for (let x = x0; x < x0 + 4; x++) p.clr(x, y); } p.rect(2, 11, 12, 1, dk); p.rect(2, 12, 12, 1, lt); }
    else { p.rect(3, 3, 10, 9, dk); p.rect(4, 4, 8, 7, shadeC(m, 0.9)); p.rect(4, 4, 8, 1, lt); p.rect(12, 0, 2, 2, C('#4a4a4a')); p.px(12, 0, C('#8a8a8a')); }
  };
  newTex('trapdoor', p => {
    for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) p.px(x, y, p.rng() < 0.15 ? C('#f0f0f0') : C('#ffffff'));
    for (let i = 0; i < 16; i++) { p.px(i, 0, C('#b2b2b2')); p.px(0, i, C('#b2b2b2')); p.px(i, 15, C('#9a9a9a')); p.px(15, i, C('#9a9a9a')); p.px(i, 7, C('#c4c4c4')); p.px(i, 8, C('#c4c4c4')); p.px(7, i, C('#c4c4c4')); p.px(8, i, C('#c4c4c4')); }
    for (const [x0, y0] of [[3, 3], [10, 3], [3, 10], [10, 10]]) { p.rect(x0 - 1, y0 - 1, 5, 5, C('#a6a6a6')); for (let y = y0; y < y0 + 3; y++) for (let x = x0; x < x0 + 3; x++) p.clr(x, y); }
  });
  newTex('door_top', p => door(p, true)); newTex('door_bottom', p => door(p, false));
  newTex('ladder', p => { const a = C('#9a7040'), b2 = C('#6e4c29'); for (let y = 0; y < 16; y++) { p.px(2, y, a); p.px(3, y, b2); p.px(12, y, a); p.px(13, y, b2); } for (const y of [1, 5, 9, 13]) for (let x = 2; x < 14; x++) { p.px(x, y, a); p.px(x, y + 1, b2); } });
  // ---- 色をかけて使う もとの絵 ----
  newTex('concrete', p => { p.speckle(CP(['#fbfbfb', '#f4f4f4', '#ffffff', '#f7f7f7'])); p.dots(5, C('#e8e8e8')); });
  newTex('glass_tint', p => {
    p.rect(0, 0, 16, 16, C('#ffffff'), 118);
    for (let i = 0; i < 16; i++) { p.px(i, 0, C('#ffffff'), 205); p.px(0, i, C('#ffffff'), 205); p.px(i, 15, C('#d8d8d8'), 205); p.px(15, i, C('#d8d8d8'), 205); }
    for (const [x, y] of [[2, 5], [3, 4], [4, 3], [5, 2], [11, 13], [12, 12], [13, 11]]) p.px(x, y, C('#ffffff'), 225);
  });
  // ---- 明かり ----
  newTex('lantern_side', p => {
    const ir = C('#3d4148'), ir2 = C('#5a5f68'), hot = CP(['#fff3a8', '#ffd84a', '#ffb02e', '#f08a1a']);
    p.rect(0, 0, 16, 16, ir);
    for (let y = 0; y < 7; y++) { p.px(7, y, y & 1 ? ir : ir2); p.px(8, y, y & 1 ? ir2 : ir); }      // くさり
    p.rect(6, 6, 4, 3, ir); p.px(6, 6, ir2); p.px(9, 6, ir2);                                           // ふた
    p.rect(5, 8, 6, 8, ir);                                                                              // わく
    for (let y = 10; y < 14; y++) for (let x = 6; x < 10; x++) p.px(x, y, hot[clamp(Math.abs(x - 7.5) > 1 ? 2 : (y < 12 ? 0 : 1), 0, 3)]);
    p.px(5, 8, ir2); p.px(10, 8, ir2);
  });
  newTex('lantern_top', p => { p.rect(0, 0, 16, 16, C('#3d4148')); p.rect(6, 6, 4, 4, C('#5a5f68')); p.rect(7, 7, 2, 2, C('#2a2d33')); });
  newTex('chochin_side', p => {
    const bk = C('#26221f'), red = CP(['#d6453a', '#c23a30', '#e2584c']);
    p.rect(0, 0, 16, 16, red[1]); p.rect(0, 0, 16, 3, bk); p.rect(0, 14, 16, 2, bk);
    p.rect(5, 1, 6, 2, bk); p.rect(5, 14, 6, 2, bk);
    for (let y = 3; y < 14; y++) for (let x = 4; x < 12; x++) {
      const rib = y % 2 === 0, mid = Math.abs(y - 8) <= 2 && x >= 6 && x <= 9;
      p.px(x, y, mid ? (rib ? C('#f6c05a') : C('#ffe08a')) : rib ? red[1] : (x === 5 || x === 6 ? red[2] : red[0]));
    }
    for (let y = 3; y < 14; y++) { p.px(4, y, C('#a8322c')); p.px(11, y, C('#a8322c')); }
  });
  newTex('chochin_top', p => { p.rect(0, 0, 16, 16, C('#26221f')); p.rect(6, 6, 4, 4, C('#3a3531')); });
  newTex('campfire_log', p => {
    const bark = CP(['#5c4327', '#4f3920', '#6b4f2f', '#3d2c18']);
    for (let y = 0; y < 16; y++) { let c = bark[Math.floor(p.rng() * 3)]; for (let x = 0; x < 16; x++) { if (p.rng() < 0.2) c = bark[Math.floor(p.rng() * 4)]; p.px(x, y, c); } }
    for (let i = 0; i < 9; i++) p.px(Math.floor(p.rng() * 16), Math.floor(p.rng() * 16), C('#1c1612'));
    for (let i = 0; i < 6; i++) p.px(Math.floor(p.rng() * 16), Math.floor(p.rng() * 16), C(i & 1 ? '#ff8a2b' : '#ffd23d'));
  });
  for (let f = 0; f < 2; f++) newTex('fire_' + f, p => {
    const pal = CP(['#fff3a8', '#ffd23d', '#ff8a2b', '#d9421f']);
    for (let x = 2; x < 14; x++) {
      const hgt = 5 + Math.floor(p.rng() * 8) + (Math.abs(x - 7.5) < 3 ? 2 : 0);
      for (let k = 0; k < hgt; k++) { const t = k / hgt; p.px(x, 15 - k, pal[t < 0.25 ? 0 : t < 0.5 ? 1 : t < 0.8 ? 2 : 3]); }
    }
  });
  newTex('crystal_lamp', p => {
    p.blot(CP(['#d8f6ff', '#bfeefc', '#eafcff', '#a9e4f6', '#d8f6ff']), 4);
    for (let i = 0; i < 16; i++) { p.px(i, 0, C('#f6feff')); p.px(0, i, C('#f6feff')); p.px(i, 15, C('#7fc6dc')); p.px(15, i, C('#7fc6dc')); }
    for (let i = 3; i < 13; i++) { p.px(i, i, C('#ffffff')); p.px(15 - i, i, C('#9adbee')); }
  });
  // ---- かざり ----
  newTex('hay_side', p => {
    const st = CP(['#d9b13c', '#c99f30', '#e6c24e', '#b88d25']);
    for (let x = 0; x < 16; x++) { let c = st[Math.floor(p.rng() * 4)]; for (let y = 0; y < 16; y++) { if (p.rng() < 0.25) c = st[Math.floor(p.rng() * 4)]; p.px(x, y, c); } }
    for (const y of [3, 12]) for (let x = 0; x < 16; x++) { p.px(x, y, C('#a8322c')); p.px(x, y + 1, C('#7a211c')); }
  });
  newTex('hay_top', p => {
    const st = CP(['#d9b13c', '#c99f30', '#e6c24e', '#b88d25']);
    for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) { const r = Math.max(Math.abs(x - 7.5), Math.abs(y - 7.5)); p.px(x, y, st[(Math.floor(r) + (p.rng() < 0.2 ? 1 : 0)) & 3]); }
  });
  const smooth = (name, pal, lt, dk) => newTex(name, p => {
    p.blot(CP(pal), 4);
    for (let i = 0; i < 16; i++) { p.px(i, 0, C(lt)); p.px(0, i, C(lt)); p.px(i, 15, C(dk)); p.px(15, i, C(dk)); }
  });
  smooth('granite_smooth', ['#9a6b5c', '#a07363', '#a87d6e', '#96685a', '#a07363'], '#bf9486', '#74503f');
  smooth('diorite_smooth', ['#cfcfd1', '#c4c4c7', '#dcdcde', '#c9c9cc', '#d4d4d6'], '#efeff0', '#9a9a9f');
  smooth('andesite_smooth', ['#8a8d8a', '#868986', '#939693', '#8a8d8a', '#8f928f'], '#a9aca9', '#666966');
  smooth('smooth_stone', ['#9c9ea3', '#98999e', '#a2a4a8', '#9c9ea3', '#9fa1a5'], '#b4b6ba', '#6e7075');
  newTex('chiseled_bricks', p => {
    p.speckle(CP(['#909296', '#888a8e', '#96989c']));
    for (let i = 0; i < 16; i++) { p.px(i, 0, C('#a6a8ad')); p.px(0, i, C('#a6a8ad')); p.px(i, 15, C('#5f6166')); p.px(15, i, C('#5f6166')); }
    for (let i = 3; i < 13; i++) { p.px(i, 3, C('#5f6166')); p.px(3, i, C('#5f6166')); p.px(i, 12, C('#a6a8ad')); p.px(12, i, C('#a6a8ad')); }
    p.rect(6, 6, 4, 4, C('#6e7075')); p.rect(7, 7, 2, 2, C('#a6a8ad'));
  });
  newTex('mossy_bricks', p => {
    sbrick(p, false);
    const g = CP(['#5d8a3a', '#4d7a30', '#6a9a44']);
    for (let i = 0; i < 8; i++) { const x = Math.floor(p.rng() * 16), y = Math.floor(p.rng() * 16); for (let k = 0; k < 6; k++) p.px(x + Math.floor(p.rng() * 4) - 1, y + Math.floor(p.rng() * 3) - 1, g[Math.floor(p.rng() * 3)]); }
  });
  newTex('chiseled_sandstone', p => {
    p.speckle(CP(['#dccf98', '#d5c78f', '#e3d6a1']));
    for (let x = 0; x < 16; x++) { p.px(x, 0, C('#ece1b4')); p.px(x, 15, C('#b9aa73')); p.px(x, 3, C('#c4b57d')); p.px(x, 12, C('#c4b57d')); }
    for (const x0 of [2, 9]) { p.rect(x0, 5, 5, 6, C('#c4b57d')); p.rect(x0 + 1, 6, 3, 4, C('#ece1b4')); p.px(x0 + 2, 7, C('#b9aa73')); p.px(x0 + 2, 8, C('#b9aa73')); }
  });
  newTex('red_sandstone', p => {
    p.speckle(CP(['#c0672e', '#b85f29', '#c96f33']));
    for (let x = 0; x < 16; x++) { p.px(x, 0, C('#d98a52')); p.px(x, 15, C('#8f4a1c')); }
    for (const y of [4, 9, 13]) for (let x = 0; x < 16; x++) if (p.rng() < 0.85) p.px(x, y, C('#a2531f'));
  });
  newTex('red_sandstone_top', p => { p.speckle(CP(['#c96f33', '#c0672e', '#d2783a'])); for (let i = 0; i < 16; i++) { p.px(i, 0, C('#d98a52')); p.px(0, i, C('#d98a52')); p.px(i, 15, C('#a2531f')); p.px(15, i, C('#a2531f')); } });
  newTex('iron_bars', p => {
    const a = C('#8c9096'), b2 = C('#5f6368');
    for (const x of [1, 5, 9, 13]) for (let y = 0; y < 16; y++) { p.px(x, y, a); p.px(x + 1, y, b2); }
    for (const y of [0, 15]) for (let x = 0; x < 16; x++) p.px(x, y, y ? b2 : a);
  });
  // 水・溶岩（動く）
  for (let f = 0; f < 8; f++) newTex('water_' + f, p => {
    const pal = CP(['#2f62cf', '#3b72e0', '#4a82ea', '#6a9cf5']);
    for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
      const v = Math.sin((x + f * 2) * Math.PI / 8 + Math.sin(y * Math.PI / 4) * 1.2) + Math.sin((y - f * 2) * Math.PI / 8 + Math.cos(x * Math.PI / 8) * 1.1);
      const i = v > 1.45 ? 3 : v > 0.5 ? 2 : v > -0.7 ? 1 : 0;
      p.px(x, y, pal[i], i === 3 ? 205 : 172);
    }
  });
  for (let f = 0; f < 4; f++) newTex('lava_' + f, p => {
    const pal = CP(['#c93d12', '#e8591a', '#ff8a1c', '#ffb02e', '#ffd75a']);
    for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
      const v = Math.sin((x + f * 4) * Math.PI / 8 + Math.sin(y * Math.PI / 8) * 2) + Math.sin((y - f * 4) * Math.PI / 8 + Math.sin(x * Math.PI / 8) * 2);
      p.px(x, y, pal[clamp(Math.floor((v + 2) * 1.25), 0, 4)]);
    }
  });
  // ---- べつの世界のブロック ----
  newTex('yakeishi', p => { p.blot(CP(['#8f3b34', '#80332d', '#9c463e', '#742d28', '#893832']), 2); p.dots(14, C('#b25a4e')); p.dots(12, C('#5a221e')); });
  newTex('ore_quartz', p => { p.copy('yakeishi'); for (const [x, y] of ORE_SH) p.px(x, y, C('#5a221e')); for (const [x, y] of ORE_SPOTS) p.px(x, y, C('#e9e2d8')); for (const [x, y] of ORE_HL) p.px(x, y, C('#ffffff')); });
  newTex('nageki_sand', p => {
    p.blot(CP(['#4f3d30', '#463529', '#594638', '#3e2f24', '#4f3d30']), 4); p.dots(10, C('#6a5646'));
    for (const [x, y] of [[3, 4], [4, 4], [9, 3], [10, 3], [5, 8], [6, 9], [7, 9], [8, 8], [12, 11], [13, 11], [2, 12], [3, 13]]) p.px(x, y, C('#2c2019'));   // くぼみ（なげく顔のように見える）
  });
  newTex('magma', p => {
    p.blot(CP(['#3a1c14', '#2e1510', '#472318', '#33180f']), 4);
    let x = 2, y = 0; for (let k = 0; k < 44; k++) { p.px(x, y, C(k % 5 === 0 ? '#ffd75a' : k % 2 ? '#ff8a1c' : '#e8591a')); if (p.rng() < 0.55) x += p.rng() < 0.5 ? 1 : -1; else y++; if (k === 20) { x = 11; y = 2; } }
    for (const [a, b] of [[6, 6], [7, 6], [13, 9], [1, 10], [9, 13], [10, 13]]) p.px(a, b, C('#ffb02e'));
  });
  const brickPat = (p, pal, mortar, hi) => {
    p.rect(0, 0, 16, 16, mortar);
    for (let r = 0; r < 4; r++) for (let x = 0; x < 16; x++) {
      const off = r % 2 ? 4 : 0, bx = (x + off) % 8; if (bx === 7) continue;
      const tone = pal[(((x + off) >> 3) + r) & 3];
      for (let y = r * 4; y < r * 4 + 3; y++) p.px(x, y, y === r * 4 && hi ? shadeC(tone, 1.14) : p.rng() < 0.15 ? shadeC(tone, 0.88) : tone);
    }
  };
  newTex('yake_bricks', p => brickPat(p, CP(['#70303a', '#662b34', '#7b3640', '#5c262e']), C('#34161b'), true));
  newTex('kurohashira', p => { for (let x = 0; x < 16; x++) { const c = C(['#3b3d44', '#33353b', '#44464e', '#2d2f35'][(x * 5 + (x >> 2)) & 3]); for (let y = 0; y < 16; y++) p.px(x, y, p.rng() < 0.1 ? shadeC(c, 0.8) : c); } for (const x of [3, 8, 12]) for (let y = 0; y < 16; y++) if (p.rng() < 0.8) p.px(x, y, C('#1f2025')); });
  newTex('kurohashira_top', p => { p.speckle(CP(['#3b3d44', '#33353b', '#44464e'])); for (let i = 0; i < 16; i++) { p.px(i, 0, C('#55575f')); p.px(0, i, C('#55575f')); p.px(i, 15, C('#1f2025')); p.px(15, i, C('#1f2025')); } for (let i = 4; i < 12; i++) { p.px(i, 4, C('#1f2025')); p.px(i, 11, C('#1f2025')); p.px(4, i, C('#1f2025')); p.px(11, i, C('#1f2025')); } });
  const aobi = CP(['#1f8f8a', '#1a807c', '#27a19b', '#16706c']);
  newTex('aobi_soil_top', p => { p.speckle(aobi); p.dots(10, C('#3fc7bd')); p.dots(8, C('#0f5552')); });
  newTex('aobi_soil_side', p => { p.copy('yakeishi'); for (let x = 0; x < 16; x++) { const dep = 2 + Math.floor(p.rng() * 3); for (let y = 0; y < dep; y++) p.px(x, y, aobi[Math.floor(p.rng() * 4)]); p.px(x, dep, C('#0f5552')); } });
  newTex('aobi_stem', p => { for (let x = 0; x < 16; x++) { const c = C(['#3a4a7a', '#33426e', '#425488', '#2d3a62'][(x * 3 + (x >> 1)) & 3]); for (let y = 0; y < 16; y++) p.px(x, y, p.rng() < 0.12 ? shadeC(c, 0.82) : c); } let x = 5; for (let y = 0; y < 16; y++) { p.px(x, y, C('#43d6c8')); if (p.rng() < 0.3) x += p.rng() < 0.5 ? 1 : -1; } x = 12; for (let y = 0; y < 16; y++) { if (y % 5 !== 4) p.px(x, y, C('#2fb3a8')); if (p.rng() < 0.3) x += p.rng() < 0.5 ? 1 : -1; } });
  newTex('aobi_stem_top', p => { p.rect(0, 0, 16, 16, C('#2d3a62')); for (const [r, c] of [[6, '#3a4a7a'], [4, '#43d6c8'], [3, '#425488'], [1, '#2fb3a8']]) for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) if (Math.max(Math.abs(x - 7.5), Math.abs(y - 7.5)) < r + 0.6) p.px(x, y, C(c)); });
  newTex('aobi_cap', p => { p.blot(CP(['#1c9c96', '#17898a', '#24aea6', '#127a7c', '#1c9c96']), 4); for (const [x, y] of [[2, 3], [9, 2], [13, 6], [5, 9], [11, 11], [3, 13], [8, 6]]) { p.px(x, y, C('#0c5b60')); p.px(x + 1, y, C('#0c5b60')); p.px(x, y + 1, C('#0e6468')); } p.dots(8, C('#4fd8cc')); });
  newTex('aobi_lamp', p => { p.blot(CP(['#9ff6ea', '#c8fff6', '#7fe9dc', '#eafffb', '#9ff6ea']), 4); for (let i = 0; i < 16; i++) { p.px(i, 0, C('#43d6c8')); p.px(0, i, C('#43d6c8')); p.px(i, 15, C('#1f9c94')); p.px(15, i, C('#1f9c94')); } });
  newTex('aobi_sprout', p => {
    for (const [bx, h, c] of [[3, 6, '#27a19b'], [7, 9, '#3fc7bd'], [11, 5, '#1f8f8a'], [13, 7, '#27a19b']]) { let x = bx; for (let k = 0; k < h; k++) { p.px(x, 15 - k, C(k > h - 2 ? '#9ff6ea' : c)); if (k > 2 && p.rng() < 0.3) x += p.rng() < 0.5 ? 1 : -1; } p.px(x + 1, 15 - h + 1, C('#9ff6ea')); }
  });
  newTex('planks_aobi', p => {
    const m = C('#2f8f8c'), dk = C('#1c6462'), lt = C('#3aa5a0');
    for (let b = 0; b < 4; b++) {
      const tone = [1, 0.96, 1.03, 0.98][b];
      for (let y = b * 4; y < b * 4 + 4; y++) for (let x = 0; x < 16; x++) p.px(x, y, shadeC(p.rng() < 0.2 ? lt : m, tone));
      for (let x = 0; x < 16; x++) p.px(x, b * 4 + 3, dk);
      const jx = (b * 5 + 3) % 16; for (let y = b * 4; y < b * 4 + 3; y++) p.px(jx, y, dk);
    }
  });
  newTex('quartz_side', p => { p.speckle(CP(['#ece6dc', '#e6dfd4', '#f2ede4'])); for (const y of [5, 10]) for (let x = 0; x < 16; x++) if (p.rng() < 0.7) p.px(x, y, C('#d4cabb')); for (let i = 0; i < 16; i++) { p.px(i, 0, C('#fbf8f2')); p.px(i, 15, C('#c9bfae')); } });
  newTex('quartz_top', p => { p.speckle(CP(['#ece6dc', '#e6dfd4', '#f2ede4'])); for (let i = 0; i < 16; i++) { p.px(i, 0, C('#fbf8f2')); p.px(0, i, C('#fbf8f2')); p.px(i, 15, C('#c9bfae')); p.px(15, i, C('#c9bfae')); } });
  newTex('soraishi', p => { p.blot(CP(['#d6d3e6', '#cbc7df', '#e1deee', '#c0bcd6', '#d6d3e6']), 2); p.dots(12, C('#f0eef8')); p.dots(12, C('#a9a4c4')); });
  newTex('sora_bricks', p => brickPat(p, CP(['#d6d3e6', '#cbc7df', '#dedbec', '#c4c0da']), C('#9f9abb'), true));
  newTex('sora_frame_top', p => {
    p.copy('obsidian'); for (let i = 0; i < 16; i++) { p.px(i, 0, C('#cbc7df')); p.px(0, i, C('#cbc7df')); p.px(i, 15, C('#8f8aae')); p.px(15, i, C('#8f8aae')); }
    for (let y = 4; y < 12; y++) for (let x = 4; x < 12; x++) { const d = Math.hypot(x - 7.5, y - 7.5); if (d < 4.2) p.px(x, y, C(d < 1.3 ? '#0e2b33' : d < 2.6 ? '#43d6c8' : '#f6cf3e')); }
    p.px(6, 6, C('#eafffb'));
  });
  newTex('sora_frame_side', p => { p.copy('obsidian'); for (let x = 0; x < 16; x++) { p.px(x, 0, C('#cbc7df')); p.px(x, 1, C('#b7b2d2')); p.px(x, 2, C('#8f8aae')); } for (const [x, y] of [[3, 7], [8, 10], [12, 6]]) { p.px(x, y, C('#f6cf3e')); p.px(x - 1, y, C('#a8862a')); p.px(x + 1, y, C('#a8862a')); p.px(x, y - 1, C('#a8862a')); p.px(x, y + 1, C('#a8862a')); } });
  // 門のゆらめき（4こま）
  for (let f = 0; f < 4; f++) newTex('gate_h_' + f, p => {
    const pal = CP(['#7a1fb8', '#b02fd0', '#e0509a', '#ff8a3a', '#ffd75a']);
    for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
      const v = Math.sin((x + f * 4) * Math.PI / 8 + Math.sin((y + f * 2) * Math.PI / 4) * 1.6) + Math.sin((y - f * 4) * Math.PI / 8 + Math.cos(x * Math.PI / 4) * 1.3);
      const i = clamp(Math.floor((v + 2) * 1.25), 0, 4); p.px(x, y, pal[i], i >= 3 ? 215 : 170);
    }
  });
  for (let f = 0; f < 4; f++) newTex('gate_s_' + f, p => {
    p.rect(0, 0, 16, 16, C('#070a1e'), 242);
    const r = mulberry32(777);
    for (let k = 0; k < 16; k++) { const x = Math.floor(r() * 16), y = Math.floor(r() * 16), ph = Math.floor(r() * 4), c = ['#ffffff', '#9ff6ea', '#f6cf3e', '#c8b6ff'][k & 3]; if (((ph + f) & 3) < 2) p.px(x, y, C(c), 255); else p.px(x, y, shadeC(C(c), 0.4), 250); }
    for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) if (((x * 3 + y * 5 + f * 4) & 15) === 0) p.px(x, y, C('#1b2a5e'), 245);
  });
  newTex('hoshi_crystal', p => {
    for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) { const d = Math.abs(x - 7.5) + Math.abs(y - 7.5); if (d < 7.6) p.px(x, y, C(d < 2.2 ? '#ffffff' : d < 4.5 ? '#ffd9f2' : d < 6.4 ? '#f39ad6' : '#b0509a')); }
    for (let i = 3; i < 13; i++) { p.px(i, 7, C('#ffffff')); p.px(7, i, C('#ffffff')); }
  });
  newTex('hoshi_egg', p => { p.blot(CP(['#1a1038', '#231648', '#120a2a', '#2c1c58', '#1a1038']), 4); const r = mulberry32(99); for (let k = 0; k < 9; k++) p.px(Math.floor(r() * 16), Math.floor(r() * 16), C(k % 3 ? '#c8b6ff' : '#fff3a0')); });
  // ---- 畑の作物 ----
  const rootCrop = (name, leafPal, rootC) => { for (let s = 0; s < 4; s++) newTex(name + '_' + s, p => {
    const hgt = 3 + s * 2, g = CP(leafPal);
    for (const x of [2, 6, 10, 13]) {
      const hh = hgt - Math.floor(p.rng() * 2);
      for (let k = 0; k < hh; k++) { p.px(x, 15 - k, g[k & 1]); if (k > 1 && (k & 1)) { p.px(x - 1, 15 - k, g[1]); p.px(x + 1, 14 - k, g[0]); } }
      if (s === 3) { p.px(x, 15, C(rootC)); p.px(x, 14, C(rootC)); p.px(x + 1, 15, shadeC(C(rootC), 0.8)); }   // 育ちきると 根もとに色が見える
    }
  }); };
  rootCrop('carrot', ['#3f9a38', '#58b845'], '#f08a2e');
  rootCrop('potato', ['#3a7f3a', '#4f9a4a'], '#c9a36a');
  for (let s = 0; s < 4; s++) newTex('stem_' + s, p => {
    const g = s < 3 ? CP(['#5aa842', '#4f9a38']) : CP(['#b8a03a', '#9a8a30']), hgt = 4 + s * 3;
    let x = 8; for (let k = 0; k < hgt; k++) { p.px(x, 15 - k, g[k & 1]); p.px(x - 1, 15 - k, g[1]); if (k > 2 && p.rng() < 0.35) x += p.rng() < 0.5 ? 1 : -1; if (k % 4 === 3) { p.px(x + 2, 15 - k, g[0]); p.px(x - 3, 14 - k, g[0]); p.px(x + 3, 15 - k, g[1]); } }
  });
  // ちからの台：黒曜石の台に、青緑に光る輪と 金のふち
  newTex('ench_top', p => { p.copy('obsidian'); const gd = C('#d9b24a'), gl = C('#6ff0d8'), gl2 = C('#b8fff0');
    for (let i = 0; i < 16; i++) { p.px(i, 0, gd); p.px(0, i, gd); p.px(i, 15, gd); p.px(15, i, gd); }
    for (let a = 0; a < 24; a++) { const x = Math.round(7.5 + Math.cos(a / 24 * 6.283) * 4.6), y = Math.round(7.5 + Math.sin(a / 24 * 6.283) * 4.6); p.px(x, y, a % 3 ? gl : gl2); }
    p.rect(7, 7, 2, 2, gl2); p.px(7, 5, gl); p.px(8, 10, gl); p.px(5, 8, gl); p.px(10, 7, gl); });
  newTex('ench_side', p => { p.copy('obsidian'); const gd = C('#d9b24a'), gd2 = C('#a8842e'), gl = C('#6ff0d8');
    for (let x = 0; x < 16; x++) { p.px(x, 0, gd); p.px(x, 1, gd2); p.px(x, 15, C('#0e0a1a')); }
    for (const [x, y] of [[2, 5], [3, 6], [2, 7], [6, 5], [6, 6], [7, 7], [6, 8], [10, 5], [11, 5], [10, 7], [11, 8], [13, 6], [14, 7], [13, 8], [4, 10], [5, 11], [9, 10], [9, 11], [12, 11]]) p.px(x, y, gl); });
  // はじけ箱：木の箱に 赤い帯と はじけるしるし。上に 火なわ
  newTex('hajike_side', p => { for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) { const seam = (x % 5) === 4, c = C(seam ? '#8a6238' : ['#c0935a', '#b98a52', '#c79b62'][(x + (y >> 2)) % 3]); p.px(x, y, p.rng() < 0.08 ? shadeC(c, 0.92) : c); }
    for (let x = 0; x < 16; x++) { p.px(x, 0, C('#7a5630')); p.px(x, 15, C('#7a5630')); for (let y = 5; y <= 10; y++) p.px(x, y, C(y === 5 || y === 10 ? '#9c2f24' : '#c8473a')); }
    const w = C('#fff1d0'); for (const [x, y] of [[7, 6], [8, 6], [6, 7], [7, 7], [8, 7], [9, 7], [5, 8], [6, 8], [9, 8], [10, 8], [6, 9], [7, 9], [8, 9], [9, 9], [4, 7], [11, 7], [4, 9], [11, 9]]) p.px(x, y, w); p.px(7, 8, C('#ffb02e')); p.px(8, 8, C('#ffb02e')); });
  newTex('hajike_top', p => { p.speckle(CP(['#c0935a', '#b98a52', '#c79b62'])); for (let i = 0; i < 16; i++) { p.px(i, 0, C('#7a5630')); p.px(0, i, C('#7a5630')); p.px(i, 15, C('#7a5630')); p.px(15, i, C('#7a5630')); } p.rect(5, 5, 6, 6, C('#c8473a')); p.rect(6, 6, 4, 4, C('#9c2f24')); p.rect(7, 7, 2, 2, C('#3a3028')); p.px(8, 7, C('#d8c9a8')); p.px(9, 6, C('#d8c9a8')); p.px(10, 5, C('#ffb02e')); });
  newTex('hajike_bottom', p => { p.speckle(CP(['#b08048', '#a87a44', '#b88a52'])); for (let i = 0; i < 16; i++) { p.px(i, 0, C('#7a5630')); p.px(0, i, C('#7a5630')); p.px(i, 15, C('#7a5630')); p.px(15, i, C('#7a5630')); p.px(i, 7, C('#8a6238')); } });
  newTex('pumpkin_side', p => { for (let x = 0; x < 16; x++) { const rib = (x % 4) === 0, c = C(rib ? '#b85f14' : ['#e8892a', '#f0962f', '#dd7f24'][(x >> 1) % 3]); for (let y = 0; y < 16; y++) p.px(x, y, p.rng() < 0.1 ? shadeC(c, 0.9) : c); } for (let x = 0; x < 16; x++) { p.px(x, 0, C('#c96c1a')); p.px(x, 15, C('#a8520f')); } });
  newTex('pumpkin_top', p => { p.speckle(CP(['#e8892a', '#dd7f24', '#f0962f'])); for (let i = 0; i < 16; i++) { p.px(i, 0, C('#b85f14')); p.px(0, i, C('#b85f14')); p.px(i, 15, C('#b85f14')); p.px(15, i, C('#b85f14')); p.px(i, i, C('#c96c1a')); p.px(15 - i, i, C('#c96c1a')); } p.rect(6, 6, 4, 4, C('#5a7a2a')); p.rect(7, 7, 2, 2, C('#7a9a3a')); });
  newTex('pumpkin_face', p => { p.copy('pumpkin_side'); const y = C('#ffe27a'), o = C('#ffb02e'); for (const [x0, y0, w, h] of [[3, 4, 3, 3], [10, 4, 3, 3], [7, 7, 2, 2], [3, 10, 10, 2], [4, 12, 2, 1], [8, 12, 2, 1], [11, 12, 1, 1]]) p.rect(x0, y0, w, h, y); for (const [x, yy] of [[3, 4], [12, 4], [5, 10], [9, 10]]) p.px(x, yy, o); });
  newTex('melon_side', p => { p.speckle(CP(['#6fb84a', '#66ae43', '#78c252'])); for (let y = 0; y < 16; y++) { const j = y > 4 && y < 11 ? (p.rng() < 0.4 ? 1 : 0) : 0; for (const x0 of [1, 5, 9, 13]) { p.px(x0 + j, y, C('#3f8a2f')); p.px(x0 + 1 + j, y, C(p.rng() < 0.2 ? '#357a27' : '#3f8a2f')); } } });
  newTex('melon_top', p => { p.speckle(CP(['#5aa83c', '#4f9a35', '#66b545'])); for (let i = 0; i < 16; i++) { p.px(i, 0, C('#3f8a2f')); p.px(0, i, C('#3f8a2f')); p.px(i, 15, C('#3f8a2f')); p.px(15, i, C('#3f8a2f')); } p.rect(7, 7, 2, 2, C('#8a7a4a')); });
  // ひび割れ（8段階）
  const crackSeq = []; { const r = mulberry32(4242); for (let l = 0; l < 7; l++) { let x = 7 + Math.floor(r() * 2), y = 7 + Math.floor(r() * 2); const ang = l * 0.9 + r(); for (let k = 0; k < 9; k++) { crackSeq.push([l, k, Math.round(x), Math.round(y)]); x += Math.cos(ang + (r() - 0.5) * 1.6); y += Math.sin(ang + (r() - 0.5) * 1.6); } } }
  for (let s = 0; s < 8; s++) newTex('crack_' + s, p => { for (const [l, k, x, y] of crackSeq) if (k <= s + 1 && l <= s + 2 && x >= 0 && x < 16 && y >= 0 && y < 16) p.px(x, y, [20, 20, 22], 175); });
  // 太陽と月
  newTex('sun', p => { p.rect(2, 2, 12, 12, C('#ffe27a')); p.rect(3, 3, 10, 10, C('#fff1b0')); p.rect(5, 5, 6, 6, C('#fffbe0')); });
  newTex('moon', p => { p.rect(3, 3, 10, 10, C('#e6ebf2')); p.rect(3, 3, 10, 1, C('#f6f8fb')); for (const [x, y] of [[5, 5], [6, 5], [5, 6], [10, 7], [10, 8], [11, 8], [7, 10], [6, 11], [7, 11]]) p.px(x, y, C('#c2c9d6')); p.rect(11, 4, 2, 9, C('#d3d9e3')); });

  // ブロックの各面の層番号を決める（向きのあるブロックは正面が南側）
  for (let id = 1; id < NB; id++) {
    const b = BLOCKS[id]; if (!b || !b.tex) continue;
    const t = b.tex, nm = (n) => { if (TEX[n] === undefined && TEX[n + '_0'] !== undefined) return TEX[n + '_0']; if (TEX[n] === undefined) throw new Error('絵がありません: ' + n); return TEX[n]; };
    if (typeof t === 'string') b.tl = [nm(t), nm(t), nm(t), nm(t), nm(t), nm(t)];
    else { const s = nm(t.side); b.tl = [s, s, nm(t.top), nm(t.bottom), t.front ? nm(t.front) : s, s]; }
  }
}
function cobbleTex(p, pal, mortar) {
  const pts = [];
  for (let gy = 0; gy < 4; gy++) for (let gx = 0; gx < 4; gx++) pts.push([gx * 4 + 1 + p.rng() * 2.5 + (gy & 1) * 2, gy * 4 + 1 + p.rng() * 2.5, Math.floor(p.rng() * pal.length)]);
  for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
    let d1 = 99, d2 = 99, bi = 0;
    for (let i = 0; i < pts.length; i++) {
      let dx = Math.abs(x - pts[i][0]), dy = Math.abs(y - pts[i][1]);
      if (dx > 8) dx = 16 - dx; if (dy > 8) dy = 16 - dy;
      const dd = Math.hypot(dx, dy * 1.15);
      if (dd < d1) { d2 = d1; d1 = dd; bi = i; } else if (dd < d2) d2 = dd;
    }
    if (d2 - d1 < 0.9) p.px(x, y, mortar);
    else p.px(x, y, shadeC(pal[pts[bi][2]], 0.97 + p.rng() * 0.06));
  }
}

// ---------------- アイテムのドット絵 ----------------
const ICON = {};   // アイテム番号 → 16x16 RGBA（立方体ブロックは別あつかい）
const TOOL_PAL = {
  wood: { m: '#b08a55', l: '#c9a46b', d: '#7a5a32' }, stone: { m: '#8b8d91', l: '#aeb0b5', d: '#5f6166' },
  iron: { m: '#d8d8d8', l: '#ffffff', d: '#8c8c8c' }, diamond: { m: '#5fe0d8', l: '#c8fbf6', d: '#2a9a93' }
};
const TOOL_ROWS = {
  pick: ['', '....ddddddd.....', '...dmlllllmdd...', '...dmddddmlmmd..', '....d....hdmlmd.', '........hH.dlmd.', '.......hH..dlmd.', '......hH...dmmd.', '.....hH....dmd..', '....hH.....dd...', '...hH...........', '..hH............', '.hH.............', 'hH..............', 'H...............', ''],
  axe: ['', '.........ddd....', '........dmmmd...', '.......dmllmmd..', '......dmlmmmmd..', '.....dmmmmmhmd..', '......dmmmhHd...', '.......ddhH.....', '........hH......', '.......hH.......', '......hH........', '.....hH.........', '....hH..........', '...hH...........', '..hH............', '..H.............'],
  shovel: ['', '..........dddd..', '.........dmllmd.', '.........dmlmmd.', '.........dmmmmd.', '.........dmmmd..', '........hHddd...', '.......hH.......', '......hH........', '.....hH.........', '....hH..........', '...hH...........', '..hH............', '.hHh............', '.HH.............', ''],
  sword: ['.............ddd', '............dlmd', '...........dlmd.', '..........dlmd..', '.........dlmd...', '........dlmd....', '..dd...dlmd.....', '..dmd.dlmd......', '...dmdlmd.......', '....dmmd........', '...hHdmd........', '..hH..dmd.......', '.hH....dd.......', 'hH..............', 'H...............', ''],
  hoe: ['', '.......ddddd....', '......dmlllmd...', '......dmmddhmd..', '.......dd.hHd...', '.........hH.....', '........hH......', '.......hH.......', '......hH........', '.....hH.........', '....hH..........', '...hH...........', '..hH............', '.hH.............', 'hH..............', '']
};
const ARMOR_ROWS = [
  ['', '', '', '....dddddddd....', '...dllllllmmd...', '..dllmmmmmmmsd..', '..dlmmmmmmmmsd..', '..dlmmddddmmsd..', '..dlmd....dmsd..', '..dmmd....dmsd..', '..dddd....dddd..', '', '', '', '', ''],
  ['', '', '..ddd......ddd..', '..dlmd....dmsd..', '..dlmmddddmmsd..', '..dllmmmmmmmsd..', '...dlmmmmmmsd...', '...dlmmmmmmsd...', '...dlmmmmmmsd...', '...dlmmmmmmsd...', '...dmmmmmmmsd...', '...dmmmmmmssd...', '...dddddddddd...', '', '', ''],
  ['', '', '...dddddddddd...', '...dllmmmmmmsd..', '...dlmmmmmmmsd..', '...dlmmddmmmsd..', '...dlmd..dmmsd..', '...dlmd..dmmsd..', '...dlmd..dmmsd..', '...dlmd..dmmsd..', '...dmmd..dmssd..', '...dmmd..dmssd..', '...dddd..ddddd..', '', '', ''],
  ['', '', '', '', '', '...dddd..dddd...', '...dlmd..dlmd...', '...dlmd..dlmd...', '...dlmd..dlmd...', '..ddlmd.ddlmd...', '..dllmd.dllmd...', '..dmmsd.dmmsd...', '..ddddd.ddddd...', '', '', '']
];
const ARMOR_PAL = { iron: { l: '#f6f6f6', m: '#d0d0d0', s: '#a2a2a2', d: '#5f5f5f' }, diamond: { l: '#d2fffb', m: '#6ee6de', s: '#35b3ab', d: '#176e69' } };
const R_LUMP = ['', '', '', '.....dddd.......', '....dmmmmdd.....', '...dmlmmmmmd....', '...dmmmmlmmd....', '..dmmmmmmmmmd...', '..dmmlmmmmmmd...', '..dmmmmmmlmmd...', '...dmmmmmmmd....', '...dmmmlmmd.....', '....dddmmd......', '.......dd.......', '', ''];
const R_INGOT = ['', '', '', '', '......ddddddd...', '.....dllllllmd..', '....dllllllmmd..', '...dlllllllmdd..', '..dmmmmmmmmdsd..', '..dmmmmmmmmdsd..', '..dmmmmmmmmdd...', '..ddddddddd.....', '', '', '', ''];
const R_GEM = ['', '', '', '.....dddddd.....', '....dllllmmd....', '...dlwllmmmmd...', '..dllllmmmmmsd..', '..dmmmmmmmmssd..', '...dmmmmmmssd...', '....dmmmmssd....', '.....dmmssd.....', '......dmsd......', '.......dd.......', '', '', ''];
const R_PILE = ['', '', '', '', '', '', '.......l....l...', '......lml.......', '.....lmmml......', '....lmmmmml.....', '...dmmmlmmmd....', '..dmmlmmmmmmd...', '..dmmmmmmlmmd...', '...dddddddddd...', '', ''];
const R_BALL = ['', '', '', '', '......dddd......', '.....dllmmd.....', '....dllmmmmd....', '....dlmmmmmd....', '....dmmmmmsd....', '....dmmmmssd....', '.....dmmssd.....', '......dddd......', '', '', '', ''];
const R_MEAT = ['', '', '', '.....ddddd......', '...ddmmmmmdd....', '..dmmllmmmmmd...', '..dmllmmmmmmmd..', '..dmlmmmmmfmmd..', '..dmmmmmmffmmd..', '...dmmmmmfmmd...', '....ddmmmmmd....', '......ddddd.....', '', '', '', ''];
const R_DRUM = ['', '', '.........ddd....', '........dmmmd...', '.......dmllmmd..', '......dmllmmmd..', '......dmlmmmmd..', '......dmmmmmd...', '.....dbdmmmd....', '....dbd.ddd.....', '...dbd..........', '..dbbd..........', '..dbdbd.........', '...d.d..........', '', ''];
const R_APPLE = ['', '........t.......', '.......tgg......', '.......t.gg.....', '....ddd.ddd.....', '...dllmdmmmd....', '..dlwlmmmmmmd...', '..dllmmmmmmmd...', '..dlmmmmmmmsd...', '..dmmmmmmmmsd...', '..dmmmmmmmssd...', '...dmmmmmssd....', '....dmmsssd.....', '.....dd.dd......', '', ''];
const R_BUCKET = ['', '', '....dddddddd....', '...dffffffffd...', '...dffffffffd...', '...dllmmmmmsd...', '...dllmmmmmsd...', '....dlmmmmsd....', '....dlmmmmsd....', '....dlmmmmsd....', '.....dmmmsd.....', '.....dmmmsd.....', '.....dddddd.....', '', '', ''];
const R_BOWL = ['', '', '', '', '', '', '.dddddddddddddd.', '.dllllllllllllld', '..dmmmmmmmmmmd..', '..dmmmmmmmmmsd..', '...dmmmmmmssd...', '....dssssssd....', '.....dddddd.....', '', '', ''];

function buildIcons() {
  const S = (id, rows, pal) => { ICON[id] = sprite(rows, P(pal)); };
  const HP = { h: '#9a7040', H: '#6e4c29' };
  TOOL_MATS.forEach((m, mi) => TOOL_TYPES.forEach((t, ti) => S(300 + mi * 5 + ti, TOOL_ROWS[t.k], Object.assign({}, HP, TOOL_PAL[m.k]))));
  ARMOR_MATS.forEach((m, mi) => ARMOR_ROWS.forEach((rows, pi) => S(320 + mi * 4 + pi, rows, ARMOR_PAL[m.k])));
  const stick = []; for (let y = 0; y < 16; y++) { let r = ''; for (let x = 0; x < 16; x++) r += (x + y === 15 && x > 1 && x < 14) ? 'h' : (x + y === 16 && x > 2 && x < 15) ? 'H' : '.'; stick.push(r); }
  S(I.stick, stick, HP);
  S(I.coal, R_LUMP, { m: '#2e2e33', l: '#5a5a62', d: '#141416' });
  S(I.charcoal, R_LUMP, { m: '#3d352d', l: '#6b5e50', d: '#1c1814' });
  S(I.iron_ingot, R_INGOT, { l: '#f6f6f6', m: '#d0d0d0', s: '#a2a2a2', d: '#5f5f5f' });
  S(I.gold_ingot, R_INGOT, { l: '#fff3a0', m: '#f6cf3e', s: '#c99a1e', d: '#7a5a0e' });
  S(I.brick, R_INGOT, { l: '#c96b55', m: '#a5503c', s: '#84402f', d: '#52251a' });
  S(I.diamond, R_GEM, { l: '#c8fbf6', m: '#5fe0d8', s: '#2fa59e', d: '#145e5a', w: '#ffffff' });
  S(I.glow_dust, R_PILE, { m: '#ffd45c', l: '#fff6cf', d: '#c98a22' });
  const dyeC = { red: ['#d63a2f', '#f0705f', '#8a1f18'], yellow: ['#f0cc3a', '#fff0a0', '#a8851a'], blue: ['#3f66c9', '#7f9df0', '#22408a'], green: ['#5a8f3a', '#8cc060', '#355a20'], black: ['#2e2e33', '#5a5a62', '#101012'], pink: ['#f0a0bd', '#fbd3e0', '#b8607f'] };
  _dyes.forEach(([k], i) => S(286 + i, R_PILE, { m: dyeC[k][0], l: dyeC[k][1], d: dyeC[k][2] }));
  const hexOf = (c) => '#' + c.map(v => ('0' + clamp(Math.round(v), 0, 255).toString(16)).slice(-2)).join('');
  COLORS.forEach(([k, , , hex], c) => { if (!ICON[DYE[c]]) S(DYE[c], R_PILE, { m: hex, l: hexOf(shadeC(C(hex), 1.3).map(v => Math.min(255, v + 30))), d: hexOf(shadeC(C(hex), 0.6)) }); });
  S(I.clay_ball, R_BALL, { l: '#c0c8d2', m: '#9aa3b0', s: '#7a8390', d: '#4f5661' });
  S(I.snowball, R_BALL, { l: '#ffffff', m: '#eaf1f6', s: '#c5d6e2', d: '#8fa6b8' });
  S(I.wheat_seeds, ['', '', '', '', '', '....a....a......', '...aba..aba.....', '....a....a..a...', '.......a...aba..', '..a...aba...a...', '.aba...a........', '..a.......a.....', '.........aba....', '..........a.....', '', ''], { a: '#6f8f2f', b: '#b7cf6a' });
  S(I.wheat, ['', '...........ab...', '..........aba...', '....ab...aba....', '...aba..aba.....', '..aba..aba...ab.', '..ab..aba...aba.', '...s.aba...aba..', '....sab...aba...', '.....s...aba....', '......s.sab.....', '.......ss.......', '......tttt......', '.....ss.ss......', '....s.....s.....', ''], { a: '#d9b13c', b: '#f6dc70', s: '#b98f25', t: '#8a6238' });
  S(I.bread, ['', '', '', '', '....dddddddd....', '...dllllllllmd..', '..dllmlllmlllmd.', '..dlmllmllmllmd.', '..dmmmmmmmmmmmd.', '..dsmmmmmmmmmsd.', '...dssssssssd...', '....dddddddd....', '', '', '', ''], { l: '#e8bd72', m: '#c98f45', s: '#a56f30', d: '#6e4a1e' });
  S(I.apple, R_APPLE, { l: '#f0705f', m: '#d63a2f', s: '#a82820', d: '#6e1712', w: '#ffffff', t: '#6e4c29', g: '#5aa842' });
  S(I.golden_apple, R_APPLE, { l: '#fff3a0', m: '#f6cf3e', s: '#c99a1e', d: '#7a5a0e', w: '#ffffff', t: '#6e4c29', g: '#5aa842' });
  S(I.raw_pork, R_MEAT, { m: '#f0959a', l: '#f7b8bb', f: '#fbe3e0', d: '#a8555c' });
  S(I.cooked_pork, R_MEAT, { m: '#c98f55', l: '#dba86e', f: '#ecd4a8', d: '#7a4f26' });
  S(I.raw_beef, R_MEAT, { m: '#c9403f', l: '#e06563', f: '#f5d6cf', d: '#7a1f22' });
  S(I.steak, R_MEAT, { m: '#8a5230', l: '#a66a42', f: '#d9b58a', d: '#4f2c16' });
  S(I.raw_mutton, R_MEAT, { m: '#d9605f', l: '#e98987', f: '#f7dfd8', d: '#8a3035' });
  S(I.cooked_mutton, R_MEAT, { m: '#a6683c', l: '#bf8250', f: '#e2c296', d: '#5e3819' });
  S(I.raw_chicken, R_DRUM, { m: '#f2b8a6', l: '#f9d5c8', d: '#b0705f', b: '#f2efe6' });
  S(I.cooked_chicken, R_DRUM, { m: '#c98a45', l: '#e0aa66', d: '#7a4d20', b: '#f2efe6' });
  S(I.feather, ['', '...........dd...', '.........ddlld..', '........dllllmd.', '.......dlllmmd..', '......dlllmmd...', '.....dllmmmd....', '....dllmmmd.....', '....dlmmdd......', '...dqmdd........', '..dq.d..........', '.dq.............', '.q..............', '', '', ''], { l: '#ffffff', m: '#d9dde3', d: '#9aa1ab', q: '#c9c0a8' });
  S(I.bowl, R_BOWL, { m: '#8a6238', l: '#5e4124', s: '#6e4c29', d: '#3d2a16' });
  const stew = R_BOWL.slice(); stew[7] = '.dllxllllxllllld'; stew[5] = '......w...w.....'; stew[4] = '.......w...w....';
  S(I.mushroom_stew, stew, { m: '#8a6238', l: '#b5651d', s: '#6e4c29', d: '#3d2a16', x: '#d63a2f', w: '#e8e8e8' });
  S(I.bucket, R_BUCKET, { l: '#f6f6f6', m: '#d0d0d0', s: '#a2a2a2', d: '#5f5f5f', f: '#6f6f72' });
  S(I.water_bucket, R_BUCKET, { l: '#f6f6f6', m: '#d0d0d0', s: '#a2a2a2', d: '#5f5f5f', f: '#3f76e4' });
  S(I.lava_bucket, R_BUCKET, { l: '#f6f6f6', m: '#d0d0d0', s: '#a2a2a2', d: '#5f5f5f', f: '#ff8a1c' });
  S(I.shadow_shard, ['', '', '.......dd.......', '......dmmd......', '......dmld..d...', '.....dmmld.dmd..', '.....dmlmd.dld..', '....dmmlmmddmd..', '....dmllmmmdd...', '...dmmlmmmmd....', '...dmlmmmmd.....', '....dmmmmd......', '.....dmmd.......', '......dd........', '', ''], { m: '#3b2a6b', l: '#8f6fe0', d: '#150d2e' });
  S(I.flint, R_LUMP, { m: '#3a3d44', l: '#6d727c', d: '#17181c' });
  S(I.flint_steel, ['', '', '..dddd..........', '.dllmmd.........', '.dlmd...........', '.dmd.....dd.....', '.dmd....dmmd....', '.dmmd..dmlmd....', '..dmmddmlmmd....', '...ddddmmmmd....', '......dmmmd.....', '.......ddd......'], { l: '#f6f6f6', m: '#b9bcc2', d: '#4a4d55' });
  { const fr = ICON[I.flint_steel]; const fl = C('#3a3d44'), fh = C('#6d727c'); for (const [x, y, c] of [[9, 5, fl], [10, 5, fl], [8, 6, fl], [9, 6, fh], [10, 6, fl], [11, 6, fl], [8, 7, fl], [9, 7, fl], [10, 7, fh], [11, 7, fl], [9, 8, fl], [10, 8, fl], [11, 8, fl], [10, 9, fl]]) { const i = (y * 16 + x) * 4; fr[i] = c[0]; fr[i + 1] = c[1]; fr[i + 2] = c[2]; fr[i + 3] = 255; } }
  S(I.quartz, R_GEM, { l: '#ffffff', m: '#ece6dc', s: '#cfc5b4', d: '#8a8172', w: '#ffffff' });
  S(I.homura_rod, stick, { h: '#ffc23a', H: '#e8591a' });
  S(I.homura_powder, R_PILE, { m: '#ff9a2e', l: '#ffe08a', d: '#c9521a' });
  { const eye = R_BALL.slice(); eye[7] = '....dlmkkmmd....'; eye[8] = '....dmmkkmsd....'; S(I.hoshi_eye, eye, { l: '#c8fff6', m: '#43d6c8', s: '#1f9c94', d: '#0e4a50', k: '#0b1a22' }); }
  S(I.carrot, ['', '', '..........gg.g..', '.........gggg...', '........dgggg...', '.......dmmdg....', '......dmlmmd....', '.....dmlmmmd....', '....dmlmmmd.....', '...dmlmmmd......', '..dmmmmmd.......', '..dmmmdd........', '..ddd...........'], { m: '#f08a2e', l: '#ffb86a', d: '#a8520f', g: '#4f9a38' });
  S(I.potato, R_LUMP, { m: '#c9a36a', l: '#e0c08a', d: '#7a5c30' });
  S(I.baked_potato, R_LUMP, { m: '#d9a84a', l: '#f6e0a0', d: '#7a4f1a' });
  S(I.pumpkin_seeds, R_PILE, { m: '#efe6c4', l: '#fffbe6', d: '#b8a878' });
  S(I.melon_seeds, R_PILE, { m: '#3a2a22', l: '#6a5444', d: '#1a120e' });
  S(I.melon_slice, ['', '', '', '', '..dddddddddddd..', '..dmmmmmmmmmmd..', '...dmkmmmkmmd...', '...dmmmkmmmmd...', '....dmmmmmmd....', '....wdmmmmdw....', '.....wwddww.....', '......gggg......'], { m: '#e8483f', k: '#2a1a14', d: '#b52a25', w: '#e6f0c8', g: '#3f8a2f' });
  S(I.pumpkin_pie, ['', '', '', '', '', '....dddddddd....', '..ddmmlmmmmmdd..', '.dmmmmmmlmmmmmd.', '.dcmmlmmmmmmmcd.', '.dccccccccccccd.', '..dccccccccccd..', '...dddddddddd...'], { m: '#e8892a', l: '#f6b45a', c: '#d9b06a', d: '#7a4f1a' });
  S(I.shears, ['', '', '..dd......dd....', '.dlmd....dlmd...', '..dmmd..dmmd....', '...dmmddmmd.....', '....dmmmmd......', '.....dmmd.......', '....drddrd......', '...drd..drd.....', '..drd....drd....', '..drd....drd....', '...d......d.....'], { l: '#f6f6f6', m: '#b9bcc2', d: '#4a4d55', r: '#c9413a' });
  S(I.egg, ['', '', '', '......dddd......', '.....dllmmd.....', '....dllmmmmd....', '....dlmmmmmd....', '...dlmmmmmmsd...', '...dmmmmmmmsd...', '...dmmmmmmssd...', '....dmmmmssd....', '.....dssssd.....', '......dddd......'], { l: '#fffaf0', m: '#f2e6d0', s: '#d6c4a6', d: '#8a785c' });
  S(I.fried_egg, ['', '', '', '', '....dddddd......', '..ddwwwwwwdd....', '.dwwwwyyywwwd...', '.dwwwyyoyywwwd..', '.dwwwyyyyywwwd..', '..dwwwyyywwwd...', '...ddwwwwwdd....', '.....ddddd......'], { w: '#fffaf0', y: '#ffd23a', o: '#fff0a0', d: '#b8a888' });
  S(I.milk_bucket, R_BUCKET, { l: '#f6f6f6', m: '#d0d0d0', s: '#a2a2a2', d: '#5f5f5f', f: '#fdfdf6' });
  S(I.xp_orb, ['', '', '', '', '......dddd......', '.....dmmlld.....', '....dmmllwld....', '....dmmmllld....', '....dsmmmmmd....', '....dssmmmmd....', '.....dssmmd.....', '......dddd......'], { d: '#3f8f1f', s: '#6fc22a', m: '#a8e63a', l: '#dcff7a', w: '#ffffff' });   // けいけんの玉（世界では 光る玉として描く。絵は 念のため）
  // ---- くすり：びんの中の色だけ ちがう ----
  { const R_BOTTLE = ['', '', '......dddd......', '......dccd......', '.......dd.......', '......dggd......', '.....dgffgd.....', '....dgffffgd....', '....dffffffd....', '....dfflfffd....', '....dffffffd....', '.....dffffd.....', '......dddd......'];
    S(I.glass_bottle, R_BOTTLE, { d: '#7f9aa8', c: '#b08a5a', g: '#d6ecf4', f: '#eaf6fa', l: '#ffffff' });
    S(I.water_bottle, R_BOTTLE, { d: '#7f9aa8', c: '#b08a5a', g: '#d6ecf4', f: '#3f76e4', l: '#8fb4ff' });
    for (const k in POTIONS) { const c = C(POTIONS[k][1]), hx = (v) => '#' + v.map(x => Math.max(0, Math.min(255, Math.round(x))).toString(16).padStart(2, '0')).join(''); S(I['potion_' + k], R_BOTTLE, { d: '#7f9aa8', c: '#b08a5a', g: '#d6ecf4', f: POTIONS[k][1], l: hx([c[0] * 0.5 + 128, c[1] * 0.5 + 128, c[2] * 0.5 + 128]) }); } }
  // ---- 弓矢と盾 ----
  S(I.bow, ['', '.........HHHHH', '.......HHhhhs', '......Hhh..s', '.....Hhh..s', '....Hhh..s', '....Hh..s', '...Hhh.s', '...Hh.s', '..Hh.s', '..Hhs', '..Hh', '..H', '', '', ''], { h: '#9a7040', H: '#6e4c29', s: '#eeeee6' });
  S(I.bow_p1, ['', '.........HHHHH', '..tt...HHhhhs', '..tt..Hhh...s', '....aHhh....s', '....Hah....s', '....Hha...s', '...Hhh.a..s', '...Hh...a.s', '..Hh....sw', '..Hh..ss', '..Hhss', '..Hs', '', '', ''], { h: '#9a7040', H: '#6e4c29', s: '#eeeee6', a: '#c9a36a', t: '#b9bcc2', w: '#f6f6f6' });
  S(I.bow_p2, ['', '.........HHHHH', '..tt...HHhhh.s', '..tt..Hhh....s', '....aHhh....s', '....Hah.....s', '....Hha.....s', '...Hhh.a....s', '...Hh...a...s', '..Hh.....a.s', '..Hh......as', '..Hh...ssssw', '..Hssss', '', '', ''], { h: '#9a7040', H: '#6e4c29', s: '#eeeee6', a: '#c9a36a', t: '#b9bcc2', w: '#f6f6f6' });
  S(I.arrow, ['', '', '...........mml', '...........mlm', '...........amm', '..........a', '.........a', '........a', '.......a', '......a', '.....a', '..w.a', '.wwa', '.waww', '...ww', ''], { a: '#c9a36a', m: '#9da1a8', l: '#e4e6ea', w: '#f6f6f6' });
  S(I.string, ['', '', '', '.....wwww.......', '....w....s......', '....w....s......', '.....ws..s......', '......wws.......', '......w..ww.....', '.....w.....s....', '.....w.....s....', '......s...s.....', '.......sss......'], { w: '#f4f4ee', s: '#c9c9bf' });
  S(I.shield, ['', '..dddddddddddd..', '..dmhhhhhhhhmd..', '..dhhHhhhhHhhd..', '..dhhHhhhhHhhd..', '..dhhHhllhHhhd..', '..dhhHlmmlHhhd..', '..dhhHlmmsHhhd..', '..dhhHhsshHhhd..', '..dhhHhhhhHhhd..', '..dmhHhhhhHhmd..', '...dhHhhhhHhd...', '...dmhhhhhhmd...', '....dmhhhhmd....', '.....dddddd.....'], { d: '#4a4d55', m: '#b9bcc2', l: '#f6f6f6', s: '#8a8d95', h: '#a67a45', H: '#7a5630' });
  S(I.pop_powder, ['', '', '', '', '........y.......', '..........y.....', '.....y..........', '.......oo.......', '......oOoo......', '.....oOooOo.....', '....oooOooooo...', '...ooOoooOooOo..', '...dddddddddddd.'], { o: '#e9774a', O: '#f6b08a', d: '#a8472a', y: '#ffd98a' });
  // 立方体でないブロックのアイコン
  ICON.icon_bed = sprite(['', '', '', '', '', '.dd.............', '.dwwd...........', '.dwwwdrrrrrrrrd.', '.dwwwdrrRrrRrrd.', '.ddddddddddddddd', '.dmmmmmmmmmmmmmd', '.ddddddddddddddd', '.dm..........dm.', '.dm..........dm.', '', ''], P({ d: '#4a321a', w: '#f2f2f0', r: '#c9413a', R: '#e2685f', m: '#8a6238' }));
  ICON.icon_door = sprite(['...dddddddddd...', '...dmmmmmmmmd...', '...dmddmmddmd...', '...dmdwmmdwmd...', '...dmdwmmdwmd...', '...dmddmmddmd...', '...dmmmmmmmmd...', '...dmmmmmmmyd...', '...dmmmmmmmmd...', '...dmddddddmd...', '...dmdllllldd...', '...dmdlllllmd...', '...dmdlllllmd...', '...dmddddddmd...', '...dmmmmmmmmd...', '...dddddddddd...'], P({ d: '#5b3d18', m: '#b08a55', l: '#c9a46b', w: '#9fd4e8', y: '#f6cf3e' }));
  const DOOR_ROWS = ['...dddddddddd...', '...dmmmmmmmmd...', '...dmddmmddmd...', '...dmdwmmdwmd...', '...dmdwmmdwmd...', '...dmddmmddmd...', '...dmmmmmmmmd...', '...dmmmmmmmyd...', '...dmmmmmmmmd...', '...dmddddddmd...', '...dmdllllldd...', '...dmdlllllmd...', '...dmdlllllmd...', '...dmddddddmd...', '...dmmmmmmmmd...', '...dddddddddd...'];
  _woods.forEach(([k], w) => { if (!w) return; const wc = WOOD_COL[k]; ICON['icon_door_' + k] = sprite(DOOR_ROWS, P({ d: hexOf(shadeC(C(wc.d), 0.7)), m: wc.m, l: wc.l, w: '#9fd4e8', y: '#f6cf3e' })); BLOCKS[B['door_' + k]].sprite = 'icon_door_' + k; });
  ICON.icon_sign = sprite(['', '.dddddddddddddd.', '.dllllllllllllld', '.dlmmmmmmmmmmmmd', '.dlmkkkmkkkkmmmd', '.dlmmmmmmmmmmmmd', '.dlmkkkkkmkkmmmd', '.dlmmmmmmmmmmmmd', '.dmmmmmmmmmmmmmd', '.dddddddddddddd.', '......dhhd......', '......dhhd......', '......dhhd......', '......dhhd......', '......dhhd......', '......dddd......'], P({ d: '#5b3d18', l: '#c9a46b', m: '#b08a55', k: '#3d2a16', h: '#8a6238' }));
  for (let id = 1; id < NB; id++) {
    const b = BLOCKS[id]; if (!b || !ITEMS[id]) continue;
    if (b.sprite) ICON[id] = ICON[b.sprite] || TEX_DATA[TEX[b.sprite]];
  }
}

// ---------------- 画面用の画像（データURL） ----------------
const ICON_URL = {};
function dataToCanvas(d) {
  const c = document.createElement('canvas'); c.width = c.height = 16;
  const ctx = c.getContext('2d'); const im = ctx.createImageData(16, 16); im.data.set(d); ctx.putImageData(im, 0, 0);
  return c;
}
function shadedCanvas(d, f, t) { const e = new Uint8ClampedArray(d), r = f * (t ? t[0] : 1), g = f * (t ? t[1] : 1), b = f * (t ? t[2] : 1); for (let i = 0; i < 1024; i += 4) { e[i] *= r; e[i + 1] *= g; e[i + 2] *= b; } return dataToCanvas(e); }
// 持ち物の絵や 手に持ったときの形：そのブロックを作っている箱（1/16マス）。ふつうの立方体は null
function itemParts(id) {
  const b = BLOCKS[id]; if (!b) return null;
  switch (b.shape) {
    case S_SLAB: return shapeParts(S_SLAB, 0, 0, false);
    case S_STAIR: return shapeParts(S_STAIR, 2, 0, false);
    case S_FENCE: case S_WALL: case S_PANE: return shapeParts(b.shape, 0, 10, false);
    case S_GATE: case S_TRAP: case S_LANTERN: case S_FIRE: return shapeParts(b.shape, 0, 0, b.big);
    case S_LAYER: return [[0, 0, 0, 16, b.lh || 2, 16]];
  }
  return null;
}
function buildIconUrls() {
  for (const k in ITEMS) {
    const id = +k, it = ITEMS[id];
    const c = document.createElement('canvas'); c.width = c.height = 32;
    const ctx = c.getContext('2d'); ctx.imageSmoothingEnabled = false;
    if (ICON[id]) ctx.drawImage(dataToCanvas(ICON[id]), 0, 0, 32, 32);
    else if (it.block) {
      // ななめ上から見た絵。箱ごとに 上の面・手前左の面（南）・手前右の面（東）を描く。奥の箱から順に
      const b = BLOCKS[id], tl = b.tl, tint = TINT[id] ? TINT_RGB[TINT[id]] : null;
      const top = shadedCanvas(TEX_DATA[tl[2]], 1, tint), left = shadedCanvas(TEX_DATA[tl[4]], 0.8, tint), right = shadedCanvas(TEX_DATA[tl[0]], 0.6, tint);
      const parts = (itemParts(id) || [[0, 0, 0, 16, 16, 16]]).slice().sort((p, q) => (p[1] - q[1]) || ((p[0] + p[2]) - (q[0] + q[2])));
      for (const [x0, y0, z0, x1, y1, z1] of parts) {
        const w = x1 - x0, h = y1 - y0, d = z1 - z0;
        ctx.setTransform(14 / 16, 7 / 16, -14 / 16, 7 / 16, 16, 1 + (16 - y1));
        ctx.drawImage(top, x0, z0, w, d, x0, z0, w, d);
        ctx.setTransform(14 / 16, 7 / 16, 0, 1, 16 - 0.875 * z1, 1 + 0.4375 * z1);
        ctx.drawImage(left, x0, 16 - y1, w, h, x0, 16 - y1, w, h);
        ctx.setTransform(14 / 16, -7 / 16, 0, 1, 2 + 0.875 * x1, 8 + 0.4375 * x1);
        ctx.drawImage(right, 16 - z1, 16 - y1, d, h, 16 - z1, 16 - y1, d, h);
      }
      ctx.setTransform(1, 0, 0, 1, 0, 0);
    }
    ICON_URL[id] = c.toDataURL();
  }
}
// 体力などの小さなアイコン
const HUD_URL = {};
function buildHudIcons() {
  const mk = (rows, pal) => {
    const c = document.createElement('canvas'); c.width = c.height = 9; const ctx = c.getContext('2d');
    for (let y = 0; y < 9; y++) for (let x = 0; x < 9; x++) { const ch = (rows[y] || '')[x]; if (ch && pal[ch]) { ctx.fillStyle = pal[ch]; ctx.fillRect(x, y, 1, 1); } }
    return c.toDataURL();
  };
  const heart = ['.dd...dd.', 'dwrd.dRRd', 'drrrdRRRd', 'drrrrRRRd', 'drrrrRRRd', '.drrrRRd.', '..drrRd..', '...drd...', '....d....'];
  const heartR = ['.dd...dd.', 'dwrd.dRRd', 'drrrdRRRd', 'drrrRRRRd', 'drrrRRRRd', '.drrRRRd.', '..drRRd..', '...dRd...', '....d....'];
  HUD_URL.heart = mk(heart, { d: '#2a0d0d', r: '#e0312f', R: '#e0312f', w: '#ffb3a8' });
  HUD_URL.heart_half = mk(heartR, { d: '#2a0d0d', r: '#e0312f', R: '#4a2327', w: '#ffb3a8' });
  HUD_URL.heart_empty = mk(heart, { d: '#2a0d0d', r: '#4a2327', R: '#4a2327', w: '#4a2327' });
  const oni = ['....d....', '...dwd...', '..dwwWd..', '..dwwWd..', '.dwwwWWd.', '.dwwwWWd.', 'dwwnnNNWd', 'dwwnnNNWd', '.ddddddd.'];
  HUD_URL.food = mk(oni, { d: '#2b2b2b', w: '#f6f6f0', W: '#f6f6f0', n: '#1f2a22', N: '#1f2a22' });
  HUD_URL.food_half = mk(oni, { d: '#2b2b2b', w: '#f6f6f0', W: '#55554f', n: '#1f2a22', N: '#3a3a36' });
  HUD_URL.food_empty = mk(oni, { d: '#2b2b2b', w: '#55554f', W: '#55554f', n: '#3a3a36', N: '#3a3a36' });
  HUD_URL.bubble = mk(['..ddddd..', '.dwwbbbd.', 'dwwbbbbbd', 'dwbbbbbbd', 'dbbbbbbbd', 'dbbbbbbbd', 'dbbbbbbbd', '.dbbbbbd.', '..ddddd..'], { d: '#1d3f7a', b: '#6aa9f5', w: '#e3f1ff' });
  const arm = ['.d.....d.', 'dld...dmd', 'dlmdddmsd', 'dlmmmmmsd', '.dlmmmsd.', '.dlmmmsd.', '.dlmmmsd.', '.dmmmssd.', '.ddddddd.'];
  HUD_URL.armor = mk(arm, { d: '#3a3a3a', l: '#f6f6f6', m: '#d0d0d0', s: '#a2a2a2' });
  HUD_URL.armor_empty = mk(arm, { d: '#2b2b2b', l: '#4a4a4a', m: '#4a4a4a', s: '#4a4a4a' });
}
