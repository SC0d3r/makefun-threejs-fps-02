// QUAY 9 boot and loop. main.js owns the single state object; simulation is fixed at 60 Hz and
// render only copies that state into the camera and renderer.
import * as THREE from 'three';
import { PALETTE } from './config.js';
import { createEffects } from './effects.js';
import { createHud } from './hud.js';
import { createInput } from './input.js';
import { createMap } from './map.js';
import { createPlayer } from './player.js';
import { createState } from './state.js';
import { createWeapon } from './weapon.js';

const STEP = 1 / 60;
const DUMMY_BOX = new THREE.BoxGeometry(1, 1, 1);
const params = new URLSearchParams(location.search);
const seed = Number.parseInt(params.get('seed') || '1', 10) || 1;
window.__shotReady = false;

const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.15;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFShadowMap;
renderer.domElement.tabIndex = 0;
document.body.prepend(renderer.domElement);

const scene = new THREE.Scene();
const state = createState(seed);
const camera = new THREE.PerspectiveCamera(
  state.settings.fov,
  window.innerWidth / window.innerHeight,
  0.035,
  200,
);
scene.add(camera);

const map = createMap(scene);
const effects = createEffects(scene);
const player = createPlayer(state, map, camera);
const hud = createHud(state);

let promptTimer = 0;
function showPrompt(text, seconds) {
  hud.setPrompt(text);
  promptTimer = seconds;
}

function handleLockChange(locked) {
  state.hud.locked = locked;
  if (state.shot) return;
  if (locked) {
    state.paused = false;
    hud.setOverlay('none');
  } else if (state.mode === 'live') {
    state.paused = true;
    hud.setOverlay('pause');
  }
}

const input = createInput(renderer.domElement, handleLockChange);

// Three static targets behind the defender doors give the Phase 1 gunplay a real head/body test.
function createDummies() {
  const names = ['RUST.WARDEN', 'RUST.CUTTER', 'RUST.TALLY'];
  for (let i = 0; i < map.spawns.defenderMarkers.length; i++) {
    const marker = map.spawns.defenderMarkers[i];
    const group = new THREE.Group();
    group.position.set(marker.x, 0, marker.z);
    scene.add(group);

    const vest = new THREE.MeshStandardMaterial({
      color: PALETTE.rust,
      emissive: PALETTE.danger,
      emissiveIntensity: 0,
      roughness: 0.72,
      metalness: 0.18,
    });
    const dark = new THREE.MeshStandardMaterial({
      color: 0x1b2228,
      emissive: PALETTE.danger,
      emissiveIntensity: 0,
      roughness: 0.82,
      metalness: 0.12,
    });
    const helmet = new THREE.MeshStandardMaterial({
      color: PALETTE.steel,
      emissive: PALETTE.danger,
      emissiveIntensity: 0,
      roughness: 0.5,
      metalness: 0.5,
    });
    const visor = new THREE.MeshStandardMaterial({
      color: PALETTE.cyan,
      emissive: PALETTE.cyan,
      emissiveIntensity: 0.8,
      roughness: 0.35,
      metalness: 0.3,
    });

    const target = {
      name: names[i],
      group,
      health: 100,
      dead: false,
      deathTimer: 0,
      flash: 0,
      parts: [],
      materials: [vest, dark, helmet],
      baseX: marker.x,
      baseZ: marker.z,
    };

    function addPart(w, h, d, cx, cy, cz, material, part, shootable) {
      const mesh = new THREE.Mesh(DUMMY_BOX, material);
      mesh.scale.set(w, h, d);
      mesh.position.set(cx, cy, cz);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      group.add(mesh);
      if (shootable) {
        const entry = {
          min: new THREE.Vector3(),
          max: new THREE.Vector3(),
          kind: 'dummy',
          part,
          target,
          impact: 'flesh',
        };
        target.parts.push({ entry, w, h, d, cx, cy, cz });
        map.shootables.push(entry);
      }
    }

    addPart(0.46, 0.72, 0.3, 0, 0.36, 0, dark, 'leg', true);
    addPart(0.62, 0.67, 0.34, 0, 1.055, 0, dark, 'body', true);
    addPart(0.3, 0.33, 0.3, 0, 1.555, 0, dark, 'head', true);
    addPart(0.66, 0.38, 0.38, 0, 1.1, 0, vest, 'body', false);
    addPart(0.36, 0.16, 0.36, 0, 1.66, 0, helmet, 'head', false);
    addPart(0.14, 0.5, 0.18, -0.4, 1.06, 0, dark, 'arm', false);
    addPart(0.14, 0.5, 0.18, 0.4, 1.06, 0, dark, 'arm', false);
    addPart(0.1, 0.1, 0.46, 0.28, 1.0, -0.25, dark, 'gun', false);
    addPart(0.2, 0.08, 0.1, 0, 1.67, -0.16, visor, 'visor', false);

    updateDummyBounds(target);
    state.targets.push(target);
  }
}

function updateDummyBounds(target) {
  for (const part of target.parts) {
    part.entry.min.set(
      target.baseX + part.cx - part.w / 2,
      part.cy - part.h / 2,
      target.baseZ + part.cz - part.d / 2,
    );
    part.entry.max.set(
      target.baseX + part.cx + part.w / 2,
      part.cy + part.h / 2,
      target.baseZ + part.cz + part.d / 2,
    );
  }
}

function placeDummy(target, x, z) {
  target.baseX = x;
  target.baseZ = z;
  target.group.position.set(x, 0, z);
  target.group.rotation.set(0, 0, 0);
  target.group.visible = true;
  target.health = 100;
  target.dead = false;
  target.deathTimer = 0;
  target.flash = 0;
  for (const part of target.parts) part.entry.disabled = false;
  updateDummyBounds(target);
}

createDummies();

const weapon = createWeapon(state, camera, map, effects, input, {
  onHit(headshot) {
    hud.hitmarker(headshot);
  },
  onKill(headshot, target) {
    state.stats.kills++;
    for (const part of target.parts) part.entry.disabled = true;
    hud.hitmarker(headshot);
    hud.pushKill(`YOU > ${target.name}`, headshot);
  },
  onDry() {
    showPrompt('MAG EMPTY · RELOADING', 1.4);
  },
});

function updateDummies(dt) {
  for (const target of state.targets) {
    if (target.dead) {
      target.deathTimer += dt;
      target.group.rotation.z = Math.min(Math.PI * 0.5, target.group.rotation.z + dt * 5);
      target.group.position.y = -Math.min(0.1, target.deathTimer * 0.1);
      if (target.deathTimer > 2.2) target.group.visible = false;
      if (target.deathTimer > 4.5) placeDummy(target, target.baseX, target.baseZ);
      continue;
    }
    target.flash = Math.max(0, target.flash - dt);
    const glow = target.flash * 6;
    for (const material of target.materials) material.emissiveIntensity = glow;
  }
}

hud.setPrompt('');

const deployButton = document.getElementById('deploy-button');
const pauseOverlay = document.getElementById('pause-overlay');
const playAgain = document.getElementById('play-again');

function beginPlay() {
  if (state.mode === 'start') {
    state.mode = 'live';
    state.paused = false;
    state.roundClock = 105;
    hud.setOverlay('none');
    showPrompt('RUST TARGETS AT NORTH QUAY · LMB FIRE · R RELOAD', 6);
  }
  input.requestLock();
}

deployButton.addEventListener('click', beginPlay);
pauseOverlay.addEventListener('click', () => input.requestLock());
playAgain.addEventListener('click', () => location.reload());
renderer.domElement.addEventListener('click', () => {
  if (state.mode === 'live' && !input.locked) input.requestLock();
});

// A small staged bomb prop is only visible in the deterministic cover composition; rounds own it later.
function createBombProp() {
  const group = new THREE.Group();
  const body = new THREE.Mesh(
    new THREE.BoxGeometry(0.42, 0.17, 0.3),
    new THREE.MeshStandardMaterial({ color: 0x20272d, roughness: 0.55, metalness: 0.5 }),
  );
  body.position.y = 0.085;
  body.castShadow = true;
  const led = new THREE.Mesh(
    new THREE.BoxGeometry(0.06, 0.06, 0.06),
    new THREE.MeshStandardMaterial({
      color: PALETTE.danger,
      emissive: PALETTE.danger,
      emissiveIntensity: 3,
      roughness: 0.3,
    }),
  );
  led.position.set(0.12, 0.18, 0.05);
  const cable = new THREE.Mesh(
    new THREE.BoxGeometry(0.02, 0.02, 0.24),
    new THREE.MeshStandardMaterial({ color: 0x11161a, roughness: 0.8 }),
  );
  cable.position.set(-0.14, 0.02, 0.18);
  group.add(body, led, cable);
  group.position.set(-16, -0.25, -10);
  group.visible = false;
  scene.add(group);
  return group;
}

const bombProp = createBombProp();

function aimAt(px, py, pz, tx, ty, tz) {
  const dx = tx - px;
  const dz = tz - pz;
  return {
    yaw: Math.atan2(-dx, -dz),
    pitch: Math.atan2(ty - py, Math.hypot(dx, dz)),
  };
}

function stageShot(name) {
  state.mode = 'shot';
  state.shot = name;
  state.paused = true;
  hud.setOverlay('none');
  state.player.health = 100;
  state.player.armor = 50;
  state.money = 3250;
  state.score.you = 2;
  state.score.rust = 1;
  state.weapon.current = 'longshore';
  state.weapon.primary = 'longshore';
  state.weapon.mags.longshore = 24;
  state.weapon.reserves.longshore = 90;

  if (name === 'cover') {
    const pose = aimAt(-22.5, 1.7, -3.5, -16, 1.2, -10);
    state.cameraOverride = { x: -22.5, y: 1.7, z: -3.5, yaw: pose.yaw, pitch: pose.pitch };
    state.roundClock = 37;
    state.hud.bombState = 'CHARGE PLANTED 0:37';
    state.player.health = 87;
    state.weapon.mags.longshore = 24;
    state.money = 3250;
    placeDummy(state.targets[0], -19, -13.5);
    placeDummy(state.targets[1], -17.4, -12.4);
    state.targets[2].group.visible = false;
    bombProp.visible = true;
    hud.pushKill('YOU > RUST.CUTTER', false);
  } else {
    const pose = aimAt(0, 3.9, 2, 0, 1.2, -8);
    state.cameraOverride = { x: 0, y: 3.9, z: 2, yaw: pose.yaw, pitch: pose.pitch };
    state.roundClock = 72;
    state.hud.bombState = 'CHARGE CARRIED';
    state.player.health = 64;
    state.weapon.mags.longshore = 19;
    placeDummy(state.targets[0], 0, -8);
    state.targets[1].group.visible = false;
    state.targets[2].group.visible = false;
    hud.pushKill('YOU > RUST.WARDEN', true);
    hud.hitmarker(true);
    const from = new THREE.Vector3(0.18, 3.62, 1.25);
    const to = new THREE.Vector3(0, 1.12, -8);
    const dir = new THREE.Vector3(0, -0.12, -1).normalize();
    effects.muzzle(from, dir);
    effects.tracer(from, to, 0xffcf96);
    effects.update(0.001);
  }

  state.time = 8;
  weapon.update(0.016);
  hud.update(0.016);
}

const requestedShot = params.get('shot');
const shotName = requestedShot === 'play' ? 'firefight'
  : requestedShot === 'end' ? 'cover'
    : requestedShot;
if (shotName === 'cover' || shotName === 'firefight') stageShot(shotName);

function step(dt) {
  state.time += dt;
  state.roundClock = Math.max(0, state.roundClock - dt);
  player.update(dt, input);
  weapon.update(dt);
  effects.update(dt);
  updateDummies(dt);
  if (promptTimer > 0) {
    promptTimer -= dt;
    if (promptTimer <= 0) hud.setPrompt('');
  }
  hud.update(dt);
  input.endFrame();
}

function render() {
  player.syncCamera();
  if (state.cameraOverride) {
    const pose = state.cameraOverride;
    camera.position.set(pose.x, pose.y, pose.z);
    camera.rotation.set(pose.pitch, pose.yaw, 0);
  }
  renderer.render(scene, camera);
  if (state.mode === 'shot') {
    state.shotFrame++;
    if (state.shotFrame >= 2) window.__shotReady = true;
  }
}

let last = performance.now();
let accumulator = 0;

function frame(now) {
  requestAnimationFrame(frame);
  const dt = Math.min(0.1, Math.max(0, (now - last) / 1000));
  last = now;

  if (state.mode === 'live' && !state.paused) {
    accumulator += dt;
    let steps = 0;
    while (accumulator >= STEP && steps < 5) {
      step(STEP);
      accumulator -= STEP;
      steps++;
      if (state.paused) break;
    }
    if (steps === 5) accumulator = 0;
  } else {
    accumulator = 0;
  }

  render();
}

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setSize(window.innerWidth, window.innerHeight);
});

hud.update(0);
requestAnimationFrame(frame);
