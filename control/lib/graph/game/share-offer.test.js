import { describe, it, expect } from 'vitest';
import { shareOffer, shareBrief } from './share-offer.js';
import { hostHandoff } from '../../mcp/hosts/registry.js';

// The offer on each shipped host profile: what a finished game can become HERE, and what degrades to the recipe.
const offer = (host, surface = null, engine = 'shell') => shareOffer({ ref: 'sk_g', engine, table: hostHandoff(host), surface });
const opt = (o, id) => o.options.find((x) => x.id === id);

describe('share offer — by what the host can do', () => {
  it('on the operator\'s machine everything is here, nothing has to travel', () => {
    const o = offer('claude-code', 'local');
    expect(o.options.map((x) => x.id)).toEqual(['play', 'desktop', 'web', 'godot']);
    for (const x of o.options) expect(x.local.can, x.id).toBe('here');
    expect(opt(o, 'desktop').call).toBe("export_game({ ref: \"sk_g\", target: 'desktop' })");
    expect(o.note).toBeUndefined();
    expect(o.ask).toMatch(/ask the operator .*never export unasked/);
    expect(o.floor.recipe).toBe('recipe/');
  });

  it('in a git box the folders are carried by the branch, the dashboard is not reachable, and the box is reclaimed', () => {
    const o = offer('claude-code', 'box');
    expect(opt(o, 'play').box.can).toBe('no');
    for (const id of ['desktop', 'web', 'godot']) expect(opt(o, id).box.can, id).toBe('carry');
    expect(opt(o, 'desktop').box.how).toMatch(/branch.*npm install && npm start there/);
    expect(o.note).toMatch(/reclaimed when the session ends/);
    expect(offer('codex', 'box').options.find((x) => x.id === 'web').box.can).toBe('carry');
  });

  it('a surface the agent has not said gets both rows', () => {
    const o = offer('claude-code');
    expect(opt(o, 'desktop')).toMatchObject({ local: { can: 'here' }, box: { can: 'carry' } });
    expect(o.note).toMatch(/surface is not known/);
    expect(shareBrief(o).desktop).toEqual({ local: 'here', box: 'carry' });
  });

  it('a file-card box cannot carry a folder: the folder options say so and point at the recipe; one page still travels', () => {
    const o = offer('grok-chat');
    for (const id of ['desktop', 'web', 'godot']) {
      expect(opt(o, id).box.can, id).toBe('no');
      expect(opt(o, id).box.how, id).toMatch(/single files.*hand over the recipe/);
    }
    const p = offer('grok-chat', null, 'pixelizer');
    expect(opt(p, 'page').box).toMatchObject({ can: 'carry', how: expect.stringMatching(/file card/) });
    expect(p.floor.recipe).toBe('recipe/game.json');
  });

  it('a drop-folder host that shows only pages: no folder, a git push only if the box can, a pixelizer page lands', () => {
    const o = offer('muse');
    expect(opt(o, 'desktop').box).toMatchObject({ can: 'no', how: expect.stringMatching(/only \.html files/) });
    expect(opt(o, 'web').box).toMatchObject({ can: 'ask', how: expect.stringMatching(/reaches the internet/) });
    expect(o.note).toBeUndefined();   // Muse's VM is not reclaimed
    expect(opt(offer('muse', null, 'pixelizer'), 'page').box).toMatchObject({ can: 'carry', how: expect.stringMatching(/^save game.html as one page with your Artifacts tool/) });
  });

  it('a host whose file door is a session transfer asks; an unknown host gets the options and no verdicts', () => {
    expect(opt(offer('chatgpt', 'local'), 'desktop').local.can).toBe('ask');
    const u = shareOffer({ ref: 'sk_g', table: null });
    expect(u.options.every((x) => !x.local && !x.box)).toBe(true);
    expect(u.note).toMatch(/not in mojulo's registry/);
    expect(shareBrief(u)).toEqual({ play: 'ask', desktop: 'ask', web: 'ask', godot: 'ask' });
  });

  it('is pure', () => {
    expect(offer('muse')).toEqual(offer('muse'));
  });
});
