// The map owns geometry, generated textures, lights and the single list of
// solid AABBs. Bullets, vision, grenades and movement all consume that list so
// nothing can see or shoot through a wall that the player cannot walk through.
import * as THREE from 'three';
import { MAP, PALETTE } from './config.js';
import { mulberry32, rayAABB } from './util.js';

export function createMap(scene, anisotropy = 8) {
  const colliders = [];
  const scratch = { t: Infinity, box: null };
  const textures = makeTextures();
  const mats = makeMaterials(textures);
  const group = new THREE.Group();
  group.name = 'quay9';
  scene.add(group);

  function collider(minx, miny, minz, maxx, maxy, maxz) {
    const box = { minx, miny, minz, maxx, maxy, maxz };
    colliders.push(box);
    return box;
  }

  function box(x, y, z, w, h, d, material, solid = true, cast = true) {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material);
    mesh.position.set(x, y + h / 2, z);
    mesh.castShadow = cast;
    mesh.receiveShadow = true;
    group.add(mesh);
    if (solid) collider(x - w / 2, y, z - d / 2, x + w / 2, y + h, z + d / 2);
    return mesh;
  }

  function decal(x, y, z, w, h, texture, rotationY = 0, opacity = 0.62) {
    const material = new THREE.MeshBasicMaterial({
      map: texture, transparent: true, opacity, depthWrite: false,
      polygonOffset: true, polygonOffsetFactor: -2, side: THREE.DoubleSide,
    });
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(w, h), material);
    mesh.position.set(x, y, z);
    mesh.rotation.y = rotationY;
    mesh.renderOrder = 2;
    group.add(mesh);
    return mesh;
  }

  function makeTextures() {
    const rng = mulberry32(904);
    const concrete = document.createElement('canvas');
    concrete.width = concrete.height = 256;
    const c = concrete.getContext('2d');
    c.fillStyle = '#3a434c';
    c.fillRect(0, 0, 256, 256);
    for (let i = 0; i < 2400; i++) {
      const v = 38 + Math.floor(rng() * 46);
      c.fillStyle = `rgba(${v},${v + 5},${v + 9},${0.1 + rng() * 0.25})`;
      c.fillRect(rng() * 256, rng() * 256, 1 + rng() * 2, 1 + rng() * 2);
    }
    c.strokeStyle = 'rgba(14,20,26,.55)';
    c.lineWidth = 1;
    for (let i = 0; i < 12; i++) {
      let x = rng() * 256;
      let y = rng() * 256;
      c.beginPath();
      c.moveTo(x, y);
      for (let j = 0; j < 7; j++) {
        x += (rng() - 0.5) * 34;
        y += (rng() - 0.5) * 34;
        c.lineTo(x, y);
      }
      c.stroke();
    }
    for (let i = 0; i < 5; i++) {
      const gx = rng() * 256;
      const gy = rng() * 256;
      const grad = c.createRadialGradient(gx, gy, 2, gx, gy, 30 + rng() * 35);
      grad.addColorStop(0, 'rgba(15,22,28,.32)');
      grad.addColorStop(1, 'rgba(15,22,28,0)');
      c.fillStyle = grad;
      c.fillRect(0, 0, 256, 256);
    }
    const concreteTex = canvasTexture(concrete, anisotropy, true);

    const ribs = document.createElement('canvas');
    ribs.width = ribs.height = 128;
    const r = ribs.getContext('2d');
    r.fillStyle = '#4c5a65';
    r.fillRect(0, 0, 128, 128);
    for (let x = 0; x < 128; x += 16) {
      r.fillStyle = '#313d46';
      r.fillRect(x, 0, 5, 128);
      r.fillStyle = '#64737e';
      r.fillRect(x + 6, 0, 3, 128);
      r.fillStyle = 'rgba(180,85,45,.22)';
      if ((x / 16) % 3 === 0) r.fillRect(x + 10, 0, 2, 128);
    }
    r.fillStyle = 'rgba(8,12,17,.25)';
    for (let i = 0; i < 70; i++) r.fillRect(rng() * 128, rng() * 128, 1, 2 + rng() * 8);
    const ribTex = canvasTexture(ribs, anisotropy, true);

    const hazard = document.createElement('canvas');
    hazard.width = hazard.height = 128;
    const h = hazard.getContext('2d');
    h.fillStyle = '#12191f';
    h.fillRect(0, 0, 128, 128);
    h.strokeStyle = '#d99a55';
    h.lineWidth = 16;
    for (let i = -128; i < 256; i += 44) {
      h.beginPath();
      h.moveTo(i, 128);
      h.lineTo(i + 128, 0);
      h.stroke();
    }
    h.fillStyle = 'rgba(0,0,0,.18)';
    for (let i = 0; i < 120; i++) h.fillRect(rng() * 128, rng() * 128, 2, 1);
    const hazardTex = canvasTexture(hazard, anisotropy, true);

    const corrugated = document.createElement('canvas');
    corrugated.width = corrugated.height = 128;
    const w = corrugated.getContext('2d');
    w.fillStyle = '#46525c';
    w.fillRect(0, 0, 128, 128);
    for (let x = 0; x < 128; x += 8) {
      w.fillStyle = x % 16 === 0 ? '#586772' : '#36414a';
      w.fillRect(x, 0, 4, 128);
    }
    for (let i = 0; i < 8; i++) {
      w.fillStyle = 'rgba(180,85,45,.16)';
      w.fillRect(rng() * 128, 0, 2 + rng() * 4, 30 + rng() * 90);
    }
    const corrTex = canvasTexture(corrugated, anisotropy, true);

    return {
      floor: cloneRepeat(concreteTex, 14, 10),
      wall: cloneRepeat(concreteTex, 5, 2),
      ribs: cloneRepeat(ribTex, 2, 1),
      hazard: cloneRepeat(hazardTex, 3, 1),
      corrugated: cloneRepeat(corrTex, 3, 1),
      stencilA: stencil('A', 'SITE A', '#ffb15c', '#b4552d'),
      stencilB: stencil('B', 'WAREHOUSE B', '#5fd6d0', '#1d5c63'),
      quay: label('QUAY 9', '#ffb15c'),
      dock: label('DRY DOCK 04', '#5fd6d0'),
      arrow: label('◄ A   MID   B ►', '#e8e2d4'),
    };
  }

  function makeMaterials(t) {
    const tint = (hex, scale) => new THREE.Color(hex).multiplyScalar(scale);
    return {
      floor: new THREE.MeshStandardMaterial({ map: t.floor, color: 0xa8b4be, roughness: 0.52, metalness: 0.08 }),
      wall: new THREE.MeshStandardMaterial({ map: t.wall, color: 0x8d99a3, roughness: 0.82, metalness: 0.08 }),
      concrete: new THREE.MeshStandardMaterial({ map: t.wall, color: 0x6f7a83, roughness: 0.88, metalness: 0.04 }),
      steel: new THREE.MeshStandardMaterial({ map: t.ribs, color: 0x7e909c, roughness: 0.44, metalness: 0.42 }),
      dark: new THREE.MeshStandardMaterial({ map: t.corrugated, color: 0x4b5963, roughness: 0.56, metalness: 0.35 }),
      rust: new THREE.MeshStandardMaterial({ map: t.ribs, color: tint(PALETTE.rust, 0.9), roughness: 0.62, metalness: 0.28 }),
      crate: new THREE.MeshStandardMaterial({ map: t.corrugated, color: 0x87949e, roughness: 0.7, metalness: 0.15 }),
      trim: new THREE.MeshStandardMaterial({ color: 0x151d25, roughness: 0.82, metalness: 0.14 }),
      puddle: new THREE.MeshStandardMaterial({ color: 0x10202b, roughness: 0.05, metalness: 0.85, transparent: true, opacity: 0.62, depthWrite: false }),
      sodium: new THREE.MeshStandardMaterial({ color: PALETTE.sodium, emissive: PALETTE.sodium, emissiveIntensity: 2.4, roughness: 0.4 }),
      cyan: new THREE.MeshStandardMaterial({ color: PALETTE.cyan, emissive: PALETTE.cyan, emissiveIntensity: 2.1, roughness: 0.4 }),
      lamp: new THREE.MeshStandardMaterial({ color: 0x1b232b, roughness: 0.5, metalness: 0.7 }),
    };
  }

  function buildWorld() {
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(64, 48), mats.floor);
    floor.rotation.x = -Math.PI / 2;
    floor.position.set(0, 0, 0);
    floor.receiveShadow = true;
    group.add(floor);

    // Perimeter and lane walls. The two 4 m lane gaps at z=0 and the two north
    // doors are the only ways between the spawn, the cross and the sites.
    box(0, 0, -24, 64, 6, 0.6, mats.wall);
    box(0, 0, 24, 64, 6, 0.6, mats.wall);
    box(-32, 0, 0, 0.6, 6, 48, mats.wall);
    box(32, 0, 0, 0.6, 6, 48, mats.wall);
    box(-21, 0, 9, 0.5, 6, 14, mats.wall);
    box(-21, 0, -5, 0.5, 6, 6, mats.wall);
    box(21, 0, 9, 0.5, 6, 14, mats.wall);
    box(21, 0, -5, 0.5, 6, 6, mats.wall);
    box(-20.5, 0, -18, 23, 6, 0.5, mats.wall);
    box(0, 0, -18, 14, 6, 0.5, mats.wall);
    box(20.5, 0, -18, 23, 6, 0.5, mats.wall);
    box(9, 0, -13, 0.4, 4.2, 6, mats.dark);
    box(-9, 0, -13, 0.4, 4.2, 6, mats.dark);
    // B tunnel dogleg: the east half is sealed at z=8 and the west half at
    // z=11, so entering B requires a right-left turn through a 3.5 m doorway.
    box(28.25, 0, 8, 7.5, 3, 0.5, mats.dark);
    box(24.5, 0, 11, 0.5, 3, 6, mats.dark);

    // Catwalk over mid with stairs at both ends, so the sightline is a real
    // risk and the player can take height without a lift.
    box(0, 2.5, -3.5, 3, 0.12, 15, mats.steel);
    for (let i = 0; i < 10; i++) {
      const rise = 0.25 * (i + 1);
      box(0, 0, 9.45 - i * 0.55, 3, rise, 0.55, mats.dark, true, false);
      box(0, 0, -16.45 + i * 0.55, 3, rise, 0.55, mats.dark, true, false);
    }
    for (const sx of [-1.46, 1.46]) {
      box(sx, 2.62, -3.5, 0.05, 0.035, 15, mats.cyan, false, false);
      box(sx, 3.28, -3.5, 0.05, 0.05, 15, mats.lamp, false, false);
      for (let z = -10.5; z <= 3.5; z += 2.3) box(sx, 2.62, z, 0.06, 0.66, 0.06, mats.lamp, false, false);
    }
    for (const p of [[0, 8], [-2, 0], [2, -6], [0, -12]]) box(p[0], 0, p[1], 0.8, 3, 0.8, mats.concrete);

    // A long and B tunnel chokepoints: containers force a slalom but leave a
    // readable lane on both sides of each block.
    const containers = [
      [-27, 6, 2.4, 6, mats.rust], [-27, 0, 6, 2.4, mats.steel], [-20, -16, 6, 2.4, mats.rust],
      [23, 6, 2.4, 6, mats.steel], [27, -2, 2.4, 6, mats.rust], [20, -16, 6, 2.4, mats.steel],
      [-10, 14, 6, 2.4, mats.rust], [10, 14, 6, 2.4, mats.steel],
    ];
    for (const [x, z, w, d, mat] of containers) {
      box(x, 0, z, w, 2.4, d, mat);
      box(x, 2.4, z, w * 0.96, 0.08, d * 0.96, mats.dark, false, false);
      // Dark corner posts and top/bottom trim break up the largest flat faces.
      for (const sx of [-1, 1]) for (const sz of [-1, 1]) box(x + sx * (w / 2 - 0.04), 0, z + sz * (d / 2 - 0.04), 0.08, 2.4, 0.08, mats.trim, false, false);
      box(x, 0, z, w + 0.01, 0.07, d + 0.01, mats.trim, false, false);
      box(x, 2.3, z, w + 0.01, 0.07, d + 0.01, mats.trim, false, false);
    }
    // Stencilled ids sit on container faces, never near a staged camera.
    decal(-27, 1.45, 3.01, 2.4, 0.62, textures.quay);
    decal(10, 1.45, 12.81, 2.8, 0.6, textures.dock);
    decal(23, 1.45, 3.01, 2.2, 0.55, textures.quay, 0);
    decal(-31.62, 2.2, -10, 2.4, 2.4, textures.stencilA, Math.PI / 2, 0.55);
    decal(31.62, 2.2, -10, 2.4, 2.4, textures.stencilB, -Math.PI / 2, 0.55);

    const crates = [[-14, -6], [-18, -14], [14, -6], [18, -14], [-6, 10], [6, 10], [-25, 10], [25, 10], [-12, -18], [12, -18]];
    for (const [cx, cz] of crates) {
      box(cx - 0.62, 0, cz - 0.6, 1.2, 1.2, 1.2, mats.crate);
      box(cx + 0.64, 0, cz - 0.6, 1.2, 1.2, 1.2, mats.crate);
      box(cx, 1.2, cz - 0.6, 1.2, 1.2, 1.2, mats.crate, false, false);
      box(cx + 0.1, 0, cz + 0.7, 1.2, 1.2, 1.2, mats.crate);
    }

    for (const [x, z] of [[-8, 16], [8, 16], [-10, -4], [10, -4], [-14, -4], [20, -4]]) {
      box(x, 0, z, 3, 1.1, 0.7, mats.concrete);
      decal(x, 0.72, z + 0.36, 2.8, 0.3, textures.hazard, 0, 0.45);
      decal(x, 0.72, z - 0.36, 2.8, 0.3, textures.hazard, Math.PI, 0.45);
    }

    box(21.5, 0, -10, 3, 3.2, 8, mats.dark);
    box(-22, 0, -16, 1.2, 6, 1.2, mats.dark);
    box(-16, 5.5, -16, 12, 0.5, 0.5, mats.rust, false, false);
    box(-21, 4.6, -16, 9, 0.25, 0.25, mats.dark, false, false);

    const pipe = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.18, 60, 8), mats.steel);
    pipe.rotation.z = Math.PI / 2;
    pipe.position.set(0, 3.3, -22.9);
    pipe.castShadow = true;
    group.add(pipe);
    for (let x = -28; x <= 28; x += 8) box(x, 2.5, -22.9, 0.12, 0.8, 0.12, mats.dark, false, false);

    // Site floor marks stay dim and small: geometry and enemies must win.
    const siteA = decal(-16, 0.028, -10, 2.0, 2.0, textures.stencilA, 0, 0.55);
    siteA.rotation.x = -Math.PI / 2;
    const siteB = decal(16, 0.028, -10, 2.0, 2.0, textures.stencilB, 0, 0.55);
    siteB.rotation.x = -Math.PI / 2;
    decal(0, 0.03, 10, 3.2, 0.5, textures.arrow, 0, 0.5).rotation.x = -Math.PI / 2;

    for (const [x, z, s] of [[-19, -6, 2.4], [-8, -12, 1.8], [6, 8, 2.1], [17, -5, 2.6], [-25, 12, 1.6], [24, 14, 1.9], [0, -9, 1.5]]) {
      const puddle = new THREE.Mesh(new THREE.CircleGeometry(1, 20), mats.puddle);
      puddle.rotation.x = -Math.PI / 2;
      puddle.scale.set(s, s * 0.62, 1);
      puddle.position.set(x, 0.016, z);
      puddle.renderOrder = 1;
      group.add(puddle);
    }

    addLights();
    stars();
  }

  function addLights() {
    scene.add(new THREE.HemisphereLight(0x3a566f, 0x18202a, 2.7));
    // A dim fill so walls that face away from the moon are not pure black in a
    // still; the value stays below the fog line so the mood holds.
    scene.add(new THREE.AmbientLight(0x2b3b49, 0.5));
    const moon = new THREE.DirectionalLight(0x9db7d8, 2.4);
    moon.position.set(-18, 28, 12);
    moon.castShadow = true;
    moon.shadow.mapSize.set(2048, 2048);
    moon.shadow.camera.left = -38;
    moon.shadow.camera.right = 38;
    moon.shadow.camera.top = 38;
    moon.shadow.camera.bottom = -38;
    moon.shadow.camera.near = 1;
    moon.shadow.camera.far = 90;
    moon.shadow.bias = -0.0007;
    moon.shadow.normalBias = 0.025;
    scene.add(moon);
    // Camera-side fill so the shadowed faces of the containers and pillars do
    // not fall to pure black in the screenshots; no shadow, low intensity.
    const fill = new THREE.DirectionalLight(0x8aa6c4, 1.25);
    fill.position.set(16, 9, 26);
    scene.add(fill);

    function lamp(x, y, z, color, intensity, distance, warm) {
      const light = new THREE.PointLight(color, intensity, distance, 2);
      light.position.set(x, y, z);
      scene.add(light);
      const housing = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.12, 0.34), mats.lamp);
      housing.position.set(x, y + 0.12, z);
      group.add(housing);
      const bulb = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.06, 0.26), warm ? mats.sodium : mats.cyan);
      bulb.position.set(x, y + 0.04, z);
      group.add(bulb);
      if (y > 3) {
        box(x, y + 0.34, z, 0.1, 0.56, 0.1, mats.steel, false, false);
        box(x, y + 0.64, z, 0.4, 0.05, 0.4, mats.lamp, false, false);
      }
    }
    lamp(-22, 4.2, -8, 0xff9a4a, 58, 24, true);
    lamp(-12, 4.2, -14, 0xff9a4a, 48, 22, true);
    lamp(13, 3.6, -8, 0x57e0d6, 48, 22, false);
    lamp(19, 3.6, -13, 0x57e0d6, 42, 20, false);
    lamp(0, 3.1, 0, 0xffd9a8, 30, 18, true);
  }

  function stars() {
    const rng = mulberry32(77);
    const positions = new Float32Array(210 * 3);
    for (let i = 0; i < 210; i++) {
      positions[i * 3] = (rng() - 0.5) * 150;
      positions[i * 3 + 1] = 24 + rng() * 38;
      positions[i * 3 + 2] = (rng() - 0.5) * 150;
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    const material = new THREE.PointsMaterial({ color: PALETTE.paper, size: 0.32, transparent: true, opacity: 0.55, depthWrite: false, fog: false });
    group.add(new THREE.Points(geometry, material));
  }

  function rayCount(ox, oy, oz, dx, dy, dz) {
    let best = Infinity;
    let hit = null;
    for (let i = 0; i < colliders.length; i++) {
      const t = rayAABB(ox, oy, oz, dx, dy, dz, colliders[i]);
      if (t < best) { best = t; hit = colliders[i]; }
    }
    scratch.t = best;
    scratch.box = hit;
    return scratch;
  }

  function blocked(ox, oy, oz, dx, dy, dz, distance) {
    return rayCount(ox, oy, oz, dx, dy, dz).t < distance - 0.05;
  }

  function nearSite(x, z) {
    for (const key of ['A', 'B']) {
      const site = MAP.sites[key];
      const dx = x - site.x;
      const dz = z - site.z;
      if (dx * dx + dz * dz <= site.radius * site.radius) return key;
    }
    return null;
  }

  buildWorld();
  return { colliders, group, textures, materials: mats, raycast: rayCount, blocked, nearSite, sites: MAP.sites };
}

function canvasTexture(canvas, anisotropy, repeat) {
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = anisotropy;
  texture.wrapS = texture.wrapT = repeat ? THREE.RepeatWrapping : THREE.ClampToEdgeWrapping;
  texture.needsUpdate = true;
  return texture;
}

function cloneRepeat(texture, x, y) {
  const clone = texture.clone();
  clone.wrapS = clone.wrapT = THREE.RepeatWrapping;
  clone.repeat.set(x, y);
  clone.needsUpdate = true;
  return clone;
}

function stencil(letter, subtitle, glow, edge) {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 256;
  const c = canvas.getContext('2d');
  c.clearRect(0, 0, 256, 256);
  c.strokeStyle = edge;
  c.lineWidth = 6;
  c.strokeRect(10, 10, 236, 236);
  c.strokeStyle = glow;
  c.lineWidth = 2;
  c.strokeRect(20, 20, 216, 216);
  c.fillStyle = glow;
  c.font = 'bold 140px "Arial Narrow", sans-serif';
  c.textAlign = 'center';
  c.textBaseline = 'middle';
  c.globalAlpha = 0.9;
  c.fillText(letter, 128, 118);
  c.globalAlpha = 0.75;
  c.font = 'bold 20px ui-monospace, monospace';
  c.fillText(subtitle, 128, 214);
  c.globalAlpha = 0.35;
  c.fillStyle = edge;
  for (let i = 0; i < 26; i++) c.fillRect(10 + i * 9, 234, 5, 4);
  return canvasTexture(canvas, 4, false);
}

function label(text, color) {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 128;
  const c = canvas.getContext('2d');
  c.clearRect(0, 0, 512, 128);
  c.fillStyle = 'rgba(7,13,22,.35)';
  c.fillRect(0, 28, 512, 72);
  c.fillStyle = color;
  c.font = 'bold 54px "Arial Narrow", sans-serif';
  c.textAlign = 'center';
  c.textBaseline = 'middle';
  c.globalAlpha = 0.88;
  c.fillText(text, 256, 64);
  return canvasTexture(canvas, 4, false);
}
