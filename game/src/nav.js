// 1 m navigation grid over the walkable floor. All scratch memory is module
// scoped; findPath only writes into the caller's reusable flat out array.
import { MAP } from './config.js';
import { clamp } from './util.js';

const W = MAP.navMaxX - MAP.navMinX + 1;
const H = MAP.navMaxZ - MAP.navMinZ + 1;
const CELLS = W * H;
const blocked = new Uint8Array(CELLS);
const gScore = new Float32Array(CELLS);
const came = new Int32Array(CELLS);
const closed = new Uint8Array(CELLS);
const heapIndex = new Int32Array(CELLS * 2);
const heapScore = new Float32Array(CELLS * 2);
const raw = new Int32Array(CELLS);
let heapSize = 0;

export function createNav(state) {
  blocked.fill(0);
  for (let iz = 0; iz < H; iz += 1) {
    const z = MAP.navMinZ + iz;
    for (let ix = 0; ix < W; ix += 1) {
      const x = MAP.navMinX + ix;
      const id = iz * W + ix;
      let hit = false;
      for (let c = 0; c < state.colliders.length; c += 1) {
        const box = state.colliders[c];
        if (
          x > box.minX - 0.45 &&
          x < box.maxX + 0.45 &&
          z > box.minZ - 0.45 &&
          z < box.maxZ + 0.45 &&
          box.minY < 1.45 &&
          box.maxY > 0.35
        ) {
          hit = true;
          break;
        }
      }
      blocked[id] = hit ? 1 : 0;
    }
  }

  const idOf = (x, z) => {
    const ix = clamp(Math.round(x - MAP.navMinX), 0, W - 1);
    const iz = clamp(Math.round(z - MAP.navMinZ), 0, H - 1);
    return iz * W + ix;
  };
  const openCell = (x, z) => {
    const id = idOf(x, z);
    return blocked[id] === 0 ? id : -1;
  };
  const openNear = (x, z) => {
    let id = openCell(x, z);
    if (id >= 0) return id;
    const cx = clamp(Math.round(x - MAP.navMinX), 0, W - 1);
    const cz = clamp(Math.round(z - MAP.navMinZ), 0, H - 1);
    for (let r = 1; r <= 8; r += 1) {
      for (let dz = -r; dz <= r; dz += 1) {
        for (let dx = -r; dx <= r; dx += 1) {
          if (Math.abs(dx) !== r && Math.abs(dz) !== r) continue;
          const nx = cx + dx;
          const nz = cz + dz;
          if (nx < 0 || nz < 0 || nx >= W || nz >= H) continue;
          id = nz * W + nx;
          if (!blocked[id]) return id;
        }
      }
    }
    return -1;
  };

  const heapPush = (id, score) => {
    let i = heapSize;
    heapSize += 1;
    heapIndex[i] = id;
    heapScore[i] = score;
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (heapScore[p] <= heapScore[i]) break;
      const ti = heapIndex[p];
      const ts = heapScore[p];
      heapIndex[p] = heapIndex[i];
      heapScore[p] = heapScore[i];
      heapIndex[i] = ti;
      heapScore[i] = ts;
      i = p;
    }
  };
  const heapPop = () => {
    const top = heapIndex[0];
    heapSize -= 1;
    if (heapSize > 0) {
      heapIndex[0] = heapIndex[heapSize];
      heapScore[0] = heapScore[heapSize];
      let i = 0;
      for (;;) {
        const l = i * 2 + 1;
        const r = l + 1;
        let best = i;
        if (l < heapSize && heapScore[l] < heapScore[best]) best = l;
        if (r < heapSize && heapScore[r] < heapScore[best]) best = r;
        if (best === i) break;
        const ti = heapIndex[best];
        const ts = heapScore[best];
        heapIndex[best] = heapIndex[i];
        heapScore[best] = heapScore[i];
        heapIndex[i] = ti;
        heapScore[i] = ts;
        i = best;
      }
    }
    return top;
  };

  const lineClear = (ax, az, bx, bz) => {
    const dx = bx - ax;
    const dz = bz - az;
    const steps = Math.max(1, Math.ceil(Math.hypot(dx, dz) / 0.28));
    for (let i = 0; i <= steps; i += 1) {
      const t = i / steps;
      const id = idOf(ax + dx * t, az + dz * t);
      if (blocked[id]) return false;
    }
    return true;
  };

  const findPath = (sx, sz, gx, gz, out) => {
    out.length = 0;
    const start = openNear(sx, sz);
    const goal = openNear(gx, gz);
    if (start < 0 || goal < 0) return out;
    heapSize = 0;
    for (let i = 0; i < CELLS; i += 1) {
      gScore[i] = Infinity;
      came[i] = -1;
      closed[i] = 0;
    }
    gScore[start] = 0;
    heapPush(start, 0);
    let guard = 0;
    while (heapSize > 0 && guard < CELLS * 2) {
      guard += 1;
      const id = heapPop();
      if (closed[id]) continue;
      closed[id] = 1;
      if (id === goal) break;
      const ix = id % W;
      const iz = (id / W) | 0;
      for (let n = 0; n < 4; n += 1) {
        const nx = ix + (n === 0 ? 1 : n === 1 ? -1 : 0);
        const nz = iz + (n === 2 ? 1 : n === 3 ? -1 : 0);
        if (nx < 0 || nz < 0 || nx >= W || nz >= H) continue;
        const nid = nz * W + nx;
        if (blocked[nid] || closed[nid]) continue;
        const tentative = gScore[id] + 1;
        if (tentative >= gScore[nid]) continue;
        gScore[nid] = tentative;
        came[nid] = id;
        const h = Math.abs(nx - (goal % W)) + Math.abs(nz - ((goal / W) | 0));
        heapPush(nid, tentative + h);
      }
    }
    if (came[goal] < 0 && goal !== start) return out;
    let count = 0;
    let cursor = goal;
    while (cursor >= 0 && count < CELLS) {
      raw[count] = cursor;
      count += 1;
      if (cursor === start) break;
      cursor = came[cursor];
    }
    if (raw[count - 1] !== start) return out;
    for (let i = 0; i < (count >> 1); i += 1) {
      const tmp = raw[i];
      raw[i] = raw[count - 1 - i];
      raw[count - 1 - i] = tmp;
    }
    let current = 0;
    while (current < count - 1) {
      const cx = raw[current] % W;
      const cz = (raw[current] / W) | 0;
      let next = current + 1;
      for (let j = count - 1; j > current + 1; j -= 1) {
        const jx = raw[j] % W;
        const jz = (raw[j] / W) | 0;
        if (lineClear(MAP.navMinX + cx, MAP.navMinZ + cz, MAP.navMinX + jx, MAP.navMinZ + jz)) {
          next = j;
          break;
        }
      }
      const id = raw[next];
      out.push(MAP.navMinX + (id % W), MAP.navMinZ + ((id / W) | 0));
      current = next;
    }
    return out;
  };

  return { W, H, findPath, lineClear, blocked };
}
