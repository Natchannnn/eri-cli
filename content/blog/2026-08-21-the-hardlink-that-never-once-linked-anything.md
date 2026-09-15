---
title: "The Hardlink That Never Once Linked Anything"
date: 2026-08-21
category: Homelab
summary: "Diagnosing 229 GB of silent file duplication across ZFS dataset boundaries, pinning Maintainerr versions, and backing up monitoring volumes ahead of node migration."
---
About to deploy Maintainerr for disk cleanup, I checked how much space hardlinking actually saves me. Radarr + Sonarr have run `copyUsingHardlinks: true` since day one. Staging downloads and library files should share inodes.

```bash
stat -c "%n - Inode: %i - Links: %h" /data/media/movies/*
```

Every file: `Links: 1`. Every single one.

Nothing ever linked. Each download existed twice — staging copy + library copy, separate files. Deleting a movie in Radarr freed the library side while the staging original sat there forever. 229 GB of silent duplicates across movies and seasons.

## Not SFTP. ZFS Datasets.

First suspect was transport — parts of ingest cross SSHFS/SFTP, easy to assume no remote-link primitive. Wrong: modern OpenSSH supports `hardlink@openssh.com`, and `ln` works fine within one remote dir. Tested, confirmed.

Real cause was dumber: my pool holds `tank/downloads` and `tank/media` as two separate ZFS datasets. Linux sees those as two filesystems. Hardlink across them returns `EXDEV: Invalid cross-device link`. Docker made it worse — `/downloads` and `/media` were separate volume mounts. On `EXDEV`, Radarr/Sonarr don't alert. They catch it and fall back to full copy. Silently. For months.

Fix: one dataset (`tank/data`), subdirs for downloads + media, single root mounted into Docker. Same filesystem boundary both sides. Hardlinks went from seconds of I/O to sub-millisecond inode refs instantly.

## Pinned Maintainerr

Set up Maintainerr while the layout was open. Everything legacy floats `:latest`; I pinned `ghcr.io/jorenn92/maintainerr:v3.24.0` deliberately. v3 brought schema migrations + breaking architecture vs v2. Floating `:latest` with unattended pulls invites background migrations that corrupt state mid-rule-run. Pinned stays intentional.

## Backups Before Moving Monitoring

Second half: prepping nine monitoring containers for a VM on node two. Two traps:

HA has ~66 automations/cards bound to numeric Kuma monitor IDs. Recreate monitors fresh and every ID shifts — automations break silently. Migration must preserve the DB in place.

~15 Grafana dashboards exist only inside the Grafana SQLite volume. No git backups, no JSON exports. Rebuild the container bare and months of tuning evaporate.

Snapshotted the root-owned volumes through a helper container first — Prometheus TSDB 2.85 GB, Grafana 95 MB, Loki 194 MB (22,139 chunks). SHA256s verified, ULID blocks + SQLite intact. Migration staged for next window.
