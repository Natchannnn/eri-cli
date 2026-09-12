---
title: "Samsung T7 Shield UAS Timeouts, GRUB Quirks, and Post-Reboot Service Recovery"
date: 2026-06-11
category: Homelab
summary: "Disabling UAS kernel drivers to eliminate severe I/O latency on external SSD storage, diagnosing empty bind-mounts after a host reboot, and automating dev server persistence."
---
Diagnosing severe storage latency on an external Samsung T7 SSD uncovered kernel UAS driver timeouts, requiring a GRUB quirk to stabilize I/O before addressing unexpected service outages following the host reboot.

## Storage Remount and Samba Provisioning

The 2TB external storage drive previously mounted at `/mnt/photos` was designated as a general-purpose host share until dedicated NAS hardware is deployed. The drive was re-mounted at `/mnt/tmpnas`, updating `/etc/fstab` and reconfiguring Immich's `UPLOAD_LOCATION` environment variable.

On top of this mount point, two Samba shares were configured in `/etc/samba/smb.conf`:
- A guest-accessible read/write drop directory for general LAN devices.
- An authenticated, password-restricted share for administrative backups, reachable over Tailscale via `smb://x.x.149.70`.

## Samsung T7 Shield UAS Driver Timeouts

During regular indexing, Immich photo loading stalled completely. Telemetry from `docker stats` revealed `immich_server` holding 147% disk utilization with 25-second flush waits and write latency climbing to 4,864ms.

System journal logs (`dmesg`) revealed repeated `uas_eh_abort_handler` kernel timeouts on `/dev/sda`. The USB Attached SCSI (UAS) protocol was failing on this host controller combination, aborting queued block transactions.

To stabilize disk operations, UAS was disabled specifically for the Samsung T7 Shield (`04e8:61fb`) via kernel parameter. Adding `usb-storage.quirks=04e8:61fb:u` to `GRUB_CMDLINE_LINUX_DEFAULT` in `/etc/default/grub` forced the device to use the standard `usb-storage` driver. Following `update-grub` and a system reboot, write latency dropped from 4,864ms to 37ms, restoring full throughput to container storage.

## Post-Reboot Recovery: Home Assistant Bind-Mounts

While the storage layer stabilized, the host reboot exposed an issue with Home Assistant. External requests through `ha.n5hq.me` returned HTTP 400 Bad Request, while local connections on port 8123 redirected to an initial onboarding wizard.

Timestamp reconstruction clarified the failure sequence:
1. Prior to rebooting, the active `/homeassisstant` data directory had been moved into `/maybebin` during root directory maintenance.
2. Upon restart, Docker auto-created an empty directory at the configured host bind-mount path. Home Assistant initialized a default configuration into this empty directory without reverse proxy trust or existing user accounts.
3. The genuine 3GB instance containing historical data and integrations remained intact in `/maybebin`.

Halting the container, restoring the original directory path, and restarting the stack brought all automations, integrations, and tunnel routing back online. An audit confirmed that automated off-host backups were not yet in place, emphasizing the requirement to build an external backup routine rather than relying on uncommitted disk state.

## Service Persistence

A secondary consequence of the reboot was the termination of the local static development server on port 3001, which had been executed manually without a supervisor. A crontab `@reboot` entry was added to ensure process persistence across future maintenance cycles.

## Pending Verification

- Monitor Samsung T7 I/O queue depths under extended read/write load.
- Implement automated off-host vzdump/tar backups for container data volumes.
- Verify AirTouch 4 integration connectivity.
