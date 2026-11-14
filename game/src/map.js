// Quay 9 geometry, procedural textures, lighting, collision and shootable volumes.
// Every solid is both a collider and a bullet surface; decorative details are visual only.
import * as THREE from 'three';
import { MAP, MATERIALS, PALETTE } from './config.js';
import { mulberry32 } from './util.js';

const UNIT_BOX = new THREE.BoxGeometry(1, 1, 1);
const UNIT_PLANE = new THREE.PlaneGeometry(1, 1);

function canvasOf(width, height) {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  return [canvas, canvas.getContext('2d')];
}

function textureOf(canvas, repeatX, repeatY) {
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(repeatX, repeatY);
  texture.anisotropy = 8;
  texture.needsUpdate = true;
  return texture;
}

function concreteCanvas(seed) {
  const [canvas, ctx] = canvasOf(512, 512);
  const rng = mulberry32(seed);
  ctx.fillStyle = '#2b333b';
  ctx.fillRect(0, 0, 512, 512);

  for (let i = 0; i < 46; i++) {
    const shade = 22 + Math.floor(rng() * 26);
    ctx.fillStyle = `rgba(${shade},${shade + 5},${shade + 8},${0.04 + rng() * 0.08})`;
    const w = 30 + rng() * 150;
    const h = 20 + rng() * 120;
    ctx.fillRect(rng() * 512, rng() * 512, w, h);
  }
  for (let i = 0; i < 2400; i++) {
    const light = rng() > 0.5;
    ctx.fillStyle = light ? 'rgba(210,220,225,0.055)' : 'rgba(0,0,0,0.06)';
    const s = rng() > 0.9 ? 2 : 1;
    ctx.fillRect(rng() * 512, rng() * 512, s, s);
  }
  for (let i = 0; i < 16; i++) {
    let x = rng() * 512;
    let y = rng() * 512;
    ctx.beginPath();
    ctx.moveTo(x, y);
    for (let j = 0; j < 5; j++) {
      x += (rng() - 0.5) * 34;
      y += 8 + rng() * 20;
      ctx.lineTo(x, y);
    }
    ctx.strokeStyle = `rgba(0,0,0,${0.18 + rng() * 0.22})`;
    ctx.lineWidth = rng() > 0.85 ? 1.5 : 0.7;
    ctx.stroke();
  }
  return canvas;
}

function hazardCanvas() {
  const [canvas, ctx] = canvasOf(256, 256);
  const rng = mulberry32(91);
  ctx.fillStyle = '#0a0d12';
  ctx.fillRect(0, 0, 256, 256);
  ctx.strokeStyle = '#ffb15c';
  ctx.lineWidth = 26;
  for (let x = -256; x < 512; x += 52) {
    ctx.beginPath();
    ctx.moveTo(x, 256);
    ctx.lineTo(x + 256, 0);
    ctx.stroke();
  }
  for (let i = 0; i < 70; i++) {
    ctx.fillStyle = `rgba(0,0,0,${0.05 + rng() * 0.2})`;
    ctx.fillRect(rng() * 256, rng() * 256, 2 + rng() * 12, 1 + rng() * 4);
  }
  return canvas;
}

function stencilCanvas(main, sub) {
  const [canvas, ctx] = canvasOf(512, 256);
  ctx.clearRect(0, 0, 512, 256);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  let size = 154;
  const family = '"Arial Narrow", "Helvetica Neue", Arial, sans-serif';
  do {
    ctx.font = `900 ${size}px ${family}`;
    size -= 6;
  } while (ctx.measureText(main).width > 450 && size > 36);

  ctx.fillStyle = 'rgba(0,0,0,0.45)';
  ctx.fillText(main, 259, 113);
  ctx.fillStyle = '#e8e2d4';
  ctx.fillText(main, 256, 108);

  if (sub) {
    ctx.font = `700 31px ${family}`;
    ctx.fillStyle = 'rgba(232,226,212,0.82)';
    ctx.fillText(sub, 256, 207);
  }
  ctx.strokeStyle = 'rgba(232,226,212,0.55)';
  ctx.lineWidth = 3;
  ctx.strokeRect(8, 8, 496, 240);
  return canvas;
}

function ribCanvas() {
  const [canvas, ctx] = canvasOf(256, 256);
  const rng = mulberry32(4404);
  ctx.fillStyle = '#4a5a66';
  ctx.fillRect(0, 0, 256, 256);
  for (let x = 0; x < 256; x += 16) {
    ctx.fillStyle = 'rgba(255,255,255,0.10)';
    ctx.fillRect(x + 2, 0, 5, 256);
    ctx.fillStyle = 'rgba(0,0,0,0.24)';
    ctx.fillRect(x + 8, 0, 5, 256);
  }
  ctx.fillStyle = 'rgba(0,0,0,0.36)';
  ctx.fillRect(0, 0, 256, 18);
  ctx.fillRect(0, 238, 256, 18);
  for (let i = 0; i < 34; i++) {
    const x = rng() * 256;
    const h = 20 + rng() * 180;
    const grad = ctx.createLinearGradient(0, 0, 0, h);
    grad.addColorStop(0, 'rgba(180,85,45,0.35)');
    grad.addColorStop(1, 'rgba(180,85,45,0)');
    ctx.fillStyle = grad;
    ctx.fillRect(x, 0, 1 + rng() * 4, h);
  }
  for (let i = 0; i < 18; i++) {
    ctx.fillStyle = 'rgba(0,0,0,0.16)';
    ctx.fillRect(rng() * 256, rng() * 256, 5 + rng() * 18, 2);
  }
  return canvas;
}

function corrugatedCanvas() {
  const [canvas, ctx] = canvasOf(256, 256);
  const rng = mulberry32(9912);
  ctx.fillStyle = '#39444e';
  ctx.fillRect(0, 0, 256, 256);
  for (let x = 0; x < 256; x += 10) {
    ctx.fillStyle = 'rgba(255,255,255,0.10)';
    ctx.fillRect(x, 0, 4, 256);
    ctx.fillStyle = 'rgba(0,0,0,0.22)';
    ctx.fillRect(x + 6, 0, 3, 256);
  }
  for (let i = 0; i < 28; i++) {
    const x = rng() * 256;
    const h = 18 + rng() * 110;
    ctx.fillStyle = `rgba(180,85,45,${0.06 + rng() * 0.15})`;
    ctx.fillRect(x, 256 - h, 1 + rng() * 5, h);
  }
  ctx.fillStyle = 'rgba(0,0,0,0.3)';
  ctx.fillRect(0, 246, 256, 10);
  return canvas;
}

function skyCanvas() {
  const [canvas, ctx] = canvasOf(1024, 512);
  const rng = mulberry32(9001);
  const gradient = ctx.createLinearGradient(0, 0, 0, 512);
  gradient.addColorStop(0, '#070d16');
  gradient.addColorStop(0.42, '#0b1420');
  gradient.addColorStop(0.7, '#142333');
  gradient.addColorStop(0.82, '#0e1722');
  gradient.addColorStop(1, '#070d16');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 1024, 512);

  for (let i = 0; i < 220; i++) {
    const y = rng() * 250;
    const alpha = 0.12 + rng() * 0.55;
    ctx.fillStyle = `rgba(220,230,240,${alpha})`;
    const s = rng() > 0.92 ? 2 : 1;
    ctx.fillRect(rng() * 1024, y, s, s);
  }

  const band = ctx.createLinearGradient(0, 326, 0, 424);
  band.addColorStop(0, 'rgba(255,177,92,0)');
  band.addColorStop(0.45, 'rgba(255,138,74,0.20)');
  band.addColorStop(0.62, 'rgba(255,177,92,0.12)');
  band.addColorStop(1, 'rgba(255,177,92,0)');
  ctx.fillStyle = band;
  ctx.fillRect(0, 326, 1024, 98);
  const west = ctx.createLinearGradient(560, 0, 840, 0);
  west.addColorStop(0, 'rgba(255,150,80,0)');
  west.addColorStop(0.5, 'rgba(255,159,88,0.20)');
  west.addColorStop(1, 'rgba(255,150,80,0)');
  ctx.fillStyle = west;
  ctx.fillRect(560, 350, 280, 54);
  return canvas;
}

export function createMap(scene) {
  const root = new THREE.Group();
  root.name = 'quay9-map';
  scene.add(root);

  const colliders = [];
  const shootables = [];

  scene.background = new THREE.Color(PALETTE.deep);
  scene.fog = new THREE.Fog(PALETTE.deep, 18, 80);

  const floorTex = textureOf(concreteCanvas(11), 9, 7);
  const wallTex = textureOf(concreteCanvas(29), 4, 2);
  const hazardTex = textureOf(hazardCanvas(), 2, 1);
  const containerTex = textureOf(ribCanvas(), 2, 1);
  const corrugatedTex = textureOf(corrugatedCanvas(), 3, 1);
  const quayTex = textureOf(stencilCanvas('QUAY 9', 'DRY DOCK 04'), 1, 1);
  const dryTex = textureOf(stencilCanvas('DRY DOCK 04', 'NORTH QUAY'), 1, 1);
  const siteATex = textureOf(stencilCanvas('A', 'DRY DOCK'), 1, 1);
  const siteBTex = textureOf(stencilCanvas('B', 'WAREHOUSE'), 1, 1);
  const arrowTex = textureOf(stencilCanvas('ENTRY', 'A  /  B'), 1, 1);

  const floorMat = new THREE.MeshStandardMaterial({
    map: floorTex,
    roughness: MATERIALS.concrete.roughness,
    metalness: MATERIALS.concrete.metalness,
  });
  const wallMat = new THREE.MeshStandardMaterial({
    map: wallTex,
    roughness: MATERIALS.wall.roughness,
    metalness: MATERIALS.wall.metalness,
  });
  const hazardMat = new THREE.MeshStandardMaterial({
    map: hazardTex,
    roughness: 0.62,
    metalness: 0.08,
  });
  const steelMat = new THREE.MeshStandardMaterial({
    map: containerTex,
    roughness: MATERIALS.steel.roughness,
    metalness: MATERIALS.steel.metalness,
  });
  const corrugatedMat = new THREE.MeshStandardMaterial({
    map: corrugatedTex,
    roughness: 0.58,
    metalness: 0.44,
  });
  const rustMat = new THREE.MeshStandardMaterial({
    color: PALETTE.rust,
    roughness: MATERIALS.rust.roughness,
    metalness: MATERIALS.rust.metalness,
  });
  const darkMat = new THREE.MeshStandardMaterial({
    color: PALETTE.night,
    roughness: 0.7,
    metalness: 0.25,
  });
  const trimMat = new THREE.MeshStandardMaterial({
    color: PALETTE.steel,
    roughness: 0.4,
    metalness: 0.72,
  });
  const puddleMat = new THREE.MeshStandardMaterial({
    color: 0x0b141d,
    roughness: MATERIALS.wet.roughness,
    metalness: MATERIALS.wet.metalness,
    transparent: true,
    opacity: 0.72,
    depthWrite: false,
  });
  const sodiumGlow = new THREE.MeshStandardMaterial({
    color: PALETTE.sodium,
    emissive: PALETTE.sodium,
    emissiveIntensity: 2.6,
    roughness: 0.4,
  });
  const cyanGlow = new THREE.MeshStandardMaterial({
    color: PALETTE.cyan,
    emissive: PALETTE.cyan,
    emissiveIntensity: 2.2,
    roughness: 0.4,
  });
  function addBox(w, h, d, x, y, z, material, options = {}) {
    const mesh = new THREE.Mesh(UNIT_BOX, material);
    mesh.scale.set(w, h, d);
    mesh.position.set(x, y, z);
    mesh.castShadow = options.cast !== false;
    mesh.receiveShadow = options.receive !== false;
    (options.parent || root).add(mesh);

    if (options.solid !== false) {
      const min = new THREE.Vector3(x - w / 2, y - h / 2, z - d / 2);
      const max = new THREE.Vector3(x + w / 2, y + h / 2, z + d / 2);
      const entry = {
        min,
        max,
        mesh,
        kind: options.kind || 'world',
        impact: options.impact || 'concrete',
      };
      colliders.push(entry);
      if (options.shoot !== false) shootables.push(entry);
      return mesh;
    }
    return mesh;
  }

  function visualBox(w, h, d, x, y, z, material, cast = true) {
    return addBox(w, h, d, x, y, z, material, { solid: false, cast });
  }

  function addPlane(texture, w, h, x, y, z, rx, ry, rz = 0, opacity = 0.88) {
    const material = new THREE.MeshBasicMaterial({
      map: texture,
      transparent: true,
      opacity,
      depthWrite: false,
      side: THREE.DoubleSide,
      toneMapped: true,
    });
    const mesh = new THREE.Mesh(UNIT_PLANE, material);
    mesh.scale.set(w, h, 1);
    mesh.position.set(x, y, z);
    mesh.rotation.set(rx, ry, rz);
    mesh.renderOrder = 2;
    root.add(mesh);
    return mesh;
  }

  function addRing(x, y, z, inner, outer, color, opacity = 0.65) {
    const geometry = new THREE.RingGeometry(inner, outer, 32);
    const material = new THREE.MeshBasicMaterial({
      color,
      transparent: true,
      opacity,
      side: THREE.DoubleSide,
      depthWrite: false,
      toneMapped: false,
    });
    const ring = new THREE.Mesh(geometry, material);
    ring.rotation.x = -Math.PI / 2;
    ring.position.set(x, y, z);
    root.add(ring);
    return ring;
  }

  function addPipe(x, y, z, length, axis, radius = 0.11) {
    const geometry = new THREE.CylinderGeometry(radius, radius, length, 10);
    const mesh = new THREE.Mesh(geometry, trimMat);
    mesh.position.set(x, y, z);
    if (axis === 'x') mesh.rotation.z = Math.PI / 2;
    else if (axis === 'z') mesh.rotation.x = Math.PI / 2;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    root.add(mesh);
    return mesh;
  }

  // Sky dome: one generated equirectangular gradient with stars and a west horizon band.
  const skyTex = textureOf(skyCanvas(), 1, 1);
  skyTex.wrapS = THREE.ClampToEdgeWrapping;
  skyTex.wrapT = THREE.ClampToEdgeWrapping;
  const sky = new THREE.Mesh(
    new THREE.SphereGeometry(140, 40, 20),
    new THREE.MeshBasicMaterial({ map: skyTex, side: THREE.BackSide, fog: false }),
  );
  root.add(sky);

  // Floors: a low slab everywhere, plus raised slabs that leave site A 0.25 m sunken.
  addBox(64, 0.5, 48, 0, -0.5, 0, floorMat, { cast: false, impact: 'concrete' });
  addBox(64, 0.25, 29, 0, -0.125, 9.5, floorMat, { cast: false, impact: 'concrete' });
  addBox(64, 0.25, 8, 0, -0.125, -20, floorMat, { cast: false, impact: 'concrete' });
  addBox(10, 0.25, 11, -27, -0.125, -10.5, floorMat, { cast: false, impact: 'concrete' });
  addBox(42, 0.25, 11, 11, -0.125, -10.5, floorMat, { cast: false, impact: 'concrete' });

  // Wet patches catch the sodium and cyan lamps without hiding the concrete.
  const puddles = [
    [-19, -2, 4.2, 2.4], [-8, 7, 3.0, 1.8], [7, 12, 4.6, 2.2],
    [15, -2, 3.4, 2.0], [-24, 13, 2.8, 1.6], [4, -12, 2.4, 1.5],
  ];
  for (const [x, z, w, d] of puddles) {
    const puddle = new THREE.Mesh(UNIT_PLANE, puddleMat);
    puddle.scale.set(w, d, 1);
    puddle.rotation.x = -Math.PI / 2;
    puddle.position.set(x, 0.006, z);
    puddle.receiveShadow = true;
    root.add(puddle);
  }

  // Outer shell.
  addBox(64.6, 6, 0.6, 0, 3, -24, wallMat, { impact: 'concrete' });
  addBox(64.6, 6, 0.6, 0, 3, 24, wallMat, { impact: 'concrete' });
  addBox(0.6, 6, 48.6, -32, 3, 0, wallMat, { impact: 'concrete' });
  addBox(0.6, 6, 48.6, 32, 3, 0, wallMat, { impact: 'concrete' });

  // A long inner wall, with a four-metre mid gap at z = 0.
  addBox(0.6, 4, 14, -21, 2, 9, wallMat, { impact: 'concrete' });
  addBox(0.6, 4, 6, -21, 2, -5, wallMat, { impact: 'concrete' });
  addBox(0.6, 5, 5, -22, 2.5, -5.5, wallMat, { impact: 'concrete' });

  // B tunnel inner wall and dogleg.
  addBox(0.6, 4, 14, 21, 2, 9, wallMat, { impact: 'concrete' });
  addBox(0.6, 4, 6, 21, 2, -5, wallMat, { impact: 'concrete' });
  addBox(3.5, 4, 0.5, 23.75, 2, 8, wallMat, { impact: 'concrete' });
  addBox(2.5, 4, 0.5, 26.75, 2, 5, wallMat, { impact: 'concrete' });
  addBox(0.6, 4, 3, 22.3, 2, 6.5, wallMat, { impact: 'concrete' });

  // Warehouse 9 shell: doors west, south and north; truck parks inside the east wall.
  addBox(0.6, 5, 10, 9, 2.5, -11, corrugatedMat, { impact: 'steel' });
  addBox(0.6, 5, 12, 23, 2.5, -10, corrugatedMat, { impact: 'steel' });
  addBox(4, 5, 0.6, 11, 2.5, -4, corrugatedMat, { impact: 'steel' });
  addBox(6, 5, 0.6, 20, 2.5, -4, corrugatedMat, { impact: 'steel' });
  addBox(4, 5, 0.6, 11, 2.5, -16, corrugatedMat, { impact: 'steel' });
  addBox(6, 5, 0.6, 20, 2.5, -16, corrugatedMat, { impact: 'steel' });
  addBox(0.7, 5.4, 0.7, 9, 2.7, -6, trimMat, { impact: 'steel' });
  addBox(0.7, 5.4, 0.7, 9, 2.7, -16, trimMat, { impact: 'steel' });

  // Defender spawn partition with two doors at x = +-8.
  addBox(15.2, 3, 0.5, -16.4, 1.5, -19, wallMat, { impact: 'concrete' });
  addBox(14.4, 3, 0.5, 0, 1.5, -19, wallMat, { impact: 'concrete' });
  addBox(15.2, 3, 0.5, 16.4, 1.5, -19, wallMat, { impact: 'concrete' });
  for (const side of [-1, 1]) {
    addBox(0.25, 3.4, 0.8, side * 8.8, 1.7, -19, hazardMat, { impact: 'concrete' });
    addBox(0.25, 3.4, 0.8, side * 7.2, 1.7, -19, hazardMat, { impact: 'concrete' });
  }

  function addContainer(x, z, alongZ, id) {
    const w = alongZ ? 2.4 : 6;
    const d = alongZ ? 6 : 2.4;
    addBox(w, 2.4, d, x, 1.2, z, steelMat, { impact: 'steel' });
    visualBox(w + 0.12, 0.12, d + 0.12, x, 2.42, z, trimMat);
    visualBox(w + 0.08, 0.1, d + 0.08, x, 0.08, z, rustMat);
    if (alongZ) {
      addPlane(quayTex, 1.8, 1.4, x + 1.21, 1.5, z, 0, Math.PI / 2, 0, 0.62);
    } else {
      addPlane(quayTex, 1.8, 1.4, x, 1.5, z + 1.21, 0, 0, 0, 0.62);
    }
    const rivetGeometry = new THREE.BoxGeometry(0.06, 0.06, 0.06);
    for (let i = 0; i < 5; i++) {
      const rivet = new THREE.Mesh(rivetGeometry, trimMat);
      rivet.position.set(
        alongZ ? x + 1.23 : x - 2.4 + i * 1.2,
        0.35,
        alongZ ? z - 2.4 + i * 1.2 : z + 1.23,
      );
      root.add(rivet);
    }
    if (id) visualBox(0.5, 0.22, 0.08, x + (alongZ ? 1.24 : 0), 0.55, z + (alongZ ? 0 : 1.24), rustMat);
  }

  addContainer(-27, 6, true, true);
  addContainer(-23, -2, false, true);
  addContainer(-20, -16, true, true);
  addContainer(23, 6, true, true);
  addContainer(27, -2, false, true);
  addContainer(20, -16, false, true);
  addContainer(-10, 14, false, true);
  addContainer(10, 14, false, true);

  // Stacked second containers on the A west and north edges.
  addBox(2.4, 2.4, 6, -27, 3.6, 6, steelMat, { impact: 'steel' });
  visualBox(2.52, 0.14, 6.12, -27, 4.84, 6, trimMat);
  addBox(6, 2.4, 2.4, -20, 3.6, -16, steelMat, { impact: 'steel' });
  visualBox(6.12, 0.14, 2.52, -20, 4.84, -16, trimMat);

  const crateMat = new THREE.MeshStandardMaterial({ color: 0x3d464d, roughness: 0.76, metalness: 0.18 });
  const crateTrim = new THREE.MeshStandardMaterial({ color: 0x6d5b47, roughness: 0.8, metalness: 0.08 });
  function addCrateStack(cx, cz) {
    const offsets = [
      [-0.64, 0.6, -0.64], [0.64, 0.6, -0.64], [-0.64, 0.6, 0.64],
      [0.64, 0.6, 0.64], [0, 1.8, 0],
    ];
    for (let i = 0; i < offsets.length; i++) {
      const [ox, oy, oz] = offsets[i];
      addBox(1.2, 1.2, 1.2, cx + ox, oy, cz + oz, crateMat, { impact: 'wood' });
      visualBox(1.26, 0.07, 0.12, cx + ox, oy - 0.45, cz + oz, crateTrim);
      visualBox(0.12, 0.07, 1.26, cx + ox, oy - 0.45, cz + oz, crateTrim);
    }
  }
  for (const [x, z] of [
    [-14, -6], [-18, -14], [14, -6], [18, -14], [-6, 10],
    [6, 10], [-25, 10], [25, 10], [-12, -18], [12, -18],
  ]) addCrateStack(x, z);

  function addBarrier(x, z, alongZ = false) {
    const w = alongZ ? 0.7 : 3;
    const d = alongZ ? 3 : 0.7;
    addBox(w, 1.1, d, x, 0.55, z, hazardMat, { impact: 'concrete' });
    visualBox(w + 0.12, 0.08, d + 0.12, x, 1.13, z, trimMat);
  }
  addBarrier(-8, 16);
  addBarrier(8, 16);
  addBarrier(-10, -4);
  addBarrier(10, -4);
  addBarrier(-20, -4, true);
  addBarrier(20, -4, true);

  // Pillars under the catwalk.
  for (const [x, z] of [[0, 8], [-2, 0], [2, -6], [0, -12]]) {
    addBox(0.8, 3, 0.8, x, 1.5, z, wallMat, { impact: 'concrete' });
    visualBox(1.0, 0.12, 1.0, x, 2.95, z, trimMat);
  }

  // Truck trailer at B, parked against the warehouse east wall.
  addBox(3, 3.2, 8, 20, 1.6, -10, steelMat, { impact: 'steel' });
  visualBox(3.15, 0.14, 8.15, 20, 3.21, -10, trimMat);
  visualBox(2.2, 0.5, 0.4, 20, 0.38, -6.1, darkMat);
  visualBox(2.2, 0.5, 0.4, 20, 0.38, -13.9, darkMat);
  addPlane(quayTex, 2.2, 1.6, 18.48, 1.9, -10, 0, -Math.PI / 2, 0, 0.6);
  for (let i = 0; i < 4; i++) visualBox(0.05, 2.2, 0.06, 18.46, 1.65, -12.9 + i * 1.2, darkMat);

  // Crane leg and truss over A (the truss is visual only above head height).
  addBox(1.2, 6, 1.2, -22, 3, -16, rustMat, { impact: 'steel' });
  visualBox(1.5, 0.25, 1.5, -22, 5.8, -16, darkMat);
  visualBox(16, 0.35, 0.35, -18, 5.5, -10.5, rustMat);
  visualBox(0.3, 0.3, 0.3, -10, 5.5, -10.5, rustMat);
  visualBox(0.25, 2.2, 0.25, -10.5, 4.4, -10.5, trimMat);
  visualBox(1.0, 0.2, 1.0, -10.5, 3.25, -10.5, rustMat);
  for (let i = 0; i < 5; i++) {
    const x = -25.5 + i * 3;
    visualBox(0.16, 0.16, 5.4, x, 5.05, -13.2, trimMat);
  }

  // Catwalk deck, stairs, rails and emissive strips.
  addBox(3, 0.2, 15, 0, 2.4, -3.5, steelMat, { impact: 'steel' });
  for (let i = 0; i < 8; i++) {
    const top = (i + 1) * 0.3125;
    addBox(2.4, top, 0.4, 0, top / 2, 6.8 - i * 0.4, hazardMat, { impact: 'concrete' });
    const northTop = 2.5 - i * 0.3125;
    addBox(2.4, northTop, 0.4, 0, northTop / 2, -11.2 - i * 0.4, hazardMat, { impact: 'concrete' });
  }
  for (const side of [-1, 1]) {
    for (let i = 0; i < 8; i++) {
      visualBox(0.06, 1.0, 0.06, side * 1.46, 3.0, 3.5 - i * 1.9, trimMat);
    }
    visualBox(0.07, 0.07, 14.6, side * 1.46, 3.5, -3.5, trimMat);
    visualBox(0.06, 0.05, 14.6, side * 1.42, 2.53, -3.5, cyanGlow, false);
  }
  visualBox(3.0, 0.06, 0.08, 0, 3.5, 4, trimMat);

  // Pipe runs: north wall headers and the low run under the catwalk.
  for (let i = 0; i < 3; i++) addPipe(0, 3.5 + i * 0.32, -23.2, 48, 'x', 0.1);
  addPipe(-1.2, 1.9, -3.5, 14, 'z', 0.16);
  addPipe(1.1, 2.0, -3.5, 14, 'z', 0.1);

  // Site markers, floor stencils and step edges.
  addPlane(hazardTex, 4.2, 4.2, -16, -0.235, -10, -Math.PI / 2, 0, 0, 0.55);
  addPlane(siteATex, 3.2, 1.9, -16, -0.228, -10, -Math.PI / 2, 0, 0, 0.92);
  addRing(-16, -0.22, -10, 2.55, 2.72, PALETTE.rust, 0.73);
  addPlane(hazardTex, 4.2, 4.2, 16, 0.012, -10, -Math.PI / 2, 0, 0, 0.55);
  addPlane(siteBTex, 3.2, 1.9, 16, 0.018, -10, -Math.PI / 2, 0, 0, 0.92);
  addRing(16, 0.025, -10, 2.55, 2.72, PALETTE.cyan, 0.73);

  addPlane(quayTex, 5.2, 2.6, 0, 3.1, 23.66, 0, Math.PI, 0, 0.9);
  addPlane(dryTex, 4.2, 2.1, -31.66, 3.2, 8, 0, Math.PI / 2, 0, 0.9);
  addPlane(arrowTex, 2.5, 1.25, 7, 2.2, -16.36, 0, 0, 0, 0.72);

  // Spawn rings: rust for TIDE, cyan for the three defender markers.
  addRing(0, 0.016, 20, 0.85, 1.02, PALETTE.rust, 0.75);
  addRing(0, 0.016, 20, 1.45, 1.5, PALETTE.rust, 0.4);
  for (const marker of MAP.defenderMarkers) {
    addRing(marker.x, 0.016, marker.z, 0.3, 0.42, PALETTE.cyan, 0.8);
  }

  // Lamps and hangars.
  function addLamp(x, y, z, material, color) {
    visualBox(0.5, 0.21, 0.5, x, y + 0.2, z, darkMat);
    const glow = new THREE.Mesh(UNIT_BOX, material);
    glow.scale.set(0.42, 0.06, 0.42);
    glow.position.set(x, y + 0.08, z);
    root.add(glow);
    const light = new THREE.PointLight(color, 1, 1, 2);
    light.position.set(x, y, z);
    root.add(light);
    return light;
  }

  const sodiumA = addLamp(-22, 4.2, -8, sodiumGlow, PALETTE.sodium);
  sodiumA.intensity = 26;
  sodiumA.distance = 18;
  const sodiumB = addLamp(-12, 4.2, -14, sodiumGlow, PALETTE.sodium);
  sodiumB.intensity = 26;
  sodiumB.distance = 18;
  const cyanA = addLamp(13, 3.6, -8, cyanGlow, PALETTE.cyan);
  cyanA.intensity = 18;
  cyanA.distance = 16;
  const cyanB = addLamp(19, 3.6, -13, cyanGlow, PALETTE.cyan);
  cyanB.intensity = 18;
  cyanB.distance = 16;
  const catwalkLight = addLamp(0, 3.0, 0, sodiumGlow, 0xffd2a0);
  catwalkLight.intensity = 10;
  catwalkLight.distance = 12;
  catwalkLight.color.setHex(0xffd2a0);

  // Emissive strip lights in the warehouse.
  visualBox(0.1, 0.08, 8, 22.65, 4.45, -10, cyanGlow, false);
  visualBox(0.1, 0.08, 8, 9.35, 4.45, -10, cyanGlow, false);
  visualBox(0.1, 0.06, 6, 11.2, 4.4, -5, cyanGlow, false);

  const hemisphere = new THREE.HemisphereLight(
    MAP.lights.hemisphere.sky,
    MAP.lights.hemisphere.ground,
    MAP.lights.hemisphere.intensity,
  );
  scene.add(hemisphere);

  const moon = new THREE.DirectionalLight(MAP.lights.moon.color, MAP.lights.moon.intensity);
  moon.position.set(...MAP.lights.moon.position);
  moon.castShadow = true;
  moon.shadow.mapSize.set(2048, 2048);
  moon.shadow.camera.left = -MAP.lights.moon.shadow;
  moon.shadow.camera.right = MAP.lights.moon.shadow;
  moon.shadow.camera.top = MAP.lights.moon.shadow;
  moon.shadow.camera.bottom = -MAP.lights.moon.shadow;
  moon.shadow.camera.near = 0.5;
  moon.shadow.camera.far = 90;
  moon.shadow.bias = -0.0006;
  moon.target.position.set(0, 0, 0);
  scene.add(moon);
  scene.add(moon.target);

  return {
    root,
    colliders,
    shootables,
    sites: MAP.sites,
    spawns: {
      attacker: MAP.attackerSpawn,
      defender: MAP.defenderSpawn,
      defenderMarkers: MAP.defenderMarkers,
      botSpawns: MAP.defenderMarkers,
    },
    bounds: MAP.bounds,
    moon,
    hemisphere,
    lights: [sodiumA, sodiumB, cyanA, cyanB, catwalkLight],
  };
}
