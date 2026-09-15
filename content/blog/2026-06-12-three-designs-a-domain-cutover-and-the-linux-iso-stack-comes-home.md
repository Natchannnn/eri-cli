---
title: "My Seedbox Hardlinks Over SSHFS and Portfolio V2 Finally Went Live"
date: 2026-06-12
category: Projects
summary: "Splitting automation workloads between a local Proxmox host and a remote 22TB seedbox using SSHFS remote hardlinks, alongside deploying the V2 portfolio to Vercel."
---
I split my media automation in half today. My remote 22TB seedbox keeps storage, seeding, and Plex. Everything that manages it — Radarr, Sonarr, Prowlarr, Overseerr, plus a Discord request bridge — moved into Docker containers on my home server.

Also cut my Portfolio V2 over to production. Busy day.

## Portfolio V2 Took Three Tries

I went through three looks for the portfolio. First one was an engineering-paper thing. Hated it. Landed on a dark minimal layout cribbed from Premier CS.

My server is headless, no way to screenshot references properly, so I screen-recorded the reference sites and pulled thirty frames out with `ffmpeg` just to get proportions right without guessing.

End result: modular project cards, one stylesheet, a Markdown-to-HTML reader. Moved it all into its own repo (`aerwk/Portfolio-V2`), put scans in place so I don't commit private notes or keys by accident. It's live on Vercel at `www.n5hq.me` with apex redirects and security headers at the edge.

## The SSHFS Hardlink Trick

The scary part of the split: I didn't want every import pulling multi-gig files across the WAN and pushing them back. On one filesystem, Radarr/Sonarr just hardlink a download into the library instantly. Over a WAN mount, a dumb move copies the whole thing.

What I did:

Mounted the remote box locally over SSHFS with identical relative paths. Then I tested it for real — made a hardlink through the mount, SSH'd into the seedbox, checked inodes. Same inode, `Links: 2`. Data never crossed the WAN. Stayed on the remote disks.

I also set up SSH connection pooling because the seedbox starts rate-limiting you if every container opens its own connections.

Migrated the app databases too — exported, restored into the local containers. Kept all my indexer rules and quality profiles.

Found Tautulli had been dead for three weeks, by the way. Stale container IP pointing at Plex. Nobody noticed. Migrated 16,000+ watch records into the local instance and repointed it at a static internal address.

## Ingress

Local apps are exposed through my existing Cloudflare Tunnel under `n5hq.me` — `radarr`, `sonarr`, `tautulli`, `overseerr`, all behind local auth. Added a systemd unit on the host to keep the SSHFS mount alive across reboots.

Still need to watch whether the mount survives a real network drop, and there's leftover indexer proxies on the remote slot I should kill. Left that for next time.
