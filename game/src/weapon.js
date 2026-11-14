// Four hitscan weapons, the viewmodel, recoil and thrown grenades.
import * as THREE from 'three';
import { WEAPONS, GRENADES, PLAYER } from './config.js';
import { angleDiff, clamp, lineOfSight } from './util.js';

const raycaster = new THREE.Raycaster();
const rayOrigin = new THREE.Vector3();
const forward = new THREE.Vector3();
const right = new THREE.Vector3();
const up = new THREE.Vector3();
const shotDir = new THREE.Vector3();
const hitPoint = new THREE.Vector3();
const muzzleWorld = new THREE.Vector3();
const grenadeForward = new THREE.Vector3();

function weaponMaterial(color, metalness = 0.4, roughness = 0.45) {
  return new THREE.MeshStandardMaterial({ color, metalness, roughness, emissive: color, emissiveIntensity: 0.08 });
}

function addPart(group, geo, material, x, y, z) {
  const mesh = new THREE.Mesh(geo, material);
  mesh.position.set(x, y, z);
  group.add(mesh);
  return mesh;
}

export function createWeapon(state, camera, scene, effects, audio, player, input) {
  const dark = weaponMaterial(0x202a33, 0.55, 0.38);
  const steel = weaponMaterial(0x596873, 0.65, 0.32);
  const rail = weaponMaterial(0xb9c2c6, 0.5, 0.3);
  const glove = weaponMaterial(0x6d5848, 0.05, 0.9);
  const magMat = weaponMaterial(0x35434d, 0.55, 0.4);
  const led = new THREE.MeshBasicMaterial({ color: 0x5fd6d0 });

  const viewRoot = new THREE.Group();
  camera.add(viewRoot);
  scene.add(camera);
  const viewLight = new THREE.PointLight(0xffe0b8, 2.4, 2.6, 2);
  viewLight.position.set(0.2, 0.16, -0.15);
  viewRoot.add(viewLight);
  const models = {};

  const buildModel = (id) => {
    const group = new THREE.Group();
    const def = WEAPONS[id];
    const long = id === 'shotgun' ? 0.46 : id === 'pistol' ? 0.24 : 0.38;
    addPart(group, new THREE.BoxGeometry(0.085, 0.1, long), dark, 0, 0, -long * 0.5);
    addPart(group, new THREE.BoxGeometry(0.07, 0.022, long * 0.72), rail, 0, 0.061, -long * 0.48);
    addPart(group, new THREE.BoxGeometry(0.03, 0.03, id === 'pistol' ? 0.2 : 0.34), steel, 0, 0.008, -long - 0.11);
    addPart(group, new THREE.BoxGeometry(0.05, 0.056, 0.15), steel, 0, -0.018, -long - 0.16);
    const mag = addPart(group, new THREE.BoxGeometry(0.052, id === 'shotgun' ? 0.1 : 0.15, 0.075), magMat, 0, id === 'shotgun' ? -0.09 : -0.11, -0.07);
    if (id === 'pistol') {
      mag.rotation.x = 0.3;
      addPart(group, new THREE.BoxGeometry(0.07, 0.13, 0.075), dark, 0, -0.1, 0.04);
    } else {
      addPart(group, new THREE.BoxGeometry(0.075, 0.085, 0.19), dark, 0, -0.005, 0.22);
      addPart(group, new THREE.BoxGeometry(0.07, 0.06, 0.1), rail, 0, 0.052, 0.03);
    }
    addPart(group, new THREE.BoxGeometry(0.055, 0.105, 0.075), glove, 0.045, -0.095, 0.045);
    addPart(group, new THREE.BoxGeometry(0.06, 0.08, 0.12), glove, -0.038, -0.075, -long * 0.72);
    addPart(group, new THREE.BoxGeometry(0.058, 0.06, 0.09), glove, 0.03, -0.052, -long * 0.5);
    addPart(group, new THREE.BoxGeometry(0.018, 0.018, 0.018), led, 0.035, 0.045, -0.06);
    group.userData.mag = mag;
    group.userData.length = long;
    group.visible = false;
    viewRoot.add(group);
    return group;
  };

  for (const id of Object.keys(WEAPONS)) models[id] = buildModel(id);

  const grenadeHand = new THREE.Group();
  addPart(grenadeHand, new THREE.SphereGeometry(0.055, 10, 8), weaponMaterial(0x33452f, 0.2, 0.8), 0, 0, 0);
  addPart(grenadeHand, new THREE.BoxGeometry(0.06, 0.02, 0.03), new THREE.MeshBasicMaterial({ color: 0xffb15c }), 0, 0.05, 0);
  const throwGlove = addPart(grenadeHand, new THREE.BoxGeometry(0.075, 0.075, 0.11), glove, 0.05, -0.04, 0.02);
  grenadeHand.visible = false;
  grenadeHand.position.set(0.26, -0.2, -0.42);
  viewRoot.add(grenadeHand);

  const muzzleSprite = new THREE.Sprite(
    new THREE.SpriteMaterial({
      map: (() => {
        const canvas = document.createElement('canvas');
        canvas.width = 64;
        canvas.height = 64;
        const ctx = canvas.getContext('2d');
        const g = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
        g.addColorStop(0, 'rgba(255,255,238,1)');
        g.addColorStop(0.22, 'rgba(255,198,100,0.95)');
        g.addColorStop(0.55, 'rgba(255,145,55,0.35)');
        g.addColorStop(1, 'rgba(255,120,30,0)');
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, 64, 64);
        return new THREE.CanvasTexture(canvas);
      })(),
      color: 0xffd28a,
      transparent: true,
      opacity: 0,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    }),
  );
  muzzleSprite.scale.set(0.12, 0.12, 1);
  muzzleSprite.visible = false;
  viewRoot.add(muzzleSprite);
  const muzzleLight = new THREE.PointLight(0xffc078, 0, 4, 2);
  viewRoot.add(muzzleLight);
  let flashTimer = 0;

  const grenades = [];
  const grenadeGeo = new THREE.SphereGeometry(0.075, 8, 6);
  const grenadeMat = new THREE.MeshStandardMaterial({ color: 0x394a37, roughness: 0.7, metalness: 0.25 });
  for (let i = 0; i < 6; i += 1) {
    const mesh = new THREE.Mesh(grenadeGeo, grenadeMat);
    mesh.visible = false;
    scene.add(mesh);
    grenades.push({ mesh, vel: new THREE.Vector3(), life: 0, type: 'frag', trail: 0 });
  }
  let grenadeCursor = 0;

  let viewKick = 0;
  let reloadDip = 0;
  let bobTime = 0;

  const hideModels = () => {
    for (const id of Object.keys(models)) models[id].visible = false;
    grenadeHand.visible = false;
  };

  const select = (id) => {
    if (!WEAPONS[id] || !state.weapon.owned[id]) return false;
    state.weapon.current = id;
    state.player.grenadeSelect = null;
    state.weapon.reloading = 0;
    state.weapon.cooldown = Math.max(state.weapon.cooldown, 0.18);
    hideModels();
    models[id].visible = true;
    return true;
  };

  const selectGrenade = (type) => {
    if (!GRENADES[type] || state.player.grenades[type] <= 0) return false;
    state.player.grenadeSelect = type;
    hideModels();
    grenadeHand.visible = true;
    return true;
  };

  const current = () => WEAPONS[state.weapon.current];

  const currentSpread = () => {
    const def = current();
    const p = state.player;
    const moveT = clamp(p.speed / PLAYER.speed, 0, 1);
    let spread = def.spread + (def.spreadMove - def.spread) * moveT;
    spread *= 1 + state.weapon.spread;
    if (p.crouch > 0.5) spread *= 0.55;
    else if (p.walk) spread *= 0.8;
    return spread;
  };

  const syncMuzzleWorld = () => {
    const p = state.player;
    const cp = Math.cos(p.pitch);
    forward.set(-Math.sin(p.yaw) * cp, Math.sin(p.pitch), -Math.cos(p.yaw) * cp);
    right.set(Math.cos(p.yaw), 0, -Math.sin(p.yaw));
    up.set(0, 0, 0).crossVectors(right, forward).normalize();
    muzzleWorld.set(p.pos.x, p.pos.y + p.eye, p.pos.z).addScaledVector(right, 0.22).addScaledVector(up, -0.16).addScaledVector(forward, 0.48);
  };

  const beginFlash = (seconds = 0.05) => {
    flashTimer = seconds;
    muzzleSprite.visible = true;
    muzzleSprite.material.opacity = 1;
    muzzleLight.intensity = 14;
    muzzleSprite.position.set(0.02, 0.02, -0.62);
  };

  const fire = () => {
    const w = state.weapon;
    const def = current();
    const ammo = w.ammo[w.current];
    if (w.reloading > 0) return;
    if (ammo.mag <= 0) {
      w.cooldown = 0.22;
      if (audio) audio.dry();
      return;
    }
    ammo.mag -= 1;
    w.cooldown = def.gap;
    w.spread = Math.min(0.9, w.spread + 0.2);
    state.player.firedAt = 0;
    state.stats.shots += def.pellets;
    viewKick = 1;
    player.addShake(def.recoil * 0.45);
    state.player.pitch = clamp(state.player.pitch + def.recoil, -1.47, 1.47);
    state.player.yaw += (state.rng() - 0.5) * def.kick;
    if (audio) audio.shot(w.current);
    beginFlash(0.05);
    syncMuzzleWorld();

    const spread = currentSpread();
    const p = state.player;
    const cp = Math.cos(p.pitch);
    forward.set(-Math.sin(p.yaw) * cp, Math.sin(p.pitch), -Math.cos(p.yaw) * cp);
    right.set(Math.cos(p.yaw), 0, -Math.sin(p.yaw));
    up.set(0, 0, 0).crossVectors(right, forward).normalize();
    const eyeY = p.pos.y + p.eye;
    let visibleTracers = 0;
    for (let pellet = 0; pellet < def.pellets; pellet += 1) {
      const cone = def.pellets > 1 ? 0.07 : spread;
      const angle = Math.sqrt(state.rng()) * cone;
      const theta = state.rng() * Math.PI * 2;
      const sx = Math.tan(angle) * Math.cos(theta);
      const sy = Math.tan(angle) * Math.sin(theta);
      shotDir.copy(forward).addScaledVector(right, sx).addScaledVector(up, sy).normalize();
      rayOrigin.set(p.pos.x, eyeY, p.pos.z);
      raycaster.set(rayOrigin, shotDir);
      raycaster.far = def.range;
      const hits = raycaster.intersectObjects(state.shootables, false);
      let endX = p.pos.x + shotDir.x * def.range;
      let endY = eyeY + shotDir.y * def.range;
      let endZ = p.pos.z + shotDir.z * def.range;
      if (hits.length > 0) {
        const hit = hits[0];
        hitPoint.copy(hit.point);
        endX = hitPoint.x;
        endY = hitPoint.y;
        endZ = hitPoint.z;
        const bot = hit.object.userData.bot;
        if (bot && !bot.dead) {
          const zone = hit.object.userData.zone || 'body';
          const dist = hit.distance;
          const falloff = 1 - 0.3 * clamp((dist - 15) / 30, 0, 1);
          let dmg = def.damage * falloff;
          if (zone === 'head') dmg *= def.head;
          else if (zone === 'legs') dmg *= def.leg;
          state.stats.hits += 1;
          state.hitMarker = 0.18;
          if (audio) audio.hit();
          if (state.botAPI) state.botAPI.hit(bot, zone, dmg, hitPoint);
        } else {
          effects.impact(hitPoint.x, hitPoint.y, hitPoint.z, hit.face ? hit.face.normal.x : 0, hit.face ? hit.face.normal.y : 1, hit.face ? hit.face.normal.z : 0);
        }
      }
      if (visibleTracers < 3) {
        effects.tracer(muzzleWorld.x, muzzleWorld.y, muzzleWorld.z, endX, endY, endZ);
        visibleTracers += 1;
      }
    }
    effects.shell(muzzleWorld.x, muzzleWorld.y - 0.02, muzzleWorld.z, 0.8 + state.rng(), 1.2, 0.3);
    if (state.botAPI) state.botAPI.hearing(p.pos.x, p.pos.z, 30);
  };

  const startReload = () => {
    const w = state.weapon;
    const def = current();
    const ammo = w.ammo[w.current];
    if (w.reloading > 0 || ammo.mag >= def.mag || ammo.reserve <= 0) return;
    w.reloading = def.reload;
    w.spread = 0;
    if (audio) audio.reload();
  };

  const finishReload = () => {
    const w = state.weapon;
    const def = current();
    const ammo = w.ammo[w.current];
    const need = def.mag - ammo.mag;
    const take = Math.min(need, ammo.reserve);
    ammo.mag += take;
    ammo.reserve -= take;
    reloadDip = 0;
  };

  const throwGrenade = () => {
    const type = state.player.grenadeSelect;
    if (!type || state.player.grenades[type] <= 0) return;
    const def = GRENADES[type];
    const g = grenades[grenadeCursor];
    grenadeCursor = (grenadeCursor + 1) % grenades.length;
    const p = state.player;
    const cp = Math.cos(p.pitch);
    grenadeForward.set(-Math.sin(p.yaw) * cp, Math.sin(p.pitch) + 0.16, -Math.cos(p.yaw) * cp).normalize();
    g.mesh.visible = true;
    g.mesh.position.set(p.pos.x + grenadeForward.x * 0.45, p.pos.y + p.eye - 0.12, p.pos.z + grenadeForward.z * 0.45);
    g.vel.copy(grenadeForward).multiplyScalar(14);
    g.life = def.fuse;
    g.type = type;
    g.trail = 0;
    state.player.grenades[type] -= 1;
    state.player.grenadeSelect = null;
    hideModels();
    models[state.weapon.current].visible = true;
    if (audio) audio.throw();
  };

  const grenadeBoom = (g) => {
    const def = GRENADES[g.type];
    const x = g.mesh.position.x;
    const y = Math.max(0.2, g.mesh.position.y);
    const z = g.mesh.position.z;
    g.mesh.visible = false;
    g.life = 0;
    effects.explosion(x, y, z, g.type === 'frag' ? 1.5 : 0.8);
    if (audio) audio.explosion(g.type === 'frag' ? 1 : 0.6);
    if (state.botAPI) state.botAPI.hearing(x, z, 45, true);
    const p = state.player;
    const dx = p.pos.x - x;
    const dz = p.pos.z - z;
    const dist = Math.hypot(dx, dz);
    if (g.type === 'frag') {
      player.addShake(clamp(1.2 - dist / 8, 0.1, 0.9));
      if (state.botAPI) state.botAPI.explosion(x, z, def.radius, def.damage);
      if (dist < def.radius && dist > 0.01 && lineOfSight(state, x, 1, z, p.pos.x, p.pos.y + 1.2, p.pos.z)) {
        player.takeDamage(def.damage * (1 - dist / def.radius) + 8, x, z);
      }
    } else {
      if (audio) audio.flashRing();
      if (state.botAPI) state.botAPI.flash(x, z, def.radius, def.blind);
      if (dist < def.radius) {
        const bearing = Math.atan2(x - p.pos.x, -(z - p.pos.z));
        if (Math.abs(angleDiff(p.yaw, bearing)) < 1.5) player.blind(def.blind);
      }
    }
  };

  const update = (dt) => {
    const w = state.weapon;
    const p = state.player;
    w.cooldown = Math.max(0, w.cooldown - dt);
    w.spread = Math.max(0, w.spread - dt * 2.5);
    if (w.reloading > 0) {
      w.reloading -= dt;
      reloadDip = Math.min(1, reloadDip + dt * 6);
      if (w.reloading <= 0) {
        w.reloading = 0;
        finishReload();
      }
    }
    viewKick = Math.max(0, viewKick - dt * 10);
    if (flashTimer > 0) {
      flashTimer -= dt;
      muzzleSprite.material.opacity = Math.max(0, flashTimer / 0.05);
      muzzleLight.intensity = Math.max(0, flashTimer / 0.05) * 14;
      if (flashTimer <= 0) {
        muzzleSprite.visible = false;
        muzzleLight.intensity = 0;
      }
    }
    bobTime += dt;
    const arms = models[w.current];
    const sway = p.moving ? Math.sin(bobTime * 9) * 0.004 : Math.sin(bobTime * 1.5) * 0.0015;
    viewRoot.position.set(0.26 + sway * 0.5, -0.22 + Math.abs(sway) + (w.reloading > 0 ? -0.09 * reloadDip : 0), -0.5 + viewKick * 0.035);
    viewRoot.rotation.x = -viewKick * 0.06;
    viewRoot.rotation.z = sway * 0.4;
    if (arms && arms.userData.mag) {
      arms.userData.mag.position.y = -0.11 - (w.reloading > 0 ? reloadDip * 0.16 : 0);
    }

    if (!p.alive || state.mode !== 'playing' || state.paused || state.flags.buyOpen || state.flags.roundEnd || state.flags.matchEnd) {
      return;
    }
    if (state.round.phase !== 'live' && state.round.phase !== 'planted') return;

    if (input.pressed('KeyR')) startReload();
    if (input.pressed('Digit1')) select('pistol');
    if (input.pressed('Digit2')) {
      if (state.weapon.owned.rifle || state.weapon.owned.smg || state.weapon.owned.shotgun) {
        select(state.weapon.primary || 'rifle');
      }
    }
    if (input.pressed('Digit3')) selectGrenade('frag');
    if (input.pressed('Digit4')) selectGrenade('flash');
    if (input.pressed('KeyG')) throwGrenade();

    if (w.reloading > 0 || p.grenadeSelect) return;
    const def = current();
    const wants = def.auto ? input.mouse.down : input.mouse.clicked;
    if (wants && w.cooldown <= 0) fire();
  };

  const updateGrenades = (dt) => {
    for (const g of grenades) {
      if (!g.mesh.visible || g.life <= 0) continue;
      g.life -= dt;
      g.vel.y -= 17 * dt;
      g.mesh.position.x += g.vel.x * dt;
      g.mesh.position.y += g.vel.y * dt;
      g.mesh.position.z += g.vel.z * dt;
      g.trail += dt;
      if (g.mesh.position.y < 0.08) {
        g.mesh.position.y = 0.08;
        g.vel.y = Math.abs(g.vel.y) * 0.32;
        g.vel.x *= 0.55;
        g.vel.z *= 0.55;
      }
      if (g.trail > 0.045) {
        g.trail = 0;
        effects.smoke(g.mesh.position.x, g.mesh.position.y, g.mesh.position.z, 0.18);
      }
      if (g.life <= 0) grenadeBoom(g);
    }
  };

  const resetRound = () => {
    const w = state.weapon;
    w.reloading = 0;
    w.cooldown = 0;
    w.spread = 0;
    reloadDip = 0;
    for (const id of Object.keys(WEAPONS)) {
      w.ammo[id].mag = WEAPONS[id].mag;
      w.ammo[id].reserve = WEAPONS[id].reserve;
    }
    w.current = w.owned[w.primary] ? w.primary : 'pistol';
    state.player.grenadeSelect = null;
    hideModels();
    models[w.current].visible = true;
    for (const g of grenades) {
      g.mesh.visible = false;
      g.life = 0;
    }
  };

  const setAmmo = (id, mag, reserve) => {
    if (!state.weapon.ammo[id]) return;
    state.weapon.ammo[id].mag = mag;
    state.weapon.ammo[id].reserve = reserve;
  };

  const give = (id) => {
    if (!WEAPONS[id]) return;
    state.weapon.owned[id] = true;
    if (id !== 'pistol') state.weapon.primary = id;
    state.weapon.ammo[id].mag = WEAPONS[id].mag;
    state.weapon.ammo[id].reserve = WEAPONS[id].reserve;
    select(id);
  };

  resetRound();

  return {
    update,
    updateGrenades,
    resetRound,
    select,
    selectGrenade,
    throwGrenade,
    startReload,
    fire,
    beginFlash,
    setAmmo,
    give,
    currentSpread,
    viewRoot,
    get flashTimer() {
      return flashTimer;
    },
  };
}
