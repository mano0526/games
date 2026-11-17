// ===== 02_blocks.js : ブロック・アイテム・レシピの定義（作業スレッドと共用） =====
const S_NONE = 0, S_CUBE = 1, S_CROSS = 2, S_TORCH = 3, S_FLUID = 4, S_LAYER = 5, S_FARM = 6, S_CACTUS = 7,
  S_CROP = 8, S_CHEST = 9, S_DOOR = 10, S_BED = 11, S_LADDER = 12;

const BLOCKS = new Array(256).fill(null);
const B = {};
const OPAQUE = new Uint8Array(256);   // すき間のない立方体（となりの面を隠す）
const SOLID = new Uint8Array(256);    // ぶつかる
const LOPAC = new Uint8Array(256);    // 光の通しにくさ 0..15
const LEMIT = new Uint8Array(256);    // 自分で光る強さ
const RCLASS = new Uint8Array(256);   // 0:不透明 1:切り抜き 2:半透明
const SHAPE = new Uint8Array(256);
const REPLACE = new Uint8Array(256);  // 上から置きかえられる
const FLUID = new Uint8Array(256);    // 1:水 2:溶岩
const GRAVITY = new Uint8Array(256);
const ISLEAF = new Uint8Array(256);
const ISLOG = new Uint8Array(256);

function defBlock(id, key, name, o) {
  const d = Object.assign({ id, key, name, shape: S_CUBE, hard: 1, tool: null, level: 0, needTool: false, sound: 'stone', light: 0 }, o);
  if (d.opaque === undefined) d.opaque = d.shape === S_CUBE && !d.cutout && !d.trans;
  if (d.solid === undefined) d.solid = d.shape === S_CUBE || d.shape === S_FARM || d.shape === S_CACTUS || d.shape === S_CHEST || d.shape === S_DOOR || d.shape === S_BED;
  if (d.opac === undefined) d.opac = d.opaque ? 15 : 0;
  BLOCKS[id] = d; B[key] = id;
  OPAQUE[id] = d.opaque ? 1 : 0; SOLID[id] = d.solid ? 1 : 0; LOPAC[id] = d.opac; LEMIT[id] = d.light;
  RCLASS[id] = d.trans ? 2 : (d.cutout || (d.shape !== S_CUBE && d.shape !== S_FLUID && d.shape !== S_FARM && d.shape !== S_CACTUS && d.shape !== S_CHEST && d.shape !== S_LAYER && d.shape !== S_BED && d.shape !== S_NONE)) ? 1 : 0;
  SHAPE[id] = d.shape; REPLACE[id] = d.replace ? 1 : 0; FLUID[id] = d.fluid || 0; GRAVITY[id] = d.gravity ? 1 : 0;
  ISLEAF[id] = d.leaves ? 1 : 0; ISLOG[id] = d.log ? 1 : 0;
  return d;
}

const I = {};       // アイテムのキー → 番号
const ITEMS = {};   // 番号 → 定義（ブロックも含む）
function defItem(id, key, name, o) {
  const d = Object.assign({ id, key, name, stack: 64 }, o);
  ITEMS[id] = d; I[key] = id; return d;
}

// ---------------- ブロック ----------------
defBlock(0, 'air', '空気', { shape: S_NONE, hard: 0, replace: true, tex: null });
defBlock(1, 'stone', '石', { tex: 'stone', hard: 1.5, tool: 'pick', level: 1, needTool: true, drop: 'cobble' });
defBlock(2, 'grass', '草ブロック', { tex: { top: 'grass_top', side: 'grass_side', bottom: 'dirt' }, hard: 0.6, tool: 'shovel', sound: 'grass', drop: 'dirt', tint: true });
defBlock(3, 'dirt', '土', { tex: 'dirt', hard: 0.5, tool: 'shovel', sound: 'dirt' });
defBlock(4, 'cobble', '丸石', { tex: 'cobble', hard: 2, tool: 'pick', level: 1, needTool: true });
defBlock(5, 'planks_oak', 'オークの板', { tex: 'planks_oak', hard: 2, tool: 'axe', sound: 'wood' });
defBlock(6, 'bedrock', '岩盤', { tex: 'bedrock', hard: -1 });
defBlock(7, 'water', '水', { shape: S_FLUID, tex: 'water_0', hard: -1, trans: true, opac: 2, fluid: 1, replace: true, sound: 'water' });
defBlock(8, 'lava', '溶岩', { shape: S_FLUID, tex: 'lava_0', hard: -1, light: 15, opac: 15, fluid: 2, replace: true, sound: 'water' });
defBlock(9, 'sand', '砂', { tex: 'sand', hard: 0.5, tool: 'shovel', sound: 'sand', gravity: true });
defBlock(10, 'gravel', '砂利', { tex: 'gravel', hard: 0.6, tool: 'shovel', sound: 'gravel', gravity: true });
const _woods = [['oak', 'オーク', 11, 12, 5, 46], ['birch', 'シラカバ', 13, 14, 19, 47], ['spruce', 'マツ', 15, 16, 20, 48], ['cherry', 'サクラ', 17, 18, 21, 49]];
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
defBlock(40, 'tallgrass', '草', { shape: S_CROSS, tex: 'tallgrass', hard: 0, sound: 'grass', replace: true, tint: true, support: 'soil', drop: (rng) => rng() < 0.18 ? [[I.wheat_seeds, 1]] : [], sprite: 'tallgrass_0' });
defBlock(41, 'flower_red', '赤い花', { shape: S_CROSS, tex: 'flower_red', hard: 0, sound: 'grass', support: 'soil', sprite: 'flower_red' });
defBlock(42, 'flower_yellow', '黄色い花', { shape: S_CROSS, tex: 'flower_yellow', hard: 0, sound: 'grass', support: 'soil', sprite: 'flower_yellow' });
defBlock(43, 'flower_blue', '青い花', { shape: S_CROSS, tex: 'flower_blue', hard: 0, sound: 'grass', support: 'soil', sprite: 'flower_blue' });
defBlock(44, 'flower_white', '白い花', { shape: S_CROSS, tex: 'flower_white', hard: 0, sound: 'grass', support: 'soil', sprite: 'flower_white' });
defBlock(45, 'deadbush', '枯れ草', { shape: S_CROSS, tex: 'deadbush', hard: 0, sound: 'grass', replace: true, support: 'sandy', drop: (rng) => rng() < 0.6 ? [[I.stick, 1]] : [], sprite: 'deadbush' });
for (const [k, n, , , , sapId] of _woods) defBlock(sapId, 'sapling_' + k, n + 'の苗木', { shape: S_CROSS, tex: 'sapling_' + k, hard: 0, sound: 'grass', support: 'soil', sprite: 'sapling_' + k });
defBlock(50, 'farmland', '耕地', { shape: S_FARM, tex: { top: 'farmland_dry', bottom: 'dirt', side: 'dirt' }, hard: 0.6, tool: 'shovel', sound: 'dirt', drop: 'dirt' });
defBlock(51, 'wheat_crop', '小麦', {
  shape: S_CROP, tex: 'wheat_0', hard: 0, sound: 'grass', support: 'farmland',
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
for (let i = 0; i < 256; i++) if (BLOCKS[i] && typeof BLOCKS[i].drop === 'string') BLOCKS[i].drop = B[BLOCKS[i].drop];

// ブロックをそのままアイテムとしても登録（持てないものは除く）
const _noItem = new Set([0, 7, 8, 31, 50, 51]);
for (let i = 1; i < 256; i++) if (BLOCKS[i] && !_noItem.has(i)) defItem(i, BLOCKS[i].key, BLOCKS[i].name, { block: i });
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
  '#planks': [5, 19, 20, 21],
  '#log': [11, 13, 15, 17],
  '#wool': [54, 55, 56, 57, 58, 59, 60],
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
shaped(B.door, 3, ['PP', 'PP', 'PP'], { P: '#planks' }, 'block');
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
_dyes.forEach(([k], i) => shapeless(B['wool_' + k], 1, [B.wool_white, 286 + i], 'block'));
shaped(B.altar, 1, ['OSO', 'SDS', 'OSO'], { O: B.obsidian, S: I.shadow_shard, D: I.diamond }, 'block');

// ---------------- かまど ----------------
const SMELT = {};
SMELT[B.ore_iron] = [I.iron_ingot, 1]; SMELT[B.ore_gold] = [I.gold_ingot, 1];
SMELT[B.sand] = [B.glass, 1]; SMELT[B.cobble] = [B.stone, 1];
for (const id of TAGS['#log']) SMELT[id] = [I.charcoal, 1];
SMELT[I.clay_ball] = [I.brick, 1]; SMELT[B.cactus] = [I.dye_green, 1];
SMELT[B.stone_bricks] = [B.cracked_bricks, 1];
SMELT[I.raw_pork] = [I.cooked_pork, 1]; SMELT[I.raw_beef] = [I.steak, 1];
SMELT[I.raw_mutton] = [I.cooked_mutton, 1]; SMELT[I.raw_chicken] = [I.cooked_chicken, 1];
SMELT[B.ore_coal] = [I.coal, 1]; SMELT[B.ore_diamond] = [I.diamond, 1];
const FUEL = {};   // 燃える時間（秒）。1こ焼くのに10秒
FUEL[I.coal] = 80; FUEL[I.charcoal] = 80; FUEL[I.stick] = 5; FUEL[I.lava_bucket] = 1000;
for (const id of TAGS['#planks']) FUEL[id] = 15;
for (const id of TAGS['#log']) FUEL[id] = 15;
for (const id of [46, 47, 48, 49]) FUEL[id] = 5;
FUEL[B.crafting_table] = 15; FUEL[B.chest] = 15; FUEL[B.ladder] = 15; FUEL[B.door] = 10; FUEL[I.bowl] = 5;
for (let t = 0; t < 5; t++) FUEL[300 + t] = 10;
const SMELT_TIME = 200;   // 1こ焼くのにかかる時間（1秒=20）

function itemName(id) { return ITEMS[id] ? ITEMS[id].name : '？'; }
function maxStack(id) { return ITEMS[id] ? ITEMS[id].stack : 64; }
