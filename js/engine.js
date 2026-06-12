"use strict";
/* ====================================================================
   EMBERFORGE DEPTHS — combat engine & shared state
   ==================================================================== */
let G = null;
let combatKind = false; /* false | 'elite' | 'boss' */
let selectedCard = null;

function log(msg){
  const el = $('log');
  if(!el) return;
  el.innerHTML += `<div>${msg}</div>`;
  el.scrollTop = el.scrollHeight;
}

/* ---------------- run-level helpers ---------------- */
function capacity(){
  let c = CHAR_DEFS[G.character].cap;
  if(G.relics.includes('bellows')) c += 1;
  if(G.relics.includes('crownOfCinders')) c += 3;
  if(G.relics.includes('voidPiston')) c += 2;
  if(G.relics.includes('nullGovernor')) c += 4;
  return c + G.permCap + G.capBonus + G.tempCap;
}
function heal(n){
  if(n <= 0) return;
  const before = G.hp;
  G.hp = Math.min(G.maxHp, G.hp + n);
  if(G.hp > before){ sfx('heal'); fxHeal(G.hp - before); }
  renderTopbar();
}
function loseHp(n){ /* out-of-combat losses (events); caller checks for death */
  G.hp = Math.max(0, G.hp - n);
  renderTopbar();
}
function gainGoldCombat(base){
  let g = base;
  if(G.relics.includes('emberBank')) g = Math.round(g*1.25);
  if(G.relics.includes('gearOfMidas')) g = Math.round(g*1.4);
  if(G.relics.includes('gildedHeart')) g = Math.round(g*0.75);
  G.gold += g;
  sfx('gold');
  return g;
}
function potionSlots(){ return 3 + (G.relics.includes('gildedFlask')?1:0); }
function gainPotion(id){
  if(G.potions.length >= potionSlots()) return false;
  G.potions.push(id);
  renderTopbar();
  return true;
}
function gainRelic(id){
  if(G.relics.includes(id)) return;
  G.relics.push(id);
  if(id==='moltenIdol'){ G.maxHp += 12; G.hp += 12; }
  if(id==='perpetualBellows'){ G.maxHp -= 7; G.hp = Math.min(G.hp, G.maxHp); }
  if(id==='gearOfMidas'){ G.gold += 150; }
  if(id==='gildedHeart'){ G.maxHp += 30; G.hp += 30; }
  sfx('relic');
  renderTopbar();
}

/* ---------------- combat primitives ---------------- */
function addHeat(n){ G.heat += n; }
function vent(n){
  if(G.relics.includes('nullGovernor')){
    if(n > 0) log('The <span class="hl">Null Governor</span> forbids venting.');
    return;
  }
  const v = Math.min(n, G.heat);
  if(v <= 0) return;
  G.heat -= v;
  log(`Vented <span class="hl">${v}</span> Heat.`);
  sfx('vent');
  if(G.relics.includes('ventTurbine')){
    const b = Math.floor(v/2);
    if(b > 0) gainBlock(b);
  }
}
function gainBlock(n){
  if(G.currentCardTag === 'GUARD' && G.relics.includes('bulwarkLens')) n += 1;
  G.player.block += n;
  log(`You gain <span class="hl">${n}</span> Block.`);
  sfx('block');
  fxBlock(n);
}
function applyStatus(target, status, amt){
  if(target !== G.player && status === 'burn'){
    if(G.relics.includes('emberCharm')) amt += 1;
    amt += (G.pyre || 0);
    if(G.pyreDance) gainBlock(1);
  }
  target[status] = (target[status]||0) + amt;
  const who = target === G.player ? 'You' : target.name;
  const names = {burn:'Burn', exposed:'Exposed', rattled:'Rattled'};
  log(`${who} ${target===G.player?'gain':'gains'} <span class="hl">${amt} ${names[status]||status}</span>.`);
  if(status === 'burn'){
    sfx('burn');
    if(target !== G.player && target.burn >= 20) award('pyromaniac');
  }
}

/* player → enemy damage */
function dealDamage(target, base, pure){
  if(!target || target.hp <= 0) return;
  let dmg = base;
  if(!pure){
    dmg += (G.player.strength||0);
    if(G.relics.includes('whetstone')) dmg += 2;
    if(G.currentCardTag === 'STRIKE'){
      dmg += G.strikeBonus;
      if(G.relics.includes('emberLens')) dmg += 1;
    }
    if(G.nextAtkBonus > 0){ dmg += G.nextAtkBonus; G.nextAtkBonus = 0; }
    if(G.player.rattled > 0) dmg = Math.floor(dmg * 0.75);
  }
  if(target.exposed > 0) dmg = Math.floor(dmg * 1.5);
  let dealt = dmg;
  if(target.block > 0){
    const absorbed = Math.min(target.block, dealt);
    target.block -= absorbed; dealt -= absorbed;
  }
  target.hp = Math.max(0, target.hp - dealt);
  fxHit(target.id, dmg, dealt);
  sfx(dmg >= 14 ? 'heavyHit' : 'attack');
  log(`You hit ${target.name} for <span class="hl">${dmg}</span>${dealt<dmg?' (blocked '+(dmg-dealt)+')':''}.`);
  if(dmg >= 50) award('haymaker');
  if(PROFILE && dmg > PROFILE.stats.biggestHit){ PROFILE.stats.biggestHit = dmg; }
  G.runStats.biggestHit = Math.max(G.runStats.biggestHit||0, dmg);
  if(target.hp <= 0) onEnemyDeath(target);
}
function onEnemyDeath(e){
  log(`<span class="hl">${e.name} is destroyed!</span>`);
  sfx('enemyDie');
  G.runStats.kills++;
  /* Pyre Locket: burn spreads on death */
  if(e.burn > 0 && G.relics.includes('pyreLocket')){
    const alive = G.enemies.filter(x=>x.hp>0);
    if(alive.length){
      const t = pick(alive);
      log(`The <span class="hl">Pyre Locket</span> flares — the fire leaps onward!`);
      applyStatus(t, 'burn', e.burn);
    }
  }
  /* Cinder Crown */
  if(G.cinderCrown){
    const alive = G.enemies.filter(x=>x.hp>0);
    if(alive.length){
      log('The <span class="hl">Cinder Crown</span> blazes!');
      alive.forEach(t=>applyStatus(t,'burn',4));
    }
  }
  /* clear the corpse's statuses (after death triggers consumed them) so a
     spread Burn visibly leaves the dead enemy instead of lingering on it */
  e.burn = 0; e.exposed = 0; e.rattled = 0; e.block = 0; e.strength = 0;
}

/* ignite: target suffers its burn immediately (burn not removed) */
function igniteEnemy(t, mult){
  if(!t || t.hp <= 0) return;
  const amt = (t.burn||0) * (mult||1);
  if(amt <= 0){ log(`${t.name} has no Burn to ignite.`); return; }
  sfx('ignite');
  log(`<span class="hl">IGNITE!</span> ${t.name}'s wounds catch fire.`);
  dealDamage(t, amt, true);
  if(G.relics.includes('witchsEye') && !G.igniteDrawUsed){
    G.igniteDrawUsed = true;
    drawCards(1);
    log("The Witch's Eye opens: draw 1.");
  }
}
function igniteAll(mult){
  G.enemies.filter(e=>e.hp>0).forEach(e=>igniteEnemy(e, mult));
}

/* ---------------- servos (Scrapwright) ---------------- */
function servoPowerBonus(){ return G.servoBoost + (G.relics.includes('sparkCalipers')?1:0); }
function deployServo(type){
  if(G.servos.length >= G.servoCap){
    log('No room to deploy another Servo.');
    return null;
  }
  const s = { id:'s'+(uid++), type };
  G.servos.push(s);
  const d = SERVO_DEFS[type];
  log(`Deployed ${d.icon} <span class="hl">${d.name}</span>.`);
  sfx('servo');
  if(G.relics.includes('magnetCoupling')) gainBlock(2);
  if(G.servos.length >= 3) award('servoLord');
  if(G.primeDirective) servoAct(s);
  renderCombat();
  return s;
}
function destroyServo(){
  const s = G.servos.pop();
  if(!s) return null;
  log(`${SERVO_DEFS[s.type].icon} ${SERVO_DEFS[s.type].name} is consumed.`);
  renderCombat();
  return s;
}
function servoAct(s){
  if(!G.inCombat) return;
  const b = servoPowerBonus();
  const alive = G.enemies.filter(e=>e.hp>0);
  if(s.type === 'strike'){
    if(alive.length){
      const t = pick(alive);
      log(`🗡️ Strike Servo fires at ${t.name}.`);
      dealDamage(t, 4 + b, true);
    }
  } else if(s.type === 'aegis'){
    log('🛡️ Aegis Servo projects a barrier.');
    gainBlock(4 + b);
  } else if(s.type === 'volt'){
    if(alive.length){
      log('⚡ Volt Servo discharges!');
      alive.forEach(e=>{ if(e.hp>0) dealDamage(e, 2 + Math.ceil(b/2), true); });
    }
  }
}
function servosAct(){ G.servos.slice().forEach(s=>{ if(G.inCombat) servoAct(s); }); }

/* enemy → player damage */
function damagePlayer(dmg, source, ignoreBlock){
  let dealt = dmg;
  if(!ignoreBlock && G.player.block > 0){
    const absorbed = Math.min(G.player.block, dealt);
    G.player.block -= absorbed; dealt -= absorbed;
  }
  applyHpLoss(dealt, source, dmg);
}
function applyHpLoss(dealt, source, shown){
  G.hp = Math.max(0, G.hp - dealt);
  G.combatStats.hpLost += dealt;
  if(dealt > 0){ fxPlayerHit(); sfx('playerHit'); }
  log(`${source} hits you for <span class="hl">${shown!==undefined?shown:dealt}</span>${shown!==undefined&&dealt<shown?' (blocked '+(shown-dealt)+')':''}.`);
  renderTopbar();
  checkPlayerDeath(source);
}
function selfDamage(n, source){ /* card costs: pierce block */
  G.hp = Math.max(0, G.hp - n);
  G.combatStats.hpLost += n;
  fxPlayerHit();
  log(`${source} costs you <span class="hl">${n}</span> HP.`);
  renderTopbar();
  checkPlayerDeath(source);
}
function checkPlayerDeath(source){
  if(G.hp > 0) return;
  if(G.inCombat && G.phoenix > 0 && !G.phoenixUsed){
    G.phoenixUsed = true;
    G.hp = Math.max(1, Math.floor(G.maxHp * G.phoenix / 100));
    log(`<span class="hl">PHOENIX PROTOCOL!</span> You reboot at ${G.hp} HP.`);
    renderTopbar();
    return;
  }
  playerDies(source);
}
function playerDies(source){
  G.inCombat = false;
  G.playerTurn = false;
  showGameOver(source);
}

/* ---------------- combat flow ---------------- */
function startCombat(encounter, kind){
  combatKind = kind || false;
  G.inCombat = true;
  G.playerTurn = false;
  G.enemies = encounter.map(makeEnemy);
  Object.assign(G, {
    heat:0, tempCap:0, capBonus:0, pendingHeat:0,
    lastTag:null, cardsPlayedThisTurn:0, nextAtkBonus:0,
    overheatedThisTurn:false, overheatedLastTurn:false, overheatPrevented:0, chainDrawUsed:false,
    furnace:0, alwaysChain:false, heatsink:false, asbestos:false,
    valve:0, strikeBonus:0, volcanic:false, echo:false,
    phoenix:0, phoenixUsed:false, extraDraw:0,
    retainBlockNext:false, combatTurn:0, currentCardTag:null,
    pyre:0, pyreDance:false, emberseal:false, cinderCrown:false,
    igniteEnd:false, feverPitch:0, igniteDrawUsed:false,
    servos:[], servoCap:3, servoBoost:0, servoTwice:false,
    fabricator:false, primeDirective:false, sentryBlock:0,
    sootSpongeUsed:false, chainStreak:0,
  });
  G.combatStats = { hpLost:0, seared:0, potions:0 };
  G.player = {block:0, strength:0, burn:0, exposed:0, rattled:0};
  if(G.relics.includes('warBanner')) G.player.strength += 1;
  if(G.relics.includes('voidPiston')) G.player.strength += 1;
  G.drawPile = shuffle(G.deck.map(c=>({...c, held:0})));
  G.discardPile = []; G.hand = []; G.exhaustPile = [];
  $('log').innerHTML = '';
  log(`<span class="ph">— ${kind==='boss'?'BOSS BATTLE':(kind==='elite'?'ELITE combat':'Combat')} · floor ${G.floorNum} —</span>`);
  if(G.relics.includes('slagMagnet')) G.enemies.forEach(e=>applyStatus(e,'burn',2));
  if(G.relics.includes('loadstone')) G.enemies.forEach(e=>applyStatus(e,'rattled',1));
  if(G.relics.includes('crownOfCinders')){ log('The Crown of Cinders sears your brow.'); G.hp = Math.max(1, G.hp-3); renderTopbar(); }
  if(G.relics.includes('rivetDriver')) deployServo('strike');
  G.enemies.forEach(e=>{ e.turn = 0; e.nextAction = ENEMY_DEFS[e.def].ai(e); });
  showScreen('screen-combat');
  if(kind === 'boss'){
    sfx('bossIntro');
    showBossBanner(G.enemies[0] ? G.enemies[0].name : 'BOSS');
  }
  startPlayerTurn();
}

function startPlayerTurn(){
  G.combatTurn++;
  G.playerTurn = true;
  G.heat = G.pendingHeat; G.pendingHeat = 0;
  G.tempCap = 0;
  /* block retention */
  if(G.retainBlockNext){ G.retainBlockNext = false; }
  else if(G.relics.includes('anchorGear')) G.player.block = Math.min(6, G.player.block);
  else G.player.block = 0;
  if(G.relics.includes('ironPlating') && G.combatTurn === 1) G.player.block += 8;
  G.lastTag = null; G.cardsPlayedThisTurn = 0; G.overheatedThisTurn = false;
  G.chainDrawUsed = false; G.igniteDrawUsed = false; G.chainStreak = 0;
  G.overheatPrevented = G.relics.includes('coolantSeal') ? 4 : 0;
  G.hand.forEach(c=>c.held++);
  let drawN = 5 + (G.relics.includes('surgeCap')?1:0) + (G.relics.includes('perpetualBellows')?1:0) + G.extraDraw;
  drawCards(drawN);
  if(G.combatTurn > 1) showTurnBanner('YOUR TURN');
  /* turn-start damage powers */
  let aoe = G.furnace + (G.relics.includes('moltenCore')?3:0);
  if(aoe > 0){
    log(`Your core sears all enemies for <span class="hl">${aoe}</span>.`);
    G.enemies.forEach(e=>{ if(e.hp>0) dealDamage(e, aoe, true); });
    if(checkCombatEnd()) return;
  }
  if(G.feverPitch > 0){
    const alive = G.enemies.filter(e=>e.hp>0);
    if(alive.length) applyStatus(pick(alive), 'burn', G.feverPitch);
  }
  if(G.fabricator && G.servos.length < G.servoCap){
    log('The Fabricator assembles reinforcements.');
    deployServo(pick(['strike','aegis','volt']));
  }
  if(G.servos.length){
    servosAct();
    if(G.servoTwice) servosAct();
    if(checkCombatEnd()) return;
  }
  selectedCard = null;
  $('end-turn-btn').disabled = false;
  renderCombat();
}

function drawCards(n){
  let drawn = 0;
  for(let i=0;i<n;i++){
    if(G.drawPile.length === 0){
      if(G.discardPile.length === 0) break;
      G.drawPile = shuffle(G.discardPile);
      G.discardPile = [];
    }
    G.hand.push(G.drawPile.pop());
    drawn++;
  }
  if(drawn > 0) sfx('draw');
  if(G.inCombat) renderCombat();
}

function effectiveCost(card){
  let c = cv(card,'cost');
  if(G.relics.includes('pocketAnvil') && G.cardsPlayedThisTurn === 0) c = Math.max(0, c-1);
  if(cardDef(card).power && G.relics.includes('overseerCore')) c = Math.max(0, c-1);
  return c;
}

function tryPlayCard(card){
  const def = cardDef(card);
  if(def.unplayable) return;
  if(def.target === 'enemy' && G.enemies.filter(e=>e.hp>0).length > 1){
    selectedCard = card;
    renderCombat();
    return;
  }
  const target = def.target === 'enemy' ? G.enemies.find(e=>e.hp>0) : null;
  playCard(card, target);
}

function playCard(card, target){
  if(!G.inCombat || !G.playerTurn) return;
  const def = cardDef(card);
  selectedCard = null;
  sfx('cardPlay');
  fxCardPlayed(card);
  /* pay heat, handle overheat */
  const cost = effectiveCost(card);
  const before = G.heat;
  G.heat += cost;
  const cap = capacity();
  const overflow = Math.max(0, G.heat - cap) - Math.max(0, before - cap);
  if(overflow > 0){
    G.overheatedThisTurn = true;
    let perPoint = (G.asbestos ? 1 : 2) + (G.ascension >= 8 ? 1 : 0);
    let sear = overflow * perPoint;
    if(G.heatsink){
      gainBlock(sear);
      log(`<span class="hl">Heatsink Array</span> converts the overheat.`);
    } else if(G.relics.includes('sootSponge') && !G.sootSpongeUsed){
      G.sootSpongeUsed = true;
      log('The <span class="hl">Soot Sponge</span> drinks the overheat. No searing.');
    } else {
      const prevented = Math.min(G.overheatPrevented, sear);
      G.overheatPrevented -= prevented; sear -= prevented;
      if(prevented > 0) log(`Coolant Seal prevents ${prevented} searing.`);
      if(sear > 0){
        G.hp = Math.max(0, G.hp - sear);
        G.combatStats.seared += sear;
        G.combatStats.hpLost += sear;
        log(`<span style="color:var(--bad)">OVERHEAT!</span> You sear yourself for <span class="hl">${sear}</span>.`);
        sfx('overheat');
        fxPlayerHit();
        renderTopbar();
        checkPlayerDeath('your own furnace');
        if(G.hp <= 0) return;
      }
    }
  }
  /* chain determination */
  const chained = G.alwaysChain
    || (G.lastTag !== null && G.lastTag === def.tag)
    || (G.cardsPlayedThisTurn === 0 && G.relics.includes('flywheel'))
    || (def.tag === 'STRIKE' && G.relics.includes('foundrySigil'));
  if(chained){
    log(`<span style="color:var(--arc)">⛓ CHAIN</span> · ${cardName(card)}`);
    G.chainStreak++;
    if(G.chainStreak >= 4) award('chainGang');
    if(G.relics.includes('chainLocket') && !G.chainDrawUsed){
      G.chainDrawUsed = true;
      drawCards(1);
      log('Chain Locket clinks: draw 1.');
    }
  } else {
    G.chainStreak = 0;
  }
  const isFirst = G.cardsPlayedThisTurn === 0;
  G.lastTag = def.tag;
  G.cardsPlayedThisTurn++;
  G.currentCardTag = def.tag;
  /* remove from hand, resolve */
  G.hand = G.hand.filter(c=>c.id !== card.id);
  def.play(card, target, chained);
  if(G.echo && isFirst && G.inCombat){
    log(`<span class="hl">Resonant Bell</span> echoes ${cardName(card)}!`);
    const t2 = (target && target.hp > 0) ? target : G.enemies.find(e=>e.hp>0);
    if(def.target !== 'enemy' || t2) def.play(card, t2, chained);
  }
  if(G.volcanic && def.tag === 'STRIKE' && G.inCombat){
    const alive = G.enemies.filter(e=>e.hp>0);
    if(alive.length) applyStatus(pick(alive),'burn',1);
  }
  G.currentCardTag = null;
  if(def.power || def.exhaust) G.exhaustPile.push(card);
  else G.discardPile.push(card);
  if(checkCombatEnd()) return;
  if(!G.inCombat) return; /* died to overheat etc. */
  renderCombat();
  renderTopbar();
}

function usePotion(idx){
  const id = G.potions[idx];
  if(!id) return;
  const p = POTION_DEFS[id];
  if(p.combat && !G.inCombat) return;
  if(G.inCombat && !G.playerTurn) return;
  G.potions.splice(idx,1);
  log(`You quaff the <span class="hl">${p.name}</span>.`);
  sfx('potion');
  p.use();
  renderTopbar();
  if(G.inCombat){
    G.combatStats.potions++;
    if(G.combatStats.potions >= 3) award('alchemist');
    if(!checkCombatEnd()) renderCombat();
  } else {
    saveRun();
  }
}

function endTurn(){
  if(!G.inCombat || !G.playerTurn) return;
  G.playerTurn = false;
  $('end-turn-btn').disabled = true;
  selectedCard = null;
  sfx('endTurn');
  /* pressure valve */
  if(G.valve > 0){
    const unspent = Math.max(0, Math.min(capacity() - G.heat, G.valve));
    if(unspent > 0){ gainBlock(unspent); log('Pressure Valve hisses.'); }
  }
  if(G.sentryBlock > 0 && G.servos.length > 0){
    gainBlock(G.sentryBlock * G.servos.length);
    log('Sentry protocol reinforces your plating.');
  }
  if(G.relics.includes('rivetedGreaves')) gainBlock(2);
  /* inferno */
  if(G.igniteEnd){
    log('<span class="hl">Inferno</span> calls the deep fire.');
    igniteAll(1);
    if(checkCombatEnd()) return;
  }
  /* cracked cores in hand */
  G.hand.forEach(c=>{
    if(c.def === 'crackedCore'){
      log('Your <span class="hl">Cracked Core</span> sparks painfully.');
      G.hp = Math.max(0, G.hp - 2);
      G.combatStats.hpLost += 2;
    }
  });
  renderTopbar();
  if(G.hp <= 0){ checkPlayerDeath('a Cracked Core'); if(G.hp<=0) return; }
  /* discard hand: charge cards stay, slag exhausts */
  const keep = [];
  G.hand.forEach(c=>{
    const d = cardDef(c);
    if(d.charge) keep.push(c);
    else if(c.def === 'slag') G.exhaustPile.push(c);
    else G.discardPile.push(c);
  });
  G.hand = keep;
  /* player end-of-turn statuses */
  if(G.player.burn > 0){
    damagePlayer(G.player.burn, 'Burn', true);
    G.player.burn = Math.max(0, G.player.burn - 1);
    if(G.hp <= 0) return;
  }
  if(G.player.exposed > 0) G.player.exposed--;
  if(G.player.rattled > 0) G.player.rattled--;
  G.overheatedLastTurn = G.overheatedThisTurn;
  renderCombat();
  showTurnBanner('ENEMY TURN');
  setTimeout(enemyPhase, dur(350));
}

function enemyPhase(){
  if(!G.inCombat) return;
  log(`<span class="ph">— Enemy turn —</span>`);
  /* snapshot acting order so deaths/spawns mid-phase can't skip or repeat */
  const order = G.enemies.filter(e=>e.hp>0).map(e=>e.id);
  let i = 0;
  function step(){
    if(!G.inCombat) return;
    if(i >= order.length){ endEnemyPhase(); return; }
    const id = order[i++];
    const e = G.enemies.find(x=>x.id === id);
    if(e && e.hp > 0){
      e.block = 0;
      fxEnemyAct(e.id);
      doEnemyAction(e);
      if(!G.inCombat || G.hp <= 0) return;
      if(e.burn > 0 && e.hp > 0){
        e.hp = Math.max(0, e.hp - e.burn);
        log(`${e.name} burns for <span class="hl">${e.burn}</span>.`);
        fxHit(e.id, e.burn, e.burn, true);
        if(e.hp <= 0) onEnemyDeath(e);
        if(!G.emberseal) e.burn = Math.max(0, e.burn - 1);
      }
      if(e.exposed > 0) e.exposed--;
      if(e.rattled > 0) e.rattled--;
    }
    renderCombat();
    if(checkCombatEnd()) return;
    setTimeout(step, dur(420));
  }
  step();
}

/* shared by enemy action & intent preview so the numbers always match */
function enemyAttackDmg(e, act){
  let dmg = act.dmg + (e.strength||0);
  if(G.ascension >= 1) dmg = Math.ceil(dmg * 1.1);
  if(e.rattled > 0) dmg = Math.floor(dmg * 0.75);
  if(G.player.exposed > 0) dmg = Math.floor(dmg * 1.5);
  if(G.relics.includes('toughHide')) dmg = Math.max(0, dmg - 1);
  return dmg;
}

function doEnemyAction(e){
  const act = e.nextAction;
  if(!act) return;
  if(act.before) act.before();
  if(act.kind === 'attack'){
    const dmg = enemyAttackDmg(e, act);
    for(let k=0;k<act.times;k++){
      if(G.hp <= 0) return;
      damagePlayer(dmg, `${e.name} (${act.name})`);
    }
  } else if(act.kind === 'block'){
    e.block += act.amt;
    log(`${e.name} hardens: <span class="hl">${act.amt} Block</span>.`);
  } else if(act.kind === 'buff'){
    act.fn();
  }
  if(act.after && G.hp > 0 && G.inCombat) act.after();
  e.turn++;
  e.nextAction = ENEMY_DEFS[e.def].ai(e);
}

function endEnemyPhase(){
  if(!G.inCombat || G.hp <= 0) return;
  log(`<span class="ph">— Your turn —</span>`);
  startPlayerTurn();
}

function checkCombatEnd(){
  if(!G.inCombat) return true;
  if(G.enemies.every(e=>e.hp<=0)){
    G.inCombat = false;
    G.playerTurn = false;
    if(G.relics.includes('phoenixAsh')){
      heal(7);
      log('Phoenix Ash heals you for 7.');
    }
    renderTopbar();
    setTimeout(()=>combatVictory(), dur(500));
    return true;
  }
  return false;
}
