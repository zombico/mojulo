// THE JOURNAL ON MANA-UI: a level with a mana HUD draws its quests' journal and words through the game UI runtime (its
// quest-log screen, its quest toasts); one without draws them as it did, byte for byte; the errand's legs set the flags.
import { execFileSync } from 'node:child_process';
import { describe, it, expect } from 'vitest';
import { questScript, questManaSpec } from './quest-channel.js';
import { manaUi } from '../../../mana-ui/kernel.js';
import { lowerTrade, lowerDeliver } from '../../game/errand-mechanics.js';

const parses = (src) => { try { execFileSync(process.execPath, ['--input-type=module', '--check'], { input: `const EVENTS = { quests: [] }, __busState = { vars: {}, log: [] };\n${src}`, stdio: ['pipe', 'pipe', 'pipe'] }); return null; } catch (e) { return String(e.stderr || e.message).slice(0, 400); } };

describe('the journal on mana-ui', () => {
  it('is a spec the runtime reads: the quest log a screen, the quest toasts on the HUD', () => {
    const spec = questManaSpec();
    expect(() => manaUi.readSpec(spec)).not.toThrow();
    expect(spec.screens.journal.use).toBe('quest-log');
    expect(spec.hud.children[0].use).toBe('quest-toasts');
  });
  it('the page\'s script hosts it where it is asked for, and parses; unasked, the journal is as it was', () => {
    const mana = questScript({ mana: 'console' }), plain = questScript();
    for (const s of ['__mojQuests', 'quest-log', 'quest-toasts', '__stepQuests', 'KeyJ']) expect(mana).toContain(s);
    expect(parses(mana)).toBe(null);
    expect(plain).toBe(questScript({}));
    expect(plain).not.toContain('quest-log');
    expect(plain).toContain('moj-quest-book');
    expect(parses(plain)).toBe(null);
  });
  it('a leg with a flag sets it when it is done, and one without says nothing', () => {
    const ctx = { i: 0, player: 'hero', resolve: () => {} };
    const flags = (L) => L.world.reactions.filter((r) => r.do === 'emit' && String(r.type).startsWith('flag:')).map((r) => r.type);
    expect(flags(lowerTrade({ item: 'fee', at: [0, 0, 0], flag: 'had-fee' }, ctx))).toEqual(['flag:had-fee']);
    expect(flags(lowerDeliver({ id: 'parcel', at: [0, 0, 0], wants: [{ item: 'fee' }], flag: 'done-parcel' }, ctx))).toEqual(['flag:done-parcel']);
    expect(flags(lowerTrade({ item: 'fee', at: [0, 0, 0] }, ctx))).toEqual([]);
    expect(flags(lowerDeliver({ id: 'parcel', at: [0, 0, 0], wants: [{ item: 'fee' }] }, ctx))).toEqual([]);
  });
});

describe('the offer (where a job is taken)', () => {
  it('sets the job\'s flag once and says the giver\'s words; a leg after it is had only once it is set', async () => {
    const { lowerOffer } = await import('../../game/errand-mechanics.js');
    const ctx = { i: 0, player: 'hero', resolve: () => {} };
    const O = lowerOffer({ id: 'parcel', at: [1, 2, 0], flag: 'took-parcel', says: 'Be quick.', radius: 7 }, ctx);
    expect(O.world.sources[0]).toMatchObject({ zone: 'offer-parcel', radius: 7, watch: 'hero' });
    expect(O.world.vars).toEqual({ 'flag-took-parcel': 0 });
    expect(O.world.reactions[0]).toMatchObject({ on: 'enter', if: { var: 'flag-took-parcel', eq: 0 }, type: 'offer:parcel' });
    expect(O.world.reactions.map((r) => r.type ?? r.var)).toEqual(['offer:parcel', 'flag-took-parcel', 'flag:took-parcel']);
    expect(O.world.hud[0]).toMatchObject({ on: 'offer:parcel', text: 'Be quick.' });
    expect(() => lowerOffer({ id: 'parcel', at: [1, 2, 0] }, ctx)).toThrow(/flag is the flag/);
    const gated = lowerTrade({ item: 'fee', at: [0, 0, 0], after: 'took-parcel' }, ctx), open = lowerTrade({ item: 'fee', at: [0, 0, 0] }, ctx);
    expect(gated.world.reactions[0]).toMatchObject({ on: 'enter', if: { var: 'flag-took-parcel', gte: 1 } });
    expect(open.world.reactions[0].if).toBeUndefined();
  });
});
