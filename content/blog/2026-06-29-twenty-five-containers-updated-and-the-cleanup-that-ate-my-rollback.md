---
title: "Twenty-Five Containers Updated and the Cleanup That Ate My Rollback"
date: 2026-06-29
category: Homelab
summary: "A routine maintenance cycle across six Docker Compose stacks uncovered edge cases: a Cloudflare tunnel syntax change, a corrupt upstream build publishing a 9-byte binary, and strict seeder thresholds discarding queries."
---
Supposed to be routine. Pull new tags across my six Compose stacks — home auto, photos, media, monitoring, proxy, odd daemons — recreate, done. Twenty-five containers came up healthy.

Except the one that routes eight public subdomains was crash-looping.

```
Error: no valid additional argument has been passed to the tunnel command
```

My compose had:

```yaml
command: tunnel --no-autoupdate --protocol http2
```

Old `cloudflared` let you say `tunnel` and guessed you meant run. New one doesn't. It wants the `run` subcommand, explicitly. Changed line 19 to `tunnel --no-autoupdate run --protocol http2`. Four edge connections registered in seconds. Checked an old exited backup container later — yep, it always used `run`. The implicit fallback had just been hiding my drift for months.

## Pruning Cost Me My Rollback

Upgrades left fourteen dangling layers. `docker system df` promised 7.21 GB reclaimable. Actual prune gave back 4.156 GB, 41 images down to 28. Shared base layers — the estimate always lies a little.

The real cost: I'd just deleted every local rollback image ten minutes before I needed one.

My Discord request bot showed healthy. Logs said otherwise, on loop:

```
Error: Invalid or corrupt jarfile /app/app.jar
```

`/app/app.jar` was nine bytes. Nine. Contents: the ASCII text `Not Found`.

Upstream CI had 404'd fetching the GitHub release asset and then baked the 404 body straight into the Docker image without failing the build. Entrypoint ran `java -jar /app/app.jar`, died instantly, Compose restarted it, forever.

Normally I'd just roll back locally. Couldn't — pruned. Pinned compose to the last good version tag instead of `latest`. Good image pulled a real 17 MB jar with proper magic bytes. Connected to the Discord gateway immediately.

## Prowlarr Was Rejecting Everything

Bot fixed, test searches still returned nothing. Logs showed searches running, eight releases found — then all discarded:

```
Filter rejected release: seeder count (7) below minimum threshold (20)
```

Every tracker had under 20 seeders for what I wanted. Threshold was set in the central indexer manager, which overwrites the downstream clients on sync, so fixing it in one place never sticks.

Didn't want to drop it to 1 like people suggest — that's how you stall on dead swarms. Set the floor to 5 in the manager. Retested: 9 of 10 accepted. The 5.94 GB file imported two minutes later.

## The Rest of the Day

Added a second 8 TB IronWolf to the NAS that morning. Bays 1 & 2 are two SSDs striped as scratch (~3 TB). Bays 3 & 4 are the two IronWolfs striped as bulk (~16 TB raw). No RAID on either — capacity over redundancy, with external snapshots as the safety net. Bay 2 is reserved so a third IronWolf can make a contiguous three-drive array later. Restored ~4 TB, filesystem shows 15 TB with 659 GB used.

Immich mobile uploads were also failing with "The network connection was lost." I chased the Cloudflare 100 MB body limit for a while. Red herring — same error over LAN IP and Tailscale. Auth logs showed zero successful logins and fourteen fails across three typo'd usernames from saved client state. Five of those came over Tailscale, so the network was fine. Reset the client creds, uploads worked. No proxy change needed.

Windows remaps threw 1219 — "mapped using a different username and password." One credential context per hostname, old IPC$ sessions holding locks. `net use * /delete /y`, all five shares mounted clean.

Retired the 2 TB USB SSD off the server for good. It's a cold-backup drive now. Stack pinned, tunnel syntax fixed, shares clear. Baseline restored.
