// Weapons own fire/reload/switch, the pooled grenades and the viewmodel scene.
// Empty-mag handling lives first in fire(); a dry pull spends nothing and the
// HUD crosshair spread is written from the same numbers used by the ray.
import * as THREE from 'three';
import { PALETTE, PLAYER, WEAPONS } from './config.js';
import { clamp, damp, mulberry32 } from './util.js';
import { makeFlashTexture } from './effects.js';

export function createWeapon(state, scene, vmScene, map, bots, player, effects, audio, hud, input) {
  const rng = mulberry32(917);
  const group = new THREE.Group();
  vmScene.add(group);
  const flashMaterial = new THREE.SpriteMaterial({ map: makeFlashTexture(), transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending });
  const flash = new THREE.Sprite(flashMaterial);
  flash.scale.setScalar(0.11);
  // Sit on the muzzle's screen position: 32 mm higher made the flash float
  // 25 px above the tracer's start in the still.
  flash.position.set(0, 0.012, -0.612);
  flash.visible = false;
  group.add(flash);
  const flashLight = new THREE.PointLight(PALETTE.sodium, 0, 3, 2);
  flashLight.position.set(0, 0.018, -0.58);
  group.add(flashLight);
  const rim = new THREE.DirectionalLight(PALETTE.cyan, 0.9);
  rim.position.set(-1.6, 0.9, -1.2);
  vmScene.add(rim);

  // Dark, cool palette. The old light-grey rail and beige glove materials were
  // what turned the viewmodel into a pile of pale crates on camera.
  const receiverMat = new THREE.MeshStandardMaterial({ color: 0x2b3238, metalness: 0.3, roughness: 0.5 });
  const polymerMat = new THREE.MeshStandardMaterial({ color: 0x3b4237, metalness: 0.05, roughness: 0.78 });
  const steelMat = new THREE.MeshStandardMaterial({ color: 0x6c777f, metalness: 0.55, roughness: 0.38 });
  const darkMetal = new THREE.MeshStandardMaterial({ color: 0x12171b, metalness: 0.4, roughness: 0.52 });
  const railMat = new THREE.MeshStandardMaterial({ color: 0x3a4247, metalness: 0.3, roughness: 0.55 });
  const magMetal = new THREE.MeshStandardMaterial({ color: 0x2a3036, metalness: 0.22, roughness: 0.56 });
  const glove = new THREE.MeshStandardMaterial({ color: 0x5f594e, metalness: 0.02, roughness: 0.9 });
  const gloveEdge = new THREE.MeshStandardMaterial({ color: 0x776e5e, metalness: 0.02, roughness: 0.88 });
  const sleeveMat = new THREE.MeshStandardMaterial({ color: 0x39443b, roughness: 0.92 });
  const rubberMat = new THREE.MeshStandardMaterial({ color: 0x1d2124, metalness: 0.02, roughness: 0.96 });
  const accent = new THREE.MeshStandardMaterial({ color: PALETTE.sodium, emissive: PALETTE.sodium, emissiveIntensity: 0.9, roughness: 0.5 });
  const glassMat = new THREE.MeshStandardMaterial({ color: 0x0a2230, metalness: 0.9, roughness: 0.12, emissive: 0x123a4a, emissiveIntensity: 0.55 });
  const dotMat = new THREE.MeshBasicMaterial({ color: 0xff3b2c });

  function part(w, h, d, x, y, z, material, rx = 0, parent = group) {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material);
    mesh.position.set(x, y, z);
    mesh.rotation.x = rx;
    parent.add(mesh);
    return mesh;
  }

  function tube(radius, length, x, y, z, material, parent = group) {
    const mesh = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, length, 12), material);
    mesh.rotation.x = Math.PI / 2;
    mesh.position.set(x, y, z);
    parent.add(mesh);
    return mesh;
  }

  // Receiver, rail and optic.
  part(0.072, 0.078, 0.34, 0, 0.012, -0.04, receiverMat);
  part(0.062, 0.05, 0.2, 0, -0.052, -0.05, receiverMat);
  part(0.078, 0.018, 0.055, 0, -0.088, 0.02, darkMetal);
  part(0.03, 0.012, 0.34, 0, 0.062, -0.04, railMat);
  for (let i = 0; i < 4; i++) part(0.034, 0.007, 0.016, 0, 0.071, -0.15 + i * 0.06, railMat);
  part(0.008, 0.03, 0.06, 0.038, 0.02, -0.1, darkMetal);
  part(0.05, 0.018, 0.03, 0.01, 0.048, 0.13, railMat);

  // Compact red-dot: the window faces the shooter, so the dot is visible in
  // the frame and the housing reads as a sight rather than a scope tube.
  part(0.034, 0.018, 0.08, 0, 0.076, -0.03, darkMetal);
  part(0.048, 0.05, 0.07, 0, 0.106, -0.035, darkMetal);
  part(0.054, 0.009, 0.056, 0, 0.136, -0.038, polymerMat);
  const lensFront = new THREE.Mesh(new THREE.PlaneGeometry(0.038, 0.038), glassMat);
  lensFront.position.set(0, 0.106, 0.0008);
  group.add(lensFront);
  const dot = new THREE.Mesh(new THREE.CircleGeometry(0.0062, 10), dotMat);
  dot.position.set(0, 0.106, 0.0017);
  group.add(dot);
  const glint = new THREE.Mesh(new THREE.CircleGeometry(0.006, 8), new THREE.MeshBasicMaterial({ color: 0xcfe6f2 }));
  glint.position.set(-0.009, 0.117, 0.0022);
  group.add(glint);

  // Barrel assembly. It lives in its own group so a shorter weapon can pull
  // the whole front back without breaking the silhouette.
  const front = new THREE.Group();
  group.add(front);
  const barrel = tube(0.014, 0.34, 0, 0.012, -0.36, steelMat, front);
  part(0.034, 0.034, 0.05, 0, 0.022, -0.31, darkMetal, 0, front);
  const handguard = part(0.074, 0.066, 0.22, 0, 0.002, -0.28, polymerMat, 0, front);
  for (let i = 0; i < 3; i++) {
    part(0.004, 0.026, 0.05, 0.038, -0.006, -0.21 - i * 0.06, darkMetal, 0, front);
    part(0.004, 0.026, 0.05, -0.038, -0.006, -0.21 - i * 0.06, darkMetal, 0, front);
  }
  part(0.05, 0.012, 0.2, 0, -0.042, -0.28, steelMat, 0, front);
  tube(0.026, 0.08, 0, 0.012, -0.575, darkMetal, front);
  for (let i = 0; i < 3; i++) part(0.048, 0.009, 0.012, 0, 0.012, -0.588 + i * 0.021, steelMat, 0, front);
  const bore = new THREE.Mesh(new THREE.CircleGeometry(0.011, 12), new THREE.MeshBasicMaterial({ color: 0x03060a }));
  bore.position.set(0, 0.012, -0.6115);
  front.add(bore);
  part(0.012, 0.052, 0.014, 0, 0.062, -0.34, darkMetal, 0, front);
  const muzzleRef = new THREE.Object3D();
  muzzleRef.position.set(0, 0.012, -0.612);
  front.add(muzzleRef);

  // Magazine, grip, trigger guard and stock.
  const magazine = part(0.058, 0.16, 0.082, 0, -0.15, 0.03, magMetal, 0.3);
  part(0.064, 0.028, 0.09, 0, -0.228, -0.005, steelMat, 0.3);
  const grip = part(0.048, 0.115, 0.062, 0, -0.135, 0.125, polymerMat, -0.32);
  part(0.012, 0.05, 0.012, 0, -0.098, 0.064, darkMetal);
  part(0.022, 0.02, 0.035, 0, -0.079, 0.075, steelMat);
  part(0.012, 0.05, 0.012, 0, -0.098, 0.027, darkMetal);
  part(0.05, 0.012, 0.06, 0, -0.121, 0.045, darkMetal);
  // Solid skeleton stock: a deep polymer body with a comb and a thin rubber
  // pad. The old stock was two rails and a full-size butt plate, which read on
  // camera as a black card floating at the end of the receiver.
  const stock = new THREE.Group();
  group.add(stock);
  tube(0.022, 0.12, 0, 0.005, 0.17, darkMetal, stock);
  part(0.042, 0.074, 0.19, 0, -0.004, 0.265, polymerMat, 0, stock);
  part(0.038, 0.03, 0.2, 0, 0.045, 0.265, polymerMat, 0, stock);
  part(0.044, 0.052, 0.06, 0, -0.034, 0.345, polymerMat, 0, stock);
  part(0.046, 0.084, 0.014, 0, -0.004, 0.372, rubberMat, 0, stock);
  part(0.014, 0.032, 0.012, 0, -0.058, 0.3, steelMat, 0, stock);
  part(0.008, 0.014, 0.05, 0, -0.028, 0.305, rubberMat, 0, stock);
  part(0.036, 0.006, 0.17, 0, 0.041, 0.26, railMat, 0, stock);

  // Support hand wrapped under the handguard: the palm sits on the near side,
  // the fingers climb the visible flank and the thumb comes over the top, so
  // the grip reads from the shooter's viewpoint.
  const hands = new THREE.Group();
  group.add(hands);
  const supportHand = new THREE.Group();
  hands.add(supportHand);
  part(0.046, 0.086, 0.07, -0.044, -0.055, -0.29, glove, 0, supportHand);
  part(0.02, 0.072, 0.066, -0.066, -0.05, -0.29, gloveEdge, 0, supportHand);
  // Wide spacing and alternating shades: at 720p the old 3 mm gaps closed up
  // and the four fingers read as one smooth wedge.
  for (let i = 0; i < 4; i++) {
    const z = -0.228 - i * 0.042;
    const finger = part(0.019, 0.06, 0.026, -0.078, -0.004, z, i % 2 ? gloveEdge : glove, 0, supportHand);
    finger.rotation.z = 1.25;
    const tip = part(0.017, 0.026, 0.024, -0.09, 0.014, z, gloveEdge, 0, supportHand);
    tip.rotation.z = 2.1;
  }
  // Thumb over the top of the handguard, the classic viewmodel grip read.
  const supportThumb = part(0.028, 0.064, 0.032, -0.014, 0.052, -0.262, gloveEdge, 0, supportHand);
  supportThumb.rotation.z = -1.0;
  supportThumb.rotation.x = 0.2;
  part(0.052, 0.028, 0.058, -0.044, -0.102, -0.275, gloveEdge, 0, supportHand);
  part(0.058, 0.058, 0.052, -0.04, -0.142, -0.25, sleeveMat, 0, supportHand);
  const supportArm = part(0.048, 0.048, 0.24, -0.03, -0.2, -0.15, sleeveMat, -0.5, supportHand);
  supportArm.rotation.y = 0.2;

  // Trigger hand on the camera side of the grip, with the same wide finger
  // spacing so the knuckles separate from the receiver.
  part(0.05, 0.086, 0.07, -0.016, -0.168, 0.152, glove, 0.12);
  part(0.02, 0.072, 0.066, -0.04, -0.16, 0.152, gloveEdge, 0);
  for (let i = 0; i < 3; i++) {
    const z = 0.108 + i * 0.04;
    const finger = part(0.019, 0.056, 0.026, -0.054, -0.122, z, i % 2 ? gloveEdge : glove, 0);
    finger.rotation.x = 0.6;
    const tip = part(0.017, 0.026, 0.024, -0.062, -0.104, z, gloveEdge, 0);
    tip.rotation.x = 0.95;
  }
  const triggerThumb = part(0.028, 0.06, 0.034, -0.042, -0.072, 0.088, gloveEdge, 0);
  triggerThumb.rotation.x = 0.2;
  part(0.05, 0.028, 0.062, -0.026, -0.214, 0.168, gloveEdge, 0);
  part(0.054, 0.054, 0.05, -0.02, -0.252, 0.19, sleeveMat, 0);
  const triggerArm = part(0.048, 0.048, 0.24, -0.008, -0.32, 0.24, sleeveMat, -0.3);
  triggerArm.rotation.y = -0.1;
  const pump = part(0.09, 0.07, 0.22, 0, -0.026, -0.25, polymerMat);
  const bolt = part(0.022, 0.024, 0.06, 0.06, 0.04, 0.02, steelMat);

  front.add(flash);
  front.add(flashLight);
  flash.position.set(0, 0.03, -0.655);
  flashLight.position.set(0, 0.06, -0.6);

  // Two gloved hands that grip the charge while the plant is running. The
  // palms are deliberately narrow and sit outside the screen bezel so the
  // countdown stays readable.
  const plantHands = new THREE.Group();
  for (const side of [-1, 1]) {
    const hand = new THREE.Group();
    // Break the mirror: the right glove sits a little higher, closer and turned
    // in, so the pair reads as two hands working instead of two clamps.
    hand.position.set(side * (0.088 + (side > 0 ? 0.006 : 0)), -0.178 + (side > 0 ? 0.012 : -0.008), -0.6 + (side > 0 ? 0.03 : -0.01));
    hand.rotation.set(-0.3 + (side > 0 ? 0.1 : -0.03), side * -0.6 + (side > 0 ? 0.12 : 0.03), side * (side > 0 ? 0.2 : 0.12));
    plantHands.add(hand);
    const palm = new THREE.Mesh(new THREE.BoxGeometry(0.052, 0.08, 0.042), glove);
    hand.add(palm);
    const knuckle = new THREE.Mesh(new THREE.BoxGeometry(0.056, 0.026, 0.024), gloveEdge);
    knuckle.position.set(0, 0.038, 0.012);
    hand.add(knuckle);
    for (let f = 0; f < 4; f++) {
      const inner = side < 0 ? f === 3 : f === 0;
      const finger = new THREE.Mesh(new THREE.BoxGeometry(0.014, inner ? 0.058 : 0.05, 0.019), gloveEdge);
      finger.position.set(-0.026 + f * 0.0175, 0.062, inner ? 0.016 : 0.004);
      finger.rotation.x = -0.45;
      finger.rotation.z = inner ? side * -0.22 : 0;
      hand.add(finger);
    }
    const thumb = new THREE.Mesh(new THREE.BoxGeometry(0.016, 0.042, 0.02), glove);
    thumb.position.set(side * -0.042, 0.02, 0.03);
    thumb.rotation.z = side * 0.95;
    thumb.rotation.x = -0.3;
    hand.add(thumb);
    const cuff = new THREE.Mesh(new THREE.BoxGeometry(0.062, 0.05, 0.05), sleeveMat);
    cuff.position.set(0, -0.056, 0.01);
    hand.add(cuff);
    // The forearms angle outward and down instead of running toward the lens,
    // which used to fill the bottom centre with a green faceted mass.
    const forearm = new THREE.Mesh(new THREE.BoxGeometry(0.046, 0.06, 0.2), sleeveMat);
    forearm.position.set(side * 0.055, -0.15, 0.16);
    forearm.rotation.x = -1.2;
    forearm.rotation.y = side * -0.35;
    hand.add(forearm);
  }
  plantHands.visible = false;
  vmScene.add(plantHands);

  const layouts = {
    pistol: { scale: 0.64, x: 0.24, y: -0.16, z: -0.7, stock: false, handguard: false, longBarrel: false, pump: false, bolt: true },
    smg: { scale: 0.78, x: 0.25, y: -0.17, z: -0.82, stock: false, handguard: true, longBarrel: false, pump: false, bolt: false },
    rifle: { scale: 0.74, x: 0.225, y: -0.17, z: -1.0, stock: true, handguard: true, longBarrel: true, pump: false, bolt: false },
    shotgun: { scale: 0.82, x: 0.25, y: -0.175, z: -0.92, stock: true, handguard: false, longBarrel: true, pump: true, bolt: false },
  };

  let kick = 0;
  let reloadSway = 0;
  let baseY = -0.175;

  function applyLayout() {
    const id = state.weapon;
    const layout = layouts[id] || layouts.rifle;
    group.scale.setScalar(layout.scale);
    group.position.set(layout.x, layout.y, layout.z);
    baseY = layout.y;
    stock.visible = layout.stock;
    handguard.visible = layout.handguard;
    pump.visible = layout.pump;
    bolt.visible = layout.bolt;
    supportHand.visible = layout.handguard;
    // A short weapon pulls the whole front group back so the muzzle stays in
    // the frame and the hands stay on the handguard.
    front.position.z = layout.longBarrel ? 0 : 0.15;
    hands.position.z = layout.longBarrel ? 0 : 0.11;
  }

  function def() { return WEAPONS[state.weapon]; }

  function equip(id) {
    if (id !== 'pistol' && id !== 'smg' && id !== 'rifle' && id !== 'shotgun') return;
    if (id !== 'pistol' && state.primary !== id) return;
    state.weapon = id;
    state.grenade = null;
    state.reload = 0;
    state.switchTimer = 0.18;
    applyLayout();
  }

  function selectGrenade(kind) {
    if (kind === 'frag' && state.grenades.frag <= 0) return;
    if (kind === 'flash' && state.grenades.flash <= 0) return;
    state.grenade = kind;
    state.reload = 0;
    state.switchTimer = 0.12;
  }

  function reload() {
    const weapon = def();
    const ammo = state.ammo[state.weapon];
    if (state.grenade || state.reload > 0 || ammo.mag >= weapon.mag || ammo.reserve <= 0) return;
    state.reload = weapon.reload;
    state.reloadTotal = weapon.reload;
    audio.reload();
  }

  function eyeHeight() { return state.player.crouch ? PLAYER.eyeCrouch : PLAYER.eyeStand; }

  function fire() {
    if (state.mode !== 'live' && state.mode !== 'planted') return false;
    if (!state.alive || state.grenade || state.reload > 0 || state.switchTimer > 0) return false;
    const weapon = def();
    if (state.shotTimer > 0) return false;
    const ammo = state.ammo[state.weapon];
    // Empty magazine blocks the shot before any ammo, accuracy or tracer work.
    if (ammo.mag <= 0) {
      if (input.firePressed) {
        audio.dry();
        state.shotTimer = 0.32;
        hud.setPrompt('PRESS R TO RELOAD', 0.5);
      }
      return false;
    }

    const oy = state.player.y + eyeHeight();
    const ox = state.player.x;
    const oz = state.player.z;
    const pitch = state.pitch + state.recoilPitch;
    const yaw = state.yaw + state.recoilYaw;
    const cp = Math.cos(pitch);
    const fx = -Math.sin(yaw) * cp;
    const fy = Math.sin(pitch);
    const fz = -Math.cos(yaw) * cp;
    const rx = Math.cos(yaw);
    const rz = -Math.sin(yaw);
    const ux = -rz * fy;
    const uy = rz * fx - rx * fz;
    const uz = rx * fy;
    const crouchFactor = state.player.crouch ? 0.55 : 1;
    const moveFactor = clamp(state.player.speed / PLAYER.speed, 0, 1);
    const spread = (weapon.spread * crouchFactor + weapon.move * moveFactor) * (1 + state.consecutive * 0.2);
    state.spread = spread;

    const pellets = weapon.pellets || 1;
    let anyHit = false;
    let hitX = 0;
    let hitY = 0;
    let hitZ = 0;
    let hasPoint = false;
    for (let p = 0; p < pellets; p++) {
      const sx = (rng() - 0.5) * 2 * spread;
      const sy = (rng() - 0.5) * 2 * spread;
      let dx = fx + rx * sx + ux * sy;
      let dy = fy + uy * sy;
      let dz = fz + rz * sx + uz * sy;
      const len = Math.hypot(dx, dy, dz) || 1;
      dx /= len; dy /= len; dz /= len;
      const wallT = map.raycast(ox, oy, oz, dx, dy, dz).t;
      const botHit = bots.raycast(ox, oy, oz, dx, dy, dz, Math.min(120, wallT));
      if (botHit.hit) {
        const falloff = 1 - clamp((botHit.t - 15) / 30, 0, 1) * 0.3;
        const zoneMul = botHit.zone === 'head' ? weapon.head : botHit.zone === 'legs' ? weapon.legs : 1;
        bots.damage(botHit.bot, weapon.body * falloff * zoneMul, botHit.zone);
        effects.impact(botHit.x, botHit.y, botHit.z, dx, dy, dz);
        if (!hasPoint) { hitX = botHit.x; hitY = botHit.y; hitZ = botHit.z; hasPoint = true; }
        anyHit = true;
      } else if (wallT < 120) {
        effects.impact(ox + dx * wallT, oy + dy * wallT, oz + dz * wallT, dx, dy, dz);
        if (!hasPoint) { hitX = ox + dx * wallT; hitY = oy + dy * wallT; hitZ = oz + dz * wallT; hasPoint = true; }
      }
    }

    state.ammo[state.weapon].mag -= 1;
    state.shots += 1;
    if (anyHit) state.hits += 1;
    state.shotTimer = weapon.gap;
    state.consecutive += 1;
    state.consecutiveTimer = 0.28;
    state.spread = Math.min(0.09, spread);
    state.recoilPitch += weapon.recoil;
    state.recoilYaw += (rng() - 0.5) * weapon.recoil * 0.6;
    state.shake = Math.min(0.5, state.shake + weapon.recoil * 2.2);
    state.muzzle = 0.05;
    kick = 1;
    audio.shot(weapon.sound);
    // The tracer starts exactly at the viewmodel muzzle, so the streak lines up
    // with the barrel on screen instead of hanging in front of the player.
    group.updateMatrixWorld(true);
    const muzzleView = new THREE.Vector3();
    muzzleRef.getWorldPosition(muzzleView);
    const mvx = muzzleView.x / -muzzleView.z;
    const mvy = muzzleView.y / -muzzleView.z;
    let tdx = fx + rx * mvx + ux * mvy;
    let tdy = fy + uy * mvy;
    let tdz = fz + rz * mvx + uz * mvy;
    const tlen = Math.hypot(tdx, tdy, tdz) || 1;
    tdx /= tlen; tdy /= tlen; tdz /= tlen;
    const tracerX = ox + tdx * 1.05;
    const tracerY = oy + tdy * 1.05;
    const tracerZ = oz + tdz * 1.05;
    if (hasPoint) effects.tracerLine(tracerX, tracerY, tracerZ, hitX, hitY, hitZ, PALETTE.sodium);
    else effects.tracerLine(tracerX, tracerY, tracerZ, ox + fx * 45, oy + fy * 45, oz + fz * 45, PALETTE.sodium);
    effects.shell(ox + rx * 0.22, oy - 0.14, oz + rz * 0.22, rx * 1.6 + (rng() - 0.5) * 0.4, 1.4 + rng() * 0.6, rz * 1.6);
    bots.hear(ox, oz, 30);
    hud.hitmarker(anyHit);
    if (state.ammo[state.weapon].mag <= 0) hud.setPrompt('PRESS R TO RELOAD', 0.6);
    return true;
  }

  function throwGrenade() {
    if (state.mode !== 'live' && state.mode !== 'planted') return;
    if (!state.alive || !state.grenade) return;
    if (state.grenades[state.grenade] <= 0) return;
    const kind = state.grenade;
    const item = projectiles.find((p) => !p.active);
    if (!item) return;
    state.grenades[kind] -= 1;
    const pitch = state.pitch;
    const yaw = state.yaw;
    const cp = Math.cos(pitch);
    const fx = -Math.sin(yaw) * cp;
    const fy = Math.sin(pitch) + 0.18;
    const fz = -Math.cos(yaw) * cp;
    item.active = true;
    item.kind = kind;
    item.x = state.player.x + fx * 0.35;
    item.y = state.player.y + eyeHeight() - 0.08;
    item.z = state.player.z + fz * 0.35;
    item.vx = fx * 9;
    item.vy = fy * 9;
    item.vz = fz * 9;
    item.fuse = kind === 'frag' ? 0.9 : 1.2;
    item.mesh.visible = true;
    item.mesh.position.set(item.x, item.y, item.z);
    item.mesh.material = kind === 'frag' ? fragMaterial : flashMaterialSolid;
    state.grenade = null;
    audio.toss();
    hud.setPrompt(kind === 'frag' ? 'FRAG OUT' : 'FLASH OUT', 0.5);
  }

  const fragMaterial = new THREE.MeshStandardMaterial({ color: 0x2c343b, roughness: 0.6, metalness: 0.3 });
  const flashMaterialSolid = new THREE.MeshStandardMaterial({ color: 0x9aa6ae, roughness: 0.4, metalness: 0.5, emissive: PALETTE.cyan, emissiveIntensity: 0.25 });
  const projectiles = [];
  for (let i = 0; i < 4; i++) {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.13, 0.11), fragMaterial);
    mesh.visible = false;
    scene.add(mesh);
    projectiles.push({ mesh, active: false, kind: 'frag', x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, fuse: 0 });
  }

  function detonate(item) {
    item.active = false;
    item.mesh.visible = false;
    if (item.kind === 'frag') {
      effects.explosion(item.x, 0.1, item.z);
      audio.explosion();
      state.shake = Math.min(0.8, state.shake + 0.6);
      for (const bot of bots.squad) {
        if (!bot.alive) continue;
        const bx = bot.x;
        const by = bot.y + 1.15;
        const bz = bot.z;
        const dx = bx - item.x;
        const dy = by - item.y;
        const dz = bz - item.z;
        const distance = Math.hypot(dx, dy, dz);
        if (distance > 5.2) continue;
        const len = distance || 1;
        if (map.blocked(item.x, item.y, item.z, dx / len, dy / len, dz / len, distance)) continue;
        const amount = 130 - (Math.min(distance, 5) / 5) * 120;
        bots.damage(bot, amount, 'body');
      }
      const pdx = state.player.x - item.x;
      const pdz = state.player.z - item.z;
      const pd = Math.hypot(pdx, pdz);
      if (pd < 5 && !map.blocked(item.x, item.y + 0.1, item.z, pdx / (pd || 1), 0, pdz / (pd || 1), pd)) {
        player.damage(40 - pd * 5, item.x, item.z);
      }
    } else {
      effects.explosion(item.x, 0.1, item.z);
      audio.flash();
      bots.flash(item.x, item.z, 9, 2.5);
      const fx = -Math.sin(state.yaw);
      const fz = -Math.cos(state.yaw);
      const dx = item.x - state.player.x;
      const dz = item.z - state.player.z;
      const distance = Math.hypot(dx, dz) || 1;
      if (distance < 12 && (fx * dx + fz * dz) / distance > 0.15 && !map.blocked(state.player.x, state.player.y + 1.55, state.player.z, dx / distance, 0, dz / distance, distance)) {
        state.flash = 1;
      }
    }
  }

  function updateProjectiles(dt) {
    for (const item of projectiles) {
      if (!item.active) continue;
      item.fuse -= dt;
      const px = item.x;
      const py = item.y;
      const pz = item.z;
      item.vy -= 20 * dt;
      item.x += item.vx * dt;
      item.y += item.vy * dt;
      item.z += item.vz * dt;
      if (item.y < 0.12) {
        item.y = 0.12;
        item.vy = Math.abs(item.vy) * 0.38;
        item.vx *= 0.7;
        item.vz *= 0.7;
      }
      const dx = item.x - px;
      const dy = item.y - py;
      const dz = item.z - pz;
      const distance = Math.hypot(dx, dy, dz);
      if (distance > 0.0001) {
        const hit = map.raycast(px, py, pz, dx / distance, dy / distance, dz / distance);
        if (hit.t < distance - 0.02) {
          item.x = px + (dx / distance) * Math.max(0, hit.t - 0.06);
          item.y = py + (dy / distance) * Math.max(0, hit.t - 0.06);
          item.z = pz + (dz / distance) * Math.max(0, hit.t - 0.06);
          item.vx *= -0.35;
          item.vz *= -0.35;
          item.vy *= 0.3;
        }
      }
      item.mesh.position.set(item.x, item.y, item.z);
      item.mesh.rotation.x += dt * 7;
      item.mesh.rotation.z += dt * 5;
      if (item.fuse <= 0) detonate(item);
    }
  }

  function update(dt) {
    state.shotTimer = Math.max(0, state.shotTimer - dt);
    state.switchTimer = Math.max(0, state.switchTimer - dt);
    state.muzzle = Math.max(0, state.muzzle - dt);
    state.flash = Math.max(0, state.flash - dt * 1.4);
    state.spread = damp(state.spread, 0, 9, dt);
    if (state.consecutive > 0) {
      state.consecutiveTimer = (state.consecutiveTimer || 0) - dt;
      if (state.consecutiveTimer <= 0) state.consecutive = 0;
    }
    if (state.reload > 0) {
      state.reload -= dt;
      if (state.reload <= 0) {
        state.reload = 0;
        const weapon = def();
        const ammo = state.ammo[state.weapon];
        const take = Math.min(weapon.mag - ammo.mag, ammo.reserve);
        ammo.mag += take;
        ammo.reserve -= take;
      }
    }
    if (state.mode === 'live' || state.mode === 'planted') {
      if (input.pressed.has('Digit1')) equip('pistol');
      if (input.pressed.has('Digit2') && state.primary) equip(state.primary);
      if (input.pressed.has('Digit3')) selectGrenade('frag');
      if (input.pressed.has('Digit4')) selectGrenade('flash');
      if (input.pressed.has('KeyR')) reload();
      if (input.pressed.has('KeyG')) throwGrenade();
      if (state.alive && !state.grenade) {
        const weapon = def();
        const wants = weapon.auto ? input.mouseDown : input.firePressed;
        if (wants) fire();
      }
    }
    updateProjectiles(dt);

    kick = damp(kick, 0, 15, dt);
    reloadSway = damp(reloadSway, state.reload > 0 ? 1 : 0, 9, dt);
    group.visible = state.mode !== 'start' && state.mode !== 'buy' && state.alive && !state.grenade;
    if (group.visible) {
      const sway = Math.sin(state.time * 1.6) * 0.004 + Math.sin(state.bobPhase) * 0.006 * Math.min(1, state.player.speed / PLAYER.speed);
      const plantDrop = state.plant.active ? 1 : 0;
      group.position.x = (layouts[state.weapon] || layouts.rifle).x + sway;
      group.position.y = baseY - reloadSway * 0.1 + Math.cos(state.time * 1.3) * 0.003 - plantDrop * 0.24;
      group.position.z = (layouts[state.weapon] || layouts.rifle).z + kick * 0.055 + plantDrop * 0.06;
      group.rotation.x = 0.02 + kick * 0.12 - plantDrop * 0.42;
      group.rotation.z = reloadSway * 0.35 + plantDrop * 0.12;
      group.rotation.y = 0.045 + sway * 0.6;
    }
    flash.visible = state.muzzle > 0;
    flashMaterial.opacity = state.muzzle > 0 ? 0.95 : 0;
    flashLight.intensity = state.muzzle > 0 ? 14 : 0;
    plantHands.visible = group.visible && state.plant.active;
  }

  function resetRound() {
    for (const id of ['pistol', 'smg', 'rifle', 'shotgun']) {
      state.ammo[id].mag = WEAPONS[id].mag;
      state.ammo[id].reserve = WEAPONS[id].reserve;
    }
    state.weapon = state.primary || 'pistol';
    state.grenade = null;
    state.reload = 0;
    state.shotTimer = 0;
    state.consecutive = 0;
    state.spread = 0;
    state.muzzle = 0;
    for (const item of projectiles) { item.active = false; item.mesh.visible = false; }
    applyLayout();
  }

  function accuracy() { return state.shots > 0 ? Math.round((state.hits / state.shots) * 100) : 0; }

  applyLayout();
  return { fire, reload, equip, selectGrenade, throwGrenade, update, resetRound, accuracy, group };
}
