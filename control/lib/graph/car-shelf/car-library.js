/**
 * car-library — the CARDS: named configurations of the car shelf, each a class (its true numbers, roads/vehicles.js),
 * a body style (car-bodies.js), a design language (car-languages.js), a trim (car-trims.js), its own parts and a paint
 * (car-paints.js). A card is a starter, never a second car: every one of its choices can be overridden, and a
 * composition with no card names its class, body and language itself. The supercar library's way
 * (car-designer/vehicle-library.js), for the cars people get about in.
 *
 *   CAR_CARDS                       id → { title, class, body, language, trim, parts?, paint? }
 *   composeCar(spec)                spec { preset?, class?, body?, language?, trim?, parts?, paint?, seed? } (or a card's
 *                                   id) → the DESIGN: its numbers at the class (the wheels' radius and the ride its
 *                                   trim's), every slot resolved (the language's word unless the trim or the parts name
 *                                   another), its paint, and its laws
 *   readCarSpec(spec)               the spec checked (throws naming what is wrong)
 *   CAR_SPEC_KEYS
 *
 * Laws (each { id, pass }): the wheels inside the body's length, the track inside its width, the bonnet over the wheels,
 * the roof over the belt, a ground clearance, an open body's roof open or soft, a closed body's never open. They advise;
 * `valid` says whether all passed. Pure and deterministic.
 */
import { VEHICLES, wheelLayout } from '../roads/vehicles.js';
import { bodyStyle, BODY_STYLE_IDS } from './car-bodies.js';
import { carLanguage, CAR_LANGUAGE_IDS } from './car-languages.js';
import { carTrim, readParts, CAR_TRIM_IDS, PART_SLOTS } from './car-trims.js';
import { readPaint } from './car-paints.js';

const card = (title, cls, body, language, trim = 'base', parts = {}, paint = undefined) =>
  Object.freeze({ title, class: cls, body, language, trim, parts: Object.freeze(parts), ...(paint !== undefined ? { paint } : {}) });

export const CAR_CARDS = Object.freeze({
  // ── the everyday ────────────────────────────────────────────────────────────
  familySedan: card('Family sedan', 'midsize', 'sedan', 'current', 'comfort', {}, 'moonstone'),
  familyHatch: card('Family hatchback', 'compact', 'hatchback', 'current', 'base', {}, 'steel blue'),
  supermini: card('Supermini', 'subcompact', 'hatchback', 'current', 'base', {}, 'crimson'),
  cityCar: card('City car', 'cityCar', 'hatchback', 'cute', 'base', {}, 'butter'),
  keiWagon: card('Kei wagon', 'keiCar', 'tallBox', 'cute', 'base', {}, 'mint'),
  microcar: card('Microcar', 'microcar', 'bubble', 'cute', 'base', { roof: 'contrast' }, { colour: 'sky', scheme: 'roof', second: 'milk' }),
  estate: card('Family estate', 'midsize', 'wagon', 'current', 'comfort', { rails: true }, 'deep blue'),
  crossover: card('Crossover', 'crossover', 'crossover', 'current', 'base', { clad: true, rails: true }, 'graphite'),
  familySuv: card('Three-row SUV', 'midSuv', 'suv', 'current', 'comfort', { clad: true, rails: true }, 'obsidian'),
  largeSuv: card('Full-size SUV', 'largeSuv', 'suv', 'current', 'luxury', { grille: 'large', bumpers: 'body', rails: true }, 'obsidian'),
  peopleCarrier: card('People carrier', 'minivan', 'minivan', 'current', 'comfort', { roof: 'solid' }, 'glacier white'),
  // ── the pleasure of it ──────────────────────────────────────────────────────
  hotHatch: card('Hot hatch', 'compact', 'hatchback', 'current', 'sport', { exhaust: 'twin' }, { colour: 'crimson', scheme: 'roof', second: 'obsidian' }),
  sportsCoupe: card('Sports coupe', 'coupe', 'coupe', 'current', 'sport', { spoiler: 'lip' }, 'steel blue'),
  convertible: card('Convertible', 'coupe', 'convertible', 'current', 'comfort', { roof: 'open', frames: 'chrome' }, 'crimson'),
  roadster: card('Roadster', 'roadster', 'roadster', 'jellybean', 'sport', { grille: 'oval', spoiler: 'none', exhaust: 'twin', skirts: false, splitter: false }, 'cherry'),
  muscleCar: card('Muscle car', 'muscle', 'fastback', 'chrome', 'sport', { grille: 'bars', lamps: 'round', bumpers: 'chrome', wheel: 'sport', tyre: 'lowProfile', stripes: 'twin', spoiler: 'ducktail', strip: 'none', skirts: false, splitter: false, exhaust: 'quad' }, 'onyx'),
  luxurySaloon: card('Luxury saloon', 'fullsize', 'sedan', 'current', 'luxury', { grille: 'bars' }, 'obsidian'),
  // ── electric ────────────────────────────────────────────────────────────────
  electricSaloon: card('Electric saloon', 'fullsize', 'liftback', 'aero', 'eco', { roof: 'glass' }, 'pearl'),
  electricHatch: card('Electric hatchback', 'compact', 'hatchback', 'aero', 'eco', {}, 'ice blue'),
  electricCrossover: card('Electric crossover', 'crossover', 'crossover', 'aero', 'eco', { roof: 'contrast', clad: true }, { colour: 'cloud grey', scheme: 'roof', second: 'void' }),
  // ── off the road ────────────────────────────────────────────────────────────
  offroader: card('Off-roader', 'offroader', 'boxy', 'rugged', 'offroad', { spare: true, roof: 'contrast' }, { colour: 'sand', scheme: 'roof', second: 'chalk' }),
  // ── from other decades ──────────────────────────────────────────────────────
  classicCruiser: card('Fifties cruiser', 'fullsize', 'sedan', 'chrome', 'base', { spoiler: 'none' }, { colour: 'seafoam', scheme: 'split', second: 'cream' }),
  eightiesSedan: card('Eighties sedan', 'midsize', 'sedan', 'wedge', 'base', {}, 'champagne'),
  ninetiesHatch: card('Nineties hatchback', 'subcompact', 'hatchback', 'jellybean', 'base', {}, 'teal'),
});
export const CAR_CARD_IDS = Object.freeze(Object.keys(CAR_CARDS));

export const CAR_SPEC_KEYS = Object.freeze(['preset', 'class', 'body', 'language', 'trim', 'parts', 'paint', 'seed']);
/** A class the shelf can build a car on: a four-wheeled road class with axles (the cycles, karts and open frames are
 *  other shelves'). */
export const CAR_CLASS_LIMITS = Object.freeze({ L: [2.4, 5.6], H: [1.1, 2.1] });
export const carClass = (cls) => {
  const v = VEHICLES[cls];
  return Boolean(v) && wheelLayout(v) === 'axles' && !v.running && !v.site && v.L >= CAR_CLASS_LIMITS.L[0] && v.L <= CAR_CLASS_LIMITS.L[1] && v.H >= CAR_CLASS_LIMITS.H[0] && v.H <= CAR_CLASS_LIMITS.H[1] && v.mass < 3500;
};

export function readCarSpec(spec) {
  const S = typeof spec === 'string' ? { preset: spec } : spec;
  if (!S || typeof S !== 'object' || Array.isArray(S)) throw new Error('car-shelf: a car is a card\'s id or { preset?, class?, body?, language?, trim?, parts?, paint?, seed? }');
  for (const k of Object.keys(S)) if (!CAR_SPEC_KEYS.includes(k)) throw new Error(`car-shelf: '${k}' is not one of ${CAR_SPEC_KEYS.join(', ')}`);
  if (S.preset !== undefined && !CAR_CARDS[S.preset]) throw new Error(`car-shelf: preset is one of ${CAR_CARD_IDS.join(', ')}`);
  if (S.preset === undefined && (S.class === undefined || S.body === undefined || S.language === undefined)) throw new Error('car-shelf: a car without a preset names its class, body and language');
  if (S.class !== undefined && !carClass(S.class)) throw new Error(`car-shelf: class '${S.class}' is no car class (a four-wheeled road class of a car's size)`);
  if (S.body !== undefined) bodyStyle(S.body);
  if (S.language !== undefined) carLanguage(S.language);
  if (S.trim !== undefined) carTrim(S.trim);
  if (S.parts !== undefined) readParts(S.parts);
  if (S.seed !== undefined && !Number.isInteger(S.seed)) throw new Error('car-shelf: seed is a whole number');
  return S;
}

const r4 = (v) => Math.round(v * 1e4) / 1e4 + 0;
// the slots a language gives when nothing else names them
const FROM_LANGUAGE = Object.freeze(['lamps', 'tails', 'grille', 'bumpers', 'wheel', 'tyre', 'frames', 'strip', 'flares']);
const DEFAULTS = Object.freeze({ roof: 'solid', spoiler: 'none', exhaust: 'hidden', stripes: 'none', rails: false, clad: false, flares: false, skirts: false, splitter: false, skid: false, fogs: false, spare: false, ride: 0, wheelScale: 0 });

/** A composition solved: its class's numbers, its body, its language, every slot, its paint, its laws. */
export function composeCar(spec = {}) {
  const S = readCarSpec(spec), C = S.preset ? CAR_CARDS[S.preset] : {};
  const cls = S.class ?? C.class, body = S.body ?? C.body, language = S.language ?? C.language, trim = S.trim ?? C.trim ?? 'base';
  const B = bodyStyle(body), Lg = carLanguage(language), T = carTrim(trim), v = VEHICLES[cls], seed = S.seed ?? 1;
  const fromLang = Object.fromEntries(FROM_LANGUAGE.map((k) => [k, Lg[k] ?? DEFAULTS[k]]));
  const parts = { ...DEFAULTS, ...fromLang, ...T.parts, ...(C.parts ?? {}), ...(S.parts ?? {}) };
  // an open body's roof is open unless a soft top is up; a closed body's is never open
  if (B.open && !['open', 'soft'].includes(parts.roof)) parts.roof = 'open';
  // a spoiler 'auto': a lip on a boot or an open deck, a roof spoiler over a hatch or a tailgate
  if (parts.spoiler === 'auto') parts.spoiler = ['boot', 'open'].includes(B.tail) ? 'lip' : 'roof';
  // a spare wheel hangs on an upright tailgate only
  if (parts.spare && B.tail !== 'liftgate') parts.spare = false;
  const paint = readPaint(S.paint ?? C.paint, { palette: Lg.palette, seed });
  if (parts.roof === 'contrast' && paint.scheme === 'mono') Object.assign(paint, { scheme: 'roof', second: readPaint({ colour: paint.body, scheme: 'roof' }, { palette: Lg.palette }).second });
  const r = r4(v.wheelRadius * (1 + parts.wheelScale));
  const tyreW = r4(Math.max(0.17, Math.min(0.3, v.W * 0.12 + (parts.tyre === 'lowProfile' ? 0.025 : parts.tyre === 'allTerrain' ? 0.035 : 0))));
  const frame = { L: v.L, W: v.W, H: v.H, wb: v.wheelbase, track: v.track, r, r0: v.wheelRadius, tyreW, lift: r4(parts.ride) };
  const laws = [
    { id: 'wheelbase-inside-body', pass: frame.wb + 2 * r < frame.L },
    { id: 'track-inside-width', pass: frame.track + tyreW <= frame.W + 0.02 },
    { id: 'bonnet-over-wheels', pass: B.zHood * frame.H + frame.lift > 2 * r },
    { id: 'roof-over-belt', pass: B.open || B.zBelt < 0.8 },
    { id: 'ground-clearance', pass: r * 0.68 + frame.lift > 0.1 },
    { id: 'roof-fits-body', pass: B.open ? ['open', 'soft'].includes(parts.roof) : parts.roof !== 'open' && parts.roof !== 'soft' },
  ];
  return {
    preset: S.preset ?? null, title: C.title ?? `${Lg.reads.split(':')[0]} ${B.label}`, class: cls, body, language, trim, seed,
    style: B, lang: Lg, parts, paint, frame, laws, valid: laws.every((l) => l.pass),
  };
}
