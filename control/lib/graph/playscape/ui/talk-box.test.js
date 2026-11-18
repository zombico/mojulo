import { describe, it, expect } from 'vitest';
import { manaUi } from '../../../mana-ui/index.js';
import { talkSpec, talkState, TALK_GLYPHS } from './talk-box.js';
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
});
