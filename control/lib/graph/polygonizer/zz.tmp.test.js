import { it } from 'vitest';
import { writeFileSync } from 'node:fs';
import { heroRecord, expandLayeredManifest } from '../../mcp/tools/layered.js';
it('hair', () => {
  const out = {};
  for (const [k, spec] of Object.entries({ rel: { cast: 'male', form: 'realistic', head: 'relational', physique: 'athletic', hair: 'swept' }, dflt: { cast: 'male', form: 'realistic', physique: 'athletic', hair: 'swept' } })) {
    const h = heroRecord(spec); const R = expandLayeredManifest({ kind: 'layered', hero: h });
    out[k] = { head: h.head, laws: h.laws, physique: h.physique, parts: Object.keys(R.recipe.parts).filter((p) => /hair|lock|brow|lash|scalp|head/i.test(p)), strands: Object.keys(R.recipe).filter((x) => /strand|lock|hair/i.test(x)) };
  }
  writeFileSync('/tmp/claude-0/-home-user-mojulo/9bd3cceb-b584-5c7b-9dfb-d2653d67e061/scratchpad/hairparts.json', JSON.stringify(out, null, 1));
}, 900000);
