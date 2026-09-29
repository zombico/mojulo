// construction/instancing — identical parts drawn once and stamped: a frame's studs, joists and sheets as `repeats`
// (world-scene → scene-three lowers each to one InstancedMesh; `expandRepeats` flattens them for a renderer that
// cannot). A part is a face group; two parts are the same when every face matches but for where it stands, so the
// template is the first part's faces relative to its first corner and each copy is that corner. Translation only: a
// part turned is a different part (its light is baked), which keeps `expandRepeats` exact.

const q = (v) => Math.round(v * 1e5) / 1e5;

/**
 * instanceGroups(faces, { minCopies, eligible }) → { faces, repeats }: groups (by `f.group`) that occur at least
 * `minCopies` times become one repeat entry each; the rest stay faces, in their order. `eligible(group)` may exclude
 * a group (default: every group).
 */
export function instanceGroups(faces, { minCopies = 4, eligible = () => true, name = 'part' } = {}) {
  const byGroup = new Map();
  for (const f of faces) {
    if (f.group == null || !eligible(f.group)) continue;
    if (!byGroup.has(f.group)) byGroup.set(f.group, []);
    byGroup.get(f.group).push(f);
  }
  const sigs = new Map();                                              // signature → [{ group, anchor }]
  for (const [group, fs] of byGroup) {
    const o = fs[0].corners[0];
    const rel = fs.map((f) => {
      const { corners, group: _g, ...rest } = f;
      return [corners.map((c) => [q(c[0] - o[0]), q(c[1] - o[1]), q(c[2] - o[2])]), rest];
    });
    const sig = JSON.stringify(rel);
    if (!sigs.has(sig)) sigs.set(sig, { rel, list: [] });
    sigs.get(sig).list.push({ group, anchor: o });
  }
  const stamped = new Set();
  const repeats = [];
  for (const { rel, list } of sigs.values()) {
    if (list.length < minCopies) continue;
    for (const { group } of list) stamped.add(group);
    const tag = `${name}:${repeats.length}`;
    repeats.push({
      group: tag,
      template: rel.map(([corners, rest]) => ({ ...rest, corners, group: tag })),
      transforms: list.map(({ anchor }) => ({ pos: anchor.map((v) => q(v)) })),
      members: list.map(({ group }) => group),
    });
  }
  return { faces: faces.filter((f) => !stamped.has(f.group)), repeats };
}

/** Shift every copy of every repeat by `d` ([dx, dy, dz]) → new repeats. */
export const shiftRepeats = (repeats, d) => repeats.map((r) => ({ ...r, transforms: r.transforms.map((t) => ({ ...t, pos: [t.pos[0] + d[0], t.pos[1] + d[1], t.pos[2] + d[2]] })) }));
