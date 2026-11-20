/**
 * THE BOSS AS MADE: a boss of the roster (./bosses.js) as the hero door's spec. The hero's body and its toy suit; the
 * hero's helm with its window shut and the boss's face over it; its colours its own.
 *
 *   bossHelm(face)  → the helm adornment (the hero's helm, its window shut, its gem and ear domes off, the face's words over it)
 *   bossSpec(id, { hue? }) → the hero door's spec: the herobot body at the boss's build in the toy suit, the helm its
 *                   `with`; `hue` its identity in place of the roster's (a level's reserved boss colour: the side map's
 *                   dress, so the boss is the colour its room is marked in and nothing before it wears)
 *   bossFaceFaults(spec) → [says]   a face that shows a person's (a window) or has no eyes in the signal
 *
 * Pure.
 */
import { gameBody } from './game-bodies.js';
import { HEROBOT_HELM } from '../headgear/cards.js';
import { BOSSES, BOSS_IDS, BOSS_FACES, BOSS_FACE_IDS, SIGNAL } from './bosses.js';

/** A boss's helm: the hero's own (headgear/cards.js HEROBOT_HELM), its window shut and its gem and ear domes off, the
 * face's words over it. */
export function bossHelm(face) {
  const F = BOSS_FACES[face];
  if (!F) throw new Error(`bosses: no face '${face}' (${BOSS_FACE_IDS.join(', ')})`);
  const { window: _w, gem: _g, ears: _e, ...keep } = HEROBOT_HELM.signature;
  return { ...structuredClone(HEROBOT_HELM), signature: { ...structuredClone(keep), ...structuredClone(F.helm) } };
}

// a lighter and a brighter of a hex, for its plaques and its highlights
const mix = (hex, to, k) => { const a = parseInt(hex.slice(1), 16), b = parseInt(to.slice(1), 16), ch = (n, s) => (n >> s) & 255;
  return `#${[16, 8, 0].map((s) => Math.round(ch(a, s) + (ch(b, s) - ch(a, s)) * k).toString(16).padStart(2, '0')).join('')}`; };

/** A boss as the hero door makes it: the herobot body (game-bodies.js) at its build, in the toy suit (armor/styles.js
 * `herobot`), its helm the `with`, its colours over the suit's. */
export function bossSpec(id, { hue = null } = {}) {
  const B0 = BOSSES[id], B = B0 && hue ? { ...B0, hue } : B0;
  if (!B) throw new Error(`bosses: no boss '${id}' (${BOSS_IDS.join(', ')})`);
  const { spec } = gameBody('herobot', 'hero');
  const hi = mix(B.hue, '#ffffff', 0.3);
  const palette = {
    Armor: B.armor, Chest: B.armor, Shoes: B.armor, ArmorHighlight: mix(B.armor, '#ffffff', 0.35), ChestHighlight: mix(B.armor, '#ffffff', 0.35),
    Pec: B.hue, PecHighlight: hi, Plaque: hi, Top: '#2e3238', Bottom: '#2e3238', Cuff: '#e9e2d4', CuffHighlight: '#ffffff', [SIGNAL]: B.signal, ...(B.plate ? { Face: B.plate } : {}),
  };
  return { ...spec, ...(B.build ? { cast: { pole: 'male', build: B.build } } : {}), hair: 'none', adorn: { type: 'armor', style: 'herobot', with: [bossHelm(B.face)] }, palette };
}

/** Where a boss's face breaks the family's rules: a window (a person's face shows), or no eyes in the signal. */
export function bossFaceFaults(spec) {
  const out = [], kit = Array.isArray(spec?.adorn) ? spec.adorn : spec?.adorn?.with ?? [];
  const helm = kit.find((a) => a?.signature?.kind === 'helm');
  if (!helm) return ['no helm: a boss\'s face is its helm'];
  const S = helm.signature;
  if (S.window) out.push('a face window: a person\'s face shows (the hero alone keeps one)');
  if (!S.visor || S.visorGroup !== SIGNAL) out.push(`no eyes in the signal (${SIGNAL}): the gaze is the aim, and the tell`);
  return out;
}
