// ===== 12_main.js : ゲーム全体の進行・セーブ・目標・毎フレームの処理 =====
const ACHS = [
  { id: 'wood', title: '木をあつめる', hint: '木の幹をなぐって原木を手に入れよう', icon: B.log_oak },
  { id: 'planks', title: '板をつくる', hint: '持ち物を開いて、原木から板を作ろう', icon: B.planks_oak },
  { id: 'table', title: '作業台をつくる', hint: '板4まいで作れる。置いて使うと作れる物がふえる', icon: B.crafting_table },
  { id: 'wpick', title: '木のツルハシ', hint: '作業台で、板3まいと棒2本から作ろう', icon: I.wood_pick },
  { id: 'stone', title: '石をほる', hint: 'ツルハシで石をほると丸石が手に入る', icon: B.cobble },
  { id: 'spick', title: '石のツルハシ', hint: '丸石3こと棒2本。鉄鉱石がほれるようになる', icon: I.stone_pick },
  { id: 'furnace', title: 'かまどをつくる', hint: '丸石8こで作れる。鉱石や肉を焼ける', icon: B.furnace },
  { id: 'torch', title: 'たいまつで照らす', hint: '石炭（か木炭）と棒で作れる。明るい所には敵がわかない', icon: B.torch },
  { id: 'food', title: '肉を焼いて食べる', hint: '動物の肉をかまどで焼こう。食べ物は押しっぱなしで食べる', icon: I.cooked_pork },
  { id: 'bed', title: 'ベッドで朝をむかえる', hint: '羊毛3つと板3まいでベッド。夜に使うと朝になる', icon: B.bed },
  { id: 'iron', title: '鉄をとかす', hint: '鉄鉱石をかまどで焼くと鉄インゴットになる', icon: I.iron_ingot },
  { id: 'ipick', title: '鉄のツルハシ', hint: '鉄インゴット3こと棒2本。金やダイヤがほれる', icon: I.iron_pick },
  { id: 'farm', title: '畑をたがやす', hint: 'クワで土をたがやし、草から出る種をまこう', icon: I.wood_hoe },
  { id: 'bread', title: 'パンを焼く', hint: '育った小麦3つでパンになる', icon: I.bread },
  { id: 'breed', title: '動物をふやす', hint: '同じ動物2ひきに好物をあげると子どもが生まれる。ウシ・ヒツジ＝小麦、ブタ＝ニンジンかジャガイモ、ニワトリ＝種', icon: I.wheat },
  { id: 'dog', title: 'イヌとなかよくなる', hint: '森や雪の森にいるイヌに、肉をあげてみよう（何回か必要）。なつくと ついてきて、敵にかみつく', icon: I.cooked_pork },
  { id: 'boat', title: 'ボートで 水の上を進む', hint: '板5まいで ボート。水に「使う」で うかべ、もう一度「使う」で 乗る。しゃがむ で おりる', icon: I.boat },
  { id: 'horse', title: 'ウマを なつかせる', hint: '草原や サバンナの ウマに、何も持たずに「使う」で 乗る。ふり落とされても 何回か乗ると なつく。「くら」（羊毛3・糸2・鉄2）を つけると 走れる', icon: I.saddle },
  { id: 'cart', title: 'トロッコで 走る', hint: '鉄6・棒1で レール16本。レールに トロッコ（鉄5）を置いて 乗る。金の「はやレール」で 速くなる', icon: I.cart },
  { id: 'village', title: '村を見つける', hint: '草原・砂漠・雪原などにある、道と家のある村', icon: B.path },
  { id: 'trade', title: 'サトビトと こうかんする', hint: '村人に「使う」。小麦16こ や 石炭12こ が 緑の石「ヒスイ」1こになり、ヒスイで いろいろな物と かえてもらえる', icon: I.jade },
  { id: 'armor', title: 'よろいを身につける', hint: '鉄で防具を作り、持ち物の左のマスに入れよう', icon: I.iron_chest },
  { id: 'shade', title: 'ヨルカゲをたおす', hint: '夜に現れる影の敵。たおすと「カゲのかけら」を落とす', icon: I.shadow_shard },
  { id: 'bow', title: '弓をつくる', hint: '棒3本と糸3本。糸は 夜に出る けむし「イトハキ」が落とす。矢は 火打ち石・棒・羽根', icon: I.bow },
  { id: 'snipe', title: '遠くの敵を射ぬく', hint: '弓は 使うボタンを長くおして引き、はなして うつ。20ブロック以上はなれた生き物に当てよう', icon: I.arrow },
  { id: 'shield', title: '盾でふせぐ', hint: '板6まいと鉄インゴット1こで盾。持ち物の「盾」のマスに入れ、使うボタンをおしている間 かまえる', icon: I.shield },
  { id: 'boom', title: 'はじけ箱に火をつける', hint: 'キノコの敵「バクダケ」が落とす はじけ粉5こと 砂4こで作る。火打ち金で火をつけたら すぐ はなれよう', icon: B.hajike_box },
  { id: 'ench', title: '道具に力をこめる', hint: '「ちからの台」（黒曜石4・ダイヤ2・ひかりの粉1）に、道具と ひかりの粉を置く。レベル5から', icon: B.ench_table },
  { id: 'potion', title: 'くすりを のむ', hint: '水入りびん（ガラスびんで水をくむ）＋ホムラの粉＋材料。スイカなら「いやしの くすり」', icon: I.potion_heal },
  { id: 'loot', title: '遺跡の宝箱を開ける', hint: '地上の石づくりの遺跡や、地下の小部屋を探そう', icon: B.chest },
  { id: 'diamond', title: 'ダイヤを見つける', hint: '地下深く（高さ15より下）を鉄のツルハシでほろう', icon: I.diamond },
  { id: 'dpick', title: 'ダイヤのツルハシ', hint: 'ダイヤ3こと棒2本。黒曜石がほれる', icon: I.diamond_pick },
  { id: 'obsidian', title: '黒曜石を手に入れる', hint: '溶岩のみなもとに水をかけるとできる。バケツが役に立つ', icon: B.obsidian },
  { id: 'altar', title: 'めざめの祭壇をつくる', hint: '黒曜石4・カゲのかけら4・ダイヤ1。置いて使うと…', icon: B.altar },
  { id: 'king', title: 'カゲの王をたおす', hint: '祭壇を使うと現れる。よろいと食べ物の準備を忘れずに', icon: B.crown_block },
  { id: 'flint', title: '火打ち金をつくる', hint: '砂利をほると ときどき出る「火打ち石」と、鉄インゴットで作る', icon: I.flint_steel },
  { id: 'gate', title: 'ホムラの門をひらく', hint: '黒曜石で四角いわく（内がわが よこ2×たて3以上）を作り、内がわに火打ち金を使う', icon: B.obsidian },
  { id: 'homura', title: 'ホムラの底に立つ', hint: '門の中にしばらく立つと、溶岩の海が広がる べつの世界へ行ける', icon: B.yakeishi },
  { id: 'fort', title: 'とりでを見つける', hint: 'ホムラの底にある、やけレンガの橋と広場', icon: B.yake_bricks },
  { id: 'rod', title: 'ホムラの芯を手に入れる', hint: 'とりでにいる火の生き物「ホムラビ」が落とす', icon: I.homura_rod },
  { id: 'eye', title: 'ほしの目をつくる', hint: 'ホムラの粉（芯1本から2つ）と カゲのかけらで作る。12こ必要', icon: I.hoshi_eye },
  { id: 'ring', title: 'ソラの門をひらく', hint: '「ソラの門のわく」12こを、地面に 5×5 の輪（かどの4つはなし）にならべる', icon: B.sora_frame },
  { id: 'crystal', title: 'ほしの結晶をこわす', hint: 'ソラのはての柱の上にある。残っていると、ボスの体力がもどってしまう', icon: B.hoshi_crystal },
  { id: 'hoshikui', title: 'ホシクイをたおす', hint: 'とびかかってきた時と、まんなかの台にとまった時が たたくチャンス', icon: B.hoshi_egg },
  { id: 'glide', title: 'ソラの羽で 滑空する', hint: 'ホシクイが落とす「ソラの羽」か、ソラのはての ホシカゲが落とす「ほしの羽根」7まいと 糸で作る。よろいのマスに入れ、高い所から とんで 空中で ジャンプ', icon: I.glider }
];
const ACH_ITEM = {}; for (const id of TAGS['#log']) ACH_ITEM[id] = 'wood';
for (const id of TAGS['#planks']) ACH_ITEM[id] = 'planks';
ACH_ITEM[B.cobble] = 'stone'; ACH_ITEM[I.iron_ingot] = 'iron'; ACH_ITEM[I.diamond] = 'diamond'; ACH_ITEM[B.obsidian] = 'obsidian';
ACH_ITEM[I.flint_steel] = 'flint'; ACH_ITEM[I.homura_rod] = 'rod'; ACH_ITEM[I.hoshi_eye] = 'eye';
const ACH_CRAFT = {}; ACH_CRAFT[B.crafting_table] = 'table'; ACH_CRAFT[I.wood_pick] = 'wpick'; ACH_CRAFT[I.stone_pick] = 'spick'; ACH_CRAFT[B.furnace] = 'furnace'; ACH_CRAFT[B.torch] = 'torch';
ACH_CRAFT[I.iron_pick] = 'ipick'; ACH_CRAFT[I.diamond_pick] = 'dpick'; ACH_CRAFT[I.bread] = 'bread'; ACH_CRAFT[B.altar] = 'altar'; ACH_CRAFT[I.flint_steel] = 'flint'; ACH_CRAFT[I.hoshi_eye] = 'eye'; ACH_CRAFT[I.bow] = 'bow';

function b64(u8) { let s = ''; for (let i = 0; i < u8.length; i += 0x8000) s += String.fromCharCode.apply(null, u8.subarray(i, i + 0x8000)); return btoa(s); }
function unb64(str) { const s = atob(str), u = new Uint8Array(s.length); for (let i = 0; i < s.length; i++) u[i] = s.charCodeAt(i); return u; }

// ---------------- 保存先（ブラウザの中） ----------------
const storage = {
  db: null, ok: false, mem: new Map(), memChunks: new Map(),
  init() {
    return new Promise((res) => {
      let done = false; const fin = (v) => { if (!done) { done = true; res(v); } };
      try {
        const rq = indexedDB.open('kakukaku', 1);
        rq.onupgradeneeded = () => { const db = rq.result; if (!db.objectStoreNames.contains('worlds')) db.createObjectStore('worlds', { keyPath: 'id' }); if (!db.objectStoreNames.contains('chunks')) db.createObjectStore('chunks'); };
        rq.onsuccess = () => { this.db = rq.result; this.ok = true; fin(true); };
        rq.onerror = () => fin(false); rq.onblocked = () => fin(false);
        setTimeout(() => fin(this.ok), 2500);
      } catch (e) { fin(false); }
    });
  },
  req(r) { return new Promise((res, rej) => { r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); }); },
  done(tx) { return new Promise((res, rej) => { tx.oncomplete = () => res(); tx.onerror = () => rej(tx.error); tx.onabort = () => rej(tx.error); }); },
  async list() {
    let all;
    if (!this.ok) all = [...this.mem.values()];
    else { try { all = await this.req(this.db.transaction('worlds', 'readonly').objectStore('worlds').getAll()); } catch (e) { all = []; } }
    return all.sort((a, b) => b.savedAt - a.savedAt);
  },
  async load(id) {
    if (!this.ok) { const m = this.mem.get(id); return m ? { meta: m, chunks: new Map(this.memChunks.get(id) || []) } : null; }
    try {
      const tx = this.db.transaction(['worlds', 'chunks'], 'readonly');
      const meta = await this.req(tx.objectStore('worlds').get(id));
      if (!meta) return null;
      const range = IDBKeyRange.bound(id + '|', id + '|￿'), st = tx.objectStore('chunks');
      const [ks, vs] = await Promise.all([this.req(st.getAllKeys(range)), this.req(st.getAll(range))]);
      const chunks = new Map();
      for (let i = 0; i < ks.length; i++) chunks.set(ks[i].slice(id.length + 1), vs[i]);
      return { meta, chunks };
    } catch (e) { return null; }
  },
  async save(meta, entries) {
    if (!this.ok) { this.mem.set(meta.id, meta); let m = this.memChunks.get(meta.id); if (!m) { m = new Map(); this.memChunks.set(meta.id, m); } for (const [k, v] of entries) m.set(k, v); return; }
    const tx = this.db.transaction(['worlds', 'chunks'], 'readwrite');
    tx.objectStore('worlds').put(meta);
    const st = tx.objectStore('chunks');
    for (const [k, v] of entries) st.put(v, meta.id + '|' + k);
    await this.done(tx);
  },
  async remove(id) {
    if (!this.ok) { this.mem.delete(id); this.memChunks.delete(id); return; }
    const tx = this.db.transaction(['worlds', 'chunks'], 'readwrite');
    tx.objectStore('worlds').delete(id); tx.objectStore('chunks').delete(IDBKeyRange.bound(id + '|', id + '|￿'));
    await this.done(tx);
  }
};

// 世界のルール（世界を作るときと、メニューの「世界のルール」で変えられる）
const RULES = [{ k: 'keep', name: '力尽きても持ち物を落とさない' }, { k: 'mobs', name: '敵が出る' }, { k: 'day', name: 'ずっと昼' }, { k: 'grief', name: 'ボスがブロックをこわす' }, { k: 'pvp', name: '友だちへの攻撃' }];
const game = {
  state: 'boot', world: null, isDemo: false, worldId: null, name: '', diff: 2, ach: {}, ended: false, boss: null,
  gates: new Map(), limbo: [[], [], []], arrive: null, soraDone: false, soraT: 0,   // 門の一覧／べつの世界に置いてきた落とし物とボス／移動のとちゅう／ソラのはてのボスをたおしたか
  rules: { keep: false, mobs: true, day: false, grief: true, pvp: false }, online: false, inBed: false, sessionT: 0, bossLost: 0, dynScale: 1, dynDist: 99,
  defaultRules(diff) { return { keep: diff < 2, mobs: true, day: false, grief: true, pvp: false }; },
  // ルールやむずかしさを変える。みんなの世界では全員に伝える
  setRule(k, v) {
    if (this.online && !net.own) return;
    if (k === 'diff') this.diff = v; else this.rules[k] = v;
    if (this.online) net.setMeta({ diff: this.diff, rules: Object.assign({}, this.rules) }); else this.save();
  },
  applyMeta(m) {
    if (!this.online || !m) return;
    this.name = m.name; this.diff = m.diff; this.rules = Object.assign(this.defaultRules(m.diff), m.rules || {}); this.soraDone = !!m.sora;
    if (ui.menu === 'mRules') ui.paintRules();
  },
  camKick: 0, shake: 0, fps: 0, debug: false, acc: 0, last: 0, frames: 0, fpsT: 0, saveT: 0, pausedAt: 0, saveChain: Promise.resolve(),
  cam: { x: 0, y: 80, z: 0, yaw: 0, pitch: 0, fov: 75, roll: 0 }, worldSpawn: { x: 0.5, y: 70, z: 0.5 }, needSafeSpot: 0, titlePos: null, titleAng: 0, loadT: 0, endT: 0, resumeId: null,

  async boot() {
    loadSettings(); net.init();
    try {
      buildTextures(); buildIcons();
      if (!initRenderer($('gl'))) { ui.init(); ui.error('このブラウザでは3D表示（WebGL2）が使えないようです。新しめの Chrome・Safari・Edge・Firefox でお試しください。'); return; }
      initMesher(); buildIconUrls(); buildHudIcons(); uploadMobTexture(buildMobAtlas()); paintSkin(0, settings.look);
    } catch (e) { console.error(e); ui.init(); ui.error('準備中に問題が起きました：' + (e && e.message ? e.message : e)); return; }
    ui.init(); map.bind(); applySettings();
    window.addEventListener('resize', resizeRenderer);
    document.addEventListener('visibilitychange', () => { if (document.hidden && this.state === 'playing') { this.save(); if (!touchSt.touchUsed) this.pause(); } });
    window.addEventListener('pagehide', () => this.save());
    this.showTitle();
    this.last = performance.now();
    requestAnimationFrame((t) => this.loop(t));
    await storage.init();
    $('titleNote').textContent = storage.ok ? '遊んだ世界はこの端末のブラウザに自動で保存されます' : 'この環境では自動保存が使えません（遊ぶことはできます）';
    if (this.resumeId) { const id = this.resumeId; this.resumeId = null; if (id[0] === '@') this.joinOnline(id.slice(1)); else this.loadWorld(id); return; }
    this.onNetReady();
  },
  // 招待リンク（?room=XXXX）で来たとき：なまえが決まっていればそのまま入る。まだなら入れる画面を出す
  onNetReady() {
    if (this._roomDone || this.state !== 'title') return;
    let room = ''; try { room = net.cleanCode(new URLSearchParams(location.search).get('room')); } catch (e) { }
    if (room.length !== 4) {   // ゲーム一覧の「みんなの部屋」から、部屋主として来たとき：世界をえらぶ画面を出す
      try { if (net.avail && window.NetDB && NetDB.hub && NetDB.hub.isHost && NetDB.hub.code && !this._roomDone) { this._roomDone = true; ui.openOnline(); ui.toast('遊ぶ世界に入ると、みんなも自動で入ってきます', 7); } } catch (e) { }
      return;
    }
    if (!net.avail) { if (!window.__blockOnline || document.readyState === 'complete') { this._roomDone = true; ui.openOnline(); } return; }
    this._roomDone = true;
    if (net.getName()) { this.joinOnline(room); return; }
    ui.openOnline(); $('inCode').value = room; ui.toast('なまえを入れて「コードで入る」を押してください', 7);
  },
  // 平らで歩きやすい陸地を探す
  findSpawn(gen) {
    let fallback = null;
    for (let r = 0; r < 140; r++) for (let k = 0; k < Math.max(1, r * 6); k++) {
      const a = k / Math.max(1, r * 6) * Math.PI * 2, x = Math.round(Math.cos(a) * r * 12), z = Math.round(Math.sin(a) * r * 12);
      const h = gen.column(x, z), b = gen.colB;
      if (!(h >= SEA + 2 && h < 76 && (b === BIOME.PLAINS || b === BIOME.FOREST || b === BIOME.FLOWER || b === BIOME.CHERRY || b === BIOME.BIRCH || b === BIOME.MEADOW))) continue;
      if (!fallback) fallback = { x: x + 0.5, y: h + 1.01, z: z + 0.5 };
      let lo = h, hi = h;
      for (let dz = -12; dz <= 12; dz += 4) for (let dx = -12; dx <= 12; dx += 4) { const hh = gen.column(x + dx, z + dz); if (hh < lo) lo = hh; if (hh > hi) hi = hh; }
      if (hi - lo <= 7 && lo >= SEA) return { x: x + 0.5, y: h + 1.01, z: z + 0.5 };
    }
    return fallback || { x: 0.5, y: gen.column(0, 0) + 1.01, z: 0.5 };
  },
  disposeWorld() {
    if (this.world) { this.world.dispose(); this.world = null; }
    stopGenWorkers(); _activeWorld = null; ents = []; PT.n = 0; this.boss = null; this.limbo = [[], [], []]; this.arrive = null; ui.gateFx(0);
    ui.dark(false); ui.fade(false);
  },
  showTitle() {
    if (ui.screen) ui.close(true);
    if (net.on) net.leave();
    map.reset(); $('mini').hidden = true;
    this.online = false; this.inBed = false; ui.sleepHud(false);
    this.disposeWorld();
    const w = this.world = new World(20261118); _activeWorld = w; w.onUnload = freeChunkMeshes; w.time = 2600; w.setGen(GEN_CUR, null);
    startGenWorkers(w.seed);
    this.isDemo = true; this.state = 'title'; this.titlePos = this.findSpawn(w.gen);
    this.titlePos.y += 10;
    $('hud').classList.add('off'); $('app').classList.remove('playing');
    if (document.pointerLockElement) { ui.expectUnlock = true; document.exitPointerLock(); }
    ui.showMenu('mTitle', false);
  },
  async openWorldList() { const list = await storage.list(); ui.renderWorlds(list, storage.ok); ui.showMenu('mWorlds', true, true); },
  startNew(name, seedStr, mode, diff, online, rules) {
    audio.unlock();
    const seed = (seedStr || '').trim() ? strSeed(seedStr) : ((Math.random() * 4294967296) | 0);
    const nm = (name || '').trim() || 'ななしの大地', r = Object.assign(this.defaultRules(diff), rules || {});
    if (online) { this.createOnline({ name: nm, seed, mode, diff, rules: r }); return; }
    this.beginWorld({ id: 'w' + Date.now().toString(36), name: nm, seed, mode, diff, day: 1, time: 600, tick: 0, player: null, ach: {}, ended: false, rules: r, gv0: GEN_CUR, rgv: {} }, new Map());
  },
  // みんなの世界：中継サーバーに世界を作って、そのまま入る
  async createOnline(info) {
    ui.busy('みんなの世界をつくっています');
    try { const code = await net.create(info); await this.joinOnline(code, true); } catch (e) { ui.netError(e); }
  },
  async joinOnline(code, fresh) {
    audio.unlock(); ui.busy('世界に入っています');
    try {
      const r = await net.join(code), m = r.meta, pd = net.loadPlayer(r.code) || {};
      net.enter(r.code, m, r.time);
      this.isFreshOnline = !!fresh;
      this.beginWorld({ id: m.id || ('o' + r.code), name: m.name, seed: m.seed, mode: m.mode, diff: m.diff, day: 1, time: 600, tick: 0, dim: pd.dim | 0, sora: m.sora, player: pd.player || null, ach: pd.ach || {}, ended: !!pd.ended, rules: m.rules, gv0: m.gv0 || 1, online: true, map: pd.map }, new Map());
    } catch (e) { console.error(e); net.leave(true); ui.netError(e); }
  },
  async loadWorld(id) {
    audio.unlock();
    const data = await storage.load(id);
    if (!data) { ui.toast('この世界を読みこめませんでした'); return; }
    this.beginWorld(data.meta, data.chunks);
  },
  beginWorld(meta, chunks) {
    this.disposeWorld();
    WX.reset();
    const w = this.world = new World(meta.seed, chunks); _activeWorld = w; w.onUnload = freeChunkMeshes; w.onMark = (x, y, z, o) => { spawnSato(x, y, z, o); };
    w.setGen(meta.gv0 || 1, meta.rgv ? new Map(Object.entries(meta.rgv)) : null);
    w.day = meta.day || 1; w.time = meta.time || 0; w.tick = meta.tick || 0;
    this.online = !!meta.online; this.inBed = false; this.sessionT = 0; this.bossLost = 0;
    if (this.online) { w.net = net; net.world = w; net.own = !!(net.known().find(o => o.code === net.code) || {}).own; }
    this.rules = Object.assign(this.defaultRules(meta.diff), meta.rules || {});
    if (this.online) net.applyTime();
    if (!this.online) { this.gates = new Map(); if (Array.isArray(meta.gates)) for (const g of meta.gates) this.gateIn(g && g.id, g); }
    this.soraDone = !!meta.sora; this.soraT = 0;
    restoreMobs(w, meta.mobs);
    if ((meta.dim | 0) && !(meta.player && meta.player.dead)) w.switchDim(meta.dim | 0);   // べつの世界でやめたときは、そこから（力つきていたら もとの世界から）
    map.load(meta.map);
    startGenWorkers(w.seed);
    this.worldId = meta.id; this.name = meta.name; this.diff = meta.diff; this.ach = meta.ach || {}; this.ended = !!meta.ended; this.isDemo = false;
    player.reset(); player.mode = meta.mode;
    this.worldSpawn = this.findSpawn(w.genOf(w.gv0, 0));
    this.isNew = !meta.player;
    if (meta.player) { player.load(meta.player); if (meta.player.dead) { player.respawn(); } else this.needSafeSpot = 0; }
    else { player.x = this.worldSpawn.x; player.y = this.worldSpawn.y; player.z = this.worldSpawn.z; this.needSafeSpot = 1; }
    player.gateWait = true;   // 門の中でやめていたら、一度出るまで移らない
    this.state = 'loading'; this.loadT = 0; this.acc = 0; this.saveT = 0; this.camKick = 0; this.shake = 0;
    $('loadTitle').textContent = this.online ? '世界に入っています' : this.isNew ? '世界をつくっています' : '世界を読みこんでいます'; $('loadFill').style.width = '0%';
    $('loadNote').textContent = 'はじめての場所は少し時間がかかります';
    ui.showMenu('mLoading', true); $('hud').classList.add('off');
  },
  enterPlay() {
    const tr = this.arrive; this.arrive = null;   // べつの世界へ移ってきたところか
    this.state = 'playing'; ui.hideMenu(); $('hud').classList.remove('off'); $('app').classList.add('playing');
    player.invDirty = true; ui.hp = ui.food = ui.air = ui.armor = ui.sel = -99; this.last = performance.now();
    ui.dayBanner(tr || this.world.dim ? DIM_NAMES[this.world.dim] : this.world.day + '日目');
    if (tr) this.onArrive(tr);
    if (this.isNew) {
      const tips = player.mode === 0 ? ['ようこそ！ まずは木をなぐって原木を集めよう', '次の目標は「開拓ノート」で見られます'] : ['クリエイティブへようこそ。持ち物を開くと全部のブロックを選べます'];
      tips.push(touchSt.touchUsed ? '左下で歩く・画面をなぞって見回す・長押しでこわす・タップで置く' : '操作に迷ったら Esc を押して「遊び方」を見てください');
      tips.forEach((t, i) => setTimeout(() => { if (this.state === 'playing') ui.toast(t, 5.5); }, 1200 + i * 6000));
    }
    if (!touchSt.touchUsed) { requestLock(false); setTimeout(() => { if (!pointerLocked && this.state === 'playing' && !ui._edgeOn) ui.hint('画面をクリックすると、マウスで見回せるようになります'); }, 600); }
    if (this.online) {   // ゲーム一覧の「みんなの部屋」から来た人には、この世界のコードを知らせる
      try { if (window.NetDB && NetDB.hub && NetDB.hub.isHost) NetDB.hub.report('block', net.code); } catch (e) { }
    }
    if (this.online) ui.netHud();
    if (this.online && !tr) { setTimeout(() => { if (this.state === 'playing' && net.on) ui.toast(this.isFreshOnline ? '世界のコードは「' + net.code + '」。メニューから招待リンクを送れます' : '「' + this.name + '」に入りました（コード ' + net.code + '）', 7); }, 800); }
    this.save();
  },
  // 安全に立てる場所へ。mode 1: 地面の上（木の上は避ける） 2: 今の場所で、埋まっていたら上へ
  placeSafe(mode) {
    const w = this.world, x0 = Math.floor(player.x), z0 = Math.floor(player.z);
    if (!w.isLoaded(x0, z0)) return false;
    if (mode === 1) {
      let best = null;
      const ord = spiralOrder(7);
      for (let n = 0; n < ord.length && !best; n += 2) {
        const x = x0 + ord[n], z = z0 + ord[n + 1];
        if (!w.isLoaded(x, z)) continue;
        const c = w.getChunk(x >> 4, z >> 4);
        for (let y = Math.min(CH - 3, c.maxY + 1); y > 1; y--) {
          const id = w.getBlock(x, y, z);
          if (!id || SHAPE[id] === S_CROSS || id === B.snow_layer || ISLEAF[id] || id === B.vine) continue;   // 葉は地面に数えない（森では木の下に立つ）
          if (OPAQUE[id] && !ISLOG[id] && !SOLID[w.getBlock(x, y + 1, z)] && !SOLID[w.getBlock(x, y + 2, z)] && !FLUID[w.getBlock(x, y + 1, z)]) best = [x, y, z];
          break;
        }
      }
      if (best) { player.x = best[0] + 0.5; player.y = best[1] + 1.01; player.z = best[2] + 0.5; }
      else { let y = w.surfaceY(x0, z0); if (y < 0) y = 70; player.y = y + 1.01; }
    }
    for (let k = 0; k < 40; k++) { _cb.length = 0; w.collectBoxes(player.x - 0.3, player.y, player.z - 0.3, player.x + 0.3, player.y + 1.8, player.z + 0.3, _cb); let hit = false; for (let i = 0; i < _cb.length; i += 6) if (_cb[i + 4] > player.y + 0.001 && _cb[i + 1] < player.y + 1.8) hit = true; if (!hit) break; player.y = Math.floor(player.y) + 1.01; }
    player.vx = player.vy = player.vz = 0; player.fallDist = 0;
    return true;
  },
  pause(keepOpen) {
    if (this.state !== 'playing') return;
    this.state = 'paused'; this.pausedAt = performance.now();
    if (document.pointerLockElement) { ui.expectUnlock = true; document.exitPointerLock(); }
    if (ui.screen) ui.close(true);
    $('app').classList.remove('playing'); ui.hint('');
    $('saveNote').textContent = '';
    this.save().then(() => { $('saveNote').textContent = this.online ? '世界は中継サーバーに、持ち物はこの端末に保存されています。メニューを開いている間も世界は動いています' : storage.ok ? 'ここまでをセーブしました' : 'この環境ではブラウザに保存できません。タイトルの「つづきから」で書き出せます'; });
    $('bQuit').textContent = this.online ? 'この世界から出る' : 'セーブしてタイトルへ'; ui.paintNetBox();
    ui.showMenu('mPause', true);
  },
  resume(noLock) {
    if (this.state !== 'paused') return;
    this.state = 'playing'; ui.hideMenu(); $('app').classList.add('playing'); this.last = performance.now(); this.acc = 0;
    if (!noLock) requestLock(true);
  },
  async quitToTitle() { await this.save(); this.showTitle(); },
  respawn() {
    if (this.world.dim !== 0) {   // べつの世界で力つきた → もとの世界の復活地点へ
      this.state = 'playing'; ui.hideMenu(); $('app').classList.add('playing'); ui.hp = ui.food = ui.air = -99; requestLock(true);
      this.travel(0, 'home'); return;
    }
    player.respawn(); this.state = 'playing'; ui.hideMenu(); $('app').classList.add('playing'); ui.hp = ui.food = ui.air = -99; requestLock(true);
  },
  save() {
    if (!this.world || this.isDemo || this.state === 'loading') return Promise.resolve();
    if (this.online) { net.savePlayer(); return Promise.resolve(); }
    const w = this.world; w.flushAll();
    const meta = { id: this.worldId, name: this.name, seed: w.seed, mode: player.mode, diff: this.diff, day: w.day, time: w.time, tick: w.tick, player: JSON.parse(JSON.stringify(player.serialize())), ach: Object.assign({}, this.ach), ended: this.ended, savedAt: Date.now(), ver: 2,
      rules: Object.assign({}, this.rules), gv0: w.gv0, mobs: collectMobs(w), map: map.save(true), dim: w.dim, gates: [...this.gates.values()], sora: this.soraDone ? 1 : 0 };
    if (w.rgv) meta.rgv = Object.fromEntries(w.rgv);
    const entries = []; for (const k of w.savedDirty) entries.push([k, w.saved.get(k)]); w.savedDirty.clear();
    this.saveChain = this.saveChain.then(() => storage.save(meta, entries)).catch((e) => { for (const [k] of entries) w.savedDirty.add(k); if (!this.saveWarned) { this.saveWarned = true; ui.toast('セーブに失敗しました。ブラウザの空き容量が足りないのかもしれません', 6); } });
    return this.saveChain;
  },
  async deleteWorld(id) { await storage.remove(id); this.openWorldListRefresh(); },
  async openWorldListRefresh() { const list = await storage.list(); ui.renderWorlds(list, storage.ok); },
  async exportWorld(id) {
    const data = await storage.load(id);
    if (!data) { ui.toast('書き出す世界が見つかりませんでした'); return; }
    const out = { format: 'kakukaku-save', ver: 1, meta: data.meta, chunks: [] };
    for (const [k, v] of data.chunks) out.chunks.push(v.b2 ? [k, b64(v.b2), b64(v.m), v.e || [], 2] : [k, b64(v.b), b64(v.m), v.e || []]);   // 5つ目の 2 ＝ ブロックの番号が16ビット
    const text = JSON.stringify(out), fname = 'block_' + String(data.meta.name || 'world').replace(/[\\/:*?"<>|\s]/g, '_') + '.json';
    try {
      if (window.claude && typeof window.claude.use === 'function') {
        const dl = await window.claude.use('downloads');
        if (!dl) { ui.toast('この画面ではファイルに書き出せません'); return; }
        await dl.save({ filename: fname, data: text });
      } else {
        const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([text], { type: 'application/json' })); a.download = fname; document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 2000);
      }
      ui.toast('ファイルに書き出しました');
    } catch (e) { if (!(e && e.code === 'declined')) ui.toast('書き出せませんでした'); }
  },
  importFile(file) {
    const fr = new FileReader();
    fr.onload = async () => {
      try {
        const o = JSON.parse(fr.result);
        if (!o || o.format !== 'kakukaku-save' || !o.meta || !Array.isArray(o.chunks)) throw new Error('形式がちがいます');
        const meta = Object.assign({}, o.meta, { id: 'w' + Date.now().toString(36), savedAt: Date.now() });
        const entries = o.chunks.map(([k, b, m, e, f]) => [k, f === 2 ? { b2: unb64(b), m: unb64(m), e: e || [] } : { b: unb64(b), m: unb64(m), e: e || [] }]);
        await storage.save(meta, entries);
        ui.toast('「' + meta.name + '」を読みこみました'); this.openWorldListRefresh();
      } catch (e) { ui.toast('このファイルは読みこめませんでした'); }
    };
    fr.onerror = () => ui.toast('このファイルは読みこめませんでした');
    fr.readAsText(file);
  },

  // ---------- 目標（開拓ノート） ----------
  unlock(id) {
    if (this.ach[id] || this.isDemo || player.mode === 1) return;
    this.ach[id] = 1;
    const a = ACHS.find(o => o.id === id); if (a) ui.achievement(a.title, a.icon);
  },
  onInventory() { for (const s of player.inv) if (s && ACH_ITEM[s.id]) this.unlock(ACH_ITEM[s.id]); },
  onCraft(r) { player.stats.crafted++; if (ACH_CRAFT[r.out]) this.unlock(ACH_CRAFT[r.out]); },
  onStat(kind, id) {
    if (kind === 'eat') { if (id === I.cooked_pork || id === I.steak || id === I.cooked_mutton || id === I.cooked_chicken) this.unlock('food'); }
    else if (kind === 'sleep') this.unlock('bed');
    else if (kind === 'till') this.unlock('farm');
    else if (kind === 'armor') { if (player.armor.some(a => a)) this.unlock('armor'); }
    else if (kind === 'kill') { if (id === 'shade') this.unlock('shade'); else if (id === 'king') this.unlock('king'); else if (id === 'hoshikui') this.unlock('hoshikui'); }
    else if (kind === 'loot') this.unlock('loot');
    else if (kind === 'arrow') { if (id >= 20) this.unlock('snipe'); }
    else if (kind === 'block') this.unlock('shield');
    else if (kind === 'prime') this.unlock('boom');
    else if (kind === 'ench') this.unlock('ench');
    else if (kind === 'potion') this.unlock('potion');
    else if (kind === 'trade') this.unlock('trade');
    else if (kind === 'ride') { if (id !== 'horse') this.unlock(id); }
    else if (kind === 'tame') this.unlock('horse');
    else if (kind === 'glide') this.unlock('glide');
    else if (kind === 'place' && id === B.torch) this.unlock('torch');
  },
  // みんなの世界では、全員がベッドに入るまで横になって待つ
  sleep(t) {
    if (this.sleeping || this.inBed) return;
    if (player.ride) player.dismount();
    if (this.online) {
      const w = this.world, d = F4[t.meta & 3], hx = (t.meta & 4) ? t.x - d[0] : t.x, hz = (t.meta & 4) ? t.z - d[1] : t.z;
      player.x = hx + 0.5 + d[0] * 0.5; player.z = hz + 0.5 + d[1] * 0.5; player.y = t.y + 0.5725; player.vx = player.vy = player.vz = 0; player.yaw = Math.atan2(d[0], d[1]); if (player.yaw < 0) player.yaw += Math.PI * 2;
      this.inBed = true; ui.fade(true); sfx('sleep'); ui.sleepHud(true);
      return;
    }
    this.sleeping = true; ui.fade(true); sfx('sleep');
    setTimeout(() => {
      const w = this.world; if (!w || this.isDemo) { this.sleeping = false; ui.fade(false); return; }
      w.time = 0; w.day++; player.hp = Math.min(20, player.hp + 4);
      for (const e of ents) if (e.kind === 'mob' && MOBS[e.type].hostile && !MOBS[e.type].boss) e.dead = true;
      ui.fade(false); this.sleeping = false; ui.dayBanner(w.day + '日目'); sfx('dawn'); this.onStat('sleep', 0); this.save();
    }, 1500);
  },
  wake() { if (!this.inBed) return; this.inBed = false; ui.fade(false); ui.sleepHud(false); },
  // 朝になった（みんなの世界で、全員が眠ったとき）
  onMorning(day) {
    const was = this.inBed; this.wake();
    for (const e of ents) if (!e.remote && e.kind === 'mob' && MOBS[e.type].hostile && !MOBS[e.type].boss) { e.dead = true; e.noCredit = true; }
    if (was) { player.hp = Math.min(20, player.hp + 4); this.onStat('sleep', 0); }
    ui.dayBanner((day || this.world.day) + '日目'); sfx('dawn');
  },
  summonBoss(x, y, z) {
    if (this.boss && !this.boss.dead) { ui.toast('カゲの王はもう目を覚ましている'); return; }
    if (this.diff === 0) { ui.toast('「のんびり」ではカゲの王は現れません'); return; }
    const w = this.world;
    let sx = x + 0.5, sz = z + 0.5, sy = null;
    for (let t = 0; t < 12 && sy === null; t++) { const a = Math.random() * 6.28; sx = x + 0.5 + Math.cos(a) * 4; sz = z + 0.5 + Math.sin(a) * 4; sy = findFloor(w, Math.floor(sx), y + 5, Math.floor(sz)); }
    if (sy === null) { sx = x + 0.5; sz = z + 0.5; sy = y + 1; }
    ui.flash(); ui.dark(true); sfx('summon'); this.shake = 0.7;
    for (let i = 0; i < 80; i++) fxPuff(x + 0.5, y + 1 + Math.random() * 5, z + 0.5, 1, 0.5, 0.3, 0.95, { glow: true, speed: 3, life: 1.4, size: 0.12, spread: 1.5 });
    this.boss = spawnMob('king', sx, sy, sz); this.bossLost = 0;
    ui.toast('カゲの王が 目を覚ました…', 4);
    if (player.mode === 1) ui.toast('クリエイティブでは、カゲの王はおそってきません', 5);
  },
  bossDefeated(type) {
    this.boss = null; ui.dark(false); ui.flash(); sfx('victory'); this.shake = 0.4;
    if (type === 'hoshikui') {   // さいごのボス。ここで「おわりの画面」
      this.unlock('hoshikui');
      if (!this.soraDone) { this.soraDone = true; if (this.online) net.setMeta({ sora: 1 }); }
      this.ended = true; this.endT = 7;
      ui.toast('ホシクイを たおした！ まんなかの台に かえりの門が ひらいた', 8);
    } else ui.toast('カゲの王を たおした！ 王冠を落としていった', 6);
    this.save();
  },
  // ---------- べつの世界（ホムラの底・ソラのはて） ----------
  gateIn(id, v) {   // 門の一覧に入れる（保存されていた物・ほかの人から届いた物。形を確かめる）
    if (typeof id !== 'string' || id.length > 48 || !v) return;
    const d = v.d | 0, x = Math.round(+v.x), y = Math.round(+v.y), z = Math.round(+v.z);
    if (!(d === 0 || d === 1) || !(Math.abs(x) < 3e7) || !(Math.abs(z) < 3e7) || !(y >= 1 && y < CH)) return;
    this.gates.set(id, { id, d, x, y, z });
  },
  gateAdd(d, x, y, z) {
    const id = d + '_' + x + '_' + y + '_' + z; if (this.gates.has(id)) return;
    const rec = { id, d, x, y, z }; this.gates.set(id, rec);
    if (this.gates.size > 80) this.gateDel(this.gates.keys().next().value);
    if (this.online) net.gateSet(rec);
  },
  gateDel(id) { if (this.gates.delete(id) && this.online) net.gateDel(id); },
  findGate(d, x, z, r) { let best = null, bd = r * r; for (const g of this.gates.values()) { if (g.d !== d) continue; const dd = (g.x - x) * (g.x - x) + (g.z - z) * (g.z - z); if (dd <= bd) { bd = dd; best = g; } } return best; },
  // いまの世界を出る前に、自分が動かしている物を片づける（動物はしまう・落とし物とボスは その世界に置いておく・敵は消す）
  leaveDim() {
    const w = this.world, keep = [];
    if (net.on) net.flush();
    for (const e of ents) {
      if (e.dead || e.remote) continue;
      if (net.on && e._ns) net.rmQ.push(e.nid);
      if (e.kind === 'mob') {
        if (net.on) { const p = net.nearPeer(e.x, e.z); if (p && (net._npd < 72 || e.type === 'hoshikui')) { netGive(e, p.pid); continue; } }   // ソラのはてのボスは、同じ世界に人がいれば 遠くてもまかせる
        if (MOBS[e.type].boss) { if (e.hp > 0) keep.push(e); }
        else if (keepsMob(e)) stashMob(w, e);
      } else if (e.kind === 'item') keep.push(e);
    }
    if (net.on) for (const p of net.peers.values()) p.ents.clear();
    for (const e of keep) e._ns = '';
    this.limbo[w.dim] = keep; ents = []; PT.n = 0; this.boss = null; this.bossLost = 0; ui.dark(false);
  },
  // べつの世界へ移る。how：'gate'＝ホムラの門をくぐる、'sora'＝ソラの門にとびこむ、'home'＝もとの世界の復活地点へ（かえりの門・力つきたとき）
  travel(dim, how) {
    if (player.ride) player.dismount();
    const w = this.world; if (!w || this.isDemo || (this.state !== 'playing' && this.state !== 'paused') || this.arrive) return;
    if (this.state === 'paused') this.resume(true);
    if (ui.screen) ui.close(true);
    if (this.inBed) this.wake();
    const from = w.dim, arr = { kind: how, from, done: false };
    let px = player.x, py = player.y, pz = player.z;
    if (how === 'gate') {
      const fx = Math.floor(player.x), fz = Math.floor(player.z);
      const o = gateOrigin(w, fx, Math.floor(player.y + 0.1), fz) || gateOrigin(w, fx, Math.floor(player.y + 1), fz);
      if (o) this.gateAdd(from, o.x, o.y, o.z);   // 帰りに ここへ出てこられるように
      const s = dim === 1 ? 1 / HOMURA_SCALE : HOMURA_SCALE, tx = Math.floor(player.x * s), tz = Math.floor(player.z * s);
      const g = this.findGate(dim, tx, tz, dim === 1 ? 26 : 150);
      arr.g = g; arr.tx = g ? g.x : tx; arr.tz = g ? g.z : tz; arr.ty = g ? g.y : clamp(Math.floor(player.y), 40, 100);
      px = arr.tx + 0.5; py = arr.ty; pz = arr.tz + 0.5;
    }
    sfx('warp'); ui.flash(); this.isNew = false;
    if (!player.dead) this.save();   // 読みこみ中にやめても、ここまでの変更が残るように
    this.leaveDim();
    w.switchDim(dim);
    ents = this.limbo[dim]; this.limbo[dim] = [];
    for (const e of ents) if (e.kind === 'mob' && MOBS[e.type].boss) bossSeen(e);
    this.needSafeSpot = 0;
    if (how === 'sora') { px = SORA_ARRIVE[0] + 0.5; pz = SORA_ARRIVE[1] + 0.5; py = 72; player.yaw = Math.PI / 2; player.pitch = 0; this.needSafeSpot = 1; }
    else if (how === 'home') {
      if (player.dead) player.respawn();
      else { const sp = player.spawn || this.worldSpawn; player.x = sp.x; player.y = sp.y; player.z = sp.z; this.needSafeSpot = player.spawn ? 2 : 1; }
      px = player.x; py = player.y; pz = player.z; arr.bed = !!player.spawn;
    }
    player.x = px; player.y = py; player.z = pz; player.vx = player.vy = player.vz = 0; player.fallDist = 0; player.gateT = 0; player.gateWait = true; player.brk = null; player.burnT = 0; player.flying = player.mode === 1;
    this.arrive = arr; this.soraT = 0;
    this.state = 'loading'; this.loadT = 0; this.acc = 0;
    $('loadTitle').textContent = DIM_NAMES[dim] + ' へ…'; $('loadFill').style.width = '0%'; $('loadNote').textContent = 'はじめての場所は少し時間がかかります';
    ui.showMenu('mLoading', true); $('hud').classList.add('off'); ui.gateFx(0);
  },
  // 着いた先の読みこみが終わった。false を返すと、もう少し読みこみを続ける
  finishArrive() {
    const a = this.arrive, w = this.world; a.done = true;
    if (a.kind === 'gate') {
      let g = a.g;
      if (g && w.getBlock(g.x, g.y, g.z) !== B.homura_gate) { this.gateDel(g.id); g = null; }   // 前にあった門が こわされていた
      if (!g) { g = buildGate(w, a.tx, a.ty, a.tz); this.gateAdd(w.dim, g.x, g.y, g.z); }
      const ax = w.getMeta(g.x, g.y, g.z) & 1;
      player.x = g.x + 0.5; player.z = g.z + 0.5; player.y = g.y + 0.01;   // マスのまんなかに立つ（マスのさかい目ちょうどに立つと、面のすき間が線に見える） player.yaw = ax ? Math.PI / 2 : 0; player.pitch = 0;
      player.vx = player.vy = player.vz = 0; player.gateWait = true;
    } else if (a.kind === 'home' && a.bed && player.spawn) {
      const sp = player.spawn;
      if (w.isLoaded(Math.floor(sp.x), Math.floor(sp.z)) && w.getBlock(Math.floor(sp.x), Math.floor(sp.y - 0.6), Math.floor(sp.z)) !== B.bed) {
        player.spawn = null; a.bed = false; a.done = false; ui.toast('ベッドがなくなったので最初の場所にもどります');
        player.x = this.worldSpawn.x; player.y = this.worldSpawn.y; player.z = this.worldSpawn.z; this.needSafeSpot = 1; this.loadT = 0;
        return false;
      }
    }
    return true;
  },
  onArrive(a) {
    const d = this.world.dim;
    if (d === 1) { this.unlock('homura'); if (!this.ach.rod && player.mode === 0) setTimeout(() => { if (this.state === 'playing' && this.world.dim === 1) ui.toast('ここは ホムラの底。溶岩に気をつけて。やけレンガの「とりで」を探そう（方向は 開拓ノートに出ます）', 8); }, 2500); }
    else if (d === 2 && !this.soraDone && this.diff > 0) setTimeout(() => { if (this.state === 'playing' && this.world.dim === 2) ui.toast('ここは ソラのはて。柱の上の結晶をこわしてから、ホシクイに いどもう', 8); }, 2500);
  },
  // ソラの門のわくを置いたとき：輪ができていたら 門をひらく
  checkSoraRing(x, y, z) {
    const w = this.world;
    if (w.dim !== 0) { ui.toast('ソラの門は、もとの世界でしか ひらかない', 5); return; }
    const c = soraRingAt(w, x, y, z); if (!c) return;
    for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) w.setBlock(c[0] + dx, y, c[1] + dz, B.sora_gate, 2, 1);
    sfx('ignite'); sfx('treasure'); ui.flash(); this.shake = Math.max(this.shake, 0.4);
    for (let i = 0; i < 70; i++) { const a = Math.random() * 6.283, r = Math.random() * 2.4; fxPuff(c[0] + 0.5 + Math.cos(a) * r, y + 0.8 + Math.random() * 3, c[1] + 0.5 + Math.sin(a) * r, 1, 0.6, 0.85, 1, { glow: true, speed: 1.5, life: 1.3, size: 0.1, up: 1.6, grav: 0 }); }
    this.unlock('ring');
    ui.toast('ソラの門が ひらいた！ とびこむと「ソラのはて」へ。帰り道は、ボスをたおすと ひらく', 9);
  },
  // その村のある区画が、村のある版（3より後）の地形か。昔の版で作った区画には 村はない
  vilOK(V) {
    const w = this.world; let gv;
    if (w.net) gv = w.gv0 >= 3 ? 3 : w.isLoaded(V.x, V.z) ? w.genVer(V.x >> 4, V.z >> 4) : 0;
    else if (!w.rgv) gv = w.gv0;
    else gv = w.rgv.get(w.pre + (V.x >> 6) + ',' + (V.z >> 6)) || GEN_CUR;
    return gv >= 3;
  },
  // いちばん近い村（まだ行っていない所も ふくむ）
  villageNear(x, z) {
    const w = this.world; if (!w || w.dim) return null;
    const g = w.genOf(3, 0), vx = Math.floor(x / VIL_CELL), vz = Math.floor(z / VIL_CELL); let best = null, bd = 1e18;
    for (let dz = -2; dz <= 2; dz++) for (let dx = -2; dx <= 2; dx++) {   // 昔の世界では 近くの村が「ない」ことがあるので、その先の村も さがす
      const V = g.village(vx + dx, vz + dz); if (!V || !this.vilOK(V)) continue;
      const d = (V.x - x) * (V.x - x) + (V.z - z) * (V.z - z); if (d < bd) { bd = d; best = V; }
    }
    return best;
  },
  // べつの世界にいる間、1秒ごとに
  dimTick() {
    const w = this.world;
    if (w.dim === 1) { if (!this.ach.fort && w.getBlock(Math.floor(player.x), Math.floor(player.y - 0.5), Math.floor(player.z)) === B.yake_bricks) this.unlock('fort'); return; }
    if (w.dim !== 2 || player.dead || ++this.soraT < 4) return;
    const first = !net.on || net.isFirstInDim();
    if (this.soraDone || this.diff === 0) {   // ボスがいない（たおした後・「のんびり」）ときは、かえりの門を出しておく
      if (first && w.isLoaded(0, 0) && w.isLoaded(-3, -3) && w.getBlock(1, SORA_PED_Y + 1, 0) !== B.sora_gate) {   // たおした人が遠くにいて 置けなかったときも、だれかが近づけば ここで置かれる
        for (const [dx, dz] of soraGateCells()) w.setBlock(dx, SORA_PED_Y + 1, dz, B.sora_gate, 2, 1);
        if (this.soraDone && !w.getBlock(0, SORA_PED_Y + 5, 0)) w.setBlock(0, SORA_PED_Y + 5, 0, B.hoshi_egg, 0);
      }
      return;
    }
    let mine = null, other = null;
    for (const e of ents) if (e.kind === 'mob' && e.type === 'hoshikui' && !e.dead) { if (e.remote) other = e; else mine = e; }
    if (mine && other && other.owner < net.pid) { mine.dead = true; mine.noCredit = true; mine = null; }   // 2体になってしまったら ゆずる
    const b = mine || other;
    if (b) { if (this.boss !== b && b.hp > 0) bossSeen(b); return; }
    if (!first) return;
    const e = spawnMob('hoshikui', 0.5, 90, 34.5); bossSeen(e);
    sfx('roar'); ui.toast('ソラのヌシ「ホシクイ」が あらわれた！', 6);
  },
  showEnding() {
    if (this.state !== 'playing') return;
    this.state = 'paused'; this.pausedAt = performance.now();
    if (document.pointerLockElement) { ui.expectUnlock = true; document.exitPointerLock(); }
    if (ui.screen) ui.close(true);
    $('app').classList.remove('playing');
    const s = player.stats, rows = [['すごした日数', this.world.day + '日'], ['こわしたブロック', s.broken + 'こ'], ['置いたブロック', s.placed + 'こ'], ['つくった回数', s.crafted + '回'], ['たおした生き物', s.kills + '体'], ['歩いた距離', Math.round(s.dist) + 'ブロック'], ['力尽きた回数', s.deaths + '回']];
    $('endStats').innerHTML = rows.map(r => '<span>' + r[0] + '</span><span>' + r[1] + '</span>').join('');
    ui.showMenu('mEnd', true);
  },

  // ---------- 1秒に20回の処理 ----------
  tick() {
    const w = this.world;
    w.tick++; this.sessionT++;
    if (!(this.online && net.applyTime())) {   // みんなの世界の時刻は、共通の時計から計算する
      if (this.rules.day) w.time = 6000; else w.time++;
      if (w.time >= 24000) { w.time = 0; w.day++; ui.dayBanner(w.day + '日目'); sfx('dawn'); }
    }
    if (w.time === 11600 && w.day <= 3 && this.diff > 0 && player.mode === 0) ui.toast('日が暮れてきた。夜は敵が出るので、明るい場所へ', 5);
    w.runScheduled();
    w.randomTicks(Math.floor(player.x / 16), Math.floor(player.z / 16));
    w.tickFurnaces();
    tickEntities(w);
    // ボスがたおれたかは、ここ（生き物を動かしたすぐ後）で見る。あとの「ボスがいなければ出す」より先に見ないと、たおした瞬間に 次のボスが出てしまう
    if (this.boss && this.boss.dead) { if (this.boss.hp <= 0) this.bossDefeated(this.boss.type); else { this.boss = null; this.bossLost = 120; } }   // 倒した以外で消えた＝ほかの人の端末に移った
    WX.tick(w);
    if (w.tick % 20 === 0) { spawnCycle(w); if (w.dim) this.dimTick(); else if (!this.ach.village && w.tick % 60 === 0) { const V = this.villageNear(player.x, player.z); if (V && Math.abs(V.x - player.x) < V.rad && Math.abs(V.z - player.z) < V.rad) { this.unlock('village'); ui.toast('村を見つけた！ サトビトに「使う」で 物を こうかんできる', 7); } } if (!this.ach.dog && w.tick % 100 === 0) { const me = meId(); for (const e of ents) if (e.type === 'dog' && e.tamer === me) { this.unlock('dog'); break; } } }
    if (w.tick % 10 === 0) map.mark();
    player.tick(); net.tick();
    if (this.bossLost > 0 && --this.bossLost === 0 && !this.boss) ui.dark(false);
    if (this.inBed && !w.isNight()) this.wake();
    if (++this.saveT >= 400) { this.saveT = 0; this.save(); }
  },
  loop(now) {
    requestAnimationFrame((t) => this.loop(t));
    if (settings.fpsCap && now - this.last < 1000 / settings.fpsCap - 3) return;   // コマ数の上限
    let dt = (now - this.last) / 1000; this.last = now;
    if (!(dt > 0)) dt = 0.016;
    this.frames++; this.fpsT += Math.min(dt, 2);
    // 重いときは自動で軽くする：2秒ごとに様子を見て、画質→見える距離の順に下げる。軽くなったら少しずつもどす
    if (settings.autoQ && this.state === 'playing') {
      this.aqT = (this.aqT || 0) + Math.min(dt, 2); this.aqN = (this.aqN || 0) + 1;
      if (this.aqT >= 2) {
        const fps = this.aqN / this.aqT, lo = settings.fpsCap === 30 ? 20 : 24, hi = settings.fpsCap ? settings.fpsCap * 0.93 : 50; this.aqT = 0; this.aqN = 0;
        const sc = Math.min(this.dynScale, settings.quality), vd0 = Math.min(this.dynDist, settings.viewDist);
        if (fps < lo) { this.aqGood = 0; if (sc > 0.55) this.dynScale = Math.max(0.5, sc - 0.1); else if (vd0 > 4) this.dynDist = vd0 - 1; }
        else if (fps > hi) { if ((this.aqGood = (this.aqGood || 0) + 1) >= 4) { this.aqGood = 0; if (this.dynDist < settings.viewDist) this.dynDist = vd0 + 1; else if (this.dynScale < settings.quality) this.dynScale = Math.min(settings.quality, sc + 0.1); } }
        else this.aqGood = 0;
        R.scale = Math.min(settings.quality, this.dynScale);
      }
    }
    if (dt > 0.1) dt = 0.1;
    if (this.fpsT >= 0.5) { this.fps = Math.round(this.frames / this.fpsT); this.frames = 0; this.fpsT = 0; }
    R.time += dt;
    const w = this.world; if (!w || R.lost) return;
    WX.frame(w, dt);
    const cam = this.cam, vd = Math.min(settings.viewDist, this.dynDist, w.dim === 1 ? 6 : 99);   // ホムラの底は もやで遠くが見えないので、読みこむ広さもしぼる（洞くつだらけで面が多いため）
    if (this.state === 'title') {
      this.titleAng += dt * 0.045; w.time = (w.time + dt * 30) % 24000; if (w.time > 10500) w.time = 500;
      const tp = this.titlePos, tvd = Math.min(vd, 6);
      cam.x = tp.x; cam.z = tp.z; cam.y = tp.y; cam.yaw = this.titleAng; cam.pitch = -0.2 + Math.sin(this.titleAng * 2.3) * 0.04; cam.fov = 70; cam.roll = 0;
      w.stream(cam.x, cam.z, tvd, 5); updateMeshes(w, cam.x, cam.y, cam.z, tvd, 6);
      renderFrame(w, cam, tvd, 0, false);
      return;
    }
    if (this.state === 'loading') {
      this.loadT += dt;
      w.stream(player.x, player.z, vd, 14); updateMeshes(w, player.x, player.y, player.z, vd, 14);
      const pcx = Math.floor(player.x / 16), pcz = Math.floor(player.z / 16);
      let ok = 0; for (let dz = -2; dz <= 2; dz++) for (let dx = -2; dx <= 2; dx++) { const c = w.getChunk(pcx + dx, pcz + dz); if (c && c.meshed) ok++; }
      $('loadFill').style.width = Math.round(ok / 25 * 100) + '%';
      let ready = ok >= 25;
      if ((ready || this.loadT > 25) && this.arrive && !this.arrive.done) ready = this.finishArrive() && ready;   // 門をさがす・つくる
      if (this.needSafeSpot && this.placeSafe(this.needSafeSpot)) this.needSafeSpot = 0;
      cam.x = player.x; cam.y = player.eyeY(); cam.z = player.z; cam.yaw = player.yaw; cam.pitch = player.pitch; cam.fov = settings.fov; cam.roll = 0;
      renderFrame(w, cam, vd, 0, false);
      if ((ready && !this.needSafeSpot) || this.loadT > 25) this.enterPlay();
      return;
    }
    // みんなの世界では、メニューを開いていても世界は止まらない
    const sim = this.state === 'playing' || (this.online && this.state === 'paused');
    if (sim) {
      if (this.state === 'playing') ui.pollInput(dt);
      else { input.fwd = input.strafe = 0; input.jump = input.sneak = input.sprint = input.breakHeld = input.useHeld = input.breakPressed = input.usePressed = false; input.lookDX = input.lookDY = 0; input.tapPending = false; }
      if (this.inBed) {   // ベッドの中：動けない。ジャンプなどで起きる
        if (this.state === 'playing' && (input.jump || input.sneak || input.breakPressed || input.usePressed || input.tapPending)) this.wake();
        input.fwd = input.strafe = 0; input.jump = input.sneak = input.sprint = input.breakHeld = input.useHeld = input.breakPressed = input.usePressed = false; input.tapPending = false;
      }
      if (this.needSafeSpot && this.placeSafe(this.needSafeSpot)) this.needSafeSpot = 0;
      player.update(dt);
      this.acc += dt; let n = 0;
      while (this.acc >= 0.05 && n < 4) { this.tick(); this.acc -= 0.05; n++; }
      if (this.acc > 0.25) this.acc = 0;
      updateParticles(w, dt);
      this.camKick = Math.max(0, this.camKick - dt * 3); this.shake = Math.max(0, this.shake - dt * 0.8);
      if (this.endT > 0) { this.endT -= dt; if (this.endT <= 0) { if (player.dead || this.state !== 'playing' || ui.screen) this.endT = 1; else this.showEnding(); } }   // 力つきている間・画面を開いている間は待つ
      audio.tickMusic(w.dim ? true : w.isNight());
    }
    net.frame(dt);
    w.stream(player.x, player.z, vd, 4);
    updateMeshes(w, player.x, player.y, player.z, vd, 5);
    player.camera(cam);
    { const gk = clamp(player.gateT / 70, 0, 1); if (gk > 0) { cam.fov += gk * 12 + Math.sin(R.time * 11) * 6 * gk; cam.roll = Math.sin(R.time * 7) * 0.07 * gk; } ui.gateFx(gk); }   // 門の中：けしきが ゆらぐ
    const alpha = sim ? this.acc / 0.05 : 1;
    drawEntities(w, cam, alpha);
    if (net.on) drawPeers(w, cam);
    if (player.ride && !player.dead && this.state !== 'loading') drawRide(w, rideCode(player), player.ride.yaw, player.x, player.y, player.z, cam, player.ride.walk, player.ride.walkAmp);   // 自分の乗り物（自分の目線でも 見える）
    if (settings.view && !player.dead && this.state !== 'loading') drawSelf(w, cam);
    WX.draw(w, cam);
    drawParticles(w, cam);
    const t = player.target;
    if (t && this.state === 'playing' && !ui.screen && !player.dead) {
      const b = t.box || selectionBoxes(t.id, t.meta)[0] || BOX_FULL[0], e = 0.004;
      const x0 = t.x + b[0] - e - cam.x, y0 = t.y + b[1] - e - cam.y, z0 = t.z + b[2] - e - cam.z, x1 = t.x + b[3] + e - cam.x, y1 = t.y + b[4] + e - cam.y, z1 = t.z + b[5] + e - cam.z;
      addBoxLines(dynLine, x0, y0, z0, x1, y1, z1, 0, 0, 0, 0.55);
      if (player.brk && player.brk.p > 0) addLayerBox(dynCrack, x0, y0, z0, x1, y1, z1, TEX['crack_' + clamp(Math.floor(player.brk.p * 8), 0, 7)], 1, 1, 1, 1);
    }
    if (settings.handShow && !settings.view) player.drawHand(w);
    const skip = R.skip; if (map.open) R.skip = true;   // 大きな地図を開いている間は 3Dの絵を描かない（軽くするため）
    renderFrame(w, cam, vd, player.headIn, !player.dead && !this.inBed);
    R.skip = skip;
    ui.updateHud(dt);
    if (net.on) updTags(cam);
    signs.draw(cam);
    map.work(map.open ? 7 : 1.5);
    if (map.open) map.drawFull(); else if (map.frame % 3 === 0) map.drawMini();
  }
};
function onContextLost() { game.save(); ui.error('3D表示が止まってしまいました。ページを読みこみ直すと、セーブしたところから続けられます。'); }

// 開いたままページが更新されたときに、同じ世界へもどれるようにする
function startApp(data) {
  if (data && data.resume) game.resumeId = data.resume;
  game.boot();
}
try { if (window.claude && window.claude.hot && window.claude.hot.snapshot) window.claude.hot.snapshot(() => { if (game.world && !game.isDemo) { game.save(); return { resume: game.online ? '@' + net.code : game.worldId }; } return {}; }); } catch (e) { }
window.__kk = { get selfPose() { return _self; }, tradesOf, VJOBS, spawnSato, VIL_CELL, lotXZ, walkPath, F4, rideCode, rideRec, RAIL_CON, mkMob, WX, weatherAt, WX_SLOT, mobEx, hurtMob, mobUse, POTIONS, itemDmg, enchOf, enchSet, enchAny, enchList, enchRoll, enchKind, ENCH, ENCH_NEED, xpNeed, spawnXp, holdKind, spawnShot, spawnPrimed, blast, blastAll, losTo, get MOB_USED() { return MOB_USED; }, mobUse, applyMobUse, passiveLife, setBaby, meId, CULL, get VIS_VER() { return VIS_VER; }, DIM_NAMES, tryLightGate, buildGate, soraPillars, fortInfo, nearestFort, NET_VER, H_LAVA, SORA_PED_Y, game, get world() { return game.world; }, player, settings, ui, R, storage, get ents() { return ents; }, spawnMob, spawnDrop, BLOCKS, ITEMS, B, I, RECIPES, TEX, audio, input, matchGrid, MOBS, meshSection, touchSt, hurtMob, selectionBoxes, genWorkers, updateMeshes, net, spawnCycle, MODELS, keepsMob, map, ICON_URL, blockDrops, GENS, GEN_CUR, BIOME, BIOME_NAMES, collisionBoxes };
if (window.claude && window.claude.hot && window.claude.hot.ready) window.claude.hot.ready(startApp); else startApp((window.claude && window.claude.hot && window.claude.hot.data) || {});
