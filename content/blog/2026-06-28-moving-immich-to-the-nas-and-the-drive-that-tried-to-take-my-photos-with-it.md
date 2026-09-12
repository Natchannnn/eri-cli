---
title: "Migrating Immich Storage to the NAS and Diagnosing USB Bus Dropouts"
date: 2026-06-28
category: Homelab
summary: "Migrating 135GB of Immich photo data from a bus-powered external SSD to a network-attached storage pool, diagnosing USB link dropouts during sustained transfers, and verifying file counts."
---
Migrating Immich photo storage from an external SSD to a network-attached storage pool relocated 135GB of media onto larger shared storage while exposing physical USB link instability under sustained load.

## Storage Scope and Architecture

The photo library had initially been hosted on a bus-powered Samsung T7 Shield external SSD mounted at `/mnt/tmpnas`. To consolidate media onto a primary storage pool, Immich was re-targeted to `/mnt/ugnas01-personal`.

An inventory of dependencies confirmed the migration boundary:
- The external SSD held the 135GB Immich library directory along with two empty Samba shares (`/etc/samba/smb.conf`).
- The PostgreSQL database and machine learning models were already running on the server's internal NVMe drive, keeping stateful transaction data off external drives.
- The only configurations requiring modification were Immich's `UPLOAD_LOCATION` environment variable, container bind-mounts, `/etc/fstab`, and Samba shares.

## Diagnosing Source Storage Dropouts

Initiating the data copy to the NAS produced severe transfer degradation. While baseline write benchmarks to the NAS exceeded 190 MB/s, file transfer rates collapsed to individual files taking up to thirty seconds.

Analysis of kernel logs (`dmesg`) revealed that the source ext4 filesystem on `/dev/sdb` had remounted into `emergency_ro,shutdown` after logging unrecoverable I/O errors. The external drive was dropping off the USB bus entirely and re-enumerating under incrementing device numbers (`005`, `006`, `007`).

SMART telemetry confirmed that the NAND flash itself was completely healthy: 0% wear indicators and `PASSED` status across all health metrics. A filesystem check (`fsck`) required only replaying the ext4 journal, verifying that all 121,599 files remained uncorrupted.

The failure was physical USB bus instability under sustained throughput. The drive was stopped, unmounted, and reconnected using a verified USB cable attached directly to a rear motherboard USB 3.2 port. Re-executing the transfer with the new cable sustained a steady 107 MB/s without error.

## Verification and Decommissioning

Following the physical cable swap, Immich was stopped to ensure point-in-time consistency. Data was synchronized via `rsync` with strict file-by-file count verification:
- Library directory: 25,125 files source, 25,125 files destination.
- Thumbnails directory: 49,341 files source, 49,341 files destination.
- Encoded video, automated backup archives, and upload profiles matched exactly.

`UPLOAD_LOCATION` was repointed to the NAS path, and the container stack was brought online. API healthchecks responded immediately, with new uploads writing directly to the network pool.

Following successful validation, the stale local SSD data was purged, the temporary Samba configurations were validated with `testparm` and removed, and the fstab entry was deleted.

## Pending Verification

- Configure off-host scheduled backups for the NAS storage pool, which currently runs without parity redundancy.
- Monitor long-term transfer stability on the replacement USB interface.
