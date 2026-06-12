"use strict";
/* ====================================================================
   EMBERFORGE DEPTHS — meta-progression: profile, settings, saves,
   unlocks, achievements, scoring, daily climb
   ==================================================================== */
const GAME_VERSION = '1.0.1';
const PROFILE_KEY = 'EF_profile_v1';
const RUN_KEY = 'EF_run_v1';

const DEFAULT_SETTINGS = { sfx:0.8, ambience:0.5, speed:'normal', shake:true, particles:true };

let PROFILE = null;
let SETTINGS = null;

function storageGet(k){ try { return localStorage.getItem(k); } catch(e){ return null; } }
function storageSet(k,v){ try { localStorage.setItem(k,v); } catch(e){} }
function storageDel(k){ try { localStorage.removeItem(k); } catch(e){} }

function loadProfile(){
  let p = null;
  const raw = storageGet(PROFILE_KEY);
  if(raw){ try { p = JSON.parse(raw); } catch(e){ p = null; } }
  PROFILE = Object.assign({
    version: 1,
    settings: {...DEFAULT_SETTINGS},
    unlocks: { cinderwitch:false, scrapwright:false },
    ascension: { forgeborn:0, cinderwitch:0, scrapwright:0 }, /* highest unlocked */
    achievements: {},
    daily: {},          /* dateStr -> best score */
    stats: {
      runs:0, wins:0, bestScore:0, totalFloors:0, totalKills:0,
      bestStreak:0, streak:0, biggestHit:0,
      byChar: {},       /* char -> {runs,wins,bestScore} */
    },
  }, p || {});
  PROFILE.settings = Object.assign({...DEFAULT_SETTINGS}, PROFILE.settings || {});
  SETTINGS = PROFILE.settings;
  return PROFILE;
}
function saveProfile(){ storageSet(PROFILE_KEY, JSON.stringify(PROFILE)); }

/* ---------------- run save / load ---------------- */
function serializeRun(extra){
  if(!G) return null;
  return Object.assign({
    version: GAME_VERSION,
    seedStr: G.seedStr, rngState: RNG.s,
    character: G.character, ascension: G.ascension, daily: G.daily || null,
    hp: G.hp, maxHp: G.maxHp, gold: G.gold, act: G.act, floorNum: G.floorNum,
    permCap: G.permCap, removalCost: G.removalCost,
    relics: [...G.relics], potions: [...G.potions],
    deck: G.deck.map(c=>({def:c.def, upgraded:!!c.upgraded})),
    map: G.map, currentNodeKey: G.currentNodeKey, visitedKeys: [...G.visitedKeys],
    eventsSeen: [...(G.eventsSeen||[])],
    runStats: G.runStats,
    pendingNode: null, pendingReward: null, pendingBossReward: null, shopState: null,
  }, extra || {});
}
function saveRun(extra){
  const data = serializeRun(extra);
  if(data) storageSet(RUN_KEY, JSON.stringify(data));
}
function clearRun(){ storageDel(RUN_KEY); }
function loadRunData(){
  const raw = storageGet(RUN_KEY);
  if(!raw) return null;
  try { return JSON.parse(raw); } catch(e){ return null; }
}
function hasSavedRun(){ return !!loadRunData(); }

/* ---------------- achievements ---------------- */
const ACH_DEFS = {
  firstSpark:   {icon:'✨', name:'First Spark',      desc:'Win your first combat.'},
  slagSlayer:   {icon:'🫅', name:'Regicide',          desc:'Defeat The Foundry King.'},
  galleryGhost: {icon:'🕸️', name:'Web Cutter',       desc:'Defeat The Ashen Matriarch.'},
  forgeMaster:  {icon:'🏆', name:'Forge Master',      desc:'Complete a full run.'},
  winForgeborn: {icon:'🤖', name:'Iron Will',         desc:'Win a run as the Forgeborn.'},
  winCinderwitch:{icon:'🔮', name:'Pyre Queen',       desc:'Win a run as the Cinderwitch.'},
  winScrapwright:{icon:'🦾', name:'Chief Engineer',   desc:'Win a run as the Scrapwright.'},
  ascended5:    {icon:'🌋', name:'Deep Delver',       desc:'Win a run at Ascension 5+.'},
  ascended10:   {icon:'☢️', name:'Heatproof',         desc:'Win a run at Ascension 10.'},
  minimalist:   {icon:'🃏', name:'Lean Machine',      desc:'Win a run with 14 or fewer cards.'},
  librarian:    {icon:'📚', name:'Pack Rat',          desc:'Win a run with 35 or more cards.'},
  untouchable:  {icon:'🛡️', name:'Untouchable',      desc:'Win an elite or boss fight without losing HP.'},
  pyromaniac:   {icon:'🔥', name:'Pyromaniac',        desc:'Have 20+ Burn on a single enemy.'},
  overheated:   {icon:'🥵', name:'Pain Tolerance',    desc:'Sear yourself for 12+ HP in one combat and still win.'},
  servoLord:    {icon:'⚙️', name:'Full Crew',         desc:'Have 3 Servos deployed at once.'},
  goldFever:    {icon:'🪙', name:'Gold Fever',        desc:'Hold 450+ gold at once.'},
  chainGang:    {icon:'⛓️', name:'Chain Gang',        desc:'Chain 5 cards in a row in one turn.'},
  haymaker:     {icon:'💥', name:'Haymaker',          desc:'Deal 50+ damage in a single hit.'},
  alchemist:    {icon:'⚗️', name:'Alchemist',         desc:'Drink 3 potions in one combat.'},
  dailyDevotee: {icon:'📅', name:'Shift Worker',      desc:'Complete a Daily Climb.'},
};
function award(id){
  if(!PROFILE || PROFILE.achievements[id]) return;
  PROFILE.achievements[id] = Date.now();
  saveProfile();
  if(typeof toastAchievement === 'function') toastAchievement(id);
}

/* ---------------- unlock helpers ---------------- */
function charUnlocked(id){
  if(id === 'forgeborn') return true;
  return !!(PROFILE && PROFILE.unlocks[id]);
}
function unlockChar(id){
  if(!PROFILE || PROFILE.unlocks[id]) return;
  PROFILE.unlocks[id] = true;
  saveProfile();
  if(typeof toastUnlock === 'function') toastUnlock(id);
}
function maxAscension(charId){ return (PROFILE && PROFILE.ascension[charId]) || 0; }

/* ---------------- scoring ---------------- */
function scoreRun(win){
  const rs = G.runStats;
  let rows = [
    ['Floors descended', rs.floors * 5],
    ['Monsters slain', rs.kills * 2],
    ['Elites broken', rs.elites * 15],
    ['Bosses felled', rs.bosses * 60],
    ['Relics collected', Math.max(0, G.relics.length - 1) * 5],
    ['Gold hoarded', Math.floor(G.gold / 5)],
  ];
  if(win) rows.push(['THE FORGE IS YOURS', 200]);
  let total = rows.reduce((s,r)=>s+r[1], 0);
  if(G.ascension > 0){
    const bonus = Math.round(total * G.ascension * 0.08);
    rows.push([`Ascension ${G.ascension} (+${G.ascension*8}%)`, bonus]);
    total += bonus;
  }
  return { rows, total };
}

/* ---------------- run end bookkeeping ---------------- */
function recordRunEnd(win, score){
  const s = PROFILE.stats;
  s.runs++;
  if(win){ s.wins++; s.streak++; s.bestStreak = Math.max(s.bestStreak, s.streak); }
  else s.streak = 0;
  s.totalFloors += G.runStats.floors;
  s.totalKills += G.runStats.kills;
  s.bestScore = Math.max(s.bestScore, score);
  const bc = s.byChar[G.character] = s.byChar[G.character] || {runs:0,wins:0,bestScore:0};
  bc.runs++; if(win) bc.wins++;
  bc.bestScore = Math.max(bc.bestScore, score);
  if(win){
    if(G.daily){
      PROFILE.daily[G.daily] = Math.max(PROFILE.daily[G.daily]||0, score);
      award('dailyDevotee');
    } else {
      /* ascension ladder: winning at your current cap raises it */
      if(G.ascension >= maxAscension(G.character) && maxAscension(G.character) < 10)
        PROFILE.ascension[G.character] = G.ascension + 1;
      if(G.ascension >= 5) award('ascended5');
      if(G.ascension >= 10) award('ascended10');
    }
    award('forgeMaster');
    award({forgeborn:'winForgeborn', cinderwitch:'winCinderwitch', scrapwright:'winScrapwright'}[G.character]);
    if(G.deck.length <= 14) award('minimalist');
    if(G.deck.length >= 35) award('librarian');
  }
  saveProfile();
}

/* ---------------- daily climb ---------------- */
function todayStr(){
  const d = new Date();
  return d.getUTCFullYear() + '-' + String(d.getUTCMonth()+1).padStart(2,'0') + '-' + String(d.getUTCDate()).padStart(2,'0');
}
function dailyConfig(){
  const date = todayStr();
  const n = hashStr('EF-DAILY-' + date);
  const chars = ['forgeborn','cinderwitch','scrapwright'];
  return {
    date,
    seedStr: 'DAILY-' + date,
    character: chars[n % 3],
    ascension: n % 6,
  };
}
