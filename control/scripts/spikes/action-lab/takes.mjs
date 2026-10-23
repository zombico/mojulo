// The takes moved to lib (lib/graph/gameworld/feel/takes.js); the lab's scripts keep this path. The loader first: the
// hero library reaches modules through the app's `@/` paths.
import { register } from 'node:module';
register('../../mcp-stdio-loader.mjs', import.meta.url);
const T = await import('../../../lib/graph/gameworld/feel/takes.js');
export const { rigOf, cyclesOf, bodyOf, fitMove, bake } = T;
