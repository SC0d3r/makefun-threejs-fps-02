import * as THREE from 'three';
// Boot, fixed-step simulation and the two-pass render. Order matters: config,
// state, input, util, nav, bots, rounds, map, player, weapon, effects, HUD,
// audio, shot — the dossier then reads match logic before presentation.
import { PALETTE } from './config.js';
import { createState } from './state.js';
import { createInput } from './input.js';
import { clamp } from './util.js';
import { createNav } from './nav.js';
import { createBots } from './bots.js';
import { createRounds } from './rounds.js';
import { createMap } from './map.js';
import { createPlayer } from './player.js';
import { createWeapon } from './weapon.js';
import { createEffects } from './effects.js';
import { createHud } from './hud.js';
import { createAudio } from './audio.js';
import { createShot, readShot } from './shot.js';

const FIXED = 1 / 60;
const state = createState();
const canvas = document.getElementById('view');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.15;
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.autoClear = false;

const scene = new THREE.Scene();
scene.background = new THREE.Color(PALETTE.night);
scene.fog = new THREE.Fog(PALETTE.deep, 18, 80);
const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.05, 120);

const vmScene = new THREE.Scene();
const vmCamera = new THREE.PerspectiveCamera(50, window.innerWidth / window.innerHeight, 0.01, 5);
vmScene.add(new THREE.HemisphereLight(0x8fb6d0, 0x1a2028, 1.5));
const vmKey = new THREE.DirectionalLight(0xffd2a0, 2.4);
vmKey.position.set(1.2, 2, 1.4);
vmScene.add(vmKey);
const vmFill = new THREE.DirectionalLight(PALETTE.cyan, 0.8);
vmFill.position.set(-1.2, 0.4, 0.6);
vmScene.add(vmFill);

const map = createMap(scene, renderer.capabilities.getMaxAnisotropy());
const nav = createNav(map);
const effects = createEffects(scene);
const audio = createAudio();
const hud = createHud(state);
const input = createInput(state, canvas, () => hud.setOverlay('pause'));
const player = createPlayer(state, camera, map, input, audio);
const bots = createBots(state, scene, map, nav, player, hud, audio, effects);
const weapon = createWeapon(state, scene, vmScene, map, bots, player, effects, audio, hud, input);
const rounds = createRounds(state, scene, map, player, bots, weapon, hud, audio, effects, input);
const shooter = createShot(state, { player, weapon, bots, rounds, hud });

function deploy() {
  audio.enable();
  state.started = true;
  state.paused = false;
  rounds.startMatch();
}

function resume() {
  state.paused = false;
  if (state.mode === 'buy' && state.buyOpen) {
    hud.setOverlay('buy');
    input.unlock();
    return;
  }
  hud.setOverlay(null);
  input.lock();
}

hud.bind({
  onDeploy: deploy,
  onBuy: (id) => rounds.buy(id),
  onRestart: () => { state.paused = false; rounds.restartMatch(); },
  onResume: resume,
});

function step() {
  state.time += FIXED;
  state.step += 1;
  state.hitmarker = Math.max(0, state.hitmarker - FIXED * 4.5);
  state.damageFlash = Math.max(0, state.damageFlash - FIXED * 1.3);
  state.shake = Math.max(0, state.shake - FIXED * 1.8);
  state.calloutTime = Math.max(0, state.calloutTime - FIXED);
  state.promptTime = Math.max(0, state.promptTime - FIXED);
  player.update(FIXED);
  weapon.update(FIXED);
  if (state.mode === 'live' || state.mode === 'planted') bots.update(FIXED);
  rounds.update(FIXED);
  effects.update(FIXED);
  input.endStep();
}

function render() {
  player.applyCamera();
  hud.update(FIXED);
  renderer.clear(true, true, true);
  renderer.render(scene, camera);
  renderer.clearDepth();
  renderer.render(vmScene, vmCamera);
  if (state.shotFrozen) {
    state.shotFrames += 1;
    if (state.shotFrames >= 2) window.__shotReady = true;
  }
}

let last = performance.now() / 1000;
let accumulator = 0;

function frame(now) {
  const dt = clamp(now / 1000 - last, 0, 0.1);
  last = now / 1000;
  if (!state.shot && !state.paused && state.started) {
    accumulator += dt;
    let steps = 0;
    while (accumulator >= FIXED && steps < 5) {
      step();
      accumulator -= FIXED;
      steps += 1;
    }
    if (steps === 5) accumulator = 0;
  } else {
    input.flushMouse();
    accumulator = 0;
  }
  render();
  requestAnimationFrame(frame);
}

function resize() {
  const width = window.innerWidth;
  const height = window.innerHeight;
  renderer.setSize(width, height);
  camera.aspect = width / height;
  camera.updateProjectionMatrix();
  vmCamera.aspect = width / height;
  vmCamera.updateProjectionMatrix();
}
window.addEventListener('resize', resize);

const shotMode = readShot();
if (shotMode) {
  shooter.stageShot(shotMode);
} else {
  hud.setOverlay('start');
  state.mode = 'start';
}
window.addEventListener('pointerdown', () => audio.enable(), { once: true });
window.addEventListener('keydown', () => audio.enable(), { once: true });
window.__shotReady = false;
requestAnimationFrame(frame);
