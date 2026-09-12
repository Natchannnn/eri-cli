---
title: "Stream Deck Plugin Fork: Dial Support, Upstream Bug Isolation, and Repository Housekeeping"
date: 2026-08-12
category: Homelab
summary: "Extending a Stream Deck plugin fork with Stream Deck+ dial support, resolving an upstream UIController bug, migrating runsheet git remotes, and fixing drift checker search roots."
---
Today's development focused on extending a Stream Deck plugin fork for Claude usage metrics, alongside auditing infrastructure housekeeping tasks across git remotes, backup scripts, and documentation drift checks.

## Forking and extending the Stream Deck plugin

The upstream plugin is MIT-licensed, and the fork preserves all 47 upstream commits and remote tracking rather than maintaining a disconnected copy. Before introducing modifications, the committed bundle was verified against a fresh source compilation, yielding a byte-identical match.

The plugin namespace was migrated to `me.n5hq.claude-usage` to avoid collisions with the upstream package.

To mitigate third-party supply chain risk, the property inspector dependency was vendored: upstream was pulling `sdpi-components` from a third-party CDN at runtime into a configuration panel displaying account emails, organizations, and tier metadata without subresource integrity (SRI). Version 4.0.1 was audited—confirming standard WebSocket communication without unauthorized telemetry—and vendored directly into the repository.

Feature development centered on adding Stream Deck+ dial support:
- Rotating the dial cycles through monitored metrics.
- Pressing forces an immediate telemetry refresh.
- Tapping the touch strip advances to the next metric.
- Selections persist on a per-dial basis via `setSettings`.
- A dedicated 200×100 landscape renderer was built for the dial display.

A preflight CI gate was added to enforce TypeScript type-checking, automated test execution, bundle reproducibility, and manifest schema validation.

## Isolating an upstream UIController defect

Analyzing upstream v1.7.0 revealed an implementation defect in its per-key profile selection feature.

The upstream implementation invokes `streamDeck.ui.current?.sendToPropertyInspector(...)`. However, `@elgato/streamdeck` v2.1.0 (the version pinned in `package.json`) does not define a `current` property on `UIController`. The optional chaining operator silently short-circuits to `undefined` without logging an error. Consequently, the property inspector profile dropdown never receives options, rendering the dropdown empty and the feature inaccessible.

Inspecting `dist/plugin/ui.js` confirmed that the compiled bundle defines `get action()` and `sendToPropertyInspector()`, but lacks `current`. The fork patches this by calling `streamDeck.ui.sendToPropertyInspector(...)` directly.

## GitHub push-mirror release workflow pruning

Pushing the fork to its GitHub mirror triggered an automated release workflow inherited from upstream. The `semantic-release` action evaluated conventional commit types, generated a minor version bump, committed back to GitHub as `semantic-release-bot`, tagged `v1.8.0`, and published an attached release artifact.

Because Forgejo serves as the authoritative git forge and GitHub functions as a read-only mirror subjected to forced pushes, automated commits directly on GitHub risk being overwritten during mirror synchronization.

The workflow was rectified:
- `release.yml` was removed from the repository.
- `ci.yml` was retained for read-only validation.
- Version `v1.8.0` and its Git tag were preserved and pushed upstream to Forgejo.

## Upstream security review

A comprehensive security audit of upstream Git history confirmed:
- Bundles compile byte-identically from source.
- External network communication is restricted exclusively to `api.anthropic.com`.
- System execution is limited to a fixed-argument macOS Keychain query via `execFileSync`.
- Dependencies include `sharp` (which introduces libvips advisories during local npm install), but `sharp` is excluded from the compiled release bundle, which bundles only the Stream Deck SDK, `ws`, and `zod`.
- The plugin communicates with Anthropic using standard headers, though utilizing undocumented endpoints remains a maintenance consideration.

## Relocating the runsheet repository remote

The runsheet repository previously maintained its bare remote on pve01, sharing the physical host with its working tree on a non-redundant drive.

The authoritative remote was migrated to Forgejo on pve02 as a private repository. Commit SHAs across both branches were verified following migration, and the legacy remote on pve01 was retained as a secondary copy.

Auditing backup routines revealed that the `03:30 forgejo-backup` job had stalled following the migration of Forgejo to a dedicated container: the job still targeted the legacy host address, failing with non-zero exit codes. While full container snapshots remained protected by nightly cluster-wide vzdump runs, granular SQLite database dumps had ceased. The backup configuration and health checks were updated to the active container address.

## Correcting drift checker search scopes

The documentation drift detection mechanism was evaluated against recent infrastructure changes. While `git.n5hq.me` had returned HTTP 200 for a full day, drift checks continued to report false-clean statuses despite stale documentation asserting HTTP 502.

Investigation identified two separate search issues:
1. The forbidden string pattern did not match subtle phrasing variations in historical notes, resolved by broadening regex patterns and testing against negative controls.
2. The drift checker scanned only the vault directory tree, completely omitting the adjacent memory tree where operational state files were maintained.

The script was updated to search both directory trees and verified by planting and removing test assertions.

Additionally, a token expansion issue was remediated where `${VAR:-UNSET}` in a shell script printed a GitHub personal access token into transcript logs rather than checking for variable existence. The token was removed from plaintext CLI configuration and relocated to secure secret storage.

The Stream Deck+ dial integration and property-inspector isolation landed cleanly in the fork (`me.n5hq.claude-usage`), while identifying an upstream optional-chain defect in `@elgato/streamdeck` communication. Concurrently, operational housekeeping updated the runsheet Git origin, exposed a stale host reference in the granular Forgejo backup routine, expanded the documentation drift checker to cover the memory directory tree, and moved personal access tokens to restricted configuration storage.
