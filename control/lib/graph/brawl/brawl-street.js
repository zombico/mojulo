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
 * rank, accuracy, moves [] }.
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
const endOf = (title, sub, play) => ({ use: 'screen', props: { layer: 'overlay', place: 'center', title }, children: [{ use: 'stack', props: { dir: 'column', gap: 'normal', align: 'center' }, children: [
  { use: 'text', props: { value: sub, role: 'label' } },
  { use: 'stack', props: { dir: 'row', gap: 'loose', align: 'center' }, children: stats(play) },
  { use: 'button', props: { label: 'Fight it again' }, on: { accept: { emit: 'street:again' } } },
] }] });

/** How a street is PLAYED (the play types: brawl-play.js): the brawler's kit, or the run & gun's. */
/** the seats a street's screen has: four, a quarter of its width each */
export const SEATS = Object.freeze(['p1', 'p2', 'p3', 'p4']);
/** a seat's state as the screen reads it, empty (the page fills it: brawl-yard.client.js) */
export const seatState = () => ({ on: false, open: false, name: '', hp: 0, hpMax: 1, gun: '', ammo: '', low: false, grenades: 0 });
export const STREET_PLAYS = Object.freeze(['brawl', 'gun']);
export const STREET_GUNS = Object.freeze(['machine-gun']);
const stats = (play) => [{ use: 'stat', props: { label: 'time', value: b('time') } }, { use: 'stat', props: { label: 'health', value: b('hp'), max: b('hpMax') } }, ...(play === 'gun' ? [{ use: 'stat', props: { label: 'accuracy', value: b('accuracy') } }] : []), { use: 'stat', props: { label: 'rank', value: b('rank') } }];
export function streetSpec(play = 'brawl') {
  const end = (title, sub) => endOf(title, sub, play);
  return {
    defs: { 'command-list': { params: IDIOMS['command-list'].params, node: IDIOMS['command-list'].node } },
    hud: { use: 'hud', children: [
      // THE SEATS: four across the top, a quarter of the screen each, whoever sits in them (docs/side-scroll-map-
      // principles.md "The screen"). A seat taken: its tag in its own colour and its name, its health read by its
      // length, and (a run & gun's) the gun in its hands, its rounds (marked LOW at a fifth of a magazine) and its grenades.
      // A seat open: its tag and how to sit down. A seat the game has not: its quarter left empty, so no seat moves.
      { use: 'region', props: { at: 'top', variant: 'bare' }, children: [{ use: 'stack', props: { dir: 'row', fill: true, gap: 'normal', align: 'start' }, children: SEATS.map((p, k) => ({ use: 'stack', props: { gap: 'tight', align: 'stretch' }, children: [
        { use: 'window', props: { variant: 'plain' }, when: b(`${p}.on`), children: [{ use: 'stack', props: { gap: 'tight', align: 'stretch' }, children: [
          { use: 'stack', props: { dir: 'row', gap: 'tight', align: 'center' }, children: [{ use: 'badge', props: { value: `${k + 1}P`, side: k, variant: 'strong' } }, { use: 'text', props: { value: b(`${p}.name`), role: 'label' } }] },
          { use: 'bar', props: { value: b(`${p}.hp`), max: b(`${p}.hpMax`), variant: 'hp', size: 'large', figures: false } },
          // (the gun in its hands, as its two letters (MG, SP, FL, RK: a name does not fit a quarter of a screen and is
          // read slower than the gun itself), its rounds; its grenades at the row's far end)
          ...(play === 'gun' ? [{ use: 'stack', props: { dir: 'row', gap: 'tight', align: 'apart' }, children: [
            { use: 'stack', props: { dir: 'row', gap: 'tight', align: 'center' }, children: [{ use: 'badge', props: { value: b(`${p}.gun`), variant: 'strong' } }, { use: 'counter', props: { label: '', value: b(`${p}.ammo`), icon: 'bullet' } }, { use: 'badge', props: { value: 'Low', variant: 'stamp' }, when: b(`${p}.low`) }] },
            { use: 'counter', props: { label: '', value: b(`${p}.grenades`), icon: 'grenade' } }] }] : [])] }] },
        { use: 'window', props: { variant: 'ghost' }, when: b(`${p}.open`), children: [{ use: 'stack', props: { dir: 'row', gap: 'tight', align: 'center' }, children: [{ use: 'badge', props: { value: `${k + 1}P`, side: k, variant: 'muted' } }, { use: 'text', props: { value: 'Press start', role: 'caption' } }] }] }] })) }] },
      // (the way through and who is left, at the foot's corners: the middle of the screen is the fight's)
      { use: 'region', props: { at: 'bottom-left' }, children: [{ use: 'stack', props: { dir: 'row', gap: 'loose', align: 'center' }, children: [{ use: 'pips', props: { value: b('cleared'), max: b('of'), shape: 'square', label: 'stage' } },
        // (the falls left, where the street has lives: hearts, shared by its players)
        { use: 'pips', props: { value: b('lives.left'), max: b('lives.of'), shape: 'heart', label: 'lives' }, when: b('lives.on') }] }] },
      { use: 'region', props: { at: 'bottom-right' }, children: [{ use: 'counter', props: { label: 'left', value: b('left'), icon: 'skull' } }] },
      // (the boss's bar along the foot, between them)
      { use: 'region', props: { at: 'bottom' }, when: b('boss.on'), children: [{ use: 'stack', props: { dir: 'column', gap: 'tight', align: 'center' }, children: [
        // (a boss with phases: the one it is in, as pips over its bar)
        { use: 'pips', props: { value: b('boss.phase'), max: b('boss.phases'), shape: 'square', label: 'phase' }, when: b('boss.phased') },
        { use: 'bar', props: { value: b('boss.hp'), max: b('boss.hpMax'), variant: 'boss', size: 'large', label: b('boss.name'), figures: false } }] }] },
      { use: 'region', props: { at: 'center', variant: 'bare' }, children: [{ use: 'moments', props: { rows: b('moments'), as: 'banner', hold: 1.1, read: 0.4 } }] },
      // A SCENE (brawl-scenes.js): the cinema bars while one plays, its card across the middle, its line along the foot
      { use: 'letterbox', when: b('scene.on') },
      { use: 'region', props: { at: 'center', variant: 'bare' }, when: b('scene.title'), children: [{ use: 'stack', props: { dir: 'column', gap: 'tight', align: 'center' }, children: [{ use: 'text', props: { value: b('scene.title'), role: 'display' } }, { use: 'text', props: { value: b('scene.sub'), role: 'heading' }, when: b('scene.sub') }] }] },
      { use: 'region', props: { at: 'bottom' }, when: b('scene.say'), children: [{ use: 'stack', props: { dir: 'column', gap: 'tight', align: 'start' }, children: [{ use: 'text', props: { value: b('scene.who'), role: 'label' }, when: b('scene.who') }, { use: 'text', props: { value: b('scene.say'), role: 'body' } }] }] },
    ] },
    screens: {
      won: end('Street cleared', 'every screen beaten'),
      lost: end('Down', 'the street is still theirs'),
      moves: { use: 'command-list', props: { title: 'Moves', kinds: b('moves') } },
    },
  };
}

export function streetScreenOf(play = 'brawl') {
  return { spec: streetSpec(play), css: `${manaCss()}\n${themeCss(cardTheme('brawl-street'))}`, theme: 'brawl-street', sides: cardTheme('brawl-street').sides };
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
