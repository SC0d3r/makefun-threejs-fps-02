// DOM HUD, buy menu and overlays. update() only writes changed readouts.
import { ECONOMY, GRENADES, WEAPONS } from './config.js';
import { clamp, formatClock, formatMoney } from './util.js';

const money = (value) => formatMoney(value).replace('$', '$ ');

export function createHud(state, handlers) {
  const byId = (id) => document.getElementById(id);
  const els = {
    timer: byId('timer'),
    bombState: byId('bombState'),
    score: byId('score'),
    health: byId('healthValue'),
    healthBar: byId('healthBar'),
    armor: byId('armorValue'),
    armorBar: byId('armorBar'),
    money: byId('money'),
    weapon: byId('weaponName'),
    ammo: byId('ammoValue'),
    mode: byId('fireMode'),
    prompt: byId('prompt'),
    crosshair: byId('crosshair'),
    hitmarker: byId('hitmarker'),
    damage: byId('damage'),
    damageTick: byId('damageTick'),
    flash: byId('flash'),
    feed: [byId('feed0'), byId('feed1'), byId('feed2')],
    buy: byId('buyMenu'),
    buyTimer: byId('buyTimer'),
    buyMoney: byId('buyMoney'),
    buyScore: byId('buyScore'),
    buyRound: byId('buyRound'),
    start: byId('startOverlay'),
    round: byId('roundOverlay'),
    roundResult: byId('roundResult'),
    roundReason: byId('roundReason'),
    roundMoney: byId('roundMoney'),
    roundNext: byId('roundNext'),
    match: byId('matchOverlay'),
    matchResult: byId('matchResult'),
    matchStats: byId('matchStats'),
    pause: byId('pauseOverlay'),
  };
  const cards = Array.from(document.querySelectorAll('.buyCard'));
  const last = { timer: '', bomb: '', score: '', health: '', armor: '', money: '', ammo: '', weapon: '', mode: '', prompt: '', gap: -1, feed: '' };
  const setText = (el, key, value) => {
    if (last[key] === value) return;
    last[key] = value;
    if (el) el.textContent = value;
  };

  for (const card of cards) {
    card.addEventListener('click', (event) => {
      event.stopPropagation();
      if (card.disabled) return;
      handlers.onBuy(card.dataset.item);
    });
  }
  byId('startDeploy')?.addEventListener('click', (event) => {
    event.stopPropagation();
    handlers.onDeploy();
  });
  byId('buyDeploy')?.addEventListener('click', (event) => {
    event.stopPropagation();
    handlers.onCloseBuy();
  });
  byId('buyClose')?.addEventListener('click', (event) => {
    event.stopPropagation();
    handlers.onCloseBuy();
  });
  byId('restartBtn')?.addEventListener('click', (event) => {
    event.stopPropagation();
    handlers.onRestart();
  });
  byId('pauseOverlay')?.addEventListener('click', () => handlers.onResume());
  byId('buyMenu')?.addEventListener('click', (event) => event.stopPropagation());

  const buyKey = () => {
    const p = state.player;
    let key = `${p.money}|${state.round.phase}|${p.armor}|${p.grenades.frag}|${p.grenades.flash}|`;
    for (const id of Object.keys(WEAPONS)) key += state.weapon.owned[id] ? '1' : '0';
    return key;
  };
  let prevBuyKey = '';

  const updateBuy = () => {
    if (!els.buy) return;
    const open = state.round.phase === 'buy' && state.flags.buyOpen;
    els.buy.classList.toggle('open', open);
    if (!open) return;
    setText(els.buyTimer, 'buyTimer', `BUY PHASE ${formatClock(state.round.timer)}`);
    setText(els.buyMoney, 'buyMoney', money(state.player.money));
    setText(els.buyScore, 'buyScore', `YOU ${state.round.score[0]} : ${state.round.score[1]} RUST`);
    setText(els.buyRound, 'buyRound', `ROUND ${state.round.number}`);
    const key = buyKey();
    if (key === prevBuyKey) return;
    prevBuyKey = key;
    for (const card of cards) {
      const item = card.dataset.item;
      let price = 0;
      let owned = false;
      if (item === 'armor') {
        price = ECONOMY.armorPrice;
        owned = state.player.armor > 0;
      } else if (item === 'frag' || item === 'flash') {
        price = GRENADES[item].price;
        owned = state.player.grenades[item] > 0;
      } else {
        price = WEAPONS[item].price;
        owned = state.weapon.owned[item];
      }
      const disabled = owned || state.player.money < price;
      card.disabled = disabled;
      card.classList.toggle('owned', owned);
      card.classList.toggle('poor', !owned && state.player.money < price);
      card.querySelector('.ownedTag').textContent = owned ? 'OWNED' : disabled ? 'NO FUNDS' : 'BUY';
    }
  };

  const update = (dt) => {
    const r = state.round;
    const p = state.player;
    if (state.hitMarker > 0) state.hitMarker = Math.max(0, state.hitMarker - dt);
    if (state.damageFlash > 0) state.damageFlash = Math.max(0, state.damageFlash - dt * 2.4);
    for (let i = state.feed.length - 1; i >= 0; i -= 1) {
      state.feed[i].t -= dt;
      if (state.feed[i].t <= 0) state.feed.splice(i, 1);
    }

    let timeText = formatClock(r.timer);
    if (r.phase === 'buy') timeText = formatClock(r.timer);
    if (r.phase === 'matchEnd') timeText = '--:--';
    setText(els.timer, 'timer', timeText);
    let bombText = 'CHARGE CARRIED';
    if (r.phase === 'buy') bombText = 'BUY PHASE';
    else if (r.phase === 'planted') bombText = `CHARGE PLANTED ${formatClock(r.fuse)}`;
    else if (r.phase === 'ended') bombText = r.result;
    else if (r.phase === 'matchEnd') bombText = state.match.result;
    setText(els.bombState, 'bomb', bombText);

    setText(els.score, 'score', `${r.score[0]} : ${r.score[1]}`);
    setText(els.health, 'health', String(Math.max(0, Math.ceil(p.health))));
    setText(els.armor, 'armor', String(Math.max(0, Math.ceil(p.armor))));
    if (els.healthBar) els.healthBar.style.width = `${clamp(p.health, 0, 100)}%`;
    if (els.armorBar) els.armorBar.style.width = `${clamp(p.armor, 0, 50) * 2}%`;
    setText(els.money, 'money', money(p.money));

    const def = WEAPONS[state.weapon.current];
    const ammo = state.weapon.ammo[state.weapon.current];
    if (p.grenadeSelect) {
      const g = GRENADES[p.grenadeSelect];
      setText(els.weapon, 'weapon', g.name);
      setText(els.ammo, 'ammo', `x${p.grenades[p.grenadeSelect]}`);
      setText(els.mode, 'mode', 'G TO THROW');
    } else {
      setText(els.weapon, 'weapon', def.name);
      setText(els.ammo, 'ammo', `${ammo.mag} / ${ammo.reserve}`);
      setText(els.mode, 'mode', def.auto ? 'AUTO' : def.pellets > 1 ? 'PUMP' : 'SEMI');
    }

    let prompt = state.prompt;
    if (state.round.phase === 'buy' && state.flags.buyOpen) prompt = 'PRESS B TO CLOSE';
    if (state.round.phase === 'planted' && r.defusing) prompt = 'DEFUSE IN PROGRESS';
    if (!p.grenadeSelect && ammo.mag <= 0 && (r.phase === 'live' || r.phase === 'planted') && !r.defusing && r.plantProgress <= 0) {
      prompt = state.weapon.reloading > 0 ? 'RELOADING' : 'RELOAD [R]';
    }
    if (r.phase === 'ended' || r.phase === 'matchEnd') prompt = '';
    setText(els.prompt, 'prompt', prompt);

    const gap = Math.round(clamp(6 + (state.crosshairGap || 0) * 900, 6, 42));
    if (gap !== last.gap && els.crosshair) {
      last.gap = gap;
      els.crosshair.style.setProperty('--gap', `${gap}px`);
    }
    if (els.hitmarker) els.hitmarker.classList.toggle('on', state.hitMarker > 0);
    if (els.damage) els.damage.style.opacity = String(clamp(state.damageFlash, 0, 1) * 0.7);
    if (els.damageTick) {
      const deg = (p.damageDir * 180) / Math.PI;
      els.damageTick.style.transform = `translate(-50%, -100%) rotate(${deg.toFixed(1)}deg)`;
      els.damageTick.style.opacity = String(clamp(state.damageFlash, 0, 1) * 0.9);
    }
    if (els.flash) els.flash.style.opacity = String(clamp(p.flash / 2.5, 0, 1) * 0.88);

    for (let i = 0; i < 3; i += 1) {
      const row = els.feed[i];
      if (!row) continue;
      const entry = state.feed[state.feed.length - 1 - i];
      const key = entry ? `${entry.text}|${entry.t.toFixed(1)}` : '';
      if (row.dataset.key === key) continue;
      row.dataset.key = key;
      row.classList.toggle('visible', !!entry);
      row.classList.toggle('head', !!entry && entry.head);
      row.textContent = entry ? entry.text : '';
      row.style.opacity = entry ? String(clamp(entry.t, 0, 1)) : '0';
    }

    if (els.start) els.start.classList.toggle('open', state.flags.startOpen && !state.shotMode);
    if (els.round) {
      els.round.classList.toggle('open', state.flags.roundEnd);
      if (state.flags.roundEnd) {
        setText(els.roundResult, 'roundResult', r.result);
        setText(els.roundReason, 'roundReason', r.reason);
        setText(els.roundMoney, 'roundMoney', `${r.moneyDelta >= 0 ? '+' : ''}${money(r.moneyDelta)}`);
        setText(els.roundNext, 'roundNext', `NEXT ROUND IN ${Math.max(0, Math.ceil(r.ended))}`);
      }
    }
    if (els.match) {
      els.match.classList.toggle('open', state.flags.matchEnd);
      if (state.flags.matchEnd) {
        setText(els.matchResult, 'matchResult', state.match.result);
        const acc = state.stats.shots > 0 ? Math.round((state.stats.hits / state.stats.shots) * 100) : 0;
        setText(
          els.matchStats,
          'matchStats',
          `ROUNDS ${state.stats.rounds}   KILLS ${state.stats.kills}   PLANTS ${state.stats.plants}   ACCURACY ${acc}%`,
        );
      }
    }
    if (els.pause) {
      const paused = state.paused && state.mode === 'playing' && !state.flags.startOpen && !state.flags.roundEnd && !state.flags.matchEnd && !state.shotMode;
      els.pause.classList.toggle('open', paused);
    }
    updateBuy();
  };

  return { update, updateBuyReady: () => (prevBuyKey = '') };
}
