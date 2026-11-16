/* 共通：ゲーム前の設定画面（ワナワナ・ドロップ・ドッカン・カート）
   LK.html(o) で HTML を作り、LK.bind(root, o) でボタンをつなぐ。
   設定は1行1項目（上下で行、左右で値）。プレイヤーは カード（大きなキャラと ◀▶）。 */
(function(){
'use strict';
const css=`
.lk{width:100%;max-width:1180px;margin:auto 0;display:flex;flex-direction:column;gap:14px}
.lk-top{display:flex;align-items:center;gap:12px;flex-wrap:wrap}
.lk-top h2{flex:1;min-width:200px}
.lk-steps{display:flex;gap:6px;flex-wrap:wrap}
.lk-step{font-weight:800;font-size:14px;padding:6px 12px;border-radius:999px;background:rgba(255,255,255,.12);color:#fff;border:2px solid transparent}
.lk-step.now{background:var(--sun);color:var(--ink);border-color:var(--ink)}
.lk-step.done{background:#2aa55a;color:#fff}
.lk-body{display:grid;grid-template-columns:minmax(0,1.55fr) minmax(300px,1fr);gap:16px;align-items:start}
@media (max-width:900px){.lk-body{grid-template-columns:1fr}}
.lk.wide .lk-body{grid-template-columns:1fr}.lk.wide .lk-cards{grid-template-columns:repeat(4,minmax(0,1fr))}.lk.wide .lk-side{display:grid;grid-template-columns:2fr 1fr;align-items:start}.lk.wide .lk-why{grid-column:1/3}.lk.wide .lk-side>[data-back]{grid-row:1;grid-column:2;align-self:stretch;justify-content:center;font-size:18px}
@media (max-width:900px){.lk.wide .lk-cards{grid-template-columns:repeat(2,minmax(0,1fr))}.lk.wide .lk-side{display:flex}}
.lk-cards{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}
.lk-card{position:relative;background:var(--paper);border:4px solid var(--ink);border-radius:14px;box-shadow:5px 5px 0 var(--ink);padding:30px 10px 12px;display:flex;flex-direction:column;align-items:center;gap:5px;min-width:0;min-height:236px}
.lk-card .pn{position:absolute;left:-4px;top:-4px;font-family:var(--display);font-size:20px;color:#fff;padding:2px 12px;border-radius:12px 0 12px 0;border:4px solid var(--ink)}
.lk-card .nm{font-weight:800;font-size:18px;max-width:100%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
@media (max-width:640px){.lk-card{min-height:0}.lk-ch canvas{width:84px;height:84px}.lk-ar{width:40px;height:52px}}
.lk-card .dv{font-size:12px;color:var(--muted);text-align:center;line-height:1.3}
.lk-card .x{position:absolute;right:6px;top:6px;width:30px;height:30px;border-radius:50%;border:2px solid var(--ink);background:#fff;font:800 16px var(--body);cursor:pointer;line-height:1}
.lk-ch{display:flex;align-items:center;justify-content:center;gap:4px;width:100%}
.lk-ch canvas{width:110px;height:110px;flex:none}
.lk-ar{width:46px;height:64px;border-radius:10px;border:3px solid var(--ink);background:#fff;font:800 22px var(--body);cursor:pointer;flex:none;box-shadow:2px 2px 0 var(--ink)}
.lk-ar:active{transform:translate(1px,1px);box-shadow:1px 1px 0 var(--ink)}
.lk-chn{font-weight:800;font-size:16px}
.lk-seg{display:flex;border:3px solid var(--ink);border-radius:10px;overflow:hidden;width:100%}
.lk-seg button{flex:1;font:800 15px var(--body);padding:8px 4px;border:0;background:#fff;cursor:pointer;color:var(--ink)}
.lk-seg button+button{border-left:3px solid var(--ink)}
.lk-seg button.on{color:#fff}
.lk-ok{width:100%;font:800 17px var(--body);padding:10px;border:3px solid var(--ink);border-radius:10px;background:var(--sun);cursor:pointer;box-shadow:3px 3px 0 var(--ink)}
.lk-ok.done{background:#2aa55a;color:#fff}
.lk-st{font-weight:800;font-size:15px;padding:6px 12px;border-radius:999px;background:#eee6d6}
.lk-st.done{background:#2aa55a;color:#fff}
.lk-card.cpu{opacity:.92;background:#ece6f2}
.lk-card.empty{background:rgba(255,255,255,.06);border:4px dashed rgba(255,255,255,.7);box-shadow:none;color:#fff;justify-content:center;cursor:pointer;gap:10px}
.lk-card.empty:hover{background:rgba(255,255,255,.14)}
.lk-plus{font-family:var(--display);font-size:54px;line-height:1}
.lk-keys{display:flex;flex-wrap:wrap;gap:6px;justify-content:center;align-items:center;font-size:13px;font-weight:800}
.kc{display:inline-flex;align-items:center;justify-content:center;min-width:30px;height:28px;padding:0 8px;border-radius:7px;background:#fff;color:var(--ink);border:2px solid var(--ink);border-bottom-width:4px;font:800 13px var(--body)}
.kc.pad{border-radius:50%;min-width:28px;padding:0;background:#2aa55a;color:#fff}
.lk-side{display:flex;flex-direction:column;gap:12px}
.lk-set{background:var(--paper);border:4px solid var(--ink);border-radius:14px;box-shadow:5px 5px 0 var(--ink);padding:8px}
.lk-set h3{margin:4px 8px 6px;font-size:15px;color:var(--muted)}
.lk-row{display:flex;align-items:center;gap:8px;padding:4px 8px;border-radius:10px;border:3px solid transparent}
.lk-row+.lk-row{margin-top:2px}
.lk-row .lb{flex:1;font-weight:800;font-size:16px;min-width:0}
.lk-row .lb small{display:block;font-weight:500;font-size:12px;color:var(--muted)}
.lk-row .va{min-width:7.5em;text-align:center;font-weight:800;font-size:17px;background:#fff;border:2px solid var(--ink);border-radius:8px;padding:6px 6px;cursor:pointer}
.lk-row button.sd{width:38px;height:38px;border-radius:9px;border:3px solid var(--ink);background:#fff;font:800 17px var(--body);cursor:pointer;flex:none}
.lk-row.dis .va{background:#f2ece2;cursor:default}
.lk-row.dis button.sd{visibility:hidden}
.lk-row.f,.lk-row:focus-visible{border-color:var(--red);background:#fff3c4}
.lk-go{font-family:var(--display);font-size:26px;width:100%;padding:16px;border:4px solid var(--ink);border-radius:14px;background:#d9d2c4;color:#6b6478;box-shadow:5px 5px 0 var(--ink);cursor:default;text-align:center}
.lk-go.can{background:#ff7a3c;color:#fff;cursor:pointer;animation:lkp 1.2s ease-in-out infinite}
@keyframes lkp{50%{transform:scale(1.03)}}
.lk-why{color:#fff;font-weight:800;font-size:15px;text-align:center;margin:0;text-shadow:1px 1px 0 var(--ink)}
.lk-share{display:flex;gap:8px;flex-wrap:wrap;align-items:center}
.lk .f{outline:5px solid #ffe066!important;outline-offset:3px;box-shadow:0 0 0 9px rgba(255,224,102,.35)!important}
.lk-row.f{outline:none!important;box-shadow:none!important}
`;
const st=document.createElement('style');st.textContent=css;document.head.appendChild(st);
const esc=s=>String(s==null?'':s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const KEYS={kb1:'<span class="kc">Space</span>',kb2:'<span class="kc">Enter</span>',pad:'<span class="kc pad">A</span>'};
function card(c,i){
  if(c.type==='empty')return`<div class="lk-card empty" data-nav data-lkjoin="${i}"><div class="lk-plus">＋</div><div style="font-weight:800;font-size:17px">${c.touch?'タップで 参加':'クリックで 参加'}</div>
    ${c.touch?'':`<div class="lk-keys">キーボード左 ${KEYS.kb1}</div><div class="lk-keys">キーボード右 ${KEYS.kb2}</div>`}<div class="lk-keys">コントローラー ${KEYS.pad}</div></div>`;
  const pn=`<div class="pn" style="background:${c.color}">${c.type==='cpu'?(c.badge||'COM'):(i+1)+'P'}</div>`;
  if(c.type==='cpu')return`<div class="lk-card cpu" style="border-color:${c.color}">${pn}<div class="nm">${esc(c.name)}</div><div class="dv">${esc(c.sub||'コンピューター')}</div>
    <div class="lk-ch"><canvas width="240" height="240" data-lkch="${c.char}"></canvas></div>${c.extra||''}</div>`;
  const ed=c.mine&&!c.ok;
  return`<div class="lk-card" style="border-color:${c.color}">${pn}${c.mine?`<button class="x" data-lkrm="${c.pid}" title="ぬける">×</button>`:''}
    <div class="nm">${esc(c.name)}</div><div class="dv">${esc(c.dev||'')}</div>
    <div class="lk-ch">${ed?`<button class="lk-ar" data-lkc="${c.pid}" data-d="-1">◀</button>`:''}<canvas width="240" height="240" data-lkch="${c.char}"></canvas>${ed?`<button class="lk-ar" data-lkc="${c.pid}" data-d="1">▶</button>`:''}</div>
    <div class="lk-chn">${esc(c.charName||'')}</div>${c.extra||''}
    ${c.mine?`<button class="lk-ok${c.ok?' done':''}" data-lkok="${c.pid}">${c.ok?(c.online?'準備OK！（もどす）':'決定！（もどす）'):(c.online?'準備OK':'これで決定')}</button>`
      :`<span class="lk-st${c.ok?' done':''}">${c.ok?'準備OK！':'えらんでいます…'}</span>`}</div>`;}
function row(s){const dis=s.dis||s.vals.length<2;const i=Math.max(0,s.vals.indexOf(s.cur));
  return`<div class="lk-row${dis?' dis':''}" ${dis?'':'data-nav'} data-lksel="${s.k}"><div class="lb">${esc(s.label)}${s.note?`<small>${esc(s.note)}</small>`:''}</div>
    <button class="sd" data-sd="-1" tabindex="-1">◀</button><div class="va">${esc(s.labels?s.labels[i]:s.vals[i])}</div><button class="sd" data-sd="1" tabindex="-1">▶</button></div>`;}
const LK={
  html(o){const n=o.cards.filter(c=>c.type==='p').length;const allOk=n>0&&o.cards.filter(c=>c.type==='p').every(c=>c.ok);
    const step=n===0?1:allOk?3:2;
    const steps=[['参加する',1],[o.online?'えらんで 準備OK':'えらんで 決定',2],[o.goLabel||'スタート',3]].map(([t,k])=>`<span class="lk-step${k===step?' now':k<step?' done':''}">${k===1?'①':k===2?'②':'③'} ${t}</span>`).join('');
    return`<div class="lk${o.wide?' wide':''}"><div class="lk-top"><h2>${o.title}</h2><div class="lk-steps">${steps}</div></div>
    ${o.share?`<div class="lk-share">${o.share}</div>`:''}
    <div class="lk-body"><div class="lk-cards">${o.cards.map(card).join('')}</div>
    <div class="lk-side">${o.settings.length?`<div class="lk-set"><h3>${o.host?'ルール（上下でえらんで、左右でかえる）':'ルール（ホストがきめます）'}</h3>${o.settings.map(row).join('')}</div>`:''}
    ${o.note?`<p class="lk-why" style="color:var(--sun)">${o.note}</p>`:''}
    ${o.host?`<button class="lk-go${o.can?' can':''}" data-nav data-lkgo ${o.can?'':'aria-disabled="true"'}>${o.goLabel||'スタート'}${o.can?'！':''}</button><p class="lk-why">${o.can?(o.startKey||'スタートボタン か コントローラーの START でも始まります'):esc(o.why||'')}</p>`:`<p class="lk-why">ホストがスタートすると始まります。</p>`}
    <button class="btn ghost" data-nav data-back>${esc(o.back||'もどる')}</button></div></div></div>`;},
  // o.on: {join(i), char(pid,d), ok(pid), rm(pid), sel(k,dir), go()}
  bind(root,o){const on=o.on;
    root.querySelectorAll('[data-lkch]').forEach(cv=>{const c=cv.getContext('2d');c.clearRect(0,0,240,240);o.drawCh(c,+cv.dataset.lkch,cv);});
    root.querySelectorAll('[data-lkjoin]').forEach(b=>b.onclick=()=>on.join(+b.dataset.lkjoin));
    root.querySelectorAll('[data-lkc]').forEach(b=>b.onclick=e=>{e.stopPropagation();on.char(b.dataset.lkc,+b.dataset.d);});
    root.querySelectorAll('[data-lkok]').forEach(b=>b.onclick=()=>on.ok(b.dataset.lkok));
    root.querySelectorAll('[data-lkrm]').forEach(b=>b.onclick=e=>{e.stopPropagation();on.rm(b.dataset.lkrm);});
    root.querySelectorAll('[data-lksel]').forEach(r=>{if(r.classList.contains('dis'))return;const k=r.dataset.lksel;
      r.querySelectorAll('[data-sd]').forEach(b=>b.onclick=e=>{e.stopPropagation();on.sel(k,+b.dataset.sd);});r.querySelector('.va').onclick=e=>{e.stopPropagation();on.sel(k,1);};r.onclick=()=>on.sel(k,1);});
    const go=root.querySelector('[data-lkgo]');if(go)go.onclick=()=>{if(o.can)on.go();};},
  // 設定の行に カーソルがあるときは 左右で 値をかえる（true を返したら 移動しない）
  navSide(el,px){if(!el||!px||!el.dataset||el.dataset.lksel==null)return false;const b=el.querySelector(`[data-sd="${px}"]`);if(b)b.click();return true;},
  step(vals,cur,d){const i=vals.indexOf(cur);return vals[((i<0?0:i)+d+vals.length)%vals.length];},
  // ロビーでの カーソル用の入力：決定ずみの人の 入力だけ（参加・キャラえらびと まざらないように）
  navDev(devs,allow){const o={px:0,py:0,pa:false,pst:false,pb:false};for(const id in devs){if(id==='any'||!allow.has(id))continue;const d=devs[id];if(!d)continue;o.px=o.px||d.px||0;if(!d.pa&&!d.a)o.py=o.py||d.py||0;o.pa=o.pa||!!d.pa;o.pst=o.pst||!!d.pst;o.pb=o.pb||!!d.pb;}return o;},
  // 全員が決定したら スタートへ カーソルを 移す
  focusGo(root,navEls,nav){const els=navEls();const i=els.findIndex(e=>e.dataset&&e.dataset.lkgo!=null);if(i>=0){nav.i=i;nav.show=true;}}
};
window.LK=LK;
})();
