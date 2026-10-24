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
// weights, where the footwear's own copy had left them on the upper's bone; nothing else in their parts moved; the
// jacket's twice: the gi cinched 8 mm past its belt each side, so the belt is a band and not a cone up to the blouse;
// boots and sandals again at the merge of the footwear library, which makes them now (lib/graph/footwear: layered
// soles, the card's adornments), its own byte pin in footwear.char.test.js; the jacket's again at the cervical neck
// (realistic laws 3, body-relational-builds.js CERVICAL_NECK): its collar lies on the neck, which now leans up into the
// skull; the trousers and the footwear unmoved)
const PINS = {
  'gathered, male': { cast: 'male', outfit: ['martialPants'], hash: '29b724313540708d' },
  'to the floor, female': { cast: 'female', outfit: ['wideTrousers'], hash: '33172caef3f632a2' },
  'jacket over, male': { cast: 'male', outfit: ['martialPants', 'gi'], hash: 'faf7d4b2a1b068f9' },
  'jacket over, female': { cast: 'female', outfit: ['martialPants', 'gi'], hash: '13c7e7a5936a1bb7' },
  'boots, male': { cast: 'male', outfit: ['boots'], hash: 'bba218d019b9d024' },
  'sandals, female': { cast: 'female', outfit: ['sandals'], hash: '770ba3a90fec3ebf' },
};

describe('the tailored words, byte for byte', () => {
  for (const [name, { cast, outfit, hash: pin }] of Object.entries(PINS)) it(name, () => { expect(hash(cast, outfit)).toBe(pin); }, 300_000);
});
