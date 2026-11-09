/**
 * THE FIRING RANGE — a game being designed, its weapons tried before its levels exist. The weapons the game needs (each
 * by its fire type and its numbers), optionally what each looks like, carried by a person into the gym and measured on
 * the runtime the game will ship (measure.js): the rounds and the seconds each takes to drop a body at 5, 15 and 30 m,
 * its cone and climb, its marks on each matter, its switch and its reload, a melee weapon's cuts; the gym laid from those
 * numbers and played (gym.js, the combat book's page). A made game's own weapons go through the combat book; this is
 * the same range before there is a game.
 *
 *   rangeOf({ weapons, skins?, sounds?, foe?, name?, quiet? })   → { minted, m, reach, gym, gate } (book.js combatSample's shape)
 *   rangeHtml(spec)                              → the page
 *
 *   weapons  1 to 5 (a body's slots, in order), each one of:
 *              a kit word ('rifle', 'shotgun', 'handgun', ...: arms-kit.js): its numbers and its look the kit's
 *              { name, fire, ...numbers }: a FIRE TYPE and the numbers it asks (FIRE below; what is not given, its
 *                default): `hitscan` a round that lands where it is aimed the frame it is fired, `projectile` one that
 *                flies (its speed, its drop, its burst), `melee` a blade in the free hand (V from the eye)
 *              { name, weapon }: a runtime weapon row as it is (worlds/controllable/combat-ranged.js initWeapon)
 *            At most one melee weapon (the free hand holds one).
 *   skins    { [name]: a kit word or an arm's build words ({ item, model?, line?, parts? }) }: what a weapon looks like
 *            in the hands, its numbers untouched; absent, a graybox of its fire type (a rifle's shape for hitscan, a
 *            launcher's tube for a projectile, the combat knife for melee)
 *   sounds   { [name]: { shot?, reload?, hit?, draw? } } (a melee weapon's { swing?, hit? }), each a word of the SFX shelf:
 *            what a weapon sounds like, the game's own choice; absent, chosen by what it is (range-sound.js). `quiet`:
 *            no sound at all
 *   foe      { hp? }: the body the rounds are timed against (100)
 * Pure but for the measures' time (a few seconds a weapon).
 */
import { kitSlot, ARMS_KIT, ADS, KNIFE, bladeLook } from '../arms-kit.js';
import { ARM_MODELS } from '../../equipment/arms/models.js';
import { SHOOT } from '../quick.js';
import { measureCombat, combatLaws } from './measure.js';
import { gymOf, gymPageHtml } from './gym.js';
import { rangeAudio } from './range-sound.js';
import { resolveSoundId } from '../../sfx-shelf/roster.js';

/** A fire type's numbers when it is not given them: one body (100 hp) in four hitscan rounds, two rockets, two cuts; a
 * hitscan round a rifle's cone, climb and look (rounds.js); a rocket drawn at a person's launcher's scale (`fxScale`: its body, its flash and its sparks; the page's default is a mech's). */
export const FIRE = Object.freeze({
  hitscan: Object.freeze({ fireClass: 'sight', auto: false, cooldown: 0.25, magazine: 20, reserve: 60, reload: 2, damage: 25, range: 60, coreAngle: 1.2, impact: 1,
    spread: Object.freeze({ base: 0.6, move: 2.5, bloom: 0.4, recover: 5, max: 4, wait: 0.15 }), recoil: Object.freeze({ kick: 0.4, recover: 4, max: 4, wait: 0.15 }), round: Object.freeze({ speed: 880, flash: 0.14 }) }),
  projectile: Object.freeze({ fireClass: 'lob', auto: false, cooldown: 0.9, magazine: 4, reserve: 12, reload: 2.6, damage: 50, range: 60, projectileSpeed: 40, projectileGravity: 0, lobAngle: 0,
    splashRadius: 2.5, projRadius: 0.2, armTime: 0.05, fuse: 4, impact: 1, fxScale: 0.5 }),
  melee: Object.freeze({ reach: KNIFE.reach, damage: 50, dur: KNIFE.dur, cooldown: KNIFE.cooldown, cone: KNIFE.cone }),
});
export const FIRE_TYPES = Object.freeze(Object.keys(FIRE));
// (a projectile's words onto the runtime's)
const PROJECTILE_WORDS = { speed: 'projectileSpeed', gravity: 'projectileGravity', splash: 'splashRadius', radius: 'projRadius' };
const MAX = 5;
const PERSON = Object.freeze({ a: 0.35, c: 0.9 });

/** What is wrong with a range's spec, by name; [] when it can be set up. */
export function validateRange({ weapons, skins = {}, sounds = {}, foe = {} } = {}) {
  const errs = [];
  if (!Array.isArray(weapons) || !weapons.length || weapons.length > MAX) return [`weapons: 1 to ${MAX}, each a kit word (${Object.keys(ARMS_KIT).join(', ')}), { name, fire: ${FIRE_TYPES.join(' | ')}, ...numbers } or { name, weapon }`];
  const names = new Set();
  let melee = 0;
  weapons.forEach((w, i) => {
    const name = typeof w === 'string' ? w : w?.name;
    if (typeof w === 'string') { if (!ARMS_KIT[w]) errs.push(`weapons[${i}]: '${w}' is not a kit word (${Object.keys(ARMS_KIT).join(', ')})`); }
    else if (!w || typeof w !== 'object' || typeof w.name !== 'string' || !w.name) errs.push(`weapons[${i}]: a kit word, or an object with a name`);
    else if (w.weapon !== undefined) { if (!w.weapon || typeof w.weapon !== 'object' || !w.weapon.fireClass) errs.push(`weapons[${i}].weapon: a runtime weapon row (its fireClass at least)`); }
    else if (!FIRE[w.fire]) errs.push(`weapons[${i}].fire: one of ${FIRE_TYPES.join(', ')}`);
    else if (w.fire === 'melee') melee++;
    if (name && names.has(name)) errs.push(`weapons[${i}]: '${name}' named twice`);
    if (name) names.add(name);
  });
  if (melee > 1) errs.push('weapons: one melee weapon (the free hand holds one)');
  for (const [k, s] of Object.entries(skins ?? {})) {
    if (!names.has(k)) errs.push(`skins.${k}: no weapon of that name`);
    else if (typeof s === 'string') { if (!ARMS_KIT[s] || ARMS_KIT[s].bow) errs.push(`skins.${k}: '${s}' is not a gun of the kit`); }
    else if (!s || typeof s !== 'object' || !ARM_MODELS[s.item]) errs.push(`skins.${k}: a kit word or an arm's build words ({ item: ${Object.keys(ARM_MODELS).join(' | ')}, model?, parts? })`);
  }
  const meleeName = weapons.find((w) => w && w.fire === 'melee')?.name;
  for (const [k, s] of Object.entries(skins ?? {})) {
    const blade = typeof s === 'object' && s?.item === 'knife';
    if (k === meleeName && !blade) errs.push(`skins.${k}: a melee weapon's skin is a knife's build words ({ item: 'knife', model? })`);
    else if (k !== meleeName && blade) errs.push(`skins.${k}: a knife is a melee weapon's skin`);
  }
  for (const [k, S] of Object.entries(sounds ?? {})) {
    if (!names.has(k)) { errs.push(`sounds.${k}: no weapon of that name`); continue; }
    const melee = k === meleeName, slotsOk = melee ? ['swing', 'hit'] : ['shot', 'reload', 'hit', 'draw'];
    for (const [slot, w] of Object.entries(S ?? {})) {
      if (!slotsOk.includes(slot)) errs.push(`sounds.${k}.${slot}: a ${melee ? 'melee weapon' : 'gun'} sounds its ${slotsOk.join(', ')}`);
      else if (!resolveSoundId(w)) errs.push(`sounds.${k}.${slot}: '${w}' is not a sound on the SFX shelf`);
    }
  }
  if (foe && foe.hp !== undefined && !(foe.hp > 0)) errs.push('foe.hp: a positive number');
  return errs;
}

// a launcher's tube in graybox (cm, the item frame: the bore along +z, +y up), its grip and its hands: a projectile's look
// when it is given none
const TUBE = Object.freeze({
  kind: 'long', boxes: [[[-4, -4, -18], [4, 4, 62], '#5a5f57', 'tube'], [[-1.4, -13, -6], [1.4, -4.5, 0], '#26282b', 'grip'], [[-1.4, -11, 22], [1.4, -4.5, 26], '#26282b', 'foregrip'], [[-1.5, 4.5, 2], [1.5, 9, 8], '#3b3f45', 'sights']],
  grip: [0, -9, -3], sight: { y: 7, rear: 2, front: 8 }, muzzle: 62,
  hands: { strong: { at: [0, -9, -3], c: [0, 0.95, 0.31], a: [0, 0, 1] }, support: { at: [0, -8, 24], c: [0, 1, 0], a: [0, 0, 1] } },
});
// the sights and the hands of a weapon given no arm: an open sight, a modest sway and switch
const GUNPLAY = (view) => ({ kind: view.kind, ads: { zoom: 1.3, time: 0.25, spread: ADS.spread, move: ADS.move, moveSpread: ADS.moveSpread }, sway: 1.5, swap: { out: 0.3, in: 0.35 }, view });
// a skin's look (a kit word or an arm's build words), its numbers left
const lookOf = (skin, base) => (skin ? kitSlot(skin, base).gunplay : null);

/** A range's body and its target: the slots its weapons make, the knife its melee is. → { pilot, foe, payload } */
export function rangeBody({ weapons, skins = {}, sounds = {}, foe = {}, name = null, quiet = false } = {}) {
  const errs = validateRange({ weapons, skins, sounds, foe });
  if (errs.length) throw new Error(`firing range: ${errs.join('; ')}`);
  const hp = foe.hp ?? 100;
  // (a kit word's rounds scaled to this body: the kit's numbers are against the quick shooter's foe)
  const base = { ...SHOOT.rifle, damage: hp / SHOOT.foeHp };
  const slots = [];
  let knife = null;
  for (const w of weapons) {
    if (typeof w === 'string') { const s = kitSlot(w, base); const look = lookOf(skins[w], base); slots.push({ ...s, ...(look ? { gunplay: { ...s.gunplay, view: look.view, kind: look.kind } } : {}) }); continue; }
    if (w.fire === 'melee') {
      const { name: _n, fire: _f, ...num } = w, K = { ...FIRE.melee, ...num };
      knife = { reach: K.reach, cone: K.cone, dur: K.dur, window: [...KNIFE.window], cooldown: K.cooldown, impact: KNIFE.impact, damage: K.damage, name: w.name, view: bladeLook(skins[w.name] ?? null) };
      continue;
    }
    let weapon;
    if (w.weapon) weapon = { ...w.weapon };
    else {
      const { name: _n, fire, rof, ...num } = w;
      weapon = JSON.parse(JSON.stringify(FIRE[fire]));
      for (const [k, v] of Object.entries(num)) weapon[PROJECTILE_WORDS[k] && fire === 'projectile' ? PROJECTILE_WORDS[k] : k] = v;
      if (rof > 0) { weapon.auto = true; weapon.rof = rof; delete weapon.cooldown; }
    }
    const look = lookOf(skins[w.name], base);
    const view = look ? look.view : weapon.fireClass === 'lob' ? TUBE : kitSlot('rifle', base).gunplay.view;
    slots.push({ name: w.name, weapon, switchReady: 0.65, gunplay: look ? { ...GUNPLAY(view), ads: look.ads, sway: look.sway, swap: look.swap } : GUNPLAY(view) });
  }
  // its sounds (range-sound.js): each weapon's own, by what it is or the game's word; the range's on a mix in the open
  const heard = quiet ? null : rangeAudio({ slots, knife, sounds });
  if (heard) for (const s of slots) s.weapon = { ...s.weapon, sfx: heard.sfx[s.name] };
  // a person, first person, as a made first-person shooter lays one: a person's pace, the eye at 1.7 m, a hull under it
  const rule = { type: 'walk', speed: 4.5, turn: 2.4, eye: 1.7, turnMode: 'look', lookPitch: true, strafe: 1, collideRadius: 0.3, collideHeight: 1.7, ...(slots.length ? { loadout: slots, gunplay: true } : {}), ...(knife ? { knife } : {}) };
  const pilot = { id: 'player', pilotable: true, rule, ...(slots.length ? { weapon: slots[0].weapon } : {}), body: { type: 'none', hittable: true, radius: 0.5, egg: { ...PERSON, cz: PERSON.c - 1.7 } } };
  // the target: a body's box on its feet, its hit volume a person's
  const target = { id: 'target', body: { type: 'mesh', shape: 'box', size: [0.5, 0.3, 1.8], color: 0xb0716a, marker: false, hittable: true, hp, radius: 0.5, egg: { ...PERSON, cz: 0 } }, lift: 0.9 };
  const payload = { camera: { rule: 'eye', target: 'player', height: 0, mouseLook: true, hideTarget: true }, figures: {},
    events: { hud: [{ text: `W / S  walk · A / D  step aside · mouse  look · click  fire · right click  aim · R  reload · 1-5 or wheel  switch${knife ? ' · V  knife' : ''}` }] },
    ...(heard ? { audio: heard.audio } : {}) };
  return { pilot, foe: target, payload, name: name ?? 'the firing range' };
}

/** A range, measured and laid (book.js combatSample's shape). */
export function rangeOf(spec = {}) {
  const { pilot, foe, payload, name } = rangeBody(spec);
  const m = measureCombat(pilot, foe, { camera: 'first-person', name });
  m.laws = combatLaws(m);
  return { minted: { pilot, foe, payload }, m, ...gymOf(pilot, m) };
}

/** The range's page: its gym, played from the eye. */
export function rangeHtml(spec = {}) {
  const S = rangeOf(spec);
  return gymPageHtml(S.minted, S.m, S.gym, S.gate, { kind: 'firing range', tag: `${spec.weapons.length} weapon${spec.weapons.length > 1 ? 's' : ''}` });
}

export const RANGE_MAX = MAX;
