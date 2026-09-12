---
title: "Cross-Protocol Hardlink Limitations and Monitoring Migration Planning"
date: 2026-08-21
category: Homelab
summary: "Diagnosing 229 GB of silent file duplication across SSHFS mounts, pinning Maintainerr versions, and backing up Grafana, Prometheus, and Loki volumes ahead of node migration."
---
Homelab maintenance on August 21 addressed two primary tracks: diagnosing silent file duplication across media services, and planning the migration of the monitoring stack off the primary host.

## Diagnosing hardlink failures across SSHFS mounts

Research into automating disk maintenance with Maintainerr prompted an audit of existing library storage utilization. Both Radarr and Sonarr were configured with `copyUsingHardlinks: true` under the expectation that completed downloads and library entries shared identical filesystem inodes.

Inspecting files via `stat` disproved this assumption: library files and completed download files showed a link count of `Links: 1` rather than `Links: 2`, indicating two distinct copies of identical data.

The failure stems from underlying transport limitations: the path connecting download directories to the library is mounted via `sshfs` over SFTP. Because the SFTP protocol lacks remote hardlink primitives, requests to create hardlinks fall back silently to full file copies without logging errors. Consequently, removing items from media managers freed only the library copy while leaving the download copy intact, resulting in 229 GB of unmanaged duplicate storage across both libraries.

This finding altered the disk maintenance plan: running cleanup automation before resolving underlying filesystem duplication would have addressed only half the consumed storage.

## Version pinning rationale for Maintainerr

Evaluating Maintainerr deployment required establishing version pinning practices. The service was configured with `ghcr.io/jorenn92/maintainerr:v3.24.0` rather than `:latest`.

This pinning decision was driven by upstream architecture: the v3.0.0 release introduced structural schema migrations, and subsequent minor releases in the v3.x series included breaking changes relative to v2.x. While legacy services in the stack (Radarr, Sonarr, Tautulli, Bazarr) historically operated on `:latest`, Maintainerr deployment manifests explicitly pinned the tested release tag to prevent unintended container updates from executing unreviewed database migrations.

## Pre-migration audit of monitoring containers

Planning the migration of nine monitoring containers from the primary host to a guest on the second node surfaced two operational dependencies during architectural review:

1. **Entity ID coupling in Home Assistant**: Approximately 66 Home Assistant automation entities were bound to numeric Uptime Kuma monitor IDs rather than hostnames or URLs. Deleting and recreating monitors would generate new IDs, causing automations to fail silently. The migration procedure was updated to require in-place configuration edits rather than recreation.
2. **Unexported Grafana dashboards**: Approximately 15 operational dashboards existed solely inside the Grafana container data volume, without Git repository backups or automated JSON exports. A volume removal during container recreation would result in unrecoverable dashboard loss.

## Verifying monitoring volume snapshots

Ahead of container migration, root-owned data volumes for the monitoring stack were backed up to external storage using a privileged helper container:
- **Prometheus TSDB**: 2.85 GB
- **Grafana**: 95 MB
- **Loki**: 194 MB

SHA256 checksums on source and destination archives matched exactly, and archive structures were verified: Prometheus contained valid ULID blocks, Grafana preserved its SQLite database file, and Loki retained 22,139 chunk files. A corrupted test archive confirmed the checksum validation script properly threw verification errors. With data volumes securely captured, migration of the monitoring containers to the secondary node was staged for the following maintenance window.
