// @vitest-environment jsdom
// THE WARNING (warning.js, a cue's `warning`): a boss coming: a red band across the screen with its title over the words,
// blinking as it comes and gone after its seconds, and its own klaxon; read off the bus's vars; and a level that raises
// none carries none of it.
import { describe, expect, it } from 'vitest';
import { warningScript, warningOn, WARNING } from './warning.js';
import { readCues, lowerCues, WARNING_VARS } from '../../playscape/ui/cues.js';

function page() {
  let now = 0;
  const vars = { [WARNING_VARS.n]: 0, [WARNING_VARS.text]: '', [WARNING_VARS.title]: '', [WARNING_VARS.ttl]: 0 };
  const tones = [];
  const node = () => ({ connect() {}, gain: { setValueAtTime() {}, linearRampToValueAtTime() {} }, frequency: { value: 0, setValueAtTime: (hz) => tones.push(hz) }, start() {}, stop() {} });
  const ctx = { currentTime: 0, state: 'running', destination: {}, createGain: node, createBiquadFilter: node, createOscillator: node };
  const step = new Function('window', 'document', 'performance', '__busState', '__beatsCtx', `${warningScript()}\nreturn __stepWarning;`)(window, document, { now: () => now }, { vars }, ctx);
  return { vars, tones, step, at: (s) => { now = s * 1000; step(); }, band: () => document.querySelector('.wrn-band') };
}

describe('the warning', () => {
  it('is read off a cue and lowered onto the bus: its words, its title and its seconds, then its count', () => {
    const play = { cues: [{ id: 'boss', when: { on: 'boss:come' }, then: { warning: { say: 'Heavy frame inbound', title: 'CAUTION', ttl: 4 } } }] };
    expect(readCues(play)[0].then[0]).toMatchObject({ kind: 'warning', say: 'Heavy frame inbound', title: 'CAUTION', ttl: 4 });
    const ev = lowerCues(play);
    expect(ev.reactions.filter((r) => r.on === 'cue:boss' && r.var).map((r) => [r.var, r.to ?? r.by])).toEqual([[WARNING_VARS.text, 'Heavy frame inbound'], [WARNING_VARS.title, 'CAUTION'], [WARNING_VARS.ttl, 4], [WARNING_VARS.n, 1]]);
    expect(warningOn(ev)).toBe(true);
    expect(warningOn(lowerCues({ cues: [{ id: 'b', when: { on: 'x' }, then: { say: 'Hi' } }] }))).toBe(false);
    expect(() => readCues({ cues: [{ id: 'b', when: { on: 'x' }, then: { warning: { say: 'x', colour: 'red' } } }] })).toThrow(/not part of a warning/);
  });

  it('comes on the bus: the band up with its title and words, blinking, its klaxon sounded; gone after its seconds', () => {
    const P = page();
    P.at(0);
    expect(window.__mojWarning.shown).toBe(false);
    Object.assign(P.vars, { [WARNING_VARS.text]: 'Enemy approach', [WARNING_VARS.title]: '', [WARNING_VARS.ttl]: 0, [WARNING_VARS.n]: 1 });
    P.at(1);
    expect(window.__mojWarning).toMatchObject({ shown: true, title: 'WARNING', text: 'Enemy approach', sounded: 1 });
    expect(new Set(P.tones)).toEqual(new Set(WARNING.tones));                       // (the two tones, stepped)
    P.at(1.3);
    expect(Number(P.band().style.opacity)).toBeLessThan(1);                           // (blinking as it comes)
    P.at(1 + WARNING.ttl + 0.1);
    expect(window.__mojWarning.shown).toBe(false);
  });
});
