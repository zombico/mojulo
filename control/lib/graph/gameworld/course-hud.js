/**
 * THE RUNNER'S HUD — what a rolled course (roll-course.js) shows in play, as ONE composition on mana-ui
 * (docs/mana-ui.md), drawn by the level page's HUD host (scene/channels/mana-hud.js). It is laid by the course's own
 * screen (course-view.js): the top third is where stuff comes from, so the HUD keeps to its corners and its edge; the
 * middle is the way's; the bottom is the character's, and nothing is drawn there.
 *
 *   top-left    which map of the run this is, as pips (only in a run: the shell hands the level its place), and the
 *               coins taken
 *   top         how far along the course: a bar, and the metres left
 *   top-right   stamina, for a hero that sprints on it
 *               (a tall frame: one plate in the top's middle, the run over the stamina, the progress beside them)
 *   right       on a run's first map, for its first seconds: what to do, in the glyphs of the device in hand
 *   centre      the start cue (a screen: it holds the hero while it counts) and the moments (GO, the end)
 *
 *   courseHud(course, { theme?, screen?, words? }) → { spec, theme, feed } (a level manifest's `manaHud`)
 *     theme   a mana-ui theme (a preset's or a card's name, or a child theme): the dress's own (`dress.ui`) unsaid
 *     feed    what the page reads into the HUD's state each frame: { kind: 'course', from, to, cue: { beats, every },
 *             hint: { seconds }, stamina }
 *   COURSE_HUD_STATE  the state's shape, with the values a sheet or a test draws it on
 *
 * The state the spec binds (the host writes it; the spec never copies it):
 *   course { metres, of, left, says } (says: the metres left in words, written by the host: a number that falls every
 *   frame would be marked as news every frame)   run { show, at, of }   hero { stamina, staminaMax, sprints }
 *   coins { count } (the level's own coins, counted on its bus)   start { count, sub }          hint { show }          moments [{ id, text, sub?, weight? }]
 * Pure: a spec is data.
 */
import { THEMES } from '../../mana-ui/theme.js';
import { cardTheme } from '../playscape/ui/theme-cards/loader.js';

const B = (path) => ({ bind: path });

export const COURSE_HUD_STATE = Object.freeze({ course: { metres: 62, of: 190, left: 128, says: '128 m to go', short: '128 m' }, run: { show: true, at: 2, of: 3 }, hero: { stamina: 4, staminaMax: 6, sprints: true }, coins: { count: 12 }, start: { count: '2', sub: '' }, hint: { show: true }, moments: [] });

export function courseHud(course, { theme = null, screen = null, words = {} } = {}) {
  const D = course.dress ?? {}, T = D.things ?? {}, sprints = !!course.rule?.stamina;
  const portrait = !!screen && (screen === 'phone' || screen.pole === 'phone' || screen.orientation === 'portrait');
  const w = { coins: 'coins', map: 'map', left: 'm to go', leftShort: 'm', stamina: 'stamina', over: T.hurdle ? 'over' : 'jump', round: T.posts ? 'clear track' : 'open lane', roundShort: 'clear', go: 'go', ...words };
  const TALL = { frame: 'portrait' };
  // the parts, in a wide frame's words or a tall one's (shorter: no room for a label beside each)
  const parts = (tall) => ({
    pips: { use: 'pips', props: { value: B('run.at'), max: B('run.of'), shape: 'square', ...(tall ? {} : { label: w.map }) }, when: B('run.show') },
    bar: { use: 'bar', props: { value: B('course.metres'), max: B('course.of'), figures: false, size: 'thin' } },
    left: { use: 'text', props: { value: B(tall ? 'course.short' : 'course.says'), role: 'label' } },
    coins: { use: 'counter', props: { label: tall ? '' : w.coins, value: B('coins.count'), icon: 'coin' } },
    stamina: { use: 'bar', props: { value: B('hero.stamina'), max: B('hero.staminaMax'), variant: 'stamina', figures: false, ...(tall ? {} : { label: w.stamina }) } },
  });
  const W = parts(false), P = parts(true);
  const hint = { use: 'region', props: { at: 'right' }, when: B('hint.show'), children: [{ use: 'stack', props: { dir: 'column', gap: 'tight', align: 'end' }, children: [
    { use: 'prompt', props: { action: 'jump', label: w.over } }, { use: 'prompt', props: { action: 'steer', label: w.round }, unless: TALL }, { use: 'prompt', props: { action: 'steer', label: w.roundShort }, when: TALL }] }] };
  const moments = { use: 'region', props: { at: 'center', variant: 'bare' }, children: [{ use: 'moments', props: { rows: B('moments'), as: 'banner', hold: 0.9, read: 0.4 } }] };
  // ONE composition, laid by the frame it is drawn in (mana-ui's frame words: a phone turned is laid again). A wide
  // frame keeps to the top's corners and edge; a tall one has no width for three across and its corner is the shell's
  // menu button's, so all of it is one plate in the top's middle: the run over the stamina, the progress beside with
  // the metres and the coins under it
  const hud = { use: 'hud', children: [
    { use: 'region', props: { at: 'top-left' }, unless: TALL, children: [{ use: 'stack', props: { dir: 'column', gap: 'tight', align: 'start' }, children: [W.pips, W.coins] }] },
    { use: 'region', props: { at: 'top' }, unless: TALL, children: [{ use: 'stack', props: { dir: 'column', gap: 'tight', align: 'center' }, children: [W.bar, W.left] }] },
    ...(sprints ? [{ use: 'region', props: { at: 'top-right' }, unless: TALL, children: [W.stamina] }] : []),
    { use: 'region', props: { at: 'top' }, when: TALL, children: [{ use: 'stack', props: { dir: 'row', gap: 'loose', align: 'center' }, children: [{ use: 'stack', props: { dir: 'column', gap: 'tight', align: 'start' }, children: [P.pips, ...(sprints ? [P.stamina] : [])] }, { use: 'stack', props: { dir: 'column', gap: 'tight', align: 'center' }, children: [P.bar, { use: 'stack', props: { dir: 'row', gap: 'loose', align: 'center' }, children: [P.left, P.coins] }] }] }] },
    hint, moments] };
  // the start cue is a SCREEN: while one is up the pilot's input is held, so the hero stands until GO
  const ready = { use: 'screen', props: { layer: 'overlay', place: 'center', legend: 'none' }, children: [{ use: 'stack', props: { dir: 'column', gap: 'tight', align: 'center' }, children: [{ use: 'text', props: { value: B('start.count'), role: 'display' } }, { use: 'text', props: { value: B('start.sub'), role: 'label' } }] }] };
  // (a card's name is resolved here to the theme it is: the page's channel reads a theme, never a shelf)
  const named = theme ?? D.ui ?? 'console', base = typeof named === 'string' && !THEMES[named] ? cardTheme(named) : named;
  return {
    spec: { screens: { ready }, hud },
    theme: portrait ? (typeof base === 'string' ? { from: base, distance: 'hand' } : { ...base, distance: 'hand' }) : base,
    feed: { kind: 'course', from: course.start[1], to: course.exit[1], left: w.left, leftShort: w.leftShort, cue: { beats: ['3', '2', '1'], every: 0.6, go: w.go.toUpperCase(), sub: D.premise ? 'the last train is leaving' : '' }, hint: { seconds: 9 }, stamina: sprints },
  };
}
