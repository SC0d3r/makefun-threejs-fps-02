// Weapons own fire/reload/switch, the pooled grenades and the viewmodel scene.
// Empty-mag handling lives first in fire(); a dry pull spends nothing and the
// HUD crosshair spread is written from the same numbers used by the ray.
import * as THREE from 'three';
import { PALETTE, PLAYER, WEAPONS } from './config.js';
import { clamp, damp, mulberry32 } from './util.js';
import { makeFlashTexture } from './effects.js';

export function createWeapon(state, scene, vmScene, map, bots, player, effects, audio, hud, input) {
  const rng = mulberry32(917);
  const group = new THREE.Group();
  vmScene.add(group);
  const flashMaterial = new THREE.SpriteMaterial({ map: makeFlashTexture(), transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending });
  const flash = new THREE.Sprite(flashMaterial);
  flash.scale.setScalar(0.16);
  flash.position.set(0, 0.03, -0.58);
  flash.visible = false;
  group.add(flash);
  const flashLight = new THREE.PointLight(PALETTE.sodium, 0, 2.4, 2);
  flashLight.position.set(0, 0.06, -0.5);
  group.add(flashLight);

  const gunmetal = new THREE.MeshStandardMaterial({ color: 0x252d35, metalness: 0.72, roughness: 0.34 });
  const railMetal = new THREE.MeshStandardMaterial({ color: 0x71818c, metalness: 0.62, roughness: 0.3 });
  const darkMetal = new THREE.MeshStandardMaterial({ color: 0x141a20, metalness: 0.8, roughness: 0.3 });
  const magMetal = new THREE.MeshStandardMaterial({ color: 0x39434c, metalness: 0.5, roughness: 0.45 });
  const glove = new THREE.MeshStandardMaterial({ color: 0x7e7466, metalness: 0.05, roughness: 0.9 });
  const accent = new THREE.MeshStandardMaterial({ color: PALETTE.sodium, emissive: PALETTE.sodium, emissiveIntensity: 0.8, roughness: 0.5 });

  function part(w, h, d, x, y, z, material, rx = 0) {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material);
    mesh.position.set(x, y, z);
    mesh.rotation.x = rx;
    group.add(mesh);
    return mesh;
  }

  const receiver = part(0.095, 0.105, 0.36, 0, 0, -0.05, gunmetal);
  const rail = part(0.052, 0.022, 0.3, 0, 0.064, -0.1, railMetal);
  const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.016, 0.016, 0.3, 10), darkMetal);
  barrel.rotation.x = Math.PI / 2;
  barrel.position.set(0, 0.012, -0.36);
  group.add(barrel);
  const muzzle = part(0.042, 0.042, 0.05, 0, 0.012, -0.515, darkMetal);
  const handguard = part(0.075, 0.066, 0.2, 0, 0, -0.27, magMetal);
  const magazine = part(0.07, 0.15, 0.085, 0, -0.105, 0.0, magMetal, 0.18);
  const grip = part(0.055, 0.11, 0.07, 0, -0.085, 0.13, gunmetal, -0.3);
  const stock = part(0.064, 0.085, 0.18, 0, -0.004, 0.3, gunmetal);
  const frontSight = part(0.018, 0.03, 0.02, 0, 0.09, -0.3, darkMetal);
  const rearSight = part(0.03, 0.022, 0.025, 0, 0.085, 0.12, darkMetal);
  const supportHand = part(0.085, 0.075, 0.12, -0.035, -0.078, -0.235, glove, 0.12);
  const supportArm = part(0.075, 0.07, 0.16, -0.045, -0.13, -0.09, glove, -0.25);
  const triggerHand = part(0.08, 0.09, 0.11, 0.028, -0.1, 0.145, glove, 0.2);
  const pump = part(0.09, 0.07, 0.22, 0, -0.026, -0.25, gunmetal);
  const bolt = part(0.022, 0.024, 0.06, 0.06, 0.012, 0.02, accent);

  const layouts = {
    pistol: { scale: 0.64, x: 0.24, y: -0.14, z: -0.44, stock: false, handguard: false, longBarrel: false, pump: false, bolt: true },
    smg: { scale: 0.8, x: 0.26, y: -0.155, z: -0.52, stock: false, handguard: true, longBarrel: false, pump: false, bolt: false },
    rifle: { scale: 0.9, x: 0.28, y: -0.175, z: -0.62, stock: true, handguard: true, longBarrel: true, pump: false, bolt: false },
    shotgun: { scale: 0.94, x: 0.285, y: -0.18, z: -0.64, stock: true, handguard: false, longBarrel: true, pump: true, bolt: false },
  };

  let kick = 0;
  let reloadSway = 0;
  let baseY = -0.175;

  function applyLayout() {
    const id = state.weapon;
    const layout = layouts[id] || layouts.rifle;
    group.scale.setScalar(layout.scale);
    group.position.set(layout.x, layout.y, layout.z);
    baseY = layout.y;
    stock.visible = layout.stock;
    handguard.visible = layout.handguard;
    pump.visible = layout.pump;
    bolt.visible = layout.bolt;
    barrel.scale.y = layout.longBarrel ? 1 : 0.62;
    barrel.position.z = layout.longBarrel ? -0.36 : -0.26;
    muzzle.position.z = layout.longBarrel ? -0.515 : -0.39;
    flash.position.z = layout.longBarrel ? -0.58 : -0.46;
    flashLight.position.z = flash.position.z;
    supportHand.position.z = layout.longBarrel ? -0.235 : -0.17;
    supportArm.position.z = layout.longBarrel ? -0.09 : -0.05;
  }

  function def() { return WEAPONS[state.weapon]; }

  function equip(id) {
    if (id !== 'pistol' && id !== 'smg' && id !== 'rifle' && id !== 'shotgun') return;
    if (id !== 'pistol' && state.primary !== id) return;
    state.weapon = id;
    state.grenade = null;
    state.reload = 0;
    state.switchTimer = 0.18;
    applyLayout();
  }

  function selectGrenade(kind) {
    if (kind === 'frag' && state.grenades.frag <= 0) return;
    if (kind === 'flash' && state.grenades.flash <= 0) return;
    state.grenade = kind;
    state.reload = 0;
    state.switchTimer = 0.12;
  }

  function reload() {
    const weapon = def();
    const ammo = state.ammo[state.weapon];
    if (state.grenade || state.reload > 0 || ammo.mag >= weapon.mag || ammo.reserve <= 0) return;
    state.reload = weapon.reload;
    state.reloadTotal = weapon.reload;
    audio.reload();
  }

  function eyeHeight() { return state.player.crouch ? PLAYER.eyeCrouch : PLAYER.eyeStand; }

  function fire() {
    if (state.mode !== 'live' && state.mode !== 'planted') return false;
    if (!state.alive || state.grenade || state.reload > 0 || state.switchTimer > 0) return false;
    const weapon = def();
    if (state.shotTimer > 0) return false;
    const ammo = state.ammo[state.weapon];
    // Empty magazine blocks the shot before any ammo, accuracy or tracer work.
    if (ammo.mag <= 0) {
      if (input.firePressed) {
        audio.dry();
        state.shotTimer = 0.32;
        hud.setPrompt('PRESS R TO RELOAD', 0.5);
      }
      return false;
    }

    const oy = state.player.y + eyeHeight();
    const ox = state.player.x;
    const oz = state.player.z;
    const pitch = state.pitch + state.recoilPitch;
    const yaw = state.yaw + state.recoilYaw;
    const cp = Math.cos(pitch);
    const fx = -Math.sin(yaw) * cp;
    const fy = Math.sin(pitch);
    const fz = -Math.cos(yaw) * cp;
    const rx = Math.cos(yaw);
    const rz = -Math.sin(yaw);
    const ux = -rz * fy;
    const uy = rz * fx - rx * fz;
    const uz = rx * fy;
    const crouchFactor = state.player.crouch ? 0.55 : 1;
    const moveFactor = clamp(state.player.speed / PLAYER.speed, 0, 1);
    const spread = (weapon.spread * crouchFactor + weapon.move * moveFactor) * (1 + state.consecutive * 0.2);
    state.spread = spread;

    const pellets = weapon.pellets || 1;
    let anyHit = false;
    for (let p = 0; p < pellets; p++) {
      const sx = (rng() - 0.5) * 2 * spread;
      const sy = (rng() - 0.5) * 2 * spread;
      let dx = fx + rx * sx + ux * sy;
      let dy = fy + uy * sy;
      let dz = fz + rz * sx + uz * sy;
      const len = Math.hypot(dx, dy, dz) || 1;
      dx /= len; dy /= len; dz /= len;
      const wallT = map.raycast(ox, oy, oz, dx, dy, dz).t;
      const botHit = bots.raycast(ox, oy, oz, dx, dy, dz, Math.min(120, wallT));
      if (botHit.hit) {
        const falloff = 1 - clamp((botHit.t - 15) / 30, 0, 1) * 0.3;
        const zoneMul = botHit.zone === 'head' ? weapon.head : botHit.zone === 'legs' ? weapon.legs : 1;
        bots.damage(botHit.bot, weapon.body * falloff * zoneMul, botHit.zone);
        effects.impact(botHit.x, botHit.y, botHit.z, dx, dy, dz);
        anyHit = true;
      } else if (wallT < 120) {
        effects.impact(ox + dx * wallT, oy + dy * wallT, oz + dz * wallT, dx, dy, dz);
      }
    }

    state.ammo[state.weapon].mag -= 1;
    state.shots += 1;
    if (anyHit) state.hits += 1;
    state.shotTimer = weapon.gap;
    state.consecutive += 1;
    state.consecutiveTimer = 0.28;
    state.spread = Math.min(0.09, spread);
    state.recoilPitch += weapon.recoil;
    state.recoilYaw += (rng() - 0.5) * weapon.recoil * 0.6;
    state.shake = Math.min(0.5, state.shake + weapon.recoil * 2.2);
    state.muzzle = 0.05;
    kick = 1;
    audio.shot(weapon.sound);
    effects.tracer(ox + rx * 0.16 - ux * 0.1 + fx * 0.55, oy - 0.12 + fy * 0.55, oz + rz * 0.16 - uz * 0.1 + fz * 0.55, fx, fy, fz, PALETTE.sodium);
    effects.shell(ox + rx * 0.22, oy - 0.14, oz + rz * 0.22, rx * 1.6 + (rng() - 0.5) * 0.4, 1.4 + rng() * 0.6, rz * 1.6);
    bots.hear(ox, oz, 30);
    hud.hitmarker(anyHit);
    if (state.ammo[state.weapon].mag <= 0) hud.setPrompt('PRESS R TO RELOAD', 0.6);
    return true;
  }

  function throwGrenade() {
    if (state.mode !== 'live' && state.mode !== 'planted') return;
    if (!state.alive || !state.grenade) return;
    if (state.grenades[state.grenade] <= 0) return;
    const kind = state.grenade;
    const item = projectiles.find((p) => !p.active);
    if (!item) return;
    state.grenades[kind] -= 1;
    const pitch = state.pitch;
    const yaw = state.yaw;
    const cp = Math.cos(pitch);
    const fx = -Math.sin(yaw) * cp;
    const fy = Math.sin(pitch) + 0.18;
    const fz = -Math.cos(yaw) * cp;
    item.active = true;
    item.kind = kind;
    item.x = state.player.x + fx * 0.35;
    item.y = state.player.y + eyeHeight() - 0.08;
    item.z = state.player.z + fz * 0.35;
    item.vx = fx * 9;
    item.vy = fy * 9;
    item.vz = fz * 9;
    item.fuse = kind === 'frag' ? 0.9 : 1.2;
    item.mesh.visible = true;
    item.mesh.position.set(item.x, item.y, item.z);
    item.mesh.material = kind === 'frag' ? fragMaterial : flashMaterialSolid;
    state.grenade = null;
    audio.toss();
    hud.setPrompt(kind === 'frag' ? 'FRAG OUT' : 'FLASH OUT', 0.5);
  }

  const fragMaterial = new THREE.MeshStandardMaterial({ color: 0x2c343b, roughness: 0.6, metalness: 0.3 });
  const flashMaterialSolid = new THREE.MeshStandardMaterial({ color: 0x9aa6ae, roughness: 0.4, metalness: 0.5, emissive: PALETTE.cyan, emissiveIntensity: 0.25 });
  const projectiles = [];
  for (let i = 0; i < 4; i++) {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.13, 0.11), fragMaterial);
    mesh.visible = false;
    scene.add(mesh);
    projectiles.push({ mesh, active: false, kind: 'frag', x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, fuse: 0 });
  }

  function detonate(item) {
    item.active = false;
    item.mesh.visible = false;
    if (item.kind === 'frag') {
      effects.explosion(item.x, 0.1, item.z);
      audio.explosion();
      state.shake = Math.min(0.8, state.shake + 0.6);
      for (const bot of bots.squad) {
        if (!bot.alive) continue;
        const bx = bot.x;
        const by = bot.y + 1.15;
        const bz = bot.z;
        const dx = bx - item.x;
        const dy = by - item.y;
        const dz = bz - item.z;
        const distance = Math.hypot(dx, dy, dz);
        if (distance > 5.2) continue;
        const len = distance || 1;
        if (map.blocked(item.x, item.y, item.z, dx / len, dy / len, dz / len, distance)) continue;
        const amount = 130 - (Math.min(distance, 5) / 5) * 120;
        bots.damage(bot, amount, 'body');
      }
      const pdx = state.player.x - item.x;
      const pdz = state.player.z - item.z;
      const pd = Math.hypot(pdx, pdz);
      if (pd < 5 && !map.blocked(item.x, item.y + 0.1, item.z, pdx / (pd || 1), 0, pdz / (pd || 1), pd)) {
        player.damage(40 - pd * 5, item.x, item.z);
      }
    } else {
      effects.explosion(item.x, 0.1, item.z);
      audio.flash();
      bots.flash(item.x, item.z, 9, 2.5);
      const fx = -Math.sin(state.yaw);
      const fz = -Math.cos(state.yaw);
      const dx = item.x - state.player.x;
      const dz = item.z - state.player.z;
      const distance = Math.hypot(dx, dz) || 1;
      if (distance < 12 && (fx * dx + fz * dz) / distance > 0.15 && !map.blocked(state.player.x, state.player.y + 1.55, state.player.z, dx / distance, 0, dz / distance, distance)) {
        state.flash = 1;
      }
    }
  }

  function updateProjectiles(dt) {
    for (const item of projectiles) {
      if (!item.active) continue;
      item.fuse -= dt;
      const px = item.x;
      const py = item.y;
      const pz = item.z;
      item.vy -= 20 * dt;
      item.x += item.vx * dt;
      item.y += item.vy * dt;
      item.z += item.vz * dt;
      if (item.y < 0.12) {
        item.y = 0.12;
        item.vy = Math.abs(item.vy) * 0.38;
        item.vx *= 0.7;
        item.vz *= 0.7;
      }
      const dx = item.x - px;
      const dy = item.y - py;
      const dz = item.z - pz;
      const distance = Math.hypot(dx, dy, dz);
      if (distance > 0.0001) {
        const hit = map.raycast(px, py, pz, dx / distance, dy / distance, dz / distance);
        if (hit.t < distance - 0.02) {
          item.x = px + (dx / distance) * Math.max(0, hit.t - 0.06);
          item.y = py + (dy / distance) * Math.max(0, hit.t - 0.06);
          item.z = pz + (dz / distance) * Math.max(0, hit.t - 0.06);
          item.vx *= -0.35;
          item.vz *= -0.35;
          item.vy *= 0.3;
        }
      }
      item.mesh.position.set(item.x, item.y, item.z);
      item.mesh.rotation.x += dt * 7;
      item.mesh.rotation.z += dt * 5;
      if (item.fuse <= 0) detonate(item);
    }
  }

  function update(dt) {
    state.shotTimer = Math.max(0, state.shotTimer - dt);
    state.switchTimer = Math.max(0, state.switchTimer - dt);
    state.muzzle = Math.max(0, state.muzzle - dt);
    state.flash = Math.max(0, state.flash - dt * 1.4);
    state.spread = damp(state.spread, 0, 9, dt);
    if (state.consecutive > 0) {
      state.consecutiveTimer = (state.consecutiveTimer || 0) - dt;
      if (state.consecutiveTimer <= 0) state.consecutive = 0;
    }
    if (state.reload > 0) {
      state.reload -= dt;
      if (state.reload <= 0) {
        state.reload = 0;
        const weapon = def();
        const ammo = state.ammo[state.weapon];
        const take = Math.min(weapon.mag - ammo.mag, ammo.reserve);
        ammo.mag += take;
        ammo.reserve -= take;
      }
    }
    if (state.mode === 'live' || state.mode === 'planted') {
      if (input.pressed.has('Digit1')) equip('pistol');
      if (input.pressed.has('Digit2') && state.primary) equip(state.primary);
      if (input.pressed.has('Digit3')) selectGrenade('frag');
      if (input.pressed.has('Digit4')) selectGrenade('flash');
      if (input.pressed.has('KeyR')) reload();
      if (input.pressed.has('KeyG')) throwGrenade();
      if (state.alive && !state.grenade) {
        const weapon = def();
        const wants = weapon.auto ? input.mouseDown : input.firePressed;
        if (wants) fire();
      }
    }
    updateProjectiles(dt);

    kick = damp(kick, 0, 15, dt);
    reloadSway = damp(reloadSway, state.reload > 0 ? 1 : 0, 9, dt);
    group.visible = state.mode !== 'start' && state.mode !== 'buy' && state.alive && !state.grenade;
    if (group.visible) {
      const sway = Math.sin(state.time * 1.6) * 0.004 + Math.sin(state.bobPhase) * 0.006 * Math.min(1, state.player.speed / PLAYER.speed);
      group.position.x = (layouts[state.weapon] || layouts.rifle).x + sway;
      group.position.y = baseY - reloadSway * 0.1 + Math.cos(state.time * 1.3) * 0.003;
      group.position.z = (layouts[state.weapon] || layouts.rifle).z + kick * 0.055;
      group.rotation.x = 0.02 + kick * 0.12;
      group.rotation.z = reloadSway * 0.35;
      group.rotation.y = -0.05 + sway * 0.6;
    }
    flash.visible = state.muzzle > 0;
    flashMaterial.opacity = state.muzzle > 0 ? 0.95 : 0;
    flashLight.intensity = state.muzzle > 0 ? 9 : 0;
  }

  function resetRound() {
    for (const id of ['pistol', 'smg', 'rifle', 'shotgun']) {
      state.ammo[id].mag = WEAPONS[id].mag;
      state.ammo[id].reserve = WEAPONS[id].reserve;
    }
    state.weapon = state.primary || 'pistol';
    state.grenade = null;
    state.reload = 0;
    state.shotTimer = 0;
    state.consecutive = 0;
    state.spread = 0;
    state.muzzle = 0;
    for (const item of projectiles) { item.active = false; item.mesh.visible = false; }
    applyLayout();
  }

  function accuracy() { return state.shots > 0 ? Math.round((state.hits / state.shots) * 100) : 0; }

  applyLayout();
  return { fire, reload, equip, selectGrenade, throwGrenade, update, resetRound, accuracy, group };
}
