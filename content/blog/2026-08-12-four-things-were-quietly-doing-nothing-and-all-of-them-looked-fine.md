---
title: "Four Things Were Quietly Doing Nothing and All of Them Looked Fine"
date: 2026-08-12
category: Homelab
summary: "Extending a Stream Deck plugin fork with Stream Deck+ dial support, resolving an upstream UIController bug, migrating runsheet git remotes, and fixing drift checker search roots."
---
Plugin day plus housekeeping. Forked the Claude-usage Stream Deck plugin for dial support, and the infra audit kept finding things that looked healthy while doing nothing.

## The Fork

Upstream is MIT. Fork keeps all 47 commits + remotes, not a detached copy. Verified the committed bundle byte-identical against fresh source build before touching anything. Renamed the namespace to `me.n5hq.claude-usage`.

Upstream pulls `sdpi-components` from a third-party CDN at runtime into a panel showing account emails, orgs, tier metadata — no SRI. Audited 4.0.1 (plain WebSocket, no stray telemetry), vendored it in. No more runtime CDN in my config surface.

Dial features for Stream Deck+: rotate cycles metrics, press forces refresh, tap strip advances metric, per-dial persistence via `setSettings`, custom 200×100 landscape renderer for the dial screen. CI gate enforces typecheck + tests + bundle reproducibility + manifest validation.

## The Upstream Bug With No Error

v1.7.0 per-key profile selection is dead on arrival. It calls `streamDeck.ui.current?.sendToPropertyInspector(...)`. But `@elgato/streamdeck` v2.1.0 has no `current` on `UIController`. Optional chaining shrugs to `undefined` — no log, no throw. Dropdown gets zero options, feature silently absent. Confirmed in `dist/plugin/ui.js`: `get action()` and `sendToPropertyInspector()` exist, `current` doesn't. Fork calls `streamDeck.ui.sendToPropertyInspector(...)` directly. Works.

## The Mirror That Published Behind My Back

Pushed to the GitHub mirror, upstream's `semantic-release` workflow woke up: read conventional commits, bumped minor, committed back as `semantic-release-bot`, tagged `v1.8.0`, published a release. Problem: Forgejo is authoritative, GitHub is a force-pushed mirror. Next sync would've overwritten that commit orphan.

Fix: deleted `release.yml`, kept `ci.yml` read-only, preserved `v1.8.0` + tag and pushed them to Forgejo as the real home.

Security pass over upstream history: bundles build byte-identical, network only ever `api.anthropic.com`, system exec scoped to one fixed-arg macOS Keychain query via `execFileSync`. `sharp` drags libvips advisories into local installs but ships nowhere — release bundle is SDK + `ws` + `zod`. Undocumented Anthropic endpoints remain the maintenance risk. Noted.

## Runsheets Moved, Backups Didn't Follow

Runsheet repo's bare remote lived on pve01 — same physical host as the working tree, non-redundant disk. Migrated authoritative remote to Forgejo on pve02 (private), verified SHAs on both branches, kept pve01 as secondary.

Then the `03:30 forgejo-backup` job stalled: it still aimed at the legacy host address after Forgejo moved containers — non-zero exits, and granular SQLite dumps quietly stopped. Nightly cluster vzdumps still covered full snapshots, so nothing was unprotected, but per-DB dumps had been dead. Repointed config + healthchecks at the live container address.

Drift checker lied clean for a day: `git.n5hq.me` served 200s while docs still claimed 502. Two causes: the forbidden-string regex missed phrasing variants (broadened + negative-control tested), and the checker only scanned the vault tree — operational state lives in the adjacent memory tree it never looked at. Now scans both; verified by planting + removing test assertions.

Also caught `${VAR:-UNSET}` printing my GitHub PAT into transcript logs instead of testing existence. Token out of plaintext CLI config, into secret storage, swept.

Dial integration landed in `me.n5hq.claude-usage`, upstream defect isolated, remotes moved, backup target fixed, drift scope widened, tokens contained. Four quiet failures, all green on the surface.
