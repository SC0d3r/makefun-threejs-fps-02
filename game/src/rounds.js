// Round flow, economy and the bomb. startBuyPhase() is the only way into a buy
// phase, completePlant() is the only way a charge becomes armed, and both the
// live game and shot staging call those same functions.
import * as THREE from 'three';
import { ECONOMY, MAP, PALETTE, ROUND, WEAPONS } from './config.js';
import { clamp, lerp } from './util.js';

export function createRounds(state, scene, map, player, bots, weapon, hud, audio, effects, input) {
  const bomb = new THREE.Group();
  const bodyMat = new THREE.MeshStandardMaterial({ color: 0x232d36, roughness: 0.62, metalness: 0.35 });
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.2, 0.28), bodyMat);
  body.position.y = 0.1;
  body.castShadow = true;
  bomb.add(body);
  const bezelMat = new THREE.MeshStandardMaterial({ color: 0x0a0f14, roughness: 0.45, metalness: 0.7 });
  const bezel = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.03, 0.32), bezelMat);
  bezel.position.y = 0.205;
  bomb.add(bezel);
  // Countdown display on the front face. The old screen sat on the top face
  // and read as a pink bar from the plant camera; a canvas gives real digits.
  const displayCanvas = document.createElement('canvas');
  displayCanvas.width = 256;
  displayCanvas.height = 128;
  const displayCtx = displayCanvas.getContext('2d');
  const displayTexture = new THREE.CanvasTexture(displayCanvas);
  displayTexture.colorSpace = THREE.SRGBColorSpace;
  let displayFuse = -1;
  function paintDisplay(seconds) {
    const whole = Math.max(0, Math.ceil(seconds));
    if (whole === displayFuse) return;
    displayFuse = whole;
    displayCtx.fillStyle = '#170303';
    displayCtx.fillRect(0, 0, 256, 128);
    displayCtx.fillStyle = '#ff3a2c';
    displayCtx.font = 'bold 88px ui-monospace, Menlo, Consolas, monospace';
    displayCtx.textAlign = 'center';
    displayCtx.textBaseline = 'middle';
    displayCtx.fillText(`0:${String(whole).padStart(2, '0')}`, 128, 66);
    displayCtx.fillStyle = 'rgba(0, 0, 0, 0.3)';
    for (let y = 0; y < 128; y += 6) displayCtx.fillRect(0, y, 256, 2);
    displayTexture.needsUpdate = true;
  }
  paintDisplay(40);
  const screenBezel = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.14, 0.016), bezelMat);
  screenBezel.position.set(0, 0.11, 0.141);
  bomb.add(screenBezel);
  const screen = new THREE.Mesh(new THREE.PlaneGeometry(0.21, 0.11), new THREE.MeshBasicMaterial({ map: displayTexture }));
  screen.position.set(0, 0.11, 0.1505);
  bomb.add(screen);
  const screenLight = new THREE.PointLight(0xff2a18, 1.15, 2.4, 2);
  screenLight.position.set(0, 0.2, 0.34);
  bomb.add(screenLight);
  const keyMat = new THREE.MeshStandardMaterial({ color: 0x8a97a3, roughness: 0.5, metalness: 0.4 });
  for (let r = 0; r < 2; r++) {
    for (let c = 0; c < 3; c++) {
      const key = new THREE.Mesh(new THREE.BoxGeometry(0.028, 0.008, 0.02), keyMat);
      key.position.set(-0.03 + c * 0.035, 0.225, -0.04 - r * 0.028);
      bomb.add(key);
    }
  }
  const strapMat = new THREE.MeshStandardMaterial({ color: 0x3a2c22, roughness: 0.92 });
  const strap = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.07, 0.3), strapMat);
  strap.position.y = 0.1;
  bomb.add(strap);
  const cableMat = new THREE.MeshStandardMaterial({ color: 0x6a4a22, roughness: 0.8 });
  for (let i = 0; i < 2; i++) {
    const cable = new THREE.Mesh(new THREE.TorusGeometry(0.07 + i * 0.03, 0.009, 6, 14, Math.PI), cableMat);
    cable.position.set(-0.04 + i * 0.07, 0.19, -0.13);
    cable.rotation.x = 1.15;
    cable.rotation.y = 0.4 - i * 0.7;
    bomb.add(cable);
  }
  // Demolition charge padding on the lid. Without it the flat lid plus the old
  // arch of cable read as a lunchbox handle from the plant camera.
  // Contact shadow so the charge sits on the deck instead of hovering in its
  // own red glow.
  const contact = new THREE.Mesh(new THREE.CircleGeometry(0.3, 20), new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.42, depthWrite: false }));
  contact.rotation.x = -Math.PI / 2;
  contact.position.y = 0.012;
  bomb.add(contact);
  const puttyMat = new THREE.MeshStandardMaterial({ color: 0x9c8a63, roughness: 0.94 });
  const tapeMat = new THREE.MeshStandardMaterial({ color: 0x2a2622, roughness: 0.95 });
  for (const side of [-1, 1]) {
    const block = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.07, 0.15), puttyMat);
    block.position.set(side * 0.105, 0.245, -0.04 + side * 0.012);
    bomb.add(block);
    const strap = new THREE.Mesh(new THREE.BoxGeometry(0.148, 0.016, 0.032), tapeMat);
    strap.position.set(side * 0.105, 0.283, -0.04 + side * 0.012);
    bomb.add(strap);
  }
  const ledMaterial = new THREE.MeshStandardMaterial({ color: PALETTE.danger, emissive: PALETTE.danger, emissiveIntensity: 3 });
  const led = new THREE.Mesh(new THREE.BoxGeometry(0.045, 0.03, 0.02), ledMaterial);
  led.position.set(-0.16, 0.19, 0.145);
  bomb.add(led);
  const ringMaterial = new THREE.MeshBasicMaterial({ color: PALETTE.cyan, transparent: true, opacity: 0.8, side: THREE.DoubleSide, depthWrite: false });
  const ring = new THREE.Mesh(new THREE.RingGeometry(0.34, 0.44, 28), ringMaterial);
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = 0.26;
  ring.visible = false;
  bomb.add(ring);
  bomb.visible = false;
  scene.add(bomb);

  let lastGear = 100;
  let lastShots = 0;
  let beepGap = 1;

  function resetBomb() {
    state.bomb.active = false;
    state.bomb.planted = false;
    state.bomb.fuse = 0;
    state.bomb.defuse = 0;
    state.bomb.defusing = false;
    state.bomb.defuserId = -1;
    state.bomb.beep = 0;
    state.bomb.led = 0;
    state.plant.time = 0;
    state.plant.active = false;
    state.plant.site = null;
    bomb.visible = false;
    ring.visible = false;
    ring.scale.setScalar(0.1);
  }

  function setBombYaw(yaw) {
    bomb.rotation.y = yaw;
  }

  function showBomb(x, z) {
    bomb.position.set(x, 0, z);
    bomb.visible = true;
    state.bomb.x = x;
    state.bomb.z = z;
    paintDisplay(state.bomb.fuse || ROUND.fuse);
  }

  function startMatch() {
    state.scoreYou = 0;
    state.scoreRust = 0;
    state.round = 1;
    state.kills = 0;
    state.plants = 0;
    state.shots = 0;
    state.hits = 0;
    state.money = ECONOMY.start;
    state.primary = null;
    state.matchResult = '';
    startBuyPhase();
  }

  function startBuyPhase() {
    state.mode = 'buy';
    state.buyClock = ROUND.buy;
    state.clock = ROUND.live;
    state.buyOpen = true;
    state.endClock = 0;
    state.plant.time = 0;
    state.plant.active = false;
    state.plant.site = null;
    state.alive = true;
    state.health = 100;
    state.armor = 0;
    state.grenades.frag = 0;
    state.grenades.flash = 0;
    state.grenade = null;
    state.damageFlash = 0;
    state.shake = 0;
    state.flash = 0;
    resetBomb();
    effects.reset();
    player.respawn();
    bots.spawnRound();
    weapon.resetRound();
    lastGear = 100;
    lastShots = state.shots;
    hud.setOverlay('buy');
    hud.setPrompt('', 0);
    input.unlock();
  }

  function startLive() {
    if (state.mode !== 'buy') return;
    state.mode = 'live';
    state.buyOpen = false;
    state.buyClock = 0;
    state.clock = ROUND.live;
    state.bomb.fuse = 0;
    state.plant.time = 0;
    state.plant.active = false;
    state.plant.site = null;
    bots.activate();
    hud.setOverlay(null);
    hud.addFeed('TIDE DEPLOYED · PLANT AT A OR B', 'call');
    input.lock();
  }

  function toggleBuy() {
    if (state.mode !== 'buy') return;
    if (state.buyOpen) {
      closeBuy();
    } else {
      state.buyOpen = true;
      hud.setOverlay('buy');
      input.unlock();
    }
  }

  function closeBuy() {
    if (state.mode !== 'buy') return;
    state.buyOpen = false;
    hud.setOverlay(null);
    input.lock();
  }

  function buy(id) {
    if (state.mode !== 'buy') return false;
    let price = 0;
    if (id === 'armor') {
      price = ECONOMY.armor;
      if (state.armor > 0) return false;
    } else if (id === 'frag' || id === 'flash') {
      price = id === 'frag' ? ECONOMY.frag : ECONOMY.flash;
      if (state.grenades[id] > 0) return false;
    } else {
      if (!WEAPONS[id] || WEAPONS[id].slot !== 2) return false;
      price = WEAPONS[id].price;
      if (state.primary === id) return false;
    }
    if (state.money < price) return false;
    state.money -= price;
    if (id === 'armor') state.armor = 100;
    else if (id === 'frag' || id === 'flash') state.grenades[id] = 1;
    else {
      state.primary = id;
      weapon.equip(id);
    }
    audio.buy();
    hud.addFeed(`${id === 'armor' ? 'PLATE ARMOR' : id === 'frag' ? 'FRAG CHARGE' : id === 'flash' ? 'FLASH CHARGE' : WEAPONS[id].name} ACQUIRED`, 'call');
    return true;
  }

  function completePlant(siteKey) {
    if (state.mode !== 'live') return false;
    const site = MAP.sites[siteKey];
    state.mode = 'planted';
    state.bomb.active = true;
    state.bomb.planted = true;
    state.bomb.fuse = ROUND.fuse;
    state.bomb.defuse = 0;
    state.bomb.defusing = false;
    state.bomb.defuserId = -1;
    state.bomb.beep = 0;
    state.plant.time = 0;
    state.plant.active = false;
    state.plant.site = siteKey;
    state.money = Math.min(ECONOMY.cap, state.money + ECONOMY.plant);
    state.plants += 1;
    showBomb(site.x, site.z);
    bots.hear(site.x, site.z, 60);
    hud.addFeed(`YOU > CHARGE PLANTED AT ${siteKey}`, 'you');
    audio.plant();
    hud.setPrompt('CHARGE PLANTED · DEFEND', 1.2);
    return true;
  }

  function stageCharge(siteKey, progress) {
    const site = MAP.sites[siteKey];
    state.mode = 'live';
    state.plant.site = siteKey;
    state.plant.active = true;
    state.plant.time = ROUND.plantTime * progress;
    showBomb(site.x, site.z);
  }

  function detonate() {
    effects.explosion(state.bomb.x, 0.1, state.bomb.z);
    audio.explosion();
    state.shake = 0.9;
    state.flash = 0.8;
    bomb.visible = false;
  }

  function updatePlant(dt) {
    const gear = state.health + state.armor;
    if (gear < lastGear - 0.01 || state.shots !== lastShots) {
      state.plant.time = 0;
      state.plant.active = false;
      lastGear = gear;
      lastShots = state.shots;
    } else {
      lastGear = gear;
      lastShots = state.shots;
    }
    const site = map.nearSite(state.player.x, state.player.z);
    const holding = input.keys.KeyE;
    if (site && holding && state.alive && state.player.speed < 0.7) {
      if (!state.plant.active) {
        state.plant.active = true;
        state.plant.site = site;
        showBomb(MAP.sites[site].x, MAP.sites[site].z);
      }
      state.plant.time += dt;
      if (state.plant.time >= ROUND.plantTime) completePlant(site);
    } else if (state.plant.active) {
      state.plant.active = false;
      state.plant.time = 0;
      if (!state.bomb.planted) bomb.visible = false;
    }
    if (state.plant.active && state.plant.time > 0 && Math.floor(state.plant.time * 2.5) !== Math.floor((state.plant.time - dt) * 2.5)) audio.plantTick();
  }

  function endRound(winner, reason) {
    if (state.mode === 'ended' || state.mode === 'matchEnd') return;
    const win = winner === 'you';
    state.mode = 'ended';
    state.endClock = ROUND.end;
    state.plant.active = false;
    state.plant.time = 0;
    state.bomb.planted = false;
    state.bomb.active = false;
    state.bomb.defusing = false;
    state.bomb.defuse = 0;
    state.bomb.defuserId = -1;
    bomb.visible = false;
    ring.visible = false;
    if (win) state.scoreYou += 1;
    else state.scoreRust += 1;
    const delta = win ? ECONOMY.win : ECONOMY.loss;
    state.money = Math.min(ECONOMY.cap, state.money + delta);
    hud.showRound(win, reason, delta, ROUND.end);
    hud.setOverlay('round');
    audio.roundEnd(win);
  }

  function showMatch() {
    const win = state.scoreYou >= ROUND.target;
    state.mode = 'matchEnd';
    state.matchResult = win ? 'MATCH WON' : 'MATCH LOST';
    hud.showMatch(win, {
      rounds: `${state.scoreYou} : ${state.scoreRust}`,
      kills: state.kills,
      plants: state.plants,
      accuracy: weapon.accuracy(),
    });
    hud.setOverlay('match');
    input.unlock();
  }

  function nextRound() {
    if (state.scoreYou >= ROUND.target || state.scoreRust >= ROUND.target) {
      showMatch();
      return;
    }
    state.round += 1;
    startBuyPhase();
  }

  function restartMatch() {
    startMatch();
    hud.setOverlay('buy');
  }

  function updateBombVisuals(dt) {
    if (state.bomb.planted) {
      state.bomb.led += dt;
      led.visible = Math.floor(state.bomb.led * (6 + (1 - state.bomb.fuse / ROUND.fuse) * 12)) % 2 === 0;
      ring.visible = state.bomb.defusing;
      if (ring.visible) {
        const k = clamp(state.bomb.defuse / ROUND.defuseTime, 0, 1);
        ring.scale.setScalar(0.35 + k * 0.9);
        ringMaterial.opacity = 0.55 + Math.sin(state.time * 12) * 0.2;
      }
      state.bomb.beep -= dt;
      if (state.bomb.beep <= 0 && state.bomb.fuse > 0) {
        beepGap = lerp(0.12, 1.0, clamp(state.bomb.fuse / ROUND.fuse, 0, 1));
        state.bomb.beep = beepGap;
        audio.beep();
      }
    } else {
      led.visible = true;
      ring.visible = false;
    }
  }

  function update(dt) {
    if (state.mode === 'buy') {
      if (input.pressed.has('KeyB')) toggleBuy();
      state.buyClock -= dt;
      if (state.buyClock <= 0) startLive();
      updateBombVisuals(dt);
      return;
    }
    updateBombVisuals(dt);
    if (state.mode === 'live') {
      state.clock = Math.max(0, state.clock - dt);
      updatePlant(dt);
      if (state.mode !== 'live') return;
      if (state.health <= 0) { endRound('rust', 'TIDE DOWN'); return; }
      if (bots.allDead()) { endRound('you', 'DEFENDERS DOWN'); return; }
      if (state.clock <= 0) { endRound('rust', 'TIME EXPIRED'); return; }
    } else if (state.mode === 'planted') {
      state.bomb.fuse = Math.max(0, state.bomb.fuse - dt);
      paintDisplay(state.bomb.fuse);
      if (state.health <= 0) { endRound('rust', 'TIDE DOWN'); return; }
      if (state.bomb.defuse >= ROUND.defuseTime) { endRound('rust', 'CHARGE DEFUSED'); return; }
      if (bots.allDead()) { endRound('you', 'DEFENDERS DOWN'); return; }
      if (state.bomb.fuse <= 0) { detonate(); endRound('you', 'CHARGE DETONATED'); return; }
    } else if (state.mode === 'ended') {
      state.endClock -= dt;
      if (state.endClock <= 0) {
        if (state.scoreYou >= ROUND.target || state.scoreRust >= ROUND.target) showMatch();
        else nextRound();
      }
    }
  }

  return {
    bomb, startMatch, startBuyPhase, startLive, closeBuy, toggleBuy, buy, update,
    completePlant, stageCharge, endRound, restartMatch, showMatch, resetBomb,
    paintDisplay,
    setBombYaw,
  };
}
