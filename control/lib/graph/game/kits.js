/**
 * game kits — curated store-schema + level-template bundles built from mechanics
 * (game-mechanics.plan.md, M4). A kit is the "don't design the store from scratch" layer: it
 * hands you a working store, a per-level `game` channel recipe (mechanics + fall), and a
 * progression convention, so authoring a whole game shape is fill-in-the-blanks.
 *
 * A kit is a curated COMPOSITION of mechanics (M0–M3), nothing new under the hood: its level
 * channels lower through composeMechanics, its store validates like any store, its gates ride the
 * game manifest. `scaffoldGameFromKit` turns per-level geometry into a complete `create_game` input
 * PLUS the per-level `game` channels to attach when minting each world. Pure + deterministic.
 */

// Each kit: store (slices), fall (default policy), a levelChannel(geometry) → game channel, and a
// progression convention ('gated' = each level unlocks the next on completion; 'linear' = no gates).
export const KITS = {
  'dungeon-crawler': {
    name: 'Dungeon crawler',
    summary: 'A room-to-room crawler: reach the exit, grab loot, dodge hazards, and don\'t die. Loot and your character persist across a gated campaign.',
    when: 'a dungeon crawler, room-to-room levels, reach the exit while collecting loot and avoiding hazards, a lethal campaign that unlocks level by level',
    store: {
      slices: [
        { name: 'hero', kind: 'character', init: { stats: { hp: 100 } } },
        { name: 'bag', kind: 'inventory' },
        { name: 'campaign', kind: 'progression' },
      ],
    },
    fall: { mode: 'respawn', penalty: 5, floor: 1 },
    progression: 'gated',
    levelChannel(g) {
      const mechanics = [{ kind: 'reach-exit', at: g.exit, ...(g.exitRadius ? { radius: g.exitRadius } : {}) }];
      if (Array.isArray(g.pickups) && g.pickups.length) mechanics.push({ kind: 'collect', into: 'bag', pickups: g.pickups });
      if (Array.isArray(g.hazards) && g.hazards.length) {
        mechanics.push({ kind: 'hazard-damage', hazards: g.hazards });
        mechanics.push({ kind: 'fail-on-death' });
      }
      return { levelRef: g.ref, mechanics, fall: this.fall };
    },
  },

  collectathon: {
    name: 'Collectathon',
    summary: 'Gather the loot, reach the exit. Light, non-lethal exploration; falls cost position, not your run. Inventory carries across a linear set of stages.',
    when: 'a collectathon, gather all the coins/gems, exploration platformer, pick up loot then reach the exit, non-lethal collecting levels',
    store: {
      slices: [
        { name: 'bag', kind: 'inventory' },
        { name: 'campaign', kind: 'progression' },
      ],
    },
    fall: { mode: 'respawn' },
    progression: 'linear',
    levelChannel(g) {
      const mechanics = [
        { kind: 'collect', into: 'bag', pickups: g.pickups || [] },
        { kind: 'reach-exit', at: g.exit, ...(g.exitRadius ? { radius: g.exitRadius } : {}) },
      ];
      return { levelRef: g.ref, mechanics, fall: this.fall };
    },
  },

  'survival-arena': {
    name: 'Survival arena',
    summary: 'Outlast a timer in a hazard-filled arena. Survive to win, die to lose. A character with hp carries across a linear run of arenas.',
    when: 'a survival arena, last N seconds, hold out against hazards, a timed survival challenge, don\'t die until the clock runs out',
    store: {
      slices: [
        { name: 'hero', kind: 'character', init: { stats: { hp: 100 } } },
        { name: 'campaign', kind: 'progression' },
      ],
    },
    fall: { mode: 'respawn', penalty: 5, floor: 1 },
    progression: 'linear',
    levelChannel(g) {
      const mechanics = [
        { kind: 'survive', seconds: g.seconds != null ? g.seconds : 30 },
        { kind: 'fail-on-death' },
      ];
      if (Array.isArray(g.hazards) && g.hazards.length) mechanics.push({ kind: 'hazard-damage', hazards: g.hazards });
      return { levelRef: g.ref, mechanics, fall: this.fall };
    },
  },
};

export const KIT_IDS = Object.keys(KITS);

export function getKit(id) { return KITS[id] || null; }
export function listKits() {
  return KIT_IDS.map((id) => ({ id, name: KITS[id].name, summary: KITS[id].summary, when: KITS[id].when }));
}

/**
 * Turn a kit + per-level geometry into a ready-to-mint game.
 * @param {string} kitId
 * @param {{ title: string, levels: Array<{ ref, title?, ...geometry }> }} spec
 * @returns {{ store, gameLevels, levelChannels }}
 *   store        — the create_game `store` (the kit's slices)
 *   gameLevels   — the create_game `levels` list, with progression gates applied
 *   levelChannels— { <ref>: game channel } to attach to each world when minting it (compose_world)
 * @throws if the kit is unknown or a level lacks required geometry
 */
export function scaffoldGameFromKit(kitId, spec = {}) {
  const kit = getKit(kitId);
  if (!kit) throw new Error(`unknown game kit '${kitId}'. Known: ${KIT_IDS.join(', ')}`);
  const levels = Array.isArray(spec.levels) ? spec.levels : [];
  if (!levels.length) throw new Error(`kit '${kitId}': spec.levels is required (one entry of geometry per level)`);

  const levelChannels = {};
  const gameLevels = [];
  levels.forEach((g, i) => {
    if (!g || !g.ref) throw new Error(`kit '${kitId}': levels[${i}] needs a ref`);
    levelChannels[g.ref] = kit.levelChannel(g);
    const row = { ref: g.ref, title: g.title || g.ref };
    // gated progression: each level after the first unlocks on the previous one's completion.
    if (kit.progression === 'gated' && i > 0) row.gate = { completed: levels[i - 1].ref };
    gameLevels.push(row);
  });

  return { store: kit.store, gameLevels, levelChannels };
}
