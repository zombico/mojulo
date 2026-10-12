// the city plan's card, generated from the reader's own tables (card.js, grammar.js, laws.js, read.js), so the manual
// and the rails cannot drift apart. Served by get_view_vocab({ id: 'city-plan' }) beside the base's 'city' card.
import { DISTRICT_USES, SITE_USES, LOT_USES, BOARD, FIDELITIES } from './card.js';
import { CITY_GRAMMARS, PLAY_SCALES, TRANSIT_MODES } from './grammar.js';
import { GRAMMAR_SCHEMA, WORLD_GRAMMARS } from './grammars.js';
import { FACADE_FIELDS, MASS_SHAPES } from './facades.js';
import { CITY_LAWS } from './laws.js';
import { CITY_OUTCOMES } from './read.js';

export function cityPlanCard() {
  const lines = [
    '# City plan: a city planned first, tuned on rails, walked as its massing', '',
    'A city as a plan before a render. The plan is laid on a BOARD of square cells seen from above (columns A… across, rows 1… down: \'C4\', a block \'C4:H9\', a stroke \'A5>P5\'), in layers that each read only the layers before them: the main streets first, then what the districts are for, the ground reserved before anything grows, the street grid cut from what they leave, the lots cut from each block\'s frontage, the transit lines, and the walk. Each layer rolls its own dice (each block its own), so tuning one never rerolls what came before it. Legacy cities (the base\'s own knobs, card city) are frozen: this is where new city work lands.', '',
    'MINT       compose_world { base: "city", seed?, title?, overrides: { plan: { grammar?, play?, board?, spine?, districts?, sites?, transit?, lots?, waive? } } }',
    '           the reply carries the census, every law (holding or its findings) and `next`; the book is /api/sketches/<ref>/bible, the massing walks at /world.',
    'EDIT       update_sketch on the stored recipe (it is the plan, flat: kind "city"); a lot by hand is lots: { <id>: { use?, storeys? } }, ids on the book\'s Lots sheet.', '',
    `GRAMMAR    how it is laid out and built, in metres. Of Earth, read from the legacy metro city so the two stay one source: ${Object.keys(CITY_GRAMMARS).map((g) => `${g} (${CITY_GRAMMARS[g].label})`).join(', ')}.`,
    `           Not of Earth, written as documents over them: ${Object.entries(WORLD_GRAMMARS).map(([g, x]) => `${g} (${x.label})`).join(', ')}.`,
    `           Your own: grammar: { from: <any of them>, …changes }, objects merge and lists replace; fields: ${Object.keys(GRAMMAR_SCHEMA).join(', ')}. A wrong field or value is refused by name.`,
    `           wear: a facade every lot wears over its skin; shapes: { ${MASS_SHAPES.join(', ')}: weight, minFloors }: the masses a lot may stand as; facade: the legacy flavour's affectations (roof caps, balconies, fire escapes, kit, awnings, signs, blade signs).`,
    `PLAY       ${Object.keys(PLAY_SCALES).join(' | ')}: 'game' (the default) compresses what a walker covers (block pitch ×${PLAY_SCALES.game.pitch}, right-of-way ×${PLAY_SCALES.game.row}, the walk's beat ×${PLAY_SCALES.game.beat}) and never a storey, a door, a car or a person; 'real' keeps real-world lengths for a layout plan or a matte.`,
    `BOARD      { cell (${BOARD.cell[0]}–${BOARD.cell[1]} m; game ${PLAY_SCALES.game.cell}, real ${PLAY_SCALES.real.cell}), cols (${BOARD.cols[0]}–${BOARD.cols[1]}, A–Z), rows (${BOARD.rows[0]}–${BOARD.rows[1]}) }`,
    'SPINE      [{ path: \'A5>P5\', rank?: major | minor, name? }]: the main streets, through cell centres; a straight run fixes the grid, a bend or a diagonal runs over it. Left out, two crossing at the middle.',
    'DISTRICTS  [{ at: \'C4:H9\', use, name? }], the last laid wins; left out, the height field decides (core near the crossing, residential far out):',
    ...Object.entries(DISTRICT_USES).map(([k, v]) => `  - ${k}: ${v.read}`),
    'SITES      [{ at: \'H5\' | \'G4:H5\', use, name?, height? (m, a landmark or civic) }]: reserved before the grid; the streets go round:',
    ...Object.entries(SITE_USES).map(([k, v]) => `  - ${k}: ${v.read}`),
    `TRANSIT    [{ path: 'A3>P3', mode?, name? }]: along a street's cells; a stop every grammar's transit.stop metres. Modes: ${TRANSIT_MODES.join(', ')} (a maglev rides an elevated guideway on pylons); a grammar names the ones it runs.`,
    `LOTS       { '<lot id>': { use? (${LOT_USES.join(', ')}), storeys?, facade? } }; a facade is the building generator's descriptor: ${Object.keys(FACADE_FIELDS).join(', ')}.`,
    `FIDELITY   ${FIDELITIES.join(' | ')}: the world in every lot's facade (the default), or the massing alone.`,
    'WAIVE      [\'<law>\' | \'<law>:<subject>\']: a finding accepted; the book shows it waived.', '',
    'LAWS       advisory: a finding never refuses the plan.',
    ...CITY_LAWS.map((l) => `  - ${l.id} (${l.layer}): ${l.want}. ${l.why}.`), '',
    'OUTCOMES   what the reply\'s `next` and the book\'s Open sheet are sorted by:',
    ...CITY_OUTCOMES.map((o) => `  - ${o.name}: ${o.question}`),
  ];
  return {
    id: 'city-plan', name: 'City plan (a city on rails, planned first)', family: 'world', entry: 'compose_world', generated: true,
    summary: 'A city planned on a board of cells before anything renders: main streets, districts, reserved sites, the grid and lots cut from them, transit, and walk laws, in a grammar from Paris to Tokyo, at game or real scale.',
    when: '"plan a city", "city layout", "a city slice", "lay out the streets first", "a walkable city for a game", "GTA-like city", "a city like Paris / Tokyo / New York", "districts and a downtown", "a city plan I can edit", "place a landmark in the city", "a tram line through the city"',
    body: lines.join('\n'),
  };
}

export const cityEntryCards = () => [cityPlanCard()];
