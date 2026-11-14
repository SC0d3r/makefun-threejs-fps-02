// The harbour is assembled from textured boxes. This module is the single
// source of truth for colliders; nav, bots, player and bullets all read them.
import * as THREE from 'three';
import { COLORS, SITES } from './config.js';
import { mulberry32 } from './util.js';

const TEX = {};
const MAT = {};
const rand = mulberry32(0x51a7c0de);

function canvasTexture(size, paint, repeatX, repeatY) {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  paint(ctx, size);
  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(repeatX, repeatY);
  texture.anisotropy = 4;
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function noise(ctx, size, count, alpha, light) {
  for (let i = 0; i < count; i += 1) {
    const v = Math.floor(rand() * 60) + (light ? 150 : 12);
    ctx.fillStyle = `rgba(${v},${v + 4},${v + 7},${alpha})`;
    const x = rand() * size;
    const y = rand() * size;
    ctx.fillRect(x, y, 1 + rand() * 2, 1 + rand() * 2);
  }
}

function makeTextures() {
  TEX.concrete = canvasTexture(
    512,
    (ctx, size) => {
      ctx.fillStyle = '#2b333b';
      ctx.fillRect(0, 0, size, size);
      noise(ctx, size, 5200, 0.16, false);
      ctx.strokeStyle = 'rgba(10,14,18,0.35)';
      for (let i = 0; i < 12; i += 1) {
        ctx.beginPath();
        let x = rand() * size;
        let y = rand() * size;
        ctx.moveTo(x, y);
        for (let j = 0; j < 5; j += 1) {
          x += (rand() - 0.5) * 90;
          y += rand() * 40;
          ctx.lineTo(x, y);
        }
        ctx.stroke();
      }
      ctx.strokeStyle = 'rgba(255,255,255,0.035)';
      for (let i = 0; i < 6; i += 1) {
        ctx.beginPath();
        ctx.moveTo(0, rand() * size);
        ctx.lineTo(size, rand() * size);
        ctx.stroke();
      }
    },
    10,
    8,
  );
  TEX.wall = canvasTexture(
    512,
    (ctx, size) => {
      ctx.fillStyle = '#333c44';
      ctx.fillRect(0, 0, size, size);
      noise(ctx, size, 3400, 0.12, false);
      ctx.fillStyle = 'rgba(7,13,22,0.3)';
      for (let y = 64; y < size; y += 96) ctx.fillRect(0, y, size, 3);
      ctx.fillStyle = 'rgba(180,85,45,0.11)';
      for (let i = 0; i < 14; i += 1) ctx.fillRect(rand() * size, rand() * size, 4 + rand() * 12, 40 + rand() * 120);
    },
    6,
    2,
  );
  TEX.container = canvasTexture(
    256,
    (ctx, size) => {
      ctx.fillStyle = '#4a5a66';
      ctx.fillRect(0, 0, size, size);
      for (let x = 0; x < size; x += 16) {
        ctx.fillStyle = x % 32 === 0 ? 'rgba(255,255,255,0.09)' : 'rgba(0,0,0,0.22)';
        ctx.fillRect(x, 0, 7, size);
        ctx.fillStyle = 'rgba(0,0,0,0.18)';
        ctx.fillRect(x + 8, 0, 2, size);
      }
      ctx.fillStyle = 'rgba(180,85,45,0.36)';
      for (let i = 0; i < 18; i += 1) {
        ctx.fillRect(rand() * size, rand() * size, 2 + rand() * 4, 30 + rand() * 90);
      }
      ctx.fillStyle = 'rgba(7,13,22,0.22)';
      ctx.fillRect(0, 0, size, 10);
      ctx.fillRect(0, size - 12, size, 12);
    },
    2,
    1,
  );
  TEX.ribs = canvasTexture(
    256,
    (ctx, size) => {
      ctx.fillStyle = '#3d4b56';
      ctx.fillRect(0, 0, size, size);
      for (let x = 0; x < size; x += 12) {
        ctx.fillStyle = 'rgba(255,255,255,0.1)';
        ctx.fillRect(x, 0, 3, size);
        ctx.fillStyle = 'rgba(7,13,22,0.3)';
        ctx.fillRect(x + 5, 0, 4, size);
      }
      ctx.fillStyle = 'rgba(180,85,45,0.18)';
      for (let i = 0; i < 12; i += 1) ctx.fillRect(rand() * size, rand() * size, 3, 20 + rand() * 70);
    },
    3,
    1,
  );
  TEX.hazard = canvasTexture(
    256,
    (ctx, size) => {
      ctx.fillStyle = '#14191f';
      ctx.fillRect(0, 0, size, size);
      ctx.strokeStyle = '#ffb15c';
      ctx.lineWidth = 34;
      for (let i = -size; i < size * 2; i += 70) {
        ctx.beginPath();
        ctx.moveTo(i, size);
        ctx.lineTo(i + size, 0);
        ctx.stroke();
      }
      ctx.fillStyle = 'rgba(255,255,255,0.08)';
      ctx.fillRect(0, 0, size, 4);
    },
    1,
    1,
  );
  TEX.site = (letter, accent) =>
    canvasTexture(
      512,
      (ctx, size) => {
        ctx.fillStyle = '#14191f';
        ctx.fillRect(0, 0, size, size);
        ctx.strokeStyle = '#ffb15c';
        ctx.lineWidth = 18;
        ctx.strokeRect(18, 18, size - 36, size - 36);
        ctx.globalAlpha = 0.18;
        for (let i = -size; i < size * 2; i += 52) {
          ctx.strokeStyle = accent;
          ctx.lineWidth = 18;
          ctx.beginPath();
          ctx.moveTo(i, size);
          ctx.lineTo(i + size, 0);
          ctx.stroke();
        }
        ctx.globalAlpha = 1;
        ctx.fillStyle = accent;
        ctx.font = 'bold 330px Georgia, serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(letter, size / 2, size / 2 + 18);
        ctx.fillStyle = '#e8e2d4';
        ctx.font = 'bold 26px monospace';
        ctx.fillText('QUAY 9', size / 2, 64);
      },
      1,
      1,
    );
  TEX.stencil = canvasTexture(
    512,
    (ctx, size) => {
      ctx.fillStyle = '#12171d';
      ctx.fillRect(0, 0, size, size);
      ctx.fillStyle = '#e8e2d4';
      ctx.font = 'bold 110px monospace';
      ctx.textAlign = 'center';
      ctx.fillText('QUAY 9', size / 2, 150);
      ctx.font = 'bold 52px monospace';
      ctx.fillStyle = '#ffb15c';
      ctx.fillText('DRY DOCK 04', size / 2, 230);
      ctx.strokeStyle = '#5fd6d0';
      ctx.lineWidth = 8;
      ctx.beginPath();
      ctx.moveTo(90, 290);
      ctx.lineTo(422, 290);
      ctx.stroke();
      ctx.fillStyle = '#9aa6ae';
      ctx.font = '30px monospace';
      ctx.fillText('CAUTION  //  TIDAL WORKS', size / 2, 344);
      ctx.strokeRect(28, 28, size - 56, size - 56);
    },
    1,
    1,
  );
  TEX.star = canvasTexture(64, (ctx, size) => {
    const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
    g.addColorStop(0, 'rgba(255,241,214,1)');
    g.addColorStop(0.3, 'rgba(255,177,92,0.55)');
    g.addColorStop(1, 'rgba(255,177,92,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, size, size);
  }, 1, 1);
}

function makeMaterials() {
  MAT.floor = new THREE.MeshStandardMaterial({ map: TEX.concrete, color: 0x9fa8ae, roughness: 0.32, metalness: 0.18 });
  MAT.wall = new THREE.MeshStandardMaterial({ map: TEX.wall, color: 0xc2cad0, roughness: 0.72, metalness: 0.12 });
  MAT.container = new THREE.MeshStandardMaterial({ map: TEX.container, color: 0xc0c8ce, roughness: 0.55, metalness: 0.35 });
  MAT.containerDark = new THREE.MeshStandardMaterial({ map: TEX.container, color: 0x8b6a58, roughness: 0.6, metalness: 0.3 });
  MAT.corrugated = new THREE.MeshStandardMaterial({ map: TEX.ribs, color: 0xaebbc4, roughness: 0.45, metalness: 0.4 });
  MAT.hazard = new THREE.MeshStandardMaterial({ map: TEX.hazard, color: 0xffffff, roughness: 0.55, metalness: 0.15 });
  MAT.crate = new THREE.MeshStandardMaterial({ map: TEX.ribs, color: 0x7f8c95, roughness: 0.65, metalness: 0.2 });
  MAT.pillar = new THREE.MeshStandardMaterial({ map: TEX.concrete, color: 0x87949d, roughness: 0.7, metalness: 0.2 });
  MAT.steel = new THREE.MeshStandardMaterial({ map: TEX.ribs, color: 0x9aa7b0, roughness: 0.4, metalness: 0.55 });
  MAT.dark = new THREE.MeshStandardMaterial({ color: 0x1a232c, roughness: 0.7, metalness: 0.3 });
  MAT.puddle = new THREE.MeshStandardMaterial({ color: 0x22313c, roughness: 0.08, metalness: 0.75, transparent: true, opacity: 0.62 });
}

export function createMap(state, scene) {
  makeTextures();
  makeMaterials();
  state.colliders.length = 0;
  state.shootables.length = 0;
  const sites = SITES.map((site) => ({ ...site }));

  const markerTextures = {
    A: TEX.site('A', '#ffb15c'),
    B: TEX.site('B', '#5fd6d0'),
  };

  const addBox = (x, z, w, d, h, y, material, collide = true, cast = true) => {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material);
    mesh.position.set(x, y + h / 2, z);
    mesh.castShadow = cast;
    mesh.receiveShadow = true;
    scene.add(mesh);
    state.shootables.push(mesh);
    if (collide) {
      state.colliders.push({
        minX: x - w / 2,
        maxX: x + w / 2,
        minY: y,
        maxY: y + h,
        minZ: z - d / 2,
        maxZ: z + d / 2,
      });
    }
    return mesh;
  };

  const floor = new THREE.Mesh(new THREE.PlaneGeometry(64, 48, 1, 1), MAT.floor);
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  scene.add(floor);
  state.shootables.push(floor);

  const plates = [
    [-16, -10, 14, 12],
    [16, -10, 16, 13],
    [0, 20, 10, 6],
  ];
  for (const [x, z, w, d] of plates) {
    const plate = new THREE.Mesh(new THREE.PlaneGeometry(w, d), new THREE.MeshStandardMaterial({ map: TEX.concrete, color: 0x7d878d, roughness: 0.22, metalness: 0.3 }));
    plate.rotation.x = -Math.PI / 2;
    plate.position.set(x, 0.012, z);
    plate.receiveShadow = true;
    scene.add(plate);
  }

  // Boundary and lane walls.
  addBox(-31.7, 0, 0.6, 48, 6, 0, MAT.wall, true, false);
  addBox(31.7, 0, 0.6, 48, 6, 0, MAT.wall, true, false);
  addBox(0, -23.7, 64, 0.6, 6, 0, MAT.wall, true, false);
  addBox(0, 23.7, 64, 0.6, 6, 0, MAT.wall, true, false);
  addBox(-21, 8, 0.6, 16, 5.4, 0, MAT.wall);
  addBox(21, 8, 0.6, 16, 5.4, 0, MAT.wall);
  addBox(-21, -18, 0.6, 8, 5.4, 0, MAT.wall);
  addBox(21, -18, 0.6, 8, 5.4, 0, MAT.wall);
  addBox(-8, -18.4, 0.5, 5, 5.4, 0, MAT.wall);
  addBox(8, -18.4, 0.5, 5, 5.4, 0, MAT.wall);
  addBox(11, -14, 0.5, 4, 4.2, 0, MAT.corrugated);
  addBox(11, -6, 0.5, 4, 4.2, 0, MAT.corrugated);
  addBox(16.5, -16, 9, 0.5, 4.2, 0, MAT.corrugated);

  // Shipping containers, alternating length along x and z.
  const containers = [
    [-27, 6, 'z', MAT.container],
    [-23, -2, 'x', MAT.containerDark],
    [-20, -16, 'z', MAT.container],
    [23, 6, 'z', MAT.containerDark],
    [27, -2, 'x', MAT.container],
    [20, -16, 'z', MAT.containerDark],
    [-10, 14, 'x', MAT.container],
    [10, 14, 'x', MAT.containerDark],
  ];
  for (const [x, z, axis, material] of containers) {
    if (axis === 'x') addBox(x, z, 6, 2.4, 2.4, 0, material);
    else addBox(x, z, 2.4, 6, 2.4, 0, material);
  }

  // Crates: a couple of sizes per cluster reads better than perfect cubes.
  const crates = [
    [-14, -6], [-18, -14], [14, -6], [18, -14], [-6, 10],
    [6, 10], [-25, 10], [25, 10], [-12, -18], [12, -18],
  ];
  for (let i = 0; i < crates.length; i += 1) {
    const [x, z] = crates[i];
    addBox(x, z, 1.2, 1.2, 1.2, 0, MAT.crate);
    if (i % 2 === 0) addBox(x + 0.75, z + 0.1, 1, 1, 1.05, 0, MAT.crate);
    else addBox(x, z + 0.7, 1.1, 1.1, 0.95, 0, MAT.crate);
  }

  // Concrete barriers with hazard bands.
  const barriers = [[-8, 16], [8, 16], [-10, -4], [10, -4], [-20, -4], [20, -4]];
  for (const [x, z] of barriers) {
    addBox(x, z, 3, 0.7, 1.1, 0, MAT.wall);
    const band = new THREE.Mesh(new THREE.PlaneGeometry(2.9, 0.34), MAT.hazard);
    band.position.set(x, 0.66, z + 0.356);
    scene.add(band);
    const band2 = band.clone();
    band2.rotation.y = Math.PI;
    band2.position.z = z - 0.356;
    scene.add(band2);
  }

  // Pillars and catwalk above mid.
  for (const [x, z] of [[0, 8], [-2, 0], [2, -6], [0, -12]]) addBox(x, z, 0.8, 0.8, 3, 0, MAT.pillar);
  addBox(0, -3.5, 3, 15, 0.22, 2.4, MAT.steel, true, true);
  const strip = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.05, 14.4), new THREE.MeshBasicMaterial({ color: COLORS.cyan }));
  strip.position.set(-1.42, 2.4, -3.5);
  scene.add(strip);
  const strip2 = strip.clone();
  strip2.position.x = 1.42;
  scene.add(strip2);
  for (let i = 0; i < 6; i += 1) {
    const step = new THREE.Mesh(new THREE.BoxGeometry(3, 0.18, 0.7), MAT.steel);
    step.position.set(0, 0.35 + i * 0.32, 6.2 + i * 0.55);
    step.castShadow = true;
    step.receiveShadow = true;
    scene.add(step);
    state.shootables.push(step);
  }

  // Trailer along B's east wall and the crane over A.
  addBox(26.5, -10, 3, 8, 3.2, 0, MAT.corrugated);
  addBox(-22, -16, 1.2, 1.2, 6, 0, MAT.steel);
  addBox(-22, -16, 12, 0.5, 0.5, 5.5, MAT.steel, false, false);
  addBox(-22, -16, 0.5, 0.5, 0.5, 5.5, MAT.dark, false, false);

  // Site floor markers and wall signage.
  for (const site of sites) {
    const marker = new THREE.Mesh(
      new THREE.PlaneGeometry(4.6, 4.6),
      new THREE.MeshStandardMaterial({ map: markerTextures[site.id], roughness: 0.5, metalness: 0.1 }),
    );
    marker.rotation.x = -Math.PI / 2;
    marker.position.set(site.x, 0.03, site.z);
    scene.add(marker);
    const sign = new THREE.Mesh(
      new THREE.PlaneGeometry(2.6, 2.6),
      new THREE.MeshBasicMaterial({ map: markerTextures[site.id], transparent: true }),
    );
    sign.position.set(site.x + (site.id === 'A' ? -5.8 : 4.8), 3.4, site.z + (site.id === 'A' ? -3.8 : -3.6));
    sign.rotation.y = site.id === 'A' ? Math.PI / 2 : -Math.PI / 2;
    scene.add(sign);
  }

  // Puddles stay flat and small so they read as wet patches, not mirror walls.
  for (const [x, z, w, d] of [[-18, -6, 5, 2.2], [-13, -13, 3.5, 1.6], [15, -5, 4, 2], [-4, 8, 2.6, 1.4], [2, 16, 3, 1.1]]) {
    const puddle = new THREE.Mesh(new THREE.PlaneGeometry(w, d), MAT.puddle);
    puddle.rotation.x = -Math.PI / 2;
    puddle.position.set(x, 0.022, z);
    scene.add(puddle);
  }

  // Pipes and service boxes keep the mid-ground from being flat slabs.
  const pipeGeo = new THREE.CylinderGeometry(0.12, 0.12, 42, 8);
  const pipeMat = new THREE.MeshStandardMaterial({ color: 0x7a5a43, roughness: 0.4, metalness: 0.6 });
  for (let i = 0; i < 2; i += 1) {
    const pipe = new THREE.Mesh(pipeGeo, pipeMat);
    pipe.rotation.z = Math.PI / 2;
    pipe.position.set(0, 4.4 + i * 0.34, -22.8 + i * 0.3);
    scene.add(pipe);
  }
  addBox(26, 14, 2.4, 1.8, 2.2, 0, MAT.corrugated, true, true);
  addBox(-26, -8, 1.6, 1.2, 1.1, 0, MAT.crate);

  // Lighting: five map point lights, one moon with PCF shadows.
  scene.fog = new THREE.Fog(COLORS.deep, 18, 82);
  scene.background = new THREE.Color(COLORS.night);
  const hemi = new THREE.HemisphereLight(0x26384a, 0x0a0d12, 1.15);
  scene.add(hemi);
  const moon = new THREE.DirectionalLight(0x9db7d8, 2.1);
  moon.position.set(-18, 28, 12);
  moon.castShadow = true;
  moon.shadow.mapSize.set(2048, 2048);
  moon.shadow.camera.left = -36;
  moon.shadow.camera.right = 36;
  moon.shadow.camera.top = 36;
  moon.shadow.camera.bottom = -36;
  moon.shadow.camera.near = 1;
  moon.shadow.camera.far = 80;
  moon.shadow.bias = -0.0006;
  scene.add(moon);

  const lamp = (x, y, z, color, intensity, distance) => {
    const light = new THREE.PointLight(color, intensity, distance, 2);
    light.position.set(x, y, z);
    scene.add(light);
    return light;
  };
  lamp(-22, 4.2, -8, 0xff9a4a, 190, 30);
  lamp(-12, 4.2, -14, 0xff9a4a, 150, 26);
  lamp(13, 3.6, -8, 0x57e0d6, 140, 26);
  lamp(19, 3.6, -13, 0x57e0d6, 130, 24);
  lamp(0, 3, 0, 0xffe0b0, 95, 18);

  // Emissive lamp heads and the faint western horizon band.
  const lampMat = new THREE.MeshBasicMaterial({ color: 0xffc78a });
  for (const [x, y, z] of [[-22, 4.2, -8], [-12, 4.2, -14]]) {
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.12, 0.5), lampMat);
    head.position.set(x, y, z);
    scene.add(head);
  }
  const cyanLamp = new THREE.MeshBasicMaterial({ color: 0x9ff5ef });
  for (const [x, y, z] of [[13, 3.6, -8], [19, 3.6, -13]]) {
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.1, 0.35), cyanLamp);
    head.position.set(x, y, z);
    scene.add(head);
  }
  const horizon = new THREE.Mesh(
    new THREE.PlaneGeometry(160, 24),
    new THREE.MeshBasicMaterial({ color: 0x6b2f1e, fog: false, transparent: true, opacity: 0.55 }),
  );
  horizon.position.set(-58, 9, -10);
  horizon.rotation.y = Math.PI / 2;
  scene.add(horizon);

  // A fixed star field: deterministic, no per-frame work.
  const starCount = 180;
  const positions = new Float32Array(starCount * 3);
  for (let i = 0; i < starCount; i += 1) {
    const a = i * 2.39996;
    positions[i * 3] = Math.cos(a) * (45 + (i % 17) * 2.5);
    positions[i * 3 + 1] = 15 + ((i * 13) % 26);
    positions[i * 3 + 2] = Math.sin(a) * (45 + (i % 11) * 3.1);
  }
  const starGeo = new THREE.BufferGeometry();
  starGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  const stars = new THREE.Points(starGeo, new THREE.PointsMaterial({ color: 0xffe7c4, size: 0.22, fog: false, transparent: true, opacity: 0.75, sizeAttenuation: true }));
  scene.add(stars);

  // Decorative stencils live high or far from the play cameras.
  const stencilMat = new THREE.MeshBasicMaterial({ map: TEX.stencil, transparent: true });
  for (const [x, z, ry] of [[-31.3, 12, Math.PI / 2], [31.3, 14, -Math.PI / 2], [0, -23.3, 0]]) {
    const sign = new THREE.Mesh(new THREE.PlaneGeometry(4.4, 4.4), stencilMat);
    sign.position.set(x, 3.2, z);
    sign.rotation.y = ry;
    scene.add(sign);
  }

}
