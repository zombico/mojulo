### The test suite, once

CI ran the whole suite four times a run, on node 22.14.0, 22 and 24 and on macOS, and the realistic hero's body was
rebuilt in every test file that asked for one. Nothing a user sees changes.

- **The whole suite on one leg.** Node 22 on Ubuntu runs the whole suite, the deep sweeps and the bundled recipe book,
  in three shards. The other legs (the engines floor 22.14.0, node 24, macOS) run what can differ by runtime: the
  critical tier, which carries every byte pin (node 24 still without them), the database and its native module, the
  MCP surface and the install scripts. Geometry is pure JavaScript; its byte pins still run on every reference leg.
- **The realistic body built once per run.** A realistic hero's slice and head cost tens of seconds and were kept in
  memory, but each test file starts with an empty memory. Under test the keeps now have a second shelf on disk
  (`lib/util/kept.js`): the runner names a folder for the sources' hash, a miss in memory reads it before building and
  writes what it built, serialized as the structured clone the keeps already read, so a kept body is the built one bit
  for bit. Without `MOJULO_KEPT_DIR` (every install) nothing touches the disk. `MOJULO_KEPT=off` turns it off under
  test.
