// A fight's cast rig (versus-cast.js): a fight game's bodies are drawn under the cast rig's card in the game's register,
// the kit that lays it on them riding the fight's channel; an arena made before the register carries neither.
import { describe, it, expect } from 'vitest';
import { fightCast } from './versus-cast.js';
import { versusArenaData } from './versus-page.js';
import { versusChannelScript } from '../scene/channels/versus.js';
import { castRig, CAST_REGISTERS } from '../color-theorist/cast-rig.js';
import { castRigInput } from '../scene/channels/cast-rig.js';

const ROSTER = [{ id: 'a', archetype: 'all-rounder' }];

describe('a fight\'s cast rig', () => {
  it('is the card in the game\'s register, as a page carries it; no register, no rig', () => {
    for (const reg of CAST_REGISTERS) expect(fightCast(reg)).toEqual(castRigInput(castRig(null, { register: reg })));
    expect(fightCast('anime').bands).toBeDefined();
    expect(fightCast(undefined)).toBeNull();
    expect(fightCast(null)).toBeNull();
  });

  it('rides the fight\'s channel with the kit under a register, and adds nothing to an arena without one', () => {
    const plain = versusChannelScript(versusArenaData({ roster: ROSTER }));
    expect(plain).not.toContain('const castKit =');
    expect(plain).not.toContain('"cast":{"register"');
    // (the arena as the world's resolver hands it: its register's card with it)
    const lit = versusChannelScript({ ...versusArenaData({ roster: ROSTER, register: 'western' }), cast: fightCast('western') });
    expect(lit).toContain('const castKit =');
    expect(lit).toContain(`"cast":${JSON.stringify(fightCast('western'))}`);
    // (an arena that carries its own rig keeps it)
    const own = { ...fightCast('western'), rim: { ...fightCast('western').rim, strength: 0.9 } };
    expect(versusChannelScript({ ...versusArenaData({ roster: ROSTER, register: 'western' }), cast: own })).toContain('"strength":0.9');
    // (the rig's lights but the key are gone from the fight: its sky and its rim are the bodies' own)
    const rig = lit.slice(lit.indexOf('function fightRig('), lit.indexOf('function bodyCoat('));
    expect(rig).not.toContain('HemisphereLight');
    expect(rig.match(/new THREE\.DirectionalLight/g).length).toBe(1);
    expect(rig).toContain('castKit.patch(');
  });
});
