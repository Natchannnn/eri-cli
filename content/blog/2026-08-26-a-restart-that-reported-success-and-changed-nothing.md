---
title: "A Restart That Reported Success and Changed Nothing"
date: 2026-08-26
category: Homelab
summary: "Systemd reported a successful restart while the old container kept running. The gateway work also exposed where prompt caching stopped paying for itself."
---
Stood up a model routing proxy on the primary node — four tiers, two on subscription endpoints, two metered with hard caps ($20 and $10 per rolling 30 days), Postgres backend for logs + transactional spend enforcement.

Validation: 21 live requests through the capped tiers. Every single one logged $0.00.

Config syntax checked out. Tier maps fine. Pricing definitions fine. Stared at those for a while. Then looked at the process: `systemctl restart` on the wrapper unit returned 0, but container uptime showed it never died. The unit restarted. The workload inside didn't. New config mounts never loaded. Exit code 0, nothing changed.

Killed and recreated the container by hand. Costs started accumulating in Postgres immediately.

## The 10.7k Cache Floor

Chased whether my ~4,000-token prompt prefix was actually caching. Didn't trust proxy summaries — benchmarked three placements at matched intervals: prefix in system block, prefix in first user turn, explicit cache-control headers.

Caching works. It just doesn't start until ~10,700 tokens of prefix. Below that, zero benefit. Past it: 91% of input tokens cached, 3.6× effective cost cut against provider billing. My 4k prefix never stood a chance. Documented the floor so I stop guessing at prompt shapes.

## Migrations Broke the Hardcoded Stuff

Made room for the proxy by moving three containers off primary, 40–120s each. Dropped a storage snapshot for the volume move, regenerated right after to keep rollback. Both hostnames 200 externally after.

Four update-rehearsal scripts died on hardcoded legacy node hostnames in their paths. Fixed three on the spot, fourth failed in the next batch run. New policy, written down this time: no physical hostnames in filenames. Abstract service refs only. Docs drift every migration otherwise.

Day closed with two items: a provider key leaked into a benchmark transcript — revoked, 401-verified, replaced, closed. And a client routing alias the gateway doesn't map — frontend sends a display name the proxy never learned. Still open, backlog, needs client-side config.
