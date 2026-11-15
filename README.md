# QUAY 9

**Hold the tide. Plant the charge.**

QUAY 9 is an original night-harbour tactical FPS built with three.js 0.187.0. You are TIDE, a
solo attacker on a decommissioned tidal drydock. Three RUST security bots hold the A dry dock and
the B warehouse while you push a charge into one of the sites.

Phase 1 built the map, movement, collision, hitscan gunplay, viewmodels, effects, HUD and render
loop. Phase 2 adds the full match: nav-grid bots with sight and sound, the round and bomb state
machine, the buy economy, grenades, procedural WebAudio and the staged screenshot scenes. Phase 3
is a correctness and polish pass over the whole entry: one state object, a fixed simulation step,
pooled effects, a real buy loop and deterministic shot staging.

## Controls

| Input | Action |
| --- | --- |
| Mouse | Look (pointer lock) |
| WASD | Move |
| Shift | Walk |
| Ctrl | Crouch |
| Space | Jump |
| Left mouse | Fire |
| R | Reload |
| 1 / 2 | Sidearm / primary |
| 3 / 4 | Frag / flash charge |
| G | Throw the selected grenade |
| B | Open or close the buy menu (buy phase only) |
| E | Hold to plant at A or B; RUST bots defuse on their own |
| Esc | Release pointer lock / pause |

Weapons are the Marlin .45 sidearm (free), Kestrel SMG ($1250), Longshore AR ($2700) and
Breakwater 12g ($1800). Armor costs $650, a frag $300 and a flash $200. Everyone starts each
match with $1900. A round win pays $3000, a loss $1900, a kill $300 and a plant $300, capped at
$9000. Buy phase is 12 seconds; the live round is 105 seconds; the fuse is 40 seconds.

The first to five round wins takes the match. RUST.WARDEN and RUST.SABLE hold A and B with
SMGs, and RUST.CUTTER patrols mid with the rifle. They hear footsteps and gunfire, search the
last known position, and defuse a planted charge if they reach it.

## Serve locally

The game is static files and needs no build step or network access:

```sh
node serve.ts --port 8080
```

Open <http://127.0.0.1:8080/>. The page loads three.js through the single import map in
`game/index.html`:

```json
{"imports":{"three":"./vendor/three/three.module.min.js"}}
```

The vendored `game/vendor/three/three.module.min.js` and `three.core.min.js` are unchanged from
three.js 0.187.0.

## Build the hand-in

`main.ts` uses only the Node 22 standard library. It checks that `game/index.html` and both
vendored three.js files exist, copies `game/` and `screenshots/` into the output directory, and
writes `dossier.json` with the vendored make.fun `buildDossier` helper. Screenshot bytes are
embedded as SHA-256-tagged JPEG/PNG entries; source text excludes `game/vendor/`.

```sh
MAKEFUN_OUTPUT_DIR=out node main.ts
```

The default output directory outside the local harness is `/output`, matching the grader.

## Screenshot scenes

The game accepts `?shot=<name>&seed=<n>` and freezes a deterministic frame. The harness captures
these four, listed in `shots.json`:

| File | Query | Scene |
| --- | --- | --- |
| `1-cover.jpg` | `?shot=cover&seed=1` | Planted charge at A, two RUST defenders closing in |
| `2-firefight.jpg` | `?shot=firefight&seed=1` | Mid-catwalk rifle fight, tracer and muzzle flash |
| `3-plant.jpg` | `?shot=plant&seed=1` | Crouched mid-plant at A, progress at 64% |
| `4-buy.jpg` | `?shot=buy&seed=1` | Buy phase with the Longshore AR card focused |

Each scene calls the real `spawnRound()`, `startBuyPhase()`, `startLive()`, `completePlant()` or
`stageCharge()` path, sets the player pose and score inputs, then freezes simulation before the
first render. One zero-time weapon tick exposes the viewmodel and muzzle flash. No timers,
particles or random values continue after that point, so a seed always produces the same frame.
The buy frame keeps the live `buyClock`, real card states and a real `startBuyPhase()` result.
After two rendered frames the page sets `window.__shotReady = true` for the capture harness.

## Layout

```text
game/index.html       HUD DOM and CSS, buy cards, overlays, import map
game/src/config.js    palette, weapon/grenade/economy tables, bot roles, map constants
game/src/state.js     the single mutable state object
game/src/input.js     keyboard, mouse, pointer lock, per-step edges
game/src/util.js      math, seeded RNG, scratch vectors, ray/AABB helpers
game/src/nav.js       nav grid, A*, line-of-sight smoothing
game/src/bots.js      RUST bodies, perception, patrol/combat/defuse
game/src/rounds.js    round machine, bomb, economy, buy list, prompts
game/src/map.js       Quay 9 geometry, generated textures, lights, colliders
game/src/player.js    movement, collision, crouch, camera, damage, shake
game/src/weapon.js    hitscan, pellets, recoil, reload, viewmodels, grenades
game/src/effects.js   pooled tracers, sparks, shells, explosions, flashes
game/src/hud.js       readouts, crosshair, hitmarker, feed, overlays, buy states
game/src/audio.js     procedural WebAudio bank with a silent fallback
game/src/shot.js      deterministic cover/firefight/plant/buy staging
game/src/main.js      boot, fixed-step loop, pointer lock, shot dispatch
main.ts               copy + dossier build
serve.ts              local static server
shots.json            the four capture definitions
```

The simulation runs at a fixed 60 Hz; rendering only copies state into the camera and renderer and
counts the two-shot-ready frames. All transient effects are preallocated at boot, textures are
generated once from a seeded RNG, and the HUD caches its DOM writes. There are no external assets,
fonts or network requests.

## Verification

- All 15 `game/src/*.js` modules pass `node --input-type=module --check`.
- `game/` holds 19 files (23 entries) and 2.3 MiB; `game/index.html` is 12,818 bytes.
- Index plus modules is 136,341 bytes of source; dossier text is 137,692 bytes, under the
  163,840-byte cap.
- `MAKEFUN_OUTPUT_DIR=out node main.ts` writes a 609,479-byte canonical `dossier.json` with four
  SHA-256-tagged screenshots and no vendored three.js text.
- A port-8093 smoke test returns 200 for `/`, `src/main.js`, `src/bots.js`, `src/rounds.js`,
  `src/shot.js` and `vendor/three/three.module.min.js`.

