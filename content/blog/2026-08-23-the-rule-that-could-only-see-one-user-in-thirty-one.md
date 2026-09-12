---
title: "Retention Rule Scoping Across Multi-User Libraries and Service Freshness Monitoring"
date: 2026-08-23
category: Homelab
summary: "Auditing media retention rules across 31 users, isolating Docker Compose .env restart mechanics, and deploying heartbeat freshness monitors against silent database corruption."
---
Engineering work on August 23 addressed media retention rules for the media library, resolved a Docker environment variable reload issue affecting scheduled tasks, and implemented activity-based freshness monitoring.

## Multi-user retention policy scoping

The media retention policy was designed to prune unaccessed media older than 18 months, with a hard guard preventing the deletion of anything ingested within the last 12 months.

The initial implementation referenced Plex's native `lastPlayedAt` property. An initial dry-run matched 426 items totaling 3,161 GiB. Inspecting the API response revealed that `lastPlayedAt` returned the `lastViewedAt` timestamp solely for the calling administrative account. Across a server with 31 active users, the rule was evaluating only one user's playback history and ignoring the remaining 30 accounts. Six recently watched media items were incorrectly flagged for deletion.

The data source was redirected to Tautulli's aggregated `lastPlayedAt` endpoint, which rolls up watch events across all 31 registered users. Re-running the filter against aggregate telemetry identified 251 genuine pruning candidates totaling 1,435 GiB.

## Docker Compose environment variable lifecycle

A scheduled cron task had been executing with an offset, previously attributed in system notes to missing `tzdata` in the Alpine container base image causing Node to fall back to UTC.

Empirical testing disproved this assumption: while the Alpine container's `/bin/date` utility lacked zoneinfo files, Node bundles its own ICU dataset and resolves timezones independently of host `/usr/share/zoneinfo`.

The root cause was operational: the `TZ` environment variable had been modified in `.env` 22 hours earlier, but the service had only been cycled using `docker compose restart`. A restart command signals existing container processes without re-reading `.env` files; environment variables are baked at container creation. Recreating the container via `docker compose up -d` applied the updated timezone, ensuring the cron task triggered at the intended local hour.

## Activity-based freshness monitoring

Activity freshness monitoring was introduced following a failure where a backend database remained in an unreadable state for 13 days while basic up/down health probes continued reporting healthy (HTTP 200 on `/health` and alive process status).

Four log-based telemetry probes were established to monitor service throughput rather than process existence:
- A 14-hour threshold on a job scheduled every 6 hours (2.3× safety factor).
- A 3-hour threshold on jobs running at 15- and 30-minute intervals.
- A 2-hour threshold on a routine running every 6 hours.

Each probe was configured with `maxretries=0` and `resendInterval=1` to alert immediately on missing heartbeats. Alert delivery was validated in both directions by simulating pipeline stalls to trigger DOWN events and restoring logs to verify UP transitions.

Backups were updated to exclude a corrupt SQLite database file (`Page 2779: never used`, invalid entry counts across three indexes verified by external reads) with documented tickets for database reconstruction.

## Outstanding maintenance items

The corrupt SQLite database remains quarantined pending manual repair, and four inventoried API keys remain scheduled for rotation during the next planned maintenance window. The activity-based freshness monitoring pattern proved effective at catching silent service freezes and is slated for expansion across seven additional background workers.
