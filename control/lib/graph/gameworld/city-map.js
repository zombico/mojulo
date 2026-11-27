/**
 * THE CITY'S MAP — a played town's or district's plan laid on mana-ui's map (control/lib/mana-ui/kernel.js `map`): its
 * ground as shapes from 0 to 1, north up, and what is on it as markers with icons; the page hosts it
 * (scene/channels/map-channel.js) as a radar in a corner and as a map opened with a key, seen from above or as a
 * miniature. What it shows and how is the interface's to say (a gameworld's `ui.map`), every word optional and none
 * a colour: the look is the game's theme.
 *
 *   ui.map: false | {
 *     corner?:  'follow' | 'plan' | false   the radar in the corner: the way you face up, or north up; false for none
 *     views?:   ['plan', 'miniature', 'follow']   the views the opened map turns through, the first the one it opens on
 *     radius?:  40 … 600                    how far the corner sees from where you stand (m)
 *     shops?, cars?: true | false           whether its shops and the cars to be had are marked
 *     icons?:   { goal?, job?, shop?, car? }   each a pictogram's name (mana-ui/icons.js) for that kind of marker
 *   }
 *
 *   CITY_MAP                         the defaults
 *   readMapUi(v, where?)             → errors[] (teaching)
 *   cityMap(plan, manifest, ui?)     → { shapes, markers, box, side, corner, views, zoom, icons, key, cars } | null
 *       plan: a scene's ({ box: [x0, y0, x1, y1], shapes: [{ kind, r: [x0, y0, x1, y1], tall? }], places: [{ at, kind, card }] });
 *       manifest: the level's (its jobs' stops: city-guide.js jobsOf)
 * Pure.
 */
import { iconOf } from '../../mana-ui/icons.js';
import { jobsOf } from './city-guide.js';

export const CITY_MAP = Object.freeze({ corner: 'follow', views: Object.freeze(['plan', 'miniature', 'follow']), radius: 130, shops: true, cars: true,
  icons: Object.freeze({ goal: 'target', job: 'flag', shop: 'shop', car: 'car', respray: 'car', guns: 'shop' }) });
const VIEWS = ['plan', 'miniature', 'follow'], KEYS = ['corner', 'views', 'radius', 'shops', 'cars', 'icons'];
const isObj = (v) => !!v && typeof v === 'object' && !Array.isArray(v);
const r4 = (v) => Math.round(v * 1e4) / 1e4;
const words = (s) => String(s).replace(/-/g, ' ');
const shopName = (card) => { const w = words(card); return /(store|shop|pharmacy|diner|market|bakery|cafe|bar)$/.test(w) ? w : `${w} shop`; };

export function readMapUi(v, where = 'ui.map') {
  if (v === undefined || v === false) return [];
  if (!isObj(v)) return [`${where} is false (no map) or { ${KEYS.join('?, ')}? }: what the map shows and how it is seen`];
  const errors = [];
  for (const k of Object.keys(v)) if (!KEYS.includes(k)) errors.push(`${where}.${k}: not a map setting (${KEYS.join(', ')})`);
  if (v.corner !== undefined && v.corner !== false && !['follow', 'plan'].includes(v.corner)) errors.push(`${where}.corner is follow (the way you face up), plan (north up) or false (no radar)`);
  if (v.views !== undefined && !(Array.isArray(v.views) && v.views.length && v.views.every((x) => VIEWS.includes(x)) && new Set(v.views).size === v.views.length)) errors.push(`${where}.views is the views the opened map turns through, each once: ${VIEWS.join(', ')}`);
  if (v.radius !== undefined && !(Number.isFinite(v.radius) && v.radius >= 40 && v.radius <= 600)) errors.push(`${where}.radius is how far the corner sees, 40 to 600 m`);
  for (const k of ['shops', 'cars']) if (v[k] !== undefined && typeof v[k] !== 'boolean') errors.push(`${where}.${k} is true or false`);
  if (v.icons !== undefined) {
    if (!isObj(v.icons)) errors.push(`${where}.icons is { ${Object.keys(CITY_MAP.icons).join('?, ')}? }, each a pictogram's name`);
    else for (const [k, name] of Object.entries(v.icons)) {
      if (!(k in CITY_MAP.icons)) errors.push(`${where}.icons.${k}: not a kind of marker (${Object.keys(CITY_MAP.icons).join(', ')})`);
      else if (typeof name !== 'string' || !iconOf(name)) errors.push(`${where}.icons.${k} '${name}' is not a pictogram mana-ui draws (mana-ui/icons.js: coin, flag, target, shop, car, box, pin, star…)`);
    }
  }
  return errors;
}

export function cityMap(plan, manifest, ui = undefined) {
  if (ui === false || !plan || !Array.isArray(plan.box) || !Array.isArray(plan.shapes)) return null;
  const U = isObj(ui) ? ui : {}, icons = { ...CITY_MAP.icons, ...(U.icons ?? {}) };
  // a square about the plan's middle, so a metre is a metre both ways; north up (the world's +y the map's top)
  const [bx0, by0, bx1, by1] = plan.box, side = Math.max(bx1 - bx0, by1 - by0), ox = (bx0 + bx1) / 2 - side / 2, oy = (by0 + by1) / 2 - side / 2;
  const X = (x) => (x - ox) / side, Y = (y) => 1 - (y - oy) / side;
  const shapes = plan.shapes.filter((q) => Array.isArray(q.r)).map((q) => ({ kind: q.kind, x: r4(X(q.r[0])), y: r4(Y(q.r[3])), w: r4((q.r[2] - q.r[0]) / side), h: r4((q.r[3] - q.r[1]) / side), ...(q.tall ? { tall: q.tall } : {}) }));
  // (the factions' TURF, factions.js: each a wash of its colour over its part of the district; its contact where it is joined)
  const sides = (manifest?.game?.mechanics ?? []).filter((m) => m?.kind === 'join' && Array.isArray(m.turf));
  for (const F of sides) shapes.push({ kind: 'turf', tint: F.colour, x: r4(X(F.turf[0])), y: r4(Y(F.turf[3])), w: r4((F.turf[2] - F.turf[0]) / side), h: r4((F.turf[3] - F.turf[1]) / side) });
  const markers = [];
  if ((U.shops ?? CITY_MAP.shops) !== false) for (const p of plan.places ?? []) markers.push({ x: r4(X(p.at[0])), y: r4(Y(p.at[1])), kind: 'poi', icon: icons.shop, label: shopName(p.card), named: false });
  // (each job's stops, over the shops they stand at: the last drawn is on top)
  for (const J of jobsOf(manifest?.game?.mechanics)) for (const s of J.steps) markers.push({ x: r4(X(s.at[0])), y: r4(Y(s.at[1])), kind: 'item', icon: icons.job, label: `${J.name}: ${s.say}` });
  for (const F of sides) markers.push({ x: r4(X(F.at[0])), y: r4(Y(F.at[1])), kind: 'npc', icon: 'person', label: `${F.name}: join here` });
  // (the city's shops, game/shop-mechanics.js: the respray, the gun shop)
  for (const m of manifest?.game?.mechanics ?? []) if ((m?.kind === 'respray' || m?.kind === 'gunshop') && Array.isArray(m.at)) markers.push({ x: r4(X(m.at[0])), y: r4(Y(m.at[1])), kind: 'poi', icon: m.kind === 'respray' ? icons.respray : icons.guns, label: m.kind === 'respray' ? `Respray (${m.price})` : `Gun shop: rounds (${m.price})` });
  // (the forger, shops.js: where papers are bought)
  for (const m of manifest?.game?.mechanics ?? []) if (m?.kind === 'forger' && Array.isArray(m.at)) markers.push({ x: r4(X(m.at[0])), y: r4(Y(m.at[1])), kind: 'poi', icon: icons.shop, label: `Forger: ${m.name ?? 'papers'} (${m.price})` });
  const radius = U.radius ?? CITY_MAP.radius, cars = (U.cars ?? CITY_MAP.cars) !== false;
  return {
    box: [r4(ox), r4(oy)], side: r4(side), shapes, markers,
    corner: U.corner === undefined ? CITY_MAP.corner : U.corner, views: [...(U.views ?? CITY_MAP.views)],
    zoom: r4(Math.max(1, Math.min(16, side / (2 * radius)))), icons, cars,
    key: [{ icon: icons.goal, name: 'Where to go' }, { icon: icons.job, name: 'A job\'s stop' }, ...((U.shops ?? CITY_MAP.shops) !== false ? [{ icon: icons.shop, name: 'A shop' }] : []), ...(cars ? [{ icon: icons.car, name: 'A car' }] : []), ...(sides.length ? [{ icon: 'person', name: 'A faction\'s contact' }] : [])],
  };
}
