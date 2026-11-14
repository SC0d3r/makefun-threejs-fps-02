// First-person movement, collision, camera sync and the player's damage model.
import { PLAYER } from './config.js';
import { clamp } from './util.js';

export function createPlayer(state, camera, input) {
  let bobPhase = 0;

  const blockedAt = (x, z, feet, height) => {
    const r = PLAYER.radius;
    for (let i = 0; i < state.colliders.length; i += 1) {
      const c = state.colliders[i];
      if (feet + height <= c.minY + 0.06 || feet >= c.maxY - 0.04) continue;
      if (x + r > c.minX && x - r < c.maxX && z + r > c.minZ && z - r < c.maxZ) return true;
    }
    return false;
  };

  const canStand = () => {
    const p = state.player;
    return !blockedAt(p.pos.x, p.pos.z, p.pos.y, PLAYER.stand);
  };

  const look = (dx, dy) => {
    const p = state.player;
    p.yaw -= dx * 0.0022;
    p.pitch = clamp(p.pitch - dy * 0.0022, -1.47, 1.47);
    if (p.yaw > Math.PI) p.yaw -= Math.PI * 2;
    if (p.yaw < -Math.PI) p.yaw += Math.PI * 2;
  };

  const update = (dt) => {
    const p = state.player;
    if (state.shotFrozen) return;
    if (p.alive && state.mode === 'playing' && !state.paused && !state.flags.buyOpen) {
      look(input.mouse.dx, input.mouse.dy);
    }
    if (!p.alive) {
      p.deadT += dt;
      p.vel.x = 0;
      p.vel.z = 0;
      p.vel.y -= PLAYER.gravity * dt;
      p.pos.y = Math.max(-0.2, p.pos.y + p.vel.y * dt);
      return;
    }

    const active = state.mode === 'playing' && !state.paused && !state.flags.buyOpen && !state.flags.roundEnd && !state.flags.matchEnd;
    const crouching = active && (input.isDown('ControlLeft') || input.isDown('ControlRight') || input.isDown('KeyC'));
    const wantCrouch = crouching || !canStand();
    p.crouch += ((wantCrouch ? 1 : 0) - p.crouch) * Math.min(1, dt * 12);
    p.height = PLAYER.stand + (PLAYER.crouch - PLAYER.stand) * p.crouch;
    p.eye = PLAYER.eye + (PLAYER.eyeCrouch - PLAYER.eye) * p.crouch;

    let fx = 0;
    let fz = 0;
    if (active) {
      if (input.isDown('KeyW')) fz -= 1;
      if (input.isDown('KeyS')) fz += 1;
      if (input.isDown('KeyA')) fx -= 1;
      if (input.isDown('KeyD')) fx += 1;
    }
    const len = Math.hypot(fx, fz);
    if (len > 0) {
      fx /= len;
      fz /= len;
    }
    const walk = input.isDown('ShiftLeft') || input.isDown('ShiftRight');
    p.walk = walk;
    const maxSpeed = wantCrouch ? PLAYER.crouchSpeed : walk ? PLAYER.walk : PLAYER.speed;
    const sin = Math.sin(p.yaw);
    const cos = Math.cos(p.yaw);
    const wishX = (fx * cos - fz * sin) * maxSpeed;
    const wishZ = (fx * sin + fz * cos) * maxSpeed;
    const accel = p.onGround ? PLAYER.accel : PLAYER.airAccel;
    p.vel.x += (wishX - p.vel.x) * Math.min(1, accel * dt);
    p.vel.z += (wishZ - p.vel.z) * Math.min(1, accel * dt);
    if (len === 0 && p.onGround) {
      const damp = Math.max(0, 1 - PLAYER.friction * dt);
      p.vel.x *= damp;
      p.vel.z *= damp;
    }

    if (active && input.isDown('Space') && p.onGround) {
      p.vel.y = PLAYER.jump;
      p.onGround = false;
      if (state.audio) state.audio.jump();
    }
    p.vel.y -= PLAYER.gravity * dt;
    p.pos.y += p.vel.y * dt;
    if (p.pos.y <= 0) {
      p.pos.y = 0;
      p.vel.y = 0;
      p.onGround = true;
    }

    const nextX = p.pos.x + p.vel.x * dt;
    if (!blockedAt(nextX, p.pos.z, p.pos.y, p.height)) p.pos.x = nextX;
    else p.vel.x = 0;
    const nextZ = p.pos.z + p.vel.z * dt;
    if (!blockedAt(p.pos.x, nextZ, p.pos.y, p.height)) p.pos.z = nextZ;
    else p.vel.z = 0;

    p.pos.x = clamp(p.pos.x, -30.8, 30.8);
    p.pos.z = clamp(p.pos.z, -22.8, 22.8);
    const speed = Math.hypot(p.vel.x, p.vel.z);
    p.speed = speed;
    p.moving = speed > 0.35;
    if (p.onGround && p.moving) {
      bobPhase += dt * PLAYER.bobHz * Math.PI * 2;
      p.stepDist += speed * dt;
      if (p.stepDist > 2.15) {
        p.stepDist = 0;
        p.stepSide = 1 - p.stepSide;
        if (state.audio) state.audio.step(p.stepSide);
      }
    }
    p.shake = Math.max(0, p.shake - dt * 2.4);
    p.flash = Math.max(0, p.flash - dt);
    p.lastDamage += dt;
    p.firedAt += dt;
  };

  const takeDamage = (amount, fromX, fromZ) => {
    const p = state.player;
    if (!p.alive || state.shotFrozen || amount <= 0) return;
    const absorbed = Math.min(p.armor, amount * 0.5);
    p.armor -= absorbed;
    p.health -= amount - absorbed;
    p.lastDamage = 0;
    p.damageDir = Math.atan2(fromX - p.pos.x, -(fromZ - p.pos.z)) - p.yaw;
    p.shake = Math.min(0.24, p.shake + amount * 0.0025);
    state.damageFlash = 1;
    if (state.audio) state.audio.hurt();
    if (p.health <= 0) {
      p.health = 0;
      p.alive = false;
      p.deadT = 0;
      p.grenadeSelect = null;
      if (state.audio) state.audio.death();
    }
  };

  const reset = () => {
    const p = state.player;
    p.pos.x = 0;
    p.pos.y = 0;
    p.pos.z = 20;
    p.vel.x = 0;
    p.vel.y = 0;
    p.vel.z = 0;
    p.yaw = 0;
    p.pitch = 0;
    p.height = PLAYER.stand;
    p.eye = PLAYER.eye;
    p.crouch = 0;
    p.health = 100;
    p.armor = 0;
    p.alive = true;
    p.deadT = 0;
    p.shake = 0;
    p.flash = 0;
    p.grenades.frag = 0;
    p.grenades.flash = 0;
    p.grenadeSelect = null;
    p.onGround = true;
    p.stepDist = 0;
    p.lastDamage = 99;
    p.firedAt = 99;
    p.speed = 0;
    p.moving = false;
    bobPhase = 0;
    state.damageFlash = 0;
  };

  const setPose = (x, y, z, yaw, pitch, crouch = 0) => {
    const p = state.player;
    p.pos.x = x;
    p.pos.y = y;
    p.pos.z = z;
    p.yaw = yaw;
    p.pitch = pitch;
    p.crouch = crouch;
    p.height = PLAYER.stand + (PLAYER.crouch - PLAYER.stand) * crouch;
    p.eye = PLAYER.eye + (PLAYER.eyeCrouch - PLAYER.eye) * crouch;
    p.vel.x = 0;
    p.vel.y = 0;
    p.vel.z = 0;
  };

  const syncCamera = (time) => {
    const p = state.player;
    const bob = p.onGround && p.moving ? Math.sin(bobPhase) * PLAYER.bob : 0;
    let y = p.pos.y + p.eye + bob + Math.sin(time * 2.1) * 0.003;
    if (!p.alive) y = p.pos.y + 0.36 + Math.min(0.2, p.deadT);
    const shakeX = p.shake > 0 ? Math.sin(time * 71) * p.shake * 0.18 : 0;
    const shakeY = p.shake > 0 ? Math.cos(time * 57) * p.shake * 0.18 : 0;
    camera.position.set(p.pos.x + shakeX, y + shakeY, p.pos.z);
    camera.rotation.order = 'YXZ';
    camera.rotation.y = p.yaw + (p.shake > 0 ? Math.sin(time * 63) * p.shake * 0.25 : 0);
    camera.rotation.x = p.pitch;
    camera.rotation.z = p.alive ? 0 : Math.min(0.9, p.deadT * 1.4);
  };

  return {
    update,
    takeDamage,
    reset,
    setPose,
    syncCamera,
    blockedAt,
    canStand,
    addShake(amount) {
      state.player.shake = Math.min(0.4, state.player.shake + amount);
    },
    blind(seconds) {
      state.player.flash = Math.max(state.player.flash, seconds);
    },
  };
}
