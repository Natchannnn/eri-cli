---
title: "Discord In, Linux ISOs Out — Closing the Last Manual Gap"
date: 2026-07-14
category: Projects
summary: "Bridging the final ingestion gap in a media management pipeline with a custom metadata router, tuning indexer network timeouts, and open-sourcing the Disclaude Sesh management bridge."
---
My home server handles media distros and open-source release images end to end — Discord requests in via Seerr, fetchers grab them. Except the last step was manual. Downloads just piled up in two flat staging folders the media server never watched. Seerr's tag/language routing couldn't decide overlaps deterministically — like animated stuff in Asian languages. Docs were vague. So I stopped guessing and wrote a sidecar.

Little Docker daemon, Python, polls every fifteen minutes:
scans staging, asks the metadata API for genre + spoken language, then routes by priority. Animation tags win outright regardless of language. Then non-English live-action to regional libraries. Then English to primary. Family collection never touches automation, stays isolated.

Moves are `os.rename` on the shared volume — instant, no copy. Then it pokes the downloader over REST so it tracks the new path instead of screaming missing-file. First test run cleared pending episodic releases in seconds.

## Three Bottlenecks Hiding Grab Failures

Big archival packages kept failing to grab. Three causes stacked:

Global cap was 5 GB. Full seasons and distro ISOs run 20–40 GB. Bumped the ceiling to 50 GB — still blocks spam bloat, allows real bulk releases.

Added a 10 MB-per-minute bitrate floor to kill garbage transcodes.

And the top indexer kept hanging 112 seconds fetching `.torrent` files off a dead mirror domain, then eating penalty backoffs. Switched it to prefer magnet URIs direct. Grab latency went from two minutes to under four seconds.

## Reboot Test Caught the Old Race

Ran an unattended reboot to prove cold-start. All sixteen probes green. But I've been burned before: media server + photo daemon starting before CIFS/NFS mounts land, showing containers empty dirs.

Added a systemd override for Docker:

```ini
[Unit]
After=remote-fs.target
Requires=remote-fs.target
```

Docker waits for remote filesystems now. Done.

## Shipped Disclaude Sesh

Last part: cleaned up `disclaude-sesh` — my two-part bridge for running homelab ops and CLI sessions over Discord — and open-sourced it. Ripped out hardcoded server IDs, webhook tokens, CIDRs, absolute paths into env vars + `config.example.json`. Admin powers, auto-confirm destructives, permission bypasses are all explicit opt-ins with warnings. Wrote both a bare-metal manual guide and a container deploy prompt. Tagged `v1.0.0`.
