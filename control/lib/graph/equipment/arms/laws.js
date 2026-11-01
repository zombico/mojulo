// equipment/arms/laws — the laws a modern or a future arm is built and read by: what makes a gun or a knife hold up in
// the seventh-generation look (era/eras.js gen-7: a live key over the surface, materials told apart by how they
// reflect), as arithmetic over two dials and a line.
//
//   1. SILHOUETTE FROM THE SIDE. An arm is read side-on first: the grip's rake, the gap of the trigger guard, the
//      magazine's drop, the stock's line. Every major part is drawn as its side outline and pushed through its width,
//      never assembled from boxes, so the read at a game camera is the arm's and not a crate's.
//   2. THE CHAMFER CATCHES THE KEY. A square edge under a live light draws no line; a chamfer draws a highlight along
//      the silhouette and parts the faces. Every hard part carries one, sized to its thickness (12 % realistic → 20 %
//      stylized), never under a floor, and the future line's broad facets twice that (chamferOf).
//   3. MATERIAL BY RESPONSE. Three responses at least, told apart by how they reflect before their colour: bare metal
//      (slide, barrel, blade), a finish (polymer, paint, wood) and the hand's own (rubber, stipple, cord) — plus the
//      dark of a bore or a port. A future arm adds ONE emissive hue, never two (a glow is a focal, laws 1 and 5 of
//      equipment/principles.js).
//   4. THE BORE IS ONE LINE. Sights, barrel, muzzle and rail sit on one line; the grip rakes back off it (18°) with
//      the trigger in the finger's reach inside the guard; the fist's place (the grip socket) and the muzzle are where
//      a hero's hand and aim already go (polygonizer/hero-gear.js).
//   5. DETAIL IN THREE TIERS. Primary: the silhouette. Secondary: the parts (slide, receiver, magazine, guard, stock).
//      Tertiary: serrations, rail teeth, vents, pins. The tertiary pitch widens as `stylize` rises (fewer, bigger), and
//      nothing is thinner than the readability floor (equipment/principles.js law 4).
//   6. NEGATIVE SPACE READS. The trigger guard's opening, a skeleton stock's window, the gap under a carry rail stay
//      open by at least a finger's width (1.6 cm in a guard): an opening is part of the silhouette.
//   7. THE FUTURE IS A TRANSFORM OF THE SAME MECHANICS. The future line keeps every station (grip, bore, sights,
//      magazine, stock) and changes the shape language: broad facets, a shell split by a dark gap, a lit conduit
//      along the bore and an emitter at the muzzle, a cell where the magazine was. So a blaster is held as a pistol.
//   8. A BLADE READS BY ITS GRIND. A knife's flat is ground toward the spine, its edge a secondary bevel of a brighter
//      response (a coated blade's sharpened edge), so the edge draws a line under the key at any angle; a future
//      blade's edge is the glow.
//
// Pure arithmetic; no dice. ARMS_LAWS_VERSION is stamped on every minted arm (the build's `laws`): a change here that
// moves an arm's bytes is a new version.

export const ARMS_LAWS_VERSION = 1;
export const LINES = Object.freeze(['modern', 'future']);

export const ARMS_LAWS = Object.freeze([
  { id: 'silhouette-from-the-side', line: 'Every major part is its side outline pushed through its width: the rake, the guard, the magazine and the stock read side-on.' },
  { id: 'chamfer-catches-the-key', line: 'Every hard part is chamfered to its thickness (12 % → 20 % as it stylizes, twice for the future line), never under the floor.' },
  { id: 'material-by-response', line: 'Bare metal, a finish and the hand\'s grip, plus the dark of a bore: three responses at least; a future arm one glow hue.' },
  { id: 'bore-is-one-line', line: 'Sights, barrel, muzzle and rail on one line; the grip raked back 18° with the trigger in the guard.' },
  { id: 'detail-in-three-tiers', line: 'Silhouette, parts, then serrations, teeth and vents, fewer and bigger as it stylizes.' },
  { id: 'negative-space-reads', line: 'A trigger guard keeps a finger\'s opening (1.6 cm); a skeleton stock its window.' },
  { id: 'future-transforms-the-same-mechanics', line: 'The future line keeps every station and changes the language: facets, a shell gap, a conduit, an emitter, a cell.' },
  { id: 'blade-reads-by-its-grind', line: 'A blade is ground toward its spine, its edge a brighter secondary bevel (or the glow).' },
]);

const lerp = (a, b, t) => a + (b - a) * t;
const r3 = (v) => Math.round(v * 1000) / 1000;
/** the chamfer floor (cm): about a pixel at the close framing of a 1080p target (era/target.js) */
export const CHAMFER_FLOOR = 0.12;
/** the grip's rake off the perpendicular to the bore (°) */
export const GRIP_RAKE = 18;
/** a trigger guard's opening, front to back (cm) */
export const GUARD_OPENING = 1.6;

/** Law 2: a part's chamfer from its thickness (cm), the stylize dial and the line. */
export function chamferOf(thick, { stylize = 0, line = 'modern' } = {}) {
  const share = lerp(0.12, 0.2, stylize) * (line === 'future' ? 2 : 1);
  return r3(Math.min(thick * 0.32, Math.max(CHAMFER_FLOOR * (1 + stylize), thick * share)));
}

/** Law 5: a tertiary detail's pitch (cm) from its realistic pitch, wider as the item stylizes. */
export const pitchOf = (base, stylize = 0) => base * lerp(1, 2.2, stylize);

/** How the stylize and mass dials scale an arm's parts: girth (widths and thickness), its length, the hand's parts. */
export function armsProportion({ stylize: s = 0, mass = 1 } = {}) {
  return { girth: mass * lerp(1, 1.3, s), length: lerp(1, 0.9, s), hand: lerp(1, 1.18, s), sight: lerp(1, 1.5, s) };
}
