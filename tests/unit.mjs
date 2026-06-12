/* Focused checks: determinism, mechanics, meta, overlays, shop restore */
import { boot, click, sleep, activeScreen, dumpStorage } from './harness.mjs';

let failures = 0;
const ok = (cond, name) => { console.log((cond ? '✓' : '✗ FAIL'), name); if (!cond) failures++; };

const instantProfile = JSON.stringify({
  version:1, settings:{sfx:0,ambience:0,speed:'instant',shake:false,particles:false},
  unlocks:{cinderwitch:true,scrapwright:true},
  ascension:{forgeborn:10,cinderwitch:10,scrapwright:10},
  achievements:{}, daily:{},
  stats:{runs:0,wins:0,bestScore:0,totalFloors:0,totalKills:0,bestStreak:0,streak:0,biggestHit:0,byChar:{}},
});

/* ---------- 1. seed determinism ---------- */
{
  const sig = async () => {
    const H = await boot({ storage: { EF_profile_v1: instantProfile } });
    H.run(`newRun({character:'forgeborn', ascension:0, seedStr:'DET-7'})`);
    const mapSig = H.run('JSON.stringify(Object.keys(G.map.nodes).map(k=>G.map.nodes[k].type))');
    click(H.window, H.window.document.querySelector('#mapsvg .mnode-avail'));
    await sleep(20);
    const enc = H.run('G.enemies.map(e=>e.def+":"+e.maxHp).join(",")');
    const hand = H.run('G.hand.map(c=>c.def).join(",")');
    H.dom.window.close();
    return mapSig + '||' + enc + '||' + hand;
  };
  const a = await sig(), b = await sig();
  ok(a === b, 'same seed → identical map, encounter, opening hand');
}

/* ---------- 2. mechanics: ignite, pyre, servos ---------- */
{
  const H = await boot({ storage: { EF_profile_v1: instantProfile } });
  const { run } = H;
  run(`newRun({character:'cinderwitch', ascension:0, seedStr:'MECH-1'})`);
  run(`startCombat(['anvilBrute'], false)`);
  run(`G.heat = 0; G.playerTurn = true;`);
  const e = 'G.enemies[0]';
  run(`${e}.hp = 100; ${e}.maxHp = 100; ${e}.burn = 0; ${e}.block = 0; G.player.strength = 0;`);
  run(`applyStatus(${e}, 'burn', 5)`);
  ok(run(`${e}.burn`) === 5, 'burn applied without pyre = 5');
  run(`G.pyre = 2; applyStatus(${e}, 'burn', 3)`);
  ok(run(`${e}.burn`) === 10, 'Heart of Ash: burn 3 + pyre 2 → total 10');
  const hpBefore = run(`${e}.hp`);
  run(`igniteEnemy(${e}, 1)`);
  ok(run(`${e}.hp`) === hpBefore - 10, 'ignite ×1 deals damage equal to burn');
  ok(run(`${e}.burn`) === 10, 'ignite does not remove burn');

  // servos
  run(`G.servos = []; G.servoCap = 3; G.servoBoost = 0;`);
  run(`deployServo('aegis')`);
  const blockBefore = run('G.player.block');
  run(`servoAct(G.servos[0])`);
  ok(run('G.player.block') === blockBefore + 4, 'aegis servo grants 4 block');
  run(`G.servoBoost = 2; servoAct(G.servos[0])`);
  ok(run('G.player.block') === blockBefore + 10, 'tune-up boost: aegis grants 6');
  run(`deployServo('strike'); deployServo('volt')`);
  ok(run('G.servos.length') === 3, '3 servos deployed');
  ok(run(`deployServo('strike')`) === null, '4th deploy rejected at cap');
  ok(run(`PROFILE.achievements.servoLord !== undefined`), 'servoLord achievement awarded');
  run(`destroyServo()`);
  ok(run('G.servos.length') === 2, 'destroyServo removes newest');
  H.dom.window.close();
}

/* ---------- 3. overheat math & ascension 8 ---------- */
{
  const H = await boot({ storage: { EF_profile_v1: instantProfile } });
  const { run } = H;
  run(`newRun({character:'forgeborn', ascension:0, seedStr:'OH-1'})`);
  run(`startCombat(['anvilBrute'], false)`);
  run(`G.playerTurn = true; G.heat = capacity(); G.hand = [makeCard('emberJab')]; renderCombat();`);
  const hp = run('G.hp');
  run(`playCard(G.hand[0], G.enemies[0])`);
  ok(run('G.hp') === hp - 6, 'overheat: 3 over capacity → 6 sear (2/point)');
  ok(run('G.overheatedThisTurn') === true, 'overheatedThisTurn set');
  H.dom.window.close();
}

/* ---------- 4. meta: unlock flow + ascension ladder ---------- */
{
  // fresh profile (nothing unlocked)
  const H = await boot();
  const { run } = H;
  run(`SETTINGS.speed='instant'; saveProfile();`);
  ok(run('charUnlocked("cinderwitch")') === false, 'cinderwitch locked on fresh profile');
  run(`newRun({character:'forgeborn', ascension:0, seedStr:'META-1'})`);
  // simulate beating act 1 boss
  run(`G.act = 0; combatKind = 'boss'; G.enemies = []; bossVictory();`);
  ok(run('charUnlocked("cinderwitch")') === true, 'act 1 boss → cinderwitch unlocked');
  ok(run('PROFILE.achievements.slagSlayer !== undefined'), 'slagSlayer achievement');
  const relicChoices = H.window.document.querySelectorAll('#overlay-panel .relic-choice');
  ok(relicChoices.length === 3, 'boss reward offers 3 relics');
  click(H.window, relicChoices[0]);
  await sleep(10);
  ok(run('G.act') === 1, 'picking boss relic advances to act 2');
  ok(run('G.relics.length') === 2, 'boss relic added');
  // simulate full win from act 3
  run(`G.act = 2; combatKind = 'boss'; G.enemies = []; bossVictory();`);
  ok(activeScreen(H.window) === 'screen-win', 'win screen shown');
  ok(run('charUnlocked("scrapwright")') === false, 'scrapwright still locked (act2 boss skipped)');
  ok(run('PROFILE.ascension.forgeborn') === 1, 'win at A0 unlocks Ascension 1');
  ok(run('PROFILE.stats.wins') === 1, 'win recorded');
  ok(run('hasSavedRun()') === false, 'run save cleared after win');
  ok(H.window.document.getElementById('win-stats').textContent.includes('SCORE'), 'score table rendered');
  H.dom.window.close();
}

/* ---------- 5. daily climb ---------- */
{
  const H = await boot({ storage: { EF_profile_v1: instantProfile } });
  const { run } = H;
  run('startDaily()');
  ok(activeScreen(H.window) === 'screen-map', 'daily run starts');
  ok(run('G.daily') !== null, 'daily flag set');
  ok(run('G.seedStr').startsWith('DAILY-'), 'daily seed');
  run(`G.act = 2; combatKind = 'boss'; G.enemies = []; G.runStats.bosses=2; bossVictory();`);
  ok(run('Object.keys(PROFILE.daily).length') === 1, 'daily best score recorded');
  ok(run('PROFILE.achievements.dailyDevotee !== undefined'), 'dailyDevotee awarded');
  ok(run('PROFILE.ascension.forgeborn') === 10, 'daily win does NOT bump ascension ladder');
  H.dom.window.close();
}

/* ---------- 6. shop state restore ---------- */
{
  const H = await boot({ storage: { EF_profile_v1: instantProfile } });
  const { run } = H;
  run(`newRun({character:'forgeborn', ascension:0, seedStr:'SHOP-1'})`);
  run(`G.gold = 999; G.currentNodeKey = '3-3'; G.map.nodes['3-3'] = {r:3,c:3,type:'shop'}; G.visitedKeys.push('3-3');`);
  run('openShop()');
  ok(activeScreen(H.window) === 'screen-shop', 'shop open');
  const stockSig = run('shopStock.cards.map(c=>c.card.def).join(",")');
  // buy first card
  const cell = H.window.document.querySelector('#shop-items .shop-cell');
  click(H.window, cell);
  await sleep(10);
  ok(run('shopStock.cards[0].sold') === true, 'first card bought');
  const gold = run('G.gold');
  // reload
  const storage = dumpStorage(H.window);
  H.dom.window.close();
  const H2 = await boot({ storage });
  click(H2.window, H2.window.document.getElementById('continue-btn'));
  await sleep(30);
  ok(activeScreen(H2.window) === 'screen-shop', 'reload returns to shop');
  ok(H2.run('shopStock.cards.map(c=>c.card.def).join(",")') === stockSig, 'shop stock preserved');
  ok(H2.run('shopStock.cards[0].sold') === true, 'sold flag preserved');
  ok(H2.run('G.gold') === gold, 'gold preserved');
  H2.dom.window.close();
}

/* ---------- 7. menu overlays ---------- */
{
  const H = await boot({ storage: { EF_profile_v1: instantProfile } });
  const { run } = H;
  for (const fn of ['openStats()', 'openCollection()', 'openSettings()', 'openHowTo()']) {
    run(fn);
    ok(H.window.document.getElementById('overlay').classList.contains('active'), fn + ' opens');
    run('closeOverlay()');
  }
  run('openCollection()');
  const cardCount = H.window.document.querySelectorAll('#overlay-panel .card').length;
  ok(cardCount > 90, `collection shows all cards (${cardCount})`);
  ok(H.__errors ? H.__errors.length === 0 : H.errors.length === 0, 'no errors from overlays');
  H.dom.window.close();
}

console.log(failures === 0 ? '\nALL UNIT TESTS PASSED' : `\n${failures} FAILURES`);
process.exit(failures ? 1 : 0);
