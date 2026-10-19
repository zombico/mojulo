/**
 * The classical card's generated half: the law table and the closed-form table, as the vocab card prints them.
 * The card (lib/graph/views/view-vocab/classical.md) carries this text between its `laws:begin` / `laws:end`
 * markers; a test fails when the two drift, and `node scripts/science-cards.mjs` writes it back.
 */

import { CLASSICAL_LAWS } from './laws.js';
import { CLASSICAL_CLOSED_FORMS } from './analytic.js';

export const CARD_BEGIN = '<!-- laws:begin (generated from the law tables: node scripts/science-cards.mjs) -->';
export const CARD_END = '<!-- laws:end -->';

const UNIT = {
  mass: 'kg', length: 'm', time: 's', velocity: 'm/s', accel: 'm/s²', stiffness: 'N/m', damping: 'N·s/m',
  viscosity: 'Pa·s', density: 'kg/m³', area: 'm²', efield: 'V/m', bfield: 'T', charge: 'C', scalar: '',
};
const SHAPE = {
  each: '`on?: [ids]` (default: every body it can act on)',
  pairs: '`among?: [ids]` (default: every body it can act on)',
  link: '`between: [id, id]` or `[id, [x, y, z]]` (a fixed point)',
  plane: '`id?` (bodies sit on it with `on_plane`), `on?: [ids]`',
};

const fmtDefault = (d) => (Array.isArray(d) ? `[${d.join(', ')}]` : String(d));

function paramLine(name, p) {
  const unit = p.number ? 'a number, SI' : p.dim === 'scalar' ? (name === 'tilt' ? 'an angle: rad, or \'30 deg\'' : 'a number') : `${p.vector ? '[x, y, z] in ' : ''}${UNIT[p.dim] || p.dim}`;
  const tail = p.required ? 'required' : p.default !== undefined ? `default ${fmtDefault(p.default)}` : 'optional';
  return `\`${name}\` (${unit}; ${tail})`;
}

export function classicalCardBlock() {
  const laws = CLASSICAL_LAWS.map((r) => [
    `### \`${r.id}\``,
    '',
    r.summary,
    '',
    `- Names its bodies with ${SHAPE[r.shape]}.`,
    ...(Object.keys(r.params).length ? [`- Takes ${Object.entries(r.params).map(([n, p]) => paramLine(n, p)).join(', ')}.`] : []),
    `- Leaves out: ${r.assumption}`,
    `- Smallest example: \`${JSON.stringify(r.example)}\``,
  ].join('\n'));
  const forms = CLASSICAL_CLOSED_FORMS.map((c) => `- \`${c.id}\`: ${c.want}.`);
  return [CARD_BEGIN, '', '## The laws', '', ...laws.flatMap((l) => [l, '']), '## Textbook answers the solver checks itself against', '',
    'When a model is exactly one of these setups, the run is measured and compared with the closed form; the result is a gate.', '',
    ...forms, '', CARD_END].join('\n');
}

/** The card text with its generated block replaced by the current tables. */
export function withClassicalBlock(card) {
  const a = card.indexOf(CARD_BEGIN), b = card.indexOf(CARD_END);
  if (a < 0 || b < a) throw new Error('classical card: the laws:begin / laws:end markers are missing');
  return card.slice(0, a) + classicalCardBlock() + card.slice(b + CARD_END.length);
}
