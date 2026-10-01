---
{
  "id": "muse",
  "name": "Meta Muse",
  "summary": "Shell-driven agent on a persistent Linux VM with npm and node ≥22.14, no MCP client: mints through `npx mojulo call`, checks renders in the VM's own Chromium, hands pages back through Artifacts and files through the Library; native image gen as the paint worker; cron as the scheduler.",
  "version": 1,
  "artifactTarget": "~/workspace/skills/<slug>/SKILL.md",
  "schedulingMechanism": "cron (in-agent scheduler)",
  "secretsPosture": "never read a .env directly — list_env names an app's keys, never values",
  "supportsClientInfoHint": []
}
---

# Muse adapter

Rider for Meta Muse: a personal AI agent running on its own persistent Linux VM. No MCP client exists on this host — the npm-CLI `call` surface is the product, not a fallback. Read `generic.md` for the baseline contract; what follows is Muse-specific.

## Connection

No MCP registration exists here — skip `init` entirely.

```
npm i mojulo                       # once, as a local dependency; or per-command:
npx -y mojulo@<ver> orient          # initialize preamble for a fresh working context
npx -y mojulo@<ver> call <tool> --json '{…}'
```

Start every fresh context with `orient`. The CLI is a first-class surface (`orient`, `tools`, `packs`, `help <tool>`, `call <tool> --json`); it is not a hack around a missing transport. Export `MOJULO_HOST=muse` in the shell profile: each `mojulo` call is a fresh process, and that variable is how mojulo knows it is on Muse — export results name the doors below, and `get_adapter` returns this card.

## Tool discovery

No MCP introspection on this host. The CLI is the discovery surface: `npx mojulo tools`, `npx mojulo packs`, `npx mojulo help <tool>` (a local `npm i` does not put `mojulo` on PATH). Never recommend `node control/scripts/mcp-stdio.mjs` — that is repo-development tooling and requires a checkout this VM will not have.

## Artifact target

Materialize reusable work as `~/workspace/skills/<slug>/SKILL.md`. That is the per-VM distribution unit; there is nothing global to install into and no shareable skill format on this host today.

## Persistence

One VM behind every client (iOS, web, macOS). `~/.mojulo` survives between conversations; workspace files survive; `/tmp` does not. State may accumulate across sessions by design — recipes and installed packages persist, so prefer re-minting from a saved recipe over re-deriving.

## Verification

The VM's own Chromium is how a render gets checked, and it cannot reach the internet: check local files, never a remote URL.

- **mojulo's renders** use it when `MOJULO_CHROMIUM` points at the binary. The VM image ships Chromium at `/opt/meta-chromium/chrome`; if a VM ever lacks it, find the binary first (`ls /opt/*/chrome`, `command -v chromium`). Without the variable, an explicit render downloads Chrome for Testing instead. Export it in the shell profile beside `MOJULO_HOST`. Sessions run as root, where mojulo launches Chromium without its sandbox on its own.
- **Your own screenshots over CDP**: launch with `--remote-debugging-port`, `--allow-file-access-from-files` and `--no-sandbox` (a sandboxed launch as root fails outright), and load pages from `file://`.

## Handing back exports

`export_model` with `format: 'html'` writes one page per call, so call it twice:

- **Default, `world.html`**: three.js ships as inline `data:` modules. No server, no network — the build to check here. Fragile on some mobile viewers, so not the one to hand over.
- **`cdn: true`, `world.cdn.html`**: three.js loads from the pinned CDN. The build for the page door. It draws black in this VM's offline Chromium, so never check with it.

Then the doors:

- **Page door: Artifacts.** Save `world.cdn.html` with your Artifacts tool; the operator opens it in their Library's Artifacts tab (on the web, `/artifacts`). Publishing gives it a public link anyone can open and asks the operator for a one-tap approval, so publish only when they want that link. Artifact pages are static and never update on their own: save again after a re-export.
- **File door: the Library, which shows only `.html`.** A file copied into `~/workspace/your_files/` lands in the operator's Library, but the Library lists `.html` files only. Every other type mojulo writes (zip, glb, stl, 3mf, usda, usdz, scad, wav, mid, json) was probed and none surfaced. A 30 MiB `.html` has made the trip intact; no ceiling is known (the ~25 MB limit is on chat attachments into the VM, not this door). Expiring public links serve third parties (not on confidential VMs). Chat file links carry no share token — don't hand those out.
- **So files leave as the bundle's folder page.** `export_model` with `format: 'bundle'` writes the zip (the self-contained page, the mesh, STL for literal kinds, recipe, README) and, beside it, `<ref>.courier.html`: one page that lists the export's files under `outcomes/<ref>/`, each with its own Save, plus Save-all for the zip. Copy that page into `your_files/`. Inside the Library's own viewer a page cannot start a download, so the operator downloads the page and opens the copy on their device, then saves any file; the page says so itself. The unzipped `world.html` opens offline.

## Dry-run, secrets, scheduling

A materialized skill demonstrates its dry run as its first step: pull one real record, render the full destination payload, write nothing; `liveMode: true` in `<skill-dir>/config.json` goes live. Never read a `.env` directly — `list_env` names an app's keys, never values. Long render pipelines go on the in-agent cron scheduler.

## Handoff note

With `MOJULO_HOST=muse`, every written export (`export_model`, `export_game`, `cook`) returns a `handoff` that names these doors — save the page to Artifacts, copy the bundle's folder page into `your_files/` — instead of the generic sentence. A file with no folder page gets a note naming the bundle rather than a copy the Library would hide. This host has one row (its VM), so `MOJULO_SURFACE` is not needed.
