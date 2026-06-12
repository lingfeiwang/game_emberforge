"use strict";
/* ====================================================================
   EMBERFORGE DEPTHS — rendering, overlays, tooltips, FX, menus
   ==================================================================== */
function showScreen(id){
  document.querySelectorAll('.screen').forEach(s=>s.classList.remove('active'));
  $(id).classList.add('active');
  /* the run topbar only makes sense inside a run */
  $('topbar').style.display = (id === 'screen-title' || id === 'screen-charselect') ? 'none' : '';
}
function openOverlay(html, dismissible){
  $('overlay-panel').innerHTML = html;
  $('overlay').dataset.dismissible = dismissible ? '1' : '0';
  $('overlay').classList.add('active');
}
function closeOverlay(){ $('overlay').classList.remove('active'); }

/* ---------------- topbar ---------------- */
function renderTopbar(){
  if(!G) return;
  $('hp-text').textContent = `${G.hp}/${G.maxHp}`;
  $('hpfill').style.width = Math.max(0, 100*G.hp/G.maxHp) + '%';
  $('gold-text').textContent = G.gold;
  if(G.gold >= 450) award('goldFever');
  $('floor-text').textContent = G.floorNum ? `${['I','II','III'][G.act]} · ${G.floorNum}` : ['I','II','III'][G.act];
  $('deck-count').textContent = G.deck.length;
  $('char-icon').textContent = CHAR_DEFS[G.character].sprite;
  $('asc-text').textContent = G.ascension > 0 ? `🔺${G.ascension}` : '';
  document.body.classList.toggle('low-hp', G.hp > 0 && G.hp <= G.maxHp * 0.25);
  $('relicbar').innerHTML = G.relics.map(r=>{
    const d = RELIC_DEFS[r];
    return `<span class="relic" data-tt="<b>${escapeHtml(d.name)}</b><br>${escapeHtml(d.desc)}">${d.icon}</span>`;
  }).join('');
  const pb = $('potionbar');
  pb.innerHTML = '';
  for(let i=0;i<potionSlots();i++){
    const id = G.potions[i];
    const span = document.createElement('span');
    span.className = 'potion' + (id?'':' empty');
    if(id){
      const d = POTION_DEFS[id];
      span.textContent = d.icon;
      span.dataset.tt = `<b>${escapeHtml(d.name)}</b><br>${escapeHtml(d.desc)}${d.combat?'<br><i>combat only</i>':''}<br><i>click to use</i>`;
      span.onclick = ()=>usePotion(i);
    } else {
      span.textContent = '·';
      span.dataset.tt = 'Empty potion slot';
    }
    pb.appendChild(span);
  }
}

/* ---------------- combat rendering ---------------- */
function statusTags(s){
  let out = '';
  if(s.block > 0) out += `<span class="stag block" data-tt="<b>Block</b>: absorbs damage; normally expires at the start of your turn">🛡${s.block}</span>`;
  if((s.strength||0) > 0) out += `<span class="stag str" data-tt="<b>Strength</b>: +damage per hit">💪${s.strength}</span>`;
  if(s.burn > 0) out += `<span class="stag burn" data-tt="<b>Burn</b>: damage at end of turn, then decays by 1">🔥${s.burn}</span>`;
  if(s.exposed > 0) out += `<span class="stag exposed" data-tt="<b>Exposed</b>: takes 50% more damage">🎯${s.exposed}</span>`;
  if(s.rattled > 0) out += `<span class="stag rattled" data-tt="<b>Rattled</b>: deals 25% less damage">😵${s.rattled}</span>`;
  return out;
}

function intentText(e){
  const a = e.nextAction;
  if(!a) return '…';
  if(a.kind === 'attack'){
    const dmg = enemyAttackDmg(e, a);
    return `⚔️ ${dmg}${a.times>1?'×'+a.times:''}${a.after?' ☠':''}`;
  }
  if(a.kind === 'block') return `🛡 ${a.amt}`;
  return a.intentIcon || '✨';
}
function intentTip(e){
  const a = e.nextAction;
  if(!a) return 'Pondering…';
  let s = `<b>${escapeHtml(a.name)}</b>`;
  if(a.kind === 'attack') s += `<br>Attacks for ${enemyAttackDmg(e,a)}${a.times>1?' × '+a.times:''}`;
  if(a.kind === 'block') s += `<br>Gains ${a.amt} Block`;
  if(a.note) s += `<br>${escapeHtml(a.note)}`;
  return s;
}

function renderCombat(){
  if(!G || !$('screen-combat').classList.contains('active')) return;
  if(!G.inCombat && G.hp <= 0) return;
  /* player side */
  $('player-avatar').textContent = CHAR_DEFS[G.character].sprite;
  $('player-name').textContent = CHAR_DEFS[G.character].name;
  $('player-block').textContent = G.player.block;
  $('player-status').innerHTML = statusTags({...G.player, block:0});
  $('player-hp-small').textContent = `${G.hp}/${G.maxHp}`;
  /* servos */
  const sr = $('servo-row');
  if(G.character === 'scrapwright' || (G.servos && G.servos.length)){
    sr.style.display = '';
    sr.innerHTML = '';
    for(let i=0;i<G.servoCap;i++){
      const s = G.servos[i];
      const chip = document.createElement('span');
      chip.className = 'servo' + (s?'':' empty');
      if(s){
        const d = SERVO_DEFS[s.type];
        chip.textContent = d.icon;
        chip.dataset.tt = `<b>${d.name}</b><br>${d.desc(servoPowerBonus())}`;
      } else {
        chip.textContent = '·';
        chip.dataset.tt = 'Empty Servo slot';
      }
      sr.appendChild(chip);
    }
  } else { sr.style.display = 'none'; }
  /* enemies */
  const zone = $('enemy-zone');
  zone.innerHTML = '';
  G.enemies.forEach(e=>{
    const div = document.createElement('div');
    div.className = 'enemy' + (e.hp<=0?' dead':'') + (e.elite?' elite':'') + (e.boss?' boss':'');
    div.id = e.id;
    const needTarget = selectedCard && cardDef(selectedCard).target === 'enemy' && e.hp > 0;
    if(needTarget) div.classList.add('targetable');
    div.innerHTML = `
      <div class="intent" data-tt="${escapeHtml(intentTip(e))}">${e.hp>0?intentText(e):'💀'}</div>
      <div class="sprite">${e.sprite}</div>
      <div class="ename">${e.name}</div>
      <div class="ehp"><div style="width:${100*e.hp/e.maxHp}%"></div></div>
      <div class="ehp-num">${e.hp}/${e.maxHp}</div>
      <div class="stags">${e.hp>0 ? statusTags(e) : ''}</div>`;
    if(needTarget) div.onclick = ()=>playCard(selectedCard, e);
    zone.appendChild(div);
  });
  /* heat gauge */
  const cap = capacity();
  const gauge = $('heat-gauge');
  gauge.innerHTML = '';
  const pips = Math.max(cap, G.heat);
  for(let i=0;i<pips;i++){
    const p = document.createElement('div');
    p.className = 'pip' + (i < G.heat ? (i >= cap ? ' over' : ' hot') : '');
    if(i >= cap && i >= G.heat) p.style.opacity = .3;
    gauge.appendChild(p);
  }
  $('heat-num').textContent = G.heat;
  $('cap-num').textContent = cap;
  const ct = $('chain-tag');
  ct.textContent = G.alwaysChain ? 'ALL' : (G.lastTag || '—');
  ct.className = G.lastTag ? `tag-${G.lastTag}` : '';
  $('pile-draw').textContent = G.drawPile.length;
  $('pile-discard').textContent = G.discardPile.length;
  $('pile-exhaust').textContent = G.exhaustPile.length;
  $('target-hint').textContent = selectedCard ? '← Click an enemy to strike (Esc or click card again to cancel)' : '';
  /* hand */
  const hand = $('hand');
  hand.innerHTML = '';
  G.hand.forEach((card, idx)=>{
    const el = renderCardEl(card);
    if(idx < 10) el.dataset.hotkey = (idx+1)%10;
    if(selectedCard && selectedCard.id === card.id) el.classList.add('selected');
    const def = cardDef(card);
    if(!def.unplayable){
      const cost = effectiveCost(card);
      const over = Math.max(0, G.heat+cost-cap) - Math.max(0, G.heat-cap);
      if(over > 0){
        el.classList.add('unplayable-warn');
        const perPoint = (G.asbestos?1:2) + (G.ascension>=8?1:0);
        el.dataset.tt = `⚠️ Playing this overheats you for <b>${over*perPoint}</b> damage!`;
      }
    }
    el.onclick = ()=>{
      if(!G.inCombat || !G.playerTurn) return;
      if(selectedCard && selectedCard.id === card.id){ selectedCard = null; renderCombat(); return; }
      tryPlayCard(card);
    };
    hand.appendChild(el);
  });
}

function renderCardEl(card){
  const def = cardDef(card);
  const el = document.createElement('div');
  el.className = `card rar-${def.rarity} tagc-${def.tag}`;
  el.dataset.cardId = card.id;
  if(card.upgraded) el.classList.add('upgraded');
  const chainSym = {STRIKE:'⚔️', GUARD:'🛡️', ARC:'✨', STATUS:'☁️', CURSE:'☠️'}[def.tag];
  const costShown = def.unplayable ? '—' : (G && G.inCombat ? effectiveCost(card) : cv(card,'cost'));
  el.innerHTML = `
    <div class="cost">${costShown}</div>
    <div class="cname">${cardName(card)}</div>
    <div class="tagline tag-${def.tag}">${chainSym} ${def.tag}${def.power?' · POWER':''}${def.charge?' · ⚡':''}</div>
    <div class="cart">${chainSym}</div>
    <div class="ctext">${def.text(card)}</div>
    ${def.charge && card.held>0 ? `<div class="charge-note">⚡ Held ${card.held} turn${card.held>1?'s':''}</div>`:''}`;
  return el;
}

/* ---------------- deck & pile viewers ---------------- */
function showDeckOverlay(){
  if(!G) return;
  openOverlay(`<h2>🃏 Your Deck (${G.deck.length})</h2><div class="deck-list"></div><br>
    <button onclick="closeOverlay()">Close</button>`, true);
  const list = document.querySelector('#overlay-panel .deck-list');
  const sorted = [...G.deck].sort((a,b)=>cardDef(a).name.localeCompare(cardDef(b).name));
  sorted.forEach(c=>list.appendChild(renderCardEl(c)));
}
function showPileOverlay(which){
  if(!G || !G.inCombat) return;
  const piles = {draw:[G.drawPile,'🂠 Draw pile (order hidden)'], discard:[G.discardPile,'🗑 Discard pile'], exhaust:[G.exhaustPile,'♨️ Exhausted']};
  const [pile, title] = piles[which];
  openOverlay(`<h2>${title} — ${pile.length}</h2><div class="deck-list"></div><br>
    <button onclick="closeOverlay()">Close</button>`, true);
  const list = document.querySelector('#overlay-panel .deck-list');
  const cards = which === 'draw'
    ? [...pile].sort((a,b)=>cardDef(a).name.localeCompare(cardDef(b).name))
    : [...pile].reverse();
  cards.forEach(c=>list.appendChild(renderCardEl(c)));
}

/* ---------------- tooltip system ---------------- */
function initTooltips(){
  const tip = $('tooltip');
  let current = null;
  document.addEventListener('mouseover', e=>{
    const t = e.target.closest ? e.target.closest('[data-tt], .kw') : null;
    if(!t){ if(current){ current=null; tip.classList.remove('show'); } return; }
    if(t === current) return;
    current = t;
    let html = t.dataset && t.dataset.tt;
    if(!html && t.classList.contains('kw')){
      const word = t.textContent.replace(/[:.]/g,'').trim();
      const def = KEYWORDS[word];
      if(def) html = `<b>${word}</b><br>${def}`;
    }
    if(!html){ current = null; return; }
    tip.innerHTML = html;
    tip.classList.add('show');
  });
  document.addEventListener('mousemove', e=>{
    if(!current) return;
    const pad = 14;
    let x = e.clientX + pad, y = e.clientY + pad;
    const r = tip.getBoundingClientRect();
    if(x + r.width > window.innerWidth - 6) x = e.clientX - r.width - pad;
    if(y + r.height > window.innerHeight - 6) y = e.clientY - r.height - pad;
    tip.style.left = x + 'px';
    tip.style.top = y + 'px';
  });
  document.addEventListener('mouseout', e=>{
    if(current && !e.relatedTarget){ current = null; tip.classList.remove('show'); }
  });
}

/* ---------------- FX ---------------- */
function fxHit(elemId, shown, dealt, isBurn){
  const host = $(elemId);
  if(!host) return;
  const f = document.createElement('div');
  f.className = 'float-dmg';
  f.style.color = isBurn ? '#ff9a3d' : (dealt>0 ? '#ff6b4d' : '#7fb6e0');
  f.textContent = `-${shown}`;
  host.appendChild(f);
  host.classList.remove('hitflash'); void host.offsetWidth; host.classList.add('hitflash');
  if(SETTINGS && SETTINGS.particles) spawnSparks(host, isBurn ? '#ff9a3d' : '#ffd28a');
  setTimeout(()=>f.remove(), 900);
}
function spawnSparks(host, color){
  for(let i=0;i<6;i++){
    const s = document.createElement('div');
    s.className = 'spark';
    s.style.background = color;
    s.style.left = (40 + crand(-20,20)) + '%';
    s.style.top = (38 + crand(-12,12)) + '%';
    s.style.setProperty('--dx', crand(-46,46)+'px');
    s.style.setProperty('--dy', crand(-60,8)+'px');
    host.appendChild(s);
    setTimeout(()=>s.remove(), 650);
  }
}
function fxPlayerHit(){
  if(SETTINGS && SETTINGS.shake){
    const app = $('app');
    app.classList.remove('shake'); void app.offsetWidth; app.classList.add('shake');
  }
  const pv = $('player-avatar');
  if(pv){ pv.classList.remove('hitflash'); void pv.offsetWidth; pv.classList.add('hitflash'); }
}
function fxEnemyAct(id){
  const el = $(id);
  if(!el) return;
  el.classList.remove('lunge'); void el.offsetWidth; el.classList.add('lunge');
}
function fxFloatPlayer(text, color){
  const host = $('player-side');
  if(!host) return;
  const f = document.createElement('div');
  f.className = 'float-dmg';
  f.style.color = color;
  f.textContent = text;
  host.appendChild(f);
  setTimeout(()=>f.remove(), 900);
}
function fxBlock(n){ if(G && G.inCombat) fxFloatPlayer(`+${n} 🛡`, '#9fd2ff'); }
function fxHeal(n){ if(G && G.inCombat) fxFloatPlayer(`+${n} ❤`, '#7ec96b'); }
function fxCardPlayed(card){
  const el = document.querySelector(`#hand .card[data-card-id="${card.id}"]`);
  if(!el || !dur(1)) return;
  const r = el.getBoundingClientRect();
  const ghost = el.cloneNode(true);
  ghost.className = el.className + ' card-ghost';
  ghost.style.left = r.left + 'px';
  ghost.style.top = r.top + 'px';
  ghost.style.width = r.width + 'px';
  document.body.appendChild(ghost);
  requestAnimationFrame(()=>ghost.classList.add('gone'));
  setTimeout(()=>ghost.remove(), 500);
}

/* ---------------- banners & toasts ---------------- */
function showTurnBanner(text){
  if(!dur(1)) return;
  const b = $('turn-banner');
  b.textContent = text;
  b.classList.remove('show'); void b.offsetWidth; b.classList.add('show');
  setTimeout(()=>b.classList.remove('show'), dur(950));
}
function showBossBanner(name){
  if(!dur(1)) return;
  const b = $('boss-banner');
  b.innerHTML = `<div class="bb-sub">— BOSS —</div><div class="bb-name">${escapeHtml(name)}</div>`;
  b.classList.remove('show'); void b.offsetWidth; b.classList.add('show');
  setTimeout(()=>b.classList.remove('show'), dur(2000));
}
function toast(html){
  const box = $('toasts');
  const t = document.createElement('div');
  t.className = 'toast';
  t.innerHTML = html;
  box.appendChild(t);
  setTimeout(()=>t.classList.add('show'), 30);
  setTimeout(()=>{ t.classList.remove('show'); setTimeout(()=>t.remove(), 400); }, 4200);
}
function toastAchievement(id){
  const a = ACH_DEFS[id];
  if(!a) return;
  sfx('achievement');
  toast(`<div class="toast-icon">${a.icon}</div><div><div class="toast-title">Achievement — ${escapeHtml(a.name)}</div><div class="dim small">${escapeHtml(a.desc)}</div></div>`);
}
function toastUnlock(id){
  const c = CHAR_DEFS[id];
  if(!c) return;
  sfx('achievement');
  toast(`<div class="toast-icon">${c.sprite}</div><div><div class="toast-title">UNLOCKED — ${escapeHtml(c.name)}</div><div class="dim small">A new way to descend.</div></div>`);
}

/* ---------------- settings ---------------- */
function openSettings(){
  const s = SETTINGS;
  openOverlay(`<h2>⚙️ Settings</h2>
    <div class="settings-grid">
      <label>SFX volume</label>
      <input type="range" id="set-sfx" min="0" max="1" step="0.05" value="${s.sfx}">
      <label>Ambience volume</label>
      <input type="range" id="set-amb" min="0" max="1" step="0.05" value="${s.ambience}">
      <label>Game speed</label>
      <select id="set-speed">
        <option value="normal"${s.speed==='normal'?' selected':''}>Normal</option>
        <option value="fast"${s.speed==='fast'?' selected':''}>Fast</option>
        <option value="turbo"${s.speed==='turbo'?' selected':''}>Turbo</option>
      </select>
      <label>Screen shake</label>
      <input type="checkbox" id="set-shake"${s.shake?' checked':''}>
      <label>Hit particles</label>
      <input type="checkbox" id="set-particles"${s.particles?' checked':''}>
    </div>
    <div style="margin-top:18px">
      ${G && hasSavedRun() ? '<button id="set-abandon">Abandon current run</button>' : ''}
      <button id="set-wipe">Erase all progress</button>
      <button class="primary" onclick="closeOverlay()">Done</button>
    </div>`, true);
  $('set-sfx').oninput = e=>{ s.sfx = +e.target.value; audioApplyVolumes(); saveProfile(); };
  $('set-amb').oninput = e=>{ s.ambience = +e.target.value; audioApplyVolumes(); saveProfile(); };
  $('set-speed').onchange = e=>{ s.speed = e.target.value; saveProfile(); };
  $('set-shake').onchange = e=>{ s.shake = e.target.checked; saveProfile(); };
  $('set-particles').onchange = e=>{ s.particles = e.target.checked; saveProfile(); };
  const ab = $('set-abandon');
  if(ab) ab.onclick = ()=>{
    openOverlay(`<h2>Abandon run?</h2><p class="dim">Your current descent will be lost. Meta progress is kept.</p>
      <button class="primary" id="ab-yes">Abandon</button> <button onclick="closeOverlay()">Keep playing</button>`);
    $('ab-yes').onclick = ()=>{ clearRun(); G = null; closeOverlay(); showTitle(); };
  };
  $('set-wipe').onclick = ()=>{
    openOverlay(`<h2>Erase ALL progress?</h2><p class="dim">Unlocks, achievements, statistics and any saved run will be permanently deleted.</p>
      <button class="primary" id="wipe-yes">Erase everything</button> <button onclick="closeOverlay()">Cancel</button>`);
    $('wipe-yes').onclick = ()=>{
      storageDel(PROFILE_KEY); clearRun(); loadProfile(); G = null;
      closeOverlay(); showTitle();
    };
  };
}

/* ---------------- statistics & achievements ---------------- */
function openStats(){
  const st = PROFILE.stats;
  const charRows = Object.keys(CHAR_DEFS).map(id=>{
    const c = CHAR_DEFS[id], b = st.byChar[id] || {runs:0,wins:0,bestScore:0};
    return `<tr><td>${c.sprite} ${c.name}</td><td>${b.runs}</td><td>${b.wins}</td><td>${b.bestScore||'—'}</td><td>${charUnlocked(id)?('🔺'+maxAscension(id)):'🔒'}</td></tr>`;
  }).join('');
  const achHtml = Object.keys(ACH_DEFS).map(id=>{
    const a = ACH_DEFS[id], got = !!PROFILE.achievements[id];
    return `<div class="ach${got?' got':''}" data-tt="<b>${escapeHtml(a.name)}</b><br>${escapeHtml(a.desc)}">
      <div class="ach-icon">${got?a.icon:'🔒'}</div><div class="ach-name">${escapeHtml(a.name)}</div></div>`;
  }).join('');
  const nAch = Object.keys(PROFILE.achievements).length, totAch = Object.keys(ACH_DEFS).length;
  openOverlay(`<h2>📊 Statistics</h2>
    <div class="stats-cols">
      <div>Runs: <b>${st.runs}</b></div><div>Victories: <b>${st.wins}</b></div>
      <div>Best score: <b>${st.bestScore||'—'}</b></div><div>Win streak: <b>${st.streak}</b> (best ${st.bestStreak})</div>
      <div>Floors descended: <b>${st.totalFloors}</b></div><div>Monsters slain: <b>${st.totalKills}</b></div>
      <div>Biggest hit: <b>${st.biggestHit||'—'}</b></div><div>Daily climbs: <b>${Object.keys(PROFILE.daily).length}</b></div>
    </div>
    <table class="stats-table"><tr><th>Character</th><th>Runs</th><th>Wins</th><th>Best</th><th>Max Asc.</th></tr>${charRows}</table>
    <h2 style="margin-top:18px">🏅 Achievements (${nAch}/${totAch})</h2>
    <div class="ach-grid">${achHtml}</div>
    <br><button class="primary" onclick="closeOverlay()">Close</button>`, true);
}

/* ---------------- collection / compendium ---------------- */
function openCollection(){
  let html = `<h2>📖 Collection</h2>`;
  ['forgeborn','cinderwitch','scrapwright'].forEach(charId=>{
    const c = CHAR_DEFS[charId];
    const ids = Object.keys(CARD_DEFS).filter(id=>CARD_DEFS[id].char===charId && CARD_DEFS[id].rarity!=='starter');
    const starters = Object.keys(CARD_DEFS).filter(id=>CARD_DEFS[id].char===charId && CARD_DEFS[id].rarity==='starter');
    html += `<h3 class="coll-h">${c.sprite} ${c.name} ${charUnlocked(charId)?'':'· 🔒 '+escapeHtml(c.unlock||'')}</h3>
      <div class="deck-list" data-cards="${starters.concat(ids).join(',')}"></div>`;
  });
  const neutrals = Object.keys(CARD_DEFS).filter(id=>CARD_DEFS[id].char==='any');
  html += `<h3 class="coll-h">🌐 Neutral cards</h3><div class="deck-list" data-cards="${neutrals.join(',')}"></div>`;
  html += `<h3 class="coll-h">🏺 Relics</h3><div class="relic-grid">` +
    Object.keys(RELIC_DEFS).map(r=>{
      const d = RELIC_DEFS[r];
      return `<div class="relic-cell" data-tt="<b>${escapeHtml(d.name)}</b><br>${escapeHtml(d.desc)}"><span class="ric">${d.icon}</span><div class="small">${escapeHtml(d.name)}</div></div>`;
    }).join('') + `</div>`;
  html += `<br><button class="primary" onclick="closeOverlay()">Close</button>`;
  openOverlay(html, true);
  document.querySelectorAll('#overlay-panel .deck-list[data-cards]').forEach(list=>{
    list.dataset.cards.split(',').filter(Boolean).forEach(id=>{
      list.appendChild(renderCardEl(makeCard(id)));
    });
  });
}

/* ---------------- ambient embers ---------------- */
function spawnEmbers(){
  const box = $('embers');
  for(let i=0;i<22;i++){
    const e = document.createElement('div');
    e.className = 'emberp';
    e.style.left = Math.random()*100 + '%';
    e.style.animationDuration = (6+Math.random()*9) + 's';
    e.style.animationDelay = (-Math.random()*12) + 's';
    e.style.opacity = .25 + Math.random()*.5;
    e.style.width = e.style.height = (2+Math.random()*4)+'px';
    box.appendChild(e);
  }
}
