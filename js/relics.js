"use strict";
/* ====================================================================
   EMBERFORGE DEPTHS — relics & potions
   pool: 'none' (starter) | 'common' | 'boss' | <characterId> (char-only)
   ==================================================================== */
const RELIC_DEFS = {
  /* ---- character starter relics ---- */
  bellows:{icon:'🪗', name:'Brass Bellows', desc:'+1 Heat Capacity.', pool:'none'},
  pyreLocket:{icon:'🏮', name:'Pyre Locket', desc:'When a Burning enemy dies, its Burn spreads to a random enemy.', pool:'none'},
  rivetDriver:{icon:'🔩', name:'Rivet Driver', desc:'Start each combat with a 🗡️ Strike Servo deployed.', pool:'none'},

  /* ---- common pool ---- */
  whetstone:{icon:'🪨', name:'Whetstone Gear', desc:'Your attacks deal +2 damage.', pool:'common'},
  coolantSeal:{icon:'💧', name:'Coolant Seal', desc:'Prevent the first 4 overheat damage each turn.', pool:'common'},
  phoenixAsh:{icon:'🪶', name:'Phoenix Ash', desc:'Heal 7 HP after each combat.', pool:'common'},
  ironPlating:{icon:'🛡', name:'Iron Plating', desc:'Start each combat with 8 Block.', pool:'common'},
  surgeCap:{icon:'🔋', name:'Surge Capacitor', desc:'Draw +1 card each turn.', pool:'common'},
  moltenIdol:{icon:'🗿', name:'Molten Idol', desc:'+12 Max HP (granted on pickup).', pool:'common'},
  warBanner:{icon:'🚩', name:'War Banner', desc:'Start each combat with 1 Strength.', pool:'common'},
  ventTurbine:{icon:'🌀', name:'Vent Turbine', desc:'Whenever you Vent, gain 1 Block per 2 Heat vented.', pool:'common'},
  chainLocket:{icon:'⛓', name:'Chain Locket', desc:'The first Chain you trigger each turn draws 1 card.', pool:'common'},
  pocketAnvil:{icon:'🔨', name:'Pocket Anvil', desc:'The first card you play each turn costs 1 less Heat.', pool:'common'},
  gildedFlask:{icon:'🏺', name:'Gilded Flask', desc:'+1 potion slot.', pool:'common'},
  luckyCog:{icon:'🍀', name:'Lucky Cog', desc:'Shop prices reduced by 25%.', pool:'common'},
  emberBank:{icon:'💰', name:'Ember Bank', desc:'Gain 25% more gold from combat.', pool:'common'},
  anchorGear:{icon:'⚓', name:'Anchor Gear', desc:'Retain up to 6 Block between turns.', pool:'common'},
  tinkerLens:{icon:'🔍', name:'Tinker Lens', desc:'Card rewards offer 1 additional choice.', pool:'common'},
  emberCharm:{icon:'📿', name:'Ember Charm', desc:'Burn you apply is +1.', pool:'common'},
  toughHide:{icon:'🦏', name:'Riveted Hide', desc:'Take 1 less damage from every enemy attack.', pool:'common'},
  emberLens:{icon:'🔆', name:'Ember Lens', desc:'Your STRIKE cards deal +1 damage.', pool:'common'},
  bulwarkLens:{icon:'🔷', name:'Bulwark Lens', desc:'Your GUARD cards grant +1 Block.', pool:'common'},
  sootSponge:{icon:'🧽', name:'Soot Sponge', desc:'The first time you overheat each combat, take no searing.', pool:'common'},
  rivetedGreaves:{icon:'🥾', name:'Riveted Greaves', desc:'Gain 2 Block at the end of each turn.', pool:'common'},
  coalRation:{icon:'🍙', name:'Coal Ration', desc:'Heal 4 HP whenever you enter a ? room.', pool:'common'},
  smithingHammer:{icon:'⚒️', name:'Smithing Hammer', desc:'Smithing at a rest site also heals 10 HP.', pool:'common'},
  loadstone:{icon:'🪨', name:'Loadstone', desc:'Enemies start each combat with 1 Rattled.', pool:'common'},
  scrapTithe:{icon:'🧾', name:'Scrap Tithe', desc:'Gain 15 gold whenever you enter a rest site.', pool:'common'},

  /* ---- character pools ---- */
  flywheel:{icon:'🎡', name:'Tempo Flywheel', desc:'The first card you play each turn counts as Chained.', pool:'forgeborn'},
  slagMagnet:{icon:'🧲', name:'Slag Magnet', desc:'At combat start, apply 2 Burn to all enemies.', pool:'cinderwitch'},
  witchsEye:{icon:'👁️', name:"Witch's Eye", desc:'The first time you Ignite each turn, draw 1 card.', pool:'cinderwitch'},
  sparkCalipers:{icon:'📐', name:'Spark Calipers', desc:'Your Servos have +1 power.', pool:'scrapwright'},
  magnetCoupling:{icon:'🧷', name:'Magnet Coupling', desc:'Whenever you deploy a Servo, gain 2 Block.', pool:'scrapwright'},

  /* ---- boss relics ---- */
  crownOfCinders:{icon:'👑', name:'Crown of Cinders', desc:'+3 Heat Capacity. Take 3 damage at the start of each combat.', pool:'boss'},
  perpetualBellows:{icon:'💨', name:'Perpetual Bellows', desc:'Draw +1 card each turn. Lose 7 Max HP (on pickup).', pool:'boss'},
  foundrySigil:{icon:'🔱', name:'Foundry Sigil', desc:'STRIKE cards always count as Chained.', pool:'boss'},
  gearOfMidas:{icon:'🪙', name:'Gear of Midas', desc:'Gain 150 gold. Combats give 40% more gold.', pool:'boss'},
  moltenCore:{icon:'🌋', name:'Molten Core', desc:'At the start of your turn, deal 3 damage to ALL enemies.', pool:'boss'},
  voidPiston:{icon:'🕳', name:'Void Piston', desc:'+2 Heat Capacity and +1 Strength.', pool:'boss'},
  nullGovernor:{icon:'🚫', name:'Null Governor', desc:'+4 Heat Capacity. You can no longer Vent.', pool:'boss'},
  gildedHeart:{icon:'💛', name:'Gilded Heart', desc:'+30 Max HP. Combats give 25% less gold.', pool:'boss'},
  overseerCore:{icon:'🧿', name:'Overseer Core', desc:'Power cards cost 1 less Heat.', pool:'boss'},
};

function relicPoolFor(charId){
  return Object.keys(RELIC_DEFS).filter(r=>{
    const p = RELIC_DEFS[r].pool;
    return p === 'common' || p === charId;
  });
}
function rollRelic(){
  const owned = new Set(G.relics);
  const avail = relicPoolFor(G.character).filter(r=>!owned.has(r));
  return avail.length ? pick(avail) : null;
}
function rollBossRelics(n){
  const owned = new Set(G.relics);
  const avail = shuffle(Object.keys(RELIC_DEFS).filter(r=>RELIC_DEFS[r].pool==='boss' && !owned.has(r)));
  return avail.slice(0,n);
}

/* ====================================================================
   POTIONS
   ==================================================================== */
const POTION_DEFS = {
  coolantVial:{icon:'🧊', name:'Coolant Vial', desc:'Vent ALL Heat.', combat:true,
    use:()=>{ vent(G.heat); }},
  firebomb:{icon:'🧨', name:'Firebomb', desc:'Deal 12 damage to ALL enemies.', combat:true,
    use:()=>G.enemies.forEach(e=>{ if(e.hp>0) dealDamage(e,12,true); })},
  blockTonic:{icon:'🧪', name:'Block Tonic', desc:'Gain 12 Block.', combat:true,
    use:()=>gainBlock(12)},
  strengthTonic:{icon:'💪', name:'Strength Tonic', desc:'Gain 2 Strength this combat.', combat:true,
    use:()=>{ G.player.strength += 2; log('<span class="hl">+2 Strength</span>.'); }},
  healingSalve:{icon:'🩹', name:'Healing Salve', desc:'Heal 14 HP.', combat:false,
    use:()=>{ heal(14); }},
  capacityElixir:{icon:'⚗️', name:'Capacity Elixir', desc:'+3 Capacity this combat.', combat:true,
    use:()=>{ G.capBonus += 3; log('Capacity +<span class="hl">3</span>.'); }},
  drawCog:{icon:'⚙️', name:'Drawing Cog', desc:'Draw 3 cards.', combat:true,
    use:()=>drawCards(3)},
  purityPhial:{icon:'✨', name:'Purity Phial', desc:'Remove all your debuffs.', combat:true,
    use:()=>{ G.player.burn=0; G.player.exposed=0; G.player.rattled=0; log('Your debuffs wash away.'); }},
  magmaPhial:{icon:'🫙', name:'Magma Phial', desc:'Apply 6 Burn to a random enemy.', combat:true,
    use:()=>{ const a=G.enemies.filter(e=>e.hp>0); if(a.length) applyStatus(pick(a),'burn',6); }},
  volatileSlurry:{icon:'☄️', name:'Volatile Slurry', desc:'Deal 16 damage to a random enemy.', combat:true,
    use:()=>{ const a=G.enemies.filter(e=>e.hp>0); if(a.length) dealDamage(pick(a),16,true); }},
  clarityDraught:{icon:'🫗', name:'Clarity Draught', desc:'Vent ALL Heat. Draw 2 cards.', combat:true,
    use:()=>{ vent(G.heat); drawCards(2); }},
  annealingOil:{icon:'🛢️', name:'Annealing Oil', desc:'Heal 6 HP and gain 8 Block.', combat:true,
    use:()=>{ heal(6); gainBlock(8); }},
  midasSip:{icon:'🥃', name:'Sip of Midas', desc:'Gain 35 gold.', combat:false,
    use:()=>{ G.gold += 35; sfx('gold'); }},
  titanBlood:{icon:'🩸', name:"Titan's Blood", desc:'Gain 3 Strength this combat.', combat:true,
    use:()=>{ G.player.strength += 3; log('<span class="hl">+3 Strength</span>.'); }},
};
function rollPotion(){ return pick(Object.keys(POTION_DEFS)); }
