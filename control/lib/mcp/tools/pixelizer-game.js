/**
 * create_pixelizer_game — mint a self-contained 2D REDUCER game into the Arcade.
 *
 * The pixelizer register's answer to `create_game`: where create_game mints a
 * SHELL over world/level artifacts (typed store + completability-gated levels),
 * this mints a pure `step(state, action)` reducer game (brickster & kin) as a
 * tiny `kind:'game'` sketch whose manifest is a RECIPE (engine:'pixelizer',
 * reducer, presentation facts). That single row joins the `game` bucket, so the
 * game lands on the Maker gallery + the Mojulo Arcade (/arcade) and plays at
 * /api/sketches/<ref>/game (the pixelizer branch serves the shell). Recipes,
 * not renders — the HTML is regenerated per request. No world/store/audit gate:
 * a reducer game has no levels to prove completable.
 *
 * The manifest builder + the registry of which reducers have a served shell
 * live in lib/graph/pixelizer/pixelizer-games.js (shared with the route + the
 * bootstrap seed). Adding a reducer there makes it mintable here for free.
 */

import { registerTool } from '@/lib/mcp/server';
import { SketchRepository } from '@/lib/db/repositories/sketches';
import { GameProjectRepository, GameProjectMemberRepository } from '@/lib/db/repositories/game-projects';
import { PIXELIZER_REDUCER_IDS, buildPixelizerGameManifest } from '@/lib/graph/pixelizer/pixelizer-games';

export async function createPixelizerGameHandler(input) {
  const { reducer, title, tagline, theme, music, register, ref, project_ref: projectRef } =
    input && typeof input === 'object' ? input : {};

  if (!reducer || !PIXELIZER_REDUCER_IDS.includes(reducer)) {
    throw new Error(`\`reducer\` must be one of: ${PIXELIZER_REDUCER_IDS.join(', ')}`);
  }
  if (ref !== undefined && (typeof ref !== 'string' || !/^[A-Za-z0-9_-]{1,64}$/.test(ref))) {
    throw new Error('`ref` must be 1-64 chars of [A-Za-z0-9_-] if provided');
  }
  // Project claim validated before the mint so a typo'd gp_ ref fails cheap.
  if (projectRef !== undefined && projectRef !== null) {
    if (typeof projectRef !== 'string' || !projectRef) throw new Error('`project_ref` must be a non-empty gp_ ref if provided');
    if (!GameProjectRepository.getByRef(projectRef)) {
      throw new Error(`Game project '${projectRef}' not found — create_game_project first, or list_game_projects to find it`);
    }
  }

  const manifest = buildPixelizerGameManifest({ reducer, title, tagline, theme, music, register });
  const sketch = SketchRepository.create({ title: manifest.title, manifest, ref });

  let project = null;
  if (projectRef) {
    GameProjectMemberRepository.bind({ projectRef, memberRef: sketch.ref, role: 'rules' });
    project = { ref: projectRef, url: `/games/${encodeURIComponent(projectRef)}` };
  }

  return {
    ok: true,
    ref: sketch.ref,
    reducer,
    url: `/sketches/${encodeURIComponent(sketch.ref)}`,
    playUrl: `/api/sketches/${encodeURIComponent(sketch.ref)}/game`,
    arcadeUrl: `/arcade/${encodeURIComponent(sketch.ref)}`,
    ...(project ? { project } : {}),
  };
}

export function registerPixelizerGameTools() {
  registerTool({
    name: 'create_pixelizer_game',
    description:
      'Mint a self-contained 2D REDUCER game into the Arcade — the pixelizer register beside '
      + "`create_game`'s world/level games. A pure step(state,action) reducer + skin (brickster & kin), "
      + "landed as a `kind:'game'` sketch so it joins the Arcade (`/arcade`) + Maker gallery and plays at "
      + '`/api/sketches/<ref>/game`. No world / store / completability gate. Pass `reducer` (a built reducer: '
      + PIXELIZER_REDUCER_IDS.join(' / ')
      + ') + optional title/tagline/theme/music/register; `project_ref` binds it to a game project. Reach for '
      + '"add brickster to the arcade", "mint the falling-blocks game".',
    inputSchema: {
      type: 'object',
      properties: {
        reducer: { type: 'string', enum: PIXELIZER_REDUCER_IDS, description: `Which built pixelizer reducer to mint (${PIXELIZER_REDUCER_IDS.join(', ')}).` },
        title: { type: 'string', description: "Optional; defaults to the reducer's name." },
        tagline: { type: 'string', description: 'Optional arcade-cabinet tagline.' },
        theme: { type: 'object', description: "Optional accents { accent?, accent2?, style?: 'hud'|'clean' }." },
        music: { type: 'boolean', description: 'Beats soundtrack + SFX. Default true.' },
        register: { type: 'string', enum: ['8bit', '16bit', '32bit'], description: "Optional era label; default the reducer's own." },
        ref: { type: 'string', description: 'Optional stable sketch ref.' },
        project_ref: { type: 'string', description: "Optional gp_… ref: binds as the project's active rules member." },
      },
      required: ['reducer'],
    },
    handler: createPixelizerGameHandler,
  });
}
