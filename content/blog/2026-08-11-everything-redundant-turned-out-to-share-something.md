---
title: "Cluster Migration, Proxmox Backup Server Deployment, and Failure Domain Auditing"
date: 2026-08-11
category: Homelab
summary: "Shrinking and migrating VM 200, deploying Proxmox Backup Server, benchmarking async NFS, and auditing latent single-point-of-failure dependencies across the cluster."
---
Infrastructure work on August 11 encompassed three major operational milestones: migrating VM 200 between Proxmox nodes, provisioning Proxmox Backup Server with verified restores, and conducting a comprehensive failure-domain audit across the cluster.

## VM 200 storage reduction and live migration

VM 200 was shrunk in place from 00:23 to 00:41, incurring 18 minutes of scheduled maintenance. Virtual disk `sda` was resized to 150G with root at 136G, active swap, 30 containers restarted, and systemd reporting all units clean. This dropped local storage utilization on pve02 from 38.41% to 26.57%.

The disk reduction enabled efficient network migration: `qm migrate 200 pve03 --online --with-local-disks` transferred 150.0 GiB (down from 477 GiB), completing in 16 minutes 27 seconds with zero service disruption. System uptime remained continuous (reported at 25 minutes post-transfer), and Immich served HTTP 200 responses throughout. Storage allocation shifted accordingly: pve02 usage fell to 1.98%, while pve03 settled at 25.56%.

During transfer, monitoring revealed pve03 was operating over its 1 GbE standby link rather than the 2.5G primary interface (`enx74****5c7c`), which had remained uninitialized in the network bond with zero link error events. Throughput held steadily at roughly 110 MB/s (~890 Mbps), matching line rate for Gigabit Ethernet, and the bond configuration was corrected later that day.

## Proxmox Backup Server deployment

Proxmox Backup Server was deployed as VM 144 on pve02 (PBS 4.2.5-1 at x.x.0.44), registered cluster-wide as `pbs-n5hq`. Its datastore is backed by a 1 TiB thick iSCSI LUN provisioned from the NAS SSD pool. This intentionally avoids the HDD pool, which had suffered unrecoverable btrfs metadata corruption on August 9 following lost writes during an unclean shutdown.

Incremental deduplication performed as expected: a third backup of CT140 transferred only 32 bytes of changed blocks out of 647.413 MiB in 0.98 seconds. The server was scheduled for its first nightly run at 01:00 on August 12.

Existing backup routines remained active alongside the new deployment: `n5-backup.sh` and the 02:30 vzdump-to-CIFS job were maintained in parallel. The scheduled 02:30 run on August 11 represented the first comprehensive cluster-wide vzdump execution across all three nodes, capturing guests that previously lacked automated snapshots (portal, stirling-pdf, forgejo on pve02, and VM 200 on pve03).

## Empirical restore verification

Three restore drills were executed to validate image integrity:
1. `pct restore` recovered CT140 as VMID 199.
2. `qmrestore` restored VM 200 as VMID 299, expanding a 49 GB archive to 161 GB (44.3% sparse) in 13 minutes, booting successfully.
3. PBS restored CT140 in 4.8 seconds at 135 MiB/s.

While the CT140 restore succeeded, a subsequent review determined that file-count parity (16,875 files) had not been rigorously verified against live checksums, prompting a stricter verification standard for future test runs.

## Shared NFS storage performance benchmarking

Shared storage was established via an NFS export on the NAS SSD pool, mounted across all three nodes as `nas-vm` with `--content images` enabled (excluding container rootfs).

NFS was selected over iSCSI with LVM because LVM thin snapshot limitations would disrupt automated container rollback routines (`pct rollback 133`).

Exporting with asynchronous writes was evaluated against synchronous safety: sequential writes improved from 95.3 MB/s sync to 227 MB/s async, while 4k fsync throughput increased from 849 kB/s to 14.4 MB/s (a 17× improvement, with latency dropping from 4.8 ms to 0.28 ms). The operational tradeoff is an exposure window of approximately 30 seconds (up to ~1.5 GB volatile write cache) during an ungraceful NAS outage. Disk benchmarks across all three nodes showed consistent throughput at 13.2, 14.0, and 13.0 MB/s. VM 200 was kept on local NVMe to protect fsync-heavy workloads (PostgreSQL, Prometheus, and Loki) from network latency.

## Failure domain and architecture audit

A read-only architecture analysis was executed using multiple analytical passes against live cluster state (pve-manager 9.2.10, full 3/3 quorum, zero NVMe media errors; HA unconfigured).

The audit highlighted key shared dependencies across redundant subsystems:
- `kuma1` and `kuma2` run as separate monitoring instances but route alerts to an identical Discord webhook endpoint.
- Fallback service instances were co-located on pve01 alongside primary services.
- The backup server datastore is hosted on the NAS it is intended to hedge against.
- The PBS encryption key used an unsegmented storage model, with both backup copies residing within the physical lab.

An adversarial analysis pass also detected an operational regression during the earlier migration: following a scheduled reboot at 00:24:59, four retired origin containers started automatically alongside their pve02 replacements, operating concurrently until stopped between 05:12 and 05:47. This dual-run caused data divergence in the stirling-pdf H2 database (73,728 bytes vs. 106,496 bytes).

## Automated cluster state and drift detection

To reconcile documentation with production telemetry, automated drift detection was implemented:
- `gen-cluster-state.sh` regenerates `~/docs/cluster-state.md` hourly from Proxmox CLI queries.
- `docs-drift-check.sh` generates a daily drift report at 06:30.
- `drift-checks.sh` validates 14 factual assertions against live infrastructure (correcting documentation errors such as guest VM placement and service HTTP response codes).

## Monitoring system audit

An audit of 63 monitors (48 on kuma1, 15 on kuma2) uncovered critical alert path vulnerabilities:
- Backup failure monitors configured with `maxretries=1` remained in PENDING status on initial failure, requiring two consecutive days of failed backups before alerting.
- WAN and gateway failures generated alert attempts that were dropped without local queuing or retry mechanisms because the notification endpoint was unreachable.
- 13 monitors were misconfigured to accept HTTP 401 and 403 status codes as operational.
- In Uptime Kuma, `updateMonitorNotification()` executed an un-transacted deletion prior to re-insertion, creating notification loss when updates encountered errors.

## Hardware lifetime metrics review

Evaluating SSD wear indicators clarified that 130 unsafe shutdowns recorded on pve01's NVMe represented lifetime cumulative telemetry from previous hardware usage rather than active homelab power instability. Similarly, pve02's SSD recorded 755 historical power losses over 5.06 years of prior operation. Actual ungraceful outages under current ownership were verified at fewer than five events, reinforcing the need for physical UPS protection without misattributing legacy SMART counters.

The live migration, PBS deployment, and restore tests confirmed critical recovery paths for VM and container workloads. At the same time, the failure-domain audit mapped specific architectural coupling: shared webhook targets between independent monitors, co-located fallback guests, and on-premises PBS key storage. These audit findings remain prioritized backlog items, distinguishing verified operational capabilities from pending resilience improvements.
