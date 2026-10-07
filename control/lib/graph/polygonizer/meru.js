/**
 * THE MERU — the shared vertical ruler. Every picture in the polygonizer is a MANDALA (a top-down plan, x and y)
 * with a meru through it (z): the two-point camera (pure-mandala.js `projectTwoPoint`) lays the plan on its floor
 * grid and adds height along one fixed axis, so verticals never converge, and the meru owns the world unit every
 * mandala shares. Here it is the datum heights plug into, apart from any one builder:
 *
 *   meruStack(o)     storeys stacked along the axis: ground at `groundZ`, index up positive and down negative, each
 *                    level its own height, a slab (`floorDrop`) between. A house, a subway hall and a stage's floors
 *                    stack on it (floorplan-structure.js `houseMeru` is this over the floorplan defaults).
 *   meruMarks(marks) named heights on one axis (a tower's base, deck, rail, eave, apex; a mound's landings and
 *                    summit), checked in order, as the landmarks are drawn (landmarks/index.js `meru` tables).
 *
 * Pure numbers; nothing here builds a face.
 */

/** Conventional level roles → meru index (ground=0, up positive, down negative). */
export const LEVEL_ROLES = { basement: -1, ground: 0, second: 1, third: 2, upper: 1 };

export const levelIndex = (lvl) => (Number.isFinite(lvl.index) ? lvl.index
  : (LEVEL_ROLES[lvl.role] ?? 0));

/**
 * A storey stack. Storeys need not share one pitch — each level carries its own height (a basement runs lower than
 * the main floor), so floor heights accumulate. `baseZ(index)` is the uniform shorthand; `resolveStack(levels)` does
 * the real per-level stacking.
 */
export function meruStack({ groundZ = 0, floorDrop, wallHeight, basementHeight, upperHeight, unitScale, footprint = null } = {}) {
  const mainHeight = wallHeight;
  const below = basementHeight ?? mainHeight;
  const above = upperHeight ?? mainHeight;
  const heightFor = (index) => (index < 0 ? below : index > 0 ? above : mainHeight);
  return {
    groundZ, floorDrop, wallHeight: mainHeight, basementHeight: below, upperHeight: above,
    storeyPitch: mainHeight + floorDrop,
    unitScale,
    footprint,
    heightFor,
    /** uniform shorthand: meru index → floor z assuming equal storeys. */
    baseZ(index) { return groundZ + index * (mainHeight + floorDrop); },
    /**
     * Resolve real floor heights for a set of levels. Ground (index 0) sits at groundZ; each level above starts on
     * the one below's ceiling + slab, each below hangs its ceiling under the floor above. Returns levels sorted with
     * { index, height, floorZ }.
     */
    resolveStack(levels) {
      const items = levels.map((l) => ({ ...l, index: levelIndex(l), height: l.height ?? heightFor(levelIndex(l)) }));
      const indices = items.map((it) => it.index);
      const lo = Math.min(0, ...indices), hi = Math.max(0, ...indices);
      const heightAt = (i) => { const it = items.find((x) => x.index === i); return it ? it.height : heightFor(i); };
      const floorZ = { 0: groundZ };
      for (let i = 1; i <= hi; i += 1) floorZ[i] = floorZ[i - 1] + heightAt(i - 1) + floorDrop;
      for (let i = -1; i >= lo; i -= 1) floorZ[i] = floorZ[i + 1] - floorDrop - heightAt(i);
      return items.sort((a, b) => a.index - b.index).map((it) => ({ ...it, floorZ: floorZ[it.index] }));
    },
  };
}

/**
 * Named heights on one axis, in the order given (lowest first). Two marks may share a height (a summit is where a
 * tower stands); a mark below the one before it is refused with both names. Returns { stack: [{ name, z }], z(name),
 * top, base } — `z` throws on a name the axis does not carry.
 */
export function meruMarks(marks) {
  const stack = (Array.isArray(marks) ? marks : Object.entries(marks).map(([name, z]) => ({ name, z })))
    .map(({ name, z }) => ({ name: String(name), z }));
  if (!stack.length) throw new Error('meru: an axis needs at least one mark');
  const seen = new Set();
  stack.forEach((m, i) => {
    if (!Number.isFinite(m.z)) throw new Error(`meru: mark '${m.name}' needs a height in metres`);
    if (seen.has(m.name)) throw new Error(`meru: mark '${m.name}' is named twice`);
    seen.add(m.name);
    if (i && m.z < stack[i - 1].z - 1e-9) throw new Error(`meru: mark '${m.name}' (${m.z} m) stands below '${stack[i - 1].name}' (${stack[i - 1].z} m): marks run up the axis`);
  });
  const byName = new Map(stack.map((m) => [m.name, m.z]));
  return {
    stack,
    base: stack[0].z,
    top: stack[stack.length - 1].z,
    z(name) {
      if (!byName.has(name)) throw new Error(`meru: no mark '${name}' (marks: ${stack.map((m) => m.name).join(', ')})`);
      return byName.get(name);
    },
  };
}
