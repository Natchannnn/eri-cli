---
title: "The Disk That Read 82% Free and Was 99.9% Full"
date: 2026-09-04
category: Homelab
summary: "Every storage dashboard showed room to spare while the account quota sat at 99.9%. The audit found several other services that were alive but no longer completing work."
---
Read-only audit day. No patches, just documenting what the dashboards claim versus what's actually running. Biggest gap was storage, and it wasn't close.

`df`, node exporter, app APIs: 4.6 TB free on the seedbox volume. `quota -s`: account 99.9% full, ~20 GiB left. `statfs` asks the shared block device; quotas live in the kernel per-account. Every green monitor tracked the wrong layer. Downloader logged `Disk quota exceeded` at 06:08, library service stalled behind it. Burn rate had been ~61 GB/day for two weeks — exhaustion marching in straight-line predictable, invisible to everything I monitored. Quota-aware checks going in this week.

## Three Silent Stalls

Retention container: alive 13 days, zero restarts, schedules green. Rules engine: `handledMediaAmount: 0` on all six collections. Five frozen on an unreleased default grace period (~1.01 TB held), sixth dead on a stale API key (401). Alerts only fire on exceptions — nothing threw, so nobody knew.

Workflow scheduler: four workflows active, container up seven days. DB shows zero runs since 2026-08-28. A brief read-only remount of its volume had frozen the SQLite scheduler with the process still breathing.

Cluster backups: nightly jobs throwing filesystem + GC errors on the nodes. Needs hands-on remediation.

Hosts themselves were fine — reboots clean, Proxmox 3/3 quorum steady. Lesson for the week: liveness isn't completion. Process up + port 200 means the box is on. Whether it did its job needs end-to-end proof and quota-aware monitors.
