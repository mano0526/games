// ===== 10_ui.js : 画面表示（体力・持ち物・メニュー）と入力（キーボード・マウス・タッチ） =====
const $ = (id) => document.getElementById(id);
// 設定（この端末のブラウザに保存する）。初期の値は SET_DEF、キーの初期の割り当ては KEY_DEF
const KEY_DEF = { fwd: 'KeyW', back: 'KeyS', left: 'KeyA', right: 'KeyD', jump: 'Space', sneak: 'ShiftLeft', sprint: 'KeyF', inv: 'KeyE', drop: 'KeyQ', view: 'F5', map: 'KeyM', info: 'KeyB',
  hot1: 'Digit1', hot2: 'Digit2', hot3: 'Digit3', hot4: 'Digit4', hot5: 'Digit5', hot6: 'Digit6', hot7: 'Digit7', hot8: 'Digit8', hot9: 'Digit9' };
const KEY_ACTS = [['fwd', '前へ進む'], ['back', '後ろへ下がる'], ['left', '左へ'], ['right', '右へ'], ['jump', 'ジャンプ（2回で飛ぶ／おりる）'], ['sneak', 'しゃがむ（飛んでいるときは下がる）'], ['sprint', '走る'], ['inv', '持ち物をひらく'], ['drop', '持っている物を1つ捨てる'],
  ['view', '視点を切りかえる'], ['map', '地図'], ['info', '座標の表示を切りかえる'], ['hot1', '持ち物らん 1'], ['hot2', '持ち物らん 2'], ['hot3', '持ち物らん 3'], ['hot4', '持ち物らん 4'], ['hot5', '持ち物らん 5'], ['hot6', '持ち物らん 6'], ['hot7', '持ち物らん 7'], ['hot8', '持ち物らん 8'], ['hot9', '持ち物らん 9']];
const SET_DEF = { viewDist: 8, quality: 1, fov: 75, bright: 3, autoQ: false, fpsCap: 0, clouds: true, fancyLeaves: true, particles: 2, bobbing: true, handShow: true, hudScale: 1, showInfo: true, showFps: false, nameTags: true, view: 0, minimap: true,
  sens: 12, touchSens: 12, invertY: false, autoJump: false, sprintTap: true, sneakToggle: false, swapMouse: false, touchSize: 1, holdMs: 330,
  master: 10, sfx: 7, music: 5, touchInit: false, look: [0, 0, 0, 1, 0] };
const settings = Object.assign({}, SET_DEF, { look: SET_DEF.look.slice(), keys: Object.assign({}, KEY_DEF) });
function loadSettings() {
  try { const s = JSON.parse(localStorage.getItem('kk_settings') || 'null'); if (s) { const k = s.keys; delete s.keys; Object.assign(settings, s); if (k && typeof k === 'object') for (const a in KEY_DEF) if (typeof k[a] === 'string') settings.keys[a] = k[a]; } } catch (e) { }
  settings.look = parseLook(settings.look);
}
function saveSettings() { try { localStorage.setItem('kk_settings', JSON.stringify(settings)); } catch (e) { } }
function applySettings() {
  game.dynScale = 1; game.dynDist = 99;   // 「自動で軽くする」のやり直し
  R.scale = settings.quality; R.clouds = settings.clouds; R.minBase = R.minLight = 0.02 + settings.bright * 0.012;
  if (meshOpts.fancyLeaves !== settings.fancyLeaves) { meshOpts.fancyLeaves = settings.fancyLeaves; if (game.world) for (const c of game.world.chunks.values()) c.dirty = 0xFF; }
  const st = document.documentElement.style; st.setProperty('--hud', settings.hudScale); st.setProperty('--tb', settings.touchSize);
  const nt = $('ntags'); if (nt) nt.style.display = settings.nameTags ? '' : 'none';
  if (typeof audio !== 'undefined') audio.setVolumes();
}
// キーの名前（画面に出す用）
function keyName(c) {
  if (!c) return 'なし';
  const fixed = { Space: 'スペース', ShiftLeft: '左Shift', ShiftRight: '右Shift', ControlLeft: '左Ctrl', ControlRight: '右Ctrl', AltLeft: '左Alt', AltRight: '右Alt', Tab: 'Tab', Enter: 'Enter', Backspace: 'Backspace', CapsLock: 'CapsLock', Escape: 'Esc',
    ArrowUp: '↑', ArrowDown: '↓', ArrowLeft: '←', ArrowRight: '→', Minus: '-', Equal: '=', BracketLeft: '[', BracketRight: ']', Semicolon: ';', Quote: "'", Comma: ',', Period: '.', Slash: '/', Backslash: '\\', Backquote: '`', IntlRo: 'ろ', IntlYen: '¥' };
  if (fixed[c]) return fixed[c];
  if (c.startsWith('Key')) return c.slice(3);
  if (c.startsWith('Digit')) return c.slice(5);
  if (c.startsWith('Numpad')) return 'テンキー' + c.slice(6);
  return c;
}
// 設定画面の中身。t: range（つまみ）・tog（オン／オフ）・sel（えらぶ）・act（ボタン）
const SET_TABS = [
  { id: 'video', name: '画面', items: [
    { k: 'viewDist', t: 'range', name: '見える距離', min: 3, max: 12, step: 1, fmt: v => v + '', desc: '1つ上げると16ブロック遠くまで見えます。大きいほど重くなります' },
    { k: 'quality', t: 'range', name: '画質（細かさ）', min: 0.5, max: 1, step: 0.1, fmt: v => Math.round(v * 100) + '%' },
    { k: 'autoQ', t: 'tog', name: '重いときは自動で軽くする', desc: '動きがカクカクするとき、画質と見える距離を自動で下げます' },
    { k: 'fpsCap', t: 'sel', name: '1秒のコマ数の上限', opts: [[0, '制限なし'], [60, '60'], [30, '30']], desc: '下げると、電池と熱にやさしくなります' },
    { k: 'fov', t: 'range', name: '視野の広さ', min: 55, max: 100, step: 1, fmt: v => v + '' },
    { k: 'bright', t: 'range', name: '明るさ', min: 0, max: 10, step: 1, fmt: v => v + '' },
    { k: 'clouds', t: 'tog', name: '雲' },
    { k: 'fancyLeaves', t: 'tog', name: '葉のすき間' },
    { k: 'particles', t: 'sel', name: 'かけら・けむり', opts: [[0, '少なめ'], [1, 'ふつう'], [2, '多め']] },
    { k: 'bobbing', t: 'tog', name: '歩くときのゆれ' },
    { k: 'view', t: 'sel', name: '視点', opts: [[0, '自分の目'], [1, 'うしろから'], [2, '前から']] },
    { k: 'handShow', t: 'tog', name: '手と持ち物を表示' },
    { k: 'hudScale', t: 'range', name: '持ち物らんの大きさ', min: 0.8, max: 1.3, step: 0.1, fmt: v => Math.round(v * 100) + '%' },
    { k: 'showInfo', t: 'tog', name: '座標・時刻の表示' },
    { k: 'minimap', t: 'tog', name: '小さな地図', desc: '画面のすみに まわりの地図を出します。押すと大きな地図が開きます' },
    { k: 'showFps', t: 'tog', name: 'コマ数の表示' },
    { k: 'nameTags', t: 'tog', name: '友だちの名前の札' },
    { t: 'act', name: '全画面の切りかえ', fn: () => { try { if (document.fullscreenElement) document.exitFullscreen(); else { const p = document.documentElement.requestFullscreen(); if (p && p.catch) p.catch(() => ui.toast('この画面では全画面にできません')); } } catch (e) { ui.toast('この画面では全画面にできません'); } } }] },
  { id: 'ctrl', name: '操作', items: [
    { k: 'sens', t: 'range', name: '視点の速さ（マウス）', min: 2, max: 30, step: 1, fmt: v => v + '' },
    { k: 'touchSens', t: 'range', name: '視点の速さ（タッチ）', min: 2, max: 30, step: 1, fmt: v => v + '' },
    { k: 'invertY', t: 'tog', name: '上下を逆にする' },
    { k: 'autoJump', t: 'tog', name: '段差で自動ジャンプ' },
    { k: 'sprintTap', t: 'tog', name: '「前へ」を2回押すと走る' },
    { k: 'sneakToggle', t: 'tog', name: '「しゃがむ」を押すたびに切りかえ', desc: 'オフのときは、押している間だけしゃがみます' },
    { k: 'swapMouse', t: 'tog', name: 'マウスの左右を入れかえる', desc: 'オンにすると、右ボタンでこわす・左ボタンで置く になります' },
    { k: 'touchSize', t: 'range', name: 'タッチボタンの大きさ', min: 0.8, max: 1.4, step: 0.1, fmt: v => Math.round(v * 100) + '%' },
    { k: 'holdMs', t: 'range', name: '長押しでこわし始めるまで', min: 200, max: 600, step: 10, fmt: v => (v / 1000).toFixed(2) + '秒' }] },
  { id: 'keys', name: 'キー', items: [] },
  { id: 'audio', name: '音', items: [
    { k: 'master', t: 'range', name: '全体の音量', min: 0, max: 10, step: 1, fmt: v => v + '' },
    { k: 'sfx', t: 'range', name: '効果音', min: 0, max: 10, step: 1, fmt: v => v + '' },
    { k: 'music', t: 'range', name: '音楽', min: 0, max: 10, step: 1, fmt: v => v + '' }] }
];
function esc(s) { return String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])); }

const keys = {};
const touchSt = { stick: null, sx: 0, sy: 0, mag: 0, jump: false, sneak: false, brk: false, use: false, look: new Map(), rayHold: 0 };
let pointerLocked = false, lastJumpTap = 0, lastWTap = 0, sprintLatch = false, sneakLatch = false, mouseNdc = [0, 0], mouseL = false, mouseR = false;

const ui = {
  screen: null, slots: [], ent: null, entPos: null, craft: [], craftW: 2, recipe: null, recTab: 'ok', menu: null, menuStack: [],
  hp: -99, food: -99, air: -99, armor: -99, sel: -99, infoT: 0, pick: [], heldT: 0, achQ: [], achT: 0, longT: null, lastInfo: '',

  init() {
    // タイトルの文字を1つずつ落とす
    // 題名は、ゲームに出てくるブロック5つに1文字ずつ
    const logo = $('logo'), tiles = ['grass_side_', 'planks_', 'stone', 'sand', 'ore_diamond'];
    const texUrl = (n) => { const k = TEX[n] !== undefined ? n : Object.keys(TEX).find(x => x.indexOf(n) === 0); return k ? dataToCanvas(TEX_DATA[TEX[k]]).toDataURL() : ''; };
    'block'.split('').forEach((ch, i) => { const s = document.createElement('span'); s.textContent = ch; s.style.animationDelay = (i * 0.09) + 's'; const u = texUrl(tiles[i]); if (u) s.style.backgroundImage = 'linear-gradient(rgba(0,0,0,.12),rgba(0,0,0,.34)),url(' + u + ')'; logo.appendChild(s); });
    for (let i = 0; i < 10; i++) { for (const id of ['hearts', 'foods', 'bubbles', 'armorRow']) { const im = document.createElement('img'); im.alt = ''; $(id).appendChild(im); } }
    const hb = $('hotbar');
    for (let i = 0; i < 9; i++) { const el = this.mkSlotEl(); el.dataset.h = i; hb.appendChild(el); }
    hb.addEventListener('pointerdown', (e) => { const s = e.target.closest('.slot'); if (s) { player.sel = +s.dataset.h; sfx('click', 0.4); e.preventDefault(); } });
    $('howText').innerHTML = howtoHtml();
    if (window.__blockOnline) { const h = $('homeLink'); h.hidden = false; try { if (window.NetDB && NetDB.hub) h.href = NetDB.hub.home(); } catch (e) { } }
    this.bindMenus(); this.bindScreen(); this.bindInput();
  },
  mkSlotEl() { const el = document.createElement('div'); el.className = 'slot'; el.innerHTML = '<i></i><b></b>'; return el; },
  paintSlot(el, s) {
    const ic = el.firstChild, cnt = ic.nextSibling;
    let u = el.querySelector('u');
    el.classList.toggle('ench', !!s && enchAny(s.d));   // 力のこもった物は 光る
    if (!s) { ic.style.backgroundImage = ''; cnt.textContent = ''; if (u) u.remove(); return; }
    ic.style.backgroundImage = 'url(' + ICON_URL[s.id] + ')';
    cnt.textContent = s.n > 1 ? s.n : '';
    const def = ITEMS[s.id], dur = def.tool ? def.tool.dur : def.armor ? def.armor.dur : 0;
    const dm = itemDmg(s.d);
    if (dur && dm > 0) {
      if (!u) { u = document.createElement('u'); u.innerHTML = '<s></s>'; el.appendChild(u); }
      const f = Math.max(0, 1 - dm / dur); u.firstChild.style.width = (f * 100) + '%'; u.firstChild.style.background = f > 0.5 ? '#6fd24a' : f > 0.2 ? '#f2c53d' : '#e0523a';
    } else if (u) u.remove();
  },

  // ---------- 遊んでいる間の表示 ----------
  setIcons(id, n, full, half, empty, val) {
    const row = $(id).children;
    for (let i = 0; i < 10; i++) { const v = val - i * 2; const src = i >= n ? '' : v >= 2 ? full : v >= 1 ? half : empty; if (row[i].dataset.s !== src) { row[i].dataset.s = src; if (src) { row[i].src = src; row[i].hidden = false; } else row[i].hidden = true; } }
  },
  bump(id) { const el = $(id); el.classList.remove('bump'); void el.offsetWidth; el.classList.add('bump'); },
  bumpHearts() { this.bump('hearts'); }, bumpFood() { this.bump('foods'); },
  updateHud(dt) {
    const p = player, creative = p.mode === 1;
    $('status').style.visibility = creative ? 'hidden' : 'visible'; $('xpbar').style.visibility = creative ? 'hidden' : 'visible';
    let fk = ''; for (const k in p.fx) if (p.fx[k] > 0) fk += k + Math.ceil(p.fx[k] / 20) + ',';   // くすりの効き目：小さな絵と のこり時間
    if (fk !== this.fxKey) { this.fxKey = fk; let h = ''; for (const k in p.fx) if (p.fx[k] > 0) { const t = Math.ceil(p.fx[k] / 20); h += '<div><i style="background-image:url(' + ICON_URL[I['potion_' + k]] + ')"></i>' + Math.floor(t / 60) + ':' + String(t % 60).padStart(2, '0') + '</div>'; } $('fxbar').innerHTML = h; }
    const xk = p.xpLv * 1000 + Math.round(p.xpPt / xpNeed(p.xpLv) * 200);
    if (xk !== this.xpKey) { this.xpKey = xk; $('xpFill').style.width = (p.xpPt / xpNeed(p.xpLv) * 100).toFixed(1) + '%'; $('xpLv').textContent = p.xpLv > 0 ? p.xpLv : ''; }
    const hp = Math.ceil(p.hp), food = Math.ceil(p.food), air = p.air >= 300 ? -1 : Math.max(0, Math.ceil(p.air / 30)) * 2, ar = p.armorPoints();
    if (hp !== this.hp) { this.hp = hp; this.setIcons('hearts', 10, HUD_URL.heart, HUD_URL.heart_half, HUD_URL.heart_empty, hp); }
    if (food !== this.food) { this.food = food; this.setIcons('foods', 10, HUD_URL.food, HUD_URL.food_half, HUD_URL.food_empty, food); }
    if (air !== this.air) { this.air = air; this.setIcons('bubbles', air < 0 ? 0 : 10, HUD_URL.bubble, HUD_URL.bubble, '', air); }
    if (ar !== this.armor) { this.armor = ar; this.setIcons('armorRow', ar > 0 ? 10 : 0, HUD_URL.armor, HUD_URL.armor, HUD_URL.armor_empty, ar); }
    if (p.invDirty) { p.invDirty = false; this.paintHotbar(); if (this.screen) this.refresh(); game.onInventory(); }
    if (p.sel !== this.sel) { this.sel = p.sel; const ch = $('hotbar').children; for (let i = 0; i < 9; i++) ch[i].classList.toggle('sel', i === p.sel); }
    this.infoT -= dt;
    if (this.infoT <= 0) {
      this.infoT = 0.25;
      let t = '';
      if ((settings.showInfo || settings.showFps) && game.world && !settings.showInfo) t = game.fps + ' コマ/秒';
      if (settings.showInfo && game.world) {
        const w = game.world, h = (w.time / 1000 + 6) % 24, hh = Math.floor(h), mm = Math.floor((h - hh) * 6) * 10;
        t = 'X ' + Math.floor(p.x) + '  Y ' + Math.floor(p.y) + '  Z ' + Math.floor(p.z) + '\n' + BIOME_NAMES[w.biomeAt(Math.floor(p.x), Math.floor(p.z))] + '  ' + w.day + '日目 ' + hh + ':' + (mm < 10 ? '0' : '') + mm;
        if (settings.showFps && !game.debug) t += '\n' + game.fps + ' コマ/秒';
        if (game.debug) t += '\n' + game.fps + 'fps  区画' + R.stats.sections + '  生き物' + ents.length + '  チャンク' + w.chunks.size;
      }
      if (t !== this.lastInfo) { this.lastInfo = t; $('info').textContent = t; }
      const boss = game.boss && !game.boss.dead ? game.boss : null;
      $('bossbar').hidden = !boss; if (boss) { $('bossFill').style.width = Math.max(0, boss.hp / boss.maxHp * 100) + '%'; const bn = MOBS[boss.type].name; if (this._bn !== bn) { this._bn = bn; $('bossName').textContent = bn; } }
    }
    $('fxWater').style.opacity = p.headIn === 1 ? 1 : 0; $('fxLava').style.opacity = p.headIn === 2 ? 1 : 0;
    const eb = $('eatbar'); if (p.eating > 0) { eb.style.display = 'block'; $('eatFill').style.width = Math.min(100, p.eating / 1.5 * 100) + '%'; } else if (eb.style.display !== 'none') eb.style.display = 'none';
    if (this.heldT > 0) { this.heldT -= dt; if (this.heldT <= 0) $('heldname').classList.remove('on'); }
    for (let i = this.pick.length - 1; i >= 0; i--) { const k = this.pick[i]; k.t -= dt; if (k.t <= 0.6 && !k.out) { k.out = true; k.el.classList.add('out'); } if (k.t <= 0) { k.el.remove(); this.pick.splice(i, 1); } }
    if (this.achT > 0) { this.achT -= dt; if (this.achT <= 0) { $('ach').classList.remove('on'); this.achT = -0.5; } }
    else if (this.achT < 0) { this.achT = Math.min(0, this.achT + dt); }
    else if (this.achQ.length) { const a = this.achQ.shift(); $('achText').textContent = a.title; $('achIcon').style.backgroundImage = 'url(' + ICON_URL[a.icon] + ')'; const el = $('ach'); el.classList.remove('on'); void el.offsetWidth; el.classList.add('on'); this.achT = 4.2; sfx('achieve'); }
    if (this.screen === 'furnace') this.paintFurnace();
  },
  paintHotbar() { const ch = $('hotbar').children; for (let i = 0; i < 9; i++) this.paintSlot(ch[i], player.inv[i]); },
  showHeldName() { const s = player.held(), el = $('heldname'); if (!s) { el.classList.remove('on'); return; } const en = enchList(s.id, s.d); el.textContent = itemName(s.id) + (en.length ? '（' + en.join('・') + '）' : ''); el.classList.add('on'); this.heldT = en.length ? 2.6 : 1.6; },
  toast(msg, sec) {
    const box = $('toasts'); if (box.lastChild && box.lastChild.textContent === msg) return;
    const el = document.createElement('div'); el.className = 'toast'; el.textContent = msg; box.appendChild(el);
    while (box.children.length > 3) box.firstChild.remove();
    setTimeout(() => { el.classList.add('out'); setTimeout(() => el.remove(), 520); }, (sec || 2.6) * 1000);
  },
  hint(msg) { $('hint').textContent = msg || ''; },
  // レベルが上がった：数字が はねる。5レベルごとに 一言
  levelFx(lv) { const b = $('xpLv'); if (b) { b.classList.remove('up'); void b.offsetWidth; b.classList.add('up'); } if (lv % 5 === 0) this.toast('レベル ' + lv + ' になった！', 3); },
  pickupFx(id, n) {
    if (id === I.xp_orb) return;
    let k = this.pick.find(o => o.id === id && !o.out);
    if (k) { k.n += n; k.t = 2.2; k.el.lastChild.textContent = '+' + k.n + ' ' + itemName(id); }
    else { const el = document.createElement('div'); el.innerHTML = '<i style="background-image:url(' + ICON_URL[id] + ')"></i><span>+' + n + ' ' + esc(itemName(id)) + '</span>'; $('pickups').appendChild(el); this.pick.push({ id, n, t: 2.2, el, out: false }); if (this.pick.length > 5) { const o = this.pick.shift(); o.el.remove(); } }
    for (let i = 0; i < 9; i++) { const s = player.inv[i]; if (s && s.id === id) { const el = $('hotbar').children[i]; el.classList.remove('pop'); void el.offsetWidth; el.classList.add('pop'); break; } }
  },
  hurtFlash() { const el = $('fxHurt'); el.classList.add('on'); requestAnimationFrame(() => requestAnimationFrame(() => el.classList.remove('on'))); },
  flash() { const el = $('fxFlash'); el.style.transition = 'none'; el.style.opacity = 0.9; requestAnimationFrame(() => requestAnimationFrame(() => { el.style.transition = ''; el.style.opacity = 0; })); },
  fade(on) { $('fxFade').style.opacity = on ? 1 : 0; },
  dark(on) { $('fxDark').style.opacity = on ? 1 : 0; },
  gateFx(k) { if (k === this._gk) return; this._gk = k; const el = $('fxGate'); if (el) el.style.opacity = k > 0 ? Math.min(0.9, 0.15 + k * 0.75) : 0; },
  dayBanner(text) { const el = $('daybanner'); el.textContent = text; el.classList.remove('on'); void el.offsetWidth; el.classList.add('on'); },
  achievement(title, icon) { this.achQ.push({ title, icon }); },
  showDeath(msg, dropped) {
    $('deathMsg').textContent = msg;
    const d = player.deathPos;
    $('deathPos').textContent = (dropped ? '持ち物は X ' + d.x + '  Y ' + d.y + '  Z ' + d.z + ' に落ちています（10分ほどで消えます）' : '持ち物はそのまま残っています');
    if (document.pointerLockElement) document.exitPointerLock();
    setTimeout(() => { if (player.dead) this.showMenu('mDeath', true); }, 900);
  },

  // ---------- メニュー ----------
  showMenu(id, dim, push) {
    const m = $('menu');
    if (push && this.menu) this.menuStack.push([this.menu, m.classList.contains('dimbg')]);
    else if (!push) this.menuStack.length = 0;
    for (const s of m.children) s.classList.toggle('on', s.id === id);
    m.classList.add('on'); m.classList.toggle('dimbg', !!dim);
    this.menu = id; m.scrollTop = 0;
    const f = $(id).querySelector('.btn.pri') || $(id).querySelector('.btn'); if (f && !touchSt.touchUsed) try { f.focus({ preventScroll: true }); } catch (e) { }
  },
  hideMenu() { $('menu').classList.remove('on'); this.menu = null; this.menuStack.length = 0; },
  back() { const p = this.menuStack.pop(); if (p) { const st = this.menuStack.slice(); this.showMenu(p[0], p[1]); this.menuStack = st; } else if (game.state === 'paused') game.resume(); else this.hideMenu(); },
  confirm(title, text, onYes) { $('confTitle').textContent = title; $('confText').textContent = text; this._yes = onYes; this.showMenu('mConfirm', true, true); },
  error(text) { $('errText').textContent = text; this.showMenu('mError', true); },
  bindMenus() {
    const on = (id, fn) => $(id).addEventListener('click', (e) => { sfx('click'); fn(e); });
    on('bNew', () => { this.showMenu('mNew', true, true); this.updNotes(); });
    on('bLoad', () => game.openWorldList());
    const how = () => { $('howText').innerHTML = howtoHtml(); this.showMenu('mHow', true, true); };
    on('bHow', how); on('bHow2', how);
    on('bSet', () => this.openSettings()); on('bSet2', () => this.openSettings());
    on('bStart', () => { if (this.segVal('segNet') === 1 && !net.getName()) { this.toast('先に、なまえを入れてください'); this.back(); this.openOnline(); $('inNick').focus(); return; } game.startNew($('inName').value, $('inSeed').value, this.segVal('segMode'), this.segVal('segDiff'), this.segVal('segNet') === 1, Object.assign({}, this._newRules)); });
    on('bOnline', () => this.openOnline());
    on('bJoin', () => { if (this.needName()) game.joinOnline($('inCode').value); });
    on('bNewOnline', () => { if (!this.needName()) return; this.setSeg('segNet', 1); this.showMenu('mNew', true, true); this.updNotes(); });
    on('bLook', () => this.openLook());
    on('bInvite', () => this.copyInvite());
    on('bRules', () => this.openRules());
    on('bMap', () => map.openMap());
    on('signOk', () => this.closeSign(true)); on('signCancel', () => this.closeSign(false));
    for (const id of ['signL1', 'signL2']) $(id).addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); if (id === 'signL1') $('signL2').focus(); else this.closeSign(true); } else if (e.key === 'Escape') { e.preventDefault(); this.closeSign(false); } });
    on('bMsgOk', () => { const f = this._msgOk; this._msgOk = null; if (f) f(); else this.back(); });
    $('inNick').addEventListener('change', () => { net.setName($('inNick').value); });
    $('segDiff2').addEventListener('click', (e) => { const b = e.target.closest('.btn'); if (!b || b.disabled) return; sfx('click'); game.setRule('diff', +b.dataset.v); this.paintRules(); });
    this._newRules = game.defaultRules(2);
    this.buildRules('segRules', () => this._newRules, (k, v) => { this._newRules[k] = v; });
    this.buildRules('segRules2', () => game.rules, (k, v) => game.setRule(k, v));
    on('bResume', () => game.resume());
    on('bNotes', () => this.openNotes()); on('scrNotes', () => { this.close(); game.pause(true); this.openNotes(); });
    on('bQuit', () => game.quitToTitle()); on('bDeathQuit', () => game.quitToTitle());
    on('bRespawn', () => game.respawn());
    on('bEndGo', () => game.resume());
    on('bConfYes', () => { const f = this._yes; this._yes = null; this.back(); if (f) f(); }); on('bConfNo', () => this.back());
    on('bImport', () => $('inFile').click());
    $('inFile').addEventListener('change', (e) => { const f = e.target.files[0]; if (f) game.importFile(f); e.target.value = ''; });
    for (const b of document.querySelectorAll('[data-back]')) b.addEventListener('click', () => { sfx('click'); saveSettings(); this.back(); });
    for (const id of ['segMode', 'segDiff', 'segNet']) $(id).addEventListener('click', (e) => {
      const b = e.target.closest('.btn'); if (!b) return; sfx('click');
      for (const o of $(id).children) o.classList.toggle('on', o === b);
      if (id === 'segDiff') { this._newRules.keep = +b.dataset.v < 2; this.paintRuleSeg('segRules', this._newRules, true); }
      this.updNotes();
    });
    this.bindSettings();
  },
  segVal(id) { const b = $(id).querySelector('.btn.on'); return b ? +b.dataset.v : 0; },
  setSeg(id, v) { for (const o of $(id).children) o.classList.toggle('on', +o.dataset.v === v); },
  // ---------- 世界のルール ----------
  buildRules(id, get, set) {
    const box = $(id); box.innerHTML = '';
    for (const r of RULES) { const b = document.createElement('button'); b.type = 'button'; b.className = 'btn sm'; b.dataset.k = r.k; b.textContent = r.name; box.appendChild(b); }
    box.addEventListener('click', (e) => { const b = e.target.closest('.btn'); if (!b || b.disabled) return; sfx('click'); const k = b.dataset.k; set(k, !get()[k]); this.paintRuleSeg(id, get(), true); });
    this.paintRuleSeg(id, get(), true);
  },
  paintRuleSeg(id, rules, can) { for (const b of $(id).children) { b.classList.toggle('on', !!rules[b.dataset.k]); b.disabled = !can; } },
  openRules() { this.paintRules(); this.showMenu('mRules', true, true); },
  paintRules() {
    const can = !game.online || net.own;
    this.paintRuleSeg('segRules2', game.rules, can);
    for (const b of $('segDiff2').children) { b.classList.toggle('on', +b.dataset.v === game.diff); b.disabled = !can; }
    $('rulesNote').textContent = can ? '金色の字がオンです。変えるとすぐに全員に反映されます。' : 'この世界のルールを変えられるのは、世界を作った人だけです。';
  },
  // ---------- みんなで遊ぶ ----------
  busy(text) { $('loadTitle').textContent = text; $('loadFill').style.width = '0%'; $('loadNote').textContent = ''; this.showMenu('mLoading', true); },
  msg(title, text, onOk) { $('msgTitle').textContent = title; $('msgText').textContent = text; this._msgOk = onOk || null; this.showMenu('mMsg', true, !onOk); },
  netError(e) { const text = (e && e.message) || String(e); this.msg('入れませんでした', text, () => { if (game.state !== 'title') game.showTitle(); else this.showMenu('mTitle', false); this.openOnline(); }); },
  needName() { if (net.setName($('inNick').value)) return true; this.toast('なまえを入れてください'); $('inNick').focus(); return false; },
  openOnline() {
    const ok = net.avail;
    if (!ok && window.__blockOnline && document.readyState !== 'complete') { this.toast('通信の準備をしています。少し待ってから、もう一度押してください', 4); return; }
    $('onlineOn').hidden = !ok; $('onlineOff').hidden = ok;
    if (!ok) {
      const a = $('onlineLink'), here = !!window.__blockOnline;   // 置き場の版なのに使えない＝通信の部品を読みこめなかった
      $('onlineOffA').textContent = here ? '中継サーバーにつなぐ部品を読みこめませんでした。' : 'このページからは、ほかの人とつなぐことができません（Claudeのページは外と通信できない決まりのため）。';
      $('onlineOffB').textContent = here ? '通信を確かめて、ページを開き直してください。ひとり用の世界はこのまま遊べます。' : 'みんなで遊ぶときは、ゲーム置き場の版を開いてください。ひとり用の世界は、このページでも今まで通り遊べます。';
      a.hidden = here; a.href = NET_URL; a.textContent = NET_URL;
    }
    else { $('inNick').value = net.getName(); drawLookPreview($('lookMini'), settings.look); this.renderOnline(); }
    this.showMenu('mOnline', true, true);
  },
  renderOnline() {
    const box = $('onlineList'), list = net.known(); box.innerHTML = '';
    if (!list.length) { box.innerHTML = '<p class="dim">まだありません。友だちからコードをもらって入るか、新しくつくりましょう。</p>'; return; }
    for (const w of list) {
      const el = document.createElement('div'); el.className = 'wslot';
      el.innerHTML = '<div><strong></strong><span class="dim"></span></div><div class="rowf"><button class="btn sm pri" type="button" data-a="play">入る</button><button class="btn sm" type="button" data-a="forget">一覧から外す</button>' + (w.own ? '<button class="btn sm bad" type="button" data-a="del">消す</button>' : '') + '</div>';
      el.querySelector('strong').textContent = w.name; const info = el.querySelector('span'); info.textContent = 'コード ' + w.code + '・しらべています…';
      net.countAt(w.code).then(async (n) => {
        if (n > 0) info.textContent = 'コード ' + w.code + '・いま ' + n + '人が遊んでいます';
        else { const ex = n === 0 ? await net.exists(w.code) : null; info.textContent = 'コード ' + w.code + (ex === false ? '・もうありません（消されたようです）' : n === 0 ? '・いまはだれもいません' : '・つながりませんでした'); }
      });
      el.addEventListener('click', (e) => {
        const b = e.target.closest('.btn'); if (!b) return; sfx('click'); const a = b.dataset.a;
        if (a === 'play') { if (this.needName()) game.joinOnline(w.code); }
        else if (a === 'forget') this.confirm('一覧から外しますか？', '「' + w.name + '」を一覧から外します。この端末に残してある持ち物の記録も消えます（世界そのものは消えません）。', () => { net.forget(w.code); this.renderOnline(); });
        else this.confirm('この世界を消しますか？', '「' + w.name + '」を中継サーバーから消します。友だちも入れなくなり、元にはもどせません。', () => { net.destroy(w.code).then(() => { net.forget(w.code); this.renderOnline(); this.toast('世界を消しました'); }, () => this.toast('消せませんでした')); });
      });
      box.appendChild(el);
    }
  },
  openLook() {
    const rows = $('lookRows');
    if (!rows.firstChild) {
      const defs = [['はだの色', LOOK_SKIN], ['かみの色', LOOK_HAIR], ['かみがた', LOOK_STYLE], ['服の色', LOOK_SHIRT], ['ズボンの色', LOOK_PANTS]];
      defs.forEach(([name, list], i) => {
        const d = document.createElement('div'); d.innerHTML = '<div>' + name + '</div><div class="seg"></div>'; const seg = d.lastChild;
        list.forEach((c, v) => { const b = document.createElement('button'); b.type = 'button'; b.dataset.v = v; if (i === 2) { b.className = 'btn sm'; b.textContent = c; } else { b.className = 'btn sw'; b.style.background = c; b.title = name + ' ' + (v + 1); b.setAttribute('aria-label', name + ' ' + (v + 1)); } seg.appendChild(b); });
        seg.addEventListener('click', (e) => { const b = e.target.closest('.btn'); if (!b) return; sfx('click'); settings.look[i] = +b.dataset.v; saveSettings(); this.paintLook(); paintSkin(0, settings.look); if (net.on) net.announce(); });
        rows.appendChild(d);
      });
    }
    this.paintLook(); this.showMenu('mLook', true, true);
  },
  paintLook() {
    drawLookPreview($('lookCv'), settings.look); drawLookPreview($('lookMini'), settings.look);
    [...$('lookRows').children].forEach((d, i) => { for (const b of d.lastChild.children) b.classList.toggle('on', +b.dataset.v === settings.look[i]); });
  },
  inviteUrl() { const base = /^https?:/.test(location.protocol) ? location.href.split('#')[0].split('?')[0] : NET_URL; return base + '?room=' + net.code; },
  copyInvite() {
    const url = this.inviteUrl(), fail = () => this.msg('招待リンク', url + '\n\n（自動でコピーできなかったので、上の文字を長押しでコピーしてください）', () => this.back());
    try { navigator.clipboard.writeText(url).then(() => this.toast('招待リンクをコピーしました。友だちに送ってください'), fail); } catch (e) { fail(); }
  },
  netHud() {
    const b = $('netBadge'); if (!b) return;
    if (!net.on) { b.hidden = true; $('netBox').hidden = true; return; }
    const n = net.count(), bad = !net.connected, txt = bad ? '接続が切れています…' : net.code + '・' + n + '人';
    if (b._t !== txt) { b._t = txt; b.textContent = txt; b.classList.toggle('bad', bad); }
    b.hidden = game.state === 'loading';
    if (this.menu === 'mPause') this.paintNetBox();
    if (game.inBed) this.sleepHud(true);
  },
  paintNetBox() {
    const box = $('netBox'); box.hidden = !net.on; if (!net.on) return;
    $('netCode').textContent = 'コード ' + net.code;
    const names = [(net.getName() || 'ななし') + '（自分）']; for (const p of net.peers.values()) if (net.here(p)) names.push(p.name + (p.dim ? '（' + DIM_NAMES[p.dim] + '）' : ''));
    $('netWho').textContent = 'いまいる人：' + names.join('、');
  },
  sleepHud(on) {
    const el = $('sleepNote'); el.hidden = !on; if (!on) return;
    let n = 1, all = 1; for (const p of net.peers.values()) if (net.here(p) && net.fresh(p) && !p.dead) { all++; if (p.sleeping) n++; }
    el.textContent = (all > 1 ? 'ねむっています…（' + all + '人中 ' + n + '人）\n全員がベッドに入ると朝になります' : 'ねむっています…') + '\n' + (touchSt.touchUsed ? 'ジャンプを押すと起きます' : 'スペースキーで起きます');
  },
  updNotes() {
    $('rowNet').hidden = !net.avail; if (!net.avail) this.setSeg('segNet', 0);
    $('netNote').textContent = this.segVal('segNet') === 1 ? '中継サーバーに保存され、コードを知っている友だちがいつでも入れます（同時に4人まで）' : 'この端末に保存されます';
    $('modeNote').textContent = this.segVal('segMode') === 0 ? '材料を集め、道具をつくり、夜を生きのびます' : 'すべてのブロックを自由に使えて、空も飛べます';
    $('diffNote').textContent = ['敵が出ず、おなかも減りません', '敵が弱め。力尽きても持ち物を落としません', '敵がふつうの強さ。力尽きると持ち物を落とします', '敵が強く、数も多くなります'][this.segVal('segDiff')];
  },
  // ---------- 設定（画面・操作・キー・音に分ける） ----------
  bindSettings() {
    const tabs = $('setTabs');
    for (const t of SET_TABS) { const b = document.createElement('button'); b.type = 'button'; b.className = 'btn sm'; b.dataset.t = t.id; b.textContent = t.name; tabs.appendChild(b); }
    tabs.addEventListener('click', (e) => { const b = e.target.closest('.btn'); if (!b) return; sfx('click'); this.setTab = b.dataset.t; this.keyWait = null; this.paintSettings(); });
    const body = $('setBody');
    body.addEventListener('input', (e) => { const el = e.target; if (el.type !== 'range') return; const it = this.setItem(el.dataset.k); settings[it.k] = +el.value; el.nextElementSibling.textContent = it.fmt(settings[it.k]); applySettings(); });
    body.addEventListener('click', (e) => {
      const b = e.target.closest('.btn'); if (!b) return; sfx('click');
      if (b.dataset.key) { this.keyWait = this.keyWait === b.dataset.key ? null : b.dataset.key; this.paintSettings(); return; }
      const it = this.setItem(b.dataset.k); if (!it) return;
      if (it.t === 'tog') settings[it.k] = !settings[it.k];
      else if (it.t === 'sel') settings[it.k] = +b.dataset.v;
      else if (it.t === 'act') { it.fn(); return; }
      applySettings(); saveSettings(); this.paintSettings();
    });
    $('bSetReset').addEventListener('click', () => {
      sfx('click'); const tab = SET_TABS.find(t => t.id === this.setTab);
      if (tab.id === 'keys') settings.keys = Object.assign({}, KEY_DEF); else for (const it of tab.items) if (it.k) settings[it.k] = SET_DEF[it.k];
      this.keyWait = null; applySettings(); saveSettings(); this.paintSettings(); this.toast('「' + tab.name + '」を最初の設定にもどしました');
    });
  },
  setItem(k) { for (const t of SET_TABS) for (const it of t.items) if ((it.k || it.name) === k) return it; return null; },
  openSettings(tab) { this.setTab = tab || this.setTab || 'video'; this.keyWait = null; this.paintSettings(); this.showMenu('mSettings', true, true); },
  paintSettings() {
    const tab = SET_TABS.find(t => t.id === this.setTab) || SET_TABS[0], body = $('setBody');
    for (const b of $('setTabs').children) b.classList.toggle('on', b.dataset.t === tab.id);
    let h = '';
    if (tab.id === 'keys') {
      h += '<p class="dim">変えたい行のボタンを押してから、割り当てたいキーを押します（Esc でやめる）。ほかと同じキーを選ぶと、入れかわります。</p>';
      for (const [a, name] of KEY_ACTS) h += '<div class="krow"><span>' + esc(name) + '</span><button class="btn sm' + (this.keyWait === a ? ' on' : '') + '" type="button" data-key="' + a + '">' + (this.keyWait === a ? 'キーを押してください…' : esc(keyName(settings.keys[a]))) + '</button></div>';
      h += '<p class="dim">メニューは Esc、見回しは矢印キーでもできます（この2つは変えられません）。こわす・置くはマウスのボタンです（「操作」で左右を入れかえられます）。</p>';
    } else for (const it of tab.items) {
      const key = it.k || it.name;
      if (it.t === 'range') h += '<label class="field"><span>' + esc(it.name) + '</span><input type="range" data-k="' + key + '" min="' + it.min + '" max="' + it.max + '" step="' + it.step + '" value="' + settings[it.k] + '"><output>' + esc(it.fmt(settings[it.k])) + '</output></label>';
      else if (it.t === 'tog') h += '<div class="srow"><span>' + esc(it.name) + '</span><button class="btn sm tog' + (settings[it.k] ? ' on' : '') + '" type="button" data-k="' + key + '">' + (settings[it.k] ? 'オン' : 'オフ') + '</button></div>';
      else if (it.t === 'sel') h += '<div class="srow"><span>' + esc(it.name) + '</span><div class="seg">' + it.opts.map(o => '<button class="btn sm' + (settings[it.k] === o[0] ? ' on' : '') + '" type="button" data-k="' + key + '" data-v="' + o[0] + '">' + esc(o[1]) + '</button>').join('') + '</div></div>';
      else h += '<div class="srow"><span></span><button class="btn sm" type="button" data-k="' + key + '">' + esc(it.name) + '</button></div>';
      if (it.desc) h += '<p class="dim sdesc">' + esc(it.desc) + '</p>';
    }
    body.innerHTML = h;
  },
  // キー設定：待っているときに押されたキーを割り当てる。同じキーを使っていた動作とは入れかえる
  takeKey(code) {
    const a = this.keyWait; this.keyWait = null;
    if (code !== 'Escape') {
      const old = settings.keys[a];
      for (const b in settings.keys) if (b !== a && settings.keys[b] === code) settings.keys[b] = old;
      settings.keys[a] = code; saveSettings(); sfx('click');
    }
    this.paintSettings();
  },
  openNotes() {
    const box = $('notes'); box.innerHTML = ''; let next = true, done = 0;
    for (const a of ACHS) {
      const ok = !!game.ach[a.id]; if (ok) done++;
      const el = document.createElement('div'); el.className = 'note' + (ok ? ' done' : '') + (!ok && next ? ' next' : '');
      let hint = a.hint;
      if (a.id === 'fort' && !ok && game.world && game.world.dim === 1) {   // いちばん近い とりでの方向を教える
        const f = nearestFort(game.world.seed, player.x, player.z);
        if (f) { const dx = f.x - player.x, dz = f.z - player.z, dir = ['北', '北東', '東', '南東', '南', '南西', '西', '北西'][((Math.round(Math.atan2(dx, -dz) / (Math.PI / 4)) % 8) + 8) % 8]; hint += '。いちばん近いのは ' + dir + 'へ 約' + Math.round(Math.hypot(dx, dz) / 10) * 10 + 'ブロック（高さ ' + FORT_Y + '）'; }
      }
      el.innerHTML = '<div><strong>' + esc(a.title) + '</strong><span class="dim">' + esc(hint) + '</span></div>'; box.appendChild(el);
      if (!ok) next = false;
    }
    $('notesHead').textContent = ACHS.length + 'こ中 ' + done + 'こ達成。金色のわくが次の目標です';
    this.showMenu('mNotes', true, true);
    const n = box.querySelector('.next'); if (n) n.scrollIntoView({ block: 'center' });
  },
  renderWorlds(list, canSave) {
    const box = $('worldList'); box.innerHTML = '';
    if (!list.length) box.innerHTML = '<p class="dim">まだセーブされた世界がありません。「はじめから」で世界をつくると、ここに並びます。</p>';
    for (const w of list) {
      const el = document.createElement('div'); el.className = 'wslot';
      const dt = new Date(w.savedAt), ds = (dt.getMonth() + 1) + '/' + dt.getDate() + ' ' + dt.getHours() + ':' + String(dt.getMinutes()).padStart(2, '0');
      el.innerHTML = '<div><strong>' + esc(w.name) + '</strong><span class="dim">' + (w.mode ? 'クリエイティブ' : 'サバイバル') + '・' + ['のんびり', 'やさしい', 'ふつう', 'むずかしい'][w.diff] + '・' + w.day + '日目・' + ds + '</span></div><div class="rowf"><button class="btn sm pri" type="button" data-a="play">あそぶ</button><button class="btn sm" type="button" data-a="export">書き出す</button><button class="btn sm bad" type="button" data-a="del">けす</button></div>';
      el.addEventListener('click', (e) => { const b = e.target.closest('.btn'); if (!b) return; sfx('click'); const a = b.dataset.a; if (a === 'play') game.loadWorld(w.id); else if (a === 'export') game.exportWorld(w.id); else this.confirm('この世界を消しますか？', '「' + w.name + '」を消すと元にもどせません。', () => game.deleteWorld(w.id)); });
      box.appendChild(el);
    }
    $('worldNote').textContent = canSave ? 'セーブはこの端末のブラウザの中に保存されます。別の端末には引き継がれないので、大事な世界は「書き出す」でファイルに残しておくと安心です。' : 'この環境ではブラウザに保存できないようです。遊んだ世界は「書き出す」でファイルに残してください。';
  },

  // ---------- 持ち物・作業台・かまど・チェスト ----------
  bindScreen() {
    const scr = $('screen');
    $('scrClose').addEventListener('click', () => { sfx('click'); this.close(); });
    scr.addEventListener('contextmenu', (e) => e.preventDefault());
    scr.addEventListener('pointerdown', (e) => {
      const el = e.target.closest('.slot');
      if (!el || el.dataset.i === undefined) { if (e.target === scr && player.cursor) { this.dropCursor(); } return; }
      e.preventDefault();
      const idx = +el.dataset.i;
      if (e.pointerType === 'mouse') this.slotClick(idx, e.button === 2 ? 2 : 0, e.shiftKey);
      else { this._lp = false; clearTimeout(this.longT); this.longT = setTimeout(() => { this._lp = true; this.slotClick(idx, 2, false); }, 430); this._lpIdx = idx; }
    });
    scr.addEventListener('pointerup', (e) => { if (e.pointerType === 'mouse') return; clearTimeout(this.longT); const el = e.target.closest('.slot'); if (el && el.dataset.i !== undefined && !this._lp && +el.dataset.i === this._lpIdx) this.slotClick(+el.dataset.i, 0, false); });
    scr.addEventListener('pointercancel', () => clearTimeout(this.longT));
    scr.addEventListener('pointermove', (e) => {
      this.moveCursor(e.clientX, e.clientY);
      if (e.pointerType !== 'mouse') return;
      const el = e.target.closest('.slot'), tip = $('tip');
      if (el && el.dataset.i !== undefined) { const s = this.getS(this.slots[+el.dataset.i]); if (s && !player.cursor) { tip.textContent = [itemName(s.id)].concat(enchList(s.id, s.d)).join('\n'); tip.style.display = 'block'; tip.style.left = Math.min(window.innerWidth - tip.offsetWidth - 4, e.clientX + 14) + 'px'; tip.style.top = (e.clientY - 30) + 'px'; return; } }
      tip.style.display = 'none';
    });
    $('recTabs').addEventListener('click', (e) => { const b = e.target.closest('.btn'); if (!b) return; sfx('click'); this.recTab = b.dataset.t; this.paintRecipes(); });
    $('scrTop').addEventListener('click', (e) => { const b = e.target.closest('.btn.enchb'); if (b && !b.disabled) this.doEnch(+b.dataset.t); });
    $('recList').addEventListener('click', (e) => { const b = e.target.closest('.btn'); if (!b || b.disabled) return; this.craftFromList(RECIPES[+b.dataset.r], e.shiftKey, b.closest('.rec')); });
  },
  moveCursor(x, y) { const c = $('cursorItem'); c.style.left = x + 'px'; c.style.top = y + 'px'; this._cx = x; this._cy = y; },
  addSlot(parent, ref, cls) { const el = this.mkSlotEl(); if (cls) el.className += ' ' + cls; el.dataset.i = this.slots.length; this.slots.push(ref); ref.el = el; parent.appendChild(el); return el; },
  getS(r) { return r.t === 'result' ? (this.recipe ? { id: this.recipe.out, n: this.recipe.n, d: 0 } : null) : r.t === 'pal' ? { id: r.id, n: 1, d: 0 } : r.t === 'trash' ? null : r.o ? r.o[r.k] : r.a[r.i]; },
  setS(r, s) { if (s && s.n <= 0) s = null; if (r.o) r.o[r.k] = s; else if (r.a) r.a[r.i] = s; },
  open(kind, ent, pos) {
    if (this.screen) this.close(true);
    if (document.pointerLockElement) { this.expectUnlock = true; document.exitPointerLock(); }
    this.screen = kind; this.ent = ent || null; this.entPos = pos || null; this.slots = [];
    const top = $('scrTop'); top.innerHTML = ''; $('scrInv').innerHTML = ''; $('scrHot').innerHTML = '';
    const creative = player.mode === 1 && kind === 'inv';
    $('scrTitle').textContent = kind === 'table' ? '作業台' : kind === 'furnace' ? 'かまど' : kind === 'chest' ? 'チェスト' : kind === 'ench' ? 'ちからの台' : '持ち物';
    this.enchS = null;
    const hasRec = (kind === 'inv' && !creative) || kind === 'table';
    $('recipes').style.display = hasRec ? '' : 'none';
    $('screen').classList.toggle('wide2', creative); $('screen').classList.toggle('norec', !hasRec && !creative);   // 画面の形（マスの大きさの決め方）
    const pb = $('palBox'); while (pb.children.length > 1) pb.removeChild(pb.lastChild);
    $('screen').dataset.k = creative ? 'cre' : kind;   // 画面の種類（上のだんの数 --tr は 見た目の決まりのほうで決める）   // 上のだんの数（少ない画面は そのぶん マスを大きくできる）
    const mk = (cls) => { const d = document.createElement('div'); d.className = cls; top.appendChild(d); return d; };
    const el = (tag, cls, parent, text) => { const d = document.createElement(tag); d.className = cls; if (text) d.textContent = text; parent.appendChild(d); return d; };
    // そうび（本家と同じ ならび）：左に 防具4つを たてに、まん中に 自分の姿、右下に 盾
    const buildEq = () => {
      const eq = mk('eqBox'); el('div', 'lbl eqL', eq, 'そうび');
      const col = el('div', 'eqCol', eq); for (let i = 0; i < 4; i++) this.addSlot(col, { t: 'armor', a: player.armor, i }).title = ARMOR_TYPES[i][1].slice(1);
      const doll = el('canvas', 'doll', eq); doll.width = 16; doll.height = 32; this.paintDoll(doll);
      const sh = el('div', 'eqSh', eq); this.addSlot(sh, { t: 'armor', a: player.armor, i: 4 }).title = '盾（左手）';
    };
    if (creative) {
      const pal = document.createElement('div'); pal.id = 'palette'; pb.appendChild(pal);   // えらぶ一覧は 右がわに大きく出す
      const ids = Object.keys(ITEMS).map(Number).filter(id => id !== B.furnace_lit && !ITEMS[id].hide).sort((a, b) => a - b);
      for (const id of ids) this.addSlot(pal, { t: 'pal', id });
      buildEq();
      const tb = mk('crBox'); el('div', 'lbl', tb, 'すてる'); const tr = el('div', 'g1', tb); this.addSlot(tr, { t: 'trash' }, 'trash').title = 'ここに置くと消えます';
      el('div', 'lbl sub', tb, 'いらない物を\nここに置く');
    } else if (kind === 'inv' || kind === 'table') {
      this.craftW = kind === 'table' ? 3 : 2; this.craft = new Array(this.craftW * this.craftW).fill(null);
      if (kind === 'inv') buildEq();
      const cr = mk('crBox'); el('div', 'lbl', cr, 'つくる'); const row = el('div', 'crRow', cr);
      const g = el('div', kind === 'table' ? 'g3' : 'g2', row); for (let i = 0; i < this.craft.length; i++) this.addSlot(g, { t: 'craft', a: this.craft, i });
      el('div', 'arrow', row, '▶');
      const rs = el('div', 'g1', row); this.addSlot(rs, { t: 'result' }, 'big');
    } else if (kind === 'furnace') {
      const f = mk(''); f.id = 'furn';
      this.addSlot(f, { t: 'fin', o: ent, k: 'in' }).style.cssText = 'grid-row:1;grid-column:1';
      const fire = document.createElement('div'); fire.id = 'furnFire'; fire.innerHTML = '<i></i>'; fire.style.cssText = 'grid-row:2;grid-column:1'; f.appendChild(fire);
      this.addSlot(f, { t: 'ffuel', o: ent, k: 'fuel' }).style.cssText = 'grid-row:3;grid-column:1';
      const ar = document.createElement('div'); ar.id = 'furnArrow'; ar.innerHTML = '<i></i>'; f.appendChild(ar);
      this.addSlot(f, { t: 'fout', o: ent, k: 'out' }, 'big').style.cssText = 'grid-row:1 / 4;grid-column:3';
    } else if (kind === 'ench') {   // 力をこめる：左に物、右に ひかりの粉。その右に えらべる力が3つ
      this.enchS = [null, null];
      const a = mk('g1'); this.addSlot(a, { t: 'ench', a: this.enchS, i: 0 }).title = '力をこめる物';
      const b = mk('g1'); this.addSlot(b, { t: 'ench', a: this.enchS, i: 1 }).title = 'ひかりの粉';
      const o = mk(''); o.id = 'enchOpts';
    } else if (kind === 'chest') { const g = mk('grid9'); for (let i = 0; i < 27; i++) this.addSlot(g, { t: 'chest', a: ent.items, i }); }
    for (let i = 9; i < 36; i++) this.addSlot($('scrInv'), { t: 'inv', a: player.inv, i });
    for (let i = 0; i < 9; i++) this.addSlot($('scrHot'), { t: 'inv', a: player.inv, i });
    $('scrHelp').textContent = touchSt.touchUsed ? 'タップで持つ・置く ／ 長押しで半分だけ持つ・1こだけ置く' : 'クリックで持つ・置く ／ 右クリックで半分・1こ ／ Shift+クリックでまとめて移す';
    $('scrInfo').textContent = kind === 'ench' ? '力をこめると レベルと「ひかりの粉」を使います（今のレベル ' + player.xpLv + '）' : kind === 'furnace' ? '上に焼く物、下に燃料（木・石炭など）を入れます' : kind === 'inv' && !creative ? '4マスに材料を並べるか、右の一覧から作れます' : kind === 'table' ? '9マスに材料を並べるか、右の一覧から作れます' : '';
    this.recipe = null;
    $('screen').classList.add('on'); $('app').classList.add('uiopen');
    this.refresh();
    if (kind === 'inv' || kind === 'table') this.paintRecipes();
    game.onStat('open', kind);
  },
  // 看板に字を書く画面
  editSign(x, y, z) {
    const w = game.world, e = w.getEnt(x, y, z);
    if (!e || e.t !== 'sign' || game.state !== 'playing') return;
    if (this.screen) this.close(true);
    if (document.pointerLockElement) { this.expectUnlock = true; document.exitPointerLock(); }
    const ln = String(e.s || '').split('\n');
    $('signL1').value = ln[0] || ''; $('signL2').value = ln[1] || '';
    this.screen = 'sign'; this.signPos = { x, y, z };
    $('signScr').classList.add('on'); $('app').classList.add('uiopen');
    setTimeout(() => { try { $('signL1').focus(); } catch (er) { } }, 30);
  },
  closeSign(save, silent) {
    if (this.screen !== 'sign') return;
    const q = this.signPos, w = game.world;
    if (save && q && w) {
      const e = w.getEnt(q.x, q.y, q.z);
      if (e && e.t === 'sign') { const a = $('signL1').value.trim().slice(0, 14), b = $('signL2').value.trim().slice(0, 14); e.s = b ? a + '\n' + b : a; w.touch(q.x, q.y, q.z); signs.at = 0; sfx('place_wood', 0.6); }
    }
    this.screen = null; this.signPos = null;
    $('signScr').classList.remove('on'); $('app').classList.remove('uiopen');
    if (document.activeElement && document.activeElement.blur) document.activeElement.blur();
    if (!silent && game.state === 'playing') requestLock(true);
  },
  close(silent) {
    if (!this.screen) return;
    if (this.screen === 'map') { map.closeMap(silent); return; }
    if (this.screen === 'sign') { this.closeSign(false, silent); return; }
    if (this.enchS) { for (const s of this.enchS) if (s) { const left = player.give(s.id, s.n, s.d); if (left) spawnDrop(player.x, player.eyeY() - 0.3, player.z, s.id, left, s.d); } this.enchS = null; }
    for (let i = 0; i < this.craft.length; i++) { const s = this.craft[i]; if (s) { const left = player.give(s.id, s.n, s.d); if (left) spawnDrop(player.x, player.eyeY() - 0.3, player.z, s.id, left, s.d); this.craft[i] = null; } }
    this.craft = [];
    if (player.cursor) { const s = player.cursor; const left = player.give(s.id, s.n, s.d); if (left) this.dropStack({ id: s.id, n: left, d: s.d }); player.cursor = null; }
    if (this.entPos) game.world.touch(this.entPos.x, this.entPos.y, this.entPos.z);
    if (this.screen === 'chest' && !silent) sfx('chest', 0.6);
    this.screen = null; this.ent = null; this.entPos = null; this.slots = [];
    $('screen').classList.remove('on'); $('app').classList.remove('uiopen'); $('cursorItem').style.display = 'none'; $('tip').style.display = 'none';
    player.invDirty = true;
    if (!silent && game.state === 'playing') requestLock(true);
  },
  toggleInv() { if (this.screen) this.close(); else if (game.state === 'playing' && !player.dead) { this.open('inv'); sfx('click'); } },
  dropStack(s) { const fx = -Math.sin(player.yaw), fz = -Math.cos(player.yaw); spawnDrop(player.x + fx * 0.4, player.eyeY() - 0.35, player.z + fz * 0.4, s.id, s.n, s.d, fx * 5, 2, fz * 5, 30); },
  dropCursor() { if (!player.cursor) return; this.dropStack(player.cursor); player.cursor = null; sfx('pop', 0.5); this.refresh(); },
  refresh() {
    if (!this.screen) return;
    if (this.craft.length) this.recipe = matchGrid(this.craft, this.craftW);
    if (this.screen === 'ench') this.paintEnch();
    for (const r of this.slots) {
      const q = this.getS(r); this.paintSlot(r.el, q);
      if (r.t === 'armor') { r.el.classList.toggle('ghost', !q); if (!q) r.el.querySelector('i').style.backgroundImage = 'url(' + ICON_URL[r.i === 4 ? I.shield : I['iron_' + ARMOR_TYPES[r.i][0]]] + ')'; }   // 空の防具のマスには「ここに何を入れるか」の うすい絵
    }
    const dl = document.querySelector('#scrTop .doll'); if (dl && dl._ac !== armorCode(player.armor)) this.paintDoll(dl);
    const c = $('cursorItem'), s = player.cursor;
    if (s && this.slots[0] && this.slots[0].el) c.style.setProperty('--s', this.slots[0].el.offsetWidth + 'px');   // つかんだ物の大きさを マスに合わせる
    if (s) { c.style.display = 'block'; c.firstChild.style.backgroundImage = 'url(' + ICON_URL[s.id] + ')'; c.lastChild.textContent = s.n > 1 ? s.n : ''; if (this._cx !== undefined) this.moveCursor(this._cx, this._cy); $('scrInfo').textContent = '持っている物：' + itemName(s.id) + (s.n > 1 ? ' ×' + s.n : ''); }
    else c.style.display = 'none';
    if (this.screen === 'inv' || this.screen === 'table') this.paintRecipes();
  },
  canPut(r, s) {
    if (r.t === 'result' || r.t === 'fout' || r.t === 'pal') return false;
    if (r.t === 'armor') return !!ITEMS[s.id].armor && ITEMS[s.id].armor.slot === r.i;
    if (r.t === 'ffuel') return !!FUEL[s.id];
    if (r.t === 'ench') return r.i === 0 ? !!enchKind(s.id) : s.id === I.glow_dust;
    return true;
  },
  slotClick(idx, btn, shift) {
    const r = this.slots[idx]; if (!r) return;
    const cur = player.cursor, s = this.getS(r);
    if (r.t === 'trash') { if (cur) { player.cursor = null; sfx('pop', 0.4); } this.refresh(); return; }
    if (r.t === 'pal') {
      if (cur && cur.id === r.id && btn === 0) cur.n = Math.min(maxStack(r.id), cur.n + 1);
      else player.cursor = { id: r.id, n: btn === 2 ? 1 : maxStack(r.id), d: 0 };
      if (shift) { player.give(r.id, maxStack(r.id), 0); player.cursor = cur; }
      sfx('click', 0.4); this.refresh(); return;
    }
    if (r.t === 'result') { this.takeResult(shift); return; }
    if (shift && s) { this.quickMove(r, s); this.afterChange(r); return; }
    if (!cur) {
      if (!s) return;
      if (btn === 2 && s.n > 1) { const k = Math.ceil(s.n / 2); player.cursor = { id: s.id, n: k, d: s.d }; s.n -= k; }
      else { player.cursor = s; this.setS(r, null); }
      if (r.t === 'fout') { game.onStat('smelt', s.id); player.smeltXp(s.id, player.cursor.n); }
    } else if (r.t === 'fout') {
      if (s && s.id === cur.id && !s.d && cur.n + s.n <= maxStack(s.id)) { cur.n += s.n; this.setS(r, null); game.onStat('smelt', s.id); player.smeltXp(s.id, s.n); }
      else { sfx('deny', 0.4); return; }
    } else if (!this.canPut(r, cur)) { sfx('deny', 0.4); return; }
    else {
      const max = r.t === 'armor' ? 1 : maxStack(cur.id);
      if (!s) { const k = btn === 2 ? 1 : Math.min(cur.n, max); this.setS(r, { id: cur.id, n: k, d: cur.d }); cur.n -= k; if (cur.n <= 0) player.cursor = null; }
      else if (s.id === cur.id && !s.d && !cur.d && max > 1) { const k = Math.min(btn === 2 ? 1 : cur.n, max - s.n); s.n += k; cur.n -= k; if (cur.n <= 0) player.cursor = null; }
      else { if (cur.n > max) return; player.cursor = s; this.setS(r, cur); }
    }
    this.afterChange(r); sfx('click', 0.35); this.refresh();
  },
  afterChange(r) {
    player.invDirty = true;
    if (this.entPos) game.world.touch(this.entPos.x, this.entPos.y, this.entPos.z);
    if (r.t === 'armor') { sfx('equip', 0.5); game.onStat('armor', 0); }
  },
  quickMove(r, s) {
    const putArr = (arr, from, to) => {
      const max = maxStack(s.id);
      if (max > 1 && !s.d) for (let i = from; i < to && s.n > 0; i++) { const o = arr[i]; if (o && o.id === s.id && !o.d && o.n < max) { const k = Math.min(s.n, max - o.n); o.n += k; s.n -= k; } }
      for (let i = from; i < to && s.n > 0; i++) if (!arr[i]) { arr[i] = { id: s.id, n: s.n, d: s.d }; s.n = 0; }
    };
    const def = ITEMS[s.id];
    if (r.t === 'inv') {
      if (this.screen === 'chest') putArr(this.ent.items, 0, 27);
      else if (this.screen === 'furnace') {
        const k = SMELT[s.id] ? 'in' : FUEL[s.id] ? 'fuel' : null;
        if (k) { const o = this.ent[k]; if (!o) { this.ent[k] = { id: s.id, n: s.n, d: s.d }; s.n = 0; } else if (o.id === s.id && !o.d) { const m = Math.min(s.n, maxStack(s.id) - o.n); o.n += m; s.n -= m; } }
        else if (r.i < 9) putArr(player.inv, 9, 36); else putArr(player.inv, 0, 9);
      } else if (def.armor && !player.armor[def.armor.slot]) { player.armor[def.armor.slot] = { id: s.id, n: 1, d: s.d }; s.n--; sfx('equip', 0.5); game.onStat('armor', 0); }
      else if (r.i < 9) putArr(player.inv, 9, 36); else putArr(player.inv, 0, 9);
    } else { const n0 = s.n; s.n = player.give(s.id, s.n, s.d); if (r.t === 'fout') { game.onStat('smelt', s.id); player.smeltXp(s.id, n0 - s.n); } }
    if (s.n <= 0) this.setS(r, null);
    sfx('click', 0.35); this.refresh();
  },
  // 持ち物の画面の まん中に出す 自分の姿（前から見た絵。生き物の絵の画像から 体の前の面だけを ならべる）
  paintDoll(cv) {
    const src = MOB_CV, m = MODELS.pl0; if (!src || !m) return;
    const c = cv.getContext('2d'); c.imageSmoothingEnabled = false; c.clearRect(0, 0, 16, 32);
    const P = { head: [4, 0], body: [4, 8], arm0: [12, 8], arm1: [0, 8], leg0: [8, 20], leg1: [4, 20] };
    for (const p of m) { const d = P[p.id]; if (!d) continue; const uv = p.uv[5]; c.drawImage(src, uv[0], uv[1], uv[2], uv[3], d[0], d[1], uv[2], uv[3]); }
    const ac = armorCode(player.armor), col = (mi) => { const q = ARMOR_RGB[mi - 1]; return 'rgb(' + Math.round(q[0] * 235) + ',' + Math.round(q[1] * 235) + ',' + Math.round(q[2] * 235) + ')'; };   // 身につけた防具を 姿にも出す
    if (ac & 3) { c.fillStyle = col(ac & 3); c.fillRect(4, 0, 8, 2); c.fillRect(4, 2, 1, 4); c.fillRect(11, 2, 1, 4); }
    if ((ac >> 2) & 3) { c.fillStyle = col((ac >> 2) & 3); c.fillRect(4, 8, 8, 11); c.fillRect(0, 8, 4, 5); c.fillRect(12, 8, 4, 5); }
    if ((ac >> 4) & 3) { c.fillStyle = col((ac >> 4) & 3); c.fillRect(4, 19, 8, 9); }
    if ((ac >> 6) & 3) { c.fillStyle = col((ac >> 6) & 3); c.fillRect(4, 28, 8, 4); }
    cv._ac = ac;
  },
  // ちからの台：えらべる力を3つ ならべる（1つ目の名前だけ見える。レベルと粉が足りないものは おせない）
  paintEnch() {
    const box = $('enchOpts'); if (!box || !this.enchS) return;
    const it = this.enchS[0], dust = this.enchS[1], nd = dust ? dust.n : 0; let h = '';
    if (!it) h = '<div class="dim">左のマスに 道具・武器・防具、右のマスに「ひかりの粉」を置こう</div>';
    else if (enchAny(it.d)) h = '<div class="dim">これには もう力が こもっている：' + esc(enchList(it.id, it.d).join('・')) + '</div>';
    else for (let t = 0; t < 3; t++) {
      const names = enchList(it.id, enchRoll(it.id, t, player.enchSeed)), lvOk = player.mode === 1 || player.xpLv >= ENCH_NEED[t], ok = lvOk && nd >= t + 1;
      h += '<button type="button" class="btn enchb" data-t="' + t + '"' + (ok ? '' : ' disabled') + '><span>' + esc(names[0] || '') + (names.length > 1 ? ' ほか' : '') + '</span><small>' + (lvOk ? '' : 'レベル' + ENCH_NEED[t] + 'から ／ ') + (t + 1) + 'レベルと 粉' + (t + 1) + 'こ</small></button>';
    }
    if (box._h !== h) { box.innerHTML = h; box._h = h; }
    $('scrInfo').textContent = '力をこめると レベルと「ひかりの粉」を使います（今のレベル ' + player.xpLv + '）';
  },
  doEnch(t) {
    const it = this.enchS && this.enchS[0], dust = this.enchS && this.enchS[1];
    if (!it || enchAny(it.d) || !dust || dust.n < t + 1 || (player.mode !== 1 && player.xpLv < ENCH_NEED[t])) { sfx('deny', 0.4); return; }
    const d = enchRoll(it.id, t, player.enchSeed); if (!d) { sfx('deny', 0.4); return; }
    player.spendLevels(t + 1); dust.n -= t + 1; if (dust.n <= 0) this.enchS[1] = null;
    it.d = itemDmg(it.d) | d; player.enchSeed = (Math.random() * 0x7fffffff) | 0;
    sfx('enchant'); this.toast('力が こもった！ ' + enchList(it.id, it.d).join('・'), 4); game.onStat('ench', 0);
    const p = this.enchPos; if (p) for (let i = 0; i < 3; i++) fxPuff(p.x + 0.5, p.y + 1.2 + i * 0.3, p.z + 0.5, 12, 0.6, 0.95, 0.9, { glow: true, speed: 1.6, life: 1.0, size: 0.07, up: 1.2, grav: 0, spread: 0.5 });
    const el = this.slots.find(r => r.t === 'ench' && r.i === 0); if (el && el.el) { el.el.classList.remove('flash'); void el.el.offsetWidth; el.el.classList.add('flash'); }
    this.refresh();
  },
  consumeGrid() { for (let i = 0; i < this.craft.length; i++) { const s = this.craft[i]; if (s) { s.n--; if (s.n <= 0) this.craft[i] = null; } } },
  takeResult(shift) {
    let r = this.recipe; if (!r) return;
    const el = this.slots.find(o => o.t === 'result').el;
    if (shift) { let guard = 64; while (r && guard-- > 0 && player.canTake(r.out, 0)) { const left = player.give(r.out, r.n, 0); if (left) { this.dropStack({ id: r.out, n: left, d: 0 }); } this.consumeGrid(); game.onCraft(r); r = matchGrid(this.craft, this.craftW); if (!r || r !== this.recipe) break; } }
    else {
      const cur = player.cursor;
      if (!cur) player.cursor = { id: r.out, n: r.n, d: 0 };
      else if (cur.id === r.out && cur.n + r.n <= maxStack(r.out) && !cur.d) cur.n += r.n;
      else return;
      this.consumeGrid(); game.onCraft(r);
    }
    el.classList.remove('flash'); void el.offsetWidth; el.classList.add('flash');
    sfx('craft'); player.invDirty = true; this.refresh();
  },
  canCraft(r) { for (const [spec, n] of r.need) if (player.countSpec(spec) < n) return false; return true; },
  craftFromList(r, many, rowEl) {
    if (r.table && this.screen !== 'table') { this.toast('これは作業台で作ります'); sfx('deny', 0.4); return; }
    let times = many ? Math.floor(maxStack(r.out) / r.n) : 1, made = 0;
    while (times-- > 0 && this.canCraft(r) && player.canTake(r.out, 0)) {
      for (const [spec, n] of r.need) player.consumeSpec(spec, n);
      const left = player.give(r.out, r.n, 0); if (left) this.dropStack({ id: r.out, n: left, d: 0 });
      game.onCraft(r); made++;
    }
    if (!made) { sfx('deny', 0.4); return; }
    sfx('craft'); this.pickupFx(r.out, made * r.n);
    this.refresh();
    const row = $('recList').querySelector('[data-rr="' + RECIPES.indexOf(r) + '"]'); if (row) { row.classList.remove('flash'); void row.offsetWidth; row.classList.add('flash'); }
  },
  paintRecipes() {
    const tabs = [['ok', 'いま作れる'], ['tool', '道具・装備'], ['block', 'ブロック'], ['build', 'かたち'], ['color', '色'], ['food', '食べ物'], ['misc', 'そのほか']];
    const tb = $('recTabs');
    if (!tb.children.length) for (const [k, n] of tabs) { const b = document.createElement('button'); b.type = 'button'; b.className = 'btn sm'; b.dataset.t = k; b.textContent = n; tb.appendChild(b); }
    for (const b of tb.children) b.classList.toggle('on', b.dataset.t === this.recTab);
    const atTable = this.screen === 'table', list = $('recList'), st = list.scrollTop;
    let html = '';
    RECIPES.forEach((r, ri) => {
      const ok = this.canCraft(r), here = !r.table || atTable;
      if (this.recTab === 'ok' ? !(ok && here) : r.cat !== this.recTab) return;
      let need = '';
      for (const [spec, n] of r.need) {
        const have = player.countSpec(spec), nm = typeof spec === 'number' ? itemName(spec) : TAG_NAMES[spec], ic = typeof spec === 'number' ? spec : TAGS[spec][0];
        need += '<span class="' + (have >= n ? '' : 'no') + '"><i style="background-image:url(' + ICON_URL[ic] + ')"></i>' + esc(nm) + ' ' + Math.min(have, 999) + '/' + n + '</span>';
      }
      if (!here) need += '<span class="no">作業台が必要</span>';
      html += '<div class="rec' + (ok && here ? ' ok' : '') + '" data-rr="' + ri + '"><i style="background-image:url(' + ICON_URL[r.out] + ')"></i><div class="nm">' + esc(itemName(r.out)) + (r.n > 1 ? ' ×' + r.n : '') + '</div><div class="need">' + need + '</div><button type="button" class="btn sm' + (ok && here ? ' pri' : '') + '" data-r="' + ri + '"' + (ok && here ? '' : ' disabled') + '>つくる</button></div>';
    });
    if (!html) html = '<p class="dim" style="padding:6px">' + (this.recTab === 'ok' ? 'いま作れる物はありません。まずは木をなぐって原木を集め、「板」を作りましょう。ほかのタブで必要な材料を調べられます。' : 'ありません') + '</p>';
    if (html !== this._recHtml) { this._recHtml = html; list.innerHTML = html; list.scrollTop = st; }
  },
  paintFurnace() {
    const e = this.ent; if (!e) return;
    const f = $('furnFire'), a = $('furnArrow'); if (!f) return;
    f.firstChild.style.height = (e.burn > 0 && e.burnMax ? Math.max(8, e.burn / e.burnMax * 100) : 0) + '%';
    a.firstChild.style.width = (e.cook / SMELT_TIME * 100) + '%';
    const key = (e.in ? e.in.id + ':' + e.in.n : '-') + (e.fuel ? e.fuel.id + ':' + e.fuel.n : '-') + (e.out ? e.out.id + ':' + e.out.n : '-');
    if (key !== this._fk) { this._fk = key; for (const r of this.slots) if (r.o) this.paintSlot(r.el, this.getS(r)); }
  },

  // ---------- 入力 ----------
  bindInput() {
    const cv = $('gl'), app = $('app');
    app.addEventListener('contextmenu', (e) => e.preventDefault());
    window.addEventListener('keydown', (e) => {
      if (this.keyWait) { e.preventDefault(); if (!e.repeat) this.takeKey(e.code); return; }
      if (e.target && e.target.tagName === 'INPUT') return;
      const c = e.code, K = settings.keys;
      if (game.state === 'playing' || game.state === 'paused') { if (c === 'Space' || c === 'Tab' || c === 'F3' || c === 'F5' || c.startsWith('Arrow') || c === 'Quote' || c === 'Slash' || Object.values(K).includes(c)) e.preventDefault(); }
      if (e.repeat) return;
      keys[c] = true;
      if (c === 'Escape') { if (this.screen) this.close(); else if (this.menu && this.menuStack.length) this.back(); else if (game.state === 'playing') game.pause(); else if (game.state === 'paused' && performance.now() - game.pausedAt > 350) game.resume(); return; }
      if (game.state !== 'playing') return;
      if (c === K.inv) { this.toggleInv(); return; }
      if (c === K.map && this.screen === 'map') { this.close(); return; }
      if (this.screen) return;
      let hot = -1; for (let i = 1; i <= 9; i++) if (K['hot' + i] === c) hot = i - 1;
      if (hot >= 0) player.sel = hot;
      else if (c === K.drop) { const s = player.held(); if (s && !player.dead) { this.dropStack({ id: s.id, n: 1, d: s.d }); if (player.mode === 0) { s.n--; if (s.n <= 0) player.inv[player.sel] = null; } player.invDirty = true; } }
      else if (c === K.jump) { const now = performance.now(); if (now - lastJumpTap < 300) player.toggleFly(); lastJumpTap = now; }
      else if (c === K.fwd) { const now = performance.now(); if (settings.sprintTap && now - lastWTap < 340) sprintLatch = true; lastWTap = now; }
      else if (c === K.sneak) { if (settings.sneakToggle) sneakLatch = !sneakLatch; }
      else if (c === K.view) { settings.view = (settings.view + 1) % 3; saveSettings(); this.toast(['自分の目から見ます', 'うしろから見ます', '前から見ます'][settings.view], 2); }
      else if (c === K.map) map.toggle();
      else if (c === K.info || c === 'F3') { if (c === 'F3') game.debug = !game.debug; else { settings.showInfo = !settings.showInfo; saveSettings(); } this.infoT = 0; }
    });
    window.addEventListener('keyup', (e) => { keys[e.code] = false; if (e.code === settings.keys.fwd) sprintLatch = false; });
    window.addEventListener('blur', () => { for (const k in keys) keys[k] = false; mouseL = mouseR = false; sprintLatch = false; });
    cv.addEventListener('mousedown', (e) => {
      if (game.state !== 'playing' || this.screen || touchSt.touchUsed && e.sourceCapabilities && e.sourceCapabilities.firesTouchEvents) return;
      audio.unlock();
      if (!pointerLocked) requestLock(true);
      const btn = settings.swapMouse ? (e.button === 0 ? 2 : e.button === 2 ? 0 : e.button) : e.button;
      if (btn === 0) { mouseL = true; input.breakPressed = true; }
      else if (btn === 2) { mouseR = true; input.usePressed = true; }
      else if (btn === 1) { e.preventDefault(); const t = player.target; if (t && player.mode === 1 && ITEMS[t.id]) { player.inv[player.sel] = { id: t.id, n: 1, d: 0 }; player.invDirty = true; } }
    });
    window.addEventListener('mouseup', (e) => { const btn = settings.swapMouse ? (e.button === 0 ? 2 : e.button === 2 ? 0 : e.button) : e.button; if (btn === 0) mouseL = false; else if (btn === 2) mouseR = false; });
    window.addEventListener('mousemove', (e) => {
      const r = cv.getBoundingClientRect();
      mouseNdc[0] = ((e.clientX - r.left) / r.width) * 2 - 1; mouseNdc[1] = 1 - ((e.clientY - r.top) / r.height) * 2;
      if (game.state !== 'playing' || this.screen || touchSt.lookActive) return;
      if (pointerLocked || e.target === cv) { const k = settings.sens * 0.00021; input.lookDX += clamp(e.movementX || 0, -200, 200) * k; input.lookDY += clamp(e.movementY || 0, -200, 200) * k * (settings.invertY ? -1 : 1); }
    });
    cv.addEventListener('wheel', (e) => { e.preventDefault(); if (game.state !== 'playing' || this.screen) return; player.sel = (player.sel + (e.deltaY > 0 ? 1 : 8)) % 9; }, { passive: false });
    document.addEventListener('pointerlockchange', () => {
      pointerLocked = document.pointerLockElement === cv;
      app.classList.toggle('free', !pointerLocked);
      if (pointerLocked) { this.hint(''); return; }
      mouseL = mouseR = false;
      if (this.expectUnlock) { this.expectUnlock = false; return; }
      if (game.state === 'playing' && !this.screen && !player.dead) game.pause();
    });
    document.addEventListener('pointerlockerror', () => { if (game.state === 'playing' && !touchSt.touchUsed) this.hint('マウスを固定できないときは、そのままマウスを動かすか、矢印キーで見回せます'); });
    // ---- タッチ ----
    const ndc = (t) => { const r = cv.getBoundingClientRect(); return [((t.clientX - r.left) / r.width) * 2 - 1, 1 - ((t.clientY - r.top) / r.height) * 2]; };
    const markTouch = () => { if (!touchSt.touchUsed) { touchSt.touchUsed = true; app.classList.add('touch'); if (!settings.touchInit) { settings.touchInit = true; settings.viewDist = Math.min(settings.viewDist, 5); settings.quality = Math.min(settings.quality, 0.8); settings.autoJump = true; settings.fancyLeaves = false; settings.autoQ = true; applySettings(); saveSettings(); } } audio.unlock(); };
    window.addEventListener('touchstart', markTouch, { passive: true, capture: true });
    cv.addEventListener('touchstart', (e) => { e.preventDefault(); if (game.state !== 'playing') return; for (const t of e.changedTouches) touchSt.look.set(t.identifier, { x: t.clientX, y: t.clientY, x0: t.clientX, y0: t.clientY, t0: performance.now(), mode: 0, n: ndc(t) }); }, { passive: false });
    cv.addEventListener('touchmove', (e) => {
      e.preventDefault();
      for (const t of e.changedTouches) {
        const l = touchSt.look.get(t.identifier); if (!l) continue;
        const dx = t.clientX - l.x, dy = t.clientY - l.y; l.x = t.clientX; l.y = t.clientY; l.n = ndc(t);
        if (l.mode === 0 && Math.hypot(t.clientX - l.x0, t.clientY - l.y0) > 12) l.mode = 1;
        if (l.mode === 1) { const k = settings.touchSens * 0.00055; input.lookDX += dx * k; input.lookDY += dy * k * (settings.invertY ? -1 : 1); }
        else if (l.mode === 2) input.rayNdc = l.n;
      }
    }, { passive: false });
    const endLook = (e) => {
      e.preventDefault();
      for (const t of e.changedTouches) {
        const l = touchSt.look.get(t.identifier); if (!l) continue;
        touchSt.look.delete(t.identifier);
        if (l.mode === 0 && performance.now() - l.t0 < Math.min(320, settings.holdMs - 10) && game.state === 'playing') { input.rayNdc = l.n; input.tapPending = true; touchSt.rayHold = 3; }
        else if (l.mode === 2) { input.rayNdc = null; }
      }
    };
    cv.addEventListener('touchend', endLook, { passive: false }); cv.addEventListener('touchcancel', endLook, { passive: false });
    const stick = $('stick'), base = $('stickBase'), knob = $('stickKnob');
    const stickMove = (t) => { const s = touchSt.stick; let dx = t.clientX - s.x, dy = t.clientY - s.y; const d = Math.hypot(dx, dy), m = 52 * settings.touchSize; if (d > m) { dx *= m / d; dy *= m / d; } touchSt.sx = dx / m; touchSt.sy = dy / m; touchSt.mag = Math.min(1, d / m); knob.style.transform = 'translate(' + dx + 'px,' + dy + 'px)'; };
    stick.addEventListener('touchstart', (e) => { e.preventDefault(); if (touchSt.stick) return; const t = e.changedTouches[0], r = stick.getBoundingClientRect(); touchSt.stick = { id: t.identifier, x: t.clientX, y: t.clientY }; base.style.left = (t.clientX - r.left) + 'px'; base.style.top = (t.clientY - r.top) + 'px'; base.style.bottom = 'auto'; stickMove(t); }, { passive: false });
    stick.addEventListener('touchmove', (e) => { e.preventDefault(); for (const t of e.changedTouches) if (touchSt.stick && t.identifier === touchSt.stick.id) stickMove(t); }, { passive: false });
    const stickEnd = (e) => { e.preventDefault(); for (const t of e.changedTouches) if (touchSt.stick && t.identifier === touchSt.stick.id) { touchSt.stick = null; touchSt.sx = touchSt.sy = touchSt.mag = 0; knob.style.transform = ''; base.style.left = ''; base.style.top = ''; base.style.bottom = ''; } };
    stick.addEventListener('touchend', stickEnd, { passive: false }); stick.addEventListener('touchcancel', stickEnd, { passive: false });
    const hold = (id, key, onDown) => { const el = $(id); el.addEventListener('touchstart', (e) => { e.preventDefault(); touchSt[key] = true; el.classList.add('on'); if (onDown) onDown(); }, { passive: false }); const up = (e) => { e.preventDefault(); touchSt[key] = false; el.classList.remove('on'); }; el.addEventListener('touchend', up, { passive: false }); el.addEventListener('touchcancel', up, { passive: false }); };
    hold('tJump', 'jump', () => { const now = performance.now(); if (now - lastJumpTap < 300) player.toggleFly(); lastJumpTap = now; });
    hold('tBreak', 'brk', () => { input.breakPressed = true; input.rayNdc = null; });
    hold('tUse', 'use', () => { input.usePressed = true; input.rayNdc = null; });
    $('tSneak').addEventListener('touchstart', (e) => { e.preventDefault(); touchSt.sneak = !touchSt.sneak; $('tSneak').classList.toggle('on', touchSt.sneak); }, { passive: false });
    $('tInv').addEventListener('touchstart', (e) => { e.preventDefault(); this.toggleInv(); }, { passive: false });
    $('tPause').addEventListener('touchstart', (e) => { e.preventDefault(); game.pause(); }, { passive: false });
    $('tInv').addEventListener('click', () => { if (!touchSt.touchUsed) this.toggleInv(); }); $('tPause').addEventListener('click', () => { if (!touchSt.touchUsed) game.pause(); });
  },
  // 毎フレーム：キーやスティックの状態を動きに変える
  pollInput(dt) {
    const K = settings.keys;
    let f = (keys[K.fwd] ? 1 : 0) - (keys[K.back] ? 1 : 0), s = (keys[K.right] ? 1 : 0) - (keys[K.left] ? 1 : 0);
    if (touchSt.stick) { f -= touchSt.sy; s += touchSt.sx; }
    input.fwd = clamp(f, -1, 1); input.strafe = clamp(s, -1, 1);
    input.jump = !!keys[K.jump] || touchSt.jump;
    input.sneak = (settings.sneakToggle ? sneakLatch : !!keys[K.sneak] || (K.sneak === 'ShiftLeft' && !!keys.ShiftRight)) || touchSt.sneak;
    input.sprint = !!keys[K.sprint] || sprintLatch || (touchSt.mag > 0.94 && touchSt.sy < -0.75);
    const ar = 2.0 * dt;
    if (keys.ArrowLeft) input.lookDX -= ar; if (keys.ArrowRight) input.lookDX += ar; const iy = settings.invertY ? -1 : 1; if (keys.ArrowUp) input.lookDY -= ar * 0.8 * iy; if (keys.ArrowDown) input.lookDY += ar * 0.8 * iy;
    if (!pointerLocked && !touchSt.touchUsed && game.state === 'playing' && !this.screen && document.hasFocus()) {
      // マウスを固定できないとき：画面の端に寄せると回り続ける
      const ex = Math.abs(mouseNdc[0]) > 0.84 ? Math.sign(mouseNdc[0]) * (Math.abs(mouseNdc[0]) - 0.84) / 0.16 : 0, ey = Math.abs(mouseNdc[1]) > 0.8 ? Math.sign(mouseNdc[1]) * (Math.abs(mouseNdc[1]) - 0.8) / 0.2 : 0;
      if (this._edgeOn) { input.lookDX += clamp(ex, -1, 1) * 2.4 * dt; input.lookDY -= clamp(ey, -1, 1) * 1.6 * dt; }
    }
    let anyBreak = false;
    if (touchSt.touchUsed) {
      const now = performance.now();
      touchSt.lookActive = touchSt.look.size > 0;
      for (const l of touchSt.look.values()) { if (l.mode === 0 && now - l.t0 > settings.holdMs) { l.mode = 2; input.breakPressed = true; input.rayNdc = l.n; } if (l.mode === 2) anyBreak = true; }
      if (!anyBreak) { if (touchSt.rayHold > 0) { if (--touchSt.rayHold === 0) input.rayNdc = null; } else if (!input.tapPending) input.rayNdc = null; }
    }
    input.breakHeld = mouseL || touchSt.brk || anyBreak;
    input.useHeld = mouseR || touchSt.use;
  }
};
// マウスを画面に固定する。gesture: クリックなどの操作から呼ばれたか
function requestLock(gesture) {
  if (touchSt.touchUsed) return;
  const cv = $('gl');
  try { cv.focus({ preventScroll: true }); const p = cv.requestPointerLock(); if (p && p.catch) p.catch(() => { if (gesture) ui._edgeOn = true; }); } catch (e) { if (gesture) ui._edgeOn = true; }
  if (gesture) setTimeout(() => { if (!pointerLocked && game.state === 'playing' && !ui.screen) { ui._edgeOn = true; ui.hint('マウスを動かすと見回せます（画面の端に寄せると回り続けます。矢印キーでも回せます）'); setTimeout(() => ui.hint(''), 7000); } }, 900);
}
function howtoHtml() {
  const K = settings.keys, k = (a) => '<kbd>' + esc(keyName(K[a])) + '</kbd>';
  return `
<dt>パソコン</dt>
<dd>${k('fwd')} ${k('left')} ${k('back')} ${k('right')} 歩く ／ ${k('jump')} ジャンプ ／ ${k('sneak')} しゃがむ</dd>
<dd>${settings.sprintTap ? k('fwd') + ' をすばやく2回、または ' : ''}${k('sprint')} を押しながら進むと走れます</dd>
<dd>マウスで見回す ／ ${settings.swapMouse ? '右' : '左'}ボタンを押しっぱなしでこわす・攻撃 ／ ${settings.swapMouse ? '左' : '右'}ボタンで置く・使う（食べ物は押しっぱなし）</dd>
<dd>${k('hot1')}〜${k('hot9')} かホイールで持ち物を選ぶ ／ ${k('inv')} 持ち物 ／ ${k('drop')} 捨てる ／ ${k('view')} 視点の切りかえ ／ <kbd>Esc</kbd> メニュー</dd>
<dd>${k('map')} 地図（歩いた所が描かれていきます。クリックで しるしを置けます）</dd>
<dd>キーの割り当ては「設定」の「キー」で変えられます</dd>
<dt>スマホ・タブレット</dt>
<dd>左下のスティックで歩き、画面をなぞって見回します</dd>
<dd>ブロックを長押しでこわす、軽くタップで置く・使う。右下のボタンでも同じことができます</dd>
<dd>食べ物は「つかう」を押しっぱなしで食べます</dd>
<dd>左上の小さな地図をタップすると、大きな地図が開きます</dd>
<dt>まずやること</dt>
<dd>木をなぐって原木を集める → 持ち物を開いて「板」「作業台」を作る → 作業台を置いて道具を作る</dd>
<dd>夜になると敵が出ます。たいまつで明るくした家にこもるか、ベッドで朝まで眠りましょう</dd>
<dd>次に何をするか迷ったら「開拓ノート」に目標が順番に書いてあります</dd>
<dt>畑と動物</dt>
<dd>クワでたがやした土に、種・ニンジン・ジャガイモを植えます。近くに水があるとよく育ちます。草をかると いろいろな種が出ます</dd>
<dd>同じ動物2ひきに好物をあげると、子どもが生まれます（ウシ・ヒツジ＝小麦、ブタ＝ニンジン・ジャガイモ、ニワトリ＝種）。好物を持っていると ついてきます</dd>
<dd>ハサミでヒツジの毛、バケツでウシのミルク。ヒツジに染料を使うと毛の色が変わります。ニワトリはときどき たまごを生みます</dd>
<dd>森にいるイヌに肉をあげると、なつくことがあります。なついたイヌに「使う」で おすわり／ついてくる</dd>
<dt>弓矢と盾</dt>
<dd>弓は「使う」を長くおして引き、はなすと矢が飛びます（1秒でいっぱい。長く引くほど遠くへ強く）。スマホは軽くタップでも、自動で引いてうちます</dd>
<dd>矢は 火打ち石・棒・羽根で4本。ブロックにささった矢は 少しすると落ちて、ひろえます</dd>
<dd>盾は 持ち物の「盾」のマスに入れます。「使う」をおしている間 かまえて、前から来た こうげき・矢・ばくはつを ふせぎます（歩くのは おそくなります）</dd>
<dd>夜の敵：ユミカゲ（矢をうつ）、バクダケ（そばで ふくらんで はじける。はなれると しぼむ）、イトハキ（糸で足をおそくする。糸を落とす）</dd>
<dt>経験値と ちからの台</dt>
<dd>敵をたおす・鉱石をほる・かまどで焼く・動物をふやす と、緑の玉（経験値）が出ます。ひろうと 手もとの上の 緑のバーがのびて、レベルが上がります</dd>
<dd>「ちからの台」（黒曜石4・ダイヤ2・ひかりの粉1）に、道具・武器・防具と「ひかりの粉」を置くと、力をこめられます（するどさ・はやほり・まもり など）。強い力ほど 高いレベルがいります</dd>
<dd>力つきると、レベルは0にもどり、経験値の一部が その場に落ちます</dd>
<dt>くすり</dt>
<dd>ガラス3こで「ガラスびん」。水に使うと「水入りびん」になります。水入りびん＋ホムラの粉＋材料で くすりができます（作業台なら 3本まとめて）</dd>
<dd>スイカ＝いやし、ひかりの粉＝さいせい、羽根＝はやあし、カゲのかけら＝ちから、マグマ石＝ひよけ、ニンジン＝よめ（暗い所が見える）。食べ物と同じように のみます</dd>
<dt>べつの世界</dt>
<dd>黒曜石で四角いわく（内がわが よこ2×たて3以上）を作り、内がわに「火打ち金」を使うと「ホムラの門」がひらきます。中にしばらく立つと「ホムラの底」へ</dd>
<dd>ホムラの底の1ブロックは、もとの世界の8ブロックぶん。力つきると、もとの世界の復活地点にもどります</dd>
<dd>その先のことは「開拓ノート」に順番に書いてあります</dd>
<dt>クリエイティブ</dt>
<dd>ジャンプをすばやく2回で空を飛べます（ジャンプで上がり、しゃがむで下がります）</dd>
<dt>セーブについて</dt>
<dd>20秒ごとと、メニューを開いたときに自動で保存されます。保存先はこの端末のブラウザの中です。大事な世界は「つづきから」の「書き出す」でファイルに残せます</dd>
<dt>みんなで遊ぶ</dt>
<dd>「みんなの世界」は中継サーバーに保存され、コードを知っている友だちがいつでも入れます。メニューの「招待リンクをコピー」で友だちを呼べます</dd>
<dd>全員がベッドに入ると朝になります。メニューを開いていても世界は止まりません</dd>`;
}
