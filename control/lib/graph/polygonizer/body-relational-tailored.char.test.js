/**
 * THE TAILORED WORDS' pin: what the realistic body's loose and footwear words (body-relational-drape.js,
 * body-relational-gi.js, body-relational-footwear.js) make, hashed part by part, so moving their construction into shared
 * primitives is proven to change no byte. One case per procedure: the gathered trousers, the open trousers falling to
 * the floor, the jacket over the trousers (its skirt cleared over them, their sash taken by its belt) on the male and on
 * the female, a boot (its shaft, sole and straps) and a sandal (a sole and straps alone).
 * (Out of the critical tier, as the plants' pin: each case mints a realistic body.)
 */
import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { heroRecord, expandLayeredManifest } from '../../mcp/tools/layered.js';

const OF = /^(martialPants|wideTrousers|gi|boots|shoes|sandals)/;
const hash = (cast, outfit) => {
  const r = expandLayeredManifest({ kind: 'layered', hero: heroRecord({ cast, form: 'realistic', outfit }) }).recipe;
  const parts = Object.fromEntries(Object.entries(r.parts).filter(([k]) => OF.test(k)).sort(([a], [b]) => (a < b ? -1 : 1)));
  return createHash('sha256').update(JSON.stringify(parts)).digest('hex').slice(0, 16);
};

// (boots and sandals re-pinned once: a strap became the tailor's one band, `bandAt`, whose caps take their ring's mixed
// weights, where the footwear's own copy had left them on the upper's bone; nothing else in their parts moved)
const PINS = {
  'gathered, male': { cast: 'male', outfit: ['martialPants'], hash: '29b724313540708d' },
  'to the floor, female': { cast: 'female', outfit: ['wideTrousers'], hash: '33172caef3f632a2' },
  'jacket over, male': { cast: 'male', outfit: ['martialPants', 'gi'], hash: 'dcdcaa4c77004581' },
  'jacket over, female': { cast: 'female', outfit: ['martialPants', 'gi'], hash: '6834076ae31295cc' },
  'boots, male': { cast: 'male', outfit: ['boots'], hash: '1f700a2bb84e1b5e' },
  'sandals, female': { cast: 'female', outfit: ['sandals'], hash: 'b677f82a7dd87c20' },
};

describe('the tailored words, byte for byte', () => {
  for (const [name, { cast, outfit, hash: pin }] of Object.entries(PINS)) it(name, () => { expect(hash(cast, outfit)).toBe(pin); }, 300_000);
});
