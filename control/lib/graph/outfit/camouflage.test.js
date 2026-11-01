// camouflage.test.js — a layer printed in a camouflage (outfit/camouflage.js): its words, its ground as the layer's tone
// (the operator's palette over it), and its marks as field paint: one pattern per kind of mark (chosen in code from CAMOS),
// on a stub recipe: every piece a convex polygon the validator takes, the same dice the same marks, each colour repainting
// only its layers' groups and the colours before it; on the game body, its cloth and its skin painted as cloth cut into
// the colours. A language with no camouflage paints nothing.
import { describe, it, expect } from 'vitest';
import { CAMOS, camoTone, camoFieldPaint, isCamo } from './camouflage.js';
import { CAMO_WORDS, PATTERN_WORDS, WEAVE_WORDS, validateOutfitCard, SEEDED_OUTFITS } from './styles.js';
import { outfitTones } from './expand.js';
import { validateFieldPaint, fieldPaintOf } from '../polygonizer/field-paint.js';
import { heroFieldPaint } from '../polygonizer/hero-emblem.js';
import { heroRecord, expandLayeredManifest } from '../../mcp/tools/layered.js';
import { withDefaultForm } from '../polygonizer/motion-stamp.js';
import { compileLayered } from '../polygonizer/station-loft.js';

/** a stub piece: a tube `r` round, from z0 to z1, about x */
const tubeAt = (x, r, z0, z1, group) => ({ group, slots: ['a', 'b', 'c', 'd'], stations: [z0, z1].map((z, i) => ({ id: `st${i}`, points: { a: [x + r, 0, z], b: [x, r, z], c: [x - r, 0, z], d: [x, -r, z] } })) });
const STUB = { parts: { top_torso: tubeAt(0, 0.16, 1.05, 1.45, 'Top'), bottomLeg_thighR: tubeAt(0.1, 0.08, 0.5, 0.95, 'Bottom'), pectoralR: tubeAt(0.08, 0.05, 1.3, 1.36, 'Top'), shoes: tubeAt(0.1, 0.05, 0, 0.1, 'Shoes') } };
const fatigues = (pattern, more = {}) => ({ type: 'outfit', style: 'fatigues', language: { top: { family: 'woven', sleeve: 'long', hem: 'hip', collar: true, pattern }, bottom: { family: 'woven', leg: 'long', cut: 'straight', pattern }, ...more } });
const lang = (pattern) => ({ top: { pattern }, bottom: { pattern } });

describe('camouflage', () => {
  it('its words are the patterns, beside the weaves; a card printed in one is valid', () => {
    expect([...CAMO_WORDS].sort()).toEqual(Object.keys(CAMOS).sort());
    expect(PATTERN_WORDS).toEqual([...WEAVE_WORDS, ...CAMO_WORDS]);
    expect(CAMO_WORDS.some((w) => WEAVE_WORDS.includes(w))).toBe(false);
    const w = CAMO_WORDS[0];
    expect(isCamo(w)).toBe(true); expect(isCamo(WEAVE_WORDS[0])).toBe(false);
    const card = SEEDED_OUTFITS.fatigues;
    expect(validateOutfitCard({ ...card, language: { ...card.language, bottom: { ...card.language.bottom, pattern: w } } })).toEqual([]);
  });

  it('its ground is the layer\'s tone, suggested under the operator\'s palette', () => {
    const w = CAMO_WORDS[0];
    expect(camoTone(lang(w))).toEqual({ Top: CAMOS[w].ground, Bottom: CAMOS[w].ground });
    expect(outfitTones(fatigues(w))).toMatchObject({ Top: CAMOS[w].ground, Bottom: CAMOS[w].ground });
    expect(outfitTones(fatigues(WEAVE_WORDS[0])).Top).toBe(SEEDED_OUTFITS.fatigues.tones.Top);
    const R = expandLayeredManifest({ kind: 'layered', hero: heroRecord(withDefaultForm({ cast: 'male', outfit: fatigues(w), palette: { Top: '#112233' } })) }).recipe;
    expect(R.palette.Top).toBe('#112233');
    expect(R.palette.Bottom).toBe(CAMOS[w].ground);
  });

  it('each kind of mark: convex pieces the field paint takes, the same dice the same marks, repainting its groups and the colours before it', () => {
    const byMark = new Map();
    for (const [w, C] of Object.entries(CAMOS)) for (const M of C.colours) if (!byMark.has(M.mark)) byMark.set(M.mark, w);
    for (const w of new Set(byMark.values())) {
      const E = camoFieldPaint(lang(w), STUB);
      expect(validateFieldPaint(E)).toEqual([]);
      expect(camoFieldPaint(lang(w), STUB)).toEqual(E);
      expect(E.length).toBe(CAMOS[w].colours.length * 5);
      for (const e of E) {
        // (its parts the layers' and their groups' (the pectoral painted as the shirt), never the shoes)
        expect(e.part).toEqual(['bottomLeg_thighR', 'pectoralR', 'top_torso']);
        const ci = CAMOS[w].colours.findIndex((M) => M.color === e.color);
        expect(e.only).toEqual(['Top', 'Bottom', ...E.filter((x) => x.chart === 'front').slice(0, ci).map((x) => x.group)]);
      }
    }
  });

  it('a language with no camouflage paints nothing; a manifest\'s own field paint is kept as it is', () => {
    expect(camoFieldPaint(lang(WEAVE_WORDS[0]), STUB)).toBeNull();
    expect(camoFieldPaint(null, STUB)).toBeNull();
    const m = expandLayeredManifest({ kind: 'layered', hero: heroRecord(withDefaultForm({ cast: 'male', outfit: fatigues(WEAVE_WORDS[0]) })) });
    expect(heroFieldPaint(m)).toBe(m.fieldPaint);
  });

  it('on the game body, the cloth and the skin painted as cloth cut into its colours, the shoes left', () => {
    const w = CAMO_WORDS[0], m = expandLayeredManifest({ kind: 'layered', hero: heroRecord(withDefaultForm({ cast: 'male', outfit: fatigues(w) })) });
    const E = heroFieldPaint(m), mesh = compileLayered(m.recipe, m.dials || {}), F = fieldPaintOf(mesh, E), parts = new Set(), colours = new Set();
    for (let fi = 0; fi < mesh.faces.length; fi++) for (const c of F.cut(fi) ?? []) if (c.group.startsWith('Camo')) { parts.add(mesh.provenance[mesh.faces[fi][0]].part); colours.add(c.group); }
    expect([...parts].some((k) => k.startsWith('top'))).toBe(true);
    expect([...parts].some((k) => k.startsWith('bottom'))).toBe(true);
    expect([...parts].every((k) => ['Top', 'Bottom'].includes(m.recipe.parts[k].group))).toBe(true);
    expect(colours.size).toBe(CAMOS[w].colours.length);
  });
});
