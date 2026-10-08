import { describe, it, expect } from 'vitest';
import { createBusState, processEvents, watchEvents, deriveZoneEvents } from '../../worlds/event-bus.js';
import { readCues } from './cues.js';
import { lowerPlay } from './direction.js';
import { menuVar } from './cues.js';
import { buildControlsKernel } from '../../controls/controls-kernel.js';
import { SCHEMES } from '../../controls/schemes.js';
import { DEVICES } from '../../controls/devices.js';

const SPOTS = [{ id: 'counter-front', at: [7, 1.2], face: 90 }];
const MENUS = [{ id: 'keeper', kind: 'talk', who: 'Keeper', lines: ['Evening.'], choices: [{ say: 'Leave' }] }];
const PLAY = {
  spots: SPOTS, menus: MENUS,
  cues: [
    { id: 'talk', when: { use: 'counter-front', prompt: 'talk' }, then: { open: 'keeper' } },
    { id: 'hello', when: { use: 'counter-front' }, then: { say: 'Evening', as: 'toast' } },
    { id: 'lever', when: { use: { at: [0, 4], r: 1 }, prompt: 'pull' }, then: { set: 'lever', to: 1 } },
    { id: 'door', when: { use: 'north-door' }, then: { set: 'opened', to: 1 } },
  ],
};

describe('places you use', () => {
  it('reads a place, an area and a thing; teaches the prompt', () => {
    const [talk, , lever, door] = readCues(PLAY);
    expect(talk.when).toEqual({ kind: 'use', id: 'counter-front', prompt: 'talk' });
    expect(lever.when).toMatchObject({ kind: 'use', id: null, area: { at: [0, 4, 0], r: 1 }, prompt: 'pull' });
    expect(door.when).toEqual({ kind: 'use', id: 'north-door', prompt: null });
    expect(() => readCues({ cues: [{ id: 'x', when: { use: 'a', prompt: 3 }, then: { set: 'a', to: 1 } }] })).toThrow(/prompt is the word/);
  });

  it('a place becomes one usable zone (shared by its cues), its use event fires the cue, and walking off ends it', () => {
    const ev = lowerPlay({ play: PLAY }, { player: 'hero' });
    const uses = ev.sources.filter((s) => s.use);
    expect(uses).toEqual([
      { type: 'zone', zone: 'use-counter-front', at: [7, 1.2, 0], radius: 1.5, planar: true, watch: 'hero', use: 'counter-front', prompt: 'talk' },
      { type: 'zone', zone: 'use-cue-lever', at: [0, 4, 0], radius: 1, planar: true, watch: 'hero', use: 'cue-lever', prompt: 'pull' },
    ]);
    // a use naming no place is the event alone (a door's click)
    expect(ev.reactions).toContainEqual({ on: 'use-north-door', do: 'emit', type: 'cue:door' });
    // in the bus: standing there and pressing (the page's use-<place>) opens the keeper; walking off closes it
    const bus = createBusState(ev, []);
    const hero = { id: 'hero', transform: { pos: [7, 1, 0] } };
    let z = deriveZoneEvents([hero], null, ev.sources);
    const run = (evs) => { processEvents(bus, evs); for (let k = 0; k < 4; k++) { const w = watchEvents(bus); if (!w.length) break; processEvents(bus, w); } };
    run(z.events);
    expect(bus.vars[menuVar('keeper')]).toBe(0);   // standing in reach opens nothing by itself
    run([{ type: 'use-counter-front' }]);
    expect(bus.vars[menuVar('keeper')]).toBe(1);
    hero.transform.pos = [0, -5, 0];
    z = deriveZoneEvents([hero], z.prev, ev.sources);
    run(z.events);
    expect(bus.vars[menuVar('keeper')]).toBe(0);
  });
});

describe('the page', () => {
  it('carries the reach runtime only for a world with a usable place, and the menu overlay reads the menu scheme', async () => {
    const { eventsChannelScript } = await import('../../scene/channels/events.js');
    const ev = lowerPlay({ play: PLAY }, { player: 'hero' });
    const js = eventsChannelScript(ev);
    expect(js).toContain('__stepReach(z.events, incoming);');
    expect(js).toContain('window.__mojUses = true;');
    const keys = JSON.parse(/const __MKEYS = (\{.*?\});/.exec(js)[1]);
    expect([keys.ArrowUp, keys.KeyW, keys.KeyS, keys.Enter, keys.Space, keys.KeyE, keys.Escape]).toEqual(['up', 'up', 'down', 'accept', 'accept', 'accept', 'back']);
    const pad = JSON.parse(/const __MPAD = (\{.*?\});\n/.exec(js)[1]);
    // confirm sits where the pad's players expect it: the bottom on Xbox, A on the right of a Nintendo pad
    expect([pad.xbox.b[0], pad.xbox.b[1], pad.nintendo.b[1], pad.nintendo.b[0]]).toEqual(['accept', 'back', 'accept', 'back']);
    expect(pad.xbox.b[2]).toBe('accept');   // the pilot's interact (west) picks in the menu it opened
    const { cues, ...noUse } = PLAY;
    const plain = eventsChannelScript(lowerPlay({ play: { ...noUse, cues: [{ id: 'near', when: { near: 'x' }, then: { open: 'keeper' } }] } }, { player: 'hero' }));
    expect(plain).not.toContain('__stepReach');
    expect(plain).toContain('const __MKEYS');
  });

  it('the pilot runtime takes no input under a menu, counts interact presses, and keeps E from strafing in reach', async () => {
    const { controllableChannelScript } = await import('../../scene/channels/index.js');
    const js = controllableChannelScript([{ id: 'hero', rule: { type: 'walk' }, transform: { pos: [0, 0, 0] }, body: { type: 'none' } }], null, {});
    expect(js).toContain('if (window.__mojMenuOpen) {');
    expect(js).toContain('if (it && !__prevInteract) __interactN++;');
    expect(js).toContain("__BIND.bind.keyboard.interact");
    expect(js).toContain('interacts: () => __interactN');
  });
});

describe('the interact action', () => {
  const K = buildControlsKernel(), D = DEVICES;
  it('shares E with strafe only across contexts (reach), and the legend lists it where there is something to use', () => {
    const B = K.resolve(SCHEMES.pilot, D);
    expect(B.bind.keyboard.interact).toEqual(['KeyE']);
    expect(B.bind.keyboard.strafeRight).toEqual(['KeyE']);
    expect(K.conflicts(SCHEMES.pilot, B)).toEqual([]);
    expect(K.legend(SCHEMES.pilot, B, D, { interact: true }).pop()).toEqual(['E', 'use / talk']);
    expect(K.legend(SCHEMES.pilot, B, D, {}).some((r) => r[1] === 'use / talk')).toBe(false);
    const pad = K.legend(SCHEMES.pilot, B, D, { interact: true, active: { gamepad: true }, layout: 'playstation' });
    expect(pad.find((r) => r[1] === 'use / talk' && r[0] === '□')).toBeTruthy();
  });
});
