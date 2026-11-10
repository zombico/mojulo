// The brawl yard's cast rig: under a register its bodies (and its guns, its props) are drawn under the cast rig, as a
// fight's are (versus/versus-cast.js), the kit riding the yard's channel; a yard with no register carries neither.
import { describe, it, expect } from 'vitest';
import { brawlYardData } from './brawl-page.js';
import { brawlLevel } from './brawl-levels.js';
import { brawlChannelScript } from '../scene/channels/brawl.js';
import { fightCast } from '../versus/versus-cast.js';

const yard = (register) => brawlYardData(brawlLevel({ kind: 'greybox', preset: 'yard' }, { ...(register ? { register } : {}), practice: { dummies: [{ mode: 'stand' }] } }).brawl);

describe('the brawl yard\'s cast rig', () => {
  it('rides the yard\'s channel with the kit under a register, and adds nothing to a yard without one', () => {
    const plain = brawlChannelScript(yard());
    expect(plain).not.toContain('const castKit =');
    expect(plain).not.toContain('"cast":{"register"');
    const cel = brawlChannelScript(yard('anime'));
    expect(cel).toContain('const castKit =');
    expect(cel).toContain(`"cast":${JSON.stringify(fightCast('anime'))}`);
    // (a yard that carries its own rig keeps it)
    const own = { ...fightCast('western'), key: { ...fightCast('western').key, gain: 2 } };
    expect(brawlChannelScript({ ...yard('western'), cast: own })).toContain('"gain":2');
  });

  it('the yard\'s rig is one key: its sky and its rim are the bodies\' own, laid on every material it makes', () => {
    const js = brawlChannelScript(yard('western')), rig = js.slice(js.indexOf('function yardRig('), js.indexOf('const RIG = '));
    expect(rig).not.toContain('HemisphereLight');
    expect(rig.match(/new THREE\.DirectionalLight/g).length).toBe(1);
    expect(rig).toContain('castKit.patch(');
    expect(rig).toContain('castKit.ramp(');
  });
});
