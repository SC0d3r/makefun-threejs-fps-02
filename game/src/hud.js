// DOM readouts and overlays. Everything shown here is copied from the state
// object; the only writes back are UI choices (buy card clicks, overlay buttons).
import { BUY, MAP, ROUND, WEAPONS } from './config.js';
import { clamp, fmtClock, fmtMoney, fmtTime } from './util.js';

export function createHud(state) {
  const $ = (id) => document.getElementById(id);
  const el = {
    timer: $('timer'), bomb: $('bombState'), you: $('scoreYou'), rust: $('scoreRust'),
    health: $('health'), healthBar: $('healthBar'), armor: $('armor'), armorBar: $('armorBar'),
    money: $('money'), weaponName: $('weaponName'), ammo: $('ammo'), fireMode: $('fireMode'),
    prompt: $('prompt'), crosshair: $('crosshair'), hitmarker: $('hitmarker'),
    feed: $('feed'), vignette: $('vignette'), flash: $('flash'), callout: $('callout'),
    start: $('start'), buy: $('buy'), round: $('round'), match: $('match'), pause: $('pause'),
    buyTimer: $('buyTimer'), buyMoney: $('buyMoney'), cards: $('cards'),
    roundResult: $('roundResult'), roundReason: $('roundReason'), roundMoney: $('roundMoney'), roundCountdown: $('roundCountdown'),
    matchResult: $('matchResult'), matchStats: $('matchStats'),
    deploy: $('deploy'), playAgain: $('playAgain'),
  };
  let actions = {};
  let feedSig = '';
  let cachedGap = -1;
  const cardElements = [];

  for (let i = 0; i < BUY.length; i++) {
    const item = BUY[i];
    const card = document.createElement('button');
    card.className = 'card';
    card.type = 'button';
    const bars = item.stats.map((value, index) => `<i class="${index < Math.round(value * 3) ? 'on' : ''}"></i>`).join('');
    card.innerHTML = `<div class="name"><span>${item.name}</span><span class="price">$${item.price}</span></div>
      <div class="role">${item.role}</div><div class="stats">${bars}</div>`;
    card.addEventListener('click', () => { if (actions.onBuy) actions.onBuy(item.id); });
    el.cards.appendChild(card);
    cardElements.push(card);
  }

  function setText(node, text) {
    if (node._text === text) return;
    node._text = text;
    node.textContent = text;
  }

  function setBar(node, ratio) {
    const value = `${Math.round(clamp(ratio, 0, 1) * 100)}%`;
    if (node._bar === value) return;
    node._bar = value;
    node.style.width = value;
  }

  function bind(next) {
    actions = next;
    el.deploy.addEventListener('click', () => { if (actions.onDeploy) actions.onDeploy(); });
    el.playAgain.addEventListener('click', () => { if (actions.onRestart) actions.onRestart(); });
    el.pause.addEventListener('click', () => { if (actions.onResume) actions.onResume(); });
  }

  function setOverlay(name) {
    state.overlay = name;
    for (const key of ['start', 'buy', 'round', 'match', 'pause']) {
      el[key].classList.toggle('on', key === name);
    }
    el.crosshair.classList.toggle('hide', name === 'start' || name === 'buy' || name === 'match' || name === 'pause');
  }

  function setPrompt(text, seconds = 0) {
    state.promptText = text;
    state.promptTime = seconds;
  }

  function addFeed(text, kind) {
    state.feed.unshift({ text, kind, at: state.time });
    if (state.feed.length > 6) state.feed.length = 6;
    state.feedVersion += 1;
  }

  function callout(text) {
    state.calloutText = text;
    state.calloutTime = 2;
  }

  function hitmarker(on) {
    if (on) state.hitmarker = 0.22;
  }

  function showRound(win, reason, delta, countdown) {
    setText(el.roundResult, win ? 'TIDE WINS' : 'RUST WINS');
    el.roundResult.classList.toggle('loss', !win);
    setText(el.roundReason, reason);
    setText(el.roundMoney, `+ ${fmtMoney(delta)}`);
    setText(el.roundCountdown, `NEXT ROUND IN ${Math.ceil(countdown)}`);
  }

  function showMatch(win, stats) {
    setText(el.matchResult, win ? 'MATCH WON' : 'MATCH LOST');
    el.matchResult.classList.toggle('loss', !win);
    el.matchStats.innerHTML = `ROUNDS ${stats.rounds}<br>KILLS ${stats.kills} &nbsp; PLANTS ${stats.plants}<br>ACCURACY ${stats.accuracy}%`;
  }

  function updateBuy() {
    setText(el.buyTimer, fmtClock(state.buyClock));
    setText(el.buyMoney, fmtMoney(state.money));
    for (let i = 0; i < cardElements.length; i++) {
      const item = BUY[i];
      const card = cardElements[i];
      let owned = false;
      if (item.id === 'armor') owned = state.armor > 0;
      else if (item.id === 'frag' || item.id === 'flash') owned = state.grenades[item.id] > 0;
      else owned = state.primary === item.id;
      const affordable = state.money >= item.price;
      card.classList.toggle('disabled', owned || !affordable);
      card.classList.toggle('owned', owned);
      card.classList.toggle('hover', state.hoverCard === i);
    }
  }

  function setHover(index) {
    state.hoverCard = index;
    for (let i = 0; i < cardElements.length; i++) cardElements[i].classList.toggle('hover', i === index);
  }

  function basePrompt() {
    if (state.mode === 'start') return '';
    if (state.mode === 'buy') return state.buyOpen ? 'CLICK A CARD — B TO CLOSE' : 'PRESS B TO BUY';
    if (state.mode === 'ended') return 'ROUND OVER';
    if (state.mode === 'matchEnd') return 'MATCH OVER';
    if (state.plant.active) return `PLANTING ${Math.min(100, Math.floor((state.plant.time / ROUND.plantTime) * 100))}%`;
    if (state.bomb.planted) return state.bomb.defusing ? 'DEFUSE IN PROGRESS' : 'CHARGE PLANTED — DEFEND';
    if (state.reload > 0) return 'RELOADING';
    const ammo = state.ammo[state.weapon];
    if (state.alive && ammo.mag <= 0) return 'PRESS R TO RELOAD';
    let near = false;
    for (const key of ['A', 'B']) {
      const site = MAP.sites[key];
      if (Math.hypot(state.player.x - site.x, state.player.z - site.z) <= site.radius) near = true;
    }
    if (near) return 'HOLD E TO PLANT';
    return '';
  }

  function update(dt) {
    if (state.mode === 'buy') setText(el.timer, fmtTime(state.buyClock));
    else if (state.mode === 'planted') setText(el.timer, fmtTime(state.bomb.fuse));
    else setText(el.timer, fmtTime(state.clock));

    let bombText = 'CHARGE CARRIED';
    if (!state.alive) bombText = 'TIDE DOWN';
    else if (state.bomb.planted) bombText = state.bomb.defusing ? 'CHARGE DEFUSING' : `CHARGE PLANTED ${fmtTime(state.bomb.fuse)}`;
    else if (state.plant.active && state.plant.time > 0) bombText = `CHARGE PLANTING ${Math.min(100, Math.floor((state.plant.time / ROUND.plantTime) * 100))}%`;
    else if (state.mode === 'buy') bombText = 'CHARGE STOWED';
    setText(el.bomb, bombText);
    el.bomb.classList.toggle('armed', state.bomb.planted);

    setText(el.you, String(state.scoreYou));
    setText(el.rust, String(state.scoreRust));
    setText(el.health, String(Math.round(state.health)));
    setText(el.armor, String(Math.round(state.armor)));
    setText(el.money, fmtMoney(state.money));
    setBar(el.healthBar, state.health / 100);
    setBar(el.armorBar, state.armor / 100);

    if (state.grenade) {
      setText(el.weaponName, state.grenade === 'frag' ? 'FRAG CHARGE' : 'FLASH CHARGE');
      setText(el.ammo, String(state.grenades[state.grenade]));
      setText(el.fireMode, 'G THROW');
    } else {
      const weapon = WEAPONS[state.weapon];
      const ammo = state.ammo[state.weapon];
      setText(el.weaponName, weapon.name);
      setText(el.ammo, `${ammo.mag} / ${ammo.reserve}`);
      setText(el.fireMode, weapon.mode);
    }
    el.ammo.classList.toggle('empty', !state.grenade && state.ammo[state.weapon].mag <= 0);

    const prompt = state.promptTime > 0 ? state.promptText : basePrompt();
    setText(el.prompt, prompt);

    const gap = clamp(4 + state.spread * 900, 4, 34);
    if (Math.abs(gap - cachedGap) > 0.4) {
      cachedGap = gap;
      el.crosshair.style.setProperty('--gap', `${gap.toFixed(1)}px`);
    }
    el.hitmarker.classList.toggle('on', state.hitmarker > 0);
    el.vignette.style.opacity = String(clamp(state.damageFlash, 0, 0.9));
    el.flash.style.opacity = String(clamp(state.flash, 0, 1));
    el.callout.classList.toggle('on', state.calloutTime > 0);
    setText(el.callout, state.calloutText);

    if (state.mode === 'buy') updateBuy();

    let sig = '';
    let count = 0;
    for (let i = 0; i < state.feed.length && count < 3; i++) {
      const row = state.feed[i];
      if (state.time - row.at > 4) continue;
      sig += `${row.text}|${row.kind};`;
      count += 1;
    }
    if (sig !== feedSig) {
      feedSig = sig;
      el.feed.innerHTML = '';
      let shown = 0;
      for (let i = 0; i < state.feed.length && shown < 3; i++) {
        const row = state.feed[i];
        if (state.time - row.at > 4) continue;
        const div = document.createElement('div');
        div.textContent = row.text;
        if (row.kind === 'you') div.className = 'you';
        if (row.kind === 'call') div.className = 'call';
        el.feed.appendChild(div);
        shown += 1;
      }
    }
    setText(el.roundCountdown, `NEXT ROUND IN ${Math.max(0, Math.ceil(state.endClock))}`);
    if (state.overlay !== el._overlay) {
      el._overlay = state.overlay;
      setOverlay(state.overlay);
    }
  }

  return { bind, update, setOverlay, setPrompt, addFeed, callout, hitmarker, showRound, showMatch, setHover };
}
