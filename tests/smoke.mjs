import { boot, click, sleep, activeScreen } from './harness.mjs';

const { window, errors, run } = await boot();
const fail = (msg) => { console.log('FAIL:', msg); if(errors.length) console.log(errors.slice(0,3).join('\n')); process.exit(1); };

if (errors.length) fail('boot errors');
if (activeScreen(window) !== 'screen-title') fail('not on title: ' + activeScreen(window));
console.log('✓ boot, title screen');

// settings → instant speed for tests
run('SETTINGS.speed = "instant"; saveProfile();');

// character select
run('openCharSelect()');
if (activeScreen(window) !== 'screen-charselect') fail('charselect');
const chars = window.document.querySelectorAll('.char-card');
console.log('✓ char select,', chars.length, 'characters,', window.document.querySelectorAll('.char-card.locked').length, 'locked');

// embark as forgeborn with fixed seed
window.document.getElementById('seed-input').value = 'TEST-SEED-1';
run('embark()');
if (activeScreen(window) !== 'screen-map') fail('map after embark');
console.log('✓ new run started, seed:', run('G.seedStr'), 'char:', run('G.character'));

// enter first node (always a fight)
const node = window.document.querySelector('#mapsvg .mnode-avail');
click(window, node);
await sleep(50);
if (activeScreen(window) !== 'screen-combat') fail('combat after node: ' + activeScreen(window));
console.log('✓ combat started vs', run('G.enemies.map(e=>e.name).join(", ")'), '| hand:', run('G.hand.length'));

// save should exist with pendingNode
const save = JSON.parse(run('localStorage.getItem("EF_run_v1")'));
if (!save || !save.pendingNode) fail('no pendingNode save');
console.log('✓ autosave with pendingNode:', save.pendingNode);

// play all playable cards then end turn, repeat until combat ends or 20 turns
let guard = 0;
while (run('G.inCombat') && guard++ < 40) {
  // play first playable, non-warned card; resolve targeting by clicking first enemy
  let played = true;
  let cguard = 0;
  while (played && run('G.inCombat') && cguard++ < 20) {
    played = false;
    const cards = window.document.querySelectorAll('#hand .card:not(.unplayable-warn)');
    for (const c of cards) {
      const before = run('G.cardsPlayedThisTurn');
      click(window, c);
      await sleep(5);
      if (run('selectedCard !== null')) {
        const en = window.document.querySelector('.enemy.targetable');
        if (en) { click(window, en); await sleep(5); }
      }
      if (run('G.cardsPlayedThisTurn') > before) { played = true; break; }
    }
  }
  if (!run('G.inCombat')) break;
  run('endTurn()');
  await sleep(120);
}
console.log('✓ combat finished after', run('G.combatTurn'), 'turns | hp:', run('G.hp'), '| inCombat:', run('G.inCombat'));
await sleep(100);

// reward overlay should be up; pick first card
const reward = window.document.querySelector('#overlay-panel .reward-card');
if (reward) { click(window, reward); await sleep(20); }
if (activeScreen(window) !== 'screen-map') fail('not back on map: ' + activeScreen(window));
console.log('✓ reward claimed, deck now', run('G.deck.length'), 'cards | gold:', run('G.gold'));

// save no longer pending
const save2 = JSON.parse(run('localStorage.getItem("EF_run_v1")'));
if (save2.pendingNode) fail('pendingNode should be cleared');
console.log('✓ checkpoint cleared after map return');

if (errors.length) fail('runtime errors during play');
console.log('\nALL SMOKE TESTS PASSED');
process.exit(0);
