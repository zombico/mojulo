// lesson channel: a flying lesson's brief over its level's page (gameworld/lesson-brief.js: its words), drawn by mana-ui
// as the lesson loads, the lesson held behind it on the pause sidecar the shell's pause uses; Start lets it go. Opt-in on
// a world's `lesson` key (an airspace level's: Pilot School's); absent, it adds nothing to the page.
//
// One block in a scope of its own, so none of its names reach the page's. It publishes `window.__mojLesson` for probes.
//
//   lessonBriefSpec()               → the mana-ui spec (one screen: the lesson, its tasks, its medals and Start)
//   lessonChannelScript({ data, theme? }) → the block
import { manaUi, manaUiSource, manaCss, themeCss, readTheme } from '../../../mana-ui/index.js';
import { manaControls, manaGlyphs, manaHostSource, padLayoutSource } from '../../controls/mana-controls.js';
import { THEME_CARDS, cardTheme } from '../../playscape/ui/theme-cards/loader.js';
import { MSG_PAUSE } from '../../game/level-contract.js';
import { LESSON_LOOK } from '../../gameworld/lesson-brief.js';

const json = (v) => JSON.stringify(v).replace(/</g, '\\u003c');
const B = (p) => ({ bind: `lb.${p}` });

/** The brief as mana-ui draws it: one screen, the lesson and Start. */
export function lessonBriefSpec() {
  const text = (value, role) => ({ use: 'text', props: { value, ...(role ? { role } : {}) } });
  const spec = {
    start: 'brief',
    screens: {
      brief: { use: 'screen', props: { place: 'center' }, children: [{ use: 'window', children: [{ use: 'stack', props: { gap: 'loose' }, children: [
        { use: 'stack', props: { gap: 'tight' }, children: [text(B('kicker'), 'label'), text(B('name'), 'display'), text(B('brief')), text(B('sky'), 'caption')] },
        { use: 'divider' },
        text('The tasks', 'heading'),
        { use: 'each', props: { rows: B('tasks'), row: { use: 'stack', props: { dir: 'row', gap: 'tight' }, children: [text({ item: 'n' }, 'numeral'), text({ item: 'text' })] } } },
        { use: 'stack', props: { gap: 'tight' }, when: B('graded'), children: [
          { use: 'divider' },
          text('Medals', 'heading'),
          { use: 'each', props: { rows: B('medals'), row: { use: 'stack', props: { dir: 'row', gap: 'tight' }, children: [{ use: 'badge', props: { value: { item: 'medal' }, variant: 'stamp' } }, text({ item: 'line' }, 'caption')] } } },
        ] },
        { use: 'button', props: { label: 'Start lesson' }, on: { accept: { emit: 'lesson:start' } } },
      ] }] }] },
    },
  };
  manaUi.readSpec(spec);
  return spec;
}

/** The block a level page splices: the brief over the level, in a scope of its own, the lesson held on the pause
 *  sidecar until Start, then gone. */
export function lessonChannelScript({ data, theme = null }) {
  const T0 = typeof theme === 'string' && THEME_CARDS[theme] ? cardTheme(theme) : theme ? readTheme(theme) : cardTheme(LESSON_LOOK);
  const T = readTheme({ ...T0, overlay: 'none' }), C = manaControls(), spec = lessonBriefSpec();
  const sheet = [manaCss(), themeCss(T).replace(/\.mana-root/g, '#mjlesson .mana-root'),
    '#mjlesson{position:fixed;inset:0;z-index:2147483000;background:rgba(6,10,18,0.55);backdrop-filter:blur(3px)}#mjlesson>.lb-mana{position:absolute;inset:0}',
    '#mjlesson .mana-screen>.mana-window{max-width:min(92vw,620px);min-width:0}'].join('\n');
  return `
// ── lesson: the instructor's brief before the lesson is flown ──
{
const __lbRoot = document.createElement('div');
__lbRoot.id = 'mjlesson';
__lbRoot.innerHTML = '<div class="lb-mana"></div>';
document.body.appendChild(__lbRoot);
const __lbCss = document.createElement('style');
__lbCss.textContent = ${json(sheet)};
document.head.appendChild(__lbCss);
// (the lesson held behind the brief on the pause sidecar the shell's pause uses, until Start)
const __lbHold = (on) => { window.__mojMenuOpen = on; try { window.postMessage({ moj: ${json(MSG_PAUSE)}, on }, '*'); } catch (e) { /* no scene */ } };
__lbHold(true);
// (the keys to the brief: inside a game's shell the level's frame is given the focus, so Enter starts it from the shell)
try { window.focus(); } catch (e) { /* not ours to take */ }
const __lbUi = ${manaUiSource()};
const __lbHost = ${manaHostSource()};
const __lbPad = (${padLayoutSource()});
const STATE = { lb: { ...${json(data)}, graded: ${data.medals && data.medals.length ? 'true' : 'false'} } };
let rt = null, started = false;
const act = (e) => { if (e.emit === 'lesson:start' && !started) { started = true; rt.close(); __lbRoot.remove(); __lbCss.remove(); __lbHold(false); } };
rt = __lbUi.runtime(${json(spec)}, { read: (p) => __lbUi.readPath(STATE, p), act, now: () => performance.now() / 1000, cues: 'silent' });
rt.glyphs(${json(manaGlyphs())});
const mview = __lbUi.mount(__lbRoot.querySelector('.lb-mana'), rt, { auto: true });
__lbHost.connect(rt, mview, { keys: ${json(C.keys)}, pad: ${json(C.pad)}, padLayout: __lbPad });
mview.paint();
window.__mojLesson = { rt, get up() { return !started; }, start: () => act({ emit: 'lesson:start' }) };
}`;
}
