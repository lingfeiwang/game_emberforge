/* Reproduction: Pyre Locket burn spread on every kill path */
import { boot, sleep } from './harness.mjs';

let failures = 0;
const ok = (cond, name, extra='') => { console.log((cond?'✓':'✗ FAIL'), name, extra); if(!cond) failures++; };

const instantProfile = JSON.stringify({
  version:1, settings:{sfx:0,ambience:0,speed:'instant',shake:false,particles:false},
  unlocks:{cinderwitch:true,scrapwright:true},
  ascension:{forgeborn:10,cinderwitch:10,scrapwright:10},
  achievements:{}, daily:{},
  stats:{runs:0,wins:0,bestScore:0,totalFloors:0,totalKills:0,bestStreak:0,streak:0,biggestHit:0,byChar:{}},
});

async function freshCombat(run, enemies = "['anvilBrute','anvilBrute','anvilBrute']") {
  run(`startCombat(${enemies}, false)`);
  await sleep(20);
  run(`G.playerTurn = true; G.pyre = 0; G.player.strength = 0;`);
}

const H = await boot({ storage: { EF_profile_v1: instantProfile } });
const { run } = H;
run(`newRun({character:'cinderwitch', ascension:0, seedStr:'SPREAD-1'})`);
ok(run(`G.relics.includes('pyreLocket')`), 'cinderwitch starts with Pyre Locket');

/* ---- 1. player attack kills burning enemy ---- */
await freshCombat(run);
run(`G.enemies[0].burn = 6; G.enemies[0].hp = 1; G.enemies[0].block = 0;`);
run(`dealDamage(G.enemies[0], 5, true)`);
ok(run('G.enemies[0].hp') === 0, 'attack kill: enemy 0 died');
ok(run('G.enemies[1].burn + G.enemies[2].burn') === 6,
   'attack kill: 6 burn spread to a living enemy',
   `(got ${run('G.enemies[1].burn')}/${run('G.enemies[2].burn')})`);
ok(run('G.enemies[0].burn') === 0, 'attack kill: corpse burn cleared');
run('renderCombat()');
ok(run(`document.querySelector('.enemy.dead .stags').innerHTML`) === '',
   'attack kill: corpse renders no status tags');

/* ---- 2. ignite kills burning enemy ---- */
await freshCombat(run);
run(`G.enemies[0].burn = 8; G.enemies[0].hp = 3; G.enemies[0].block = 0;`);
run(`igniteEnemy(G.enemies[0], 1)`);
ok(run('G.enemies[0].hp') === 0, 'ignite kill: enemy 0 died');
ok(run('G.enemies[1].burn + G.enemies[2].burn') === 8,
   'ignite kill: 8 burn spread',
   `(got ${run('G.enemies[1].burn')}/${run('G.enemies[2].burn')})`);

/* ---- 3. burn tick kills enemy during enemy phase ---- */
await freshCombat(run);
run(`G.enemies[0].burn = 10; G.enemies[0].hp = 4;
     G.enemies[1].burn = 0; G.enemies[2].burn = 0;
     G.enemies.forEach(e=>{ e.nextAction = {kind:'block', name:'Wait', amt:1}; });
     G.playerTurn = false; enemyPhase();`);
await sleep(150);
ok(run('G.enemies[0].hp') === 0, 'burn-tick kill: enemy 0 died of burn');
/* receiver hadn't acted yet, so the spread burn ticks at its own slot (10 dmg)
   and decays to 9 by phase end */
ok(run('G.enemies[1].burn + G.enemies[2].burn') === 9,
   'burn-tick kill: 10 burn spread, ticked at receiver\'s slot, decayed to 9',
   `(got ${run('G.enemies[1].burn')}/${run('G.enemies[2].burn')})`);

/* ---- 4. AoE kills two burning enemies at once ---- */
await freshCombat(run);
run(`G.enemies[0].burn = 4; G.enemies[0].hp = 2;
     G.enemies[1].burn = 5; G.enemies[1].hp = 2;
     G.enemies[2].burn = 0; G.enemies[2].hp = 50;
     G.enemies.forEach(e=>e.block=0);
     G.enemies.slice().forEach(e=>{ if(e.hp>0 && e!==G.enemies[2]) dealDamage(e, 3, true); });`);
ok(run('G.enemies[2].burn') === 9,
   'double kill: both burns (4+5) land on the survivor',
   `(got ${run('G.enemies[2].burn')})`);

/* ---- 5. chain reaction: spread burn then ignite-kills the receiver ---- */
await freshCombat(run, "['anvilBrute','anvilBrute']");
run(`G.enemies[0].burn = 12; G.enemies[0].hp = 1;
     G.enemies[1].burn = 0;  G.enemies[1].hp = 60; G.enemies[1].block = 0;`);
run(`dealDamage(G.enemies[0], 1, true)`);
ok(run('G.enemies[1].burn') === 12, 'chain: survivor got 12 burn');
run(`igniteEnemy(G.enemies[1], 1)`);
ok(run('G.enemies[1].hp') === 48, 'chain: ignite of spread burn deals 12');

/* ---- 6. last enemy dies burning → no crash, combat ends ---- */
await freshCombat(run, "['anvilBrute']");
run(`G.enemies[0].burn = 7; G.enemies[0].hp = 1; G.enemies[0].block = 0;`);
run(`dealDamage(G.enemies[0], 5, true); checkCombatEnd();`); /* as playCard does */
await sleep(50);
ok(run('G.inCombat') === false, 'last-enemy kill: combat ends cleanly');

/* ---- 7. mid-phase spread to an already-acted enemy ticks next phase ---- */
run(`G.hp = 500; G.maxHp = 500;`);
await freshCombat(run, "['anvilBrute','anvilBrute']");
run(`G.hp = 500; G.maxHp = 500;
     G.enemies[0].burn = 0;  G.enemies[0].hp = 40; G.enemies[0].maxHp = 40; G.enemies[0].block = 0;
     G.enemies[1].burn = 10; G.enemies[1].hp = 5;  G.enemies[1].block = 0;
     G.playerTurn = false; enemyPhase();`);
await sleep(200);
ok(run('G.enemies[1].hp') === 0, 'mid-phase: burner died of its own burn');
ok(run('G.enemies[1].burn') === 0, 'mid-phase: corpse burn cleared');
ok(run('G.enemies[0].burn') === 10, 'mid-phase: receiver holds the 10 spread burn',
   `(got ${run('G.enemies[0].burn')})`);
ok(run('G.enemies[0].hp') === 40, 'mid-phase: no double-tick in the same phase');
ok(run('G.playerTurn') === true, 'mid-phase: back to player turn');
run(`G.hand = []; endTurn();`);
await sleep(200);
ok(run('G.enemies[0].hp') === 30, 'next phase: spread burn ticks for 10',
   `(got ${run('G.enemies[0].hp')})`);
ok(run('G.enemies[0].burn') === 9, 'next phase: burn decays to 9');

/* ---- 8. regression: EVERY living enemy acts each enemy phase ---- */
run(`G.hp = 500; G.maxHp = 500;`);
await freshCombat(run, "['anvilBrute','anvilBrute','anvilBrute']");
run(`G.hp = 500; G.playerTurn = false; enemyPhase();`);
await sleep(200);
ok(run('G.enemies.map(e=>e.turn).join(",")') === '1,1,1',
   'all 3 enemies act in one phase', `(turns: ${run('G.enemies.map(e=>e.turn).join(",")')})`);
run(`G.enemies[0].hp = 0; G.enemies[0].burn = 0;`); /* first one dies */
run(`G.hand = []; G.playerTurn = true; endTurn();`);
await sleep(200);
ok(run('G.enemies.map(e=>e.turn).join(",")') === '1,2,2',
   'survivors still act after a death earlier in the array',
   `(turns: ${run('G.enemies.map(e=>e.turn).join(",")')})`);

console.log(failures === 0 ? '\nALL SPREAD TESTS PASSED' : `\n${failures} FAILURES`);
if (H.errors.length) { console.log('runtime errors:', H.errors.slice(0,3)); process.exit(1); }
process.exit(failures ? 1 : 0);
