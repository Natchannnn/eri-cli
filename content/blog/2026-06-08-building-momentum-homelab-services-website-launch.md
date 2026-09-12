---
title: "Deploying the Homelab Observability Stack and Initial Portfolio Site"
date: 2026-06-08
category: Projects
summary: "Setting up Prometheus, Grafana, Loki, and UnPoller on an OptiPlex host, exposing Immich via Cloudflare Tunnel, and creating a static portfolio generator from Obsidian markdown notes."
---
Deploying a complete observability stack on the OptiPlex host brought Prometheus, Grafana, Loki, Promtail, Node Exporter, cAdvisor, and UnPoller online as a unified Docker Compose stack, routing operational metrics to a custom dashboard at `status.n5hq.me`.

## The Monitoring Stack

The monitoring deployment focused on capturing system metrics across host hardware and networking components. Using the Grafana Python API, I built a custom Homelab Overview dashboard tracking WAN uptime, connected device counts, container lifecycle states, CPU and memory utilization, disk I/O, network throughput, and UniFi PoE power draw.

Several operational quirks required immediate adjustments:
- Dashboard template imports contained mismatched metric prefixes and unexpanded variables, requiring custom Python patch scripts to normalize datasources.
- Under cgroup v2, cAdvisor failed to expose Docker container names by default, displaying raw hash cgroup paths instead of readable labels.
- The WAN uptime query intermittently dragged down average availability metrics because the inactive failover WAN interface returned a `-1` state. A temporary filter (`wan_networkgroup="WAN"`) was staged to isolate the primary interface.

## Exposing Immich via Cloudflare Tunnel

With the monitoring services running, Immich photo storage was configured for remote access at `photo.n5hq.me`. Rather than deploying a separate tunnel daemon, I added an ingress rule to the existing `cloudflared` instance already routing Home Assistant traffic. Because internal traffic stayed within the host network, no additional port forwarding or router exposure was required.

## Building the Static Site Pipeline

The remainder of the day was spent developing the initial portfolio website and publishing workflow.

The frontend was structured as a mobile-first responsive layout with dedicated sections for homelab infrastructure, active projects, and contact routing via FormSubmit.co.

To eliminate friction in publishing homelab notes, I wrote a Node.js build script to interface directly with markdown journal notes in Obsidian. The script parses frontmatter metadata, synchronizes source files to `blog/posts/`, and compiles a structured `posts.json` manifest for the client-side archive. Initial edge cases—such as duplicate sidebar references and incorrect relative paths in the markdown reader—were resolved during local testing.

## Pending Verification

- Apply the `wan_networkgroup="WAN"` query filter to the Grafana uptime dashboard.
- Evaluate Cloudflare Access policies to add an extra authentication layer in front of the Immich tunnel.
- Update Cloudflare DNS records to point `n5hq.me` apex and `www` CNAMEs to the static hosting target.
