// Three RUST defenders: box-built silhouettes, A* patrols, vision/hearing,
// burst fire, squad alerts, bomb defusal and death cleanup.
import * as THREE from 'three';
import { BOT, BOT_ROLES, COLORS, ECONOMY, ROUNDS } from './config.js';
import { angleDiff, clamp, lineOfSight } from './util.js';

const eyeScratch = { x: 0, y: 0, z: 0 };

function makeVisor(color) {
  return new THREE.MeshBasicMaterial({ color });
}

export function createBots(state, scene, nav, audio, effects, player) {
  const bots = [];
  const separation = new THREE.Vector3();

  const makeBot = (role, index) => {
    const group = new THREE.Group();
    const vest = new THREE.MeshStandardMaterial({ color: 0xb4552d, roughness: 0.72, metalness: 0.15 });
    const cloth = new THREE.MeshStandardMaterial({ color: 0x202a31, roughness: 0.85, metalness: 0.05 });
    const helmetMat = new THREE.MeshStandardMaterial({ color: 0x151c22, roughness: 0.6, metalness: 0.35 });
    const skin = new THREE.MeshStandardMaterial({ color: 0x8a6a55, roughness: 0.9 });
    const visorMat = makeVisor(role.site === 'MID' ? COLORS.cyan : 0xffb15c);
    const bootMat = new THREE.MeshStandardMaterial({ color: 0x11171d, roughness: 0.8 });

    const torso = new THREE.Mesh(new THREE.BoxGeometry(0.48, 0.6, 0.28), vest);
    torso.position.y = 1.12;
    group.add(torso);
    torso.userData.zone = 'body';
    const plate = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.42, 0.08), new THREE.MeshStandardMaterial({ color: 0x6f3d27, roughness: 0.65, metalness: 0.2 }));
    plate.position.set(0, 1.12, -0.17);
    group.add(plate);
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.27, 0.27), skin);
    head.position.y = 1.6;
    group.add(head);
    head.userData.zone = 'head';
    const helmet = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.13, 0.33), helmetMat);
    helmet.position.y = 1.75;
    group.add(helmet);
    const visor = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.055, 0.015), visorMat);
    visor.position.set(0, 1.63, -0.145);
    group.add(visor);

    const legs = [];
    for (const side of [-1, 1]) {
      const leg = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.78, 0.19), cloth);
      leg.position.set(side * 0.12, 0.41, 0);
      leg.userData.zone = 'legs';
      group.add(leg);
      legs.push(leg);
      const boot = new THREE.Mesh(new THREE.BoxGeometry(0.17, 0.12, 0.26), bootMat);
      boot.position.set(side * 0.12, 0.06, -0.03);
      group.add(boot);
    }
    const arms = [];
    for (const side of [-1, 1]) {
      const arm = new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.52, 0.15), vest);
      arm.position.set(side * 0.31, 1.18, 0);
      group.add(arm);
      arms.push(arm);
    }
    const backpack = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.4, 0.14), bootMat);
    backpack.position.set(0, 1.16, 0.18);
    group.add(backpack);
    const gun = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.09, 0.42), new THREE.MeshStandardMaterial({ color: 0x27323b, roughness: 0.5, metalness: 0.5 }));
    gun.position.set(0.13, 1.2, -0.26);
    group.add(gun);
    const flash = new THREE.Sprite(
      new THREE.SpriteMaterial({ color: 0xffc16f, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending }),
    );
    flash.scale.setScalar(0.16);
    flash.position.set(0.13, 1.22, -0.5);
    group.add(flash);

    const drop = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.09, 0.48), gun.material);
    drop.visible = false;
    scene.add(drop);

    group.position.set(role.spawn[0], 0, role.spawn[1]);
    scene.add(group);
    const bot = {
      id: role.id,
      name: role.name,
      role,
      index,
      group,
      head,
      torso,
      legs,
      arms,
      gun,
      flash,
      drop,
      hitMeshes: [head, torso, ...legs],
      x: role.spawn[0],
      z: role.spawn[1],
      yaw: 0,
      health: 100,
      armor: 0,
      dead: false,
      deadT: 0,
      state: 'patrol',
      routeIndex: 0,
      path: [],
      pathIndex: 0,
      goalX: 0,
      goalZ: 0,
      replan: 0,
      reaction: 0,
      burst: 0,
      burstLeft: 0,
      burstGap: 0.25,
      ammo: 30,
      reload: 0,
      lastSeenX: 0,
      lastSeenZ: 0,
      lastSeenT: -99,
      lastHeardX: 0,
      lastHeardZ: 0,
      lastHeardT: -99,
      canSee: false,
      defusing: false,
      pause: 0,
      scan: 0,
      strafe: 1,
      strafeT: 0,
      muzzleT: 0,
      callout: 0,
      blind: 0,
      crouch: false,
      hitFlash: 0,
    };
    for (const mesh of bot.hitMeshes) {
      mesh.userData.bot = bot;
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      state.shootables.push(mesh);
    }
    return bot;
  };

  for (let i = 0; i < BOT_ROLES.length; i += 1) bots.push(makeBot(BOT_ROLES[i], i));
  state.bots = bots;

  const eyeHeight = BOT.eye;
  const seesPlayer = (bot) => {
    const p = state.player;
    if (!p.alive || bot.dead || bot.blind > 0) return false;
    if (state.round.phase !== 'live' && state.round.phase !== 'planted') return false;
    const dx = p.pos.x - bot.x;
    const dz = p.pos.z - bot.z;
    const dist = Math.hypot(dx, dz);
    if (dist > BOT.range || dist < 0.01) return false;
    const forwardX = -Math.sin(bot.yaw);
    const forwardZ = -Math.cos(bot.yaw);
    const dot = (dx * forwardX + dz * forwardZ) / dist;
    if (dot < Math.cos((BOT.fov * Math.PI) / 360)) return false;
    eyeScratch.x = bot.x;
    eyeScratch.y = eyeHeight;
    eyeScratch.z = bot.z;
    const chest = lineOfSight(state, bot.x, eyeHeight, bot.z, p.pos.x, p.pos.y + 1.05, p.pos.z);
    if (chest) return true;
    return lineOfSight(state, bot.x, eyeHeight, bot.z, p.pos.x, p.pos.y + 1.55, p.pos.z);
  };

  const face = (bot, x, z, dt, rate = 7) => {
    const target = Math.atan2(-(x - bot.x), -(z - bot.z));
    bot.yaw += clamp(angleDiff(bot.yaw, target), -rate * dt, rate * dt);
  };

  const addMeshes = (bot) => {
    for (const mesh of bot.hitMeshes) {
      if (!state.shootables.includes(mesh)) state.shootables.push(mesh);
    }
  };

  const kill = (bot, zone) => {
    if (bot.dead) return;
    bot.dead = true;
    bot.deadT = 0;
    bot.defusing = false;
    bot.flash.material.opacity = 0;
    state.shootables = state.shootables.filter((mesh) => mesh.userData.bot !== bot);
    bot.drop.visible = true;
    bot.drop.position.set(bot.x, 0.06, bot.z);
    bot.drop.rotation.set(0, state.rng() * Math.PI, Math.PI / 2);
    if (audio) audio.botDown();
    state.stats.kills += 1;
    state.player.money = Math.min(ECONOMY.cap, state.player.money + ECONOMY.kill);
    state.feed.push({ text: `YOU > ${bot.name}${zone === 'head' ? ' [HEADSHOT]' : ''}`, head: zone === 'head', t: 4 });
    if (state.feed.length > 3) state.feed.shift();
  };

  const hit = (bot, zone, amount) => {
    if (bot.dead) return;
    bot.health -= amount;
    bot.hitFlash = 0.12;
    bot.defusing = false;
    bot.reaction = Math.min(bot.reaction, 0.12);
    if (bot.health <= 0) kill(bot, zone);
    else if (state.round.phase === 'planted' && state.round.plantSite) {
      bot.lastHeardX = state.bomb.x;
      bot.lastHeardZ = state.bomb.z;
      bot.state = 'defuse';
    }
  };

  const alertSquad = (source, radius) => {
    for (const other of bots) {
      if (other.dead || other === source) continue;
      if (Math.hypot(other.x - source.x, other.z - source.z) > radius) continue;
      other.lastHeardX = source.lastSeenX;
      other.lastHeardZ = source.lastSeenZ;
      other.lastHeardT = state.time;
      if (other.state !== 'engage' && other.state !== 'defuse') other.state = 'investigate';
    }
  };

  const hearing = (x, z, radius, boom = false) => {
    for (const bot of bots) {
      if (bot.dead) continue;
      const dist = Math.hypot(bot.x - x, bot.z - z);
      if (dist > radius) continue;
      bot.lastHeardX = x;
      bot.lastHeardZ = z;
      bot.lastHeardT = state.time;
      if (bot.state !== 'engage' && bot.state !== 'defuse') bot.state = 'investigate';
      if (!boom) alertSquad(bot, 12);
    }
  };

  const plantAlert = (x, z) => {
    for (const bot of bots) {
      if (bot.dead) continue;
      bot.lastHeardX = x;
      bot.lastHeardZ = z;
      bot.lastHeardT = state.time;
      bot.state = 'defuse';
      bot.pause = 0;
      bot.replan = 0;
    }
  };

  const explosion = (x, z, radius, damage) => {
    for (const bot of bots) {
      if (bot.dead) continue;
      const dist = Math.hypot(bot.x - x, bot.z - z);
      if (dist > radius) continue;
      if (!lineOfSight(state, x, 1, z, bot.x, 1.1, bot.z)) continue;
      const amount = 10 + (damage - 10) * (1 - dist / radius);
      hit(bot, 'body', amount);
    }
  };

  const flash = (x, z, radius, duration) => {
    for (const bot of bots) {
      if (bot.dead || Math.hypot(bot.x - x, bot.z - z) > radius) continue;
      if (!lineOfSight(state, x, 1, z, bot.x, 1.5, bot.z)) continue;
      bot.blind = Math.max(bot.blind, duration);
      bot.state = 'investigate';
      bot.lastHeardX = x;
      bot.lastHeardZ = z;
    }
  };

  const moveTo = (bot, tx, tz, speed, dt) => {
    const dx = tx - bot.x;
    const dz = tz - bot.z;
    const dist = Math.hypot(dx, dz);
    if (dist < 0.04) return;
    const step = Math.min(speed * dt, dist);
    const nx = bot.x + (dx / dist) * step;
    const nz = bot.z + (dz / dist) * step;
    let blocked = false;
    const r = 0.3;
    for (let i = 0; i < state.colliders.length; i += 1) {
      const c = state.colliders[i];
      if (c.minY > 1.4 || c.maxY < 0.3) continue;
      if (nx + r > c.minX && nx - r < c.maxX && nz + r > c.minZ && nz - r < c.maxZ) {
        blocked = true;
        break;
      }
    }
    if (!blocked) {
      bot.x = nx;
      bot.z = nz;
    } else {
      bot.replan = 0;
    }
    if (dist > 0.5) face(bot, tx, tz, dt, 7);
  };

  const followPath = (bot, gx, gz, speed, dt) => {
    const moved = Math.hypot(gx - bot.goalX, gz - bot.goalZ);
    bot.replan -= dt;
    if (bot.replan <= 0 || moved > 1.5 || bot.path.length === 0) {
      bot.replan = BOT.replan;
      bot.goalX = gx;
      bot.goalZ = gz;
      nav.findPath(bot.x, bot.z, gx, gz, bot.path);
      bot.pathIndex = 0;
    }
    while (bot.pathIndex * 2 + 1 < bot.path.length) {
      const wx = bot.path[bot.pathIndex * 2];
      const wz = bot.path[bot.pathIndex * 2 + 1];
      if (Math.hypot(wx - bot.x, wz - bot.z) < BOT.arrive) bot.pathIndex += 1;
      else break;
    }
    if (bot.pathIndex * 2 + 1 < bot.path.length) {
      moveTo(bot, bot.path[bot.pathIndex * 2], bot.path[bot.pathIndex * 2 + 1], speed, dt);
      return false;
    }
    return true;
  };

  const shoot = (bot, dt) => {
    const p = state.player;
    const dist = Math.hypot(p.pos.x - bot.x, p.pos.z - bot.z);
    bot.burstGap -= dt;
    if (bot.reload > 0) {
      bot.reload -= dt;
      if (bot.reload <= 0) bot.ammo = 30;
      return;
    }
    if (bot.burstLeft <= 0) {
      if (bot.burstGap > 0) return;
      bot.burstLeft = 3 + Math.floor(state.rng() * 4);
      bot.burstGap = 0.25 + state.rng() * 0.12;
    }
    if (bot.burstGap > 0) return;
    bot.burstGap = 0.25;
    bot.burstLeft -= 1;
    bot.ammo -= 1;
    if (bot.ammo <= 0) bot.reload = BOT.reload;
    bot.muzzleT = 0.05;
    if (audio) audio.botShot(dist);
    const chance = clamp(0.74 - dist * 0.013, 0.22, 0.74);
    const hitPlayer = state.rng() < chance;
    const tx = p.pos.x + (hitPlayer ? 0 : (state.rng() - 0.5) * 2.2);
    const ty = p.pos.y + 1.1 + (hitPlayer ? 0 : (state.rng() - 0.5) * 1.2);
    const tz = p.pos.z + (hitPlayer ? 0 : (state.rng() - 0.5) * 2.2);
    effects.tracer(bot.x - Math.sin(bot.yaw) * 0.3, 1.22, bot.z - Math.cos(bot.yaw) * 0.3, tx, ty, tz, 0xffb15c);
    if (hitPlayer) {
      const dmg = bot.role.weapon === 'rifle' ? BOT.damageRifle : BOT.damageSmg;
      player.takeDamage(dmg, bot.x, bot.z);
    }
  };

  const update = (dt) => {
    const p = state.player;
    for (const bot of bots) {
      if (bot.dead) {
        bot.deadT += dt;
        const t = Math.min(1, bot.deadT * 3);
        bot.group.rotation.z = -t * Math.PI * 0.5;
        bot.group.position.y = -t * 0.1;
        continue;
      }
      bot.hitFlash = Math.max(0, bot.hitFlash - dt);
      bot.muzzleT = Math.max(0, bot.muzzleT - dt);
      bot.flash.material.opacity = bot.muzzleT > 0 ? 1 : 0;
      bot.callout = Math.max(0, bot.callout - dt);
      bot.blind = Math.max(0, bot.blind - dt);
      if (state.round.phase !== 'live' && state.round.phase !== 'planted') continue;
      if (bot.blind > 0) {
        bot.canSee = false;
        bot.yaw += Math.sin(state.time * 2 + bot.index) * dt * 0.8;
        continue;
      }

      const canSee = seesPlayer(bot);
      bot.canSee = canSee;
      if (canSee) {
        bot.lastSeenX = p.pos.x;
        bot.lastSeenZ = p.pos.z;
        bot.lastSeenT = state.time;
        if (bot.state !== 'engage' && bot.state !== 'defuse') {
          bot.state = 'engage';
          bot.reaction = BOT.reactionMin + state.rng() * (BOT.reactionMax - BOT.reactionMin);
          if (bot.callout <= 0 && audio) {
            audio.callout();
            bot.callout = 3.5;
          }
          alertSquad(bot, 16);
        }
      }

      if (state.round.phase === 'planted' && !bot.defusing) {
        if (bot.state !== 'engage' || Math.hypot(p.pos.x - bot.x, p.pos.z - bot.z) > 9) {
          bot.state = 'defuse';
        }
      }

      if (bot.state === 'engage' && !canSee && state.time - bot.lastSeenT > 2.4) {
        bot.state = 'investigate';
        bot.replan = 0;
      }

      if (bot.state === 'engage') {
        bot.reaction = Math.max(0, bot.reaction - dt);
        if (canSee) {
          face(bot, p.pos.x, p.pos.z, dt, 8);
          const dist = Math.hypot(p.pos.x - bot.x, p.pos.z - bot.z);
          bot.strafeT -= dt;
          if (bot.strafeT <= 0) {
            bot.strafeT = 0.8 + state.rng() * 0.6;
            bot.strafe = -bot.strafe;
          }
          if (dist > 18) moveTo(bot, p.pos.x, p.pos.z, BOT.alertSpeed * 0.75, dt);
          else if (dist < 6) moveTo(bot, bot.x + (bot.x - p.pos.x), bot.z + (bot.z - p.pos.z), BOT.alertSpeed * 0.6, dt);
          else {
            const sideX = Math.cos(bot.yaw) * bot.strafe * BOT.alertSpeed * 0.45;
            const sideZ = -Math.sin(bot.yaw) * bot.strafe * BOT.alertSpeed * 0.45;
            moveTo(bot, bot.x + sideX, bot.z + sideZ, BOT.alertSpeed * 0.5, dt);
          }
          if (bot.reaction <= 0) shoot(bot, dt);
        } else if (bot.lastSeenT > 0) {
          followPath(bot, bot.lastSeenX, bot.lastSeenZ, BOT.alertSpeed, dt);
          if (Math.hypot(bot.lastSeenX - bot.x, bot.lastSeenZ - bot.z) < 1.2) {
            bot.state = 'investigate';
            bot.pause = 0.8;
          }
        }
      } else if (bot.state === 'defuse' && state.round.phase === 'planted') {
        const bx = state.bomb.x;
        const bz = state.bomb.z;
        const dist = Math.hypot(bx - bot.x, bz - bot.z);
        if (dist > ROUNDS.defuseRange) {
          bot.defusing = false;
          followPath(bot, bx, bz, BOT.alertSpeed, dt);
        } else if (canSee) {
          bot.defusing = false;
          bot.state = 'engage';
        } else {
          bot.defusing = true;
          face(bot, bx, bz, dt, 8);
          state.round.defusing = true;
          state.round.defuseProgress = Math.min(1, state.round.defuseProgress + dt / ROUNDS.defuse);
          if (state.round.defuseProgress >= 1) state.flags.defused = true;
        }
      } else if (bot.state === 'investigate') {
        const gx = bot.lastHeardT > bot.lastSeenT ? bot.lastHeardX : bot.lastSeenX;
        const gz = bot.lastHeardT > bot.lastSeenT ? bot.lastHeardZ : bot.lastSeenZ;
        const arrived = followPath(bot, gx, gz, BOT.alertSpeed, dt);
        if (arrived) {
          bot.pause -= dt;
          bot.yaw += Math.sin(state.time * 1.7 + bot.index) * dt * 1.1;
          if (bot.pause <= 0) {
            bot.pause = 1.2 + state.rng() * 1.2;
            bot.state = 'patrol';
            bot.replan = 0;
          }
        }
      } else {
        if (bot.pause > 0) {
          bot.pause -= dt;
          bot.yaw += Math.sin(state.time * 1.3 + bot.index) * dt * 0.9;
          if (state.round.phase === 'planted') bot.state = 'defuse';
        } else {
          const route = bot.role.route;
          const point = route[bot.routeIndex % route.length];
          const arrived = followPath(bot, point[0], point[1], BOT.patrolSpeed, dt);
          if (arrived) {
            bot.routeIndex = (bot.routeIndex + 1) % route.length;
            bot.pause = BOT.holdPause[0] + state.rng() * (BOT.holdPause[1] - BOT.holdPause[0]);
            bot.crouch = state.rng() < 0.25;
            bot.replan = 0;
            bot.path.length = 0;
          }
        }
      }

      // Simple separation keeps bots from stacking without adding colliders.
      separation.set(0, 0, 0);
      for (const other of bots) {
        if (other === bot || other.dead) continue;
        const dx = bot.x - other.x;
        const dz = bot.z - other.z;
        const d2 = dx * dx + dz * dz;
        if (d2 > 0.0001 && d2 < 0.72) {
          const inv = 1 / Math.sqrt(d2);
          separation.x += dx * inv;
          separation.z += dz * inv;
        }
      }
      if (separation.lengthSq() > 0) {
        bot.x += separation.x * dt * 0.9;
        bot.z += separation.z * dt * 0.9;
      }

      bot.group.position.x = bot.x;
      bot.group.position.z = bot.z;
      bot.group.position.y = bot.crouch ? -0.11 : 0;
      bot.group.rotation.y = bot.yaw;
      const walking = bot.state === 'patrol' || bot.state === 'investigate' || bot.state === 'defuse' || (bot.state === 'engage' && !bot.canSee);
      const cycle = state.time * (bot.state === 'engage' ? 8 : 6) + bot.index;
      const swing = walking ? Math.sin(cycle) * 0.45 : 0;
      bot.legs[0].rotation.x = swing;
      bot.legs[1].rotation.x = -swing;
      bot.arms[0].rotation.x = -swing * 0.6;
      bot.arms[1].rotation.x = swing * 0.35;
      bot.torso.rotation.z = walking ? Math.sin(cycle) * 0.035 : 0;
      if (bot.hitFlash > 0) {
        bot.torso.material.emissive.setHex(0x662211);
      } else {
        bot.torso.material.emissive.setHex(0x000000);
      }
    }
  };

  const reset = () => {
    for (const bot of bots) {
      bot.dead = false;
      bot.deadT = 0;
      bot.health = 100;
      bot.armor = 0;
      bot.state = 'patrol';
      bot.routeIndex = 0;
      bot.path.length = 0;
      bot.pathIndex = 0;
      bot.goalX = 999;
      bot.goalZ = 999;
      bot.replan = 0;
      bot.reaction = 0;
      bot.burstLeft = 0;
      bot.burstGap = 0;
      bot.ammo = 30;
      bot.reload = 0;
      bot.lastSeenT = -99;
      bot.lastHeardT = -99;
      bot.canSee = false;
      bot.defusing = false;
      bot.pause = 0;
      bot.blind = 0;
      bot.crouch = false;
      bot.callout = 0;
      bot.muzzleT = 0;
      bot.flash.material.opacity = 0;
      bot.x = bot.role.spawn[0];
      bot.z = bot.role.spawn[1];
      bot.yaw = 0;
      bot.group.visible = true;
      bot.group.position.set(bot.x, 0, bot.z);
      bot.group.rotation.set(0, 0, 0);
      bot.drop.visible = false;
      addMeshes(bot);
    }
  };

  const allDead = () => bots.every((bot) => bot.dead);

  return {
    bots,
    update,
    reset,
    hit,
    kill,
    hearing,
    plantAlert,
    explosion,
    flash,
    allDead,
    setDefuseProgress(value) {
      state.round.defuseProgress = value;
    },
  };
}
