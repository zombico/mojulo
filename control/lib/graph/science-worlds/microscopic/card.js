/**
 * The microscopic card's generated half: the law table as the vocab card prints it, between the card's
 * `laws:begin` / `laws:end` markers (lib/graph/views/view-vocab/microscopic.md). A test fails when they drift;
 * `node scripts/science-cards.mjs` writes it back.
 */

import { MICROSCOPIC_LAWS } from './laws.js';
import { CARD_BEGIN, CARD_END } from '../classical/card.js';

const UNIT = { velocity: 'm/s (e.g. \'1 µm/s\')', force: 'N (e.g. \'2 pN\')', length: 'm', axis: "'x', 'y' or 'z'", species: 'species ids', rate: 'per second (one reactant) or per molar per second (two), e.g. \'2 /s\', \'1e6 /M/s\'' };

function paramLine(name, p) {
  const what = p.perSpecies ? `{ <species>: ${UNIT[p.dim]} }` : p.list ? `[${UNIT[p.dim]}]` : `${p.vector ? '[x, y, z] in ' : ''}${UNIT[p.dim] || p.dim}`;
  const tail = p.required ? 'required' : p.default !== undefined ? `default ${p.default}` : 'optional';
  return `\`${name}\` (${what}; ${tail})`;
}

export function microscopicCardBlock() {
  const laws = MICROSCOPIC_LAWS.map((r) => [
    `### \`${r.id}\``,
    '',
    r.summary,
    '',
    ...(Object.keys(r.params).length ? [`- Takes ${Object.entries(r.params).map(([n, p]) => paramLine(n, p)).join(', ')}.`] : []),
    `- Leaves out: ${r.assumption}`,
    `- Smallest example: \`${JSON.stringify(r.example)}\``,
  ].join('\n'));
  return [CARD_BEGIN, '', '## The laws', '', ...laws.flatMap((l) => [l, '']), CARD_END].join('\n');
}

export function withMicroscopicBlock(card) {
  const a = card.indexOf(CARD_BEGIN), b = card.indexOf(CARD_END);
  if (a < 0 || b < a) throw new Error('microscopic card: the laws:begin / laws:end markers are missing');
  return card.slice(0, a) + microscopicCardBlock() + card.slice(b + CARD_END.length);
}
