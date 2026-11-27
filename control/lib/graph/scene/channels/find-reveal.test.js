// @vitest-environment jsdom
// A FIND, REVEALED (find-reveal.js): as the objectives say a scan's task was found, the game stops for it (the world
// frozen, the keys held) and the find is shown, its name, its grade, its yield counted up to what was reckoned; it
// stands its time, or until a key after its least, and the play goes on. A task with no find shows nothing.
import { describe, expect, it } from 'vitest';
import { findRevealScript, FIND_REVEAL } from './find-reveal.js';

function page(finds) {
  document.body.innerHTML = ''; document.head.innerHTML = '';
  let now = 0, frames = [];
  const log = [];
  window.__mojBus = { state: { log } }; window.__mojFreeze = false; window.__mojMenuOpen = false;
  new Function('window', 'document', 'performance', 'requestAnimationFrame', findRevealScript(finds))(window, document, { now: () => now }, (f) => { frames.push(f); });
  const at = (s) => { now = s * 1000; const fs = frames; frames = []; fs.forEach((f) => f()); };
  return { log, at };
}
const F = { task: 't2', name: 'Platinum-group metals', grade: 'Rich seam', about: 'what makes a rock worth moving', amount: { approx: 4.2, unit: 'Mt' }, wire: { lines: [0, 0, 0, 1, 0, 0, 1, 0, 0, 1, 1, 0], colour: '#f1e6c8' } };

describe('a find, revealed', () => {
  it('stops the game as its task is found, shows it with its yield counted up, then lets the play go on', () => {
    const P = page([F]);
    P.at(0);
    P.log.push({ type: 'objective:found:t9' });                                 // (another task's: nothing)
    P.at(0.1);
    expect(document.querySelector('.moj-find')).toBeNull();
    P.log.push({ type: 'objective:found:t2' });
    P.at(0.2); P.at(0.3);
    expect(document.querySelector('.moj-find .n').textContent).toBe(F.name);
    expect(window.__mojFreeze).toBe(true);
    expect(window.__mojMenuOpen).toBe(true);
    expect(window.__mojFind.up).toEqual({ task: 't2', name: F.name });
    P.at(FIND_REVEAL.lay + 1);
    expect(document.querySelector('.moj-find .num').textContent).toBe('4.2');           // (counted up to what was reckoned)
    // (a key before its least does nothing; after it, the reveal goes and the world runs again)
    P.at(FIND_REVEAL.hold + 0.5);
    P.at(FIND_REVEAL.hold + 0.5 + FIND_REVEAL.fade + 0.1);
  });

  it('goes after its time and the world runs again', async () => {
    const P = page([F]);
    P.at(0);
    P.log.push({ type: 'objective:found:t2' });
    P.at(0.1);
    P.at(FIND_REVEAL.hold + 0.2);
    await new Promise((r) => setTimeout(r, FIND_REVEAL.fade * 1000 + 60));
    expect(window.__mojFreeze).toBe(false);
    expect(document.querySelector('.moj-find')).toBeNull();
    expect(window.__mojFind.shown).toBe(1);
  });
});
