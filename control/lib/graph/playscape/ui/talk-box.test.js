import { describe, it, expect } from 'vitest';
import { manaUi } from '../../../mana-ui/index.js';
import { talkSpec, talkState, TALK_GLYPHS, readSpeakers } from './talk-box.js';
import { faceFrame, buildTalkFace, FACE_FOV } from '../../scene/channels/talk-face.js';
import { buildSceneRunner } from './scene-runner.js';
import { manaHudScript } from '../../scene/channels/mana-hud.js';

// The talk box: the scene runner's view lowered to mana-ui's talk presenter, drawn in the HUD's look. One case per
// state the box can be in (nothing said, a line typing, a line whole, a choice, a stage that cannot be skipped), the
// runner itself driving it, and the host carrying it only on a page with scenes.

const draw = (talk) => {
  const rt = manaUi.runtime(talkSpec(), { read: (p) => manaUi.readPath({ talk }, p), act: () => {} });
  rt.glyphs(TALK_GLYPHS);
  return rt.view();
};
const line = { id: 'gate', when: { start: true }, once: true, beats: [{ kind: 'line', who: 'mayor', name: 'Mayor', text: 'The road is shut.' }, { kind: 'choose', ask: null, options: [{ text: 'Since when?', fire: [], beats: [] }, { text: 'Then I climb.', fire: [], beats: [] }] }] };

describe('the talk box: the scene runner said through mana-ui', () => {
  it('reads as a spec, and draws nothing while nothing is said', () => {
    expect(() => manaUi.readSpec(talkSpec())).not.toThrow();
    expect(talkState(null)).toMatchObject({ show: false, choices: [], legend: [] });
    expect(draw(talkState(null))).not.toContain('mana-window');
  });

  it('a line: the nameplate, the words typed so far, ▼ only once they are whole, the legend in the keys', () => {
    const R = buildSceneRunner(), S = R.create([line]);
    R.hear(S, ['scene:gate']); R.step(S, 0, {});
    R.step(S, 0.1, {});   // four characters typed on
    const typing = talkState(R.view(S));
    expect(typing).toMatchObject({ show: true, who: 'Mayor', text: 'The ', more: false });
    const h = draw(typing);
    expect(h).toContain('<h3 class="mana-heading">Mayor</h3>');
    expect(h).not.toContain('▼');
    R.step(S, 0, { next: true });   // a press shows it whole
    const whole = talkState(R.view(S));
    expect(whole).toMatchObject({ text: 'The road is shut.', more: true });
    const w = draw(whole);
    expect(w).toContain('▼');
    expect(w).toMatch(/mana-key">Space<\/span><span>Next/);
    expect(w).toMatch(/mana-key">Esc<\/span><span>Skip/);
    // a stage that cannot be skipped offers no skip
    expect(talkState(R.view(S), { noSkip: true }).legend.map((r) => r.label)).toEqual(['Next']);
  });

  it('a choice: its answers numbered, the one in hand marked, moving and choosing in the legend, no ▼', () => {
    const R = buildSceneRunner(), S = R.create([line]);
    R.hear(S, ['scene:gate']); R.step(S, 0, {}); R.step(S, 0, { next: true }); R.step(S, 0, { next: true });
    R.step(S, 0, { move: 1 });
    const T = talkState(R.view(S));
    expect(T.choices).toEqual([{ n: '1', say: 'Since when?', mark: '▷' }, { n: '2', say: 'Then I climb.', mark: '▶' }]);
    expect(T.more).toBe(false);
    expect(T.legend.map((r) => r.label)).toEqual(['Move', 'Choose']);
    const h = draw(T);
    expect(h).toContain('Then I climb.');
    expect(h).not.toContain('▼');
  });

  it('the HUD host carries the talk box only on a page with scenes', () => {
    const hud = { spec: { hud: { use: 'hud', children: [] } } };
    const plain = manaHudScript(hud, {}), talk = manaHudScript(hud, { talk: true });
    expect(plain).not.toContain('moj-mana-talk');
    expect(talk).toContain('moj-mana-talk');
    expect(talk).toContain('.moj-scene-box,.moj-scene-hint{display:none!important}');
    expect(() => new Function(talk)).not.toThrow();
  });

  it('a speaker with a face: its place named for them; without, no place', () => {
    const R = buildSceneRunner(), S = R.create([line]);
    R.hear(S, ['scene:gate']); R.step(S, 0, {});
    expect(talkState(R.view(S)).face).toBe('');
    expect(talkState(R.view(S), { face: true }).face).toBe('Mayor');
    expect(draw(talkState(R.view(S), { face: true }))).toContain('mana-portrait');
    expect(draw(talkState(R.view(S)))).not.toContain('mana-portrait');
  });

  it('the speakers sheet: live by default, none the box alone; anything else teaches', () => {
    expect(readSpeakers({})).toEqual({});
    expect(readSpeakers({ speakers: { mayor: {}, hero: { portrait: 'none' } } })).toEqual({ mayor: { portrait: 'live' }, hero: { portrait: 'none' } });
    expect(() => readSpeakers({ speakers: { mayor: { portrait: 'drawn' } } })).toThrow(/live or none/);
    expect(() => readSpeakers({ speakers: { mayor: { side: 'left' } } })).toThrow(/not part of a speaker/);
    expect(() => readSpeakers({ speakers: [] })).toThrow(/how each speaker is shown/);
  });

  it('the portrait\'s camera: in front of the speaker, a little to their right, on the top of the body', () => {
    // a person 1.8 m tall facing +y: the camera stands on their +y side, on their right (+x, z up), at the head
    const F = faceFrame({ min: [-0.3, -0.2, 0], max: [0.3, 0.2, 1.8] }, Math.PI / 2, FACE_FOV);
    expect(F.at[1]).toBeGreaterThan(1);
    expect(F.at[0]).toBeGreaterThan(0);
    expect(F.look[2]).toBeGreaterThan(1.3);
    expect(F.look[2]).toBeLessThan(1.8);
    expect(Math.abs(F.at[2] - F.look[2])).toBeLessThan(0.2);
    // the page's portrait frames with the same lens
    expect(buildTalkFace.toString()).toContain(`FOV = ${FACE_FOV}`);
  });

  it('the host draws faces only when asked, with the sheet and the frame\'s pre-pass hook', () => {
    const hud = { spec: { hud: { use: 'hud', children: [] } } };
    const plain = manaHudScript(hud, { talk: true }), faced = manaHudScript(hud, { talk: { faces: true, speakers: { hero: { portrait: 'none' } } } });
    expect(plain).not.toContain('__mojTalkFace');
    expect(faced).toContain('window.__mojTalkFace = function');
    expect(faced).toContain('const SPK = {"hero":{"portrait":"none"}}');
    expect(() => new Function('THREE', 'renderer', 'scene', faced)).not.toThrow();
  });
});
