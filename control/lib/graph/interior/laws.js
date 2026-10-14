/**
 * interior/laws — the numbers a room is furnished by: clearances, distances and proportions decorators and builders
 * work to, each with its source. Millimetres. A law is a target and a range; the placer aims at the target and the
 * review says when a piece falls outside the range. These are industry norms, not building code.
 *
 * LAWS_VERSION stamps every interior's readout; a retuned number is a new version (a room re-reads by the laws it was
 * built under only while the version holds — the laws are part of the kernel's compatibility promise).
 */

export const LAWS_VERSION = 'interior-laws-v1';

export const LAWS = Object.freeze({
  // ── circulation ──
  walkway: { target: 915, min: 760, line: 'a main path through a room', source: 'NKBA; common practice (36 in)' },
  'secondary-path': { target: 760, min: 610, line: 'a path between pieces, or behind a floated sofa', source: 'common practice (24–30 in)' },
  'door-approach': { target: 915, min: 760, line: 'kept clear before a doorway, the leaf’s swing and the step through', source: 'IRC R311 landing; common practice' },
  // ── the conversation group ──
  'coffee-gap': { target: 420, min: 355, max: 460, line: 'sofa front to the coffee table', source: 'common practice (14–18 in)' },
  'coffee-length': { ratio: 2 / 3, min: 0.5, max: 0.75, line: 'a coffee table about two thirds the sofa’s length', source: 'decorators’ rule of proportion' },
  'coffee-height': { target: 420, min: 380, max: 460, line: 'at the seat’s height or a little under', source: 'common practice' },
  'conversation-span': { target: 2440, max: 3050, line: 'seats that talk sit within 8–10 ft of each other', source: 'decorators’ rule (conversation circle)' },
  reach: { target: 450, max: 600, line: 'every seat within reach of a surface', source: 'decorators’ rule (18 in)' },
  'chair-gap': { target: 300, min: 150, max: 450, line: 'a chair beside the coffee table, off its end', source: 'common practice' },
  // ── the screen ──
  'tv-distance': { ratio: 1.5, min: 1.0, max: 2.5, line: 'seat to screen, times the screen’s diagonal (1–1.5 for 4K)', source: 'SMPTE / THX viewing angle 30–40°' },
  'tv-centre': { target: 1070, min: 950, max: 1250, line: 'the screen’s centre at a seated eye', source: 'common practice (42 in)' },
  // ── the rug ──
  'rug-front-legs': { target: 300, min: 150, line: 'the rug runs this far under each seat’s front, so every front leg stands on it', source: 'decorators’ rule (front legs on the rug)' },
  'rug-wall-margin': { target: 300, min: 200, max: 460, line: 'bare floor between a rug and the walls', source: 'decorators’ rule (8–18 in)' },
  'rug-bed-side': { target: 610, min: 460, line: 'a bed rug past each side of the bed', source: 'decorators’ rule (18–24 in)' },
  'rug-dining-past': { target: 610, min: 610, line: 'a dining rug past the table on every side, so a chair pulled out stays on it', source: 'decorators’ rule (24 in)' },
  // ── walls ──
  'art-centre': { target: 1475, min: 1450, max: 1525, line: 'a picture’s centre above the floor', source: 'gallery rule (57–60 in)' },
  'art-width': { ratio: 0.66, min: 0.5, max: 0.75, line: 'a picture over a piece, two thirds its width', source: 'decorators’ rule' },
  'art-gap': { target: 230, min: 150, max: 300, line: 'a picture’s bottom above the piece below it', source: 'decorators’ rule (8–10 in)' },
  // ── dining ──
  'dining-pullout': { target: 915, min: 760, line: 'table edge to the wall behind a chair', source: 'NKBA; common practice (36 in)' },
  'dining-per-diner': { target: 610, min: 560, line: 'table edge per place', source: 'common practice (24 in)' },
  // ── sleeping ──
  'bed-side': { target: 610, min: 460, line: 'a path down each side of a bed', source: 'common practice (24 in)' },
  'bed-foot': { target: 760, min: 610, line: 'the path across the foot of a bed', source: 'common practice' },
  'nightstand-height': { target: 0, min: -50, max: 50, line: 'a nightstand’s top within 2 in of the mattress', source: 'decorators’ rule' },
  'dresser-front': { target: 915, min: 760, line: 'clear before a chest, to pull a drawer and stand', source: 'common practice (36 in)' },
  // ── work ──
  'desk-chair': { target: 915, min: 760, line: 'desk edge to the wall or piece behind the chair', source: 'common practice' },
  // ── composition ──
  'negative-space': { target: 0.4, min: 0.3, line: 'the share of the floor left open (a minimal style leaves more)', source: 'decorators’ rule' },
  'lighting-layers': { target: 3, min: 3, line: 'light sources in a room, ambient, task and accent', source: 'lighting designers’ rule' },
});

/** A law by id (throws on an unknown one, so a typo in a strategy fails its test, not a room). */
export function law(id) {
  const L = LAWS[id];
  if (!L) throw new Error(`interior: no law '${id}' (${Object.keys(LAWS).join(', ')})`);
  return L;
}
