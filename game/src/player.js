// First-person movement, collision and camera. The collision routine is the proven axis-by-axis
// AABB probe, extended with step-up for the catwalk stairs and a crouch-stand clearance check.
import { MAP, PLAYER } from './config.js';
import { angleDelta, clamp, damp, TAU, yawFromDirection } from './util.js';

const EPS = 1e-5;

export function createPlayer(state, map, camera) {
  camera.rotation.order = 'YXZ';
  camera.near = 0.035;
  const p = state.player;

  function overlapsAt(x, y, z, height) {
    const minX = x - PLAYER.radius;
    const maxX = x + PLAYER.radius;
    const minZ = z - PLAYER.radius;
    const maxZ = z + PLAYER.radius;
    const maxY = y + height;
    for (let i = 0; i < map.colliders.length; i++) {
      const c = map.colliders[i];
      if (
        minX < c.max.x - EPS && maxX > c.min.x + EPS &&
        y < c.max.y - EPS && maxY > c.min.y + EPS &&
        minZ < c.max.z - EPS && maxZ > c.min.z + EPS
      ) return true;
    }
    return false;
  }

  function supportTop(maxDrop) {
    const minX = p.pos.x - PLAYER.radius;
    const maxX = p.pos.x + PLAYER.radius;
    const minZ = p.pos.z - PLAYER.radius;
    const maxZ = p.pos.z + PLAYER.radius;
    let top = -Infinity;
    for (let i = 0; i < map.colliders.length; i++) {
      const c = map.colliders[i];
      if (minX >= c.max.x || maxX <= c.min.x || minZ >= c.max.z || maxZ <= c.min.z) continue;
      if (c.max.y <= p.pos.y + 0.02 && c.max.y >= p.pos.y - maxDrop && c.max.y > top) top = c.max.y;
    }
    return top;
  }

  function moveAxis(axis, delta) {
    if (delta === 0) return;
    const old = p.pos[axis];
    p.pos[axis] = old + delta;
    if (!overlapsAt(p.pos.x, p.pos.y, p.pos.z, p.height)) return;

    p.pos[axis] = old;
    if (p.grounded) {
      const oldY = p.pos.y;
      p.pos.y += PLAYER.stepHeight;
      p.pos[axis] = old + delta;
      if (!overlapsAt(p.pos.x, p.pos.y, p.pos.z, p.height)) return;
      p.pos[axis] = old;
      p.pos.y = oldY;
    }
    p.vel[axis] = 0;
  }

  function moveVertical(dt) {
    const oldY = p.pos.y;
    p.pos.y += p.vel.y * dt;
    if (overlapsAt(p.pos.x, p.pos.y, p.pos.z, p.height)) {
      if (p.vel.y <= 0) {
        let top = -Infinity;
        for (let i = 0; i < map.colliders.length; i++) {
          const c = map.colliders[i];
          if (p.pos.x - PLAYER.radius >= c.max.x || p.pos.x + PLAYER.radius <= c.min.x) continue;
          if (p.pos.z - PLAYER.radius >= c.max.z || p.pos.z + PLAYER.radius <= c.min.z) continue;
          if (c.max.y <= oldY + 0.06 && c.max.y > top) top = c.max.y;
        }
        p.pos.y = top > -Infinity ? top : oldY;
        p.vel.y = 0;
        p.grounded = true;
      } else {
        p.pos.y = oldY;
        p.vel.y = 0;
      }
    }

    if (p.vel.y <= 0) {
      const top = supportTop(p.grounded ? PLAYER.stepHeight : 0.09);
      if (top > -Infinity) {
        p.pos.y = top;
        p.vel.y = 0;
        p.grounded = true;
      } else {
        p.grounded = false;
      }
    } else {
      p.grounded = false;
    }
  }

  function updateLook() {
    const sens = state.settings.sensitivity;
    const dx = p.lookX;
    const dy = p.lookY;
    if (dx !== 0) p.yaw -= dx * sens;
    if (dy !== 0) p.pitch -= dy * sens;
    p.yaw = Math.atan2(Math.sin(p.yaw), Math.cos(p.yaw));
    p.pitch = clamp(p.pitch, -1.48, 1.48);
  }

  function update(dt, input) {
    if (p.dead) {
      p.grounded = false;
      p.vel.set(0, 0, 0);
      return;
    }

    input.consumeLook();
    p.lookX = input.takeLookX;
    p.lookY = input.takeLookY;
    updateLook();

    const crouchHeld = input.isDown('ControlLeft') || input.isDown('ControlRight') || input.isDown('KeyC');
    if (crouchHeld) {
      p.crouched = true;
    } else if (p.crouched) {
      if (!overlapsAt(p.pos.x, p.pos.y, p.pos.z, PLAYER.standHeight)) p.crouched = false;
    }
    const targetHeight = p.crouched ? PLAYER.crouchHeight : PLAYER.standHeight;
    const targetEye = p.crouched ? PLAYER.crouchEye : PLAYER.standEye;
    p.height = targetHeight;
    p.eye = damp(p.eye, targetEye, 16, dt);

    p.walking = input.isDown('ShiftLeft') || input.isDown('ShiftRight');
    const speed = p.crouched ? PLAYER.crouchSpeed : p.walking ? PLAYER.walkSpeed : PLAYER.speed;

    let forward = 0;
    let strafe = 0;
    if (input.isDown('KeyW') || input.isDown('ArrowUp')) forward += 1;
    if (input.isDown('KeyS') || input.isDown('ArrowDown')) forward -= 1;
    if (input.isDown('KeyD') || input.isDown('ArrowRight')) strafe += 1;
    if (input.isDown('KeyA') || input.isDown('ArrowLeft')) strafe -= 1;

    const sin = Math.sin(p.yaw);
    const cos = Math.cos(p.yaw);
    let wishX = -sin * forward + cos * strafe;
    let wishZ = -cos * forward - sin * strafe;
    const wishLen = Math.hypot(wishX, wishZ);
    if (wishLen > 1) {
      wishX /= wishLen;
      wishZ /= wishLen;
    }

    const accel = p.grounded ? PLAYER.groundAccel : PLAYER.airAccel;
    const blend = Math.min(1, accel * dt * 0.12);
    p.vel.x += (wishX * speed - p.vel.x) * blend;
    p.vel.z += (wishZ * speed - p.vel.z) * blend;

    if (p.grounded && wishLen < 0.01) {
      const friction = Math.max(0, 1 - PLAYER.friction * dt);
      p.vel.x *= friction;
      p.vel.z *= friction;
    }

    if (visitJump(input) && p.grounded) {
      p.vel.y = PLAYER.jump;
      p.grounded = false;
    }

    p.vel.y -= PLAYER.gravity * dt;
    if (p.vel.y < -40) p.vel.y = -40;

    moveAxis('x', p.vel.x * dt);
    moveAxis('z', p.vel.z * dt);
    if (p.grounded) {
      const top = supportTop(PLAYER.stepHeight + 0.03);
      if (top > -Infinity) p.pos.y = top;
      else p.grounded = false;
    }
    moveVertical(dt);

    p.groundSpeed = Math.hypot(p.vel.x, p.vel.z);
    if (p.grounded && p.groundSpeed > 0.35) {
      p.bob += dt * TAU * PLAYER.bobHz * clamp(p.groundSpeed / PLAYER.speed, 0, 1.25);
      p.bobAmount = damp(p.bobAmount, PLAYER.bobAmplitude * (p.crouched ? 0.55 : 1), 12, dt);
    } else {
      p.bobAmount = damp(p.bobAmount, 0, 14, dt);
    }

    p.recoilPitch = damp(p.recoilPitch, 0, 11, dt);
    p.recoilYaw = damp(p.recoilYaw, 0, 11, dt);
    p.damageFlash = Math.max(0, p.damageFlash - dt * 1.7);
    p.health = clamp(p.health, 0, 100);
    p.armor = clamp(p.armor, 0, 100);

    syncCamera();
  }

  function visitJump(input) {
    return input.consumeKey('Space');
  }

  function syncCamera() {
    camera.position.set(
      p.pos.x,
      p.pos.y + p.eye + Math.sin(p.bob) * p.bobAmount,
      p.pos.z,
    );
    camera.rotation.y = p.yaw + p.recoilYaw;
    camera.rotation.x = p.pitch + p.recoilPitch;
    camera.rotation.z = 0;
  }

  function addRecoil(pitchKick, yawKick) {
    p.recoilPitch += pitchKick;
    p.recoilYaw += yawKick;
    if (p.recoilPitch > 0.14) p.recoilPitch = 0.14;
    if (p.recoilPitch < -0.04) p.recoilPitch = -0.04;
    if (p.recoilYaw > 0.08) p.recoilYaw = 0.08;
    if (p.recoilYaw < -0.08) p.recoilYaw = -0.08;
  }

  function damage(amount, fromX, fromZ) {
    if (p.dead) return;
    const absorbed = Math.min(p.armor, amount * 0.5);
    p.armor -= absorbed;
    p.health -= amount - absorbed;
    p.damageFlash = Math.min(1, p.damageFlash + amount / 55);
    const toward = yawFromDirection(fromX - p.pos.x, fromZ - p.pos.z);
    p.damageYaw = angleDelta(p.yaw, toward);
    state.effects.damage = Math.max(state.effects.damage, 0.55);
    state.effects.damageYaw = p.damageYaw;
    if (p.health <= 0) {
      p.health = 0;
      p.dead = true;
    }
  }

  function respawn() {
    p.pos.set(MAP.attackerSpawn.x, MAP.attackerSpawn.y, MAP.attackerSpawn.z);
    p.vel.set(0, 0, 0);
    p.yaw = 0;
    p.pitch = 0;
    p.crouched = false;
    p.walking = false;
    p.grounded = true;
    p.health = 100;
    p.armor = 0;
    p.height = PLAYER.standHeight;
    p.eye = PLAYER.standEye;
    p.bob = 0;
    p.bobAmount = 0;
    p.recoilPitch = 0;
    p.recoilYaw = 0;
    p.damageFlash = 0;
    p.damageYaw = 0;
    p.dead = false;
    p.lookX = 0;
    p.lookY = 0;
    syncCamera();
  }

  syncCamera();
  return { update, syncCamera, addRecoil, damage, respawn, overlapsAt };
}
