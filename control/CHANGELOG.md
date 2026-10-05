# Changelog

All notable changes to the `mojulo` npm package are documented here.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).
From `3.0.0` the media, game, connected-service and app loops and the recipe
format are the stable surface, and the chatbot factory is no longer part of
mojulo. The dashboard package, `mojulo-ui`, is released at the same version.
Releases up to 2.1.0, and the detailed log behind 3.0.0, are archived in
[CHANGELOG-2.x.md](CHANGELOG-2.x.md).

## [Unreleased]

### Figure hair

Four anime cuts from the operator's sketches, as hair words anywhere a hair word goes, and the construction words they
needed on the anime head. Being built on this branch.

- **The cuts.** `flipped-long` (long, curtain bangs framing the face, the ends kicked out), `blunt-bob` (a level fringe
  split off centre, the left side falling long), `side-tail` (the side-parted sheet gathered into a low tail over the
  left shoulder) and, for the male, `wild-spikes` (after Toriyama's spiky heroes: a swept-back mass, seven thorn
  spikes on its outline, heavy bangs, the back falling to a point at the nape).
- **The words.** `flip`, `spikes`, `sideTail` (its clump `tail`, part `hairTail`) and `fringeNotch` join the hair form
  words; each is absent unless given, so every stored hero builds as before.
- **Hair as shapes.** `shapes` composes a hairstyle from three primitives placed on the cap — peppers (the mass),
  bananas (the flow) and carrots (cut conical carrots, the spikes) — and may take over the studio's clump groups.
  `wild-spikes` is rebuilt on it, mass first. The principles and recipes cross-referenced to shonen and JRPG heroes are
  in `docs/examples/humanoid/DESIGNING.md`.
- **Fixed.** An anime hero whose hair is a list (`['long', { locks }]`) now wears that family: before, the list was not
  read as naming one, the base's cut was worn under it and its clump edits were lost.

### Figure articulation: pelvic

The hero's midsection structured from the vajra core it already carries, on the regular and the anime hero alike, and
the default for every hero (`core: 'structured'`). Every hero changes: a stored hero regenerates with it. `core:
'streamlined'` is the hero before it, byte for byte. Being built on this branch; each bullet is rewritten as its phase
lands.

- **The default.** Every hero is built on the structured core unless it says `core: 'streamlined'`. The tune keeps its
  contract on it: `thigh` thickens the thigh about its own rings, `calf` the knee and the shin, `legs` moves the joints
  and no radius; and the outline is one curve in every register (each ring's radius solved from the width it draws).
  A swing word's keys stand on a base of their own, reachable on every verb.

- **The pelvis bone.** On the structured core the `pelvis` bone is the basin: it turns with the hip girdle alone, as
  the vajra's own pelvis does, so a spine curl or arch bends the lower back over a still pelvis instead of tipping it. A
  new `lumbar` bone carries what `pelvis` used to (the pelvis hub to the navel); the hem and the top of the thighs blend
  the two, and a hip-slung blade rides the basin. A rig bone may now take `align`, two joints whose line orients it.
- **The legs converge.** On the structured core the thigh slants in from the hip to the knee, more on the female, so
  the knees sit inside the hips and the feet under the knees. The female casts no longer stand with their knees wider
  than their hips and a deep V between the thighs: their narrowed hips had left the knees behind.
- **The stand owns its base.** New pose words `stance` (how far apart the planted feet stand, as a multiple of the hip
  spread) and `stagger` (one foot forward, one back), and `heelL` / `heelR` in a stand. With converged legs the
  presets plant both feet on a base of their own: the guard wide and bladed with the rear heel up, the relaxed and
  hand-on-hip stands close-set with a soft free knee, a swing on the guard's base. Without these words a planted foot
  stands where it always did.
- **The pelvis mesh.** On the structured core a `pelvis` part on the vajra basket runs from the crotch up into the
  hem, its back the seat, and the thigh is rooted at the hip socket inside it. The hip is one curve out from the waist:
  the female's widest at the trochanter and narrowing steadily to the knee, the male's straight. The front recedes to the
  crotch, the thighs meet under it, and the thigh comes out of the pelvis along the groin's diagonal. Gone: the corner
  and pinch at the side of the female hip, the front standing proud of the belly, the shelf at the hem, the step at the
  knee, and the flat seat.
- **The dress follows the pelvis.** On the structured core the hip pieces hang from the pelvis and ride it: a knight's
  faulds carry on down over the hips under the breastplate and the tassets hang from the crest over the hip, fitted close
  and clear of the thighs at every dial. Every piece that stands off the thighs (a fauld, a belt, a kit of the
  operator's) stands off the pelvis too, and thigh plates wrap the share of the thigh they were drawn for. On converged
  legs a hardsuit's inner knee plate turns less far in, clear of the other knee.
- **The torso.** On the structured core the torso is built on the vajra rib cage: a waist above the hem, the ribs
  widening to a lifted chest, the male's back widest under the arms and the female's narrower, and the shoulders sloping
  from the neck under the arm's own cap instead of a box with square corners. The new rings sit between the five the
  dress addresses, so every torso address (`s` 0 … 4, a collar's station) lands where it did.
- **The chest layers.** On the structured core a pectoral lies over each side of the rib cage, its own part hugging
  the chest: the pair meets at the sternum as one domed chest, its lower border standing proud as the shelf and its
  armpit end moving a little with the arm. The adult female hero carries a bust by default (a child or chibi cast, or
  the kid look, never does): a breast per side over the pectoral, each its own part and a bone each (`bustR`, `bustL`)
  an engine's spring can drive. The breast is a studied field over the chest (`breast-field.js`): its footprint and its
  poles' profiles are a handful of anatomy words, and gates measured on the field hold it to what an artist checks (the
  upper and lower poles 45 : 55, the fold a wall, the upper pole straight or concave, the lower pole full, the margins
  melting into the chest, one clean peak). The pair meets at the midline in a cleavage valley (the field's `cleft`, a
  share of the projection there), not two mounds with flat chest between them, and the triangle between the clavicles
  and the upper poles stays shallow. A bare belly carries a navel, set where the canon puts it: about level with the elbow, a little under the
  narrowest waist. A clothed jerkin covers the pectorals, and every piece worn on the torso stands off the layers. A trunk ring
  may now name its own `u` (the address parameter) and `push` named slots off the ring, a skin blend may weigh one point
  (`station.slot`) over its ring, a new plan kind `rings` gives a part's rings point by point, and a `ring20` slot
  family is there for a finely sampled form. The knight's and
  the ranger's pauldrons and the jerkin's quilt sit on the new shoulder.
- **The swimsuit view.** New `detail: 'swimsuit'` shows the body bare: every shirt, trouser and shoe colour is skin, and
  swimwear is painted on the body's own surface (the adult male's trunks, the adult female's two-piece — on the structured core a speedo and a thong — a child-coded
  figure's rash vest and trunks; the female's cups follow her breasts with a sweetheart top edge that dips into the
  cleft), in a `Swim` tone you can name (by default dark, so the swimwear sorts into the dark
  value band apart from the skin and the hair). A plan segment may now carry `bandGroups` (a group
  per band and slot) and `slotT` (each slot's address parameter).
- **The shoulders and the neck.** On the structured core the neck rises out of the chest: the sternal notch sits under
  the base of the neck at the back, so the neck shows from the front instead of the chin resting on the shoulders. The
  male's trapezius slopes from the neck to the shoulder instead of standing as a plateau, and the shoulder rounds over the arm as a deltoid instead of ending in a square corner. Under the
  anime head the neck's shade is the jaw's shadow, its lower edge a V toward the notch, no longer the whole neck down
  to its seam on the chest. The upper arm's widest point sits a quarter down it, as the deltoid's does, its top a
  dome over the joint; the western figure's neck is a round column whose back rises into the head, and the pectoral's
  top edge rises from the breastbone toward the shoulder as the clavicle does. A segment may name its caps' height (`cap`).
- **The seat.** On the structured core the female's seat is her own shape, not the male's a size up: fuller and
  set further back, fullest halfway down it, its two halves parted by a deep cleft (drawn on bare skin in a darker
  second shade), under a lower back that curves in over it; the male's is square and high, his back running
  straight down into it, two masses with a cleft between them. On the structured core the swimsuit is a speedo for
  the male (low and level, no leg, a clean leg line, the cleft a crease in it) and a thong for the female (a front
  triangle, a thin string rising over the hip and a V at the back narrowing into her cleft, her seat bare), so the two
  seats show; the thong's back is drawn under the studio light as well as the character light.
- **The hands.** On the structured core the hand is a palm and five digits instead of a mitten, on the regular and
  the anime hero alike (the anime casts' hands smaller, the same shape): the palm flat across the back with the thumb's
  and the little finger's pads in front, the knuckles on an arc, the fingers in a relaxed curl that deepens toward the
  little finger, the thumb opposed. The hand hangs facing the thigh, the forearm tapering into it at a rounded wrist. The wrist is a joint and the fingers bend: the
  pose words `wristL` / `wristR` (flex, or `{ flex, deviation, twist }`) and `fingersL` / `fingersR` (a curl, a curl
  per digit, or a hand word: `relaxed`, `open`, `fist`, `point`, `grip`) now move a structured hero instead of being
  refused; a streamlined hero still refuses them. Fifteen finger bones a hand, named as VRM and Godot name them. A rig
  may now carry `hands`, the wrist and digit chains its posing turns in the hand's own frame.
- **The arms.** On the structured core the upper arm and the forearm carry their muscles instead of running as two
  cones: under the deltoid the triceps fills the back of the upper arm and the biceps the front lower down, into an
  elbow that is wider across than it is deep; the forearm is fullest across just below the elbow and slims into the
  wrist over its last third. The male's are marked, the female's softer, the anime casts' softer still. Cuffs,
  bracers and armour land where they did; a streamlined hero is unchanged. A segment may carry shaping rings between
  its own (`shape`), addressed between its rings so its addresses keep their meaning.
- **The legs.** The same on the structured legs: the thigh's front fuller over its upper half, the hamstrings behind
  and the inner thigh full high, the inner bulge just above the knee and the knee narrower under it; the calf full at
  the back and lower on the inside, the leg slimming above the ankle. Swimsuit leg lines, wraps and greaves land where
  they did. A loft's station may name its `u` too.
- **The feet.** A bare structured hero (the swimsuit's) stands on feet instead of shoes: a rounded heel under the
  Achilles, the two ankle bones, the instep rising to the shin, the arch lifted on the inside, the ball wide on a
  slant; the big toe its own, apart from the rest (the grip), the other four side by side with the lines between them.
  The toes bend with the toe bone. Footwear replaces the foot: a hero in shoes, clothes or armour keeps the shoe as it
  was, and sandals and boots to come take the foot's place on the same joints.
- **The western forehead.** The landmark head's forehead rises from the brow instead of leaning back from it, and the
  brow's outer end stands level with the corner of the eye instead of sinking in behind it, so the far side of the face
  no longer caves in over the eye in the ¾ and the profile. The hair rides the new forehead. Every hero with the landmark
  head changes a little above the eyes, the streamlined core's too.
- **The ear.** The ear is an ear, not an egg, on the landmark and the anime head alike. From the side the broad top
  runs into a nearly straight back edge and down on a diagonal into a broad lobe, the front open where the rim ends, the
  ear leaning back. It is a thin plate, like a leaf, joined to the head at its front and angled off it toward its back.
  On the landmark ear the rim is raised, the antihelix rises inside it and the bowl dips behind, in the darker inner
  tone, so the light shows its depth; the anime ear is a simpler rim, fold and bowl, drawn by its outline. The anime
  head's studio-exact face (`sculpt: false`) keeps its own ear.
- **The head stored once.** A stored hero kept its anime head twice, once in the plan and again in the recipe the plan
  expands to: about half of every hero row. The recipe's copy is no longer stored; it comes back from the plan when the
  row is read, so every tool, render and export still sees the whole recipe. A head part edited by hand under
  `/recipe` is stored as edited. A hero row is about 1.2 MB instead of 2.35 MB; a row stored before shrinks on its next
  edit.
- **The torso's anatomy.** On the round register the structured torso and pelvis are rounder (twelve points a ring,
  addressed on the old scale, so every armour piece, kit and quilt lands where it did), and they carry the forms a
  silhouette is marked by: the male's chest and its shelf, the sternum, the belly and the navel, the lats and the
  waist's taper, the shoulder blades and the spine; the female's deeper waist and the curve of the lower back; the seat's
  two masses on the pelvis. The step at the waist is gone.
- **Core measures.** Every hero's readout carries `core`: the waist to hip, where the hip peaks, the seat, how far the
  front falls below the waist, any pouch, the largest step in the outline, and whether the legs converge, with advice
  against bands per body that names the word to move. On the structured core the advice is a warning; on a streamlined
  hero it stays in `core.advice`. The design loop's critic reads it. `render-pelvic-overlay.mjs`
  draws the vajra core over the hero mesh before and after.

## [3.0.0] - 2026-10-01

### Upgrading from 2.x

- **3.0.0 is the release after 2.1.0.** A 2.2 was prepared and never published; everything it carried
  is in this release. Removing the chatbot factory is why this is a major version.
- **Node 22.14 or newer.** 2.x asked for 22.12, but on Node 22.12 and 22.13 the database library
  (better-sqlite3) crashes the process the first time it opens the database, with no message; 2.1.0
  crashes the same way. 3.0 checks the version at start-up and says which Node to install.
- **The 2.x line is unmaintained.** No 2.x release will be patched, and running one is not
  recommended. 2.1.0 and the bot image it deploys (`mojulo-bot` 0.5.1) have known security issues: an
  open relay on deployed bots (`/api/send-webhook`), SSRF in `upload_document_from_url`, path
  traversal in the Office-document parser, Fly credentials in the machine environment, dashboard DNS
  rebinding and cross-site writes, a revoked delegate's dashboard session that outlives the
  revocation, a delegate's dashboard session that holds the operator's authority, and an
  `update_sketch` patch that reaches the prototype chain
  ([SECURITY.md](https://github.com/zombico/mojulo/blob/v3.0.0/SECURITY.md#known-issues-in-2x)). Bots
  already deployed from 2.x run on their own, on that image, until you take them down.
- **Unpinned installs move to 3.0 on their next start once 3.0.0 is npm `latest`.** A host that runs
  `npx -y mojulo` (every config 2.x `mojulo init` wrote, the README's manual lines, and the Claude
  plugin up to 2.0.1) installs 3.0.0 on its next start, whether or not the plugin was updated. The
  3.0 plugin runs `npx -y mojulo@3.0.0`; update it, and remove any `mojulo init` or `claude mcp add`
  registration beside it (two registrations run two servers). Exact pins and a global
  `npm i -g mojulo` stay on their version until you change them. The first start downloads about
  79 MB (the package and its dependencies); if the host gives up, start Claude Code with
  `MCP_TIMEOUT=60000`, or run `npx -y mojulo@3.0.0 --help` once in a terminal. Restart every host
  afterwards so no 2.x server keeps running against the same `~/.mojulo`.
- **Saved provider keys become unreadable to 2.x.** With `API_KEY_ENCRYPTION_KEY` unset (the
  default), the first time a 3.0 process reads saved keys (`mojulo-config`, `list` included;
  `mojulo init`'s key prompt; the dashboard's key settings; `mint_solid` `via:'prompt'` without an
  inline `apiKey`), it re-encrypts every key a 2.x install saved, the Fly token included, under a
  per-install key at `$MOJULO_HOME/secret.key`. 2.x cannot decrypt them after that; the change is
  one way. **Back up `secret.key` together with the database:** without it 3.0 cannot read the keys
  either.
- **What left, and what it left behind.** The chatbot factory is no longer part of mojulo as of 3.0
  and is moving to its own project. Earlier 2.x versions that include it are unmaintained and have
  known security issues. Its tools, packs and dashboard pages are not in 3.0; calling one of its
  tools, `mojulo install chatbot` or an `artifact_materialization` commit does nothing and answers
  with that notice. Its tables (`deployments`, `modular_sessions`, `mcp_jobs`) and their rows, and the
  `packs/chatbot` marker, stay in `~/.mojulo`, inert: 3.0 does not use them, and you may delete them.
  **`~/.mojulo/data/artifacts/` holds each old bot's `.env` with its provider key in plain text:
  delete it.**
- **Downloaded helpers and draft figure specs move out of the npx cache.** 2.1.0 kept Chrome for
  Testing, ffmpeg, gallery stills, turntable strips and draft figure specs inside its package folder;
  3.0 keeps them under `$MOJULO_HOME`. An unpinned upgrade replaces that folder, so they are not
  carried over; pending figure specs are lost unless another version's npx folder still holds them
  (3.0 copies those across once). The browser (now build 154) is no longer fetched in the
  background: with no browser installed, gallery thumbnails stay blank until one is available (an
  installed one, `MOJULO_CHROMIUM`, or, outside the Claude plugin build, an explicit render's
  download).
  @puppeteer/browsers 3 has no proxy support, so a host behind an HTTP proxy sets `MOJULO_CHROMIUM`.
- **Other changes a 2.x setup can notice.**
  - `mojulo init` changes nothing without `--yes` when stdin is not a terminal: it prints its plan and
    exits 2. With the Claude plugin installed it leaves Claude Code to the plugin.
  - The dashboard is its own package, `mojulo-ui` (`npx -y mojulo-ui`); `npx -y -p mojulo mojulo-ui`
    downloads the matching version on first use (`MOJULO_UI_NO_FETCH=1` refuses). It answers 403 to
    a `Host` other than loopback, `MOJULO_UI_HOST` or a name in `MOJULO_UI_ALLOWED_HOSTS`, and to a
    cross-site write, so a LAN, proxy or tunnel setup needs `MOJULO_UI_ALLOWED_HOSTS`.
  - `mint_solid` `via:'prompt'` requires `provider`: nothing chooses the provider for you any more.
    The key is `apiKey`, the saved key named by `apiKeyId`, or else your saved key for the provider
    you name.
  - Exported World pages are self-contained by default again (`world.html`, no third-party fetch);
    `cdn: true` writes `world.cdn.html`, and `world.offline.html` is no longer written.
  - Stored `floorplan` and `condo-complex` rows that relied on the old room defaults re-render
    roomier, and the furnish pass doors sealed rooms, parks interior doors open against the wall and
    moves wall pieces out of a door's way
    ([Room livability](https://github.com/zombico/mojulo/blob/v3.0.0/control/CHANGELOG-2.x.md#room-livability),
    [Furniture audit](https://github.com/zombico/mojulo/blob/v3.0.0/control/CHANGELOG-2.x.md#furniture-audit)).
  - `chatbot` or `ops` in `MOJULO_PACKS` is ignored, so `MOJULO_PACKS=chatbot` alone now leaves the
    creative tools on.
  - `MOJULO_MCP_TELEMETRY=off` stops only the local tool-call log, no longer the tool timeout, and
    `MOJULO_MCP_TOOL_TIMEOUT_MS` can raise a tool's budget but not lower it. Render tools get 600 s.
  - `mojulo install creative` installs nothing (the creative pack always ships), and
    `mojulo install recall` now works from npm and npx. With the runtime already installed and the
    search model missing, it fetches the model instead of reporting nothing to do.
  - A delegate (roles pack) signed in to the dashboard reads and no longer writes (below).
  - A city minted from now on wears the round street kit (below); stored cities are unchanged, and
    `elements: { roundKit: false }` keeps the block kit.
  - A material object whose `metal` is a name (`{ metal: 'steel', finish: 'brushed' }`) is a metal
    surface (below); beside `base` or `preset` it is refused. The shelf's numeric `metal: 1` is
    unchanged.

### What 3.0 is

- **A 3D compiler for agents.** Your agent builds objects, walkable worlds and games by conversation
  as small deterministic recipes on your machine, compiled back to the same geometry (byte for byte on
  the same platform) and exported to STL / 3MF, glTF, OpenUSD, IFC4, self-contained HTML, Godot,
  Blender, Unity and Unreal. The bot factory, which never fit that, is gone.

### Determinism

- **What "the same geometry" means.** A recipe compiles to the same geometry every time: byte for byte
  on the same platform (OS, CPU and Node version), and to within floating-point rounding on any other.
  V8's `Math` is not one function everywhere: its arm64 builds round `sin`, `cos`, `exp`, `atan2` and the
  rest differently from x64, and since Node 24 `Math.pow` and `**` call the platform's C library. An
  embedded texture PNG can also differ in its compressed bytes between Node builds (Homebrew's Node links
  a different zlib), never in its pixels.
- **3.0's generators go further.** The vegetation engine, terrain worlds, the anime head and hero, stores
  and construction, metro and canal cities, the metro refacade and the Tian Tan Buddha take their
  transcendental functions from a deterministic math module (fdlibm in plain double arithmetic), so their
  pinned outputs are the same bytes on Linux and macOS, x64 and arm64, Node 22 and 24, and CI checks them
  on every runner. The older helpers they reach switch to it only inside a 3.0 build, so nothing minted
  with 2.x changes. A few older helpers still use the engine's `Math` (specular shading, sRGB conversion,
  some textures, roads, the metro World's walkers and cars).

### Lean install

- **3.0.0 against the published 2.1.0, one method.** A cold start with an empty npm cache and a
  fresh `HOME` and `MOJULO_HOME` (`npm exec --package=<tarball> -- mojulo`) through a local registry
  stand-in, timed from spawn to the `initialize` answer, on one macOS arm64 machine (M1 Max). Sizes
  are decimal MB; the installed and downloaded rows include the package itself, and "downloaded" is
  the unique tarballs plus the package metadata, estimated gzipped.

  | | 2.1.0 | 3.0.0 |
  |---|---|---|
  | npm tarball | 31.2 MB | 6.7 MB |
  | Unpacked package | 121.7 MB | 21.3 MB |
  | Installed, package and dependencies | 539 MB, 426 packages | 227 MB, 153 packages |
  | Downloaded on a cold start, package included | about 182 MB | about 79 MB |
  | Cold start to `initialize`, median (p90) | 12.7 s (15.7 s), 14 runs | 4.5 s (4.6 s), 6 runs |

- **Machine caveat.** The two timings come from separate sessions on a busy machine: 2.1.0 on
  2026-09-27 (load average 3 to 12), 3.0.0 on 2026-09-30 (7 to 11). In the 3.0.0 session, runs of a
  pre-release 3.0 candidate interleaved with the release's took a median 6.1 s: the release installs
  one copy of sharp instead of two, 26 packages fewer. Trust the sizes more than the seconds, and
  expect the real registry to be slower than the stand-in. npm also keeps the downloaded tarballs in
  its cache, about 140 MB for 3.0.0. 2.1.0's package carried the dashboard build; 3.0.0's dashboard
  is `mojulo-ui` (12.7 MB packed, 57.0 MB unpacked), fetched only when it is opened.
- **The package never carries a local content pack.** A tarball or `mojulo-ui` build made from a
  checkout holding the operator-local mobile-suit content pack carried it; the package file list
  leaves it out, a test fails any tarball carrying a gitignored file, and the dashboard build refuses
  such a checkout. A clean install no longer prints warnings about that absent pack.
- **What left the install:** the dashboard build, `@swc/core`, `three`, the dashboard-only libraries,
  `dotenv`, and the chatbot factory's `officeparser` and `pdf2json`. puppeteer-core, archiver and
  react load on first use, so the stdio server boots without them. Details:
  [docs/tech-requirements.md](https://github.com/zombico/mojulo/blob/v3.0.0/docs/tech-requirements.md),
  [Lean cold start](https://github.com/zombico/mojulo/blob/v3.0.0/control/CHANGELOG-2.x.md#lean-cold-start).

### Security and consent

- Saved provider keys are encrypted under a random per-install key (`$MOJULO_HOME/secret.key`, mode
  0600) instead of a constant in the source. The dashboard refuses DNS-rebinding and cross-site
  requests. `mint_solid` `via:'prompt'` never chooses the LLM provider for the caller: `provider` is
  required, and the key is `apiKey`, the saved key `apiKeyId` names, or the caller's saved key for
  that provider.
- Chrome for Testing downloads only for an explicit render and says so (never under the Claude
  plugin, below); headless Chromium keeps its sandbox (on Linux it falls back only on Chrome's
  sandbox errors or as root); the ffmpeg download is SHA-256 pinned; everything mojulo writes lazily
  lands under `~/.mojulo`.
- `mojulo init` needs `--yes` when nobody is at a keyboard. "No telemetry" is now "no external
  telemetry", with the local tool-call log described. Core has no Docker, Fly, GHCR, webhook or
  uploaded-document code path.
  ([Security hardening](https://github.com/zombico/mojulo/blob/v3.0.0/control/CHANGELOG-2.x.md#security-hardening),
  [Runtime footprint and consent](https://github.com/zombico/mojulo/blob/v3.0.0/control/CHANGELOG-2.x.md#runtime-footprint-and-consent))
- **Revoking a delegate's key now ends their dashboard session on their next request.** Before, the
  dashboard checked only a session's signature and 7-day cookie expiry. A delegate (roles pack) whose
  key was revoked with `revoke_role_key`, had expired, or had its token epoch bumped could keep using
  the dashboard until the cookie ran out, even though their MCP bearer had already stopped working.
  Such a session now gets the same 401 on `/api/*` and redirect to `/login` as no session, and with
  the roles pack off a delegate session is refused outright. The dashboard middleware now runs on the
  Node runtime so it can make this check. The operator's own session, installs with login off, and
  installs without the roles pack make no database read.
- **A delegate's dashboard session is read-only.** No dashboard route checks a role, a grant or a
  flag, so on 2.x a signed-in delegate held the operator's authority there, whatever the role
  granted: deleting the operator's saved keys, writing an app's `.env` and starting the app, deleting
  sketches. A live delegate session now reads pages and the API, and gets 403 (`DELEGATE_READ_ONLY`)
  on every write and on the settings API. The roles pack's grants still bind the delegate's MCP key;
  the operator's session is unchanged.

- **sharp 0.35.5.** The image library moves past high-severity advisories in its bundled libvips and
  libheif (GHSA-f88m-g3jw-g9cj, GHSA-rgj7-g3m4-5g8c), and `mojulo-ui` no longer carries the older copy
  Next.js keeps for `next/image`, which the dashboard never imports. An image submitted for a render
  that does not decode is refused at submit.
- **A patch cannot reach the prototype chain.** An `update_sketch` patch path through `__proto__` or
  `constructor/prototype` set or deleted a property on every object in the server process until it
  restarted. Such a path, or the same key in a set-by-id merge, now refuses by name.

### Claude plugin and directory readiness

- Every tool carries a `title` and behavior `annotations`, `initialize` negotiates `2025-06-18`,
  `2025-03-26` or `2024-11-05`, and the Claude plugin pins `npx -y mojulo@3.0.0`
  ([annotations](https://github.com/zombico/mojulo/blob/v3.0.0/control/CHANGELOG-2.x.md#mcp-tool-annotations-and-protocol-negotiation),
  [disclosure](https://github.com/zombico/mojulo/blob/v3.0.0/control/CHANGELOG-2.x.md#directory-listing-and-disclosure)).
- **The Claude plugin build.** When the Claude plugin starts mojulo, it leaves out the handoff tools
  for AI image, voice and mesh generators. That covers the image-render and mesh handoffs, the voice
  registers, sprite sheets, style presets, the skin op, the painted sketch kinds, the painted cover
  title, `forge_motion`'s scene and cel sources, the character-from-dream figure specs and a
  figure's `dream_audit`, and the image-driven catalysts. The vocab cards and catalysts it keeps are
  served without their lines about those loops. It also leaves out the keyed
  `mint_solid via:'prompt'` door (use `via:'packet'`) and every automatic download:
  - renders use a Chrome, Chromium, Edge or Brave you already have, or `MOJULO_CHROMIUM`;
  - MP4 encodes use an ffmpeg you already have, or `MOJULO_FFMPEG`;
  - the search model arrives only through `install recall`.

  Exported World and game pages are always self-contained there: `cdn: true` is ignored, and the
  result says so. The host adapter cards are served without their image-generator and CDN lines, and
  the MCP Apps preview is not offered. A call to a tool the plugin build leaves out answers in-band.
  Installs from npm or a checkout are unchanged.
- **The plugin listing.** It is rewritten for 3.0 with three example prompts that work in the plugin
  build, a table of what it installs, fetches, runs and writes, a privacy policy link, an "Upgrading
  from 2.x" note, and an icon.

### Hosts

- **ChatGPT.** Its own adapter card (`get_adapter({ id: 'chatgpt' })`) and handoff profile, for
  connected MCP and for a shell-enabled Work box. A separate ChatGPT skills package
  ([plugins/mojulo-chatgpt](https://github.com/zombico/mojulo/blob/v3.0.0/plugins/mojulo-chatgpt/README.md))
  prefers connected MCP and otherwise sets up a pinned, workspace-local CLI in the box. Handoff notes
  keep a file on the MCP server apart from a file in the session, and promise no attachment or inline
  preview the session has not shown. Codex is no longer recognized by the bare OpenAI vendor name.
- **Meta Muse.** A host profile and adapter card for the shell-only agent on its own persistent Linux
  VM, where `npx mojulo call` is the whole surface and `MOJULO_HOST=muse` names its doors: pages leave
  through its Artifacts, files through its Library. A bundle export's `<ref>.courier.html` lists the
  export's files under `outcomes/<ref>/`, each with a Save where the viewer allows it, so one HTML page
  can deliver any of them. A host profile
  may name its own page words (`pageVerb`, `pageTool`, `pageOpensIn`), what its page door does with
  inline scripts (`inlinePage`), and a `drop-folder` file door.
- **`MOJULO_HOST`** picks the adapter card on the CLI, for `get_adapter`, catalyst composition and
  recommendations, when no client identity says which host is calling. An explicit adapter id or a
  recognized client still wins.
- **Recipe recovery.** `create_sketch` accepts an exported world recipe and passes it through the same
  validation and ledger stamp as `update_sketch`, so a recipe carried out of a temporary box comes back
  as it left, a hero with its hand edits. A duplicate ref refuses, and referenced assets must already
  exist.
- **MCP Apps preview, opt-in.** With `MOJULO_MCP_APPS=1`, `preview_world` shows an inline mesh
  snapshot of a stored ref in a host that supports MCP Apps; the exported HTML stays the full world.
  Nothing is hosted publicly.

### Dashboard package

- **The dashboard is its own npm package, `mojulo-ui`,** published at the same version as `mojulo`
  and depending on exactly that version. `npx -y mojulo-ui` starts it; core's `mojulo-ui` command
  runs the matching package or downloads it after saying so. It has no bot pages. Both packages
  carry LICENSE and NOTICE, and the dashboard lists every package it redistributes in
  `THIRD_PARTY_NOTICES.md`
  ([Dashboard package](https://github.com/zombico/mojulo/blob/v3.0.0/control/CHANGELOG-2.x.md#dashboard-package)).

### Creative work

- **Characters and heroes:** the hero as a core form with a create-hero loop and tunes kept as the
  record, fitted landmark heads with a face tune and a hair library, the ring plan and creature loop,
  planar humanoids, and worn things that follow the dials
  ([Create hero](https://github.com/zombico/mojulo/blob/v3.0.0/control/CHANGELOG-2.x.md#create-hero),
  [Hero detail](https://github.com/zombico/mojulo/blob/v3.0.0/control/CHANGELOG-2.x.md#hero-detail),
  [Hero tune](https://github.com/zombico/mojulo/blob/v3.0.0/control/CHANGELOG-2.x.md#hero-tune),
  [Fitted heads](https://github.com/zombico/mojulo/blob/v3.0.0/control/CHANGELOG-2.x.md#fitted-heads),
  [Face tune](https://github.com/zombico/mojulo/blob/v3.0.0/control/CHANGELOG-2.x.md#face-tune),
  [Hair library](https://github.com/zombico/mojulo/blob/v3.0.0/control/CHANGELOG-2.x.md#hair-library),
  [Ring plan](https://github.com/zombico/mojulo/blob/v3.0.0/control/CHANGELOG-2.x.md#ring-plan),
  [Planar detail](https://github.com/zombico/mojulo/blob/v3.0.0/control/CHANGELOG-2.x.md#planar-detail),
  [Planar humanoid](https://github.com/zombico/mojulo/blob/v3.0.0/control/CHANGELOG-2.x.md#planar-humanoid),
  [Read and attach](https://github.com/zombico/mojulo/blob/v3.0.0/control/CHANGELOG-2.x.md#read-and-attach)).
  The hero also wears the Anime Form Studio's head (`head: 'anime'`) on anime proportions, with
  fitted hair forms, looks as composable words, a graphic face and neck, a character light with
  designed shadow shapes, draw layers and clips at the door; its skinned GLB and Godot pack carry the
  face. Worn armour (plate, samurai lamellar and hard-suits, with themes carried down a suit) and held
  gear with swings ride the hero door
  ([layered manual](https://github.com/zombico/mojulo/blob/v3.0.0/control/lib/graph/solid-vocab/layered.md),
  [designing a hero](https://github.com/zombico/mojulo/blob/v3.0.0/docs/examples/humanoid/DESIGNING.md)).
- **Arms, metal and gems:** swords, daggers, greatswords, staves, bows and shields composed from a few
  dials and laws, pattern-welded blades included (`mint_solid` kind `equipment`); metal as a surface
  any part, facade, roof or trim can wear (a metal, a finish and an oxide film), reflected on the World
  page and kept in glTF and USD; gems with their optics and exact light prints, and crystals as light
  operators in worlds, performed in Godot
  ([equipment manual](https://github.com/zombico/mojulo/blob/v3.0.0/control/lib/graph/solid-vocab/equipment.md),
  [workbench manual](https://github.com/zombico/mojulo/blob/v3.0.0/control/lib/graph/solid-vocab/workbench.md)).
- **Cities and worlds:** metro and canal profiles for the fractal city, redrawn landmarks and sacred
  buildings, stores and malls from concept cards, and large cities streamed by tile
  ([City scale](https://github.com/zombico/mojulo/blob/v3.0.0/control/CHANGELOG-2.x.md#city-scale),
  [Canal city](https://github.com/zombico/mojulo/blob/v3.0.0/control/CHANGELOG-2.x.md#canal-city),
  [Local city refacade](https://github.com/zombico/mojulo/blob/v3.0.0/control/CHANGELOG-2.x.md#local-city-refacade),
  [Retail concept cards](https://github.com/zombico/mojulo/blob/v3.0.0/control/CHANGELOG-2.x.md#retail-concept-cards),
  [World streaming](https://github.com/zombico/mojulo/blob/v3.0.0/control/CHANGELOG-2.x.md#world-streaming)).
  New cities wear a round street kit: lamps, poles, bins, bollards, piers, playground frames and
  rooftop equipment drawn round, a few of them in metal.
- **Interiors:** houses minted in a style, livable default room sizes, and a furniture audit that
  gives every room a way in
  ([House styles](https://github.com/zombico/mojulo/blob/v3.0.0/control/CHANGELOG-2.x.md#house-styles),
  [Room livability](https://github.com/zombico/mojulo/blob/v3.0.0/control/CHANGELOG-2.x.md#room-livability),
  [Furniture audit](https://github.com/zombico/mojulo/blob/v3.0.0/control/CHANGELOG-2.x.md#furniture-audit)).
- **Buildings and furniture:** timber from a synthetic log, steel sections, reinforced concrete and
  masonry, joined by Western and Japanese joinery through the exact kernel and checked, never refused;
  houses framed, lined and wired by their building tradition, carrying a building model with a
  takeoff; tile roofs and drainage; houses exported as IFC4 (`export_model` `format: 'ifc'`); house
  design checks that measure the walkways, with a repair; furniture built from sheet goods and
  fittings (carcasses, tables, chairs, sofas with upholstery and cloth from a weave draft), checked for
  sag, racking and tipping, with wordless assembly manuals; and the built pieces placed in rooms and
  condos ([floor plan manual](https://github.com/zombico/mojulo/blob/v3.0.0/control/lib/graph/sketch-vocab/floor-plan.md),
  [workbench manual](https://github.com/zombico/mojulo/blob/v3.0.0/control/lib/graph/solid-vocab/workbench.md)).
- **Terrain and nature:** a painted landscape made real-scale ground you walk, fly and orbit, up to a
  small planet, or a world composed from features (a river, a range, a lake, a volcano, a coast) sized
  on real-world bands, with fractal cities sited on its hills; plants grown rather than drawn (trees by
  their architecture, palms, bamboo, figs and conifers), standing as forests where the ground is
  painted wood, and grass; rocks built from their minerals, and landforms and erosion on painted
  landscapes ([terrain manual](https://github.com/zombico/mojulo/blob/v3.0.0/control/lib/graph/views/view-vocab/terrain.md),
  [vegetation](https://github.com/zombico/mojulo/blob/v3.0.0/docs/vegetation.md)).
- **Look and drawing:** shading normals from the hull, outlines and rims carried into Godot, Unity
  and Unreal, key-and-fill art direction, and the `layered` kind drawn from its compiled mesh, with
  rigs and clips
  ([Shader look](https://github.com/zombico/mojulo/blob/v3.0.0/control/CHANGELOG-2.x.md#shader-look),
  [Art direction](https://github.com/zombico/mojulo/blob/v3.0.0/control/CHANGELOG-2.x.md#art-direction),
  [Planar drawing](https://github.com/zombico/mojulo/blob/v3.0.0/control/CHANGELOG-2.x.md#planar-drawing)).
  A line drawn on a `layered` solid becomes a recipe op (a silhouette solves the shape dials, a
  contour becomes a ridge strip, a brush a dial), with the share of the line it could not hold.
- **Audio:** stereo and per-hit variation, tuned strings, orchestral scoring and era synths, and
  anthem and roots song styles, all synthesized from formulas and opt-in
  ([Audio fidelity](https://github.com/zombico/mojulo/blob/v3.0.0/control/CHANGELOG-2.x.md#audio-fidelity),
  [Orchestra and era synthesis](https://github.com/zombico/mojulo/blob/v3.0.0/control/CHANGELOG-2.x.md#orchestra-and-era-synthesis),
  [Anthem styles](https://github.com/zombico/mojulo/blob/v3.0.0/control/CHANGELOG-2.x.md#anthem-styles),
  [Roots styles](https://github.com/zombico/mojulo/blob/v3.0.0/control/CHANGELOG-2.x.md#roots-styles)).

2.1.0 and earlier releases, and the detailed log behind this release, are in
[CHANGELOG-2.x.md](https://github.com/zombico/mojulo/blob/v3.0.0/control/CHANGELOG-2.x.md).
