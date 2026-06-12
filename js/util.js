"use strict";
/* ====================================================================
   EMBERFORGE DEPTHS — utilities & seeded RNG
   ==================================================================== */
const $ = id => document.getElementById(id);
const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n));

let uid = 0;

/* ---------------- seeded RNG (mulberry32, serializable state) ----- */
const RNG = {
  s: 1,
  next(){
    this.s = (this.s + 0x6D2B79F5) | 0;
    let t = Math.imul(this.s ^ (this.s >>> 15), 1 | this.s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  },
};
/* xmur3 string hash → 32-bit seed */
function hashStr(str){
  let h = 1779033703 ^ str.length;
  for(let i = 0; i < str.length; i++){
    h = Math.imul(h ^ str.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  h = Math.imul(h ^ (h >>> 16), 2246822507);
  h = Math.imul(h ^ (h >>> 13), 3266489909);
  return (h ^= h >>> 16) >>> 0;
}
function seedRng(str){ RNG.s = hashStr(str) | 0; }
function randomSeedString(){
  const words = ['EMBER','SLAG','FORGE','ANVIL','CINDER','PISTON','MOLTEN','RIVET','COG','ASH','BRASS','SPARK'];
  return words[Math.floor(Math.random()*words.length)] + '-' +
         Math.floor(Math.random()*99999).toString(36).toUpperCase() +
         Math.floor(Math.random()*99999).toString(36).toUpperCase();
}

/* game-logic randomness — always seeded */
const randf  = () => RNG.next();
const rand   = (a,b) => Math.floor(RNG.next()*(b-a+1))+a;
const chance = p => RNG.next() < p;
const pick   = arr => arr[rand(0,arr.length-1)];
const shuffle = arr => { for(let i=arr.length-1;i>0;i--){const j=rand(0,i);[arr[i],arr[j]]=[arr[j],arr[i]];} return arr; };

/* cosmetic randomness — unseeded, never affects gameplay */
const crand = (a,b) => Math.random()*(b-a)+a;

/* animation duration scaled by game-speed setting (0 = instant, for tests) */
function dur(ms){
  const f = (typeof SETTINGS !== 'undefined' && SETTINGS.speed in SPEED_FACTORS)
    ? SPEED_FACTORS[SETTINGS.speed] : 1;
  return Math.round(ms * f);
}
const SPEED_FACTORS = { normal:1, fast:0.55, turbo:0.25, instant:0 };

function escapeHtml(s){ return String(s).replace(/[&<>"]/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c])); }
