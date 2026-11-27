// seat lobby channel: a level whose seats join by lobby (soul.join=lobby, a level's `seats.join`) opens on the lobby
// (docs/local-multiplayer-principles.md principle 6): every seat in its colour, saying who has sat down and how to, drawn by
// mana-ui over the level, the level held behind it as a menu holds it (frozen, its input taken). Each controller sits down
// with a press (the seats kernel's own join, controllable/index.js); seat 1 starts the game with a fresh press of its
// start (Enter on the keyboard; a pad's Start or A), and the lobby closes behind it (the kernel's setOpen: no one joins
// after). Opt-in: a page whose seats say no lobby adds nothing.
//
// One block in a scope of its own, so none of its names reach the page's. It reads the seats the controllable channel
// keeps (window.__mojSeats) and closes them (window.__mojSeatsOpen). It publishes `window.__mojLobby` for probes.
//
//   seatLobbySpec()               → the mana-ui spec (one screen: the seats and how to start)
//   seatLobbyScript({ max })      → the block
import { manaUi, manaUiSource, manaCss, themeCss, readTheme } from '../../../mana-ui/index.js';
import { manaGlyphs } from '../../controls/mana-controls.js';
import { THEME_CARDS, cardTheme } from '../../playscape/ui/theme-cards/loader.js';

const json = (v) => JSON.stringify(v).replace(/</g, '\\u003c');
const B = (p) => ({ bind: `sl.${p}` });
// a theme card for the lobby when the page names none: the shell's own
const LOBBY_LOOK = 'floodlight';

/** The lobby as mana-ui draws it: one screen, a row a seat (its tag in its colour, what it is doing), then how to start. */
export function seatLobbySpec() {
  const text = (value, role) => ({ use: 'text', props: { value, ...(role ? { role } : {}) } });
  const spec = {
    start: 'lobby',
    screens: {
      lobby: { use: 'screen', props: { place: 'center' }, children: [{ use: 'window', children: [{ use: 'stack', props: { gap: 'loose' }, children: [
        text('Players', 'display'),
        { use: 'each', props: { rows: B('rows'), row: { use: 'stack', props: { dir: 'row', gap: 'tight' }, children: [
          { use: 'badge', props: { value: { item: 'label' }, variant: 'strong', side: { item: 'side' } } },
          text({ item: 'state' }),
        ] } } },
        { use: 'divider' },
        text(B('hint'), 'caption'),
      ] }] }] },
    },
  };
  manaUi.readSpec(spec);
  return spec;
}

/** The block a level page splices: the lobby over the level until seat 1 starts, then gone and the seats closed. */
export function seatLobbyScript({ max = 2, theme = null } = {}) {
  const T0 = typeof theme === 'string' && THEME_CARDS[theme] ? cardTheme(theme) : theme ? readTheme(theme) : cardTheme(LOBBY_LOOK);
  const T = readTheme({ ...T0, overlay: 'none' }), spec = seatLobbySpec();
  const sheet = [manaCss(), themeCss(T).replace(/\.mana-root/g, '#mjlobby .mana-root'),
    '#mjlobby{position:fixed;inset:0;z-index:2147483000;background:rgba(6,10,18,0.55);backdrop-filter:blur(3px)}#mjlobby>.sl-mana{position:absolute;inset:0}',
    '#mjlobby .mana-screen>.mana-window{max-width:min(92vw,460px);min-width:0}'].join('\n');
  return `
// ── seat lobby: who plays, before the level starts ──
{
const __slRoot = document.createElement('div');
__slRoot.id = 'mjlobby';
__slRoot.innerHTML = '<div class="sl-mana"></div>';
document.body.appendChild(__slRoot);
const __slCss = document.createElement('style');
__slCss.textContent = ${json(sheet)};
document.head.appendChild(__slCss);
// (the level held behind the lobby, as a menu holds it: no input to the pilot, the world and its clock still. Never the
// shell's pause: a paused page steps no channel, and the seats are taken in the controllable channel's step)
const __slHold = (on) => { window.__mojMenuOpen = on; window.__mojFreeze = on; };
__slHold(true);
try { window.focus(); } catch (e) { /* not ours to take */ }
const __slUi = ${manaUiSource()};
const __slMax = ${json(max)};
const STATE = { sl: { rows: [], hint: '' } };
let rt = null, started = false, said = '', kbStart = false;
const seats = () => (window.__mojSeats ? window.__mojSeats() : { seats: [] });
// what the lobby says: a row a seat (in its colour), then who starts it
function read() {
  const S = seats(), rows = [];
  for (let n = 1; n <= __slMax; n++) {
    const x = S.seats.find((y) => y.n === n);
    rows.push({ label: 'P' + n, side: n - 1, state: !x ? 'Press any button to join' : x.away ? 'Away' : x.controller === 'keyboard' ? 'Joined on the keyboard' : 'Joined' });
  }
  const one = S.seats.find((y) => y.n === 1);
  return { rows, hint: !one ? 'Press any button to join' : one.controller === 'keyboard' ? 'P1: press Enter to start' : 'P1: press Start to start' };
}
// seat 1's start: a fresh press of it, the press that sat it down not one (its controller seated a frame before)
let one0 = null;
const padPrev = {};
function startPressed() {
  const S = seats(), one = S.seats.find((y) => y.n === 1);
  const was = one0; one0 = one ? one.controller : null;
  if (!one || was !== one.controller) { kbStart = false; return false; }
  if (one.controller === 'keyboard') { const k = kbStart; kbStart = false; return k; }
  const ps = navigator.getGamepads ? navigator.getGamepads() : [], g = ps[+one.controller.slice(4)];
  if (!g || !g.connected) return false;
  const now = !!((g.buttons[9] && g.buttons[9].pressed) || (g.buttons[0] && g.buttons[0].pressed)), prev = padPrev[g.index];
  padPrev[g.index] = now;
  return now && prev === false;
}
window.addEventListener('keydown', (e) => { if (e.key === 'Enter') kbStart = true; });
function start() {
  if (started) return;
  started = true;
  if (window.__mojSeatsOpen) window.__mojSeatsOpen(false);
  rt.close(); __slRoot.remove(); __slCss.remove(); __slHold(false);
}
rt = __slUi.runtime(${json(spec)}, { read: (p) => __slUi.readPath(STATE, p), act: () => {}, now: () => performance.now() / 1000, cues: 'silent' });
rt.glyphs(${json(manaGlyphs())});
const mview = __slUi.mount(__slRoot.querySelector('.sl-mana'), rt, { auto: true });
function tick() {
  if (started) return;
  const R = read(), s = JSON.stringify(R);
  if (s !== said) { said = s; STATE.sl = R; mview.paint(); }
  if (startPressed()) { start(); return; }
  requestAnimationFrame(tick);
}
STATE.sl = read(); said = JSON.stringify(STATE.sl); mview.paint();
requestAnimationFrame(tick);
window.__mojLobby = { rt, get up() { return !started; }, read, start };
}`;
}
