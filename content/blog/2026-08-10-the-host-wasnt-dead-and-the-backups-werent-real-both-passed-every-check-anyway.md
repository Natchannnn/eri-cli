---
title: "Cluster Quorum, NIC Failure Isolation, and Verifying Backup Hooks"
date: 2026-08-10
category: Homelab
summary: "Expanding the Proxmox cluster to three nodes, diagnosing an e1000e transmit hang on pve02, and fixing a vzdump monitoring hook that reported false positives."
---
Expanding the homelab to a three-node Proxmox cluster with `pve03` established a 2-of-3 quorum, retiring reliance on `n5ubuntu` for cluster voting. During the expansion, two operational issues surfaced: an `e1000e` NIC lockup that mimicked a host crash, and a backup notification hook that had been reporting false positives on failed runs since late July.

## Three Nodes, One Cluster

`pve03` joined the `n5hq` cluster as node ID 3 using `pvecm add x.x.0.20 --use_ssh 1 --link0 x.x.0.25`. Cluster quorum updated to 2-of-3 with expected votes set to 3. All guest virtual machines and containers remained operational throughout the join without requiring migration or downtime.

Networking on `pve03` was configured with an active-backup bond mirroring `pve01`, pairing a 2.5G USB NIC as primary with the onboard 1GbE interface as failover. A backup of the network configuration was preserved at `/root/interfaces.bak-2026-08-10` prior to applying changes. An apt repository lockout caused by an unauthenticated enterprise repo was removed during the same maintenance pass.

## Isolating the pve02 NIC Failure

At 11:29, `pve02` dropped off the local network, taking the `n5ubuntu` VM (VM 200) with it. Corosync logs on `pve01` recorded link failure on link 0 at 11:29:18, followed by token loss at 11:29:19 and node membership departure at 11:29:24. While these symptoms matched a total host crash, kernel logs showed the machine was operational: the onboard Intel `e1000e` NIC had suffered a transmit-unit hang.

To restore reliable connectivity, a secondary 2.5G USB NIC was connected to `pve02` and configured in an active-backup bond. Failover testing confirmed zero packet loss under link disconnect. The new MAC address was registered on the UniFi network whitelist, and a transient IP conflict from the onboard interface was resolved.

## Correcting the vzdump Backup Hook

Audit of the backup monitoring pipeline revealed that `vzdump-kuma-hook` had been reporting success for failed backup jobs since 2026-07-28. The script pushed status to Uptime Kuma on the `job-end` event, which executes unconditionally whether a backup completes or fails. The `job-abort` event was not triggered in this Proxmox release's hook sequence.

The hook script was rewritten to parse exit status directly and deployed across all three cluster nodes. Each node received an individual push token, and monitor retry counts were set to zero (`maxretries: 0`) to prevent temporary retries from obscuring first-attempt failures. The rewritten hook was validated by running both standard backup jobs and deliberately triggered failure scenarios. Additionally, the `ugnas01-backup` storage target was unpinned from single-node access to cluster-wide availability, allowing all nodes to write backups directly.

## Infrastructure Relocation and Memory Gates

Services running on `n5ubuntu` were migrated ahead of its planned decommissioning. The primary Claude workspace was moved into an unprivileged Debian 13 LXC (`n5claude`, CT 109, `x.x.0.9`) on `pve01`. Five automation consumers (`n5-update-judge.sh`, `n5-doc-stack.sh`, and internal proxy scripts) were repointed to the new container. Security items identified during the migration, including credential exposure and permission hardening, were cataloged in `runsheets/BACKLOG-n5claude-followups.md` for resolution.

The Tailscale subnet router (`1.102.2` at `x.x.27.67`) was transferred to `pve01`. Finally, the memory allocation policy for VM 200 was formalized: the gate was set at host RAM >= 23 GiB with a 16 GiB allocation verified under active workload, maintaining stability without requiring hardware expansion.
