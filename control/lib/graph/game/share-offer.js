/**
 * share-offer — what a finished game's result says about sharing it, on THIS host.
 *
 * A game is complete when it mints (`create_game`, `create_pixelizer_game`, or `design_game` once its game is made),
 * and that is when the operator is asked how they want to share it: never before, and never exported unasked. The
 * offer lists the ways (play it here, a desktop app, a web folder, a single page, a Godot project), each with the call
 * that makes it and a verdict per surface, read off the host's handoff rows (hosts/registry.js):
 *
 *   here   it works on this surface as it is
 *   carry  it is written here and reaches the operator through this host's door (export_game's `handoff` names it)
 *   ask    it depends on something only the operator or the session knows (a folder-capable file tool, a git remote)
 *   no     this host cannot do it; `how` says why and what to do instead
 *
 * The `floor` is the recipe: any host running mojulo re-mints the game from it, so it is the handoff that works
 * everywhere and the only one when nothing else can leave the host. Mojulo is agent-run, often in a box with no
 * display, no dashboard the operator can reach, and a door that carries one file at most: the offer degrades to what
 * the door allows rather than promising a step that cannot run. An unknown host gets no verdicts, only the options
 * and the advice to ask. Pure: same inputs, same offer. No `@/` imports.
 */

const verdict = (can, how) => ({ can, how });

// Can a FOLDER leave this surface (a level game's export, a desktop app, an engine pack)?
function folderOut(row, surface) {
  if (surface === 'local') {
    if (row.file === 'local') return verdict('here', 'the folder is on the operator\'s machine');
    return verdict('ask', 'only if this session\'s file transfer can deliver a folder');
  }
  switch (row.file) {
    case 'git':
    case 'artifact-download':
      return row.egress === 'git' || row.file === 'git'
        ? verdict('carry', 'commit the folder to the branch; the PR carries it')
        : verdict('ask', 'only if this box can push the folder somewhere the operator reads');
    case 'session-file':
    case 'server-file':
      return verdict('ask', 'only if this session\'s file tool can deliver a folder');
    case 'file-card':
      return verdict('no', 'this host hands back single files, not a folder');
    case 'drop-folder': {
      const only = Array.isArray(row.downloadExtensions) ? row.downloadExtensions.map((x) => `.${x}`).join(', ') : null;
      return verdict('no', `${row.dropLabel || "the operator's side"} carries ${only ? `only ${only} files` : 'files'}, not a folder`);
    }
    default:
      return verdict('no', 'this host has no door for a folder');
  }
}

// Can ONE page (a pixelizer game's game.html) leave this surface?
function pageOut(row, surface) {
  if (surface === 'local') {
    return row.file === 'local' ? verdict('here', 'game.html plays straight from file://') : folderOut(row, surface);
  }
  if (row.page === 'artifact') return verdict('carry', `${row.pageVerb || 'publish'} game.html as one page with ${row.pageTool || "the host's artifact tool"}`);
  if (row.page === 'file-card') return verdict('carry', 'hand game.html back as a file card');
  if (row.file === 'drop-folder' && (!row.downloadExtensions || row.downloadExtensions.includes('html'))) {
    return verdict('carry', `copy game.html into ${String(row.dropDir).replace(/\/+$/, '')}/`);
  }
  return folderOut(row, surface);
}

const withHow = (v, how) => (v.can === 'here' || v.can === 'carry' ? verdict(v.can, `${v.how}; ${how}`) : v);
const notOut = (v, instead) => (v.can === 'no' ? verdict('no', `${v.how}: ${instead}`) : v);

function options({ ref, engine, playUrl }) {
  const q = JSON.stringify(ref);
  const pixel = engine === 'pixelizer';
  const atHome = 'hand over the recipe and export it on the operator\'s machine';
  return [
    {
      id: 'play', call: playUrl, gives: 'play it now in the dashboard, nothing exported',
      judge: (row, surface) => (surface === 'local' && (row.page === 'dashboard' || row.page === 'local-preview')
        ? verdict('here', 'on this machine only (a loopback URL)')
        : verdict('no', surface === 'box' ? 'the dashboard in this box is not reachable from the operator\'s side' : 'this host shows no dashboard')),
    },
    {
      id: 'desktop', call: `export_game({ ref: ${q}, target: 'desktop' })`, gives: 'an app that plays offline with no web server (unsigned)',
      judge: (row, surface) => {
        const out = folderOut(row, surface);
        if (surface === 'local' && out.can === 'here') return verdict('here', 'npm install && npm start in the folder; npm run package builds the app');
        return notOut(withHow(out, 'it plays once on a machine with a display: npm install && npm start there'), atHome);
      },
    },
    {
      id: 'web', call: `export_game({ ref: ${q} })`, gives: 'a folder any static host serves, GitHub Pages included',
      judge: (row, surface) => {
        const out = pixel ? pageOut(row, surface) : folderOut(row, surface);
        if (surface === 'local' && out.can === 'here') return verdict('here', 'a static server plays it; for a public URL, git init && gh repo create when git and gh are set up');
        if (surface === 'box' && out.can === 'no' && row.egress === 'internet') return verdict('ask', `${out.how}, but this box reaches the internet: only with a repository it can push to`);
        return notOut(withHow(out, 'GitHub Pages can serve it from the repository'), atHome);
      },
    },
    ...(pixel ? [{
      id: 'page', call: `export_game({ ref: ${q} })`, gives: 'one self-contained game.html',
      judge: (row, surface) => notOut(pageOut(row, surface), atHome),
    }] : []),
    {
      id: 'godot', call: `export_game({ ref: ${q}, target: 'godot' })`, gives: 'a Godot 4 project, the fullest engine translation, with a portability report',
      judge: (row, surface) => notOut(withHow(folderOut(row, surface), 'it opens in Godot 4.5 or newer'), atHome),
    },
  ];
}

/**
 * The offer. `table` is the host's handoff ({ local?, box? }, or null for an unknown host), `surface` 'local' | 'box' |
 * null. → { ask, options: [{ id, call, gives, local?, box? }], floor, note? }.
 */
export function shareOffer({ ref, engine = 'shell', playUrl = null, table = null, surface = null }) {
  const rows = [];
  if (table?.local && surface !== 'box') rows.push(['local', table.local]);
  if (table?.box && surface !== 'local') rows.push(['box', table.box]);
  if (!rows.length && table) rows.push(table.local ? ['local', table.local] : ['box', table.box]);
  const opts = options({ ref, engine, playUrl: playUrl || `/api/sketches/${encodeURIComponent(ref)}/game` })
    .map(({ judge, ...o }) => ({ ...o, ...Object.fromEntries(rows.map(([s, row]) => [s, judge(row, s)])) }));
  const ephemeral = rows.some(([s, row]) => s === 'box' && row.ephemeral);
  const notes = [
    ...(!table ? ['this host is not in mojulo\'s registry, so what it can carry is unknown: ask where the operator will play it'] : []),
    ...(rows.length > 1 ? ['the surface is not known: `local` is the operator\'s machine, `box` the host\'s sandbox; MOJULO_SURFACE says which'] : []),
    ...(ephemeral ? ['this box is reclaimed when the session ends: share before it closes, and hand over the recipe either way'] : []),
  ];
  return {
    ask: 'The game is complete: ask the operator how they want to share it, then call the option they choose. Offer the ones this host can do; never export unasked.',
    options: opts,
    floor: {
      recipe: engine === 'pixelizer' ? 'recipe/game.json' : 'recipe/',
      how: 'any host running mojulo re-mints the game from its recipe (every export writes it): the handoff that always works, and the one to give when nothing above can leave this host',
    },
    ...(notes.length ? { note: notes.join('; ') } : {}),
  };
}

/** The offer in one line per option, for a readout that repeats it on every call: each option's verdict (`can` per
 * surface), the full offer being what the completing call returned. */
export function shareBrief(offer) {
  return Object.fromEntries(offer.options.map((o) => {
    const at = ['local', 'box'].filter((s) => o[s]);
    return [o.id, at.length === 1 ? o[at[0]].can : at.length ? Object.fromEntries(at.map((s) => [s, o[s].can])) : 'ask'];
  }));
}
