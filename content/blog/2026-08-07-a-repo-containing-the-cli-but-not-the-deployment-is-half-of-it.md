---
title: "Packaging the n5-board CLI and Production Deployment Manifests"
date: 2026-08-07
category: Homelab
summary: "Deploying the Planka-backed n5-board system, separating CLI code from infrastructure units, auditing false-positive leak alarms, and scoping a public client package."
---
Resuming work on the n5-board Kanban automation stack began by reconciling session state after a week of stable operations. The nightly automations had executed without failure, providing a solid baseline to close the initial research spike and transition n5-board from experimental scripts into production infrastructure.

## Phase 0 validation wrap-up

Two validation checks remained from the July 31 spike: verifying API key longevity after generation, and confirming whether shared OAuth token background refreshes survive concurrent session execution.

The API key longevity check had been delayed because its timer container had been stopped. Starting the container and executing the test suite manually yielded a clean pass: 33 mixed API requests succeeded with zero authorization failures eight days post-generation, validating Planka as the permanent board backend over fallback alternatives.

The concurrent token-refresh soak yielded an inconclusive result. The background soak ran 66 calls across six and a half hours, reporting telemetry to Discord and the vault, but did not capture a natural refresh cycle before quota exhaustion. Rather than assuming resilience, concurrent token refreshing remains categorized as indeterminate pending further empirical observation.

## Production board deployment

With backend selection settled, Phase 1 focused on production provisioning across container infrastructure and local tooling.

The backend was deployed inside an unprivileged container on the second Proxmox node, running Ubuntu 26.04 and Planka 2.1.1 backed by PostgreSQL. The deployment corrected an upstream image tag omission in the initial plan and bound the web listener strictly to its private container IP. A DOCKER-USER firewall allowlist was configured to restrict network access to two specific host IPs.

The n5-board management CLI was installed at `~/n5-board/` within an isolated Python 3.14.4 virtual environment, bootstrapping pip via get-pip.py to accommodate non-root user permissions. Verification was strict: 125 test cards seeded across six lists, dry-run diffs verifying zero state drift, a full wipe-and-regeneration reproducing an identical board hash, and all doctor self-checks reporting healthy.

Monitoring was added via three Uptime Kuma HTTP health probes distributed across both nodes. To avoid false positives from failed API registrations, active probe attachments were verified directly against the underlying SQLite database records. External exposure through Cloudflare was kept parked pending manual review.

## False-positive leak alarm inspection

During configuration, an internal security check halted execution, reporting an apparent API key leak in the vault runsheet. Direct inspection revealed a flaw in the verification script: piping grep into head caused the pipeline to exit with status zero regardless of whether matches occurred. Verifying the runsheet confirmed only an eight-character non-sensitive identifier prefix was present, clearing the alert as a check syntax defect rather than a credential exposure.

## Forgejo repository creation and architecture review

Once the board and CLI were functional, the project was organized into a dedicated Forgejo Git repository. Two independent review passes evaluated the initial migration plan before committing.

The first review identified a significant scope omission: the repository plan included CLI source files but omitted the deployment manifests—Docker Compose configurations, systemd units, database backup scripts, and hypervisor firewall rules. A repository containing only the client CLI without its deployment definitions would leave the service unrepeatable. Both code and deployment automation were unified into the repository structure.

The second review caught two implementation defects:
1. The documentation synchronization drift detector injected dynamic UTC timestamps into file headers on every execution, generating false diffs on unchanged content.
2. The credential pre-scan allowlist caused false positives on substring matches (such as `_PAT` within standard English nouns or `TOKEN` inside variable names).

These issues were resolved prior to repository initialization, resulting in a private repository containing 44 tracked files (228 KB) with zero leaked credentials. A planned GitHub push-mirror was deferred, as the existing personal access token lacked permissions to create remote repositories.

## Off-network access via Tailscale and SNAT

Accessing the board remotely over Tailscale revealed that manual credential retrieval was unnecessary. The primary gateway SNATs tailnet traffic to its internal LAN address, placing authenticated Tailscale clients inside the firewall allowlist automatically. This allowed seamless browser access while preserving restricted access rules.

## Scoping the public client repository

Later in the day, planning began for a standalone public version of the tooling (`plankamd`), designed to allow third parties to run the board workflow against external environments.

The architectural pass established clear boundaries:
- Internal hosting on Forgejo cannot serve anonymous public clones due to site-wide authentication policies, requiring public distribution on GitHub.
- Code analysis identified strong coupling in the backlog parser, where brittle markdown heading parsing could drop items silently if formatting differed slightly.
- A proposed branding abstraction was designed to decouple internal lab paths from generic CLI commands, but review highlighted an architectural hurdle: the CLI parsed arguments before loading configuration, requiring a two-phase parser to support dynamic subcommands.

Work closed with the isolated public build initialized at 23:34:01, maintaining a clean boundary from the live private repository while package renaming and argument parsing refactors remain pending.
