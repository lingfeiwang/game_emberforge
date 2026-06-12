# Emberforge Depths

A roguelike deckbuilder in three acts. Descend the dead forge, master the **Heat**,
slay what beats at its heart.

A test for Claude Fable 5. [Play here.](https://lingfeiwang.github.io/misc/emberforge/)

- **3 playable characters** with exclusive card pools and mechanics
  - 🤖 **The Forgeborn** — Chain combos & Charge cards
  - 🧙 **The Cinderwitch** — Burn stacking, Ignite, blood sacrifice *(unlock: beat the Act I boss)*
  - 🦾 **The Scrapwright** — a deployable squad of Servos *(unlock: beat the Act II boss)*
- **114 cards**, 38 relics, 14 potions, 30+ enemies, **6 bosses** (2 per act, randomly chosen), 9 elites
- **10 Ascension levels** per character, unlocked by winning
- **Daily Climb** — a deterministic daily seed with a rotating character and modifiers
- **Seeded runs** — enter any seed; same seed = same map, shops, enemies and rewards
- 20 in-game **achievements**, lifetime **statistics**, card/relic **collection** browser
- **Autosave** at every room; quitting mid-combat restarts that combat
- Procedural **audio** (all SFX/ambience are synthesized at runtime — zero audio assets)
- Keyboard play: `1–9` cards, `E` end turn, `D` deck, `Esc` cancel/close

## The Heat system (the core hook)

There is no "energy". Every card adds Heat and **you are never blocked from playing a
card** — but every point of Heat over your Capacity sears you for 2 HP straight through
Block. The resource system *is* a push-your-luck mechanic, and several cards and relics
(Comet Driver, Reactive Shell, Heatsink Array, Soot Sponge…) deliberately reward
overheating on purpose.

## Run it

It's a zero-build static page: open `index.html` in any browser, or:

```bash
npx serve .            # any static server works
```

### Desktop (Electron)

```bash
npm install
npm start              # dev window
```

## Building binaries

`./build.sh` wraps electron-builder: it installs dependencies if needed, runs the
headless test suite, builds, and writes artifacts plus `SHA256SUMS.txt` into `dist/`.

```bash
./build.sh             # every target this host can produce
./build.sh --win       # Windows x64 — NSIS installer + zip
./build.sh --mac       # macOS universal (Intel + Apple Silicon) — dmg + zip
./build.sh --linux     # Linux — AppImage + zip
./build.sh --win --skip-tests --clean   # flags compose
```

What each host OS can build (an electron-builder constraint):

| host \ target | Windows | macOS | Linux |
|---------------|:-------:|:-----:|:-----:|
| Linux         | ✅      | ❌    | ✅    |
| macOS         | ✅      | ✅    | ✅    |
| Windows       | ✅      | ❌    | ❌    |

**macOS binaries require a macOS host** — there is no cross-compile path. If you
don't own a Mac, run `./build.sh --mac` on a macOS CI runner (e.g. GitHub Actions
`macos-latest`). On a Windows host, run the script from Git Bash or WSL.

Cross-building caveats the script handles for you:

- **No wine on Linux/macOS** → the Windows exe is built without custom icon/version
  metadata (`-c.win.signAndEditExecutable=false`), which is otherwise identical.
  Install wine to re-enable, or build on Windows.
- **Non-x64 Linux host** (e.g. ARM dev box) → the NSIS installer is skipped and only
  the Windows **zip** is produced (electron-builder's bundled `makensis` is x86-64
  only). The zip is all a Steam depot needs anyway — the installer is for direct
  distribution.
- **`Cannot find module 'dmg-license'` on macOS** → the dmg target needs this
  macOS-only package, which package managers sometimes skip (yarn, `--no-optional`,
  `node_modules` copied from another OS). It's declared in `optionalDependencies`
  (npm skips it automatically on Linux/Windows), and `build.sh` re-installs it on
  the fly if it's still missing — falling back to a zip-only mac build in the worst
  case.

Builds are unsigned by default so they always succeed locally
(`CSC_IDENTITY_AUTO_DISCOVERY=false`). For signed distribution, export your cert env
vars (see the header of `build.sh`) to enable it.

Low-level equivalents remain available: `npm run dist:win` / `dist:mac` / `dist:linux`.

## Testing

A headless jsdom harness (smoke tests, mechanics unit tests, and a random-agent fuzzer
that plays entire runs, including save/reload between acts) lives outside the shipped
files in `tests/` — run `npm test` (needs `npm install` for jsdom) or `npm run test:fuzz`.
Three suites: smoke (game loop), unit (mechanics, meta, saves), and burn-spread/enemy-phase
regression.

## Architecture notes

- No build system, no dependencies at runtime: 11 plain JS files loaded by `index.html`.
  Load order matters and is encoded in the HTML.
- All gameplay randomness flows through the seeded `RNG` in `js/util.js`
  (`rand/randf/pick/shuffle/chance`). `Math.random` is reserved for cosmetics.
  **Never** call `Math.random` in game logic or you break seeds/dailies.
- Saves: `EF_profile_v1` (meta) and `EF_run_v1` (run) in localStorage. The run is
  checkpointed *before* each room resolves (`pendingNode`), so reload replays the room
  identically (same RNG state). Reward screens checkpoint as `pendingReward` /
  `pendingBossReward`; shops serialize their stock.
- Combat engine hooks worth knowing: `award()` (achievements), `onEnemyDeath()`,
  `enemyAttackDmg()` (the *only* place enemy damage is computed — intent preview and
  resolution share it), `dur()` (all animation timing, respects the speed setting,
  `0` in headless tests).
