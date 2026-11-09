/**
 * sfx-shelf/register — the realistic register's floor: what every realistic one-shot reaches. A family's every dial
 * point is held to it (families.deep.test.js), its defaults in the regular tier, and every set that voices the style
 * meets it too (families.laws.test.js, from the stored baseline).
 *
 *   layers   it stacks at least 4 gestures: a transient, a body, a low end, grit, a tail, as it needs
 *   heard    it fills at least 1.31 of the 4 bands, as the ear weighs them (measure.js `heard`)
 *   crestDb  at least 8 dB of punch over its body, unless it swells rather than strikes (a gust, a whistle, a horn)
 */
export const REGISTER = Object.freeze({ layers: 4, heard: 1.31, crestDb: 8 });

/** What a sound lacks of the register, as readable lines (none: it is in it). */
export function meetsRegister(m, { swell = false } = {}) {
  const off = [];
  if (m.layers < REGISTER.layers) off.push(`layers ${m.layers} < ${REGISTER.layers}`);
  if (m.heard < REGISTER.heard) off.push(`heard spread ${m.heard} < ${REGISTER.heard}`);
  if (!swell && m.crestDb < REGISTER.crestDb) off.push(`crest ${m.crestDb} dB < ${REGISTER.crestDb}`);
  return off;
}

/**
 * The held law: what a held voice (families/held.js) must do along its lane (measure.js renderHeld), as readable
 * lines (none: it does). Louder at full than at a
 * half by 2 dB and more, and at a half than idle; no darker at full than at a half; silent at idle and gone after it is
 * let go when it idles silent, running at idle when it idles running; at full it fills as many bands as the register.
 */
export function meetsHeld(m, F) {
  const off = [];
  if (!(m.full.rmsDb > m.half.rmsDb + 2)) off.push(`full ${m.full.rmsDb} dB not 2 dB over half ${m.half.rmsDb}`);
  if (!(m.half.rmsDb > m.idle.rmsDb)) off.push(`half ${m.half.rmsDb} dB not over idle ${m.idle.rmsDb}`);
  if (m.full.centroidHz < m.half.centroidHz * 0.97) off.push(`darker at full (${m.full.centroidHz} Hz) than at half (${m.half.centroidHz})`);
  if (F.idle === 'silent' && (m.idle.rmsDb > -90 || m.gone.rmsDb > -90)) off.push(`idles silent, but idle ${m.idle.rmsDb} dB, let go ${m.gone.rmsDb} dB`);
  if (F.idle === 'running' && m.idle.rmsDb < -60) off.push(`idles running, but idle is ${m.idle.rmsDb} dB`);
  if (m.heard < REGISTER.heard) off.push(`full heard spread ${m.heard} < ${REGISTER.heard}`);
  return off;
}
