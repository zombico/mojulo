/**
 * versus traditions — the ways a body has been taught to strike: boxing, karate, taekwondo, Muay Thai, kung fu,
 * capoeira, savate, and the street's brawling (a page module: the page compiles fighters with it).
 *
 * A tradition is a GUARD (how it stands: where the hands are, how low, how wide; its crouch), a RHYTHM (how it moves
 * standing still: a boxer's bounce, a capoeirista's ginga), its STANCE against the genre's (degrees onto the style's
 * open, hips and tilt: a Thai boxer stands square, a taekwondo player side-on), and its MOVES: punch and kick
 * families authored over its own guard, each with the load that winds it, the strike it accelerates into, and the
 * follow it carries on to (a karate kick re-chambers, a Thai kick turns the body through, a cross carries the
 * shoulder over), with the kinetic chain keyed on the round body (versus-library.js). A spinning move turns its back in
 * the load (180°) and completes the turn AT CONTACT (360°): the body turned whole about the vertical would carry the
 * striking foot off the line the hitbox is on, so the hit lands square, and the follow carries the turn on past it.
 * A kick that swings through the target (a Thai kick, a meia-lua) says `through`: it does not re-chamber; a kick
 * that rises with the knee locked (the axe kick) says `straight`: it does not chamber at all.
 * Its `normals` fill every slot
 * (stand, crouch, air × L, M, H); its `families` are the ones a signature word may swap in (its own, and the shared
 * ones it also throws).
 *
 *   TRADITIONS          { <word>: { says, guard, crouch?, rhythm, stance, normals, families, moves } }
 *   FAMILIES            every family: the library's and every tradition's, one namespace
 *   traditionRests(w)   the poses a fighter of tradition w stands, crouches and walks in (null for the genre's own)
 *
 * Pure data; the sim reads a move's frames and boxes as it reads any other (versus-compile.js).
 */
/* (inlined after versus-rig.js and versus-library.js: POSES, NORMAL_FAMILIES) */
import { POSES, NORMAL_FAMILIES } from './versus-library.js';

const tr = (base, over = {}) => ({ ...base, ...over });
const AIR = POSES.jump;

// ── boxing: hands high and tight, chin down, knees soft; punches only ────────────────────────────────────────
const BOX = { torso: 14, head: 10, armF: [26, 162], armB: [16, 170], legF: [20, 0, 90], legB: [-14, -22, 76], hip: [0, -10], hands: [0.5, 0.12] };
const BOX_LOW = tr(POSES.crouch, { torso: 30, head: 18, armF: [30, 165], armB: [20, 172], hands: [0.5, 0.12] });

// ── karate: long and low, the lead hand out, the rear fist chambered at the hip (hikite) ─────────────────────
const KAR = { torso: 4, head: -2, armF: [42, 125], armB: [-14, 70], legF: [34, 12, 90], legB: [-34, -28, 78], hip: [0, -30], hands: [0.75, 1] };
const KAR_LOW = tr(POSES.crouch, { torso: 20, armF: [45, 125], armB: [-10, 70], hands: [0.75, 1] });

// ── taekwondo: side-on and light, hands low, the legs do the work ───────────────────────────────────────────
const TKD = { torso: 2, head: -2, armF: [28, 110], armB: [12, 130], legF: [14, 6, 90], legB: [-16, -12, 84], hands: [0.55, 0.45] };
const TKD_LOW = tr(POSES.crouch, { armF: [40, 120], armB: [20, 130], hands: [0.55, 0.45] });

// ── Muay Thai: tall and square, weight on the back foot, the lead arm long ──────────────────────────────────
const THAI = { torso: 0, head: 8, armF: [62, 150], armB: [24, 172], legF: [8, 4, 84], legB: [-12, -8, 84], hands: [0.55, 0.45] };
const THAI_LOW = tr(POSES.crouch, { armF: [55, 160], armB: [25, 172], hands: [0.55, 0.45] });

// ── kung fu: a low bow stance, the lead hand open before the centre line, the rear guarding the chest ───────
const KF = { torso: 4, head: -6, armF: [50, 135], armB: [44, 150], legF: [36, 14, 92], legB: [-34, -28, 78], hip: [0, -60], hands: [0.35, 0.05] };
const KF_LOW = tr(POSES.crouch, { torso: 18, armF: [50, 135], armB: [44, 150], hands: [0.35, 0.05] });

// ── capoeira: the ginga, low and rocking, an arm across the face, the other back toward the floor ───────────
const CAP = { torso: 24, head: 10, armF: [70, 170], armB: [-30, 10], legF: [40, -2, 90], legB: [-36, -44, 66], hip: [0, -70], hands: [-0.1, 0.9] };
const CAP_LOW = tr(POSES.crouch, { torso: 36, armF: [60, 170], armB: [-10, -20], hands: [-0.1, 1] });

// ── savate: upright and bladed, the hands mid-high, the shoe as a weapon ────────────────────────────────────
const SAV = { torso: 6, head: 0, armF: [46, 142], armB: [20, 162], legF: [10, 6, 92], legB: [-16, -10, 84], hands: [0.7, 0.3] };

// ── the brawler: hunched and square, fists low and wide, nothing taught ─────────────────────────────────────
const BRAWL = { torso: 18, head: 14, armF: [30, 118], armB: [12, 118], legF: [12, 4, 84], legB: [-12, -8, 80], hands: [0.9, 0.6] };
const BRAWL_LOW = tr(POSES.crouch, { torso: 34, head: 24, armF: [40, 110], armB: [20, 110], hands: [0.9, 0.6] });

// moves shared by more than one tradition
const SHARED_MOVES = {
  'flying-side-kick': {
    stance: 'air', limb: 'ankleF', tempo: 1.1, says: 'a flying side kick: the body turns side-on in the air, the heel leads',
    load: tr(AIR, { legF: [96, -40, 90], legB: [40, -80, 60] }),
    strike: tr(AIR, { torso: -30, legF: [92, 92, 180], legB: [30, -70, 60], armF: [80, 110], armB: [-20, 40], sway: 70, twist: 15 }),
  },
  'spin-sweep': {
    stance: 'crouch', limb: 'toeB', tempo: 1.15, guard: 'low', knock: 'down', adv: { block: -12 },
    says: 'a spinning sweep: a full turn on the floor, the rear heel takes the legs',
    load: tr(POSES.crouch, { torso: 40, legB: [20, -80, 60], armF: [20, 20], spin: 180 }),
    strike: tr(POSES.crouch, { torso: 44, legB: [88, 92, 100], legF: [60, -40, 70], armF: [10, 10], hip: [0, -60], spin: 360 }),
    follow: tr(POSES.crouch, { torso: 42, legB: [70, 70, 100], legF: [60, -40, 70], hip: [0, -60], spin: 380 }),
  },
};

const TRADITION_LIST = {
  boxing: {
    says: 'boxing: hands high, the head moving, and punches only: the jab, the cross, the hook, the uppercut',
    guard: BOX, crouch: BOX_LOW, rhythm: { bounce: 1, rock: 0.2 }, stance: { open: 5, hips: 4, tilt: 4 },
    normals: { 'stand.L': 'jab', 'stand.M': 'cross', 'stand.H': 'lead-hook', 'crouch.L': 'crouch-jab', 'crouch.M': 'shovel-hook', 'crouch.H': 'crouch-uppercut', 'air.L': 'air-punch', 'air.M': 'superman-punch', 'air.H': 'overhand' },
    families: ['uppercut', 'straight', 'hook', 'crouch-punch'],
    moves: {
      cross: {
        stance: 'stand', limb: 'fistB', tempo: 1, says: 'a cross: the back foot turns, the hip and the shoulder throw the rear hand through',
        load: tr(BOX, { torso: 12, armB: [12, 160], sway: 12, twist: 10 }),
        strike: tr(BOX, { torso: 26, head: 20, armF: [22, 168], armB: [88, 90], legB: [-22, -18, 62], hip: [70, -10], sway: -45, twist: -65, hands: [0.4, 0.05] }),
        follow: tr(BOX, { torso: 24, head: 18, armF: [22, 168], armB: [80, 98], legB: [-20, -18, 64], hip: [60, -10], sway: -40, twist: -55 }),
      },
      'lead-hook': {
        stance: 'stand', limb: 'fistF', tempo: 1.1, says: 'a lead hook: the elbow up level with the fist, the whole body turning it across',
        load: tr(BOX, { torso: 10, armF: [38, 140], sway: 14, twist: 20 }),
        strike: tr(BOX, { torso: 18, head: 14, armF: [84, 120], legF: [20, 4, 70], sway: -30, twist: -40, hands: [-0.2, 0.15] }),
        follow: tr(BOX, { torso: 16, armF: [74, 110], sway: -34, twist: -55, hands: [-0.5, 0.15] }),
      },
      'shovel-hook': {
        stance: 'crouch', limb: 'fistF', tempo: 1, says: 'a shovel hook: half uppercut, half hook, up under the guard into the body',
        load: tr(BOX_LOW, { armF: [20, 120], sway: 12, twist: 14 }),
        strike: tr(BOX_LOW, { torso: 28, armF: [60, 130], sway: -26, twist: -30, hands: [0, 0.12] }),
        follow: tr(BOX_LOW, { torso: 24, armF: [70, 150], twist: -40, hands: [-0.2, 0.12] }),
      },
      'superman-punch': {
        stance: 'air', limb: 'fistB', tempo: 1, says: 'a superman punch: the rear leg kicks back and the rear hand flies in',
        load: tr(AIR, { armB: [-20, 40], legB: [-30, -60, 70] }),
        strike: tr(AIR, { torso: 30, armB: [92, 92], armF: [30, 160], legF: [30, -20, 80], legB: [-40, -50, 70], twist: -50 }),
      },
      overhand: {
        stance: 'air', limb: 'fistB', tempo: 1.15, says: 'an overhand from the air: the rear hand loops over the guard and down',
        load: tr(AIR, { torso: -6, armB: [150, 170] }),
        strike: tr(AIR, { torso: 36, armB: [70, 40], armF: [30, 150], twist: -40 }),
      },
    },
  },
  karate: {
    says: 'karate: long, low stances, the rear fist chambered at the hip, every strike focused and held (kime)',
    guard: KAR, crouch: KAR_LOW, rhythm: { bounce: 0.3, rock: 0 }, stance: { open: 0, hips: 6, tilt: -2 },
    normals: { 'stand.L': 'kizami-zuki', 'stand.M': 'gyaku-zuki', 'stand.H': 'mawashi-geri', 'crouch.L': 'crouch-jab', 'crouch.M': 'low-kick', 'crouch.H': 'sweep', 'air.L': 'air-punch', 'air.M': 'air-kick', 'air.H': 'flying-side-kick' },
    families: ['mae-geri', 'uppercut', 'crouch-punch', 'knee'],
    moves: {
      'kizami-zuki': {
        stance: 'stand', limb: 'fistF', tempo: 0.9, says: 'a kizami-zuki: the lead hand with a slide in, the karateka\'s fastest',
        load: tr(KAR, { armF: [50, 90] }),
        strike: tr(KAR, { torso: 10, armF: [88, 90], legF: [38, 16, 90], hip: [40, -30], twist: 6 }),
        follow: tr(KAR, { torso: 8, armF: [80, 92], hip: [30, -30] }),
      },
      'gyaku-zuki': {
        stance: 'stand', limb: 'fistB', tempo: 1, says: 'a gyaku-zuki: the reverse punch; the lead hand pulls back to the hip as the rear drives out, and holds',
        load: tr(KAR, { armB: [-20, 60], sway: 8 }),
        strike: tr(KAR, { torso: 12, armB: [88, 90], armF: [-14, 70], legB: [-34, -34, 70], hip: [30, -40], sway: -50, twist: -70, hands: [1, 0.2] }),
        follow: tr(KAR, { torso: 12, armB: [86, 90], armF: [-14, 70], legB: [-34, -34, 70], hip: [30, -40], sway: -48, twist: -66, hands: [1, 0.2] }),
      },
      'mae-geri': {
        stance: 'stand', limb: 'toeF', tempo: 1.05, says: 'a mae-geri: the knee chambers high, the ball of the foot snaps out and back',
        load: tr(KAR, { torso: -2, legF: [96, -20, 100], hip: [0, 0] }),
        strike: tr(KAR, { torso: -10, legF: [96, 92, 140], legB: [-20, -18, 84], armF: [50, 100], hip: [0, 0] }),
        follow: tr(KAR, { legF: [96, -16, 100], hip: [0, 0] }),
      },
      'mawashi-geri': {
        stance: 'stand', limb: 'toeB', tempo: 1.15, says: 'a mawashi-geri: the rear knee comes up and across, the hips turn over, the shin whips out and re-chambers',
        load: tr(KAR, { legB: [70, -30, 80], legF: [20, 6, 90], hip: [0, -10], sway: 24 }),
        strike: tr(KAR, { torso: -22, head: -6, legB: [104, 104, 100], legF: [6, 2, 90], armB: [-24, 60], hip: [0, 0], sway: -70, twist: -30, feet: [1, 0.1] }),
        follow: tr(KAR, { torso: -12, legB: [80, -20, 90], legF: [6, 2, 90], hip: [0, 0], sway: -50, twist: -20 }),
      },
    },
  },
  taekwondo: {
    says: 'taekwondo: side-on and bouncing, the hands low, the legs do the work: cut kicks, side kicks, the axe, the spins',
    guard: TKD, crouch: TKD_LOW, rhythm: { bounce: 1, rock: 0 }, stance: { open: 15, hips: 14, tilt: -3 },
    normals: { 'stand.L': 'cut-kick', 'stand.M': 'side-kick', 'stand.H': 'axe-kick', 'crouch.L': 'crouch-jab', 'crouch.M': 'low-side-kick', 'crouch.H': 'spin-sweep', 'air.L': 'air-kick', 'air.M': 'flying-side-kick', 'air.H': 'tornado-kick' },
    families: ['front-kick', 'roundhouse', 'jab', 'straight', 'low-kick'],
    moves: {
      'cut-kick': {
        stance: 'stand', limb: 'toeF', tempo: 0.9, says: 'a cut kick: the lead leg lifts and slices out before they can close',
        load: tr(TKD, { legF: [70, -20, 100] }),
        strike: tr(TKD, { torso: -14, legF: [86, 84, 120], legB: [-6, -6, 90], sway: 30 }),
        follow: tr(TKD, { legF: [66, -10, 100] }),
      },
      'side-kick': {
        stance: 'stand', limb: 'ankleF', tempo: 1.05, says: 'a side kick (yop chagi): the body turns side-on, the heel drives out in a line',
        load: tr(TKD, { torso: -6, legF: [112, -10, 120], sway: 40, twist: 10 }),
        strike: tr(TKD, { torso: -32, head: -14, legF: [94, 94, 180], legB: [6, -14, 80], armF: [40, 110], armB: [-30, 30], sway: 85, twist: 20, feet: [0, 1] }),
        follow: tr(TKD, { torso: -20, legF: [108, -14, 120], sway: 60, twist: 10 }),
      },
      'axe-kick': {
        stance: 'stand', limb: 'ankleB', tempo: 1.3, guard: 'overhead', straight: true, says: 'an axe kick: the leg rises straight up and the heel drops over the guard (blocked standing)',
        load: tr(TKD, { torso: -14, legB: [150, 150, 150], legF: [0, 0, 90], armF: [40, 140], armB: [-20, 30] }),
        strike: tr(TKD, { torso: 6, legB: [112, 112, 130], legF: [2, 0, 90], twist: -20 }),
        follow: tr(TKD, { torso: 16, legB: [60, 50, 100] }),
      },
      'low-side-kick': {
        stance: 'crouch', limb: 'ankleF', tempo: 1, guard: 'low', says: 'a low side kick: from the crouch, the heel to the knee',
        load: tr(TKD_LOW, { legF: [96, -30, 120], sway: 30 }),
        strike: tr(TKD_LOW, { torso: 16, legF: [80, 82, 180], sway: 70, twist: 10 }),
        follow: tr(TKD_LOW, { legF: [92, -20, 120], sway: 40 }),
      },
      'tornado-kick': {
        stance: 'air', limb: 'toeB', tempo: 1.15, says: 'a tornado kick: a full turn in the air, the rear leg whipping round',
        load: tr(AIR, { legB: [60, -40, 80], spin: 180 }),
        strike: tr(AIR, { torso: -20, legB: [100, 104, 110], legF: [50, -40, 80], spin: 360 }),
        follow: tr(AIR, { legB: [60, -20, 90], spin: 380 }),
      },
    },
  },
  'muay-thai': {
    says: 'Muay Thai: tall and square, the teep to keep them off, elbows and knees close, the round kick through with the shin',
    guard: THAI, crouch: THAI_LOW, rhythm: { bounce: 0.2, rock: 0.6 }, stance: { open: -15, hips: -12, tilt: -2 },
    normals: { 'stand.L': 'teep', 'stand.M': 'elbow', 'stand.H': 'thai-kick', 'crouch.L': 'crouch-jab', 'crouch.M': 'leg-kick', 'crouch.H': 'sweep', 'air.L': 'air-elbow', 'air.M': 'air-kick', 'air.H': 'flying-knee' },
    families: ['knee', 'jab', 'straight', 'roundhouse', 'uppercut'],
    moves: {
      teep: {
        stance: 'stand', limb: 'toeF', tempo: 1, push: 320, says: 'a teep: the lead foot pushes them off, a jab with the leg',
        load: tr(THAI, { torso: -4, legF: [96, -10, 110] }),
        strike: tr(THAI, { torso: -18, legF: [88, 86, 160], legB: [-6, -4, 90], armF: [70, 160], hip: [-20, 0] }),
        follow: tr(THAI, { torso: -8, legF: [80, 10, 110] }),
      },
      elbow: {
        stance: 'stand', limb: 'elbowB', tempo: 0.95, damage: 1.2, says: 'a horizontal elbow: short and sharp, it cuts',
        load: tr(THAI, { armB: [60, 170], sway: 10, twist: 14 }),
        strike: tr(THAI, { torso: 16, armB: [96, 220], hip: [40, 0], sway: -36, twist: -60, hands: [0.5, -0.2] }),
        follow: tr(THAI, { torso: 14, armB: [80, 230], hip: [30, 0], sway: -40, twist: -70, hands: [0.5, -0.4] }),
      },
      'thai-kick': {
        stance: 'stand', limb: 'ankleB', tempo: 1.2, damage: 1.15, through: true, says: 'a Thai round kick: the arm swings down, the hips turn over and the shin goes through',
        load: tr(THAI, { armB: [40, 170], legB: [-20, -30, 70], sway: 16 }),
        strike: tr(THAI, { torso: -16, head: 0, legB: [98, 94, 100], legF: [4, 0, 70], armB: [-40, -30], armF: [70, 160], sway: -75, twist: -45, feet: [1, 0] }),
        follow: tr(THAI, { torso: -10, legB: [60, 50, 90], armB: [-50, -40], sway: -110, twist: -70, spin: 30 }),
      },
      'leg-kick': {
        stance: 'crouch', limb: 'ankleB', tempo: 1.05, guard: 'low', says: 'a low kick: the shin into the thigh, blocked low',
        load: tr(THAI_LOW, { sway: 14 }),
        strike: tr(THAI_LOW, { torso: 10, legB: [70, 72, 90], armB: [-30, -20], sway: -60, twist: -30 }),
        follow: tr(THAI_LOW, { legB: [40, 40, 90], sway: -80 }),
      },
      'flying-knee': {
        stance: 'air', limb: 'kneeF', tempo: 1, says: 'a flying knee: both hands reach for the head, the knee drives up into it',
        load: tr(AIR, { legF: [40, -60, 70], armF: [100, 160], armB: [90, 170] }),
        strike: tr(AIR, { torso: -10, legF: [110, -30, 60], legB: [-20, -40, 60], armF: [110, 120], armB: [100, 130], hands: [0, 0] }),
      },
      'air-elbow': {
        stance: 'air', limb: 'elbowF', tempo: 1, says: 'a jumping elbow: dropped onto the head from above',
        load: tr(AIR, { armF: [170, 200] }),
        strike: tr(AIR, { torso: 30, armF: [70, 240] }),
      },
    },
  },
  'kung-fu': {
    says: 'kung fu: a low bow stance, open hands up the centre line, palm strikes and claws, the crane kick, kicks that spin',
    guard: KF, crouch: KF_LOW, rhythm: { bounce: 0, rock: 0.25 }, stance: { open: 5, hips: 4, tilt: -4 },
    normals: { 'stand.L': 'palm-strike', 'stand.M': 'tiger-claw', 'stand.H': 'crane-kick', 'crouch.L': 'crouch-jab', 'crouch.M': 'snake-strike', 'crouch.H': 'spin-sweep', 'air.L': 'air-punch', 'air.M': 'butterfly-kick', 'air.H': 'flying-side-kick' },
    families: ['front-kick', 'roundhouse', 'uppercut'],
    moves: {
      'palm-strike': {
        stance: 'stand', limb: 'fistF', tempo: 0.9, says: 'a palm strike: the heel of the hand, quick and straight up the centre line',
        load: tr(KF, { armF: [50, 110] }),
        strike: tr(KF, { torso: 10, armF: [86, 100], hip: [30, -60], twist: 8 }),
        follow: tr(KF, { armF: [80, 104], hip: [20, -60] }),
      },
      'tiger-claw': {
        stance: 'stand', limb: 'fistB', tempo: 1.05, says: 'a tiger claw: both hands raised, then raked down through the guard',
        load: tr(KF, { armF: [100, 180], armB: [100, 200] }),
        strike: tr(KF, { torso: 20, armF: [74, 70], armB: [92, 84], hip: [50, -60], sway: -30, twist: -40, hands: [0.2, 0.2] }),
        follow: tr(KF, { torso: 24, armF: [56, 40], armB: [70, 50], hip: [50, -60], sway: -30, twist: -40 }),
      },
      'crane-kick': {
        stance: 'stand', limb: 'toeF', tempo: 1.1, says: 'a crane kick: up on one leg, the arms spread like wings, the front foot snaps up high',
        load: tr(KF, { legF: [110, -30, 120], armF: [160, 170], armB: [-130, -150], hip: [0, 0], hands: [1.6, 1.6] }),
        strike: tr(KF, { torso: -14, legF: [118, 112, 150], legB: [0, 0, 90], armF: [150, 170], armB: [-140, -160], hip: [0, 0], hands: [1.8, 1.8] }),
        follow: tr(KF, { legF: [110, -20, 120], armF: [140, 170], armB: [-120, -150], hip: [0, 0], hands: [1.6, 1.6] }),
      },
      'snake-strike': {
        stance: 'crouch', limb: 'fistF', tempo: 0.95, says: 'a snake strike: the fingertips dart out low, under the guard',
        load: tr(KF_LOW, { armF: [40, 100] }),
        strike: tr(KF_LOW, { torso: 32, armF: [86, 84], twist: 10, hands: [0.1, 0.05] }),
        follow: tr(KF_LOW, { armF: [80, 90] }),
      },
      'butterfly-kick': {
        stance: 'air', limb: 'toeB', tempo: 1.1, says: 'a butterfly kick: the body laid out flat and spinning, the legs scissoring round',
        load: tr(AIR, { torso: 50, spin: 180, bank: 30 }),
        strike: tr(AIR, { torso: 40, legB: [100, 100, 100], legF: [-40, -40, 80], spin: 360 }),
        follow: tr(AIR, { torso: 20, spin: 380 }),
      },
    },
  },
  capoeira: {
    says: 'capoeira: the ginga\'s rocking step, the head low, kicks that turn and sweep, a hand on the floor, the head as a weapon',
    guard: CAP, crouch: CAP_LOW, rhythm: { bounce: 0.3, rock: 1 }, stance: { open: 10, hips: 10, tilt: 4 },
    normals: { 'stand.L': 'bencao', 'stand.M': 'martelo', 'stand.H': 'meia-lua', 'crouch.L': 'cabecada', 'crouch.M': 'chapa-baixa', 'crouch.H': 'rasteira', 'air.L': 'air-kick', 'air.M': 'armada', 'air.H': 'parafuso' },
    families: ['knee', 'front-kick'],
    moves: {
      bencao: {
        stance: 'stand', limb: 'ankleF', tempo: 1, push: 280, says: 'a bênção: the sole pushes straight out into the chest, a blessing that shoves',
        load: tr(CAP, { torso: 6, legF: [100, -20, 140], hip: [0, -20] }),
        strike: tr(CAP, { torso: -20, legF: [90, 88, 170], legB: [-6, -6, 86], armF: [60, 160], hip: [0, 0] }),
        follow: tr(CAP, { torso: -6, legF: [90, -10, 140], hip: [0, -20] }),
      },
      martelo: {
        stance: 'stand', limb: 'toeB', tempo: 1.1, says: 'a martelo: the hammer, the instep whipping round high',
        load: tr(CAP, { torso: 10, legB: [60, -30, 80], hip: [0, -20], sway: 20 }),
        strike: tr(CAP, { torso: -30, head: -10, legB: [108, 112, 100], legF: [4, 0, 80], armB: [-50, -40], armF: [70, 170], hip: [0, 0], sway: -70, twist: -30, feet: [1, 0.1] }),
        follow: tr(CAP, { torso: -10, legB: [70, -10, 90], hip: [0, -20], sway: -50 }),
      },
      'meia-lua': {
        stance: 'stand', limb: 'toeB', tempo: 1.3, through: true, says: 'a meia-lua de compasso: the hands to the floor, the body turns and the heel sweeps round high',
        load: tr(CAP, { torso: 70, head: 50, armF: [10, 10], armB: [-10, -10], legB: [-40, -40, 70], hip: [0, -60], spin: 180 }),
        strike: tr(CAP, { torso: 80, head: 70, armF: [0, 0], armB: [10, 10], legB: [120, 125, 160], legF: [40, -10, 90], hip: [0, -60], spin: 360 }),
        follow: tr(CAP, { torso: 50, legB: [70, 50, 90], spin: 380 }),
      },
      cabecada: {
        stance: 'crouch', limb: 'head', tempo: 1, says: 'a cabeçada: the head, driven low into the body',
        load: tr(CAP_LOW, { torso: 10, head: -10 }),
        strike: tr(CAP_LOW, { torso: 60, head: 70, armF: [20, 60], armB: [-10, 20], hip: [80, -20] }),
        follow: tr(CAP_LOW, { torso: 50, head: 60, hip: [60, -20] }),
      },
      'chapa-baixa': {
        stance: 'crouch', limb: 'ankleF', tempo: 1, guard: 'low', says: 'a chapa baixa: a low push with the sole, a hand on the floor',
        load: tr(CAP_LOW, { legF: [92, -30, 140], armB: [-60, -70] }),
        strike: tr(CAP_LOW, { torso: 40, legF: [76, 78, 170], armB: [-20, -10], sway: 50 }),
        follow: tr(CAP_LOW, { legF: [88, -20, 140], sway: 30 }),
      },
      rasteira: {
        stance: 'crouch', limb: 'toeF', tempo: 1.1, guard: 'low', knock: 'down', adv: { block: -12 },
        says: 'a rasteira: the hands on the floor, the lead foot hooks the legs away',
        load: tr(CAP_LOW, { torso: 50, legF: [60, 20, 90], sway: -10 }),
        strike: tr(CAP_LOW, { torso: 54, legF: [86, 90, 100], legB: [36, -70, 60], armF: [10, 10], armB: [-10, -10], hip: [0, -70], sway: 40 }),
        follow: tr(CAP_LOW, { torso: 50, legF: [70, 72, 100], sway: 50 }),
      },
      armada: {
        stance: 'air', limb: 'toeB', tempo: 1.1, says: 'an armada pulada: a jumping spin, the outside of the foot round',
        load: tr(AIR, { torso: -6, spin: 180 }),
        strike: tr(AIR, { torso: -16, legB: [104, 108, 100], legF: [40, -40, 80], spin: 360 }),
        follow: tr(AIR, { spin: 380 }),
      },
      parafuso: {
        stance: 'air', limb: 'toeF', tempo: 1.2, says: 'a parafuso: the corkscrew, both legs round in the air',
        load: tr(AIR, { spin: 180, bank: 25 }),
        strike: tr(AIR, { torso: -20, legF: [100, 100, 110], legB: [70, -20, 90], spin: 360 }),
        follow: tr(AIR, { spin: 380 }),
      },
    },
  },
  savate: {
    says: 'savate: upright and bladed, the shoe as the weapon: the fouetté\'s whip, the chassé\'s stop-hit, the spinning revers',
    guard: SAV, rhythm: { bounce: 0.6, rock: 0 }, stance: { open: 8, hips: 6, tilt: 2 },
    normals: { 'stand.L': 'fouette', 'stand.M': 'chasse', 'stand.H': 'revers', 'crouch.L': 'coup-bas', 'crouch.M': 'crouch-punch', 'crouch.H': 'sweep', 'air.L': 'air-punch', 'air.M': 'air-kick', 'air.H': 'flying-side-kick' },
    families: ['jab', 'straight', 'hook'],
    moves: {
      fouette: {
        stance: 'stand', limb: 'toeF', tempo: 0.95, says: 'a fouetté: the lead leg whips round and the point of the shoe lands',
        load: tr(SAV, { legF: [100, -20, 90], sway: -10 }),
        strike: tr(SAV, { torso: -24, head: -8, legF: [114, 120, 130], legB: [2, -12, 64], armF: [30, 120], sway: 60, twist: 10, feet: [0.1, 1] }),
        follow: tr(SAV, { legF: [100, -24, 100], sway: 45 }),
      },
      chasse: {
        stance: 'stand', limb: 'ankleF', tempo: 1.05, says: 'a chassé: the sole of the shoe driven out side-on, the long stop-hit',
        load: tr(SAV, { torso: -4, legF: [122, -4, 130], sway: 40, twist: 10 }),
        strike: tr(SAV, { torso: -30, legF: [84, 84, 175], legB: [8, -14, 80], sway: 85, twist: 20, feet: [0, 1] }),
        follow: tr(SAV, { torso: -16, legF: [106, -16, 130], sway: 55, twist: 10 }),
      },
      revers: {
        stance: 'stand', limb: 'toeB', tempo: 1.3, says: 'a revers: a spinning back kick, the heel hooking round',
        load: tr(SAV, { torso: 6, legB: [70, -40, 80], legF: [16, -6, 70], spin: 180 }),
        strike: tr(SAV, { torso: -24, head: -10, legB: [100, 106, 110], legF: [8, -10, 70], armB: [-30, -10], spin: 360 }),
        follow: tr(SAV, { torso: -10, legB: [104, -10, 90], spin: 380 }),
      },
      'coup-bas': {
        stance: 'crouch', limb: 'toeF', tempo: 0.95, guard: 'low', says: 'a coup de pied bas: the toe of the shoe to the shin, low',
        load: tr(POSES.crouch, { legF: [56, 0, 100] }),
        strike: tr(POSES.crouch, { torso: 16, legF: [70, 76, 120], sway: 25 }),
        follow: tr(POSES.crouch, { legF: [56, 10, 100] }),
      },
    },
  },
  brawler: {
    says: 'brawling: nothing taught, everything meant: the headbutt, the body blow, the haymaker wound back to the floor',
    guard: BRAWL, crouch: BRAWL_LOW, rhythm: { bounce: 0, rock: 0.4 }, stance: { open: -10, hips: -8, tilt: 6 },
    normals: { 'stand.L': 'headbutt', 'stand.M': 'body-blow', 'stand.H': 'haymaker', 'crouch.L': 'crouch-jab', 'crouch.M': 'low-kick', 'crouch.H': 'shoulder-charge', 'air.L': 'air-punch', 'air.M': 'air-kick', 'air.H': 'elbow-drop' },
    families: ['jab', 'hook', 'knee', 'uppercut', 'front-kick'],
    moves: {
      headbutt: {
        stance: 'stand', limb: 'head', tempo: 0.95, says: 'a headbutt: a fist in the collar, the forehead brought down',
        load: tr(BRAWL, { torso: -6, head: -16, armF: [50, 100], armB: [40, 100] }),
        strike: tr(BRAWL, { torso: 50, head: 58, armF: [60, 90], armB: [50, 90], legF: [30, 10, 84], legB: [-34, -26, 60], hip: [170, -20] }),
        follow: tr(BRAWL, { torso: 40, head: 40, hip: [110, -10] }),
      },
      'body-blow': {
        stance: 'stand', limb: 'fistB', tempo: 1, says: 'a body blow: the rear fist dug up into the ribs',
        load: tr(BRAWL, { armB: [-20, 60], sway: 14, twist: 16 }),
        strike: tr(BRAWL, { torso: 30, head: 24, armB: [70, 60], hip: [40, -20], sway: -40, twist: -50, hands: [0.6, 0] }),
        follow: tr(BRAWL, { torso: 28, armB: [60, 80], hip: [30, -20], sway: -40, twist: -55 }),
      },
      haymaker: {
        stance: 'stand', limb: 'fistB', tempo: 1.35, damage: 1.25, says: 'a haymaker: wound right back, swung all the way through, a lot to see coming',
        load: tr(BRAWL, { torso: -10, head: -6, armB: [-120, -70], armF: [60, 100], sway: 30, twist: 40 }),
        strike: tr(BRAWL, { torso: 30, head: 20, armB: [110, 80], armF: [10, 60], legB: [-20, -20, 60], hip: [80, -10], sway: -55, twist: -80, hands: [0.6, -0.1] }),
        follow: tr(BRAWL, { torso: 40, head: 30, armB: [60, 30], armF: [0, 40], hip: [70, -10], sway: -70, twist: -90, spin: 20 }),
      },
      'shoulder-charge': {
        stance: 'crouch', limb: 'head', tempo: 1.1, knock: 'down', travel: 18, adv: { block: -12 },
        says: 'a shoulder charge: low and straight through them, it knocks them down',
        load: tr(BRAWL_LOW, { torso: 40 }),
        strike: tr(BRAWL_LOW, { torso: 70, head: 60, armF: [10, 40], armB: [-20, 10], legB: [-40, -50, 60], hip: [120, -40], twist: -30 }),
        follow: tr(BRAWL_LOW, { torso: 60, hip: [100, -40] }),
      },
      'elbow-drop': {
        stance: 'air', limb: 'elbowB', tempo: 1.1, says: 'an elbow drop: the point of the elbow, dropped from height',
        load: tr(AIR, { armB: [170, 220] }),
        strike: tr(AIR, { torso: 40, armB: [40, 200], armF: [40, 120] }),
      },
    },
  },
};

/** Every family, one namespace: the library's, the shared ones, and every tradition's own. */
export const FAMILIES = Object.freeze({
  ...NORMAL_FAMILIES, ...SHARED_MOVES,
  ...Object.assign({}, ...Object.values(TRADITION_LIST).map((t) => t.moves)),
});

export const TRADITIONS = Object.freeze(TRADITION_LIST);

// a walk from a guard: the legs as the genre's walk moves them from its own guard
const TR_WALK = (guard, sign) => {
  const d = (a, b) => (a ?? []).map((v, i) => v + ((b ?? [])[i] ?? 0));
  const [dF, dB] = sign > 0 ? [[8, 6, 0], [8, -10, -2]] : [[-10, -8, 0], [-8, 8, 2]];
  return { ...guard, legF: d(guard.legF, dF), legB: d(guard.legB, dB) };
};

/** The poses a fighter of tradition `word` stands, crouches and walks in; null for the genre's own (or no word). */
export function traditionRests(word) {
  const t = word ? TRADITIONS[word] : null;
  if (!t) return null;
  return { stand: t.guard, crouch: t.crouch ?? POSES.crouch, air: POSES.jump, walkA: TR_WALK(t.guard, 1), walkB: TR_WALK(t.guard, -1) };
}
