// vehicle-registry/entries — the VEHICLES CARD for the solid vocabulary, generated from the registry (roster.js,
// builds.js) at load (solid-vocab/loader.js), never hand-written: every vehicle by realm, its role and eras, and what it
// is drawn as at each tier today. Found by search ("which vehicles are there", "a realistic pickup"), read by id
// ('vehicles'); the `vehicle` card says how a vehicle is minted.
import { VEHICLES, REALMS, ROLES } from './roster.js';
import { buildOf, upscaleLedger, TIER_IDS } from './builds.js';

const tierWord = (id, tier) => {
  const at = buildOf(id, tier);
  if (at.tier === tier) return `${tier} ${at.build.status === 'live' ? at.build.via : `${at.build.via} (asleep)`}`;
  return null;
};

export function vehiclesCard() {
  const ledger = upscaleLedger();
  const lines = ['# The vehicle registry', '',
    "Every vehicle a game, a world or a preview names, one row under the words people say: `mint_solid { kind: 'vehicle', spec: { vehicle: '<word>', tier? } }` shows one; a quick game's `ride`, `vehicle` and `craft` take the same words (design_game). The old tables (the city's nets, the physics classes, the fleet, the rides, the race machines, the craft shelf) are each a row's build, frozen behind the registry: a new vehicle is a row first.", '',
    `A build is a row at a tier (${TIER_IDS.join(', ')}). Live: a door or game draws it today. Asleep: built and not yet wired (the upscale is wiring). Every row falls back to the technology crafter's concept, so a game can always draw it. Drawn realistic today, for the use that matters most: ${ledger.live.length} rows live, ${ledger.asleep.length} asleep, ${ledger.none.length} with no realistic body yet.`, ''];
  for (const realm of Object.keys(REALMS)) {
    const ids = Object.keys(VEHICLES).filter((id) => VEHICLES[id].realm === realm);
    if (!ids.length) continue;
    lines.push(`## ${realm}: ${REALMS[realm]}`, '');
    for (const id of ids) {
      const r = VEHICLES[id], tiers = TIER_IDS.map((t) => tierWord(id, t)).filter(Boolean);
      lines.push(`- \`${id}\` ${r.label}${r.aliases.length ? ` (${r.aliases.slice(0, 3).join(', ')})` : ''}: ${r.role}, ${r.eras.join('/')}; ${tiers.length ? tiers.join(', ') : 'a concept only'}`);
    }
    lines.push('');
  }
  lines.push('## Roles', '', ...Object.entries(ROLES).map(([k, v]) => `- \`${k}\` ${v}`));
  return {
    id: 'vehicles', name: 'The vehicle registry: every vehicle by realm, and what it is drawn as at each tier', family: 'vehicle', entry: 'mint_solid', generated: true,
    summary: `Every vehicle a game can name, by realm (${Object.keys(REALMS).join(', ')}), its role and eras, and its build at each tier (toy, stylised, realistic).`,
    when: '"which vehicles are there", "a realistic pickup truck for my game", "cars that fit a medieval world", "what can my hero drive", "a tank", "a sailing ship", "a space fighter", "can this vehicle be drawn realistic"',
    body: lines.join('\n').trim(),
  };
}
