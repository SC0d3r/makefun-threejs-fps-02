// The one mutable game state. main.js owns it; every system receives it and mutates in place.
import * as THREE from 'three';
import { ECONOMY, MAP, PLAYER, ROUND, WEAPONS } from './config.js';
import { mulberry32 } from './util.js';

export function createState(seed = 1) {
  const mags = {};
  const reserves = {};
  for (const id of Object.keys(WEAPONS)) {
    mags[id] = WEAPONS[id].mag;
    reserves[id] = WEAPONS[id].reserve;
  }

  return {
    seed,
    rng: mulberry32(seed),
    mode: 'start',
    paused: true,
    shot: null,
    shotFrame: 0,
    cameraOverride: null,
    time: 0,
    round: 1,
    roundClock: ROUND.liveSeconds,
    score: { you: 0, rust: 0 },
    money: ECONOMY.startMoney,
    player: {
      pos: new THREE.Vector3(MAP.attackerSpawn.x, MAP.attackerSpawn.y, MAP.attackerSpawn.z),
      vel: new THREE.Vector3(),
      yaw: 0,
      pitch: 0,
      height: PLAYER.standHeight,
      eye: PLAYER.standEye,
      crouched: false,
      walking: false,
      grounded: true,
      health: 100,
      armor: 0,
      groundSpeed: 0,
      bob: 0,
      bobAmount: 0,
      recoilPitch: 0,
      recoilYaw: 0,
      recoilPitchVel: 0,
      recoilYawVel: 0,
      lookX: 0,
      lookY: 0,
      damageFlash: 0,
      damageYaw: 0,
      dead: false,
    },
    weapon: {
      current: 'longshore',
      primary: 'longshore',
      secondary: 'marlin',
      mags,
      reserves,
      owned: { marlin: true, longshore: true, kestrel: false, breakwater: false },
      reloading: false,
      reloadLeft: 0,
      cooldown: 0,
      spread: 0,
      bloom: 0,
    },
    bots: [],
    targets: [],
    effects: {
      hitmarker: 0,
      damage: 0,
      damageYaw: 0,
      feedSerial: 0,
      feed: [
        { id: 0, text: '', headshot: false, life: 0 },
        { id: 0, text: '', headshot: false, life: 0 },
        { id: 0, text: '', headshot: false, life: 0 },
      ],
    },
    stats: { kills: 0, plants: 0, deaths: 0, shots: 0, hits: 0 },
    settings: { sensitivity: 0.0022, fov: 75 },
    hud: { prompt: '', locked: false, bombState: 'CHARGE CARRIED' },
  };
}
