---
title: "Model Proxy Architecture, Prompt Cache Thresholds, and Container Lifecycle Traps"
date: 2026-08-26
category: Homelab
summary: "Deploying a multi-tier model gateway proxy backed by PostgreSQL, debugging systemd container restart failures, benchmarking prompt caching thresholds, and isolating migration breakages."
---
Engineering work on August 26 centered on deploying a multi-tier model proxy gateway with database-backed cost accounting, benchmarking prompt caching characteristics, and migrating workloads across cluster nodes.

## Deploying the model proxy and isolating systemd container restart failures

A multi-tier model routing proxy was provisioned on the primary node to enforce hard spend limits across upstream providers. The gateway defined four operational tiers: two routed to subscription-backed model endpoints and two connected to metered third-party providers with hard spending caps ($20 and $10 per 30-day rolling window). The proxy was deployed with a PostgreSQL database backend to persist request logs and enforce spend limits transactionally.

During initial validation, 21 live requests passed through the capped tiers, but every request logged a cost of $0.00.

Configuration syntax, tier mapping tables, and pricing definitions were verified as correct. Investigating the running environment revealed a discrepancy in process management: executing `systemctl restart` against the proxy wrapper unit returned exit code 0, yet the underlying container process was never terminated. Container uptime metrics confirmed the process had run continuously without picking up modified configuration mounts. The service manager reported successful execution of the wrapper unit while the underlying workload remained unchanged.

Terminating and recreating the container explicitly resolved the issue, after which request costs accumulated accurately in PostgreSQL.

## Empirical benchmarking of prompt caching thresholds

Investigating model token economics addressed an assumption that a ~4,000-token prompt prefix was failing to leverage prompt caching.

Rather than relying on proxy summary statistics, caching mechanics were benchmarked across three configurations at matched intervals:
1. Prefix placed in the system message block.
2. Prefix placed in the initial user turn.
3. Explicit caching control headers applied.

The tests demonstrated that caching was operational but constrained by upstream architecture: input prompt caching required a minimum prefix length of approximately 10,700 tokens before activation. Once crossing the 10.7k-token threshold, caching efficiency reached 91% of input tokens, yielding an effective 3.6× cost reduction verified against upstream provider billing telemetry. Documenting the 10.7k minimum threshold codified clear parameters for prompt structuring.

## Workload migrations and hardcoded hostname dependencies

To accommodate the model proxy deployment, three containers were migrated off the primary node, incurring between 40 and 120 seconds of scheduled maintenance per guest. A storage snapshot was temporarily removed to permit volume migration and regenerated immediately post-cutover to preserve rollback capability. Public ingress was validated through external health checks (HTTP 200) on both primary hostnames.

The migration exposed brittle operational dependencies: four update-rehearsal scripts failed because legacy node hostnames were hardcoded into execution paths. Three scripts were updated immediately, while a fourth failed during subsequent batch runs. This prompted a policy change across operational documentation: removing physical hostnames from file names in favor of abstract service references to prevent documentation drift during future migrations.

## Current operational status

Two items concluded the day with distinct statuses:
- **Key Rotation (Closed)**: A provider API key exposed in an agent session transcript during benchmark testing was revoked immediately, with invalidation verified via upstream HTTP 401 responses, and replaced with a newly minted secret.
- **Client Routing Mapping (Open)**: A client-side routing alias mismatch—where a front-end client passes an unmapped display name unhandled by the gateway proxy—remains unresolved in the project backlog pending client configuration updates.
