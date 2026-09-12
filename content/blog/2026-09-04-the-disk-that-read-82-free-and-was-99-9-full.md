---
title: "Seedbox Storage: When statfs Disagreed with Account Quotas"
date: 2026-09-04
category: Homelab
summary: "A read-only audit of homelab services identified storage quota blind spots, silent retention job failures, and stalled automation workflows."
---
A read-only audit of the homelab examined services, dashboards, and system logs to identify discrepancies between health-check status and actual task execution. Rather than applying immediate patches, each failure state was documented directly from the running environment.

## Storage Quotas vs. Filesystem Free Space

The most significant discrepancy appeared in seedbox storage monitoring. Standard filesystem tools (`df`, Prometheus node exporter, and application APIs) reported 4.6 TB of available storage on the volume. However, running `quota -s` revealed that the hosting provider account was 99.9% full with approximately 20 GiB remaining.

Because filesystem `statfs` calls query the shared block device rather than user-level quota limits enforced by the kernel, standard disk space monitors remained green while the account approached exhaustion. The download client logged `Disk quota exceeded` at 06:08, causing the downstream library service to halt shortly after. Based on a burn rate of roughly 61 GB per day over the previous two weeks, storage exhaustion had progressed predictably without triggering alerts, because monitoring was tracking filesystem capacity rather than the quota limit.

## Retention and Automation Pipeline Audits

The audit identified silent failures across other automation services:

1. **Media retention tool**: The container maintained active status for 13 days with zero restarts and successful scheduled runs. However, an API query against the rules engine showed `handledMediaAmount: 0` across all six collections. Five collections were suspended by an unreleased default grace period holding approximately 1.01 TB, while the sixth failed due to an outdated API key returning HTTP 401. Because error alerts were configured only on explicit exception reporting, the failure went unnoticed.
2. **Workflow automation scheduler**: The automation platform reported all four workflows active and container uptime of seven days. However, database inspection showed zero execution runs since 2026-08-28. This coincided with a brief read-only remount of the container's storage volume, stalling the SQLite-backed scheduler without terminating the container process.
3. **Cluster backups**: Nightly backup routines on the cluster nodes reported intermittent file system and garbage collection errors requiring remediation.

## Verification

Routine infrastructure checks held steady: planned host reboots completed cleanly, and Proxmox cluster quorum remained healthy at 3 of 3 votes. The audit underscored the necessity of augmenting process liveness checks with end-to-end task completion verification and quota-aware monitoring.
