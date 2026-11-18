/**
 * brawl street — a street's screen: mana-ui over the street being fought down (brawl-crowd.js streetOf), in the
 * brawler's look. What the game shows, not what the practice yard measures: the player's health, the street's held
 * screens as pips, the crowd left on this one (or the boss's bar while it stands), the moments (GO, the boss's name),
 * and the two ends (the street cleared, the player down), each with a way to fight it again.
 *
 *   streetSpec()        the spec: the HUD and its screens (`won`, `lost`, and `moves`, the brawler's move list)
 *   streetScreenOf()    → { spec, css, theme } for the street's page
 *   readStreet(street, belt, where?) → the settled `{ players, waves, things?, cast? }` of a world's `brawl.street` (throws
 *                       naming the fault before the page is made)
 *
 * The state it reads (the page writes it from brawl-street-read.js streetRead): brawl.street { p1 … p4 (each seat:
 * seatState), cleared, of, left, boss { on, name, hp, hpMax, phased, phase, phases }, moments [], time, hp, hpMax,
 * rank, accuracy, moves [], peril (0..1: one player's danger), target { on, name, hp, hpMax } (the foe last hit), combo
 * { on, n, word }, go (the way on is open) }.
 *
 * Pure: no clock, no dice.
 */
import { readScenes } from './brawl-scenes.js';
import { IDIOMS } from '../../mana-ui/idioms.js';
import { manaCss } from '../../mana-ui/css.js';
import { themeCss } from '../../mana-ui/theme.js';
import { cardTheme } from '../playscape/ui/theme-cards/loader.js';
import { readWaves } from './brawl-crowd.js';
import { readGun } from './brawl-guns.js';

const b = (path) => ({ bind: `brawl.street.${path}` });
const endOf = (title, sub, play, won) => ({ use: 'screen', props: { layer: 'modal', place: 'center', title }, children: [{ use: 'stack', props: { dir: 'column', gap: 'normal', align: 'center' }, children: [
  { use: 'text', props: { value: sub, role: 'label' } },
  { use: 'stack', props: { dir: 'row', gap: 'loose', align: 'center' }, children: stats(play, won) },
  { use: 'button', props: { label: 'Fight it again' }, on: { accept: { emit: 'street:again' } } },
] }] });

/** How a street is PLAYED (the play types: brawl-play.js): the brawler's kit, or the run & gun's. */
/** the seats a street's screen has: four, a quarter of its width each */
export const SEATS = Object.freeze(['p1', 'p2', 'p3', 'p4']);
/** a seat's state as the screen reads it, empty (the page fills it: brawl-yard.client.js) */
export const seatState = () => ({ on: false, open: false, name: '', hp: 0, hpMax: 1, gun: '', gunId: '', ammo: '', rounds: 0, size: 0, endless: false, low: false, grenades: 0, grenadesMax: 0 });
export const STREET_PLAYS = Object.freeze(['brawl', 'gun']);
export const STREET_GUNS = Object.freeze(['machine-gun']);
// (what the end says: the time, the health kept as a bar and never as a sum, the accuracy where guns were fired, the rank
// stamped on; a loss says none of the health it does not have)
const stats = (play, won = true) => [{ use: 'stat', props: { label: 'time', value: b('time'), count: true } }, ...(won ? [{ use: 'bar', props: { value: b('hp'), max: b('hpMax'), variant: 'hp', label: 'health', figures: false } }] : []), ...(play === 'gun' ? [{ use: 'stat', props: { label: 'accuracy', value: b('accuracy') } }] : []), ...(won ? [{ use: 'badge', props: { value: b('rank'), variant: 'stamp' } }] : [])];
export function streetSpec(play = 'brawl') {
  const end = (title, sub, won) => endOf(title, sub, play, won);
  return {
    defs: { 'command-list': { params: IDIOMS['command-list'].params, node: IDIOMS['command-list'].node } },
    hud: { use: 'hud', children: [
      // DANGER, one player's: the screen's own edge closing in as its health runs out (co-op: each seat's bar beats)
      { use: 'peril', props: { level: b('peril') }, unless: b('scene.on') },
      // THE SEATS: four across the top, a quarter of the screen each, whoever sits in them (docs/side-scroll-map-
      // principles.md "The screen"), on one shade across the top and never a box (docs/mana-ui.md, "A HUD that reads as
      // a game"). A seat taken: its tag and its name, its health a strip in cells in its own colour, read by its length;
      // a run & gun's gun in its hands as its wireframe, its rounds the figure and a belt (∞ for the sidearm), its
      // grenades as pips. A seat open: its tag and how to sit down. A seat the game has not: its quarter left empty.
      { use: 'region', props: { at: 'top', variant: 'scrim' }, unless: b('scene.on'), children: [{ use: 'stack', props: { dir: 'row', fill: true, gap: 'normal', align: 'start' }, children: SEATS.map((p, k) => ({ use: 'stack', props: { gap: 'tight', align: 'stretch' }, children: [
        { use: 'stack', props: { gap: 'tight', align: 'stretch' }, when: b(`${p}.on`), children: [
          { use: 'stack', props: { dir: 'row', gap: 'tight', align: 'center' }, children: [{ use: 'badge', props: { value: `${k + 1}P`, side: k, variant: 'strong' } }, { use: 'text', props: { value: b(`${p}.name`), role: 'heading' } }] },
          { use: 'bar', props: { value: b(`${p}.hp`), max: b(`${p}.hpMax`), variant: 'hp', size: 'large', segments: 5, figures: false, side: k } },
          ...(play === 'gun' ? [{ use: 'stack', props: { dir: 'row', gap: 'normal', align: 'apart' }, children: [
            { use: 'magazine', props: { gun: b(`${p}.gunId`), rounds: b(`${p}.rounds`), size: b(`${p}.size`), endless: b(`${p}.endless`), low: 0.2 } },
            { use: 'pips', props: { value: b(`${p}.grenades`), max: b(`${p}.grenadesMax`), shape: 'pip' } }] }] : [])] },
        { use: 'stack', props: { dir: 'row', gap: 'tight', align: 'center' }, when: b(`${p}.open`), children: [{ use: 'badge', props: { value: `${k + 1}P`, side: k, variant: 'muted' } }, { use: 'text', props: { value: 'Press start', role: 'caption' } }] }] })) }] },
      // THE FOE BEING HIT: its name and a short bar under the hitter's seat, gone a moment after the last hit
      { use: 'region', props: { at: 'top-left', variant: 'bare' }, when: b('target.on'), children: [{ use: 'stack', props: { gap: 'tight', align: 'start' }, children: [{ use: 'text', props: { value: b('target.name'), role: 'label' } }, { use: 'bar', props: { value: b('target.hp'), max: b('target.hpMax'), variant: 'hp', size: 'thin', figures: false } }] }] },
      // THE COMBO at the hitter's edge: the count as the figure, its word under it at each rung
      { use: 'region', props: { at: 'left', variant: 'bare' }, when: b('combo.on'), children: [{ use: 'stack', props: { gap: 'tight', align: 'start' }, children: [{ use: 'stack', props: { dir: 'row', gap: 'tight', align: 'end' }, children: [{ use: 'text', props: { value: b('combo.n'), role: 'numeral' } }, { use: 'text', props: { value: 'hits', role: 'caption' } }] }, { use: 'text', props: { value: b('combo.word'), role: 'heading' }, when: b('combo.word') }] }] },
      // GO: an arrow pulsing at the right edge, the way on, not a word over the fight's middle
      { use: 'region', props: { at: 'right', variant: 'bare' }, when: b('go'), children: [{ use: 'text', props: { value: 'GO ➜', role: 'display' } }] },
      // (the way through and who is left, at the foot's corners, as marks with no word: the middle is the fight's)
      { use: 'region', props: { at: 'bottom-left', variant: 'bare' }, unless: b('scene.on'), children: [{ use: 'stack', props: { dir: 'row', gap: 'loose', align: 'center' }, children: [{ use: 'pips', props: { value: b('cleared'), max: b('of'), shape: 'square' } },
        // (the falls left, where the street has lives: hearts, shared by its players)
        { use: 'pips', props: { value: b('lives.left'), max: b('lives.of'), shape: 'heart' }, when: b('lives.on') }] }] },
      { use: 'region', props: { at: 'bottom-right', variant: 'bare' }, unless: b('scene.on'), children: [{ use: 'counter', props: { label: '', value: b('left'), icon: 'skull' } }] },
      // (the boss along the foot between them: its name as a title over its bar, its phases as ticks inside it)
      { use: 'region', props: { at: 'bottom', variant: 'scrim' }, when: b('boss.on'), children: [{ use: 'stack', props: { dir: 'column', gap: 'tight', align: 'start' }, children: [
        { use: 'text', props: { value: b('boss.name'), role: 'title' } },
        { use: 'bar', props: { value: b('boss.hp'), max: b('boss.hpMax'), variant: 'boss', size: 'large', segments: b('boss.phases'), figures: false } }] }] },
      { use: 'region', props: { at: 'center', variant: 'bare' }, children: [{ use: 'moments', props: { rows: b('moments'), as: 'banner', hold: 1.1, read: 0.4 } }] },
      // A SCENE (brawl-scenes.js): the cinema bars while one plays, its card across the middle, its line along the foot
      { use: 'letterbox', when: b('scene.on') },
      { use: 'region', props: { at: 'center', variant: 'bare' }, when: b('scene.title'), children: [{ use: 'stack', props: { dir: 'column', gap: 'tight', align: 'center' }, children: [{ use: 'text', props: { value: b('scene.title'), role: 'display' } }, { use: 'text', props: { value: b('scene.sub'), role: 'heading' }, when: b('scene.sub') }] }] },
      { use: 'region', props: { at: 'bottom' }, when: b('scene.say'), children: [{ use: 'stack', props: { dir: 'column', gap: 'tight', align: 'start' }, children: [{ use: 'text', props: { value: b('scene.who'), role: 'label' }, when: b('scene.who') }, { use: 'text', props: { value: b('scene.say'), role: 'body' } }] }] },
    ] },
    screens: {
      won: end('Street cleared', 'every screen beaten', true),
      lost: end('Down', 'the street is still theirs', false),
      moves: { use: 'command-list', props: { title: 'Moves', kinds: b('moves') } },
    },
  };
}

// the street's own touches over the sheet: a seat low on health beats (co-op cannot say whose with one screen edge), the
// way on's arrow leans and pulses (under three times a second), the combo's figure large, the boss's bar held to the
// foot's middle so the corners stay the stage's and the lives'
const STREET_CSS = [
  '.mana-root .mana-place[data-at=top] .mana-bar[data-low] .mana-track{animation:mana-pulse .9s ease-in-out infinite;animation-play-state:var(--mana-loop)}',
  '.mana-root .mana-place[data-at=right] .mana-text[data-role=display]{font-style:italic;animation:mana-pulse 1.1s ease-in-out infinite;animation-play-state:var(--mana-loop)}',
  '.mana-root .mana-place[data-at=left] .mana-text[data-role=numeral]{font:900 calc(84 * var(--mana-du))/.9 var(--mana-display)}',
  '.mana-root .mana-place[data-at=bottom]{max-width:62%}',
  // (a run & gun's gun as one small line under the seat's health, never a block over the street: its drawing, its rounds,
  // a thin strip of what is left; four seats share the top)
  '.mana-root .mana-place[data-at=top] .mana-magazine{flex-direction:row;align-items:center;gap:calc(8 * var(--mana-du))}',
  '.mana-root .mana-place[data-at=top] .mana-magazine .mana-sil{width:calc(70 * var(--mana-du));height:calc(22 * var(--mana-du));margin:0}',
  '.mana-root .mana-place[data-at=top] .mana-magazine .mana-rounds>.mana-num{font-size:calc(24 * var(--mana-du));line-height:1}',
  '.mana-root .mana-place[data-at=top] .mana-magazine>.mana-track{width:calc(70 * var(--mana-du));height:calc(4 * var(--mana-du))}',
  '.mana-root .mana-place[data-at=top] .mana-magazine>.mana-belt{width:calc(70 * var(--mana-du))!important;height:calc(14 * var(--mana-du))}',
  '.mana-root .mana-place[data-at=top] .mana-magazine>.mana-call{font-size:calc(12 * var(--mana-du))}',
  '.mana-root .mana-place[data-at=top] .mana-pips{font-size:calc(14 * var(--mana-du))}',
  // (the foe being hit under the seats, never over them)
  '.mana-root .mana-place[data-at=top-left]{top:calc(var(--mana-safe) * 100cqh + 150 * var(--mana-du))}',
  '.mana-root .mana-place[data-at=bottom] .mana-bar[data-variant=boss]{width:min(calc(760 * var(--mana-du)),58cqw)}',
].join('\n');

export function streetScreenOf(play = 'brawl') {
  return { spec: streetSpec(play), css: `${manaCss()}\n${themeCss(cardTheme('brawl-street'))}\n${STREET_CSS}`, theme: 'brawl-street', sides: cardTheme('brawl-street').sides };
}

/** A world's `brawl.street`, settled: who plays (roster indices, one to four), the waves a held screen (read against
 * the belt, so a fault is said before the page), the things on it. */
export function readStreet(street, belt, where = 'brawl.street') {
  if (!street || typeof street !== 'object' || Array.isArray(street)) throw new Error(`brawl: ${where} is { players?, roster?, waves: [{ screen, crowd: [{ type, n }], boss? }], things? }`);
  for (const k of Object.keys(street)) if (!['players', 'roster', 'waves', 'things', 'cast', 'scenes', 'play', 'guns', 'grenades'].includes(k)) throw new Error(`brawl: ${where}.${k} is not a street's word (players, roster, waves, things, cast, scenes, play, guns, grenades)`);
  // (HOW IT IS PLAYED: the brawler's kit, or the run & gun's: its players' guns (the first held over the sidearm) and grenades)
  const play = street.play ?? 'brawl';
  if (!STREET_PLAYS.includes(play)) throw new Error(`brawl: ${where}.play is ${STREET_PLAYS.join(' | ')}`);
  if (play !== 'gun' && (street.guns !== undefined || street.grenades !== undefined)) throw new Error(`brawl: ${where}.guns and .grenades are a street's played gun (play: 'gun')`);
  if (street.guns !== undefined && (!Array.isArray(street.guns) || !street.guns.length || street.guns.length > 6)) throw new Error(`brawl: ${where}.guns is 1 to 6 guns (a brawl-guns.js name, or dials over one)`);
  (street.guns ?? []).forEach((g, k) => readGun(g, `${where}.guns[${k}]`));
  if (street.grenades !== undefined && !(Number.isInteger(street.grenades) && street.grenades >= 0 && street.grenades <= 9)) throw new Error(`brawl: ${where}.grenades is 0 to 9`);
  // (`cast`: who the crowd is DRAWN as: a crowd type, `boss`, or `*` for the rest → a roster index, that character's body;
  // a list of them is taken in turn, body by body, so a wave is not one face)
  if (street.cast !== undefined && (!street.cast || typeof street.cast !== 'object' || Array.isArray(street.cast) || Object.values(street.cast).some((v) => { const L = Array.isArray(v) ? v : [v]; return !L.length || L.some((k) => !Number.isInteger(k) || k < 0); }))) throw new Error(`brawl: ${where}.cast is { <crowd type> | boss | *: a roster index, or a list of them taken in turn }`);
  if (!Array.isArray(street.waves) || !street.waves.length) throw new Error(`brawl: ${where}.waves is a list of { screen, crowd: [{ type, n }] }, at least one: a street with no wave is a walk`);
  readWaves(street.waves, belt);
  return { players: street.players ?? [0], waves: street.waves, things: street.things ?? [], ...(play === 'gun' ? { play, guns: street.guns ?? STREET_GUNS.slice(), grenades: street.grenades ?? 3 } : {}), ...(street.roster ? { roster: street.roster } : {}), ...(street.cast ? { cast: street.cast } : {}), ...(street.scenes ? { scenes: readScenes(street.scenes, belt, `${where}.scenes`) } : {}) };
}
