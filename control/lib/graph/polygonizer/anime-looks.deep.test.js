/** Looks, swept (the deep tier: `npm run test:deep`, and CI): every look built on both bases. anime-looks.test.js keeps the
 * tables and the composition laws. Looks (anime-looks.js): presets as words that compose. The tables are disjoint; every preset builds a closed head whose
 * eyes read (unless its pose closes them) with no advice at its own values; composition keeps its laws. */
import { describe, it, expect } from 'vitest';
import { ANIME_LOOKS, LOOK_TABLES, LOOK_WORDS, validateLook, resolveLook, lookEntries, composeAnime } from './anime-looks.js';
import { animeHead, animeFaceWarnings, animeHairWarnings, animeExpressionWarnings, ANIME_FACE_MOVES, ANIME_HAIR_MOVES, ANIME_POSES, ANIME_HAIR_BASE, resolveAnimeHair } from './anime-head.js';
import { tuneWarnings } from './hero-form.js';
import { ANIME_SCULPT_MOVES, animeSculptWarnings } from './anime-sculpt.js';
import { compileLayered, auditLayered } from './station-loft.js';
import { layeredExposure } from './station-loft-exposure.js';

const failures = (m) => Object.entries(auditLayered(m)).filter(([, r]) => !r.pass).map(([n]) => n);
const closedEyes = (e) => e.blink >= 0.985;

describe('looks: every preset builds', () => {
  // (on the graphic face, the anime head's default: the face words' slider read is its face layer times the word; the
  // hair advice reads past the words' own values, as the door reads it — a cut's authored lock edits past ±0.2 are the
  // word's, not the operator's)
  const words = [...LOOK_TABLES.archetype, ...LOOK_TABLES.face, ...LOOK_TABLES.sculpt, ...Object.keys(ANIME_HAIR_MOVES), ...LOOK_TABLES.pose];
  for (const preset of ['female', 'male']) for (const w of words) it(`${preset} · ${w}: closed, the eyes read, no advice at its own values`, () => {
    const eff = composeAnime({ lookResolved: resolveLook([w]), face: {}, hair: { style: null, locks: {} } }, preset === 'male' ? 'short' : 'bob');
    expect([...animeFaceWarnings(eff.face, preset, { sculpt: eff.sculpt }), ...animeSculptWarnings(eff.sculpt), ...animeHairWarnings(eff.hair, { words: eff.hairWords }), ...animeExpressionWarnings(eff.expression), ...tuneWarnings(eff.tune)]).toEqual([]);
    const mesh = compileLayered(animeHead({ preset, face: eff.face, hair: eff.hair, expression: eff.expression, sculpt: eff.sculpt }));
    expect(failures(mesh)).toEqual([]);
    if (!closedEyes(eff.expression)) { const ex = layeredExposure(mesh, { res: 192 }); for (const e of ['irisR', 'irisL']) expect(['reads', 'faint']).toContain(ex.parts[e]?.flag); }
  });
});
