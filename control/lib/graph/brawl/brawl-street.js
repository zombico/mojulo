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
 * The state it reads (the page writes it from brawl-street-read.js streetRead): brawl.street { hp, hpMax, name,
 * cleared, of, left, boss { on, name, hp, hpMax }, moments [], time, moves [] }.
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
export const STREET_PLAYS = Object.freeze(['brawl', 'gun']);
export const STREET_GUNS = Object.freeze(['machine-gun']);
const stats = (play) => [{ use: 'stat', props: { label: 'time', value: b('time') } }, { use: 'stat', props: { label: 'health', value: b('hp'), max: b('hpMax') } }, ...(play === 'gun' ? [{ use: 'stat', props: { label: 'accuracy', value: b('accuracy') } }] : []), { use: 'stat', props: { label: 'rank', value: b('rank') } }];
export function streetSpec(play = 'brawl') {
  const end = (title, sub) => endOf(title, sub, play);
  return {
    defs: { 'command-list': { params: IDIOMS['command-list'].params, node: IDIOMS['command-list'].node } },
    hud: { use: 'hud', children: [
      { use: 'region', props: { at: 'top-left' }, children: [{ use: 'stack', props: { dir: 'column', gap: 'tight', align: 'start' }, children: [
        { use: 'text', props: { value: b('name'), role: 'label' } },
        { use: 'bar', props: { value: b('hp'), max: b('hpMax'), variant: 'hp', size: 'large', figures: false } }] }] },
      { use: 'region', props: { at: 'top' }, children: [{ use: 'pips', props: { value: b('cleared'), max: b('of'), shape: 'square', label: 'street' } }] },
      { use: 'region', props: { at: 'top-right' }, children: [{ use: 'counter', props: { label: 'left', value: b('left'), icon: 'skull' } }] },
      // (A RUN & GUN's: the gun held, its rounds, the grenades, under the health)
      ...(play === 'gun' ? [{ use: 'region', props: { at: 'bottom-left' }, children: [{ use: 'stack', props: { dir: 'row', gap: 'normal', align: 'center' }, children: [
        { use: 'counter', props: { label: b('gun.name'), value: b('gun.ammo'), icon: 'bolt' } },
        { use: 'counter', props: { label: 'grenades', value: b('gun.grenades'), icon: 'flame' } }] }] }] : []),
      // (the boss's bar along the foot, clear of the corners' readouts)
      { use: 'region', props: { at: 'bottom' }, when: b('boss.on'), children: [{ use: 'bar', props: { value: b('boss.hp'), max: b('boss.hpMax'), variant: 'boss', size: 'large', label: b('boss.name'), figures: false } }] },
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
  return { spec: streetSpec(play), css: `${manaCss()}\n${themeCss(cardTheme('brawl-yard'))}`, theme: 'brawl-yard' };
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
