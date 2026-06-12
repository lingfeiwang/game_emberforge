"use strict";
/* ====================================================================
   EMBERFORGE DEPTHS — run flow, screens, shop, rest, events, boot
   ==================================================================== */

const ASC_DESCS = [
  'Enemies hit 10% harder.',
  'Normal enemies have 10% more HP.',
  'Begin each run with a Cracked Core curse.',
  'Rest sites heal 20% (down from 30%).',
  'Elites +20% HP · bosses +10% HP.',
  'Begin with 8 less Max HP.',
  'Shop prices +15%.',
  'Overheating sears +1 HP per point.',
  'Bosses enrage at 60% HP.',
  'No healing after boss fights.',
];

/* ============================ TITLE ============================ */
function showTitle(){
  closeOverlay();
  document.body.dataset.act = 'act1';
  const has = hasSavedRun();
  $('continue-btn').style.display = has ? '' : 'none';
  if(has){
    const d = loadRunData();
    $('continue-btn').innerHTML = `▶ &nbsp;CONTINUE — ${CHAR_DEFS[d.character].sprite} Act ${['I','II','III'][d.act]}, floor ${d.floorNum||1}${d.ascension?` · 🔺${d.ascension}`:''}`;
  }
  const daily = dailyConfig();
  const played = PROFILE.daily[daily.date];
  $('daily-sub').textContent = `${CHAR_DEFS[daily.character].name} · Ascension ${daily.ascension}` + (played ? ` · your best: ${played}` : '');
  showScreen('screen-title');
}

function openHowTo(){
  openOverlay(`<h2>📜 How to Play</h2>
    <div class="howto" style="text-align:left">
      <div class="howto-cell"><div class="howto-icon">🔥</div><b>HEAT, not energy</b>
        <p>Every card adds Heat. You are <i>never</i> blocked from playing — but each point over Capacity sears you for 2 HP, straight through Block. Heat resets each turn.</p></div>
      <div class="howto-cell"><div class="howto-icon">⛓</div><b>CHAIN combos</b>
        <p>Cards are tagged <span class="tag-STRIKE">STRIKE</span>, <span class="tag-GUARD">GUARD</span> or <span class="tag-ARC">ARC</span>. Match the tag of the previous card you played this turn to trigger <b>Chain</b> bonuses.</p></div>
      <div class="howto-cell"><div class="howto-icon">🧙</div><b>Three smiths, three fires</b>
        <p>The <b>Forgeborn</b> chains combos and holds Charge cards. The <b>Cinderwitch</b> stacks Burn and Ignites it. The <b>Scrapwright</b> fields a squad of Servos.</p></div>
      <div class="howto-cell"><div class="howto-icon">🗺️</div><b>The Descent</b>
        <p>Three acts with branching maps: combats, elites, shops, shrines, treasures, rest sites. A boss waits at the top of every act. Win to raise your Ascension — ten levels of escalating cruelty.</p></div>
      <div class="howto-cell"><div class="howto-icon">⌨️</div><b>Shortcuts</b>
        <p><b>1–9</b> play cards · <b>E</b> end turn · <b>D</b> view deck · <b>Esc</b> cancel/close. Click the draw/discard/exhaust counters to inspect those piles.</p></div>
      <div class="howto-cell"><div class="howto-icon">💾</div><b>Saving</b>
        <p>Your run is saved automatically at every room. Quitting mid-combat restarts that combat. Meta-progress (unlocks, achievements, ascensions) is permanent.</p></div>
    </div>
    <button class="primary" onclick="closeOverlay()">Close</button>`, true);
}

/* ============================ CHARACTER SELECT ============================ */
let selChar = 'forgeborn', selAsc = 0;

function openCharSelect(){
  if(!charUnlocked(selChar)) selChar = 'forgeborn';
  selAsc = Math.min(selAsc, maxAscension(selChar));
  renderCharSelect();
  showScreen('screen-charselect');
}
function renderCharSelect(){
  const box = $('char-cards');
  box.innerHTML = '';
  Object.keys(CHAR_DEFS).forEach(id=>{
    const c = CHAR_DEFS[id];
    const unlocked = charUnlocked(id);
    const el = document.createElement('div');
    el.className = 'char-card' + (id===selChar?' sel':'') + (unlocked?'':' locked');
    el.innerHTML = unlocked
      ? `<div class="cc-sprite">${c.sprite}</div><div class="cc-name">${c.name}</div>
         <div class="cc-title">${c.title}</div><div class="cc-mech">${c.mechanics}</div>
         <p class="cc-blurb">${c.blurb}</p>
         <div class="cc-stats">❤️ ${c.hp} HP · 🔥 ${c.cap} Capacity</div>`
      : `<div class="cc-sprite">🔒</div><div class="cc-name">${c.name}</div>
         <div class="cc-title">${c.title}</div><p class="cc-blurb dim">${c.unlock}.</p>`;
    if(unlocked) el.onclick = ()=>{ sfx('click'); selChar = id; selAsc = Math.min(selAsc, maxAscension(id)); renderCharSelect(); };
    box.appendChild(el);
  });
  /* ascension */
  const cap = maxAscension(selChar);
  $('asc-minus').disabled = selAsc <= 0;
  $('asc-plus').disabled = selAsc >= cap;
  $('asc-val').textContent = selAsc;
  $('asc-desc').innerHTML = selAsc === 0
    ? (cap === 0 ? 'Win a run to unlock Ascension levels.' : 'The standard descent.')
    : ASC_DESCS.slice(0, selAsc).map((d,i)=>`<div>🔺${i+1} ${d}</div>`).join('');
}
function ascAdjust(d){
  selAsc = clamp(selAsc + d, 0, maxAscension(selChar));
  renderCharSelect();
}
function embark(){
  const seedInput = $('seed-input').value.trim().toUpperCase();
  newRun({
    character: selChar,
    ascension: selAsc,
    seedStr: seedInput || randomSeedString(),
  });
}
function startDaily(){
  const cfg = dailyConfig();
  newRun({ character: cfg.character, ascension: cfg.ascension, seedStr: cfg.seedStr, daily: cfg.date });
}

/* ============================ RUN SETUP ============================ */
function newRun(opts){
  uid = 0;
  const charId = opts.character;
  const C = CHAR_DEFS[charId];
  seedRng(opts.seedStr + '·' + charId + '·A' + opts.ascension);
  const maxHp = C.hp - (opts.ascension >= 6 ? 8 : 0);
  G = {
    character: charId, ascension: opts.ascension, seedStr: opts.seedStr, daily: opts.daily || null,
    hp:maxHp, maxHp, gold:99, act:0, floorNum:0, permCap:0,
    relics:[C.relic], potions:[], deck:[], inCombat:false, playerTurn:false,
    map:null, currentNodeKey:null, visitedKeys:[], eventsSeen:[],
    removalCost:75, ended:false,
    runStats:{floors:0, kills:0, elites:0, bosses:0, biggestHit:0},
    combatStats:{hpLost:0, seared:0, potions:0},
    player:{block:0,strength:0,burn:0,exposed:0,rattled:0},
    enemies:[], hand:[], drawPile:[], discardPile:[], exhaustPile:[],
    heat:0, tempCap:0, capBonus:0, pendingHeat:0, lastTag:null,
    cardsPlayedThisTurn:0, nextAtkBonus:0, overheatedThisTurn:false, overheatedLastTurn:false,
    overheatPrevented:0, chainDrawUsed:false, furnace:0, alwaysChain:false,
    heatsink:false, asbestos:false, valve:0, strikeBonus:0, volcanic:false,
    echo:false, phoenix:0, phoenixUsed:false, extraDraw:0,
    retainBlockNext:false, combatTurn:0, currentCardTag:null,
    pyre:0, pyreDance:false, emberseal:false, cinderCrown:false, igniteEnd:false, feverPitch:0,
    servos:[], servoCap:3, servoBoost:0, servoTwice:false, fabricator:false, primeDirective:false, sentryBlock:0,
    igniteDrawUsed:false, sootSpongeUsed:false, chainStreak:0,
  };
  C.deck.forEach(d=>G.deck.push(makeCard(d)));
  if(opts.ascension >= 3) G.deck.push(makeCard('crackedCore'));
  startAct(0);
}

function startAct(act){
  G.act = act;
  G.map = generateMap();
  G.currentNodeKey = null;
  G.visitedKeys = [];
  document.body.dataset.act = ACT_DATA[act].theme;
  renderTopbar();
  resumeMap();
}

function resumeMap(){
  closeOverlay();
  renderTopbar();
  $('map-act-title').textContent = ACT_DATA[G.act].title;
  $('map-seed').textContent = `seed ${G.seedStr}${G.daily ? ' · DAILY CLIMB' : ''}`;
  renderMap();
  showScreen('screen-map');
  saveRun();
}

/* ============================ CONTINUE ============================ */
function continueRun(){
  const d = loadRunData();
  if(!d){ showTitle(); return; }
  uid = 0;
  RNG.s = d.rngState;
  G = {
    character:d.character, ascension:d.ascension, seedStr:d.seedStr, daily:d.daily,
    hp:d.hp, maxHp:d.maxHp, gold:d.gold, act:d.act, floorNum:d.floorNum, permCap:d.permCap||0,
    relics:[...d.relics], potions:[...d.potions],
    deck:d.deck.map(c=>makeCard(c.def, c.upgraded)),
    inCombat:false, playerTurn:false,
    map:d.map, currentNodeKey:d.currentNodeKey, visitedKeys:[...d.visitedKeys],
    eventsSeen:[...(d.eventsSeen||[])],
    removalCost:d.removalCost, ended:false,
    runStats:d.runStats || {floors:0,kills:0,elites:0,bosses:0,biggestHit:0},
    combatStats:{hpLost:0, seared:0, potions:0},
    player:{block:0,strength:0,burn:0,exposed:0,rattled:0},
    enemies:[], hand:[], drawPile:[], discardPile:[], exhaustPile:[],
    heat:0, tempCap:0, capBonus:0, pendingHeat:0, lastTag:null,
    cardsPlayedThisTurn:0, nextAtkBonus:0, overheatedThisTurn:false, overheatedLastTurn:false,
    overheatPrevented:0, chainDrawUsed:false, furnace:0, alwaysChain:false,
    heatsink:false, asbestos:false, valve:0, strikeBonus:0, volcanic:false,
    echo:false, phoenix:0, phoenixUsed:false, extraDraw:0,
    retainBlockNext:false, combatTurn:0, currentCardTag:null,
    pyre:0, pyreDance:false, emberseal:false, cinderCrown:false, igniteEnd:false, feverPitch:0,
    servos:[], servoCap:3, servoBoost:0, servoTwice:false, fabricator:false, primeDirective:false, sentryBlock:0,
    igniteDrawUsed:false, sootSpongeUsed:false, chainStreak:0,
  };
  document.body.dataset.act = ACT_DATA[G.act].theme;
  renderTopbar();
  if(d.pendingBossReward){
    showBossRewardOverlay(d.pendingBossReward);
  } else if(d.pendingReward){
    showRewardOverlay(d.pendingReward);
  } else if(d.pendingNode){
    if(d.shopState) G._restoredShop = d.shopState;
    resolveNode(d.pendingNode);
  } else {
    resumeMap();
  }
}

/* ============================ REWARDS ============================ */
function combatVictory(){
  award('firstSpark');
  if(combatKind && G.combatStats.hpLost === 0) award('untouchable');
  if(G.combatStats.seared >= 12) award('overheated');
  if(combatKind === 'boss'){ bossVictory(); return; }
  if(combatKind === 'elite') G.runStats.elites++;
  sfx('victory');
  const base = combatKind === 'elite' ? rand(40,60) : rand(15,25);
  const g = gainGoldCombat(base + G.act*6);
  let html = `<h2>⚔️ Victory!</h2><p>You salvage <b class="gold">${g} gold</b>.</p>`;
  if(chance(.35)){
    const p = rollPotion();
    if(gainPotion(p)) html += `<p>${POTION_DEFS[p].icon} Found a <b>${POTION_DEFS[p].name}</b>! <span class="dim">(${POTION_DEFS[p].desc})</span></p>`;
    else html += `<p class="dim">You spot a potion, but your belt is full.</p>`;
  }
  let relicLine = '';
  if(combatKind === 'elite'){
    const r = rollRelic();
    if(r){
      gainRelic(r);
      relicLine = `<p>Relic claimed: <span style="font-size:26px">${RELIC_DEFS[r].icon}</span> <b>${RELIC_DEFS[r].name}</b><br><span class="dim">${RELIC_DEFS[r].desc}</span></p>`;
    }
  }
  const nCards = 3 + (G.relics.includes('tinkerLens')?1:0);
  const cardIds = rollRewardCards(nCards, combatKind==='elite');
  /* checkpoint: spoils applied, card choice still open */
  saveRun({pendingReward:{cardIds, html: html + relicLine}});
  showRewardOverlay({cardIds, html: html + relicLine});
  renderTopbar();
}
function showRewardOverlay(rw){
  openOverlay(rw.html + `<p class="dim">Forge a new card into your deck:</p><div class="reward-row"></div>
    <button onclick="resumeMap()">Skip card</button>`);
  fillCardChoices(rw.cardIds, ()=>resumeMap());
}

function fillCardChoices(ids, onDone){
  const row = document.querySelector('#overlay-panel .reward-row');
  ids.forEach(defId=>{
    const card = makeCard(defId);
    const el = renderCardEl(card);
    el.classList.add('reward-card');
    el.onclick = ()=>{ sfx('click'); G.deck.push(card); renderTopbar(); onDone(); };
    row.appendChild(el);
  });
}
function openCardChoice(ids, onDone){
  openOverlay(`<h2>📚 Choose a card</h2><div class="reward-row"></div><button id="cardchoice-skip">Skip</button>`);
  $('cardchoice-skip').onclick = onDone;
  fillCardChoices(ids, onDone);
}

function bossVictory(){
  G.runStats.bosses++;
  sfx('victory');
  const g = gainGoldCombat(rand(95,110));
  if(G.ascension < 10) heal(Math.floor(G.maxHp*0.25));
  if(G.act === 0){ award('slagSlayer'); unlockChar('cinderwitch'); }
  if(G.act === 1){ award('galleryGhost'); unlockChar('scrapwright'); }
  if(G.act >= 2){ showWin(); return; }
  const relics = rollBossRelics(G.ascension >= 5 ? 2 : 3);
  const reward = {relicIds:relics, gold:g};
  saveRun({pendingBossReward:reward});
  showBossRewardOverlay(reward);
}
function showBossRewardOverlay(reward){
  let html = `<h2>👑 ${actBoss().name} falls!</h2>
    <p>You loot <b class="gold">${reward.gold} gold</b>${G.ascension<10?' and patch yourself up (+25% HP)':''}.</p>
    <p class="dim">Choose a boss relic:</p><div class="reward-row boss-relics"></div>`;
  openOverlay(html);
  const row = document.querySelector('#overlay-panel .boss-relics');
  reward.relicIds.forEach(rid=>{
    const d = RELIC_DEFS[rid];
    const el = document.createElement('div');
    el.className = 'relic-choice';
    el.innerHTML = `<div class="ric">${d.icon}</div><b>${d.name}</b><div class="dim">${d.desc}</div>`;
    el.onclick = ()=>{ gainRelic(rid); startAct(G.act+1); };
    row.appendChild(el);
  });
  if(reward.relicIds.length === 0){
    document.querySelector('#overlay-panel').innerHTML += `<button class="primary" onclick="startAct(G.act+1)">Descend</button>`;
  }
}

/* ============================ RUN END ============================ */
function endRunScreens(win, source){
  if(G.ended) return null;
  G.ended = true;
  const sc = scoreRun(win);
  recordRunEnd(win, sc.total);
  clearRun();
  const rows = sc.rows.map(r=>`<tr><td>${r[0]}</td><td class="gold">${r[1]}</td></tr>`).join('');
  return `<table class="score-table">${rows}<tr class="score-total"><td>SCORE</td><td class="gold">${sc.total}</td></tr></table>
    <p class="dim small">seed ${G.seedStr}${G.daily?' · DAILY CLIMB':''} · ${CHAR_DEFS[G.character].name}${G.ascension?' · Ascension '+G.ascension:''}</p>`;
}
function showGameOver(source){
  const scoreHtml = endRunScreens(false, source);
  if(scoreHtml === null) return;
  sfx('defeat');
  $('death-text').textContent = `Destroyed by ${source} — Act ${G.act+1}, floor ${G.floorNum}. The forge swallows another soul.`;
  $('death-stats').innerHTML = scoreHtml;
  closeOverlay();
  showScreen('screen-gameover');
}
function showWin(){
  const scoreHtml = endRunScreens(true, null);
  if(scoreHtml === null) return;
  sfx('victory');
  $('win-stats').innerHTML = scoreHtml;
  const nextAsc = maxAscension(G.character);
  $('win-next').textContent = (!G.daily && nextAsc > G.ascension && nextAsc <= 10)
    ? `Ascension ${nextAsc} unlocked for ${CHAR_DEFS[G.character].name}: ${ASC_DESCS[nextAsc-1]}` : '';
  closeOverlay();
  showScreen('screen-win');
}

/* ============================ REST ============================ */
function restHeal(){
  const pct = G.ascension >= 4 ? 0.20 : 0.30;
  heal(Math.floor(G.maxHp*pct));
  openOverlay(`<h2>🛏️ Rested</h2><p>You power down among the warm pipes. <b>+${Math.round(pct*100)}% HP.</b></p>
    <button class="primary" onclick="resumeMap()">Continue</button>`);
}
function restSmith(){
  openSmith(()=>resumeMap(), G.relics.includes('smithingHammer'));
}

function openSmith(onDone, bonusHeal){
  const upgradable = G.deck.filter(c=>!c.upgraded && !cardDef(c).unplayable);
  if(upgradable.length === 0){
    openOverlay(`<h2>🔨 Smith</h2><p>Every card in your deck already gleams.</p><button class="primary" id="smith-done">Continue</button>`);
    $('smith-done').onclick = onDone;
    return;
  }
  openOverlay(`<h2>🔨 Smith — upgrade a card</h2><p class="dim">Click a card to upgrade it permanently.</p>
    <div class="deck-list"></div><br><button id="smith-cancel">Never mind</button>`);
  $('smith-cancel').onclick = onDone;
  const list = document.querySelector('#overlay-panel .deck-list');
  upgradable.forEach(card=>{
    const el = renderCardEl(card);
    el.onclick = ()=>{
      card.upgraded = true;
      sfx('relic');
      if(bonusHeal) heal(10);
      const after = renderCardEl(card);
      openOverlay(`<h2>🔨 Forged!</h2>${bonusHeal?'<p class="dim">The Smithing Hammer\'s rhythm soothes: +10 HP.</p>':''}<div class="reward-row" id="smith-result"></div>
        <button class="primary" id="smith-done">Continue</button>`);
      $('smith-result').appendChild(after);
      $('smith-done').onclick = onDone;
    };
    list.appendChild(el);
  });
}

function openPurge(onDone){
  openOverlay(`<h2>🗑️ Remove a card</h2><p class="dim">Click a card to remove it from your deck forever.</p>
    <div class="deck-list"></div><br><button id="purge-cancel">Never mind</button>`);
  $('purge-cancel').onclick = onDone;
  const list = document.querySelector('#overlay-panel .deck-list');
  G.deck.forEach(card=>{
    const el = renderCardEl(card);
    el.onclick = ()=>{ G.deck = G.deck.filter(c=>c.id!==card.id); renderTopbar(); onDone(); };
    list.appendChild(el);
  });
}

function openDuplicate(onDone){
  openOverlay(`<h2>🪞 Duplicate a card</h2><p class="dim">Click a card to copy it.</p>
    <div class="deck-list"></div><br><button id="dup-cancel">Never mind</button>`);
  $('dup-cancel').onclick = onDone;
  const list = document.querySelector('#overlay-panel .deck-list');
  G.deck.filter(c=>!cardDef(c).unplayable).forEach(card=>{
    const el = renderCardEl(card);
    el.onclick = ()=>{ G.deck.push(makeCard(card.def, card.upgraded)); renderTopbar(); onDone(); };
    list.appendChild(el);
  });
}

/* ============================ SHOP ============================ */
let shopStock = null;
function shopPrice(n){
  let p = n;
  if(G.relics.includes('luckyCog')) p *= 0.75;
  if(G.ascension >= 7) p *= 1.15;
  return Math.round(p);
}

function serializeShop(){
  return {
    cards: shopStock.cards.map(it=>({def:it.card.def, price:it.price, sold:it.sold})),
    relics: shopStock.relics.map(it=>({id:it.id, price:it.price, sold:it.sold})),
    potions: shopStock.potions.map(it=>({id:it.id, price:it.price, sold:it.sold})),
  };
}
function openShop(){
  if(G._restoredShop){
    const s = G._restoredShop;
    G._restoredShop = null;
    shopStock = {
      cards: s.cards.map(it=>({card:makeCard(it.def), price:it.price, sold:it.sold})),
      relics: s.relics.map(it=>({id:it.id, price:it.price, sold:it.sold})),
      potions: s.potions.map(it=>({id:it.id, price:it.price, sold:it.sold})),
    };
  } else {
    const cardIds = [];
    const used = new Set();
    const want = [['common',2],['uncommon',2],['rare',1]];
    want.forEach(([rar,n])=>{
      let guard=0;
      while(n>0 && guard++<60){
        const id = randomCardOfRarity(rar);
        if(used.has(id)) continue;
        used.add(id); cardIds.push({id, rarity:rar}); n--;
      }
    });
    const prices = {common:()=>rand(45,55), uncommon:()=>rand(75,90), rare:()=>rand(135,160)};
    shopStock = {
      cards: cardIds.map(c=>({card:makeCard(c.id), price:prices[c.rarity](), sold:false})),
      relics: [rollRelic(), rollRelic()].filter(Boolean).filter((v,i,a)=>a.indexOf(v)===i)
              .map(r=>({id:r, price:rand(145,165), sold:false})),
      potions: [rollPotion(), rollPotion()].map(p=>({id:p, price:rand(48,58), sold:false})),
    };
  }
  saveRun({pendingNode:G.currentNodeKey, shopState:serializeShop()});
  renderShop();
  showScreen('screen-shop');
}
function shopCheckpoint(){
  saveRun({pendingNode:G.currentNodeKey, shopState:serializeShop()});
}

function renderShop(){
  renderTopbar();
  const wrap = $('shop-items');
  wrap.innerHTML = '';
  /* cards */
  const cardRow = document.createElement('div'); cardRow.className = 'shop-row';
  shopStock.cards.forEach(item=>{
    const cell = document.createElement('div'); cell.className = 'shop-cell';
    if(item.sold){ cell.innerHTML = `<div class="sold">SOLD</div>`; cardRow.appendChild(cell); return; }
    const el = renderCardEl(item.card);
    const price = shopPrice(item.price);
    const tag = document.createElement('div');
    tag.className = 'price' + (G.gold < price ? ' poor':'');
    tag.textContent = `${price}g`;
    cell.appendChild(el); cell.appendChild(tag);
    cell.onclick = ()=>{
      if(G.gold < price || item.sold) return;
      G.gold -= price; item.sold = true;
      G.deck.push(item.card);
      sfx('gold');
      shopCheckpoint();
      renderShop();
    };
    cardRow.appendChild(cell);
  });
  wrap.appendChild(cardRow);
  /* relics & potions */
  const row2 = document.createElement('div'); row2.className = 'shop-row';
  shopStock.relics.forEach(item=>{
    const d = RELIC_DEFS[item.id];
    const price = shopPrice(item.price);
    const cell = document.createElement('div'); cell.className = 'shop-cell shop-trinket';
    cell.innerHTML = item.sold ? `<div class="sold">SOLD</div>` :
      `<div class="ric">${d.icon}</div><b>${d.name}</b><div class="dim small">${d.desc}</div>
       <div class="price${G.gold<price?' poor':''}">${price}g</div>`;
    if(!item.sold) cell.onclick = ()=>{
      if(G.gold < price) return;
      G.gold -= price; item.sold = true;
      gainRelic(item.id);
      shopCheckpoint();
      renderShop();
    };
    row2.appendChild(cell);
  });
  shopStock.potions.forEach(item=>{
    const d = POTION_DEFS[item.id];
    const price = shopPrice(item.price);
    const cell = document.createElement('div'); cell.className = 'shop-cell shop-trinket';
    cell.innerHTML = item.sold ? `<div class="sold">SOLD</div>` :
      `<div class="ric">${d.icon}</div><b>${d.name}</b><div class="dim small">${d.desc}</div>
       <div class="price${G.gold<price?' poor':''}">${price}g</div>`;
    if(!item.sold) cell.onclick = ()=>{
      if(G.gold < price) return;
      if(!gainPotion(item.id)) return;
      G.gold -= price; item.sold = true;
      sfx('potion');
      shopCheckpoint();
      renderShop();
    };
    row2.appendChild(cell);
  });
  /* removal service */
  const rm = document.createElement('div'); rm.className = 'shop-cell shop-trinket';
  const rmPrice = shopPrice(G.removalCost);
  rm.innerHTML = `<div class="ric">🗑️</div><b>Card Removal</b><div class="dim small">Smelt a card out of your deck.</div>
    <div class="price${G.gold<rmPrice?' poor':''}">${rmPrice}g</div>`;
  rm.onclick = ()=>{
    if(G.gold < rmPrice) return;
    openPurgeForShop(rmPrice);
  };
  row2.appendChild(rm);
  wrap.appendChild(row2);
}
function openPurgeForShop(price){
  openOverlay(`<h2>🗑️ Remove a card</h2><div class="deck-list"></div><br><button id="purge-cancel">Never mind</button>`);
  $('purge-cancel').onclick = ()=>{ closeOverlay(); };
  const list = document.querySelector('#overlay-panel .deck-list');
  G.deck.forEach(card=>{
    const el = renderCardEl(card);
    el.onclick = ()=>{
      G.gold -= price; G.removalCost += 25;
      G.deck = G.deck.filter(c=>c.id!==card.id);
      closeOverlay();
      shopCheckpoint();
      renderShop();
    };
    list.appendChild(el);
  });
}

/* ============================ EVENTS ============================ */
function openEvent(){
  const ev = rollEvent();
  $('event-icon').textContent = ev.icon;
  $('event-title').textContent = ev.title;
  $('event-text').textContent = ev.text;
  const box = $('event-choices');
  box.innerHTML = '';
  ev.choices().forEach(ch=>{
    const b = document.createElement('button');
    b.className = 'event-btn';
    b.innerHTML = `<b>${ch.label}</b>${ch.desc?`<span class="dim"> — ${ch.desc}</span>`:''}`;
    if(ch.disabled) b.disabled = true;
    b.onclick = ()=>{
      sfx('click');
      const result = ch.fn();
      renderTopbar();
      if(G.hp <= 0){ playerDies(ev.title); return; }
      if(result === null) return; /* choice opened its own overlay */
      openOverlay(`<h2>${ev.icon} ${ev.title}</h2><p>${result}</p>
        <button class="primary" onclick="resumeMap()">Continue</button>`);
    };
    box.appendChild(b);
  });
  showScreen('screen-event');
}

/* ============================ KEYBOARD ============================ */
function initKeyboard(){
  document.addEventListener('keydown', e=>{
    if(e.repeat) return;
    const tag = (document.activeElement && document.activeElement.tagName) || '';
    if(tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA') return;
    const overlayOpen = $('overlay').classList.contains('active');
    if(e.key === 'Escape'){
      if(overlayOpen){
        if($('overlay').dataset.dismissible === '1') closeOverlay();
      } else if(selectedCard){
        selectedCard = null; renderCombat();
      }
      return;
    }
    if(overlayOpen) return;
    const inCombat = G && G.inCombat && G.playerTurn;
    if(inCombat){
      if(/^[0-9]$/.test(e.key)){
        const idx = e.key === '0' ? 9 : (+e.key - 1);
        const card = G.hand[idx];
        if(card){
          if(selectedCard && selectedCard.id === card.id){ selectedCard = null; renderCombat(); }
          else tryPlayCard(card);
        }
        return;
      }
      if(e.key === 'e' || e.key === 'E' || e.key === 'Enter'){ endTurn(); return; }
    }
    if((e.key === 'd' || e.key === 'D') && G){ showDeckOverlay(); }
  });
}

/* ---------------- boot ---------------- */
window.addEventListener('DOMContentLoaded', ()=>{
  loadProfile();
  spawnEmbers();
  initTooltips();
  initKeyboard();
  $('deck-btn').onclick = ()=>showDeckOverlay();
  $('pile-draw-btn').onclick = ()=>showPileOverlay('draw');
  $('pile-discard-btn').onclick = ()=>showPileOverlay('discard');
  $('pile-exhaust-btn').onclick = ()=>showPileOverlay('exhaust');
  $('settings-btn').onclick = ()=>openSettings();
  showTitle();
});
