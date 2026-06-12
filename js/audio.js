"use strict";
/* ====================================================================
   EMBERFORGE DEPTHS — procedural audio (WebAudio, zero assets)
   SFX + forge-ambience are synthesized; volumes via settings.
   ==================================================================== */
const AUDIO = {
  ctx: null, sfxGain: null, ambGain: null, started: false,
  ambNodes: [],
};

function audioSupported(){ return typeof window !== 'undefined' && (window.AudioContext || window.webkitAudioContext); }

function audioInit(){
  if(AUDIO.started || !audioSupported()) return;
  try {
    const AC = window.AudioContext || window.webkitAudioContext;
    AUDIO.ctx = new AC();
    AUDIO.sfxGain = AUDIO.ctx.createGain();
    AUDIO.ambGain = AUDIO.ctx.createGain();
    AUDIO.sfxGain.connect(AUDIO.ctx.destination);
    AUDIO.ambGain.connect(AUDIO.ctx.destination);
    AUDIO.started = true;
    audioApplyVolumes();
    startAmbience();
  } catch(e){ /* audio unavailable — play silently */ }
}
function audioApplyVolumes(){
  if(!AUDIO.started) return;
  AUDIO.sfxGain.gain.value = (SETTINGS.sfx ?? 0.8) * 0.9;
  AUDIO.ambGain.gain.value = (SETTINGS.ambience ?? 0.5) * 0.35;
}

/* ---------------- ambience: forge rumble + ember crackle ---------- */
function startAmbience(){
  const ctx = AUDIO.ctx;
  if(!ctx) return;
  /* brown-noise rumble through a lowpass */
  const len = ctx.sampleRate * 4;
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const data = buf.getChannelData(0);
  let last = 0;
  for(let i=0;i<len;i++){
    const white = Math.random()*2-1;
    last = (last + 0.02*white) / 1.02;
    data[i] = last * 3.5;
  }
  const src = ctx.createBufferSource();
  src.buffer = buf; src.loop = true;
  const lp = ctx.createBiquadFilter();
  lp.type = 'lowpass'; lp.frequency.value = 110; lp.Q.value = 0.4;
  /* slow LFO breathing on the rumble */
  const lfoGain = ctx.createGain(); lfoGain.gain.value = 0.75;
  const lfo = ctx.createOscillator(); lfo.frequency.value = 0.07;
  const lfoDepth = ctx.createGain(); lfoDepth.gain.value = 0.25;
  lfo.connect(lfoDepth); lfoDepth.connect(lfoGain.gain);
  src.connect(lp); lp.connect(lfoGain); lfoGain.connect(AUDIO.ambGain);
  src.start(); lfo.start();
  AUDIO.ambNodes.push(src, lfo);
  /* sporadic ember pops + distant clangs */
  scheduleCrackle();
}
function scheduleCrackle(){
  if(!AUDIO.started) return;
  const delay = 700 + Math.random()*2600;
  setTimeout(()=>{
    if(!AUDIO.started) return;
    if(Math.random() < 0.82) popEmber();
    else distantClang();
    scheduleCrackle();
  }, delay);
}
function popEmber(){
  const ctx = AUDIO.ctx, t = ctx.currentTime;
  const o = ctx.createOscillator(), g = ctx.createGain();
  o.type = 'triangle';
  o.frequency.setValueAtTime(1400 + Math.random()*2200, t);
  o.frequency.exponentialRampToValueAtTime(220, t + 0.06);
  g.gain.setValueAtTime(0.12 + Math.random()*0.1, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 0.07);
  o.connect(g); g.connect(AUDIO.ambGain);
  o.start(t); o.stop(t + 0.09);
}
function distantClang(){
  const ctx = AUDIO.ctx, t = ctx.currentTime;
  [220, 331, 547].forEach((f, i)=>{
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = 'sine';
    o.frequency.value = f * (0.97 + Math.random()*0.06);
    g.gain.setValueAtTime(0.05 / (i+1), t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 1.7);
    o.connect(g); g.connect(AUDIO.ambGain);
    o.start(t); o.stop(t + 1.8);
  });
}

/* ---------------- SFX primitives ---------------- */
function tone(freq, durS, type, vol, slideTo, when){
  if(!AUDIO.started) return;
  const ctx = AUDIO.ctx, t = ctx.currentTime + (when||0);
  const o = ctx.createOscillator(), g = ctx.createGain();
  o.type = type || 'sine';
  o.frequency.setValueAtTime(freq, t);
  if(slideTo) o.frequency.exponentialRampToValueAtTime(Math.max(20, slideTo), t + durS);
  g.gain.setValueAtTime(vol ?? 0.2, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + durS);
  o.connect(g); g.connect(AUDIO.sfxGain);
  o.start(t); o.stop(t + durS + 0.05);
}
function noise(durS, vol, filterFreq, filterType, when){
  if(!AUDIO.started) return;
  const ctx = AUDIO.ctx, t = ctx.currentTime + (when||0);
  const len = Math.max(1, Math.floor(ctx.sampleRate * durS));
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const d = buf.getChannelData(0);
  for(let i=0;i<len;i++) d[i] = Math.random()*2-1;
  const src = ctx.createBufferSource(); src.buffer = buf;
  const f = ctx.createBiquadFilter();
  f.type = filterType || 'lowpass'; f.frequency.value = filterFreq || 1000;
  const g = ctx.createGain();
  g.gain.setValueAtTime(vol ?? 0.2, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + durS);
  src.connect(f); f.connect(g); g.connect(AUDIO.sfxGain);
  src.start(t); src.stop(t + durS + 0.02);
}

/* ---------------- named SFX ---------------- */
const SFX = {
  click(){ tone(880, 0.05, 'square', 0.06); },
  cardPlay(){ noise(0.12, 0.14, 3500, 'highpass'); tone(520, 0.09, 'triangle', 0.07, 700); },
  draw(){ noise(0.06, 0.08, 5000, 'highpass'); },
  attack(){ noise(0.14, 0.3, 900); tone(110, 0.12, 'square', 0.16, 55); },
  heavyHit(){ noise(0.25, 0.4, 500); tone(75, 0.3, 'sawtooth', 0.22, 38); },
  block(){ tone(620, 0.1, 'triangle', 0.16, 740); tone(930, 0.14, 'sine', 0.1, 1100, 0.03); },
  burn(){ noise(0.3, 0.16, 2600, 'bandpass'); },
  vent(){ noise(0.4, 0.2, 1800, 'highpass'); },
  overheat(){ noise(0.35, 0.3, 2200, 'bandpass'); tone(150, 0.35, 'sawtooth', 0.18, 70); },
  playerHit(){ noise(0.2, 0.32, 420); tone(90, 0.22, 'square', 0.2, 45); },
  enemyDie(){ noise(0.4, 0.28, 350); tone(180, 0.4, 'sawtooth', 0.16, 40); },
  gold(){ tone(1320, 0.07, 'square', 0.1); tone(1760, 0.12, 'square', 0.09, undefined, 0.07); },
  potion(){ tone(420, 0.12, 'sine', 0.14, 880); tone(660, 0.14, 'sine', 0.1, 1320, 0.08); },
  relic(){ [660, 880, 1320].forEach((f,i)=>tone(f, 0.25, 'triangle', 0.1, undefined, i*0.09)); },
  heal(){ tone(520, 0.3, 'sine', 0.12, 780); tone(780, 0.32, 'sine', 0.08, 1040, 0.12); },
  servo(){ tone(330, 0.08, 'square', 0.1, 495); tone(660, 0.06, 'square', 0.07, undefined, 0.08); },
  ignite(){ noise(0.4, 0.3, 3000, 'bandpass'); tone(300, 0.35, 'sawtooth', 0.12, 110); },
  endTurn(){ tone(440, 0.08, 'triangle', 0.08, 330); },
  bossIntro(){
    tone(82, 1.6, 'sine', 0.3, 41); tone(123, 1.4, 'sine', 0.18, 62, 0.05);
    noise(1.1, 0.12, 240);
  },
  victory(){ [523, 659, 784, 1046].forEach((f,i)=>tone(f, 0.32, 'triangle', 0.14, undefined, i*0.12)); },
  defeat(){ [392, 311, 261, 196].forEach((f,i)=>tone(f, 0.5, 'sine', 0.16, undefined, i*0.22)); },
  achievement(){ [784, 988, 1175].forEach((f,i)=>tone(f, 0.3, 'triangle', 0.12, undefined, i*0.1)); },
};
function sfx(name){
  try { if(AUDIO.started && SFX[name]) SFX[name](); } catch(e){}
}

/* start audio on first user gesture (browser autoplay policy) */
if(typeof window !== 'undefined'){
  const kick = ()=>{ audioInit(); window.removeEventListener('pointerdown', kick); window.removeEventListener('keydown', kick); };
  window.addEventListener('pointerdown', kick);
  window.addEventListener('keydown', kick);
}
