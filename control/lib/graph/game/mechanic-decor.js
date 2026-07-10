/**
 * mechanic-decor — the U5 PAYOFF (game-ui-language.plan.md): default UI-language decoration lowered
 * from a level's `game.mechanics`, so a verbs-only level is legible AND juicy with zero styling.
 *
 * Each spatial mechanic contributes decoration that rides the channels U1–U4 built:
 *   - collect  → a GLYPH pickup body (gem/coin/key/… by item) at each pickup, fx `float` + sfx
 *                `sparkle`, and an fx `burst` on collect (the pickup pops out of existence). The
 *                mechanic's own box marker is SUPPRESSED (the glyph replaces it).
 *   - reach-exit → a `flag` glyph at the goal + a green `aura` beacon.
 *   - hazard-damage → a red danger `aura` at each hazard (a pulsing "stay away").
 * survive / fail-on-death are stateful, not spatial → no world decoration (their HUD is enough).
 *
 * Pure + deterministic. The decoration is DEFAULT-ON and fully overridable: `game.decorate:false`
 * opts a level out wholesale; a hand-authored `entities`/`fx`/`sfx` on the level composes ON TOP
 * (decoration is additive, and a hand `fx.on`/`states` key wins on merge). Ids are namespaced
 * `dec_*` so they never collide with hand-authored or mechanic-internal ids.
 */

// item name → glyph form. A small heuristic over the closed form shelf; unknowns default to a gem
// (the canonical collectible). Extend by adding rows, not by opening the mapping.
const ITEM_FORM = [
  [/coin|gold|money|cash|token/i, 'coin'],
  [/gem|crystal|jewel|diamond|emerald|ruby/i, 'gem'],
  [/key|rune-?key/i, 'key'],
  [/heart|life|health|hp/i, 'heart'],
  [/star|shard/i, 'star'],
  [/orb|mana|energy|soul|essence/i, 'orb'],
  [/skull|bone|curse/i, 'skull'],
];
export function formForItem(item) {
  const s = String(item || '');
  for (const [re, form] of ITEM_FORM) if (re.test(s)) return form;
  return 'gem';
}

/**
 * decorateMechanics(mechanics, ctx?) → { entities, fx:{states,on}, sfx, reactions, suppress }
 *   entities  — glyph-bodied static props (payload.entities) for pickups/exit
 *   fx        — { states:{id:state}, on:{event:{gesture,target}} } (payload.fx)
 *   sfx       — [{ verb, at, color?, params? }] (→ payload.effects via the sfx composer)
 *   reactions — bus reactions the decoration adds (emit the per-pickup burst signal)
 *   suppress  — mechanic marker ids to drop (the glyph replaces the box)
 */
export function decorateMechanics(mechanics, ctx = {}) {
  const entities = [];
  const states = {};
  const on = {};
  const sfx = [];
  const reactions = [];
  const suppress = [];
  const list = Array.isArray(mechanics) ? mechanics : [];

  list.forEach((m, i) => {
    if (!m || !m.kind) return;

    if (m.kind === 'collect') {
      const pickups = Array.isArray(m.pickups) ? m.pickups : [];
      pickups.forEach((pk, j) => {
        const zone = `pk_${i}_${j}`;             // matches collect's own zone/marker id
        const gid = `dec_${zone}`;
        const at = Array.isArray(pk.at) ? pk.at : [0, 0, 0];
        entities.push({ id: gid, transform: { pos: at, heading: 0 }, rule: { type: 'clock', rate: 0 }, body: { type: 'glyph', form: formForItem(pk.item) } });
        states[gid] = 'float';
        sfx.push({ verb: 'sparkle', at });
        // burst the glyph when the player enters the pickup's zone. The fx wrap matches this key
        // against the enter event's SOURCE (the zone id) — a top-level fact, so it fires (emit-ted
        // events don't reach the wrap; see channels.js). Explicit target = this pickup's glyph.
        on[zone] = { gesture: 'burst', target: gid };
        suppress.push(zone);                     // hide the mechanic's box marker (glyph replaces it)
      });
    } else if (m.kind === 'reach-exit') {
      const at = Array.isArray(m.at) ? m.at : [0, 0, 0];
      entities.push({ id: `dec_exit_${i}`, transform: { pos: at, heading: 0 }, rule: { type: 'clock', rate: 0 }, body: { type: 'glyph', form: 'flag' } });
      sfx.push({ verb: 'aura', at, color: [0.25, 1.0, 0.45], params: { base: 0.3, pulse: 0.35, r: 1.0, cz: 1.0 } });
    } else if (m.kind === 'hazard-damage') {
      const hazards = Array.isArray(m.hazards) ? m.hazards : [];
      hazards.forEach((hz) => {
        const at = Array.isArray(hz.at) ? hz.at : [0, 0, 0];
        sfx.push({ verb: 'aura', at, color: [1.0, 0.15, 0.1], params: { base: 0.3, pulse: 0.45, r: 0.9, cz: 0.4 } });
      });
    }
  });

  return { entities, fx: { states, on }, sfx, reactions, suppress };
}

/**
 * mergeDecorFx(handFx, decorFx) — merge a hand-authored `fx` channel with the decoration's, hand
 * keys winning (an author override beats a default). Both are { states?, on? }.
 */
export function mergeDecorFx(handFx, decorFx) {
  const hf = handFx && typeof handFx === 'object' ? handFx : {};
  const states = { ...(decorFx.states || {}), ...(hf.states || {}) };
  const on = { ...(decorFx.on || {}), ...(hf.on || {}) };
  const out = {};
  if (Object.keys(states).length) out.states = states;
  if (Object.keys(on).length) out.on = on;
  return Object.keys(out).length ? out : null;
}
