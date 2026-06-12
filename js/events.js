"use strict";
/* ====================================================================
   EMBERFORGE DEPTHS — events ("?" rooms)
   Events do not repeat within a run until the pool is exhausted.
   ==================================================================== */
const EVENT_DEFS = [
  {id:'shrine', icon:'⛩️', title:'Scorched Shrine',
   text:'An old shrine to the fire gods, blackened but standing. Offerings of melted coins surround it.',
   choices:()=>[
     {label:'Pray', desc:'Heal 15 HP', fn:()=>{ heal(15); return 'Warmth spreads through your frame.'; }},
     {label:'Desecrate', desc:'Gain 60 gold. Take 8 damage.', fn:()=>{ G.gold+=60; loseHp(8); return 'The shrine collapses. Your servos sting with guilt... and gold.'; }},
     {label:'Leave', desc:'', fn:()=>'You move on.'},
   ]},
  {id:'tinker', icon:'🧰', title:'Wandering Tinker',
   text:'A hunched automaton with a cart of tools waves you over. "Free tune-up, friend. Or something shinier, for coin."',
   choices:()=>[
     {label:'Tune-up', desc:'Upgrade a card', fn:()=>{ openSmith(()=>resumeMap()); return null; }},
     {label:'Buy trinket (80g)', desc:'Gain a random relic', disabled:G.gold<80,
      fn:()=>{ G.gold-=80; const r=rollRelic(); if(r){ gainRelic(r); return `The tinker hands you the ${RELIC_DEFS[r].name}.`; } G.gold+=80; return 'The cart is empty after all.'; }},
     {label:'Leave', desc:'', fn:()=>'The tinker shrugs and rolls on.'},
   ]},
  {id:'slagpit', icon:'🕳️', title:'The Slag Pit',
   text:'A glowing pit of molten refuse. Something glints at the bottom — a card of rare make, half-buried.',
   choices:()=>[
     {label:'Dive for it', desc:'Gain a random RARE card. Take 10 damage.',
      fn:()=>{ loseHp(10); const id=randomCardOfRarity('rare'); G.deck.push(makeCard(id)); return `Scalded but triumphant, you claim <b>${CARD_DEFS[id].name}</b>!`; }},
     {label:'Walk around', desc:'', fn:()=>'Not worth the burns.'},
   ]},
  {id:'spring', icon:'⛲', title:'Coolant Spring',
   text:'A miracle: a spring of pure coolant bubbles up between the flagstones.',
   choices:()=>[
     {label:'Drink deep', desc:'Heal 20 HP', fn:()=>{ heal(20); return 'Your core temperature drops to a purr.'; }},
     {label:'Bottle it', desc:'Gain a Coolant Vial potion', fn:()=>{ gainPotion('coolantVial'); return 'You fill a vial for later.'; }},
   ]},
  {id:'gambler', icon:'🎲', title:'Gambling Imp',
   text:'"Double or nothing!" cackles an imp, rattling a cup of dice carved from teeth.',
   choices:()=>[
     {label:'Bet 30 gold', desc:'50%: win 60. 50%: lose it.', disabled:G.gold<30,
      fn:()=>{ G.gold-=30; if(chance(.5)){ G.gold+=60; return 'The dice come up double sixes! +60 gold.'; } return 'The imp scoops your coins, giggling.'; }},
     {label:'Decline', desc:'', fn:()=>'The imp blows a raspberry.'},
   ]},
  {id:'anvil', icon:'🛠️', title:'The Cursed Anvil',
   text:'A magnificent anvil hums with power, but dark slag crusts its base. Forging here would improve your craft... at a price.',
   choices:()=>[
     {label:'Forge', desc:'Upgrade 2 random cards. Gain a Cracked Core curse.',
      fn:()=>{ const un=G.deck.filter(c=>!c.upgraded && !cardDef(c).unplayable); shuffle(un);
        un.slice(0,2).forEach(c=>c.upgraded=true); G.deck.push(makeCard('crackedCore'));
        return `${un.length?un.slice(0,2).map(cardName).join(' and '):'Nothing'} upgraded. The anvil laughs — a <b>Cracked Core</b> slips into your deck.`; }},
     {label:'Leave', desc:'', fn:()=>'Some bargains are too dear.'},
   ]},
  {id:'automaton', icon:'🤖', title:'Fallen Automaton',
   text:'A construct like yourself lies broken in the corridor, chest cavity sparking. Its relic core is intact.',
   choices:()=>[
     {label:'Repair it', desc:'Lose 10 HP. It gives you its relic in thanks.',
      fn:()=>{ loseHp(10); const r=rollRelic(); if(r){ gainRelic(r); return `It rises, bows, and presses the ${RELIC_DEFS[r].name} into your hands before limping away.`; } return 'It rises, bows... and has nothing to give. Typical.'; }},
     {label:'Salvage it', desc:'Gain 45 gold.', fn:()=>{ G.gold+=45; return 'You strip it for parts. It watches you with dimming eyes.'; }},
     {label:'Leave', desc:'', fn:()=>'You leave it to rust in peace.'},
   ]},
  {id:'mirror', icon:'🪞', title:'Mirror of Slag',
   text:'A polished slab of black glass shows your reflection — but wrong, somehow. It whispers of revision.',
   choices:()=>[
     {label:'Erase', desc:'Remove a card from your deck', fn:()=>{ openPurge(()=>resumeMap()); return null; }},
     {label:'Duplicate', desc:'Copy a card in your deck', fn:()=>{ openDuplicate(()=>resumeMap()); return null; }},
     {label:'Leave', desc:'', fn:()=>'You look away before it learns your face.'},
   ]},
  {id:'library', icon:'📚', title:'The Charred Library',
   text:'Shelves of half-burned schematics. Most are ash, but a few diagrams survive.',
   choices:()=>[
     {label:'Study', desc:'Choose 1 of 3 cards to add', fn:()=>{ openCardChoice(rollRewardCards(3,true), ()=>resumeMap()); return null; }},
     {label:'Burn the rest', desc:'Gain 30 gold (scrap value)', fn:()=>{ G.gold+=30; return 'Knowledge burns bright and brief.'; }},
   ]},
  {id:'forgegod', icon:'🔥', title:'Voice in the Flame',
   text:'A pillar of fire speaks your serial number. "LITTLE SPARK. I CAN MAKE YOU GREATER. GIVE ME OF YOURSELF."',
   choices:()=>[
     {label:'Offer your frame', desc:'Lose 7 Max HP. Gain a boss-quality relic.',
      fn:()=>{ G.maxHp-=7; G.hp=Math.min(G.hp,G.maxHp); const rs=rollBossRelics(1);
        if(rs.length){ gainRelic(rs[0]); return `Pain. Then power. You receive the ${RELIC_DEFS[rs[0]].name}.`; } return 'The flame takes... and gives nothing. It laughs.'; }},
     {label:'Refuse', desc:'', fn:()=>'"PRUDENT. DULL, BUT PRUDENT." The flame gutters out.'},
   ]},
  {id:'organ', icon:'🎹', title:'The Bellows Organ',
   text:'A cathedral organ built from forge bellows. Its pipes still hold pressure from an age of fire. Playing it might re-tune your core... or burst it.',
   choices:()=>[
     {label:'Play the toccata', desc:'Take 12 damage. Gain +1 Heat Capacity permanently.',
      fn:()=>{ loseHp(12); G.permCap+=1; return 'The chord shakes dust from the vault. Your core resonates wider than before — <b>+1 Capacity</b>.'; }},
     {label:'Pump the bellows', desc:'Heal 10 HP', fn:()=>{ heal(10); return 'Warm, clean air floods your intakes.'; }},
     {label:'Leave', desc:'', fn:()=>'Some music is not for you.'},
   ]},
  {id:'tollkeeper', icon:'🌉', title:'The Tollkeeper',
   text:'A rusted giant blocks the only bridge, palm out. It does not speak. The toll is whatever you can spare — or whatever it can take.',
   choices:()=>[
     {label:'Pay 55 gold', desc:'Pass unharmed', disabled:G.gold<55, fn:()=>{ G.gold-=55; return 'The giant pockets your coins and creaks aside.'; }},
     {label:'Refuse to pay', desc:'It takes a swing: lose 14 HP.', fn:()=>{ loseHp(14); return 'You duck under its fist and sprint across. Mostly.'; }},
   ]},
  {id:'scales', icon:'⚖️', title:'The Forge Scales',
   text:'A brass balance large enough to weigh a soul. A plaque reads: ALL TRADES FINAL.',
   choices:()=>[
     {label:'Trade vigor for gold', desc:'Lose 6 Max HP. Gain 90 gold.',
      fn:()=>{ G.maxHp-=6; G.hp=Math.min(G.hp,G.maxHp); G.gold+=90; return 'The scales tip. You feel lighter — in every sense.'; }},
     {label:'Trade gold for vigor', desc:'Pay 75 gold. Gain 8 Max HP.', disabled:G.gold<75,
      fn:()=>{ G.gold-=75; G.maxHp+=8; G.hp+=8; renderTopbar(); return 'The scales tip. Your frame feels denser, truer.'; }},
     {label:'Leave', desc:'', fn:()=>'You keep what is yours.'},
   ]},
  {id:'ghostsmith', icon:'👻', title:'Ghost of the Smith',
   text:'A translucent figure hammers at nothing, on an anvil that is no longer there. It looks up, and gestures at your deck with professional interest.',
   choices:()=>[
     {label:'Let it work', desc:'Upgrade 2 random cards',
      fn:()=>{ const un=G.deck.filter(c=>!c.upgraded && !cardDef(c).unplayable); shuffle(un);
        const picked = un.slice(0,2); picked.forEach(c=>c.upgraded=true);
        return picked.length ? `Ghostly hammerblows ring out. ${picked.map(cardName).join(' and ')} now gleam${picked.length===1?'s':''}.` : 'It finds nothing to improve, and seems offended.'; }},
     {label:'Ask it to rest', desc:'Heal 8 HP. The ghost departs gratefully.',
      fn:()=>{ heal(8); return 'It sets down the hammer that is not there, and is gone. The air grows warmer.'; }},
   ]},
  {id:'casino', icon:'🎰', title:'The Molten Casino',
   text:'Three slag-crusted reels spin in an alcove. A sign: ONE PULL PER CUSTOMER. WINNERS SMELTED FREE.',
   choices:()=>[
     {label:'Pull the lever (20g)', desc:'???', disabled:G.gold<20,
      fn:()=>{ G.gold-=20; const r=randf();
        if(r<.15){ const rl=rollRelic(); if(rl){ gainRelic(rl); return `JACKPOT! Three crowns! The machine disgorges the ${RELIC_DEFS[rl].name}.`; } G.gold+=120; return 'JACKPOT! The machine pays out 120 gold.'; }
        if(r<.45){ G.gold+=50; return 'Two crowns! 50 gold rattles into the tray.'; }
        if(r<.75){ return 'The reels mock you: slag, slag, crown.'; }
        loseHp(6); return 'The machine sneezes sparks at you. Lose 6 HP. Rigged!'; }},
     {label:'Walk away', desc:'', fn:()=>'The house always wins. Usually.'},
   ]},
  {id:'sleeper', icon:'🗿', title:'The Sleeping Colossus',
   text:'A war-titan slumbers across the corridor, a relic glinting in its half-open fist. Its breath is a slow furnace-roar.',
   choices:()=>[
     {label:'Steal the relic', desc:'60%: gain a relic. 40%: lose 16 HP.',
      fn:()=>{ if(chance(.6)){ const r=rollRelic(); if(r){ gainRelic(r); return `You ease the ${RELIC_DEFS[r].name} free. The titan smiles in its sleep.`; } return 'Its fist is empty. Fool\'s gold and shadows.'; }
        loseHp(16); return 'Its hand closes. You barely wrench yourself free of the grinding fingers.'; }},
     {label:'Tip-toe past', desc:'', fn:()=>'You will wonder about that relic for the rest of your run.'},
   ]},
  {id:'ashchoir', icon:'🎶', title:'The Ash Choir',
   text:'Robed figures of fused cinders sing a single sustained note. As you pass, the note bends — an invitation to shed what weighs you down.',
   choices:()=>[
     {label:'Join the song', desc:'Remove a card from your deck',
      fn:()=>{ openPurge(()=>resumeMap()); return null; }},
     {label:'Listen only', desc:'Heal 6 HP', fn:()=>{ heal(6); return 'The chord settles your rattling bolts.'; }},
   ]},
  {id:'phialMerchant', icon:'🧴', title:'The Phial Peddler',
   text:'A spindly automaton, draped in clinking bandoliers of glass. "Fresh! Mostly stable! Three for the price of... three."',
   choices:()=>[
     {label:'Buy the bundle (50g)', desc:'Gain 2 random potions', disabled:G.gold<50,
      fn:()=>{ G.gold-=50; let got=0; for(let i=0;i<2;i++){ if(gainPotion(rollPotion())) got++; }
        return got>0 ? `${got} potion${got>1?'s':''} clipped to your belt.` : 'Your belt is full! The peddler keeps your coin AND the phials. Outrageous.'; }},
     {label:'Decline', desc:'', fn:()=>'"Suit yourself. BOOM is free elsewhere."'},
   ]},
];

function rollEvent(){
  G.eventsSeen = G.eventsSeen || [];
  let unseen = EVENT_DEFS.filter(e=>!G.eventsSeen.includes(e.id));
  if(unseen.length === 0){ G.eventsSeen = []; unseen = EVENT_DEFS.slice(); }
  const ev = pick(unseen);
  G.eventsSeen.push(ev.id);
  return ev;
}
