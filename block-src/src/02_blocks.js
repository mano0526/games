// ===== 02_blocks.js : ブロック・アイテム・レシピの定義（作業スレッドと共用） =====
const S_NONE = 0, S_CUBE = 1, S_CROSS = 2, S_TORCH = 3, S_FLUID = 4, S_LAYER = 5, S_FARM = 6, S_CACTUS = 7,
  S_CROP = 8, S_CHEST = 9, S_DOOR = 10, S_BED = 11, S_LADDER = 12, S_FLAT = 13,
  S_SLAB = 14, S_STAIR = 15, S_FENCE = 16, S_WALL = 17, S_PANE = 18, S_GATE = 19, S_TRAP = 20, S_SIGN = 21, S_LANTERN = 22, S_FIRE = 23, S_PORTAL = 24;

// ブロックの番号は 0〜255 と 512〜1023（256〜511 はアイテムの番号なので使わない）
const NB = 1024;
function isBlk(id) { return id < 256 || id >= 512; }
const BLOCKS = new Array(NB).fill(null);
const B = {};
const OPAQUE = new Uint8Array(NB);   // すき間のない立方体（となりの面を隠す）
const SOLID = new Uint8Array(NB);    // ぶつかる
const LOPAC = new Uint8Array(NB);    // 光の通しにくさ 0..15
const LEMIT = new Uint8Array(NB);    // 自分で光る強さ
const RCLASS = new Uint8Array(NB);   // 0:不透明 1:切り抜き 2:半透明
const SHAPE = new Uint8Array(NB);
const REPLACE = new Uint8Array(NB);  // 上から置きかえられる
const FLUID = new Uint8Array(NB);    // 1:水 2:溶岩
const GRAVITY = new Uint8Array(NB);
const ISLEAF = new Uint8Array(NB);
const ISLOG = new Uint8Array(NB);
const SOIL = new Uint8Array(NB);     // 草花や苗木を植えられる土
const TINT = new Uint8Array(NB);     // 色をかける番号（0＝そのまま）。TINT_RGB の何番目か
const TINT_RGB = [[1, 1, 1]];        // 色をかける表（絵は白っぽく描いておき、この色をかけ算する）

function defBlock(id, key, name, o) {
  if (!(id >= 0 && id < NB && isBlk(id)) || BLOCKS[id] || B[key] !== undefined) throw new Error('ブロックの番号か名前が重なっています: ' + id + ' ' + key);
  const d = Object.assign({ id, key, name, shape: S_CUBE, hard: 1, tool: null, level: 0, needTool: false, sound: 'stone', light: 0 }, o);
  if (d.opaque === undefined) d.opaque = d.shape === S_CUBE && !d.cutout && !d.trans;
  if (d.solid === undefined) d.solid = d.shape === S_CUBE || d.shape === S_FARM || d.shape === S_CACTUS || d.shape === S_CHEST || d.shape === S_DOOR || d.shape === S_BED || (d.shape >= S_SLAB && d.shape <= S_TRAP) || d.shape === S_LANTERN || d.shape === S_FIRE;
  if (d.opac === undefined) d.opac = d.opaque ? 15 : 0;
  BLOCKS[id] = d; B[key] = id;
  OPAQUE[id] = d.opaque ? 1 : 0; SOLID[id] = d.solid ? 1 : 0; LOPAC[id] = d.opac; LEMIT[id] = d.light;
  RCLASS[id] = d.trans ? 2 : (d.cutout || (d.shape !== S_CUBE && d.shape !== S_FLUID && d.shape !== S_FARM && d.shape !== S_CACTUS && d.shape !== S_CHEST && d.shape !== S_LAYER && d.shape !== S_BED && d.shape !== S_NONE && !(d.shape >= S_SLAB && d.shape <= S_FIRE))) ? 1 : 0;
  SHAPE[id] = d.shape; REPLACE[id] = d.replace ? 1 : 0; FLUID[id] = d.fluid || 0; GRAVITY[id] = d.gravity ? 1 : 0;
  ISLEAF[id] = d.leaves ? 1 : 0; ISLOG[id] = d.log ? 1 : 0; SOIL[id] = d.soil ? 1 : 0; TINT[id] = d.tint2 || 0;
  return d;
}

const I = {};       // アイテムのキー → 番号
const ITEMS = {};   // 番号 → 定義（ブロックも含む）
function defItem(id, key, name, o) {
  if (ITEMS[id] || (I[key] !== undefined && I[key] !== id)) throw new Error('アイテムの番号か名前が重なっています: ' + id + ' ' + key);
  const d = Object.assign({ id, key, name, stack: 64 }, o);
  ITEMS[id] = d; I[key] = id; return d;
}

// ---------------- ブロック ----------------
defBlock(0, 'air', '空気', { shape: S_NONE, hard: 0, replace: true, tex: null });
defBlock(1, 'stone', '石', { tex: 'stone', hard: 1.5, tool: 'pick', level: 1, needTool: true, drop: 'cobble' });
defBlock(2, 'grass', '草ブロック', { tex: { top: 'grass_top', side: 'grass_side', bottom: 'dirt' }, hard: 0.6, tool: 'shovel', sound: 'grass', drop: 'dirt', tint: true, soil: true });
defBlock(3, 'dirt', '土', { tex: 'dirt', hard: 0.5, tool: 'shovel', sound: 'dirt', soil: true });
defBlock(4, 'cobble', '丸石', { tex: 'cobble', hard: 2, tool: 'pick', level: 1, needTool: true });
defBlock(5, 'planks_oak', 'オークの板', { tex: 'planks_oak', hard: 2, tool: 'axe', sound: 'wood' });
defBlock(6, 'bedrock', '岩盤', { tex: 'bedrock', hard: -1 });
defBlock(7, 'water', '水', { shape: S_FLUID, tex: 'water_0', hard: -1, trans: true, opac: 2, fluid: 1, replace: true, sound: 'water' });
defBlock(8, 'lava', '溶岩', { shape: S_FLUID, tex: 'lava_0', hard: -1, light: 15, opac: 15, fluid: 2, replace: true, sound: 'water' });
defBlock(9, 'sand', '砂', { tex: 'sand', hard: 0.5, tool: 'shovel', sound: 'sand', gravity: true });
defBlock(10, 'gravel', '砂利', { tex: 'gravel', hard: 0.6, tool: 'shovel', sound: 'gravel', gravity: true, drop: (rng) => rng() < 0.12 ? [[I.flint, 1]] : null });
const _woods = [['oak', 'オーク', 11, 12, 5, 46], ['birch', 'シラカバ', 13, 14, 19, 47], ['spruce', 'マツ', 15, 16, 20, 48], ['cherry', 'サクラ', 17, 18, 21, 49],
  ['mahog', 'マホガニー', 74, 75, 76, 77], ['acacia', 'アカシア', 78, 79, 80, 81], ['walnut', 'クルミ', 82, 83, 84, 85]];
const SAP_TYPE = {};   // 苗木の番号 → 木の種類（genTreeShape の type）
_woods.forEach((w, i) => { SAP_TYPE[w[5]] = i; });
for (const [k, n, logId, leafId, plankId, sapId] of _woods) {
  defBlock(logId, 'log_' + k, n + 'の原木', { tex: { top: 'log_' + k + '_top', bottom: 'log_' + k + '_top', side: 'log_' + k }, hard: 2, tool: 'axe', sound: 'wood', log: true });
  defBlock(leafId, 'leaves_' + k, n + 'の葉', {
    tex: 'leaves_' + k, hard: 0.2, cutout: true, opac: 1, sound: 'leaf', leaves: true,
    drop: (rng) => {
      const out = [];
      if (rng() < 0.07) out.push([sapId, 1]);
      if (k === 'oak' && rng() < 0.035) out.push([I.apple, 1]);
      if (rng() < 0.05) out.push([I.stick, 1]);
      return out;
    }
  });
  if (plankId !== 5) defBlock(plankId, 'planks_' + k, n + 'の板', { tex: 'planks_' + k, hard: 2, tool: 'axe', sound: 'wood' });
}
defBlock(22, 'ore_coal', '石炭鉱石', { tex: 'ore_coal', hard: 3, tool: 'pick', level: 1, needTool: true, drop: () => [[I.coal, 1]] });
defBlock(23, 'ore_iron', '鉄鉱石', { tex: 'ore_iron', hard: 3, tool: 'pick', level: 2, needTool: true });
defBlock(24, 'ore_gold', '金鉱石', { tex: 'ore_gold', hard: 3, tool: 'pick', level: 3, needTool: true });
defBlock(25, 'ore_diamond', 'ダイヤ鉱石', { tex: 'ore_diamond', hard: 3, tool: 'pick', level: 3, needTool: true, drop: () => [[I.diamond, 1]] });
defBlock(26, 'ore_glow', 'ひかり鉱石', { tex: 'ore_glow', hard: 3, tool: 'pick', level: 3, needTool: true, light: 7, drop: (rng) => [[I.glow_dust, 2 + Math.floor(rng() * 3)]] });
defBlock(27, 'sandstone', '砂岩', { tex: { top: 'sandstone_top', bottom: 'sandstone_top', side: 'sandstone' }, hard: 0.8, tool: 'pick', level: 1, needTool: true });
defBlock(28, 'glass', 'ガラス', { tex: 'glass', hard: 0.3, cutout: true, sound: 'glass', drop: () => [] });
defBlock(29, 'crafting_table', '作業台', { tex: { top: 'table_top', bottom: 'planks_oak', side: 'table_side', front: 'table_front' }, hard: 2.5, tool: 'axe', sound: 'wood', interact: 'table' });
defBlock(30, 'furnace', 'かまど', { tex: { top: 'furnace_top', bottom: 'furnace_top', side: 'furnace_side', front: 'furnace_front' }, hard: 3.5, tool: 'pick', level: 1, needTool: true, facing: true, interact: 'furnace', ent: 'furnace' });
defBlock(31, 'furnace_lit', 'かまど', { tex: { top: 'furnace_top', bottom: 'furnace_top', side: 'furnace_side', front: 'furnace_front_lit' }, hard: 3.5, tool: 'pick', level: 1, needTool: true, facing: true, interact: 'furnace', ent: 'furnace', light: 13, drop: 'furnace' });
defBlock(32, 'chest', 'チェスト', { shape: S_CHEST, tex: { top: 'chest_top', bottom: 'chest_top', side: 'chest_side', front: 'chest_front' }, hard: 2.5, tool: 'axe', sound: 'wood', facing: true, interact: 'chest', ent: 'chest' });
defBlock(33, 'torch', 'たいまつ', { shape: S_TORCH, tex: 'torch', hard: 0, light: 14, sound: 'wood', sprite: 'torch' });
defBlock(34, 'snow_layer', 'つもった雪', { shape: S_LAYER, tex: 'snow', hard: 0.1, tool: 'shovel', needTool: true, level: 0, sound: 'snow', replace: true, drop: () => [[I.snowball, 1]], support: 'solid' });
defBlock(35, 'snow_block', '雪ブロック', { tex: 'snow', hard: 0.2, tool: 'shovel', sound: 'snow' });
defBlock(36, 'ice', '氷', { tex: 'ice', hard: 0.5, tool: 'pick', trans: true, opac: 2, sound: 'glass', drop: () => [] });
defBlock(37, 'cactus', 'サボテン', { shape: S_CACTUS, tex: { top: 'cactus_top', bottom: 'cactus_top', side: 'cactus_side' }, hard: 0.4, sound: 'cloth', support: 'cactus' });
defBlock(38, 'clay', '粘土', { tex: 'clay', hard: 0.6, tool: 'shovel', sound: 'dirt', drop: () => [[I.clay_ball, 4]] });
defBlock(39, 'bricks', 'レンガ', { tex: 'bricks', hard: 2, tool: 'pick', level: 1, needTool: true });
defBlock(40, 'tallgrass', '草', { shape: S_CROSS, tex: 'tallgrass', hard: 0, sound: 'grass', replace: true, tint: true, support: 'soil', drop: (rng) => { const r = rng(); return r < 0.18 ? [[I.wheat_seeds, 1]] : r < 0.2 ? [[I.pumpkin_seeds, 1]] : r < 0.22 ? [[I.melon_seeds, 1]] : r < 0.235 ? [[I.carrot, 1]] : r < 0.25 ? [[I.potato, 1]] : []; }, sprite: 'tallgrass_0' });
defBlock(41, 'flower_red', '赤い花', { shape: S_CROSS, tex: 'flower_red', hard: 0, sound: 'grass', support: 'soil', sprite: 'flower_red' });
defBlock(42, 'flower_yellow', '黄色い花', { shape: S_CROSS, tex: 'flower_yellow', hard: 0, sound: 'grass', support: 'soil', sprite: 'flower_yellow' });
defBlock(43, 'flower_blue', '青い花', { shape: S_CROSS, tex: 'flower_blue', hard: 0, sound: 'grass', support: 'soil', sprite: 'flower_blue' });
defBlock(44, 'flower_white', '白い花', { shape: S_CROSS, tex: 'flower_white', hard: 0, sound: 'grass', support: 'soil', sprite: 'flower_white' });
defBlock(45, 'deadbush', '枯れ草', { shape: S_CROSS, tex: 'deadbush', hard: 0, sound: 'grass', replace: true, support: 'sandy', drop: (rng) => rng() < 0.6 ? [[I.stick, 1]] : [], sprite: 'deadbush' });
for (const [k, n, , , , sapId] of _woods) defBlock(sapId, 'sapling_' + k, n + 'の苗木', { shape: S_CROSS, tex: 'sapling_' + k, hard: 0, sound: 'grass', support: 'soil', sprite: 'sapling_' + k });
defBlock(50, 'farmland', '耕地', { shape: S_FARM, tex: { top: 'farmland_dry', bottom: 'dirt', side: 'dirt' }, hard: 0.6, tool: 'shovel', sound: 'dirt', drop: 'dirt', soil: true });
defBlock(51, 'wheat_crop', '小麦', {
  shape: S_CROP, tex: 'wheat_0', stages: 'wheat', hard: 0, sound: 'grass', support: 'farmland',
  drop: (rng, meta) => meta >= 3 ? [[I.wheat, 1], [I.wheat_seeds, 1 + Math.floor(rng() * 3)]] : [[I.wheat_seeds, 1]]
});
defBlock(52, 'mushroom_brown', '茶色いキノコ', { shape: S_CROSS, tex: 'mushroom_brown', hard: 0, sound: 'grass', support: 'solid', sprite: 'mushroom_brown' });
defBlock(53, 'mushroom_red', '赤いキノコ', { shape: S_CROSS, tex: 'mushroom_red', hard: 0, sound: 'grass', support: 'solid', sprite: 'mushroom_red' });
const _wools = [['white', '白い'], ['red', '赤い'], ['yellow', '黄色い'], ['blue', '青い'], ['green', '緑の'], ['black', '黒い'], ['pink', 'ピンクの']];
_wools.forEach(([k, n], i) => defBlock(54 + i, 'wool_' + k, n + '羊毛', { tex: 'wool_' + k, hard: 0.8, sound: 'cloth', wool: true }));
defBlock(61, 'bed', 'ベッド', { shape: S_BED, tex: 'bed_side', hard: 0.2, sound: 'wood', interact: 'bed', sprite: 'icon_bed' });
defBlock(62, 'door', 'ドア', { shape: S_DOOR, tex: 'door_bottom', hard: 1.5, tool: 'axe', sound: 'wood', interact: 'door', sprite: 'icon_door' });
defBlock(63, 'ladder', 'はしご', { shape: S_LADDER, tex: 'ladder', hard: 0.4, tool: 'axe', sound: 'wood', sprite: 'ladder' });
defBlock(64, 'obsidian', '黒曜石', { tex: 'obsidian', hard: 30, tool: 'pick', level: 4, needTool: true });
defBlock(65, 'mossy_cobble', '苔むした丸石', { tex: 'mossy_cobble', hard: 2, tool: 'pick', level: 1, needTool: true });
defBlock(66, 'stone_bricks', '石レンガ', { tex: 'stone_bricks', hard: 1.5, tool: 'pick', level: 1, needTool: true });
defBlock(67, 'iron_block', '鉄ブロック', { tex: 'iron_block', hard: 5, tool: 'pick', level: 2, needTool: true, sound: 'metal' });
defBlock(68, 'gold_block', '金ブロック', { tex: 'gold_block', hard: 3, tool: 'pick', level: 3, needTool: true, sound: 'metal' });
defBlock(69, 'diamond_block', 'ダイヤブロック', { tex: 'diamond_block', hard: 5, tool: 'pick', level: 3, needTool: true, sound: 'metal' });
defBlock(70, 'glow_block', 'ひかり石', { tex: 'glow_block', hard: 0.3, light: 15, sound: 'glass' });
defBlock(71, 'altar', 'めざめの祭壇', { tex: { top: 'altar_top', bottom: 'obsidian', side: 'altar_side' }, hard: 8, tool: 'pick', level: 3, needTool: true, light: 7, interact: 'altar' });
defBlock(72, 'crown_block', 'カゲの王冠', { shape: S_CROSS, tex: 'crown', hard: 0.2, light: 12, sound: 'metal', support: 'solid', sprite: 'crown' });
defBlock(73, 'cracked_bricks', 'ひびわれ石レンガ', { tex: 'cracked_bricks', hard: 1.5, tool: 'pick', level: 1, needTool: true });
// ---- 版2の地形で使うブロック ----
defBlock(86, 'red_sand', '赤い砂', { tex: 'red_sand', hard: 0.5, tool: 'shovel', sound: 'sand', gravity: true });
defBlock(87, 'terracotta', '素焼き', { tex: 'terracotta', hard: 1.25, tool: 'pick', level: 1, needTool: true });
const _terras = [['white', '白い'], ['yellow', '黄色い'], ['orange', 'オレンジの'], ['red', '赤い'], ['brown', '茶色い']];
_terras.forEach(([k, n], i) => defBlock(88 + i, 'terracotta_' + k, n + '素焼き', { tex: 'terracotta_' + k, hard: 1.25, tool: 'pick', level: 1, needTool: true }));
defBlock(93, 'packed_ice', 'かたい氷', { tex: 'packed_ice', hard: 0.6, tool: 'pick', sound: 'glass' });
defBlock(94, 'podzol', '落ち葉の土', { tex: { top: 'podzol_top', side: 'podzol_side', bottom: 'dirt' }, hard: 0.5, tool: 'shovel', sound: 'dirt', drop: 'dirt', soil: true });
defBlock(95, 'mud', 'どろ', { tex: 'mud', hard: 0.5, tool: 'shovel', sound: 'dirt', soil: true });
defBlock(96, 'coarse_dirt', 'あらい土', { tex: 'coarse_dirt', hard: 0.5, tool: 'shovel', sound: 'gravel', soil: true });
defBlock(97, 'moss', 'コケ', { tex: 'moss', hard: 0.1, sound: 'grass', soil: true });
defBlock(98, 'mycelium', 'きんしの土', { tex: { top: 'mycelium_top', side: 'mycelium_side', bottom: 'dirt' }, hard: 0.6, tool: 'shovel', sound: 'grass', drop: 'dirt', soil: true });
// 大きなキノコ：オノで壊すとブロックのまま、それ以外は小さなキノコになる
const _capDrop = (small) => (rng, meta, tool) => (tool && tool.type === 'axe') ? null : (rng() < 0.6 ? [[small, 1 + Math.floor(rng() * 2)]] : []);
defBlock(99, 'mush_brown', '茶色いキノコのかさ', { tex: { top: 'mush_brown', side: 'mush_brown', bottom: 'mush_pore' }, hard: 0.2, tool: 'axe', sound: 'wood', drop: _capDrop(52) });
defBlock(100, 'mush_red', '赤いキノコのかさ', { tex: { top: 'mush_red', side: 'mush_red', bottom: 'mush_pore' }, hard: 0.2, tool: 'axe', sound: 'wood', drop: _capDrop(53) });
defBlock(101, 'mush_stem', 'キノコの柄', { tex: { top: 'mush_pore', side: 'mush_stem', bottom: 'mush_pore' }, hard: 0.2, tool: 'axe', sound: 'wood' });
defBlock(102, 'fern', 'シダ', { shape: S_CROSS, tex: 'fern', hard: 0, sound: 'grass', replace: true, support: 'soil', drop: (rng) => { const r = rng(); return r < 0.1 ? [[I.wheat_seeds, 1]] : r < 0.14 ? [[I.melon_seeds, 1]] : r < 0.17 ? [[I.potato, 1]] : []; }, sprite: 'fern' });
defBlock(103, 'lily_pad', 'スイレンの葉', { shape: S_FLAT, tex: 'lily_pad', hard: 0, sound: 'grass', solid: true, support: 'water', sprite: 'lily_pad' });
defBlock(104, 'vine', 'つた', { shape: S_LADDER, tex: 'vine', hard: 0.2, sound: 'grass', drop: (rng) => rng() < 0.4 ? [[104, 1]] : [], sprite: 'vine' });
defBlock(105, 'granite', '花こう岩', { tex: 'granite', hard: 1.5, tool: 'pick', level: 1, needTool: true });
defBlock(106, 'diorite', 'せん緑岩', { tex: 'diorite', hard: 1.5, tool: 'pick', level: 1, needTool: true });
defBlock(107, 'andesite', '安山岩', { tex: 'andesite', hard: 1.5, tool: 'pick', level: 1, needTool: true });
defBlock(108, 'flower_purple', 'むらさきの花', { shape: S_CROSS, tex: 'flower_purple', hard: 0, sound: 'grass', support: 'soil', sprite: 'flower_purple' });
defBlock(109, 'flower_orange', 'オレンジの花', { shape: S_CROSS, tex: 'flower_orange', hard: 0, sound: 'grass', support: 'soil', sprite: 'flower_orange' });

// ===== 形のあるブロック・色の素材・明かり（番号は 512 から） =====
// 16色。[キー, 「〜の染料」の名前, 「〜い／〜の」の形, 色]
const COLORS = [['white', '白', '白い', '#f2f2f2'], ['orange', 'オレンジ', 'オレンジの', '#f08a2e'], ['magenta', '赤むらさき', '赤むらさきの', '#c955c0'], ['lightblue', '水色', '水色の', '#5fb4e6'],
  ['yellow', '黄色', '黄色い', '#f0cc3a'], ['lime', '黄緑', '黄緑の', '#86c43a'], ['pink', 'ピンク', 'ピンクの', '#f0a0bd'], ['gray', '灰色', '灰色の', '#4a4f55'],
  ['lightgray', 'うすい灰色', 'うすい灰色の', '#a3a8a8'], ['cyan', '青緑', '青緑の', '#2a9aa0'], ['purple', 'むらさき', 'むらさきの', '#8544b8'], ['blue', '青', '青い', '#3f66c9'],
  ['brown', '茶色', '茶色い', '#7a5234'], ['green', '緑', '緑の', '#5a8f3a'], ['red', '赤', '赤い', '#c9413a'], ['black', '黒', '黒い', '#2e2e33']];
const _hex = (h) => [parseInt(h.substr(1, 2), 16) / 255, parseInt(h.substr(3, 2), 16) / 255, parseInt(h.substr(5, 2), 16) / 255];
COLORS.forEach((c) => TINT_RGB.push(_hex(c[3])));                 // 1〜16：16色
const WOOD_TINT = { oak: '#b08a55', birch: '#d9c896', spruce: '#7a5a38', cherry: '#e0a3a8', mahog: '#a8623f', acacia: '#c26d3f', walnut: '#4f3320' };
_woods.forEach((w) => TINT_RGB.push(_hex(WOOD_TINT[w[0]])));      // 17〜23：木の色（ドア・トラップドア）
const TINT_WOOD0 = 17;
// 色つきの羊毛（7色は前からある。足りない9色を足す）
const WOOL = [], CARPET = [], CONCRETE = [], CGLASS = [], TERRA = [];
{
  let nw = 512, nt = 576;
  COLORS.forEach(([k, , adj], c) => {
    if (B['wool_' + k] === undefined) defBlock(nw++, 'wool_' + k, adj + '羊毛', { tex: 'wool_white', tint2: c + 1, hard: 0.8, sound: 'cloth', wool: true });
    WOOL[c] = B['wool_' + k];
    CARPET[c] = defBlock(528 + c, 'carpet_' + k, adj + 'カーペット', { shape: S_LAYER, lh: 1, tex: 'wool_white', tint2: c + 1, hard: 0.1, sound: 'cloth', support: 'floor' }).id;
    CONCRETE[c] = defBlock(544 + c, 'concrete_' + k, adj + 'コンクリート', { tex: 'concrete', tint2: c + 1, hard: 1.8, tool: 'pick', level: 1, needTool: true }).id;
    CGLASS[c] = defBlock(560 + c, 'glass_' + k, adj + 'ガラス', { tex: 'glass_tint', tint2: c + 1, hard: 0.3, trans: true, opac: 1, sound: 'glass', drop: () => [] }).id;
    if (B['terracotta_' + k] === undefined) defBlock(nt++, 'terracotta_' + k, adj + '素焼き', { tex: 'terracotta_white', tint2: c + 1, hard: 1.25, tool: 'pick', level: 1, needTool: true });
    TERRA[c] = B['terracotta_' + k];
  });
}
// 階段とハーフブロック。[キー, 名前, もとのブロック]
const _mats = [['oak', 'オーク', 5], ['birch', 'シラカバ', 19], ['spruce', 'マツ', 20], ['cherry', 'サクラ', 21], ['mahog', 'マホガニー', 76], ['acacia', 'アカシア', 80], ['walnut', 'クルミ', 84],
  ['cobble', '丸石', 4], ['stone', '石', 1], ['stone_bricks', '石レンガ', 66], ['bricks', 'レンガ', 39], ['sandstone', '砂岩', 27], ['mossy_cobble', '苔むした丸石', 65], ['granite', '花こう岩', 105], ['diorite', 'せん緑岩', 106], ['andesite', '安山岩', 107]];
_mats.forEach(([k, n, base], i) => {
  const b = BLOCKS[base], o = { tex: b.tex, hard: b.hard, tool: b.tool, level: b.level, needTool: b.needTool, sound: b.sound, opac: 15, base };
  defBlock(592 + i, 'stairs_' + k, n + 'の階段', Object.assign({ shape: S_STAIR }, o));
  defBlock(608 + i, 'slab_' + k, n + 'のハーフブロック', Object.assign({ shape: S_SLAB }, o));
});
// 木のフェンス・フェンスゲート・ドア・トラップドア
_woods.forEach(([k, n, , , plank], w) => {
  const o = { tex: 'planks_' + k, hard: 2, tool: 'axe', sound: 'wood', base: plank };
  defBlock(624 + w, 'fence_' + k, n + 'のフェンス', Object.assign({ shape: S_FENCE, fence: true }, o));
  defBlock(632 + w, 'gate_' + k, n + 'のフェンスゲート', Object.assign({ shape: S_GATE, interact: 'gate' }, o));
  if (w > 0) defBlock(647 + w, 'door_' + k, n + 'のドア', { shape: S_DOOR, tex: 'door_bottom', tint2: TINT_WOOD0 + w, hard: 1.5, tool: 'axe', sound: 'wood', interact: 'door', base: plank });
  defBlock(656 + w, 'trapdoor_' + k, n + 'のトラップドア', { shape: S_TRAP, tex: 'trapdoor', tint2: TINT_WOOD0 + w, cutout: true, hard: 1.5, tool: 'axe', sound: 'wood', interact: 'trap', base: plank });
});
BLOCKS[62].tint2 = TINT_WOOD0; TINT[62] = TINT_WOOD0; BLOCKS[62].name = 'オークのドア'; BLOCKS[62].base = 5;
// 石のへい
[['cobble', '丸石', 4], ['mossy_cobble', '苔むした丸石', 65], ['stone_bricks', '石レンガ', 66], ['bricks', 'レンガ', 39], ['sandstone', '砂岩', 27]].forEach(([k, n, base], i) => {
  const b = BLOCKS[base];
  defBlock(640 + i, 'wall_' + k, n + 'のへい', { shape: S_WALL, tex: b.tex, hard: b.hard, tool: 'pick', level: 1, needTool: true, base });
});
defBlock(664, 'glass_pane', 'ガラス板', { shape: S_PANE, tex: 'glass', cutout: true, hard: 0.3, sound: 'glass', drop: () => [] });
defBlock(665, 'iron_bars', '鉄格子', { shape: S_PANE, tex: 'iron_bars', cutout: true, hard: 5, tool: 'pick', level: 1, needTool: true, sound: 'metal' });
defBlock(666, 'sign', '看板', { shape: S_SIGN, tex: 'planks_oak', hard: 1, tool: 'axe', sound: 'wood', interact: 'sign', ent: 'sign', support: 'floor', sprite: 'icon_sign' });
// 明かり
defBlock(667, 'lantern', 'ランタン', { shape: S_LANTERN, tex: { top: 'lantern_top', bottom: 'lantern_top', side: 'lantern_side' }, hard: 0.5, light: 15, sound: 'metal', hang: true });
defBlock(668, 'chochin', 'ちょうちん', { shape: S_LANTERN, big: true, tex: { top: 'chochin_top', bottom: 'chochin_top', side: 'chochin_side' }, hard: 0.2, light: 13, sound: 'cloth', hang: true });
defBlock(669, 'campfire', 'たき火', { shape: S_FIRE, tex: { top: 'campfire_log', bottom: 'campfire_log', side: 'campfire_log' }, hard: 1, tool: 'axe', light: 15, sound: 'wood', support: 'floor', drop: () => [[I.charcoal, 2]] });
defBlock(670, 'crystal_lamp', 'クリスタルランプ', { tex: 'crystal_lamp', hard: 0.4, light: 15, sound: 'glass' });
// かざりのブロック
defBlock(671, 'hay', '干し草の束', { tex: { top: 'hay_top', bottom: 'hay_top', side: 'hay_side' }, hard: 0.5, sound: 'grass' });
defBlock(672, 'granite_smooth', 'みがいた花こう岩', { tex: 'granite_smooth', hard: 1.5, tool: 'pick', level: 1, needTool: true });
defBlock(673, 'diorite_smooth', 'みがいたせん緑岩', { tex: 'diorite_smooth', hard: 1.5, tool: 'pick', level: 1, needTool: true });
defBlock(674, 'andesite_smooth', 'みがいた安山岩', { tex: 'andesite_smooth', hard: 1.5, tool: 'pick', level: 1, needTool: true });
defBlock(675, 'smooth_stone', 'なめらかな石', { tex: 'smooth_stone', hard: 1.5, tool: 'pick', level: 1, needTool: true });
defBlock(676, 'chiseled_bricks', 'もようの石レンガ', { tex: 'chiseled_bricks', hard: 1.5, tool: 'pick', level: 1, needTool: true });
defBlock(677, 'mossy_bricks', '苔むした石レンガ', { tex: 'mossy_bricks', hard: 1.5, tool: 'pick', level: 1, needTool: true });
defBlock(678, 'smooth_sandstone', 'なめらかな砂岩', { tex: 'sandstone_top', hard: 0.8, tool: 'pick', level: 1, needTool: true });
defBlock(679, 'chiseled_sandstone', 'もようの砂岩', { tex: { top: 'sandstone_top', bottom: 'sandstone_top', side: 'chiseled_sandstone' }, hard: 0.8, tool: 'pick', level: 1, needTool: true });
defBlock(680, 'red_sandstone', '赤い砂岩', { tex: { top: 'red_sandstone_top', bottom: 'red_sandstone_top', side: 'red_sandstone' }, hard: 0.8, tool: 'pick', level: 1, needTool: true });
// ===== ホムラの底・ソラのはて（べつの世界）で使うブロック（681〜） =====
// 門：meta 0＝X方向にのびる面、1＝Z方向にのびる面、2＝水平の面。手ではこわせない。わくがこわれると消える
defBlock(681, 'homura_gate', 'ホムラの門', { shape: S_PORTAL, tex: 'gate_h_0', hard: -1, solid: false, trans: true, opac: 0, light: 11, sound: 'glass', support: 'hgate', drop: () => [] });
defBlock(682, 'sora_frame', 'ソラの門のわく', { shape: S_FARM, tex: { top: 'sora_frame_top', bottom: 'obsidian', side: 'sora_frame_side' }, hard: 20, tool: 'pick', level: 3, needTool: true, light: 5 });
defBlock(683, 'sora_gate', 'ソラの門', { shape: S_PORTAL, tex: 'gate_s_0', hard: -1, solid: false, trans: true, opac: 0, light: 15, sound: 'glass', support: 'sgate', drop: () => [] });
defBlock(684, 'yakeishi', 'やけ石', { tex: 'yakeishi', hard: 0.5, tool: 'pick', level: 1, needTool: true });
defBlock(685, 'ore_quartz', '白水晶の鉱石', { tex: 'ore_quartz', hard: 2.5, tool: 'pick', level: 1, needTool: true, drop: (rng) => [[I.quartz, 1 + Math.floor(rng() * 2)]] });
defBlock(686, 'nageki_sand', 'なげきの砂', { tex: 'nageki_sand', hard: 0.6, tool: 'shovel', sound: 'sand', slow: true });
defBlock(687, 'magma', 'マグマ石', { tex: 'magma', hard: 0.8, tool: 'pick', level: 1, needTool: true, light: 4, hot: true });
defBlock(688, 'yake_bricks', 'やけレンガ', { tex: 'yake_bricks', hard: 2.5, tool: 'pick', level: 1, needTool: true });
defBlock(689, 'kurohashira', '黒い柱石', { tex: { top: 'kurohashira_top', bottom: 'kurohashira_top', side: 'kurohashira' }, hard: 1.5, tool: 'pick', level: 1, needTool: true });
defBlock(690, 'aobi_soil', 'アオビの土', { tex: { top: 'aobi_soil_top', side: 'aobi_soil_side', bottom: 'yakeishi' }, hard: 0.6, tool: 'pick', level: 1, needTool: true, drop: 'yakeishi' });
defBlock(691, 'aobi_stem', 'アオビの幹', { tex: { top: 'aobi_stem_top', bottom: 'aobi_stem_top', side: 'aobi_stem' }, hard: 2, tool: 'axe', sound: 'wood' });
defBlock(692, 'aobi_cap', 'アオビのかさ', { tex: 'aobi_cap', hard: 0.6, tool: 'axe', sound: 'grass' });
defBlock(693, 'aobi_lamp', 'アオビのあかり', { tex: 'aobi_lamp', hard: 0.6, tool: 'axe', sound: 'grass', light: 15 });
defBlock(694, 'aobi_sprout', 'アオビの芽', { shape: S_CROSS, tex: 'aobi_sprout', hard: 0, sound: 'grass', replace: true, support: 'solid', light: 6, sprite: 'aobi_sprout' });
defBlock(695, 'planks_aobi', 'アオビの板', { tex: 'planks_aobi', hard: 2, tool: 'axe', sound: 'wood' });
defBlock(696, 'quartz_block', '白水晶ブロック', { tex: { top: 'quartz_top', bottom: 'quartz_top', side: 'quartz_side' }, hard: 0.8, tool: 'pick', level: 1, needTool: true });
defBlock(703, 'soraishi', 'そら石', { tex: 'soraishi', hard: 3, tool: 'pick', level: 1, needTool: true });
defBlock(704, 'sora_bricks', 'そら石レンガ', { tex: 'sora_bricks', hard: 3, tool: 'pick', level: 1, needTool: true });
// 階段・ハーフブロック・へい・フェンス
[[697, 'stairs', 'yake_bricks', 'やけレンガ', S_STAIR], [698, 'slab', 'yake_bricks', 'やけレンガ', S_SLAB], [699, 'stairs', 'quartz_block', '白水晶', S_STAIR], [700, 'slab', 'quartz_block', '白水晶', S_SLAB],
  [705, 'stairs', 'sora_bricks', 'そら石レンガ', S_STAIR], [706, 'slab', 'sora_bricks', 'そら石レンガ', S_SLAB]].forEach(([id, kind, bk, n, sh]) => {
  const b = BLOCKS[B[bk]];
  defBlock(id, kind + '_' + (bk === 'quartz_block' ? 'quartz' : bk), n + (sh === S_STAIR ? 'の階段' : 'のハーフブロック'), { shape: sh, tex: b.tex, hard: b.hard, tool: b.tool, level: b.level, needTool: b.needTool, sound: b.sound, opac: 15, base: b.id });
});
defBlock(701, 'fence_yake', 'やけレンガのフェンス', { shape: S_FENCE, fence: true, tex: 'yake_bricks', hard: 2.5, tool: 'pick', level: 1, needTool: true, base: 688 });
defBlock(702, 'wall_yake_bricks', 'やけレンガのへい', { shape: S_WALL, tex: 'yake_bricks', hard: 2.5, tool: 'pick', level: 1, needTool: true, base: 688 });
defBlock(707, 'wall_sora_bricks', 'そら石レンガのへい', { shape: S_WALL, tex: 'sora_bricks', hard: 3, tool: 'pick', level: 1, needTool: true, base: 704 });
// ---- 畑の作物（710〜） ----
defBlock(710, 'carrot_crop', 'ニンジン', { shape: S_CROP, tex: 'carrot_0', stages: 'carrot', hard: 0, sound: 'grass', support: 'farmland', drop: (rng, meta) => meta >= 3 ? [[I.carrot, 2 + Math.floor(rng() * 3)]] : [[I.carrot, 1]] });
defBlock(711, 'potato_crop', 'ジャガイモ', { shape: S_CROP, tex: 'potato_0', stages: 'potato', hard: 0, sound: 'grass', support: 'farmland', drop: (rng, meta) => meta >= 3 ? [[I.potato, 2 + Math.floor(rng() * 3)]] : [[I.potato, 1]] });
// つる：育ちきると、となりの土の上に 実がなる
defBlock(712, 'pumpkin_stem', 'カボチャのつる', { shape: S_CROP, tex: 'stem_0', stages: 'stem', fruit: 714, hard: 0, sound: 'grass', support: 'farmland', drop: (rng, meta) => [[I.pumpkin_seeds, meta >= 3 ? 1 + Math.floor(rng() * 2) : 1]] });
defBlock(713, 'melon_stem', 'スイカのつる', { shape: S_CROP, tex: 'stem_0', stages: 'stem', fruit: 716, hard: 0, sound: 'grass', support: 'farmland', drop: (rng, meta) => [[I.melon_seeds, meta >= 3 ? 1 + Math.floor(rng() * 2) : 1]] });
defBlock(714, 'pumpkin', 'カボチャ', { tex: { top: 'pumpkin_top', bottom: 'pumpkin_top', side: 'pumpkin_side' }, hard: 1, tool: 'axe', sound: 'wood' });
defBlock(715, 'jack_lantern', 'カボチャのランタン', { tex: { top: 'pumpkin_top', bottom: 'pumpkin_top', side: 'pumpkin_side', front: 'pumpkin_face' }, hard: 1, tool: 'axe', sound: 'wood', light: 15, facing: true });
defBlock(716, 'melon', 'スイカ', { tex: { top: 'melon_top', bottom: 'melon_top', side: 'melon_side' }, hard: 1, tool: 'axe', sound: 'wood', drop: (rng) => [[I.melon_slice, 3 + Math.floor(rng() * 5)]] });
// ほしの結晶：ソラのはての柱の上で、ボスの体力をもどす。こわすと はじける
defBlock(708, 'hoshi_crystal', 'ほしの結晶', { tex: 'hoshi_crystal', hard: 0.4, cutout: true, opac: 0, light: 15, sound: 'glass', drop: () => [] });
defBlock(709, 'hoshi_egg', 'ホシのたまご', { tex: 'hoshi_egg', hard: 3, light: 9, sound: 'stone' });
for (let i = 0; i < NB; i++) if (BLOCKS[i] && typeof BLOCKS[i].drop === 'string') BLOCKS[i].drop = B[BLOCKS[i].drop];

// ブロックをそのままアイテムとしても登録（持てないものは除く）
const _noItem = new Set([0, 7, 8, 31, 50, 51, 681, 683, 710, 711, 712, 713]);
for (let i = 1; i < NB; i++) if (BLOCKS[i] && !_noItem.has(i)) defItem(i, BLOCKS[i].key, BLOCKS[i].name, { block: i });
ITEMS[B.bed].stack = 1;

// ---------------- アイテム ----------------
defItem(256, 'stick', '棒', {});
defItem(257, 'coal', '石炭', {});
defItem(258, 'charcoal', '木炭', {});
defItem(259, 'iron_ingot', '鉄インゴット', {});
defItem(260, 'gold_ingot', '金インゴット', {});
defItem(261, 'diamond', 'ダイヤモンド', {});
defItem(262, 'glow_dust', 'ひかりの粉', {});
defItem(264, 'clay_ball', '粘土玉', {});
defItem(265, 'brick', 'レンガのかけら', {});
defItem(266, 'wheat_seeds', '小麦の種', { place: 51 });
defItem(267, 'wheat', '小麦', {});
defItem(268, 'bread', 'パン', { food: [5, 6] });
defItem(269, 'apple', 'リンゴ', { food: [4, 2.4] });
defItem(270, 'golden_apple', '金のリンゴ', { food: [4, 9.6], heal: 10 });
defItem(271, 'raw_pork', '生の豚肉', { food: [3, 1.2] });
defItem(272, 'cooked_pork', '焼き豚', { food: [8, 12] });
defItem(273, 'raw_beef', '生の牛肉', { food: [3, 1.2] });
defItem(274, 'steak', 'ステーキ', { food: [8, 12] });
defItem(275, 'raw_mutton', '生の羊肉', { food: [2, 1.2] });
defItem(276, 'cooked_mutton', '焼いた羊肉', { food: [6, 9.6] });
defItem(277, 'raw_chicken', '生の鶏肉', { food: [2, 1.2] });
defItem(278, 'cooked_chicken', '焼き鳥', { food: [6, 7.2] });
defItem(279, 'feather', '羽根', {});
defItem(280, 'bowl', 'おわん', {});
defItem(281, 'mushroom_stew', 'キノコシチュー', { food: [6, 7.2], stack: 1, leftover: 280 });
defItem(282, 'bucket', 'バケツ', { stack: 16, bucket: 'empty' });
defItem(283, 'water_bucket', '水入りバケツ', { stack: 1, bucket: 'water' });
defItem(284, 'lava_bucket', '溶岩入りバケツ', { stack: 1, bucket: 'lava' });
defItem(285, 'snowball', '雪玉', { stack: 16 });
const _dyes = [['red', '赤'], ['yellow', '黄色'], ['blue', '青'], ['green', '緑'], ['black', '黒'], ['pink', 'ピンク']];
_dyes.forEach(([k, n], i) => defItem(286 + i, 'dye_' + k, n + 'の染料', {}));
defItem(292, 'shadow_shard', 'カゲのかけら', {});
// 足りなかった10色の染料（330〜339）。DYE[c]＝その色の染料の番号
const DYE = [];
{
  let nd = 330;
  COLORS.forEach(([k, n], c) => { if (I['dye_' + k] === undefined) defItem(nd++, 'dye_' + k, n + 'の染料', {}); DYE[c] = I['dye_' + k]; });
}

// ---- べつの世界まわり（340〜） ----
defItem(340, 'flint', '火打ち石', {});
defItem(341, 'flint_steel', '火打ち金', { stack: 1, tool: { type: 'lighter', tier: 0, speed: 1, dur: 64, dmg: 1, mat: 'iron' } });
defItem(342, 'quartz', '白水晶', {});
defItem(343, 'homura_rod', 'ホムラの芯', {});
defItem(344, 'homura_powder', 'ホムラの粉', {});
defItem(345, 'hoshi_eye', 'ほしの目', {});
// ---- 畑と動物（346〜） ----
defItem(346, 'carrot', 'ニンジン', { food: [3, 3.6], place: 710 });
defItem(347, 'potato', 'ジャガイモ', { food: [1, 0.6], place: 711 });
defItem(348, 'baked_potato', '焼きジャガイモ', { food: [5, 6] });
defItem(349, 'pumpkin_seeds', 'カボチャの種', { place: 712 });
defItem(350, 'melon_seeds', 'スイカの種', { place: 713 });
defItem(351, 'melon_slice', 'スイカ', { food: [2, 1.2] });
defItem(352, 'pumpkin_pie', 'パンプキンパイ', { food: [8, 4.8] });
defItem(353, 'shears', 'ハサミ', { stack: 1, tool: { type: 'shears', tier: 0, speed: 1, dur: 238, dmg: 1, mat: 'iron' } });
defItem(354, 'egg', 'たまご', { stack: 16 });
defItem(355, 'fried_egg', '目玉焼き', { food: [4, 4.8] });
defItem(356, 'milk_bucket', 'ミルク入りバケツ', { stack: 1, food: [2, 2.4], leftover: 282, drink: true });

const TOOL_MATS = [
  { k: 'wood', n: '木', tier: 1, speed: 2, dur: 60, mat: '#planks' },
  { k: 'stone', n: '石', tier: 2, speed: 4, dur: 132, mat: 4 },
  { k: 'iron', n: '鉄', tier: 3, speed: 6, dur: 251, mat: 259 },
  { k: 'diamond', n: 'ダイヤ', tier: 4, speed: 8, dur: 1562, mat: 261 }
];
const TOOL_TYPES = [
  { k: 'pick', n: 'のツルハシ', dmg: 2 }, { k: 'axe', n: 'のオノ', dmg: 3 }, { k: 'shovel', n: 'のシャベル', dmg: 1.5 },
  { k: 'sword', n: 'の剣', dmg: 4 }, { k: 'hoe', n: 'のクワ', dmg: 1 }
];
TOOL_MATS.forEach((m, mi) => TOOL_TYPES.forEach((t, ti) => {
  defItem(300 + mi * 5 + ti, m.k + '_' + t.k, m.n + t.n, { stack: 1, tool: { type: t.k, tier: m.tier, speed: m.speed, dur: m.dur, dmg: t.dmg + mi, mat: m.k } });
}));
const ARMOR_MATS = [
  { k: 'iron', n: '鉄', def: [2, 6, 5, 2], dur: [165, 240, 225, 195], mat: 259 },
  { k: 'diamond', n: 'ダイヤ', def: [3, 8, 6, 3], dur: [363, 528, 495, 429], mat: 261 }
];
const ARMOR_TYPES = [['helmet', 'のかぶと'], ['chest', 'のよろい'], ['legs', 'のズボン'], ['boots', 'のくつ']];
ARMOR_MATS.forEach((m, mi) => ARMOR_TYPES.forEach(([k, n], pi) => {
  defItem(320 + mi * 4 + pi, m.k + '_' + k, m.n + n, { stack: 1, armor: { slot: pi, def: m.def[pi], dur: m.dur[pi], mat: m.k } });
}));

// ---------------- 分類（どれでも使える材料） ----------------
const TAGS = {
  '#planks': _woods.map(w => w[4]).concat([695]),
  '#log': _woods.map(w => w[2]),
  '#wool': WOOL.slice(),
  '#coal': [257, 258]
};
const TAG_NAMES = { '#planks': '板（どの木でも）', '#log': '原木（どの木でも）', '#wool': '羊毛（何色でも）', '#coal': '石炭か木炭' };
function specMatch(spec, id) { return typeof spec === 'number' ? spec === id : TAGS[spec].indexOf(id) >= 0; }

// ---------------- クラフトのレシピ ----------------
const RECIPES = [];
function shaped(out, n, rows, key, cat) {
  const need = new Map();
  for (const row of rows) for (const ch of row) if (ch !== ' ') need.set(key[ch], (need.get(key[ch]) || 0) + 1);
  const w = Math.max(...rows.map(r => r.length));
  RECIPES.push({ out, n, rows: rows.map(r => r.padEnd(w, ' ')), key, cat, need: [...need.entries()], table: rows.length > 2 || w > 2 });
}
function shapeless(out, n, list, cat) {
  const need = new Map();
  for (const s of list) need.set(s, (need.get(s) || 0) + 1);
  RECIPES.push({ out, n, list, cat, need: [...need.entries()], table: list.length > 4 });
}
for (const [k, , logId, , plankId] of _woods) shapeless(plankId, 4, [logId], 'block');
shaped(I.stick, 4, ['P', 'P'], { P: '#planks' }, 'misc');
shaped(B.crafting_table, 1, ['PP', 'PP'], { P: '#planks' }, 'block');
shaped(B.torch, 4, ['C', 'S'], { C: '#coal', S: I.stick }, 'misc');
shaped(B.furnace, 1, ['CCC', 'C C', 'CCC'], { C: B.cobble }, 'block');
shaped(B.chest, 1, ['PPP', 'P P', 'PPP'], { P: '#planks' }, 'block');
TOOL_MATS.forEach((m, mi) => {
  const k = { M: m.mat, S: I.stick }, base = 300 + mi * 5;
  shaped(base + 0, 1, ['MMM', ' S ', ' S '], k, 'tool');
  shaped(base + 1, 1, ['MM', 'MS', ' S'], k, 'tool');
  shaped(base + 2, 1, ['M', 'S', 'S'], k, 'tool');
  shaped(base + 3, 1, ['M', 'M', 'S'], k, 'tool');
  shaped(base + 4, 1, ['MM', ' S', ' S'], k, 'tool');
});
ARMOR_MATS.forEach((m, mi) => {
  const k = { M: m.mat }, base = 320 + mi * 4;
  shaped(base + 0, 1, ['MMM', 'M M'], k, 'tool');
  shaped(base + 1, 1, ['M M', 'MMM', 'MMM'], k, 'tool');
  shaped(base + 2, 1, ['MMM', 'M M', 'M M'], k, 'tool');
  shaped(base + 3, 1, ['M M', 'M M'], k, 'tool');
});
shaped(I.bucket, 1, ['I I', ' I '], { I: I.iron_ingot }, 'tool');
shaped(B.bed, 1, ['WWW', 'PPP'], { W: '#wool', P: '#planks' }, 'block');
B.door_oak = B.door;
_woods.forEach(([k, , , , plank]) => shaped(B['door_' + k], 3, ['PP', 'PP', 'PP'], { P: plank }, 'build'));
shaped(B.ladder, 3, ['S S', 'SSS', 'S S'], { S: I.stick }, 'block');
shaped(B.stone_bricks, 4, ['SS', 'SS'], { S: B.stone }, 'block');
shaped(B.sandstone, 1, ['SS', 'SS'], { S: B.sand }, 'block');
shaped(B.bricks, 1, ['BB', 'BB'], { B: I.brick }, 'block');
shaped(B.clay, 1, ['CC', 'CC'], { C: I.clay_ball }, 'block');
shaped(B.snow_block, 1, ['SS', 'SS'], { S: I.snowball }, 'block');
shaped(B.glow_block, 1, ['GG', 'GG'], { G: I.glow_dust }, 'block');
shaped(B.iron_block, 1, ['III', 'III', 'III'], { I: I.iron_ingot }, 'block');
shaped(B.gold_block, 1, ['III', 'III', 'III'], { I: I.gold_ingot }, 'block');
shaped(B.diamond_block, 1, ['III', 'III', 'III'], { I: I.diamond }, 'block');
shapeless(I.iron_ingot, 9, [B.iron_block], 'misc');
shapeless(I.gold_ingot, 9, [B.gold_block], 'misc');
shapeless(I.diamond, 9, [B.diamond_block], 'misc');
shaped(I.bread, 1, ['WWW'], { W: I.wheat }, 'food');
shaped(I.bowl, 4, ['P P', ' P '], { P: '#planks' }, 'food');
shapeless(I.mushroom_stew, 1, [I.bowl, B.mushroom_brown, B.mushroom_red], 'food');
shaped(I.golden_apple, 1, ['GGG', 'GAG', 'GGG'], { G: I.gold_ingot, A: I.apple }, 'food');
shapeless(I.dye_red, 2, [B.flower_red], 'misc');
shapeless(I.dye_yellow, 2, [B.flower_yellow], 'misc');
shapeless(I.dye_blue, 2, [B.flower_blue], 'misc');
shapeless(I.dye_black, 2, ['#coal'], 'misc');
shapeless(I.dye_pink, 2, [I.dye_red, B.flower_white], 'misc');
// ---- 色 ----
shapeless(I.dye_white, 2, [B.flower_white], 'color');
shapeless(I.dye_orange, 2, [B.flower_orange], 'color');
shapeless(I.dye_purple, 2, [B.flower_purple], 'color');
shapeless(I.dye_orange, 2, [I.dye_red, I.dye_yellow], 'color');
shapeless(I.dye_purple, 2, [I.dye_red, I.dye_blue], 'color');
shapeless(I.dye_pink, 2, [I.dye_red, I.dye_white], 'color');
shapeless(I.dye_magenta, 2, [I.dye_purple, I.dye_pink], 'color');
shapeless(I.dye_lightblue, 2, [I.dye_blue, I.dye_white], 'color');
shapeless(I.dye_lime, 2, [I.dye_green, I.dye_white], 'color');
shapeless(I.dye_gray, 2, [I.dye_black, I.dye_white], 'color');
shapeless(I.dye_lightgray, 2, [I.dye_gray, I.dye_white], 'color');
shapeless(I.dye_cyan, 2, [I.dye_blue, I.dye_green], 'color');
shapeless(I.dye_brown, 2, [I.dye_orange, I.dye_black], 'color');
COLORS.forEach(([k], c) => {
  if (c) shapeless(WOOL[c], 1, [B.wool_white, DYE[c]], 'color');
  shaped(CARPET[c], 3, ['WW'], { W: WOOL[c] }, 'color');
  shapeless(CONCRETE[c], 8, [B.sand, B.sand, B.sand, B.sand, B.gravel, B.gravel, B.gravel, B.gravel, DYE[c]], 'color');
  shaped(CGLASS[c], 8, ['GGG', 'GDG', 'GGG'], { G: B.glass, D: DYE[c] }, 'color');
  if (TERRA[c] !== B.terracotta_red && TERRA[c] !== B.terracotta_yellow) shaped(TERRA[c], 8, ['TTT', 'TDT', 'TTT'], { T: B.terracotta, D: DYE[c] }, 'color');
});
// ---- 形のあるブロック ----
_mats.forEach(([k, , base]) => {
  shaped(B['stairs_' + k], 4, ['M  ', 'MM ', 'MMM'], { M: base }, 'build');
  shaped(B['slab_' + k], 6, ['MMM'], { M: base }, 'build');
});
_woods.forEach(([k, , , , plank]) => {
  shaped(B['fence_' + k], 3, ['PSP', 'PSP'], { P: plank, S: I.stick }, 'build');
  shaped(B['gate_' + k], 1, ['SPS', 'SPS'], { P: plank, S: I.stick }, 'build');
  shaped(B['trapdoor_' + k], 2, ['PPP', 'PPP'], { P: plank }, 'build');
});
for (const k of ['cobble', 'mossy_cobble', 'stone_bricks', 'bricks', 'sandstone']) shaped(B['wall_' + k], 6, ['MMM', 'MMM'], { M: B[k] }, 'build');
shaped(B.glass_pane, 16, ['GGG', 'GGG'], { G: B.glass }, 'build');
shaped(B.iron_bars, 16, ['III', 'III'], { I: I.iron_ingot }, 'build');
shaped(B.sign, 3, ['PPP', 'PPP', ' S '], { P: '#planks', S: I.stick }, 'build');
// ---- 明かり・かざり ----
shapeless(B.lantern, 2, [I.iron_ingot, B.torch, B.glass], 'block');
shapeless(B.chochin, 1, [B.torch, B.wool_red, I.stick], 'block');
shaped(B.campfire, 1, [' S ', 'SCS', 'LLL'], { S: I.stick, C: '#coal', L: '#log' }, 'block');
shaped(B.crystal_lamp, 2, ['GDG', 'DDD', 'GDG'], { G: B.glass, D: I.glow_dust }, 'block');
shaped(B.hay, 1, ['WWW', 'WWW', 'WWW'], { W: I.wheat }, 'block');
shapeless(I.wheat, 9, [B.hay], 'misc');
shaped(B.granite_smooth, 4, ['XX', 'XX'], { X: B.granite }, 'block');
shaped(B.diorite_smooth, 4, ['XX', 'XX'], { X: B.diorite }, 'block');
shaped(B.andesite_smooth, 4, ['XX', 'XX'], { X: B.andesite }, 'block');
shaped(B.chiseled_bricks, 1, ['S', 'S'], { S: B.slab_stone_bricks }, 'block');
shapeless(B.mossy_bricks, 1, [B.stone_bricks, B.vine], 'block');
shapeless(B.mossy_bricks, 1, [B.stone_bricks, B.moss], 'block');
shaped(B.chiseled_sandstone, 1, ['S', 'S'], { S: B.slab_sandstone }, 'block');
shaped(B.red_sandstone, 1, ['SS', 'SS'], { S: B.red_sand }, 'block');
shaped(B.terracotta_red, 8, ['TTT', 'TDT', 'TTT'], { T: B.terracotta, D: I.dye_red }, 'block');
shaped(B.terracotta_yellow, 8, ['TTT', 'TDT', 'TTT'], { T: B.terracotta, D: I.dye_yellow }, 'block');
shaped(B.coarse_dirt, 4, ['DG', 'GD'], { D: B.dirt, G: B.gravel }, 'block');
shapeless(B.mossy_cobble, 1, [B.cobble, B.vine], 'block');
shapeless(B.mossy_cobble, 1, [B.cobble, B.moss], 'block');
shaped(B.altar, 1, ['OSO', 'SDS', 'OSO'], { O: B.obsidian, S: I.shadow_shard, D: I.diamond }, 'block');

// ---- 畑と動物 ----
shaped(I.shears, 1, [' I', 'I '], { I: I.iron_ingot }, 'tool');
shapeless(I.pumpkin_seeds, 4, [B.pumpkin], 'food');
shapeless(I.melon_seeds, 1, [I.melon_slice], 'food');
shaped(B.melon, 1, ['MMM', 'MMM', 'MMM'], { M: I.melon_slice }, 'food');
shapeless(B.jack_lantern, 1, [B.pumpkin, B.torch], 'block');
shapeless(I.pumpkin_pie, 1, [B.pumpkin, I.egg, I.wheat], 'food');
// ---- べつの世界 ----
shapeless(I.flint_steel, 1, [I.iron_ingot, I.flint], 'tool');
shapeless(I.homura_powder, 2, [I.homura_rod], 'misc');
shapeless(I.hoshi_eye, 1, [I.homura_powder, I.shadow_shard], 'misc');
shaped(B.sora_frame, 1, ['E', 'O'], { E: I.hoshi_eye, O: B.obsidian }, 'block');
shapeless(B.planks_aobi, 4, [B.aobi_stem], 'block');
shaped(B.yake_bricks, 4, ['XX', 'XX'], { X: B.yakeishi }, 'block');
shaped(B.quartz_block, 1, ['QQ', 'QQ'], { Q: I.quartz }, 'block');
shaped(B.sora_bricks, 4, ['XX', 'XX'], { X: B.soraishi }, 'block');
shaped(B.magma, 1, ['PP', 'PP'], { P: I.homura_powder }, 'block');
[['yake_bricks', 'yake_bricks'], ['quartz', 'quartz_block'], ['sora_bricks', 'sora_bricks']].forEach(([k, bk]) => {
  shaped(B['stairs_' + k], 4, ['M  ', 'MM ', 'MMM'], { M: B[bk] }, 'build');
  shaped(B['slab_' + k], 6, ['MMM'], { M: B[bk] }, 'build');
});
shaped(B.fence_yake, 6, ['MMM', 'MMM'], { M: B.yake_bricks }, 'build');
shaped(B.wall_yake_bricks, 6, ['MMM', 'M M'], { M: B.yake_bricks }, 'build');
shaped(B.wall_sora_bricks, 6, ['MMM', 'MMM'], { M: B.sora_bricks }, 'build');

// ---------------- かまど ----------------
const SMELT = {};
SMELT[B.ore_iron] = [I.iron_ingot, 1]; SMELT[B.ore_gold] = [I.gold_ingot, 1];
SMELT[B.sand] = [B.glass, 1]; SMELT[B.red_sand] = [B.glass, 1]; SMELT[B.cobble] = [B.stone, 1]; SMELT[B.clay] = [B.terracotta, 1];
for (const id of TAGS['#log']) SMELT[id] = [I.charcoal, 1];
SMELT[I.clay_ball] = [I.brick, 1]; SMELT[B.cactus] = [I.dye_green, 1];
SMELT[B.stone_bricks] = [B.cracked_bricks, 1]; SMELT[B.stone] = [B.smooth_stone, 1]; SMELT[B.sandstone] = [B.smooth_sandstone, 1];
SMELT[I.raw_pork] = [I.cooked_pork, 1]; SMELT[I.raw_beef] = [I.steak, 1];
SMELT[I.raw_mutton] = [I.cooked_mutton, 1]; SMELT[I.raw_chicken] = [I.cooked_chicken, 1];
SMELT[B.ore_coal] = [I.coal, 1]; SMELT[B.ore_diamond] = [I.diamond, 1]; SMELT[B.ore_quartz] = [I.quartz, 1];
SMELT[I.potato] = [I.baked_potato, 1]; SMELT[I.egg] = [I.fried_egg, 1];
const FUEL = {};   // 燃える時間（秒）。1こ焼くのに10秒
FUEL[I.coal] = 80; FUEL[I.charcoal] = 80; FUEL[I.stick] = 5; FUEL[I.lava_bucket] = 1000;
for (const id of TAGS['#planks']) FUEL[id] = 15;
for (const id of TAGS['#log']) FUEL[id] = 15;
for (const w of _woods) FUEL[w[5]] = 5;
FUEL[B.crafting_table] = 15; FUEL[B.chest] = 15; FUEL[B.ladder] = 15; FUEL[I.bowl] = 5; FUEL[B.sign] = 10;
_woods.forEach(([k], w) => { FUEL[B['door_' + k]] = 10; FUEL[B['fence_' + k]] = 15; FUEL[B['gate_' + k]] = 15; FUEL[B['trapdoor_' + k]] = 15; FUEL[B['stairs_' + k]] = 15; FUEL[B['slab_' + k]] = 7; });
for (const id of WOOL) FUEL[id] = 5; for (const id of CARPET) FUEL[id] = 3;
for (let t = 0; t < 5; t++) FUEL[300 + t] = 10;
FUEL[I.homura_rod] = 120;
const SMELT_TIME = 200;   // 1こ焼くのにかかる時間（1秒=20）

function itemName(id) { return ITEMS[id] ? ITEMS[id].name : '？'; }
function maxStack(id) { return ITEMS[id] ? ITEMS[id].stack : 64; }

// ---------------- 動物の好物 ----------------
const MOB_FOOD = { cow: [267], sheep: [267], pig: [346, 347], chicken: [266, 349, 350] };   // 小麦／ニンジン・ジャガイモ／種
const MEATS = [271, 272, 273, 274, 275, 276, 277, 278];
