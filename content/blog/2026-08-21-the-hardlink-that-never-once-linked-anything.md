---
title: "The Hardlink That Never Once Linked Anything"
date: 2026-08-21
category: Homelab
summary: "Diagnosing 229 GB of silent file duplication across ZFS dataset boundaries, pinning Maintainerr versions, and backing up monitoring volumes ahead of node migration."
---
I was preparing to deploy Maintainerr to automate disk cleanup across my media libraries when a routine storage check caught my eye. Radarr and Sonarr had `copyUsingHardlinks: true` enabled from day one, so completed downloads in staging and organized files in the library were supposed to point to identical filesystem inodes.

## The stat check and 229 GB of duplicate data

Curious about how much space hardlinking was actually saving, I ran `stat` across a batch of library items:

```bash
stat -c "%n - Inode: %i - Links: %h" /data/media/movies/*
```

Every single file returned `Links: 1`. Not `2`.

The downloads and the library weren't sharing storage at all. They were two separate, distinct files on disk. Removing a movie from Radarr only freed the library file, leaving the initial download sitting untouched in the staging directory. That silent fallback had quietly eaten 229 GB of unmanaged duplicate storage across movies and TV seasons.

## Cross-dataset boundaries, not protocol limits

My first instinct was to blame transport layers. Parts of my remote ingest workflow touch SSHFS mounts over SFTP, and it's easy to assume SFTP lacks remote link primitives. But modern OpenSSH servers support the `hardlink@openssh.com` protocol extension, and manual tests with `ln` worked fine within the same remote directory.

The actual culprit was much more mundane: storage architecture.

In my ZFS pool, downloads lived on `tank/downloads` while the library sat on `tank/media`. Because they were provisioned as two distinct ZFS datasets, Linux treats them as entirely separate filesystems. Attempting to create a hardlink across dataset boundaries returns `EXDEV: Invalid cross-device link`.

Inside Docker, the containers had separate volume mounts for `/downloads` and `/media`. When Radarr and Sonarr hit `EXDEV`, they don't crash or throw a visible alert; they silently catch the error and fall back to an atomic full file copy.

The fix was consolidating storage under a single ZFS dataset (`tank/data`) with subdirectories for downloads and media, then mounting that single root into Docker. Once both paths shared an identical filesystem boundary, hardlinking worked instantly, dropping link creation from several seconds of disk I/O to sub-millisecond inode references.

## Pinning Maintainerr versions

While fixing the storage layout, I set up Maintainerr. Unlike legacy containers in my stack that historically floated on `:latest`, I explicitly pinned `ghcr.io/jorenn92/maintainerr:v3.24.0`.

Maintainerr's v3 release introduced significant database schema migrations and breaking architectural changes compared to v2. Floating on `:latest` in an unattended environment invites background database migrations that can corrupt state or break rules during automated image pulls. Pinning to a known-good release tag keeps updates intentional.

## Pre-migration backups for monitoring

The second half of the maintenance window went toward preparing nine monitoring containers for migration to a guest VM on my secondary node:

1. **Home Assistant entity coupling**: About 66 automations and dashboard cards in Home Assistant were mapped directly to numeric Uptime Kuma monitor IDs. Deleting and recreating monitors on the new host would assign fresh IDs and break those automations silently. The migration had to preserve the existing database state in-place.
2. **Unexported Grafana dashboards**: Around 15 custom dashboards existed exclusively inside the Grafana SQLite database volume, without Git repository backups or automated JSON exports. Rebuilding the container without preserving the volume would mean losing months of dashboard tuning.

Before touching the primary host, I used a helper container to create snapshot archives of the root-owned volumes:
- **Prometheus TSDB**: 2.85 GB
- **Grafana**: 95 MB
- **Loki**: 194 MB (22,139 chunk files)

I verified all SHA256 checksums, confirmed Prometheus ULID blocks and the Grafana SQLite database were intact, and staged the migration for the next window.
