// Static design data: the palette is the contract for every material and CSS
// accent, so map, bots and HUD cannot drift into different night-harbour looks.
export const PALETTE = {
  night: 0x070d16,
  deep: 0x0e1722,
  concrete: 0x2b333b,
  steel: 0x4a5a66,
  rust: 0xb4552d,
  sodium: 0xffb15c,
  cyan: 0x5fd6d0,
  paper: 0xe8e2d4,
  danger: 0xe5483c,
};

export const ROUND = { buy: 12, live: 105, fuse: 40, end: 4, target: 5, plantTime: 3.2, defuseTime: 5 };
export const ECONOMY = { start: 1900, win: 3000, loss: 1900, kill: 300, plant: 300, cap: 9000, armor: 650, frag: 300, flash: 200 };
export const PLAYER = {
  stand: 1.72, crouch: 1.12, eyeStand: 1.6, eyeCrouch: 1.02,
  speed: 5.2, walk: 2.6, crouchSpeed: 2.4, accel: 42, friction: 9, air: 9,
  gravity: 20, jump: 6.2, half: 0.34, step: 0.45, skin: 0.04,
};

export const WEAPONS = {
  pistol: { id: 'pistol', name: 'MARLIN .45', slot: 1, price: 0, mag: 12, reserve: 48, body: 44, head: 2.1, legs: 0.8, gap: 0.16, spread: 0.006, move: 0.020, reload: 1.4, recoil: 0.010, auto: false, mode: 'SEMI', sound: 1.0 },
  smg: { id: 'smg', name: 'KESTREL SMG', slot: 2, price: 1250, mag: 30, reserve: 90, body: 25, head: 1.8, legs: 0.8, gap: 0.075, spread: 0.012, move: 0.030, reload: 1.8, recoil: 0.012, auto: true, mode: 'AUTO', sound: 1.15 },
  rifle: { id: 'rifle', name: 'LONGSHORE AR', slot: 2, price: 2700, mag: 30, reserve: 90, body: 34, head: 2.2, legs: 0.8, gap: 0.10, spread: 0.008, move: 0.032, reload: 2.0, recoil: 0.018, auto: true, mode: 'AUTO', sound: 0.9 },
  shotgun: { id: 'shotgun', name: 'BREAKWATER 12g', slot: 2, price: 1800, mag: 6, reserve: 24, body: 9, head: 1.5, legs: 0.8, gap: 0.85, spread: 0.055, move: 0.075, reload: 2.6, recoil: 0.025, auto: false, mode: 'PUMP', sound: 0.7, pellets: 9 },
};

export const BUY = [
  { id: 'rifle', name: 'LONGSHORE AR', price: 2700, role: '30 ROUNDS — HOLD LONG ANGLES', stats: [0.78, 0.62, 0.82] },
  { id: 'smg', name: 'KESTREL SMG', price: 1250, role: 'FAST — CLEAR THE TUNNEL', stats: [0.48, 0.92, 0.58] },
  { id: 'shotgun', name: 'BREAKWATER 12g', price: 1800, role: '9 PELLETS — SITE A CLOSE', stats: [0.95, 0.22, 0.4] },
  { id: 'armor', name: 'PLATE ARMOR', price: 650, role: 'SOAKS HALF OF EVERY HIT', stats: [0.7, 0.5, 0.6] },
  { id: 'frag', name: 'FRAG CHARGE', price: 300, role: '0.9 s FUSE — CLEARS COVER', stats: [0.9, 0.35, 0.3] },
  { id: 'flash', name: 'FLASH CHARGE', price: 200, role: 'BLINDS 2.5 s — PUSH IN', stats: [0.3, 0.55, 0.45] },
];

export const MAP = {
  minX: -32, maxX: 32, minZ: -24, maxZ: 24,
  playerSpawn: { x: 0, z: 20 },
  botSpawn: { x: 0, z: -20 },
  sites: { A: { x: -16, z: -10, radius: 6 }, B: { x: 16, z: -10, radius: 6 } },
};
