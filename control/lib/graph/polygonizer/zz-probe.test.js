import { it } from 'vitest'; import { appendFileSync } from 'node:fs'; const log = (...a) => appendFileSync('/tmp/claude-0/-home-user-mojulo/40b2dde6-a55d-5372-b5cc-0305cf485ecf/scratchpad/probe.txt', a.map(x => typeof x === 'string' ? x : JSON.stringify(x)).join(' ') + '\n');
import { heroRecord, expandLayeredManifest } from '../../mcp/tools/layered.js';
import { compileLayered } from './station-loft.js';
import { outlineMeasures, outlineCritic } from './dress-outline.js';
for (const [cast, outfit] of [['male', { type: 'outfit', style: 'business' }], ['female', { type: 'outfit', style: 'sundress' }], ['male', { type: 'outfit', style: 'casual' }]]) for (const form of [undefined, 'realistic']) it(`probe ${cast} ${outfit.style} ${form}`, { timeout: 300000 }, () => {
  const m = expandLayeredManifest({ kind: 'layered', hero: heroRecord({ cast, outfit, ...(form ? { form } : {}) }) });
  const mesh = compileLayered(m.recipe, m.dials);
  try { const M = outlineMeasures(mesh, m.recipe); const C = outlineCritic(M, 'western', { sex: cast });
    log(cast, outfit.style, form ?? 'authored', 'family', M.family, 'bare', M.bareFamily, 'fit', M.fit.top.class, M.fit.bottom.class, 'ratios', JSON.stringify(M.ratios), 'returns', JSON.stringify(M.returns), 'div', M.divisions.map((d) => `${d.kind}@${d.f}`).join(' '), 'advice', C.advice.length, JSON.stringify(C.advice).slice(0, 300));
    log('   at', JSON.stringify(Object.fromEntries(Object.entries(M.at).map(([k, v]) => [k, [v.f, v.W, v.B]]))));
  } catch (e) { log(cast, outfit.style, form ?? 'authored', 'THREW', e.message.slice(0, 300), e.stack.split('\n')[1]); }
});
