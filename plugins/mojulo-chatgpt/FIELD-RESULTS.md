# Reported ChatGPT Work test — 2026-09-29

Source: session report supplied by the user. These are reported execution results,
not independently inspected logs or artifacts. Client downloads and visual checks remain open.

- Linux x64; Node 24.19.0; npm 11.9.0; Mojulo 3.0.0.
- Supplied tarball SHA-256: `8770034c210664548081ccc2857d2dbbd9affda920ccca19ff3d86d96ec99814`.
- Two isolated installations succeeded. City `sk_chatgpt_field` created at seed 91,
  edited on the same ref to seed 92; GLB bytes changed.
- Recovery in a fresh workspace reproduced the following hashes. Repeated restore
  returned `REF_EXISTS`. This was workspace recovery within the reported session,
  not proof of recovery across separate conversations.

| Output | Reported SHA-256 | Recovery |
| --- | --- | --- |
| Recipe | `ccaae29d3ed3bc71f73124b2f5287851520b18aa7c57e861ce1bd1357aba982c` | Match |
| GLB | `38d23de2b53ac937a0f8af93c12074c84a639822926e630e81f3919b862c1bb4` | Match |
| HTML | `28ce041ff07f7bc9ed8fcf4273889b598980fd84680519e526ea89f9119237ff` | Match |
| ZIP | `1a72c0ccacaae400e469da2835317b0e2d44833c2bf6543a055d23a35c79e4b6` | Match |

Files and download links were produced for both GLBs, HTML, bundle, recipe and checkpoint.
No user click, client unzip, visible geometry or interactive HTML check was reported.
No Chromium binary was detected; that does not determine the client's preview capability.

## Friction and diagnosis

- Direct `pack_world` invocation was rejected; `exec -- call compose_world` worked.
  The Work reference now includes a complete mint example and clarifies `call` syntax.
- Missing `ms-shield.js` and `arena-atmosphere.js` warnings come from optional imports
  in `figure-render.js` and `controllable-world.js`. Both have contained fallbacks;
  the files are absent from this branch. City success does not certify those features.
- npm's `http-proxy` configuration warning was reported nonblocking; its source has
  not been independently diagnosed.

## Remaining gate

Open/download outputs on ChatGPT web and mobile, inspect geometry and HTML behavior,
and test checkpoint recovery in a separate conversation. Keep the original tarball.
The next integration milestone is an MCP Apps preview; this report does not verify it.
