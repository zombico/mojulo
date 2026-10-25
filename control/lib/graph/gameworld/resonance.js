/**
 * RESONANCES — the compiler's check that a composition's combined outcomes are laid (docs: CHANGELOG, Resonance). When
 * values in two or more of the cube's facets are set together, an outcome exists that neither says alone: the seats,
 * the frame and the camera make a co-op screen; a watcher's perception and an unseen goal make a sneak. A concern
 * (concerns.js) is raised by ANY one value and says what the world must give; a resonance is the AND, and says what the
 * composition makes. Each value can read built while the combination is not laid, or laid and never checked: the
 * check asks, for a composition, which resonances it OPENS, whether the design run's steps LAID what each needs, and
 * whether the laid levels HOLD its law. Internal: the agent's tools and cards carry none of it; nothing refuses.
 *
 * A row earns its place by four tests: neither facet makes it alone; it changes what is laid (it names `lowers`); a law
 * can check it; and, for anything the agent may one day read, a user voices it as one intent (`voiced`).
 *
 *   RESONANCES                 [{ id, name, of: [facet], when: [key], outcome, lowers: [module], laid(levels, cube) →
 *                              bool, law?(levels, cube) → advice | null, voiced?: [words] }]; `when` keys are
 *                              'facet.setting=value', ANDed across the list, `a|b` inside one key ORed
 *   resonancesOf(cube)         → the rows the cube opens, in table order
 *   resonanceCheck(cube, orders) → [{ id, name, laid, held, says }] for each opened row: `orders` the design run's
 *                              step orders (a level's is { title, manifest }), `held` null when the row has no law or
 *                              nothing was laid, `says` the law's advice (null when it holds)
 *   compilerGaps(cube, orders) → the opened rows the run did not lay ({ id, laid: false }) or laid and did not hold
 *                              ({ id, says }): the compiler's own defects, reported with a design run, never refused
 * Pure; reads the cube and the orders, never a store.
 */

const has = (cube, key) => {
  const [path, want] = key.split('='), [facet, setting] = path.split('.');
  const got = cube?.[facet]?.[setting];
  if (got === undefined) return false;
  const values = want.split('|');
  return Array.isArray(got) ? got.some((g) => values.includes(g)) : values.includes(got);
};
const valuesOf = (cube, path) => { const [facet, setting] = path.split('.'), v = cube?.[facet]?.[setting]; return v === undefined ? [] : Array.isArray(v) ? v : [v]; };
// the level orders of a run: those whose manifest is a playable level (it carries a game channel)
const levelsOf = (orders) => (orders ?? []).map((o) => o?.manifest).filter((m) => m && m.game);
const SEATS = { two: 2, four: 4 };

export const RESONANCES = Object.freeze([
  {
    id: 'co-op-screen', name: 'A co-op screen',
    of: ['soul', 'space'],
    when: ['soul.seats=two|four', 'soul.frame=follow-all', 'space.camera=side|top-down'],
    outcome: 'several players on one screen, each a hero of their own, a shared camera framing them all',
    lowers: ['lib/graph/gameworld/levels.js', 'lib/graph/worlds/controllable/rules-basic.js', 'lib/graph/scene/channels/controllable/index.js'],
    laid: (levels) => levels.some((m) => m.seats?.bodies?.length && ['side', 'overhead'].includes(m.camera?.rule)),
    law: (levels, cube) => {
      const n = SEATS[valuesOf(cube, 'soul.seats')[0]], pool = valuesOf(cube, 'soul.pool')[0];
      for (const m of levels.filter((x) => x.seats)) {
        const byId = Object.fromEntries((m.entities ?? []).map((e) => [e.id, e])), hero = (m.entities ?? []).find((e) => e.pilotable);
        if (m.seats.bodies.length !== n - 1) return `${m.title}: ${m.seats.bodies.length + 1} seats laid where the cube asks ${n}`;
        for (const id of m.seats.bodies) {
          const b = byId[id];
          if (!b || !b.pilotable) return `${m.title}: seat body '${id}' is not a pilotable entity of the level`;
          if (hero && b.team !== hero.team) return `${m.title}: seat body '${id}' is not on the hero's side`;
        }
        if (pool && m.seats.pool !== pool) return `${m.title}: the cube asks soul.pool=${pool}; the seats carry ${m.seats.pool ? `pool ${m.seats.pool}` : 'no lives'}`;
      }
      return null;
    },
    voiced: ['couch co-op', 'co-op platformer', 'play together on one screen'],
  },
  {
    id: 'watched-sneak', name: 'A sneak past watchers',
    of: ['mind', 'power'],
    when: ['mind.perception=sight|memory', 'power.mechanics=unseen'],
    outcome: 'watchers who perceive the hero, and a goal that ends when they do: a way through unseen',
    lowers: ['lib/graph/gameworld/quick.js', 'lib/graph/worlds/controllable/mind.js', 'lib/graph/game/mechanics.js'],
    laid: (levels) => levels.some((m) => (m.game.mechanics ?? []).some((x) => x.kind === 'unseen') && (m.entities ?? []).some((e) => ['sight', 'memory'].includes(e.rule?.mind?.perception))),
    // the watchers perceive as the cube says: a cube that asks for memory is laid with watchers who remember
    law: (levels, cube) => {
      const want = valuesOf(cube, 'mind.perception');
      for (const m of levels) {
        const off = (m.entities ?? []).filter((e) => e.rule?.mind?.perception && !want.includes(e.rule.mind.perception));
        if (off.length) return `${m.title}: the cube asks mind.perception=${want.join('|')}; ${off.length} watcher${off.length === 1 ? ' is' : 's are'} laid with ${[...new Set(off.map((e) => e.rule.mind.perception))].join(', ')}`;
      }
      return null;
    },
    voiced: ['stealth', 'sneak past guards'],
  },
  {
    id: 'escorting-party', name: 'Companions who follow',
    of: ['soul', 'mind'],
    when: ['soul.party=party', 'mind.motivation=escort'],
    outcome: 'characters who join the hero and keep with them, fighting at their side',
    lowers: ['lib/graph/gameworld/levels.js', 'lib/graph/playscape/ui/party.js', 'lib/graph/worlds/controllable/mind.js'],
    laid: (levels) => levels.some((m) => (m.entities ?? []).some((e) => e.rule?.mind?.motivation === 'escort')),
    // each companion keeps with someone the level has: its ward is an entity there
    law: (levels) => {
      for (const m of levels) {
        const ids = new Set((m.entities ?? []).map((e) => e.id));
        const lost = (m.entities ?? []).filter((e) => e.rule?.mind?.motivation === 'escort' && e.rule.escort && !ids.has(e.rule.escort));
        if (lost.length) return `${m.title}: ${lost.map((e) => e.id).join(', ')} escort${lost.length === 1 ? 's' : ''} no one the level has`;
      }
      return null;
    },
    voiced: ['companions who follow', 'a party that joins the hero'],
  },
]);

export function resonancesOf(cube) {
  return RESONANCES.filter((r) => r.when.every((k) => has(cube, k)));
}

export function resonanceCheck(cube, orders) {
  const levels = levelsOf(orders);
  return resonancesOf(cube).map((r) => {
    const laid = r.laid(levels, cube);
    const says = laid && r.law ? r.law(levels, cube) : null;
    return { id: r.id, name: r.name, laid, held: laid && r.law ? says === null : null, says };
  });
}

export function compilerGaps(cube, orders) {
  return resonanceCheck(cube, orders).filter((r) => !r.laid || r.held === false).map((r) => (r.laid ? { id: r.id, says: r.says } : { id: r.id, laid: false }));
}
