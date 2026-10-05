// statue/principles — the laws a statue build obeys, as data and arithmetic over its words and its one dial (outfit/
// principles.js is the model: an outfit is one look spread over the body's parts; a statue is one MATERIAL spread over
// the whole figure, cut to a format and set on a base).
//
//   1. ONE MATERIAL. Every face of the figure is the material's tone: skin, hair, eyes, lips and cloth alike. The form
//      reads by light alone, as carving does; the studio's crease (skin and cloth smooth, the rest crisp) is the chisel.
//   2. THE EYES ARE BLANK. Sclera, iris, pupil and lid take the material: a carved eye has no painted pupil unless the
//      surface is painted (law 6).
//   3. HAIR IS A CARVED MASS. The hair's locks are already closed masses on the skull; the material makes them stone or
//      metal, never a separate colour.
//   4. A FORMAT IS A CUT. `full` keeps the figure; `bust` cuts below the chest and through the upper arms; `herm` is the
//      bust on a tapering shaft, its arms cut at the shoulder; `torso` is the study after the antique: no head, no arms, the thighs cut. Every cut closes the
//      part it ends (a sealed ring), so the piece prints as one closed solid.
//   5. LOSS IS WHOLE PARTS. `lose` removes a part and everything it carries (a forearm takes its hand): the break closes
//      in the part's own cap at the joint. No fracture surface is drawn.
//   6. PAINT IS RECONSTRUCTED. `painted` lays polychromy over the card's stone (else marble): hair, brows, eyes, lips and cloth in mineral
//      pigments, the skin a light wash. Ancient polychromy survives in traces only: the colours here are conjecture and
//      the readout says so, every time.
//   7. A STATUE STANDS ON A BASE. The base is stone (a bronze, gilt or painted figure stands on limestone), sized
//      by the figure's footprint and height; `none` stands it on the floor.
//   8. WEAR IS ONE CURVE. `wear` 0 → 1 dulls stone toward a weathered grey and ages bronze through brown to verdigris
//      (metal-surface.js copperAge). It never changes the form.
//
// Pure data and arithmetic; no dice. STATUE_LAWS_VERSION is stamped on every minted build: a change here that moves a
// statue's bytes is a new version.

export const STATUE_LAWS_VERSION = 1;

export const STATUE_DIALS = Object.freeze({
  wear: 'fresh 0 → weathered 1: stone dulls toward grey, bronze ages through brown to verdigris (law 8)',
});

/** law 1: the materials. `tone` the stone's colour; `metal` a metal-surface spec (its colour is the surface's own);
 * `surface` the shelf row or metal spec its faces carry for the exports (polygonizer/materials.js) */
export const STATUE_MATERIALS = Object.freeze({
  marble: { tone: '#e9e4da', surface: 'stone', note: 'white marble (Pentelic, Parian, Carrara)' },
  limestone: { tone: '#d9cbb0', surface: 'stone', note: 'fine limestone, warm buff' },
  sandstone: { tone: '#c99d70', surface: 'stone', note: 'Nubian sandstone' },
  granite: { tone: '#a86e5c', surface: 'stone', note: 'Aswan red granite' },
  basalt: { tone: '#3d3e3b', surface: 'stone', note: 'dark stone: basalt, greywacke, diorite' },
  bronze: { metal: 'bronze', note: 'cast bronze, its patina by wear' },
  gilt: { metal: 'gold', note: 'gilt bronze' },
  painted: { tone: '#ece6dc', surface: 'stone', paint: true, note: "reconstructed polychromy (law 6) over the card's stone, else marble" },
});
export const MATERIAL_WORDS = Object.freeze(Object.keys(STATUE_MATERIALS));

/** law 4: the formats */
export const CROPS = Object.freeze({
  full: 'the whole figure',
  bust: 'head, neck and chest, cut below the chest and through the upper arms',
  herm: 'the bust on a tapering square shaft',
  torso: 'the study after the antique: no head, no arms, the thighs cut',
});
export const CROP_WORDS = Object.freeze(Object.keys(CROPS));
/** law 4: a bust keeps the torso's rings from this station `u` up (st0 the waist, st4 the root of the neck): below the
 * chest; a torso study keeps this share of each thigh from the hip */
export const BUST_FROM_U = 1.5;
/** law 4: a bust keeps this share of each upper arm from the shoulder: the rounded stump busts are cut through */
export const BUST_ARM_KEEP = 0.3;
export const TORSO_THIGH_KEEP = 0.5;
/** law 4: a lost head leaves this share of the neck (a torso study a short stump), cut flat */
export const NECK_KEEP = Object.freeze({ head: 0.6, torso: 0.35 });
/** law 1: the bare body's zone groups (the mannequin's Top, Bottom and Shoes on its own parts) are skin under any
 * material: a garment, or a second skin painted on, keeps its own */
export const BODY_ZONES = Object.freeze(['Top', 'Bottom', 'Shoes', 'Body']);

/** law 5: the loss words, each the parts it removes (side-less base names; R and L by the word's side) */
const HAND = ['hand', 'thumb', 'index', 'middle', 'ring', 'little'];
const FOOT = ['foot', 'toes', 'hallux', 'toe2', 'toe3', 'toe4', 'toe5'];
export const LOSSES = Object.freeze({
  hand: HAND, forearm: ['foreArm', ...HAND], arm: ['upperArm', 'foreArm', ...HAND],
  foot: FOOT, shank: ['shank', ...FOOT], leg: ['thigh', 'shank', ...FOOT],
});
export const LOSS_WORDS = Object.freeze(['head', ...Object.keys(LOSSES).flatMap((w) => [`${w}R`, `${w}L`])]);

/** law 7: the bases; each proportioned to the figure (h × its height, margin × the footprint it stands on: the feet, or
 * a bust's cut) — a herm's shaft is a life-size pillar, so its h is measured in bust heights */
export const BASES = Object.freeze({
  none: { note: 'on the floor' },
  block: { h: 0.12, margin: 1.25, note: 'a squared plinth with a projecting crown' },
  attic: { h: 0.14, margin: 1.3, note: 'a square plinth under a turned torus-scotia-torus moulding' },
  drum: { h: 0.16, margin: 1.2, note: 'a round drum with a fillet top and foot' },
  socle: { h: 0.3, margin: 0.55, note: "a bust's turned foot: a small round base, a waisted neck and a flared top" },
  herm: { h: 2.6, margin: 0.85, note: 'a square shaft tapering toward its foot, on a low plinth' },
});
export const BASE_WORDS = Object.freeze(Object.keys(BASES));
/** law 7: the base a format stands on when neither card nor build names one */
export const CROP_BASE = Object.freeze({ full: 'block', bust: 'socle', herm: 'herm', torso: 'block' });
/** law 9: the stands. `standing`: the card's own gesture. `seated`: the figure sits on a THRONE built with its base
 * (base.js): the legs free of the floor (the seat carries them), the thighs level (the rig's `seat` channel turns them
 * past the hip's anatomical cone), the shins hanging, the hands flat on the knees. The arm channels were found offline by
 * a search over the rig's own channels on both casts (the hand on the thigh above the knee, clear of it), as the gesture
 * presets were; the left arm mirrors the right (yaw and roll negated). */
export const STANDS = Object.freeze({
  standing: { note: "the card's stand" },
  seated: { note: 'on a block throne, the thighs level, the hands on the knees; a long skirt cut at the knee' },
  mounted: { note: "astride a carved horse (an equestrian statue): the legs about the barrel, the right arm raised in address, the left forearm forward at the reins; a long skirt cut at the knee" },
});
export const STAND_WORDS = Object.freeze(Object.keys(STANDS));
export const SEATED_POSE = Object.freeze({
  support: 'none', seat: 28, hipL: { yaw: 0, pitch: 62, roll: 0 }, hipR: { yaw: 0, pitch: 62, roll: 0 }, kneeL: 90, kneeR: 90,
  shR: { yaw: 10, pitch: 15, roll: -30 }, elbowR: 55, shL: { yaw: -10, pitch: 15, roll: 30 }, elbowL: 55,
});
/** law 9: the rider astride (the hips spread about the horse's barrel past its half-width, the knees bent, the shins
 * hanging along its flank; +yaw spreads the left leg, the right mirrored); the right arm in address as the roman card's,
 * the left forearm carried forward at the reins (no reins carved) */
export const MOUNTED_POSE = Object.freeze({
  support: 'none', hipL: { yaw: 30, pitch: 22, roll: 0 }, hipR: { yaw: -30, pitch: 22, roll: 0 }, kneeL: 35, kneeR: 35,
  armR: ['forward', 'up'], elbowR: 'slight', shL: { yaw: -8, pitch: 25, roll: 0 }, elbowL: 75,
});
/** law 10: the MOUNT, carved by the creature filter (creature.js): the creature designer's horse (kind animal, species
 * 'horse', archetype 'equine') retuned for sculpture — a watertight skin (closed: it prints), a deeper head, sturdier
 * legs, a lighter rump and a hanging tail — its opts over the species' own; the zoo's horse itself is unchanged */
export const STATUE_HORSE = Object.freeze(JSON.parse('{"skin": "watertight", "armatureCfg": {"backHeight": 0.62, "trunkLength": 0.5, "backArch": 0, "neckLength": 0.3, "neckAngle": 50, "headPitch": -40, "girthBody": 1.1, "girthFore": 1.45, "girthHind": 1.35, "girthHead": 1.4}, "skullCfg": {"length": 0.36, "width": 0.08, "muzzle": 0.64, "snout": 0.5, "boxy": 0.55, "muzzleDrop": 0.18}, "fleshCfg": {"thorax": 1.9, "belly": 1.9, "bellyDrop": 0.3, "taper": 0.6, "rump": 1.45, "haunch": 0.8, "rumpCap": 1.2}, "tailCfg": {"rootR": 0.03, "bulgeR": 0.042, "bulgeAt": 0.28, "tipR": 0.03, "droop": 72, "length": 0.55, "waveAmp": 0.02}}'));
/** law 10: the mount's group (it rides with the rider: a slot drops the base, never the horse); the saddle, this share of
 * the horse's length from the rear on its back's midline, the rider's seat sunk this far into it (the thighs close on
 * the barrel); the horse scaled about its hooves so its back stands a horse's withers high under a life-size rider (the
 * creature designer's horse is pony-sized); a mount always stands on an oblong block (a round base under a horse reads as
 * a turntable) */
export const MOUNT_GROUP = 'mount';
export const MOUNT = Object.freeze({ saddleAt: 0.42, sink: 0.04, scale: 1.12 });

/** law 9: the throne under a seated figure: its seat runs under this share of the lap from the buttocks forward (the
 * knees and shins stand clear in front of it), its sides this far past the hips (× the lap's width) */
export const THRONE = Object.freeze({ lap: 0.62, side: 0.12 });

/** law 7: a metal figure's base is stone */
export const METAL_BASE_MATERIAL = 'limestone';

/** law 6: the reconstructed polychromy's mineral palette (painted marble; the card's own `paint` tones win) */
export const PAINT_TONES = Object.freeze({
  Skin: '#ecd9c2', Hair: '#6b3f22', HairAlt: '#5e361d', Brow: '#4a2c18', Iris: '#5b4630', Pupil: '#1e1611', Lip: '#a85a4a', Mouth: '#6e3a30',
  Top: '#9c3b2b', Bottom: '#2f5f8a', Collar: '#c9a24a', Trim: '#c9a24a', Waistband: '#c9a24a', Leather: '#6a4327', Buckle: '#c9a24a',
});

const hex = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
const toHex = (c) => `#${c.map((x) => Math.max(0, Math.min(255, Math.round(x))).toString(16).padStart(2, '0')).join('')}`;
export const mixHex = (a, b, t) => toHex(hex(a).map((x, i) => x + (hex(b)[i] - x) * t));
/** law 8: stone weathers toward this grey, by at most this share */
const WEATHER = '#8e8778', WEATHER_MAX = 0.35;
export const weatherTone = (tone, wear = 0) => (wear > 0 ? mixHex(tone, WEATHER, WEATHER_MAX * wear) : tone);
/** law 8: a bronze's age in years by wear (metal-surface.js copperAge): 0 → six years, the brown statuary patina past the
 * first tarnish's interference colours; 1 → forty, a full verdigris */
export const bronzeAge = (wear = 0) => Math.round((6 + 34 * wear) * 100) / 100;
