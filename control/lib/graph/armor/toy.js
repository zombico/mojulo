// armor/toy — the TOY family: the toy hero robot's armour (game-bodies.js `herobot`), moulded VOLUMES on the rig rather
// than shells that follow the body. Its read is GIRTH CONTRAST: a ball on each shoulder, a barrel over the chest, the
// forearms swelling to a flared cuff, boots widening toward the feet on half-egg soles, against the slim limbs between
// them (the bodysuit). As an adornment kit for the hero. Pure data out; no dice.
//
// The family's own reads of the laws:
//   - BULK IS GIRTH. A piece is a volume round its part (the `volume` signature, station-loft-adorn.js), its girth a
//     share of the limb's own; `mass` scales how far each swells past the limb (1 the card's; 2 twice the swell).
//   - THE CONTRAST IS THE SILHOUETTE. The pieces stand at the joints and the ends (the shoulder, the forearm, the shank
//     and the foot, the chest), never along a whole limb: the slim runs between them are what make them read.
//   - ORNAMENT IS THE TRIM. 0 bare volumes; 1 their cuffs (a lip in the trim, `Cuff`); 2 and over the plaques on the
//     chest (the pecs, the ab plate) and a rim round each thigh.
//
// Coverage (law 9, per family), in order: the chest, the boots and their soles, the forearms, the pauldrons, the brief,
// the knees, the collar, the thigh rims and the plaques. The helm is not the family's: the hero robot's helm is a
// headgear card (headgear/cards.js heroBotHelm), worn with the suit as the build's `with`.
//
// Language words (each optional; absent, the piece as the card has it): pauldron ball | none, chest barrel | none,
// arms football | none, legs cone | none, knees cap | none, collar band | none, brief brief | none, cannon none | R | L (the
// arm cannon on that arm: never at the card's default, a run and gun's hero names it).
import { r4 } from './plate.js';

export const TOY_ORDER = Object.freeze([[0.0, 'chest'], [0.1, 'boot'], [0.2, 'forearm'], [0.3, 'pauldron'], [0.45, 'brief'], [0.55, 'knee'],
  [0.65, 'collar'], [0.8, 'thighRim'], [0.9, 'plaque']]);
export const TOY_WORDS = Object.freeze({ pauldron: ['ball', 'none'], chest: ['barrel', 'none'], arms: ['football', 'none'], legs: ['cone', 'none'],
  knees: ['cap', 'none'], collar: ['band', 'none'], brief: ['brief', 'none'], cannon: ['none', 'R', 'L'] });
// which language word turns each piece off
const OFF = Object.freeze({ pauldron: 'pauldron', chest: 'chest', forearm: 'arms', boot: 'legs', knee: 'knees', collar: 'collar', brief: 'brief' });

// THE PIECES, one side's (the right's: a paired piece is mirrored to the left), as the toy hero robot's cast laid them on
// the hero's rig: each a part's stations (`s`), its volume's girth a share of the limb's
// THE ARM CANNON (the buster's: worlds/controllable/buster.js), off unless the language names its arm: the forearm's form
// carried on past the wrist over the hand, ONE form with no seam at the wrist. Its barrel, round the hand, tucks up into
// the forearm piece's mouth (that arm's forearm wears no cuff at the wrist) and runs on straight, flush with it, past
// the fingertips, its end rounded in a dome and a short nozzle standing out of it, the bore dark in its face. The hand
// is inside it
const CANNON = Object.freeze({ mode: 'shell', part: 'handR', s: [0, 1], t: 'wrap', nt: 8, ns: 4, mugen: 0.001, thick: 0.001, rigid: true, group: 'Armor',
  signature: { kind: 'volume', group: 'Armor', shape: 'cone', girth: 1.62, taper: 1, n: 2.2, extend: [2.8, 2.6], m: 28, rings: 16,
    dome: { depth: 1 }, nozzle: { r: 0.42, len: 0.55, group: 'Cuff' }, bore: { group: 'Bore', r: 0.7 } } });

const PIECES = Object.freeze({
  collar: Object.freeze({"mode": "shell", "part": "neck", "s": [0.0, 0.9], "t": "wrap", "nt": 10, "ns": 3, "mugen": 0.001, "thick": 0.001, "rigid": true, "group": "Cuff", "signature": {"kind": "volume", "group": "Cuff", "shape": "cone", "girth": 1.22, "taper": 0.88, "n": 2.2, "m": 20}}),
  chest: Object.freeze({"mode": "shell", "part": "torso", "s": [1.05, 3.5], "t": "wrap", "nt": 10, "ns": 4, "mugen": 0.001, "thick": 0.001, "rigid": true, "group": "Chest", "signature": {"kind": "volume", "group": "Chest", "shape": "football", "girth": 1.12, "n": 2.0, "squash": [1.32, 0.9], "m": 32, "lip": {"group": "Cuff", "at": "low", "w": 0.12, "out": 0.03}, "base": 0.72, "peak": 0.62, "mouth": 0.68, "rings": 18}}),
  pec: Object.freeze({"mode": "shell", "part": "torso", "side": "R", "s": [1.9, 2.3], "t": [0.5, 1.0], "nt": 2, "ns": 1, "mugen": -0.02, "thick": 0.001, "rigid": true, "group": "Pec", "signature": {"kind": "plaque", "group": "Pec", "s": [1.45, 2.6], "w": [0.36, 0.44], "c": 0.78, "lift": 0.024, "thick": 0.007, "bevel": 0.82}}),
  abplate: Object.freeze({"mode": "shell", "part": "torso", "side": "R", "s": [0.9, 1.3], "t": [0, 0.3], "nt": 2, "ns": 1, "mugen": -0.02, "thick": 0.001, "rigid": true, "group": "Plaque", "signature": {"kind": "plaque", "group": "Plaque", "s": [0.77, 1.58], "w": [0.3, 0.51], "lift": 0.034, "thick": 0.007, "bevel": 0.84}}),
  brief: Object.freeze({"mode": "shell", "part": "pelvis", "s": [0.6, 4.6], "t": "wrap", "nt": 10, "ns": 4, "mugen": 0.001, "thick": 0.001, "rigid": true, "group": "Armor", "signature": {"kind": "volume", "group": "Armor", "shape": "football", "girth": 1.1, "n": 2.4, "squash": [1.24, 0.98], "m": 24, "lip": {"group": "Cuff", "at": "high", "w": 0.14, "out": 0.03}, "base": 0.88, "peak": 0.6, "mouth": 0.8}}),
  pauldron: Object.freeze({"mode": "shell", "part": "upperArmR", "s": [0.0, 0.9], "t": "wrap", "nt": 10, "ns": 4, "mugen": 0.001, "thick": 0.001, "rigid": true, "group": "Armor", "signature": {"kind": "volume", "group": "Armor", "shape": "bead", "girth": 2.3, "at": 0.15, "squashAlong": 0.85, "rings": 15, "m": 28}, "side": "R"}),
  forearm: Object.freeze({"mode": "shell", "part": "foreArmR", "s": [0.35, 1.95], "t": "wrap", "nt": 8, "ns": 4, "mugen": 0.001, "thick": 0.001, "rigid": true, "group": "Armor", "signature": {"kind": "volume", "group": "Armor", "shape": "football", "girth": 2.05, "peak": 0.86, "mouth": 0.94, "n": 2.2, "lip": {"group": "Cuff", "at": "high", "w": 0.14, "out": 0.05}, "base": 0.5}}),
  boot: Object.freeze({"mode": "shell", "part": "shankR", "s": [0.45, 2.0], "t": "wrap", "nt": 8, "ns": 4, "mugen": 0.001, "thick": 0.001, "rigid": true, "group": "Armor", "signature": {"kind": "volume", "group": "Armor", "shape": "cone", "girth": 1.72, "taper": 1.6, "n": 2.2, "extend": [0, 0.02], "lip": {"group": "Cuff", "at": "low", "w": 0.12, "out": 0.06}}}),
  sole: Object.freeze({"mode": "shell", "part": "footR", "s": [0.0, 2.0], "t": "wrap", "nt": 8, "ns": 4, "mugen": 0.001, "thick": 0.001, "rigid": true, "group": "Armor", "signature": {"kind": "volume", "group": "Armor", "shape": "football", "girth": 2.05, "base": 0.75, "peak": 0.3, "mouth": 0.1, "n": 2.2, "squash": [1.0, 1.0], "extend": [0.45, 1.1], "half": {"cut": 0.62}, "bias": [0, -0.02, 0], "m": 28, "rings": 16}}),
  thighRim: Object.freeze({"mode": "shell", "part": "thighR", "side": "R", "s": [3.0, 3.45], "t": "wrap", "nt": 8, "ns": 3, "mugen": 0.001, "thick": 0.001, "rigid": true, "group": "Cuff", "signature": {"kind": "volume", "group": "Cuff", "shape": "cone", "girth": 1.14, "taper": 0.96, "n": 2.0, "m": 24, "rings": 6}}),
  knee: Object.freeze({"mode": "shell", "part": "shankR", "side": "R", "s": [0.0, 0.6], "t": "wrap", "nt": 8, "ns": 3, "mugen": 0.001, "thick": 0.001, "rigid": true, "group": "Armor", "signature": {"kind": "volume", "group": "Armor", "shape": "bead", "girth": 1.2, "at": 0.1, "squashAlong": 1.15, "peak": 0.3, "point": "start", "squash": [0.95, 0.7], "bias": [0, 0.4, 0], "half": {"cut": 0}, "m": 24, "rings": 13}}),
});

// a piece's mirror: the left part, the left side, a plaque's place across the chest turned over
const mirror = (p) => {
  const sig = p.signature ? { ...p.signature, ...(p.signature.kind === 'plaque' && Number.isFinite(p.signature.c) ? { c: -p.signature.c } : {}) } : p.signature;
  return { ...p, part: p.part.replace(/R$/, 'L'), ...(p.side ? { side: 'L' } : {}), signature: sig };
};
// mass: how far a volume swells past its limb (girth 1 the limb's own)
const massed = (p, mass) => (p.signature?.kind === 'volume' && Number.isFinite(p.signature.girth)
  ? { ...p, signature: { ...p.signature, girth: r4(1 + (p.signature.girth - 1) * mass) } } : p);
// ornament 0: no cuffs (a volume's lip)
const bare = (p) => (p.signature?.lip ? { ...p, signature: (({ lip, ...rest }) => rest)(p.signature) } : p);

/** a toy suit at `dials.coverage` as one kit. lang: TOY_WORDS */
export function toySuit(dials, ctx = {}, lang = {}) {
  const c = dials.coverage ?? 1, mass = dials.mass ?? 1, orn = dials.ornament ?? 1, kit = [], trace = { worn: [] };
  const lay = (id, p, paired) => {
    let q = massed(p, mass);
    if (orn < 1) q = bare(q);
    if (!paired) { kit.push({ id, ...q }); return; }
    kit.push({ id: `${id}R`, ...q }, { id: `${id}L`, ...mirror(q) });
  };
  const PIECE = {
    chest: () => lay('chest', PIECES.chest, false),
    boot: () => { lay('boot', PIECES.boot, true); lay('sole', PIECES.sole, true); },
    forearm: () => {
      const C = lang.cannon === 'R' || lang.cannon === 'L' ? lang.cannon : null;
      if (!C) { lay('forearm', PIECES.forearm, true); return; }
      // (the cannon's arm: its forearm with no cuff at the wrist, the barrel carried on out of it; the other arm as ever)
      const q = massed(orn < 1 ? bare(PIECES.forearm) : PIECES.forearm, mass), seamless = massed(bare(PIECES.forearm), mass), c = massed(CANNON, mass);
      kit.push({ id: 'forearmR', ...(C === 'R' ? seamless : q) }, { id: 'forearmL', ...mirror(C === 'L' ? seamless : q) }, { id: `buster${C}`, ...(C === 'L' ? mirror(c) : c) });
    },
    pauldron: () => lay('shoulder', PIECES.pauldron, true),
    brief: () => lay('brief', PIECES.brief, false),
    knee: () => lay('knee', PIECES.knee, true),
    collar: () => lay('neckband', PIECES.collar, false),
    thighRim: () => { if (orn >= 2) lay('thighRim', PIECES.thighRim, true); },
    plaque: () => { if (orn >= 2) { lay('pec', PIECES.pec, true); lay('abplate', PIECES.abplate, false); } },
  };
  for (const [th, piece] of TOY_ORDER) {
    if (c < th - 1e-9 || (ctx.keep && !ctx.keep.includes(piece)) || (OFF[piece] && lang[OFF[piece]] === 'none')) continue;
    const n = kit.length; PIECE[piece]();
    if (kit.length > n) trace.worn.push(piece);
  }
  return { kit, trace: { ...trace, pieces: trace.worn.length, focal: 'chest' } };
}
