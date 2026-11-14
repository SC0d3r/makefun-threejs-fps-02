// All transient combat visuals are allocated once and rewritten in place.
import * as THREE from 'three';
import { COLORS } from './config.js';

function puffTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 64;
  canvas.height = 64;
  const ctx = canvas.getContext('2d');
  const g = ctx.createRadialGradient(32, 32, 2, 32, 32, 32);
  g.addColorStop(0, 'rgba(255,238,205,0.9)');
  g.addColorStop(0.35, 'rgba(190,180,165,0.4)');
  g.addColorStop(1, 'rgba(120,120,120,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 64, 64);
  return new THREE.CanvasTexture(canvas);
}

export function createEffects(state, scene) {
  const hidden = -999;
  const tracerCount = 64;
  const tracerPos = new Float32Array(tracerCount * 6);
  const tracerLife = new Float32Array(tracerCount);
  const tracerCursor = { value: 0 };
  const tracerGeo = new THREE.BufferGeometry();
  const tracerAttr = new THREE.BufferAttribute(tracerPos, 3);
  tracerAttr.setUsage(THREE.DynamicDrawUsage);
  tracerGeo.setAttribute('position', tracerAttr);
  const tracers = new THREE.LineSegments(
    tracerGeo,
    new THREE.LineBasicMaterial({ color: 0xffd8a2, transparent: true, opacity: 0.9, depthWrite: false, blending: THREE.AdditiveBlending }),
  );
  tracers.frustumCulled = false;
  scene.add(tracers);

  const sparkCount = 96;
  const sparkPos = new Float32Array(sparkCount * 3);
  const sparkVel = new Float32Array(sparkCount * 3);
  const sparkLife = new Float32Array(sparkCount);
  const sparkCursor = { value: 0 };
  const sparkGeo = new THREE.BufferGeometry();
  const sparkAttr = new THREE.BufferAttribute(sparkPos, 3);
  sparkAttr.setUsage(THREE.DynamicDrawUsage);
  sparkGeo.setAttribute('position', sparkAttr);
  const sparks = new THREE.Points(
    sparkGeo,
    new THREE.PointsMaterial({ color: 0xffc277, size: 0.075, transparent: true, opacity: 0.95, depthWrite: false, blending: THREE.AdditiveBlending }),
  );
  sparks.frustumCulled = false;
  scene.add(sparks);

  const shellCount = 32;
  const shells = [];
  const shellGeo = new THREE.BoxGeometry(0.035, 0.035, 0.075);
  const shellMat = new THREE.MeshStandardMaterial({ color: 0xc8a05c, metalness: 0.8, roughness: 0.3 });
  for (let i = 0; i < shellCount; i += 1) {
    const mesh = new THREE.Mesh(shellGeo, shellMat);
    mesh.visible = false;
    mesh.castShadow = false;
    scene.add(mesh);
    shells.push({ mesh, vel: new THREE.Vector3(), life: 0, spin: new THREE.Vector3() });
  }
  let shellCursor = 0;

  const smokeCount = 16;
  const smokeTex = puffTexture();
  const puffs = [];
  for (let i = 0; i < smokeCount; i += 1) {
    const material = new THREE.SpriteMaterial({ map: smokeTex, color: 0xb7aa96, transparent: true, opacity: 0, depthWrite: false });
    const sprite = new THREE.Sprite(material);
    sprite.visible = false;
    scene.add(sprite);
    puffs.push({ sprite, life: 0, max: 1, rise: 0 });
  }
  let puffCursor = 0;

  const boomCount = 8;
  const boomTex = puffTexture();
  const booms = [];
  for (let i = 0; i < boomCount; i += 1) {
    const material = new THREE.SpriteMaterial({ map: boomTex, color: 0xffc06a, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending });
    const sprite = new THREE.Sprite(material);
    sprite.visible = false;
    scene.add(sprite);
    booms.push({ sprite, life: 0, max: 0.5, size: 1 });
  }
  let boomCursor = 0;

  const ring = new THREE.Mesh(
    new THREE.TorusGeometry(0.7, 0.035, 6, 40),
    new THREE.MeshBasicMaterial({ color: COLORS.cyan, transparent: true, opacity: 0.9 }),
  );
  ring.rotation.x = Math.PI / 2;
  ring.visible = false;
  scene.add(ring);

  const flashLight = new THREE.PointLight(0xffb15c, 0, 14, 2);
  scene.add(flashLight);
  let flashLife = 0;

  const tracer = (ax, ay, az, bx, by, bz, color = 0xffd8a2) => {
    const i = tracerCursor.value;
    tracerCursor.value = (i + 1) % tracerCount;
    tracerPos[i * 6] = ax;
    tracerPos[i * 6 + 1] = ay;
    tracerPos[i * 6 + 2] = az;
    tracerPos[i * 6 + 3] = bx;
    tracerPos[i * 6 + 4] = by;
    tracerPos[i * 6 + 5] = bz;
    tracerLife[i] = 0.07;
    tracers.material.color.setHex(color);
  };

  const spark = (x, y, z, nx, ny, nz, speed) => {
    const i = sparkCursor.value;
    sparkCursor.value = (i + 1) % sparkCount;
    sparkPos[i * 3] = x;
    sparkPos[i * 3 + 1] = y;
    sparkPos[i * 3 + 2] = z;
    sparkVel[i * 3] = nx * speed + (state.rng() - 0.5) * 2.6;
    sparkVel[i * 3 + 1] = ny * speed + state.rng() * 2.4;
    sparkVel[i * 3 + 2] = nz * speed + (state.rng() - 0.5) * 2.6;
    sparkLife[i] = 0.2 + state.rng() * 0.24;
  };

  const impact = (x, y, z, nx = 0, ny = 1, nz = 0) => {
    for (let i = 0; i < 6; i += 1) spark(x, y, z, nx, ny, nz, 2.2 + state.rng() * 2.8);
    smoke(x + nx * 0.12, y + ny * 0.12, z + nz * 0.12, 0.55);
  };

  const smoke = (x, y, z, size = 0.8) => {
    const p = puffs[puffCursor];
    puffCursor = (puffCursor + 1) % smokeCount;
    p.sprite.visible = true;
    p.sprite.position.set(x, y, z);
    p.sprite.scale.setScalar(size);
    p.life = 0.7;
    p.max = 0.7;
    p.rise = 0.25;
    p.sprite.material.opacity = 0.34;
  };

  const explosion = (x, y, z, size = 1) => {
    const b = booms[boomCursor];
    boomCursor = (boomCursor + 1) % boomCount;
    b.sprite.visible = true;
    b.sprite.position.set(x, y + 0.2, z);
    b.sprite.scale.setScalar(size * 1.3);
    b.life = 0.5;
    b.max = 0.5;
    b.size = size;
    b.sprite.material.opacity = 0.95;
    for (let i = 0; i < 14; i += 1) spark(x, y + 0.2, z, 0, 1, 0, 3.6 + state.rng() * 4);
    for (let i = 0; i < 5; i += 1) smoke(x + (state.rng() - 0.5) * size * 2, y + 0.4 + state.rng() * 1.2, z + (state.rng() - 0.5) * size * 2, 1.4 + state.rng());
    flashLight.position.set(x, y + 0.8, z);
    flashLight.intensity = 160;
    flashLife = 0.18;
  };

  const shell = (x, y, z, vx, vy, vz) => {
    const s = shells[shellCursor];
    shellCursor = (shellCursor + 1) % shellCount;
    s.mesh.visible = true;
    s.mesh.position.set(x, y, z);
    s.vel.set(vx, vy, vz);
    s.life = 1.4;
    s.spin.set(state.rng() * 8, state.rng() * 8, state.rng() * 8);
  };

  const defuse = (x, z, progress, visible) => {
    ring.visible = visible;
    if (!visible) return;
    ring.position.set(x, 1.12, z);
    ring.scale.setScalar(0.45 + progress * 0.75);
    ring.rotation.z += 0.02;
  };

  const update = (dt) => {
    let active = false;
    for (let i = 0; i < tracerCount; i += 1) {
      if (tracerLife[i] <= 0) continue;
      tracerLife[i] -= dt;
      if (tracerLife[i] <= 0) {
        tracerPos[i * 6] = hidden;
        tracerPos[i * 6 + 1] = hidden;
        tracerPos[i * 6 + 2] = hidden;
        tracerPos[i * 6 + 3] = hidden;
        tracerPos[i * 6 + 4] = hidden;
        tracerPos[i * 6 + 5] = hidden;
      } else active = true;
    }
    if (active) tracerAttr.needsUpdate = true;

    active = false;
    for (let i = 0; i < sparkCount; i += 1) {
      if (sparkLife[i] <= 0) continue;
      sparkLife[i] -= dt;
      if (sparkLife[i] <= 0) {
        sparkPos[i * 3 + 1] = hidden;
        continue;
      }
      active = true;
      sparkVel[i * 3 + 1] -= 14 * dt;
      sparkPos[i * 3] += sparkVel[i * 3] * dt;
      sparkPos[i * 3 + 1] += sparkVel[i * 3 + 1] * dt;
      sparkPos[i * 3 + 2] += sparkVel[i * 3 + 2] * dt;
    }
    if (active) sparkAttr.needsUpdate = true;

    for (const s of shells) {
      if (!s.mesh.visible) continue;
      s.life -= dt;
      if (s.life <= 0) {
        s.mesh.visible = false;
        continue;
      }
      s.vel.y -= 15 * dt;
      s.mesh.position.x += s.vel.x * dt;
      s.mesh.position.y += s.vel.y * dt;
      s.mesh.position.z += s.vel.z * dt;
      if (s.mesh.position.y < 0.03) {
        s.mesh.position.y = 0.03;
        s.vel.y *= -0.35;
        s.vel.x *= 0.6;
        s.vel.z *= 0.6;
      }
      s.mesh.rotation.x += s.spin.x * dt;
      s.mesh.rotation.z += s.spin.z * dt;
    }

    for (const p of puffs) {
      if (!p.sprite.visible) continue;
      p.life -= dt;
      if (p.life <= 0) {
        p.sprite.visible = false;
        continue;
      }
      const t = p.life / p.max;
      p.sprite.position.y += p.rise * dt;
      p.sprite.scale.addScalar(dt * 0.9);
      p.sprite.material.opacity = 0.34 * t;
    }

    for (const b of booms) {
      if (!b.sprite.visible) continue;
      b.life -= dt;
      if (b.life <= 0) {
        b.sprite.visible = false;
        continue;
      }
      const t = b.life / b.max;
      b.sprite.scale.setScalar(b.size * (1.3 + (1 - t) * 2.4));
      b.sprite.material.opacity = 0.95 * t * t;
    }

    if (flashLife > 0) {
      flashLife -= dt;
      flashLight.intensity = Math.max(0, flashLife / 0.18) * 160;
    }
  };

  return {
    tracer,
    impact,
    smoke,
    explosion,
    shell,
    defuse,
    update,
    ring,
  };
}
