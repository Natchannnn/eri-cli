---
title: "Hybrid Seedbox Migration via SSHFS and Portfolio V2 Deployment"
date: 2026-06-12
category: Projects
summary: "Splitting automation workloads between a local Proxmox host and a remote 22TB seedbox using SSHFS remote hardlinks, alongside deploying the V2 portfolio to Vercel."
---
Migrating media automation workloads off a remote seedbox split responsibilities between local compute and remote high-capacity storage, while the V2 static portfolio was cut over to production.

## Portfolio V2 Redesign and Deployment

The initial portfolio redesign iterated through three visual treatments. The first (an engineering paper aesthetic) was discarded in favor of a dark minimal structure inspired by Premier CS. Because the headless server lacked graphical rendering libraries, I captured video recordings of reference interfaces and extracted thirty discrete frames via `ffmpeg` to guide frontend styling without guessing at layout proportions.

The resulting site features modular project cards, a unified stylesheet, and an automated Markdown-to-HTML reader. The code was migrated to a dedicated repository (`aerwk/Portfolio-V2`), with security scans in place to prevent private notes and keys from committing. Production deployment was established on Vercel under `www.n5hq.me`, with apex redirects and security headers enforced at the edge.

## Hybrid Seedbox Architecture via SSHFS

The primary infrastructure initiative involved decoupling automation daemons from the remote 22TB seedbox. The seedbox retains storage, BitTorrent seeding, and Plex media streaming, while management applications—Radarr, Sonarr, Prowlarr, Overseerr, and a Discord request bridge—were moved to local Docker containers on the home server.

The critical technical challenge was preventing remote downloads from traversing the WAN during automated import. In a standard setup, media managers hardlink completed downloads into library directories instantly on the same filesystem. Over a WAN mount, naïve moves would pull multi-gigabyte files locally before uploading them back.

To resolve this:
1. The remote filesystem was mounted locally over SSHFS using identical relative path structures.
2. Hardlinking behavior was tested directly: executing a hardlink through the SSHFS mount point and inspecting the remote filesystem via SSH confirmed identical inode numbers and an incremented link count (`Links: 2`). Data remained entirely on the remote storage plane without WAN transfer.
3. SSH connection pooling was established to prevent the remote host from rate-limiting concurrent application requests.

## Database Migration and Inactive Telemetry

Application databases were exported and restored into local container instances, preserving historical indexer rules and quality profiles.

During migration, Tautulli monitoring was discovered to have stalled three weeks prior due to a stale container IP link to the Plex server. Over 16,000 historical watch records were migrated into the local instance and reconnected to a static internal host address.

## Remote Ingress and Persistence

The local management instances were exposed via Cloudflare Tunnel across subdomains of `n5hq.me` (`radarr`, `sonarr`, `tautulli`, `overseerr`), each requiring local authentication. A systemd service unit was provisioned on the host to manage SSHFS reconnects and mount persistence across system restarts.

## Pending Verification

- Verify automated SSHFS remount behavior following simulated network drops.
- Monitor remote hardlink creation across completed large-file transfers.
- Decommission redundant indexer proxies remaining on the remote slot.
