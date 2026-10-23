/**
 * The relativistic card's generated half: the law table as the vocab card prints it, with each row's sources and the
 * date it was last reviewed, between the card's `laws:begin` / `laws:end` markers
 * (lib/graph/views/view-vocab/relativistic.md). A test fails when they drift; `node scripts/science-cards.mjs`
 * writes it back.
 */

import { RELATIVISTIC_LAWS, SYSTEMS } from './laws.js';
import { CARD_BEGIN, CARD_END } from '../classical/card.js';

const UNIT = {
  mass: "a mass, e.g. '10 M☉' or '5.972e24 kg'", length: "a length, e.g. '300 km', or in Schwarzschild radii, '20 Rs'",
  velocity: "a speed below c, e.g. '0.2 c' or '30 km/s'", scalar: "an angle, e.g. '75°'", flag: 'true or false', id: 'a short name',
};

function paramLine(name, p) {
  const tail = p.required ? 'required' : p.default !== undefined ? `default ${p.default}` : 'optional';
  return `\`${name}\` (${p.vector ? '[x, y, z], each ' : ''}${UNIT[p.dim] || p.dim}; ${tail})`;
}

const rowBlock = (r) => [
  `#### \`${r.id}\``,
  '',
  r.summary,
  '',
  ...(Object.keys(r.params).length ? [`- Takes ${Object.entries(r.params).map(([n, p]) => paramLine(n, p)).join(', ')}.`] : []),
  `- Leaves out: ${r.assumption}`,
  `- Sources: ${r.sources.join('; ')} (reviewed ${r.reviewed}).`,
  `- Smallest example: \`${JSON.stringify(r.example)}\``,
  '',
];

export function relativisticCardBlock() {
  const shared = RELATIVISTIC_LAWS.filter((r) => r.system === '*');
  const bySystem = SYSTEMS.map((sys) => [`### The ${sys} system`, '', ...RELATIVISTIC_LAWS.filter((r) => r.system === sys).flatMap(rowBlock)].join('\n'));
  return [CARD_BEGIN, '', '## The laws', '', '### Every system', '', ...shared.flatMap(rowBlock), ...bySystem, CARD_END].join('\n');
}

export function withRelativisticBlock(card) {
  const a = card.indexOf(CARD_BEGIN), b = card.indexOf(CARD_END);
  if (a < 0 || b < a) throw new Error('relativistic card: the laws:begin / laws:end markers are missing');
  return card.slice(0, a) + relativisticCardBlock() + card.slice(b + CARD_END.length);
}
