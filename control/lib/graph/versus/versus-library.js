/**
 * versus library — the stick figure's moves as keys a designer can read.
 *
 * Every move is a variation of one record: what it hits with (a striking point on the rig), the poses it passes
 * through (guard → load → strike, held through the active frames → follow → guard), how long each phase lasts, and
 * what it does to the one it touches. The WEIGHT is in the keys: the load winds the body up, the strike accelerates
 * into contact, the follow carries it on past (the body still turning through), and the kinetic chain is keyed on the
 * round body (`sway` the hips, `twist` the chest, `hands` / `feet` across the centre line: the side view, and so the
 * boxes, never see them). The boxes are not drawn: the compiler solves them from the striking segment and the
 * body, so a longer arm reaches further with the same key.
 *
 * Three shelves:
 *   NORMAL_FAMILIES  a punch or kick shape at a stance (stand, crouch, air); a strength (L / M / H) sets its tempo,
 *                    damage and frame advantage, so `{ family: 'front-kick', strength: 'M' }` is a whole normal.
 *   SPECIALS         the loop's verbs: fireball (projectile), rising (the invincible reversal), rush, spin, leap
 *                    (an overhead), grab (a command throw); each at L / M / H.
 *   SUPERS           a special's bigger self: a freeze, invincibility, damage, a full meter; a `lock` makes it a script
 *                    once it catches: a hit-combo super (in the fight) or a cutscene super (the clock stops).
 *   WEAPONS          what a fighter may hold: a blade on the grip hand that its strikes hit with (versus-compile.js
 *                    lays the blade, its disjoint and what that costs).
 *
 * A recipe adds to the shelves without code: its own specials and supers in the same record (`library`), a tune on
 * any move, and a weapon; a game's rules switch on SYSTEMS by word.
 *
 * Frames follow the genre's count: `startup` includes the first active frame, so a 4-frame jab hits on frame 4;
 * active frames run startup .. startup + active - 1, then recovery. Advantage is the designer's intent (`adv.hit`,
 * `adv.block`, measured from the first active frame) and the stun is solved from it, never written by hand.
 */

// ── poses ────────────────────────────────────────────────────────────────────────────────────────────────────

const P = (base, over = {}) => ({ ...base, ...over });

export const POSES = {};
POSES.guard = { torso: 10, head: 0, armF: [35, 150], armB: [15, 165], legF: [18, 4, 90], legB: [-18, -12, 82] };
POSES.crouch = { torso: 26, head: 5, armF: [45, 150], armB: [25, 165], legF: [70, -10, 90], legB: [38, -62, 70] };
POSES.walkA = P(POSES.guard, { legF: [26, 10, 90], legB: [-10, -22, 80] });
POSES.walkB = P(POSES.guard, { legF: [8, -4, 90], legB: [-26, -4, 84] });
POSES.prejump = P(POSES.crouch, { torso: 15, armF: [20, 140], armB: [0, 150] });
POSES.jump = { torso: 8, head: 0, armF: [40, 150], armB: [20, 160], legF: [70, -40, 80], legB: [35, -80, 60], air: true };
POSES.dash = P(POSES.guard, { torso: 25, legF: [40, 0, 90], legB: [-35, -30, 70], hip: [60, 0] });
POSES.backdash = P(POSES.guard, { torso: -10, legF: [30, 20, 90], legB: [-5, -10, 80], hip: [-60, 0] });
POSES.blockHigh = P(POSES.guard, { torso: -6, head: -10, armF: [15, 172], armB: [5, 176] });
POSES.blockLow = P(POSES.crouch, { torso: 12, armF: [15, 168], armB: [5, 174] });
POSES.hitHigh = P(POSES.guard, { torso: -22, head: -38, armF: [-20, 40], armB: [-35, 20], hip: [-50, 0] });
POSES.hitLow = P(POSES.guard, { torso: 38, head: 50, armF: [10, 30], armB: [-10, 20], hip: [-40, 0] });
POSES.hitCrouch = P(POSES.crouch, { torso: 5, head: -20, armF: [-10, 50], armB: [-25, 30] });
POSES.fall = { torso: -55, head: -70, armF: [140, 120], armB: [170, 150], legF: [60, 40, 100], legB: [30, 10, 90], air: true };
POSES.down = { torso: -90, head: -95, armF: [-80, -95], armB: [-100, -110], legF: [88, 92, 175], legB: [80, 90, 170] };
POSES.rise = P(POSES.crouch, { torso: 40, head: 20 });
POSES.thrown = P(POSES.fall, { air: false });
POSES.burst = P(POSES.guard, { torso: -8, head: -12, armF: [120, 150], armB: [-120, -150], legF: [30, 10, 90], legB: [-30, -10, 90] });
POSES.win = P(POSES.guard, { torso: 0, head: -10, armB: [175, 178], armF: [20, 165] });
POSES.lose = P(POSES.crouch, { torso: 60, head: 70, armF: [5, 0], armB: [-5, 0] });

// ── normals ──────────────────────────────────────────────────────────────────────────────────────────────────

// a strength's frame shape, damage and intended advantage; a family's tempo stretches startup and recovery
export const STRENGTHS = Object.freeze({
  L: { startup: 4, active: 2, recovery: 7, damage: 30, adv: { hit: 4, block: 1 }, hitstop: 8, push: 140, meter: 20 },
  M: { startup: 6, active: 3, recovery: 13, damage: 60, adv: { hit: 4, block: -1 }, hitstop: 10, push: 180, meter: 30 },
  H: { startup: 9, active: 3, recovery: 20, damage: 90, adv: { hit: 2, block: -4 }, hitstop: 12, push: 220, meter: 40 },
});

export const STANCES = Object.freeze(['stand', 'crouch', 'air']);

export const NORMAL_FAMILIES = Object.freeze({
  jab: {
    stance: 'stand', limb: 'fistF', tempo: 0.9, says: 'a lead-hand jab: fast, short, the button that interrupts',
    load: P(POSES.guard, { armF: [55, 125], twist: 6 }), strike: P(POSES.guard, { torso: 14, armF: [88, 90], twist: 10 }),
    follow: P(POSES.guard, { torso: 12, armF: [78, 104], twist: 6 }),
  },
  straight: {
    stance: 'stand', limb: 'fistB', tempo: 1, says: 'a rear straight: the hip turns into a long punch',
    load: P(POSES.guard, { torso: 4, armB: [10, 150], sway: 10, twist: 8 }),
    strike: P(POSES.guard, { torso: 24, armF: [20, 165], armB: [86, 88], legB: [-24, -20, 70], hip: [60, 0], sway: -40, twist: -60, hands: [0.3, 0.1] }),
    follow: P(POSES.guard, { torso: 22, armF: [22, 162], armB: [78, 96], legB: [-22, -18, 72], hip: [50, 0], sway: -34, twist: -50 }),
  },
  hook: {
    stance: 'stand', limb: 'fistF', tempo: 1, says: 'a lead hook: short, high, it catches a forward jump early',
    load: P(POSES.guard, { torso: 0, armF: [40, 140], twist: 18, sway: 10 }),
    strike: P(POSES.guard, { torso: 18, armF: [80, 128], twist: -35, sway: -22, hands: [0, 0.3] }),
    follow: P(POSES.guard, { torso: 16, armF: [72, 118], twist: -48, sway: -26, hands: [-0.3, 0.3] }),
  },
  uppercut: {
    stance: 'stand', limb: 'fistB', tempo: 1, antiAir: true, says: 'a rising uppercut: the normal that answers a jump',
    load: P(POSES.guard, { torso: 20, armB: [-10, 40], hip: [0, -60], sway: 12, twist: 10 }),
    strike: P(POSES.guard, { torso: 4, armF: [10, 160], armB: [150, 172], hip: [30, 40], sway: -30, twist: -40, hands: [0.4, 0.1] }),
    follow: P(POSES.guard, { torso: 0, head: -8, armF: [12, 158], armB: [160, 176], hip: [24, 50], legB: [-14, -14, 60], sway: -34, twist: -46 }),
  },
  'front-kick': {
    stance: 'stand', limb: 'toeF', tempo: 1.05, says: 'a lead front kick: the long poke that keeps them out',
    load: P(POSES.guard, { torso: 0, legF: [72, -30, 100] }), strike: P(POSES.guard, { torso: -12, legF: [92, 92, 150], legB: [-4, -4, 90] }),
    follow: P(POSES.guard, { torso: -6, legF: [74, -20, 110] }),
  },
  roundhouse: {
    stance: 'stand', limb: 'toeB', tempo: 1.15, says: 'a rear roundhouse: high, far, slow to come home',
    load: P(POSES.guard, { torso: 0, legB: [52, -40, 80], legF: [4, 0, 90], sway: 20 }),
    strike: P(POSES.guard, { torso: -24, head: -5, legB: [102, 108, 120], legF: [0, 0, 90], armB: [-20, 80], sway: -60, twist: -25, feet: [1, 0.2] }),
    follow: P(POSES.guard, { torso: -16, legB: [70, -20, 90], legF: [0, 0, 90], armB: [0, 110], sway: -50, twist: -20 }),
  },
  knee: {
    stance: 'stand', limb: 'kneeF', tempo: 0.95, says: 'a lead knee: short, quick, close in',
    load: P(POSES.guard, { legF: [50, -30, 80] }), strike: P(POSES.guard, { torso: -6, legF: [105, -30, 60], legB: [-4, -4, 90], armF: [60, 100], armB: [50, 110] }),
    follow: P(POSES.guard, { torso: 0, legF: [80, -20, 70] }),
  },
  'crouch-jab': {
    stance: 'crouch', limb: 'fistF', tempo: 0.9, says: 'a crouching jab: low profile, fast, it chains into itself',
    load: P(POSES.crouch, { armF: [60, 120] }), strike: P(POSES.crouch, { torso: 30, armF: [88, 90] }),
  },
  'low-kick': {
    stance: 'crouch', limb: 'toeF', tempo: 1, guard: 'low', says: 'a crouching shin kick: it must be blocked low',
    load: P(POSES.crouch, { legF: [60, 10, 90] }), strike: P(POSES.crouch, { torso: 20, legF: [84, 86, 92] }),
  },
  'crouch-punch': {
    stance: 'crouch', limb: 'fistB', tempo: 1, says: 'a crouching straight: the low poke that cancels',
    load: P(POSES.crouch, { armB: [10, 150], sway: 10 }), strike: P(POSES.crouch, { torso: 34, armF: [25, 160], armB: [88, 92], sway: -30, twist: -45 }),
    follow: P(POSES.crouch, { torso: 32, armF: [28, 158], armB: [80, 100], sway: -24, twist: -36 }),
  },
  sweep: {
    stance: 'crouch', limb: 'toeF', tempo: 1.1, guard: 'low', knock: 'down', adv: { block: -12 },
    says: 'a sweep: low, it knocks down, very unsafe on block',
    load: P(POSES.crouch, { torso: 40, legF: [50, 20, 90], sway: -10 }),
    strike: P(POSES.crouch, { torso: 44, legF: [88, 92, 100], legB: [30, -70, 60], hip: [0, -60], armF: [20, 20], sway: 40 }),
    follow: P(POSES.crouch, { torso: 42, legF: [70, 70, 100], legB: [30, -70, 60], hip: [0, -60], sway: 50 }),
  },
  'crouch-uppercut': {
    stance: 'crouch', limb: 'fistF', tempo: 1, antiAir: true, says: 'a crouching uppercut: an anti-air from low',
    load: P(POSES.crouch, { armF: [-10, 60] }), strike: P(POSES.crouch, { torso: 8, armF: [150, 175] }),
  },
  'air-punch': {
    stance: 'air', limb: 'fistF', tempo: 0.9, guard: 'overhead', says: 'a jumping punch: quick in the air, blocked standing',
    load: P(POSES.jump, { armF: [80, 120] }), strike: P(POSES.jump, { armF: [62, 56] }),
  },
  'air-kick': {
    stance: 'air', limb: 'toeF', tempo: 1, guard: 'overhead', says: 'a jumping kick: the jump-in that starts a combo',
    load: P(POSES.jump, { legF: [50, -40, 80] }), strike: P(POSES.jump, { torso: -6, legF: [62, 58, 100] }),
  },
  'air-stomp': {
    stance: 'air', limb: 'toeF', tempo: 1.1, guard: 'overhead', says: 'a jumping heavy kick angled down: deep and late',
    load: P(POSES.jump, { legF: [60, -40, 80] }), strike: P(POSES.jump, { torso: -12, legF: [38, 30, 70], legB: [60, -60, 70] }),
  },
});

// a family at a stance's default strength row; the slot table the modern scheme fills
export const NORMAL_SLOTS = Object.freeze([
  'stand.L', 'stand.M', 'stand.H', 'crouch.L', 'crouch.M', 'crouch.H', 'air.L', 'air.M', 'air.H',
]);

// ── throws ───────────────────────────────────────────────────────────────────────────────────────────────────

export const THROW = Object.freeze({
  limb: 'fistF', startup: 5, active: 3, recovery: 22, damage: 120, tech: 10, clinch: 24, range: 0, meter: 80,
  load: P(POSES.guard, { armF: [60, 100], armB: [50, 110] }),
  strike: P(POSES.guard, { torso: 20, armF: [82, 84], armB: [76, 86] }),
  says: 'a throw: unblockable, short, it loses to a strike or a jump and is teched by a throw',
});

// ── specials ─────────────────────────────────────────────────────────────────────────────────────────────────

// each special: its shape, its frame data per strength, and its properties. Frames are 1-based move frames.
export const SPECIALS = Object.freeze({
  fireball: {
    rps: 'projectile', limb: 'fistF', motion: '236', says: 'a fireball: it owns the screen, a jump over it is the answer',
    load: P(POSES.guard, { torso: -6, armF: [-30, 60], armB: [-40, 50] }),
    strike: P(POSES.guard, { torso: 20, armF: [90, 90], armB: [84, 88], legF: [38, -8, 90], legB: [-38, -30, 70], hip: [80, 0] }),
    at: { L: { startup: 13, recovery: 30, speed: 45 }, M: { startup: 12, recovery: 31, speed: 60 }, H: { startup: 11, recovery: 32, speed: 80 } },
    damage: 60, chip: 15, guard: 'mid', projectile: { w: 260, h: 220, y: -260, life: 150 }, adv: { hit: 0, block: 0 }, hitstop: 10, push: 160, meter: 40,
  },
  rising: {
    rps: 'reversal', limb: 'fistB', motion: '623', says: 'the invincible reversal: it beats everything but a block, and a block punishes it',
    load: P(POSES.crouch, { armB: [-20, 30] }),
    strike: P(POSES.jump, { torso: 14, armB: [138, 152], armF: [20, 150], legF: [60, -30, 80], legB: [10, -40, 70] }),
    at: {
      L: { startup: 3, active: 8, landing: 14, damage: 90, invuln: 5, vel: [20, 90] },
      M: { startup: 4, active: 10, landing: 18, damage: 110, invuln: 7, vel: [26, 110] },
      H: { startup: 5, active: 12, landing: 22, damage: 130, invuln: 10, vel: [30, 125] },
    },
    guard: 'mid', knock: 'launch', juggle: true, airborne: 4, hitstop: 14, push: 0, meter: 60, chip: 10,
  },
  rush: {
    rps: 'rush', limb: 'elbowF', motion: '214', says: 'a rush: it closes the distance and ends a combo, it is unsafe if blocked close',
    load: P(POSES.guard, { torso: 0, hip: [-40, 0] }),
    strike: P(POSES.guard, { torso: 48, armF: [96, -10], armB: [40, 40], legF: [50, 10, 90], legB: [-50, -40, 70], hip: [120, -60] }),
    at: {
      L: { startup: 12, active: 4, recovery: 18, damage: 70, travel: 55, adv: { hit: 1, block: -6 } },
      M: { startup: 14, active: 5, recovery: 20, damage: 90, travel: 70, adv: { hit: 2, block: -8 } },
      H: { startup: 16, active: 6, recovery: 22, damage: 110, travel: 85, adv: { hit: 0, block: -10 }, knock: 'down' },
    },
    guard: 'mid', hitstop: 12, push: 260, meter: 40, chip: 12,
  },
  spin: {
    rps: 'rush', limb: 'toeF', motion: '214', says: 'a spinning kick that travels, low-risk at range, it passes over low pokes',
    load: P(POSES.guard, { torso: -10, legF: [40, -40, 80] }),
    strike: P(POSES.jump, { torso: -8, legF: [92, 92, 100], legB: [20, -60, 70] }),
    at: {
      L: { startup: 10, active: 8, recovery: 14, damage: 70, travel: 40, adv: { hit: 2, block: -4 } },
      M: { startup: 12, active: 10, recovery: 16, damage: 90, travel: 50, adv: { hit: 2, block: -6 } },
      H: { startup: 14, active: 12, recovery: 18, damage: 110, travel: 60, adv: { hit: 2, block: -8 }, knock: 'down' },
    },
    guard: 'mid', hits: 2, hitstop: 10, push: 200, meter: 40, chip: 10, lift: 160,
  },
  leap: {
    rps: 'overhead', limb: 'fistB', motion: '22', says: 'a leaping overhead: it must be blocked standing, slow enough to react to',
    load: P(POSES.crouch, { armB: [150, 170] }),
    strike: P(POSES.jump, { torso: 30, armB: [70, 40], armF: [40, 120] }),
    at: {
      L: { startup: 18, active: 4, recovery: 14, damage: 70, travel: 40, adv: { hit: 2, block: -4 } },
      M: { startup: 20, active: 4, recovery: 15, damage: 80, travel: 50, adv: { hit: 2, block: -5 } },
      H: { startup: 22, active: 4, recovery: 16, damage: 90, travel: 60, adv: { hit: 3, block: -6 } },
    },
    guard: 'overhead', hitstop: 12, push: 200, meter: 40, chip: 8,
  },
  grab: {
    rps: 'throw', limb: 'fistF', motion: '41236', says: 'a command throw: it beats a block from further away than a throw, a whiff is very punishable',
    load: P(POSES.crouch, { armF: [60, 90], armB: [50, 100] }),
    strike: P(POSES.guard, { torso: 30, armF: [86, 80], armB: [80, 84], hip: [60, -40] }),
    at: {
      L: { startup: 5, active: 3, recovery: 34, damage: 140, reach: 1.15 },
      M: { startup: 6, active: 3, recovery: 38, damage: 170, reach: 1.25 },
      H: { startup: 7, active: 3, recovery: 42, damage: 200, reach: 1.35 },
    },
    throw: true, clinch: 36, meter: 50,
  },
});

export const SPECIAL_SLOTS = Object.freeze(['neutral', 'forward', 'back', 'down']);

// ── supers ───────────────────────────────────────────────────────────────────────────────────────────────────

export const SUPERS = Object.freeze({
  'super-fireball': {
    from: 'fireball', says: 'a beam of a fireball: invincible to start, it crosses the screen in a breath',
    startup: 10, recovery: 40, speed: 110, damage: 300, chip: 60, hits: 5, rehit: 4, invuln: 10, freeze: 40, projectile: { w: 420, h: 360, y: 0, life: 90 },
  },
  'super-rush': {
    from: 'rush', says: 'a flurry that runs them down: invincible to start, it carries to the corner',
    startup: 8, active: 20, recovery: 34, damage: 320, travel: 120, hits: 6, rehit: 3, invuln: 12, freeze: 40,
  },
  'super-rising': {
    from: 'rising', says: 'the reversal at full height: invincible and long, the anti-air that ends a round',
    startup: 4, active: 18, landing: 30, damage: 340, hits: 4, rehit: 4, invuln: 16, freeze: 40, vel: [24, 150],
  },
  'super-chain': {
    from: 'rush', says: 'the hit-combo super: the first blow catches and the rest follow on their own, in the fight\'s own camera, every hit landing; blocked, one blocked blow',
    startup: 7, active: 6, recovery: 30, damage: 330, travel: 90, invuln: 10, freeze: 30, lock: { kind: 'combo', hits: 7, every: 6, finish: 'launch', gap: 650 },
  },
  'super-cutscene': {
    from: 'rush', says: 'the cutscene super: the first blow catches and the fight cuts away (the camera closes in, the clock stops) for a beat-by-beat that ends with them on the floor',
    startup: 6, active: 4, recovery: 36, damage: 400, travel: 60, invuln: 12, freeze: 40, lock: { kind: 'cutscene', hits: 5, every: 16, finish: 'down', gap: 600 },
  },
  'super-grab': {
    from: 'grab', says: 'the long throw: it reaches a jump\'s landing, unblockable, invincible to start',
    startup: 4, active: 4, recovery: 50, damage: 380, reach: 1.6, invuln: 4, freeze: 40, clinch: 60,
  },
});

export const SUPER_COST = 1000;
export const METER_MAX = 1000;

// ── weapons ──────────────────────────────────────────────────────────────────────────────────────────────────

/**
 * A weapon rides the grip hand (F lead, B rear) along the forearm, turned by `angle` (degrees, + tips it up); its
 * blade is `length` of the body's height past the fist (`butt` behind it, drawn only). A strike with the grip hand
 * hits with the blade. The blade is disjointed: it is not a hurtbox while it swings, so it pays for its reach in
 * frames (versus-compile.js reachTax) and, by default, stays hurtable through a whiff's recovery (`hurt`:
 * 'recovery'; 'none' fully disjointed; 'always' hurtable whenever it is out). `tempo` stretches the grip hand's
 * normals, `damage` scales what they deal, `width` is the blade's half-thickness (mm at 1800 tall).
 */
export const WEAPONS = Object.freeze({
  knife: { grip: 'F', length: 0.14, width: 40, angle: -10, tempo: 0.95, damage: 1, hurt: 'recovery', color: '#d8dde6', says: 'a knife: barely longer than a fist, quick' },
  sword: { grip: 'F', length: 0.42, width: 45, angle: 0, tempo: 1, damage: 1.1, hurt: 'recovery', color: '#e6ebf2', says: 'a sword in the lead hand: the jab becomes a thrust' },
  katana: { grip: 'F', length: 0.48, width: 40, angle: 6, tempo: 1, damage: 1.15, hurt: 'recovery', color: '#f2f4f8', says: 'a long blade: reach, paid for on a whiff' },
  axe: { grip: 'F', length: 0.36, width: 90, angle: 10, tempo: 1.12, damage: 1.3, hurt: 'recovery', color: '#b9a48a', says: 'an axe: short, slow, it hits like a sweep' },
  spear: { grip: 'B', length: 0.72, width: 35, butt: 0.3, angle: -4, tempo: 1.05, damage: 1, hurt: 'recovery', color: '#c9b089', says: 'a spear in the rear hand: the longest poke, the lead hand stays free' },
  staff: { grip: 'B', length: 0.5, width: 45, butt: 0.45, angle: 0, tempo: 1.02, damage: 0.95, hurt: 'always', color: '#a57b4f', says: 'a staff: long both ways, its wood is hit as it swings' },
  claws: { grip: 'F', length: 0.1, width: 60, angle: 0, tempo: 0.92, damage: 0.95, hurt: 'recovery', color: '#c8ccd2', says: 'claws: a fist that cuts, a frame faster' },
});

export const WEAPON_HURT = Object.freeze(['recovery', 'none', 'always']);

// ── systems ──────────────────────────────────────────────────────────────────────────────────────────────────

// a game's opt-in rules (rules.systems); absent, the fight is the same to the byte
export const SYSTEMS = Object.freeze({
  parry: 'tap forward as a strike arrives (down for a low) to parry it: no damage, and you move first',
  burst: 'once a round, S + T while being hit breaks the combo and knocks the attacker away',
  guard: 'blocking wears a guard bar; an empty bar is crushed, open for a combo',
});
