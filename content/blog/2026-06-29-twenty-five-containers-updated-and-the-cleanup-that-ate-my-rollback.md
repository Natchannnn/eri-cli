---
title: "Updating Twenty-Five Containers, Docker Image Pruning, and Upstream Build Failures"
date: 2026-06-29
category: Homelab
summary: "A routine maintenance cycle across six Docker Compose stacks uncovered edge cases: a Cloudflare tunnel syntax change, a corrupt upstream build publishing a 9-byte binary, and strict seeder thresholds discarding queries."
---
A routine maintenance pass across my homelab's six Docker Compose projects ended up surfacing several discrete operational issues. The stacks cover home automation, photo management, media automation, telemetry monitoring, reverse proxying, and supporting daemons. While twenty-five containers successfully restarted under updated images, the process exposed a CLI syntax deprecation in Cloudflare tunnel connectors, an upstream container image packaging a 404 response as a 9-byte application payload, and indexer threshold filters silently dropping search results.

## Updating twenty-five containers across six stacks

The fleet comprises six Compose projects along with standalone utility containers. Pulling updated tags and recreating changed containers completed with twenty-five active workloads and passing healthchecks, with one critical exception: the primary Cloudflare tunnel connector entered an immediate crash loop.

Because that single container routes eight public subdomains, the crash effectively took down external ingress. Container logs reported:

```
Error: no valid additional argument has been passed to the tunnel command
```

The `docker-compose.yml` service definition had specified:

```yaml
command: tunnel --no-autoupdate --protocol http2
```

Earlier `cloudflared` images accepted `tunnel` without explicit subcommands, inferring the run invocation. The updated release strictly required the `run` subcommand. Updating line 19 to `tunnel --no-autoupdate run --protocol http2` allowed the connector to register four edge connections within seconds. Cross-checking against an older exited backup container confirmed it had historically used the explicit `run` syntax, highlighting how implicit command fallback had masked the configuration drift.

## Docker layer reclamation: 4.156 GB actual vs 7.21 GB estimated

Upgrading twenty-five containers left fourteen dangling layers. Docker's initial reclaim estimation via `docker system df` reported 7.21 GB as reclaimable space. After executing the prune, the actual reclaimed filesystem space measured 4.156 GB, reducing the local image inventory from 41 to 28 images.

The discrepancy stems from shared base image layers; space calculated for individual orphaned layers does not cleanly translate to net disk recovery when shared parents remain bound to running containers. A key procedural reality of pruning dangling layers immediately post-upgrade is the loss of local rollback images: reverting to a prior release requires fetching upstream registries rather than rolling back locally.

## Diagnosing the 9-byte corrupt JAR release

While the container runtime reported the Discord request bot container as healthy and running, deeper log inspection revealed a continuous failure loop:

```
Error: Invalid or corrupt jarfile /app/app.jar
```

Inspecting the container filesystem showed that `/app/app.jar` was exactly nine bytes in size. Outputting its raw content revealed the ASCII text `Not Found`.

The upstream maintainer's automated CI/CD pipeline had encountered an HTTP 404 during its GitHub release asset fetch step, yet wrote that 404 text string directly into the build artifact without failing the Docker build stage. The entrypoint script executed `java -jar /app/app.jar`, failing instantly on the corrupted magic bytes, exiting, and triggering Compose restart policies continuously. Because the local image cache had been pruned minutes earlier, reverting locally was not possible. Instead, I pinned the Compose file to an explicit prior version tag instead of `latest`. The verified image pulled a 17 MB binary with correct Java archive magic bytes, successfully connecting to the Discord gateway.

## Tuning Prowlarr seeder thresholds for media automation

Following bot restoration, test queries against the media indexing pipeline failed to return releases. Inspecting the indexer query logs showed that searches executed immediately and matched eight potential releases, but every candidate was rejected before routing to the downloader:

```
Filter rejected release: seeder count (7) below minimum threshold (20)
```

Because every indexed tracker reported fewer than twenty seeders for the requested media, the filter discarded all candidates silently. The threshold had originally been hardcoded into the indexer manager, which routinely overwrites individual client service settings during scheduled syncs.

Rather than accepting the default recommendation to lower the threshold to 1 (which risks stalling downloads indefinitely on dead swarms), I adjusted the minimum floor to 5 within the central indexer manager. Retesting the exact query accepted 9 out of 10 candidates, and the media client imported the verified 5.94 GB file within two minutes.

## Expanding NAS storage: 8 TB IronWolf drive addition

Prior to the container maintenance, I carried out a physical storage reconfiguration on the NAS. Adding a second 8 TB Seagate IronWolf drive allowed reorganizing the four bays:

- **Bays 1 & 2**: Two SSDs configured as a striped scratch volume (~3 TB usable).
- **Bays 3 & 4**: Two 8 TB IronWolf HDDs configured as a striped bulk volume (~16 TB raw usable).

Both volumes intentionally run without RAID redundancy to maximize usable capacity, bounded by external snapshot backups. The physical bay allocation ensures that a planned third IronWolf can occupy Bay 2, establishing a contiguous three-drive array. After recreating the shares and restoring roughly 4 TB of data, the filesystem registered 15 TB capacity with 659 GB initially occupied.

## Immich upload failures: Auth lockouts vs proxy payload limits

Following the storage migration, mobile clients reported upload failures on photo assets:

```
The network connection was lost.
```

Initial troubleshooting focused on the Cloudflare Tunnel 100 MB request body limit, as un-chunked high-resolution assets can exceed edge buffer thresholds. However, bypassing the tunnel and targeting the local LAN IP and direct Tailscale node produced the exact same error.

Authentication logs revealed the actual root cause: zero successful sessions and fourteen failed login attempts across three distinct typo variations of the account identifier (omitted characters and password mismatches from saved client state). Five failed attempts had routed via Tailscale IP addresses, confirming network path reachability while isolating the issue entirely to client credential validation. Resetting client credentials resolved the upload pipeline without needing reverse proxy modifications.

## Windows SMB credential caching and storage migration

Remapping the recreated NAS shares on Windows workstations triggered error 1219:

```
The network folder is currently mapped using a different username and password.
```

Windows limits concurrent SMB connections to a single server hostname to one credential context. Background IPC$ sessions established during initial share discovery retained previous session keys. Terminating all active sessions via `net use * /delete /y` flushed the cached credentials, allowing all five drive shares to mount cleanly.

The external 2 TB USB SSD was permanently retired from the primary server, consolidating network storage onto the NAS while repurposing the removed drive as a cold-storage backup destination. With the container stack pinned to stable versions, ingress subcommands standardized, and SMB shares cleared, the infrastructure was restored to a verified baseline.
