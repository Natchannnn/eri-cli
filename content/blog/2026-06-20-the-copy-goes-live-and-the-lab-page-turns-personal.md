---
title: "Restructuring the Homelab Page as a Service Launcher"
date: 2026-06-20
category: Projects
summary: "Deploying the revised portfolio copy, removing marketing embellishments from the Lab page, and creating a lightweight public service launcher restricted to tunnel-routed services."
---
Deploying the staged portfolio revisions to production provided an opportunity to audit `/lab`, transforming it from an unfocused promotional section into a clean operational launcher.

## Deploying Staged Copy Revisions

The copy adjustments, native `<details>` project cards, and navigation jump targets staged locally were deployed to production. 

To maintain consistency across views:
- The four dedicated portfolio subpages were updated to use the same `<details>` card markup as the homepage.
- On subpages, the details block is expanded by default via the HTML `open` attribute, ensuring that users navigating to dedicated project routes immediately see technical specifications.
- A broken anchor reference on the completed projects archive was corrected.

## Decoupling Public Launcher from Internal Topologies

The original `/lab` page attempted to function as both a public portfolio showcase and a personal bookmark utility, presenting an excessive list of private services and infrastructure specs.

Committing comprehensive container topologies and internal addresses to a public GitHub repository introduces unnecessary reconnaissance exposure. The page was refactored with clear boundaries:
- The promotional homelab section on the homepage was eliminated.
- The public `/lab` route was rebuilt as a lightweight launcher containing links strictly to services already exposed via Cloudflare Tunnel with active authentication (e.g. Home Assistant, Immich).
- Private local network IPs, direct management ports, and internal Grafana dashboards remain unexposed, deferred to a dedicated private internal portal.
- Host metrics (stack, container, image, and volume counts) are updated via a local git pre-commit hook that queries Docker daemon statistics directly.

## Scripting Blog Generation

Closing an inconsistency where the June 13 journal entry was omitted from the static build led to automating article publishing. Previously, reader pages had been generated manually.

A Node.js build script was written to parse markdown frontmatter, compile HTML prose templates, generate adjacent post navigation, and update the blog archive manifest. This script ensures that published articles retain correct chronologies without manual page assembly.

## Pending Verification

- Verify that no private host IPs appear in public repository manifests.
- Test blog generator against missing or malformed frontmatter.
