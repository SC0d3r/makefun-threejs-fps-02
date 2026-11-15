// Pure helpers plus the one AABB ray test shared by bullets, bot vision,
// grenade line of sight and defuse interruption. All numbers, no allocation.
const TAU = Math.PI * 2;

export function clamp(v, lo, hi) { return v < lo ? lo : v > hi ? hi : v; }
export function lerp(a, b, t) { return a + (b - a) * t; }
export function damp(a, b, rate, dt) { return lerp(a, b, 1 - Math.exp(-rate * dt)); }

export function mulberry32(seed) {
  let a = seed >>> 0;
  return function random() {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}


// Slab test. Returns the entry distance or Infinity. Boxes are axis aligned and
// use minx/miny/minz/maxx/maxy/maxz so both map colliders and bot parts share it.
export function rayAABB(ox, oy, oz, dx, dy, dz, box) {
  let tmin = 0;
  let tmax = 1e9;
  if (Math.abs(dx) < 1e-8) {
    if (ox < box.minx || ox > box.maxx) return Infinity;
  } else {
    const inv = 1 / dx;
    let t1 = (box.minx - ox) * inv;
    let t2 = (box.maxx - ox) * inv;
    if (t1 > t2) { const s = t1; t1 = t2; t2 = s; }
    if (t1 > tmin) tmin = t1;
    if (t2 < tmax) tmax = t2;
    if (tmin > tmax) return Infinity;
  }
  if (Math.abs(dy) < 1e-8) {
    if (oy < box.miny || oy > box.maxy) return Infinity;
  } else {
    const inv = 1 / dy;
    let t1 = (box.miny - oy) * inv;
    let t2 = (box.maxy - oy) * inv;
    if (t1 > t2) { const s = t1; t1 = t2; t2 = s; }
    if (t1 > tmin) tmin = t1;
    if (t2 < tmax) tmax = t2;
    if (tmin > tmax) return Infinity;
  }
  if (Math.abs(dz) < 1e-8) {
    if (oz < box.minz || oz > box.maxz) return Infinity;
  } else {
    const inv = 1 / dz;
    let t1 = (box.minz - oz) * inv;
    let t2 = (box.maxz - oz) * inv;
    if (t1 > t2) { const s = t1; t1 = t2; t2 = s; }
    if (t1 > tmin) tmin = t1;
    if (t2 < tmax) tmax = t2;
    if (tmin > tmax) return Infinity;
  }
  return tmin;
}

export function fmtTime(seconds) {
  const s = Math.max(0, Math.ceil(seconds));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

export function fmtClock(seconds) {
  const s = Math.max(0, Math.ceil(seconds));
  return `00:${String(s).padStart(2, '0')}`;
}

export function fmtMoney(value) {
  return `$ ${Math.round(value).toLocaleString('en-US')}`;
}

export function angleDelta(a, b) {
  let d = (b - a) % TAU;
  if (d > Math.PI) d -= TAU;
  if (d < -Math.PI) d += TAU;
  return d;
}
