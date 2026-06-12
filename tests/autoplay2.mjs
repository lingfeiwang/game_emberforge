/* Smarter agent: avoids overheat, blocks, reloads save between acts.
   Usage: node autoplay2.mjs <char> <seed> <asc> [--reload] */
import { boot, click, sleep, activeScreen, dumpStorage } from './harness.mjs';

const charId = process.argv[2] || 'forgeborn';
const seed = process.argv[3] || 'SMART-1';
const asc = +(process.argv[4] || 0);
const doReload = process.argv.includes('--reload');

let rngS = 99991;
const frand = () => { rngS = (rngS * 1103515245 + 12345) & 0x7fffffff; return rngS / 0x7fffffff; };
const fpick = arr => arr[Math.floor(frand() * arr.length)];

const profile = {
  version: 1,
  settings: { sfx: 0, ambience: 0, speed: 'instant', shake: false, particles: false },
  unlocks: { cinderwitch: true, scrapwright: true },
  ascension: { forgeborn: 10, cinderwitch: 10, scrapwright: 10 },
  achievements: {}, daily: {},
  stats: { runs: 0, wins: 0, bestScore: 0, totalFloors: 0, totalKills: 0, bestStreak: 0, streak: 0, biggestHit: 0, byChar: {} },
};

let H = await boot({ storage: { EF_profile_v1: JSON.stringify(profile) } });
H.run(`newRun({character:'${charId}', ascension:${asc}, seedStr:'${seed}'})`);

let steps = 0, stall = 0, lastSig = '', reloads = 0, lastAct = 0;
const MAX_STEPS = 20000;

while (steps++ < MAX_STEPS) {
  const { window, errors, run } = H;
  const doc = window.document;
  if (errors.length) break;
  const screen = activeScreen(window);
  const overlay = doc.getElementById('overlay').classList.contains('active');
  const sig = screen + '|' + overlay + '|' + run('G ? G.floorNum+":"+(G.inCombat?G.combatTurn:"-")+":"+(G.hand?G.hand.length:0)+":"+G.hp+":"+G.heat : "noG"');
  if (sig === lastSig) stall++; else { stall = 0; lastSig = sig; }
  if (stall > 900) { console.log('STALL at', sig); break; }
  if (screen === 'screen-gameover' || screen === 'screen-win') break;

  /* mid-run reload test: once per act change, on the map with no overlay */
  if (doReload && screen === 'screen-map' && !overlay) {
    const act = run('G.act');
    if (act > lastAct) {
      lastAct = act;
      reloads++;
      const storage = dumpStorage(window);
      H.dom.window.close();
      H = await boot({ storage });
      if (activeScreen(H.window) !== 'screen-title') { console.log('reload: not on title'); break; }
      const cont = H.window.document.getElementById('continue-btn');
      if (cont.style.display === 'none') { console.log('reload: no continue button'); break; }
      click(H.window, cont);
      await sleep(20);
      continue;
    }
  }

  if (overlay) {
    const panel = doc.getElementById('overlay-panel');
    const rewards = [...panel.querySelectorAll('.reward-card, .relic-choice')];
    if (rewards.length) { click(window, fpick(rewards)); await sleep(2); continue; }
    const smithCards = [...panel.querySelectorAll('.deck-list .card')];
    if (smithCards.length && frand() < 0.7) { click(window, fpick(smithCards)); await sleep(2); continue; }
    const btns = [...panel.querySelectorAll('button:not(:disabled)')];
    if (btns.length) click(window, btns.find(b=>b.classList.contains('primary')) || fpick(btns));
    await sleep(2);
    continue;
  }

  if (screen === 'screen-map') {
    const nodes = [...doc.querySelectorAll('#mapsvg .mnode-avail')];
    if (nodes.length) {
      // prefer rest when hurt
      const hp = run('G.hp/G.maxHp');
      let target = null;
      if (hp < 0.5) target = nodes.find(n => n.dataset.tt && n.dataset.tt.includes('Rest'));
      click(window, target || fpick(nodes));
    }
    await sleep(5);
    continue;
  }

  if (screen === 'screen-combat') {
    if (!run('G.inCombat')) { await sleep(10); continue; }
    if (!run('G.playerTurn')) { await sleep(5); continue; }
    // drink potion if hurt
    if (frand() < 0.1) {
      const po = [...doc.querySelectorAll('#potionbar .potion:not(.empty)')];
      if (po.length) { click(window, fpick(po)); await sleep(2); }
    }
    const safe = [...doc.querySelectorAll('#hand .card:not(.unplayable-warn)')]
      .filter(c => !c.querySelector('.ctext').textContent.includes('Unplayable'));
    if (safe.length) {
      const c = fpick(safe);
      const before = run('G.cardsPlayedThisTurn');
      click(window, c);
      await sleep(2);
      if (run('selectedCard !== null')) {
        const tg = [...doc.querySelectorAll('.enemy.targetable')];
        if (tg.length) click(window, fpick(tg));
        await sleep(2);
      }
      if (run('G.cardsPlayedThisTurn') === before && run('selectedCard === null')) {
        // couldn't play (e.g. unplayable) — end turn to avoid loop
        run('if(G.playerTurn) endTurn()');
        await sleep(10);
      }
    } else {
      run('if(G.playerTurn) endTurn()');
      await sleep(10);
    }
    continue;
  }

  if (screen === 'screen-rest') {
    const hp = H.run('G.hp/G.maxHp');
    const cards = [...doc.querySelectorAll('#screen-rest .room-card')];
    click(window, hp < 0.6 ? cards[0] : fpick(cards));
    await sleep(2);
    continue;
  }

  if (screen === 'screen-shop') {
    if (frand() < 0.4) {
      const items = [...doc.querySelectorAll('#shop-items .shop-cell')];
      if (items.length) click(window, fpick(items));
    } else {
      run('resumeMap()');
    }
    await sleep(2);
    continue;
  }

  if (screen === 'screen-event') {
    const btns = [...doc.getElementById('event-choices').querySelectorAll('button:not(:disabled)')];
    if (btns.length) click(window, fpick(btns));
    await sleep(2);
    continue;
  }

  await sleep(5);
}

const { window, errors, run } = H;
const screen = activeScreen(window);
console.log(JSON.stringify({
  char: charId, seed, asc, steps, reloads,
  end: screen, floor: run('G ? G.floorNum : -1'), act: run('G ? G.act : -1'),
  hp: run('G ? G.hp : -1'), deck: run('G ? G.deck.length : -1'),
  relics: run('G ? G.relics.length : -1'),
  win: screen === 'screen-win', errors: errors.length,
}));
if (errors.length) {
  console.log('\nERRORS:\n' + [...new Set(errors)].slice(0, 5).join('\n---\n'));
  process.exit(1);
}
if (steps >= MAX_STEPS) { console.log('HIT STEP LIMIT'); process.exit(2); }
process.exit(0);
