/**
 * THE RUNNER'S HUD — what a rolled course (roll-course.js) shows in play, as ONE composition on mana-ui
 * (docs/mana-ui.md), drawn by the level page's HUD host (scene/channels/mana-hud.js). It is laid by the course's own
 * screen (course-view.js): the top third is where stuff comes from, so the HUD keeps to its corners and its edge; the
 * middle is the way's; the bottom is the character's, and nothing is drawn there.
 *
 *   top-left    which map of the run this is, as pips (only in a run: the shell hands the level its place)
 *   top         how far along the course: a bar, and the metres left
 *   top-right   stamina, for a hero that sprints on it
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
 *   course { metres, of, left }   run { show, at, of }   hero { stamina, staminaMax, sprints }
 *   start { count, sub }          hint { show }          moments [{ id, text, sub?, weight? }]
 * Pure: a spec is data.
 */
import { THEMES } from '../../mana-ui/theme.js';
import { cardTheme } from '../playscape/ui/theme-cards/loader.js';

const B = (path) => ({ bind: path });

export const COURSE_HUD_STATE = Object.freeze({ course: { metres: 62, of: 190, left: 128 }, run: { show: true, at: 2, of: 3 }, hero: { stamina: 4, staminaMax: 6, sprints: true }, start: { count: '2', sub: '' }, hint: { show: true }, moments: [] });

export function courseHud(course, { theme = null, screen = null, words = {} } = {}) {
  const D = course.dress ?? {}, T = D.things ?? {}, sprints = !!course.rule?.stamina;
  const portrait = !!screen && (screen === 'phone' || screen.pole === 'phone' || screen.orientation === 'portrait');
  const w = { map: 'map', left: 'm to go', stamina: 'stamina', over: T.hurdle ? 'over' : 'jump', round: portrait ? 'clear' : T.posts ? 'clear track' : 'open lane', go: 'go', ...words };
  const pips = { use: 'pips', props: { value: B('run.at'), max: B('run.of'), shape: 'square', label: w.map }, when: B('run.show') };
  const progress = { use: 'stack', props: { dir: 'column', gap: 'tight', align: 'center' }, children: [{ use: 'bar', props: { value: B('course.metres'), max: B('course.of'), figures: false, size: 'thin' } }, { use: 'counter', props: { label: w.left, value: B('course.left') } }] };
  const stamina = { use: 'bar', props: { value: B('hero.stamina'), max: B('hero.staminaMax'), variant: 'stamina', figures: false, ...(portrait ? {} : { label: w.stamina }) } };
  const hint = { use: 'region', props: { at: 'right' }, when: B('hint.show'), children: [{ use: 'stack', props: { dir: 'column', gap: 'tight', align: 'end' }, children: [
    { use: 'prompt', props: { action: 'jump', label: w.over } }, { use: 'prompt', props: { action: 'steer', label: w.round } }] }] };
  const moments = { use: 'region', props: { at: 'center', variant: 'bare' }, children: [{ use: 'moments', props: { rows: B('moments'), as: 'banner', hold: 0.9, read: 0.4 } }] };
  // a wide frame keeps to the top's corners and edge; a tall one has no width for three, so the run and the stamina
  // share a row over the progress, all in the top's middle
  const hud = { use: 'hud', children: portrait
    ? [{ use: 'region', props: { at: 'top' }, children: [{ use: 'stack', props: { dir: 'column', gap: 'tight', align: 'center' }, children: [{ use: 'stack', props: { dir: 'row', gap: 'loose', align: 'center' }, children: [pips, ...(sprints ? [stamina] : [])] }, progress] }] }, hint, moments]
    : [{ use: 'region', props: { at: 'top-left' }, when: B('run.show'), children: [pips] }, { use: 'region', props: { at: 'top' }, children: [progress] }, ...(sprints ? [{ use: 'region', props: { at: 'top-right' }, children: [stamina] }] : []), hint, moments] };
  // the start cue is a SCREEN: while one is up the pilot's input is held, so the hero stands until GO
  const ready = { use: 'screen', props: { layer: 'overlay', place: 'center', legend: 'none' }, children: [{ use: 'stack', props: { dir: 'column', gap: 'tight', align: 'center' }, children: [{ use: 'text', props: { value: B('start.count'), role: 'display' } }, { use: 'text', props: { value: B('start.sub'), role: 'label' } }] }] };
  // (a card's name is resolved here to the theme it is: the page's channel reads a theme, never a shelf)
  const named = theme ?? D.ui ?? 'console', base = typeof named === 'string' && !THEMES[named] ? cardTheme(named) : named;
  return {
    spec: { screens: { ready }, hud },
    theme: portrait ? (typeof base === 'string' ? { from: base, distance: 'hand' } : { ...base, distance: 'hand' }) : base,
    feed: { kind: 'course', from: course.start[1], to: course.exit[1], cue: { beats: ['3', '2', '1'], every: 0.6, go: w.go.toUpperCase(), sub: D.premise ? 'the last train is leaving' : '' }, hint: { seconds: 9 }, stamina: sprints },
  };
}
