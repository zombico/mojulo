/**
 * Concept-board fixture — the fidelity + casting dials at their far ends:
 * `fidelity: 'concept'` (frames ARE production design) and
 * `casting: 'explore'` (no locked character exists; the worker designs
 * the cast on a design plate, then holds its own design).
 *
 * Deliberately NO style preset: concept exploration is the
 * max-capability path the styles shelf leaves open by omission — the
 * point is to discover the production's look, not to lock one in advance.
 *
 * Pure data — no Date, no dice. See storyboard.plan.md (fidelity addendum).
 */

const W = 1536;
const H = 864;

// The cast as a DESIGN BRIEF — a starting point, not a locked identity.
export const KES = {
  id: 'kes',
  name: 'Kes',
  description:
    'the orchard keeper — weathered, patient, agile on cliff paths; carries a long tuning hammer for ringing the glass trees; clothing should read as workwear evolved for a coast where everything is abrasive salt and sharp glass',
};

export function conceptBoardFixture() {
  return {
    kind: 'storyboard',
    title: 'The Saltglass Orchard — concept pass',
    intent: 'A four-shot concept board for an unproduced short: on a cliff coast, an orchard of glass trees grown from sea-salt is tended by a lone keeper who tunes them against storms. These frames DESIGN the production — the orchard, the keeper, the light.',
    frame: { width: W, height: H },
    fidelity: 'concept',
    casting: 'explore',
    characters: [KES],
    renderBrief: {
      style: 'production concept art for an animated short — designed, specific, atmospheric',
      mood: 'windswept, crystalline, quietly wondrous',
      lighting: 'low coastal sun refracting through glass foliage',
      mayInvent: ['the glass trees\' entire design language', 'the keeper\'s tools and rigging', 'cliff architecture', 'weather'],
      negative: ['no readable text anywhere', 'no arrows, motion lines, or annotation graphics'],
    },
    shots: [
      {
        id: 'c1',
        scene: 'Scene 1 — The orchard',
        beat: 'Wide establishing: the saltglass orchard on the cliff shelf at low sun — ranks of glass trees refracting the light, the sea far below.',
        camera: { kind: 'wide-establishing', horizonY: 350 },
        horizonY: 350,
        cameraMove: 'pan-right',
        seconds: 6,
        sfx: 'wind; faint chiming',
        forms: [
          { id: 'sea', role: 'sea far below the cliff', depthBand: 'background', depthRank: 0, preserve: 'loose', polygon: [[0, 290], [W, 290], [W, 430], [0, 430]] },
          { id: 'cliff-shelf', role: 'the orchard shelf', depthBand: 'midground', depthRank: 1, preserve: 'strict', polygon: [[0, 560], [W, 500], [W, H], [0, H]], materialHint: 'salt-crusted rock' },
          { id: 'orchard-rows', role: 'ranks of glass trees', depthBand: 'midground', depthRank: 2, preserve: 'guided', polygon: [[180, 300], [1380, 260], [1440, 560], [120, 620]], materialHint: 'DESIGN THIS: glass foliage, grown not built' },
        ],
        figures: [],
      },
      {
        id: 'c2',
        scene: 'Scene 1 — The orchard',
        beat: 'Kes walks the orchard rows with the tuning hammer, small under the glass canopy.',
        camera: { kind: 'wide-cinematic', horizonY: 330 },
        horizonY: 330,
        cameraMove: 'track-left',
        seconds: 5,
        forms: [
          { id: 'canopy', role: 'glass canopy overhead', depthBand: 'background', depthRank: 0, preserve: 'guided', polygon: [[0, 0], [W, 0], [W, 360], [0, 400]], materialHint: 'refracted low sun through glass leaves' },
          { id: 'row-floor', role: 'orchard row floor', depthBand: 'foreground', depthRank: 2, preserve: 'strict', polygon: [[0, 620], [W, 580], [W, H], [0, H]], materialHint: 'salt gravel, fallen glass leaves' },
        ],
        figures: [{ id: 'kes', x: 640, y: 520, scale: 1.0, pose: 'walk', character: 'kes', move: 'cross-left' }],
      },
      {
        id: 'c3',
        scene: 'Scene 2 — The tuning',
        beat: 'Close on Kes at a tree trunk: hammer raised, listening — the character study frame; costume and tools read clearly.',
        camera: { kind: 'close-up' },
        cameraMove: 'static',
        seconds: 4,
        dialogue: 'KES: *Hold, old one. Hold.*',
        forms: [
          { id: 'trunk', role: 'glass tree trunk', depthBand: 'midground', depthRank: 1, preserve: 'strict', polygon: [[980, 60], [1220, 60], [1260, H], [940, H]], materialHint: 'DESIGN THIS: grown glass, salt-fogged, resonant' },
        ],
        figures: [{ id: 'kes', x: 620, y: 470, scale: 1.5, pose: 'reach', character: 'kes' }],
      },
      {
        id: 'c4',
        scene: 'Scene 2 — The tuning',
        beat: 'Low angle up through the canopy: the storm front arrives beyond the ringing trees; Kes braced at the trunk below.',
        camera: { kind: 'low-angle-hero', horizonY: 600 },
        horizonY: 600,
        cameraMove: 'push-in',
        seconds: 5,
        transition: 'dissolve',
        sfx: 'the orchard ringing, storm bass under it',
        forms: [
          { id: 'storm-front', role: 'incoming storm wall', depthBand: 'background', depthRank: 0, preserve: 'guided', polygon: [[0, 0], [W, 0], [W, 340], [0, 300]], materialHint: 'a designed weather event, not generic clouds' },
          { id: 'canopy-up', role: 'canopy seen from below', depthBand: 'midground', depthRank: 1, preserve: 'guided', polygon: [[100, 180], [1440, 220], [1300, 620], [220, 580]], materialHint: 'glass branches against the storm light' },
        ],
        figures: [{ id: 'kes', x: 760, y: 700, scale: 0.9, pose: 'brace', character: 'kes' }],
      },
    ],
  };
}
