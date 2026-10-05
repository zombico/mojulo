// Quasi-static granular mass layer over wave-field terrain. Not a volumetric solver.
export function buildWaveSand({ n = 33, spacing = 0.375, grainHeight = 0.025, repose = 0.6, ground } = {}) {
  if (!Number.isInteger(n) || n < 3 || n > 129 || ![spacing, grainHeight, repose].every(v => Number.isFinite(v) && v > 0)) throw Error('invalid layer dimensions or parameters');
  let terrain = new Float64Array(n * n), active = new Set(), tick = 0, total = 0;
  const mass = new Uint32Array(n * n);
  function neighbors(i) {
    const x = i % n, y = Math.floor(i / n), out = [];
    if (x > 0) out.push(i - 1); if (x < n - 1) out.push(i + 1);
    if (y > 0) out.push(i - n); if (y < n - 1) out.push(i + n);
    return out;
  }
  function wake(i) { active.add(i); for (const j of neighbors(i)) active.add(j); }
  function setGround(values) {
    if (!values || values.length !== n * n || !Array.from(values).every(Number.isFinite)) throw Error('finite ground samples required');
    terrain = Float64Array.from(values);
    for (let i = 0; i < mass.length; i++) if (mass[i]) wake(i);
  }
  function deposit(x, y, count = 1) {
    if (![x, y, count].every(Number.isInteger) || x < 0 || y < 0 || x >= n || y >= n || count < 1) return false;
    const i = y * n + x;
    if (mass[i] + count > 0xffffffff || !Number.isSafeInteger(total + count)) throw Error('mass limit exceeded');
    mass[i] += count; total += count; wake(i); return true;
  }
  const top = i => terrain[i] + mass[i] * grainHeight;
  function step() {
    tick++;
    const pending = [...active].sort((a,b) => tick % 2 ? a-b : b-a);
    active = new Set(); let checked = 0, moved = 0;
    for (const i of pending) {
      if (!mass[i]) continue;
      checked++;
      let target = -1, drop = repose * spacing + grainHeight;
      // Alternate tied directions to avoid one permanent preferred direction.
      const next = neighbors(i); if (tick % 2) next.reverse();
      for (const j of next) { const d = top(i) - top(j); if (d > drop + 1e-10) { drop = d; target = j; } }
      if (target < 0) continue;
      const amount = Math.min(mass[i], Math.max(1, Math.floor((drop - repose * spacing) / (2 * grainHeight))));
      if (mass[target] + amount > 0xffffffff) throw Error('mass limit exceeded');
      mass[i] -= amount; mass[target] += amount; moved += amount;
      wake(i); wake(target);
    }
    return { tick, checked, moved, active: active.size, total };
  }
  function snapshot() { return { n, spacing, grainHeight, repose, tick, total, active: active.size, ground: Array.from(terrain), mass: Array.from(mass), top: Array.from(mass, (_,i) => top(i)) }; }
  if (ground) setGround(ground);
  return { n, spacing, grainHeight, repose, mass, deposit, setGround, step, snapshot, ground: () => terrain, stats: () => ({ tick, total, active: active.size }) };
}
