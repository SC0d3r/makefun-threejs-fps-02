// Deterministic screenshot scenes. Each entry calls the same spawner, round,
// buy, plant and weapon functions as live play; staging only writes player
// pose, score inputs and a freeze flag. Nothing is drawn as a fake overlay.
import { MAP, PLAYER } from './config.js';
import { clamp } from './util.js';

export function readShot() {
  const value = new URLSearchParams(window.location.search).get('shot');
  return value === 'cover' || value === 'firefight' || value === 'plant' || value === 'buy' ? value : null;
}

export function createShot(state, deps) {
  const { player, weapon, bots, rounds, hud } = deps;

  function eye() { return state.player.crouch ? PLAYER.eyeCrouch : PLAYER.eyeStand; }

  function place(x, y, z) {
    state.player.x = x;
    state.player.y = y;
    state.player.z = z;
    state.player.vx = 0;
    state.player.vy = 0;
    state.player.vz = 0;
    state.player.speed = 0;
    state.player.onGround = true;
  }

  function lookAt(x, y, z) {
    const dx = x - state.player.x;
    const dy = y - (state.player.y + eye());
    const dz = z - state.player.z;
    state.yaw = Math.atan2(-dx, -dz);
    state.pitch = Math.asin(clamp(dy / (Math.hypot(dx, dy, dz) || 1), -1, 1));
    state.recoilPitch = 0;
    state.recoilYaw = 0;
  }

  function facePlayer(bot) {
    const yaw = Math.atan2(state.player.x - bot.x, state.player.z - bot.z);
    return yaw;
  }

  function liveBase(scoreYou, scoreRust, round, money) {
    rounds.startBuyPhase();
    rounds.startLive();
    state.scoreYou = scoreYou;
    state.scoreRust = scoreRust;
    state.round = round;
    state.money = money;
    state.primary = 'rifle';
    weapon.equip('rifle');
    state.switchTimer = 0;
    state.shotTimer = 0;
    state.reload = 0;
    state.feed.length = 0;
    state.feedVersion += 1;
    state.promptTime = 0;
    state.buyOpen = false;
    hud.setOverlay(null);
  }

  function cover() {
    liveBase(2, 1, 3, 3250);
    place(-22.5, 0.1, 1.0);
    lookAt(-16, 1.2, -10);
    state.health = 87;
    state.armor = 50;
    state.ammo.rifle.mag = 24;
    state.ammo.rifle.reserve = 90;
    state.plant.time = 0;
    rounds.completePlant('A');
    state.bomb.fuse = 37;
    state.feed.length = 0;
    state.feedVersion += 1;
    const killed = bots.squad[2];
    bots.damage(killed, 999, 'head');
    killed.group.visible = false;
    killed.drop.visible = false;
    const warden = bots.squad[0];
    const sable = bots.squad[1];
    const wyaw = Math.atan2(state.player.x - (-16.5), state.player.z - (-12.5));
    const syaw = Math.atan2(state.player.x - (-13.5), state.player.z - (-13));
    bots.stage(warden, -16.5, -12.5, wyaw, 0.34);
    bots.stage(sable, -13.5, -13, syaw, -0.3);
    state.money = 3250;
    state.kills = 1;
    state.plants = 1;
    state.clock = 37;
  }

  function firefight() {
    liveBase(2, 1, 5, 3600);
    place(0, 2.3, 2);
    const target = bots.squad[0];
    bots.stage(target, -5.4, -8.5, 0);
    bots.squad[1].group.visible = false;
    const killed = bots.squad[2];
    bots.damage(killed, 999, 'head');
    killed.group.visible = false;
    killed.drop.visible = false;
    bots.stage(target, -5.4, -8.5, facePlayer(target), 0.2);
    target.alive = true;
    target.health = 100;
    target.group.visible = true;
    lookAt(target.x, 1.62, target.z);
    state.health = 64;
    state.armor = 0;
    state.ammo.rifle.mag = 20;
    state.ammo.rifle.reserve = 90;
    state.clock = 72;
    state.shots = 0;
    state.hits = 0;
    state.consecutive = 0;
    if (weapon.fire()) {
      state.shotTimer = 0;
      state.consecutive = 0;
      state.spread = 0.02;
    }
    state.money = 3600;
    state.kills = 1;
  }

  function plant() {
    liveBase(2, 1, 4, 2900);
    state.player.crouch = true;
    place(-17.5, 0, -7.5);
    lookAt(-16, 0.15, -10);
    state.health = 92;
    state.armor = 0;
    state.ammo.rifle.mag = 30;
    state.ammo.rifle.reserve = 90;
    state.clock = 68;
    rounds.stageCharge('A', 0.64);
    const warden = bots.squad[0];
    bots.stage(warden, -15, -15.5, Math.atan2(state.player.x + 15, state.player.z + 15.5), 0.12);
    bots.squad[1].group.visible = false;
    bots.squad[2].group.visible = false;
    state.feed.length = 0;
    state.feedVersion += 1;
  }

  function buy() {
    rounds.startBuyPhase();
    state.buyClock = 9;
    state.money = 4150;
    state.round = 4;
    state.scoreYou = 2;
    state.scoreRust = 1;
    state.primary = null;
    place(MAP.playerSpawn.x, 0, MAP.playerSpawn.z);
    state.yaw = 0;
    state.pitch = 0;
    state.recoilPitch = 0;
    state.recoilYaw = 0;
    hud.setOverlay('buy');
    hud.setHover(0);
    state.feed.length = 0;
    state.feedVersion += 1;
  }

  function stageShot(mode) {
    state.shot = mode;
    state.shotFrozen = false;
    state.started = true;
    state.paused = false;
    window.__shotReady = false;
    if (mode === 'cover') cover();
    else if (mode === 'firefight') firefight();
    else if (mode === 'plant') plant();
    else if (mode === 'buy') buy();
    // One zero-time weapon tick exposes the muzzle flash and viewmodel pose
    // that the staged shot would show on its first simulated frame.
    weapon.update(0);
    state.promptText = '';
    state.promptTime = 0;
    hud.setPrompt('', 0);
    hud.update(0);
    player.syncEye();
    player.applyCamera();
    state.shotFrozen = true;
  }

  return { stageShot };
}
