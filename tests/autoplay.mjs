/* Random-agent full-run fuzzer: plays whole runs, reports errors/stalls */
import { boot, click, sleep, activeScreen } from './harness.mjs';

const charId = process.argv[2] || 'forgeborn';
const seed = process.argv[3] || 'FUZZ-1';
const asc = +(process.argv[4] || 0);
const verbose = process.argv.includes('-v');

let rngS = 12345;
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

const { window, errors, run } = await boot({ storage: { EF_profile_v1: JSON.stringify(profile) } });
const doc = window.document;

run(`newRun({character:'${charId}', ascension:${asc}, seedStr:'${seed}'})`);

let steps = 0, lastProgress = '';
let stall = 0;
const MAX_STEPS = 6000;

function visibleButtons(root) {
  return [...root.querySelectorAll('button:not(:disabled)')].filter(b => b.offsetParent !== null || true);
}

while (steps++ < MAX_STEPS) {
  if (errors.length) break;
  const screen = activeScreen(window);
  const overlay = doc.getElementById('overlay').classList.contains('active');
  const sig = screen + '|' + overlay + '|' + run('G ? G.floorNum+":"+(G.inCombat?G.combatTurn:"-")+":"+(G.hand?G.hand.length:0)+":"+G.hp : "noG"');
  if (sig === lastProgress) stall++; else { stall = 0; lastProgress = sig; }
  if (stall > 700) { console.log('STALL at', sig); break; }

  if (screen === 'screen-gameover' || screen === 'screen-win') break;

  if (overlay) {
    const panel = doc.getElementById('overlay-panel');
    const cards = [...panel.querySelectorAll('.reward-card, .relic-choice, .deck-list .card')];
    const btns = visibleButtons(panel);
    const choices = [...cards, ...btns];
    if (choices.length) click(window, fpick(choices));
    await sleep(2);
    continue;
  }

  if (screen === 'screen-map') {
    const nodes = [...doc.querySelectorAll('#mapsvg .mnode-avail')];
    if (nodes.length) click(window, fpick(nodes));
    await sleep(5);
    continue;
  }

  if (screen === 'screen-combat') {
    if (!run('G.inCombat')) { await sleep(10); continue; }
    if (!run('G.playerTurn')) { await sleep(5); continue; }
    const hand = [...doc.querySelectorAll('#hand .card')];
    // 80%: try to play a random card; 20% or empty hand: end turn
    if (hand.length && frand() < 0.85) {
      const c = fpick(hand);
      click(window, c);
      await sleep(2);
      if (run('selectedCard !== null')) {
        const tg = [...doc.querySelectorAll('.enemy.targetable')];
        if (tg.length && frand() < 0.9) click(window, fpick(tg));
        else click(window, c); // cancel
        await sleep(2);
      }
    } else {
      run('endTurn()');
      await sleep(10);
    }
    // occasionally quaff a potion
    if (frand() < 0.04) {
      const po = [...doc.querySelectorAll('#potionbar .potion:not(.empty)')];
      if (po.length) { click(window, fpick(po)); await sleep(2); }
    }
    continue;
  }

  if (screen === 'screen-rest') {
    click(window, fpick([...doc.querySelectorAll('#screen-rest .room-card')]));
    await sleep(2);
    continue;
  }

  if (screen === 'screen-shop') {
    if (frand() < 0.5) {
      const items = [...doc.querySelectorAll('#shop-items .shop-cell')];
      if (items.length) click(window, fpick(items));
    } else {
      run('resumeMap()');
    }
    await sleep(2);
    continue;
  }

  if (screen === 'screen-event') {
    const btns = visibleButtons(doc.getElementById('event-choices'));
    if (btns.length) click(window, fpick(btns));
    await sleep(2);
    continue;
  }

  await sleep(5);
}

const screen = activeScreen(window);
const result = {
  char: charId, seed, asc, steps,
  end: screen,
  floor: run('G ? G.floorNum : -1'),
  act: run('G ? G.act : -1'),
  hp: run('G ? G.hp : -1'),
  deck: run('G ? G.deck.length : -1'),
  win: screen === 'screen-win',
  errors: errors.length,
};
console.log(JSON.stringify(result));
if (errors.length) {
  console.log('\nERRORS:');
  console.log([...new Set(errors)].slice(0, 5).join('\n---\n'));
  process.exit(1);
}
if (steps >= MAX_STEPS) { console.log('HIT STEP LIMIT (possible stall)'); process.exit(2); }
process.exit(0);
