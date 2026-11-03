/**
 * build — a mount card in a register, resolved into what the solver and the pose read: every length scaled, every
 * trunk landmark placed, the standing pose SOLVED (the blade's rest, the limbs' standing swing, the reciprocal
 * coupling's constant, the standing loads and pastern slopes), and the share of the weight each pair carries from where
 * the hooves stand about the centre of mass. Pure and deterministic; the same card and register give the same build.
 */
import { MOUNTS, REGISTERS } from './cards.js';
import { MECHANICS, REFERENCE_HORSE } from './reference.js';
import { solveFore, solveHind, hoofOnGround, swingAngle, dir, sub, mul, add } from './limb.js';
import { legPlane } from './pose.js';

const DEG = Math.PI / 180;

/**
 * The fetlock's extension (radians past the cannon's line) under a vertical force F (body weights): the suspensory
 * apparatus sinks it, stiffening as it goes, from its standing angle under the standing load.
 */
export function fetlockExt(B, pair, F) {
  const { drop, F0 } = MECHANICS.fetlock[pair];
  const D = (f) => drop * (1 - Math.exp(-f / F0));
  return (90 - B[pair].slope + D(F) - D(B.share[pair] / 2)) * DEG;
}

/**
 * The hoof on the ground at `g` (y), pitched `eta`, and the fetlock over it for a cannon at angle `cannon` and an
 * extension `ext`: the pastern runs at the cannon's angle plus the extension (the coffin joint takes the rest).
 */
export function fetlockOver(B, pair, g, cannon, ext, eta = 0) {
  const h = hoofOnGround(g, eta, B.hoof), pastern = cannon + ext;
  return { ...h, F: sub(h.coffin, mul(dir(pastern), B[pair].pastern)), pastern };
}

/** solve a leg standing on its hoof: the fetlock's place and the cannon's angle found together (fixed iterations) */
export function standOn(B, pair, g, F, eta, solveTo, cannon0 = -Math.PI / 2) {
  const ext = fetlockExt(B, pair, F);
  let cannon = cannon0, d, sol;
  for (let i = 0; i < 6; i++) { d = fetlockOver(B, pair, g, cannon, ext, eta); sol = solveTo(d.F); cannon = sol.cannon; }
  d = fetlockOver(B, pair, g, cannon, ext, eta);
  return { distal: d, solve: solveTo(d.F) };
}

export function resolveMount(word = 'horse', { register = 'realistic' } = {}) {
  const card = MOUNTS[word];
  if (!card) throw new Error(`mount: '${word}' is not one of ${Object.keys(MOUNTS).join(', ')}`);
  const R = REGISTERS[register];
  if (!R) throw new Error(`mount: register '${register}' is not one of ${Object.keys(REGISTERS).join(', ')}`);
  const lg = R.leg, dz = (lg - 1) * card.trunk.hip[1];
  const T = Object.fromEntries(Object.entries(card.trunk).filter(([k]) => k !== 'neck').map(([k, p]) => [k, [p[0], p[1] + dz]]));
  const base = [card.trunk.neck[0][0], card.trunk.neck[0][1] + dz];
  T.neck = card.trunk.neck.map((p) => add(base, mul(sub([p[0], p[1] + dz], base), R.neck)));
  const fore = { ...card.fore, humerus: card.fore.humerus * lg, radius: card.fore.radius * lg, cannon: card.fore.cannon * lg, pastern: card.fore.pastern * lg };
  const hind = { ...card.hind, femur: card.hind.femur * lg, tibia: card.hind.tibia * lg, cannon: card.hind.cannon * lg, pastern: card.hind.pastern * lg };
  const hs = lg * R.hoof;
  const hoof = { toe: card.hoof.toe * hs, heel: card.hoof.heel * hs, coffin: card.hoof.coffin * hs };
  const scap = { length: card.scapula.length * lg, slope: card.scapula.slope, pivot: card.scapula.pivot };
  const head = { length: card.head.length * R.head, carriage: card.head.carriage, ear: card.head.ear * R.ear, jaw: card.head.jaw * R.head };
  // the forehand's share from where the hooves stand about the centre of mass (y = 0): the moments balance
  const share = { fore: -hind.hoofY / (fore.hoofY - hind.hoofY) };
  share.hind = 1 - share.fore;

  const B = { word, register, card, motion: R.motion, trunk: T, fore, hind, hoof, scapula: scap, head, tail: card.tail, sockets: card.sockets, share };
  B.hip = T.hip[1];                                              // the leg of dynamic similarity
  B.scale = B.hip / REFERENCE_HORSE.hip;
  B.foreL = { b: scap.length * (1 - scap.pivot), top: scap.length * scap.pivot, humerus: fore.humerus, radius: fore.radius, cannon: fore.cannon };
  B.hindL = { femur: hind.femur, tibia: hind.tibia, cannon: hind.cannon };
  B.bladeRest = -scap.slope * DEG;

  // THE STAND, solved: the hooves flat where they stand, each pair under its standing load, each leg in its plane
  // (through its girdle's joint and its hoof's line: the in-plane height of the girdle a little over its height)
  const planeF = legPlane([fore.girdleX, T.scapulaPivot[0], T.scapulaPivot[1]], fore.hoofX);
  const planeH = legPlane([hind.girdleX, T.hip[0], T.hip[1]], hind.hoofX);
  const pivot2 = [T.scapulaPivot[0], planeF.D], hip2 = [T.hip[0], planeH.D];
  B.swing0 = 0; B.hindSwing0 = 0;
  const foreTo = (F) => solveFore({ pivot: pivot2, L: B.foreL, rest: B.bladeRest, swing0: B.swing0, kS: MECHANICS.scapula, target: F });
  // the blade's standing swing is the limb's own: solve once for the line, then hold it as the rest
  B.swing0 = swingAngle(pivot2, standOn(B, 'fore', fore.hoofY, share.fore / 2, 0, foreTo).distal.F);
  const sf = standOn(B, 'fore', fore.hoofY, share.fore / 2, 0, foreTo);
  const sh = standOn(B, 'hind', hind.hoofY, share.hind / 2, 0, (F) => solveHind({ hip: hip2, L: B.hindL, target: F, hockFixed: hind.hock * DEG }));
  B.reciprocal = { k: MECHANICS.reciprocal, c0: hind.hock * DEG - MECHANICS.reciprocal * sh.solve.stifleFlex, hockMin: 5 * DEG };
  B.hindSwing0 = swingAngle(hip2, sh.distal.F);
  B.stand = { fore: { ...sf.solve, distal: sf.distal }, hind: { ...sh.solve, distal: sh.distal } };
  return B;
}
