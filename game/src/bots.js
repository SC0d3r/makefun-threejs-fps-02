// Three RUST defenders. Perception is FOV + wall rays, aim is rate-limited and
// gated by a reaction timer, and every shot goes through player.damage() so a
// bot that is visible in the kill feed is also a real threat.
import * as THREE from 'three';
import { MAP, PALETTE, ECONOMY } from './config.js';
import { clamp, mulberry32, rayAABB, angleDelta } from './util.js';

const ROUTES = {
  anchorA: [[-8, -18], [-16, -16], [-19, -12], [-13, -7], [-8, -4], [-3, -5], [-8, -4], [-13, -7], [-19, -12], [-16, -16]],
  anchorB: [[8, -18], [16, -16], [19, -13], [13, -7], [8, -4], [3, -9], [8, -4], [13, -7], [19, -13], [16, -16]],
  roam: [[0, -14], [-3, -5], [-8, -4], [-13, -7], [-16, -16], [-8, -4], [-3, -5], [3, -9], [8, -4], [13, -7], [16, -16], [8, -4], [0, -2]],
};

const SPAWNS = [[-2, -20], [0, -20], [2, -20]];

export function createBots(state, scene, map, nav, player, hud, audio, effects) {
  const rng = mulberry32(4242);
  const squad = [];
  const scratch = { hit: false, bot: null, zone: '', t: Infinity, x: 0, y: 0, z: 0 };
  const vestMat = new THREE.MeshStandardMaterial({ color: PALETTE.rust, roughness: 0.66, metalness: 0.18, emissive: PALETTE.rust, emissiveIntensity: 0.22 });
  const plateMat = new THREE.MeshStandardMaterial({ color: 0x6e3620, roughness: 0.5, metalness: 0.3, emissive: PALETTE.rust, emissiveIntensity: 0.22 });
  const clothMat = new THREE.MeshStandardMaterial({ color: 0x131a22, roughness: 0.9, metalness: 0.05 });
  const helmetMat = new THREE.MeshStandardMaterial({ color: 0x222c36, roughness: 0.55, metalness: 0.35 });
  const gunMat = new THREE.MeshStandardMaterial({ color: 0x3a4752, roughness: 0.42, metalness: 0.4 });
  const barrelMat = new THREE.MeshStandardMaterial({ color: 0x7d8a94, roughness: 0.36, metalness: 0.55 });
  const gloveMat = new THREE.MeshStandardMaterial({ color: 0x4b5359, roughness: 0.85 });
  const bootMat = new THREE.MeshStandardMaterial({ color: 0x10161d, roughness: 0.92 });
  const visorCyan = new THREE.MeshStandardMaterial({ color: PALETTE.cyan, emissive: PALETTE.cyan, emissiveIntensity: 1.6, roughness: 0.35 });
  const visorWarm = new THREE.MeshStandardMaterial({ color: PALETTE.sodium, emissive: PALETTE.sodium, emissiveIntensity: 1.45, roughness: 0.35 });

  const defs = [
    { name: 'WARDEN', role: 'anchorA', route: ROUTES.anchorA, weapon: 'smg', spawn: SPAWNS[0], visor: visorWarm },
    { name: 'SABLE', role: 'anchorB', route: ROUTES.anchorB, weapon: 'smg', spawn: SPAWNS[1], visor: visorCyan },
    { name: 'CUTTER', role: 'roam', route: ROUTES.roam, weapon: 'rifle', spawn: SPAWNS[2], visor: visorCyan },
  ];

  function makePart(minx, miny, minz, maxx, maxy, maxz, zone) {
    return { minx, miny, minz, maxx, maxy, maxz, zone };
  }

  for (let i = 0; i < defs.length; i++) {
    const def = defs[i];
    const group = new THREE.Group();
    const legL = addBox(group, 0.17, 0.8, 0.2, -0.13, 0.42, 0, clothMat);
    const legR = addBox(group, 0.17, 0.8, 0.2, 0.13, 0.42, 0, clothMat);
    addBox(legL, 0.19, 0.12, 0.27, 0, -0.36, 0.04, bootMat);
    addBox(legR, 0.19, 0.12, 0.27, 0, -0.36, 0.04, bootMat);
    addBox(legL, 0.16, 0.12, 0.05, 0, -0.08, 0.1, plateMat);
    addBox(legR, 0.16, 0.12, 0.05, 0, -0.08, 0.1, plateMat);
    addBox(group, 0.5, 0.58, 0.3, 0, 1.18, 0, vestMat);
    addBox(group, 0.42, 0.34, 0.05, 0, 1.24, 0.17, plateMat);
    addBox(group, 0.11, 0.1, 0.04, -0.13, 1.08, 0.2, clothMat);
    addBox(group, 0.11, 0.1, 0.04, 0, 1.08, 0.2, clothMat);
    addBox(group, 0.11, 0.1, 0.04, 0.13, 1.08, 0.2, clothMat);
    addBox(group, 0.44, 0.12, 0.32, 0, 0.93, 0, helmetMat);
    addBox(group, 0.17, 0.11, 0.24, -0.33, 1.42, 0, plateMat);
    addBox(group, 0.17, 0.11, 0.24, 0.33, 1.42, 0, plateMat);
    const head = addBox(group, 0.27, 0.28, 0.28, 0, 1.62, 0, helmetMat);
    addBox(group, 0.29, 0.09, 0.3, 0, 1.77, -0.01, helmetMat);
    const dome = new THREE.Mesh(new THREE.SphereGeometry(0.15, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2), helmetMat);
    dome.position.set(0, 1.78, 0);
    dome.scale.set(1, 0.75, 1);
    group.add(dome);
    const visor = addBox(group, 0.2, 0.07, 0.035, 0, 1.64, 0.15, def.visor);
    const armL = addBox(group, 0.13, 0.5, 0.15, -0.3, 1.15, 0.02, clothMat);
    const armR = addBox(group, 0.13, 0.5, 0.15, 0.3, 1.15, 0.02, clothMat);
    addBox(armL, 0.11, 0.1, 0.12, 0, -0.27, 0.02, gloveMat);
    addBox(armR, 0.11, 0.1, 0.12, 0, -0.27, 0.02, gloveMat);
    const gun = new THREE.Group();
    gun.position.set(-0.04, 1.18, 0.2);
    gun.rotation.set(0.1, 1.32, 0.14);
    group.add(gun);
    const addGun = (w, h, d, x, y, z, mat = gunMat) => {
      const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
      mesh.position.set(x, y, z);
      gun.add(mesh);
      return mesh;
    };
    addGun(0.05, 0.07, 0.34, 0, 0, 0);
    addGun(0.026, 0.026, 0.2, 0, 0.012, 0.26, barrelMat);
    addGun(0.036, 0.036, 0.05, 0, 0.012, 0.37, barrelMat);
    addGun(0.034, 0.09, 0.05, 0, -0.062, -0.04, barrelMat);
    addGun(0.042, 0.06, 0.13, 0, -0.004, -0.23);
    addGun(0.03, 0.03, 0.05, 0, 0.055, -0.02, barrelMat);
    addGun(0.016, 0.05, 0.016, 0, 0.05, 0.17, barrelMat);
    addGun(0.05, 0.07, 0.05, 0, -0.008, -0.19, gloveMat);
    addGun(0.05, 0.065, 0.05, 0, -0.032, 0.04, gloveMat);
    addGun(0.06, 0.065, 0.24, 0.02, -0.075, 0.03, gunMat);
    addGun(0.06, 0.065, 0.2, -0.03, -0.06, -0.12, gunMat);
    addBox(group, 0.18, 0.2, 0.12, 0, 1.25, -0.2, clothMat);
    const contact = new THREE.Mesh(new THREE.CircleGeometry(0.5, 18), new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.3, depthWrite: false }));
    contact.rotation.x = -Math.PI / 2;
    contact.position.y = 0.015;
    group.add(contact);
    group.visible = false;
    scene.add(group);
    const drop = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.1, 0.5), gunMat);
    drop.visible = false;
    scene.add(drop);
    const bot = {
      id: i, name: def.name, role: def.role, weapon: def.weapon, route: def.route,
      routeIndex: 0, x: def.spawn[0], y: 0, z: def.spawn[1], yaw: 0, baseYaw: 0,
      health: 100, alive: true, state: 'idle', group, legL, legR, armL, armR, gun, visor, head, drop,
      path: { xs: new Float32Array(128), zs: new Float32Array(128), n: 0 }, pathIndex: 0,
      repath: 0, goalX: 0, goalZ: 0, lastSeenX: 0, lastSeenZ: 0, lastSeenAt: -99,
      lastHeardX: 0, lastHeardZ: 0, lastHeardAt: -99, seeing: false, reaction: 0,
      burstLeft: 0, burstTimer: 0, mag: 30, reloadTimer: 0, blind: 0, defuse: 0,
      anim: 0, deathT: 0, pause: 0, scan: rng() * 6, strafe: 1, strafeTimer: 0,
      lastCall: -99, crouch: false, hold: 0,
      parts: [
        makePart(0, 0, 0, 0, 0, 0, 'head'),
        makePart(0, 0, 0, 0, 0, 0, 'body'),
        makePart(0, 0, 0, 0, 0, 0, 'legs'),
      ],
    };
    updateParts(bot);
    squad.push(bot);
  }

  function addBox(parent, w, h, d, x, y, z, material) {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material);
    mesh.position.set(x, y, z);
    mesh.castShadow = true;
    parent.add(mesh);
    return mesh;
  }

  function updateParts(bot) {
    const head = bot.parts[0];
    head.minx = bot.x - 0.17; head.maxx = bot.x + 0.17;
    head.miny = bot.y + 1.46; head.maxy = bot.y + 1.8;
    head.minz = bot.z - 0.17; head.maxz = bot.z + 0.17;
    const body = bot.parts[1];
    body.minx = bot.x - 0.28; body.maxx = bot.x + 0.28;
    body.miny = bot.y + 0.88; body.maxy = bot.y + 1.46;
    body.minz = bot.z - 0.2; body.maxz = bot.z + 0.2;
    const legs = bot.parts[2];
    legs.minx = bot.x - 0.24; legs.maxx = bot.x + 0.24;
    legs.miny = bot.y + 0.02; legs.maxy = bot.y + 0.88;
    legs.minz = bot.z - 0.18; legs.maxz = bot.z + 0.18;
  }

  function place(bot) {
    bot.group.position.set(bot.x, bot.y, bot.z);
    bot.group.rotation.y = bot.yaw;
    bot.group.rotation.z = 0;
    bot.group.scale.y = bot.crouch ? 0.86 : 1;
    updateParts(bot);
  }

  function spawnRound() {
    for (const bot of squad) {
      bot.x = bot.role === 'anchorA' ? SPAWNS[0][0] : bot.role === 'anchorB' ? SPAWNS[1][0] : SPAWNS[2][0];
      bot.z = -20;
      bot.y = 0;
      bot.yaw = 0;
      bot.baseYaw = 0;
      bot.health = 100;
      bot.alive = true;
      bot.state = 'idle';
      bot.routeIndex = 0;
      bot.path.n = 0;
      bot.pathIndex = 0;
      bot.repath = 0;
      bot.lastSeenAt = -99;
      bot.lastHeardAt = -99;
      bot.seeing = false;
      bot.reaction = 0;
      bot.burstLeft = 0;
      bot.burstTimer = 0;
      bot.mag = 30;
      bot.reloadTimer = 0;
      bot.blind = 0;
      bot.defuse = 0;
      bot.deathT = 0;
      bot.pause = 0;
      bot.crouch = false;
      bot.hold = 0;
      bot.group.visible = true;
      bot.group.rotation.z = 0;
      bot.drop.visible = false;
      bot.gun.visible = true;
      place(bot);
    }
  }

  function activate() {
    for (const bot of squad) {
      if (!bot.alive) continue;
      bot.state = 'patrol';
      bot.routeIndex = 0;
      bot.pause = 0;
      planTo(bot, bot.route[0][0], bot.route[0][1], true);
    }
  }

  function planTo(bot, x, z, force = false) {
    if (!force && Math.abs(x - bot.goalX) < 0.8 && Math.abs(z - bot.goalZ) < 0.8 && bot.path.n > 0) return;
    bot.goalX = x;
    bot.goalZ = z;
    nav.findPath(bot.x, bot.z, x, z, bot.path);
    bot.pathIndex = 0;
    bot.repath = 0.7;
  }

  function stepTo(bot, nx, nz) {
    if (nav.freeCell(nx, bot.z)) bot.x = nx;
    else bot.repath = 0;
    if (nav.freeCell(bot.x, nz)) bot.z = nz;
    else bot.repath = 0;
  }

  function follow(bot, dt, speed) {
    if (bot.pathIndex >= bot.path.n) return true;
    const tx = bot.path.xs[bot.pathIndex];
    const tz = bot.path.zs[bot.pathIndex];
    let dx = tx - bot.x;
    let dz = tz - bot.z;
    let dist = Math.hypot(dx, dz);
    if (dist < 0.5) {
      bot.pathIndex += 1;
      return bot.pathIndex >= bot.path.n;
    }
    dx /= dist;
    dz /= dist;
    // Simple squad separation keeps three bodies from stacking in a door.
    for (const other of squad) {
      if (other === bot || !other.alive) continue;
      const ox = bot.x - other.x;
      const oz = bot.z - other.z;
      const od = Math.hypot(ox, oz);
      if (od > 0.001 && od < 0.95) {
        dx += (ox / od) * 0.7;
        dz += (oz / od) * 0.7;
        dist = Math.hypot(dx, dz) || 1;
        dx /= dist;
        dz /= dist;
      }
    }
    const step = Math.min(dist, speed * dt);
    stepTo(bot, bot.x + dx * step, bot.z + dz * step);
    bot.anim += step * 3.6;
    const targetYaw = Math.atan2(dx, dz);
    bot.yaw += clamp(angleDelta(bot.yaw, targetYaw), -5 * dt, 5 * dt);
    return false;
  }

  function seesPlayer(bot) {
    if (!state.alive || bot.blind > 0) return false;
    const dx = state.player.x - bot.x;
    const dz = state.player.z - bot.z;
    const distance = Math.hypot(dx, dz);
    if (distance > 42 || distance < 0.01) return false;
    const facingX = Math.sin(bot.yaw);
    const facingZ = Math.cos(bot.yaw);
    if ((dx / distance) * facingX + (dz / distance) * facingZ < 0.5736) return false;
    const eyeY = bot.y + 1.58;
    const chestY = state.player.y + 1.25;
    const headY = state.player.y + 1.62;
    const chestDir = [dx / distance, (chestY - eyeY) / distance, dz / distance];
    const headDir = [dx / distance, (headY - eyeY) / distance, dz / distance];
    if (!map.blocked(bot.x, eyeY, bot.z, chestDir[0], chestDir[1], chestDir[2], distance)) return true;
    if (!map.blocked(bot.x, eyeY, bot.z, headDir[0], headDir[1], headDir[2], distance)) return true;
    return false;
  }

  function acquire(bot) {
    const distance = Math.hypot(state.player.x - bot.x, state.player.z - bot.z);
    bot.seeing = true;
    bot.lastSeenX = state.player.x;
    bot.lastSeenZ = state.player.z;
    bot.lastSeenAt = state.time;
    if (state.time - bot.lastCall > 5 && distance < 40) {
      bot.lastCall = state.time;
      hud.callout(`${bot.name} · CONTACT`);
      audio.callout();
      for (const other of squad) {
        if (other !== bot && other.alive && Math.hypot(other.x - bot.x, other.z - bot.z) < 14 && other.lastSeenAt < state.time - 1) {
          other.state = 'investigate';
          other.lastHeardX = state.player.x;
          other.lastHeardZ = state.player.z;
          other.lastHeardAt = state.time;
        }
      }
    }
  }

  function shoot(bot, distance) {
    if (state.mode !== 'live' && state.mode !== 'planted') return;
    if (!state.alive || bot.reloadTimer > 0 || bot.mag <= 0) return;
    const fx = Math.sin(bot.yaw);
    const fz = Math.cos(bot.yaw);
    const aim = Math.atan2(state.player.x - bot.x, state.player.z - bot.z);
    if (Math.abs(angleDelta(bot.yaw, aim)) > 0.28) return;
    bot.mag -= 1;
    bot.burstLeft -= 1;
    const moving = state.player.speed > 1.5;
    const chance = clamp(0.82 - distance * 0.013 - (moving ? 0.16 : 0) - (state.player.crouch ? 0.05 : 0), 0.22, 0.86);
    const hit = rng() < chance;
    const damage = bot.weapon === 'smg' ? 12 : 16;
    const muzzleX = bot.x + fx * 0.55 + fz * 0.18;
    const muzzleY = bot.y + 1.2;
    const muzzleZ = bot.z + fz * 0.55 - fx * 0.18;
    const dirX = (state.player.x - muzzleX) / distance;
    const dirY = (state.player.y + 1.2 - muzzleY) / distance;
    const dirZ = (state.player.z - muzzleZ) / distance;
    effects.tracer(muzzleX, muzzleY, muzzleZ, dirX, dirY, dirZ, PALETTE.danger);
    if (hit) {
      player.damage(damage, bot.x, bot.z);
    }
    audio.botShot(bot.weapon === 'smg' ? 0.55 : 0.7);
    if (bot.mag <= 0) bot.reloadTimer = 1.8;
  }

  function loseTarget(bot) {
    bot.seeing = false;
    if (bot.state === 'engage') {
      bot.state = 'investigate';
      bot.lastHeardX = bot.lastSeenX;
      bot.lastHeardZ = bot.lastSeenZ;
      bot.lastHeardAt = state.time;
      planTo(bot, bot.lastSeenX, bot.lastSeenZ, true);
    }
  }

  function engage(bot, dt, distance) {
    const tx = state.player.x;
    const tz = state.player.z;
    const aim = Math.atan2(tx - bot.x, tz - bot.z);
    bot.yaw += clamp(angleDelta(bot.yaw, aim), -5.5 * dt, 5.5 * dt);
    bot.strafeTimer -= dt;
    if (bot.strafeTimer <= 0) {
      bot.strafeTimer = 0.8 + rng() * 0.6;
      bot.strafe = rng() < 0.5 ? -1 : 1;
    }
    if (distance > 17) {
      if (bot.repath <= 0) planTo(bot, tx, tz);
      follow(bot, dt, 4.2);
    } else if (distance < 6) {
      const bx = Math.cos(bot.yaw) * bot.strafe;
      const bz = -Math.sin(bot.yaw) * bot.strafe;
      stepTo(bot, bot.x + bx * 2.4 * dt, bot.z + bz * 2.4 * dt);
    } else {
      const sx = Math.cos(bot.yaw) * bot.strafe;
      const sz = -Math.sin(bot.yaw) * bot.strafe;
      stepTo(bot, bot.x + sx * 1.7 * dt, bot.z + sz * 1.7 * dt);
      bot.anim += dt * 3;
    }
    if (bot.burstTimer > 0) bot.burstTimer -= dt;
    if (bot.burstLeft <= 0 && bot.burstTimer <= 0) {
      bot.burstLeft = 3 + Math.floor(rng() * 4);
      bot.burstTimer = 0;
    }
    if (bot.seeing && bot.reaction <= 0 && bot.burstLeft > 0 && bot.burstTimer <= 0) {
      shoot(bot, distance);
      bot.burstTimer = 0.25;
      if (bot.burstLeft <= 0) bot.burstTimer = 0.45 + rng() * 0.55;
    }
  }

  function investigate(bot, dt) {
    const distance = Math.hypot(bot.lastHeardX - bot.x, bot.lastHeardZ - bot.z);
    if (bot.repath <= 0) {
      planTo(bot, bot.lastHeardX, bot.lastHeardZ);
    }
    if (follow(bot, dt, 4.2) || distance < 0.8) {
      bot.state = 'idle';
      bot.pause = 1.6 + rng();
      bot.baseYaw = bot.yaw;
      bot.crouch = rng() < 0.25;
    }
  }

  function patrol(bot, dt) {
    if (bot.pause > 0) {
      bot.pause -= dt;
      bot.scan += dt;
      bot.yaw = bot.baseYaw + Math.sin(bot.scan * 1.4) * 0.85;
      return;
    }
    const node = bot.route[bot.routeIndex];
    if (bot.repath <= 0) planTo(bot, node[0], node[1]);
    if (follow(bot, dt, 3.4)) {
      bot.routeIndex = (bot.routeIndex + 1) % bot.route.length;
      bot.pause = 1.2 + rng() * 1.2;
      bot.baseYaw = bot.yaw;
      bot.crouch = rng() < 0.25;
      bot.state = 'idle';
      bot.hold = state.time;
    }
  }

  function bombLogic(bot, dt, distanceToPlayer) {
    if (!state.bomb.planted) return false;
    const bx = state.bomb.x;
    const bz = state.bomb.z;
    const distance = Math.hypot(bx - bot.x, bz - bot.z);
    if (distanceToPlayer < 15 && bot.seeing) {
      bot.defuse = 0;
      if (state.bomb.defuserId === bot.id) {
        state.bomb.defuserId = -1;
        state.bomb.defusing = false;
        state.bomb.defuse = 0;
      }
      bot.state = 'engage';
      return true;
    }
    if (distance < 1.6 && !bot.seeing && (state.bomb.defuserId === -1 || state.bomb.defuserId === bot.id)) {
      if (state.bomb.defuserId === -1) {
        state.bomb.defuserId = bot.id;
        bot.defuse = 0;
      }
      bot.state = 'defuse';
      bot.defuse += dt;
      state.bomb.defuse = bot.defuse;
      state.bomb.defusing = true;
      bot.yaw += clamp(angleDelta(bot.yaw, Math.atan2(bx - bot.x, bz - bot.z)), -3 * dt, 3 * dt);
      if (bot.defuse >= 5) state.bomb.defuse = 5;
      return true;
    }
    if (distance < 3 && state.bomb.defuserId !== -1 && state.bomb.defuserId !== bot.id) {
      bot.state = 'idle';
      return true;
    }
    if (state.bomb.defuserId === bot.id) {
      // The defuser left the charge: release it so another bot can start.
      state.bomb.defuserId = -1;
      state.bomb.defusing = false;
      state.bomb.defuse = 0;
      bot.defuse = 0;
    }
    bot.state = 'investigate';
    bot.lastHeardX = bx;
    bot.lastHeardZ = bz;
    if (bot.repath <= 0) planTo(bot, bx, bz);
    follow(bot, dt, 4.2);
    return true;
  }

  function update(dt) {
    for (const bot of squad) {
      if (!bot.alive) {
        if (bot.deathT < 1.2) {
          bot.deathT += dt;
          bot.group.rotation.z = Math.min(Math.PI / 2, bot.deathT * 3);
          bot.group.position.y = -Math.min(0.12, bot.deathT * 0.15);
        } else {
          bot.group.visible = false;
        }
        continue;
      }
      bot.repath -= dt;
      bot.reloadTimer = Math.max(0, bot.reloadTimer - dt);
      bot.blind = Math.max(0, bot.blind - dt);
      bot.reaction = Math.max(0, bot.reaction - dt);
      if (bot.reloadTimer === 0 && bot.mag <= 0) bot.mag = 30;

      const dx = state.player.x - bot.x;
      const dz = state.player.z - bot.z;
      const distance = Math.hypot(dx, dz);
      const visible = seesPlayer(bot);
      if (visible) {
        if (!bot.seeing) {
          bot.reaction = 0.25 + rng() * 0.2;
          acquire(bot);
        } else {
          acquire(bot);
        }
        if (bot.reaction <= 0 && bot.state !== 'defuse') bot.state = 'engage';
      } else {
        if (bot.seeing) loseTarget(bot);
        else bot.seeing = false;
      }

      const busy = bombLogic(bot, dt, distance);
      if (!busy) {
        if (bot.state === 'engage') engage(bot, dt, distance);
        else if (bot.state === 'investigate') investigate(bot, dt);
        else if (bot.state === 'patrol') patrol(bot, dt);
        else {
          bot.pause -= dt;
          bot.yaw = bot.baseYaw + Math.sin((state.time + bot.scan) * 0.9) * 0.4;
          if (bot.pause <= 0) {
            bot.state = 'patrol';
            if (bot.routeIndex >= bot.route.length) bot.routeIndex = 0;
            planTo(bot, bot.route[bot.routeIndex][0], bot.route[bot.routeIndex][1], true);
          }
        }
      } else if (bot.state === 'engage') {
        engage(bot, dt, distance);
      }

      // Bots live on the ground plane; nav paths already avoid solid boxes.
      bot.y = 0;
      bot.x = clamp(bot.x, MAP.minX + 1, MAP.maxX - 1);
      bot.z = clamp(bot.z, MAP.minZ + 1, MAP.maxZ - 1);
      bot.group.position.set(bot.x, bot.y, bot.z);
      bot.group.rotation.y = bot.yaw;
      bot.group.scale.y = bot.crouch ? 0.86 : 1;
      const swing = Math.sin(bot.anim) * 0.45;
      bot.legL.rotation.x = swing;
      bot.legR.rotation.x = -swing;
      bot.armL.rotation.x = -swing * 0.4;
      bot.armR.rotation.x = swing * 0.4;
      updateParts(bot);
    }
  }

  function damage(bot, amount, zone) {
    if (!bot.alive) return;
    bot.health -= amount;
    bot.lastSeenX = state.player.x;
    bot.lastSeenZ = state.player.z;
    bot.lastSeenAt = state.time;
    bot.defuse = 0;
    if (state.bomb.defuserId === bot.id) {
      state.bomb.defuserId = -1;
      state.bomb.defusing = false;
      state.bomb.defuse = 0;
    }
    if (bot.health <= 0) {
      bot.health = 0;
      bot.alive = false;
      bot.state = 'dead';
      bot.deathT = 0;
      bot.drop.position.set(bot.x, 0.12, bot.z);
      bot.drop.rotation.set(0, bot.yaw, Math.PI / 2);
      bot.drop.visible = true;
      bot.gun.visible = false;
      state.kills += 1;
      state.money = Math.min(ECONOMY.cap, state.money + ECONOMY.kill);
      hud.addFeed(`YOU > RUST.${bot.name}${zone === 'head' ? ' [HEADSHOT]' : ''}`, 'you');
      audio.hit(true);
      for (const other of squad) {
        if (other !== bot && other.alive && Math.hypot(other.x - bot.x, other.z - bot.z) < 14) {
          other.state = 'investigate';
          other.lastHeardX = state.player.x;
          other.lastHeardZ = state.player.z;
          other.lastHeardAt = state.time;
          other.repath = 0;
        }
      }
    } else {
      bot.state = 'engage';
      bot.reaction = Math.min(bot.reaction, 0.18);
      bot.seeing = seesPlayer(bot);
      if (!bot.seeing) {
        bot.state = 'investigate';
        bot.lastHeardX = state.player.x;
        bot.lastHeardZ = state.player.z;
        planTo(bot, bot.lastHeardX, bot.lastHeardZ, true);
      }
    }
  }

  function raycast(ox, oy, oz, dx, dy, dz, maxT) {
    let best = maxT;
    scratch.hit = false;
    scratch.bot = null;
    scratch.t = best;
    for (const bot of squad) {
      if (!bot.alive) continue;
      for (let p = 0; p < bot.parts.length; p++) {
        const part = bot.parts[p];
        const t = rayAABB(ox, oy, oz, dx, dy, dz, part);
        if (t < best) {
          best = t;
          scratch.hit = true;
          scratch.bot = bot;
          scratch.zone = part.zone;
          scratch.t = t;
          scratch.x = ox + dx * t;
          scratch.y = oy + dy * t;
          scratch.z = oz + dz * t;
        }
      }
    }
    return scratch;
  }

  function hear(x, z, radius) {
    for (const bot of squad) {
      if (!bot.alive) continue;
      if (Math.hypot(bot.x - x, bot.z - z) > radius) continue;
      bot.lastHeardX = x;
      bot.lastHeardZ = z;
      bot.lastHeardAt = state.time;
      if (bot.state !== 'engage' && bot.state !== 'defuse') {
        bot.state = 'investigate';
        bot.repath = 0;
      }
    }
  }

  function flash(x, z, radius, duration) {
    for (const bot of squad) {
      if (!bot.alive) continue;
      const distance = Math.hypot(bot.x - x, bot.z - z);
      if (distance > radius) continue;
      const dx = (bot.x - x) / (distance || 1);
      const dz = (bot.z - z) / (distance || 1);
      if (map.blocked(x, 1.4, z, dx, 0, dz, distance)) continue;
      bot.blind = Math.max(bot.blind, duration);
      bot.seeing = false;
    }
  }

  function allDead() { return squad.every((bot) => !bot.alive); }

  // Shot staging uses the real spawned squad; it only places a body and pose.
  function stage(bot, x, z, yaw, pose = 0) {
    bot.x = x;
    bot.z = z;
    bot.y = 0;
    bot.yaw = yaw;
    bot.baseYaw = yaw;
    bot.seeing = false;
    bot.state = 'idle';
    bot.pause = 99;
    bot.group.visible = true;
    bot.group.position.set(x, 0, z);
    bot.group.rotation.set(0, yaw, 0);
    bot.group.scale.y = 1;
    bot.gun.visible = bot.alive;
    // Mirror the carry for SABLE and tie the tilt to the lean, so a staged pair
    // never stands in two identical poses.
    const mirror = bot.name === 'SABLE' ? -1 : 1;
    bot.gun.rotation.set(0.1 + pose * 0.22, mirror * (1.32 + pose * 0.25), 0.14 + pose * 0.3);
    bot.legL.rotation.x = pose;
    bot.legR.rotation.x = -pose;
    bot.armL.rotation.x = -1.15;
    bot.armR.rotation.x = -0.95;
    bot.armL.rotation.z = 0.55;
    bot.armR.rotation.z = -0.5;
    updateParts(bot);
  }

  return { squad, spawnRound, activate, update, damage, raycast, hear, flash, allDead, stage };
}
