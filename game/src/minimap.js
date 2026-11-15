// Top-down radar for the dock. It draws from the same solid-AABB list that the
// bullets and the bots consume, so the panel can never show a lane the player
// cannot walk. Static geometry is baked once into an offscreen canvas and the
// live pass only adds the facing cone, the player arrow, spotted enemies and
// the planted charge, which keeps it cheap next to the WebGL draw.
import { MAP } from './config.js';

const SODIUM = 'rgba(255,177,92,';
const CYAN = 'rgba(95,214,208,';
const DANGER = 'rgba(229,72,60,';

export function createRadar(canvas, map, state, bots) {
  const W = 148;
  const H = 111;
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  canvas.width = Math.round(W * dpr);
  canvas.height = Math.round(H * dpr);
  const ctx = canvas.getContext('2d');
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

  const sx = W / (MAP.maxX - MAP.minX);
  const sz = H / (MAP.maxZ - MAP.minZ);
  const px = (x) => (x - MAP.minX) * sx;
  const pz = (z) => (z - MAP.minZ) * sz;

  const base = document.createElement('canvas');
  base.width = canvas.width;
  base.height = canvas.height;
  const bc = base.getContext('2d');
  bc.setTransform(dpr, 0, 0, dpr, 0, 0);
  bc.fillStyle = 'rgba(5,10,16,.88)';
  bc.fillRect(0, 0, W, H);
  for (const box of map.colliders) {
    const tall = box.maxy - box.miny >= 1.35;
    bc.fillStyle = tall ? 'rgba(150,168,180,.82)' : 'rgba(120,136,148,.42)';
    bc.fillRect(px(box.minx), pz(box.minz), (box.maxx - box.minx) * sx, (box.maxz - box.minz) * sz);
  }
  for (const key of ['A', 'B']) {
    const site = map.sites[key];
    const cx = px(site.x);
    const cy = pz(site.z);
    bc.strokeStyle = (key === 'A' ? SODIUM : CYAN) + '.85)';
    bc.setLineDash([4, 3]);
    bc.lineWidth = 1.5;
    bc.beginPath();
    bc.arc(cx, cy, site.radius * sx, 0, Math.PI * 2);
    bc.stroke();
    bc.setLineDash([]);
    bc.fillStyle = (key === 'A' ? SODIUM : CYAN) + '.9)';
    bc.font = '700 12px ui-monospace,Menlo,Consolas,monospace';
    bc.textAlign = 'center';
    bc.textBaseline = 'middle';
    bc.fillText(key, cx, cy);
  }
  bc.strokeStyle = 'rgba(232,226,212,.22)';
  bc.strokeRect(0.5, 0.5, W - 1, H - 1);

  let clock = 0;
  function update(dt) {
    clock -= dt;
    if (clock > 0) return;
    clock = 0.06;
    const P = state.player;
    const ax = px(P.x);
    const ay = pz(P.z);
    const ang = Math.atan2(-Math.cos(state.yaw), -Math.sin(state.yaw));
    ctx.clearRect(0, 0, W, H);
    ctx.drawImage(base, 0, 0, W, H);
    ctx.fillStyle = CYAN + '.16)';
    ctx.beginPath();
    ctx.moveTo(ax, ay);
    ctx.arc(ax, ay, 38, ang - 0.55, ang + 0.55);
    ctx.closePath();
    ctx.fill();
    ctx.save();
    ctx.translate(ax, ay);
    ctx.rotate(ang);
    ctx.fillStyle = '#8ff2ec';
    ctx.beginPath();
    ctx.moveTo(7, 0);
    ctx.lineTo(-4, 4);
    ctx.lineTo(-2, 0);
    ctx.lineTo(-4, -4);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
    for (const bot of bots.squad) {
      if (!bot.alive) continue;
      const dx = bot.x - P.x;
      const dz = bot.z - P.z;
      const d = Math.hypot(dx, dz);
      if (d > 34) continue;
      const seen = d < 1.2 || !map.blocked(P.x, 1.45, P.z, dx / d, 0, dz / d, d);
      const heard = state.time - (bot.lastHeardAt || -9) < 2.4;
      if (!seen && !heard) continue;
      ctx.beginPath();
      ctx.arc(px(bot.x), pz(bot.z), 2.6, 0, Math.PI * 2);
      if (seen) {
        ctx.fillStyle = DANGER + '.95)';
        ctx.fill();
      } else {
        ctx.strokeStyle = DANGER + '.7)';
        ctx.lineWidth = 1;
        ctx.stroke();
      }
    }
    const bomb = state.bomb;
    if (bomb && bomb.planted) {
      ctx.fillStyle = SODIUM + (bomb.fuse % 0.6 < 0.3 ? '.95)' : '.35)');
      ctx.fillRect(px(bomb.x) - 3, pz(bomb.z) - 3, 6, 6);
    }
  }
  return { update };
}
