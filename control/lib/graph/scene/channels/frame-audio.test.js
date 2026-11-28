// THE FRAME'S FIELD, HEARD (frame-audio.js): every sound but the pilot's own by where it is (FRAME_EAR: full near the
// pilot, falling away with distance, silent far off), and the field's effects at FRAME_EAR.mix of their level. Run on a
// stub page: the layer reads the world each frame and plays its cues through the engine's __beatsCue.
import { describe, expect, it } from 'vitest';
import { frameAudioScript, FRAME_EAR } from './frame-audio.js';

function field(at) {
  let frame = null;
  const played = [];
  const P = { id: 'p', pilotable: true, rule: { type: 'none' }, transform: { pos: [0, 0, 0] } };
  const gnats = at.map((x, i) => ({ id: `g${i}`, body: { figure: 'unit-gnat', hp: 5 }, transform: { pos: [x, 0, 0] }, weapon: { shots: 0 } }));
  const W = { time: 0, pilotId: 'p', byId: Object.fromEntries([P, ...gnats].map((e) => [e.id, e])), entities: [P, ...gnats], projectiles: [], bursts: [] };
  const win = { __mojCtrl: { world: W }, addEventListener() {} };
  const AUDIO = { frame: { units: { gnat: { shot: 'u-shot' } }, world: {}, cockpit: {}, parts: {} }, cues: { 'u-shot': [{ g: 1 }] } };
  new Function('window', 'requestAnimationFrame', '__AUDIO', '__beatsCue', '__beatsEng', '__beatsCtx', '__beatsMuted', '__beatsUnlock', '__listenerPos', frameAudioScript())(
    win, (f) => { frame = f; }, AUDIO, (spec, g) => played.push(g), {}, { currentTime: 0 }, false, () => {}, () => P.transform.pos);
  const step = () => { W.time += 0.1; const f = frame; frame = null; f(); };
  return { gnats, played, step };
}

describe('the frame\'s field, heard', () => {
  it('a unit\'s round is heard by its distance from the pilot: full near, fainter off, nothing far, all at the field\'s mix', () => {
    const F = field([20, 300, FRAME_EAR.far + 50]);
    F.step();
    for (const g of F.gnats) g.weapon.shots = 1;
    F.step();
    expect(F.played).toHaveLength(2);                                    // (the far one not played at all)
    const [near, off] = F.played;
    expect(near).toBeCloseTo(FRAME_EAR.mix, 6);
    expect(off).toBeLessThan(near * 0.15);
    expect(off).toBeGreaterThan(0);
  });
});
