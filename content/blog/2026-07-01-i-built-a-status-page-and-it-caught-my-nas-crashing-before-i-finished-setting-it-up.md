---
title: "I Built a Status Page and It Caught My NAS Crashing Before I Finished Setting It Up"
date: 2026-07-01
category: Homelab
summary: "Deploying Uptime Kuma to monitor 33 homelab services immediately caught an active Immich outage caused by an smbd segmentation fault in /run/samba."
---
I finally got tired of checking things by hand and deployed Uptime Kuma. Scripted all 33 monitors in via the socket API with a little Python script instead of clicking through the UI — gateway/WAN, hypervisor and NAS, media pipelines, public `n5hq.me` domains, the offsite seedbox, cameras. Seven groups.

Cameras sit on an isolated VLAN with no route from the server net, so I added one tight firewall rule: monitoring host IP → camera subnet, HTTP/ICMP only. All five reachable. Good.

Then `photo.n5hq.me` went red before I'd even finished. 502.

`immich_server` was crash-looping:

```text
Error: EIO: i/o error, write '/data/upload'
```

The CIFS mount at `/mnt/nas/photos` had gone catatonic. I'd set it up as a systemd automount with aggressive timeouts — when the share hung, the unit burned its retries and unmounted from under the container. Containers kept writing into an empty hole.

Tried `mount -a`. Instant:

```text
mount error(104): Connection reset by peer
```

Weird part: NAS web UI fine, ping sub-millisecond, port 445 open. Every SMB handshake just died mid-negotiation. Restarted Samba from the NAS UI — came back, died again within two hours under load.

SSH'd in, ran `smartctl -H` on both 8 TB IronWolfs. Both `PASSED`, zero reallocs, zero pending, no ATA errors. Not the disks. Not the striped volume journals either.

`/var/log/samba` had it:

```text
smbXsrv_open_create: ... NT_STATUS_INTERNAL_DB_CORRUPTION
INTERNAL ERROR: Signal 11: Segmentation fault in pid 14822
```

`smbd` was segfaulting on every handshake that touched its session-tracking DB. And because Samba keeps those `*.tdb` files in `/run/samba` — tmpfs, RAM — restarting the daemon from the UI just reloaded the same corrupted in-memory tables. Crash, restart, crash.

Stopped the daemon, deleted the corrupted DBs out of `/run/samba` by hand, clean reboot. Hasn't dropped since.

While I was there I ripped out the automount units in `/etc/fstab` and switched to persistent mounts (`_netdev,nofail,hard,intr`). Now a network hiccup stalls I/O instead of yanking the filesystem away. Wired Discord webhooks into Kuma too, so all 33 endpoints push on state change.

The NAS array still has no offsite backup. That's the next big ugly job. Not tonight, though.
