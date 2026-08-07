/**
 * platform-field — the platformer LEVEL-GEOMETRY authoring helper (platformer.plan.md, P1).
 *
 * Every world generator in the substrate makes ARCHITECTURALLY CONNECTED space (cities, rooms,
 * dungeons). A platformer wants the opposite: DISCONNECTED islands with gaps you jump across, plus
 * moving platforms and hazard pads over a void. This is the one place that geometry is authored, so
 * the walkable tops and their matching lateral colliders can never drift apart (the fractal-city
 * precedent: colliders are emitted beside the faces, not bolted on later).
 *
 * `platformField(spec)` → `{ faces, colliders, entities, hazards, spawn, exit }` — the pieces to drop
 * into a `kind:'controllable'` world manifest beside the player entity + a `game:` channel:
 *   - `faces`      : a flat walkable top quad per STATIC island (group:'floor' → the down-raycast
 *                    grounds on it; the platform rule jumps between them).
 *   - `colliders`  : one analytic AABB per static island (the box UNDER the top) so you can't walk
 *                    through an island's side — the lateral-blocking half of the controller.
 *   - `entities`   : one `mover` CARRIER entity per moving platform (body.carrier + carryHalf), so a
 *                    grounded rider inherits its motion via the carry post-pass in controllable-world.
 *   - `hazards`    : zone specs to hand straight to the `hazard-damage` mechanic (the game channel).
 *   - `spawn`/`exit`: passed through for the player spawn + the `reach-exit` goal.
 *
 * Pure + deterministic (no dice). The moving-platform VISUAL (rendering the carrier's box as it
 * moves) is a renderer concern tracked in the plan; the carry MECHANIC it feeds is engine-tested.
 */

const asHalf = (size, def = 4) => {
  if (Array.isArray(size)) return [size[0] / 2, size[1] / 2];
  const s = Number.isFinite(size) ? size : def;
  return [s / 2, s / 2];
};

export function platformField(spec = {}) {
  const islands = Array.isArray(spec.islands) ? spec.islands : [];
  const movers = Array.isArray(spec.movers) ? spec.movers : [];
  const hazards = Array.isArray(spec.hazards) ? spec.hazards : [];
  const thickness = Number.isFinite(spec.thickness) ? spec.thickness : 1.5;
  const tint = spec.tint || '#8a9bb0';

  const faces = [];
  const colliders = [];
  const entities = [];

  islands.forEach((isl) => {
    if (!isl || !Array.isArray(isl.at)) throw new Error('platformField: each island needs an at:[x,y,z]');
    const [x, y, z] = isl.at;
    const [hx, hy] = asHalf(isl.size);
    // the walkable top (a flat quad at z) — the down-raycast lands here.
    faces.push({
      corners: [[x - hx, y - hy, z], [x + hx, y - hy, z], [x + hx, y + hy, z], [x - hx, y + hy, z]],
      fill: isl.tint || tint,
      group: 'floor',
    });
    // the solid box under the top (its sides block lateral movement).
    colliders.push({ min: [x - hx, y - hy, z - thickness], max: [x + hx, y + hy, z] });
  });

  movers.forEach((m, i) => {
    if (!m || !Array.isArray(m.from) || !Array.isArray(m.to)) throw new Error(`platformField: movers[${i}] needs from:[x,y,z] and to:[x,y,z]`);
    const [hx, hy] = asHalf(m.size);
    entities.push({
      id: m.id || `mover_${i}`,
      rule: { type: 'mover', from: m.from, to: m.to, period: m.period || 4, ...(m.phase ? { phase: m.phase } : {}) },
      // carrier body: type is REQUIRED (normalizeEntity drops a typeless body); carryHalf is the deck
      // footprint the carry post-pass tests against. w/d/thickness/tint describe the box for a renderer.
      body: { type: 'platform', carrier: true, carryHalf: [hx, hy], deck: 0, w: hx * 2, d: hy * 2, thickness, tint: m.tint || tint },
      transform: { pos: [...m.from] },
    });
  });

  const hazardZones = hazards.map((h) => ({
    at: h.at,
    ...(h.radius ? { radius: h.radius } : {}),
    ...(Number.isFinite(h.damage) ? { damage: h.damage } : {}),
  }));

  return {
    faces,
    colliders,
    entities,
    hazards: hazardZones,
    spawn: Array.isArray(spec.spawn) ? spec.spawn : null,
    exit: Array.isArray(spec.exit) ? spec.exit : null,
  };
}
