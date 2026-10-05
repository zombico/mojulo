// Isolated granular occupancy approximation. Same closure runs in Node and the preview.
// Grain physics is integer fixed-point (FP = 1/256 cell) so replays are exact on any host.
//   gravity      cells/tick²; falling grains accelerate to `terminal` cells/tick.
//   friction     dynamic Coulomb μ. Work–energy: a sliding grain gains 1 cell of energy per cell dropped and
//                pays μ per cell travelled horizontally (friction work is μ·m·g·Δx on any incline), so a flow
//                stops on slopes shallower than atan(μ).
//   staticFriction  μs ≥ μ. A resting grain yields when the surface ahead falls away steeper than atan(μs).
//                Two angles give hysteresis: heaps build near atan(μs) and avalanche down toward atan(μ).
//   restitution  fraction of fall energy a landing grain keeps as slide energy; sand impacts are very inelastic.
export function buildSand({
  width = 180, height = 120, seed = 1003,
  gravity = 0.25, terminal = 6, friction = 0.58, staticFriction = 0.67, restitution = 0.05,
} = {}) {
  if (![width, height].every(n => Number.isInteger(n) && n >= 4 && n <= 512) || !Number.isInteger(seed)) {
    throw Error('width/height must be integers in [4,512]; seed must be an integer');
  }
  if (!(gravity > 0 && gravity <= 1) || !(Number.isInteger(terminal) && terminal >= 1 && terminal <= 16)
    || !(restitution >= 0 && restitution <= 1)) {
    throw Error('gravity in (0,1], terminal an integer in [1,16], restitution in [0,1]');
  }
  const FP = 256, PROBE = 8;
  const G = Math.round(gravity * FP), VMAX = terminal * FP, REST = Math.round(restitution * FP);
  let MU = 0, MUS = 0, AIR = 0, REACH = 1;
  function tune({ friction: mu = MU / FP, staticFriction: mus = MUS / FP } = {}) {
    if (!(mu >= 0.1 && mu <= 1.5) || !(mus >= mu && mus <= 2)) throw Error('friction in [0.1,1.5]; staticFriction in [friction,2]');
    MU = Math.round(mu * FP); MUS = Math.round(mus * FP); AIR = MU >> 3;
    REACH = Math.max(1, Math.floor(MUS * PROBE / FP));   // deepest drop the static probe reads
    for (let i = 0; i < cells.length; i++) if (cells[i] === 1) enqueue(i);   // existing slopes re-test the new friction
  }
  const cells = new Uint8Array(width * height); // 0 air, 1 sand, 2 terrain
  // Per-cell grain state; it travels with the grain and is zero for air, terrain and sleeping sand.
  const fall = new Int32Array(width * height);     // downward speed, FP cells/tick
  const sub = new Int32Array(width * height);      // sub-cell fall remainder, FP
  const energy = new Int32Array(width * height);   // slide energy, FP cells of height
  const dir = new Int8Array(width * height);       // slide direction −1, 0, +1
  const movedAt = new Uint32Array(width * height); // tick stamp: a grain moves at most once per tick
  const queued = new Uint32Array(width * height);  // tick stamp: queued for the next tick at most once
  let active = [], tick = 0, grainCount = 0, rngState = seed >>> 0;
  // mulberry32: seeded choices only, and no dependence on rendering rate.
  function random() {
    let t = rngState += 0x6D2B79F5;
    t = Math.imul(t ^ t >>> 15, t | 1);
    t ^= t + Math.imul(t ^ t >>> 7, t | 61);
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  }
  const inside = (x, y) => Number.isInteger(x) && Number.isInteger(y) && x >= 0 && x < width && y >= 0 && y < height;
  const index = (x, y) => y * width + x;
  const free = (x, y) => x >= 0 && x < width && y >= 0 && y < height && cells[y * width + x] === 0;
  function clear(i) { fall[i] = sub[i] = energy[i] = dir[i] = 0; }
  function enqueue(i) { if (queued[i] !== tick + 1) { queued[i] = tick + 1; active.push(i); } }
  function wake(x, y) {
    for (let ny = Math.max(0, y - 1), y1 = Math.min(height - 1, y + 1); ny <= y1; ny++) {
      for (let nx = Math.max(0, x - 1), x1 = Math.min(width - 1, x + 1); nx <= x1; nx++) {
        if (cells[ny * width + nx] === 1) enqueue(ny * width + nx);
      }
    }
  }
  // A vacated cell can destabilise every grain whose rule reads it: the 3×3 above (falls, diagonals) and the
  // static probe's footprint (PROBE cells either side, REACH rows up). Sleep stays sound only if all of them wake;
  // with the 3×3 alone, a grain that probed past a passing grain sleeps forever on an over-steep slope.
  // Filling a cell only adds support, so arrivals keep the 3×3. Beyond the 3×3 only a grain with an open side
  // can yield, so buried grains stay asleep.
  function wakeReaders(x, y) {
    wake(x, y);
    const x0 = Math.max(0, x - PROBE), x1 = Math.min(width - 1, x + PROBE);
    for (let ny = Math.max(0, y - REACH); ny <= y; ny++) {
      const row = ny * width;
      for (let nx = x0; nx <= x1; nx++) {
        const j = row + nx;
        if (cells[j] === 1 && ((nx > 0 && cells[j - 1] === 0) || (nx < width - 1 && cells[j + 1] === 0))) enqueue(j);
      }
    }
  }
  function set(x, y, kind) {
    if (!inside(x, y) || ![0, 1, 2].includes(kind)) return false;
    const i = index(x, y), previous = cells[i];
    if (previous === kind) return false;
    // Placing terrain never silently destroys sand; explicit erasure is allowed.
    if (kind === 2 && previous === 1) return false;
    if (kind === 1 && previous !== 0) return false;
    grainCount += (kind === 1 ? 1 : 0) - (previous === 1 ? 1 : 0);
    cells[i] = kind;
    clear(i);
    wake(x, y);
    if (kind === 0) wakeReaders(x, y);
    return true;
  }
  function brush(x, y, radius, kind) {
    if (!inside(x, y) || !Number.isInteger(radius) || radius < 0 || radius > 32) return 0;
    let changed = 0;
    for (let dy = -radius; dy <= radius; dy++) for (let dx = -radius; dx <= radius; dx++) {
      if (dx * dx + dy * dy <= radius * radius && set(x + dx, y + dy, kind)) changed++;
    }
    return changed;
  }
  function move(i, j) {
    cells[j] = 1; fall[j] = fall[i]; sub[j] = sub[i]; energy[j] = energy[i]; dir[j] = dir[i]; movedAt[j] = tick;
    cells[i] = 0; clear(i);
  }
  // Static friction: walk the clear row ahead as far as PROBE cells, then yield if the surface falls from this
  // grain's top to the column k cells away more steeply than μs: (drop + 1) / k > μs, drop ≥ 1 so a lone grain
  // on flat ground never creeps. The baseline must be long: a grid surface steeper than ½ is a mix of 1- and
  // 2-cell steps, and a one-step probe reads every grain on a 2-cell terrace as a 45° bump and flattens all heaps
  // to slope ½.
  function yields(x, y, s) {
    let k = 0;
    while (k < PROBE && free(x + s * (k + 1), y)) k++;
    if (k < 2) return false;
    const need = Math.max(1, Math.floor(MUS * k / FP)), cx = x + s * k;
    let drop = 0;
    while (drop < need && free(cx, y + drop + 1)) drop++;
    return drop === need;
  }
  function sides(i) {
    if (dir[i]) return [dir[i], -dir[i]];
    return random() < 0.5 ? [-1, 1] : [1, -1];
  }
  function step() {
    tick++;
    if (!active.length) return { tick, moved: 0, checked: 0, active: 0, grains: grainCount };
    // Bottom-up: falls and diagonals land in rows already processed this tick. Rows alternate direction per tick.
    // Integer sort keys (bottom row first, then column in this tick's direction) keep the order exact and cheap.
    const keys = Int32Array.from(active, i => {
      const row = (i / width) | 0, col = i - row * width;
      return (height - 1 - row) * width + (tick % 2 ? col : width - 1 - col);
    }).sort();
    active = [];
    let moved = 0, checked = 0;
    for (const key of keys) {
      const row = height - 1 - ((key / width) | 0), c = key % width;
      const i = row * width + (tick % 2 ? c : width - 1 - c);
      if (cells[i] !== 1 || movedAt[i] === tick) continue;
      checked++;
      const x = i % width, y = Math.floor(i / width);
      let at = i, cx = x, cy = y, busy = false;
      if (free(x, y + 1)) {
        // Airborne: semi-implicit Euler, then march cell by cell so a fast grain never skips a support.
        fall[i] = Math.min(fall[i] + G, VMAX);
        sub[i] += fall[i];
        let n = sub[i] >> 8;
        sub[i] &= FP - 1;
        while (n > 0 && free(cx, cy + 1)) { cy++; n--; }
        if (n > 0) {
          const below = index(cx, cy + 1);
          if (cells[below] === 1 && fall[below] > 0) {
            fall[i] = Math.min(fall[i], fall[below]); // queue behind a slower falling grain
          } else {
            // Inelastic landing: h = v²/2g cells of fall energy, keep `restitution` of it as slide energy.
            energy[i] += Math.floor(REST * fall[i] * fall[i] / (2 * G * FP));
            fall[i] = 0; sub[i] = 0;
          }
        }
        // Momentum carried off a ledge keeps travelling sideways, lightly damped by air.
        if (energy[i] > 0 && dir[i]) {
          if (free(x + dir[i], cy)) { cx += dir[i]; energy[i] = Math.max(0, energy[i] - AIR); }
          else { energy[i] = 0; dir[i] = 0; }     // struck a wall mid-air
        }
        busy = true;
      } else {
        fall[i] = 0; sub[i] = 0;
        let diag = 0;
        for (const s of sides(i)) {
          // Terrain corners block diagonal tunnelling.
          if (free(x + s, y + 1) && cells[index(x + s, y)] !== 2) { diag = s; break; }
        }
        if (diag) {
          // Down one, across one: +1 cell of height, −μ for the horizontal cell.
          energy[i] = Math.max(0, energy[i] + FP - MU); dir[i] = diag;
          cx = x + diag; cy = y + 1; busy = true;
        } else {
          if (energy[i] >= MU && !dir[i]) {
            const [a, b] = sides(i);
            dir[i] = free(x + a, y) ? a : free(x + b, y) ? b : 0;
          }
          if (energy[i] >= MU && dir[i] && free(x + dir[i], y)) {
            energy[i] -= MU; cx = x + dir[i]; busy = true;
          } else {
            energy[i] = 0;
            const order = sides(i);
            const s = yields(x, y, order[0]) ? order[0] : yields(x, y, order[1]) ? order[1] : 0;
            if (s) { dir[i] = s; cx = x + s; busy = true; }   // over-steep surface: creep toward the drop
            else dir[i] = 0;                                  // asleep until a support change wakes it
          }
        }
      }
      if (cx !== x || cy !== y) {
        at = index(cx, cy);
        move(i, at);
        moved++;
        wakeReaders(x, y);
        wake(cx, cy);
      }
      if (busy) enqueue(at);
    }
    return { tick, moved, checked, active: active.length, grains: grainCount };
  }
  function snapshot() {
    return { width, height, tick, grains: grainCount, active: active.length, cells: Array.from(cells) };
  }
  tune({ friction, staticFriction });
  // For render consumers only; mutations must use set/brush so wakeups and mass stay correct.
  return { width, height, cells, set, brush, step, tune, snapshot, stats: () => ({ tick, grains: grainCount, active: active.length }) };
}
