// Hitscan weapons, the box viewmodel and its animation. All four definitions share one fire path;
// the shotgun simply asks that path for nine independent rays.
import * as THREE from 'three';
import { PLAYER, WEAPONS } from './config.js';
import {
  boxNormal,
  clamp,
  damp,
  lerp,
  rayAABB,
  scratch,
  TAU,
} from './util.js';

const VM_BOX = new THREE.BoxGeometry(1, 1, 1);
const VIEW_BASE = { x: 0.235, y: -0.225, z: -0.52 };
const MUZZLE_LOCAL = {
  marlin: { x: 0.245, y: -0.185, z: -0.76 },
  kestrel: { x: 0.245, y: -0.18, z: -0.88 },
  longshore: { x: 0.245, y: -0.18, z: -1.18 },
  breakwater: { x: 0.245, y: -0.18, z: -1.07 },
};

export function createWeapon(state, camera, map, effects, input, hooks = {}) {
  const gunSteel = new THREE.MeshStandardMaterial({ color: 0x53636f, roughness: 0.34, metalness: 0.82 });
  const gunDark = new THREE.MeshStandardMaterial({ color: 0x141a1f, roughness: 0.52, metalness: 0.55 });
  const gunRust = new THREE.MeshStandardMaterial({ color: 0x8d4529, roughness: 0.7, metalness: 0.32 });
  const glove = new THREE.MeshStandardMaterial({ color: 0x222a2f, roughness: 0.9, metalness: 0.02 });
  const brass = new THREE.MeshStandardMaterial({ color: 0xb28a4f, roughness: 0.4, metalness: 0.72 });
  const sightGlow = new THREE.MeshStandardMaterial({
    color: 0x5fd6d0,
    emissive: 0x5fd6d0,
    emissiveIntensity: 1.8,
    roughness: 0.4,
  });

  const viewModels = {};
  let swayX = 0;
  let swayY = 0;
  let kick = 0;

  function part(group, w, h, d, x, y, z, material) {
    const mesh = new THREE.Mesh(VM_BOX, material);
    mesh.scale.set(w, h, d);
    mesh.position.set(x, y, z);
    mesh.castShadow = false;
    mesh.receiveShadow = false;
    group.add(mesh);
    return mesh;
  }

  function buildViewmodel(def) {
    const group = new THREE.Group();
    group.position.set(VIEW_BASE.x, VIEW_BASE.y, VIEW_BASE.z);
    group.visible = false;
    let mag;
    let magY = 0;

    if (def.kind === 'pistol') {
      part(group, 0.075, 0.085, 0.23, 0, 0.02, 0, gunSteel);
      part(group, 0.042, 0.04, 0.22, 0, 0.078, -0.025, gunDark);
      part(group, 0.03, 0.03, 0.11, 0, 0.035, -0.17, gunSteel);
      part(group, 0.012, 0.02, 0.022, 0, 0.11, -0.12, sightGlow);
      const grip = part(group, 0.062, 0.15, 0.075, 0, -0.105, 0.065, gunDark);
      grip.rotation.x = -0.2;
      mag = part(group, 0.042, 0.095, 0.05, 0, -0.125, 0.06, gunSteel);
      magY = mag.position.y;
      part(group, 0.085, 0.08, 0.11, 0.004, -0.135, 0.01, glove);
      part(group, 0.075, 0.07, 0.1, -0.015, -0.08, -0.03, glove);
    } else if (def.kind === 'smg') {
      part(group, 0.08, 0.105, 0.34, 0, 0.015, -0.02, gunSteel);
      part(group, 0.028, 0.028, 0.16, 0, 0.045, -0.27, gunDark);
      part(group, 0.05, 0.055, 0.15, 0, 0.01, 0.19, gunDark);
      part(group, 0.055, 0.12, 0.065, 0, -0.1, 0.07, gunDark);
      mag = part(group, 0.044, 0.17, 0.06, 0, -0.145, -0.06, gunSteel);
      magY = mag.position.y;
      part(group, 0.045, 0.045, 0.11, 0, 0.09, -0.06, gunDark);
      part(group, 0.011, 0.018, 0.02, 0, 0.12, -0.09, sightGlow);
      part(group, 0.08, 0.08, 0.11, 0.005, -0.14, 0.01, glove);
      part(group, 0.08, 0.075, 0.12, -0.005, -0.095, -0.2, glove);
    } else if (def.kind === 'rifle') {
      part(group, 0.082, 0.11, 0.44, 0, 0.01, -0.04, gunSteel);
      part(group, 0.062, 0.07, 0.24, 0, 0.025, -0.29, gunDark);
      part(group, 0.026, 0.026, 0.25, 0, 0.04, -0.53, gunDark);
      part(group, 0.055, 0.09, 0.2, 0, 0.01, 0.25, gunDark);
      part(group, 0.055, 0.13, 0.07, 0, -0.105, 0.07, gunDark);
      mag = part(group, 0.05, 0.15, 0.075, 0, -0.14, -0.07, gunSteel);
      magY = mag.position.y;
      part(group, 0.04, 0.04, 0.14, 0, 0.095, -0.06, gunDark);
      part(group, 0.05, 0.035, 0.08, 0, 0.075, -0.06, gunSteel);
      part(group, 0.012, 0.018, 0.02, 0, 0.122, -0.1, sightGlow);
      part(group, 0.082, 0.08, 0.12, 0.005, -0.145, 0.01, glove);
      part(group, 0.08, 0.075, 0.13, -0.005, -0.095, -0.32, glove);
      part(group, 0.05, 0.05, 0.08, 0.01, 0.035, 0.28, gunRust);
    } else {
      part(group, 0.09, 0.11, 0.42, 0, 0.01, -0.03, gunSteel);
      part(group, 0.048, 0.048, 0.38, 0.018, 0.045, -0.35, gunDark);
      part(group, 0.042, 0.042, 0.3, -0.02, 0.005, -0.32, gunSteel);
      part(group, 0.082, 0.07, 0.17, 0, -0.045, -0.25, gunRust);
      part(group, 0.06, 0.095, 0.22, 0, 0.01, 0.26, gunDark);
      part(group, 0.056, 0.11, 0.07, 0, -0.095, 0.08, gunDark);
      mag = part(group, 0.038, 0.1, 0.045, 0, -0.14, -0.14, brass);
      magY = mag.position.y;
      part(group, 0.012, 0.016, 0.02, 0, 0.078, -0.05, sightGlow);
      part(group, 0.085, 0.08, 0.12, 0.005, -0.14, 0.01, glove);
      part(group, 0.082, 0.078, 0.14, -0.005, -0.095, -0.26, glove);
    }

    group.userData.mag = mag;
    group.userData.magY = magY;
    camera.add(group);
    viewModels[def.id] = group;
    return group;
  }

  for (const id of Object.keys(WEAPONS)) buildViewmodel(WEAPONS[id]);
  viewModels[state.weapon.current].visible = true;

  let hitEntry = null;
  let hitT = 0;

  function currentDef() {
    return WEAPONS[state.weapon.current];
  }

  function baseSpread(def) {
    const speedFactor = clamp(state.player.groundSpeed / PLAYER.speed, 0, 1);
    let spread = def.spreadStill + def.spreadMove * speedFactor;
    if (state.player.crouched) spread *= 0.55;
    else if (state.player.walking) spread *= 0.8;
    if (!state.player.grounded) spread *= 1.25;
    return spread;
  }

  function switchTo(id) {
    if (!id || !WEAPONS[id] || id === state.weapon.current) return;
    if (!state.weapon.owned[id]) return;
    viewModels[state.weapon.current].visible = false;
    state.weapon.current = id;
    state.weapon.reloading = false;
    state.weapon.reloadLeft = 0;
    state.weapon.cooldown = Math.max(state.weapon.cooldown, 0.18);
    state.weapon.bloom = 0;
    viewModels[id].visible = true;
    kick = 0;
    swayX = 0;
    swayY = 0;
  }

  function startReload() {
    const def = currentDef();
    const w = state.weapon;
    if (w.reloading) return;
    if (w.mags[def.id] >= def.mag || w.reserves[def.id] <= 0) return;
    w.reloading = true;
    w.reloadLeft = def.reload;
    if (hooks.onReload) hooks.onReload(def);
  }

  function finishReload() {
    const def = currentDef();
    const w = state.weapon;
    const missing = def.mag - w.mags[def.id];
    const take = Math.min(missing, w.reserves[def.id]);
    w.mags[def.id] += take;
    w.reserves[def.id] -= take;
    w.reloading = false;
    w.reloadLeft = 0;
  }

  function spreadDir(cone, out) {
    out.set(0, 0, -1).applyQuaternion(camera.quaternion);
    if (cone <= 0) return out;
    scratch.right.set(1, 0, 0).applyQuaternion(camera.quaternion);
    scratch.up.set(0, 1, 0).applyQuaternion(camera.quaternion);
    const angle = state.rng() * TAU;
    const radius = Math.sqrt(state.rng()) * cone;
    out.addScaledVector(scratch.right, Math.cos(angle) * radius);
    out.addScaledVector(scratch.up, Math.sin(angle) * radius);
    return out.normalize();
  }

  function traceShot(def, cone) {
    const w = state.weapon;
    scratch.origin.copy(camera.position);
    spreadDir(cone, scratch.dir);

    hitEntry = null;
    hitT = 90;
    const ox = scratch.origin.x;
    const oy = scratch.origin.y;
    const oz = scratch.origin.z;
    const dx = scratch.dir.x;
    const dy = scratch.dir.y;
    const dz = scratch.dir.z;

    for (let i = 0; i < map.shootables.length; i++) {
      const entry = map.shootables[i];
      if (entry.disabled) continue;
      const t = rayAABB(ox, oy, oz, dx, dy, dz, entry.min, entry.max);
      if (t >= 0 && t < hitT) {
        hitT = t;
        hitEntry = entry;
      }
    }

    scratch.hit.set(ox + dx * hitT, oy + dy * hitT, oz + dz * hitT);
    const muzzle = scratch.muzzle.set(MUZZLE_LOCAL[def.id].x, MUZZLE_LOCAL[def.id].y, MUZZLE_LOCAL[def.id].z);
    muzzle.applyQuaternion(camera.quaternion).add(camera.position);
    effects.tracer(muzzle, scratch.hit, def.tracer);

    if (!hitEntry) return;

    boxNormal(scratch.hit.x, scratch.hit.y, scratch.hit.z, hitEntry.min, hitEntry.max, scratch.normal);

    if (hitEntry.kind === 'dummy') {
      const falloff = hitT <= 15 ? 1 : hitT >= 45 ? 0.7 : lerp(1, 0.7, (hitT - 15) / 30);
      let damage = def.damage * falloff;
      const headshot = hitEntry.part === 'head';
      if (headshot) damage *= def.head;
      else if (hitEntry.part === 'leg') damage *= 0.8;
      state.stats.hits++;
      const target = hitEntry.target;
      target.health -= damage;
      target.flash = 0.16;
      if (hooks.onHit) hooks.onHit(headshot, damage);
      if (target.health <= 0 && !target.dead) {
        target.dead = true;
        target.deathTimer = 0;
        if (hooks.onKill) hooks.onKill(headshot, target);
      }
      effects.impact(scratch.hit, scratch.normal, 'flesh');
    } else {
      effects.impact(scratch.hit, scratch.normal, hitEntry.impact || 'concrete');
    }
  }

  function fire() {
    const w = state.weapon;
    const def = currentDef();
    if (w.cooldown > 0 || w.reloading || state.paused || state.mode !== 'live') return;

    if (w.mags[def.id] <= 0) {
      w.cooldown = 0.3;
      if (hooks.onDry) hooks.onDry();
      if (w.reserves[def.id] > 0) startReload();
      return;
    }

    w.mags[def.id]--;
    state.stats.shots += def.pellets;
    w.cooldown = def.gap;
    w.bloom = Math.min(1.5, w.bloom + 0.2);
    state.player.recoilPitch += def.kick;
    state.player.recoilYaw += (state.rng() * 2 - 1) * def.yawKick;
    if (state.player.recoilPitch > 0.14) state.player.recoilPitch = 0.14;
    if (state.player.recoilYaw > 0.08) state.player.recoilYaw = 0.08;
    if (state.player.recoilYaw < -0.08) state.player.recoilYaw = -0.08;

    const spread = baseSpread(def) * (1 + w.bloom);
    w.spread = spread;
    kick = 1;

    scratch.muzzle.set(MUZZLE_LOCAL[def.id].x, MUZZLE_LOCAL[def.id].y, MUZZLE_LOCAL[def.id].z);
    scratch.muzzle.applyQuaternion(camera.quaternion).add(camera.position);
    scratch.dir.set(0, 0, -1).applyQuaternion(camera.quaternion);
    effects.muzzle(scratch.muzzle, scratch.dir);

    scratch.right.set(1, 0, 0).applyQuaternion(camera.quaternion);
    scratch.up.set(0, 1, 0).applyQuaternion(camera.quaternion);
    scratch.a.copy(camera.position)
      .addScaledVector(scratch.right, 0.16)
      .addScaledVector(scratch.up, -0.12);
    effects.shell(scratch.a, scratch.right);

    if (def.pellets > 1) {
      for (let i = 0; i < def.pellets; i++) traceShot(def, def.cone + spread * 0.35);
    } else {
      traceShot(def, spread);
    }

    if (hooks.onShot) hooks.onShot(def);
    state.player.recoilPitch = clamp(state.player.recoilPitch, -0.04, 0.14);
  }

  function updateViewmodel(dt) {
    const def = currentDef();
    const group = viewModels[def.id];

    for (const id of Object.keys(viewModels)) viewModels[id].visible = id === def.id;

    const swayTargetX = clamp(-state.player.lookX * 0.0011, -0.03, 0.03);
    const swayTargetY = clamp(state.player.lookY * 0.0011, -0.026, 0.026);
    swayX = damp(swayX, swayTargetX, 13, dt);
    swayY = damp(swayY, swayTargetY, 13, dt);
    kick = damp(kick, 0, 19, dt);

    let reloadDip = 0;
    if (state.weapon.reloading) {
      const t = 1 - state.weapon.reloadLeft / def.reload;
      reloadDip = Math.sin(clamp(t, 0, 1) * Math.PI);
    }

    const idle = Math.sin(state.time * 1.7) * 0.0022 + Math.sin(state.time * 0.53) * 0.0012;
    group.position.set(
      VIEW_BASE.x + swayX,
      VIEW_BASE.y + swayY + idle - reloadDip * 0.18,
      VIEW_BASE.z + kick * 0.05,
    );
    group.rotation.set(
      -kick * 0.035 + reloadDip * 0.62,
      swayX * 0.6,
      -reloadDip * 0.18,
    );

    const mag = group.userData.mag;
    if (mag) {
      const drop = state.weapon.reloading
        ? Math.sin(clamp((1 - state.weapon.reloadLeft / def.reload - 0.12) / 0.55, 0, 1) * Math.PI) * 0.24
        : 0;
      mag.position.y = group.userData.magY - drop;
    }
  }

  function update(dt) {
    const w = state.weapon;
    const def = currentDef();

    if (input.consumeKey('Digit1')) switchTo(w.primary);
    if (input.consumeKey('Digit2')) switchTo(w.secondary);
    if (input.consumeKey('KeyR')) startReload();

    w.cooldown = Math.max(0, w.cooldown - dt);
    w.bloom = damp(w.bloom, 0, 7.5, dt);
    w.spread = baseSpread(def) * (1 + w.bloom);

    if (w.reloading) {
      w.reloadLeft -= dt;
      if (w.reloadLeft <= 0) finishReload();
    }

    if (state.mode === 'live' && !state.paused) {
      const pressed = input.consumeMouse(0);
      const held = input.isMouseDown(0);
      if ((def.auto && held) || pressed) fire();
    } else {
      input.consumeMouse(0);
    }

    updateViewmodel(dt);
    if (state.effects.hitmarker > 0) state.effects.hitmarker = Math.max(0, state.effects.hitmarker - dt);
  }

  return { update, fire, startReload, switchTo, viewModels };
}
