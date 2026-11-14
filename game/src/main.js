// Boot, fixed-step simulation, render copy pass, pointer lock and shot dispatch.
// Import order is deliberate: match layer first, presentation last.
import * as config from './config.js';
import { createState } from './state.js';
import { createInput } from './input.js';
import * as util from './util.js';
import { createNav } from './nav.js';
import { createBots } from './bots.js';
import { createRounds } from './rounds.js';
import { createMap } from './map.js';
import { createPlayer } from './player.js';
import { createWeapon } from './weapon.js';
import { createEffects } from './effects.js';
import { createHud } from './hud.js';
import { createAudio } from './audio.js';
import { createShot } from './shot.js';
import * as THREE from 'three';

const params = new URLSearchParams(location.search);
const shotName = params.get('shot');
const seed = Number(params.get('seed') ?? '1') || 1;
const state = createState(seed);
const app = document.getElementById('app');
const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.35;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFShadowMap;
app.appendChild(renderer.domElement);
renderer.domElement.setAttribute('aria-label', 'QUAY 9 first-person harbour');

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.05, Math.hypot(config.MAP.maxX * 2, config.MAP.maxZ * 2) + 60);
scene.add(camera);

const input = createInput(renderer.domElement);
const effects = createEffects(state, scene);
const audio = createAudio();
state.audio = audio;
createMap(state, scene);
const player = createPlayer(state, camera, input);
const weapon = createWeapon(state, camera, scene, effects, audio, player, input);
let rounds = null;
const hud = createHud(state, {
  onBuy: (item) => {
    if (!rounds || !rounds.buy(item)) return;
    audio.start();
    state.paused = false;
    input.requestLock();
  },
  onDeploy: () => startMatch(),
  onCloseBuy: () => {
    if (!rounds) return;
    audio.start();
    rounds.closeBuy();
    state.paused = false;
    input.requestLock();
  },
  onRestart: () => {
    if (!rounds) return;
    audio.start();
    rounds.restart();
    state.paused = false;
  },
  onResume: () => {
    audio.start();
    state.paused = false;
    input.requestLock();
  },
});
const nav = createNav(state);
const bots = createBots(state, scene, nav, audio, effects, player);
state.botAPI = bots;
rounds = createRounds(state, scene, effects, audio, player, weapon, bots);
state.inputRef = input;

function startMatch() {
  audio.start();
  rounds.startMatch();
  state.paused = false;
  hud.updateBuyReady();
}

const STEP = 1 / 60;
let lastTime = performance.now();
let accumulator = 0;

function stepFixed(dt) {
  if (state.shotFrozen) return;
  state.time += dt;
  if (state.round.phase === 'buy' && input.pressed('KeyB')) {
    rounds.toggleBuy();
    if (!state.flags.buyOpen) {
      state.paused = false;
      input.requestLock();
    }
  }
  player.update(dt);
  weapon.update(dt);
  weapon.updateGrenades(dt);
  bots.update(dt);
  rounds.update(dt);
  rounds.updateBombIdle();
  effects.update(dt);
  state.crosshairGap = weapon.currentSpread();
  hud.update(dt);
  input.endStep();
}

function renderFrame() {
  player.syncCamera(state.time);
  renderer.render(scene, camera);
}

function frame(now) {
  requestAnimationFrame(frame);
  if (state.shotFrozen) return;
  const raw = (now - lastTime) / 1000;
  lastTime = now;
  const dt = util.clamp(raw, 0, 0.1);
  if (!state.paused) {
    accumulator += dt;
    let steps = 0;
    while (accumulator >= STEP && steps < 5) {
      stepFixed(STEP);
      accumulator -= STEP;
      steps += 1;
    }
  } else {
    accumulator = 0;
    hud.update(0);
    input.endStep();
  }
  if (input.locked && (state.flags.roundEnd || state.flags.matchEnd || state.flags.startOpen || state.flags.buyOpen)) {
    input.releaseLock();
  }
  renderFrame();
}

input.onLock(() => {
  state.paused = false;
  audio.resume();
});
input.onUnlock(() => {
  if (state.shotMode) return;
  if (state.mode === 'playing' && !state.flags.buyOpen && !state.flags.roundEnd && !state.flags.matchEnd && !state.flags.startOpen) {
    state.paused = true;
  }
});

renderer.domElement.addEventListener('click', () => {
  if (state.shotMode || state.mode !== 'playing' || state.flags.buyOpen || state.flags.roundEnd || state.flags.matchEnd) return;
  if (!input.locked) {
    state.paused = false;
    audio.start();
    input.requestLock();
  }
});
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});
document.addEventListener('visibilitychange', () => {
  if (document.hidden && state.mode === 'playing' && !state.shotMode) state.paused = true;
});

hud.update(0);

if (shotName && ['cover', 'firefight', 'plant', 'buy'].includes(shotName)) {
  state.shotMode = true;
  state.flags.startOpen = false;
  state.mode = 'playing';
  input.setEnabled(false);
  const shot = createShot(state, scene, camera, player, weapon, bots, rounds, effects, hud, stepFixed);
  shot.enter(shotName);
  hud.update(0);
  renderFrame();
  requestAnimationFrame(() => {
    renderFrame();
    state.shotFrozen = true;
    window.__shotReady = true;
  });
} else {
  window.__shotReady = false;
  requestAnimationFrame(frame);
}
