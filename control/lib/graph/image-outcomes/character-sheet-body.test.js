// character-from-dream C1 — the character-sheet body channel. A sheet's
// turnaround rows derive from ONE tuned body (character.rig) wearing per-outfit
// wardrobe, over four REAL cameras. Prose-only sheets (no rig) are unchanged.
import { describe, expect, it } from 'vitest';

import { normalizeCharacterSheetManifest } from './manifest.js';
import { renderScaffoldSvg, SHEET_VIEW_CAMERA } from './scaffold.js';

const BODY = { sex: 'female', height: 1.02, stockiness: 1.1 };

function sheet(overrides = {}) {
  return normalizeCharacterSheetManifest({
    title: 'mechanic sheet',
    character: {
      id: 'mechanic',
      description: 'stocky mature female harbor mechanic, short hair',
      rig: { proto: BODY },
      outfits: [
        { id: 'work', description: 'jacket over tank, baggy trousers', garment: ['tank', 'trousersBaggy'] },
        { id: 'formal', description: 'a dress', garment: 'dress' },
      ],
      ...overrides.character,
    },
    ...overrides,
  });
}

const polyCount = (svg) => (svg.match(/<polygon/g) || []).length;

describe('character-sheet body channel (C1)', () => {
  it('the four turnaround columns map to four DISTINCT figure cameras (not repeats)', () => {
    const cams = Object.values(SHEET_VIEW_CAMERA);
    expect(cams).toEqual(['frontal', 'three-quarter', 'lateral', 'back']);
    expect(new Set(cams).size).toBe(4);
  });

  it('normalizes the shared body (rig) + per-outfit wardrobe', () => {
    const m = sheet();
    expect(m.character.rig.proto).toEqual(BODY);
    expect(m.character.outfits[0].garment).toEqual(['tank', 'trousersBaggy']);
    expect(m.character.outfits[1].garment).toBe('dress');
  });

  it('renders filled figure guides (a real turnaround, not a stick strip)', () => {
    const svg = renderScaffoldSvg(sheet());
    // 2 outfits × 4 views of a fleshed protoform = thousands of lit polygons.
    expect(polyCount(svg)).toBeGreaterThan(1000);
    // control mode (the paint scaffold) also renders the figures.
    expect(polyCount(renderScaffoldSvg(sheet(), { control: true }))).toBeGreaterThan(1000);
  });

  it('per-outfit garment changes the row while the body stays the same', () => {
    const both = renderScaffoldSvg(sheet());
    // Same sheet but both outfits share ONE garment → the two rows become
    // geometrically identical wardrobe; different-garment rows must diverge.
    const same = renderScaffoldSvg(sheet({
      character: {
        id: 'mechanic', description: 'stocky mature female harbor mechanic, short hair', rig: { proto: BODY },
        outfits: [
          { id: 'work', description: 'a dress', garment: 'dress' },
          { id: 'formal', description: 'a dress', garment: 'dress' },
        ],
      },
    }));
    expect(both).not.toEqual(same);
  });

  it('accepts a fluff-register body (mascot/mech)', () => {
    const m = normalizeCharacterSheetManifest({
      title: 'mascot sheet',
      character: {
        id: 'bot', description: 'a round action-figure robot',
        rig: { fluffs: [{ shape: 'football', segment: ['neckHub', 'pelvisHub'], girth: 0.5 }] },
        outfits: [{ id: 'default', description: 'bare chassis' }],
      },
    });
    expect(m.character.rig.fluffs).toHaveLength(1);
    expect(polyCount(renderScaffoldSvg(m))).toBeGreaterThan(100);
  });

  it('prose-only sheets (no rig) keep working — no body required', () => {
    const m = normalizeCharacterSheetManifest({
      title: 'prose sheet',
      character: { id: 'x', description: 'a person', outfits: [{ id: 'a', description: 'casual' }] },
    });
    expect(m.character.rig).toBeUndefined();
    expect(() => renderScaffoldSvg(m)).not.toThrow();
  });

  describe('closed-vocabulary refusals at mint', () => {
    const mk = (character) => () => normalizeCharacterSheetManifest({ title: 't', character });

    it('rejects an unknown wardrobe key on an outfit', () => {
      expect(mk({ id: 'x', description: 'p', rig: { proto: BODY }, outfits: [{ id: 'a', description: 'd', garment: 'toga' }] }))
        .toThrow(/not a wardrobe key/);
    });

    it('rejects an unknown wardrobe key on the shared body rig', () => {
      expect(mk({ id: 'x', description: 'p', rig: { proto: BODY, garment: 'toga' }, outfits: [{ id: 'a', description: 'd' }] }))
        .toThrow(/not a wardrobe key/);
    });

    it('rejects outfit figure dials without a rig (a wardrobe needs a body)', () => {
      expect(mk({ id: 'x', description: 'p', outfits: [{ id: 'a', description: 'd', garment: 'tank' }] }))
        .toThrow(/declares no rig/);
    });

    it('rejects a malformed fluff spec', () => {
      expect(mk({ id: 'x', description: 'p', rig: { fluffs: [{ shape: 'notashape' }] }, outfits: [{ id: 'a', description: 'd' }] }))
        .toThrow(/fluffs/);
    });

    it('rejects an inline garment spec with a bad cut kind', () => {
      expect(mk({
        id: 'x', description: 'p', rig: { proto: BODY },
        outfits: [{ id: 'a', description: 'd', garment: { id: 'p', pieces: [{ fit: 'drape' }], cuts: [{ kind: 'zigzag' }] } }],
      })).toThrow(/is not one of/);
    });
  });
});
