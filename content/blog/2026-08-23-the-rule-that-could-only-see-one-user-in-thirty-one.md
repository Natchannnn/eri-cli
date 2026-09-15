---
title: "The Rule That Could Only See One User in Thirty-One"
date: 2026-08-23
category: Homelab
summary: "A retention rule covering 31 users had only been checking one of them. Its dry run wanted to remove 3,161GiB before the data model was fixed."
---
My retention rule was about to delete movies people watched last week. Dry run flagged 426 items, 3,161 GiB, under a simple policy: prune anything unplayed 18 months+, never touch anything ingested within the last 12.

Six of the flagged items had been watched days ago. That's when I looked at the data source: Plex's native `lastPlayedAt`. Turns out that field returns `lastViewedAt` for the calling admin account only. My server has 31 active users. The rule was judging the whole library on one person's history and ignoring the other 30.

Repointed at Tautulli's aggregated endpoint, which rolls up all 31 users. Rerun: 251 genuine candidates, 1,435 GiB. Less than half the original flag set. The other 175 were somebody's favorites I nearly shredded.

## restart Doesn't Read .env

Cron task firing an hour off. Old notes blamed missing `tzdata` in Alpine — Node falling back to UTC. Tested it: Alpine's `/bin/date` indeed lacks zoneinfo, but Node ships its own ICU data and resolves timezones without touching `/usr/share/zoneinfo`. Theory dead.

Real cause was dumber. I'd edited `TZ` in `.env` 22 hours earlier and run `docker compose restart`. Restart signals existing processes. It never re-reads `.env` — env is baked at creation. `docker compose up -d` recreated the container, timezone applied, cron fires on local hour now. Twenty-two hours of offset because I used the wrong verb.

## Healthchecks That Check Nothing

This one stung: a backend DB sat unreadable for 13 days while `/health` returned 200 and the process showed alive. Up/down probes check existence. I needed throughput.

Four log-based freshness probes now, watching actual activity instead of process state:
- 14h threshold on a 6-hour job (2.3× margin)
- 3h on the 15- and 30-minute jobs
- 2h on another 6-hour routine

All `maxretries=0`, `resendInterval=1` — missing heartbeat pages immediately. Tested both directions: stalled the pipeline to force DOWN, restored logs for UP.

Backups now exclude a corrupt SQLite file too (`Page 2779: never used`, three indexes with garbage counts on external read). Rebuild ticketed. Four API keys still queued for rotation next window. Freshness pattern works — extending it to seven more background workers next.
