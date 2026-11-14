// Preallocated transient visuals. update() only writes into typed arrays and instanced matrices.
import * as THREE from 'three';
import { PALETTE } from './config.js';
import { mulberry32 } from './util.js';

const TRACER_COUNT = 64;
const SPARK_COUNT = 64;
const SHELL_COUNT = 32;
const FLASH_COUNT = 4;
const dummy = new THREE.Object3D();

function radialTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 64;
  canvas.height = 64;
  const ctx = canvas.getContext('2d');
  const grad = ctx.createRadialGradient(32, 32, 1, 32, 32, 31);
  grad.addColorStop(0, 'rgba(255,244,214,1)');
  grad.addColorStop(0.22, 'rgba(255,196,120,0.9)');
  grad.addColorStop(0.6, 'rgba(255,140,70,0.28)');
  grad.addColorStop(1, 'rgba(255,120,60,0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 64, 64);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

export function createEffects(scene) {
  const rng = mulberry32(773);

  const tracerPositions = new Float32Array(TRACER_COUNT * 6);
  const tracerColors = new Float32Array(TRACER_COUNT * 6);
  const tracerLife = new Float32Array(TRACER_COUNT);
  const tracerStart = new Float32Array(TRACER_COUNT * 3);
  const tracerEnd = new Float32Array(TRACER_COUNT * 3);
  const tracerGeometry = new THREE.BufferGeometry();
  tracerGeometry.setAttribute('position', new THREE.BufferAttribute(tracerPositions, 3));
  tracerGeometry.setAttribute('color', new THREE.BufferAttribute(tracerColors, 3));
  for (let i = 0; i < TRACER_COUNT; i++) {
    tracerPositions[i * 6 + 1] = -100;
    tracerPositions[i * 6 + 4] = -100;
  }
  const tracerMaterial = new THREE.LineBasicMaterial({
    vertexColors: true,
    transparent: true,
    opacity: 0.9,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
  const tracers = new THREE.LineSegments(tracerGeometry, tracerMaterial);
  tracers.frustumCulled = false;
  scene.add(tracers);
  let tracerCursor = 0;

  const sparkPositions = new Float32Array(SPARK_COUNT * 3);
  const sparkColors = new Float32Array(SPARK_COUNT * 3);
  const sparkVelocity = new Float32Array(SPARK_COUNT * 3);
  const sparkLife = new Float32Array(SPARK_COUNT);
  for (let i = 0; i < SPARK_COUNT; i++) sparkPositions[i * 3 + 1] = -100;
  const sparkGeometry = new THREE.BufferGeometry();
  sparkGeometry.setAttribute('position', new THREE.BufferAttribute(sparkPositions, 3));
  sparkGeometry.setAttribute('color', new THREE.BufferAttribute(sparkColors, 3));
  const sparkMaterial = new THREE.PointsMaterial({
    size: 0.062,
    vertexColors: true,
    transparent: true,
    opacity: 0.95,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    sizeAttenuation: true,
  });
  const sparks = new THREE.Points(sparkGeometry, sparkMaterial);
  sparks.frustumCulled = false;
  scene.add(sparks);
  let sparkCursor = 0;

  const shellGeometry = new THREE.BoxGeometry(0.025, 0.025, 0.065);
  const shellMaterial = new THREE.MeshStandardMaterial({
    color: 0xb28a4f,
    roughness: 0.35,
    metalness: 0.8,
  });
  const shells = new THREE.InstancedMesh(shellGeometry, shellMaterial, SHELL_COUNT);
  shells.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  shells.frustumCulled = false;
  const shellPos = new Float32Array(SHELL_COUNT * 3);
  const shellVel = new Float32Array(SHELL_COUNT * 3);
  const shellLife = new Float32Array(SHELL_COUNT);
  const shellSpin = new Float32Array(SHELL_COUNT);
  for (let i = 0; i < SHELL_COUNT; i++) {
    dummy.position.set(0, -100, 0);
    dummy.scale.set(0, 0, 0);
    dummy.updateMatrix();
    shells.setMatrixAt(i, dummy.matrix);
  }
  scene.add(shells);
  let shellCursor = 0;

  const flashTexture = radialTexture();
  const flashes = [];
  for (let i = 0; i < FLASH_COUNT; i++) {
    const material = new THREE.SpriteMaterial({
      map: flashTexture,
      color: PALETTE.sodium,
      transparent: true,
      opacity: 0,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      depthTest: true,
    });
    const sprite = new THREE.Sprite(material);
    sprite.scale.set(0.42, 0.42, 1);
    sprite.position.set(0, -100, 0);
    scene.add(sprite);
    flashes.push({ sprite, material, life: 0 });
  }
  let flashCursor = 0;
  const muzzleLight = new THREE.PointLight(PALETTE.sodium, 0, 7, 2);
  muzzleLight.position.set(0, -100, 0);
  scene.add(muzzleLight);
  let lightLife = 0;

  function tracer(from, to, color) {
    const i = tracerCursor;
    tracerCursor = (tracerCursor + 1) % TRACER_COUNT;
    tracerLife[i] = 0.055;
    tracerStart[i * 3] = from.x;
    tracerStart[i * 3 + 1] = from.y;
    tracerStart[i * 3 + 2] = from.z;
    tracerEnd[i * 3] = to.x;
    tracerEnd[i * 3 + 1] = to.y;
    tracerEnd[i * 3 + 2] = to.z;
    const cr = ((color >> 16) & 255) / 255;
    const cg = ((color >> 8) & 255) / 255;
    const cb = (color & 255) / 255;
    for (let v = 0; v < 2; v++) {
      tracerColors[i * 6 + v * 3] = cr;
      tracerColors[i * 6 + v * 3 + 1] = cg;
      tracerColors[i * 6 + v * 3 + 2] = cb;
    }
    tracerGeometry.attributes.color.needsUpdate = true;
  }

  function impact(point, normal, kind) {
    let r = 0.95;
    let g = 0.72;
    let b = 0.42;
    if (kind === 'steel') { r = 1; g = 0.54; b = 0.19; }
    else if (kind === 'wood') { r = 0.9; g = 0.48; b = 0.2; }
    else if (kind === 'flesh') { r = 0.85; g = 0.3; b = 0.22; }

    for (let s = 0; s < 6; s++) {
      const i = sparkCursor;
      sparkCursor = (sparkCursor + 1) % SPARK_COUNT;
      sparkLife[i] = 0.22 + rng() * 0.3;
      sparkPositions[i * 3] = point.x + normal.x * 0.03;
      sparkPositions[i * 3 + 1] = point.y + normal.y * 0.03;
      sparkPositions[i * 3 + 2] = point.z + normal.z * 0.03;
      const speed = 1.6 + rng() * 3.6;
      let tx = -normal.z;
      let ty = 0;
      let tz = normal.x;
      let tl = Math.hypot(tx, ty, tz);
      if (tl < 0.01) { tx = 1; tz = 0; tl = 1; }
      tx /= tl;
      tz /= tl;
      const by = normal.y;
      const spreadX = rng() * 2 - 1;
      const spreadZ = rng() * 2 - 1;
      sparkVelocity[i * 3] = normal.x * speed + tx * spreadX * 1.4;
      sparkVelocity[i * 3 + 1] = by * speed + rng() * 2.2;
      sparkVelocity[i * 3 + 2] = normal.z * speed + tz * spreadZ * 1.4;
      const shade = 0.72 + rng() * 0.28;
      sparkColors[i * 3] = r * shade;
      sparkColors[i * 3 + 1] = g * shade;
      sparkColors[i * 3 + 2] = b * shade;
    }
    sparkGeometry.attributes.position.needsUpdate = true;
    sparkGeometry.attributes.color.needsUpdate = true;
  }

  function shell(position, right) {
    const i = shellCursor;
    shellCursor = (shellCursor + 1) % SHELL_COUNT;
    shellLife[i] = 0.9 + rng() * 0.5;
    shellPos[i * 3] = position.x;
    shellPos[i * 3 + 1] = position.y;
    shellPos[i * 3 + 2] = position.z;
    shellVel[i * 3] = right.x * (1.4 + rng() * 1.4) - right.z * 0.4;
    shellVel[i * 3 + 1] = 1.5 + rng() * 1.2;
    shellVel[i * 3 + 2] = right.z * (1.4 + rng() * 1.4) + right.x * 0.4;
    shellSpin[i] = (rng() - 0.5) * 18;
  }

  function muzzle(position, direction) {
    const flash = flashes[flashCursor];
    flashCursor = (flashCursor + 1) % FLASH_COUNT;
    flash.life = 0.05;
    flash.material.opacity = 1;
    flash.sprite.position.set(
      position.x + direction.x * 0.1,
      position.y + direction.y * 0.1,
      position.z + direction.z * 0.1,
    );
    flash.sprite.scale.setScalar(0.32 + rng() * 0.18);
    muzzleLight.position.copy(flash.sprite.position);
    muzzleLight.intensity = 9;
    lightLife = 0.05;
  }

  function updateSparks(dt) {
    for (let i = 0; i < SPARK_COUNT; i++) {
      if (sparkLife[i] <= 0) continue;
      sparkLife[i] -= dt;
      if (sparkLife[i] <= 0) {
        sparkPositions[i * 3 + 1] = -100;
        continue;
      }
      sparkVelocity[i * 3 + 1] -= 14 * dt;
      sparkPositions[i * 3] += sparkVelocity[i * 3] * dt;
      sparkPositions[i * 3 + 1] += sparkVelocity[i * 3 + 1] * dt;
      sparkPositions[i * 3 + 2] += sparkVelocity[i * 3 + 2] * dt;
    }
    sparkGeometry.attributes.position.needsUpdate = true;
  }

  function updateTracers(dt) {
    for (let i = 0; i < TRACER_COUNT; i++) {
      if (tracerLife[i] > 0) {
        tracerLife[i] -= dt;
        const o = i * 6;
        if (tracerLife[i] <= 0) {
          tracerPositions[o + 1] = -100;
          tracerPositions[o + 4] = -100;
        } else {
          tracerPositions[o] = tracerStart[i * 3];
          tracerPositions[o + 1] = tracerStart[i * 3 + 1];
          tracerPositions[o + 2] = tracerStart[i * 3 + 2];
          tracerPositions[o + 3] = tracerEnd[i * 3];
          tracerPositions[o + 4] = tracerEnd[i * 3 + 1];
          tracerPositions[o + 5] = tracerEnd[i * 3 + 2];
        }
      }
    }
    tracerGeometry.attributes.position.needsUpdate = true;
  }

  function updateShells(dt) {
    for (let i = 0; i < SHELL_COUNT; i++) {
      if (shellLife[i] <= 0) continue;
      shellLife[i] -= dt;
      if (shellLife[i] <= 0) {
        dummy.position.set(0, -100, 0);
        dummy.scale.set(0, 0, 0);
        dummy.updateMatrix();
        shells.setMatrixAt(i, dummy.matrix);
        continue;
      }
      shellVel[i * 3 + 1] -= 16 * dt;
      shellPos[i * 3] += shellVel[i * 3] * dt;
      shellPos[i * 3 + 1] += shellVel[i * 3 + 1] * dt;
      shellPos[i * 3 + 2] += shellVel[i * 3 + 2] * dt;
      if (shellPos[i * 3 + 1] < 0.03) {
        shellPos[i * 3 + 1] = 0.03;
        shellVel[i * 3 + 1] *= -0.28;
        shellVel[i * 3] *= 0.62;
        shellVel[i * 3 + 2] *= 0.62;
      }
      dummy.position.set(shellPos[i * 3], shellPos[i * 3 + 1], shellPos[i * 3 + 2]);
      dummy.rotation.set(shellLife[i] * shellSpin[i], shellLife[i] * shellSpin[i] * 0.5, 0);
      dummy.scale.set(1, 1, 1);
      dummy.updateMatrix();
      shells.setMatrixAt(i, dummy.matrix);
    }
    shells.instanceMatrix.needsUpdate = true;
  }

  function updateFlashes(dt) {
    for (let i = 0; i < FLASH_COUNT; i++) {
      const flash = flashes[i];
      if (flash.life <= 0) continue;
      flash.life -= dt;
      const alpha = Math.max(0, flash.life / 0.05);
      flash.material.opacity = alpha;
      flash.sprite.scale.setScalar(0.32 + (1 - alpha) * 0.12);
    }
    if (lightLife > 0) {
      lightLife -= dt;
      muzzleLight.intensity = Math.max(0, (lightLife / 0.05) * 9);
      if (lightLife <= 0) muzzleLight.intensity = 0;
    }
  }

  function update(dt) {
    updateTracers(dt);
    updateSparks(dt);
    updateShells(dt);
    updateFlashes(dt);
  }

  return { tracer, impact, shell, muzzle, update };
}
