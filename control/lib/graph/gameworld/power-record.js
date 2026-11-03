/**
 * The powers a level's holder carries, read back as data from the level's own recipe, for a reader that does not run
 * the page's cues: the engine handoff's level record, where a developer wires the powers in their engine.
 *
 * mechanics.js writes a power as a key (`events.inputs`: `{ on: 'key', key, emit: { type: 'power-<id>' } }`) and its
 * cue (`play.cues`: `power-<id>`, gated by `if` on its node and its spend, refused by `else`; its spend a `grant`, its
 * look a `status`, its attack a `beam`); levels.js writes its move in `game.powers` (granted from the held slice, a
 * pickup, or the stats). This reads those back. It imports nothing, so any reader of a manifest can take it.
 *
 *   powerRecord(manifest) → [{
 *     id, key, holder,
 *     gained:  { at: 'start' } | { at: 'stats', var: '<holder>.<id>', gte },
 *     spends?: { <resource>: n },  refusal?: '<the toast>',  look?: '<look>',
 *     attack?: { is, from, at: 'nearest-foe', range, cone, hurt } | { is, from, to, hurt? },
 *     move?:   { grants: { <rule knob>: value }, on: ['held' | 'pickup' | 'stats'] },
 *   }]
 *
 * A power gained at the start whose move is in the holder's own rule from the first level (levels.js startingGrants)
 * has no `move` here: that move is the pilot's rule itself.
 */

const PREFIX = 'power-';

export function powerRecord(manifest) {
  const M = manifest && typeof manifest === 'object' ? manifest : {};
  const inputs = Array.isArray(M.events?.inputs) ? M.events.inputs : [];
  const cues = Array.isArray(M.play?.cues) ? M.play.cues : [];
  const P = M.game?.powers && typeof M.game.powers === 'object' ? M.game.powers : null;
  const keyOf = new Map();
  for (const i of inputs) if (i?.on === 'key' && typeof i.emit?.type === 'string' && i.emit.type.startsWith(PREFIX)) keyOf.set(i.emit.type.slice(PREFIX.length), i.key);
  const on = P ? [...(P.slice ? ['held', 'pickup'] : []), ...(P.bought ? ['stats'] : [])] : [];
  const rows = [];
  for (const c of cues) {
    if (!c || typeof c.id !== 'string' || !c.id.startsWith(PREFIX) || c.when?.on !== c.id) continue;
    const id = c.id.slice(PREFIX.length);
    const then = (Array.isArray(c.then) ? c.then : [c.then]).filter(Boolean);
    const ifs = (Array.isArray(c.if) ? c.if : c.if ? [c.if] : []).filter((x) => x && typeof x.var === 'string');
    const beam = then.find((t) => t.beam)?.beam ?? null, status = then.find((t) => t.status)?.status ?? null;
    const grant = then.find((t) => t.grant && Number(t.grant.by) < 0)?.grant ?? null;
    const holder = beam?.who ?? status?.who ?? P?.bought ?? (ifs[0] ? ifs[0].var.split('.')[0] : null);
    const node = ifs.find((x) => x.var === `${holder}.${id}`);
    const nearest = beam && beam.to && typeof beam.to === 'object' && beam.to.nearest ? beam.to.nearest : null;
    rows.push({
      id, key: keyOf.get(id) ?? null, holder,
      gained: node ? { at: 'stats', var: node.var, gte: node.gte } : { at: 'start' },
      ...(grant ? { spends: { [grant.res]: -grant.by } } : {}),
      ...(typeof c.else?.say === 'string' ? { refusal: c.else.say } : {}),
      ...(status?.look ? { look: status.look } : {}),
      ...(beam ? { attack: nearest
        ? { is: beam.is ?? null, from: beam.who, at: 'nearest-foe', range: nearest.range ?? null, cone: nearest.cone ?? null, ...(beam.hurt !== undefined ? { hurt: beam.hurt } : {}) }
        : { is: beam.is ?? null, from: beam.who, to: beam.to ?? null, ...(beam.hurt !== undefined ? { hurt: beam.hurt } : {}) } } : {}),
      ...(P?.grants?.[id] ? { move: { grants: { ...P.grants[id] }, on } } : {}),
    });
  }
  return rows;
}
