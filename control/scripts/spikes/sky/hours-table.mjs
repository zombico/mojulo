#!/usr/bin/env node
/** SPIKE: a cube's light through the day (era/geocube-hours.js), as a table. cd control && node scripts/spikes/sky/hours-table.mjs */
import { register } from 'node:module';
register('../../mcp-stdio-loader.mjs', import.meta.url);
const { readGeocube } = await import('../../../lib/graph/era/geocube.js');
const { hourLight } = await import('../../../lib/graph/era/geocube-hours.js');
for (const id of process.argv.slice(2).length ? process.argv.slice(2) : ['limestone-crags', 'jungle-haze', 'gothic-night']) {
  const c = readGeocube(id);
  console.log(id, c.light.reference);
  for (const h of [0, 5, 6, 7, 9, 12, 15, 17.5, 18.5, 19, 20, 23]) { const L = hourLight(c, h); console.log(String(h).padStart(5), L.s.toFixed(2).padStart(5), L.moonlit ? 'moon' : 'sun ', `${L.key.color} el ${L.key.elevation} az ${L.key.azimuth}`.padEnd(30), L.gainK, L.ambient, L.dome.zenith.join(','), L.dome.horizon.join(','), L.fog, L.water ?? ''); }
}
