// Deterministic screenshot staging. A fixed settle pass runs first, then every
// visible value is written directly so two frames match for a given seed.
import * as THREE from 'three';
import { ROUNDS } from './config.js';

const muzzle = new THREE.Vector3();

export function createShot(state, scene, camera, player, weapon, bots, rounds, effects, hud, stepFixed) {
  const placeBot = (bot, x, z, yaw, visible = true) => {
    bot.dead = false;
    bot.health = 100;
    bot.blind = 0;
    bot.defusing = false;
    bot.x = x;
    bot.z = z;
    bot.yaw = yaw;
    bot.group.visible = visible;
    bot.group.position.set(x, 0, z);
    bot.group.rotation.set(0, yaw, 0);
    bot.legs[0].rotation.x = 0.18;
    bot.legs[1].rotation.x = -0.18;
    bot.arms[0].rotation.x = -0.2;
    bot.arms[1].rotation.x = 0.15;
    bot.flash.material.opacity = 0;
    bot.drop.visible = false;
  };

  const common = () => {
    state.mode = 'playing';
    state.paused = false;
    state.shotMode = true;
    state.shotFrozen = false;
    state.flags.startOpen = false;
    state.flags.buyOpen = false;
    state.flags.roundEnd = false;
    state.flags.matchEnd = false;
    state.flags.defused = false;
    state.player.alive = true;
    state.player.deadT = 0;
    state.player.vel.x = 0;
    state.player.vel.y = 0;
    state.player.vel.z = 0;
    state.round.score = [2, 1];
    state.round.number = 4;
    state.weapon.owned.rifle = true;
    state.weapon.primary = 'rifle';
    state.weapon.reloading = 0;
    state.weapon.cooldown = 0;
    state.player.grenadeSelect = null;
    state.player.grenades.frag = 1;
    state.player.grenades.flash = 1;
    state.feed.length = 0;
    state.hitMarker = 0;
    state.damageFlash = 0;
    state.player.flash = 0;
    state.player.shake = 0;
    weapon.select('rifle');
    rounds.hideBomb();
    effects.defuse(0, 0, 0, false);
    document.body.classList.add('shot');
  };

  const modeCover = () => {
    player.setPose(-22.5, 0, -3.5, -Math.PI / 4, -0.043, 0);
    state.player.eye = 1.7;
    state.player.health = 87;
    state.player.armor = 50;
    state.player.money = 3250;
    state.player.alive = true;
    state.round.phase = 'planted';
    state.round.timer = 37;
    state.round.fuse = 37;
    state.round.plantSite = 'A';
    state.round.plantProgress = 1;
    state.round.defuseProgress = 0;
    state.flags.defused = false;
    state.prompt = 'HOLD THE SITE';
    state.crosshairGap = 0.008;
    weapon.setAmmo('rifle', 24, 90);
    rounds.stageBomb(-16, -10, 'A');
    state.round.beep = 0.8;
    const ward = bots.bots[0];
    const cinder = bots.bots[1];
    const roamer = bots.bots[2];
    placeBot(ward, -18.1, -13.1, Math.atan2(-(-22.5 - -18.1), -(-3.5 - -13.1)));
    placeBot(cinder, -14.2, -12.4, Math.atan2(-(-22.5 - -14.2), -(-3.5 - -12.4)));
    roamer.group.visible = false;
    state.feed.push({ text: 'YOU > RUST.WARDEN [HEADSHOT]', head: true, t: 3.8 });
  };

  const modeFirefight = () => {
    player.setPose(0, 2.3, 2, 0, Math.atan2(1.2 - 3.9, 12), 0);
    state.player.eye = 1.6;
    state.player.health = 64;
    state.player.armor = 0;
    state.player.money = 3650;
    state.round.phase = 'live';
    state.round.timer = 72;
    state.round.fuse = 0;
    state.crosshairGap = 0.032;
    state.prompt = 'ENGAGE';
    weapon.setAmmo('rifle', 19, 90);
    const bot = bots.bots[0];
    placeBot(bot, 0, -10, Math.PI);
    bot.health = 48;
    bots.bots[1].group.visible = false;
    bots.bots[2].group.visible = false;
    state.feed.push({ text: 'YOU > RUST.WARDEN [HEADSHOT]', head: true, t: 3.8 });
    state.hitMarker = 0.18;
    weapon.beginFlash(0.1);
    const p = state.player;
    muzzle.set(p.pos.x + 0.18, p.pos.y + p.eye - 0.14, p.pos.z - 0.42);
    effects.tracer(muzzle.x, muzzle.y, muzzle.z, 0.02, 1.22, -10, 0xffd8a2);
    effects.tracer(-0.02, 3.55, 1.1, 0.01, 1.05, -10, 0xfff0cc);
    effects.impact(0.02, 1.22, -9.95, 0, 0.2, 1);
    scene.updateMatrixWorld(true);
  };

  const modePlant = () => {
    player.setPose(-17.5, 0, -7.5, -0.541, -0.361, 1);
    state.player.eye = 1.25;
    state.player.health = 92;
    state.player.armor = 25;
    state.player.money = 3450;
    state.round.phase = 'live';
    state.round.timer = 68;
    state.round.fuse = 0;
    state.round.plantSite = 'A';
    state.round.plantProgress = 0.64;
    state.round.defusing = false;
    state.crosshairGap = 0.01;
    state.prompt = 'PLANTING 64%';
    weapon.setAmmo('rifle', 24, 90);
    rounds.stageBomb(-16, -10, 'A');
    state.bomb.planted = false;
    const bot = bots.bots[0];
    placeBot(bot, -16, -16.4, Math.PI);
    bot.health = 100;
    bots.bots[1].group.visible = false;
    bots.bots[2].group.visible = false;
  };

  const modeBuy = () => {
    player.setPose(0, 0, 20, 0, -0.015, 0);
    state.player.eye = 1.6;
    state.player.health = 100;
    state.player.armor = 0;
    state.player.money = 4150;
    state.round.phase = 'buy';
    state.round.timer = 9;
    state.round.fuse = 0;
    state.flags.buyOpen = true;
    state.crosshairGap = 0.008;
    state.prompt = 'SELECT LOADOUT';
    weapon.setAmmo('rifle', 24, 90);
    for (const bot of bots.bots) bot.group.visible = false;
    const rifleCard = document.querySelector('[data-item="rifle"]');
    if (rifleCard) {
      rifleCard.classList.add('hover');
      hud.updateBuyReady();
    }
  };

  const stage = {
    cover: modeCover,
    firefight: modeFirefight,
    plant: modePlant,
    buy: modeBuy,
  };

  return {
    enter(name) {
      state.round.phase = 'live';
      state.round.timer = ROUNDS.live;
      state.round.fuse = 0;
      state.flags.buyOpen = false;
      state.player.health = 100;
      state.player.armor = 0;
      state.player.money = 1900;
      player.reset();
      bots.reset();
      weapon.resetRound();
      for (let i = 0; i < 90; i += 1) stepFixed(1 / 60);
      common();
      stage[name]();
      hud.update(0);
      camera.updateMatrixWorld(true);
      scene.updateMatrixWorld(true);
    },
  };
}
