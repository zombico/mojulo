// AN OOZED CREATURE IN ITS GAME'S LOOK: the setting a game hands every character rolled for it (egocube/setting.js,
// gameworld/cast-setting.js `settingOfGame`), read for a creature the oozes made, so an enemy stands in a world's light
// and colours as its people do.
//
//   LIGHT    the tradition's (gameworld/characters.js TRADITIONS): anime is the character light, a two-tone step with a
//            shade swatch per group and the silhouette ink, the creature's key (station-loft-shade.js CREATURE_KEY) and
//            its materials drawn in bands; western is the studio light, its materials real surfaces. No tradition: the
//            animal's own light, as before.
//   COLOUR   what an ooze MAKES (a piece, armour, plates and panels, marks, ornaments in a motif that does not glow) is
//            dressed from the world's ramps, as the people's clothes are: each colour takes the nearest stop of a ramp of
//            its own hue and value (never moved more than RAMP_VALUE in L*, so the creature keeps its three values: an
//            armour stays dark, a seam darker) and nearly its chroma (a signal colour is not drained into an earth). A
//            colour drawn in a METAL is the metal's (era/style/pole.js: on the material pole colour is the material's),
//            so chrome stays chrome and a gold shine gold in any world. What the animal IS (its coat, and a tint the ooze lays on it) stays its own, a light (a glow:
//            eyes, veins, burning marks) is a light, and a made colour with no ramp of its hue in the world is the accent,
//            which stays its own (era/style/pole.js: the accent stays flat).
//
//   oozeSetting(s)                         → the setting, checked (readSetting's shape and words) | null
//   settingToon(setting)                   → the mint's `toon` (anime: { light: true }) | null
//   dressPush(push, setting, ledger = [], { motif, coat })   → the push with its made colours dressed from the ramps,
//                                            each move ledgered { at, from, to, ramp }; `motif: 'only'` dresses the
//                                            ornaments' motif alone (it is decided last: a stylism may name it), `false`
//                                            all but it
//
// Pure; absent ⇒ the push as given and no toon, byte-identical.
import { readSetting } from '../egocube/setting.js';
import { hexLch } from '../polygonizer/station-loft-shade.js';
import { MOTIFS } from './motif.js';
import { valueStep } from './push.js';
import { resolveMaterial } from '../polygonizer/materials.js';

/** How far a ramp's stop may sit from a made colour and still dress it: in LCh hue degrees, in L* (its value), and in
 *  chroma lost (a stop may be duller by this much at most: past it the colour is a signal, and keeps its own). */
export const RAMP_HUE = 40, RAMP_VALUE = 15, RAMP_DRAIN = 25;
/** Below this chroma a colour (or a stop) is a neutral: it takes a neutral stop, or a quiet one (under QUIET_C). */
const NEUTRAL_C = 12, QUIET_C = 22;
const HEX = /^#[0-9a-f]{6}$/i;

export function oozeSetting(s) {
  if (s === undefined || s === null) return null;
  return readSetting(s);
}

export function settingToon(setting) {
  return setting?.tradition === 'anime' ? { light: true } : null;
}

const hueGap = (a, b) => { const d = Math.abs(a - b) % 360; return d > 180 ? 360 - d : d; };
/** the stops a made colour may be dressed in, nearest first (none: no ramp of its hue and value, the accent keeps its own) */
function stopsFor(hex, ramps) {
  const [L, C, h] = hexLch(hex), neutral = C < NEUTRAL_C, out = [];
  for (const r of ramps) for (const s of r.stops) {
    if (!HEX.test(s)) continue;
    const [Ls, Cs, hs] = hexLch(s);
    if (Math.abs(L - Ls) > RAMP_VALUE || C - Cs > RAMP_DRAIN) continue;
    if (neutral ? Cs >= QUIET_C : Cs < NEUTRAL_C || hueGap(h, hs) > RAMP_HUE) continue;
    out.push({ d: Math.hypot(L - Ls, C - Cs, neutral ? 0 : (hueGap(h, hs) / 180) * Math.max(C, Cs)), stop: s.toLowerCase(), ramp: r.name });
  }
  return out.sort((a, b) => a.d - b.d || (a.stop < b.stop ? -1 : 1));
}
/** Two made colours a value apart (a seam under its armour) never share one stop: the line between them would vanish. */
const KEEP_APART = 8;

/** The made colours of a push, by path: the piece, the armour, the groups and marks that do not glow; or the motif's (its
 *  own colour a value step from the coat, as the ornaments draw it, unless a colour is named for it) */
function madeColours(push, { motif, coat }) {
  const out = [], M = MOTIFS[push.motif ?? 'horn'], S = push.surfaces || {};
  // what a group is drawn in: its own word, then the surfaces' (by group, then '*')
  const metal = (name) => !!name && !!resolveMaterial(name)?.metal, drawnIn = (g, own) => metal(own ?? S[g] ?? S['*']);
  if (motif === 'only') {
    if (!push.motifColor && !M.glow && !push.motifGlow && !metal(M.material ?? S.Motif ?? S['*'])) out.push(['motifColor', valueStep(M.color, coat, false)]);
    return out;
  }
  if (HEX.test(push.piece?.color ?? '') && !drawnIn('Piece')) out.push(['piece.color', push.piece.color]);
  if (HEX.test(push.armor?.color ?? '') && !push.armor.glow && !drawnIn('Armor', push.armor.material)) out.push(['armor.color', push.armor.color]);
  for (const [g, v] of Object.entries(push.groups || {})) if (HEX.test(v?.color ?? '') && !v.glow && !drawnIn(g, v.material)) out.push([`groups.${g}.color`, v.color]);
  for (const [i, m] of (push.marks || []).entries()) if (HEX.test(m?.color ?? '') && !m.glow && !drawnIn(m.group)) out.push([`marks.${i}.color`, m.color]);
  if (HEX.test(push.motifColor ?? '') && !push.motifGlow && !metal(M.material ?? S.Motif ?? S['*'])) out.push(['motifColor', push.motifColor]);
  return out;
}

export function dressPush(push, setting, ledger = [], { motif = false, coat } = {}) {
  const ramps = (setting?.ramps || []).filter((r) => Array.isArray(r?.stops) && r.stops.length);
  if (!push || !ramps.length) return push;
  const out = structuredClone(push), memo = new Map(), taken = new Map();   // stop → the lightness of the colour it dresses
  for (const [at, from] of madeColours(push, { motif, coat })) {
    const key = from.toLowerCase(), L = hexLch(key)[0];
    if (!memo.has(key)) {
      const s = stopsFor(key, ramps).find((c) => !taken.has(c.stop) || Math.abs(taken.get(c.stop) - L) <= KEEP_APART) ?? null;
      if (s && !taken.has(s.stop)) taken.set(s.stop, L);
      memo.set(key, s);
    }
    const s = memo.get(key);
    if (!s || (s.stop === key && at !== 'motifColor')) continue;
    const ks = at.split('.'); let o = out;
    for (const k of ks.slice(0, -1)) o = o[k];
    o[ks.at(-1)] = s.stop;
    ledger.push({ at, from: key, to: s.stop, ramp: s.ramp });
  }
  return out;
}
