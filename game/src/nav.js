// Nav grid and A*. Typed arrays and fixed scratch storage mean a replan costs
// no garbage, and string-pulling removes the staircase look of 4-neighbour paths.
import { MAP } from './config.js';

const COLS = 60;
const ROWS = 44;
const CELL = 1;
const X0 = -30;
const Z0 = -22;
const SIZE = COLS * ROWS;
const EXPAND = 0.45;

export function createNav(map) {
  const blocked = new Uint8Array(SIZE);
  const g = new Float32Array(SIZE);
  const f = new Float32Array(SIZE);
  const came = new Int32Array(SIZE);
  const mark = new Uint8Array(SIZE);
  const heap = new Int32Array(SIZE + 1);
  let heapN = 0;
  let stamp = 1;

  for (let cz = 0; cz < ROWS; cz++) {
    for (let cx = 0; cx < COLS; cx++) {
      const x = X0 + cx + 0.5;
      const z = Z0 + cz + 0.5;
      let solid = false;
      for (const c of map.colliders) {
        if (c.miny > 1.65) continue;
        if (x > c.minx - EXPAND && x < c.maxx + EXPAND && z > c.minz - EXPAND && z < c.maxz + EXPAND) { solid = true; break; }
      }
      blocked[cz * COLS + cx] = solid ? 1 : 0;
    }
  }

  function cellOf(x, z) {
    const cx = Math.max(0, Math.min(COLS - 1, Math.floor(x - X0)));
    const cz = Math.max(0, Math.min(ROWS - 1, Math.floor(z - Z0)));
    return cz * COLS + cx;
  }

  function freeCell(x, z) {
    if (x < X0 || x > X0 + COLS || z < Z0 || z > Z0 + ROWS) return false;
    return blocked[cellOf(x, z)] === 0;
  }

  function nearest(cx, cz) {
    const start = cz * COLS + cx;
    if (!blocked[start]) return start;
    for (let r = 1; r <= 5; r++) {
      for (let dz = -r; dz <= r; dz++) {
        for (let dx = -r; dx <= r; dx++) {
          if (Math.abs(dx) !== r && Math.abs(dz) !== r) continue;
          const nx = cx + dx;
          const nz = cz + dz;
          if (nx < 0 || nx >= COLS || nz < 0 || nz >= ROWS) continue;
          const i = nz * COLS + nx;
          if (!blocked[i]) return i;
        }
      }
    }
    return start;
  }

  function heapPush(index) {
    let i = ++heapN;
    heap[i] = index;
    while (i > 1) {
      const parent = i >> 1;
      if (f[heap[parent]] <= f[heap[i]]) break;
      const tmp = heap[parent];
      heap[parent] = heap[i];
      heap[i] = tmp;
      i = parent;
    }
  }

  function heapPop() {
    const top = heap[1];
    heap[1] = heap[heapN--];
    let i = 1;
    for (;;) {
      const left = i << 1;
      const right = left + 1;
      let small = i;
      if (left <= heapN && f[heap[left]] < f[heap[small]]) small = left;
      if (right <= heapN && f[heap[right]] < f[heap[small]]) small = right;
      if (small === i) break;
      const tmp = heap[small];
      heap[small] = heap[i];
      heap[i] = tmp;
      i = small;
    }
    return top;
  }

  function lineFree(x0, z0, x1, z1) {
    const dx = x1 - x0;
    const dz = z1 - z0;
    const steps = Math.max(1, Math.ceil(Math.hypot(dx, dz) / 0.22));
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      if (!freeCell(x0 + dx * t, z0 + dz * t)) return false;
    }
    return true;
  }

  // out = { xs: Float32Array, zs: Float32Array, n }, owned by the caller.
  function findPath(sx, sz, tx, tz, out) {
    out.n = 0;
    const startCx = Math.max(0, Math.min(COLS - 1, Math.floor(sx - X0)));
    const startCz = Math.max(0, Math.min(ROWS - 1, Math.floor(sz - Z0)));
    const goalCx = Math.max(0, Math.min(COLS - 1, Math.floor(tx - X0)));
    const goalCz = Math.max(0, Math.min(ROWS - 1, Math.floor(tz - Z0)));
    const start = nearest(startCx, startCz);
    const goal = nearest(goalCx, goalCz);
    if (start === goal) {
      out.xs[0] = tx;
      out.zs[0] = tz;
      out.n = 1;
      return out;
    }
    stamp += 1;
    heapN = 0;
    g[start] = 0;
    f[start] = Math.abs((start % COLS) - (goal % COLS)) + Math.abs(Math.floor(start / COLS) - Math.floor(goal / COLS));
    mark[start] = stamp;
    came[start] = -1;
    heapPush(start);
    let found = false;
    while (heapN > 0) {
      const current = heapPop();
      if (current === goal) { found = true; break; }
      const cx = current % COLS;
      const cz = (current - cx) / COLS;
      for (let dir = 0; dir < 4; dir++) {
        const nx = cx + (dir === 0 ? 1 : dir === 1 ? -1 : 0);
        const nz = cz + (dir === 2 ? 1 : dir === 3 ? -1 : 0);
        if (nx < 0 || nx >= COLS || nz < 0 || nz >= ROWS) continue;
        const next = nz * COLS + nx;
        if (blocked[next]) continue;
        const ng = g[current] + 1;
        if (mark[next] === stamp && ng >= g[next]) continue;
        mark[next] = stamp;
        g[next] = ng;
        f[next] = ng + Math.abs(nx - (goal % COLS)) + Math.abs(nz - Math.floor(goal / COLS));
        came[next] = current;
        heapPush(next);
      }
    }
    if (!found) return out;

    let count = 0;
    let node = goal;
    while (node !== -1 && count < 256) {
      out.xs[count] = X0 + (node % COLS) + 0.5;
      out.zs[count] = Z0 + Math.floor(node / COLS) + 0.5;
      count += 1;
      node = came[node];
    }
    // Reversed chain: start is at count-1. Jump to the furthest cell whose
    // centre is still visible, which removes redundant stair-steps.
    let anchorX = sx;
    let anchorZ = sz;
    let write = 0;
    let i = count - 1;
    while (i >= 0 && write < out.xs.length) {
      let far = i;
      // Scan from the goal end so the first visible cell is the furthest one,
      // which is what makes the path string-pulled instead of grid-stepped.
      for (let j = 0; j < i; j++) {
        if (lineFree(anchorX, anchorZ, out.xs[j], out.zs[j])) {
          far = j;
          break;
        }
      }
      out.xs[write] = out.xs[far];
      out.zs[write] = out.zs[far];
      anchorX = out.xs[far];
      anchorZ = out.zs[far];
      write += 1;
      i = far - 1;
    }
    out.n = write;
    return out;
  }

  function holdReachable(x, z) { return freeCell(x, z); }

  return { blocked, cellOf, freeCell, findPath, holdReachable, cols: COLS, rows: ROWS };
}
