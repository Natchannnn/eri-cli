---
title: "My Monitoring Stack Lies About WAN Uptime and My Site Builds From Obsidian"
date: 2026-06-08
category: Projects
summary: "I brought up the monitoring stack, then learned that one green WAN panel was measuring the wrong thing. The same day, my Obsidian notes became a static site."
---
Spent most of today getting Prometheus, Grafana, Loki, Promtail, Node Exporter, cAdvisor, and UnPoller all up on my OptiPlex as one Docker Compose stack. Metrics are landing on a dashboard I built at `status.n5hq.me`.

I used the Grafana Python API to put together a Homelab Overview board — WAN uptime, device count, container states, CPU and memory, disk I/O, network throughput, UniFi PoE draw. The stuff I actually check when something feels off.

Nothing imported cleanly.
- Dashboard templates I grabbed had wrong metric prefixes and variables that never expanded, so I wrote little Python patch scripts just to normalize datasources.
- Under cgroup v2, cAdvisor refused to show Docker container names, just raw hash cgroup paths.
- My WAN uptime average looked terrible for an hour before I realized the dead failover WAN reports `-1` and drags everything down. Slapped a `wan_networkgroup="WAN"` filter on it for now. Still need to make that permanent.

## Immich Went Remote Without a Second Tunnel

With that running I pointed `photo.n5hq.me` at my Immich. Didn't spin up another `cloudflared` — just added an ingress rule to the one already routing Home Assistant. Internal traffic never leaves the host anyway, so no new firewall holes.

## The Portfolio Site

Rest of the day was the portfolio. Mobile-first layout, sections for my homelab, projects, contact going out through FormSubmit.co. Nothing fancy.

The part I actually care about: I wrote a Node.js build script that reads my markdown notes straight out of Obsidian, parses frontmatter, syncs everything into `blog/posts/`, and rebuilds a `posts.json` manifest for the archive page. Beats running it by hand every time.

It tripped over duplicate sidebar references and bad relative paths on the first few runs. Fixed during testing. DNS for the apex and `www` still needs pointing at the static host, and I want Cloudflare Access in front of Immich eventually. Called it there for tonight.
