# QUAY 9

**Hold the tide. Plant the charge.**

QUAY 9 is an original night-harbour tactical FPS built with three.js 0.187.0. The player is
TIDE, a solo attacker on a decommissioned tidal drydock. The full match pits TIDE against three
RUST security defenders over the A dry dock and the B warehouse. Phase 1 delivers the complete
core: the map, movement, collision, hitscan gunplay, viewmodels, effects, HUD and render loop.
Bots, the bomb round loop and the buy economy follow in Phase 2.

## Controls

| Input | Action |
| --- | --- |
| Mouse | Look (pointer lock) |
| WASD | Move |
| Shift | Walk |
| C or Ctrl | Crouch |
| Space | Jump |
| Left mouse | Fire |
| R | Reload |
| 1 / 2 | Primary / sidearm |
| E | Plant (Phase 2) |
| G | Grenade (Phase 2) |
| B | Buy menu (Phase 2) |
| Esc | Release pointer lock / pause |

The Phase 1 loadout starts with the Longshore AR and the Marlin .45. The Kestrel SMG and
Breakwater 12g are fully defined and can be equipped by code; buying them arrives with the
economy in Phase 2. Three static RUST target dummies stand behind the defender spawn doors so
gunplay, headshots, hitmarkers, tracers and the kill feed can be tested immediately.

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
writes `dossier.json` with the vendored make.fun `buildDossier` helper.

```sh
MAKEFUN_OUTPUT_DIR=out node main.ts
```

The default output directory outside the local harness is `/output`, matching the grader. Do not
push from the build.

## Layout

```text
game/index.html       HUD DOM and CSS, import map, data-URI favicon
game/src/config.js    palette, materials, weapon table, economy, map constants
game/src/util.js      math, seeded RNG, scratch vectors, ray/AABB helpers
game/src/state.js     the single mutable state object
game/src/input.js     keyboard, mouse, pointer lock
game/src/map.js       Quay 9 geometry, textures, lights, colliders, shootables
game/src/player.js    movement, collision, crouch, camera, recoil
game/src/weapon.js    hitscan, reload, spread, viewmodels
game/src/effects.js   pooled tracers, sparks, shells, muzzle flash
game/src/hud.js       readouts, crosshair, hitmarker, feed, overlays, buy cards
game/src/main.js      boot, fixed-step loop, pointer lock, target dummies
main.ts               copy + dossier build
serve.ts              local static server
```

The simulation runs at a fixed 60 Hz; rendering only copies state into the camera and renderer.
All transient effects are preallocated at boot, and the HUD caches its DOM writes.

## Deferred to Phase 2

- Nav grid, A* pathing, patrols and bot perception/combat
- Round state machine, bomb plant/defuse, score and economy
- Buy menu purchasing, grenades and audio
- Full HUD round/match overlays and the `plant` / `buy` screenshot scenes
