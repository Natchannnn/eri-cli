---
title: "Uptime Kuma Deployment and Diagnosing Samba Internal DB Corruption"
date: 2026-07-01
category: Homelab
summary: "Deploying Uptime Kuma to monitor 33 homelab services immediately caught an active Immich outage caused by an smbd segmentation fault in /run/samba."
---
To replace ad-hoc manual checks with automated uptime tracking, I deployed an Uptime Kuma instance across the homelab infrastructure. Within minutes of provisioning, the monitoring stack flagged a live outage on `photo.n5hq.me`, leading into a diagnostic trace that isolated a silent CIFS mount drop back to corrupted state files within Samba's runtime directory on the NAS.

## Provisioning Uptime Kuma across 33 endpoints

Uptime Kuma was deployed as a container connected to the internal monitoring network bridge, allowing it to communicate with Prometheus and Grafana instances via Docker service discovery. Rather than manually configuring monitors through the web interface, I scripted the initial setup via the Uptime Kuma socket API using a lightweight Python script.

The script populated 33 monitors across seven operational groups:
- Gateway interfaces and WAN uplinks
- Core hypervisor and NAS hardware endpoints
- Media ingestion and indexing pipelines
- Public-facing reverse proxy domains (`n5hq.me`)
- Offsite seedbox connections
- Local network cameras

The UniFi Protect camera pool resides on an isolated VLAN with no inbound routing from the general server network. To allow HTTP/ICMP status checks without opening broad inter-VLAN routing, I created a firewall rule scoped strictly from the monitoring host's static IP to the camera subnet ports, verifying reachability across all five camera units.

## Detecting the Immich storage outage

Immediately following monitor initialization, the `photo.n5hq.me` healthcheck reported HTTP 502 Bad Gateway. Inspecting the host showed the `immich_server` container in an unhealthy crash loop.

Container error logs reported:

```text
Error: EIO: i/o error, write '/data/upload'
```

The underlying CIFS mount `/mnt/nas/photos` had fallen into an unresponsive I/O state. The host system had been utilizing a systemd automount unit configured with aggressive timeouts. When the network share hung, the automount unit exhausted its retry counter and unmounted the backing directory, causing the container to attempt writes against an unmounted mount point.

Initial attempts to remount the share via `mount -a` failed immediately:

```text
mount error(104): Connection reset by peer
Refer to the mount.cifs(8) manual page (e.g. man mount.cifs)
```

The NAS web interface was fully responsive, ICMP ping latency was sub-millisecond, and port 445 was open. However, every SMB session negotiation terminated abruptly during the protocol handshake. A service restart via the NAS management UI temporarily restored connectivity, but the mount dropped again within two hours under moderate I/O.

## Tracing the Samba segfault to /run/samba

To rule out storage hardware failure on the non-redundant striped volume, I accessed the NAS via SSH and queried SMART status across both 8 TB Seagate IronWolf disks:

```bash
smartctl -H /dev/sda
smartctl -H /dev/sdb
```

Both drives reported `PASSED`, with zero reallocated sectors, zero pending sectors, and no ATA error counts. The filesystem journals showed no underlying block allocation errors.

Inspecting `/var/log/samba/` and checking core dump traces revealed the origin of the connection resets:

```text
smbXsrv_open_create: ... NT_STATUS_INTERNAL_DB_CORRUPTION
INTERNAL ERROR: Signal 11: Segmentation fault in pid 14822
```

The `smbd` daemon crashed and dumped core whenever client connections triggered operations requiring access to its internal session tracking database. Because Samba places its runtime lock and database files (`*.tdb`) in `/run/samba`—a `tmpfs` RAM-backed filesystem—simply toggling the daemon through the management interface kept the corrupted in-memory database file intact. Each restarted daemon instance read the corrupted table and faulted immediately upon client handshake.

Purging the corrupted database files from `/run/samba` while the daemon was stopped, followed by a clean reboot, permanently cleared the state.

## Mount resilience and alert webhooks

To prevent transient file server drops from permanently wedging Docker mounts in the future, I adjusted the `/etc/fstab` configuration for the NAS shares:

- Replaced on-demand systemd automounting with persistent kernel mounts (`_netdev,nofail,hard,intr`).
- Configured connection retry behavior so that momentary network hiccups stall I/O rather than dropping the filesystem out from underneath running containers.

Finally, I integrated Discord webhook alerts within Uptime Kuma using the homelab monitoring bot credentials. The integration delivers push notifications on state changes across all 33 monitored endpoints, ensuring real-time awareness of infrastructure status while the broader task of implementing comprehensive offsite backup redundancy for the NAS array remains ongoing.
