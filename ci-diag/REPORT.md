# 3.0 determinism fix — report (branch `ci-diag/fix`)

## The answer

**Yes, on x64: every pinned 3.0 output is now byte-identical across Node 22.12.0, 22.23.2 and 24.8.0.**
The same pins also hold on **Linux arm64** under all three Node versions. That was run here under qemu-user with the
official linux-arm64 Node builds; vitest itself ran on arm64. **macOS arm64 is not verified**: no Mac was available.

Full suite on Linux x64 (`npx vitest run`, every test file):

| | Node 22.12.0 | Node 22.23.2 | Node 24.8.0 |
|---|---|---|---|
| faefe40 (before) | 65 failed | 61 failed | 58 failed |
| ci-diag/fix (after) | 11 failed | 4 failed | 4 failed |

**The 4 failures left on 22.23.2 and 24.8.0 come from this machine and also fail at faefe40:**
- `motion/world-traversal.test.js` (3): no Chromium-family browser is installed here.
- `worlds/world-scene.kinds.test.js` (1): a local-only snapshot (`skipIf(CI)`). It prints the same hashes before and after
  the fix, on both Node versions. That was checked by the independent review.

**On 22.12.0, seven more tests fail, the same ones before and after the fix.** The cause is a separate bug (§8):
better-sqlite3 13.0.3 segfaults on Node < 22.14. The seven are `scripts/mcp-config` (3), `mcp-install`,
`mcp-stdio.boot-guard`, `lib/mcp/carve-boundary` and `plugin-profile`; each spawns a CLI that opens the DB and dies.
Another 1,982 DB-dependent tests are reported as skipped on 22.12.0, also before and after.

**Before the fix, Linux x64 reproduced CI exactly:** all 54 failures CI reports on ubuntu x64, on every Node version.
Node 22.23.2 also had three 30 s timeouts under 4-worker load (`compose-world.metro` "the dice", and two
`update-sketch.solid` anime-hero tests). They pass after the fix; see §10.

## 1. Root cause (measured)

There are two independent sources of divergence. Both are 1-ulp differences in V8's `Math`; nothing else differs.

1. **Node version: `pow` only.** V8 13.6 (Node 24) enables `--use-std-math-pow` by default.
   - **What changes:** `Math.pow` and `**` call the platform's C library `pow` (glibc on Linux, Apple libm on macOS),
     except that y==2 gives x*x and y==0.5 gives sqrt
     (`deps/v8/src/numbers/ieee754.cc` in node v24.8.0).
   - **What Node 22 does:** V8 12.4 uses its own fdlibm port, now `base::ieee754::legacy::pow`.
   - **How often they differ:** on x64, Node 22 and 24 differ on about 10% of random `pow` inputs. Example: `10 ** -4` is
     `3f1a36e2eb1c432c` on Node 22 and `3f1a36e2eb1c432d` on Node 24.
   - **No other function differs** between 22.12.0, 22.23.2 and 24.8.0 on the same CPU.
2. **CPU.** V8's C++ fdlibm is compiled with fused multiply-add on arm64.
   - **Affected functions:** sin, cos, tan, asin, acos, atan, atan2, exp, expm1, log1p, log2, sinh, cosh, tanh, and pow
     on Node 22. They differ from x64 on 0.02–1.4% of inputs.
   - **Unaffected:** log, log10, cbrt and hypot never differed.
   - **Linux arm64 is not the same as macOS arm64.** Linux arm64 (gcc) diverges on different inputs from macOS arm64
     (clang). For example, plants.char schefflera prints three different hashes on macOS arm64, Linux arm64 and x64.
     So no "divergent call site" list built on one machine can be complete. The fix treats every transcendental
     call on a 3.0 output path as divergent.
   - **NaN bytes:** V8's NaNs also have a different sign bit on x64 and arm64.

**The unverified lead was right.** V8's legacy pow computes `r = z*t1 / ((t1-2) - (w+z*w))`, where fdlibm's e_pow.c has
`(z*t1)/(t1-2) - (w+z*w)`. With V8's grouping swapped in, a faithful fdlibm port reproduces Node 22's `pow` bit for bit
on all 203,480 inputs tested.

**Ruled out** by recorder flags, a platform probe and static scans of every reached module:
- `Array.prototype.sort`: every comparator is numeric. One returns NaN for ∞−∞, which is a consistent preorder.
- localeCompare and Intl: never reached, so ICU 76.1/78.2/77.1 don't matter.
- `Math.random`, Date and platform reads.
- WASM: Manifold is loaded, but no pinned path uses it.
- zlib: deflate output was identical across the three Node builds and both CPUs.

## 2. The fix

| commit | what |
|---|---|
| `Math: dmath, …` | `control/lib/util/dmath.js`: FreeBSD msun / fdlibm ported to + − × ÷, sqrt, abs, floor, trunc and Float64Array/Uint32Array word reads. Exports sin cos tan asin acos atan atan2 exp expm1 log log1p log2 log10 pow cbrt hypot sinh cosh tanh with `Math`'s signatures and special values. Every NaN is `7ff8000000000000`. On x64 it is V8's Math bit for bit except `pow`, which keeps fdlibm's correct grouping. `hypot` is V8's own Torque algorithm, so it equals `Math.hypot` on every V8. The test pins golden digests (the cross-platform contract), checks special values, checks 200k seeded inputs per function against Math, and scans the source for forbidden operations. |
| `NOTICE: …` | fdlibm and V8 notices. |
| `Math: math-scope, …` | `control/lib/util/math-scope.js`: `SM` is the engine's `Math` unless the build runs inside `withMath(dmath, build)` (synchronous only; async builds are refused). `mathKey()` gives a cache-key suffix (`''` outside a scope, so existing keys don't move). |
| `Shared builders: …` | 24 modules from 2.1.0 that 3.0 generators also reach now call `SM.fn` instead of `Math.fn`: figure pipeline, lathe, sweep, extrude, floor-plan structure and building assets, plants, taiji, vehicles, pedestrian and cyclist assets, statue figure, scene-css3d. Outside a scope `SM` is `Math`, so no 2.1.0 output can move. The review confirmed that reverting `SM.`→`Math.` restores faefe40's source, apart from cache keys and two `**`→`SM.pow` (`**` and `Math.pow` gave identical bits on 6M inputs on both Node versions). |
| `Plants and terrain: …` | vegetation engine, terrain world and painted-landscape erosion (all new in 3.0) switched whole-file to dmath. A literal `** 2` / `** 0.5` stays, since every V8 path computes those exactly. The page kernels (`*-kernel.js`) are left alone because the World page inlines their source. |
| `Anime head and hero: …` | anime-form, anime-head, anime-sculpt, hero-*, humanoid-*, station-loft-* and wire-svg switched to dmath. Hero form's figure cast and the rig's vajra pose run under `withMath(dmath)`. |
| `Stores and construction: …` | construction and retail switched to dmath. `lowerFrame`, `buildStandaloneStore`, `fitOutFromConcept`, the mall's `cardBayFaces` and the store world are scoped. |
| `Cities and landmarks: …` | canal town, round kit, metro refacade, Tian Tan Buddha and metal surfaces switched to dmath. `fractal-city`, `building-facade` and polygonizer `materials` (2.1.0 files) read `SM`. A metro or canal recipe plans, assembles and tiles inside the scope, as do refacade and the Buddha. A stock recipe never enters it. The cyclist bake, Buddha head and pedestrian geometry caches key on `mathKey()`. |
| `Chromium: …` | test fix (§7). |
| `Changelog: …`, `Review fixes: …` | Unreleased `### Deterministic math`. The review fixes scope the streamed city page and terrain cities, and key the mannequin cache on `mathKey()`. |

**How files were chosen.** A file new since v2.1.0 was switched whole, not just its call sites that diverged here,
because the Mac diverges on other inputs (§1). A 2.1.0 file was never given dmath directly; it reads `SM`. The
`withMath` entry points sit in 3.0 code only (`fractal-city` scopes metro and canal recipes, which don't exist at 541daae).

**Why a scope rather than a parameter.** The store and city reach the shared helpers through deep 2.1.0 call chains
(store → fixture → building asset → workbench → lathe-faces → lathe; store-cast → figure-render → figure-proto/head/…).
Threading a `math` parameter would change every intermediate 2.1.0 signature. All three family investigations
independently converged on the same scoped design.

## 3. Divergent functions and call sites (Phase 1)

Each family was recorded per call site under Node 22.23.2 (sampled inputs, exact call counts), re-evaluated on x64 and
arm64 for all three Node versions, and checked against `git log 541daae..faefe40` and `git blame`.

| family | divergent sites (here) | functions | provenance | treatment |
|---|---|---|---|---|
| plants / terrain | 62 of 257 executed | pow (Node), cos sin exp asin acos atan2 (CPU) | all in files new in 3.0 (vegetation `cbc57db`, terrain-atlas `75de35d`, terrain-plants `1c3ad96`, erosion `6ef26e0`) | whole-file dmath. `face-mesh.js:32` (sRGB `pow 2.4`, 2.1.0) left: its output is rounded to float32 with ≥ 471,495 ulps of margin on all 989 inputs |
| anime / hero | 67 (63 new, 4 shared) | pow (Node), sin cos exp atan2 acos (CPU) | anime-form `b6814e6`, station-loft `90fffba`/`80d6be1`; shared: figure-vajra 193/204, figure-posing 82–93, figure-cast 209 | dmath + scoped figure calls |
| buildings | 28 (26 shared, 2 new) | sin(9π/8) `400c463abeccb2bb` → x64 `…961`, arm64 `…960` (lathe 212, sweep 90); figure pow/sin/atan2/acos | lathe, sweep, figure-*: 0 commits since 541daae; prims.js new | store scoped; prims dmath |
| city / landmarks | 73 | car `pow` (vehicle-swept-net 783/902, 99% of metro divergence), fractal-city metro lines, refacade, figure | metro/canal/refacade/Buddha new in 3.0; cars, figures, landmarks/index are 2.1.0 | 3.0 code dmath or scoped; stock untouched |

Hex samples: x64-22 / x64-24 / arm64-22 / arm64-24.
- `grow.js:142` `pow(3ffe666666666666, c01c000000000000)` (1.9^-7) → `…1a / …19 / …1a / …19`.
- `bamboo.js:259` `sin(3fd946880a87fbba)` → x64 `3fd89fa31fee0068`, arm64 `…69`.
- `station-loft-shade.js:417` `pow(3fb42d52a7b8d11d, 3fe6666666666666)` → `3fc59e8c78f59be6 / …e7 / …e6 / …e7`.
- `fractal-city.js:2182` `k ** 1.5`, `pow(3fd2fa791bc78d19, 3ff8000000000000)` → `3fc4ab63b3034d3c / …3d / …3d / …3d`.

**The four Rosetta extras on real Linux:**
- `version/distribution`: passes on all three Node versions.
- `semantic-search-hints`: passes; it only fails outside a git checkout.
- `compose-world.metro`: passes, but "the dice" uses 18–25 s of its 30 s timeout. That is the likely Rosetta failure.
- `world-traversal`: needs a Chromium binary.

## 4. Pins changed (old → new; new values verified on x64 22.12.0, 22.23.2, 24.8.0 and Linux arm64 22.23.2, 24.8.0)

| test | old (macOS arm64, Node 24) | new |
|---|---|---|
| plants.char oak / beech / fir / schefflera / coconut / vulgaris (unlit, lit) | `c5851c572e526566 4c2448e506ec5b70` / `74909ededd5fe69b c0bc5d3d5cd3ff9c` / `53c9e737f225c476 2994f6041e29634b` / `513879ffe50dbddc 58b43fa5667e80c7` / `a14977e2d8cc1ff0 672b9832bac7ada1` / `543915f8e1eb620d 7a2037ef2e515350` | `625e6a0db2b6ce27 02c0e3e50599282b` / `c1a57167e93963aa 3bf8a1438fcb8cbc` / `9d5ee347655cec4e 60a0a605bbacdf4a` / `78de85942741b097 5fbd29de5d48950d` / `623478a079a65197 2eebf6c673ac1140` / `13d46384deb36cb6 4c9668eaa30f053e` |
| plants.char terrain without / with plants | `6dccdaca111730cc 4fe1f2be3ad77788` | `91ba2043f00b8c5b 4704c5b175ffd28b` |
| anime-form.fixture.json (9 cases × every part but `mouth`; shared by anime-form and anime-form.neutral) | studio digests | port on dmath; all-cases digest `bf2491d3c428a1e3` on all six runtimes |
| station-loft-shade, female World chain (waved, timed, full, undone × default / at rest / studio's face) | `063cfada165cf26e 1f8dfbdcce521acf 6638d7faece840ed c68d9dd2daf9c0a2` / `630a37bd22646386 66c1c69f1281f783 97f568810e02d624 48503d1cf2fbf351` / `ca4dc4c0c5a22cfa 68c433eae5b44629 dd03f27f734e5ac1 7232081e0d783020` | `a0cf31d82d429668 2585a16cdc02ae53 ffb8d37bc08d16ba f5deaea4120a546a` / `920af4172d6e2312 ad90336ddc2cc553 4c3754af7646aa9e 2887b27d6e938552` / `1e426997d5069890 2ff2e9f55796d955 1fdf3c90d77c935c 755ab3593db17ff7` (male chain and hair-base pins unchanged) |
| store.char department / wine-bar | `27d96b5aff9e269c` / `44081827e1086187` | `2e64afaa21fea7a5` (what x64 always printed) / `50db283660598df9` |
| round-kit release bytes metro / canal (plan, scene) | `c5723b2790856ae9 569a4126a4bbe6b2` / `2208cfcbe452b8aa ff4f5cd9fceafbea` | `26b0d6c6b877c6a9 6b49c70b58c27743` / `ac25ab8725ed7b8b add9ac7d16bc797e` |
| refacade tian-tan-buddha (stock) | `4c4f20c3c5d1577b` | `b58c7c0c31563e0a` |

**Anime studio claim.** The fixture recorded hashes of the studio's own `model.js`, frozen on macOS arm64's native
Math. That file is not in the repo or its history. The fixture is now the port's own output on dmath; it keeps
`studioSha256` and says so (`source`, `studioFrozen`). The headers of anime-form, the test and the humanoid docs say
the same. **To restore the independent check:** load the studio's unedited `model.js` with
`Math.sin/cos/tan/acos/atan2/exp/pow` bound to dmath (restore them afterwards). Assert that every `**` in it has
exponent 2, and re-freeze. If the port is faithful, the digests come out equal to the current fixture.

## 5. Outputs that cannot be deterministic without changing 2.1.0 bytes

These pins capture output of **2.1.0 generators** that already differed by platform at v2.1.0. This was measured by
running 541daae on x64 and arm64. Under the hard rule they keep `Math`, so their pins now record each platform's bytes.

| pin | why | treatment |
|---|---|---|
| floorplan-furnish "generated seed plan, furnish:true" | the kitchen-sink faucet (`sweep-faces.js:90`, sin(9π/8)); v2.1.0 plan seeds 1, 5 and 11 differ by CPU the same way | per arch: x64 `ad42369b…5fd8`, arm64 `4e11a264…da22` (the old pin; Linux arm64 reproduces it on all three Nodes) |
| facades "condo plain, seed 7" | condo plants (`lathe.js:212`) | per arch: x64 `01b1bd7f413d0758`, arm64 `97b66d5824337228` (old pin) |
| refacade stock: taj, cn-tower, skytree, colosseum, petronas-towers, mobile-edm-hall, cloud-gate, rizal-monument, rotunda-bulbous | landmarks/index.js stock builders (arm64 FMA) | per arch: x64 values in `STOCK_X64`, arm64 = old pins (Linux arm64 both Nodes; Mac CI on Node 22 passed them) |
| refacade statue-of-liberty; round-kit stock city (plan, scene) | also depend on Node's `pow` (car `pow` in the stock city) and, for the stock scene on Node 24, on Apple libm | per platform-arch-Node-major table with only measured entries: linux-x64-22/24, linux-arm64-22/24, darwin-arm64-24 (the old pins). **No darwin-arm64-22 entry**, so CI macos (Node 22) reports these as *skipped*. Record those two values on a Mac with Node 22. |

**Alternative, your call.** dmath equals x64 V8 for everything but `pow`. So switching `lathe.js` and `sweep-faces.js`
to dmath for every caller would move **no x64 byte** in these cases, and would bring arm64 onto x64's bytes. It would
change minted rows on arm64 machines (yours included), which the hard rule forbids, so it was not done.

## 6. What is still on the engine's Math in 3.0 outputs (found by the review; not covered by any pin)

- **Built outside any scope:** metro World walkers and cars (`attachCityCars`/`attachCityWalkers` in world-kinds build
  after an `await`), the `buildMall` structure, and `ifc.js` → `structurizeHouse`.
- **Unconverted 2.1.0 helpers that scoped builds reach:** vexar specular `pow`, face-mesh sRGB `pow`, field-terms,
  surface-textures (memoised by texture key), ao-bake, workbench fixed camera angles, roads.
- **Page kernels** (`atlas`/`terrain`/`vegetation`/`grass-kernel.js`). The World page inlines them as source, so they
  can't import dmath. `vegetation-kernel.js` uses cos/sin for plant placement, and they also run in Node for exports
  (`plantsBake`).
- **Import-time constants** in shared modules (car-window outlines, `CRESCENT_CLIP`, two figure-vajra rotations).
- **New stock mints** (3.0 stamps `roundKit: true`) still run the 2.1.0 generator. Bringing them into scope needs a
  recipe marker.

**Next step for these.** Convert the remaining non-serialized helpers to `SM` (no 2.1.0 change), key their memos on
`mathKey()`, and pass the math explicitly into the async attach paths.

## 7. Chromium test

`chromium.plugin-profile.test.js` planted the macOS Chrome path, but `systemCandidates()` only probes it when
`process.platform === 'darwin'`. The test now plants the running OS's first candidate path, as `chromium.test.js`
already does. It passes on all three Node versions, and with `process.platform` forced to darwin, win32 and linux.

**Production `resolveChromium` has no Linux bug** for what the test covers. Verified in a private mount namespace
with a real Chromium symlinked at `/usr/bin/chromium`, `google-chrome` and `chromium-browser`: each resolves and
launches. A minor wording gap: the error suggests Brave, which has no Linux or Windows candidate path, and Edge is
only found as `/usr/bin/microsoft-edge`.

## 8. Separate finding: better-sqlite3 on Node 22.12.0 (not fixed here)

- **The mismatch:** every better-sqlite3 13.0.x prebuild declares Node-API version 10. Node < 22.14.0 supports 9.
- **The crash:** Node v22.12.0's `napi_module_register_by_symbol` dereferences the null env returned after
  `ThrowNodeApiVersionError` (seen in gdb). So the first `new Database()` segfaults; `mojulo orient` exits 139 with no
  output.
- **Where it happens:** bisected with exact Node builds, it crashes on 22.12.0 and 22.13.1 and works on 22.14.0+.
- **Scope:** v2.1.0 is equally affected (same `^13.0.3`, same lockfile integrity).
- **Options:** raise `engines` (and the stdio floor) to `>=22.14.0`, or pin a better-sqlite3 that declares Node-API 9.

## 9. Benchmark (`ci-diag/bench-dmath.mjs`, 1e6 calls per function, best of 5, x64, idle machine)

dmath ÷ Math time:

| | sin | cos | tan | asin | acos | atan | atan2 | exp | expm1 | log | log1p | log2 | log10 | pow | cbrt | hypot | sinh | cosh | tanh |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Node 22.23.2 | 2.27 | 1.44 | 1.58 | 1.04 | 1.09 | 1.02 | 1.95 | 1.13 | 1.08 | 1.09 | 1.08 | 1.19 | 1.35 | 1.16 | 1.67 | 0.66 | 1.39 | 1.36 | 1.38 |
| Node 24.8.0 | 2.27 | 1.53 | 1.51 | 1.22 | 1.07 | 1.03 | 1.95 | 1.09 | 1.04 | 1.10 | 1.06 | 1.20 | 1.48 | 3.20 | 1.71 | 0.94 | 1.56 | 1.60 | 1.50 |

dmath costs 30–70 ns a call. The plants characterization test went from about 46 s to about 70 s under load. The
anime and metro tests stay inside their timeouts on this machine.

## 10. Gates run (this machine, Linux x64)

- **Full suite** on all three Node versions, before and after: the table above.
- **Pinned tests on Linux arm64** (qemu; vitest threads pool or plain-Node harnesses):
  - plants.char, the anime fixture: Node 22.12.0, 22.23.2 and 24.8.0.
  - store.char, the condo and seed-plan pins, round-kit release bytes, refacade stock boxes, the anime hero World
    chain (26/26), dmath.test (218/218): Node 22.23.2 and 24.8.0.
  - All pass.
- **README example** (`compose_world` city, seed 11, metro, new-york): the plan and scene hashes are now identical on
  Node 22.12.0 and 24.8.0, `fbcb9e56810704d6` / `44fe762f51ac2dbb`. Before the fix they differed between Node 22 and 24
  even on one x64 host.
- **Lint gates:**
  - `node --check` over `control/**/*.{js,mjs}`: clean.
  - Locale validator for every non-en catalog: clean.
  - `node control/scripts/check-plugin-version.mjs --expect 3.0.0`: plugin.json, glama.json and server.json all
    `mojulo@3.0.0`.
- **`scripts/smoke.sh`:** see the last line of this report.
- **Size pins:**
  - `PAYLOAD_CEILING` (267_588) and the packs, description, routing and rules ceilings are unchanged; a lib file
    can't affect them.
  - No test pins the tarball size.
  - `pack-boundary` allows `lib/graph` to import `lib/util`.
- **Timing risk, pre-existing:** `compose-world.metro` "the dice" uses 18–25 s of 30 s, and timed out under load
  *before* the fix too. Consider a larger timeout for it.
- **Independent review** (a fresh agent):
  - No 2.1.0 output changed. Every test that passed at faefe40 on Node 24.8.0 passes on this branch; one was renamed.
  - Its six findings were fixed or are listed in §6.

## 11. Not verified

- **macOS arm64** (your Mac, and CI macos with Node 22). Linux arm64 is a proxy, not a copy: it reproduced the Mac's
  pins for some outputs and not others. dmath is engine-independent by construction, and its golden digest is the
  check. Run `npx vitest run lib/util/dmath.test.js` first, then the re-pinned files.
- **Windows** and other engines.
- The studio fixture re-freeze (§4).
- Recording the darwin-arm64-22 values for the two platform tables (§5).

## 12. README wording that stays true

- **Line 174**, "Each URL regenerates deterministically on request — geometry byte for byte across platforms; …", is
  not true for every kind (§5, §6). Suggested:
  "Each URL regenerates deterministically on request, byte for byte on the machine that minted it; recipes from 3.0's
  generators (plants and terrain, the anime hero, stores and construction, metro and canal cities) regrow byte for byte
  on any CPU and Node version; …"
- **Line 162**, "keep it and the same city regrows on any machine", holds for the example as written: the metro
  recipe's plan and scene are now the same on all five Linux runtimes measured. It holds on the Mac if dmath's digest
  matches there. With `context: { time: 'night' }`, the lighting still uses an unconverted helper (§6).
- **The README's three "re-mints byte for byte" lines** (README.md:50, control/README.md:5, :121) carry the same caveat
  as line 174.

`scripts/smoke.sh` (Node 22.23.2): install, bare-install CLI, `next build`, control plane boot and `/api/health` 200 — all checks passed.
