// Shared maths and scratch storage. Nothing here allocates during a frame.
import * as THREE from 'three';

export const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);
export const lerp = (a, b, t) => a + (b - a) * t;
export const damp = (a, b, lambda, dt) => lerp(a, b, 1 - Math.exp(-lambda * dt));
export const sign = (v) => (v < 0 ? -1 : 1);

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

export const TAU = Math.PI * 2;

export function wrapAngle(a) {
  a = (a + Math.PI) % TAU;
  if (a < 0) a += TAU;
  return a - Math.PI;
}

export function angleDelta(from, to) {
  return wrapAngle(to - from);
}

export function dampAngle(from, to, lambda, dt) {
  return wrapAngle(from + angleDelta(from, to) * (1 - Math.exp(-lambda * dt)));
}

export function yawFromDirection(dx, dz) {
  return Math.atan2(-dx, -dz);
}

export function forwardFromAngles(yaw, pitch, target) {
  const cp = Math.cos(pitch);
  target.set(-Math.sin(yaw) * cp, Math.sin(pitch), -Math.cos(yaw) * cp);
  return target;
}

export function rightFromYaw(yaw, target) {
  target.set(Math.cos(yaw), 0, -Math.sin(yaw));
  return target;
}

export function formatClock(seconds) {
  const whole = Math.max(0, Math.ceil(seconds));
  const m = Math.floor(whole / 60);
  const s = whole % 60;
  return `${m}:${s < 10 ? '0' : ''}${s}`;
}

export function formatMoney(value) {
  return String(Math.max(0, Math.round(value))).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

// Slab ray test against an axis-aligned box. Returns the entry distance, or -1 for a miss.
export function rayAABB(ox, oy, oz, dx, dy, dz, min, max) {
  let tmin = -Infinity;
  let tmax = Infinity;
  let t1;
  let t2;

  if (Math.abs(dx) < 1e-8) {
    if (ox < min.x || ox > max.x) return -1;
  } else {
    t1 = (min.x - ox) / dx;
    t2 = (max.x - ox) / dx;
    if (t1 > t2) { const t = t1; t1 = t2; t2 = t; }
    if (t1 > tmin) tmin = t1;
    if (t2 < tmax) tmax = t2;
    if (tmin > tmax) return -1;
  }

  if (Math.abs(dy) < 1e-8) {
    if (oy < min.y || oy > max.y) return -1;
  } else {
    t1 = (min.y - oy) / dy;
    t2 = (max.y - oy) / dy;
    if (t1 > t2) { const t = t1; t1 = t2; t2 = t; }
    if (t1 > tmin) tmin = t1;
    if (t2 < tmax) tmax = t2;
    if (tmin > tmax) return -1;
  }

  if (Math.abs(dz) < 1e-8) {
    if (oz < min.z || oz > max.z) return -1;
  } else {
    t1 = (min.z - oz) / dz;
    t2 = (max.z - oz) / dz;
    if (t1 > t2) { const t = t1; t1 = t2; t2 = t; }
    if (t1 > tmin) tmin = t1;
    if (t2 < tmax) tmax = t2;
    if (tmin > tmax) return -1;
  }

  if (tmax < 0) return -1;
  return tmin >= 0 ? tmin : 0;
}

// Writes the outward face normal of a box at a surface point into target.
export function boxNormal(px, py, pz, min, max, target) {
  const toMinX = Math.abs(px - min.x);
  const toMaxX = Math.abs(max.x - px);
  const toMinY = Math.abs(py - min.y);
  const toMaxY = Math.abs(max.y - py);
  const toMinZ = Math.abs(pz - min.z);
  const toMaxZ = Math.abs(max.z - pz);
  const m = Math.min(toMinX, toMaxX, toMinY, toMaxY, toMinZ, toMaxZ);
  if (m === toMinX) target.set(-1, 0, 0);
  else if (m === toMaxX) target.set(1, 0, 0);
  else if (m === toMinY) target.set(0, -1, 0);
  else if (m === toMaxY) target.set(0, 1, 0);
  else if (m === toMinZ) target.set(0, 0, -1);
  else target.set(0, 0, 1);
  return target;
}

export const scratch = {
  a: new THREE.Vector3(),
  b: new THREE.Vector3(),
  c: new THREE.Vector3(),
  d: new THREE.Vector3(),
  origin: new THREE.Vector3(),
  dir: new THREE.Vector3(),
  right: new THREE.Vector3(),
  up: new THREE.Vector3(),
  normal: new THREE.Vector3(),
  muzzle: new THREE.Vector3(),
  hit: new THREE.Vector3(),
  quat: new THREE.Quaternion(),
  mat4: new THREE.Matrix4(),
  min: new THREE.Vector3(),
  max: new THREE.Vector3(),
  euler: new THREE.Euler(0, 0, 0, 'YXZ'),
};
