### The plugin's last 3.1 leftover goes, and 3.2's size is said before it is measured

- **The Claude plugin drops its `inference-worker` skill.** It answered the parked inference tasks of mojulo apps, a
  surface retired from the tool list in 3.1; the `run-inference-worker` catalyst and the agent-task queue stay for any
  host that drives them. plugin.json moves to `3.2.0-rc.3` so an installed copy updates.
- **The 3.2 package is about twice 3.1.1's**, and the plugin README and `docs/tech-requirements.md` say so beside
  3.1.1's measured figures (a pack from source: 22.3 MB tarball, 68.7 MB unpacked); the published 3.2.0 is measured at
  the release.
- **A 3.2.0 release summary is drafted** (`changelog/release-3.2.0.draft.md`, read by no tool and not shipped), with
  the release-day checklist: the parked engine-handoff plan to delete, the detailed log to move to
  `CHANGELOG-3.2.md`, the version pins, and the plugin agents' release lists to empty.
