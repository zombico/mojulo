// A craft's drives on the page (craft-form.js `drives`, index.js __driveJet): a figure whose thrusters are of kind
// `drive` brings the drive's plume and its mouth's flare, burning by the entity's e.thrust; a page whose thrusters are
// the boost flames, or that has none, keeps every byte (no drive code).
import { describe, it, expect } from 'vitest';
import { controllableChannelScript } from './index.js';
import { b64 } from '../../emit-util.js';

const u8 = (n) => b64(new Uint8Array(n).fill(128)), f32 = (n) => b64(new Float32Array(n));
const part = { pos: f32(9), col: u8(9), faces: 1, q: 'x', idx: 'x' };
const fig = (thrusters) => ({ rig: true, bones: [{ id: 'drive', head: [0, -2, 1], tail: [0, -2.5, 1] }], parts: [part], clips: {}, ...(thrusters ? { thrusters } : {}) });
const craft = { id: 'p', pilotable: true, rule: { type: 'starfighter' }, body: { type: 'figure-rig', figure: 'craft' }, transform: { pos: [0, 0, 0], heading: 0 } };
const drive = { bone: 'drive', local: [0, -2.4, 1], dir: [0, -1, 0], size: 0.4, half: [0.4, 0.4], len: 2.8, kind: 'drive', color: '#ff2a1a' };
const boost = { bone: 'drive', local: [0, -2.4, 1], dir: [0, 0, -1], size: 0.2, kind: 'backpack' };

describe('a craft\'s drives on the page', () => {
  it('a drive brings its plume and its flare; boost flames and no thrusters carry none of it', () => {
    const s = controllableChannelScript([craft], null, { craft: fig([drive]) });
    expect(s).toContain('function __driveJet(');
    expect(s).toContain("if (j.kind === 'drive')");
    for (const other of [fig([boost]), fig(null)]) {
      const t = controllableChannelScript([craft], null, { craft: other });
      expect(t).not.toContain('__driveJet');
      expect(t).not.toContain("j.kind === 'drive'");
    }
  });

  it('an assault frame\'s thrust brings its layered fire, its depth written for a long view; a drive and none carry none of it', () => {
    const flame = { ...drive, kind: 'flame', role: 'main' };
    const s = controllableChannelScript([craft], null, { craft: fig([flame]) });
    expect(s).toContain('function __flameJet(');
    expect(s).toContain("if (j.kind === 'flame')");
    for (const layer of ['core', 'sheath', 'tail']) expect(s).toContain(`"${layer}"`);
    expect(s).toContain('logdepthbuf_fragment');
    for (const other of [fig([drive]), fig(null)]) {
      const t = controllableChannelScript([craft], null, { craft: other });
      expect(t).not.toContain('__flameJet');
      expect(t).not.toContain("j.kind === 'flame'");
    }
  });
});
