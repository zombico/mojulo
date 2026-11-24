import { describe, it, expect } from 'vitest';
import { composeLive, emissionSource } from './compose.js';
import { readPrompts, PROMPT_LAWS } from './prompt.js';

// THE QUICK-TIME PROMPT: one button in a window, told before it opens, its clock the screen's, a miss that says its cost
const CW = composeLive();
const DT = 1 / 60;
const FLAT = { ground: () => 0 };
CW.RULES.__probeIn = (e, input) => { e.sawJump = (e.sawJump || 0) + (input.jump ? 1 : 0); };
const world = (prompts, extra = {}) => {
  const w = CW.createWorld({ entities: [{ id: 'h', pilotable: true, rule: { type: '__probeIn' }, transform: { pos: [3, 4, 0], heading: 0 }, body: { type: 'mesh', shape: 'box', size: [0.6, 0.6, 1.7], hp: 100 } }], camera: { rule: '__probeIn' }, prompts: readPrompts(prompts), ...extra });
  w.pilotId = 'h';
  return w;
};
// step `n` frames, pressing `button` on the frames `on` says
const run = (w, n, on = () => false, button = 'act') => { for (let i = 0; i < n; i++) CW.stepWorld(w, on(i) ? { [button]: 1 } : {}, DT, FLAT); return w; };
const grab = { id: 'grab', lead: 0.5, window: 0.8 };   // opens at 30 frames, closes at 78
const at = (s) => Math.round(s * 60);

describe('the quick-time prompt', () => {
  it('absent adds nothing: no state, no emitted source', () => {
    expect(CW.createWorld({ entities: [{ id: 'h', rule: { type: 'static' }, transform: { pos: [0, 0, 0], heading: 0 } }] })).not.toHaveProperty('prompt');
    expect(emissionSource({})).not.toContain('stepWithPrompt');
    expect(emissionSource({ prompt: true })).toContain('stepWithPrompt');
  });

  it('a press on the window\'s middle hits; a frame after it closes misses; a press before it opens counts for nothing', () => {
    const mid = world([grab]); CW.promptFire(mid, 'grab');
    run(mid, 100, (i) => i === at(0.9));
    expect(mid.prompt.results.grab).toBe('hit');
    const late = world([grab]); CW.promptFire(late, 'grab');
    run(late, 100, (i) => i === at(1.3) + 1);
    expect(late.prompt.results.grab).toBe('miss');
    const early = world([grab]); CW.promptFire(early, 'grab');
    run(early, 100, (i) => i === at(0.2));
    expect(early.prompt.results.grab).toBe('miss');
  });

  it('a mash counts its presses inside the window; a hold is held without letting go', () => {
    const m = world([{ id: 'climb', kind: 'mash', count: 4, lead: 0.4, window: 1 }]); CW.promptFire(m, 'climb');
    run(m, 120, (i) => i > at(0.45) && i % 8 === 0);   // a press every 8 frames: 7 a second
    expect(m.prompt.results.climb).toBe('hit');
    const h = world([{ id: 'brace', kind: 'hold', hold: 0.5, lead: 0.4, window: 1 }]); CW.promptFire(h, 'brace');
    run(h, 120, (i) => i > at(0.45));
    expect(h.prompt.results.brace).toBe('hit');
    const let_ = world([{ id: 'brace', kind: 'hold', hold: 0.5, lead: 0.4, window: 1 }]); CW.promptFire(let_, 'brace');
    run(let_, 120, (i) => i > at(0.45) && i % 20 !== 0);   // let go every third of a second
    expect(let_.prompt.results.brace).toBe('miss');
  });

  it('its clock is the screen\'s: under a world slowed to a fifth the window is as long as it says', () => {
    const w = world([{ ...grab, slow: 0.2 }], { tempo: { moments: [{ on: 'prompt:grab', scale: 0.2, hold: 5 }] } });
    CW.promptFire(w, 'grab');
    run(w, 100, (i) => i === at(0.9));
    expect(w.prompt.results.grab).toBe('hit');
    expect(CW.tempoScale(w)).toBeGreaterThan(0.2);   // the world given back as it is answered
  });

  it('a miss goes back to the checkpoint and lets a chase line go; a hurt takes its hp; the bus hears it', () => {
    const w = world([{ ...grab, back: [0, 0, 0] }]);
    CW.promptFire(w, 'grab');
    const events = [];
    let prev = null;
    for (let i = 0; i < 100; i++) { CW.stepWorld(w, {}, DT, FLAT); const f = CW.castFacts(w, prev); prev = f.prev; events.push(...f.events.filter((x) => x.type.startsWith('prompt:')).map((x) => x.type)); }
    expect(w.byId.h.transform.pos).toEqual([0, 0, 0]);
    expect(events).toEqual(['prompt:grab:up', 'prompt:grab:miss']);
    const hurt = world([{ ...grab, miss: 'hurt', hurt: 30 }]); CW.promptFire(hurt, 'grab'); run(hurt, 100);
    expect(hurt.byId.h.body.hp).toBe(70);
  });

  it('is brought up by a cue\'s op, one at a time, and its button does only this while it is up', () => {
    const w = world([{ ...grab, button: 'jump' }, { id: 'other' }]);
    CW.castOps(w, [{ op: 'prompt', id: 'grab' }]);
    expect(w.prompt.up.id).toBe('grab');
    expect(CW.promptFire(w, 'other')).toBe(false);
    run(w, 100, (i) => i === at(0.9), 'jump');
    expect(w.prompt.results.grab).toBe('hit');
    expect(w.byId.h.sawJump || 0).toBe(0);
    run(w, 2, () => true, 'jump');
    expect(w.byId.h.sawJump).toBe(2);   // its own again once the prompt is down
  });
});

describe('a world\'s prompts, read and held to their laws', () => {
  it('takes a prompt with its kind, its button and its timing', () => {
    expect(readPrompts([grab])).toEqual([{ id: 'grab', kind: 'press', button: 'act', lead: 0.5, window: 0.8, miss: 'checkpoint' }]);
    expect(readPrompts([{ id: 'a', kind: 'aim', dir: 'left' }])[0]).toMatchObject({ kind: 'aim', dir: 'left' });
  });
  it('refuses a prompt that is sprung, unfair, two things or costs nothing said', () => {
    expect(() => readPrompts([{ id: 'a', lead: PROMPT_LAWS.lead - 0.05 }])).toThrow(/told/);
    expect(() => readPrompts([{ id: 'a', window: 0.3 }])).toThrow(/fair/);
    expect(() => readPrompts([{ id: 'a', kind: 'mash', count: 10, window: 0.8 }])).toThrow(/no faster/);
    expect(() => readPrompts([{ id: 'a', kind: 'hold', hold: 0.8, window: 0.8 }])).toThrow(/shorter than its window/);
    expect(() => readPrompts([{ id: 'a', button: ['act', 'jump'] }])).toThrow(/one thing/);
    expect(() => readPrompts([{ id: 'a', miss: 'nothing' }])).toThrow(/recoverable/);
    expect(() => readPrompts([grab, grab])).toThrow(/twice/);
  });
});

describe('the prompt on the page', () => {
  it('a world with prompts carries the prompt\'s builder and its look; one without keeps every byte', async () => {
    const { emitThreeWorld } = await import('@/lib/graph/scene/scene-three');
    const floor = { corners: [[-20, -20, 0], [20, -20, 0], [20, 20, 0], [-20, 20, 0]], fill: '#556' };
    const base = { faces: [floor], entities: [{ id: 'p', rule: { type: 'walk', speed: 4 }, pilotable: true, body: { type: 'mesh', shape: 'box', size: [0.6, 0.6, 1.7] } }], camera: { rule: 'follow', target: 'p' } };
    const plain = emitThreeWorld(base), asked = emitThreeWorld({ ...base, prompts: readPrompts([{ ...grab, says: 'Grab' }]) });
    for (const s of ['stepWithPrompt', '__mojPromptMana', 'moj-pr']) { expect(asked).toContain(s); expect(plain).not.toContain(s); }
    expect(emitThreeWorld({ ...base, prompts: null })).toBe(plain);
    expect(emitThreeWorld({ ...base, capture: true, prompts: readPrompts([grab]) })).not.toContain('__mojPromptMana');   // (a render draws no prompt)
  });
});
