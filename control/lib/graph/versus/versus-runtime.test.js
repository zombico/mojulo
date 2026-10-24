import { describe, it, expect } from 'vitest';
import { versusSource, VERSUS_PAGE_MODULES } from './versus-page.js';
import { compileFighter } from './versus-compile.js';
import { solveFighter } from './versus-solver.js';

// the page's runtime (versus-runtime.client.js) is a classic script; it is loaded here the way the page inlines it,
// with a canvas that draws nothing, so its overlay clocks can be read against its steps

const src = [...VERSUS_PAGE_MODULES, 'versus-runtime.client.js'].map(versusSource).join('\n');
const load = () => new Function('window', 'navigator', `${src}\nRT.muted = true;\nreturn { newMatch, stepMatch, drawHud, drawEffects };`)({}, {});
// a 2D context that accepts every call and returns itself (a gradient, a measure)
const canvas = () => {
  const g = new Proxy(function () {}, { get: (_t, k) => (k === 'width' ? 0 : g), set: () => true, apply: () => g });
  return g;
};

describe('versus runtime: the overlay keeps the match\'s time, not the screen\'s', () => {
  const F = compileFighter(solveFighter({ id: 'kata', archetype: 'all-rounder' }).recipe);
  const watch = (drawsPerStep, steps) => {
    const R = load();
    const g = canvas();
    const m = R.newMatch({ fighters: [F, F], names: ['A', 'B'], colors: ['#e0503a', '#3a9be0'], schemes: ['modern', 'modern'], mode: 'watch', level: 1, rules: {}, seed: 5 });
    const seen = [];
    for (let k = 0; k < steps; k++) {
      R.stepMatch(m);
      for (let d = 0; d < drawsPerStep; d++) { R.drawEffects(g, m, () => [0, 0], 1); R.drawHud(g, 1280, 720, m); }
      seen.push([m.banner && m.banner.n > 0 ? `${m.banner.t}:${m.banner.n}` : '', m.flash && m.flash.n > 0 ? `${m.flash.text}:${m.flash.n}` : '', m.superFlash, m.sparks.length, Math.round(m.shake * 1000), Math.round(m.lag[0])]);
    }
    return seen;
  };

  it('a banner, a toast, the sparks, the shake and the trailing health last the same steps however often they are drawn', () => {
    const still = watch(0, 900);
    const fast = watch(5, 900);
    expect(fast).toEqual(still);
    // FIGHT! lasts its 40 steps, a frame of sim per step, not per picture
    const fight = still.filter(([b]) => b.startsWith('FIGHT!')).length;
    expect(fight).toBe(40);
    expect(still.some(([, , , sparks]) => sparks > 0)).toBe(true);
  });
});

describe('versus runtime: the bodies move, they never pop', () => {
  const F = compileFighter(solveFighter({ id: 'kata', archetype: 'all-rounder' }).recipe);
  const loadPoses = () => new Function('window', 'navigator', `${src}\nRT.muted = true;\nreturn { newMatch, stepMatch, drawnPose, poseOf, rigJoints };`)({}, {});
  it('every state change eases in from the body drawn before it: no joint jumps in a step (a move moves at its own speed)', () => {
    const R = loadPoses();
    const m = R.newMatch({ fighters: [F, F], names: ['A', 'B'], colors: ['#e0503a', '#3a9be0'], schemes: ['modern', 'modern'], mode: 'watch', level: 3, rules: {}, seed: 7 });
    let worst = 0, raw = 0, prev = null, reactions = 0, rounds = 0;
    for (let k = 0; k < 4000; k++) {
      const was = m.s.p.map((p) => !!p.mv), round = m.s.round;
      R.stepMatch(m);
      const now = [0, 1].map((i) => ({ drawn: R.drawnPose(m, i).J, bare: R.rigJoints(F.body, R.poseOf(m.s.p[i], F, m.t + i * 40, m.s.rules)), mv: !!m.s.p[i].mv }));
      if (prev && round === m.s.round) for (let i = 0; i < 2; i++) {   // (a new round is a cut, drawn as it stands)
        if (now[i].mv || was[i]) continue;   // a move's frames are its frame data
        for (const j of Object.keys(now[i].drawn)) {
          worst = Math.max(worst, Math.hypot(now[i].drawn[j][0] - prev[i].drawn[j][0], now[i].drawn[j][1] - prev[i].drawn[j][1]));
          raw = Math.max(raw, Math.hypot(now[i].bare[j][0] - prev[i].bare[j][0], now[i].bare[j][1] - prev[i].bare[j][1]));
        }
      }
      if (m.s.p.some((p) => p.rx)) reactions++;
      rounds = m.s.round;
      prev = now;
    }
    expect(reactions).toBeGreaterThan(0);
    // the state's own poses jump (a hit landing, a body meeting the floor); drawn, they travel
    expect(raw).toBeGreaterThan(worst * 1.5);
    // (a heavy blow still flings an arm fast: the impact is struck at once and held through the freeze)
    expect(worst).toBeLessThan(F.body.height * 0.3);
    expect(rounds).toBeGreaterThan(1);
  });
});

describe('versus runtime: the swing trail in a fight kind\'s look', () => {
  const F = compileFighter(solveFighter({ id: 'kata', archetype: 'all-rounder', weapon: 'katana' }).recipe);
  const watch = (look, steps = 600) => {
    const R = load(), g = canvas();
    const m = R.newMatch({ fighters: [F, F], names: ['A', 'B'], colors: ['#e0503a', '#3a9be0'], schemes: ['modern', 'modern'], mode: 'watch', level: 1, rules: {}, seed: 5, ...(look ? { look } : {}) });
    const at = [];
    for (let k = 0; k < steps; k++) { R.stepMatch(m); R.drawEffects(g, m, () => [0, 0], 1); if (m.trails) for (const tr of m.trails) if (tr[0] && tr[0].at === m.t) at.push(m.t); }
    return { m, at };
  };
  it('no look: no trail kept; a look keeps one while a blade sweeps, the cel look on twos', () => {
    expect('trails' in watch(null, 120).m).toBe(false);
    const cel = watch('cel'), glow = watch('isekai');
    expect(cel.at.length).toBeGreaterThan(0); expect(glow.at.length).toBeGreaterThan(0);
    expect(cel.at.every((t) => t % 2 === 0)).toBe(true);
    expect(glow.at.some((t) => t % 2 === 1)).toBe(true);
  });
});

// the players' controls come through the controls kernel (controls/schemes.js `versus`): each player's own keys, and
// each player's own pad, kept by its Gamepad.index so a pad that leaves never hands its player's place to the other
describe('versus runtime: each player reads their own keys and their own pad', () => {
  const pad = (index, pressed = [], axes = [0, 0, 0, 0]) => ({ index, connected: true, id: 'Xbox pad', axes, buttons: Array.from({ length: 17 }, (_, b) => ({ pressed: pressed.includes(b), value: pressed.includes(b) ? 1 : 0 })) });
  const boot = (pads) => {
    const nav = { getGamepads: () => pads.list };
    return new Function('window', 'navigator', `${src}\nRT.muted = true;\nreturn { rawInput, RT, BTN };`)({}, nav);
  };
  it('player one the left hand\'s keys, player two the arrows and the numpad; a pad its D-pad, stick and five buttons', () => {
    const pads = { list: [] }, R = boot(pads);
    R.RT.held.add('KeyA'); R.RT.held.add('KeyJ'); R.RT.held.add('ArrowUp'); R.RT.held.add('Numpad4');
    expect(R.rawInput(0)).toEqual({ x: -1, y: 0, b: R.BTN.L, start: false, back: false });
    expect(R.rawInput(1)).toEqual({ x: 0, y: 1, b: R.BTN.S, start: false, back: false });
    R.RT.held.clear();
    pads.list = [pad(0, [2, 4, 9], [0.8, 0.9, 0, 0])];   // X (medium), LB (throw), start; the stick right and down
    expect(R.rawInput(0)).toEqual({ x: 1, y: -1, b: R.BTN.M | R.BTN.T, start: true, back: false });
    expect(R.rawInput(1)).toEqual({ x: 0, y: 0, b: 0, start: false, back: false });
  });
  it('a pad keeps its player when the other pad leaves', () => {
    const pads = { list: [pad(0), pad(1, [3])] }, R = boot(pads);
    expect(R.rawInput(1).b).toBe(R.BTN.H);
    pads.list = [null, pad(1, [3])];   // player one's pad unplugged
    expect(R.rawInput(0).b).toBe(0);
    expect(R.rawInput(1).b).toBe(R.BTN.H);
  });
});
