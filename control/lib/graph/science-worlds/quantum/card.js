/**
 * The quantum card's generated half: the law table as the vocab card prints it, with each row's sources and the
 * date it was last reviewed, between the card's `laws:begin` / `laws:end` markers
 * (lib/graph/views/view-vocab/quantum.md). A test fails when they drift; `node scripts/science-cards.mjs` writes it back.
 */

import { QUANTUM_LAWS, SYSTEMS } from './laws.js';
import { CARD_BEGIN, CARD_END } from '../classical/card.js';

const UNIT = { length: "a length, e.g. '0.6 nm'", work: "an energy, e.g. '0.2 eV'", time: "a time, e.g. '2 s'", axis: "'x', 'y', 'z', '-z' …, or an angle from z toward x", keep: "'up', 'down' or 'both'" };

function paramLine(name, p) {
  const tail = p.required ? 'required' : p.default !== undefined ? `default ${p.default}` : 'optional';
  return `\`${name}\` (${UNIT[p.dim] || p.dim}; ${tail})`;
}

export function quantumCardBlock() {
  const bySystem = SYSTEMS.map((sys) => [
    `### The ${sys} system`,
    '',
    ...QUANTUM_LAWS.filter((r) => r.system === sys).flatMap((r) => [
      `#### \`${r.id}\``,
      '',
      r.summary,
      '',
      ...(Object.keys(r.params).length ? [`- Takes ${Object.entries(r.params).map(([n, p]) => paramLine(n, p)).join(', ')}.`] : []),
      `- Leaves out: ${r.assumption}`,
      `- Sources: ${r.sources.join('; ')} (reviewed ${r.reviewed}).`,
      `- Smallest example: \`${JSON.stringify(r.example)}\``,
      '',
    ]),
  ].join('\n'));
  return [CARD_BEGIN, '', '## The laws', '', ...bySystem, CARD_END].join('\n');
}

export function withQuantumBlock(card) {
  const a = card.indexOf(CARD_BEGIN), b = card.indexOf(CARD_END);
  if (a < 0 || b < a) throw new Error('quantum card: the laws:begin / laws:end markers are missing');
  return card.slice(0, a) + quantumCardBlock() + card.slice(b + CARD_END.length);
}
