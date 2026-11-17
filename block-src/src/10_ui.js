// ===== 10_ui.js : 画面表示（体力・持ち物・メニュー）と入力（キーボード・マウス・タッチ） =====
const $ = (id) => document.getElementById(id);
const settings = { viewDist: 8, fov: 75, sens: 12, bright: 3, sfx: 7, music: 5, quality: 1, clouds: true, fancyLeaves: true, bobbing: true, autoJump: false, showInfo: true, touchInit: false, look: [0, 0, 0, 1, 0] };
function loadSettings() { try { const s = JSON.parse(localStorage.getItem('kk_settings') || 'null'); if (s) Object.assign(settings, s); } catch (e) { } settings.look = parseLook(settings.look); }
function saveSettings() { try { localStorage.setItem('kk_settings', JSON.stringify(settings)); } catch (e) { } }
function applySettings() {
  R.scale = settings.quality; R.clouds = settings.clouds; R.minLight = 0.02 + settings.bright * 0.012;
  if (meshOpts.fancyLeaves !== settings.fancyLeaves) { meshOpts.fancyLeaves = settings.fancyLeaves; if (game.world) for (const c of game.world.chunks.values()) c.dirty = 0xFF; }
  if (typeof audio !== 'undefined') audio.setVolumes();
}
function esc(s) { return String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])); }

const keys = {};
const touchSt = { stick: null, sx: 0, sy: 0, mag: 0, jump: false, sneak: false, brk: false, use: false, look: new Map(), rayHold: 0 };
let pointerLocked = false, lastJumpTap = 0, lastWTap = 0, sprintLatch = false, mouseNdc = [0, 0], mouseL = false, mouseR = false;

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
    $('howText').innerHTML = HOWTO_HTML;
    if (window.__blockOnline) { const h = $('homeLink'); h.hidden = false; try { if (window.NetDB && NetDB.hub) h.href = NetDB.hub.home(); } catch (e) { } }
    this.bindMenus(); this.bindScreen(); this.bindInput();
  },
  mkSlotEl() { const el = document.createElement('div'); el.className = 'slot'; el.innerHTML = '<i></i><b></b>'; return el; },
  paintSlot(el, s) {
    const ic = el.firstChild, cnt = ic.nextSibling;
    let u = el.querySelector('u');
    if (!s) { ic.style.backgroundImage = ''; cnt.textContent = ''; if (u) u.remove(); return; }
    ic.style.backgroundImage = 'url(' + ICON_URL[s.id] + ')';
    cnt.textContent = s.n > 1 ? s.n : '';
    const def = ITEMS[s.id], dur = def.tool ? def.tool.dur : def.armor ? def.armor.dur : 0;
    if (dur && s.d > 0) {
      if (!u) { u = document.createElement('u'); u.innerHTML = '<s></s>'; el.appendChild(u); }
      const f = Math.max(0, 1 - s.d / dur); u.firstChild.style.width = (f * 100) + '%'; u.firstChild.style.background = f > 0.5 ? '#6fd24a' : f > 0.2 ? '#f2c53d' : '#e0523a';
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
    $('status').style.visibility = creative ? 'hidden' : 'visible';
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
      if (settings.showInfo && game.world) {
        const w = game.world, h = (w.time / 1000 + 6) % 24, hh = Math.floor(h), mm = Math.floor((h - hh) * 6) * 10;
        t = 'X ' + Math.floor(p.x) + '  Y ' + Math.floor(p.y) + '  Z ' + Math.floor(p.z) + '\n' + BIOME_NAMES[w.biomeAt(Math.floor(p.x), Math.floor(p.z))] + '  ' + w.day + '日目 ' + hh + ':' + (mm < 10 ? '0' : '') + mm;
        if (game.debug) t += '\n' + game.fps + 'fps  区画' + R.stats.sections + '  生き物' + ents.length + '  チャンク' + w.chunks.size;
      }
      if (t !== this.lastInfo) { this.lastInfo = t; $('info').textContent = t; }
      const boss = game.boss && !game.boss.dead ? game.boss : null;
      $('bossbar').hidden = !boss; if (boss) $('bossFill').style.width = Math.max(0, boss.hp / boss.maxHp * 100) + '%';
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
  showHeldName() { const s = player.held(), el = $('heldname'); if (!s) { el.classList.remove('on'); return; } el.textContent = itemName(s.id); el.classList.add('on'); this.heldT = 1.6; },
  toast(msg, sec) {
    const box = $('toasts'); if (box.lastChild && box.lastChild.textContent === msg) return;
    const el = document.createElement('div'); el.className = 'toast'; el.textContent = msg; box.appendChild(el);
    while (box.children.length > 3) box.firstChild.remove();
    setTimeout(() => { el.classList.add('out'); setTimeout(() => el.remove(), 520); }, (sec || 2.6) * 1000);
  },
  hint(msg) { $('hint').textContent = msg || ''; },
  pickupFx(id, n) {
    let k = this.pick.find(o => o.id === id && !o.out);
    if (k) { k.n += n; k.t = 2.2; k.el.lastChild.textContent = '+' + k.n + ' ' + itemName(id); }
    else { const el = document.createElement('div'); el.innerHTML = '<i style="background-image:url(' + ICON_URL[id] + ')"></i><span>+' + n + ' ' + esc(itemName(id)) + '</span>'; $('pickups').appendChild(el); this.pick.push({ id, n, t: 2.2, el, out: false }); if (this.pick.length > 5) { const o = this.pick.shift(); o.el.remove(); } }
    for (let i = 0; i < 9; i++) { const s = player.inv[i]; if (s && s.id === id) { const el = $('hotbar').children[i]; el.classList.remove('pop'); void el.offsetWidth; el.classList.add('pop'); break; } }
  },
  hurtFlash() { const el = $('fxHurt'); el.classList.add('on'); requestAnimationFrame(() => requestAnimationFrame(() => el.classList.remove('on'))); },
  flash() { const el = $('fxFlash'); el.style.transition = 'none'; el.style.opacity = 0.9; requestAnimationFrame(() => requestAnimationFrame(() => { el.style.transition = ''; el.style.opacity = 0; })); },
  fade(on) { $('fxFade').style.opacity = on ? 1 : 0; },
  dark(on) { $('fxDark').style.opacity = on ? 1 : 0; },
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
    on('bHow', () => this.showMenu('mHow', true, true)); on('bHow2', () => this.showMenu('mHow', true, true));
    on('bSet', () => this.openSettings()); on('bSet2', () => this.openSettings());
    on('bStart', () => { if (this.segVal('segNet') === 1 && !net.getName()) { this.toast('先に、なまえを入れてください'); this.back(); this.openOnline(); $('inNick').focus(); return; } game.startNew($('inName').value, $('inSeed').value, this.segVal('segMode'), this.segVal('segDiff'), this.segVal('segNet') === 1, Object.assign({}, this._newRules)); });
    on('bOnline', () => this.openOnline());
    on('bJoin', () => { if (this.needName()) game.joinOnline($('inCode').value); });
    on('bNewOnline', () => { if (!this.needName()) return; this.setSeg('segNet', 1); this.showMenu('mNew', true, true); this.updNotes(); });
    on('bLook', () => this.openLook());
    on('bInvite', () => this.copyInvite());
    on('bRules', () => this.openRules());
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
    for (const id of ['segMode', 'segDiff', 'segQual', 'segNet']) $(id).addEventListener('click', (e) => {
      const b = e.target.closest('.btn'); if (!b) return; sfx('click');
      for (const o of $(id).children) o.classList.toggle('on', o === b);
      if (id === 'segQual') { settings.quality = +b.dataset.v; applySettings(); }
      else { if (id === 'segDiff') { this._newRules.keep = +b.dataset.v < 2; this.paintRuleSeg('segRules', this._newRules, true); } this.updNotes(); }
    });
    $('segTog').addEventListener('click', (e) => { const b = e.target.closest('.btn'); if (!b) return; sfx('click'); settings[b.dataset.k] = !settings[b.dataset.k]; b.classList.toggle('on', settings[b.dataset.k]); applySettings(); });
    const rng = [['sDist', 'oDist', 'viewDist', v => v + ''], ['sFov', 'oFov', 'fov', v => v + ''], ['sSens', 'oSens', 'sens', v => v + ''], ['sBright', 'oBright', 'bright', v => v + ''], ['sSfx', 'oSfx', 'sfx', v => v + ''], ['sMusic', 'oMusic', 'music', v => v + '']];
    for (const [sid, oid, key, fmt] of rng) $(sid).addEventListener('input', (e) => { settings[key] = +e.target.value; $(oid).textContent = fmt(settings[key]); applySettings(); });
    this._rng = rng;
    $('bFull').addEventListener('click', () => { sfx('click'); try { if (document.fullscreenElement) document.exitFullscreen(); else { const p = document.documentElement.requestFullscreen(); if (p && p.catch) p.catch(() => this.toast('この画面では全画面にできません')); } } catch (e) { this.toast('この画面では全画面にできません'); } });
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
      net.count(w.code).then(async (n) => {
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
    const names = [(net.getName() || 'ななし') + '（自分）']; for (const p of net.peers.values()) if (net.here(p)) names.push(p.name);
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
  openSettings() {
    for (const [sid, oid, key, fmt] of this._rng) { $(sid).value = settings[key]; $(oid).textContent = fmt(settings[key]); }
    for (const b of $('segQual').children) b.classList.toggle('on', +b.dataset.v === settings.quality);
    for (const b of $('segTog').children) b.classList.toggle('on', !!settings[b.dataset.k]);
    this.showMenu('mSettings', true, true);
  },
  openNotes() {
    const box = $('notes'); box.innerHTML = ''; let next = true, done = 0;
    for (const a of ACHS) {
      const ok = !!game.ach[a.id]; if (ok) done++;
      const el = document.createElement('div'); el.className = 'note' + (ok ? ' done' : '') + (!ok && next ? ' next' : '');
      el.innerHTML = '<div><strong>' + esc(a.title) + '</strong><span class="dim">' + esc(a.hint) + '</span></div>'; box.appendChild(el);
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
      if (el && el.dataset.i !== undefined) { const s = this.getS(this.slots[+el.dataset.i]); if (s && !player.cursor) { tip.textContent = itemName(s.id); tip.style.display = 'block'; tip.style.left = Math.min(window.innerWidth - tip.offsetWidth - 4, e.clientX + 14) + 'px'; tip.style.top = (e.clientY - 30) + 'px'; return; } }
      tip.style.display = 'none';
    });
    $('recTabs').addEventListener('click', (e) => { const b = e.target.closest('.btn'); if (!b) return; sfx('click'); this.recTab = b.dataset.t; this.paintRecipes(); });
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
    $('scrTitle').textContent = kind === 'table' ? '作業台' : kind === 'furnace' ? 'かまど' : kind === 'chest' ? 'チェスト' : creative ? 'ブロックをえらぶ' : '持ち物';
    $('recipes').style.display = (kind === 'inv' && !creative) || kind === 'table' ? '' : 'none';
    const mk = (cls) => { const d = document.createElement('div'); d.className = cls; top.appendChild(d); return d; };
    if (creative) {
      const pal = mk(''); pal.id = 'palette';
      const ids = Object.keys(ITEMS).map(Number).filter(id => id !== B.furnace_lit).sort((a, b) => a - b);
      for (const id of ids) this.addSlot(pal, { t: 'pal', id });
      const tr = mk('g1'); this.addSlot(tr, { t: 'trash' }, 'trash').title = 'ここに置くと消えます';
    } else if (kind === 'inv' || kind === 'table') {
      this.craftW = kind === 'table' ? 3 : 2; this.craft = new Array(this.craftW * this.craftW).fill(null);
      if (kind === 'inv') { const ar = mk('g2'); for (let i = 0; i < 4; i++) this.addSlot(ar, { t: 'armor', a: player.armor, i }).title = ARMOR_TYPES[i][1].slice(1); }
      const g = mk(kind === 'table' ? 'g3' : 'g2'); for (let i = 0; i < this.craft.length; i++) this.addSlot(g, { t: 'craft', a: this.craft, i });
      const a = mk('arrow'); a.textContent = '▶';
      const rs = mk('g1'); this.addSlot(rs, { t: 'result' }, 'big');
    } else if (kind === 'furnace') {
      const f = mk(''); f.id = 'furn';
      this.addSlot(f, { t: 'fin', o: ent, k: 'in' }).style.cssText = 'grid-row:1;grid-column:1';
      const fire = document.createElement('div'); fire.id = 'furnFire'; fire.innerHTML = '<i></i>'; fire.style.cssText = 'grid-row:2;grid-column:1'; f.appendChild(fire);
      this.addSlot(f, { t: 'ffuel', o: ent, k: 'fuel' }).style.cssText = 'grid-row:3;grid-column:1';
      const ar = document.createElement('div'); ar.id = 'furnArrow'; ar.innerHTML = '<i></i>'; f.appendChild(ar);
      this.addSlot(f, { t: 'fout', o: ent, k: 'out' }, 'big').style.cssText = 'grid-row:1 / 4;grid-column:3';
    } else if (kind === 'chest') { const g = mk('grid9'); for (let i = 0; i < 27; i++) this.addSlot(g, { t: 'chest', a: ent.items, i }); }
    for (let i = 9; i < 36; i++) this.addSlot($('scrInv'), { t: 'inv', a: player.inv, i });
    for (let i = 0; i < 9; i++) this.addSlot($('scrHot'), { t: 'inv', a: player.inv, i });
    $('scrHelp').textContent = touchSt.touchUsed ? 'タップで持つ・置く ／ 長押しで半分だけ持つ・1こだけ置く' : 'クリックで持つ・置く ／ 右クリックで半分・1こ ／ Shift+クリックでまとめて移す';
    $('scrInfo').textContent = kind === 'furnace' ? '上に焼く物、下に燃料（木・石炭など）を入れます' : kind === 'inv' && !creative ? '4マスに材料を並べるか、右の一覧から作れます' : kind === 'table' ? '9マスに材料を並べるか、右の一覧から作れます' : '';
    this.recipe = null;
    $('screen').classList.add('on'); $('app').classList.add('uiopen');
    this.refresh();
    if (kind === 'inv' || kind === 'table') this.paintRecipes();
    game.onStat('open', kind);
  },
  close(silent) {
    if (!this.screen) return;
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
    for (const r of this.slots) this.paintSlot(r.el, this.getS(r));
    const c = $('cursorItem'), s = player.cursor;
    if (s) { c.style.display = 'block'; c.firstChild.style.backgroundImage = 'url(' + ICON_URL[s.id] + ')'; c.lastChild.textContent = s.n > 1 ? s.n : ''; if (this._cx !== undefined) this.moveCursor(this._cx, this._cy); $('scrInfo').textContent = '持っている物：' + itemName(s.id) + (s.n > 1 ? ' ×' + s.n : ''); }
    else c.style.display = 'none';
    if (this.screen === 'inv' || this.screen === 'table') this.paintRecipes();
  },
  canPut(r, s) {
    if (r.t === 'result' || r.t === 'fout' || r.t === 'pal') return false;
    if (r.t === 'armor') return !!ITEMS[s.id].armor && ITEMS[s.id].armor.slot === r.i;
    if (r.t === 'ffuel') return !!FUEL[s.id];
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
      if (r.t === 'fout') game.onStat('smelt', s.id);
    } else if (r.t === 'fout') {
      if (s && s.id === cur.id && !s.d && cur.n + s.n <= maxStack(s.id)) { cur.n += s.n; this.setS(r, null); game.onStat('smelt', s.id); }
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
    } else { if (r.t === 'fout') game.onStat('smelt', s.id); s.n = player.give(s.id, s.n, s.d); }
    if (s.n <= 0) this.setS(r, null);
    sfx('click', 0.35); this.refresh();
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
    const tabs = [['ok', 'いま作れる'], ['tool', '道具・装備'], ['block', 'ブロック'], ['food', '食べ物'], ['misc', 'そのほか']];
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
      if (e.target && e.target.tagName === 'INPUT') return;
      const c = e.code;
      if (game.state === 'playing' || game.state === 'paused') { if (c === 'Space' || c === 'Tab' || c === 'F3' || c.startsWith('Arrow') || c === 'Quote' || c === 'Slash') e.preventDefault(); }
      if (e.repeat) return;
      keys[c] = true;
      if (c === 'Escape') { if (this.screen) this.close(); else if (this.menu && this.menuStack.length) this.back(); else if (game.state === 'playing') game.pause(); else if (game.state === 'paused' && performance.now() - game.pausedAt > 350) game.resume(); return; }
      if (game.state !== 'playing') return;
      if (c === 'KeyE') { this.toggleInv(); return; }
      if (this.screen) return;
      if (c.startsWith('Digit') && c !== 'Digit0') player.sel = +c.slice(5) - 1;
      else if (c === 'KeyQ') { const s = player.held(); if (s && !player.dead) { this.dropStack({ id: s.id, n: 1, d: s.d }); if (player.mode === 0) { s.n--; if (s.n <= 0) player.inv[player.sel] = null; } player.invDirty = true; } }
      else if (c === 'Space') { const now = performance.now(); if (now - lastJumpTap < 300) player.toggleFly(); lastJumpTap = now; }
      else if (c === 'KeyW') { const now = performance.now(); if (now - lastWTap < 280) sprintLatch = true; lastWTap = now; }
      else if (c === 'KeyB' || c === 'F3') { if (c === 'F3') game.debug = !game.debug; else { settings.showInfo = !settings.showInfo; saveSettings(); } this.infoT = 0; }
    });
    window.addEventListener('keyup', (e) => { keys[e.code] = false; if (e.code === 'KeyW') sprintLatch = false; });
    window.addEventListener('blur', () => { for (const k in keys) keys[k] = false; mouseL = mouseR = false; sprintLatch = false; });
    cv.addEventListener('mousedown', (e) => {
      if (game.state !== 'playing' || this.screen || touchSt.touchUsed && e.sourceCapabilities && e.sourceCapabilities.firesTouchEvents) return;
      audio.unlock();
      if (!pointerLocked) requestLock(true);
      if (e.button === 0) { mouseL = true; input.breakPressed = true; }
      else if (e.button === 2) { mouseR = true; input.usePressed = true; }
      else if (e.button === 1) { e.preventDefault(); const t = player.target; if (t && player.mode === 1 && ITEMS[t.id]) { player.inv[player.sel] = { id: t.id, n: 1, d: 0 }; player.invDirty = true; } }
    });
    window.addEventListener('mouseup', (e) => { if (e.button === 0) mouseL = false; else if (e.button === 2) mouseR = false; });
    window.addEventListener('mousemove', (e) => {
      const r = cv.getBoundingClientRect();
      mouseNdc[0] = ((e.clientX - r.left) / r.width) * 2 - 1; mouseNdc[1] = 1 - ((e.clientY - r.top) / r.height) * 2;
      if (game.state !== 'playing' || this.screen || touchSt.lookActive) return;
      if (pointerLocked || e.target === cv) { const k = settings.sens * 0.00021; input.lookDX += clamp(e.movementX || 0, -200, 200) * k; input.lookDY += clamp(e.movementY || 0, -200, 200) * k; }
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
    const markTouch = () => { if (!touchSt.touchUsed) { touchSt.touchUsed = true; app.classList.add('touch'); if (!settings.touchInit) { settings.touchInit = true; settings.viewDist = Math.min(settings.viewDist, 5); settings.quality = Math.min(settings.quality, 0.8); settings.autoJump = true; settings.fancyLeaves = false; applySettings(); saveSettings(); } } audio.unlock(); };
    window.addEventListener('touchstart', markTouch, { passive: true, capture: true });
    cv.addEventListener('touchstart', (e) => { e.preventDefault(); if (game.state !== 'playing') return; for (const t of e.changedTouches) touchSt.look.set(t.identifier, { x: t.clientX, y: t.clientY, x0: t.clientX, y0: t.clientY, t0: performance.now(), mode: 0, n: ndc(t) }); }, { passive: false });
    cv.addEventListener('touchmove', (e) => {
      e.preventDefault();
      for (const t of e.changedTouches) {
        const l = touchSt.look.get(t.identifier); if (!l) continue;
        const dx = t.clientX - l.x, dy = t.clientY - l.y; l.x = t.clientX; l.y = t.clientY; l.n = ndc(t);
        if (l.mode === 0 && Math.hypot(t.clientX - l.x0, t.clientY - l.y0) > 12) l.mode = 1;
        if (l.mode === 1) { const k = settings.sens * 0.00055; input.lookDX += dx * k; input.lookDY += dy * k; }
        else if (l.mode === 2) input.rayNdc = l.n;
      }
    }, { passive: false });
    const endLook = (e) => {
      e.preventDefault();
      for (const t of e.changedTouches) {
        const l = touchSt.look.get(t.identifier); if (!l) continue;
        touchSt.look.delete(t.identifier);
        if (l.mode === 0 && performance.now() - l.t0 < 320 && game.state === 'playing') { input.rayNdc = l.n; input.tapPending = true; touchSt.rayHold = 3; }
        else if (l.mode === 2) { input.rayNdc = null; }
      }
    };
    cv.addEventListener('touchend', endLook, { passive: false }); cv.addEventListener('touchcancel', endLook, { passive: false });
    const stick = $('stick'), base = $('stickBase'), knob = $('stickKnob');
    const stickMove = (t) => { const s = touchSt.stick; let dx = t.clientX - s.x, dy = t.clientY - s.y; const d = Math.hypot(dx, dy), m = 52; if (d > m) { dx *= m / d; dy *= m / d; } touchSt.sx = dx / m; touchSt.sy = dy / m; touchSt.mag = Math.min(1, d / m); knob.style.transform = 'translate(' + dx + 'px,' + dy + 'px)'; };
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
    let f = (keys.KeyW ? 1 : 0) - (keys.KeyS ? 1 : 0), s = (keys.KeyD ? 1 : 0) - (keys.KeyA ? 1 : 0);
    if (touchSt.stick) { f -= touchSt.sy; s += touchSt.sx; }
    input.fwd = clamp(f, -1, 1); input.strafe = clamp(s, -1, 1);
    input.jump = !!keys.Space || touchSt.jump;
    input.sneak = !!keys.ShiftLeft || !!keys.ShiftRight || touchSt.sneak;
    input.sprint = !!keys.KeyF || sprintLatch || (touchSt.mag > 0.94 && touchSt.sy < -0.75);
    const ar = 2.0 * dt;
    if (keys.ArrowLeft) input.lookDX -= ar; if (keys.ArrowRight) input.lookDX += ar; if (keys.ArrowUp) input.lookDY -= ar * 0.8; if (keys.ArrowDown) input.lookDY += ar * 0.8;
    if (!pointerLocked && !touchSt.touchUsed && game.state === 'playing' && !this.screen && document.hasFocus()) {
      // マウスを固定できないとき：画面の端に寄せると回り続ける
      const ex = Math.abs(mouseNdc[0]) > 0.84 ? Math.sign(mouseNdc[0]) * (Math.abs(mouseNdc[0]) - 0.84) / 0.16 : 0, ey = Math.abs(mouseNdc[1]) > 0.8 ? Math.sign(mouseNdc[1]) * (Math.abs(mouseNdc[1]) - 0.8) / 0.2 : 0;
      if (this._edgeOn) { input.lookDX += clamp(ex, -1, 1) * 2.4 * dt; input.lookDY -= clamp(ey, -1, 1) * 1.6 * dt; }
    }
    let anyBreak = false;
    if (touchSt.touchUsed) {
      const now = performance.now();
      touchSt.lookActive = touchSt.look.size > 0;
      for (const l of touchSt.look.values()) { if (l.mode === 0 && now - l.t0 > 330) { l.mode = 2; input.breakPressed = true; input.rayNdc = l.n; } if (l.mode === 2) anyBreak = true; }
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
const HOWTO_HTML = `
<dt>パソコン</dt>
<dd><kbd>W</kbd> <kbd>A</kbd> <kbd>S</kbd> <kbd>D</kbd> 歩く ／ <kbd>スペース</kbd> ジャンプ ／ <kbd>Shift</kbd> しゃがむ</dd>
<dd><kbd>W</kbd> をすばやく2回、または <kbd>F</kbd> を押しながら進むと走れます</dd>
<dd>マウスで見回す ／ 左ボタンを押しっぱなしでこわす・攻撃 ／ 右ボタンで置く・使う（食べ物は押しっぱなし）</dd>
<dd><kbd>1</kbd>〜<kbd>9</kbd> かホイールで持ち物を選ぶ ／ <kbd>E</kbd> 持ち物 ／ <kbd>Q</kbd> 捨てる ／ <kbd>Esc</kbd> メニュー</dd>
<dt>スマホ・タブレット</dt>
<dd>左下のスティックで歩き、画面をなぞって見回します</dd>
<dd>ブロックを長押しでこわす、軽くタップで置く・使う。右下のボタンでも同じことができます</dd>
<dd>食べ物は「つかう」を押しっぱなしで食べます</dd>
<dt>まずやること</dt>
<dd>木をなぐって原木を集める → 持ち物を開いて「板」「作業台」を作る → 作業台を置いて道具を作る</dd>
<dd>夜になると敵が出ます。たいまつで明るくした家にこもるか、ベッドで朝まで眠りましょう</dd>
<dd>次に何をするか迷ったら「開拓ノート」に目標が順番に書いてあります</dd>
<dt>クリエイティブ</dt>
<dd>ジャンプをすばやく2回で空を飛べます（ジャンプで上がり、しゃがむで下がります）</dd>
<dt>セーブについて</dt>
<dd>20秒ごとと、メニューを開いたときに自動で保存されます。保存先はこの端末のブラウザの中です。大事な世界は「つづきから」の「書き出す」でファイルに残せます</dd>`;
