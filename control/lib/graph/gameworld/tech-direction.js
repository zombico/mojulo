/**
 * THE TECHNOLOGY DIRECTION — the first page of a civilization's technology design loop, as the hero's direction is the
 * first of the hero's: what every crafted thing the civilization makes shares, and how much each one matters.
 *
 *   technology.direction?: {
 *     style?,                          // how it is drawn (tech-eras.js TECH_STYLES): 'wc3' unless named
 *     motif?,                          // the shape language its adornment speaks (MOTIFS): a word, or words naming one
 *     elements?: { primary?, secondary? } | '<word>' | ['<word>', '<word>'],   // element words (element-words.js):
 *                                      // the glow and the stones; the world's hero direction's when left out
 *     tone?,                           // a tone preset (era/tone.js) its values are coloured by; the kit's ramps if none
 *     asymmetry?,                      // how lopsided its adornment is, 0–1 or a word (ASYMMETRY_WORDS); the style's if none
 *     team?,                           // the team colour, '#rrggbb': a MARKER, painted as a mask so a placement or an
 *                                      // engine may pass its own; the civilization's place in TEAM_COLOURS if none
 *   }
 *   a crafted thing: words, or { intent, seed?, rank?, use? }   // rank: its interest (playscape/objects/laws.js INTEREST);
 *                                      // use: watched, held or driven (tech-eras.js TECH_USES)
 *
 * Every default says where it came from; every value the creator sets over a default is ledgered beside it.
 *
 *   readTechDirection(D, at)           → the page, checked (throws naming what is wrong)
 *   resolveTechDirection(G, cid)       → { style, camera, motif, elements, tone, team, setting, ranks, from, ledger } | null
 *   teamColour(direction, override?)   → the team colour a placement shows (a passed marker wins)
 *   rankOf(kind, thing)                → { rank, why }: the default interest of a crafted thing
 *   useOf(kind, thing)                 → { use, why }: how the player meets it by default
 *   USES_BY_LIST                       the uses each list may take
 *
 * Pure.
 */
import { TECH_STYLES, TECH_STYLE_IDS, DEFAULT_TECH_STYLE, TECH_CAMERAS, DEFAULT_TECH_CAMERA } from './tech-eras.js';
export { TECH_USES, TECH_USE_IDS } from './tech-eras.js';
import { ELEMENT_WORDS } from './element-words.js';
import { TONE_PRESETS, TONE_IDS } from '../era/tone.js';
import { INTEREST } from '../playscape/objects/laws.js';
import { SETTING_BY_FINISH, DEFAULT_SETTING } from './mech-kit.js';

/** The shape languages adornment speaks: how edges are finished and what is hung on a mass. Read by words. */
export const MOTIFS = Object.freeze({
  smooth: { read: 'rounded shells and clean seams, edges eased', words: ['smooth', 'sleek', 'clean', 'rounded', 'streamlined', 'sci-fi', 'scifi', 'futuristic'], edges: 'round', adorn: ['shell', 'fin', 'emitter'] },
  faceted: { read: 'planes cut at hard angles, chamfered edges', words: ['faceted', 'angular', 'chamfered', 'geometric', 'crystalline', 'sharp'], edges: 'chamfer', adorn: ['plate', 'fin', 'antenna'] },
  riveted: { read: 'plates bolted over a frame, strapped and banded', words: ['riveted', 'industrial', 'bolted', 'plated', 'steampunk', 'dieselpunk', 'iron', 'rugged', 'utilitarian'], edges: 'bevel', adorn: ['plate', 'rivets', 'pipe', 'vent'] },
  spiked: { read: 'blades and spikes past the outline, hooked and barbed', words: ['spiked', 'spiky', 'barbed', 'brutal', 'savage', 'orcish', 'war', 'warlike', 'jagged'], edges: 'chamfer', adorn: ['spike', 'plate', 'blade'] },
  organic: { read: 'carapace, ribs and claws: grown, not built', words: ['organic', 'grown', 'biological', 'insect', 'insectoid', 'chitin', 'carapace', 'living', 'alien'], edges: 'round', adorn: ['carapace', 'spine', 'claw'] },
  ornate: { read: 'filigree, crests and finials on a dressed mass', words: ['ornate', 'gilded', 'regal', 'ceremonial', 'elven', 'arcane', 'temple', 'baroque'], edges: 'bevel', adorn: ['crest', 'finial', 'trim', 'emitter'] },
});
export const MOTIF_IDS = Object.freeze(Object.keys(MOTIFS));
/** A finish says a motif when no word does. */
const FINISH_MOTIF = Object.freeze({ alloy: 'smooth', composite: 'smooth', 'iron-and-timber': 'riveted', 'stone-and-brass': 'ornate' });

/** Team colours, in the order civilizations take them: distinct hues at a mid value, so a mask reads on any tone. */
export const TEAM_COLOURS = Object.freeze(['#c8322b', '#2d5fc4', '#2a9d8f', '#7b3fb0', '#d9b62c', '#d9782c', '#3f8f3a', '#d65a9a', '#8a8f99', '#5aa7d6', '#2f5130', '#7a4a2a']);

const HEX = /^#[0-9a-f]{6}$/i;
const isObj = (v) => !!v && typeof v === 'object' && !Array.isArray(v);
const KEYS = ['style', 'motif', 'elements', 'tone', 'team', 'asymmetry'];
/** Words for how lopsided a civilization's technology is. */
export const ASYMMETRY_WORDS = Object.freeze({ symmetric: 0, symmetrical: 0, balanced: 0.15, asymmetric: 0.7, asymmetrical: 0.7, lopsided: 0.85, ramshackle: 0.9 });
const wordsOf = (s) => String(s).toLowerCase().split(/[^a-z0-9-]+/).filter(Boolean);
/** The motif a few words name: the first word any motif knows. */
export function motifOf(words) {
  for (const w of wordsOf(words)) for (const [id, M] of Object.entries(MOTIFS)) if (id === w || M.words.includes(w)) return id;
  return null;
}

/** Read a civilization's technology direction and say what is wrong. */
export function readTechDirection(D, at = 'technology.direction') {
  if (!isObj(D)) throw new Error(`gameworld: ${at} is { ${KEYS.join('?, ')}? }`);
  for (const k of Object.keys(D)) if (!KEYS.includes(k)) throw new Error(`gameworld: ${at}.${k} is not part of a technology direction (${KEYS.join(', ')})`);
  const out = {};
  if (D.style !== undefined) { if (!TECH_STYLES[D.style]) throw new Error(`gameworld: ${at}.style '${D.style}' is not a style (${TECH_STYLE_IDS.join(', ')})`); out.style = D.style; }
  if (D.motif !== undefined) {
    const m = typeof D.motif === 'string' ? motifOf(D.motif) : null;
    if (!m) throw new Error(`gameworld: ${at}.motif is a word naming a motif (${MOTIF_IDS.map((id) => `${id}: ${MOTIFS[id].words.slice(0, 3).join(', ')}`).join(' · ')})`);
    out.motif = { id: m, said: D.motif };
  }
  if (D.elements !== undefined) {
    const E = typeof D.elements === 'string' ? { primary: D.elements } : Array.isArray(D.elements) ? { primary: D.elements[0], secondary: D.elements[1] } : D.elements;
    if (!isObj(E)) throw new Error(`gameworld: ${at}.elements is { primary?, secondary? }, a word, or two words`);
    for (const k of Object.keys(E)) if (!['primary', 'secondary'].includes(k)) throw new Error(`gameworld: ${at}.elements.${k} is not an element slot (primary, secondary)`);
    out.elements = {};
    for (const k of ['primary', 'secondary']) if (E[k] !== undefined) {
      if (!ELEMENT_WORDS[E[k]]) throw new Error(`gameworld: ${at}.elements.${k} '${E[k]}' is not an element word (${Object.keys(ELEMENT_WORDS).join(', ')})`);
      out.elements[k] = E[k];
    }
  }
  if (D.tone !== undefined) { if (!TONE_PRESETS[D.tone]) throw new Error(`gameworld: ${at}.tone '${D.tone}' is not a tone (${TONE_IDS.join(', ')})`); out.tone = D.tone; }
  if (D.team !== undefined) { if (typeof D.team !== 'string' || !HEX.test(D.team)) throw new Error(`gameworld: ${at}.team is a colour, '#rrggbb'`); out.team = D.team.toLowerCase(); }
  if (D.asymmetry !== undefined) {
    const a = typeof D.asymmetry === 'string' ? ASYMMETRY_WORDS[D.asymmetry] : D.asymmetry;
    if (!(Number.isFinite(a) && a >= 0 && a <= 1)) throw new Error(`gameworld: ${at}.asymmetry is 0–1, or a word (${Object.keys(ASYMMETRY_WORDS).join(', ')})`);
    out.asymmetry = a;
  }
  return out;
}

/** A crafted thing's default interest: what it does and how big it is say how much it matters to the moment. */
export function rankOf(kind, t) {
  const B = t.block, fns = B.functions;
  if (kind === 'things') return { rank: 'prop', why: 'a machine: it works in the background' };
  if (kind === 'weapons') return { rank: 'interactable', why: B.tier === 'held' ? 'a weapon in the hand: it is used' : 'a crewed or emplaced weapon: it is used' };
  if (kind === 'vehicles') {
    if (B.tier === 'vessel') return { rank: 'focus', why: 'a vessel: building scale, and it goes' };
    if (fns.includes('strike') || fns.includes('guard')) return { rank: 'focus', why: 'armed or armoured: it is what the moment is about' };
    if (t.form === 'drawn') return t.variant === 'cart' || t.variant === 'drawn' ? { rank: 'prop', why: 'a cart: it is drawn, not ridden' } : { rank: 'interactable', why: `a ${t.variant}: it is boarded, or escorted` };
    return { rank: 'interactable', why: 'it can be ridden' };
  }
  if (['tower', 'gate', 'portal', 'launch'].includes(t.form)) return { rank: 'focus', why: `a ${t.variant}: the level is read by it` };
  return { rank: 'interactable', why: `a ${t.variant}: a work the level shows` };
}

/** The uses a list may take: a vehicle is ridden or watched, a weapon held or watched (emplaced, crewed, escorted). */
export const USES_BY_LIST = Object.freeze({ vehicles: Object.freeze(['driven', 'watched']), structures: Object.freeze(['watched']), weapons: Object.freeze(['held', 'watched']), things: Object.freeze(['watched']) });
/** How the player meets a crafted thing by default: what it is says whether it is held, ridden or watched. */
export function useOf(kind, t) {
  const B = t.block;
  if (kind === 'weapons') return B.tier === 'held' ? { use: 'held', why: 'a weapon in the hand' } : { use: 'watched', why: 'emplaced or crewed: watched as it fires' };
  if (kind === 'vehicles') return t.form === 'drawn' ? { use: 'watched', why: 'a cart: drawn, not driven' } : { use: 'driven', why: 'it can be ridden' };
  if (kind === 'things') return { use: 'watched', why: 'a machine: it works in the background' };
  return { use: 'watched', why: `a ${t.variant}: the level shows it` };
}

/** The camera a world's tech is met through: its own, else third person with a hero and first person without. */
export function techCamera(G) {
  const c = G.camera ?? (G.characters ? 'third-person' : 'first-person');
  return TECH_CAMERAS[c] ? c : DEFAULT_TECH_CAMERA;
}

const LISTS = ['things', 'vehicles', 'structures', 'weapons'];
/** The direction a civilization's technology resolves to, or null when it makes nothing and says nothing. */
export function resolveTechDirection(G, cid) {
  const C = G.civilizations[cid], T = C?.technology;
  if (!T || !(T.direction || LISTS.slice(1).some((k) => T[k] && Object.keys(T[k]).length))) return null;
  const D = T.direction ?? {}, from = {}, ledger = [], at = `${cid}/technology`;
  const set = (key, value, source, dflt) => { from[key] = source; if (dflt !== undefined && JSON.stringify(dflt) !== JSON.stringify(value)) ledger.push({ scope: 'civilization', at, key, world: dflt, local: value }); return value; };
  const style = D.style ? set('style', D.style, 'said', DEFAULT_TECH_STYLE) : set('style', DEFAULT_TECH_STYLE, 'default');
  // the motif: the direction's word, else the words it builds in, else its finish
  const said = C.builds ? motifOf(C.builds.intent) : null, byFinish = FINISH_MOTIF[T.finish ?? 'alloy'];
  const dflt = said ?? byFinish;
  const motif = D.motif ? set('motif', D.motif.id, 'said', dflt) : set('motif', dflt, said ? `its builds ("${C.builds.intent}")` : `its finish (${T.finish ?? 'alloy'})`);
  // the elements: the direction's, else the world's hero direction's, else none (the accent is its status light)
  const heroD = G.characters?.direction, heroE = heroD && (heroD.primary || heroD.secondary) ? { ...(heroD.primary ? { primary: heroD.primary } : {}), ...(heroD.secondary ? { secondary: heroD.secondary } : {}) } : null;
  const elements = D.elements ? set('elements', D.elements, 'said', heroE ?? undefined) : heroE ? set('elements', heroE, 'the hero\'s direction') : set('elements', {}, 'none: the accent is its status light');
  const tone = D.tone ? set('tone', D.tone, 'said') : set('tone', null, 'the kit\'s ramps');
  const civTeam = TEAM_COLOURS[G.civIds.indexOf(cid) % TEAM_COLOURS.length];
  const team = D.team ? set('team', D.team, 'said', civTeam) : set('team', civTeam, `the civilization's place (${G.civIds.indexOf(cid) + 1} of ${G.civIds.length})`);
  const asymmetry = D.asymmetry !== undefined ? set('asymmetry', D.asymmetry, 'said', TECH_STYLES[style].asymmetry) : set('asymmetry', TECH_STYLES[style].asymmetry ?? 0, `its style (${style})`);
  const ranks = {};
  for (const list of LISTS) for (const [id, t] of Object.entries(T[list] ?? {})) {
    if (!t.block) continue;
    const r = rankOf(list, t), u = useOf(list, t), here = `${at}/${list}/${id}`;
    if (t.rank && t.rank !== r.rank) ledger.push({ scope: 'thing', at: here, key: 'rank', world: r.rank, local: t.rank });
    if (t.use && t.use !== u.use) ledger.push({ scope: 'thing', at: here, key: 'use', world: u.use, local: t.use });
    ranks[`${list}/${id}`] = { ...(t.rank ? { rank: t.rank, why: 'said' } : r), ...(t.use ? { use: t.use, useWhy: 'said' } : { use: u.use, useWhy: u.why }) };
  }
  // what it is made of and what drives it (mech-kit.js): its finish's, until the world says its own
  const setting = set('setting', SETTING_BY_FINISH[T.finish ?? 'alloy'] ?? DEFAULT_SETTING, `its finish (${T.finish ?? 'alloy'})`);
  return { style, camera: techCamera(G), motif, motifRead: MOTIFS[motif].read, elements, tone, team, asymmetry, setting, ranks, from, ledger };
}

/** The team colour a placement shows: a passed marker wins over the civilization's. */
export function teamColour(direction, override) {
  if (override !== undefined) { if (typeof override !== 'string' || !HEX.test(override)) throw new Error('gameworld: a team colour is \'#rrggbb\''); return override.toLowerCase(); }
  return direction.team;
}

export { INTEREST };
