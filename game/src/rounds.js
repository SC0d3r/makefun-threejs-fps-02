// Round state machine, the charge, economy and the buy list.
import * as THREE from 'three';
import { ECONOMY, GRENADES, ROUNDS, SITES, WEAPONS } from './config.js';
import { clamp } from './util.js';

function buildBomb(scene) {
  const group = new THREE.Group();
  const bodyMat = new THREE.MeshStandardMaterial({ color: 0x2a333b, roughness: 0.55, metalness: 0.5 });
  const hazardMat = new THREE.MeshStandardMaterial({ map: null, color: 0xffb15c, roughness: 0.5, metalness: 0.2 });
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.18, 0.32), bodyMat);
  body.position.y = 0.09;
  group.add(body);
  const band = new THREE.Mesh(new THREE.BoxGeometry(0.44, 0.05, 0.34), hazardMat);
  band.position.y = 0.1;
  group.add(band);
  const plate = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.02, 0.16), new THREE.MeshStandardMaterial({ color: 0x11171d }));
  plate.position.set(0, 0.185, 0);
  group.add(plate);
  const ledMat = new THREE.MeshBasicMaterial({ color: 0xff2a1e });
  const led = new THREE.Mesh(new THREE.SphereGeometry(0.035, 8, 6), ledMat);
  led.position.set(0.11, 0.215, 0.02);
  group.add(led);
  const beep = new THREE.Mesh(new THREE.SphereGeometry(0.07, 8, 6), new THREE.MeshBasicMaterial({ color: 0xff2a1e, transparent: true, opacity: 0.3 }));
  beep.position.copy(led.position);
  group.add(beep);
  const wireMat = new THREE.MeshStandardMaterial({ color: 0xb4552d, roughness: 0.8 });
  for (let i = 0; i < 3; i += 1) {
    const wire = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.28, 5), wireMat);
    wire.position.set(-0.14 + i * 0.05, 0.2, -0.06);
    wire.rotation.z = Math.PI / 2;
    group.add(wire);
  }
  const antenna = new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.006, 0.38, 5), wireMat);
  antenna.position.set(-0.16, 0.3, 0.1);
  antenna.rotation.z = -0.2;
  group.add(antenna);
  group.visible = false;
  scene.add(group);
  return { group, ledMat, beep };
}

export function createRounds(state, scene, effects, audio, player, weapon, bots) {
  const bomb = buildBomb(scene);

  const setPrompt = (text) => {
    state.prompt = text;
  };

  const showBomb = (x, z, site) => {
    state.bomb.planted = true;
    state.bomb.x = x;
    state.bomb.z = z;
    state.bomb.led = 0;
    bomb.group.visible = true;
    bomb.group.position.set(x, 0, z);
    bomb.group.rotation.y = site === 'B' ? 0.7 : -0.4;
  };

  const hideBomb = () => {
    state.bomb.planted = false;
    state.round.plantProgress = 0;
    state.round.defuseProgress = 0;
    state.round.defusing = false;
    state.flags.defused = false;
    bomb.group.visible = false;
    effects.defuse(0, 0, 0, false);
  };

  const nearestSite = () => {
    let best = null;
    let bestDist = Infinity;
    for (const site of SITES) {
      const dist = Math.hypot(state.player.pos.x - site.x, state.player.pos.z - site.z);
      if (dist < ROUNDS.plantRange && dist < bestDist) {
        best = site;
        bestDist = dist;
      }
    }
    return best;
  };

  const feed = (text, head = false) => {
    state.feed.push({ text, head, t: 4 });
    if (state.feed.length > 3) state.feed.shift();
  };

  const startBuy = () => {
    state.round.number += 1;
    state.round.phase = 'buy';
    state.round.timer = ROUNDS.buy;
    state.round.fuse = 0;
    state.round.result = '';
    state.round.reason = '';
    state.round.ended = 0;
    state.round.plantSite = null;
    state.round.plantProgress = 0;
    state.round.defuseProgress = 0;
    state.round.defusing = false;
    state.round.moneyDelta = 0;
    state.flags.buyOpen = true;
    state.flags.roundEnd = false;
    state.flags.matchEnd = false;
    state.flags.defused = false;
    state.paused = false;
    state.feed.length = 0;
    hideBomb();
    player.reset();
    weapon.resetRound();
    bots.reset();
    state.mode = 'playing';
    setPrompt('PRESS B TO BUY');
    if (audio) audio.roundStart();
  };

  const startMatch = () => {
    state.mode = 'playing';
    state.match.result = '';
    state.round.score = [0, 0];
    state.round.number = 0;
    state.stats.kills = 0;
    state.stats.plants = 0;
    state.stats.shots = 0;
    state.stats.hits = 0;
    state.stats.rounds = 0;
    state.player.money = ECONOMY.loss;
    state.weapon.owned = { pistol: true, smg: false, rifle: false, shotgun: false };
    state.weapon.primary = null;
    state.flags.startOpen = false;
    state.flags.matchEnd = false;
    if (audio) audio.start();
    startBuy();
  };

  const restart = () => {
    state.flags.matchEnd = false;
    state.flags.roundEnd = false;
    state.flags.buyOpen = false;
    startMatch();
  };

  const closeBuy = () => {
    if (state.round.phase !== 'buy') return;
    state.flags.buyOpen = false;
    state.round.phase = 'live';
    state.round.timer = ROUNDS.live;
    setPrompt('CHARGE CARRIED');
  };

  const toggleBuy = () => {
    if (state.round.phase !== 'buy') return false;
    if (state.flags.buyOpen) closeBuy();
    else state.flags.buyOpen = true;
    return true;
  };

  const buy = (item) => {
    if (state.round.phase !== 'buy') return false;
    const p = state.player;
    if (item === 'armor') {
      if (p.armor > 0 || p.money < ECONOMY.armorPrice) return false;
      p.money -= ECONOMY.armorPrice;
      p.armor = 50;
    } else if (item === 'frag' || item === 'flash') {
      const def = GRENADES[item];
      if (p.grenades[item] >= 1 || p.money < def.price) return false;
      p.money -= def.price;
      p.grenades[item] += 1;
    } else if (WEAPONS[item]) {
      const def = WEAPONS[item];
      if (state.weapon.owned[item] || p.money < def.price) return false;
      p.money -= def.price;
      weapon.give(item);
    } else {
      return false;
    }
    if (audio) audio.buy();
    closeBuy();
    return true;
  };

  const endRound = (winner, reason) => {
    if (state.round.phase === 'ended' || state.round.phase === 'matchEnd') return;
    const won = winner === 'attackers';
    state.round.phase = 'ended';
    state.round.ended = ROUNDS.ended;
    state.round.result = won ? 'VICTORY' : 'DEFEAT';
    state.round.reason = reason;
    state.round.moneyDelta = won ? ECONOMY.win : ECONOMY.loss;
    state.player.money = Math.min(ECONOMY.cap, state.player.money + state.round.moneyDelta);
    state.round.score[won ? 0 : 1] += 1;
    state.stats.rounds += 1;
    state.flags.roundEnd = true;
    state.flags.buyOpen = false;
    state.prompt = '';
    if (audio) {
      if (won) audio.win();
      else audio.lose();
    }
  };

  const detonate = () => {
    if (audio) audio.explosion(1.4);
    effects.explosion(state.bomb.x, 0.6, state.bomb.z, 2.4);
    player.addShake(0.8);
    const dist = Math.hypot(player.pos.x - state.bomb.x, player.pos.z - state.bomb.z);
    if (dist < 9 && player.alive) player.takeDamage(60 * (1 - dist / 9), state.bomb.x, state.bomb.z);
    endRound('attackers', 'CHARGE DETONATED');
  };

  const plant = (site) => {
    const p = state.player;
    showBomb(p.pos.x, p.pos.z, site.id);
    state.round.phase = 'planted';
    state.round.fuse = ROUNDS.fuse;
    state.round.timer = ROUNDS.fuse;
    state.round.plantSite = site.id;
    state.round.plantProgress = 0;
    state.round.beep = 0.4;
    state.round.beepGap = 1;
    p.money = Math.min(ECONOMY.cap, p.money + ECONOMY.plant);
    state.stats.plants += 1;
    bots.plantAlert(p.pos.x, p.pos.z);
    if (audio) audio.plantDone();
    feed('TIDE > CHARGE PLANTED');
    setPrompt('CHARGE PLANTED');
  };

  const update = (dt) => {
    const r = state.round;
    const p = state.player;
    if (state.mode !== 'playing' || state.shotFrozen) return;
    if (r.phase === 'buy') {
      r.timer -= dt;
      if (r.timer <= 0) closeBuy();
      return;
    }
    if (r.phase === 'live') {
      r.timer -= dt;
      if (!p.alive) {
        endRound('defenders', 'TIDE DOWN');
        return;
      }
      if (bots.allDead()) {
        endRound('attackers', 'RUST ELIMINATED');
        return;
      }
      const site = nearestSite();
      if (site) {
        if (!r.plantProgress) setPrompt('HOLD E TO PLANT');
        if (inputPlant(dt, site)) return;
      } else {
        r.plantProgress = Math.max(0, r.plantProgress - dt * 2);
        if (r.timer > 0) setPrompt('CHARGE CARRIED');
      }
      if (r.timer <= 0) endRound('defenders', 'TIME EXPIRED');
      return;
    }
    if (r.phase === 'planted') {
      r.fuse -= dt;
      r.timer = Math.max(0, r.fuse);
      if (!p.alive) {
        endRound('defenders', 'TIDE DOWN');
        return;
      }
      if (state.flags.defused) {
        endRound('defenders', 'CHARGE DEFUSED');
        return;
      }
      const anyDefusing = bots.bots.some((bot) => !bot.dead && bot.defusing);
      r.defusing = anyDefusing;
      if (!anyDefusing) r.defuseProgress = Math.max(0, r.defuseProgress - dt * 1.6);
      effects.defuse(state.bomb.x, state.bomb.z, r.defuseProgress, anyDefusing);
      r.beep -= dt;
      if (r.beep <= 0) {
        r.beepGap = 1.0 - 0.88 * clamp(1 - r.fuse / ROUNDS.fuse, 0, 1);
        r.beep = r.beepGap;
        state.bomb.led = 1;
        if (audio) audio.beep(clamp(1 - r.fuse / ROUNDS.fuse, 0, 1));
      }
      state.bomb.led = Math.max(0, state.bomb.led - dt * 4);
      bomb.ledMat.color.setHex(state.bomb.led > 0.2 ? 0xff2a1e : 0x4a0d0a);
      bomb.beep.scale.setScalar(1 + state.bomb.led * 1.5);
      bomb.group.position.y = Math.sin(state.time * 8) * 0.005;
      setPrompt(anyDefusing ? 'DEFUSE IN PROGRESS' : 'HOLD THE SITE');
      if (r.defuseProgress >= 1) {
        endRound('defenders', 'CHARGE DEFUSED');
        return;
      }
      if (r.fuse <= 0) {
        detonate();
        return;
      }
      if (bots.allDead()) endRound('attackers', 'RUST ELIMINATED');
      return;
    }
    if (r.phase === 'ended') {
      r.ended -= dt;
      if (r.ended <= 0) {
        if (r.score[0] >= ROUNDS.wins || r.score[1] >= ROUNDS.wins) {
          r.phase = 'matchEnd';
          state.flags.roundEnd = false;
          state.flags.matchEnd = true;
          state.match.result = r.score[0] >= ROUNDS.wins ? 'MATCH WON' : 'MATCH LOST';
          if (audio) audio.matchEnd(state.match.result === 'MATCH WON');
        } else {
          setPrompt('');
          startBuy();
        }
      }
    }
  };

  function inputPlant(dt, site) {
    const p = state.player;
    const moving = p.speed > 0.25 || p.moving;
    const firing = p.firedAt < 0.1;
    const damaged = p.lastDamage < 0.25;
    const held = state.inputRef && state.inputRef.isDown('KeyE');
    if (moving || firing || damaged) {
      if (state.round.plantProgress > 0) setPrompt('PLANT CANCELLED');
      state.round.plantProgress = Math.max(0, state.round.plantProgress - dt * 3);
      return false;
    }
    if (!held) {
      state.round.plantProgress = Math.max(0, state.round.plantProgress - dt * 3);
      setPrompt('HOLD E TO PLANT');
      return false;
    }
    state.round.plantProgress = Math.min(1, state.round.plantProgress + dt / ROUNDS.plant);
    setPrompt(`PLANTING ${Math.floor(state.round.plantProgress * 100)}%`);
    if (audio) audio.plantTick(state.round.plantProgress);
    if (state.round.plantProgress >= 1) {
      plant(site);
      return true;
    }
    return false;
  }

  const updateBombIdle = () => {
    if (state.round.phase === 'planted') {
      bomb.group.rotation.y += 0.0012;
      const pulse = 0.5 + Math.sin(state.time * 6) * 0.5;
      bomb.beep.material.opacity = 0.15 + pulse * 0.25;
    }
  };

  const stageBomb = (x, z, site) => {
    showBomb(x, z, site);
    state.round.plantSite = site;
    bomb.ledMat.color.setHex(0xff2a1e);
  };

  return {
    update,
    updateBombIdle,
    startMatch,
    startBuy,
    restart,
    closeBuy,
    toggleBuy,
    buy,
    endRound,
    plant,
    detonate,
    stageBomb,
    hideBomb,
    bomb,
    nearestSite,
    showBomb,
  };
}
