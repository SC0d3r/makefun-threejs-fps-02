// DOM HUD. Readouts are cached so a quiet frame touches no text nodes; transient feedback is
// driven from the same state the simulation writes.
import { ECONOMY, WEAPONS } from './config.js';
import { clamp, formatClock, formatMoney } from './util.js';

export function createHud(state) {
  const byId = (id) => document.getElementById(id);
  const hud = byId('hud');
  const overlayIds = {
    start: byId('start-overlay'),
    pause: byId('pause-overlay'),
    round: byId('round-overlay'),
    match: byId('match-overlay'),
  };

  const elements = {
    timer: byId('round-timer'),
    bomb: byId('bomb-state'),
    scoreYou: byId('score-you'),
    scoreRust: byId('score-rust'),
    healthValue: byId('health-value'),
    healthFill: byId('health-fill'),
    armorValue: byId('armor-value'),
    armorFill: byId('armor-fill'),
    money: byId('money'),
    weaponName: byId('weapon-name'),
    ammoMag: byId('ammo-mag'),
    ammoReserve: byId('ammo-reserve'),
    fireMode: byId('fire-mode'),
    prompt: byId('prompt'),
    killfeed: byId('killfeed'),
    crosshair: byId('crosshair'),
    hitmarker: byId('hitmarker'),
    vignette: byId('damage-vignette'),
    damageTick: byId('damage-tick'),
    buyMoney: byId('buy-money'),
    buyTimer: byId('buy-timer'),
    buyCards: byId('buy-cards'),
    roundResult: byId('round-result'),
    roundReason: byId('round-reason'),
    roundMoney: byId('round-money'),
    roundCountdown: byId('round-countdown'),
    matchResult: byId('match-result'),
    matchStats: byId('match-stats'),
  };

  const cache = {
    bomb: '',
    scoreYou: -1,
    scoreRust: -1,
    health: -1,
    armor: -1,
    money: '',
    weapon: '',
    ammo: '',
    mode: '',
    prompt: null,
    gap: -1,
    hit: false,
    feed: [-1, -1, -1],
    feedPhase: [0, 0, 0],
    timerSec: -1,
    moneyValue: -1,
    buyMoneyValue: -1,
    buySec: -1,
    damageStage: -1,
    tickDeg: 999,
  };

  const feedRows = [];
  for (let i = 0; i < 3; i++) {
    const row = document.createElement('div');
    row.className = 'kill-row';
    const text = document.createElement('span');
    text.className = 'kill-text';
    const tag = document.createElement('span');
    tag.className = 'kill-tag';
    tag.textContent = 'HEADSHOT';
    row.append(text, tag);
    elements.killfeed.appendChild(row);
    feedRows.push({ row, text, tag });
  }

  const cards = [
    {
      id: 'longshore', name: WEAPONS.longshore.name, price: WEAPONS.longshore.price,
      role: 'Long angle, three-tap body', stats: [82, 58, 78],
    },
    {
      id: 'kestrel', name: WEAPONS.kestrel.name, price: WEAPONS.kestrel.price,
      role: 'Close range, fast burst', stats: [54, 90, 56],
    },
    {
      id: 'breakwater', name: WEAPONS.breakwater.name, price: WEAPONS.breakwater.price,
      role: 'One-step stop, nine pellets', stats: [95, 26, 38],
    },
    {
      id: 'armor', name: 'BODY ARMOR', price: ECONOMY.armorPrice,
      role: 'Half damage absorbed', stats: [0, 0, 100],
    },
    {
      id: 'frag', name: 'FRAG CHARGE', price: ECONOMY.fragPrice,
      role: 'Cooked throw, lethal core', stats: [90, 12, 24],
    },
    {
      id: 'flash', name: 'FLASH CHARGE', price: ECONOMY.flashPrice,
      role: 'Blinds a held angle', stats: [28, 20, 50],
    },
  ];

  for (const card of cards) {
    const article = document.createElement('article');
    article.className = 'buy-card';
    article.dataset.item = card.id;
    const head = document.createElement('div');
    head.className = 'buy-card-head';
    const name = document.createElement('span');
    name.className = 'buy-name';
    name.textContent = card.name;
    const price = document.createElement('span');
    price.className = 'buy-price';
    price.textContent = `$${formatMoney(card.price)}`;
    head.append(name, price);
    const role = document.createElement('p');
    role.className = 'buy-role';
    role.textContent = card.role;
    article.append(head, role);
    if (card.stats[2] > 0) {
      const bars = document.createElement('div');
      bars.className = 'stat-bars';
      const labels = ['DMG', 'RATE', 'ACC'];
      for (let i = 0; i < 3; i++) {
        const line = document.createElement('div');
        line.className = 'stat-line';
        const label = document.createElement('span');
        label.textContent = labels[i];
        const track = document.createElement('i');
        const fill = document.createElement('b');
        fill.style.width = `${card.stats[i]}%`;
        track.appendChild(fill);
        line.append(label, track);
        bars.appendChild(line);
      }
      article.appendChild(bars);
    }
    elements.buyCards.appendChild(article);
  }

  function setText(element, value, key) {
    if (cache[key] === value) return;
    cache[key] = value;
    element.textContent = value;
  }

  function setOverlay(name) {
    for (const key of Object.keys(overlayIds)) {
      overlayIds[key].classList.toggle('is-open', key === name);
    }
    hud.classList.toggle('is-playing', name === 'none');
    if (name !== 'start') {
      // The start card is a one-way door; later overlays reuse the same panel stack.
      overlayIds.start.classList.remove('is-open');
    }
  }

  function hitmarker(headshot = false) {
    state.effects.hitmarker = 0.24;
    elements.hitmarker.classList.toggle('is-headshot', headshot);
  }

  function pushKill(text, headshot = false) {
    let oldest = 0;
    for (let i = 1; i < state.effects.feed.length; i++) {
      if (state.effects.feed[i].life < state.effects.feed[oldest].life) oldest = i;
    }
    const row = state.effects.feed[oldest];
    row.id = ++state.effects.feedSerial;
    row.text = text;
    row.headshot = headshot;
    row.life = 4;
  }

  function setPrompt(text) {
    state.hud.prompt = text;
  }

  function update(dt) {
    const p = state.player;
    const w = state.weapon;

    const timerSec = Math.ceil(state.roundClock);
    if (cache.timerSec !== timerSec) {
      cache.timerSec = timerSec;
      elements.timer.textContent = formatClock(state.roundClock);
    }
    setText(elements.bomb, state.hud.bombState || 'CHARGE CARRIED', 'bomb');
    if (cache.scoreYou !== state.score.you) {
      cache.scoreYou = state.score.you;
      elements.scoreYou.textContent = String(state.score.you);
    }
    if (cache.scoreRust !== state.score.rust) {
      cache.scoreRust = state.score.rust;
      elements.scoreRust.textContent = String(state.score.rust);
    }

    const health = Math.round(p.health);
    if (cache.health !== health) {
      cache.health = health;
      elements.healthValue.textContent = String(health);
      elements.healthFill.style.width = `${clamp(health, 0, 100)}%`;
      elements.healthFill.classList.toggle('is-low', health <= 30);
    }
    const armor = Math.round(p.armor);
    if (cache.armor !== armor) {
      cache.armor = armor;
      elements.armorValue.textContent = String(armor);
      elements.armorFill.style.width = `${clamp(armor, 0, 100)}%`;
    }
    if (cache.moneyValue !== state.money) {
      cache.moneyValue = state.money;
      elements.money.textContent = `$ ${formatMoney(state.money)}`;
    }

    const def = WEAPONS[w.current];
    setText(elements.weaponName, def.name, 'weapon');
    setText(elements.ammoMag, String(w.mags[def.id]), 'ammo');
    const reserve = String(w.reserves[def.id]);
    if (elements.ammoReserve.textContent !== reserve) elements.ammoReserve.textContent = reserve;
    setText(elements.fireMode, w.reloading ? 'RELOADING' : def.fireMode, 'mode');

    const gap = Math.round(6 + w.spread * 900);
    if (cache.gap !== gap) {
      cache.gap = gap;
      elements.crosshair.style.setProperty('--gap', `${gap}px`);
    }

    const hit = state.effects.hitmarker > 0;
    if (cache.hit !== hit) {
      cache.hit = hit;
      elements.hitmarker.classList.toggle('is-active', hit);
    }

    state.effects.damage = Math.max(0, state.effects.damage - dt * 2.1);
    const damage = clamp(p.damageFlash * 0.9 + state.effects.damage * 0.45, 0, 0.92);
    const damageStage = Math.round(damage * 20);
    if (cache.damageStage !== damageStage) {
      cache.damageStage = damageStage;
      elements.vignette.style.opacity = String(damageStage / 20);
      elements.damageTick.style.opacity = damageStage > 1 ? '0.85' : '0';
    }
    if (damageStage > 1) {
      const deg = Math.round((state.effects.damageYaw * 180) / Math.PI);
      if (cache.tickDeg !== deg) {
        cache.tickDeg = deg;
        elements.damageTick.style.transform = `translate(-50%, -50%) rotate(${deg}deg)`;
      }
    }

    const prompt = state.hud.prompt || '';
    if (cache.prompt !== prompt) {
      cache.prompt = prompt;
      elements.prompt.textContent = prompt;
      elements.prompt.classList.toggle('is-visible', prompt.length > 0);
    }

    for (let i = 0; i < state.effects.feed.length; i++) {
      const data = state.effects.feed[i];
      const row = feedRows[i];
      if (data.life > 0) data.life = Math.max(0, data.life - dt);
      const phase = data.life <= 0 ? 0 : data.life < 1 ? 2 : 1;
      if (cache.feed[i] !== data.id || cache.feedPhase[i] !== phase) {
        cache.feed[i] = data.id;
        cache.feedPhase[i] = phase;
        row.text.textContent = data.text;
        row.tag.classList.toggle('is-headshot', data.headshot);
        row.row.classList.toggle('is-open', phase > 0);
        row.row.classList.toggle('is-fading', phase === 2);
      }
    }

    if (cache.buyMoneyValue !== state.money) {
      cache.buyMoneyValue = state.money;
      elements.buyMoney.textContent = `$ ${formatMoney(state.money)}`;
    }
    const buySec = Math.ceil(state.buyClock ?? 12);
    if (cache.buySec !== buySec) {
      cache.buySec = buySec;
      elements.buyTimer.textContent = formatClock(buySec);
    }

    elements.roundResult.textContent = state.hud.roundResult || 'ROUND WON';
    elements.roundReason.textContent = state.hud.roundReason || 'CHARGE DETONATED';
    elements.roundMoney.textContent = state.hud.roundMoney || '+ $3,000';
    elements.roundCountdown.textContent = state.hud.roundCountdown || 'NEXT ROUND IN 4';
    elements.matchResult.textContent = state.hud.matchResult || 'MATCH WON';
    elements.matchStats.textContent = state.hud.matchStats || 'ROUNDS 5  ·  KILLS 0  ·  PLANTS 0  ·  ACCURACY 0%';
  }

  setOverlay('start');
  update(0);

  return { update, setOverlay, setPrompt, hitmarker, pushKill };
}
