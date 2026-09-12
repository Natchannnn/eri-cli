---
title: "Automating Media Ingestion Routing and Open-Sourcing Disclaude Sesh"
date: 2026-07-14
category: Projects
summary: "Bridging the final ingestion gap in a media management pipeline with a custom metadata router, tuning indexer network timeouts, and open-sourcing the Disclaude Sesh management bridge."
---
My home server manages an automated archival and streaming pipeline for media distros and open-source release images. While requests submitted via Discord routed cleanly through Seerr and downstream fetchers, the final ingestion step required manual intervention: downloads accumulated in generic landing folders rather than populating categorized library sections. Resolving this required developing a custom classification sidecar, tuning indexer fetch limits, and hardening server boot dependencies before packaging the Discord management daemon as an open-source utility.

## Eliminating the manual ingestion gap

The media server organizes archives into eight structured categories based on release type and regional origin (feature releases, episodic series, regional foreign language libraries, and a protected family category). 

The automated fetchers deposited completed downloads into two flat download staging directories that the media server did not monitor. While Seerr provided basic routing rules based on tags and languages, evaluating overlapping attributes—such as animated content originating in Asian languages—lacked deterministic priority handling in documentation.

## Deploying an automated classification sidecar

Rather than testing speculative routing configurations against live downloads, I deployed a lightweight classification daemon in Docker. The service runs a Python script on a fifteen-minute polling schedule:

1. Scans staging directories for completed archives.
2. Queries the upstream metadata API to parse genre and primary spoken language attributes.
3. Maps content deterministically:
   - Priority 1: Animation tags route directly to the animated library irrespective of source language.
   - Priority 2: Non-English live-action content routes to designated regional libraries.
   - Priority 3: English live-action content routes to primary library directories.
   - Protected family collections remain strictly isolated from automated routing.
4. Executes atomic filesystem renames (`os.rename`) on the shared backing volume, moving multi-gigabyte archives instantaneously without data duplication.
5. Updates downstream fetcher state via REST API calls so the download manager tracks the new destination path without throwing missing file alarms.

On its initial test run, the daemon correctly identified and routed pending episodic releases, moving them to their respective destination directories within seconds.

## Tuning indexer parameters: Size caps and magnet failover

Investigating intermittent grab failures for large archival packages revealed three configuration bottlenecks:

1. **Size Thresholds**: The global download cap had been set to 5 GB, rejecting full-season releases and large distribution ISOs (typically 20–40 GB). I increased the ceiling to 50 GB, preserving protection against bloated spam archives while allowing legitimate bulk releases.
2. **Bitrate Quality Floors**: Set minimum bitrate constraints to 10 MB per minute to filter low-bitrate transcodes.
3. **Indexer Mirror Timeouts**: The highest-priority indexer routinely timed out fetching `.torrent` metadata files from a degraded mirror domain, producing 112-second HTTP connection hangs and placing the indexer into temporary penalty backoffs. Switching the indexer configuration to prioritize direct BitTorrent magnet URIs bypassed the broken HTTP mirrors, dropping grab latency from two minutes to under four seconds.

## Unattended reboot validation and systemd mount order

Following configuration updates, I executed an unattended reboot test to verify cold-start reliability across all Docker stacks, network shares, and tunnels.

All sixteen system probes returned healthy, but past boots had occasionally suffered from a race condition where the media server and photo daemon started before remote CIFS/NFS mounts were fully mounted by the kernel, presenting empty directories to the containers.

To permanently prevent this race, I added a systemd override drop-in for the Docker daemon:

```ini
[Unit]
After=remote-fs.target
Requires=remote-fs.target
```

This configuration ensures Docker delays container initialization until the kernel's remote filesystem targets are fully mounted and verified.

## Open-sourcing Disclaude Sesh

The final phase of the session focused on sanitizing and publishing `disclaude-sesh`, a two-part bridge that enables managing homelab operations and interactive CLI sessions via Discord bots:

- **Sanitization Pass**: Replaced hardcoded personal server IDs, webhook tokens, local network CIDRs, and absolute directory paths with environment variables and documented configuration templates (`config.example.json`).
- **Security Defaults**: Configured safe defaults out-of-the-box. Administrative privileges, auto-confirmation of destructive actions, and permission bypasses were implemented as explicit opt-in flags with documented security implications.
- **Documentation**: Provided two onboarding workflows—a step-by-step manual setup guide for bare-metal configurations, and a standardized deployment prompt for containerized automation.

The repository was tagged as version `v1.0.0`, closing the loop from local operational automation to a documented, reproducible utility.
