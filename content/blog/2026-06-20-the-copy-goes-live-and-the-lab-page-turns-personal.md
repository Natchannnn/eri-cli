---
title: "My Lab Page Was Leaking Internal IPs So I Gutted It"
date: 2026-06-20
category: Projects
summary: "Deploying the revised portfolio copy, removing marketing embellishments from the Lab page, and creating a lightweight public service launcher restricted to tunnel-routed services."
---
Pushed the staged copy to production today — the rewritten About, the `<details>` cards, the anchor jumps. While I was in there I finally fixed `/lab`.

It was trying to be two things: a public showcase and my personal bookmark page. Result was a wall of private services and specs nobody outside my LAN should see.

I do not want my container topology and internal addresses sitting in a public GitHub repo for anyone to recon. So:

- Killed the promo homelab section on the homepage.
- Rebuilt `/lab` as a dumb launcher. Only links to stuff already exposed via Cloudflare Tunnel with auth — Home Assistant, Immich, that kind of thing.
- Local IPs, management ports, Grafana internals? Not there. That's getting its own private portal.
- Host counts (stacks, containers, images, volumes) update from a git pre-commit hook that asks the Docker daemon directly.

Four subpages got the same `<details>` markup as the homepage for consistency. On subpages they default open via the `open` attribute so you see specs immediately. Also fixed a broken anchor on the completed archive — it was pointing nowhere.

One more thing: my June 13 post never made it into the static build. I'd been generating reader pages by hand and just missed it. Wrote a Node script to parse frontmatter, build the HTML, wire prev/next, update the archive manifest. No more hand assembly. Still need to test what it does with missing frontmatter, but it ran clean tonight.
