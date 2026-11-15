// One mutable state object. Every module receives it and nobody else owns game
// state, which keeps fixed-step simulation and HUD reads on the same numbers.
import { ECONOMY, MAP, ROUND, WEAPONS } from './config.js';

function freshAmmo() {
  return {
    pistol: { mag: WEAPONS.pistol.mag, reserve: WEAPONS.pistol.reserve },
    smg: { mag: WEAPONS.smg.mag, reserve: WEAPONS.smg.reserve },
    rifle: { mag: WEAPONS.rifle.mag, reserve: WEAPONS.rifle.reserve },
    shotgun: { mag: WEAPONS.shotgun.mag, reserve: WEAPONS.shotgun.reserve },
  };
}

export function createState() {
  return {
    mode: 'start',          // start | buy | live | planted | ended | matchEnd
    started: false,
    paused: false,
    shot: null,
    shotFrozen: false,
    shotFrames: 0,
    round: 1,
    scoreYou: 0,
    scoreRust: 0,
    clock: ROUND.live,
    buyClock: ROUND.buy,
    endClock: 0,
    matchResult: '',
    money: ECONOMY.start,
    health: 100,
    armor: 0,
    alive: true,
    primary: null,
    weapon: 'pistol',
    grenade: null,
    grenades: { frag: 0, flash: 0 },
    ammo: freshAmmo(),
    reload: 0,
    reloadTotal: 0,
    switchTimer: 0,
    shotTimer: 0,
    consecutive: 0,
    consecutiveTimer: 0,
    spread: 0,
    muzzle: 0,
    hitmarker: 0,
    damageFlash: 0,
    shake: 0,
    flash: 0,
    kills: 0,
    plants: 0,
    shots: 0,
    hits: 0,
    player: {
      x: MAP.playerSpawn.x, y: 0, z: MAP.playerSpawn.z,
      vx: 0, vy: 0, vz: 0, onGround: true, crouch: false, speed: 0,
    },
    yaw: 0,
    pitch: 0,
    recoilPitch: 0,
    recoilYaw: 0,
    bob: 0,
    bobPhase: 0,
    plant: { time: 0, site: null, active: false },
    bomb: { active: false, planted: false, x: 0, z: 0, fuse: 0, defuse: 0, defusing: false, defuserId: -1, beep: 0, led: 0 },
    buyOpen: false,
    overlay: 'start',
    hoverCard: 0,
    feed: [],
    feedVersion: 0,
    calloutText: '',
    calloutTime: 0,
    promptText: '',
    promptTime: 0,
    time: 0,
    step: 0,
    lastHealth: 100,
  };
}
