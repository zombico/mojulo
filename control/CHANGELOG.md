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

### Upgrading from 2.x

- **3.0.0 is the release after 2.1.0.** A 2.2 was prepared and never published; everything it carried
  is in this release. Removing the chatbot factory is why this is a major version.
- **The 2.x line is unmaintained.** No 2.x release will be patched, and running one is not
  recommended. 2.1.0 and the bot image it deploys (`mojulo-bot` 0.5.1) have known security issues: an
  open relay on deployed bots (`/api/send-webhook`), SSRF in `upload_document_from_url`, path
  traversal in the Office-document parser, Fly credentials in the machine environment, and dashboard
  DNS rebinding and cross-site writes
  ([SECURITY.md](https://github.com/zombico/mojulo/blob/v3.0.0/SECURITY.md#known-issues-in-2x)). Bots
  already deployed from 2.x run on their own, on that image, until you take them down.
- **Unpinned installs move to 3.0 on their next start once 3.0.0 is npm `latest`.** A host that runs
  `npx -y mojulo` (every config 2.x `mojulo init` wrote, the README's manual lines, and the Claude
  plugin up to 2.0.1) installs 3.0.0 on its next start, whether or not the plugin was updated. The
  3.0 plugin runs `npx -y mojulo@3.0.0`; update it, and remove any `mojulo init` or `claude mcp add`
  registration beside it (two registrations run two servers). Exact pins and a global
  `npm i -g mojulo` stay on their version until you change them. The first start downloads about
  90 MB; if the host gives up, start Claude Code with `MCP_TIMEOUT=60000`, or run
  `npx -y mojulo@3.0.0 --help` once in a terminal. Restart every host afterwards so no 2.x server
  keeps running against the same `~/.mojulo`.
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
  installed one, `MOJULO_CHROMIUM`, or an explicit render's download).
  @puppeteer/browsers 3 has no proxy support, so a host behind an HTTP proxy sets `MOJULO_CHROMIUM`.
- **Other changes a 2.x setup can notice.**
  - `mojulo init` changes nothing without `--yes` when stdin is not a terminal: it prints its plan and
    exits 2. With the Claude plugin installed it leaves Claude Code to the plugin.
  - The dashboard is its own package, `mojulo-ui` (`npx -y mojulo-ui`); `npx -y -p mojulo mojulo-ui`
    downloads the matching version on first use (`MOJULO_UI_NO_FETCH=1` refuses). It answers 403 to
    a `Host` other than loopback, `MOJULO_UI_HOST` or a name in `MOJULO_UI_ALLOWED_HOSTS`, and to a
    cross-site write, so a LAN, proxy or tunnel setup needs `MOJULO_UI_ALLOWED_HOSTS`.
  - `mint_solid` `via:'prompt'` requires `provider` and no longer picks a saved default key.
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
    `mojulo install recall` now works from npm and npx.

### What 3.0 is

- **A 3D compiler for agents.** Your agent builds objects, walkable worlds and games by conversation
  as small deterministic recipes on your machine, compiled back to the same geometry byte for byte and
  exported to STL / 3MF, glTF, OpenUSD, self-contained HTML, Godot, Blender, Unity and Unreal. The
  bot factory, which never fit that, is gone.

### Lean install

- **3.0.0 against the published 2.1.0, one method.** A cold start with an empty npm cache and a
  fresh `HOME` and `MOJULO_HOME` (`npm exec --package=<tarball> -- mojulo`) through a local registry
  stand-in, timed from spawn to the `initialize` answer, on one macOS arm64 machine (M1 Max). Sizes
  are decimal MB; "downloaded" is the unique tarballs plus the package metadata, estimated gzipped.

  | | 2.1.0 | 3.0.0 |
  |---|---|---|
  | npm tarball | 31.2 MB, 6,326 files | 5.8 MB, 1,390 files |
  | Unpacked package | 121.7 MB | 18.6 MB |
  | Dependencies installed | 539 MB, 426 packages | 228 MB, 179 packages |
  | Downloaded on a cold start | about 182 MB | about 89 MB |
  | Cold start to `initialize`, median (p90) | 12.7 s (15.7 s), 14 runs | 6.6 s (7.0 s), 10 runs |

- **Machine caveat.** The two timings come from separate sessions, 2026-09-27 and 2026-09-28, on a
  busy machine (load average 3 to 12, then 11 to 33). The unreleased 2.2 line, run in both, took a
  median 7.3 s and 7.2 s, so the sessions agree; still, trust the sizes more than the seconds, and
  expect the real registry to be slower than the stand-in. 2.1.0's package carried the dashboard
  build; 3.0.0's dashboard is `mojulo-ui` (12.1 MB packed, 55.3 MB unpacked), fetched only when it is
  opened.
- **What left the install:** the dashboard build, `@swc/core`, `three`, the dashboard-only libraries,
  `dotenv`, and the chatbot factory's `officeparser` and `pdf2json`. puppeteer-core, archiver and
  react load on first use, so the stdio server boots without them. Details:
  [docs/tech-requirements.md](https://github.com/zombico/mojulo/blob/v3.0.0/docs/tech-requirements.md),
  [Lean cold start](https://github.com/zombico/mojulo/blob/v3.0.0/control/CHANGELOG-2.x.md#lean-cold-start).

### Security and consent

- Saved provider keys are encrypted under a random per-install key (`$MOJULO_HOME/secret.key`, mode
  0600) instead of a constant in the source. The dashboard refuses DNS-rebinding and cross-site
  requests. `mint_solid` `via:'prompt'` never picks an LLM key for the caller.
- Chrome for Testing downloads only for an explicit render and says so; headless Chromium keeps its
  sandbox (on Linux it falls back only on Chrome's sandbox errors or as root); the ffmpeg download is
  SHA-256 pinned; everything mojulo writes lazily lands under `~/.mojulo`.
- `mojulo init` needs `--yes` when nobody is at a keyboard. "No telemetry" is now "no external
  telemetry", with the local tool-call log described. Core has no Docker, Fly, GHCR, webhook or
  uploaded-document code path.
  ([Security hardening](https://github.com/zombico/mojulo/blob/v3.0.0/control/CHANGELOG-2.x.md#security-hardening),
  [Runtime footprint and consent](https://github.com/zombico/mojulo/blob/v3.0.0/control/CHANGELOG-2.x.md#runtime-footprint-and-consent))

### Claude plugin and directory readiness

- Every tool carries a `title` and behavior `annotations`, `initialize` negotiates `2025-06-18`,
  `2025-03-26` or `2024-11-05`, the Claude plugin pins `npx -y mojulo@3.0.0` and its README discloses
  what the server runs, sends, fetches and writes, and under the plugin mojulo leaves out what
  conflicts with Anthropic's Software Directory Policy
  ([annotations](https://github.com/zombico/mojulo/blob/v3.0.0/control/CHANGELOG-2.x.md#mcp-tool-annotations-and-protocol-negotiation),
  [disclosure](https://github.com/zombico/mojulo/blob/v3.0.0/control/CHANGELOG-2.x.md#directory-listing-and-disclosure)).

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
- **Cities and worlds:** metro and canal profiles for the fractal city, redrawn landmarks and sacred
  buildings, stores and malls from concept cards, and large cities streamed by tile
  ([City scale](https://github.com/zombico/mojulo/blob/v3.0.0/control/CHANGELOG-2.x.md#city-scale),
  [Canal city](https://github.com/zombico/mojulo/blob/v3.0.0/control/CHANGELOG-2.x.md#canal-city),
  [Local city refacade](https://github.com/zombico/mojulo/blob/v3.0.0/control/CHANGELOG-2.x.md#local-city-refacade),
  [Retail concept cards](https://github.com/zombico/mojulo/blob/v3.0.0/control/CHANGELOG-2.x.md#retail-concept-cards),
  [World streaming](https://github.com/zombico/mojulo/blob/v3.0.0/control/CHANGELOG-2.x.md#world-streaming)).
- **Interiors:** houses minted in a style, livable default room sizes, and a furniture audit that
  gives every room a way in
  ([House styles](https://github.com/zombico/mojulo/blob/v3.0.0/control/CHANGELOG-2.x.md#house-styles),
  [Room livability](https://github.com/zombico/mojulo/blob/v3.0.0/control/CHANGELOG-2.x.md#room-livability),
  [Furniture audit](https://github.com/zombico/mojulo/blob/v3.0.0/control/CHANGELOG-2.x.md#furniture-audit)).
- **Look and drawing:** shading normals from the hull, outlines and rims carried into Godot, Unity
  and Unreal, key-and-fill art direction, and the `layered` kind drawn from its compiled mesh, with
  rigs and clips
  ([Shader look](https://github.com/zombico/mojulo/blob/v3.0.0/control/CHANGELOG-2.x.md#shader-look),
  [Art direction](https://github.com/zombico/mojulo/blob/v3.0.0/control/CHANGELOG-2.x.md#art-direction),
  [Planar drawing](https://github.com/zombico/mojulo/blob/v3.0.0/control/CHANGELOG-2.x.md#planar-drawing)).
- **Audio:** stereo and per-hit variation, tuned strings, orchestral scoring and era synths, and
  anthem and roots song styles, all synthesized from formulas and opt-in
  ([Audio fidelity](https://github.com/zombico/mojulo/blob/v3.0.0/control/CHANGELOG-2.x.md#audio-fidelity),
  [Orchestra and era synthesis](https://github.com/zombico/mojulo/blob/v3.0.0/control/CHANGELOG-2.x.md#orchestra-and-era-synthesis),
  [Anthem styles](https://github.com/zombico/mojulo/blob/v3.0.0/control/CHANGELOG-2.x.md#anthem-styles),
  [Roots styles](https://github.com/zombico/mojulo/blob/v3.0.0/control/CHANGELOG-2.x.md#roots-styles)).

2.1.0 and earlier releases, and the detailed log behind this release, are in
[CHANGELOG-2.x.md](https://github.com/zombico/mojulo/blob/v3.0.0/control/CHANGELOG-2.x.md).
