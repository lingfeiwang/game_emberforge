"use strict";
/* ====================================================================
   EMBERFORGE DEPTHS — enemies, encounters, acts
   Actions may carry a `note` shown in the intent tooltip.
   ==================================================================== */
function mkAttack(name,dmg,times){ return {kind:'attack', name, dmg, times:times||1}; }
function mkBlock(name,amt){ return {kind:'block', name, amt}; }
function mkBuff(name,fn,icon){ return {kind:'buff', name, fn, intentIcon:icon||'📈'}; }

/* bosses enrage below this fraction of max HP (Ascension 9 raises it) */
function enrageFrac(){ return (G && G.ascension >= 9) ? 0.6 : 0.5; }

const ENEMY_DEFS = {
/* ---- ACT 1 ---- */
slagCrawler:{name:'Slag Crawler', sprite:'🦎', hp:[16,20],
  ai(self){
    if(self.turn % 3 === 2) return {kind:'attack', name:'Searing Spit', dmg:4, times:1, note:'Applies 2 Burn', after:()=>applyStatus(G.player,'burn',2)};
    return mkAttack('Bite', 6);
  }},
cinderWisp:{name:'Cinder Wisp', sprite:'🔥', hp:[10,13],
  ai(self){
    if(self.turn % 3 === 1 && G.enemies.filter(e=>e.hp>0).length > 1)
      return mkBuff('Kindle', ()=>{ G.enemies.forEach(e=>{ if(e.hp>0) e.strength=(e.strength||0)+2; }); log(`${self.name} kindles its allies: <span class="hl">+2 Strength</span>.`); });
    return mkAttack('Flare', 4);
  }},
boilerImp:{name:'Boiler Imp', sprite:'👺', hp:[13,16],
  ai(self){
    if(self.turn % 4 === 3) return mkBlock('Hunker', 6);
    if(self.turn % 2 === 0) return {kind:'attack', name:'Scald', dmg:5, times:1, note:'Applies 1 Burn', after:()=>applyStatus(G.player,'burn',1)};
    return mkAttack('Claw', 6);
  }},
rustHound:{name:'Rust Hound', sprite:'🐺', hp:[24,28],
  ai(self){
    const m = self.turn % 3;
    if(m===0) return mkAttack('Maul', 8);
    if(m===1) return mkBlock('Harden', 6);
    return {kind:'attack', name:'Rending Howl', dmg:5, times:1, note:'Applies 2 Rattled', after:()=>applyStatus(G.player,'rattled',2)};
  }},
forgeSpider:{name:'Forge Spider', sprite:'🕷', hp:[20,24],
  ai(self){
    const m = self.turn % 3;
    if(m===0) return {kind:'attack', name:'Venom Sting', dmg:5, times:1, note:'Applies 1 Exposed', after:()=>applyStatus(G.player,'exposed',1)};
    if(m===1) return mkAttack('Twin Fangs', 4, 2);
    return mkAttack('Pounce', 9);
  }},
anvilBrute:{name:'Anvil Brute', sprite:'🦍', hp:[38,44],
  ai(self){
    if(self.turn % 2 === 0) return mkAttack('Smash', 12);
    return mkAttack('Piston Fists', 6, 2);
  }},
pyreShade:{name:'Pyre Shade', sprite:'👻', hp:[30,34],
  ai(self){
    if(self.turn % 3 === 1) return {kind:'attack', name:'Cinder Curse', dmg:4, times:1, note:'Applies 3 Burn', after:()=>applyStatus(G.player,'burn',3)};
    return mkAttack('Soul Lash', 9);
  }},
moltenGolem:{name:'Molten Golem', sprite:'🌋', hp:[58,64], elite:true,
  ai(self){
    const m = self.turn % 3;
    if(m===0) return mkBuff('Heat Up', ()=>{ self.strength=(self.strength||0)+3; log(`${self.name} glows hotter: <span class="hl">+3 Strength</span>.`); });
    if(m===1) return mkAttack('Crush', 13);
    return {kind:'attack', name:'Lava Slam', dmg:8, times:1, note:'Applies 3 Burn', after:()=>applyStatus(G.player,'burn',3)};
  }},
clockworkWarden:{name:'Clockwork Warden', sprite:'🤖', hp:[52,58], elite:true,
  ai(self){
    const m = self.turn % 3;
    if(m===0) return {kind:'attack', name:'Shield Bash', dmg:6, times:1, note:'Gains 11 Block first', before:()=>{ self.block+=11; }};
    if(m===1) return mkAttack('Gear Flurry', 4, 3);
    return {kind:'attack', name:'Lockdown', dmg:6, times:1, note:'Applies 2 Exposed', after:()=>applyStatus(G.player,'exposed',2)};
  }},
scrapTyrant:{name:'Scrap Tyrant', sprite:'🦏', hp:[60,66], elite:true,
  ai(self){
    const m = self.turn % 3;
    if(m===0) return mkBuff('Snort', ()=>{ self.strength=(self.strength||0)+2; self.block+=6; log(`${self.name} snorts sparks: <span class="hl">+2 Strength</span>, 6 Block.`); });
    if(m===1) return mkAttack('Gore', 12);
    return mkAttack('Stampede', 4, 3);
  }},
foundryKing:{name:'The Foundry King', sprite:'🫅', hp:[140,140], boss:true,
  ai(self){
    const enraged = self.hp <= self.maxHp*enrageFrac();
    const m = self.turn % 3;
    if(m===0) return mkBuff('Stoke the Forge', ()=>{ self.strength=(self.strength||0)+(enraged?3:2); self.block+=10; log(`The Foundry King stokes the forge: <span class="hl">+${enraged?3:2} Strength</span>, 10 Block.`); });
    if(m===1) return mkAttack('Hammerfall', enraged?18:14);
    return {kind:'attack', name:'Sea of Flame', dmg:enraged?12:9, times:1, note:'Applies 4 Burn', after:()=>applyStatus(G.player,'burn',4)};
  }},
unmadeColossus:{name:'The Unmade Colossus', sprite:'🗿', hp:[150,150], boss:true,
  ai(self){
    const enraged = self.hp <= self.maxHp*enrageFrac();
    const m = self.turn % 4;
    if(m===0) return mkAttack('Boulder Fist', enraged?16:13);
    if(m===1) return {kind:'attack', name:'Tremor', dmg:enraged?10:8, times:1, note:'Applies 2 Rattled', after:()=>applyStatus(G.player,'rattled',2)};
    if(m===2) return {kind:'buff', name:'Winding Up', intentIcon:'🌀', note:'Something massive is coming…',
      fn:()=>{ self.block+=12; log(`${self.name} <span class="hl">winds up</span> — brace yourself!`); }};
    return mkAttack('COLOSSAL SMASH', enraged?32:26);
  }},

/* ---- ACT 2 ---- */
gearSerpent:{name:'Gear Serpent', sprite:'🐍', hp:[34,40],
  ai(self){
    const m = self.turn % 3;
    if(m===0) return mkAttack('Constrict', 11);
    if(m===1) return {kind:'attack', name:'Coil Lash', dmg:5, times:1, note:'Gains 8 Block first', before:()=>{ self.block+=8; }};
    return {kind:'attack', name:'Rust Venom', dmg:7, times:1, note:'Applies 2 Rattled', after:()=>applyStatus(G.player,'rattled',2)};
  }},
ashRevenant:{name:'Ash Revenant', sprite:'🧟', hp:[30,36],
  ai(self){
    const m = self.turn % 3;
    if(m===0) return {kind:'attack', name:'Cinder Touch', dmg:9, times:1, note:'Applies 2 Burn', after:()=>applyStatus(G.player,'burn',2)};
    if(m===1) return mkAttack('Rake', 6, 2);
    return {kind:'attack', name:'Life Drain', dmg:7, times:1, note:'Heals itself 7', after:()=>{ self.hp=Math.min(self.maxHp,self.hp+7); log(`${self.name} drains your warmth and mends.`); }};
  }},
smelterWitch:{name:'Smelter Witch', sprite:'🧙', hp:[28,32],
  ai(self){
    const m = self.turn % 3;
    if(m===0) return mkBuff('Hex of Slag', ()=>{ G.discardPile.push(makeCard('slag')); G.discardPile.push(makeCard('slag')); log(`${self.name} hexes you: <span class="hl">2 Slag</span> shuffled into your discard pile!`); }, '🌑');
    if(m===1) return mkAttack('Fireball', 12);
    return mkBlock('Ward', 8);
  }},
ironShrike:{name:'Iron Shrike', sprite:'🦅', hp:[18,22],
  ai(self){
    const m = self.turn % 3;
    if(m===0) return mkAttack('Dive', 7);
    if(m===1) return mkBuff('Shriek', ()=>{ self.strength=(self.strength||0)+2; log(`${self.name} shrieks: <span class="hl">+2 Strength</span>.`); });
    return mkAttack('Peck', 4, 2);
  }},
coalDevil:{name:'Coal Devil', sprite:'😈', hp:[26,30],
  ai(self){
    const m = self.turn % 3;
    if(m===0) return {kind:'attack', name:'Brand', dmg:8, times:1, note:'Applies 2 Burn', after:()=>applyStatus(G.player,'burn',2)};
    if(m===1) return mkBuff('Pickpocket', ()=>{ const st=Math.min(15,G.gold); G.gold-=st; log(`${self.name} steals <span class="hl">${st} gold</span>!`); renderTopbar(); }, '🪙');
    return mkAttack('Claw Frenzy', 10);
  }},
furnaceKnight:{name:'Furnace Knight', sprite:'🛡️', hp:[42,48],
  ai(self){
    const m = self.turn % 3;
    if(m===0) return mkAttack('Greatblade', 13);
    if(m===1) return {kind:'attack', name:'Guarded Thrust', dmg:6, times:1, note:'Gains 10 Block first', before:()=>{ self.block+=10; }};
    return {kind:'attack', name:'Smite', dmg:8, times:1, note:'Applies 1 Exposed', after:()=>applyStatus(G.player,'exposed',1)};
  }},
emberSeraph:{name:'Ember Seraph', sprite:'👼', hp:[82,88], elite:true,
  ai(self){
    const m = self.turn % 3;
    if(m===0) return mkBuff('Blazing Litany', ()=>{ self.strength=(self.strength||0)+3; self.block+=8; log(`${self.name} chants: <span class="hl">+3 Strength</span>, 8 Block.`); });
    if(m===1) return mkAttack('Judgement Lance', 16);
    return {kind:'attack', name:'Purging Flame', dmg:10, times:1, note:'Applies 3 Burn', after:()=>applyStatus(G.player,'burn',3)};
  }},
crucibleTwinA:{name:'Crucible Twin · Vex', sprite:'👹', hp:[46,50], elite:true,
  ai(self){
    if(self.turn % 2 === 0) return mkAttack('Twin Strike', 9);
    return mkAttack('Hammer Toss', 6, 2);
  }},
crucibleTwinB:{name:'Crucible Twin · Mox', sprite:'👺', hp:[46,50], elite:true,
  ai(self){
    if(self.turn % 2 === 0) return mkBlock('Cover Brother', 12);
    return {kind:'attack', name:'Slag Bolt', dmg:8, times:1, note:'Applies 2 Burn', after:()=>applyStatus(G.player,'burn',2)};
  }},
kilnAbbot:{name:'The Kiln Abbot', sprite:'🧌', hp:[88,94], elite:true,
  ai(self){
    const m = self.turn % 3;
    if(m===0) return {kind:'attack', name:'Sermon of Flame', dmg:7, times:1, note:'Applies 3 Burn', after:()=>applyStatus(G.player,'burn',3)};
    if(m===1) return mkAttack('Censer Swing', 13);
    return mkBuff('Absolution', ()=>{ self.hp=Math.min(self.maxHp,self.hp+10); self.block+=8; log(`${self.name} intones absolution: heals 10, gains 8 Block.`); }, '🙏');
  }},
ashenMatriarch:{name:'The Ashen Matriarch', sprite:'🕸️', hp:[240,240], boss:true,
  ai(self){
    const enraged = self.hp <= self.maxHp*enrageFrac();
    const m = self.turn % 4;
    if(m===0 && G.enemies.filter(e=>e.hp>0).length < 3)
      return {kind:'buff', name:'Brood Call', intentIcon:'🥚', note:'Births a Cinder Wisp', fn:()=>{
        const w = makeEnemy('cinderWisp'); w.hp = w.maxHp = 18; w.nextAction = ENEMY_DEFS.cinderWisp.ai(w);
        G.enemies.push(w); log('The Matriarch births a <span class="hl">Cinder Wisp</span>!'); }};
    if(m===0) return mkAttack('Devour', enraged?22:16);
    if(m===1) return {kind:'attack', name:'Ash Sweep', dmg:enraged?15:12, times:1, note:'Applies 3 Burn', after:()=>applyStatus(G.player,'burn',3)};
    if(m===2) return mkBuff('Keening Wail', ()=>{ applyStatus(G.player,'rattled',2); applyStatus(G.player,'exposed',2); log('The wail rattles your plating!'); }, '😱');
    return mkAttack('Talon Rake', enraged?9:7, 2);
  }},
magnetarPrime:{name:'Magnetar Prime', sprite:'🧲', hp:[230,230], boss:true,
  ai(self){
    const enraged = self.hp <= self.maxHp*enrageFrac();
    const feed = {note:'Gains 2 Strength if you overheated last turn',
      before:()=>{ if(G.overheatedLastTurn){ self.strength=(self.strength||0)+2; log(`${self.name} <span class="hl">feeds on your stray heat: +2 Strength</span>.`); } }};
    const m = self.turn % 3;
    if(m===0) return Object.assign(mkAttack('Flux Crush', enraged?19:15), feed);
    if(m===1) return Object.assign({kind:'buff', name:'Polarity Inversion', intentIcon:'🔄',
      fn:()=>{ applyStatus(G.player,'rattled',2); applyStatus(G.player,'exposed',enraged?2:1); log('Your polarity flips — plating loosens!'); }}, feed);
    return Object.assign(mkAttack('Rail Volley', enraged?6:5, 3), feed);
  }},

/* ---- ACT 3 ---- */
obsidianSentinel:{name:'Obsidian Sentinel', sprite:'🗿', hp:[50,56],
  ai(self){
    const m = self.turn % 3;
    if(m===0) return mkAttack('Stone Fist', 14);
    if(m===1) return mkBlock('Fortify', 14);
    return mkAttack('Twin Beams', 9, 2);
  }},
pyreColossus:{name:'Pyre Colossus', sprite:'🦖', hp:[60,66],
  ai(self){
    const m = self.turn % 3;
    if(m===0) return mkBuff('Towering Roar', ()=>{ self.strength=(self.strength||0)+4; log(`${self.name} roars: <span class="hl">+4 Strength</span>.`); });
    if(m===1) return mkAttack('Stomp', 18);
    return {kind:'attack', name:'Flame Wash', dmg:12, times:1, note:'Applies 3 Burn', after:()=>applyStatus(G.player,'burn',3)};
  }},
forgeWraith:{name:'Forge Wraith', sprite:'🌫️', hp:[44,50],
  ai(self){
    const m = self.turn % 3;
    if(m===0) return {kind:'buff', name:'Phase Veil', intentIcon:'🌫️', note:'Gains 12 Block, applies 2 Rattled', fn:()=>{ self.block+=12; applyStatus(G.player,'rattled',2); log(`${self.name} blurs from sight.`); }};
    if(m===1) return {kind:'attack', name:'Rend Soul', dmg:11, times:1, note:'Applies 1 Exposed', after:()=>applyStatus(G.player,'exposed',1)};
    return {kind:'attack', name:'Soulfire', dmg:9, times:1, note:'Applies 3 Burn', after:()=>applyStatus(G.player,'burn',3)};
  }},
moltenHydra:{name:'Molten Hydra', sprite:'🐉', hp:[55,62],
  ai(self){
    const m = self.turn % 3;
    if(m===0) return mkAttack('Three Maws', 6, 3);
    if(m===1) return {kind:'buff', name:'Regrow', intentIcon:'💚', note:'Heals 10, gains 6 Block', fn:()=>{ self.hp=Math.min(self.maxHp,self.hp+10); self.block+=6; log(`${self.name} regrows a head.`); }};
    return mkAttack('Magma Breath', 16);
  }},
courtGuard:{name:'Cinder Court Guard', sprite:'💂', hp:[35,40],
  ai(self){
    const m = self.turn % 3;
    if(m===0) return mkAttack('Pike Thrust', 12);
    if(m===1) return mkBlock('Shield Wall', 10);
    return mkAttack('Volley', 5, 2);
  }},
heartsWarden:{name:"Heart's Warden", sprite:'🦁', hp:[116,124], elite:true,
  ai(self){
    const m = self.turn % 3;
    if(m===0) return mkAttack('Judgement', 20);
    if(m===1) return {kind:'attack', name:'Bulwark Slam', dmg:8, times:1, note:'Gains 16 Block first', before:()=>{ self.block+=16; }};
    return {kind:'attack', name:'Condemn', dmg:8, times:1, note:'Applies 3 Exposed', after:()=>applyStatus(G.player,'exposed',3)};
  }},
annealedHorror:{name:'Annealed Horror', sprite:'🦂', hp:[106,114], elite:true,
  ai(self){
    const m = self.turn % 3;
    if(m===0) return mkBuff('Anneal', ()=>{ self.strength=(self.strength||0)+4; log(`${self.name} hardens and sharpens: <span class="hl">+4 Strength</span>.`); });
    if(m===1) return mkAttack('Crush', 16);
    return mkAttack('Flailing Tails', 7, 3);
  }},
gravewright:{name:'The Gravewright', sprite:'⚰️', hp:[108,116], elite:true,
  ai(self){
    const m = self.turn % 3;
    if(m===0) return {kind:'attack', name:'Soot Choke', dmg:9, times:1, note:'Shuffles 2 Slag into your discard',
      after:()=>{ G.discardPile.push(makeCard('slag')); G.discardPile.push(makeCard('slag')); log('Slag clogs your systems!'); }};
    if(m===1) return mkAttack('Entomb', 17);
    return {kind:'buff', name:'Grave Chill', intentIcon:'🥶', note:'Gains 12 Block, applies 2 Rattled',
      fn:()=>{ self.block+=12; applyStatus(G.player,'rattled',2); log('A graveyard cold seeps into your joints.'); }};
  }},
heartOfForge:{name:'The Heart of the Forge', sprite:'🩸', hp:[320,320], boss:true,
  ai(self){
    const enraged = self.hp <= self.maxHp*enrageFrac();
    const m = self.turn % 4;
    if(m===0) return mkBuff(enraged?'CORE MELTDOWN':'Molten Pulse', ()=>{
        self.strength=(self.strength||0)+(enraged?4:2); self.block+=(enraged?18:12);
        log(`The Heart ${enraged?'<span class="hl">goes critical</span>: +4 Strength':'pulses: +2 Strength'}, ${enraged?18:12} Block.`); }, enraged?'☢️':'📈');
    if(m===1) return {kind:'attack', name:'Eruption', dmg:enraged?16:13, times:1, note:'Applies 4 Burn', after:()=>applyStatus(G.player,'burn',4)};
    if(m===2) return mkAttack('Worldsplitter', enraged?26:20);
    return mkAttack('Magma Jets', enraged?8:6, 3);
  }},
firstFlame:{name:'The First Flame', sprite:'☀️', hp:[290,290], boss:true,
  ai(self){
    const enraged = self.hp <= self.maxHp*enrageFrac();
    const ramp = {note:'Burns ever hotter: gains 1 Strength every turn',
      before:()=>{ self.strength=(self.strength||0)+1; log(`${self.name} burns <span class="hl">ever hotter: +1 Strength</span>.`); }};
    const m = self.turn % 3;
    if(m===0) return Object.assign({kind:'attack', name:'Solar Lash', dmg:enraged?14:11, times:1,
      after:()=>applyStatus(G.player,'burn',3)}, ramp, {note:'Applies 3 Burn · gains 1 Strength every turn'});
    if(m===1) return Object.assign(mkAttack('Radiance', enraged?7:6, 2), ramp);
    return Object.assign(mkAttack('Cleansing Fire', enraged?22:17), ramp);
  }},
};

function makeEnemy(defId){
  const d = ENEMY_DEFS[defId];
  let hp = rand(d.hp[0], d.hp[1]);
  /* ascension HP scaling */
  if(G && G.ascension){
    if(G.ascension >= 2 && !d.elite && !d.boss) hp = Math.round(hp * 1.1);
    if(G.ascension >= 5 && d.elite) hp = Math.round(hp * 1.2);
    if(G.ascension >= 5 && d.boss)  hp = Math.round(hp * 1.1);
  }
  return { id:'e'+(uid++), def:defId, name:d.name, sprite:d.sprite, hp, maxHp:hp,
           block:0, strength:0, burn:0, exposed:0, rattled:0, turn:0, nextAction:null,
           elite:!!d.elite, boss:!!d.boss };
}

const ACT_DATA = [
  { /* ACT 1 */
    title:'Act I — The Slag Halls', theme:'act1',
    early:[ ['slagCrawler'], ['cinderWisp','cinderWisp'], ['boilerImp'], ['slagCrawler','cinderWisp'] ],
    late:[ ['rustHound'], ['forgeSpider'], ['boilerImp','boilerImp'], ['rustHound','cinderWisp'],
           ['forgeSpider','slagCrawler'], ['anvilBrute'], ['pyreShade'] ],
    elites:[ ['moltenGolem'], ['clockworkWarden'], ['scrapTyrant'] ],
    bosses:[
      {ids:['foundryKing'], name:'The Foundry King', sprite:'🫅'},
      {ids:['unmadeColossus'], name:'The Unmade Colossus', sprite:'🗿'},
    ],
  },
  { /* ACT 2 */
    title:'Act II — The Ashen Gallery', theme:'act2',
    early:[ ['gearSerpent'], ['ironShrike','ironShrike'], ['ashRevenant'], ['smelterWitch'] ],
    late:[ ['furnaceKnight'], ['coalDevil','ironShrike'], ['smelterWitch','ashRevenant'],
           ['gearSerpent','coalDevil'], ['ashRevenant','ironShrike'], ['furnaceKnight','cinderWisp'] ],
    elites:[ ['emberSeraph'], ['crucibleTwinA','crucibleTwinB'], ['kilnAbbot'] ],
    bosses:[
      {ids:['ashenMatriarch'], name:'The Ashen Matriarch', sprite:'🕸️'},
      {ids:['magnetarPrime'], name:'Magnetar Prime', sprite:'🧲'},
    ],
  },
  { /* ACT 3 */
    title:'Act III — The Burning Heart', theme:'act3',
    early:[ ['obsidianSentinel'], ['forgeWraith'], ['courtGuard','courtGuard'], ['moltenHydra'] ],
    late:[ ['pyreColossus'], ['forgeWraith','courtGuard'], ['obsidianSentinel','courtGuard'],
           ['moltenHydra','forgeWraith'], ['pyreColossus','courtGuard'] ],
    elites:[ ['heartsWarden'], ['annealedHorror'], ['gravewright'] ],
    bosses:[
      {ids:['heartOfForge'], name:'The Heart of the Forge', sprite:'🩸'},
      {ids:['firstFlame'], name:'The First Flame', sprite:'☀️'},
    ],
  },
];
