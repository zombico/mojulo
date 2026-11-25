/**
 * THE HOLO BRIEFING PAGE — a mission's briefing as one self-contained page: the holo table (briefing.client.js, three.js
 * inlined as data modules, or from the pinned CDN where a host needs it) and the words over it on mana-ui, in the
 * campaign's idioms (mana-ui/idioms-campaign.js): the place along the top, the step told on the left, the flight groups
 * on the right, the orders under them. One input paradigm: the keys, a pad or a finger move through the same buttons.
 *
 *   briefingSpec()                       → the mana-ui spec (its defs only the idioms it uses)
 *   briefingState(B)                     → the words' state at the first step
 *   briefingPage(M, { theme?, cdn?, editor?, data? }) → the page (html), for a mission read by readMission (mission.js), or
 *                                        any design's table data (`data`: an arcade stage's, stage.js); with
 *                                        `editor`, the mission designer's (designer.js): its state, Approve, the table
 *                                        it is edited on
 *   briefingScript(D, { theme?, level? }) → the code both run (after `import * as THREE`)
 *   briefingChannelSource({ data, theme? }) → the block a level page splices (scene/channels/briefing.js): the briefing
 *                                        over the level as it loads, the mission held behind it; Launch lets it go
 *   BRIEFING_LOOK                        the look when none is said: the `orbit` theme card, nothing drawn across the
 *                                        screen (the table is the screen)
 *
 * The page answers to `window.__brief` (the table: go(k), step, steps) and `window.__manaUi` (the words); a step is
 * moved by the words' buttons, and the table follows. Launch opens the launch screen: in a game the level loads there.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { moduleDir } from '../../module-dir.js';
import { manaUi, manaUiSource, withIdioms, manaCss, themeCss, readTheme } from '../../mana-ui/index.js';
import { manaControls, manaGlyphs, manaHostSource, padLayoutSource } from '../controls/mana-controls.js';
import { THEME_CARDS, cardTheme } from '../playscape/ui/theme-cards/loader.js';
import { inlineImportmap, CDN_IMPORTMAP } from '../scene/emit-util.js';
import { briefingData } from './briefing.js';
import { MSG_PAUSE } from '../game/level-contract.js';

const SRC = moduleDir(import.meta.url, 'lib/graph/campaign');
const clientSource = () => readFileSync(join(SRC, 'briefing.client.js'), 'utf8');
const editorSource = () => readFileSync(join(SRC, 'briefing-editor.client.js'), 'utf8');
const json = (v) => JSON.stringify(v).replace(/</g, '\\u003c');
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
const B = (p) => ({ bind: `bf.${p}` });
const USES = ['place-banner', 'flight-roster', 'briefing-steps'];
export const BRIEFING_LOOK = 'orbit';

function themeOf(t) {
  const T = typeof t === 'string' && THEME_CARDS[t] ? cardTheme(t) : readTheme(t ?? cardTheme(BRIEFING_LOOK));
  // (nothing of the look drawn across the screen or behind a screen: the table is the screen's backdrop)
  return readTheme({ ...T, overlay: 'none', stage: 'none' });
}

/** The briefing's words as mana-ui draws them. */
export function briefingSpec() {
  const spec = {
    start: 'briefing',
    hud: { use: 'hud', children: [
      { use: 'place-banner', props: { parts: B('place'), state: B('state') } },
      { use: 'flight-roster', props: { title: B('rosterTitle'), rows: B('roster') }, when: B('theatre') },
      // the orders, once the table is on the fight: each goal as the briefing says it
      { use: 'region', props: { at: 'bottom-right', variant: 'scrim' }, when: B('theatre'), children: [{ use: 'stack', props: { gap: 'tight' }, children: [
        { use: 'text', props: { value: 'Orders', role: 'label' } },
        { use: 'each', props: { rows: B('goals'), row: { use: 'stack', props: { dir: 'row', gap: 'tight' }, children: [{ use: 'text', props: { value: '◆', role: 'caption' } }, { use: 'text', props: { value: { item: 'text' } } }] } } },
      ] }] },
    ] },
    screens: {
      briefing: { use: 'briefing-steps', props: { kicker: B('brief.kicker'), title: B('brief.title'), say: B('brief.say'), step: B('brief.step'), count: B('brief.count'), ready: B('brief.ready'), go: 'Launch', steps: B('brief.steps'),
        prev: { emit: 'brief:prev' }, next: { emit: 'brief:next' }, launch: { emit: 'brief:launch' }, back: { emit: 'brief:prev' } } },
      launch: { use: 'screen', props: { title: B('launch.title'), place: 'center' }, children: [{ use: 'window', children: [{ use: 'stack', children: [
        { use: 'text', props: { value: B('launch.say') } },
        { use: 'button', props: { label: 'Back to the briefing' }, on: { accept: { back: true } } },
      ] }] }] },
    },
  };
  const full = withIdioms(spec);
  full.defs = Object.fromEntries(Object.entries(full.defs || {}).filter(([k]) => USES.includes(k)));
  manaUi.readSpec(full);
  return full;
}

const SIDE = { friend: 0, foe: 1, neutral: 2 };
/** The words' state (the page recomputes it at each step with the same code: `stepWords`). */
export function briefingState(D) {
  return { bf: {
    state: D.status === 'approved' ? 'Approved' : 'Draft · for approval',
    // (who is in it, headed in the design's word: a squadron's flight groups, an operation's forces)
    rosterTitle: D.rosterTitle ?? 'Flight groups',
    place: D.place.parts.map((name) => ({ name })), roster: D.roster.map((r) => ({ id: r.id, name: r.name, craft: r.craft, count: `×${r.count}`, side: SIDE[r.side] ?? 2 })),
    goals: D.goals, theatre: false,
    brief: { kicker: '', title: '', say: '', step: 0, count: D.steps.length, ready: false, steps: [] },
    launch: D.status === 'approved' ? { title: `${D.name}: launch`, say: 'Red Flight, launch. The level loads here.' } : { title: `${D.name}: a draft`, say: 'This mission is a design waiting for approval. Once it is approved, its level is compiled and built, and Launch loads it here.' },
  } };
}

// the words at step k (inlined in the page with toString(): it reads only its arguments)
function stepWords(S, D, k) {
  const St = D.steps[k], bf = S.bf;
  bf.place = D.place.parts.map((name, i) => ({ name, ...(i ? {} : { first: true }), ...(i === St.part ? { now: true } : i > St.part ? { ahead: true } : {}) }));
  bf.theatre = St.stage === 'theatre';
  const lit = new Set(St.show);
  bf.roster = bf.roster.map((r) => ({ ...r, lit: lit.has(r.id) }));
  bf.brief = { kicker: `Step ${k + 1} of ${D.steps.length}`, title: St.title, say: St.say, step: k + 1, count: D.steps.length, ready: k === D.steps.length - 1,
    steps: D.steps.slice(0, k + 1).map((s, i) => ({ title: s.title, mark: i === k ? '▶' : '✓', then: { emit: 'brief:go', to: i } })) };
}

/**
 * The briefing's code (after `import * as THREE`): the data, the canvas, the client, mana-ui and its host, and the words
 * stepped with the table. `level`: drawn over a level's page, the mission held behind it until Launch, then gone (its
 * frames stopped, its GL context given back, the scene let go); else the page's own, Launch opening the launch screen.
 */
export function briefingScript(D, { theme = null, level = false } = {}) {
  const T = themeOf(theme), C = manaControls(), spec = briefingSpec();
  // (over a level: its own root, its sheet's look scoped to it, so a HUD the level draws on mana-ui keeps its own)
  const sheet = [manaCss(), themeCss(T).replace(/\.mana-root/g, '#mjbrief .mana-root'),
    '#mjbrief .mana-root{--mana-stage:none;--mana-overlay:none}#mjbrief{position:fixed;inset:0;z-index:2147483000;background:#02050a}#mjbrief>canvas{position:absolute;inset:0;width:100%;height:100%;display:block}#mjbrief>.bf-mana{position:absolute;inset:0}',
    '#mjbrief .mana-screen[data-place=left]{max-width:min(36vw,520px)}'].join('\n');
  const open = level ? `const __bfRoot = document.createElement('div');
__bfRoot.id = 'mjbrief';
__bfRoot.innerHTML = '<canvas></canvas><div class="bf-mana"></div>';
document.body.appendChild(__bfRoot);
const __bfCss = document.createElement('style');
__bfCss.textContent = ${json(sheet)};
document.head.appendChild(__bfCss);
const BRIEF_CANVAS = __bfRoot.querySelector('canvas'), __bfMana = __bfRoot.querySelector('.bf-mana');
// (the mission held behind the briefing on the pause sidecar the shell's pause uses, until Launch)
const __bfHold = (on) => { window.__mojMenuOpen = on; try { window.postMessage({ moj: ${json(MSG_PAUSE)}, on }, '*'); } catch (e) { /* no scene */ } };
__bfHold(true);` : `const BRIEF_CANVAS = document.getElementById('holo'), __bfMana = document.getElementById('mana');`;
  const launch = level
    ? `{ window.__brief.stop(); rt.close(); __bfRoot.remove(); __bfCss.remove(); __bfHold(false); launched = true; }`
    : `rt.open('launch');`;
  return `const BRIEF = ${json(D)};
${open}
${clientSource()}
const __manaUi = window.__manaUiKernel = ${manaUiSource()};
const __manaHostK = ${manaHostSource()};
const __manaPadLayout = (${padLayoutSource()});
const STATE = window.__manaState = ${json(briefingState(D))};
const stepWords = ${stepWords.toString()};
let rt = null, mview = null, launched = false;
const showStep = (k) => { if (launched) return; window.__brief.go(k); stepWords(STATE, BRIEF, window.__brief.step); if (mview) mview.paint(); };
const act = (e) => {
  if (e.emit === 'brief:next') showStep(window.__brief.step + 1);
  else if (e.emit === 'brief:prev') showStep(window.__brief.step - 1);
  else if (e.emit === 'brief:go') showStep(e.to);
  else if (e.emit === 'brief:launch' && !launched) ${launch}
};
rt = __manaUi.runtime(${json(spec)}, { read: (p) => __manaUi.readPath(STATE, p), act, now: () => performance.now() / 1000, cues: 'silent' });
rt.glyphs(${json(manaGlyphs())});
mview = __manaUi.mount(__bfMana, rt, { auto: true });
__manaHostK.connect(rt, mview, { keys: ${json(C.keys)}, pad: ${json(C.pad)}, padLayout: __manaPadLayout });
stepWords(STATE, BRIEF, 0);
mview.paint();${level ? `
// (a level's frame is inside the game's shell: take the keys, so the pilot steps the table without clicking into it)
try { window.focus(); } catch (e) {}` : ''}
window.${level ? '__mojBriefing' : '__manaUi'} = ${level ? '{ rt, get up() { return !launched; }, launch: () => act({ emit: \'brief:launch\' }) }' : 'rt'};`;
}

/** The page for a mission read by readMission. `editor` ({ ref, mission, design, edit, post, at }): served as a game's
 *  book, the bar over it (its state, the table, Approve) and, with `edit`, the table to edit it on
 *  (briefing-editor.client.js). */
export function briefingPage(M, { theme = null, cdn = false, editor = null, data = null } = {}) {
  // (`data`: a table drawn from another design's data, an arcade stage's: stage.js stageBriefingData)
  const D = data ?? briefingData(M), T = themeOf(theme);
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(D.name)} · briefing</title>
<script type="importmap">${cdn ? CDN_IMPORTMAP : inlineImportmap()}</script>
<style>
html,body{margin:0;height:100%;overflow:hidden;background:#02050a}
#holo{position:fixed;inset:0;width:100%;height:100%;display:block}
#mana{position:fixed;inset:0;z-index:2}
${manaCss()}
${themeCss(T)}
#mana .mana-screen[data-place=left]{max-width:min(36vw,520px)}
</style></head><body><canvas id="holo"></canvas><div id="mana"></div>
<script type="module">
import * as THREE from 'three';
${briefingScript(D, { theme })}${editor ? `
const EDITOR = ${json(editor)};
${editorSource()}` : ''}
</script></body></html>`;
}

/** The block a level page's briefing channel splices (scene/channels/briefing.js): in a scope of its own. */
export function briefingChannelSource({ data, theme = null }) {
  return `{
${briefingScript(data, { theme, level: true })}
}`;
}
